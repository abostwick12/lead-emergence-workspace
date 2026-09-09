"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { taskTargetFromHash } from "@/lib/bundles/task-target";
import styles from "./task-link-navigation.module.css";

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
  };
}
const snapshot = () => window.location.hash;
const serverSnapshot = () => "";

/** Mount only around an authorized, loaded editor, never around history or proposals. */
export function TaskLinkNavigation({ targets, children }: { targets: string[]; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null), notice = useRef<HTMLParagraphElement>(null);
  const hash = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const targetId = taskTargetFromHash(hash);
  const found = targetId !== null && targets.includes(targetId);
  const invalid = hash.toLowerCase().startsWith("#task-") && targetId === null;
  const missing = targetId !== null && !found;

  useEffect(() => {
    if (!targetId && !invalid) return;
    // IDs are validated, matched to the on-screen draft, and scoped to this editor.
    // Do not search earlier revisions or silently select a different task.
    const target = found && targetId ? document.getElementById(targetId) : null;
    if (target && !root.current?.contains(target)) return;
    const destination = target ?? notice.current;
    if (!destination) return;
    if (target) target.dataset.linkedTask = "true";
    let frame = 0;
    const reveal = () => {
      if (target instanceof HTMLDetailsElement) target.open = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.location.hash !== hash || !destination.isConnected) return;
        const focus = target instanceof HTMLDetailsElement ? target.querySelector("summary") : destination;
        focus?.focus({ preventScroll: true });
        destination.scrollIntoView({ block: "start", behavior: "instant" });
      });
    };
    reveal();
    const repeat = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash === hash) reveal();
    };
    window.addEventListener("click", repeat);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("click", repeat);
      if (target) delete target.dataset.linkedTask;
    };
  }, [hash, targetId, found, invalid]);

  return <div ref={root} className={styles.scope}>
    {(missing || invalid) && <p ref={notice} tabIndex={-1} role="status" className={styles.notice}>
      {invalid ? "This task link is not valid." : "The linked task is not in this on-screen record. It may have been removed or changed."}
      {" "}You can review this record and its earlier saved work. No other task was selected and nothing was saved.
    </p>}
    {children}
  </div>;
}
