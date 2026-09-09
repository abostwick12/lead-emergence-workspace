import {z} from "zod";
const labelList=(max:number)=>z.array(z.string().trim().min(1).max(max)).max(100).refine(v=>new Set(v.map(x=>x.toLocaleLowerCase())).size===v.length,"Use each label once.");
export const writingProfile=z.object({
 voice_notes:z.string().max(4000).optional(),audience_notes:z.string().max(1000).optional(),editing_boundaries:z.string().max(2000).optional(),
 website_notes:z.string().max(2000).optional(),preferred_terms:labelList(120).optional(),avoid_terms:labelList(120).optional(),
 topics:labelList(120).optional(),themes:labelList(240).optional()
}).strict();
export type WritingProfile=z.infer<typeof writingProfile>;
export const profileResult=z.object({revision:z.number().int().nonnegative(),profile:writingProfile.nullable(),epistemicState:z.enum(["unset","confirmed"]),confirmedAt:z.string().datetime({offset:true}).nullable()}).strict().refine(
 value=>(value.profile===null)===(value.epistemicState==="unset")&&(value.revision===0?value.profile===null&&value.confirmedAt===null:value.confirmedAt!==null),"Invalid profile confirmation state.");
export type ProfileResult=z.infer<typeof profileResult>;
export const profileSaveInput=z.object({expectedRevision:z.number().int().nonnegative(),requestId:z.string().uuid(),profile:writingProfile.nullable(),confirmPreferences:z.literal(true)}).strict();
export const profileHistory=z.object({revisions:z.array(z.object({revision:z.number().int().positive(),profile:writingProfile.nullable(),confirmedAt:z.string().datetime({offset:true})}).strict()).max(10)}).strict();
export function profileLabels(raw:string){return [...new Map(raw.split(/\r?\n/).map(v=>v.trim()).filter(Boolean).map(v=>[v.toLocaleLowerCase(),v])).values()];}
