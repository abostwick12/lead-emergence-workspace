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
  RefreshCw,
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

function formatLastSuccess(value: string | null): string {
  if (!value) return "No sync yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "Sync recorded";
  return `Last sync ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed)}`;
}

function selectedMessage(entry: McpCatalogEntry, connection: IntegrationConnection | undefined, assistantConnection?: McpAuthorizationRecord): string {
  if (entry.id === "chatgpt" || entry.id === "claude") {
    if (assistantConnection?.status === "connected") return `${entry.name} is connected through Workspace OAuth and controlled tool authorization. You can disconnect it from Settings.`;
    return `${entry.name} can connect to the Workspace-native assistant interface with explicit OAuth consent. Workspace remains the system of record.`;
  }
  if (connection?.status === "connected") {
    return `${entry.name} is connected. Connection metadata is visible here; its encrypted credential is isolated in the private Workspace vault.`;
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
  const selectedProvider = selectedEntry ? getIntegrationProvider(selectedEntry.id) : undefined;
  const externalConnectionsEnabled = capabilities.external_connectors && capabilities.integration_limit > 0;
  const activeCount = connections.filter((connection) => connection.status === "connected").length + assistantConnections.filter((connection) => connection.status === "connected").length;
  const attentionCount = connections.filter(
    (connection) => connection.status === "reconnect_required" || connection.status === "error"
  ).length;

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
            Choose the assistant interfaces and external systems that serve your leadership work. Nothing is connected automatically.
          </p>
        </div>

        <div className={styles.headerActions} ref={popoverRootRef}>
          <div className={styles.summary} aria-label={`${activeCount} of ${MCP_CATALOG.length} connections active`}>
            <strong>
              {String(activeCount).padStart(2, "0")}
              <span>/{MCP_CATALOG.length}</span>
            </strong>
            <small>{loading ? "Loading states" : `${attentionCount} need review`}</small>
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
            Browse connections
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
                  <h2 id="mcp-catalog-title">Add a connection</h2>
                  <p>Choose an explicit, Workspace-scoped connection.</p>
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
                        <span className={styles.catalogAction} data-status={status}>
                          {meta.action}
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
                    <strong>{selectedEntry.name} setup</strong>
                    <p>{selectedMessage(selectedEntry, selectedConnection, assistantConnections.find((item) => item.assistant_provider === selectedEntry.id))}</p>
                    {selectedEntry.id === "chatgpt" || selectedEntry.id === "claude" ? (
                      <Link className={styles.connectButton} href={`/workspace/integrations/assistant?provider=${selectedEntry.id}`}>Connect assistant</Link>
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

      {error ? <p className="error" role="alert">{error}</p> : null}

      <section id="assistants" className="assistant-connection-feature" aria-label="AI assistant connections">
        <div><p className="eyebrow">Recommended interface</p><h2>Connect your AI assistant</h2><p>ChatGPT and Claude use the same controlled Workspace tools. Connect either one, both, or neither.</p></div>
        <div>{(["chatgpt", "claude"] as const).map((provider) => { const record = assistantConnections.find((item) => item.assistant_provider === provider && item.status === "connected"); return <article key={provider}><ProviderBrandMark providerId={provider} /><div><strong>{provider === "chatgpt" ? "ChatGPT" : "Claude"}</strong><span>{record ? "Connected" : "Not connected"}</span></div><Link className="button secondary" href={`/workspace/integrations/assistant?provider=${provider}`}>{record ? "Review" : "Connect"}</Link></article>; })}</div>
      </section>

      <section className={styles.connectionsGrid} aria-label="Workspace connections">
        {MCP_CATALOG.map((entry) => {
          const connection = findConnectionForEntry(entry, connections);
          const provider = getIntegrationProvider(entry.id);
          const status = displayStatus(entry, connections, assistantConnections);
          const meta = STATUS_META[status];
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
                <span className={styles.statusBadge} data-status={status}>
                  {meta.label}
                </span>
              </div>
              <p className={styles.cardDetail}>{entry.detail}</p>
              <footer className={styles.cardFooter}>
                <span>{entry.id === "chatgpt" || entry.id === "claude" ? "Workspace OAuth" : connection ? "Workspace metadata" : provider?.consumerConnectionReady ? "Connection setup" : "Planned connector"}</span>
                <span>
                  <RefreshCw size={11} aria-hidden="true" />
                  {formatLastSuccess(connection?.last_success_at ?? null)}
                </span>
              </footer>
              <button type="button" className={styles.cardConnectButton} onClick={() => { setOpen(true); selectEntry(entry); }}>
                {status === "connected" ? "Manage connection" : getMcpSetupLabel(entry)}
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
    const record = assistants.find((item) => item.assistant_provider === entry.id);
    if (!record) return "available";
    if (record.status === "connected") return "connected";
    if (record.status === "error") return "error";
    if (record.status === "reconnect_required" || record.status === "connecting") return "reconnect_required";
    return "disconnected";
  }
  return getMcpDisplayStatus(entry, connections);
}
