"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { CapabilityLockedState } from "@/components/capability-locked-state";
import { useWorkspace } from "@/components/workspace-provider";
import { capabilityEnabled } from "@/lib/workspace/capabilities";
import { createTask, deleteTask, listTasks, updateTask } from "@/lib/workspace/repository";
import { DOMAIN_LABELS, type TaskPriority, type TaskRecord, type TaskStatus, type WorkspaceDomain } from "@/lib/workspace/types";

const domains = Object.keys(DOMAIN_LABELS) as WorkspaceDomain[];
const lanes: Array<{ value: TaskStatus; label: string }> = [{ value: "todo", label: "Ready" }, { value: "in_progress", label: "In progress" }, { value: "blocked", label: "Blocked" }, { value: "done", label: "Complete" }];

export default function TasksPage() {
  const { workspace, user, plan, capabilities } = useWorkspace();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<WorkspaceDomain>("general");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState<WorkspaceDomain | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reload = useCallback(async () => { if (workspace) setTasks(await listTasks(workspace.id)); }, [workspace]);
  useEffect(() => { void reload().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load tasks.")); }, [reload]);
  const visible = useMemo(() => filter === "all" ? tasks : tasks.filter((task) => task.domain === filter), [filter, tasks]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !user || !title.trim()) return;
    setSaving(true); setError(null);
    try { await createTask({ workspaceId: workspace.id, userId: user.id, title, domain, priority, dueDate: dueDate || null }); setTitle(""); setDueDate(""); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add task."); }
    finally { setSaving(false); }
  }
  async function move(task: TaskRecord, status: TaskStatus) { try { await updateTask(task.id, { status }); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update task."); } }
  async function remove(id: string) { try { await deleteTask(id); await reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove task."); } }

  if (!capabilityEnabled(capabilities, "tasks", plan?.status)) return <CapabilityLockedState title="Daily Focus" benefit="Daily Focus turns commitments into a clear, editable view of the work that matters." suspended={plan?.status === "suspended"} />;

  return <section className="workflow-page"><header className="workflow-heading"><p className="eyebrow">Daily Focus</p><h1 className="page-title">Move the work that matters.</h1><p className="page-lede">A private Workspace board for current commitments. Each change stays within your authenticated Workspace and produces its existing audit event.</p></header>
    <section className="workflow-composer"><form className="task-composer" onSubmit={add}><label>Task title<input required value={title} placeholder="What needs to move forward?" onChange={(event) => setTitle(event.target.value)} /></label><label>Domain<select value={domain} onChange={(event) => setDomain(event.target.value as WorkspaceDomain)}>{domains.map((value) => <option key={value} value={value}>{DOMAIN_LABELS[value]}</option>)}</select></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><button className="button" disabled={saving}>{saving ? "Adding…" : <><Plus size={16} />Add task</>}</button></form></section>
    <div className="domain-filters" aria-label="Filter tasks by domain"><button data-active={filter === "all"} onClick={() => setFilter("all")}>All tasks</button>{domains.map((value) => <button key={value} data-active={filter === value} onClick={() => setFilter(value)}>{DOMAIN_LABELS[value]}</button>)}</div>
    {error ? <p className="error">{error}</p> : null}
    <section className="kanban-board" aria-label="Task board">{lanes.map((lane) => { const laneTasks = visible.filter((task) => task.status === lane.value); return <article className="kanban-lane" key={lane.value}><header><div><span className={`lane-dot ${lane.value}`} /><h2>{lane.label}</h2></div><span>{laneTasks.length}</span></header><div className="kanban-stack">{laneTasks.length ? laneTasks.map((task) => <article className="task-card" key={task.id}><div className="task-card-top"><span className={`priority-mark ${task.priority}`}>{task.priority}</span><button aria-label={`Delete ${task.title}`} onClick={() => void remove(task.id)}><X size={15} /></button></div><strong>{task.title}</strong><p>{DOMAIN_LABELS[task.domain]}{task.due_date ? ` · due ${task.due_date}` : ""}</p><select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => void move(task, event.target.value as TaskStatus)}>{lanes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></article>) : <p className="lane-empty">This lane is ready when a commitment reaches this stage. Add a task above, then move it as the work changes.</p>}</div></article>; })}</section>
  </section>;
}
