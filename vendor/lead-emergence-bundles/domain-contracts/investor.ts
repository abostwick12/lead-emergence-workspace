import { z } from "zod";

const text = (max: number) => z.string().max(max);
const required = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().uuid();
const date = z.iso.date().nullable();
const unique = (items: readonly { id: string }[]) => new Set(items.map(x => x.id)).size === items.length;
const ids = z.array(id).max(12).refine(xs => new Set(xs).size === xs.length, "Use each reference once.");
export const investorKinds = ["watchlist", "thesis", "filing", "brief"] as const;
export const investorKind = z.enum(investorKinds);
export type InvestorKind = z.infer<typeof investorKind>;
export const investorCapabilities: Record<InvestorKind, string> = {
  watchlist: "investor.company_research", thesis: "investor.thesis",
  filing: "investor.filings", brief: "investor.company_research"
};
export const investorLabels: Record<InvestorKind, string> = {
  watchlist: "Watchlists", thesis: "Theses & companies", filing: "Filing reviews", brief: "Market briefs"
};
export const filingForms = ["10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A", "4", "4/A",
  "SC 13D", "SC 13D/A", "SC 13G", "SC 13G/A", "SCHEDULE 13D", "SCHEDULE 13D/A",
  "SCHEDULE 13G", "SCHEDULE 13G/A", "13F-HR", "13F-HR/A", "13F-NT", "13F-NT/A", "other"] as const;
export const sourceUrl = z.string().url().max(2000).refine(raw => {
  try { const u = new URL(raw); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; }
  catch { return false; }
}, "Use an HTTP(S) source URL without credentials.");
export const cik = z.union([z.literal(""), z.string().regex(/^\d{10}$/).refine(x => Number(x) > 0)]);
export const instrument = z.object({
  name: required(240), ticker: text(30), exchange: text(100), cik
}).strict();
export type Instrument = z.infer<typeof instrument>;
export const investorSource = z.object({
  id, title: required(500), publisher: required(300), url: sourceUrl,
  type: z.enum(["filing", "earnings", "company", "government", "market_data", "secondary"]),
  sourceDate: date, periodEnd: date, retrievedAt: z.iso.datetime({ offset: true }),
  reference: text(2000), excerpt: text(3000), status: z.enum(["unverified", "checked", "stale", "superseded"]),
  limitations: text(2000)
}).strict();
export type InvestorSource = z.infer<typeof investorSource>;
export const claimKinds = ["FACT", "INTERPRETATION", "THESIS", "SCENARIO", "PREDICTION"] as const;
export const evidenceClaim = z.object({
  id, kind: z.enum(claimKinds), text: required(4000),
  relation: z.enum(["supports", "challenges", "context"]), sourceIds: ids,
  epistemicState: z.enum(["user_stated", "inferred", "confirmed", "stale", "rejected"]),
  confidence: z.number().min(0).max(100).nullable(), uncertainty: text(2000)
}).strict().refine(c => c.kind !== "FACT" || c.sourceIds.length > 0, "A fact claim needs a recorded source.");
export type EvidenceClaim = z.infer<typeof evidenceClaim>;
export const catalyst = z.object({
  id, title: required(240), type: z.enum(["earnings", "filing", "company", "macro", "other"]),
  eventDate: date, dateState: z.enum(["unknown", "estimated", "announced", "occurred"]),
  status: z.enum(["open", "reviewed", "cancelled"]), sourceIds: ids,
  whyItMatters: required(2000), nextCheck: text(2000)
}).strict().refine(c => c.dateState === "unknown" || c.eventDate !== null, "A dated catalyst needs its date.")
  .refine(c => !["announced", "occurred"].includes(c.dateState) || c.sourceIds.length > 0, "An announced or occurred catalyst needs evidence.");
