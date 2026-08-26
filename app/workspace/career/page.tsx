"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { CapabilityLockedState } from "@/components/capability-locked-state";
import { useWorkspace } from "@/components/workspace-provider";
import { capabilityEnabled } from "@/lib/workspace/capabilities";
import { createJobApplication, listJobApplications, updateJobApplication } from "@/lib/workspace/repository";
import type { JobApplicationRecord, JobApplicationStatus } from "@/lib/workspace/types";

const stages: Array<{ value: JobApplicationStatus; label: string }> = [
  { value: "researching", label: "Research" }, { value: "applied", label: "Applied" }, { value: "phone_screen", label: "Screen" }, { value: "interview", label: "Interview" }, { value: "offer", label: "Offer" }
];

export default function CareerPage() {
  const { workspace, user, plan, capabilities } = useWorkspace();
  const [items, setItems] = useState<JobApplicationRecord[]>([]);
  const [company, setCompany] = useState(""); const [role, setRole] = useState(""); const [followUp, setFollowUp] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const reload = useCallback(async () => { if (workspace) setItems(await listJobApplications(workspace.id)); }, [workspace]);
  useEffect(() => { void reload().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load the career pipeline.")); }, [reload]);
  async function add(event: FormEvent) { event.preventDefault(); if (!workspace || !user || !company.trim() || !role.trim()) return; setSaving(true); setError(null); try { await createJobApplication({ workspaceId: workspace.id, userId: user.id, company, role, nextFollowUpDate: followUp || null }); setCompany(""); setRole(""); setFollowUp(""); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add the opportunity."); } finally { setSaving(false); } }
  async function move(id: string, status: JobApplicationStatus) { try { await updateJobApplication(id, status); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the opportunity."); } }
  const current = items.filter((item) => !["rejected", "withdrawn"].includes(item.status));
  if (!capabilityEnabled(capabilities, "career", plan?.status)) return <CapabilityLockedState title="Career Pipeline" benefit="Career Pipeline keeps opportunities, follow-ups, and next actions visible without losing their context." suspended={plan?.status === "suspended"} />;
  return <section className="workflow-page"><header className="workflow-heading"><p className="eyebrow">Career Pipeline</p><h1 className="page-title">Keep the next opportunity visible.</h1><p className="page-lede">A private, tenant-scoped view of real opportunities and follow-ups—without external job feeds or match scores.</p></header>
    <section className="workflow-composer"><form className="career-composer" onSubmit={add}><label>Company<input required value={company} placeholder="Organization" onChange={(event) => setCompany(event.target.value)} /></label><label>Role<input required value={role} placeholder="Role title" onChange={(event) => setRole(event.target.value)} /></label><label>Follow up<input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label><button className="button" disabled={saving}>{saving ? "Adding…" : <><Plus size={16} />Add opportunity</>}</button></form></section>
    {error ? <p className="error">{error}</p> : null}
    <div className="pipeline-summary"><BriefcaseBusiness size={18} /><p><strong>{current.length}</strong> active {current.length === 1 ? "opportunity" : "opportunities"} in your Workspace.</p><span>External network and job-alert signals are intentionally deferred.</span></div>
    <section className="career-board" aria-label="Career application board">{stages.map((stage) => { const columnItems = items.filter((item) => item.status === stage.value); return <article className="career-lane" key={stage.value}><header><h2>{stage.label}</h2><span>{columnItems.length}</span></header>{columnItems.length ? columnItems.map((item) => <article className="career-card" key={item.id}><p className="eyebrow">Opportunity</p><strong>{item.company}</strong><em>{item.role}</em><p>{item.next_follow_up_date ? `Follow up ${item.next_follow_up_date}` : "No follow-up date"}</p><select aria-label={`Stage for ${item.company}`} value={item.status} onChange={(event) => void move(item.id, event.target.value as JobApplicationStatus)}>{stages.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="rejected">Closed — rejected</option><option value="withdrawn">Closed — withdrawn</option></select></article>) : <p className="lane-empty">Opportunities appear here as their stage changes. Add one above to keep its next useful action and follow-up visible.</p>}</article>; })}</section>
  </section>;
}
