import { z } from "zod";

const bundleKeySchema = z.string().regex(/^[a-z][a-z0-9_]{1,49}$/);
const contributionIdSchema = z.string().regex(/^[a-z][a-z0-9._-]{2,99}$/);
const routeSchema = z.string().regex(/^\/workspace(?:\/[a-z0-9][a-z0-9/_-]*)?$/);

const rankedItem = {
  id: contributionIdSchema,
  label: z.string().trim().min(1).max(80),
  order: z.number().int().min(0).max(10_000)
};

export const navigationItemSchema = z.object({
  ...rankedItem,
  route: routeSchema,
  icon: z.string().trim().min(1).max(80).optional()
}).strict();

export const dashboardWidgetSchema = z.object({
  ...rankedItem,
  type: z.string().regex(/^[a-z][a-z0-9._-]{2,99}$/),
  capabilityId: contributionIdSchema,
  attentionTypes: z.array(contributionIdSchema).default([]),
  emptyStateId: contributionIdSchema.optional()
}).strict();

export const actionSchema = z.object({
  ...rankedItem,
  workflowId: contributionIdSchema,
  capabilityId: contributionIdSchema
}).strict();

export const searchProviderSchema = z.object({
  ...rankedItem,
  capabilityId: contributionIdSchema,
  resultTypes: z.array(contributionIdSchema).min(1)
}).strict();

export const notificationTypeSchema = z.object({
  ...rankedItem,
  capabilityId: contributionIdSchema,
  defaultEnabled: z.boolean()
}).strict();

export const emptyStateSchema = z.object({
  id: contributionIdSchema,
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  actionId: contributionIdSchema.optional()
}).strict();

export const bundleSettingSchema = z.object({
  ...rankedItem,
  type: z.enum(["boolean", "select", "text"]),
  required: z.boolean().default(false),
  options: z.array(z.object({
    value: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(100)
  }).strict()).optional()
}).strict().superRefine((value, context) => {
  if (value.type === "select" && (!value.options || value.options.length === 0)) {
    context.addIssue({ code: "custom", message: "Select settings require options" });
  }
});

export const uiManifestSchema = z.object({
  schemaVersion: z.literal("1.0"),
  bundleKey: bundleKeySchema,
  workspaceRoute: z.object({
    route: routeSchema,
    label: z.string().trim().min(1).max(80)
  }).strict().optional(),
  primaryNavigation: z.array(navigationItemSchema),
  secondaryNavigation: z.array(navigationItemSchema),
  dashboardWidgets: z.array(dashboardWidgetSchema),
  quickActions: z.array(actionSchema),
  searchProviders: z.array(searchProviderSchema),
  commandPaletteActions: z.array(actionSchema),
  notificationTypes: z.array(notificationTypeSchema),
  emptyStates: z.array(emptyStateSchema),
  bundleSettings: z.array(bundleSettingSchema)
}).strict();

export type UiManifest = z.infer<typeof uiManifestSchema>;
export type UiPreferences = {
  hiddenItemIds?: string[];
  pinnedWidgetIds?: string[];
  orderOverrides?: Record<string, number>;
  defaultWorkspaceRoute?: string;
};

type Sourced<T> = T & { sourceBundleKey: string };

export type ComposedUiManifest = {
  primaryNavigation: Array<Sourced<z.infer<typeof navigationItemSchema>>>;
  secondaryNavigation: Array<Sourced<z.infer<typeof navigationItemSchema>>>;
  dashboardWidgets: Array<Sourced<z.infer<typeof dashboardWidgetSchema>>>;
  quickActions: Array<Sourced<z.infer<typeof actionSchema>>>;
  searchProviders: Array<Sourced<z.infer<typeof searchProviderSchema>>>;
  commandPaletteActions: Array<Sourced<z.infer<typeof actionSchema>>>;
  notificationTypes: Array<Sourced<z.infer<typeof notificationTypeSchema>>>;
  emptyStates: Array<Sourced<z.infer<typeof emptyStateSchema>>>;
  bundleSettings: Array<Sourced<z.infer<typeof bundleSettingSchema>>>;
  defaultWorkspaceRoute?: string;
};

export class UiCompositionError extends Error {
  readonly code = "UI_COMPOSITION_ERROR";
}

function composeItems<T extends { id: string; order?: number }>(
  kind: string,
  manifests: UiManifest[],
  select: (manifest: UiManifest) => T[],
  preferences: UiPreferences
): Array<Sourced<T>> {
  const hidden = new Set(preferences.hiddenItemIds ?? []);
  const seen = new Set<string>();
  const items = manifests.flatMap((manifest) => select(manifest).map((item) => {
    const identity = `${manifest.bundleKey}:${item.id}`;
    const collisionKey = `${kind}:${item.id}`;
    if (seen.has(collisionKey)) throw new UiCompositionError(`Duplicate ${kind} contribution: ${item.id}`);
    seen.add(collisionKey);
    return { ...item, sourceBundleKey: manifest.bundleKey, identity };
  })).filter((item) => !hidden.has(item.identity));

  return items.sort((left, right) => {
    const leftPinned = kind === "dashboardWidgets" && (preferences.pinnedWidgetIds ?? []).includes(left.identity);
    const rightPinned = kind === "dashboardWidgets" && (preferences.pinnedWidgetIds ?? []).includes(right.identity);
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
    const leftOrder = preferences.orderOverrides?.[left.identity] ?? left.order ?? 0;
    const rightOrder = preferences.orderOverrides?.[right.identity] ?? right.order ?? 0;
    return leftOrder - rightOrder
      || left.sourceBundleKey.localeCompare(right.sourceBundleKey)
      || left.id.localeCompare(right.id);
  }).map(({ identity: _identity, ...item }) => item as Sourced<T>);
}

export function composeUiManifests(
  inputs: UiManifest[],
  preferences: UiPreferences = {}
): ComposedUiManifest {
  const manifests = inputs.map((input) => uiManifestSchema.parse(input))
    .sort((left, right) => left.bundleKey.localeCompare(right.bundleKey));
  const primaryNavigation = composeItems("primaryNavigation", manifests, (item) => item.primaryNavigation, preferences);
  const defaultWorkspaceRoute = preferences.defaultWorkspaceRoute
    ?? primaryNavigation[0]?.route
    ?? manifests.find((item) => item.workspaceRoute)?.workspaceRoute?.route;
  if (defaultWorkspaceRoute && !routeSchema.safeParse(defaultWorkspaceRoute).success) {
    throw new UiCompositionError("Default workspace route is invalid.");
  }
  return {
    primaryNavigation,
    secondaryNavigation: composeItems("secondaryNavigation", manifests, (item) => item.secondaryNavigation, preferences),
    dashboardWidgets: composeItems("dashboardWidgets", manifests, (item) => item.dashboardWidgets, preferences),
    quickActions: composeItems("quickActions", manifests, (item) => item.quickActions, preferences),
    searchProviders: composeItems("searchProviders", manifests, (item) => item.searchProviders, preferences),
    commandPaletteActions: composeItems("commandPaletteActions", manifests, (item) => item.commandPaletteActions, preferences),
    notificationTypes: composeItems("notificationTypes", manifests, (item) => item.notificationTypes, preferences),
    emptyStates: composeItems("emptyStates", manifests, (item) => item.emptyStates, preferences),
    bundleSettings: composeItems("bundleSettings", manifests, (item) => item.bundleSettings, preferences),
    defaultWorkspaceRoute
  };
}
