"use client";
import type { InvestorSource, EvidenceClaim, Catalyst, InvestorThesis, Scenario } from "@/lib/investor-bundle/contracts";
import { claimKinds, sourceWarnings, sourceUrl, emptyScenario, scenarioSummary } from "@/lib/investor-bundle/contracts";
import { Field, Choice, NumberField, Disclosure, styles } from "./common";

export function Citations({ sources, value, onChange }: { sources: InvestorSource[]; value: string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className={styles.checklist}><legend>Linked evidence</legend><p className={styles.muted}>Choose up to 12 sources from this record. A link is not independent verification.</p>
    {!sources.length && <p>Add a source in Evidence first.</p>}{sources.map(s => <label key={s.id}><input type="checkbox" checked={value.includes(s.id)}
      disabled={!value.includes(s.id) && value.length >= 12} onChange={e => onChange(e.target.checked ? [...value, s.id] : value.filter(id => id !== s.id))} />{s.title || "Untitled source"} · {s.status}</label>)}</fieldset>;
}
export function SourceFields({ sources, referencedIds, asOf, onChange }: { sources: InvestorSource[]; referencedIds: string[]; asOf: string; onChange: (sources: InvestorSource[]) => void }) {
  const update = (id: string, patch: Partial<InvestorSource>) => onChange(sources.map(s => s.id === id ? { ...s, ...patch } : s));
  return <section className={styles.section}><h2>Sources you can inspect</h2><p className={styles.muted}>Record the publication date separately from when you retrieved it. Brief excerpts and page references are more useful than a pasted full report.</p>
    {sources.map((s, i) => <Disclosure key={s.id} initialOpen={!s.title} summary={<>Source {i + 1} · {s.title || "New source"} · {s.status}</>}>
      <Field label="Source title" value={s.title} max={500} required onChange={title => update(s.id, { title })} />
      <div className={styles.grid}><Field label="Publisher" value={s.publisher} max={300} required onChange={publisher => update(s.id, { publisher })} />
        <Choice label="Source type" value={s.type} values={["filing", "earnings", "company", "government", "market_data", "secondary"]} onChange={type => update(s.id, { type: type as InvestorSource["type"] })} /></div>
      <Field label="Public source URL" value={s.url} max={2000} type="url" required onChange={url => update(s.id, { url })} />
      {sourceUrl.safeParse(s.url).success && <p><a href={s.url} target="_blank" rel="noopener noreferrer">Inspect source in a new tab</a></p>}
      <div className={styles.grid}><Field label="Publication or filing date" type="date" value={s.sourceDate ?? ""} onChange={v => update(s.id, { sourceDate: v || null })} />
        <Field label="Reporting period end" type="date" value={s.periodEnd ?? ""} onChange={v => update(s.id, { periodEnd: v || null })} /></div>
      <Field label="Retrieved at (ISO timestamp)" value={s.retrievedAt} max={40} required hint="Record when you actually retrieved this source, not when its contents were published." onChange={retrievedAt => update(s.id, { retrievedAt })} />
      <button type="button" onClick={() => update(s.id, { retrievedAt: new Date().toISOString() })}>Record retrieval now</button>
      <Field label="Page, section or table reference" value={s.reference} max={2000} onChange={reference => update(s.id, { reference })} />
      <Field label="Brief supporting excerpt" value={s.excerpt} max={3000} multiline onChange={excerpt => update(s.id, { excerpt })} />
      <Field label="Source limitations" value={s.limitations} max={2000} multiline onChange={limitations => update(s.id, { limitations })} />
      <Choice label="Source review status" value={s.status} values={["unverified", "checked", "stale", "superseded"]} onChange={status => update(s.id, { status: status as InvestorSource["status"] })} />
      <ul className={styles.muted}>{sourceWarnings(s, asOf).map(w => <li key={w}>{w}</li>)}</ul>
      <button type="button" disabled={referencedIds.includes(s.id)} onClick={() => onChange(sources.filter(x => x.id !== s.id))}>Remove source {i + 1}</button>
      {referencedIds.includes(s.id) && <p className={styles.muted}>Unlink this source from its claims, catalysts or invalidation conditions before removing it.</p>}
    </Disclosure>)}
    <button type="button" disabled={sources.length >= 40} onClick={() => onChange([...sources, { id: crypto.randomUUID(), title: "", publisher: "", url: "", type: "secondary", sourceDate: null, periodEnd: null, retrievedAt: "", reference: "", excerpt: "", status: "unverified", limitations: "" }])}>Add source</button>
  </section>;
}
export function ClaimFields({ claims, sources, onChange }: { claims: EvidenceClaim[]; sources: InvestorSource[]; onChange: (claims: EvidenceClaim[]) => void }) {
  const update = (id: string, patch: Partial<EvidenceClaim>) => onChange(claims.map(c => c.id === id ? { ...c, ...patch } : c));
  return <section className={styles.section}><h2>What the evidence says — and does not say</h2><p className={styles.muted}>Separate reported facts from your interpretation, thesis, scenario or prediction. Capture challenging evidence as carefully as supporting evidence.</p>
    {claims.map((c, i) => <Disclosure key={c.id} initialOpen={!c.text} summary={<>Claim {i + 1} · {c.kind} · {c.relation} · {c.epistemicState.replaceAll("_", " ")} · {c.text.slice(0, 90) || "New claim"}</>}>
      <div className={styles.grid}><Choice label="Claim category" value={c.kind} values={claimKinds} onChange={kind => update(c.id, { kind: kind as EvidenceClaim["kind"] })} />
        <Choice label="Relation to the research question" value={c.relation} values={["supports", "challenges", "context"]} onChange={relation => update(c.id, { relation: relation as EvidenceClaim["relation"] })} /></div>
      <Field label="Claim" value={c.text} required multiline onChange={text => update(c.id, { text })} />
      <Citations sources={sources} value={c.sourceIds} onChange={sourceIds => update(c.id, { sourceIds })} />
      <div className={styles.grid}><Choice label="Claim review state" value={c.epistemicState} values={["user_stated", "inferred", "confirmed", "stale", "rejected"]} onChange={epistemicState => update(c.id, { epistemicState: epistemicState as EvidenceClaim["epistemicState"] })} />
        <NumberField label="Subjective confidence (%)" value={c.confidence} hint="Optional judgment, not a measured probability." onChange={confidence => update(c.id, { confidence })} /></div>
      <Field label="Claim uncertainty" value={c.uncertainty} max={2000} multiline onChange={uncertainty => update(c.id, { uncertainty })} />
      <button type="button" onClick={() => onChange(claims.filter(x => x.id !== c.id))}>Remove claim {i + 1}</button>
    </Disclosure>)}
    <button type="button" disabled={claims.length >= 60} onClick={() => onChange([...claims, { id: crypto.randomUUID(), kind: "INTERPRETATION", text: "", relation: "context", sourceIds: [], epistemicState: "user_stated", confidence: null, uncertainty: "" }])}>Add evidence claim</button>
  </section>;
}
export function CatalystFields({ catalysts, sources, onChange }: { catalysts: Catalyst[]; sources: InvestorSource[]; onChange: (catalysts: Catalyst[]) => void }) {
  const update = (id: string, patch: Partial<Catalyst>) => onChange(catalysts.map(c => c.id === id ? { ...c, ...patch } : c));
  return <section className={styles.section}><h2>What could change the picture?</h2><p className={styles.muted}>A recorded catalyst is a review cue, not a scheduled alert. Distinguish estimated dates from announced events.</p>
    {catalysts.map((c, i) => <Disclosure key={c.id} initialOpen={!c.title} summary={<>Catalyst {i + 1} · {c.title || "New catalyst"} · {c.eventDate ?? "Date unknown"}</>}>
      <Field label="Catalyst title" value={c.title} required max={240} onChange={title => update(c.id, { title })} />
      <div className={styles.grid}><Choice label="Catalyst type" value={c.type} values={["earnings", "filing", "company", "macro", "other"]} onChange={type => update(c.id, { type: type as Catalyst["type"] })} />
        <Choice label="Catalyst status" value={c.status} values={["open", "reviewed", "cancelled"]} onChange={status => update(c.id, { status: status as Catalyst["status"] })} />
        <Field label="Event date" type="date" value={c.eventDate ?? ""} onChange={v => update(c.id, { eventDate: v || null })} />
        <Choice label="Date certainty" value={c.dateState} values={["unknown", "estimated", "announced", "occurred"]} onChange={dateState => update(c.id, { dateState: dateState as Catalyst["dateState"] })} /></div>
      <Field label="Why this matters" value={c.whyItMatters} required multiline max={2000} onChange={whyItMatters => update(c.id, { whyItMatters })} />
      <Field label="Next check" value={c.nextCheck} max={2000} onChange={nextCheck => update(c.id, { nextCheck })} />
      <Citations sources={sources} value={c.sourceIds} onChange={sourceIds => update(c.id, { sourceIds })} />
      <button type="button" onClick={() => onChange(catalysts.filter(x => x.id !== c.id))}>Remove catalyst {i + 1}</button>
    </Disclosure>)}
    <button type="button" disabled={catalysts.length >= 30} onClick={() => onChange([...catalysts, { id: crypto.randomUUID(), title: "", type: "other", eventDate: null, dateState: "unknown", status: "open", sourceIds: [], whyItMatters: "", nextCheck: "" }])}>Add catalyst</button>
  </section>;
}
export function ScenarioFields({ value, onChange }: { value: InvestorThesis; onChange: (value: InvestorThesis) => void }) {
  const update = (id: string, patch: Partial<Scenario>) => onChange({ ...value, scenarios: value.scenarios.map(s => s.id === id ? { ...s, ...patch } : s) });
  const summary = scenarioSummary(value);
  return <section className={styles.section}><h2>Explore assumptions, not predictions</h2><p className={styles.muted}>Leave probabilities and returns blank unless you have a reason to specify them. A weighted result appears only for a complete, mutually exclusive set with every return entered.</p>
    <Choice label="Scenario coverage" value={value.scenarioMode} values={["draft", "exclusive_complete"]} onChange={scenarioMode => onChange({ ...value, scenarioMode: scenarioMode as InvestorThesis["scenarioMode"] })} />
    {value.scenarios.map((s, i) => <Disclosure key={s.id} initialOpen={!s.title} summary={<>Scenario {i + 1} · {s.title || "New scenario"}</>}>
      <Field label="Scenario name" value={s.title} required max={120} onChange={title => update(s.id, { title })} />
      <Field label="Assumptions" value={s.assumptions} required multiline onChange={assumptions => update(s.id, { assumptions })} />
      <Field label="Hypothetical outcome" value={s.outcome} required max={2000} multiline onChange={outcome => update(s.id, { outcome })} />
      <div className={styles.grid}><NumberField label="Assumed probability (%)" value={s.probability} onChange={probability => update(s.id, { probability })} />
        <NumberField label="Hypothetical return (%)" value={s.returnPercent} min={-100} max={100000} onChange={returnPercent => update(s.id, { returnPercent })} /></div>
      <Field label="What would invalidate this scenario?" value={s.invalidatedBy} required multiline max={2000} onChange={invalidatedBy => update(s.id, { invalidatedBy })} />
      <button type="button" onClick={() => onChange({ ...value, scenarios: value.scenarios.filter(x => x.id !== s.id) })}>Remove scenario {i + 1}</button>
    </Disclosure>)}
    <button type="button" disabled={value.scenarios.length >= 8} onClick={() => onChange({ ...value, scenarios: [...value.scenarios, emptyScenario(crypto.randomUUID())] })}>Add scenario</button>
    <p className={styles.notice} role="status">Specified probability total: {summary.probabilityTotal.toFixed(2)}%. {summary.label}
      {summary.weightedReturnPercent !== null && <> Hypothetical weighted return: {summary.weightedReturnPercent.toFixed(2)}%.</>}</p>
  </section>;
}
