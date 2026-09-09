import { describe, expect, it, vi, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
vi.mock("server-only", () => ({}));
import { composeBundleExperience, type BundleAuthority } from "@/lib/bundles/experience";
import { createWorkspaceMcpServer } from "@/lib/workspace/mcp-server";
import { getDocument, saveDocument } from "@/lib/investor-bundle/server";
import { investorSchemas, investorKinds, investorCapabilities, investorThesis, type InvestorDocument } from "@/lib/investor-bundle/contracts";
import { investorHandoff, describeInvestor } from "@/lib/investor-bundle/presentation";
import { parseSecSubmissions } from "@/lib/investor-bundle/public-filings-data";
import { getPublicFilings } from "@/lib/investor-bundle/public-filings";
import { investorFixtures } from "@/scripts/investor-fixtures.mjs";
const id = "85000000-0000-4000-8000-000000000001";
const authority: BundleAuthority = { schemaVersion: "1.0", subjectId: id, workspaceId: id, revision: "synthetic", resolvedAt: "2026-09-08T18:00:00Z", assignments: [{ bundleKey: "investor", status: "active", startsAt: "2026-09-01T00:00:00Z", expiresAt: null }], capabilities: [...new Set(Object.values(investorCapabilities))].map(capabilityId => ({ bundleKey: "investor", capabilityId })) };
const thesis = investorThesis.parse(investorFixtures().thesis);
const document: InvestorDocument = { id, kind: "thesis", revision: 2, origin: "user", createdAt: "2026-09-08T00:00:00Z", updatedAt: "2026-09-08T00:00:00Z", data: thesis };
const publicInput = { cik: "0000000001", forms: [], limit: 1 };
const fetchedAt = "2026-09-08T12:00:00Z";
const raw = () => ({ cik: 1, name: "Fictional public filer", tickers: [], exchanges: [], filings: { recent: {
  accessionNumber: ["0000000001-26-000001", "0000000001-26-000002"], filingDate: ["2026-08-15", "2026-08-14"], reportDate: ["2026-06-30", ""], form: ["13F-HR", "8-K"], primaryDocument: ["report.xml", "report.htm"]
}, files: [{ name: "older-history.json" }] } });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Investor native research boundary", () => {
  it.each(investorKinds)("uses the exact generated %s base schema in SQL", async kind => {
    const sql = await readFile("supabase/migrations/20260910130000_investor_native_workspace.sql", "utf8");
    const match = sql.match(new RegExp("when '" + kind + "' then \\$schema\\$([\\s\\S]*?)\\$schema\\$::jsonb"));
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual(z.toJSONSchema(investorSchemas[kind], { io: "input", unrepresentable: "any" }));
  });
  it("composes all admitted research areas without admitting unrelated domains", () => {
    const result = composeBundleExperience(authority);
    expect(result.ui.primaryNavigation.map(x => x.route)).toEqual(["/workspace/investing"]);
    expect(result.ui.secondaryNavigation).toHaveLength(4);
    expect(result.capabilityIds).not.toContain("writer.resource.library");
    expect(composeBundleExperience({ ...authority, assignments: [] }).capabilityIds).toEqual([]);
  });
  it.each(["investor.company_research", "investor.thesis", "investor.filings"])("keeps %s-only research reachable without opening revoked areas", capabilityId => {
    const result = composeBundleExperience({ ...authority, capabilities: [{ bundleKey: "investor", capabilityId }] });
    expect(result.ui.primaryNavigation.map(x => x.route)).toEqual(["/workspace/investing"]);
    expect(result.ui.secondaryNavigation.every(x => x.capabilityId === capabilityId)).toBe(true);
    expect(result.capabilityIds).toEqual([capabilityId]);
  });
  it.each([["54000", 429], ["42501", 403], ["P0002", 404], ["40001", 409], ["22023", 400], ["XX000", 503]])("maps %s without exposing private SQL errors", async (code, status) => {
    const rpc = vi.fn(async () => ({ data: null, error: { code, message: "PRIVATE_SQL_DETAIL" } }));
    await expect(getDocument({ rpc } as never, "thesis", id)).rejects.toMatchObject({ status });
    await expect(getDocument({ rpc } as never, "thesis", id)).rejects.not.toThrow("PRIVATE_SQL_DETAIL");
  });
  it("rejects inconsistent server records and mismatched save areas", async () => {
    const rpc = vi.fn(async () => ({ data: { document: { ...document, kind: "filing" } }, error: null }));
    await expect(getDocument({ rpc } as never, "thesis", id)).rejects.toMatchObject({ status: 503 });
    await expect(saveDocument({ rpc } as never, { kind: "thesis", documentId: id, expectedRevision: 1, requestId: id, data: thesis, confirmResearchOnly: true }, "filing")).rejects.toMatchObject({ status: 400 });
    rpc.mockResolvedValueOnce({ data: { document: null }, error: null } as never);
    await expect(getDocument({ rpc } as never, "thesis", id)).rejects.toMatchObject({ status: 503 });
  });
  it("exports saved evidence, uncertainty and literal text without hiding a zero confidence", () => {
    const text = investorHandoff({ ...document, data: { ...thesis, confidence: 0, title: "<script>untrusted evidence</script>" } });
    expect(text).toContain("Saved revision 2"); expect(text).toContain("<script>untrusted evidence</script>");
    expect(text).toContain("SYNTHETIC_INVESTOR_EVIDENCE_MARKER"); expect(text).toContain("not investment guidance");
    expect(text).toContain("Confidence judgment: 0%"); expect(describeInvestor(thesis, "thesis")).toContain("challenges");
  });
  it("advertises 13 private tools and one bounded public reader, never canonical approval", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "42501" } }));
    const server = createWorkspaceMcpServer({ rpc } as never, undefined, { bundleCapabilityIds: composeBundleExperience(authority).capabilityIds });
    const client = new Client({ name: "investor-unit", version: "1" }), [c, s] = InMemoryTransport.createLinkedPair();
    try { await server.connect(s); await client.connect(c); const tools = (await client.listTools()).tools.filter(t => t.name.startsWith("investor_"));
      expect(tools).toHaveLength(14); expect(tools.filter(t => !t.annotations?.readOnlyHint)).toHaveLength(4);
      expect(tools.filter(t => t.annotations?.openWorldHint).map(t => t.name)).toEqual(["investor_public_filings"]);
      expect(tools.some(t => /save|approve|history|trade/.test(t.name))).toBe(false);
      expect((await client.callTool({ name: "investor_get_thesis", arguments: { documentId: id } })).isError).toBe(true);
    } finally { await client.close(); await server.close(); }
  });
});
describe("Bounded public SEC metadata", () => {
  it("reports exact recent-set coverage and fixed archive links without inferring a result", () => {
    const result = parseSecSubmissions(raw(), publicInput, fetchedAt);
    expect(result.coverage).toEqual({ scope: "recent_filer_submissions", scannedCount: 2, matchingCount: 2, returnedCount: 1, earliestDate: "2026-08-14", latestDate: "2026-08-15", hasOlderHistory: true, truncated: true });
    expect(result.filings[0].filingUrl).toBe("https://www.sec.gov/Archives/edgar/data/1/000000000126000001/report.xml");
    expect(result.warnings.join(" ")).toMatch(/not filing analysis/);
    expect(parseSecSubmissions(raw(), { ...publicInput, forms: ["4"] }, fetchedAt).coverage.matchingCount).toBe(0);
  });
  it.each(["../report.htm", "%2e%2e/report.htm", "https://evil.invalid/x", "a//b", "a?token=secret", "report.htm#fragment"])("rejects unsafe primary document %s", path => {
    const data = raw(); data.filings.recent.primaryDocument[0] = path; expect(() => parseSecSubmissions(data, publicInput, fetchedAt)).toThrow();
  });
  it("rejects inconsistent columns, identity changes and even filtered-out invalid dates", () => {
    const data = raw(); data.filings.recent.form.pop(); expect(() => parseSecSubmissions(data, publicInput, fetchedAt)).toThrow();
    expect(() => parseSecSubmissions({ ...raw(), cik: 2 }, publicInput, fetchedAt)).toThrow(/identity/);
    const bad = raw(); bad.filings.recent.filingDate[1] = "2026-02-30";
    expect(() => parseSecSubmissions(bad, { ...publicInput, forms: ["13F-HR"] }, fetchedAt)).toThrow();
    expect(() => parseSecSubmissions(raw(), { ...publicInput, url: "https://evil.invalid" }, fetchedAt)).toThrow();
  });
  it("uses only fixed SEC destination with declared identity and checks access before and after reading", async () => {
    const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }));
    const fetcher = vi.fn(async () => new Response(JSON.stringify(raw()))); vi.stubGlobal("fetch", fetcher);
    await getPublicFilings({ rpc } as never, publicInput);
    expect(fetcher).toHaveBeenCalledOnce(); expect(fetcher.mock.calls[0]).toEqual(["https://data.sec.gov/submissions/CIK0000000001.json", expect.objectContaining({ redirect: "error", cache: "no-store", headers: expect.objectContaining({ "User-Agent": expect.stringContaining("LeadEmergence") }) })]);
    expect(rpc.mock.calls).toEqual([["investor_public_source_access", { p_reserve: true }], ["investor_public_source_access", { p_reserve: false }]]);
  });
  it("does not fetch after denied access and does not release a response after revocation", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(raw()))); vi.stubGlobal("fetch", fetcher);
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    await expect(getPublicFilings({ rpc } as never, publicInput)).rejects.toMatchObject({ status: 403 }); expect(fetcher).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: { allowed: true }, error: null }).mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    await expect(getPublicFilings({ rpc } as never, publicInput)).rejects.toMatchObject({ status: 403 }); expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([403, 404, 429, 500])("fails honestly on upstream %s without retries or leaking its body", async status => {
    const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }));
    const fetcher = vi.fn(async () => new Response("PRIVATE_UPSTREAM_BODY", { status })); vi.stubGlobal("fetch", fetcher);
    const failure = await getPublicFilings({ rpc } as never, publicInput).catch(e => e);
    expect(failure.status).toBe(status === 404 ? 404 : 503); expect(failure.message).not.toContain("PRIVATE_UPSTREAM_BODY"); expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rejects oversized, invalid and unverifiable public responses", async () => {
    const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }));
    for (const body of ["x".repeat(5000001), "not JSON", JSON.stringify({ ...raw(), cik: 2 })]) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
      await expect(getPublicFilings({ rpc } as never, publicInput)).rejects.toMatchObject({ status: 503 });
    }
  });
});
