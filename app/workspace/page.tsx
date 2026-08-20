"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { listCaptures, listJobApplications, listTasks } from "@/lib/workspace/repository";
import type { CaptureRecord, JobApplicationRecord, TaskRecord } from "@/lib/workspace/types";

export default function WorkspaceOverviewPage() {
  const { workspace } = useWorkspace();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [jobs, setJobs] = useState<JobApplicationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!workspace) return;
    void Promise.all([listTasks(workspace.id), listCaptures(workspace.id), listJobApplications(workspace.id)])
      .then(([nextTasks, nextCaptures, nextJobs]) => { setTasks(nextTasks); setCaptures(nextCaptures); setJobs(nextJobs); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load overview."));
  }, [workspace]);
  const openTasks = tasks.filter((task) => task.status !== "done");
  const todayPriority = [...openTasks].sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))[0];
  return <>
    <h1 className="page-title">Your command center</h1><p className="page-lede">Private planning, captured commitments, and personal priorities — isolated from ministry data.</p>
    {error ? <p className="error">{error}</p> : null}
    <section className="grid three">
      <article className="card"><p className="muted">Open tasks</p><p className="metric">{openTasks.length}</p></article>
      <article className="card"><p className="muted">Needs review</p><p className="metric">{captures.filter((entry) => entry.status === "unprocessed").length}</p></article>
      <article className="card"><p className="muted">Career follow-ups</p><p className="metric">{jobs.filter((job) => job.next_follow_up_date && job.next_follow_up_date <= new Date().toISOString().slice(0, 10)).length}</p></article>
    </section>
    <section className="grid two" style={{ marginTop: 18 }}>
      <article className="card"><h2>Today&apos;s priority</h2>{todayPriority ? <><h3>{todayPriority.title}</h3><p className="muted">{todayPriority.due_date ? `Due ${todayPriority.due_date}` : "No due date"} · {todayPriority.domain.replaceAll("_", " ")}</p></> : <p className="empty">No open tasks. Add one when a priority emerges.</p>}</article>
      <article className="card"><h2>Workspace boundary</h2><p className="notice">This application queries only the `workspace` schema using your authenticated session. Ministry records, roles, and storage are not part of this product.</p></article>
    </section>
  </>;
}
