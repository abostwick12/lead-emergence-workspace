"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { WritingAccessState } from "./writing-library";
import { useWritingAction } from "./use-writing-action";
import styles from "./writing.module.css";
export function WritingImportPage() {
  const { user, bundleExperience } = useWorkspace();
  if (!bundleExperience?.capabilityIds.includes("writer.resource.manage") || !bundleExperience.capabilityIds.includes("writer.resource.review")) return <WritingAccessState />;
  return <ImportForm key={user?.id + ":" + bundleExperience.workspaceId + ":" + bundleExperience.revision} />;
}
function ImportForm() {
  const router = useRouter(), { busy, error, run } = useWritingAction();
  const [fileError, setFileError] = useState<string | null>(null), [body, setBody] = useState(""), [fileName, setFileName] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await run<{ resourceId: string }>("/api/writing/import", {
      resource: {
        title: String(form.get("title")), author: String(form.get("author")) || null, body_text: body,
        resource_type: String(form.get("resource_type")), source_label: String(form.get("source_label")),
        source_url: String(form.get("source_url")) || null, source_date: String(form.get("source_date")) || null,
        ...(fileName ? { metadata: { source_file: fileName } } : {})
      }
    }, true);
    if (result) router.push("/workspace/writing/" + result.resourceId);
  }
  return <section className={styles.workspace}>
    <Link className={styles.back} href="/workspace/writing">← Resource library</Link>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>A useful first step</p><h1>Bring your work into view.</h1>
      <p>Add a resource once. Keep its source, review what it needs, and compare improvements before you approve them.</p></div></header>
    <form className={styles.editorForm} onSubmit={(event) => void submit(event)}>
      <fieldset className={styles.formFields} disabled={busy}>
      <div className={styles.formGrid}>
        <label>Title<input name="title" required maxLength={240} autoFocus /></label>
        <label>Author <span>Optional</span><input name="author" maxLength={240} /></label>
        <label>Resource type<select name="resource_type"><option value="article">Article</option><option value="sermon">Sermon</option><option value="teaching">Teaching</option><option value="study_guide">Study guide</option><option value="other">Other</option></select></label>
        <label>Source label<input name="source_label" required maxLength={240} placeholder="For example: My teaching manuscript" /></label>
        <label>Recorded source URL <span>Optional; not fetched or verified</span><input name="source_url" type="url" maxLength={2000} placeholder="https://" /></label>
        <label>Source date <span>Optional</span><input name="source_date" type="date" /></label>
      </div>
      <label>Load a text file <span>Optional · .txt or .md · replaces the text below; the original file is not uploaded</span>
        <input type="file" accept=".txt,.md,text/plain,text/markdown" disabled={busy} onChange={async (event) => {
          const file = event.target.files?.[0];
          setFileError(null);
          if (!file) return;
          if (!/\.(txt|md)$/i.test(file.name) || file.size > 400000) { setFileError("Choose a .txt or .md file up to 400 KB. For Word or PDF, paste the text below."); return; }
          try {
            const text = await file.text();
            if (text.length > 100000 || text.includes("\u0000")) throw new Error("Use plain text up to 100,000 characters.");
            setBody(text); setFileName(file.name);
          } catch { setFileError("This file couldn't be read as plain text. Paste the text below."); }
        }} />
      </label>
      {fileError && <p role="alert">{fileError}</p>}
      <label>Source text<textarea required rows={15} maxLength={100000} value={body} onChange={(event) => { setBody(event.target.value); setFileName(""); }} /></label>
      <p className={styles.method}>{body.length.toLocaleString()} / 100,000 characters · Saved as a private draft with “user stated” evidence status. Adding a resource does not publish it or verify its claims.</p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actionRow}><button className={styles.secondary} disabled={busy} type="submit">{busy ? "Saving your original…" : "Save resource and review"}</button><Link className={styles.textLink} href="/workspace/writing">Cancel</Link></div>
      </fieldset>
    </form>
  </section>;
}
