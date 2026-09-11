"use client";
import { useCallback, useEffect, useState } from "react";
import { workspaceRead, WorkspaceReadError } from "@/lib/bundles/client";
import { useWorkspace } from "@/components/workspace-provider";
export function useWritingRead<T>(path: string, capability: string) {
  const { bundleExperience, refreshBundleExperience } = useWorkspace();
  const enabled = bundleExperience?.capabilityIds.includes(capability) === true;
  const key = enabled ? bundleExperience.workspaceId + ":" + bundleExperience.revision + ":" + path : null;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null; denied: boolean } | null>(null);
  useEffect(() => {
    if (!enabled || !key) return;
    const controller = new AbortController();
    void workspaceRead<T>(path, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ key, data, error: null, denied: false });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const denied = error instanceof WorkspaceReadError && [401, 403].includes(error.status);
      setState({ key, data: null, error: error instanceof Error ? error.message : "Please try again.", denied });
      if (denied) refreshBundleExperience();
    });
    return () => controller.abort();
  }, [enabled, key, path, attempt, refreshBundleExperience]);
  const matching = key !== null && state?.key === key;
  return { enabled, data: matching ? state.data : null, loading: enabled && !matching,
    error: matching ? state.error : null,
    retry: useCallback(() => { setState(null); setAttempt((value) => value + 1); }, []),
    refresh: useCallback(() => { setAttempt((value) => value + 1); }, []) };
}
