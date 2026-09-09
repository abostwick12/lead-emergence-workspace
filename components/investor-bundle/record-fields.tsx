"use client";
import { useState } from "react";
import type { Instrument, InvestorData, InvestorWatchlist, InvestorThesis, InvestorFiling, InvestorBrief, InvestorKind } from "@/lib/investor-bundle/contracts";
import { filingForms, filingWarnings, researchGaps } from "@/lib/investor-bundle/contracts";
import { Field, Choice, NumberField, Disclosure, styles } from "./common";
import { Citations, SourceFields, ClaimFields, CatalystFields, ScenarioFields } from "./research-fields";
import { PublicFilingsPanel } from "./public-filings";

export function InstrumentFields({ value, onChange, label = "Company or instrument" }: { value: Instrument; onChange: (v: Instrument) => void; label?: string }) {
  return <><Field label={label} value={value.name} max={240} required onChange={name => onChange({ ...value, name })} />
    <div className={styles.grid}><Field label="Ticker (optional)" value={value.ticker} max={30} onChange={ticker => onChange({ ...value, ticker })} />
      <Field label="Exchange (optional)" value={value.exchange} max={100} onChange={exchange => onChange({ ...value, exchange })} /></div>
    <Field label="Subject CIK (optional, 10 digits)" value={value.cik} max={10} hint="Identify the subject separately from the person or manager that filed a disclosure." onChange={cik => onChange({ ...value, cik })} /></>;
}
function WatchlistFields({ value, onChange }: { value: InvestorWatchlist; onChange: (v: InvestorWatchlist) => void }) {
  return <section className={styles.section}><h2>Keep a reason for watching</h2><Field label="Watchlist purpose" value={value.purpose} multiline onChange={purpose => onChange({ ...value, purpose })} />
    {value.entries.map((entry, i) => { const update = (patch: Partial<typeof entry>) => onChange({ ...value, entries: value.entries.map(e => e.id === entry.id ? { ...e, ...patch } : e) });
      return <Disclosure key={entry.id} initialOpen={!entry.instrument.name} summary={<>Instrument {i + 1} · {entry.instrument.name || "New instrument"} · {entry.status}</>}>
        <InstrumentFields value={entry.instrument} onChange={instrument => update({ instrument })} />
        <Field label="Why watch this?" value={entry.rationale} max={2000} multiline required onChange={rationale => update({ rationale })} />
        <Field label="Next research question" value={entry.nextQuestion} max={2000} onChange={nextQuestion => update({ nextQuestion })} />
        <div className={styles.grid}><Field label="Instrument review date" type="date" value={entry.reviewDate ?? ""} onChange={v => update({ reviewDate: v || null })} />
          <Choice label="Watch status" value={entry.status} values={["watching", "paused", "archived"]} onChange={status => update({ status: status as typeof entry.status })} /></div>
        <button type="button" onClick={() => onChange({ ...value, entries: value.entries.filter(e => e.id !== entry.id) })}>Remove instrument {i + 1}</button>
      </Disclosure>;
    })}
    {!value.entries.length && <p className={styles.muted}>Start with one company and the question worth answering. This does not connect holdings or track live prices.</p>}
    <button type="button" disabled={value.entries.length >= 50} onClick={() => onChange({ ...value, entries: [...value.entries, { id: crypto.randomUUID(), instrument: { name: "", ticker: "", exchange: "", cik: "" }, rationale: "", nextQuestion: "", reviewDate: null, status: "watching" }] })}>Add instrument</button>
  </section>;
}
function ThesisFields({ value, onChange }: { value: InvestorThesis; onChange: (v: InvestorThesis) => void }) {
  return <><section className={styles.section}><h2>A thesis you can challenge</h2><InstrumentFields value={value.instrument} onChange={instrument => onChange({ ...value, instrument })} />
    <Field label="Research question" value={value.question} required multiline onChange={question => onChange({ ...value, question })} />
    <Field label="Working thesis" value={value.thesis} required multiline max={8000} onChange={thesis => onChange({ ...value, thesis })} />
    <Field label="Research horizon" value={value.horizon} max={200} required hint="For example, the next reporting cycle; this is not an instruction to hold or trade." onChange={horizon => onChange({ ...value, horizon })} />
    <div className={styles.grid}><Choice label="Current stance" value={value.stance} values={["investigating", "constructive", "cautious", "mixed", "invalidated"]} onChange={stance => onChange({ ...value, stance: stance as InvestorThesis["stance"] })} />
      <NumberField label="Thesis confidence (%)" value={value.confidence} hint="Optional subjective judgment, not a measured chance of success." onChange={confidence => onChange({ ...value, confidence })} /></div>
    <Choice label="What changed since your last review?" value={value.changeAssessment} values={["not_reviewed", "no_material_change", "supported", "challenged", "invalidated"]} onChange={changeAssessment => onChange({ ...value, changeAssessment: changeAssessment as InvestorThesis["changeAssessment"] })} />
    <Field label="Reason for the change assessment" value={value.changeReason} multiline hint="Even a no-change conclusion needs recorded sources and evidence claims. An empty search does not establish no change." onChange={changeReason => onChange({ ...value, changeReason })} />
  </section><section className={styles.section}><h2>What would prove this thesis wrong?</h2>
    {value.invalidations.map((item, i) => { const update = (patch: Partial<typeof item>) => onChange({ ...value, invalidations: value.invalidations.map(x => x.id === item.id ? { ...x, ...patch } : x) });
      return <Disclosure key={item.id} initialOpen={!item.condition} summary={<>Condition {i + 1} · {item.condition || "New invalidation condition"} · {item.status}</>}>
        <Field label="Observable invalidation condition" value={item.condition} max={2000} required multiline onChange={condition => update({ condition })} />
        <Choice label="Condition assessment" value={item.status} values={["unchecked", "not_triggered", "triggered"]} onChange={status => update({ status: status as typeof item.status })} />
        <Field label="Assessment and limitations" value={item.assessment} max={2000} multiline onChange={assessment => update({ assessment })} />
        <Citations sources={value.sources} value={item.sourceIds} onChange={sourceIds => update({ sourceIds })} />
        <button type="button" onClick={() => onChange({ ...value, invalidations: value.invalidations.filter(x => x.id !== item.id) })}>Remove condition {i + 1}</button>
      </Disclosure>;
    })}<button type="button" disabled={value.invalidations.length >= 20} onClick={() => onChange({ ...value, invalidations: [...value.invalidations, { id: crypto.randomUUID(), condition: "", status: "unchecked", sourceIds: [], assessment: "" }] })}>Add invalidation condition</button>
  </section></>;
}
function FilingFields({ value, onChange }: { value: InvestorFiling; onChange: (v: InvestorFiling) => void }) {
  return <><PublicFilingsPanel value={value} onChange={onChange} /><section className={styles.section}><h2>The disclosure and your question</h2>
    <InstrumentFields value={value.instrument} onChange={instrument => onChange({ ...value, instrument })} />
    <div className={styles.grid}><Field label="Filer name" value={value.filerName} max={240} required onChange={filerName => onChange({ ...value, filerName })} />
      <Field label="Filer CIK (optional, 10 digits)" value={value.filerCik} max={10} onChange={filerCik => onChange({ ...value, filerCik })} /></div>
    <div className={styles.grid}><Choice label="SEC form" value={value.form} values={filingForms} onChange={form => onChange({ ...value, form: form as InvestorFiling["form"] })} />
      <Field label="Accession number (optional)" value={value.accession} max={20} onChange={accession => onChange({ ...value, accession })} /></div>
    <Field label="Filing URL" value={value.filingUrl} max={2000} type="url" required onChange={filingUrl => onChange({ ...value, filingUrl })} />
    <div className={styles.grid}><Field label="Filed date" value={value.filedDate} type="date" required onChange={filedDate => onChange({ ...value, filedDate })} />
      <Field label="Reported period end" value={value.periodEnd ?? ""} type="date" onChange={v => onChange({ ...value, periodEnd: v || null })} /></div>
    <Field label="Earlier filing and amendment context" value={value.amendmentOf} max={2000} multiline onChange={amendmentOf => onChange({ ...value, amendmentOf })} />
    <Field label="Question this filing should help answer" value={value.question} required multiline onChange={question => onChange({ ...value, question })} />
    {(value.form === "4" || value.form === "4/A") && <><h3>Read the transaction, not just the headline</h3>
      <div className={styles.grid}><Field label="Transaction date" value={value.transactionDate ?? ""} type="date" onChange={v => onChange({ ...value, transactionDate: v || null })} />
        <Field label="Transaction codes" value={value.transactionCodes} max={200} onChange={transactionCodes => onChange({ ...value, transactionCodes })} /></div>
      <Field label="Transaction footnotes and derivative context" value={value.transactionFootnotes} multiline max={8000} onChange={transactionFootnotes => onChange({ ...value, transactionFootnotes })} />
      <Choice label="Rule 10b5-1 plan disclosure" value={value.plan10b51} values={["unknown", "disclosed", "not_disclosed"]} onChange={plan10b51 => onChange({ ...value, plan10b51: plan10b51 as InvestorFiling["plan10b51"] })} /></>}
    <Field label="Holdings, scope and reporting-lag limitations" value={value.holdingsLimitations} multiline required={value.form.startsWith("13F")} onChange={holdingsLimitations => onChange({ ...value, holdingsLimitations })} />
    <ul className={styles.notice}>{filingWarnings(value, value.asOfDate).map(w => <li key={w}>{w}</li>)}</ul>
  </section></>;
}
function BriefFields({ value, onChange }: { value: InvestorBrief; onChange: (v: InvestorBrief) => void }) {
  return <section className={styles.section}><h2>A brief with a clear boundary</h2><Field label="Market or company scope" value={value.scope} max={2000} required multiline onChange={scope => onChange({ ...value, scope })} />
    <div className={styles.grid}><Field label="Brief window starts" value={value.periodStart} type="date" required onChange={periodStart => onChange({ ...value, periodStart })} />
      <Field label="Brief window ends" value={value.periodEnd} type="date" required onChange={periodEnd => onChange({ ...value, periodEnd })} /></div>
    <Field label="Research summary" value={value.summary} required multiline max={8000} onChange={summary => onChange({ ...value, summary })} />
  </section>;
}
export function RecordFields({ kind, value, onChange }: { kind: InvestorKind; value: InvestorData; onChange: (v: InvestorData) => void }) {
  const [tab, setTab] = useState("Overview"), research = "sources" in value ? value : null;
  const tabs = research ? ["Overview", "Evidence", "Catalysts", ...(kind === "thesis" ? ["Scenarios"] : [])] : ["Overview"];
  const gaps = researchGaps(value, value.asOfDate);
  return <><div className={styles.grid}><Field label="Record title" value={value.title} required max={240} onChange={title => onChange({ ...value, title })} />
    <Choice label="Record status" value={value.status} values={["draft", "active", "review_required", "archived"]} onChange={status => onChange({ ...value, status: status as InvestorData["status"] })} />
    <Field label="Research as-of date" value={value.asOfDate} type="date" required onChange={asOfDate => onChange({ ...value, asOfDate })} />
    <Field label="Next review date" value={value.reviewDate ?? ""} type="date" onChange={v => onChange({ ...value, reviewDate: v || null })} /></div>
    {tabs.length > 1 && <div className={styles.tabs} aria-label="Research sections">{tabs.map(t => <button type="button" key={t} aria-pressed={t === tab} onClick={() => setTab(t)}>{t}{t === "Evidence" && research ? " (" + research.sources.length + " source" + (research.sources.length === 1 ? "" : "s") + ", " + research.claims.length + " claim" + (research.claims.length === 1 ? "" : "s") + ")" : ""}</button>)}</div>}
    {tab === "Overview" && (kind === "watchlist" ? <WatchlistFields value={value as InvestorWatchlist} onChange={onChange} /> : kind === "thesis" ? <ThesisFields value={value as InvestorThesis} onChange={onChange} /> : kind === "filing" ? <FilingFields value={value as InvestorFiling} onChange={onChange} /> : <BriefFields value={value as InvestorBrief} onChange={onChange} />)}
    {tab === "Evidence" && research && <><SourceFields sources={research.sources} asOf={value.asOfDate} referencedIds={[...research.claims, ...research.catalysts, ...("invalidations" in research ? research.invalidations : [])].flatMap(c => c.sourceIds)} onChange={sources => onChange({ ...research, sources })} />
      <ClaimFields claims={research.claims} sources={research.sources} onChange={claims => onChange({ ...research, claims })} /></>}
    {tab === "Catalysts" && research && <CatalystFields catalysts={research.catalysts} sources={research.sources} onChange={catalysts => onChange({ ...research, catalysts })} />}
    {tab === "Scenarios" && kind === "thesis" && <ScenarioFields value={value as InvestorThesis} onChange={onChange} />}
    {research && <section className={styles.section}><h2>Keep the uncertainty visible</h2><Field label="What is still uncertain?" value={research.uncertainty} required multiline onChange={uncertainty => onChange({ ...research, uncertainty })} />
      <Field label="Highest-value next question" value={research.nextQuestion} max={2000} onChange={nextQuestion => onChange({ ...research, nextQuestion })} />
      {!!gaps.length && <><h3>Research gaps in this draft</h3><ul className={styles.muted}>{gaps.map(g => <li key={g}>{g}</li>)}</ul></>}
    </section>}
  </>;
}
