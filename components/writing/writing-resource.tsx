"use client";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Copy, FileText, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useWritingRead } from "./use-writing-read";
import { WritingAccessState } from "./writing-library";
import { safeSourceUrl, type WritingResource } from "@/lib/writing/contracts";
import type { ResourceReview } from "@/lib/writing/review";
import styles from "./writing.module.css";

type ReviewResult = { resource: WritingResource; review: ResourceReview; retrievedAt: string };
export function WritingResourcePage({ resourceId }: { resourceId: string }) {
  const { enabled, data, loading, error, retry } = useWritingRead<ReviewResult>("/api/writing/resources/" + encodeURIComponent(resourceId), "writer.resource.review");
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  if (!enabled) return <WritingAccessState />;
  if (loading) return <div className={styles.empty} role="status">Opening the resource and its source details…</div>;
  if (error || !data) return <div className={styles.empty} role="alert"><h1>Resource unavailable</h1><p>{error}</p><button className={styles.secondary} onClick={retry}>Try again</button><Link href="/workspace/writing" className={styles.textLink}>Return to the library</Link></div>;
  const { resource, review } = data;
  const sourceUrl = safeSourceUrl(resource.source_url);
  const copyReview = async () => {
    try {
      await navigator.clipboard.writeText([
        resource.title, "Source: " + resource.source_label, sourceUrl ?? "", "Recorded status: " + resource.epistemic_state,
        "", ...review.findings.map((finding) => finding.field + ": " + finding.reason + " " + finding.nextAction),
        "", "Next step: " + review.nextAction, "", review.method, review.publicationDecision
      ].filter(Boolean).join("\n"));
      setCopyState("done");
    } catch { setCopyState("failed"); }
  };
  return <article className={styles.workspace}>
    <Link href="/workspace/writing" className={styles.back}><ArrowLeft size={16} />Resource library</Link>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>{resource.resource_type.replaceAll("_", " ")} · {resource.author || "Author not recorded"}</p>
      <h1>{resource.title}</h1><p>{resource.abstract || "No summary has been recorded yet."}</p></div>
      <span className={styles.readOnly}><ShieldCheck size={15} />Original unchanged</span>
    </header>
    <section className={styles.nextMove} aria-label="Next editorial step"><p className={styles.eyebrow}>The next useful move</p><h2>{review.nextAction}</h2>
      <p>{review.findings.length ? review.findings.length + (review.findings.length === 1 ? " detail needs" : " details need") + " attention in the recorded information." : "The basic metadata is present. An editor still needs to review the source."}</p></section>
    <div className={styles.reviewLayout}>
      <section className={styles.sourceText}><div className={styles.sectionHeading}><h2><FileText size={18} />Source text</h2><span>{review.wordCount ? review.wordCount.toLocaleString() + " words" : "No text retained"}</span></div>
        {resource.body_text ? <div className={styles.prose}>{resource.body_text}</div> : <div className={styles.empty}><p>The original text hasn’t been added to this record. Open the source before making editorial claims.</p></div>}
      </section>
      <aside className={styles.reviewAside} aria-label="Resource review">
        <section className={styles.reviewCard}><div className={styles.sectionHeading}><h2>Before publication</h2><span className={styles.badge} data-state={resource.publication_state}>{resource.publication_state.replaceAll("_", " ")}</span></div>
          {review.findings.length ? <ol className={styles.findings}>{review.findings.map((finding) => <li key={finding.field}><h3>{finding.field}</h3><p>{finding.reason}</p><p className={styles.findingAction}>{finding.nextAction}</p></li>)}</ol> : <p>Basic metadata is present. This check does not confirm accuracy, rights, theology, or publication approval.</p>}
          <button className={styles.secondary} onClick={() => void copyReview()}>{copyState === "done" ? <Check size={16} /> : <Copy size={16} />}{copyState === "done" ? "Review copied" : "Copy review notes"}</button>
          <span role="status">{copyState === "failed" ? "Copy wasn't available. Select and copy the notes instead." : ""}</span>
        </section>
        <section className={styles.reviewCard}><h2>Know the source</h2><dl className={styles.sourceFacts}>
          <dt>Recorded source</dt><dd>{resource.source_label}</dd><dt>Evidence status</dt><dd>{resource.epistemic_state.replaceAll("_", " ")}</dd>
          <dt>Intended reader</dt><dd>{resource.audience || "Not recorded"}</dd><dt>Source date</dt><dd>{resource.source_date || "Not recorded"}</dd>
          <dt>Retrieved</dt><dd>{new Date(resource.retrieved_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</dd>
        </dl>{sourceUrl && <a className={styles.textLink} href={sourceUrl} target="_blank" rel="noopener noreferrer">Open recorded source <ArrowUpRight size={16} /></a>}
          <p className={styles.method}>{review.method}</p>
        </section>
      </aside>
    </div>
  </article>;
}
