"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { createJobApplication, listJobApplications, updateJobApplication } from "@/lib/workspace/repository";
import type { JobApplicationRecord, JobApplicationStatus } from "@/lib/workspace/types";

const statuses: JobApplicationStatus[] = ["researching", "applied", "phone_screen", "interview", "offer", "rejected", "withdrawn"];
export default function CareerPage() {
  const { workspace, user } = useWorkspace(); const [items, setItems] = useState<JobApplicationRecord[]>([]);
  const [company, setCompany] = useState(""); const [role, setRole] = useState(""); const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => { if (workspace) setItems(await listJobApplications(workspace.id)); }, [workspace]);
  useEffect(() => { void reload().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load career pipeline.")); }, [reload]);
  async function add(event: FormEvent) { event.preventDefault(); if (!workspace || !user || !company.trim() || !role.trim()) return; try { await createJobApplication({ workspaceId: workspace.id, userId: user.id, company, role }); setCompany(""); setRole(""); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add application."); } }
  return <><h1 className="page-title">Career pipeline</h1><p className="page-lede">A private tracker for opportunities and next follow-ups.</p><section className="grid two"><article className="card"><h2>Add opportunity</h2><form className="form-grid" onSubmit={add}><label>Company<input required value={company} onChange={(event) => setCompany(event.target.value)} /></label><label>Role<input required value={role} onChange={(event) => setRole(event.target.value)} /></label><button className="button">Add to pipeline</button></form></article><article className="card"><h2>Boundary note</h2><p className="notice">Career records are Workspace-owned. No ministry profile, volunteer role, or organizational permission is used to query them.</p></article></section><section className="card" style={{ marginTop: 18 }}><h2>Opportunities</h2>{error ? <p className="error">{error}</p> : null}{items.length ? items.map((item) => <article className="item" key={item.id}><div className="row"><div><strong>{item.company}</strong><p className="muted">{item.role}</p></div><select aria-label={`Status for ${item.company}`} value={item.status} onChange={(event) => void updateJobApplication(item.id, event.target.value as JobApplicationStatus).then(reload).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not update application."))}>{statuses.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}</select></div></article>) : <p className="empty">No opportunities tracked yet.</p>}</section></>;
}
