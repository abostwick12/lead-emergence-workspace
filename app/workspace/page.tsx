"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, CheckCircle2, CircleDashed, Inbox, MessageSquare, Radio, Sparkles } from "lucide-react";
import { CapabilityLockedState } from "@/components/capability-locked-state";
import { useWorkspace } from "@/components/workspace-provider";
import { capabilityEnabled } from "@/lib/workspace/capabilities";
import { countAiConversations, listCaptures, listDailyBriefings, listIntegrationConnections, listJobApplications, listTasks, listWorkspaceActivity } from "@/lib/workspace/repository";
import type { CaptureRecord, DailyBriefingRecord, IntegrationConnection, JobApplicationRecord, TaskRecord, WorkspaceAuditEvent } from "@/lib/workspace/types";

type DashboardState = { tasks: TaskRecord[]; captures: CaptureRecord[]; jobs: JobApplicationRecord[]; integrations: IntegrationConnection[]; briefings: DailyBriefingRecord[]; activity: WorkspaceAuditEvent[]; conversationCount: number };
const emptyState: DashboardState = { tasks: [], captures: [], jobs: [], integrations: [], briefings: [], activity: [], conversationCount: 0 };

export default function WorkspaceOverviewPage() {
  const { workspace, configuration, plan, capabilities } = useWorkspace();
  const [state, setState] = useState<DashboardState>(emptyState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const [tasks, captures, jobs, integrations, briefings, activity, conversationCount] = await Promise.all([listTasks(workspace.id), listCaptures(workspace.id), listJobApplications(workspace.id), listIntegrationConnections(workspace.id), listDailyBriefings(workspace.id), listWorkspaceActivity(workspace.id), countAiConversations(workspace.id)]);
      setState({ tasks, captures, jobs, integrations, briefings, activity, conversationCount });
      setError(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load the command center."); }
    finally { setLoading(false); }
  }, [workspace]);
  useEffect(() => { void reload(); }, [reload]);

  const openTasks = state.tasks.filter((task) => task.status !== "done");
  const priority = useMemo(() => [...openTasks].sort((left, right) => priorityRank(left) - priorityRank(right) || (left.due_date || "9999-12-31").localeCompare(right.due_date || "9999-12-31"))[0], [openTasks]);
  const planned = useMemo(() => openTasks.filter((task) => task.due_date).sort((left, right) => (left.due_date || "").localeCompare(right.due_date || "")).slice(0, 4), [openTasks]);
  const activeJobs = state.jobs.filter((job) => !["rejected", "withdrawn"].includes(job.status));
  const currentJob = [...activeJobs].sort((left, right) => (left.next_follow_up_date || "9999-12-31").localeCompare(right.next_follow_up_date || "9999-12-31"))[0];
  const gmail = state.integrations.find((integration) => integration.provider === "gmail");
  const slack = state.integrations.find((integration) => integration.provider === "slack");
  const configuredPriority = configuration.find((item) => item.active && item.area === "priorities" && ["user_confirmed", "validated_configuration"].includes(item.epistemic_status))?.content.text;
  const attention = configuration.find((item) => item.active && item.area === "areas_of_attention" && ["user_confirmed", "validated_configuration"].includes(item.epistemic_status))?.content.text;
  const briefPreference = configuration.find((item) => item.active && item.area === "daily_brief" && ["user_confirmed", "validated_configuration"].includes(item.epistemic_status))?.content.text;

  if (!capabilityEnabled(capabilities, "core_workspace", plan?.status)) return <CapabilityLockedState title="Personal Workspace" benefit="Core Workspace keeps your leadership context, commitments, decisions, and learning in one private system." suspended={plan?.status === "suspended"} />;

  return <section className="command-dashboard" aria-label="Lead Emergence Workspace command center">
    {error ? <p className="error">{error}</p> : null}
    <div className="command-content"><section className="command-bento">
      <article className="synthesis-hero"><div className="hero-topline"><span><Sparkles size={16} />Leadership focus</span><small>{loading ? "Loading Workspace signals…" : `${state.activity.length} recent change${state.activity.length === 1 ? "" : "s"} · ${state.conversationCount} retained conversation ${state.conversationCount === 1 ? "entry" : "entries"}`}</small></div><div className="hero-main"><p className="eyebrow hero-eyebrow">What deserves attention</p>{priority ? <><h1>{priority.title}</h1><p>{priority.description || `A ${priority.priority} priority in ${priority.domain.replaceAll("_", " ")}—kept in view from your real Workspace task list.`}</p></> : configuredPriority ? <><h1>{configuredPriority}</h1><p>Drawn from your confirmed setup. Turn it into a task or capture what you notice next.</p></> : <><h1>Choose the work that matters most.</h1><p>Capture a commitment or create a task to establish today’s focus. Workspace will learn only from what you confirm.</p></>}</div><div className="hero-actions">{priority ? <Link className="button hero-primary" href="/workspace/tasks"><CheckCircle2 size={16} />Open task <ArrowRight size={15} /></Link> : <Link className="button hero-primary" href="/workspace/capture"><Inbox size={16} />Capture what you notice <ArrowRight size={15} /></Link>}<Link className="button secondary hero-secondary" href="/workspace/tasks">View daily focus</Link><button className="hero-lewis-deferred" disabled title="Assistant synthesis is available only through a connected interface">Ask Workspace <span>Connect an assistant</span></button></div></article>
      <article className="planner-card command-card"><CardHeading icon={<CalendarDays size={16} />} label="Daily Planner" detail={planned.length ? `${planned.length} due task${planned.length === 1 ? "" : "s"}` : "No scheduled items"} /><div className="planner-list">{planned.length ? planned.map((task, index) => <div className="planner-item" key={task.id}><time>{task.due_date}</time><span className={index === 0 ? "planner-dot active" : "planner-dot"} /><div><strong>{task.title}</strong><p>{task.domain.replaceAll("_", " ")} · {task.status.replaceAll("_", " ")}</p></div></div>) : <EmptyCopy>Tasks with a due date will appear here. Calendar activity is unavailable until its Workspace integration is reconnected.</EmptyCopy>}</div></article>
      <article className="integration-context-card command-card"><CardHeading icon={<Inbox size={17} />} label="Inbox" detail={gmail?.status === "connected" ? "Connected" : "Reconnect required"} /><p className="integration-state-copy">Gmail messages are unavailable. Existing integration metadata has no copied account, token, or mailbox content.</p><Link href="/workspace/integrations" className="card-link">View integration state <ArrowRight size={15} /></Link></article>
      <article className="integration-context-card command-card"><CardHeading icon={<MessageSquare size={17} />} label="Slack" detail={slack?.status === "connected" ? "Connected" : "Reconnect required"} /><p className="integration-state-copy">Slack messages, channels, and people remain unavailable until a Workspace-specific connection is approved.</p><Link href="/workspace/integrations" className="card-link">View integration state <ArrowRight size={15} /></Link></article>
      <article className="network-card command-card"><CardHeading icon={<Radio size={16} />} label="Areas of Attention" detail={attention ? "Confirmed context" : "Ready to shape"} /><div className="deferred-panel"><p>{attention || "What are you noticing?"}</p><span>{attention ? "This is confirmed Personal context—not an inferred priority." : "Add or refine this context in Workspace Settings. You do not need an external connection."}</span></div><Link href="/workspace/settings#workspace" className="card-link">Edit Personal setup <ArrowRight size={15} /></Link></article>
      <article className="pipeline-card command-card"><CardHeading icon={<BriefcaseBusiness size={16} />} label="Career Pipeline" detail={`${activeJobs.length} active`} />{currentJob ? <><p className="pipeline-kicker">Next opportunity</p><h2>{currentJob.company} <em>· {currentJob.role}</em></h2><p className="pipeline-meta">{currentJob.next_follow_up_date ? `Follow up ${currentJob.next_follow_up_date}` : "No follow-up date set"}</p><PipelineProgress jobs={state.jobs} /></> : <EmptyCopy>Add an opportunity to start a real, private career pipeline.</EmptyCopy>}<Link href="/workspace/career" className="card-link">Open pipeline <ArrowRight size={15} /></Link></article>
      <article className="briefing-card command-card"><CardHeading icon={<Sparkles size={16} />} label="Daily Brief" detail={state.briefings[0] ? state.briefings[0].briefing_date : briefPreference ? "Preference saved" : "Not configured"} />{state.briefings[0] ? <p className="briefing-copy">A retained Workspace briefing is available for this date. No new AI synthesis is being simulated.</p> : briefPreference ? <p className="briefing-copy">{briefPreference} Workspace will use tasks, captures, priorities, commitments, and recent change when a brief is produced.</p> : <EmptyCopy>Choose a cadence in Settings. A useful brief can begin with Workspace data even when no external systems are connected.</EmptyCopy>}<Link href="/workspace/settings#workspace" className="card-link">Configure brief <ArrowRight size={15} /></Link></article>
    </section></div>
    <aside className="activity-rail" aria-label="Workspace live feed"><div className="activity-rail-header"><div><Radio size={16} /><h2>Live Feed</h2></div><span>{state.activity.length} recorded</span></div><div className="activity-filters" aria-label="Activity categories"><button data-active>All</button><button disabled>Comms</button><button disabled>Network</button><button disabled>Calendar</button></div><div className="activity-list">{state.activity.length ? state.activity.slice(0, 10).map((event) => <ActivityItem event={event} key={event.id} />) : <EmptyCopy>No Workspace activity has been recorded yet. Real task, capture, and pipeline changes will appear here.</EmptyCopy>}</div></aside>
  </section>;
}

