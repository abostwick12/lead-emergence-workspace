import { z } from "zod";

// Native-user discovery only. This contract does not register an assistant tool
// or grant cross-domain model access. Hosts must reauthorize every read.
export const nativeSearchProviders = [
  {
    "id": "writer.search.resources",
    "bundleKey": "writer_editor",
    "bundleLabel": "Writing",
    "kind": "resource",
    "label": "Saved resources",
    "capabilityIds": [
      "writer.resource.library",
      "writer.resource.review"
    ],
    "route": "/workspace/writing"
  },
  {
    "id": "ministry.search.research",
    "bundleKey": "ministry",
    "bundleLabel": "Ministry",
    "kind": "research",
    "label": "Research projects",
    "capabilityIds": [
      "ministry.research"
    ],
    "route": "/workspace/ministry/research"
  },
  {
    "id": "ministry.search.archive",
    "bundleKey": "ministry",
    "bundleLabel": "Ministry",
    "kind": "archive",
    "label": "Teaching archive",
    "capabilityIds": [
      "ministry.archive"
    ],
    "route": "/workspace/ministry/archive"
  },
  {
    "id": "nonprofit.search.plan",
    "bundleKey": "nonprofit_founder",
    "bundleLabel": "Nonprofit Founder",
    "kind": "plan",
    "label": "Roadmaps",
    "capabilityIds": [
      "nonprofit.roadmap"
    ],
    "route": "/workspace/nonprofit/plan"
  },
  {
    "id": "nonprofit.search.partner",
    "bundleKey": "nonprofit_founder",
    "bundleLabel": "Nonprofit Founder",
    "kind": "partner",
    "label": "People and partnerships",
    "capabilityIds": [
      "nonprofit.partners"
    ],
    "route": "/workspace/nonprofit/partner"
  },
  {
    "id": "nonprofit.search.meeting",
    "bundleKey": "nonprofit_founder",
    "bundleLabel": "Nonprofit Founder",
    "kind": "meeting",
    "label": "Founder meetings",
    "capabilityIds": [
      "nonprofit.meetings"
    ],
    "route": "/workspace/nonprofit/meeting"
  },
  {
    "id": "nonprofit.search.research",
    "bundleKey": "nonprofit_founder",
    "bundleLabel": "Nonprofit Founder",
    "kind": "research",
    "label": "Founder research",
    "capabilityIds": [
      "nonprofit.regulatory_research"
    ],
    "route": "/workspace/nonprofit/research"
  },
  {
    "id": "investor.search.watchlist",
    "bundleKey": "investor",
    "bundleLabel": "Investor",
    "kind": "watchlist",
    "label": "Watchlists",
    "capabilityIds": [
      "investor.company_research"
    ],
    "route": "/workspace/investing/watchlist"
  },
  {
    "id": "investor.search.thesis",
    "bundleKey": "investor",
    "bundleLabel": "Investor",
    "kind": "thesis",
    "label": "Investment theses",
    "capabilityIds": [
      "investor.thesis"
    ],
    "route": "/workspace/investing/thesis"
  },
  {
    "id": "investor.search.filing",
    "bundleKey": "investor",
    "bundleLabel": "Investor",
    "kind": "filing",
    "label": "Filing reviews",
    "capabilityIds": [
      "investor.filings"
    ],
    "route": "/workspace/investing/filing"
  },
  {
    "id": "investor.search.brief",
    "bundleKey": "investor",
    "bundleLabel": "Investor",
    "kind": "brief",
    "label": "Market briefs",
    "capabilityIds": [
      "investor.company_research"
    ],
    "route": "/workspace/investing/brief"
  },
  {
    "id": "executive.search.commitment",
    "bundleKey": "executive",
    "bundleLabel": "Executive",
    "kind": "commitment",
    "label": "Commitments",
    "capabilityIds": [
      "executive.coordination"
    ],
    "route": "/workspace/executive/commitment"
  },
  {
    "id": "executive.search.decision",
    "bundleKey": "executive",
    "bundleLabel": "Executive",
    "kind": "decision",
    "label": "Decisions",
    "capabilityIds": [
      "executive.coordination"
    ],
    "route": "/workspace/executive/decision"
  },
  {
    "id": "executive.search.meeting",
    "bundleKey": "executive",
    "bundleLabel": "Executive",
    "kind": "meeting",
    "label": "Meeting plans",
    "capabilityIds": [
      "executive.coordination"
    ],
    "route": "/workspace/executive/meeting"
  },
  {
    "id": "executive.search.daily_brief",
    "bundleKey": "executive",
    "bundleLabel": "Executive",
    "kind": "daily_brief",
    "label": "Daily briefs",
    "capabilityIds": [
      "executive.brief"
    ],
    "route": "/workspace/executive/daily_brief"
  },
  {
    "id": "executive.search.weekly_review",
    "bundleKey": "executive",
    "bundleLabel": "Executive",
    "kind": "weekly_review",
    "label": "Weekly reviews",
    "capabilityIds": [
      "executive.review"
    ],
    "route": "/workspace/executive/weekly_review"
  }
] as const;
export type NativeSearchProvider = typeof nativeSearchProviders[number];
export const searchProviderIdSchema = z.enum(nativeSearchProviders.map(p => p.id));
const uniqueProviders = z.array(searchProviderIdSchema).min(1).max(16)
  .refine(ids => new Set(ids).size === ids.length, "Choose each scope once.");
