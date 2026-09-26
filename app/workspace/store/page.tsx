import { CUSTOMER_RELEASE_INDEX } from "@/lib/workspace/customer-release-index";

export default function StorePage() {
  const approvedBundleManifests = CUSTOMER_RELEASE_INDEX.approvedBundleManifests;

  return <section className="workflow-page" aria-label="Bundle Store">
    <header className="workflow-heading">
      <p className="eyebrow workflow-kicker">Workspace</p>
      <h1 className="page-title">Store</h1>
      <p className="page-lede">Browse bundles approved for customers.</p>
    </header>
    {approvedBundleManifests.length === 0
      ? <article className="card" aria-labelledby="store-empty-title">
        <h2 id="store-empty-title">No bundles are available yet</h2>
        <p>Customer-approved bundles will appear here when they are published.</p>
      </article>
      : <section className="grid two" aria-label="Customer-approved bundles">
        {approvedBundleManifests.map((manifestPath) => <article className="card" key={manifestPath}>
          <h2>Approved bundle</h2>
        </article>)}
      </section>}
  </section>;
}
