"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bot, Check, ChevronRight, Gauge, LockKeyhole, MemoryStick, PackageCheck, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { ClockSettings } from "@/components/clock-settings";
import { useWorkspace } from "@/components/workspace-provider";
import { CAPABILITY_DEFINITIONS, capabilityEnabled, capabilityIncluded, type CapabilityKey } from "@/lib/workspace/capabilities";
import { saveNativeConfiguration, trackProductEvent } from "@/lib/workspace/repository";
import type { ConfigurationArea } from "@/lib/workspace/types";

const editableAreas: Array<{ area: ConfigurationArea; label: string; description: string }> = [
  { area: "responsibilities", label: "Responsibilities", description: "What you are responsible for now." },
  { area: "areas_of_attention", label: "Areas of attention", description: "Where clarity, alignment, or support matters." },
  { area: "priorities", label: "Priorities", description: "What deserves deliberate attention first." },
  { area: "assistant_posture", label: "Assistant posture", description: "Reactive, assistive, or proactive—and what that means to you." },
  { area: "review_rhythm", label: "Review rhythm", description: "When Workspace should help you step back and reassess." },
  { area: "daily_brief", label: "Daily Brief", description: "Your preferred cadence or whether to leave it off for now." }
];

export default function SettingsPage() {
  const { user, workspace, plan, capabilities, configuration, refreshProductState, bundleExperience } = useWorkspace();
  const [values, setValues] = useState<Record<string, string>>({});
  const [pendingArea, setPendingArea] = useState<ConfigurationArea | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of configuration) if (item.active && typeof item.content.text === "string" && next[item.area] === undefined) next[item.area] = item.content.text;
    setValues(next);
  }, [configuration]);

  useEffect(() => {
    if (!workspace || !user) return;
    void trackProductEvent(workspace.id, user.id, "plan_viewed").catch(() => undefined);
  }, [workspace, user]);

  const included = useMemo(() => (Object.keys(CAPABILITY_DEFINITIONS) as CapabilityKey[]).filter((key) => capabilityIncluded(capabilities, key)), [capabilities]);
  const unavailable = useMemo(() => (Object.keys(CAPABILITY_DEFINITIONS) as CapabilityKey[]).filter((key) => !capabilityIncluded(capabilities, key)), [capabilities]);
  const configurationEnabled = capabilityEnabled(capabilities, "core_workspace", plan?.status);

  async function saveArea(area: ConfigurationArea) {
    if (!workspace || !user || !configurationEnabled || !values[area]?.trim()) return;
    setPendingArea(area); setError(null); setMessage(null);
    try {
      await saveNativeConfiguration({ workspaceId: workspace.id, userId: user.id, area, content: { text: values[area].trim() } });
      await refreshProductState();
      setMessage(`${editableAreas.find((entry) => entry.area === area)?.label} updated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workspace configuration could not be updated.");
    } finally { setPendingArea(null); }
  }

  return <section className="settings-page"><p className="eyebrow workflow-kicker">Workspace</p><h1 className="page-title">Settings</h1>
      <div className="header-actions">{bundleExperience?.capabilityIds.includes("workspace.personalize") ? <Link className="button secondary" href="/workspace/layout">Customize workspace layout</Link> : null}{bundleExperience?.capabilityIds.includes("workspace.compose") ? <Link className="button secondary" href="/workspace/value">Measure bundle value</Link> : null}</div><p className="page-lede">Manage the Personal configuration, assistant access, plan capabilities, and privacy boundaries that shape your Workspace.</p>
    {message ? <p className="notice" role="status">{message}</p> : null}{error ? <p className="error" role="alert">{error}</p> : null}
    <nav className="settings-index" aria-label="Settings sections"><a href="#workspace"><SlidersHorizontal size={16} />Workspace</a>{bundleExperience?.capabilityIds.includes("workspace.compose") ? <a href="#value"><Gauge size={16} />Bundle value</a> : null}<a href="#profile"><UserRound size={16} />Personal profile</a><a href="#assistant"><Bot size={16} />AI / Assistant</a><a href="#plan"><PackageCheck size={16} />Plan &amp; capabilities</a><a href="#privacy"><ShieldCheck size={16} />Privacy / Data</a></nav>

    <section id="workspace" className="settings-section"><header><SlidersHorizontal size={20} /><div><h2>Workspace configuration</h2><p>The same confirmed configuration is used whether you edit here or work through ChatGPT or Claude.</p></div></header>{!configurationEnabled ? <p className="notice"><LockKeyhole size={16} />Configuration editing is unavailable while Core Workspace is not enabled. Confirmed information is retained.</p> : null}<div className="settings-edit-grid">{editableAreas.map((entry) => <article className="settings-editor" key={entry.area}><div><h3>{entry.label}</h3><p>{entry.description}</p></div><textarea rows={4} maxLength={5000} aria-label={entry.label} readOnly={!configurationEnabled} value={values[entry.area] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [entry.area]: event.target.value }))} /><button className="button secondary" disabled={!configurationEnabled || pendingArea === entry.area || !values[entry.area]?.trim()} onClick={() => void saveArea(entry.area)}>{pendingArea === entry.area ? "Saving…" : "Save"}</button></article>)}</div></section>

    {bundleExperience?.capabilityIds.includes("workspace.compose") ? <section id="value" className="settings-section"><header><Gauge size={20} /><div><h2>Bundle value</h2><p>Measure whether each assigned bundle reaches its promised first outcome quickly, clearly, and with trustworthy evidence.</p></div></header><p>Record your usual-process estimate before beginning, let the server measure elapsed time, then rate the actual result. The check stores only bounded measurements and declared signal IDs—never your prompt, source material, client work, or output.</p><Link className="button secondary" href="/workspace/value">Open bundle value checks <ChevronRight size={15} /></Link></section> : null}

    <section id="profile" className="settings-section"><header><UserRound size={20} /><div><h2>Personal profile</h2><p>Your Workspace identity is local to Personal even though sign-in begins with Lead Emergence.</p></div></header><div className="settings-summary-grid"><article><span>Owner</span><strong>{user?.email}</strong></article><article><span>Workspace</span><strong>{workspace?.name}</strong></article><article><span>Type</span><strong>Personal</strong></article></div><ClockSettings /></section>

    <section id="assistant" className="settings-section"><header><Bot size={20} /><div><h2>AI / Assistant</h2><p>Review current permission, unfinished setup and saved connection evidence in one place.</p></div></header><p>Native Workspace works without an AI connection. The connection center checks current grants and registration, explains shared-credential impact, and asks you to review the exact disconnect. Privacy controls remain available after plan changes.</p><Link className="button secondary" href="/workspace/integrations">Manage access in connection center <ChevronRight size={15} /></Link></section>

    <section id="plan" className="settings-section"><header><PackageCheck size={20} /><div><h2>Plan &amp; capabilities</h2><p>Product capabilities never change which private records you own or bypass row-level security.</p></div></header><article className="current-plan"><span>Current plan</span><h3>{plan?.plan_key === "personal" ? "Personal" : "Unavailable"}</h3><p>{plan?.status === "active" ? "Active — included capabilities are enabled." : "Capability use is currently suspended. Your data is retained."}</p><small>Billing is not active. Pricing and trial terms have not been invented.</small></article><div className="capability-columns"><div><h3>Included in Personal</h3>{included.map((key) => <article className="capability-row" key={key}><Check size={16} /><div><strong>{CAPABILITY_DEFINITIONS[key].label}</strong><p>{key === "integration_limit" ? `${capabilities.integration_limit} external connections` : CAPABILITY_DEFINITIONS[key].benefit}</p></div></article>)}</div><div><h3>Available capabilities</h3>{unavailable.map((key) => <article className="capability-row locked" key={key}><LockKeyhole size={16} /><div><strong>{CAPABILITY_DEFINITIONS[key].label}</strong><p>{CAPABILITY_DEFINITIONS[key].benefit} Available with an upgraded plan.</p></div></article>)}</div></div><p className="retention-note"><ShieldCheck size={16} />If a capability is removed, privileged use is disabled and its safe configuration is retained. Workspace does not delete Personal data on downgrade.</p></section>

    <section id="privacy" className="settings-section"><header><ShieldCheck size={20} /><div><h2>Privacy / Data</h2><p>Understand and control what Workspace remembers and who may act on your behalf.</p></div></header><div className="privacy-settings-grid"><article><MemoryStick size={20} /><h3>Personal Memory</h3><p>Memory is confirmed context that may influence assistance. It is not raw conversation history. You can review and remove entries from Memory.</p><Link href="/workspace/memory">Review Memory <ChevronRight size={15} /></Link></article><article><ShieldCheck size={20} /><h3>Access boundaries</h3><p>Lead Emergence identity, Personal plan, connector permission, and record authorization are separate controls.</p><Link href="/privacy">Read privacy details <ChevronRight size={15} /></Link></article></div></section>
  </section>;
}
