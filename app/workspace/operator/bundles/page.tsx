import { BundleOperatorConsole } from "@/components/bundle-operator-console";
import { createWorkspaceServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BundleOperatorPage() {
  const supabase = await createWorkspaceServerClient();
  const { data } = await supabase.auth.getUser();
  const authorized = data.user?.app_metadata?.workspace_bundle_operator === true;

  return <section className="workflow-page" aria-label="Bundle pilot operations">
    <p className="eyebrow workflow-kicker">Pilot operations</p>
    <h1 className="page-title">Manage bundle access without database edits.</h1>
    <p className="page-lede">Assignments and invites use the same canonical entitlement model. Every write is re-authorized by the database and records its issuer and source.</p>
    {authorized
      ? <BundleOperatorConsole />
      : <p className="error" role="alert" style={{ marginTop: 20 }}>Bundle operator authorization is required.</p>}
  </section>;
}
