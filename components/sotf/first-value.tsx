"use client";

import { useState, type FormEvent } from "react";
import { commandSchema, type Command } from "@/lib/sotf/contracts";
import styles from "./sotf.module.css";

export function FirstValue({ onSave, preview }: { onSave: (command: Command) => Promise<void>; preview: boolean }) {
  const [step, setStep] = useState(0);
  const [timing, setTiming] = useState("");
  const [question, setQuestion] = useState("");
  const [hours, setHours] = useState("8");
  const [work, setWork] = useState("");
  const [environment, setEnvironment] = useState("");
  const [directions, setDirections] = useState(["", ""]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 2) { setStep(step + 1); return; }
    setPending(true); setError("");
    try {
      const criteria = [
        { id: crypto.randomUUID(), label: "Actual contribution", dimension: "actual_work", desired: work, importance: 4, nonNegotiable: false, confirmed: true },
        { id: crypto.randomUUID(), label: "Working environment", dimension: "environment", desired: environment, importance: 4, nonNegotiable: false, confirmed: true }
      ];
      await onSave(commandSchema.parse({ type: "start_transition", timing, question, weeklyHours: Number(hours), criteria,
        hypotheses: directions.filter((value) => value.trim()).map((proposition) => ({ id: crypto.randomUUID(), proposition, whyPromising: "A possibility I have chosen to investigate; fit is not yet established.", assumptions: ["The actual work and environment will fit the criteria I confirmed."], gaps: [], nextExperiment: "Review a real role and ask a practitioner about the actual work.", reviewTrigger: "After reviewing a role and completing a practitioner conversation.", status: "continue", confidenceExplanation: "Early hypothesis. Gather evidence before committing to a direction." }))
      }));
    } catch (caught) { setError(caught instanceof Error ? ("issues" in caught ? "Complete each step with a short answer before confirming." : caught.message) : "Could not verify this step."); }
    finally { setPending(false); }
  }
  return <section className={styles.firstValue}>
    <p className={styles.eyebrow}>SOTF Bundle · Begin where you are</p>
    <h1>You do not need the right title yet.<br /><em>Start with the next question.</em></h1>
    <p>We will keep the decision, the evidence, and your next move connected. A short answer is enough.</p>
    {preview ? <p className={styles.notice}>Fictional preview. Use invented information; nothing here is saved to an account.</p> : null}
    <ol className={styles.steps} aria-label="First session progress">{["Your next decision", "What good looks like", "Two possibilities"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}>{index + 1}<span>{label}</span></li>)}</ol>
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      {step === 0 ? <>
        <label>Where are you in the transition?<input required maxLength={240} value={timing} onChange={(event) => setTiming(event.target.value)} placeholder="For example: exploring, six months before transition" /></label>
        <label>What is the most useful decision to work on?<textarea required maxLength={5000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="For example: which kind of work would give me meaningful ownership?" /></label>
        <label>How many hours a week can you give this?<input required type="number" min={1} max={80} value={hours} onChange={(event) => setHours(event.target.value)} /></label>
      </> : step === 1 ? <>
        <label>What would you like to spend time actually doing?<textarea required maxLength={5000} value={work} onChange={(event) => setWork(event.target.value)} placeholder="Describe work you want to test—not a résumé summary." /></label>
        <label>What kind of working environment do you want?<textarea required maxLength={5000} value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="For example: room to make decisions, a clear team purpose, and a sustainable pace." /></label>
        <p className={styles.help}>These become two criteria you can revise deliberately. Keep private or sensitive material out of this operational pilot; its protected-context capability is separate.</p>
      </> : <>
        <p>Choose two possibilities to test. These are hypotheses, not commitments. Your connected ChatGPT conversation can help propose alternatives from the context you choose to share.</p>
        <div className={styles.chips}>{["Program delivery", "Operations improvement", "Transformation consulting", "A direction I have not named"].map((value) => <button key={value} type="button" onClick={() => setDirections((current) => current[0] ? [current[0], value] : [value, current[1]])}>{value}</button>)}</div>
        {directions.map((value, index) => <label key={index}>Possibility {index + 1}<input required maxLength={240} value={value} onChange={(event) => setDirections((current) => current.map((item, position) => position === index ? event.target.value : item))} /></label>)}
        <p className={styles.notice}>Next: bring one real job. We will separate eligibility from fit and identify the question worth investigating.</p>
      </>}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <div className={styles.formActions}>{step > 0 ? <button type="button" onClick={() => setStep(step - 1)} disabled={pending}>Back</button> : null}<button className={styles.primary} disabled={pending}>{pending ? "Verifying…" : step === 2 ? "Confirm these starting points" : "Continue"}</button></div>
    </form>
  </section>;
}
