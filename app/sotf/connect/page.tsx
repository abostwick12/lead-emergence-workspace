import Link from "next/link";
import styles from "@/components/sotf/sotf.module.css";

export default function ConversationGuidePage() {
  return <main className={styles.experience}>
    <header className={styles.header}><Link href="https://entry.leademergence.com" className={styles.brand}>Lead Emergence</Link><span>SOTF Bundle</span></header>
    <section className={styles.introduction}>
      <p className={styles.eyebrow}>Your conversation, with continuity</p>
      <h1>Pick up where you left off.</h1>
      <p>SOTF Bundle can bring your saved transition decisions, evidence, relationships, and commitments into a new ChatGPT conversation through your authorized Workspace connection.</p>
    </section>
    <section className={styles.sheet}>
      <h2>Use your existing Lead Emergence access</h2>
      <ol className={styles.list}>
        <li>Use the shared Lead Emergence Sign In, then choose your authorized Individual Workspace.</li>
        <li>In Workspace, open Connections and follow the existing ChatGPT connection instructions.</li>
        <li>When SOTF Bundle pilot access is enabled for your account and environment, ask ChatGPT: “Resume my SOTF Bundle. What changed, what needs a decision, and what is my best next move?”</li>
      </ol>
      <p className={styles.help}>The connection uses the transition information you deliberately save. It does not automatically read every ChatGPT conversation. Protected Professional Context will be available only through its separately approved boundary.</p>
      <div className={styles.actions}><Link className={styles.primary} href="https://entry.leademergence.com/login">Lead Emergence Sign In</Link><Link href="/sotf/preview">Explore the fictional workflow preview</Link></div>
    </section>
  </main>;
}
