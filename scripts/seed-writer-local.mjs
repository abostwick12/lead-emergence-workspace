import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { appUrl, localConfiguration, localSql, fixtureSession } from "./bundle-local-runtime.mjs";

const config = await localConfiguration();
await writeFile(".bundle-local/public-config.json", JSON.stringify({ url: config.API_URL, anonKey: config.ANON_KEY }));
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fixtures = {};
for (const name of ["writer", "reader", "other", "operator"]) {
  const id = randomUUID();
  const fixture = { id, email: "p2." + name + "." + id.slice(0, 8) + "@example.invalid", password: randomBytes(24).toString("base64url") };
  const created = await admin.auth.admin.createUser({ id, email: fixture.email, password: fixture.password,
    email_confirm: true, app_metadata: name === "operator" ? { workspace_bundle_operator: true } : {},
    user_metadata: { full_name: "Synthetic " + name } });
  if (created.error) throw new Error("Synthetic user creation failed.");
  // A local legacy Workspace fixture exercises real browser sign-in without
  // inventing or bypassing the production Entry identity provider.
  const workspaceId = randomUUID();
  localSql(`
    insert into workspace.user_profiles(user_id,display_name) values ('${id}','Synthetic ${name}');
    insert into workspace.workspaces(id,workspace_type,name,owner_user_id) values ('${workspaceId}','personal','Synthetic P2 ${name}','${id}');
    insert into workspace.workspace_memberships(workspace_id,user_id,role,status) values ('${workspaceId}','${id}','owner','active');
  `);
  const session = await fixtureSession(config, fixture);
  const { data, error } = await session.client.rpc("ensure_personal_workspace").single();
  if (error || !data?.id) throw new Error("Synthetic Workspace provisioning failed: " + error?.message);
  fixture.workspaceId = data.id;
  fixtures[name] = fixture;
}
const writerResourceId = randomUUID(), foreignResourceId = randomUUID();
localSql(`
  update workspace.personal_onboarding set state='workspace_ready' where user_id in ('${fixtures.writer.id}','${fixtures.reader.id}','${fixtures.other.id}','${fixtures.operator.id}');
  insert into workspace_private.writing_resources(id,workspace_id,title,author,resource_type,audience,topics,abstract,body_text,source_url,source_label,source_date,publication_state) values
  ('${writerResourceId}','${fixtures.writer.workspaceId}','The practice of paying attention','A. Example','article',null,array['Attention','Community'],'A short reflection on noticing the people and places around us.','The practice of paying attention\n\nGood work begins with noticing. We listen carefully, name what we have heard, and make room for the person whose experience differs from our own.\n\nA useful next step can be small: one conversation, one question, one act of care. What matters is that it responds to what is actually in front of us.','https://example.com/resources/attention','Synthetic acceptance manuscript','2026-09-01','in_review'),
  (gen_random_uuid(),'${fixtures.writer.workspaceId}','A guide to welcoming new neighbors','A. Example','study_guide','Community volunteers',array['Welcome','Community'],'Questions for a first neighborhood conversation.','Begin by asking what neighbors already value about their community. Record their answers in their own words.','https://example.com/resources/welcome','Synthetic acceptance study guide','2026-09-02','ready'),
  (gen_random_uuid(),'${fixtures.writer.workspaceId}','Learning through small commitments','A. Example','teaching','Small groups',array['Learning'],'A teaching outline on following through.','Choose one commitment and a time to return to it.',null,'Synthetic acceptance teaching','2026-09-03','draft'),
  ('${foreignResourceId}','${fixtures.other.workspaceId}','PRIVATE OTHER WORKSPACE RESOURCE','Other Example','article','Other reader',array['Private'],'A separate tenant fixture.','This text must never be returned to the first writer.',null,'Synthetic other-tenant source','2026-09-04','draft');
  update workspace_private.product_settings set setting_value='true' where setting_key='mcp_dynamic_admission_enabled';
  update workspace_private.product_settings set setting_value='https://workspace.leademergence.com/api/mcp' where setting_key='mcp_resource_uri';
`);
const operator = await fixtureSession(config, fixtures.operator);
for (const name of ["writer", "other"]) {
  const result = await operator.client.rpc("issue_bundle_assignment", {
    target_workspace_id: fixtures[name].workspaceId, target_bundle_key: "writer_editor",
    idempotency_key: "p2-" + name + "-" + randomUUID(), target_expires_at: null
  });
  if (result.error) throw new Error("Synthetic assignment failed: " + result.error.message);
  fixtures[name].entitlementId = result.data.entitlement_id;
}
const output = { ...fixtures, writerResourceId, foreignResourceId, appUrl };
await writeFile(".bundle-local/fixtures.json", JSON.stringify(output, null, 2));
console.log("Created isolated synthetic Writer, Reader, second-tenant, and operator fixtures.");
