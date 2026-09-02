import { BundleInviteClaim } from "@/components/bundle-invite-claim";

export default async function BundleInvitePage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <section className="workflow-page" aria-label="Claim bundle invite">
    <p className="eyebrow workflow-kicker">Bundle invite</p>
    <h1 className="page-title">Add SOTF Bundle to your Workspace.</h1>
    <p className="page-lede">This invite adds transition support to the same Personal Workspace and identity you already use.</p>
    <BundleInviteClaim token={token} />
  </section>;
}
