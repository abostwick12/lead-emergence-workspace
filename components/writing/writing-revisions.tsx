"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import type { WritingResource } from "@/lib/writing/contracts";
import type { SavedProposal } from "@/lib/writing/revision-contracts";
import { useWritingRead } from "./use-writing-read";
import { useWritingAction } from "./use-writing-action";
import styles from "./writing.module.css";
import { useWorkingDraft } from "./use-working-draft";
import { DraftStatus } from "./draft-status";
import { patchFromWorkingDraft, resourceEditorValues } from "@/lib/writing/draft-editing";
type History = { proposals: SavedProposal[]; revisions: { revision: number; snapshot: WritingResource; reason: string; origin: string; recorded_at: string }[] };
const fieldLabel = (field: string) => field.replaceAll("_"," ").replace(/^./, (letter) => letter.toUpperCase());
function printable(value: unknown) { return value == null || value === "" ? "Not recorded" : Array.isArray(value) ? value.join(", ") || "None" : typeof value === "object" ? JSON.stringify(value,null,2) : String(value); }
export function WritingRevisions({ resource, onApplied, refreshKey=0 }: { resource: WritingResource; onApplied: () => void; refreshKey?:number }) {
  const { user, bundleExperience } = useWorkspace();
  return <RevisionPanel key={user?.id + ":" + bundleExperience?.workspaceId + ":" + bundleExperience?.revision + ":" + resource.id + ":" + resource.revision} resource={resource} onApplied={onApplied} refreshKey={refreshKey} />;
}
function RevisionPanel({ resource, onApplied, refreshKey }: { resource: WritingResource; onApplied: () => void; refreshKey:number }) {
  const { bundleExperience } = useWorkspace();
  const canPropose = bundleExperience?.capabilityIds.includes("writer.resource.metadata") === true;
  const canApprove = bundleExperience?.capabilityIds.includes("writer.resource.manage") === true;
  const history = useWritingRead<History>("/api/writing/resources/" + resource.id + "/history?refresh=" + refreshKey, "writer.resource.review");
  const [editing, setEditing] = useState(false);
  const [draftUnsettled,setDraftUnsettled]=useState(false);
  return <section className={styles.revisions} aria-label="Revisions and proposals">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Your voice. Your decision.</p><h2>Revisions & proposals</h2></div>
      {canPropose && <button className={styles.secondary} onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Propose an improvement"}</button>}
    </div>
    <p className={styles.method}>Current revision {resource.revision}. Suggestions never change the library until you approve the saved comparison here. Approval is an editorial decision, not fact-checking or website publication.</p>
    {canPropose && <div hidden={!editing}><ProposalEditor resource={resource} onUnsettled={setDraftUnsettled} onSaved={() => { setEditing(false); history.retry(); }} /></div>}
    {draftUnsettled&&<p role="status">Finish saving or explicitly discard your working draft before approving another proposal.</p>}
    {history.loading ? <p role="status">Loading revision history…</p> : history.error ? <p role="alert">{history.error} <button className={styles.secondary} onClick={history.retry}>Retry history</button></p> :
      <><div className={styles.proposalList}>{history.data?.proposals.map((proposal) =>
        <ProposalComparison key={proposal.id + ":" + proposal.status} proposal={proposal} resource={resource}
          baseline={history.data?.revisions.find((item) => item.revision === proposal.base_revision)?.snapshot}
          canApprove={canApprove} draftUnsettled={draftUnsettled} onDecided={(applied) => { if (applied) onApplied(); else history.retry(); }} />
      )}</div>
      {!history.data?.proposals.length && <p>No saved proposals yet. Start with the next editorial step above, or ask your connected assistant to propose a source-backed improvement.</p>}
      <details className={styles.history}><summary>Saved revision history ({history.data?.revisions.length || 0}, original included)</summary>
        {history.data?.revisions.map((revision) => <details key={revision.revision}><summary>Revision {revision.revision} · {new Date(revision.recorded_at).toLocaleString()} · {revision.origin.replaceAll("_"," ")}</summary>
          <p>{revision.reason}</p><h3>{revision.snapshot.title}</h3><div className={styles.prose}>{revision.snapshot.body_text || "No source text recorded."}</div>
          <pre className={styles.diffValue}>{JSON.stringify({ ...revision.snapshot, body_text: undefined },null,2)}</pre>
        </details>)}
      </details></>}
  </section>;
}
function ProposalEditor({resource,onSaved,onUnsettled}:{resource:WritingResource;onSaved:()=>void;onUnsettled:(value:boolean)=>void}) {
  const {run,error}=useWritingAction(),draft=useWorkingDraft(resource.id,resourceEditorValues(resource),resource.revision);
  const [validation,setValidation]=useState<string|null>(null),[submitting,setSubmitting]=useState(false);
  const stale=draft.loaded&&draft.baseRevision!==resource.revision;
  useEffect(()=>{onUnsettled(draft.dirty||draft.saving);},[draft.dirty,draft.saving,onUnsettled]);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setValidation(null);
    if(stale){setValidation("Compare your draft with the current revision first.");return;}
    try {patchFromWorkingDraft(resource,draft.values);} catch {setValidation("Make at least one valid change. Keep topics to 30 entries of 120 characters or fewer.");return;}
    setSubmitting(true);
    try {
      const saved=await draft.flush();
      if(!saved?.values||!saved.requestId)return;
      const result=await run("/api/writing/proposals",{
        resourceId:resource.id,requestId:saved.requestId,baseRevision:saved.baseRevision,patch:patchFromWorkingDraft(resource,saved.values),
        reason:saved.values.reason||"",evidence:saved.values.evidence||""
      });
      if(result){await draft.clear(saved.version);onSaved();}
    } finally {setSubmitting(false);}
  }
  const fields=[["title","Proposed title",240,0],["author","Proposed author",240,0],["audience","Intended audience",300,0],["topics","Topics (comma-separated)",3630,0],
    ["abstract","Resource summary",3000,3],["body_text","Proposed text",100000,12],["website_summary","Website summary",3000,3],["seo_description","SEO description",320,2],
    ["reason","Why this helps",2000,2],["evidence","Source evidence or basis",4000,2]] as const;
  return <div>
    <DraftStatus draft={draft} />
    {stale&&<div className={styles.draftStatus} role="status"><p>Your unfinished draft is based on revision {draft.baseRevision}; the resource is now revision {resource.revision}. The original has not been changed by this draft.</p>
      <button className={styles.secondary} onClick={draft.rebase}>Compare this draft with the current revision</button><p className={styles.method}>This keeps your draft text and changes only its comparison base. Review every difference before approval.</p></div>}
    <form className={styles.editorForm} onSubmit={e=>void submit(e)}>
      <fieldset className={styles.formFields} disabled={submitting||!draft.loaded||draft.clearing}>
        <h3>Prepare a proposal · revision {draft.baseRevision||resource.revision}</h3>
        {fields.map(([field,label,max,rows])=><label key={field}>{label}{rows?
          <textarea name={field} rows={rows} maxLength={max} required={["reason","evidence"].includes(field)} value={draft.values[field]||""} onChange={e=>draft.update({[field]:e.target.value})} />:
          <input name={field} maxLength={max} required={field==="title"} value={draft.values[field]||""} onChange={e=>draft.update({[field]:e.target.value})} />}</label>)}
        <label>Library status<select name="publication_state" value={draft.values.publication_state||resource.publication_state} onChange={e=>draft.update({publication_state:e.target.value})}>
          <option value="draft">Draft</option><option value="in_review">In review</option><option value="ready">Ready for human publication review</option><option value="archived">Archived</option>
          {resource.publication_state==="published"&&<option value="published">Published (recorded; unchanged)</option>}
        </select></label>
        {(error||validation)&&<p role="alert">{error||validation}</p>}
        <button className={styles.secondary} type="submit" disabled={stale||Boolean(draft.saveError)}>{submitting?"Saving proposal…":"Save proposal for comparison"}</button>
      </fieldset>
    </form>
  </div>;
}
function ProposalComparison({ proposal, resource, baseline, canApprove, draftUnsettled, onDecided }: {
  proposal: SavedProposal; resource: WritingResource; baseline?: WritingResource; canApprove: boolean; draftUnsettled:boolean; onDecided: (applied: boolean) => void;
}) {
  const { busy, error, run } = useWritingAction();
  const [confirmed, setConfirmed] = useState(false);
  const stale = proposal.base_revision !== resource.revision;
  async function decide(decision: "approve" | "reject") {
    const result = await run<{ status: string }>("/api/writing/proposals/decision", {
      proposalId: proposal.id, expectedRevision: proposal.base_revision, decision
    });
    if (result) onDecided(result.status === "approved");
  }
  return <article className={styles.proposalCard} aria-label={"Proposal: " + proposal.reason}>
    <div className={styles.sectionHeading}><h3>{proposal.reason}</h3><span className={styles.badge}>{proposal.status}</span></div>
    <p className={styles.method}>{proposal.origin === "assistant" ? "Assistant suggestion" : "User proposal"} · Based on revision {proposal.base_revision} · {new Date(proposal.created_at).toLocaleString()}</p>
    <p><strong>Basis:</strong> {proposal.evidence}</p>
    {Object.entries(proposal.patch).map(([field,value]) => <section key={field} className={styles.diffField}>
      <h4>{fieldLabel(field)}</h4><div className={styles.diffGrid}>
        <div><span>Before · revision {proposal.base_revision}</span><pre className={styles.diffValue}>{baseline ? printable(baseline[field as keyof WritingResource]) : "Baseline is outside the ten most recent revisions. Approval is disabled."}</pre></div>
        <div><span>Proposed</span><pre className={styles.diffValue}>{printable(value)}</pre></div>
      </div>
    </section>)}
    {proposal.status === "pending" && <>
      {stale && <p role="status">The resource has changed since this proposal. Reject it and prepare a fresh comparison; it cannot overwrite the newer revision.</p>}
      {canApprove ? <><label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={stale || !baseline || busy} />I reviewed these exact changes and want to apply them to my private library.</label>
        <div className={styles.actionRow}><button className={styles.secondary} disabled={!confirmed || stale || !baseline || busy || draftUnsettled} onClick={() => void decide("approve")}>{busy ? "Saving decision…" : "Approve and save revision"}</button>
        <button className={styles.secondary} disabled={busy} onClick={() => void decide("reject")}>Reject proposal</button></div></> :
        <p>Approval requires Writing revision access in Workspace.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
