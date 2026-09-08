"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Search, ShieldCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { useWritingRead } from "./use-writing-read";
import type { WritingLibrary } from "@/lib/writing/contracts";
import styles from "./writing.module.css";

export function WritingAccessState() {
  const { bundlesLoading, bundleError, refreshBundleExperience } = useWorkspace();
  return <section className={styles.empty} aria-live="polite">
    <BookOpen size={28} /><h1>{bundlesLoading ? "Opening your Writing workspace…" : bundleError ? "Writing is temporarily unavailable" : "Writing isn't included in your current access"}</h1>
    <p>{bundleError ? "We couldn't verify your access. Please try again." : bundlesLoading ? "Checking your current access." : "Your Workspace administrator can assign Writer & Editor. If your access just changed, check again."}</p>
    {!bundlesLoading && <button className={styles.secondary} onClick={refreshBundleExperience}>Check access again</button>}
    <Link className={styles.textLink} href="/workspace">Return to Home <ArrowRight size={16} /></Link>
  </section>;
}
export function WritingLibraryPage() {
  const { bundleExperience } = useWorkspace();
  const canReview = bundleExperience?.capabilityIds.includes("writer.resource.review") === true;
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ search, offset: String(offset), limit: "25" });
  if (filter) params.set("state", filter);
  const { enabled, data, loading, error, retry } = useWritingRead<WritingLibrary>("/api/writing/resources?" + params, "writer.resource.library");
  if (!enabled) return <WritingAccessState />;
  return <section className={styles.workspace} aria-label="Writing resource library">
    <header className={styles.pageHeader}>
      <div><p className={styles.eyebrow}>Writer & Editor</p><h1>Give good work its next reader.</h1>
        <p>Find a resource, see what it needs, and make the next editorial decision with the source in view.</p></div>
      {canReview && bundleExperience?.capabilityIds.includes("writer.resource.manage") ? <Link className={styles.secondary} href="/workspace/writing/new">Add a resource</Link> : <span className={styles.readOnly}><ShieldCheck size={15} />Read-only review</span>}
    </header>
    <div className={styles.libraryHeading}><h2>Resource library</h2>
      {data && <p><strong>{data.total}</strong> resources <span>·</span> <strong>{data.awaitingPublication}</strong> awaiting publication</p>}
    </div>
    <div className={styles.toolbar}>
      <form className={styles.search} onSubmit={(event) => { event.preventDefault(); setSearch(draftSearch.trim()); setOffset(0); }}>
        <Search size={18} aria-hidden="true" /><label className={styles.srOnly} htmlFor="resource-search">Search resources</label>
        <input id="resource-search" type="search" value={draftSearch} maxLength={200} onChange={(event) => setDraftSearch(event.target.value)} placeholder={canReview?"Search title, topic, or source text":"Search title, author, or topic"} />
        <button type="submit">Search</button>
      </form>
      <label className={styles.filter}>Publication status
        <select value={filter} onChange={(event) => { setFilter(event.target.value); setOffset(0); }}>
          <option value="">All resources</option><option value="draft">Draft</option><option value="in_review">In review</option>
          <option value="ready">Ready</option><option value="published">Published</option><option value="archived">Archived</option>
        </select>
      </label>
    </div>
    {loading ? <div className={styles.empty} role="status">Loading your resources…</div> :
      error ? <div className={styles.empty} role="alert"><h2>We couldn’t load your library</h2><p>{error}</p><button className={styles.secondary} onClick={retry}>Try again</button></div> :
      !data?.resources.length ? <div className={styles.empty}><BookOpen size={30} /><h2>{data?.total ? "No resources match this view" : "A home for your next piece"}</h2>
        <p>{data?.total ? "Try another title, author, topic, or publication status." : "Add your first manuscript or article to keep its source in view and prepare improvements you can compare before approving. Website connections are not available yet."}</p>
        {data?.total ? <button className={styles.secondary} onClick={() => { setDraftSearch(""); setSearch(""); setFilter(""); setOffset(0); }}>Clear filters</button> : null}
      </div> :
      <ul className={styles.resourceList}>{data.resources.map((resource) => <li key={resource.id}>
        <ResourceLink id={resource.id} enabled={canReview}>
          <span className={styles.documentIcon}><FileType type={resource.resource_type} /></span>
          <div className={styles.resourceCopy}><div className={styles.resourceMeta}><span>{resource.resource_type.replaceAll("_", " ")}</span><span>{resource.author || "Author not recorded"}</span></div>
            <h3>{resource.title}</h3><p>{resource.abstract || "A summary hasn't been recorded for this resource."}</p>
            <div className={styles.topics}>{resource.topics.slice(0, 4).map((topic) => <span key={topic}>{topic}</span>)}</div>
          </div>
          <div className={styles.rowEnd}><span className={styles.badge} data-state={resource.publication_state}>{resource.publication_state.replaceAll("_", " ")}</span>
            <span className={styles.reviewLink}>{canReview ? <>Review resource <ArrowRight size={16} /></> : "Review access not included"}</span></div>
        </ResourceLink>
      </li>)}</ul>}
    {data && data.matchingCount > 25 && <nav className={styles.pagination} aria-label="Resource pages">
      <button className={styles.secondary} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</button>
      <span>{offset + 1}–{Math.min(offset + 25, data.matchingCount)} of {data.matchingCount}</span>
      <button className={styles.secondary} disabled={offset + 25 >= data.matchingCount} onClick={() => setOffset(offset + 25)}>Next</button>
    </nav>}
    <footer className={styles.footer}>Source information stays visible. Original revisions are preserved; changes require your approval.</footer>
  </section>;
}
function FileType({ type }: { type: string }) { return <><BookOpen size={21} /><small>{type === "sermon" ? "SER" : type === "teaching" ? "TCH" : "DOC"}</small></>; }
function ResourceLink({ id, enabled, children }: { id: string; enabled: boolean; children: ReactNode }) {
  return enabled ? <Link href={"/workspace/writing/" + id} className={styles.resourceRow}>{children}</Link>
    : <div className={styles.resourceRow}>{children}</div>;
}
