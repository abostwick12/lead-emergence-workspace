"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, CircleDashed, Mail, MessageSquare, RefreshCw, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { listIntegrationConnections } from "@/lib/workspace/repository";
import { WORKSPACE_BUNDLES } from "@/lib/workspace/bundles";
import { buildDailyRhythmPlan, type RhythmStep } from "@/lib/workspace/rhythm";
import type { IntegrationConnection } from "@/lib/workspace/types";

export default function SotfBundlePage() {
  const { workspace } = useWorkspace();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      setConnections(await listIntegrationConnections(workspace.id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load SOTF Bundle connection state.");
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { void reload(); }, [reload]);

  const connectedProviders = useMemo(
    () => connections.filter((connection) => connection.status === "connected").map((connection) => connection.provider),
    [connections]
  );
  const rhythm = useMemo(() => buildDailyRhythmPlan(connectedProviders), [connectedProviders]);
  const bundle = WORKSPACE_BUNDLES.sotf_transition;

  return <section className="workflow-page" aria-label="SOTF Bundle">
    <p className="eyebrow workflow-kicker">SOTF Bundle</p>
    <h1 className="page-title">Turn transition context into a daily operating rhythm.</h1>
    <p className="page-lede">{bundle.description} The same approved professional context can remain useful after transition instead of being discarded when the fellowship ends.</p>
    {error ? <p className="error">{error}</p> : null}

    <section className="grid two" style={{ marginTop: 20 }}>
      <article className="card">
        <div className="row"><div><p className="eyebrow">Morning</p><h2>Start current, not cold.</h2></div><Sparkles size={22} /></div>
        <div style={{ marginTop: 14 }}>{rhythm.morning.map((step) => <RhythmItem step={step} key={step.id} />)}</div>
      </article>
      <article className="card">
        <div className="row"><div><p className="eyebrow">Continuous</p><h2>Promote signal, not noise.</h2></div><RefreshCw size={22} /></div>
        <div style={{ marginTop: 14 }}>{rhythm.continuous.map((step) => <RhythmItem step={step} key={step.id} />)}</div>
      </article>
      <article className="card">
        <div className="row"><div><p className="eyebrow">End of day</p><h2>Reconcile what actually changed.</h2></div><CheckCircle2 size={22} /></div>
        <div style={{ marginTop: 14 }}>{rhythm.evening.map((step) => <RhythmItem step={step} key={step.id} />)}</div>
      </article>
      <article className="card">
        <div className="row"><div><p className="eyebrow">Weekly</p><h2>Improve the system with you.</h2></div><CalendarDays size={22} /></div>
        <div style={{ marginTop: 14 }}>{rhythm.weekly.map((step) => <RhythmItem step={step} key={step.id} />)}</div>
      </article>
    </section>

    <section className="grid two" style={{ marginTop: 18 }}>
      <article className="card">
        <h2>Connection readiness</h2>
        <p className="page-lede">The SOTF Bundle can begin with Workspace data now. Email, Slack, and calendar steps become active as their approved Workspace connections are available.</p>
        <ConnectionRow icon={<Mail size={17} />} label="Gmail" connection={connections.find((item) => item.provider === "gmail")} loading={loading} />
        <ConnectionRow icon={<MessageSquare size={17} />} label="Slack" connection={connections.find((item) => item.provider === "slack")} loading={loading} />
        <ConnectionRow icon={<CalendarDays size={17} />} label="Google Calendar" connection={connections.find((item) => item.provider === "google_calendar")} loading={loading} />
        <Link className="button secondary" href="/workspace/integrations" style={{ marginTop: 14 }}>Manage connections <ArrowRight size={15} /></Link>
      </article>
      <article className="card">
        <h2>Memory guardrail</h2>
        <p className="notice">Ingestion is not memory. The SOTF Bundle can surface possible learning from email, Slack, meetings, coaching notes, or documents, but durable professional context must be confirmed before promotion. Sensitive context always requires review.</p>
        <p className="muted" style={{ marginTop: 14 }}>This keeps the long-term context portable and useful after transition without turning every message or transcript into permanent memory.</p>
        <Link className="button secondary" href="/workspace/memory" style={{ marginTop: 14 }}>View memory <ArrowRight size={15} /></Link>
      </article>
    </section>
  </section>;
}

function RhythmItem({ step }: { step: RhythmStep }) {
  const status = step.status === "ready" ? "Ready" : step.status === "review" ? "Review required" : "Connection required";
  const Icon = step.status === "ready" ? CheckCircle2 : step.status === "review" ? CircleAlert : CircleDashed;
  return <article className="item" style={{ marginTop: 10 }}><div className="row"><div><strong>{step.label}</strong><p className="muted">{step.purpose}</p></div><span className="pill"><Icon size={14} /> {status}</span></div></article>;
}

function ConnectionRow({ icon, label, connection, loading }: { icon: React.ReactNode; label: string; connection?: IntegrationConnection; loading: boolean }) {
  const status = loading ? "Checking…" : connection?.status === "connected" ? "Connected" : connection?.status === "error" ? "Needs attention" : "Connection required";
  return <div className="item" style={{ marginTop: 10 }}><div className="row"><span style={{ display: "flex", alignItems: "center", gap: 8 }}>{icon}<strong>{label}</strong></span><span className="pill">{status}</span></div></div>;
}
