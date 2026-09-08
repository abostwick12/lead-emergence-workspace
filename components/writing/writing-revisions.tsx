"use client";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import type { WritingResource } from "@/lib/writing/contracts";
import type { SavedProposal, WritingPatch } from "@/lib/writing/revision-contracts";
import { useWritingRead } from "./use-writing-read";
import { useWritingAction } from "./use-writing-action";
import styles from "./writing.module.css";
type History = { proposals: SavedProposal[]; revisions: { revision: number; snapshot: WritingResource; reason: string; origin: string; recorded_at: string }[] };
const fieldLabel = (field: string) => field.replaceAll("_"," ").replace(/^./, (letter) => letter.toUpperCase());
function printable(value: unknown) { return value == null || value === "" ? "Not recorded" : Array.isArray(value) ? value.join(", ") || "None" : typeof value === "object" ? JSON.stringify(value,null,2) : String(value); }
export function WritingRevisions({ resource, onApplied }: { resource: WritingResource; onApplied: () => void }) {
  const { user, bundleExperience } = useWorkspace();
  return <RevisionPanel key={user?.id + ":" + bundleExperience?.workspaceId + ":" + bundleExperience?.revision + ":" + resource.id + ":" + resource.revision} resource={resource} onApplied={onApplied} />;
}
function RevisionPanel({ resource, onApplied }: { resource: WritingResource; onApplied: () => void }) {
  const { bundleExperience } = useWorkspace();
  const canPropose = bundleExperience?.capabilityIds.includes("writer.resource.metadata") === true;
  const canApprove = bundleExperience?.capabilityIds.includes("writer.resource.manage") === true;
  const history = useWritingRead<History>("/api/writing/resources/" + resource.id + "/history", "writer.resource.review");
  const [editing, setEditing] = useState(false);
  return <section className={styles.revisions} aria-label="Revisions and proposals">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Your voice. Your decision.</p><h2>Revisions & proposals</h2></div>
      {canPropose && <button className={styles.secondary} onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Propose an improvement"}</button>}
    </div>
    <p className={styles.method}>Current revision {resource.revision}. Suggestions never change the library until you approve the saved comparison here. Approval is an editorial decision, not fact-checking or website publication.</p>
    {editing && <ProposalEditor resource={resource} onSaved={() => { setEditing(false); history.retry(); }} />}
    {history.loading ? <p role="status">Loading revision history…</p> : history.error ? <p role="alert">{history.error} <button className={styles.secondary} onClick={history.retry}>Retry history</button></p> :
      <><div className={styles.proposalList}>{history.data?.proposals.map((proposal) =>
        <ProposalComparison key={proposal.id + ":" + proposal.status} proposal={proposal} resource={resource}
          baseline={history.data?.revisions.find((item) => item.revision === proposal.base_revision)?.snapshot}
          canApprove={canApprove} onDecided={(applied) => { if (applied) onApplied(); else history.retry(); }} />
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
function ProposalEditor({ resource, onSaved }: { resource: WritingResource; onSaved: () => void }) {
  const { run, busy, error } = useWritingAction();
  const [validation, setValidation] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setValidation(null);
    const form = new FormData(event.currentTarget), patch: WritingPatch = {};
    for (const field of ["title","author","audience","abstract","body_text"] as const) {
      const raw = String(form.get(field) ?? "");
      const value = ["author","audience","abstract"].includes(field) ? raw || null : raw;
      if (value !== resource[field]) Object.assign(patch,{ [field]: value });
    }
    const topics = String(form.get("topics")).split(",").map((value) => value.trim()).filter(Boolean);
    if (JSON.stringify(topics) !== JSON.stringify(resource.topics)) patch.topics = topics;
    const metadata = { ...resource.metadata, website_summary: String(form.get("website_summary")), seo_description: String(form.get("seo_description")) };
    if (metadata.website_summary !== (resource.metadata.website_summary || "") || metadata.seo_description !== (resource.metadata.seo_description || "")) patch.metadata = metadata;
    const state = String(form.get("publication_state"));
    if (state !== resource.publication_state) patch.publication_state = state as WritingPatch["publication_state"];
    if (!Object.keys(patch).length) { setValidation("Make at least one change before saving a proposal."); return; }
    const result = await run("/api/writing/proposals", {
      resourceId: resource.id, baseRevision: resource.revision, patch, reason: String(form.get("reason")), evidence: String(form.get("evidence"))
    }, true);
    if (result) onSaved();
  }
  return <form className={styles.editorForm} onSubmit={(event) => void submit(event)}>
    <fieldset className={styles.formFields} disabled={busy}>
    <h3>Prepare a proposal · revision {resource.revision}</h3>
    <div className={styles.formGrid}>
      <label>Proposed title<input name="title" defaultValue={resource.title} required maxLength={240} /></label>
      <label>Proposed author<input name="author" defaultValue={resource.author || ""} maxLength={240} /></label>
      <label>Intended audience<input name="audience" defaultValue={resource.audience || ""} maxLength={300} /></label>
      <label>Topics <span>Separate with commas</span><input name="topics" defaultValue={resource.topics.join(", ")} maxLength={3630} /></label>
    </div>
    <label>Resource summary<textarea name="abstract" defaultValue={resource.abstract || ""} rows={3} maxLength={3000} /></label>
    <label>Proposed text<textarea name="body_text" defaultValue={resource.body_text} rows={12} maxLength={100000} /></label>
    <label>Website summary<textarea name="website_summary" defaultValue={resource.metadata.website_summary || ""} rows={3} maxLength={3000} /></label>
    <label>SEO description<textarea name="seo_description" defaultValue={resource.metadata.seo_description || ""} rows={2} maxLength={320} /></label>
    <label>Library status<select name="publication_state" defaultValue={resource.publication_state}>
      <option value="draft">Draft</option><option value="in_review">In review</option><option value="ready">Ready for human publication review</option><option value="archived">Archived</option>
      {resource.publication_state === "published" && <option value="published">Published (recorded; unchanged)</option>}
    </select></label>
    <label>Why this helps<textarea name="reason" required rows={2} maxLength={2000} placeholder="Explain the benefit while preserving the author's voice." /></label>
    <label>Source evidence or basis<textarea name="evidence" required rows={2} maxLength={4000} defaultValue={"Source: " + resource.source_label + " · revision " + resource.revision + ". "} /></label>
    {(error || validation) && <p role="alert">{error || validation}</p>}
    <button className={styles.secondary} type="submit" disabled={busy}>{busy ? "Saving proposal…" : "Save proposal for comparison"}</button>
    </fieldset>
  </form>;
}
function ProposalComparison({ proposal, resource, baseline, canApprove, onDecided }: {
  proposal: SavedProposal; resource: WritingResource; baseline?: WritingResource; canApprove: boolean; onDecided: (applied: boolean) => void;
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
        <div className={styles.actionRow}><button className={styles.secondary} disabled={!confirmed || stale || !baseline || busy} onClick={() => void decide("approve")}>{busy ? "Saving decision…" : "Approve and save revision"}</button>
        <button className={styles.secondary} disabled={busy} onClick={() => void decide("reject")}>Reject proposal</button></div></> :
        <p>Approval requires Writing revision access in Workspace.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