export type Catalyst = z.infer<typeof catalyst>;
const researchFields = {
  sources: z.array(investorSource).max(40), claims: z.array(evidenceClaim).max(60),
  catalysts: z.array(catalyst).max(30), uncertainty: required(4000), nextQuestion: text(2000)
};
function checkEvidence(r: { sources: InvestorSource[]; claims: EvidenceClaim[]; catalysts: Catalyst[] }, ctx: z.RefinementCtx) {
  const keys = new Set(r.sources.map(s => s.id));
  for (const [key, values] of [["sources", r.sources], ["claims", r.claims], ["catalysts", r.catalysts]] as const) {
    if (!unique(values)) ctx.addIssue({ code: "custom", path: [key], message: "Entries need distinct identifiers." });
  }
  for (const [key, values] of [["claims", r.claims], ["catalysts", r.catalysts]] as const) {
    values.forEach((c, i) => { if (c.sourceIds.some(ref => !keys.has(ref))) ctx.addIssue({
      code: "custom", path: [key, i, "sourceIds"], message: "Citations must refer to sources in this record."
    }); });
  }
}
const commonFields = {
  title: required(240), status: z.enum(["draft", "active", "review_required", "archived"]),
  asOfDate: z.iso.date(), reviewDate: date
};
export const watchlistEntry = z.object({
  id, instrument, rationale: required(2000), nextQuestion: text(2000),
  reviewDate: date, status: z.enum(["watching", "paused", "archived"])
}).strict();
export type WatchlistEntry = z.infer<typeof watchlistEntry>;
export const investorWatchlist = z.object({
  ...commonFields, purpose: text(4000), entries: z.array(watchlistEntry).max(50)
}).strict().superRefine((w, ctx) => {
  if (!unique(w.entries)) ctx.addIssue({ code: "custom", message: "Watchlist entries need distinct identifiers." });
  const keys = w.entries.map(e => e.instrument.cik || [e.instrument.ticker, e.instrument.exchange, e.instrument.name].join("|").toLowerCase());
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: "This instrument is already on the watchlist." });
});
export const scenario = z.object({
  id, title: required(120), assumptions: required(4000), outcome: required(2000),
  probability: z.number().min(0).max(100).nullable(),
  returnPercent: z.number().min(-100).max(100000).nullable(), invalidatedBy: required(2000)
}).strict();
export type Scenario = z.infer<typeof scenario>;
export const invalidation = z.object({
  id, condition: required(2000), status: z.enum(["unchecked", "not_triggered", "triggered"]),
  sourceIds: ids, assessment: text(2000)
}).strict().refine(i => i.status === "unchecked" || i.sourceIds.length > 0, "An assessed invalidation condition needs evidence.");
export const thesisFields = z.object({
  ...commonFields, instrument, question: required(4000), thesis: required(8000),
  horizon: required(200), stance: z.enum(["investigating", "constructive", "cautious", "mixed", "invalidated"]),
  confidence: z.number().min(0).max(100).nullable(), changeAssessment: z.enum(["not_reviewed", "no_material_change", "supported", "challenged", "invalidated"]),
  changeReason: text(4000), ...researchFields,
  invalidations: z.array(invalidation).max(20), scenarioMode: z.enum(["draft", "exclusive_complete"]),
  scenarios: z.array(scenario).max(8)
}).strict();
export const investorThesis = thesisFields.superRefine((t, ctx) => {
  checkEvidence(t, ctx);
  if (!unique(t.invalidations) || !unique(t.scenarios)) ctx.addIssue({ code: "custom", message: "Scenarios and invalidation conditions need distinct identifiers." });
  const sourceIds = new Set(t.sources.map(s => s.id));
  if (t.invalidations.some(i => i.sourceIds.some(key => !sourceIds.has(key)))) ctx.addIssue({ code: "custom", message: "Invalidation evidence must belong to this record." });
  const total = t.scenarios.reduce((sum, s) => sum + (s.probability ?? 0), 0);
  if (total > 100.000001) ctx.addIssue({ code: "custom", path: ["scenarios"], message: "Scenario probabilities cannot exceed 100%." });
  if (t.scenarioMode === "exclusive_complete" && (t.scenarios.length < 2 || t.scenarios.some(s => s.probability === null) || Math.abs(total - 100) > .000001))
    ctx.addIssue({ code: "custom", path: ["scenarios"], message: "A complete, mutually exclusive scenario set needs at least two probabilities totaling 100%." });
  if (t.changeAssessment !== "not_reviewed" && (!t.changeReason.trim() || !t.sources.length || !t.claims.length))
    ctx.addIssue({ code: "custom", path: ["changeAssessment"], message: "A change or no-change conclusion needs a reason and recorded evidence." });
});
export const filingFields = z.object({
  ...commonFields, instrument, filerName: required(240), filerCik: cik, form: z.enum(filingForms),
  accession: z.union([z.literal(""), z.string().regex(/^\d{10}-\d{2}-\d{6}$/)]),
  filingUrl: sourceUrl, filedDate: z.iso.date(), periodEnd: date,
  amendmentOf: text(2000), question: required(4000), ...researchFields,
  transactionDate: date, transactionCodes: text(200), transactionFootnotes: text(8000),
  plan10b51: z.enum(["unknown", "disclosed", "not_disclosed"]),
  holdingsLimitations: text(4000)
}).strict();
export const investorFiling = filingFields.superRefine((f, ctx) => {
  checkEvidence(f, ctx);
  if (f.periodEnd && f.periodEnd > f.filedDate) ctx.addIssue({ code: "custom", path: ["periodEnd"], message: "The report period cannot end after its filing date." });
  if (f.form.startsWith("13F") && (!f.periodEnd || !f.holdingsLimitations.trim()))
    ctx.addIssue({ code: "custom", message: "13F research needs the reporting period and explicit holdings/lag limitations." });
});
export const investorBrief = z.object({
  ...commonFields, scope: required(2000), periodStart: z.iso.date(), periodEnd: z.iso.date(),
  summary: required(8000), ...researchFields
}).strict().superRefine((b, ctx) => {
  checkEvidence(b, ctx);
  if (b.periodStart > b.periodEnd) ctx.addIssue({ code: "custom", path: ["periodEnd"], message: "The brief window must end on or after it starts." });
});
export type InvestorWatchlist = z.infer<typeof investorWatchlist>;
export type InvestorThesis = z.infer<typeof investorThesis>;
export type InvestorFiling = z.infer<typeof investorFiling>;
export type InvestorBrief = z.infer<typeof investorBrief>;
export const investorSchemas = { watchlist: investorWatchlist, thesis: investorThesis, filing: investorFiling, brief: investorBrief };
export const investorData = z.union([investorWatchlist, investorThesis, investorFiling, investorBrief]);
export type InvestorData = z.infer<typeof investorData>;
const checkKind = (d: { kind: InvestorKind; data: InvestorData }, ctx: z.RefinementCtx) => {
  const parsed = investorSchemas[d.kind].safeParse(d.data);
  if (!parsed.success) for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", message: issue.message, path: ["data", ...issue.path] });
};
export function emptyInvestorData(kind: InvestorKind, today: string): InvestorData {
  const common = { title: "", status: "draft" as const, asOfDate: today, reviewDate: null };
  const research = { sources: [], claims: [], catalysts: [], uncertainty: "Not yet researched. Source coverage, freshness and applicability need review.", nextQuestion: "" };
  const company = { name: "", ticker: "", exchange: "", cik: "" };
  if (kind === "watchlist") return { ...common, purpose: "", entries: [] };
  if (kind === "thesis") return { ...common, ...research, instrument: company, question: "", thesis: "", horizon: "",
    stance: "investigating", confidence: null, changeAssessment: "not_reviewed", changeReason: "", invalidations: [], scenarioMode: "draft", scenarios: [] };
  if (kind === "filing") return { ...common, ...research, instrument: company, filerName: "", filerCik: "", form: "10-K",
    accession: "", filingUrl: "", filedDate: today, periodEnd: null, amendmentOf: "", question: "",
    transactionDate: null, transactionCodes: "", transactionFootnotes: "", plan10b51: "unknown", holdingsLimitations: "" };
  return { ...common, ...research, scope: "", periodStart: today, periodEnd: today, summary: "" };
}
export const investorDocument = z.object({
  id, kind: investorKind, revision: z.number().int().positive(), data: investorData,
  origin: z.enum(["user", "assistant"]), createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true })
}).strict().superRefine(checkKind);
export type InvestorDocument = z.infer<typeof investorDocument>;
export const investorResult = z.object({ document: investorDocument.nullable() }).strict();
const requestFields = {
  kind: investorKind, documentId: id.nullable(), expectedRevision: z.number().int().nonnegative(),
  requestId: id, data: investorData
};
const exactBase = (d: { documentId: string | null; expectedRevision: number }) => d.documentId ? d.expectedRevision > 0 : d.expectedRevision === 0;
export const investorSave = z.object({ ...requestFields, confirmResearchOnly: z.literal(true) }).strict()
  .superRefine(checkKind).refine(exactBase, "Use the exact current revision.");
