"use client";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { useWritingRead } from "./use-writing-read";
import type { PublicationQueueResult } from "@/lib/writing/publication-readiness";
import styles from "./writing.module.css";
export function WritingAttention({ label }: { label: string }) {
  const { enabled, data, loading, error, retry } = useWritingRead<PublicationQueueResult>(
    "/api/writing/publication?limit=3", "writer.publication.queue");
  if (!enabled) return null;
  return <article className={styles.attention} aria-label="Writing publication queue">
    <div className={styles.attentionIcon}><FileText size={21} /></div>
    <div className={styles.attentionCopy}><p className={styles.eyebrow}>Writing · {label}</p>
      <h2>{loading ? "Checking your Writing library…" : error ? "Your Writing library couldn't be checked" :
        data?.counts.readyForHandoff ? data.counts.readyForHandoff + (data.counts.readyForHandoff === 1 ? " revision has" : " revisions have") + " complete handoff evidence." :
        data?.total ? data.total + (data.total === 1 ? " publication plan needs" : " publication plans need") + " attention." : "Nothing is waiting for a handoff."}</h2>
      <p>{error ? "Your saved work is unchanged." : data?.counts.readyForHandoff ?
        "Review the exact saved revision, then deliberately record its handoff." :
        data?.total ? "Open the queue to resolve current source, review, or destination evidence." :
        "Add a reviewed resource when you want one exact revision carried through publication preparation."}</p>
    </div>
    {error ? <button className={styles.secondary} onClick={retry}>Try again</button> :
      <Link className={styles.textLink} href="/workspace/writing/publication">Open publication queue <ArrowRight size={16} /></Link>}
  </article>;
}
