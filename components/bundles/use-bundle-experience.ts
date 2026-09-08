"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { workspaceRead } from "@/lib/bundles/client";
import type { BundleExperience } from "@/lib/bundles/experience";

export function useBundleExperience(subjectId?: string, workspaceId?: string) {
  const pathname = usePathname();
  const scope = subjectId && workspaceId ? subjectId + ":" + workspaceId : null;
  const [state, setState] = useState<{ scope: string | null; experience: BundleExperience | null; loading: boolean; error: string | null }>({
    scope: null, experience: null, loading: false, error: null
  });
  const reload = useRef<() => void>(() => {});
  useEffect(() => {
    if (!scope || !workspaceId) return;
    let disposed = false;
    let request: AbortController | null = null;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      request?.abort();
      request = new AbortController();
      const current = request;
      try {
        const experience = await workspaceRead<BundleExperience>("/api/bundles/experience", current.signal);
        if (disposed || current.signal.aborted) return;
        if (experience.workspaceId !== workspaceId) throw new Error("Workspace access could not be verified.");
        clearTimeout(expiryTimer);
        if (experience.expiresAt) {
          const remaining = Date.parse(experience.expiresAt) - Date.now();
          if (remaining <= 0) {
            setState({ scope, experience: null, loading: false, error: null });
            return;
          }
          expiryTimer = setTimeout(() => {
            setState({ scope, experience: null, loading: true, error: null });
            void load();
          }, Math.min(remaining, 2_147_483_647));
        }
        setState({ scope, experience, loading: false, error: null });
      } catch {
        if (!disposed && !current.signal.aborted) setState({
          scope, experience: null, loading: false, error: "Bundle access is temporarily unavailable."
        });
      }
    };
    reload.current = () => { void load(); };
    void load();
    const refreshVisible = () => { if (document.visibilityState === "visible") void load(); };
    const poll = setInterval(refreshVisible, 30_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      disposed = true; request?.abort(); clearInterval(poll); clearTimeout(expiryTimer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [scope, workspaceId, pathname]);
  const refreshBundleExperience = useCallback(() => reload.current(), []);
  const matching = scope !== null && state.scope === scope;
  return {
    bundleExperience: matching ? state.experience : null,
    bundlesLoading: scope !== null && (!matching || state.loading),
    bundleError: matching ? state.error : null,
    refreshBundleExperience
  };
}
