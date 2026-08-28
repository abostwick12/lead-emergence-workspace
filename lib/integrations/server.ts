import { createClient } from "@supabase/supabase-js";
import { encryptIntegrationValue } from "@/lib/integrations/crypto";
import { connectionScopes, getIntegrationProvider, type IntegrationProviderId } from "@/lib/integrations/providers";

function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error("Workspace is not configured.");
  return { anonKey, url };
}

function encryptionSecret(): string {
  const value = process.env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!value) throw new Error("This connection is being configured. Please try again shortly.");
  return value;
}

function clientFor(accessToken: string) {
  const { anonKey, url } = configuration();
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: process.env.NEXT_PUBLIC_WORKSPACE_SCHEMA?.trim() || "workspace" },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

function encryptedCredential(input: { credential: Record<string, unknown>; provider: IntegrationProviderId; workspaceId: string }): string {
  const provider = getIntegrationProvider(input.provider);
  if (!provider) throw new Error("Unsupported integration provider.");
  return encryptIntegrationValue(
    JSON.stringify(input.credential),
    encryptionSecret(),
    `${input.workspaceId}:${provider.credentialFamily}`
  );
}

function tokenExpiresAt(credential: Record<string, unknown>): string | null {
  return typeof credential.expires_in === "number"
    ? new Date(Date.now() + credential.expires_in * 1000).toISOString()
    : null;
}

export async function verifyWorkspaceOwner(accessToken: string, workspaceId: string): Promise<void> {
  const client = clientFor(accessToken);
  const { data: userData, error: userError } = await client.auth.getUser(accessToken);
  if (userError || !userData.user) throw new Error("Sign in before connecting an integration.");
  const { data, error } = await client
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userData.user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) throw new Error("Only the Workspace owner can change connections.");
}

export async function createOAuthAttempt(input: {
  accessToken: string;
  expiresAt: string;
  provider: IntegrationProviderId;
  stateHash: string;
  workspaceId: string;
}): Promise<void> {
  const { error } = await clientFor(input.accessToken).rpc("create_integration_oauth_attempt", {
    p_workspace_id: input.workspaceId,
    p_provider: input.provider,
    p_state_hash: input.stateHash,
    p_expires_at: input.expiresAt
  });
  if (error) throw new Error("Could not create this connection request.");
}

export async function consumeOAuthAttempt(input: {
  accessToken: string;
  provider: IntegrationProviderId;
  stateHash: string;
  workspaceId: string;
}): Promise<void> {
  const { error } = await clientFor(input.accessToken).rpc("consume_integration_oauth_attempt", {
    p_workspace_id: input.workspaceId,
    p_provider: input.provider,
    p_state_hash: input.stateHash
  });
  if (error) throw new Error("This connection request has expired. Please try again.");
}

export async function saveIntegrationCredential(input: {
  accessToken: string;
  accountLabel?: string | null;
  credential: Record<string, unknown>;
  provider: IntegrationProviderId;
  status?: "connected" | "error" | "disconnected";
  workspaceId: string;
}) {
  const provider = getIntegrationProvider(input.provider);
  if (!provider) throw new Error("Unsupported integration provider.");
  const status = input.status ?? "connected";
  const ciphertext = status === "connected" ? encryptedCredential(input) : null;
  const expiresAt = tokenExpiresAt(input.credential);
  const client = clientFor(input.accessToken);
  const { data, error } = await client.rpc("save_integration_connection", {
    p_workspace_id: input.workspaceId,
    p_provider: provider.id,
    p_provider_family: provider.credentialFamily,
    p_status: status,
    p_account_label: input.accountLabel ?? null,
    p_scopes: [...connectionScopes(provider.id)],
    p_ciphertext: ciphertext,
    p_key_version: 1,
    p_account_subject_hash: null,
    p_token_expires_at: expiresAt,
    p_refresh_token_present: status === "connected" && typeof input.credential.refresh_token === "string"
  });
  if (error || !data) throw new Error("Could not save this connection.");
  return data;
}

export async function saveOAuthIntegrationCredential(input: {
  accessToken: string;
  accountLabel?: string | null;
  credential: Record<string, unknown>;
  provider: IntegrationProviderId;
  stateHash: string;
  workspaceId: string;
}) {
  const provider = getIntegrationProvider(input.provider);
  if (!provider) throw new Error("Unsupported integration provider.");
  const client = clientFor(input.accessToken);
  const { data, error } = await client.rpc("complete_integration_oauth_connection", {
    p_workspace_id: input.workspaceId,
    p_provider: provider.id,
    p_state_hash: input.stateHash,
    p_account_label: input.accountLabel ?? null,
    p_scopes: [...connectionScopes(provider.id)],
    p_ciphertext: encryptedCredential(input),
    p_key_version: 1,
    p_account_subject_hash: null,
    p_token_expires_at: tokenExpiresAt(input.credential),
    p_refresh_token_present: typeof input.credential.refresh_token === "string"
  });
  if (error || !data) throw new Error("Could not save this connection.");
  return data;
}
