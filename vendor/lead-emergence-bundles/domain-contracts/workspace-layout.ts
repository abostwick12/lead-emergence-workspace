import { z } from "zod";
import type { ComposedUiManifest } from "../ui-manifest/index";

export const layoutIdentity = z.string().regex(/^[a-z][a-z0-9_]{1,49}:[a-z][a-z0-9._-]{2,99}$/);
const uniqueIds = (max: number) => z.array(layoutIdentity).max(max).refine(ids => new Set(ids).size === ids.length, "Use each item once.");
export const workspaceLayoutBase = z.object({
  schemaVersion: z.literal("1.0"),
  hiddenItemIds: z.array(layoutIdentity).max(200),
  pinnedNavigationIds: z.array(layoutIdentity).max(100),
  pinnedWidgetIds: z.array(layoutIdentity).max(100),
  orderOverrides: z.record(layoutIdentity, z.number().int().min(0).max(10000)),
  defaultWorkspaceRoute: z.string().max(200).regex(/^\/workspace(?:\/[a-z0-9][a-z0-9/_-]*)?$/)
}).strict();
export const workspaceLayoutSchema = workspaceLayoutBase.extend({
  hiddenItemIds: uniqueIds(200), pinnedNavigationIds: uniqueIds(100), pinnedWidgetIds: uniqueIds(100)
}).superRefine((value, context) => {
  if (Object.keys(value.orderOverrides).length > 200) context.addIssue({code:"custom",path:["orderOverrides"],message:"Use up to 200 order choices."});
  const hidden = new Set(value.hiddenItemIds);
  if ([...value.pinnedNavigationIds, ...value.pinnedWidgetIds].some(id => hidden.has(id))) {
    context.addIssue({code:"custom",message:"An item cannot be both pinned and hidden."});
  }
});
export type WorkspaceLayout = z.infer<typeof workspaceLayoutSchema>;
export function emptyWorkspaceLayout(): WorkspaceLayout {
  return {schemaVersion:"1.0",hiddenItemIds:[],pinnedNavigationIds:[],pinnedWidgetIds:[],orderOverrides:{},defaultWorkspaceRoute:"/workspace"};
}
export const layoutIdentityFor = (item: {sourceBundleKey:string;id:string}) => item.sourceBundleKey + ":" + item.id;

export function workspaceLayoutCatalog(ui: ComposedUiManifest) {
  const navigation = ui.primaryNavigation.filter(item => item.route !== "/workspace");
  return {
    navigation, widgets: ui.dashboardWidgets,
    defaultWorkspaces: [{route:"/workspace",label:"Home"}, ...navigation.filter((item,index,items) => items.findIndex(other=>other.route===item.route)===index).map(({route,label})=>({route,label}))]
  };
}

/** Presentation only. The host MUST supply capability-filtered contributions. */
export function applyWorkspaceLayout(ui: ComposedUiManifest, raw: WorkspaceLayout): ComposedUiManifest {
  const preferences = workspaceLayoutSchema.parse(raw), hidden = new Set(preferences.hiddenItemIds);
  function arrange<T extends {id:string;sourceBundleKey:string}>(items:T[], pinned:string[]) {
    const pins = new Set(pinned);
    return items.map((item,index)=>({item,index,key:layoutIdentityFor(item)}))
      .filter(({item,key}) => ("route" in item && item.route === "/workspace") || !hidden.has(key))
      .sort((a,b)=>Number(pins.has(b.key))-Number(pins.has(a.key))
        || (preferences.orderOverrides[a.key]??a.index*10)-(preferences.orderOverrides[b.key]??b.index*10)
        || a.index-b.index)
      .map(({item})=>item);
  }
  const catalog=workspaceLayoutCatalog(ui);
  return {
    ...ui,
    primaryNavigation:arrange(ui.primaryNavigation,preferences.pinnedNavigationIds),
    dashboardWidgets:arrange(ui.dashboardWidgets,preferences.pinnedWidgetIds),
    defaultWorkspaceRoute:catalog.defaultWorkspaces.some(item=>item.route===preferences.defaultWorkspaceRoute)
      ? preferences.defaultWorkspaceRoute : "/workspace"
  };
}

/** Count dormant choices without exposing names or routes from unavailable bundles. */
export function inactiveLayoutChoices(ui: ComposedUiManifest, preferences: WorkspaceLayout): number {
  const catalog=workspaceLayoutCatalog(ui), active=new Set([...catalog.navigation,...catalog.widgets].map(layoutIdentityFor));
  return new Set([...preferences.hiddenItemIds,...preferences.pinnedNavigationIds,...preferences.pinnedWidgetIds,...Object.keys(preferences.orderOverrides)].filter(id=>!active.has(id))).size;
}
