"use client";
import type {PartnerRecord} from "@/lib/nonprofit-bundle/contracts";
import {Field,Choice,styles} from "./common";
export function PartnerFields({value,onChange}:{value:PartnerRecord;onChange:(value:PartnerRecord)=>void}){
 const put=(key:string,v:unknown)=>onChange({...value,[key]:v});
 return <><section className={styles.section}><h2>A relationship with a clear next step</h2>
 <Field label="Name or organization" value={value.title} max={240} required onChange={v=>put("title",v)}/>
 <div className={styles.grid}><Choice label="Relationship role" value={value.role} values={["partner","volunteer","donor","grantmaker","board","other"]} onChange={v=>put("role",v)}/><Choice label="Relationship stage" value={value.stage} values={["identified","contacted","conversation","committed","closed"]} onChange={v=>put("stage",v)}/></div>
 <Field label="Next follow-up action" value={value.nextAction} multiline max={2000} onChange={v=>put("nextAction",v)}/>
 <div className={styles.grid}><Field label="Follow-up owner" value={value.owner} max={200} onChange={v=>put("owner",v)} hint="Leave blank until someone accepts responsibility."/><Field label="Follow-up date" type="date" value={value.followupDate??""} onChange={v=>put("followupDate",v||null)}/></div></section>
 <section className={styles.section}><h2>Administrative context</h2><div className={styles.grid}><Field label="Administrative contact name" value={value.contactName} max={200} onChange={v=>put("contactName",v)}/><Field label="Administrative contact email" type="email" value={value.contactEmail} max={320} onChange={v=>put("contactEmail",v)}/></div>
 <Field label="Last contact date" type="date" value={value.lastContactDate??""} onChange={v=>put("lastContactDate",v||null)}/>
 <Field label="Relationship notes" value={value.notes} max={12000} multiline onChange={v=>put("notes",v)} hint="Record administrative commitments and useful context, not clinical details."/>
 <details className={styles.step}><summary>Prepare an outreach draft</summary><Field label="Outreach draft" value={value.outreachDraft} max={8000} multiline onChange={v=>put("outreachDraft",v)} hint="Saving does not send this message. Review names, facts, tone and recipients before using it elsewhere."/></details></section></>;
}
