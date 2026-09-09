"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { executiveKinds, executiveLabels, executiveCapabilities } from "@/lib/executive-bundle/contracts";
import styles from "./executive.module.css";
export { styles };
export function ExecutiveFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { bundleExperience } = useWorkspace(), path = usePathname(), caps = bundleExperience?.capabilityIds ?? [];
  return <section className={styles.workspace}><header className={styles.header}><p className={styles.eyebrow}>Executive · Lead Emergence</p>
    <h1>{title}</h1><p>{description}</p></header><nav className={styles.nav} aria-label="Executive workspace">
    {executiveKinds.some(k => caps.includes(executiveCapabilities[k])) && <Link href="/workspace/executive" aria-current={path === "/workspace/executive" ? "page" : undefined}>Attention</Link>}
    {executiveKinds.filter(k => caps.includes(executiveCapabilities[k])).map(k => <Link key={k} href={"/workspace/executive/" + k}
      aria-current={path.startsWith("/workspace/executive/" + k) ? "page" : undefined}>{executiveLabels[k]}</Link>)}{caps.includes("executive.coordination")&&<Link href="/workspace/executive/sources" aria-current={path==="/workspace/executive/sources"?"page":undefined}>Attention sources</Link>}</nav>{children}</section>;
}
export function AccessState() {
  const { bundlesLoading, bundleError, refreshBundleExperience } = useWorkspace();
  return <ExecutiveFrame title={bundlesLoading ? "Opening Executive…" : bundleError ? "Executive is temporarily unavailable" : "This Executive area is not included"}
    description="Only your currently assigned capabilities can open private coordination records."><div className={styles.empty}>
    <p>{bundlesLoading ? "Checking your access." : "Your administrator can assign access. If it just changed, check again."}</p>
    <button onClick={refreshBundleExperience}>Check access again</button><p><Link href="/workspace">Return to Home</Link></p></div></ExecutiveFrame>;
}
export function ReadState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  return <div className={styles.empty} role={error ? "alert" : "status"}>{loading ? "Opening your saved work…" : error}
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
export function Choice({ label, value, values, onChange, labels }: { label: string; value: string; values: readonly string[]; onChange: (v: string) => void; labels?:Record<string,string> }) {
  const id = useId(); return <div className={styles.field}><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => onChange(e.target.value)}>
    {values.map(v => <option value={v} key={v}>{labels?.[v]??v.replaceAll("_", " ")}</option>)}</select></div>;
}
export function NumberField({ label, value, onChange, min = 0, max = 100, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; hint?: string }) {
  const id = useId(); return <div className={styles.field}><label htmlFor={id}>{label}</label><input id={id} type="number" min={min} max={max} step="1"
    aria-describedby={hint ? id + "-hint" : undefined} value={value ?? ""} onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    {hint && <small id={id + "-hint"}>{hint}</small>}</div>;
}
export function Disclosure({ summary, children, initialOpen = false, id }: { summary: ReactNode; children: ReactNode; initialOpen?: boolean; id?: string }) {
  const [open, setOpen] = useState(initialOpen);
  return <details id={id} className={styles.detail} open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>{summary}</summary>{open&&children}</details>;
}
export function Validation({ message }: { message: string | null }) { return message ? <p className={styles.error} role="alert">{message}</p> : null; }
export function CoordinationNotice() {
 return <p className={styles.notice}>Saved plans and assistant proposals do not send messages, book meetings or start recurring work.
  Review the evidence and agreement state before taking an external action.</p>;
}
