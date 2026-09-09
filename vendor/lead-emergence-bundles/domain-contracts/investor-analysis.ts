import type { InvestorData, InvestorSource, InvestorThesis, InvestorFiling, Scenario } from "./investor";

const dayMillis = 86_400_000;
export function ageDays(date: string, asOf: string): number {
  return Math.floor((Date.parse(asOf.slice(0, 10) + "T00:00:00Z") - Date.parse(date.slice(0, 10) + "T00:00:00Z")) / dayMillis);
}
export function sourceWarnings(source: InvestorSource, asOf: string): string[] {
  const warnings: string[] = [];
  if (source.status !== "checked") warnings.push("Source status: " + source.status + ".");
  const retrievedAge = ageDays(source.retrievedAt, asOf);
  if (retrievedAge < 0) warnings.push("Retrieval is dated after this review's as-of date.");
  if (retrievedAge > 30) warnings.push("Retrieved " + retrievedAge + " days ago; check whether this question needs newer evidence.");
  if (!source.sourceDate) warnings.push("Publication or source date is not recorded.");
  if (source.periodEnd) warnings.push("Describes the period ending " + source.periodEnd + ", not current holdings or conditions.");
  if (source.limitations.trim()) warnings.push(source.limitations);
  return warnings;
}
export function filingWarnings(f: Pick<InvestorFiling, "form" | "periodEnd" | "filedDate" | "holdingsLimitations" | "transactionFootnotes" | "plan10b51" | "amendmentOf">, asOf: string): string[] {
  const warnings = ["A filing is a public disclosure, not SEC verification of its accuracy or a trading instruction."];
  if (f.form.startsWith("13F")) {
    warnings.push("13F is a delayed reporting-period snapshot; filings are generally due within 45 days after quarter-end. It is not a current portfolio or trade feed and omits short positions.");
    if (f.periodEnd) warnings.push("Period ended " + f.periodEnd + "; " + ageDays(f.periodEnd, asOf) + " days before this review. Filing date: " + f.filedDate + ".");
    if (f.holdingsLimitations.trim()) warnings.push(f.holdingsLimitations);
  }
  if (f.form === "4" || f.form === "4/A") {
    warnings.push("Form 4 reports public insider transactions. Read transaction codes, dates, derivative tables and footnotes; do not equate every acquisition with an open-market purchase.");
    warnings.push("Rule 10b5-1 plan disclosure: " + f.plan10b51.replaceAll("_", " ") + ". This is not proof of motive or nonpublic knowledge.");
    if (!f.transactionFootnotes.trim()) warnings.push("Transaction footnotes have not been recorded.");
  }
  if (f.form.endsWith("/A")) warnings.push(f.amendmentOf.trim() ? "Amendment context: " + f.amendmentOf : "This is an amendment; compare with the earlier filing before interpreting a change.");
  return warnings;
}
export function scenarioSummary(t: Pick<InvestorThesis, "scenarioMode" | "scenarios">) {
  const probabilityTotal = t.scenarios.reduce((n, s) => n + (s.probability ?? 0), 0);
  const complete = t.scenarioMode === "exclusive_complete" && t.scenarios.length >= 2
    && t.scenarios.every(s => s.probability !== null) && Math.abs(probabilityTotal - 100) <= .000001;
  const weightedReturnPercent = complete && t.scenarios.every(s => s.returnPercent !== null)
    ? t.scenarios.reduce((n, s) => n + s.probability! / 100 * s.returnPercent!, 0) : null;
  return { probabilityTotal, complete, weightedReturnPercent,
    label: complete ? "Hypothetical, mutually exclusive assumptions; not calibrated probabilities or a forecast."
      : "Incomplete assumptions. No probability-weighted result is presented." };
}
export function researchGaps(data: InvestorData, asOf: string): string[] {
  if (!("sources" in data)) return data.entries.length ? [] : ["No instruments are being watched yet."];
  const gaps: string[] = [];
  if (!data.sources.length) gaps.push("No public sources are recorded.");
  if (!data.claims.length) gaps.push("No evidence claims are recorded.");
  if (!data.claims.some(c => c.relation === "challenges")) gaps.push("No thesis-challenging claim is recorded; this is a research gap, not proof that none exists.");
  if (data.claims.some(c => !c.sourceIds.length)) gaps.push("Some interpretations, theses, scenarios or predictions have no linked source.");
  if (data.claims.some(c => c.epistemicState === "inferred")) gaps.push("AI/inferred claims still need source review.");
  if (data.sources.some(s => s.status !== "checked")) gaps.push("Some sources are unverified, stale or superseded.");
  if (data.sources.some(s => ageDays(s.retrievedAt, asOf) > 30)) gaps.push("Some evidence was retrieved more than 30 days ago; relevance depends on the research question.");
  if ("invalidations" in data && !data.invalidations.length) gaps.push("No observable thesis-invalidation condition is recorded.");
  return gaps;
}
// Exact item comparison is order-independent for object keys and preserves array order.
// SQL performs the equivalent operation against immutable base-revision JSONB.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v)).join(",") + "}";
  return JSON.stringify(value);
}
export function normalizeAssistantResearch<T extends InvestorData>(proposed: T, base: InvestorData | null): T {
  const result = structuredClone(proposed);
  if (canonical(proposed) === canonical(base)) return result;
  result.status = "review_required";
  if ("sources" in result) {
    const original = base && "sources" in base ? base : null;
    const proposedSources = result.sources;
    result.sources = result.sources.map(s => canonical(original?.sources.find(x => x.id === s.id)) === canonical(s)
      ? s : { ...s, status: "unverified" });
    result.claims = result.claims.map(c => canonical(original?.claims.find(x => x.id === c.id)) === canonical(c)
      && c.sourceIds.every(key => canonical(original?.sources.find(x => x.id === key)) === canonical(proposedSources.find(x => x.id === key)))
      ? c : { ...c, epistemicState: "inferred" });
  }
  return result;
}
export const emptyScenario = (id: string): Scenario => ({
  id, title: "", assumptions: "", outcome: "", probability: null, returnPercent: null, invalidatedBy: ""
});
