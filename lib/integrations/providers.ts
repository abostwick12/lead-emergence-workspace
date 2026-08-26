export const INTEGRATION_PROVIDER_IDS = [
  "logos",
  "chatgpt",
  "claude",
  "gmail",
  "slack",
  "google_calendar",
  "monday",
  "github",
  "linkedin",
  "google_drive",
  "firecrawl",
  "canva",
  "powerpoint",
  "youversion"
] as const;

export type IntegrationProviderId = (typeof INTEGRATION_PROVIDER_IDS)[number];
export type IntegrationConnectionMethod = "oauth" | "api_key" | "github_app" | "oauth1";

export type IntegrationProvider = {
  id: IntegrationProviderId;
  credentialFamily: string;
  connectionMethod: IntegrationConnectionMethod;
  setupLabel: string;
  scopes: readonly string[];
  supportsDisconnect: boolean;
};

export const GOOGLE_WORKSPACE_CONNECTION_IDS = ["gmail", "google_calendar"] as const;
type GoogleWorkspaceConnectionId = (typeof GOOGLE_WORKSPACE_CONNECTION_IDS)[number];

export const INTEGRATION_PROVIDERS: Record<IntegrationProviderId, IntegrationProvider> = {
  logos: {
    id: "logos",
    credentialFamily: "logos",
    connectionMethod: "oauth1",
    setupLabel: "Connect Logos",
    scopes: [],
    supportsDisconnect: true
  },
  chatgpt: {
    id: "chatgpt",
    credentialFamily: "openai",
    connectionMethod: "api_key",
    setupLabel: "Add OpenAI API key",
    scopes: [],
    supportsDisconnect: true
  },
  claude: {
    id: "claude",
    credentialFamily: "anthropic",
    connectionMethod: "api_key",
    setupLabel: "Add Anthropic API key",
    scopes: [],
    supportsDisconnect: true
  },
  gmail: {
    id: "gmail",
    credentialFamily: "google",
    connectionMethod: "oauth",
    setupLabel: "Connect Gmail",
    scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose"],
    supportsDisconnect: true
  },
  slack: {
    id: "slack",
    credentialFamily: "slack",
    connectionMethod: "oauth",
    setupLabel: "Connect Slack",
    scopes: ["chat:write", "channels:read", "groups:read"],
    supportsDisconnect: true
  },
  google_calendar: {
    id: "google_calendar",
    credentialFamily: "google",
    connectionMethod: "oauth",
    setupLabel: "Connect Google Calendar",
    scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar.events.readonly"],
    supportsDisconnect: true
  },
  monday: {
    id: "monday",
    credentialFamily: "monday",
    connectionMethod: "oauth",
    setupLabel: "Connect Monday.com",
    scopes: ["me:read", "boards:read", "workspaces:read"],
    supportsDisconnect: true
  },
  github: {
    id: "github",
    credentialFamily: "github",
    connectionMethod: "github_app",
    setupLabel: "Install GitHub App",
    scopes: [],
    supportsDisconnect: true
  },
  linkedin: {
    id: "linkedin",
    credentialFamily: "linkedin",
    connectionMethod: "oauth",
    setupLabel: "Connect LinkedIn",
    scopes: ["openid", "profile", "email"],
    supportsDisconnect: true
  },
  google_drive: {
    id: "google_drive",
    credentialFamily: "google",
    connectionMethod: "oauth",
    setupLabel: "Connect Google Drive",
    scopes: ["openid", "email", "https://www.googleapis.com/auth/drive.file"],
    supportsDisconnect: true
  },
  firecrawl: {
    id: "firecrawl",
    credentialFamily: "firecrawl",
    connectionMethod: "api_key",
    setupLabel: "Add Firecrawl API key",
    scopes: [],
    supportsDisconnect: true
  },
  canva: {
    id: "canva",
    credentialFamily: "canva",
    connectionMethod: "oauth",
    setupLabel: "Connect Canva",
    scopes: ["openid", "profile", "design:meta:read"],
    supportsDisconnect: true
  },
  powerpoint: {
    id: "powerpoint",
    credentialFamily: "microsoft",
    connectionMethod: "oauth",
    setupLabel: "Connect Microsoft 365",
    scopes: ["openid", "profile", "offline_access", "User.Read", "Files.ReadWrite"],
    supportsDisconnect: true
  },
  youversion: {
    id: "youversion",
    credentialFamily: "youversion",
    connectionMethod: "oauth",
    setupLabel: "Connect YouVersion",
    scopes: ["openid", "profile", "email"],
    supportsDisconnect: true
  }
};

const GOOGLE_WORKSPACE_SCOPES = Object.freeze(
  [...new Set(GOOGLE_WORKSPACE_CONNECTION_IDS.flatMap((providerId) => INTEGRATION_PROVIDERS[providerId].scopes))]
);

export function isIntegrationProviderId(value: string): value is IntegrationProviderId {
  return INTEGRATION_PROVIDER_IDS.includes(value as IntegrationProviderId);
}

export function getIntegrationProvider(id: string): IntegrationProvider | undefined {
  return isIntegrationProviderId(id) ? INTEGRATION_PROVIDERS[id] : undefined;
}

export function isGoogleWorkspaceConnection(id: IntegrationProviderId): id is GoogleWorkspaceConnectionId {
  return (GOOGLE_WORKSPACE_CONNECTION_IDS as readonly string[]).includes(id);
}

export function connectionScopes(providerId: IntegrationProviderId): readonly string[] {
  return isGoogleWorkspaceConnection(providerId) ? GOOGLE_WORKSPACE_SCOPES : INTEGRATION_PROVIDERS[providerId].scopes;
}

export function connectedProviders(providerId: IntegrationProviderId): readonly IntegrationProviderId[] {
  return isGoogleWorkspaceConnection(providerId) ? GOOGLE_WORKSPACE_CONNECTION_IDS : [providerId];
}
