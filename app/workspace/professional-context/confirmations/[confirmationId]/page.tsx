import { ProfessionalContextConfirmation } from "@/components/professional-context-confirmation";

export default async function ProfessionalContextConfirmationPage({
  params,
}: {
  params: Promise<{ confirmationId: string }>;
}) {
  const { confirmationId } = await params;
  return <section className="workflow-page" aria-label="Professional Context confirmation">
    <p className="eyebrow workflow-kicker">Professional Context</p>
    <h1 className="page-title">Review this Workspace change.</h1>
    <p className="page-lede">The operation below came from a connected assistant. Only this authenticated Workspace review can execute it.</p>
    <ProfessionalContextConfirmation confirmationId={confirmationId} />
  </section>;
}
