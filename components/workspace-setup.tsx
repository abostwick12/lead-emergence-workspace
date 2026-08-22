"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, Check, Clipboard, ExternalLink, MessageCircle, RefreshCw, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { CapabilityLockedState } from "@/components/capability-locked-state";
import { useWorkspace } from "@/components/workspace-provider";
import { capabilityEnabled } from "@/lib/workspace/capabilities";
import {
  chooseSetupMethod,
  completePersonalOnboarding,
  listMcpAuthorizations,
  saveNativeConfiguration,
  trackProductEvent
} from "@/lib/workspace/repository";
import type { AssistantProvider, ConfigurationArea, McpAuthorizationRecord } from "@/lib/workspace/types";

const nativeSteps: Array<{
  title: string;
  lede: string;
  fields: Array<{ area: ConfigurationArea; label: string; prompt: string; optional?: boolean }>;
}> = [
  {
    title: "Your leadership reality",
    lede: "Start with what is true now. You can refine it later.",
    fields: [
      { area: "responsibilities", label: "Responsibilities", prompt: "What are you responsible for right now?" },
      { area: "areas_of_attention", label: "Areas of attention", prompt: "Where do you need clarity, alignment, or support?" }
    ]
  },
  {
    title: "Commitments and value",
    lede: "Name what is competing for attention and where you want to create value.",
    fields: [
      { area: "priorities", label: "Starting priorities", prompt: "What deserves deliberate attention first?" },
      { area: "commitments", label: "Major commitments", prompt: "What responsibilities or commitments are competing for attention?", optional: true },
      { area: "value_focus", label: "Value focus", prompt: "Where are you trying to create meaningful value?", optional: true }
    ]
  },
  {
    title: "How Workspace should help",
    lede: "Choose a posture and rhythm that feel supportive—not intrusive.",
    fields: [
      { area: "assistant_posture", label: "Assistant posture", prompt: "Reactive, assistive, or proactive? What would helpful support feel like?" },
      { area: "review_rhythm", label: "Review rhythm", prompt: "How often should Workspace help you step back and reassess?", optional: true }
    ]
  },
  {
    title: "Your starting system",
    lede: "Connect nothing by default. These answers only shape recommendations.",
    fields: [
      { area: "existing_systems", label: "Existing systems", prompt: "What tools or systems do you already rely on?", optional: true },
      { area: "starting_capabilities", label: "Starting capabilities", prompt: "What should Workspace help with first?", optional: true },
      { area: "daily_brief", label: "Daily Brief preference", prompt: "Would a daily or weekly step-back be useful? Note a preferred rhythm or say not yet.", optional: true }
    ]
  }
];

