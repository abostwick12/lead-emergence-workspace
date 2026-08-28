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

export type McpDisplayStatus = IntegrationConnection["status"] | "available" | "catalog_only";

export const MCP_CATALOG: readonly McpCatalogEntry[] = [
  {
    id: "logos",
    name: "Logos",
    category: "Faith",
    detail: "Planned study-library connection",
    boundary: "No Workspace authorization or content access is available until the Logos adapter is reviewed and released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "AI",
    detail: "Conversational Workspace interface for reasoning and drafting",
    boundary: "Explicit Workspace OAuth consent and the AI assistant capability are required.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "claude",
    name: "Claude",
    category: "AI",
    detail: "Conversational interface to your Personal Workspace",
    boundary: "Explicit Workspace OAuth consent and the AI assistant capability are required.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "Comms",
    detail: "Planned personal inbox connection",
    boundary: "No mailbox access, draft, or send action is available until a narrowly scoped Gmail adapter is reviewed and released. Ministry Gmail is excluded.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "slack",
    name: "Slack",
    category: "Comms",
    detail: "Planned workspace connection",
    boundary: "No channel access or message action is available until a separately reviewed Slack adapter is released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "Work",
    detail: "Planned calendar connection",
    boundary: "No calendar event is read, created, changed, or deleted until a separately reviewed calendar adapter is released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "monday",
    name: "Monday.com",
    category: "Work",
    detail: "Planned task-context connection",
    boundary: "No Monday.com data is imported or changed until a separately reviewed adapter is released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "github",
    name: "GitHub",
    category: "Work",
    detail: "Planned repository connection",
    boundary: "No repository access is available until a separately reviewed GitHub adapter is released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "Work",
    detail: "Planned career-context connection",
    boundary: "No LinkedIn access or posting action is available until a separately reviewed adapter is released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "google_drive",
    name: "Google Drive",
    category: "Files",
    detail: "Planned personal-file connection",
    boundary: "No Drive file is read, created, organized, or shared until a separately reviewed adapter is released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    category: "Files",
    detail: "Planned curated-resource connection",
    boundary: "No API key is collected and no fetch is performed until a separately reviewed adapter is released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "canva",
    name: "Canva",
    category: "Creative",
    detail: "Planned design connection",
    boundary: "No Canva design is accessed or exported until a separately reviewed adapter is released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "powerpoint",
    name: "PowerPoint",
    category: "Creative",
    detail: "Planned Microsoft 365 connection",
    boundary: "No file is read, created, or exported until a separately reviewed Microsoft 365 adapter is released.",
    supportsWorkspaceMetadata: true
  },
  {
    id: "youversion",
    name: "YouVersion",
    category: "Faith",
    detail: "Planned Scripture connection",
    boundary: "No YouVersion access is available until a separately reviewed adapter is released.",
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
  const connection = findConnectionForEntry(entry, connections);
  if (connection) return connection.status;
  return getIntegrationProvider(entry.id)?.consumerConnectionReady ? "available" : "catalog_only";
}

export function getMcpSetupLabel(entry: McpCatalogEntry): string {
  return getIntegrationProvider(entry.id)?.setupLabel ?? "Connect";
}
