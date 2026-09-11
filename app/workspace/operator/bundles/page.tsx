import { BundleOperatorConsole } from "@/components/bundle-operator-console";
import { createWorkspaceServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BundleOperatorPage() {
  const supabase = await createWorkspaceServerClient();
  const { data } = await supabase.auth.getUser();
  const authorized = data.user?.app_metadata?.workspace_bundle_operator === true;

  return <section className="workflow-page" aria-label="Bundle access operations">
    <p className="eyebrow workflow-kicker">Client access</p>
    <h1 className="page-title">Give each client exactly the bundles they need.</h1>
    <p className="page-lede">Verify the client, review their current access, and grant or remove any active bundle. Every change is re-authorized by the database and preserved in the audit history.</p>
    {authorized
      ? <BundleOperatorConsole />
      : <p className="error" role="alert" style={{ marginTop: 20 }}>Bundle operator authorization is required.</p>}
  </section>;
}
