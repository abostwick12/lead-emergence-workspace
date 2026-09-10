import {z} from "zod";
// Native current-condition inbox. This contract grants no source authority or delivery.
const hash=z.string().regex(/^[0-9a-f]{64}$/), instant=z.iso.datetime({offset:true});
export const notificationDefinitions=[
 {id:"writer.notification.publication_ready",bundleKey:"writer_editor",capabilityId:"writer.resource.library",label:"Resource marked ready"},
 {id:"ministry.notification.teaching_due",bundleKey:"ministry",capabilityId:"ministry.research",label:"Research date approaching"},
 {id:"nonprofit.notification.followup_due",bundleKey:"nonprofit_founder",capabilityId:"nonprofit.partners",label:"Partner follow-up due"},
 {id:"investor.notification.thesis_change",bundleKey:"investor",capabilityId:"investor.thesis",label:"Recorded thesis concern"},
 {id:"executive.notification.coordination_due",bundleKey:"executive",capabilityId:"executive.coordination",label:"Commitments and meeting actions due"},
 {id:"executive.notification.brief_action_due",bundleKey:"executive",capabilityId:"executive.brief",label:"Daily brief actions due"},
 {id:"executive.notification.review_action_due",bundleKey:"executive",capabilityId:"executive.review",label:"Weekly review actions due"},
 {id:"workspace.notification.connection_required",bundleKey:"workspace_experience",capabilityId:"workspace.notifications",label:"Saved access needs review"}
] as const;
export const notificationType=z.enum(notificationDefinitions.map(d=>d.id));
export const notificationView=z.enum(["inbox","unread","later","dismissed","muted"]);
export const notificationQuery=z.object({view:notificationView.default("inbox"),typeId:notificationType.optional(),
 offset:z.number().int().min(0).max(2147483000).multipleOf(25).default(0)}).strict();
const reviewed=z.object({id:hash,revision:hash}).strict();
const changeBase={requestId:z.string().uuid(),expectedVersion:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)};
export const notificationChange=z.discriminatedUnion("kind",[
 z.object({...changeBase,kind:z.literal("items"),action:z.enum(["read","unread","dismiss","snooze"]),
 items:z.array(reviewed).min(1).max(25).refine(a=>new Set(a.map(i=>i.id)).size===a.length,"Review each item once.")}).strict(),
 z.object({...changeBase,kind:z.literal("preference"),typeId:notificationType,enabled:z.boolean()}).strict()
]);
export const notificationItem=z.object({
 id:hash,revision:hash,typeId:notificationType,title:z.string().min(1).max(300),reason:z.string().max(1000),
 sourceHref:z.string().regex(/^\/workspace\/(?:integrations|(?:writing|ministry\/research|nonprofit\/partner|investing\/thesis|executive\/(?:commitment|decision|meeting|daily_brief|weekly_review))\/[0-9a-f-]{36}(?:#task-action-[0-9a-f-]{36})?)$/).max(500),
 sourceLabel:z.string().max(200),dueDate:z.iso.date().nullable(),priority:z.enum(["high","normal"]),
 status:z.enum(["unread","read","later","dismissed","muted"]),snoozedUntil:instant.nullable()
}).strict();
export const notificationSnapshot=z.object({
 workspaceId:z.string().uuid(),authorityRevision:z.string().min(1).max(200),retrievedAt:instant,timeZone:z.string().max(100),
 asOfDate:z.iso.date(),version:z.number().int().nonnegative(),view:notificationView,typeId:notificationType.nullable(),
 offset:z.number().int().nonnegative(),pageSize:z.literal(25),total:z.number().int().nonnegative(),
 counts:z.object({inbox:z.number().int().nonnegative(),unread:z.number().int().nonnegative(),
 later:z.number().int().nonnegative(),dismissed:z.number().int().nonnegative(),muted:z.number().int().nonnegative()}).strict(),
 types:z.array(z.object({id:notificationType,enabled:z.boolean()}).strict()).max(8),
 items:z.array(notificationItem).max(25)
}).strict();
export const notificationReceipt=z.object({requestId:z.string().uuid(),version:z.number().int().positive(),changed:z.number().int().min(1).max(25)}).strict();
export type NotificationSnapshot=z.infer<typeof notificationSnapshot>;
export type NotificationChange=z.infer<typeof notificationChange>;
export type NotificationItem=z.infer<typeof notificationItem>;
export type NotificationQuery=z.infer<typeof notificationQuery>;
