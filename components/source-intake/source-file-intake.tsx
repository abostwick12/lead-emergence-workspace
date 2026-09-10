"use client";
import { useEffect, useRef, useState } from "react";
import { FileCheck2, FileUp, ShieldCheck, X } from "lucide-react";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace-provider";
import {
  inspectSourceIntakeDescriptor, sourceIntakeExtraction, type SourceIntakeExtraction
} from "@/lib/source-intake/contracts";
import styles from "./source-file-intake.module.css";

const warningText: Record<string, string> = {
  formatting_not_preserved: "Formatting is not preserved.", images_not_imported: "Images are not imported.",
  pdf_reading_order_may_differ: "PDF reading order can differ from the page.", review_extracted_text: "Review the extracted text before saving."
};
const clientErrors: Record<string, string> = {
  unsupported_type: "Choose a .txt, .md, .docx, or .pdf document.", empty_document: "Choose a document that is not empty.",
  file_too_large: "Choose a document up to 4 MB."
};

export function SourceFileIntake({ purpose, currentText, onApply, heading = "Import a document" }: {
  purpose: "writer_resource" | "ministry_archive";
  currentText: string;
  onApply: (result: SourceIntakeExtraction) => void;
  heading?: string;
}) {
  const { user, refreshBundleExperience } = useWorkspace();
  const [result, setResult] = useState<SourceIntakeExtraction | null>(null);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [applied, setApplied] = useState(false);
  const controller = useRef<AbortController | null>(null), input = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function select(file: File | undefined) {
    setResult(null); setApplied(false); setError(null);
    if (!file) return;
    try { inspectSourceIntakeDescriptor({ fileName: file.name, mediaType: file.type, byteSize: file.size }); }
    catch (caught) { setError(clientErrors[caught instanceof Error ? caught.message : "unsupported_type"] ?? clientErrors.unsupported_type); return; }
    const next = new AbortController(); controller.current?.abort(); controller.current = next; setBusy(true);
    const timer = window.setTimeout(() => next.abort(), 45_000);
    try {
      const { data, error: sessionError } = await getWorkspaceClient().auth.getSession();
      if (sessionError || !data.session || data.session.user.id !== user?.id) throw new Error("Your sign-in changed. Refresh before importing.");
      const form = new FormData(); form.set("purpose", purpose); form.set("file", file, file.name);
      const response = await fetch("/api/source-intake/extract", { method: "POST", headers: { Authorization: "Bearer " + data.session.access_token }, body: form, cache: "no-store", signal: next.signal });
      const raw: unknown = await response.json();
      if (!response.ok) {
        if ([401, 403].includes(response.status)) refreshBundleExperience();
        throw new Error(raw && typeof raw === "object" && "message" in raw && typeof raw.message === "string" ? raw.message : "Workspace could not extract this document.");
      }
      setResult(sourceIntakeExtraction.parse(raw));
    } catch (caught) {
      if (!next.signal.aborted) setError(caught instanceof Error ? caught.message : "Workspace could not extract this document.");
      else setError("Extraction took too long or was cancelled. Nothing was saved; try a smaller document or text export.");
    } finally { window.clearTimeout(timer); if (controller.current === next) controller.current = null; setBusy(false); }
  }
  function clear() { controller.current?.abort(); setResult(null); setError(null); setApplied(false); if (input.current) input.current.value = ""; }
  return <section className={styles.intake} aria-labelledby="source-intake-heading">
    <div className={styles.heading}><FileUp size={19} aria-hidden="true"/><div><h3 id="source-intake-heading">{heading}</h3>
      <p>.txt, .md, .docx, or text-based .pdf · up to 4 MB and 100 PDF pages</p></div></div>
    <label className={styles.picker}><span>{busy ? "Extracting readable text…" : "Choose a document"}</span>
      <input ref={input} type="file" accept=".txt,.md,.markdown,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy}
        onChange={event => void select(event.target.files?.[0])}/></label>
    <p className={styles.privacy}><ShieldCheck size={15} aria-hidden="true"/>The file is sent to Workspace only for bounded text extraction. The original file is not retained, fetched again, or published.</p>
    {busy && <p className={styles.status} role="status">Reading the document. Keep this page open.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {result && <div className={styles.preview}>
      <div className={styles.previewTitle}><FileCheck2 size={18} aria-hidden="true"/><div><strong>{result.file.name}</strong><span>{result.wordCount.toLocaleString()} words · {result.characterCount.toLocaleString()} characters{result.pageCount ? ` · ${result.pageCount} ${result.pageCount === 1 ? "page" : "pages"}` : ""}</span></div>
        <button type="button" className={styles.iconButton} onClick={clear} aria-label="Discard extracted document"><X size={17}/></button></div>
      <p className={styles.previewText}>{result.text.slice(0, 700)}{result.text.length > 700 ? "…" : ""}</p>
      <ul className={styles.warnings}>{result.warnings.map(warning => <li key={warning}>{warningText[warning]}</li>)}</ul>
      <button type="button" className={styles.apply} onClick={() => { onApply(result); setApplied(true); }} disabled={applied}>
        {applied ? "Text added to this protected draft" : currentText.trim() ? "Replace draft text with this extraction" : "Use this extracted text"}
      </button>
      {applied && <p className={styles.status} role="status">Review the full text below, then use the page&apos;s normal save confirmation.</p>}
    </div>}
  </section>;
}
