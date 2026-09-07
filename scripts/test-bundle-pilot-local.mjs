import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.BUNDLE_ACCEPTANCE_APP_URL || "http://127.0.0.1:3105";

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Local Supabase URL, anon key, and test-only service role key are required.");
}
if (!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(supabaseUrl)) {
  throw new Error("Bundle acceptance may run only against loopback Supabase.");
}
if (!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(appUrl)) {
  throw new Error("Bundle acceptance may run only against a loopback app server.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "workspace" }
});

const fixtures = {
  operator: { id: "91111111-1111-4111-8111-111111111111", email: "api.operator@example.invalid", password: "BundlePilotOperator!2026" },
  founder: { id: "92222222-2222-4222-8222-222222222222", email: "api.founder@example.invalid", password: "BundlePilotFounder!2026", workspaceId: "92aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  invitee: { id: "93333333-3333-4333-8333-333333333333", email: "api.invitee@example.invalid", password: "BundlePilotInvitee!2026", workspaceId: "93bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }
};

async function createFixtureUser(fixture, appMetadata = {}) {
  const { error } = await admin.auth.admin.createUser({
    id: fixture.id,
    email: fixture.email,
    password: fixture.password,
    email_confirm: true,
    app_metadata: appMetadata
  });
  if (error) throw error;
}

async function signIn(fixture) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "workspace" }
  });
  const { data, error } = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  if (error || !data.session?.access_token) throw error || new Error(`Could not sign in ${fixture.email}.`);
  return { accessToken: data.session.access_token, client };
}

async function provisionFixtureWorkspace(fixture, client) {
  const { error: profileError } = await client.from("user_profiles").insert({
    user_id: fixture.id,
    display_name: fixture === fixtures.founder ? "API Founder" : "API Invitee"
  });
  if (profileError) throw profileError;
  const { error: workspaceError } = await client.from("workspaces").insert({
    id: fixture.workspaceId,
    workspace_type: "personal",
    name: fixture === fixtures.founder ? "API Founder Workspace" : "API Invitee Workspace",
    owner_user_id: fixture.id
  });
  if (workspaceError) throw workspaceError;
  const { error: membershipError } = await client.from("workspace_memberships").insert({
    workspace_id: fixture.workspaceId,
    user_id: fixture.id,
    role: "owner",
    status: "active"
  });
  if (membershipError) throw membershipError;
}