export function WorkspaceSetup() {
  const router = useRouter();
  const { user, workspace, onboarding, plan, configuration, capabilities, refreshProductState } = useWorkspace();
  const [nativeStep, setNativeStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [connections, setConnections] = useState<McpAuthorizationRecord[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mcpUrl, setMcpUrl] = useState("https://workspace.leademergence.com/api/mcp");

  useEffect(() => {
    setMcpUrl(new URL("/api/mcp", window.location.origin).toString());
  }, []);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of configuration) {
      if (typeof item.content.text === "string" && next[item.area] === undefined) next[item.area] = item.content.text;
    }
    setValues(next);
    if (onboarding?.setup_method === "native") {
      const confirmed = new Set(configuration.filter((item) => item.active && ["user_confirmed", "validated_configuration"].includes(item.epistemic_status)).map((item) => item.area));
      const firstIncomplete = nativeSteps.findIndex((step) => step.fields.some((field) => !field.optional && !confirmed.has(field.area)));
      setNativeStep(firstIncomplete === -1 ? nativeSteps.length - 1 : firstIncomplete);
    }
  }, [configuration, onboarding?.setup_method]);

  useEffect(() => {
    if (!workspace) return;
    void listMcpAuthorizations(workspace.id).then(setConnections).catch(() => undefined);
  }, [workspace, onboarding?.state]);

  const connected = connections.some((connection) => connection.status === "connected");
  const assistant = onboarding?.selected_assistant;
  const currentStep = nativeSteps[nativeStep];
  const confirmedAreas = useMemo(() => new Set(configuration.filter((item) => item.active && ["user_confirmed", "validated_configuration"].includes(item.epistemic_status)).map((item) => item.area)), [configuration]);
  const coreEnabled = capabilityEnabled(capabilities, "core_workspace", plan?.status);
  const mcpEnabled = capabilityEnabled(capabilities, "workspace_mcp", plan?.status);

  if (!coreEnabled) return <CapabilityLockedState title="Personal Workspace setup" benefit="Core Workspace setup establishes the confirmed context that makes your leadership system useful." suspended={plan?.status === "suspended"} />;

  async function selectMethod(method: "ai" | "native", selectedAssistant?: AssistantProvider) {
    if (!workspace || !user || pending) return;
    setPending(true);
    setError(null);
    try {
      await chooseSetupMethod({ workspaceId: workspace.id, userId: user.id, method, assistant: selectedAssistant });
      await refreshProductState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workspace setup could not be updated.");
    } finally {
      setPending(false);
    }
  }

  async function saveStep() {
    if (!workspace || !user || pending) return;
    const requiredMissing = currentStep.fields.find((field) => !field.optional && !values[field.area]?.trim());
    if (requiredMissing) {
      setError(`Add a response for ${requiredMissing.label.toLowerCase()}—or write “I don't know yet.”`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      for (const field of currentStep.fields) {
        const text = values[field.area]?.trim();
        if (text) await saveNativeConfiguration({ workspaceId: workspace.id, userId: user.id, area: field.area, content: { text } });
      }
      await trackProductEvent(workspace.id, user.id, "workspace_configured", { native_step: nativeStep + 1 });
      await refreshProductState();
      if (nativeStep < nativeSteps.length - 1) setNativeStep((step) => step + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This setup step could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function finishNative() {
    if (!workspace || !user || pending) return;
    const requiredMissing = currentStep.fields.find((field) => !field.optional && !values[field.area]?.trim());
    if (requiredMissing) {
      setError(`Add a response for ${requiredMissing.label.toLowerCase()}—or write “I don't know yet.”`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      for (const field of currentStep.fields) {
        const text = values[field.area]?.trim();
        if (text) await saveNativeConfiguration({ workspaceId: workspace.id, userId: user.id, area: field.area, content: { text } });
      }
      await trackProductEvent(workspace.id, user.id, "workspace_configured", { native_step: nativeStep + 1, completed: true });
      await completePersonalOnboarding();
      await refreshProductState();
      router.replace("/workspace?welcome=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workspace setup could not be completed.");
    } finally {
      setPending(false);
    }
  }

  async function refreshConnection() {
    if (!workspace) return;
    setPending(true);
    setError(null);
    try {
      const latest = await listMcpAuthorizations(workspace.id);
      setConnections(latest);
      await refreshProductState();
      if (!latest.some((connection) => connection.status === "connected")) {
        setError("No active assistant connection was found yet. You can try again or continue without AI.");
      }
    } catch {
      setError("Connection status is temporarily unavailable. You can continue setup without AI.");
    } finally {
      setPending(false);
    }
  }

  if (!workspace || !user || !onboarding) return null;

  if (!onboarding.setup_method || onboarding.state === "setup_method_required") {
    return <SetupFrame step="Welcome" title="Set up your Workspace" lede="The easiest way to get started is with your AI assistant. Lead Emergence can guide the setup conversation in ChatGPT or Claude and configure your Workspace as you go.">
      <section className="setup-choice-grid" aria-label="Choose a Workspace setup method">
        <article className="setup-choice recommended"><span className="setup-recommended"><Sparkles size={14} /> Recommended</span><Bot size={28} /><h2>Connect your AI assistant</h2><p>Have a Lead Emergence conversation, confirm what matters, and see the same setup reflected here.</p><div className="setup-button-stack"><button className="button" disabled={pending || !mcpEnabled} onClick={() => void selectMethod("ai", "chatgpt")}><MessageCircle size={17} />Connect ChatGPT</button><button className="button secondary" disabled={pending || !mcpEnabled} onClick={() => void selectMethod("ai", "claude")}><Sparkles size={17} />Connect Claude</button></div></article>
        <article className="setup-choice"><UserRound size={28} /><h2>Set up without AI</h2><p>Use focused, save-as-you-go screens. This path creates the same Personal configuration and is fully supported.</p><button className="button secondary" disabled={pending} onClick={() => void selectMethod("native")}>Set up in Workspace <ArrowRight size={16} /></button></article>
      </section>
      <TrustNote />
      {error ? <p className="error" role="alert">{error}</p> : null}
    </SetupFrame>;
  }

  if (onboarding.setup_method === "ai" && assistant) {
    return <SetupFrame step="Connect" title={`Continue with ${assistant === "chatgpt" ? "ChatGPT" : "Claude"}`} lede="Workspace remains the system of record. Your assistant becomes an authorized interface—not a separate copy of your setup.">
      <section className="setup-connection-layout">
        <article className="setup-instructions">
          <div className="connection-status" data-connected={connected}><span />{connected ? "Connected" : "Connection required"}</div>
          <ol>
            <li><strong>Copy your Workspace connection address.</strong><div className="copy-field"><code>{mcpUrl}</code><button className="icon-button" aria-label="Copy Workspace connection address" onClick={() => { void navigator.clipboard.writeText(mcpUrl); setCopied(true); }}><Clipboard size={16} /></button></div>{copied ? <small role="status"><Check size={13} /> Copied</small> : null}</li>
            {assistant === "chatgpt" ? <>
              <li><strong>Open ChatGPT settings.</strong> In Apps &amp; Connectors, enable developer mode, create a connection, and paste the address.</li>
              <li><strong>Approve access.</strong> Sign in with Lead Emergence and review the Workspace consent screen.</li>
            </> : <>
              <li><strong>Open Claude settings.</strong> Under Connectors, choose Add custom connector and paste the address.</li>
              <li><strong>Approve access.</strong> Sign in with Lead Emergence and review the Workspace consent screen.</li>
            </>}
            <li><strong>Start the setup conversation.</strong> Ask the connected Workspace to continue your Lead Emergence setup.</li>
          </ol>
          <div className="setup-inline-actions"><a className="button" href={assistant === "chatgpt" ? "https://chatgpt.com" : "https://claude.ai/new"} target="_blank" rel="noreferrer">Open {assistant === "chatgpt" ? "ChatGPT" : "Claude"} <ExternalLink size={15} /></a><button className="button secondary" disabled={pending} onClick={() => void refreshConnection()}><RefreshCw size={15} />{connected ? "Refresh" : "I've connected"}</button></div>
        </article>
        <aside className="setup-access-card"><ShieldCheck size={22} /><h2>What the connection can do</h2><p>Read your confirmed setup, priorities, commitments, tasks, and captures through controlled tools. It can save user-reported setup, propose an interpretation, and store that interpretation only after you confirm it.</p><p>Tokens stay with the authorization service. You can disconnect access from Workspace Settings.</p></aside>
      </section>
      {connected ? <p className="notice" role="status">Your assistant is connected. Continue the setup conversation there; Workspace will recognize your existing progress and will not restart it.</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="setup-footer-actions"><button className="text-button" disabled={pending} onClick={() => void selectMethod("native")}><ArrowLeft size={15} />Continue setup without AI</button></div>
      <details className="setup-advanced"><summary>Advanced connection details</summary><p>This is a remote Model Context Protocol connection using OAuth 2.1, exact audience binding, explicit consent, Workspace authorization, plan capability checks, and row-level isolation.</p></details>
    </SetupFrame>;
  }

  return <SetupFrame step={`${nativeStep + 1} of ${nativeSteps.length}`} title={currentStep.title} lede={currentStep.lede}>
    <div className="setup-progress" aria-label={`Setup step ${nativeStep + 1} of ${nativeSteps.length}`}>{nativeSteps.map((step, index) => <span key={step.title} data-active={index <= nativeStep} />)}</div>
    <section className="setup-native-form">
      {currentStep.fields.map((field) => <label key={field.area}><span>{field.label}{field.optional ? <small>Optional</small> : null}</span><em>{field.prompt}</em><textarea rows={4} maxLength={5000} value={values[field.area] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.area]: event.target.value }))} placeholder={field.optional ? "Add context, skip this, or return later." : "A short answer is enough. “I don't know yet” is a valid answer."} /></label>)}
    </section>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <div className="setup-footer-actions"><button className="button secondary" disabled={nativeStep === 0 || pending} onClick={() => setNativeStep((step) => Math.max(0, step - 1))}><ArrowLeft size={15} />Back</button>{nativeStep < nativeSteps.length - 1 ? <button className="button" disabled={pending} onClick={() => void saveStep()}>{pending ? "Saving…" : "Save and continue"}<ArrowRight size={15} /></button> : <><button className="button secondary" disabled={pending} onClick={() => void saveStep()}>Save this step</button><button className="button" disabled={pending || confirmedAreas.size < 3} onClick={() => void finishNative()}>{pending ? "Finishing…" : "Save and begin using Workspace"}<ArrowRight size={15} /></button></>}</div>
    <div className="setup-switch"><p>Prefer a conversation? Your saved answers will carry over.</p><button className="text-button" disabled={pending || !mcpEnabled} onClick={() => void selectMethod("ai", "chatgpt")}>Connect an AI assistant</button></div>
  </SetupFrame>;
}

function SetupFrame({ step, title, lede, children }: { step: string; title: string; lede: string; children: React.ReactNode }) {
  return <div className="setup-page"><header className="setup-brand"><Link href="/workspace" aria-label="Lead Emergence Workspace"><span className="brand-mark"><Sparkles size={18} /></span><span>Lead Emergence<small>Workspace</small></span></Link><span>{step}</span></header><section className="setup-card"><p className="eyebrow">Personal Workspace</p><h1>{title}</h1><p className="setup-lede">{lede}</p>{children}</section></div>;
}

function TrustNote() {
  return <p className="setup-trust"><ShieldCheck size={16} />AI setup is recommended, never required. Nothing external is connected automatically, and both paths populate the same private configuration.</p>;
}
