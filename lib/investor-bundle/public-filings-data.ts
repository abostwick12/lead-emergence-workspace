import { z } from "zod";
import { filingForms, publicFilingsInput, publicFilingsResult, type PublicFilingsResult } from "./contracts";

const rawRecent = z.object({
  accessionNumber: z.array(z.string().max(20)).max(10000), filingDate: z.array(z.iso.date()).max(10000),
  reportDate: z.array(z.union([z.literal(""), z.iso.date()])).max(10000), form: z.array(z.string().trim().min(1).max(40)).max(10000),
  primaryDocument: z.array(z.string().max(240)).max(10000)
});
const rawSubmissions = z.object({
  cik: z.union([z.number().int().positive(), z.string().regex(/^\d{1,10}$/)]),
  name: z.string().trim().min(1).max(500), tickers: z.array(z.string().max(40)).max(100).default([]),
  exchanges: z.array(z.string().max(100)).max(100).default([]),
  filings: z.object({ recent: rawRecent, files: z.array(z.unknown()).max(10000).default([]) })
});
export function parseSecSubmissions(raw: unknown, inputRaw: unknown, fetchedAt: string): PublicFilingsResult {
  const input = publicFilingsInput.parse(inputRaw), data = rawSubmissions.parse(raw);
  const actualCik = String(data.cik).padStart(10, "0");
  if (actualCik !== input.cik) throw new Error("Public filer identity mismatch.");
  const recent = data.filings.recent, count = recent.accessionNumber.length;
  if (Object.values(recent).some(column => column.length !== count)) throw new Error("Inconsistent public filing columns.");
  const tracked = new Set<string>(filingForms.filter(form => form !== "other"));
  const requested = new Set<string>(input.forms.length ? input.forms : [...tracked]);
  const rows = recent.accessionNumber.map((accession, index) => {
    const primaryDocument = recent.primaryDocument[index];
    const segments = primaryDocument.split("/");
    if (!/^\d{10}-\d{2}-\d{6}$/.test(accession)
      || !segments.length || segments.length > 4 || segments.some(s => !/^[A-Za-z0-9_.-]{1,200}$/.test(s) || s === "." || s === ".."))
      throw new Error("Unsafe public filing reference.");
    return { accession, form: recent.form[index], filedDate: recent.filingDate[index],
      reportDate: recent.reportDate[index] || null, primaryDocument,
      filingUrl: "https://www.sec.gov/Archives/edgar/data/" + Number(actualCik) + "/" + accession.replaceAll("-", "")
        + "/" + segments.map(encodeURIComponent).join("/") };
  });
  const matching = rows.filter(r => requested.has(r.form) || (requested.has("other") && !tracked.has(r.form)));
  const dates = rows.map(r => r.filedDate).sort();
  return publicFilingsResult.parse({
    filer: { cik: actualCik, name: data.name, tickers: data.tickers, exchanges: data.exchanges },
    fetchedAt, sourceUrl: "https://data.sec.gov/submissions/CIK" + actualCik + ".json",
    coverage: { scope: "recent_filer_submissions", scannedCount: count, matchingCount: matching.length,
      returnedCount: Math.min(input.limit, matching.length), earliestDate: dates[0] ?? null, latestDate: dates.at(-1) ?? null,
      hasOlderHistory: data.filings.files.length > 0, truncated: matching.length > input.limit },
    filings: matching.slice(0, input.limit),
    warnings: [
      "Recent filings for this filer CIK only. Older history files were not fetched; this is not a continuous monitor.",
      "Filer/manager identity and subject issuer can differ. This is not complete issuer-wide insider transaction coverage.",
      "Metadata is not filing analysis, an assurance of correctness, current holdings or a live market-price feed.",
      "A successful lookup does not save a review or prove there was no material thesis change. Read the underlying disclosure and amendments."
    ]
  });
}
