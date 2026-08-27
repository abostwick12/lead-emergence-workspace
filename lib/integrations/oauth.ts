import { createHash } from "node:crypto";
import { createOpaqueValue, decryptIntegrationValue, encryptIntegrationValue } from "@/lib/integrations/crypto";
import { getIntegrationProvider, type IntegrationProviderId } from "@/lib/integrations/providers";

export const OAUTH_FLOW_COOKIE = "workspace_integration_oauth";
export const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

type OAuthFlow = {
  accessToken: string;
  codeVerifier: string;
  createdAt: number;
  provider: IntegrationProviderId;
  state: string;
  workspaceId: string;
};

type OAuthServerConfiguration = {
  authorizationEndpoint: string;
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  additionalAuthorizationParameters?: Record<string, string>;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("This connection is being configured. Please try again shortly.");
  return value;
}

function applicationOrigin(): string {
  const value = requiredEnvironment("NEXT_PUBLIC_APP_URL");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("The Workspace application URL must use HTTPS.");
  }
  return parsed.origin;
}

function oauthConfiguration(provider: IntegrationProviderId): OAuthServerConfiguration {
  switch (provider) {
    case "gmail":
    case "google_calendar":
    case "google_drive":
      return {
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
        clientId: requiredEnvironment("WORKSPACE_GOOGLE_OAUTH_CLIENT_ID"),
        clientSecret: requiredEnvironment("WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET"),
        additionalAuthorizationParameters: { access_type: "offline", include_granted_scopes: "true", prompt: "consent" }
      };
    case "slack":
      return {
        authorizationEndpoint: "https://slack.com/oauth/v2/authorize",
        tokenEndpoint: "https://slack.com/api/oauth.v2.access",
        clientId: requiredEnvironment("WORKSPACE_SLACK_OAUTH_CLIENT_ID"),
        clientSecret: requiredEnvironment("WORKSPACE_SLACK_OAUTH_CLIENT_SECRET")
      };
    case "monday":
      return {
        authorizationEndpoint: "https://auth.monday.com/oauth2/authorize",
        tokenEndpoint: "https://auth.monday.com/oauth_ms/oauth/token",
        clientId: requiredEnvironment("WORKSPACE_MONDAY_OAUTH_CLIENT_ID"),
        clientSecret: requiredEnvironment("WORKSPACE_MONDAY_OAUTH_CLIENT_SECRET")
      };
    case "linkedin":
      return {
        authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
        tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
        clientId: requiredEnvironment("WORKSPACE_LINKEDIN_OAUTH_CLIENT_ID"),
        clientSecret: requiredEnvironment("WORKSPACE_LINKEDIN_OAUTH_CLIENT_SECRET")
      };
    case "canva":
      return {
        authorizationEndpoint: "https://www.canva.com/api/oauth/authorize",
        tokenEndpoint: "https://api.canva.com/rest/v1/oauth/token",
        clientId: requiredEnvironment("WORKSPACE_CANVA_OAUTH_CLIENT_ID"),
        clientSecret: requiredEnvironment("WORKSPACE_CANVA_OAUTH_CLIENT_SECRET")
      };
    case "powerpoint": {
      const tenant = requiredEnvironment("WORKSPACE_MICROSOFT_OAUTH_TENANT_ID");
      return {
        authorizationEndpoint: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`,
        tokenEndpoint: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
        clientId: requiredEnvironment("WORKSPACE_MICROSOFT_OAUTH_CLIENT_ID"),
        clientSecret: requiredEnvironment("WORKSPACE_MICROSOFT_OAUTH_CLIENT_SECRET")
      };
    }
    case "youversion":
      return {
        authorizationEndpoint: "https://api.youversion.com/auth/authorize",
        tokenEndpoint: "https://api.youversion.com/auth/token",
        clientId: requiredEnvironment("WORKSPACE_YOUVERSION_OAUTH_CLIENT_ID"),
        clientSecret: requiredEnvironment("WORKSPACE_YOUVERSION_OAUTH_CLIENT_SECRET")
      };
    default:
      throw new Error("This provider uses a different connection method.");
  }
}

function flowSecret(): string {
  return requiredEnvironment("WORKSPACE_INTEGRATION_STATE_SECRET");
}

export function integrationRedirectUri(provider: IntegrationProviderId): string {
  return `${applicationOrigin()}/api/integrations/${provider}/callback`;
}

export function createOAuthFlow(input: { accessToken: string; provider: IntegrationProviderId; workspaceId: string }) {
  const provider = getIntegrationProvider(input.provider);
  if (!provider || provider.connectionMethod !== "oauth") throw new Error("This provider does not use OAuth.");
  const state = createOpaqueValue();
  const codeVerifier = createOpaqueValue();
  const configuration = oauthConfiguration(input.provider);
  const authorizationUrl = new URL(configuration.authorizationEndpoint);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", configuration.clientId);
  authorizationUrl.searchParams.set("redirect_uri", integrationRedirectUri(input.provider));
  authorizationUrl.searchParams.set("scope", provider.scopes.join(" "));
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set("code_challenge", createHash("sha256").update(codeVerifier).digest("base64url"));
  for (const [key, value] of Object.entries(configuration.additionalAuthorizationParameters ?? {})) {
    authorizationUrl.searchParams.set(key, value);
  }
  const flow: OAuthFlow = { accessToken: input.accessToken, codeVerifier, createdAt: Date.now(), provider: input.provider, state, workspaceId: input.workspaceId };
  return {
    authorizationUrl: authorizationUrl.toString(),
    state,
    sealedFlow: encryptIntegrationValue(JSON.stringify(flow), flowSecret(), "workspace-integration-oauth-flow")
  };
}

export function createGitHubAppFlow(input: { accessToken: string; workspaceId: string }) {
  const slug = requiredEnvironment("WORKSPACE_GITHUB_APP_SLUG");
  if (!/^[a-z0-9-]+$/i.test(slug)) throw new Error("GitHub App configuration is invalid.");
  const state = createOpaqueValue();
  const flow: OAuthFlow = {
    accessToken: input.accessToken,
    codeVerifier: "",
    createdAt: Date.now(),
    provider: "github",
    state,
    workspaceId: input.workspaceId
  };
  const authorizationUrl = new URL(`https://github.com/apps/${slug}/installations/new`);
  authorizationUrl.searchParams.set("state", state);
  return {
    authorizationUrl: authorizationUrl.toString(),
    state,
    sealedFlow: encryptIntegrationValue(JSON.stringify(flow), flowSecret(), "workspace-integration-oauth-flow")
  };
}

export function readOAuthFlow(value: string, provider: IntegrationProviderId, state: string): OAuthFlow {
  const parsed = JSON.parse(decryptIntegrationValue(value, flowSecret(), "workspace-integration-oauth-flow")) as OAuthFlow;
  if (parsed.provider !== provider || parsed.state !== state || Date.now() - parsed.createdAt > OAUTH_FLOW_TTL_MS || Date.now() < parsed.createdAt) {
    throw new Error("This connection request has expired. Please try again.");
  }
  return parsed;
}

export function oauthStateHash(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export async function exchangeOAuthCode(input: { code: string; codeVerifier: string; provider: IntegrationProviderId }): Promise<Record<string, unknown>> {
  const configuration = oauthConfiguration(input.provider);
  const body = new URLSearchParams({
    client_id: configuration.clientId,
    client_secret: configuration.clientSecret,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: integrationRedirectUri(input.provider)
  });
  const response = await fetch(configuration.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store"
  });
  if (!response.ok) throw new Error("The provider did not approve this connection.");
  const token = await response.json();
  if (!token || typeof token !== "object" || typeof token.access_token !== "string") {
    throw new Error("The provider returned an invalid connection response.");
  }
  return token as Record<string, unknown>;
}

export function workspaceApplicationOrigin(): string {
  return applicationOrigin();
}
