"use client";

import {
  Bot,
  BookHeart,
  BookOpenText,
  BrainCircuit,
  CalendarDays,
  FileSliders,
  Flame,
  Github,
  HardDrive,
  KanbanSquare,
  Linkedin,
  Mail,
  MessageSquare,
  Palette,
  Plus,
  Search,
  X,
  type LucideIcon
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BsOpenai } from "react-icons/bs";
import { FaFilePowerpoint, FaGithub } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { SiClaude } from "react-icons/si";
import { useWorkspace } from "@/components/workspace-provider";
import {
  MCP_CATALOG,
  MCP_CATEGORIES,
  filterMcpCatalog,
  findConnectionForEntry,
  getMcpSetupLabel,
  getMcpDisplayStatus,
  type McpCatalogEntry,
  type McpCategoryFilter,
  type McpDisplayStatus
} from "@/lib/workspace/mcp-catalog";
import { listIntegrationConnections, listMcpAuthorizations } from "@/lib/workspace/repository";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { getIntegrationProvider } from "@/lib/integrations/providers";
import type { IntegrationConnection, McpAuthorizationRecord } from "@/lib/workspace/types";
import styles from "./integrations.module.css";

type CalendarSlot = "personal" | "business";
const CALENDAR_ACCOUNTS: { slot: CalendarSlot; email: string; label: string }[] = [
  { slot: "personal", email: "andrew.w.bostwick12@gmail.com", label: "Personal" },
  { slot: "business", email: "andrew@leademergence.com", label: "Lead Emergence" }
];

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  logos: BookOpenText,
  chatgpt: Bot,
  claude: BrainCircuit,
  gmail: Mail,
  slack: MessageSquare,
  google_calendar: CalendarDays,
  monday: KanbanSquare,
  github: Github,
  linkedin: Linkedin,
  google_drive: HardDrive,
  firecrawl: Flame,
  canva: Palette,
  powerpoint: FileSliders,
  youversion: BookHeart
};

const PROVIDER_BRAND_ASSETS: Record<string, string> = {
  logos: "/brand-icons/logos.ico",
  gmail: "/brand-icons/gmail.ico",
  slack: "/brand-icons/slack.ico",
  google_calendar: "/brand-icons/google-calendar.ico",
  monday: "/brand-icons/monday.ico",
  linkedin: "/brand-icons/linkedin.ico",
  google_drive: "/brand-icons/google-drive.ico",
  firecrawl: "/brand-icons/firecrawl.ico",
  canva: "/brand-icons/canva.ico",
  youversion: "/brand-icons/youversion.ico"
};

const PROVIDER_BRAND_COMPONENTS: Record<string, { Icon: IconType; color: string }> = {
  chatgpt: { Icon: BsOpenai, color: "#f0f3f7" },
  claude: { Icon: SiClaude, color: "#d97757" },
  github: { Icon: FaGithub, color: "#f0f3f7" },
  powerpoint: { Icon: FaFilePowerpoint, color: "#d35230" }
};

function ProviderBrandMark({ providerId }: { providerId: string }) {
  const asset = PROVIDER_BRAND_ASSETS[providerId];
  if (asset) {
    return <Image className={styles.brandImage} src={asset} alt="" width={24} height={24} unoptimized aria-hidden="true" />;
  }

  const brandComponent = PROVIDER_BRAND_COMPONENTS[providerId];
  if (brandComponent) {
    const BrandIcon = brandComponent.Icon;
    return <BrandIcon className={styles.brandVector} color={brandComponent.color} aria-hidden="true" />;
  }

  const FallbackIcon = PROVIDER_ICONS[providerId] ?? Bot;
  return <FallbackIcon size={20} aria-hidden="true" />;
}

const STATUS_META: Record<McpDisplayStatus, { label: string; action: string }> = {
  connected: { label: "Connected", action: "Connected" },
  reconnect_required: { label: "Reconnect required", action: "Review" },
  disconnected: { label: "Disconnected", action: "Review" },
  error: { label: "Action needed", action: "Review" },
  available: { label: "Not connected", action: "View setup" },
  catalog_only: { label: "Planned", action: "Details" }
};

