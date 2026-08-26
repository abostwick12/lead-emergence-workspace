"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { resolvePersonalWorkspace } from "@/lib/workspace/provision";
import {
  getClockTimeZones,
  getLeaderModeEntitlement,
  getOnboarding,
  getPersonalPlan,
  listConfiguration,
  listPlanCapabilities,
  saveClockTimeZones
} from "@/lib/workspace/repository";
import { EMPTY_CAPABILITIES, resolveCapabilities, type CapabilityResolution } from "@/lib/workspace/capabilities";
import { DEFAULT_CLOCK_TIMEZONES, normalizeClockTimeZones, type ClockTimeZones } from "@/lib/workspace/timezones";
import type { ConfigurationItem, OnboardingRecord, PersonalPlanRecord, WorkspaceRecord } from "@/lib/workspace/types";

type WorkspaceContextValue = {
  ready: boolean;
  user: User | null;
  workspace: WorkspaceRecord | null;
  onboarding: OnboardingRecord | null;
  plan: PersonalPlanRecord | null;
  capabilities: CapabilityResolution;
  configuration: ConfigurationItem[];
  error: string | null;
  clockTimeZones: ClockTimeZones;
  clockPreferencesError: string | null;
  saveClockPreferences: (timeZones: ClockTimeZones) => Promise<void>;
  refreshProductState: () => Promise<void>;
  signOut: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingRecord | null>(null);
  const [plan, setPlan] = useState<PersonalPlanRecord | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityResolution>({ ...EMPTY_CAPABILITIES });
  const [configuration, setConfiguration] = useState<ConfigurationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clockTimeZones, setClockTimeZones] = useState<ClockTimeZones>([...DEFAULT_CLOCK_TIMEZONES]);
  const [clockPreferencesError, setClockPreferencesError] = useState<string | null>(null);

  const loadProductState = useCallback(async (personalWorkspace: WorkspaceRecord) => {
    const [personalOnboarding, personalPlan, configuredItems, leaderMode] = await Promise.all([
      getOnboarding(personalWorkspace.id),
      getPersonalPlan(personalWorkspace.id),
      listConfiguration(personalWorkspace.id),
      getLeaderModeEntitlement(personalWorkspace.id)
    ]);
    const planCapabilities = await listPlanCapabilities(personalPlan.plan_key);
    setOnboarding(personalOnboarding);
    setPlan(personalPlan);
    setCapabilities(resolveCapabilities(planCapabilities, leaderMode));
    setConfiguration(configuredItems);
  }, []);

  useEffect(() => {
    let live = true;
    const supabase = getWorkspaceClient();
    const load = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!data.user) return;
        if (live) setUser(data.user);
        const personalWorkspace = await resolvePersonalWorkspace(data.user);
        const storedClockTimeZones = await getClockTimeZones(data.user.id).catch((clockError: unknown) => {
          if (live) setClockPreferencesError(clockError instanceof Error ? clockError.message : "Could not load clock preferences.");
          return [...DEFAULT_CLOCK_TIMEZONES] as ClockTimeZones;
        });
        if (!live) return;
        await loadProductState(personalWorkspace);
        if (!live) return;
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
        setOnboarding(null);
        setPlan(null);
        setCapabilities({ ...EMPTY_CAPABILITIES });
        setConfiguration([]);
        setClockTimeZones([...DEFAULT_CLOCK_TIMEZONES]);
        setClockPreferencesError(null);
      }
    });
    return () => {
      live = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProductState]);

  const refreshProductState = useCallback(async () => {
    if (workspace) await loadProductState(workspace);
  }, [workspace, loadProductState]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    ready,
    user,
    workspace,
    onboarding,
    plan,
    capabilities,
    configuration,
    error,
    clockTimeZones,
    clockPreferencesError,
    refreshProductState,
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
      setOnboarding(null);
      setPlan(null);
      setCapabilities({ ...EMPTY_CAPABILITIES });
      setConfiguration([]);
      setClockTimeZones([...DEFAULT_CLOCK_TIMEZONES]);
      setClockPreferencesError(null);
    }
  }), [ready, user, workspace, onboarding, plan, capabilities, configuration, error, clockTimeZones, clockPreferencesError, refreshProductState]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return value;
}
