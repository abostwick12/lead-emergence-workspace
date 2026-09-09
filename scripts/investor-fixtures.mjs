import { randomUUID } from "node:crypto";
// Entirely fictional acceptance data. No security, position or return is recommended.
export function investorFixtures() {
  const common = { title: "Synthetic research " + randomUUID(), status: "active", asOfDate: "2026-09-08", reviewDate: "2026-09-01" };
  const instrument = { name: "Example Research Company (fictional)", ticker: "", exchange: "", cik: "" };
  const source = { id: randomUUID(), title: "Fictional public disclosure", publisher: "Example research fixture", url: "https://example.org/fictional-disclosure", type: "filing", sourceDate: "2026-08-01", periodEnd: "2026-06-30", retrievedAt: "2026-08-02T12:00:00Z", reference: "Fictional table 1", excerpt: "SYNTHETIC_INVESTOR_EVIDENCE_MARKER", status: "checked", limitations: "Fictional testing evidence; not investment guidance." };
  const claim = { id: randomUUID(), kind: "FACT", text: "The fictional report records a hypothetical metric.", relation: "supports", sourceIds: [source.id], epistemicState: "confirmed", confidence: null, uncertainty: "Fixture, not verified information." };
  const research = { sources: [source], claims: [claim, { ...claim, id: randomUUID(), kind: "INTERPRETATION", text: "The fictional metric does not establish future demand.", relation: "challenges", epistemicState: "user_stated" }],
    catalysts: [{ id: randomUUID(), title: "Fictional earnings review", type: "earnings", eventDate: "2026-09-01", dateState: "estimated", status: "open", sourceIds: [], whyItMatters: "Revisit the fictional assumption.", nextCheck: "Confirm the announced date from an original public source." }],
    uncertainty: "Public-research fixture only; coverage and freshness require review.", nextQuestion: "What evidence would disprove the working view?" };
  return {
    watchlist: { ...common, title: "Synthetic watchlist " + randomUUID(), purpose: "SYNTHETIC_INVESTOR_WATCHLIST_MARKER", entries: [{ id: randomUUID(), instrument, rationale: "Study a fictional question, not a trade.", nextQuestion: "What evidence is missing?", reviewDate: "2026-09-01", status: "watching" }] },
    thesis: { ...common, ...structuredClone(research), instrument, title: "Synthetic thesis " + randomUUID(), question: "SYNTHETIC_INVESTOR_THESIS_MARKER", thesis: "A fictional working interpretation that may be wrong.", horizon: "Next reporting cycle", stance: "investigating", confidence: null, changeAssessment: "not_reviewed", changeReason: "",
      invalidations: [{ id: randomUUID(), condition: "The next public report contradicts the demand assumption.", status: "unchecked", sourceIds: [], assessment: "" }], scenarioMode: "draft", scenarios: [] },
    filing: { ...common, ...structuredClone(research), instrument, title: "Synthetic filing review " + randomUUID(), filerName: "Fictional reporting manager", filerCik: "", form: "13F-HR", accession: "", filingUrl: "https://example.org/fictional-13f", filedDate: "2026-08-14", periodEnd: "2026-06-30", amendmentOf: "", question: "SYNTHETIC_INVESTOR_FILING_MARKER", transactionDate: null, transactionCodes: "", transactionFootnotes: "", plan10b51: "unknown", holdingsLimitations: "Delayed quarter-end snapshot; not current holdings and does not report shorts." },
    brief: { ...common, ...structuredClone(research), title: "Synthetic market brief " + randomUUID(), scope: "SYNTHETIC_INVESTOR_BRIEF_MARKER", periodStart: "2026-09-01", periodEnd: "2026-09-08", summary: "Fictional bounded market-research summary; not a recommendation." }
  };
}
