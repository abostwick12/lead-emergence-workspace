import { ProfessionalContextReadGrants } from "@/components/professional-context-read-grants";

export default function ProfessionalContextAccessPage() {
  return <section className="workflow-page" aria-label="Professional Context protected-read access">
    <p className="eyebrow workflow-kicker">Professional Context / Protected reads</p>
    <h1 className="page-title">Choose what Lewis may read temporarily.</h1>
    <p className="page-lede">Private and Sensitive Professional Context stay outside ordinary assistant access. You can grant either scope to a specific connected assistant for a short, read-only window and revoke it immediately.</p>
    <ProfessionalContextReadGrants />
  </section>;
}