function CardHeading({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) { return <div className="command-card-heading"><div>{icon}<h2>{label}</h2></div><span>{detail}</span></div>; }
function EmptyCopy({ children }: { children: React.ReactNode }) { return <p className="command-empty">{children}</p>; }
function PipelineProgress({ jobs }: { jobs: JobApplicationRecord[] }) { const stages = ["researching", "applied", "phone_screen", "interview", "offer"] as const; const furthest = Math.max(0, ...jobs.map((job) => Math.max(0, stages.indexOf(job.status as typeof stages[number])))); return <div className="pipeline-progress" aria-label={`Pipeline has ${jobs.length} opportunities`}><div>{stages.map((stage, index) => <span key={stage} className={index <= furthest ? "filled" : ""} />)}</div><p>{stages.map((stage) => stage.replaceAll("_", " ")).join(" · ")}</p></div>; }
function ActivityItem({ event }: { event: WorkspaceAuditEvent }) { const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(event.created_at)); return <article className="activity-item"><span className="activity-icon"><CircleDashed size={15} /></span><div><p>{event.entity_type.replaceAll("_", " ")} · {event.event_type.replaceAll("_", " ")}</p><strong>Workspace activity recorded</strong></div><time>{time}</time></article>; }
function priorityRank(task: TaskRecord) { return ["critical", "high", "medium", "low"].indexOf(task.priority); }
