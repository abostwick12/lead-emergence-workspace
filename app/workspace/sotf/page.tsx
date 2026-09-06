import { SotfExperience } from "@/components/sotf/sotf-experience";
import Link from "next/link";

export default function SotfBundlePage() {
  if (process.env.SOTF_PILOT_ENABLED !== "true") return <section className="workflow-page" aria-label="SOTF Bundle">
    <p className="eyebrow">SOTF Bundle</p>
    <h1 className="page-title">Your next move, connected to what you have learned.</h1>
    <p className="page-lede">Persistent SOTF Bundle workflows are not enabled in this environment yet. Explore a fictional transition to see how evidence, decisions, conversations, and follow-through connect.</p>
    <Link className="button" href="/sotf/preview">Explore the fictional workflow preview</Link>
  </section>;
  return <SotfExperience mode="connected" />;
}
