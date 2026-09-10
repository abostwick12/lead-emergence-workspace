"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, RotateCcw, ShieldCheck } from "lucide-react";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { workspaceRead } from "@/lib/bundles/client";
import { valuePilotChange, valuePilotDashboard, valuePilotSession,
  type ValuePilotChange, type ValuePilotDefinition, type ValuePilotSession } from "@/vendor/lead-emergence-bundles/domain-contracts/value-pilot";
import styles from "./value-pilot.module.css";

type Answers = {
  outcome: boolean | null; signals: string[]; usefulness: number; trust: number; actionability: number;
  evidence: boolean | null; provenance: boolean | null; mutation: boolean | null; corrections: string;
};
type WithoutRequest<T> = T extends unknown ? Omit<T, "requestId"> : never;
type ValuePilotIntent = WithoutRequest<ValuePilotChange>;
const emptyAnswers: Answers = { outcome: null, signals: [], usefulness: 0, trust: 0, actionability: 0,
  evidence: null, provenance: null, mutation: null, corrections: "0" };
const labels = { strong_signal: "Strong user-reported signal", promising_signal: "Promising user-reported signal", needs_iteration: "Needs iteration" } as const;
const abandonLabels = { interrupted: "I was interrupted", outcome_unclear: "The expected outcome was unclear", source_gap: "I lacked the needed sources", workflow_friction: "The workflow got in the way", other: "Another reason" } as const;

class PilotRequestError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function changePilot(change: ValuePilotChange) {
  const { data, error } = await getWorkspaceClient().auth.getSession();
  if (error || !data.session) throw new PilotRequestError("Sign in to continue.", 401);
  const response = await fetch("/api/bundles/value-pilots", { method: "POST", cache: "no-store",
    headers: { Authorization: "Bearer " + data.session.access_token, "Content-Type": "application/json" }, body: JSON.stringify(change) });
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new PilotRequestError(body.message || "The value check could not be updated.", response.status);
  return valuePilotSession.parse(body);
}

function elapsedLabel(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? "1 measured minute" : `${minutes} measured minutes`;
}

function ResultSummary({ session }: { session: ValuePilotSession }) {
  if (session.status !== "completed" || !session.result) return null;
  const result = session.result;
  return <div className={styles.result}>
    <div><CheckCircle2 size={18}/><strong>{labels[result.assessment]}</strong></div>
    <dl>
      <div><dt>Elapsed</dt><dd>{elapsedLabel(result.elapsedSeconds)}</dd></div>
      <div><dt>Target</dt><dd>{result.targetMet ? `Met · ${session.targetMinutes} min` : `Over ${session.targetMinutes} min`}</dd></div>
      <div><dt>Estimated time saved</dt><dd>{result.estimatedMinutesSaved} min</dd></div>
      <div><dt>Trust gates</dt><dd>{result.qualityGatesMet ? "Met" : "Needs work"}</dd></div>
    </dl>
    <p>Usefulness {result.ratings.usefulness}/5 · Trust {result.ratings.trust}/5 · Actionability {result.ratings.actionability}/5 · {result.correctionCount} correction{result.correctionCount === 1 ? "" : "s"}</p>
    <small>The baseline was recorded before work began. Ratings and the usual-process baseline are user-reported; elapsed time is server-measured. One session is not representative proof.</small>
  </div>;
}

function BooleanChoice({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean) => void }) {
  return <label className={styles.field}><span>{label}</span><select value={value === null ? "" : value ? "yes" : "no"}
    onChange={event => onChange(event.target.value === "yes")} required>
    <option value="" disabled>Choose</option><option value="yes">Yes</option><option value="no">No</option>
  </select></label>;
}

