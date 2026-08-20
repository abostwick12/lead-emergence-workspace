"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { createTask, deleteTask, listTasks, updateTask } from "@/lib/workspace/repository";
import { DOMAIN_LABELS, type TaskRecord, type WorkspaceDomain } from "@/lib/workspace/types";

const domains = Object.keys(DOMAIN_LABELS) as WorkspaceDomain[];

export default function TasksPage() {
  const { workspace, user } = useWorkspace();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [title, setTitle] = useState(""); const [domain, setDomain] = useState<WorkspaceDomain>("general");
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const reload = useCallback(async () => { if (workspace) setTasks(await listTasks(workspace.id)); }, [workspace]);
  useEffect(() => { void reload().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load tasks.")); }, [reload]);
  async function add(event: FormEvent) {
    event.preventDefault(); if (!workspace || !user || !title.trim()) return;
    setSaving(true); setError(null);
    try { await createTask({ workspaceId: workspace.id, userId: user.id, title, domain }); setTitle(""); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add task."); } finally { setSaving(false); }
  }
  async function changeStatus(id: string, status: TaskRecord["status"]) { try { await updateTask(id, { status }); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update task."); } }
  return <><h1 className="page-title">Tasks</h1><p className="page-lede">Track your personal next actions across the parts of life that matter.</p>
    <section className="grid two"><article className="card"><h2>Add task</h2><form className="form-grid" onSubmit={add}><label>Task title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Domain<select value={domain} onChange={(event) => setDomain(event.target.value as WorkspaceDomain)}>{domains.map((value) => <option key={value} value={value}>{DOMAIN_LABELS[value]}</option>)}</select></label><button className="button" disabled={saving}>{saving ? "Adding…" : "Add task"}</button></form></article>
      <article className="card"><h2>Priority guide</h2><p className="muted">Use status to keep today&apos;s work visible. Due dates, projects, and richer planning data are supported by the Workspace schema and can be added without reopening the tenant model.</p></article></section>
    <section className="card" style={{ marginTop: 18 }}><div className="row"><h2>All tasks</h2><span className="pill">{tasks.length}</span></div>{error ? <p className="error">{error}</p> : null}{tasks.length ? <div>{tasks.map((task) => <article className="item" key={task.id}><div className="row"><div><strong>{task.title}</strong><p className="muted">{DOMAIN_LABELS[task.domain]} · {task.due_date || "No due date"}</p></div><div className="row"><span className={`pill ${task.status}`}>{task.status.replaceAll("_", " ")}</span><select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => void changeStatus(task.id, event.target.value as TaskRecord["status"])}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select><button className="button danger" onClick={() => void deleteTask(task.id).then(reload).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not delete task."))}>Delete</button></div></div></article>)}</div> : <p className="empty">No tasks yet.</p>}</section>
  </>;
}