export const investorProposalInput = z.object({
  ...requestFields, reason: required(2000), evidence: required(4000), scope: z.literal("public_research_only")
}).strict().superRefine(checkKind).refine(exactBase, "Use the exact proposal base revision.");
export const investorProposal = z.object({
  id, kind: investorKind, documentId: id.nullable(), baseRevision: z.number().int().nonnegative(), data: investorData,
  reason: z.string(), evidence: z.string(), origin: z.enum(["user", "assistant"]),
  status: z.enum(["pending", "approved", "rejected"]), createdAt: z.iso.datetime({ offset: true }),
  appliedDocumentId: id.nullable(), appliedRevision: z.number().int().positive().nullable()
}).strict().superRefine(checkKind);
export type InvestorProposal = z.infer<typeof investorProposal>;
export const investorDecision = z.object({
  proposalId: id, expectedRevision: z.number().int().nonnegative(), decision: z.enum(["approve", "reject"]), confirmResearchOnly: z.boolean()
}).strict().refine(d => d.decision === "reject" || d.confirmResearchOnly, "Confirm public-research-only content before approving.");
export const investorDecisionResult = z.object({ document: investorDocument.nullable(), proposal: investorProposal }).strict();
export const investorHistory = z.object({ revisions: z.array(investorDocument).max(10) }).strict();
export const investorSearch = z.object({
  search: text(200).default(""), offset: z.number().int().min(0).max(10000).default(0), limit: z.number().int().min(1).max(50).default(25)
}).strict();
export const investorSummary = z.object({
  id, kind: investorKind, title: z.string(), revision: z.number().int().positive(), status: z.string(),
  summary: z.string(), dueDate: date, updatedAt: z.iso.datetime({ offset: true })
}).strict();
export const investorSearchResult = z.object({ total: z.number().int().nonnegative(), documents: z.array(investorSummary).max(50) }).strict();
export const investorProposalsResult = z.object({ total: z.number().int().nonnegative(), proposals: z.array(investorProposal).max(25) }).strict();
export const investorAttention = z.object({
  items: z.array(z.object({
    id: z.string(), documentId: id, kind: investorKind, title: z.string(), dueDate: date,
    revision: z.number().int().positive(), reason: z.string(), evidence: z.string(), priority: z.enum(["high", "normal"])
  }).strict()).max(30), total: z.number().int().nonnegative(), asOfDate: z.iso.date()
}).strict();

