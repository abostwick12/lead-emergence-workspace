"use client";
import { useState } from "react";
import { filingForms, publicFilingsInput, publicFilingsResult, type InvestorFiling, type PublicFilingsResult } from "@/lib/investor-bundle/contracts";
import { useInvestorAction } from "./use-investor";
import { Field, Choice, Disclosure, Validation, styles } from "./common";

export function PublicFilingsPanel({ value, onChange }: { value: InvestorFiling; onChange: (v: InvestorFiling) => void }) {
  const [cik, setCik] = useState(""), [form, setForm] = useState(""), [result, setResult] = useState<PublicFilingsResult | null>(null);
  const [message, setMessage] = useState<string | null>(null), action = useInvestorAction();
  const lookup = async () => {
    setMessage(null); setResult(null);
    const input = publicFilingsInput.safeParse({ cik, forms: form ? [form] : [], limit: 25 });
    if (!input.success) { setMessage("Enter the public filer’s 10-digit SEC CIK, including leading zeroes. Do not enter account information."); return; }
    const response = await action.run<unknown>("/api/investor/public-filings?" + new URLSearchParams({ cik: input.data.cik, forms: input.data.forms.join(","), limit: "25" }), null);
    if (response) { const checked = publicFilingsResult.safeParse(response); if (checked.success) setResult(checked.data); else setMessage("The public response could not be verified. Nothing was imported."); }
  };
  const canImport = !value.filingUrl && !value.sources.length && !value.claims.length;
  return <Disclosure summary="Optional: find a public SEC filing" initialOpen={!value.filingUrl}>
    <p>Look up one public CIK. Only that identifier and your form filter leave this workspace — not your thesis, watchlist or account information. No account connection is needed.</p>
    <div className={styles.grid}><Field label="Public filer CIK" value={cik} max={10} onChange={setCik} hint="Use the SEC’s public company/filer search to find the exact identifier." />
      <Choice label="Public filing form filter" value={form} values={["", ...filingForms]} onChange={setForm} /></div>
    <p className={styles.muted}>An empty filter includes the supported annual, quarterly, current, insider, ownership and institutional forms. This searches recent submissions only.</p>
    <button type="button" disabled={action.busy} onClick={() => void lookup()}>{action.busy ? "Checking SEC public submissions…" : "Look up public filings"}</button>
    <Validation message={message ?? action.error} />
    {result && <section aria-label="Public filing results"><h3>{result.filer.name} · CIK {result.filer.cik}</h3>
      <p className={styles.muted}>Retrieved {result.fetchedAt}. Scanned {result.coverage.scannedCount} recent submissions dated {result.coverage.earliestDate ?? "unknown"} to {result.coverage.latestDate ?? "unknown"}; {result.coverage.matchingCount} matched and {result.coverage.returnedCount} are shown.
        {result.coverage.truncated ? " More matching rows exist in this recent set." : ""}{result.coverage.hasOlderHistory ? " Older history files exist and were not searched." : ""}</p>
      <p><a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect the public metadata source</a></p>
      <ul className={styles.notice}>{result.warnings.map(w => <li key={w}>{w}</li>)}</ul>
      {!result.filings.length && <p>No matching filings in the scanned recent set. This does not establish that no relevant disclosure or change exists.</p>}
      {!canImport && <p className={styles.notice}>This draft already contains filing evidence. To preserve its context, start a new filing review to import another disclosure. You can still inspect the public links below.</p>}
      <ul className={styles.list}>{result.filings.map(f => <li key={f.accession} className={styles.row}><h3>{f.form} · Filed {f.filedDate}</h3><p>{f.accession}{f.reportDate ? " · Period " + f.reportDate : ""}</p>
        <p><a href={f.filingUrl} target="_blank" rel="noopener noreferrer">Read this filing</a></p>
        <button type="button" disabled={!canImport} onClick={() => {
          const knownForm = filingForms.find(x => x === f.form) ?? "other";
          const issuerForm = /^(10-K|10-Q|8-K)(\/A)?$/.test(f.form);
          onChange({ ...value, title: value.title || result.filer.name.slice(0, 190) + " · " + f.form + " · " + f.filedDate,
            filerName: result.filer.name.slice(0, 240), filerCik: result.filer.cik, form: knownForm, accession: f.accession, filingUrl: f.filingUrl, filedDate: f.filedDate, periodEnd: f.reportDate,
            instrument: issuerForm && !value.instrument.name ? { ...value.instrument, name: result.filer.name.slice(0, 240), cik: result.filer.cik } : value.instrument,
            sources: [{ id: crypto.randomUUID(), title: (f.form + " filing metadata — " + result.filer.name).slice(0, 500), publisher: "SEC EDGAR public submissions", url: result.sourceUrl,
              type: "filing", sourceDate: f.filedDate, periodEnd: f.reportDate, retrievedAt: result.fetchedAt, reference: "Accession " + f.accession + "; primary document " + f.primaryDocument,
              excerpt: "", status: "unverified", limitations: "Only filing metadata was retrieved. The filing text, tables, footnotes and amendments have not been reviewed by this lookup." }]
          }); setMessage("Metadata added to this unsaved draft. Read the filing, identify the subject, and record your question and evidence before confirming a save.");
        }}>Use metadata in this draft</button>
      </li>)}</ul>
    </section>}
  </Disclosure>;
}