function OutcomeForm({ definition, pending, onFinish, onAbandon }: {
  definition: ValuePilotDefinition; pending: boolean;
  onFinish: (answers: Answers) => void; onAbandon: (reason: keyof typeof abandonLabels) => void;
}) {
  const [answers, setAnswers] = useState(emptyAnswers);
  const [reason, setReason] = useState<keyof typeof abandonLabels>("interrupted");
  const valid = answers.outcome !== null && answers.usefulness > 0 && answers.trust > 0 && answers.actionability > 0
    && answers.evidence !== null && answers.provenance !== null && answers.mutation !== null
    && (!answers.outcome || answers.signals.length > 0) && Number.isInteger(Number(answers.corrections))
    && Number(answers.corrections) >= 0 && Number(answers.corrections) <= 100;
  const rating = (key: "usefulness" | "trust" | "actionability", label: string) => <label className={styles.field}><span>{label}</span>
    <select value={answers[key] || ""} onChange={event => setAnswers(current => ({ ...current, [key]: Number(event.target.value) }))} required>
      <option value="" disabled>Choose</option>{[1,2,3,4,5].map(value => <option key={value} value={value}>{value} · {value === 1 ? "Low" : value === 5 ? "High" : ""}</option>)}
    </select></label>;
  return <section className={styles.outcome} aria-label={`Record ${definition.displayName} result`}>
    <h3>Record what actually happened</h3><p>Answer from this session only. A disappointing result is useful product evidence.</p>
    <BooleanChoice label="Did you reach the expected first outcome?" value={answers.outcome}
      onChange={outcome => setAnswers(current => ({ ...current, outcome, signals: outcome ? current.signals : [] }))}/>
    {answers.outcome ? <fieldset><legend>Which declared signal occurred?</legend>{definition.successSignals.map(signal => <label className={styles.check} key={signal.id}>
      <input type="checkbox" checked={answers.signals.includes(signal.id)} onChange={event => setAnswers(current => ({ ...current,
        signals: event.target.checked ? [...current.signals, signal.id] : current.signals.filter(id => id !== signal.id) }))}/><span>{signal.description}</span></label>)}</fieldset> : null}
    <div className={styles.grid}>{rating("usefulness", "Useful result")}{rating("trust", "Result felt trustworthy")}{rating("actionability", "Next move was clear")}</div>
    <div className={styles.gates}>
      <BooleanChoice label="Evidence was visible where it mattered" value={answers.evidence} onChange={evidence => setAnswers(current => ({ ...current, evidence }))}/>
      <BooleanChoice label="Origin, freshness, or uncertainty was clear" value={answers.provenance} onChange={provenance => setAnswers(current => ({ ...current, provenance }))}/>
      <BooleanChoice label="Nothing changed without review and confirmation" value={answers.mutation} onChange={mutation => setAnswers(current => ({ ...current, mutation }))}/>
    </div>
    <label className={styles.field}><span>Corrections needed before the result was useful</span><input type="number" min="0" max="100" step="1" value={answers.corrections}
      onChange={event => setAnswers(current => ({ ...current, corrections: event.target.value }))}/></label>
    <div className={styles.actions}><button className="button" disabled={pending || !valid} onClick={() => onFinish(answers)}>{pending ? "Recording…" : "Record result"}</button>
      <label className={styles.stop}><span>Stop instead</span><select value={reason} onChange={event => setReason(event.target.value as keyof typeof abandonLabels)}>
        {Object.entries(abandonLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="button secondary" disabled={pending} onClick={() => onAbandon(reason)}>Stop this check</button></div>
  </section>;
}

export function BundleValuePilot() {
  const [dashboard, setDashboard] = useState<ReturnType<typeof valuePilotDashboard.parse> | null>(null);
  const [loading, setLoading] = useState(true); const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null);
  const [baselines, setBaselines] = useState<Record<string,string>>({}); const [openPilot, setOpenPilot] = useState<string | null>(null);
  const [rerunBundle, setRerunBundle] = useState<string | null>(null);
  const attempt = useRef<{ payload: string; change: ValuePilotChange } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);setError(null);
    try { setDashboard(valuePilotDashboard.parse(await workspaceRead("/api/bundles/value-pilots"))); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Value checks are temporarily unavailable."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const sessions = useMemo(() => dashboard?.sessions ?? [], [dashboard]);
  const exactChange = (base: ValuePilotIntent) => {
    const payload = JSON.stringify(base);
    if (attempt.current?.payload === payload) return attempt.current.change;
    const change = valuePilotChange.parse({ ...base, requestId: crypto.randomUUID() });
    attempt.current = { payload, change }; return change;
  };
  const update = async (base: ValuePilotIntent, success: string) => {
    setPending(true);setError(null);setMessage(null);const change = exactChange(base);
    try { await changePilot(change);attempt.current=null;setOpenPilot(null);setRerunBundle(null);setMessage(success);await load(); }
    catch (caught) {
      const requestError = caught instanceof PilotRequestError ? caught : null;
      if (requestError && requestError.status < 500) attempt.current=null;
      setError(caught instanceof Error ? caught.message : "The value check could not be updated.");
      if (requestError?.status === 409) await load();
    } finally { setPending(false); }
  };
  if (loading && !dashboard) return <section className={styles.page}><p role="status">Loading private value checks…</p></section>;
  return <section className={styles.page}>
    <header className={styles.hero}><p className="eyebrow workflow-kicker">Workspace Experience</p><h1>Does each bundle earn its place?</h1>
      <p>Run one focused task, compare it with your usual process, and record the result. Workspace saves measurements and ratings—not your prompt, sources, work, or output.</p>
      <div><ShieldCheck size={18}/><span>Private to this native workspace. Never available to assistant tools.</span></div></header>
    {message ? <p className="notice" role="status">{message}</p> : null}{error ? <div className="error" role="alert"><p>{error}</p><button className="button secondary" onClick={() => void load()}>Retry</button></div> : null}
    <div className={styles.cards}>{dashboard?.definitions.map(definition => {
      const history = sessions.filter(session => session.bundleKey === definition.bundleKey);
      const active = history.find(session => session.status === "active"); const latestCompleted = history.find(session => session.status === "completed");
      const baseline = Number(baselines[definition.bundleKey]);
      return <article className={styles.card} key={definition.bundleKey} data-available={definition.available}>
        <div className={styles.cardHead}><div><p>{definition.targetMinutes}-minute target</p><h2>{definition.displayName}</h2></div><span>{definition.available ? "Available" : "Not currently assigned"}</span></div>
        <p className={styles.promise}>{definition.promise}</p><div className={styles.expected}><strong>Expected first outcome</strong><p>{definition.firstRunOutcome}</p></div>
        {active ? <div className={styles.active}><p><Clock3 size={16}/> Measurement is running from the server start time.</p><div className={styles.actions}>
          <Link className="button" href={definition.workspaceRoute}>Open {definition.displayName} <ArrowRight size={15}/></Link>
          <button className="button secondary" onClick={() => setOpenPilot(current => current === active.id ? null : active.id)}>{openPilot === active.id ? "Close result form" : "Record the outcome"}</button></div>
          {openPilot === active.id ? <OutcomeForm definition={definition} pending={pending}
            onFinish={answers => void update({ operation:"finish",pilotId:active.id,expectedVersion:active.version,outcomeAchieved:answers.outcome!,successSignalIds:answers.signals,
              ratings:{usefulness:answers.usefulness,trust:answers.trust,actionability:answers.actionability},gates:{evidenceVisible:answers.evidence!,provenanceVisible:answers.provenance!,mutationControlPreserved:answers.mutation!},correctionCount:Number(answers.corrections)}, `${definition.displayName} result recorded.`)}
            onAbandon={reason => void update({operation:"abandon",pilotId:active.id,expectedVersion:active.version,reason}, `${definition.displayName} check stopped. The reason was retained without work content.`)}/> : null}
        </div> : latestCompleted && rerunBundle !== definition.bundleKey ? <div className={styles.start}><ResultSummary session={latestCompleted}/>
          <button className="button secondary" disabled={!definition.available || pending} onClick={() => setRerunBundle(definition.bundleKey)}><RotateCcw size={15}/> Run another check</button></div>
        : <div className={styles.start}><label className={styles.field}><span>Before starting, how many minutes would this take with your usual process?</span>
          <input type="number" min="1" max="480" step="1" inputMode="numeric" value={baselines[definition.bundleKey] ?? ""} placeholder="Minutes"
            onChange={event => setBaselines(current => ({ ...current, [definition.bundleKey]: event.target.value }))} disabled={!definition.available}/></label>
          <button className="button" disabled={!definition.available || pending || !Number.isInteger(baseline) || baseline < 1 || baseline > 480}
            onClick={() => void update({operation:"start",bundleKey:definition.bundleKey,baselineMinutes:baseline}, `${definition.displayName} measurement started.`)}>
            {pending ? "Please wait…" : latestCompleted ? "Start another measurement" : "Start value check"}</button></div>}
        {latestCompleted && (active || rerunBundle === definition.bundleKey) ? <ResultSummary session={latestCompleted}/> : null}
        {history.length ? <p className={styles.history}>{history.length} private session{history.length === 1 ? "" : "s"} retained · {history.filter(item => item.status === "completed").length} completed</p> : null}
      </article>;
    })}</div>
  </section>;
}