// Public SEC lookup is a bounded read of an explicit public filer identifier.
// It carries no watchlist/thesis/account content and performs no durable import.
export const publicFilingsInput = z.object({
  cik: z.string().regex(/^(?!0000000000)\d{10}$/),
  forms: z.array(z.enum(filingForms)).max(24).default([]),
  limit: z.number().int().min(1).max(100).default(25)
}).strict();
export const publicFiling = z.object({
  accession: z.string().regex(/^\d{10}-\d{2}-\d{6}$/), form: required(40),
  filedDate: z.iso.date(), reportDate: date, primaryDocument: required(240), filingUrl: sourceUrl
}).strict();
export const publicFilingsResult = z.object({
  filer: z.object({ cik: z.string().regex(/^\d{10}$/), name: required(500),
    tickers: z.array(text(40)).max(100), exchanges: z.array(text(100)).max(100) }).strict(),
  fetchedAt: z.iso.datetime({ offset: true }), sourceUrl,
  coverage: z.object({
    scope: z.literal("recent_filer_submissions"), scannedCount: z.number().int().nonnegative(),
    matchingCount: z.number().int().nonnegative(), returnedCount: z.number().int().nonnegative(),
    earliestDate: date, latestDate: date, hasOlderHistory: z.boolean(), truncated: z.boolean()
  }).strict(),
  filings: z.array(publicFiling).max(100), warnings: z.array(text(2000)).max(10)
}).strict().refine(r => r.coverage.returnedCount === r.filings.length, "Public filing coverage count is inconsistent.");
export type PublicFilingsInput = z.infer<typeof publicFilingsInput>;
export type PublicFilingsResult = z.infer<typeof publicFilingsResult>;