function selectedMessage(entry: McpCatalogEntry, connection: IntegrationConnection | undefined, assistantConnection?: McpAuthorizationRecord): string {
  if (entry.id === "chatgpt" || entry.id === "claude") {
    if (assistantConnection?.status === "connected") return `Workspace has a saved ${entry.name} authorization. This does not confirm connection health in your ChatGPT account. You can manage this Workspace authorization in Settings.`;
    return `This setup manages ${entry.name} authorization to Workspace tools. It does not check or repair connections in your ChatGPT account.`;
  }
  if (connection?.status === "connected") {
    return `Workspace has saved ${entry.name} connection metadata; its encrypted credential is isolated in the private Workspace vault. This does not confirm connection health in your ChatGPT account.`;
  }
  if (connection) {
    return `${entry.name} already has Workspace metadata, but provider authorization still needs attention. ${entry.boundary}`;
  }
  if (!getIntegrationProvider(entry.id)?.consumerConnectionReady) {
    return `${entry.name} is catalogued for this Workspace, but it cannot collect credentials or access provider data until its provider-specific adapter is reviewed and released. ${entry.boundary}`;
  }
  if (entry.supportsWorkspaceMetadata) {
    return `${entry.name} is supported by the current metadata model. An approved provider authorization endpoint is still required before it can connect.`;
  }
  return `${entry.name} is catalogued for this Workspace, but its provider adapter has not been approved or provisioned yet. ${entry.boundary}`;
}

