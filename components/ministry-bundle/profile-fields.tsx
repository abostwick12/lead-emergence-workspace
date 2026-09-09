"use client";
import type {TheologicalProfile} from "@/lib/ministry-bundle/contracts";
import {Field,Choice,Lines,styles} from "./common";
export function ProfileFields({value,onChange}:{value:TheologicalProfile;onChange:(v:TheologicalProfile)=>void}) {
 const update=(patch:Partial<TheologicalProfile>)=>onChange({...value,...patch});
 return <>
 <div className={styles.notice}>This profile starts blank. Saving confirms your configuration, not every position. An inferred position remains inferred until you personally change its status.</div>
 <section className={styles.section}><h2>Your interpretive context</h2>
 <Field label="Tradition and context" value={value.traditionContext} onChange={traditionContext=>update({traditionContext})} multiline hint="Describe your own context, or leave it blank. No denomination is assumed."/>
 <Lines label="Preferred translations" values={value.preferredTranslations} onChange={preferredTranslations=>update({preferredTranslations})} max={2500}/>
 <Field label="Interpretive preferences and boundaries" value={value.interpretiveNotes} max={6000} multiline onChange={interpretiveNotes=>update({interpretiveNotes})}/>
 <Field label="How you want dialogue and disagreement handled" value={value.dialoguePreferences} max={3000} multiline onChange={dialoguePreferences=>update({dialoguePreferences})}/>
 </section>
 <section className={styles.section}><h2>Positions and their status</h2><p className={styles.muted}>Record the statement and its origin. Rejected positions remain visible as boundaries, not beliefs.</p>
 {value.positions.map((p,index)=><fieldset className={styles.source} key={p.id}><legend>Position {index+1}</legend>
 <Field label={"Position "+(index+1)+" statement"} value={p.statement} required max={2000} multiline onChange={statement=>update({positions:value.positions.map(x=>x.id===p.id?{...x,statement}:x)})}/>
 <Choice label={"Position "+(index+1)+" status"} value={p.epistemicState} values={["inferred","user_stated","confirmed","rejected"]} onChange={epistemicState=>update({positions:value.positions.map(x=>x.id===p.id?{...x,epistemicState:epistemicState as typeof p.epistemicState}:x)})}/>
 <Field label={"Position "+(index+1)+" source or context"} value={p.sourceReference} max={2000} onChange={sourceReference=>update({positions:value.positions.map(x=>x.id===p.id?{...x,sourceReference}:x)})}/>
 <button type="button" onClick={()=>update({positions:value.positions.filter(x=>x.id!==p.id)})}>Remove position {index+1}</button>
 </fieldset>)}
 <div className={styles.actions}><button type="button" disabled={value.positions.length>=30} onClick={()=>update({positions:[...value.positions,{id:crypto.randomUUID(),statement:"",epistemicState:"user_stated",sourceReference:""}]})}>Add a position</button></div>
 </section></>;
}
