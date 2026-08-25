import type { IntegrationConnection } from "@/lib/workspace/types";
import { getIntegrationProvider, type IntegrationProviderId } from "@/lib/integrations/providers";

export const MCP_CATEGORIES = ["All", "AI", "Comms", "Work", "Files", "Creative", "Faith"] as const;

export type McpCategory = Exclude<(typeof MCP_CATEGORIES)[number], "All">;
export type McpCategoryFilter = (typeof MCP_CATEGORIES)[number];

export type McpCatalogEntry = {
  id: IntegrationProviderId;
  name: string;
  category: McpCategory;
  detail: string;
  boundary: string;
  supportsWorkspaceMetadata: boolean;
};

export type McpDisplayStatus = IntegrationConnection["status"] | "available";

export const MCP_CATALOG: readonly McpCatalogEntry[] = [
  {
    id: "logos",
    name: "Logos",
    category: "Faith",
    detail: "Study library and commentary lookup",
    boundary: "Read-only study access through a separately approved Logos adapter.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "AI",
    detail: "Reasoning and drafting model access",
    boundary: "A separate AI capability gate is required before model access is enabled.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "claude",
    name: "Claude",
    category: "AI",
    detail: "Long-context synthesis and review",
    boundary: "A separate AI capability gate is required before model access is enabled.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "Comms",
    detail: "Personal inbox triage and draft-only workflows",
    boundary: "Personal Workspace Gmail only. Ministry Gmail is excluded.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "slack",
    name: "Slack",
    category: "Comms",
    detail: "Explicit briefing delivery to approved channels",
    boundary: "Only explicitly approved workspaces and channels may be used.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "Work",
    detail: "Schedule context and user-triggered event actions",
    boundary: "Calendar actions remain user-triggered and Workspace-scoped.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "monday",
    name: "Monday.com",
    category: "Work",
    detail: "Approved one-way task import",
    boundary: "Import only; no automatic writes back to Monday.com.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "github",
    name: "GitHub",
    category: "Work",
    detail: "Repository context and workflow visibility",
    boundary: "Repository access requires a separately approved read scope.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "Work",
    detail: "Career drafting support",
    boundary: "Drafting only. The Workspace never posts automatically.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "google_drive",
    name: "Google Drive",
    category: "Files",
    detail: "Search and organize permitted personal files",
    boundary: "Only explicitly permitted Workspace files may be accessed.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    category: "Files",
    detail: "Manual curated resource refresh",
    boundary: "Refreshes are user-triggered and produce Workspace-owned sources only.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "canva",
    name: "Canva",
    category: "Creative",
    detail: "Design discovery and approved exports",
    boundary: "Design access requires a separately approved Canva adapter.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "powerpoint",
    name: "PowerPoint",
    category: "Creative",
    detail: "Deck generation and outline export",
    boundary: "File creation requires an approved Microsoft 365 adapter.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "youversion",
    name: "YouVersion",
    category: "Faith",
    detail: "Reading plans and Scripture references",
    boundary: "Read-only access requires a separately approved YouVersion adapter.",
    supportsWorkspaceMetadata: true
  }
] as const;

export function filterMcpCatalog(
  entries: readonly McpCatalogEntry[],
  query: string,
  category: McpCategoryFilter
): McpCatalogEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return entries.filter((entry) => {
    const matchesCategory = category === "All" || entry.category === category;
    const searchable = `${entry.name} ${entry.detail} ${entry.category}`.toLocaleLowerCase();
    const matchesQuery = normalizedQuery.length === 0 || searchable.includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });
}

export function findConnectionForEntry(
  entry: McpCatalogEntry,
  connections: readonly IntegrationConnection[]
): IntegrationConnection | undefined {
  return connections.find((connection) => connection.provider === entry.id);
}

export function getMcpDisplayStatus(
  entry: McpCatalogEntry,
  connections: readonly IntegrationConnection[]
): McpDisplayStatus {
  return findConnectionForEntry(entry, connections)?.status ?? "available";
}

export function getMcpSetupLabel(entry: McpCatalogEntry): string {
  return getIntegrationProvider(entry.id)?.setupLabel ?? "Connect";
}
