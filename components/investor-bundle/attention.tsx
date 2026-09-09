"use client";
import Link from "next/link";
import { z } from "zod";
import { useWorkspace } from "@/components/workspace-provider";
import { investorAttention, investorKinds, investorCapabilities, investorLabels } from "@/lib/investor-bundle/contracts";
import { useInvestorRead } from "./use-investor";
import { InvestorFrame, AccessState, ReadState, ResearchNotice, styles } from "./common";
type Attention = z.infer<typeof investorAttention>;
function Moves({ data, limit = 30 }: { data: Attention; limit?: number }) {
  return <><ul className={styles.list}>{data.items.slice(0, limit).map(item => <li key={item.id}><Link className={styles.row + " " + (item.priority === "high" ? styles.priority : "")} href={"/workspace/investing/" + item.kind + "/" + item.documentId}>
    <p className={styles.eyebrow}>{investorLabels[item.kind]} · {item.priority === "high" ? "Needs attention" : "Review cue"}</p><h3>{item.title}</h3><p>{item.reason}</p>
    <p>{item.dueDate ? "Recorded date: " + item.dueDate : "No date recorded"}</p><small className={styles.muted}>Recorded evidence: {item.evidence.slice(0, 300)} · Revision {item.revision}</small></Link></li>)}</ul>
    <p className={styles.muted}>As of {data.asOfDate} (server date). Showing {Math.min(data.items.length, limit)} of {data.total} recorded review cues. This checks saved research, not live markets, accounts or incoming filings. No alerts are sent automatically.</p></>;
}
function useAttention() {
  const { bundleExperience } = useWorkspace();
  const capability = investorKinds.map(k => investorCapabilities[k]).find(c => bundleExperience?.capabilityIds.includes(c)) ?? "__no_read__";
  return useInvestorRead<Attention>("/api/investor/attention", capability);
}
export function InvestorAttention({ label }: { label: string }) {
  const read = useAttention();
  if (!read.enabled) return null;
  return <article className={styles.workspace} aria-label="Investor research attention"><div className={styles.section}><p className={styles.eyebrow}>Investor · {label}</p>
    <h2>{read.loading ? "Checking saved research…" : read.error ? "Research could not be checked" : read.data?.items.length ? "What deserves another look?" : "No recorded research needs attention."}</h2>
    {read.error ? <button onClick={read.retry}>Try again</button> : read.data && <Moves data={read.data} limit={3} />}<Link href="/workspace/investing">Open your research desk</Link>
  </div></article>;
}
export function InvestorHome() {
  const { bundleExperience } = useWorkspace(), read = useAttention();
  const allowed = investorKinds.filter(k => bundleExperience?.capabilityIds.includes(investorCapabilities[k]));
  const first = allowed.includes("thesis") ? "thesis" : allowed[0];
  if (!read.enabled) return <AccessState />;
  return <InvestorFrame title="What would change your mind?" description="Keep your research focused on the next consequential question — with the source, uncertainty and review date close at hand.">
    <div className={styles.overview}><div>{read.loading || read.error ? <ReadState loading={read.loading} error={read.error} retry={read.retry} /> : read.data?.items.length ? <Moves data={read.data} /> :
      <div className={styles.empty}><p className={styles.eyebrow}>Your first useful step</p><h2>Start with one question worth answering.</h2>
        <p>{first === "thesis" ? "Write a working thesis, name what could disprove it, and keep supporting and challenging evidence together." : first === "filing" ? "Identify one public disclosure and the question it should help answer. The optional SEC lookup brings in metadata for your review." : "Choose one company to watch and write down why it deserves your attention."}</p>
        <Link className={styles.button} href={"/workspace/investing/" + first + "/new"}>Start {first === "thesis" ? "a company thesis" : first === "filing" ? "a filing review" : "a watchlist"}</Link>
        <p className={styles.muted}>No saved research needs attention here yet. This does not establish that no material change occurred.</p></div>}
      <ResearchNotice /></div>
      <aside className={styles.rail}><h2>A useful research rhythm</h2><ol><li>Ask a bounded question.</li><li>Inspect the original source and its dates.</li><li>Look for evidence against your view.</li><li>Decide what to review next.</li></ol>
        <h3>Review assistant proposals</h3>{allowed.map(k => <p key={k}><Link href={"/workspace/investing/" + k + "/proposals"}>{investorLabels[k]} proposals</Link></p>)}
        <p className={styles.muted}>Your assistant can prepare proposed research. Only your confirmed decision here changes a saved record.</p><p><Link href="/workspace/integrations/assistant">Manage assistant connections</Link></p>
      </aside></div>
  </InvestorFrame>;
}
