"use client";
import { useEffect, useRef, useState } from "react";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace-provider";
export function useWritingAction() {
  const { user, refreshBundleExperience } = useWorkspace();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const mounted = useRef(true), inFlight = useRef(false);
  const attempt = useRef({ payload: "", requestId: "" });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function run<T>(path: string, input: object, idempotent = false): Promise<T | null> {
    if (inFlight.current) return null;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const { data, error: sessionError } = await getWorkspaceClient().auth.getSession();
      if (sessionError || !data.session || data.session.user.id !== user?.id) throw new Error("Your sign-in changed. Refresh before saving.");
      const payload = JSON.stringify({ path, input });
      if (attempt.current.payload !== payload) attempt.current = { payload, requestId: crypto.randomUUID() };
      const response = await fetch(path, {
        method: "POST", headers: { Authorization: "Bearer " + data.session.access_token, "Content-Type": "application/json" },
        cache: "no-store", body: JSON.stringify(idempotent ? { ...input, requestId: attempt.current.requestId } : input)
      });
      const result = await response.json();
      if (!response.ok) {
        if ([401,403].includes(response.status)) refreshBundleExperience();
        throw new Error(typeof result.message === "string" ? result.message : "Couldn't save. Please try again.");
      }
      return mounted.current ? result as T : null;
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error ? caught.message : "Couldn't save. You can safely retry.");
      return null;
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return { run, busy, error };
}
