import { z } from "zod";
import { layoutIdentity, workspaceLayoutSchema, type WorkspaceLayout } from "./workspace-layout";

export const layoutProposalBasis = z.enum([
  "user_stated_priority",
  "current_layout",
  "enabled_capability",
  "assistant_inference"
]);
const rationale = {
  reason: z.string().trim().min(10).max(400),
  basis: z.array(layoutProposalBasis).min(1).max(4)
    .refine(value => new Set(value).size === value.length, "Use each basis once.")
    .refine(value => value.some(item => item !== "assistant_inference"), "Ground every change in user, layout, or capability evidence.")
};
const itemOperation = z.object({
  itemId: layoutIdentity,
  ...rationale
});
export const layoutProposalOperation = z.discriminatedUnion("kind", [
  itemOperation.extend({ kind: z.literal("set_visibility"), visible: z.boolean() }).strict(),
  itemOperation.extend({ kind: z.literal("set_pin"), pinned: z.boolean() }).strict(),
  itemOperation.extend({ kind: z.literal("set_order"), order: z.number().int().min(0).max(10_000) }).strict(),
  z.object({ kind: z.literal("set_default_workspace"), route: z.string().max(200).regex(/^\/workspace(?:\/[a-z0-9][a-z0-9/_-]*)?$/), ...rationale }).strict()
]);
export type LayoutProposalOperation = z.infer<typeof layoutProposalOperation>;
export const layoutProposalOperations = z.array(layoutProposalOperation).min(1).max(30).superRefine((operations,context) => {
  const seen = new Set<string>();
  operations.forEach((operation,index) => {
    const key=operation.kind+":"+("itemId" in operation?operation.itemId:operation.route);
    if(seen.has(key))context.addIssue({code:"custom",path:[index],message:"Propose each exact change once."});
    seen.add(key);
  });
});

export const layoutProposalCatalogItem = z.object({
  id: layoutIdentity,
  bundleKey: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  kind: z.enum(["navigation","widget"]),
  label: z.string().trim().min(1).max(120),
  route: z.string().max(200).regex(/^\/workspace(?:\/[a-z0-9][a-z0-9/_-]*)?$/).nullable(),
  visible: z.boolean(),
  pinned: z.boolean(),
  order: z.number().int().min(0).max(10_000).nullable()
}).strict();
export type LayoutProposalCatalogItem = z.infer<typeof layoutProposalCatalogItem>;
export const layoutProposalContext = z.object({
  schemaVersion: z.literal("1.0"),
  workspaceId: z.string().uuid(),
  layoutRevision: z.number().int().min(0),
  authorityRevision: z.string().min(1).max(200),
  items: z.array(layoutProposalCatalogItem).max(200),
  defaultWorkspaces: z.array(z.object({route:z.string().max(200),label:z.string().trim().min(1).max(120),current:z.boolean()}).strict()).min(1).max(100),
  defaultUnavailable: z.boolean(),
  dormantChoiceCount: z.number().int().min(0).max(500)
}).strict();
export type LayoutProposalContext = z.infer<typeof layoutProposalContext>;

export const layoutProposalInput = z.object({
  schemaVersion: z.literal("1.0"),
  expectedLayoutRevision: z.number().int().min(0),
  expectedAuthorityRevision: z.string().min(1).max(200),
  requestId: z.string().uuid(),
  title: z.string().trim().min(5).max(120),
  goal: z.string().trim().min(5).max(500),
  goalSource: z.enum(["user_stated","assistant_inferred"]),
  summary: z.string().trim().min(10).max(1_000),
  operations: layoutProposalOperations
}).strict();
export type LayoutProposalInput = z.infer<typeof layoutProposalInput>;

export const layoutProposalReceipt = z.object({
  schemaVersion: z.literal("1.0"),
  proposalId: z.string().uuid(),
  status: z.enum(["pending","stale","accepted","rejected"]),
  baseLayoutRevision: z.number().int().min(0),
  authorityRevision: z.string().min(1).max(200),
  createdAt: z.string().datetime({offset:true}),
  replayed: z.boolean()
}).strict();
export type LayoutProposalReceipt = z.infer<typeof layoutProposalReceipt>;