async function request(path, accessToken, init = {}) {
  const response = await fetch(`${appUrl}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  const payload = await response.json();
  return { payload, response };
}

try {
  await createFixtureUser(fixtures.operator, { workspace_bundle_operator: true });
  await createFixtureUser(fixtures.founder);
  await createFixtureUser(fixtures.invitee);

  const [operatorSession, founderSession, inviteeSession] = await Promise.all([
    signIn(fixtures.operator), signIn(fixtures.founder), signIn(fixtures.invitee)
  ]);
  const operatorToken = operatorSession.accessToken;
  const founderToken = founderSession.accessToken;
  const inviteeToken = inviteeSession.accessToken;
  await provisionFixtureWorkspace(fixtures.founder, founderSession.client);
  await provisionFixtureWorkspace(fixtures.invitee, inviteeSession.client);

  const assignmentBody = JSON.stringify({
    workspaceId: fixtures.founder.workspaceId,
    bundleKey: "sotf_transition",
    idempotencyKey: "api-founder-grant-001",
    expiresAt: null
  });
  const firstAssignment = await request("/api/operator/bundles/assign", operatorToken, { method: "POST", body: assignmentBody });
  assert.equal(firstAssignment.response.status, 200);
  assert.equal(firstAssignment.payload.entitlement.state, "active");
  const repeatedAssignment = await request("/api/operator/bundles/assign", operatorToken, { method: "POST", body: assignmentBody });
  assert.equal(repeatedAssignment.response.status, 200);
  assert.equal(repeatedAssignment.payload.entitlement.idempotent_replay, true);

  const { count: founderEntitlementCount, error: founderCountError } = await founderSession.client
    .from("bundle_entitlements")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", fixtures.founder.workspaceId)
    .eq("bundle_key", "sotf_transition");
  if (founderCountError) throw founderCountError;
  assert.equal(founderEntitlementCount, 1);

  const founderResolution = await request(`/api/workspaces/${fixtures.founder.workspaceId}/bundles/sotf_transition`, founderToken);
  assert.equal(founderResolution.response.status, 200);
  assert.equal(founderResolution.payload.entitlement.state, "active");

  const ordinaryAssignment = await request("/api/operator/bundles/assign", founderToken, { method: "POST", body: assignmentBody });
  assert.equal(ordinaryAssignment.response.status, 403);

  const inviteBody = JSON.stringify({
    recipientEmail: fixtures.invitee.email,
    bundleKey: "sotf_transition",
    idempotencyKey: "api-invite-001",
    expiresAt: null
  });
  const issuedInvite = await request("/api/operator/bundles/invites", operatorToken, { method: "POST", body: inviteBody });
  assert.equal(issuedInvite.response.status, 200);
  assert.equal(issuedInvite.payload.invite.status, "pending");
  assert.equal("token_hash" in issuedInvite.payload.invite, false);
  const repeatedInvite = await request("/api/operator/bundles/invites", operatorToken, { method: "POST", body: inviteBody });
  assert.equal(repeatedInvite.response.status, 200);
  assert.equal(repeatedInvite.payload.invite.idempotent_replay, true);
  assert.equal(repeatedInvite.payload.inviteUrl, issuedInvite.payload.inviteUrl);

  const inviteToken = new URL(issuedInvite.payload.inviteUrl).searchParams.get("token");
  assert.ok(inviteToken);
  const firstClaim = await request("/api/bundles/invites/claim", inviteeToken, {
    method: "POST",
    body: JSON.stringify({ token: inviteToken })
  });
  assert.equal(firstClaim.response.status, 200);
  assert.equal(firstClaim.payload.claim.entitlement.state, "active");
  assert.equal(firstClaim.payload.claim.entitlement.source, "invite");
  const repeatedClaim = await request("/api/bundles/invites/claim", inviteeToken, {
    method: "POST",
    body: JSON.stringify({ token: inviteToken })
  });
  assert.equal(repeatedClaim.response.status, 200);
  assert.equal(repeatedClaim.payload.claim.idempotent_replay, true);

  const { count: inviteeEntitlementCount, error: inviteeCountError } = await inviteeSession.client
    .from("bundle_entitlements")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", fixtures.invitee.workspaceId)
    .eq("bundle_key", "sotf_transition");
  if (inviteeCountError) throw inviteeCountError;
  assert.equal(inviteeEntitlementCount, 1);

  const inviteeResolution = await request(`/api/workspaces/${fixtures.invitee.workspaceId}/bundles/sotf_transition`, inviteeToken);
  assert.equal(inviteeResolution.response.status, 200);
  assert.equal(inviteeResolution.payload.entitlement.state, "active");

  const revocableInvite = await request("/api/operator/bundles/invites", operatorToken, {
    method: "POST",
    body: JSON.stringify({
      recipientEmail: fixtures.invitee.email,
      bundleKey: "sotf_transition",
      idempotencyKey: "api-revoked-invite-001",
      expiresAt: null
    })
  });
  assert.equal(revocableInvite.response.status, 200);
  const revoked = await request("/api/operator/bundles/invites/revoke", operatorToken, {
    method: "POST",
    body: JSON.stringify({ inviteId: revocableInvite.payload.invite.invite_id, reason: "Acceptance test withdrawal." })
  });
  assert.equal(revoked.response.status, 200);
  assert.equal(revoked.payload.invite.status, "revoked");
  const revokedToken = new URL(revocableInvite.payload.inviteUrl).searchParams.get("token");
  const revokedClaim = await request("/api/bundles/invites/claim", inviteeToken, {
    method: "POST",
    body: JSON.stringify({ token: revokedToken })
  });
  assert.equal(revokedClaim.response.status, 403);

  const invalidClaim = await request("/api/bundles/invites/claim", inviteeToken, {
    method: "POST",
    body: JSON.stringify({ token: "bi1.0123456789012345678901234567890123456789012" })
  });
  assert.equal(invalidClaim.response.status, 403);

  console.log("Bundle API acceptance PASS: founder assignment, invite issuance/claim, retries, authorization, revocation, and canonical resolution.");
} catch (error) {
  console.error("Bundle acceptance failed. Reset the repository-local Supabase database before retrying.");
  throw error;
}
