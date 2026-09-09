"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { investorKinds, investorLabels, investorCapabilities } from "@/lib/investor-bundle/contracts";
import styles from "./investor.module.css";
export { styles };
export function InvestorFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { bundleExperience } = useWorkspace(), path = usePathname(), caps = bundleExperience?.capabilityIds ?? [];
  return <section className={styles.workspace}><header className={styles.header}><p className={styles.eyebrow}>Investor · Lead Emergence</p>
    <h1>{title}</h1><p>{description}</p></header><nav className={styles.nav} aria-label="Investor workspace">
    {investorKinds.some(k => caps.includes(investorCapabilities[k])) && <Link href="/workspace/investing" aria-current={path === "/workspace/investing" ? "page" : undefined}>Research desk</Link>}
    {investorKinds.filter(k => caps.includes(investorCapabilities[k])).map(k => <Link key={k} href={"/workspace/investing/" + k}
      aria-current={path.startsWith("/workspace/investing/" + k) ? "page" : undefined}>{investorLabels[k]}</Link>)}</nav>{children}</section>;
}
export function AccessState() {
  const { bundlesLoading, bundleError, refreshBundleExperience } = useWorkspace();
  return <InvestorFrame title={bundlesLoading ? "Opening Investor…" : bundleError ? "Investor is temporarily unavailable" : "This Investor area is not included"}
    description="Only your currently assigned capabilities can open private investment research."><div className={styles.empty}>
    <p>{bundlesLoading ? "Checking your access." : "Your administrator can assign access. If it just changed, check again."}</p>
    <button onClick={refreshBundleExperience}>Check access again</button><p><Link href="/workspace">Return to Home</Link></p></div></InvestorFrame>;
}
export function ReadState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  return <div className={styles.empty} role={error ? "alert" : "status"}>{loading ? "Opening your saved research…" : error}
    {error && <p><button onClick={retry}>Try again</button></p>}</div>;
}
export function Field({ label, value, onChange, max = 4000, multiline = false, type = "text", hint, required = false }:
  { label: string; value: string; onChange: (v: string) => void; max?: number; multiline?: boolean; type?: string; hint?: string; required?: boolean }) {
  const id = useId(), description = hint ? id + "-hint" : undefined;
  return <div className={styles.field}><label htmlFor={id}>{label}{required ? " *" : ""}</label>
    {multiline ? <textarea id={id} aria-describedby={description} value={value} onChange={e => onChange(e.target.value)} maxLength={max} rows={4} required={required} />
      : <input id={id} aria-describedby={description} value={value} onChange={e => onChange(e.target.value)} maxLength={max} type={type} required={required} />}
    {hint && <small id={description}>{hint}</small>}</div>;
}
export function Choice({ label, value, values, onChange }: { label: string; value: string; values: readonly string[]; onChange: (v: string) => void }) {
  const id = useId(); return <div className={styles.field}><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => onChange(e.target.value)}>
    {values.map(v => <option value={v} key={v}>{v.replaceAll("_", " ")}</option>)}</select></div>;
}
export function NumberField({ label, value, onChange, min = 0, max = 100, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; hint?: string }) {
  const id = useId(); return <div className={styles.field}><label htmlFor={id}>{label}</label><input id={id} type="number" min={min} max={max} step="any"
    aria-describedby={hint ? id + "-hint" : undefined} value={value ?? ""} onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    {hint && <small id={id + "-hint"}>{hint}</small>}</div>;
}
export function Disclosure({ summary, children, initialOpen = false, id }: { summary: ReactNode; children: ReactNode; initialOpen?: boolean; id?: string }) {
  const [open, setOpen] = useState(initialOpen);
  return <details id={id} className={styles.detail} open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>{summary}</summary>{children}</details>;
}
export function Validation({ message }: { message: string | null }) { return message ? <p className={styles.error} role="alert">{message}</p> : null; }
export function ResearchNotice() {
  return <p className={styles.notice}>Public-research support, not a trading service. Keep personal account details and material nonpublic information out of these records.
    A saved fact claim or approval is not independent verification. Review sources, dates and assumptions before making financial decisions.</p>;
}
