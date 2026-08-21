"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { resolvePersonalWorkspace } from "@/lib/workspace/provision";
import type { WorkspaceRecord } from "@/lib/workspace/types";

type WorkspaceContextValue = {
  ready: boolean;
  user: User | null;
  workspace: WorkspaceRecord | null;
  error: string | null;
  signOut: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const supabase = getWorkspaceClient();
    const load = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!data.user) return;
        const personalWorkspace = await resolvePersonalWorkspace(data.user);
        if (!live) return;
        setUser(data.user);
        setWorkspace(personalWorkspace);
      } catch (caught) {
        if (live) setError(caught instanceof Error ? caught.message : "Could not load Workspace.");
      } finally {
        if (live) setReady(true);
      }
    };
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setWorkspace(null);
      }
    });
    return () => {
      live = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<WorkspaceContextValue>(() => ({
    ready,
    user,
    workspace,
    error,
    signOut: async () => {
      await getWorkspaceClient().auth.signOut();
      setUser(null);
      setWorkspace(null);
    }
  }), [ready, user, workspace, error]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return value;
}