export const layoutProposalRecord = z.object({
  ...layoutProposalReceipt.omit({replayed:true}).shape,
  version: z.number().int().positive(),
  title: z.string().trim().min(5).max(120),
  goal: z.string().trim().min(5).max(500),
  goalSource: z.enum(["user_stated","assistant_inferred"]),
  summary: z.string().trim().min(10).max(1_000),
  operations: layoutProposalOperations,
  proposedPreferences: workspaceLayoutSchema,
  createdBy: z.enum(["assistant","user"]),
  decidedAt: z.string().datetime({offset:true}).nullable(),
  decisionNote: z.string().max(500)
}).strict();
export type LayoutProposalRecord = z.infer<typeof layoutProposalRecord>;
export const layoutProposalList = z.object({
  schemaVersion:z.literal("1.0"),workspaceId:z.string().uuid(),layoutRevision:z.number().int().min(0),
  authorityRevision:z.string().min(1).max(200),items:z.array(layoutProposalRecord).max(20)
}).strict();
export const layoutProposalDecision = z.object({
  proposalId:z.string().uuid(),expectedProposalVersion:z.number().int().positive(),
  expectedLayoutRevision:z.number().int().min(0),expectedAuthorityRevision:z.string().min(1).max(200),
  requestId:z.string().uuid(),decision:z.enum(["accept","reject"]),confirmed:z.literal(true),note:z.string().trim().max(500).default("")
}).strict();
export const layoutProposalDecisionResult = layoutProposalRecord.extend({
  replayed:z.boolean(),resultingLayoutRevision:z.number().int().min(0)
}).strict();

export type LayoutProposalCatalog = {items:Array<{id:string;kind:"navigation"|"widget";route:string|null}>;defaultRoutes:string[]};

/** Apply only active-catalog operations. Dormant preferences remain untouched. */
export function applyLayoutProposalOperations(current:WorkspaceLayout,catalog:LayoutProposalCatalog,raw:unknown):WorkspaceLayout {
  const operations=layoutProposalOperations.parse(raw),active=new Map(catalog.items.map(item=>[item.id,item]));
  const allowedRoutes=new Set(catalog.defaultRoutes),next=structuredClone(current);
  const hidden=new Set(next.hiddenItemIds),navPins=new Set(next.pinnedNavigationIds),widgetPins=new Set(next.pinnedWidgetIds);
  for(const operation of operations){
    if(operation.kind==="set_default_workspace"){
      if(!allowedRoutes.has(operation.route))throw new Error("Default workspace is not currently available.");
      next.defaultWorkspaceRoute=operation.route;continue;
    }
    const item=active.get(operation.itemId);if(!item)throw new Error("Layout item is not currently available.");
    if(operation.kind==="set_visibility"){
      if(operation.visible)hidden.delete(operation.itemId);else {hidden.add(operation.itemId);navPins.delete(operation.itemId);widgetPins.delete(operation.itemId);}
    }else if(operation.kind==="set_pin"){
      hidden.delete(operation.itemId);
      const pins=item.kind==="navigation"?navPins:widgetPins;
      if(operation.pinned)pins.add(operation.itemId);else pins.delete(operation.itemId);
    }else next.orderOverrides[operation.itemId]=operation.order;
  }
  next.hiddenItemIds=[...hidden];next.pinnedNavigationIds=[...navPins];next.pinnedWidgetIds=[...widgetPins];
  return workspaceLayoutSchema.parse(next);
}

export function layoutProposalChanges(current:WorkspaceLayout,proposed:WorkspaceLayout) {
  const ids=new Set([...current.hiddenItemIds,...proposed.hiddenItemIds,...current.pinnedNavigationIds,...proposed.pinnedNavigationIds,
    ...current.pinnedWidgetIds,...proposed.pinnedWidgetIds,...Object.keys(current.orderOverrides),...Object.keys(proposed.orderOverrides)]);
  const changes=[...ids].flatMap(id=>{
    const before={hidden:current.hiddenItemIds.includes(id),navigationPinned:current.pinnedNavigationIds.includes(id),widgetPinned:current.pinnedWidgetIds.includes(id),order:current.orderOverrides[id]??null};
    const after={hidden:proposed.hiddenItemIds.includes(id),navigationPinned:proposed.pinnedNavigationIds.includes(id),widgetPinned:proposed.pinnedWidgetIds.includes(id),order:proposed.orderOverrides[id]??null};
    return JSON.stringify(before)===JSON.stringify(after)?[]:[{itemId:id,before,after}];
  });
  return {items:changes,defaultWorkspace:current.defaultWorkspaceRoute===proposed.defaultWorkspaceRoute?null:{before:current.defaultWorkspaceRoute,after:proposed.defaultWorkspaceRoute}};
}