export const workspaceSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(200),
  providerIds: uniqueProviders,
  authorityRevision: z.string().min(1).max(200),
  offset: z.number().int().min(0).max(10_000).multipleOf(25).default(0)
}).strict();
export const workspaceSearchCatalogSchema = z.object({
  workspaceId: z.string().uuid(), authorityRevision: z.string().min(1).max(200),
  providerIds: z.array(searchProviderIdSchema).max(16)
    .refine(ids => new Set(ids).size === ids.length)
}).strict();
export const workspaceSearchResultSchema = z.object({
  workspaceId: z.string().uuid(), authorityRevision: z.string().min(1),
  retrievedAt: z.string().datetime({offset:true}),
  query: z.string().min(2).max(200), offset: z.number().int().min(0).max(10_000),
  matchingCount: z.number().int().nonnegative(),
  coverage: z.array(z.object({providerId:searchProviderIdSchema,matchingCount:z.number().int().nonnegative()}).strict()).min(1).max(16),
  results: z.array(z.object({
    providerId: searchProviderIdSchema, id: z.string().uuid(),
    title: z.string().max(500), snippet: z.string().max(360),
    revision:z.number().int().positive(), updatedAt:z.string().datetime({offset:true}),
    matchReason: z.enum(["exact_title","title_contains","saved_text"])
  }).strict()).max(25)
}).strict().superRefine((value,ctx)=>{
  const ids=value.coverage.map(c=>c.providerId);
  if(new Set(ids).size!==ids.length || value.coverage.reduce((n,c)=>n+c.matchingCount,0)!==value.matchingCount
    || value.results.some(r=>!ids.includes(r.providerId))
    || new Set(value.results.map(r=>r.providerId+":"+r.id)).size!==value.results.length
    || value.results.length!==Math.min(25,Math.max(0,value.matchingCount-value.offset)))
    ctx.addIssue({code:"custom",message:"Search coverage is inconsistent."});
});
export type WorkspaceSearchResult=z.infer<typeof workspaceSearchResultSchema>;
export function admittedSearchProviders(capabilityIds:readonly string[]) {
  const allowed=new Set(capabilityIds);
  return allowed.has("workspace.search") ? nativeSearchProviders.filter(p=>p.capabilityIds.every(id=>allowed.has(id))) : [];
}
export function searchResultRoute(providerId:string,id:string) {
  const provider=nativeSearchProviders.find(p=>p.id===providerId);
  if(!provider || !z.string().uuid().safeParse(id).success)throw new Error("Search result is unavailable.");
  return provider.route+"/"+id;
}
