import type { Metadata } from "next";
import { SotfExperience } from "@/components/sotf/sotf-experience";
import styles from "@/components/sotf/sotf.module.css";
import { networkingBookingConfiguration, networkingSchedulingHandoff } from "@/lib/sotf/booking";

export const metadata: Metadata = { title: "SOTF Bundle · fictional workflow preview", robots: { index: false, follow: false } };
export default function PreviewPage() {
  return <main className={styles.experience} style={{ padding: 0, minHeight: "auto" }}>
    <section className={styles.introduction} style={{ padding: "50px clamp(18px, 4vw, 64px) 28px" }} aria-labelledby="preview-introduction">
      <p className={styles.previewLabel}>Fictional example · No real client result</p>
      <h1 id="preview-introduction">Decide what to investigate before pursuing a role.</h1>
      <p>Workspace helps people navigating a career transition compare opportunities with what matters to them.</p>
      <article className={styles.sheet}>
        <p className={styles.eyebrow}>Northstar — fictional employer</p>
        <h2>Technical Program Lead</h2>
        <p><strong>What the evidence supports:</strong> Cross-team delivery matches the fictional candidate’s reviewed experience.</p>
        <p><strong>What remains uncertain:</strong> The candidate wants decision ownership, but the fictional practitioner account says functional leaders retain final authority.</p>
        <p className={styles.recommendation}>Decision: Investigate before committing.</p>
        <p><strong>Next move:</strong> Ask which decisions this role owns, then revisit the assessment when that evidence is available.</p>
      </article>
      <p>Explore the assessment below. Everything in this example is fictional.</p>
    </section>
    <SotfExperience mode="preview" scheduling={networkingSchedulingHandoff(networkingBookingConfiguration())} initialSection="opportunities" />
  </main>;
}
