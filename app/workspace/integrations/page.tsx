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
  getMcpDisplayStatus,
  type McpCatalogEntry,
  type McpCategoryFilter,
  type McpDisplayStatus
} from "@/lib/workspace/mcp-catalog";
import { listIntegrationConnections } from "@/lib/workspace/repository";
import type { IntegrationConnection } from "@/lib/workspace/types";
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
  available: { label: "Not connected", action: "View setup" }
};

function formatLastSuccess(value: string | null): string {
  if (!value) return "No sync yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "Sync recorded";
  return `Last sync ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed)}`;
}

function selectedMessage(entry: McpCatalogEntry, connection: IntegrationConnection | undefined): string {
  if (connection?.status === "connected") {
    return `${entry.name} is connected. Connection metadata is visible here; provider credentials remain outside the Workspace.`;
  }
  if (connection) {
    return `${entry.name} already has Workspace metadata, but provider authorization still needs attention. ${entry.boundary}`;
  }
  if (entry.supportsWorkspaceMetadata) {
    return `${entry.name} is supported by the current metadata model. An approved provider authorization endpoint is still required before it can connect.`;
  }
  return `${entry.name} is catalogued for this Workspace, but its provider adapter has not been approved or provisioned yet. ${entry.boundary}`;
}

export default function IntegrationsPage() {
  const { workspace } = useWorkspace();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<McpCategoryFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const popoverRootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspace) return;
    let active = true;
    setLoading(true);
    setError(null);
    void listIntegrationConnections(workspace.id)
      .then((records) => {
        if (active) setConnections(records);
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
  const activeCount = connections.filter((connection) => connection.status === "connected").length;
  const attentionCount = connections.filter(
    (connection) => connection.status === "reconnect_required" || connection.status === "error"
  ).length;

  const closePopover = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div className={styles.headingCopy}>
          <p className="eyebrow workflow-kicker">Operational / Integrations</p>
          <h1 className="page-title">Connections</h1>
          <p className="page-lede">
            Every MCP the Workspace can use or prepare. Personal Workspace access stays isolated from ministry and external systems.
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
            Add new MCP
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
                  <h2 id="mcp-catalog-title">Add an MCP</h2>
                  <p>Choose a connection for this Workspace.</p>
                </div>
                <button type="button" className={styles.closeButton} aria-label="Close MCP catalog" onClick={closePopover}>
                  <X size={17} aria-hidden="true" />
                </button>
              </div>

              <label className="sr-only" htmlFor="mcp-catalog-search">
                Search MCPs
              </label>
              <div className={styles.searchWrap}>
                <Search size={16} aria-hidden="true" />
                <input
                  ref={searchRef}
                  id="mcp-catalog-search"
                  type="search"
                  value={query}
                  placeholder="Search MCPs"
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
                    const status = getMcpDisplayStatus(entry, connections);
                    const meta = STATUS_META[status];
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={styles.catalogItem}
                        data-selected={selectedId === entry.id}
                        aria-pressed={selectedId === entry.id}
                        onClick={() => setSelectedId(entry.id)}
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
                  <p className={styles.emptyCatalog}>No MCPs match this search.</p>
                )}
              </div>

              {selectedEntry ? (
                <div className={styles.selectionPanel} aria-live="polite">
                  <span className={styles.providerIcon}>
                    <ProviderBrandMark providerId={selectedEntry.id} />
                  </span>
                  <div>
                    <strong>{selectedEntry.name} setup</strong>
                    <p>{selectedMessage(selectedEntry, selectedConnection)}</p>
                  </div>
                </div>
              ) : null}

              <p className={styles.boundaryNote}>
                Connection metadata may be shown here. OAuth tokens, MCP secrets, and ministry credentials are never stored in the Workspace application.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {error ? <p className="error" role="alert">{error}</p> : null}

      <section className={styles.connectionsGrid} aria-label="Workspace connections">
        {MCP_CATALOG.map((entry) => {
          const connection = findConnectionForEntry(entry, connections);
          const status = getMcpDisplayStatus(entry, connections);
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
                <span>{connection ? "Workspace metadata" : "Catalog only"}</span>
                <span>
                  <RefreshCw size={11} aria-hidden="true" />
                  {formatLastSuccess(connection?.last_success_at ?? null)}
                </span>
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}
