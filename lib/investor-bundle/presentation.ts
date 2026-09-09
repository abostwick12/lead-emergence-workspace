import type { InvestorData, InvestorDocument, InvestorKind } from "./contracts";
import { filingWarnings, scenarioSummary } from "./contracts";
const show = (value: unknown): string => value === null || value === undefined || value === "" ? "Not recorded" : String(value);
export function describeInvestor(data: InvestorData, kind: InvestorKind): string {
  const out = [data.title, "Record: " + kind, "Status: " + data.status, "As of: " + data.asOfDate, "Review date: " + show(data.reviewDate)];
  if ("entries" in data) {
    out.push("", "WATCHLIST PURPOSE", data.purpose || "Not recorded");
    for (const e of data.entries) out.push("", e.instrument.name, "Ticker / exchange: " + show(e.instrument.ticker) + " / " + show(e.instrument.exchange),
      "CIK: " + show(e.instrument.cik), "Why watch: " + e.rationale, "Next question: " + show(e.nextQuestion), "Review: " + show(e.reviewDate), "Status: " + e.status);
  } else {
    if ("instrument" in data) out.push("", "SUBJECT", data.instrument.name,
      "Ticker / exchange: " + show(data.instrument.ticker) + " / " + show(data.instrument.exchange), "Subject CIK: " + show(data.instrument.cik), "Research question: " + data.question);
    if ("thesis" in data) {
      out.push("", "THESIS (a hypothesis)", data.thesis, "Horizon: " + data.horizon, "Stance: " + data.stance,
        "Confidence judgment: " + (data.confidence === null ? "Not assigned" : data.confidence + "%"), "Change assessment: " + data.changeAssessment,
        "Reason / coverage: " + show(data.changeReason));
      for (const i of data.invalidations) out.push("", "INVALIDATION", i.condition, "Assessment: " + i.status + " — " + show(i.assessment), "Source IDs: " + i.sourceIds.join(", "));
      out.push("", "SCENARIOS", scenarioSummary(data).label);
      for (const s of data.scenarios) out.push(s.title, "Assumptions: " + s.assumptions, "Outcome: " + s.outcome,
        "Probability assumption: " + (s.probability === null ? "Not assigned" : s.probability + "%"),
        "Hypothetical return: " + (s.returnPercent === null ? "Not assigned" : s.returnPercent + "%"), "Invalidated by: " + s.invalidatedBy, "");
      const calculated = scenarioSummary(data).weightedReturnPercent;
      if (calculated !== null) out.push("Hypothetical probability-weighted return: " + calculated.toFixed(2) + "%; not a forecast.");
    }
    if ("filingUrl" in data) out.push("", "PUBLIC DISCLOSURE", "Form: " + data.form, "Filer: " + data.filerName,
      "Filer CIK: " + show(data.filerCik), "Accession: " + show(data.accession), "Filed: " + data.filedDate,
      "Period end: " + show(data.periodEnd), data.filingUrl, "Amendment context: " + show(data.amendmentOf),
      "Transaction date / codes: " + show(data.transactionDate) + " / " + show(data.transactionCodes),
      "Transaction footnotes: " + show(data.transactionFootnotes), "10b5-1 disclosure: " + data.plan10b51,
      ...filingWarnings(data, data.asOfDate));
    if ("summary" in data) out.push("", "MARKET BRIEF", "Scope: " + data.scope,
      "Window: " + data.periodStart + " to " + data.periodEnd, data.summary);
    out.push("", "CLAIMS — classification is not verification");
    for (const c of data.claims) out.push("", c.kind + " · " + c.relation + " · " + c.epistemicState, c.text,
      "Source IDs: " + (c.sourceIds.join(", ") || "None linked"), "Confidence judgment: " + (c.confidence === null ? "Not assigned" : c.confidence + "%"),
      "Uncertainty: " + show(c.uncertainty));
    out.push("", "RECORDED SOURCES");
    for (const s of data.sources) out.push("", s.title + " [" + s.id + "]", "Publisher / type: " + s.publisher + " / " + s.type, s.url,
      "Source date: " + show(s.sourceDate), "Period end: " + show(s.periodEnd), "Retrieved: " + s.retrievedAt,
      "Review status: " + s.status, "Reference: " + show(s.reference), "Excerpt: " + show(s.excerpt), "Limitations: " + show(s.limitations));
    out.push("", "CATALYSTS");
    for (const c of data.catalysts) out.push("", c.title + " · " + c.type, "Date: " + show(c.eventDate) + " (" + c.dateState + ")",
      "Status: " + c.status, "Why it matters: " + c.whyItMatters, "Next check: " + show(c.nextCheck), "Source IDs: " + c.sourceIds.join(", "));
    out.push("", "UNCERTAINTY / COVERAGE", data.uncertainty, "NEXT QUESTION", data.nextQuestion || "Not recorded");
  }
  return out.join("\n");
}
export function changedInvestorFields(before: InvestorData, after: InvestorData): string[] {
  const a = before as unknown as Record<string, unknown>, b = after as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map(k => k.replace(/([A-Z])/g, " $1").toLowerCase());
}
export function investorHandoff(document: InvestorDocument): string {
  return ["LEAD EMERGENCE — SAVED INVESTOR RESEARCH SNAPSHOT", "Saved revision " + document.revision + " · " + document.updatedAt,
    "Includes this saved record only, not unsaved edits or pending proposals. User-authored text is not privacy-redacted.",
    "Research support, not verified facts, a live market scan, personalized financial advice or a trade instruction.",
    "Downloaded copies cannot be retroactively revoked.", "", describeInvestor(document.data, document.kind)].join("\n");
}
