"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { resolvePersonalWorkspace } from "@/lib/workspace/provision";
import { getClockTimeZones, saveClockTimeZones } from "@/lib/workspace/repository";
import { DEFAULT_CLOCK_TIMEZONES, normalizeClockTimeZones, type ClockTimeZones } from "@/lib/workspace/timezones";
import type { WorkspaceRecord } from "@/lib/workspace/types";

type WorkspaceContextValue = {
  ready: boolean;
  user: User | null;
  workspace: WorkspaceRecord | null;
  error: string | null;
  clockTimeZones: ClockTimeZones;
  clockPreferencesError: string | null;
  saveClockPreferences: (timeZones: ClockTimeZones) => Promise<void>;
  signOut: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clockTimeZones, setClockTimeZones] = useState<ClockTimeZones>([...DEFAULT_CLOCK_TIMEZONES]);
  const [clockPreferencesError, setClockPreferencesError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const supabase = getWorkspaceClient();
    const load = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!data.user) return;
        const [personalWorkspace, storedClockTimeZones] = await Promise.all([
          resolvePersonalWorkspace(data.user),
          getClockTimeZones(data.user.id).catch((clockError: unknown) => {
            if (live) setClockPreferencesError(clockError instanceof Error ? clockError.message : "Could not load clock preferences.");
            return [...DEFAULT_CLOCK_TIMEZONES] as ClockTimeZones;
          })
        ]);
        if (!live) return;
        setUser(data.user);
        setWorkspace(personalWorkspace);
        setClockTimeZones(storedClockTimeZones);
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
        setClockTimeZones([...DEFAULT_CLOCK_TIMEZONES]);
        setClockPreferencesError(null);
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
    clockTimeZones,
    clockPreferencesError,
    saveClockPreferences: async (timeZones) => {
      if (!user) throw new Error("Sign in before saving clock preferences.");
      const normalized = normalizeClockTimeZones(timeZones);
      if (normalized.some((timeZone, index) => timeZone !== timeZones[index])) {
        throw new Error("Choose three supported IANA time zones.");
      }
      setClockPreferencesError(null);
      try {
        const saved = await saveClockTimeZones(user.id, normalized);
        setClockTimeZones(saved);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not save clock preferences.";
        setClockPreferencesError(message);
        throw new Error(message);
      }
    },
    signOut: async () => {
      const { error: signOutError } = await getWorkspaceClient().auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;
      setUser(null);
      setWorkspace(null);
      setClockTimeZones([...DEFAULT_CLOCK_TIMEZONES]);
      setClockPreferencesError(null);
    }
  }), [ready, user, workspace, error, clockTimeZones, clockPreferencesError]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return value;
}
