import {z} from "zod";
import {namedTimeZone} from "./executive";

const instant=z.iso.datetime({offset:true}),localTime=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const safeVersion=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const executiveDeliveryKind=z.enum(["daily_brief","weekly_review"]);
export const executiveDeliveryChangePolicy=z.enum(["always","when_attention_summary_changes"]);
export const executiveDeliveryCadence=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("daily"),localTime}).strict(),
 z.object({kind:z.literal("weekly"),localTime,weekdays:z.array(z.number().int().min(1).max(7)).min(1).max(7)
  .refine(days=>new Set(days).size===days.length,"Choose each weekday once.")}).strict()
]);
export const executiveDeliveryDefinition=z.object({
 schemaVersion:z.literal("1.0"),deliveryKind:executiveDeliveryKind,label:z.string().trim().min(5).max(120),
 timeZone:namedTimeZone,cadence:executiveDeliveryCadence,changePolicy:executiveDeliveryChangePolicy,
 deliveryTarget:z.literal("native_executive_inbox")
}).strict().superRefine((value,context)=>{
 if(value.deliveryKind==="daily_brief"&&value.cadence.kind!=="daily")context.addIssue({code:"custom",message:"Daily briefs use a daily cadence."});
 if(value.deliveryKind==="weekly_review"&&value.cadence.kind!=="weekly")context.addIssue({code:"custom",message:"Weekly reviews use a weekly cadence."});
});
export type ExecutiveDeliveryDefinition=z.infer<typeof executiveDeliveryDefinition>;

export const executiveDeliveryMutation=z.object({
 scheduleId:z.string().uuid().nullable(),expectedVersion:safeVersion,requestId:z.string().uuid(),
 operation:z.enum(["create","update","pause","resume","cancel"]),definition:executiveDeliveryDefinition.nullable(),
 confirmExactSchedule:z.literal(true)
}).strict().superRefine((value,context)=>{
 const create=value.operation==="create",write=create||value.operation==="update";
 if(create?(value.scheduleId!==null||value.expectedVersion!==0):(value.scheduleId===null||value.expectedVersion<1))context.addIssue({code:"custom",message:"Schedule identity and version do not match the operation."});
 if(write!==Boolean(value.definition))context.addIssue({code:"custom",message:"Only create and update carry a complete schedule definition."});
});

export const executiveDeliverySchedule=z.object({
 scheduleId:z.string().uuid(),version:safeVersion.positive(),definition:executiveDeliveryDefinition,
 status:z.enum(["active","paused","cancelled"]),capabilityAvailable:z.boolean(),nextOccurrence:instant.nullable(),lastEvaluatedAt:instant.nullable(),lastDeliveredAt:instant.nullable(),
 createdAt:instant,updatedAt:instant,replayed:z.boolean()
}).strict().superRefine((value,context)=>{
 if((value.status==="active")!==Boolean(value.nextOccurrence))context.addIssue({code:"custom",message:"Only active schedules have a next occurrence."});
});
export type ExecutiveDeliverySchedule=z.infer<typeof executiveDeliverySchedule>;

export const executiveDeliveryEvent=z.object({
 deliveryId:z.string().uuid(),scheduleId:z.string().uuid(),scheduleVersion:safeVersion.positive(),
 deliveryKind:executiveDeliveryKind,label:z.string().trim().min(5).max(120),dueAt:instant,evaluatedAt:instant,
 outcome:z.enum(["ready","skipped_unchanged"]),reason:z.string().trim().min(10).max(500),
 currentAttentionCount:z.number().int().nonnegative(),inspectedAttentionCount:z.number().int().nonnegative().max(50),
 inspectedHighPriorityCount:z.number().int().nonnegative().max(50),
 route:z.enum(["/workspace/executive/daily_brief/new","/workspace/executive/weekly_review/new"]),
 requiresUserReview:z.literal(true),externalDelivery:z.literal(false),recordCreated:z.literal(false)
}).strict().superRefine((value,context)=>{
 if(value.inspectedHighPriorityCount>value.inspectedAttentionCount||value.inspectedAttentionCount>value.currentAttentionCount
  ||(value.deliveryKind==="daily_brief")!==(value.route==="/workspace/executive/daily_brief/new"))
  context.addIssue({code:"custom",message:"Delivery counts or destination could not be verified."});
});
export type ExecutiveDeliveryEvent=z.infer<typeof executiveDeliveryEvent>;
export const executiveDeliveryList=z.object({
 schemaVersion:z.literal("1.0"),workspaceId:z.string().uuid(),authorityRevision:z.string().min(1).max(200),serverNow:instant,
 schedules:z.array(executiveDeliverySchedule).max(20),deliveries:z.array(executiveDeliveryEvent).max(50),
 backgroundDeliveryAvailable:z.literal(false)
}).strict().superRefine((value,context)=>{
 const currentSchedules=value.schedules.filter(schedule=>schedule.status!=="cancelled");
 if(new Set(currentSchedules.map(schedule=>schedule.definition.deliveryKind)).size!==currentSchedules.length
  ||value.deliveries.some(delivery=>!value.schedules.some(schedule=>schedule.scheduleId===delivery.scheduleId)))
  context.addIssue({code:"custom",message:"Delivery schedules or history could not be verified."});
});
export type ExecutiveDeliveryList=z.infer<typeof executiveDeliveryList>;
