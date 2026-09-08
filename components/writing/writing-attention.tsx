"use client";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { useWritingRead } from "./use-writing-read";
import type { WritingLibrary } from "@/lib/writing/contracts";
import styles from "./writing.module.css";
export function WritingAttention({ label }: { label: string }) {
  const { enabled, data, loading, error, retry } = useWritingRead<WritingLibrary>(
    "/api/writing/resources?limit=3", "writer.resource.library");
  if (!enabled) return null;
  return <article className={styles.attention} aria-label="Writing publication queue">
    <div className={styles.attentionIcon}><FileText size={21} /></div>
    <div className={styles.attentionCopy}><p className={styles.eyebrow}>Writing · {label}</p>
      <h2>{loading ? "Checking your Writing library…" : error ? "Your Writing library couldn't be checked" :
        data?.awaitingPublication ? data.awaitingPublication + (data.awaitingPublication === 1 ? " resource is" : " resources are") + " waiting for their next reader." :
        data?.total ? "Nothing is waiting to publish." : "Your next resource starts here."}</h2>
      <p>{error ? "Your saved work is unchanged." : data?.awaitingPublication ?
        "Review the source, resolve missing details, and choose the next editorial step." :
        data?.total ? "Browse your library when you're ready to revisit a piece." :
        "Writing brings your resources, source details, and editorial next steps into one place."}</p>
    </div>
    {error ? <button className={styles.secondary} onClick={retry}>Try again</button> :
      <Link className={styles.textLink} href="/workspace/writing">Open Writing <ArrowRight size={16} /></Link>}
  </article>;
}