export default function IntegrationsPage() {
  const { user, workspace, capabilities } = useWorkspace();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [assistantConnections, setAssistantConnections] = useState<McpAuthorizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<McpCategoryFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [calendarStatus, setCalendarStatus] = useState<Record<CalendarSlot, boolean | null>>({ personal: null, business: null });
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarBusy, setCalendarBusy] = useState<CalendarSlot | null>(null);
  const popoverRootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspace) return;
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([listIntegrationConnections(workspace.id), listMcpAuthorizations(workspace.id)])
      .then(([records, assistants]) => {
        if (active) { setConnections(records); setAssistantConnections(assistants); }
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load connections.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace]);

  useEffect(() => {
    if (!workspace || !user || user.id !== workspace.owner_user_id) return;
    let active = true;
    const load = async () => {
      try {
        const { data } = await getWorkspaceClient().auth.getSession();
        if (!data.session?.access_token) throw new Error("Sign in to review Calendar accounts.");
        const statuses = await Promise.all(CALENDAR_ACCOUNTS.map(async ({ slot }) => {
          const response = await fetch(`/api/calendar/accounts/${slot}?workspaceId=${encodeURIComponent(workspace.id)}`, {
            headers: { Authorization: `Bearer ${data.session!.access_token}` }, cache: "no-store"
          });
          if (!response.ok) throw new Error("Calendar account status is unavailable.");
          const payload = await response.json() as { connected?: boolean };
          return [slot, payload.connected === true] as const;
        }));
        if (active) setCalendarStatus(Object.fromEntries(statuses) as Record<CalendarSlot, boolean>);
      } catch (caught) {
        if (active) setCalendarError(caught instanceof Error ? caught.message : "Calendar account status is unavailable.");
      }
    };
    void load();
    return () => { active = false; };
  }, [workspace, user]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!popoverRootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filteredCatalog = useMemo(() => filterMcpCatalog(MCP_CATALOG, query, category), [query, category]);
  const selectedEntry = useMemo(
    () => MCP_CATALOG.find((entry) => entry.id === selectedId),
    [selectedId]
  );
  const selectedConnection = selectedEntry ? findConnectionForEntry(selectedEntry, connections) : undefined;
  const selectedAssistantConnection = selectedEntry
    ? assistantConnections.find((item) => item.assistant_provider === selectedEntry.id && item.status === "connected")
      ?? assistantConnections.find((item) => item.assistant_provider === selectedEntry.id)
    : undefined;
  const selectedProvider = selectedEntry ? getIntegrationProvider(selectedEntry.id) : undefined;
  const externalConnectionsEnabled = capabilities.external_connectors && capabilities.integration_limit > 0;

  const closePopover = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const selectEntry = (entry: McpCatalogEntry) => {
    setSelectedId(entry.id);
    setConnectionError(null);
    setApiKey("");
  };

  const accessToken = async (): Promise<string> => {
    const { data, error: sessionError } = await getWorkspaceClient().auth.getSession();
    if (sessionError || !data.session?.access_token) throw new Error("Sign in before connecting an integration.");
    return data.session.access_token;
  };

  const changeCalendarAccount = async (slot: CalendarSlot, disconnect: boolean) => {
    if (!workspace || !user || user.id !== workspace.owner_user_id) return;
    setCalendarBusy(slot);
    setCalendarError(null);
    try {
      const token = await accessToken();
      const response = await fetch(`/api/calendar/accounts/${slot}`, {
        method: disconnect ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id })
      });
      const payload = await response.json().catch(() => ({})) as { authorizationUrl?: string; message?: string };
      if (!response.ok) throw new Error(payload.message || "Could not change Calendar account.");
      if (disconnect) {
        setCalendarStatus((current) => ({ ...current, [slot]: false }));
      } else if (payload.authorizationUrl) {
        window.location.assign(payload.authorizationUrl);
      } else {
        throw new Error("Google authorization did not open.");
      }
    } catch (caught) {
      setCalendarError(caught instanceof Error ? caught.message : "Could not change Calendar account.");
    } finally {
      setCalendarBusy(null);
    }
  };

  const startExternalConnection = async (entry: McpCatalogEntry) => {
    if (!workspace || !user) return setConnectionError("Sign in before connecting an integration.");
    setConnectingId(entry.id);
    setConnectionError(null);
    try {
      const token = await accessToken();
      const response = await fetch(`/api/integrations/${entry.id}/start`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: workspace.id }) });
      const payload = await response.json() as { authorizationUrl?: string; message?: string };
      if (!response.ok || !payload.authorizationUrl) throw new Error(payload.message || "Could not start this connection.");
      window.location.assign(payload.authorizationUrl);
    } catch (caught) {
      setConnectionError(caught instanceof Error ? caught.message : "Could not start this connection.");
      setConnectingId(null);
    }
  };

  const connectApiKey = async (event: React.FormEvent<HTMLFormElement>, entry: McpCatalogEntry) => {
    event.preventDefault();
    if (!workspace || !user) return setConnectionError("Sign in before connecting an integration.");
    setConnectingId(entry.id);
    setConnectionError(null);
    try {
      const token = await accessToken();
      const response = await fetch(`/api/integrations/${entry.id}/credential`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, workspaceId: workspace.id }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Could not connect this provider.");
      setConnections(await listIntegrationConnections(workspace.id));
      setApiKey("");
    } catch (caught) {
      setConnectionError(caught instanceof Error ? caught.message : "Could not connect this provider.");
    } finally {
      setConnectingId(null);
    }
  };

  const disconnectExternalConnection = async (entry: McpCatalogEntry) => {
    if (!workspace || !user) return setConnectionError("Sign in before changing an integration.");
    setConnectingId(entry.id);
    setConnectionError(null);
    try {
      const token = await accessToken();
      const response = await fetch(`/api/integrations/${entry.id}/disconnect`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: workspace.id }) });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Could not disconnect this provider from Workspace.");
      setConnections(await listIntegrationConnections(workspace.id));
    } catch (caught) {
      setConnectionError(caught instanceof Error ? caught.message : "Could not disconnect this provider from Workspace.");
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div className={styles.headingCopy}>
          <p className="eyebrow workflow-kicker">Operational / Integrations</p>
          <h1 className="page-title">Connections</h1>
          <p className="page-lede">
            Connection health in your ChatGPT account is not available here. In ChatGPT, open Settings and review the relevant app under Apps or Plugins, if available.
          </p>
        </div>

        <div className={styles.headerActions} ref={popoverRootRef}>
          <div className={styles.summary} role="status">
            <p className={styles.providerSetupNote}>Status unavailable in Workspace</p>
            <a href="https://chatgpt.com/">Check in ChatGPT</a>
          </div>
          <button
            ref={triggerRef}
            type="button"
            className={styles.addButton}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls="mcp-catalog-popover"
            onClick={() => setOpen((current) => !current)}
          >
            <Plus size={16} aria-hidden="true" />
            Workspace settings
          </button>

          {open ? (
            <div
              id="mcp-catalog-popover"
              className={styles.popover}
              role="dialog"
              aria-modal="false"
              aria-labelledby="mcp-catalog-title"
            >
              <div className={styles.popoverHeader}>
                <div>
                  <h2 id="mcp-catalog-title">Workspace connection settings</h2>
                  <p>These settings manage Workspace authorizations, not connection health in your ChatGPT account.</p>
                </div>
                <button type="button" className={styles.closeButton} aria-label="Close MCP catalog" onClick={closePopover}>
                  <X size={17} aria-hidden="true" />
                </button>
              </div>

              <label className="sr-only" htmlFor="mcp-catalog-search">
                Search connections
              </label>
              <div className={styles.searchWrap}>
                <Search size={16} aria-hidden="true" />
                <input
                  ref={searchRef}
                  id="mcp-catalog-search"
                  type="search"
                  value={query}
                  placeholder="Search connections"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>

              <div className={styles.categories} aria-label="Filter MCPs by category">
                {MCP_CATEGORIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={styles.categoryButton}
                    data-active={category === item}
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className={styles.catalogGrid} aria-live="polite">
                {filteredCatalog.length ? (
                  filteredCatalog.map((entry) => {
                    const status = displayStatus(entry, connections, assistantConnections);
                    const meta = STATUS_META[status];
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={styles.catalogItem}
                        data-selected={selectedId === entry.id}
                        aria-pressed={selectedId === entry.id}
                        onClick={() => selectEntry(entry)}
                      >
                        <span className={styles.providerIcon}>
                          <ProviderBrandMark providerId={entry.id} />
                        </span>
                        <span className={styles.catalogText}>
                          <strong>{entry.name}</strong>
                          <span>{entry.detail}</span>
                        </span>
                        <span className={styles.catalogAction} data-status={loading || error ? undefined : status}>
                          Workspace: {loading || error ? "Status unavailable" : meta.action}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className={styles.emptyCatalog}>No connections match this search.</p>
                )}
              </div>

              {selectedEntry ? (
                <div className={styles.selectionPanel} aria-live="polite">
                  <span className={styles.providerIcon}>
                    <ProviderBrandMark providerId={selectedEntry.id} />
                  </span>
                  <div>
                    <strong>{selectedEntry.name} Workspace setup</strong>
                    <p>{loading || error ? "Workspace authorization status is unavailable. Review the relevant app in ChatGPT to check your ChatGPT-account connection." : selectedMessage(selectedEntry, selectedConnection, selectedAssistantConnection)}</p>
                    {selectedEntry.id === "chatgpt" || selectedEntry.id === "claude" ? (
                      <Link className={styles.connectButton} href={`/workspace/integrations/assistant?provider=${selectedEntry.id}`}>Manage Workspace authorization</Link>
                    ) : selectedConnection && selectedConnection.status !== "disconnected" && getIntegrationProvider(selectedEntry.id)?.supportsDisconnect ? (
                      <div>
                        <button type="button" className={styles.connectButton} disabled={connectingId === selectedEntry.id} onClick={() => void disconnectExternalConnection(selectedEntry)}>
                          {connectingId === selectedEntry.id ? "Disconnecting…" : "Disconnect from Workspace"}
                        </button>
                        <p className={styles.providerSetupNote}>This removes the encrypted Workspace credential. Revoke the provider-side grant there as well if you no longer want it active.</p>
                      </div>
                    ) : !selectedProvider?.consumerConnectionReady ? (
                      <p className={styles.providerSetupNote}>This connector is planned, not active. Workspace will not collect a credential or access provider data until its provider-specific action contract and release checks are complete.</p>
                    ) : !externalConnectionsEnabled ? (
                      <p className={styles.providerSetupNote}>External connections are not included for this Workspace right now. They remain unavailable until the plan explicitly enables them and includes connection capacity.</p>
                    ) : selectedProvider.connectionMethod === "oauth" || selectedProvider.connectionMethod === "github_app" ? (
                      <button type="button" className={styles.connectButton} disabled={connectingId === selectedEntry.id} onClick={() => void startExternalConnection(selectedEntry)}>
                        {connectingId === selectedEntry.id ? "Opening secure connection…" : getMcpSetupLabel(selectedEntry)}
                      </button>
                    ) : selectedProvider.connectionMethod === "api_key" ? (
                      <form className={styles.apiKeyForm} onSubmit={(event) => void connectApiKey(event, selectedEntry)}>
                        <label className="sr-only" htmlFor={`api-key-${selectedEntry.id}`}>API key for {selectedEntry.name}</label>
                        <input id={`api-key-${selectedEntry.id}`} type="password" autoComplete="off" required value={apiKey} placeholder="Paste API key once" onChange={(event) => setApiKey(event.target.value)} />
                        <button type="submit" className={styles.connectButton} disabled={connectingId === selectedEntry.id}>{connectingId === selectedEntry.id ? "Saving securely…" : getMcpSetupLabel(selectedEntry)}</button>
                      </form>
                    ) : <p className={styles.providerSetupNote}>{selectedEntry.name} uses a registered provider adapter. Its secure connection flow will open as soon as the provider registration is added.</p>}
                  </div>
                </div>
              ) : null}

              {connectionError ? <p className={styles.connectionError} role="alert">{connectionError}</p> : null}

              <p className={styles.boundaryNote}>
                Connections use an encrypted private Workspace vault. OAuth tokens, API keys, connector secrets, and ministry credentials are never stored in the Workspace data API.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {error ? <p className="error" role="alert">Workspace settings could not be loaded. ChatGPT-account connection status remains unavailable here.</p> : null}

      <section id="assistants" className="assistant-connection-feature" aria-label="Workspace assistant authorizations">
        <div><p className="eyebrow">Workspace settings</p><h2>Workspace assistant authorizations</h2><p>These records authorize access to Workspace tools. They do not establish connection health in your ChatGPT account.</p></div>
        <div>{(["chatgpt", "claude"] as const).map((provider) => {
          const record = assistantConnections.find((item) => item.assistant_provider === provider && item.status === "connected");
          return <article key={provider}><ProviderBrandMark providerId={provider} /><div><strong>{provider === "chatgpt" ? "ChatGPT" : "Claude"}</strong><span>{loading || error ? "Workspace authorization status unavailable" : record ? "Workspace authorization saved" : "No active Workspace authorization recorded"}</span></div><Link className="button secondary" href={`/workspace/integrations/assistant?provider=${provider}`}>Workspace settings</Link></article>;
        })}</div>
      </section>

      {workspace && user?.id === workspace.owner_user_id ? (
        <section className={styles.calendarAccounts} aria-label="Workspace Calendar accounts">
          <div>
            <p className="eyebrow">Workspace owner settings</p>
            <h2>Workspace Calendar accounts</h2>
            <p>Connect both accounts so scheduling can check each calendar. You choose which account organizes each meeting type.</p>
          </div>
          <div className={styles.calendarAccountGrid}>
            {CALENDAR_ACCOUNTS.map(({ slot, email, label }) => (
              <div className={styles.calendarAccount} key={slot}>
                <div><strong>{label}</strong><span>{email}</span></div>
                <span>{calendarStatus[slot] === null ? "Status unavailable" : calendarStatus[slot] ? "Saved" : "Not connected"}</span>
                <button type="button" disabled={calendarBusy !== null || calendarStatus[slot] === null}
                  onClick={() => void changeCalendarAccount(slot, calendarStatus[slot] === true)}>
                  {calendarBusy === slot ? "Working…" : calendarStatus[slot] ? "Disconnect" : "Connect"}
                </button>
              </div>
            ))}
          </div>
          {calendarError ? <p className={styles.connectionError} role="alert">{calendarError}</p> : null}
          <p className={styles.providerSetupNote}>Saved means Workspace has a credential; it does not confirm current Google access. Disconnecting removes the Workspace copy. You can also revoke access in Google.</p>
        </section>
      ) : null}

      <section className={styles.connectionsGrid} aria-label="ChatGPT-account connection status">
        {MCP_CATALOG.map((entry) => {
          return (
            <article className={styles.connectionCard} key={entry.id}>
              <div className={styles.cardHeader}>
                <div className={styles.providerTitle}>
                  <span className={styles.providerIcon}>
                    <ProviderBrandMark providerId={entry.id} />
                  </span>
                  <div>
                    <h2>{entry.name}</h2>
                    <p>{entry.category}</p>
                  </div>
                </div>
                <span className={styles.statusBadge}>
                  Status unavailable
                </span>
              </div>
              <p className={styles.cardDetail}>Review the relevant app in ChatGPT Settings under Apps or Plugins, if available.</p>
              <footer className={styles.cardFooter}>
                <span>Review in ChatGPT</span>
              </footer>
              <a className={styles.cardConnectButton} href="https://chatgpt.com/">Check in ChatGPT</a>
              <button type="button" className={styles.cardConnectButton} onClick={() => { setOpen(true); selectEntry(entry); }}>
                Workspace settings
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function displayStatus(entry: McpCatalogEntry, connections: IntegrationConnection[], assistants: McpAuthorizationRecord[]): McpDisplayStatus {
  if (entry.id === "chatgpt" || entry.id === "claude") {
    const record = assistants.find((item) => item.assistant_provider === entry.id && item.status === "connected")
      ?? assistants.find((item) => item.assistant_provider === entry.id);
    if (!record) return "available";
    if (record.status === "connected") return "connected";
    if (record.status === "error") return "error";
    if (record.status === "reconnect_required" || record.status === "connecting") return "reconnect_required";
    return "disconnected";
  }
  return getMcpDisplayStatus(entry, connections);
}
