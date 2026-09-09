"use client";
import {sourceLayers,sourceLayerLabels,type ResearchProject,type ResearchSource,type ResearchNote} from "@/lib/ministry-bundle/contracts";
import {Field,Choice,styles} from "./common";
export function ResearchFields({value,onChange}:{value:ResearchProject;onChange:(v:ResearchProject)=>void}) {
 const update=(patch:Partial<ResearchProject>)=>onChange({...value,...patch});
 const source=(id:string,patch:Partial<ResearchSource>)=>update({sources:value.sources.map(x=>x.id===id?{...x,...patch}:x)});
 const note=(id:string,patch:Partial<ResearchNote>)=>update({notes:value.notes.map(x=>x.id===id?{...x,...patch}:x)});
 return <>
 <section className={styles.section}><h2>Begin with the question</h2>
 <Field label="Project title" value={value.title} max={240} required onChange={title=>update({title})}/>
 <Field label="Research question" value={value.question} required multiline onChange={question=>update({question})} hint="What must you understand before teaching this?"/>
 <div className={styles.grid}><Field label="Passage or subject" value={value.passage} max={500} onChange={passage=>update({passage})}/><Field label="Audience" value={value.audience} max={300} onChange={audience=>update({audience})}/>
 <Field label="Teaching date" value={value.dueDate??""} type="date" onChange={v=>update({dueDate:v||null})}/><Choice label="Project status" value={value.status} values={["draft","researching","ready","archived"]} onChange={status=>update({status:status as ResearchProject["status"]})}/></div>
 </section>
 <section className={styles.section}><h2>Evidence, kept in its own voice</h2>
 <p className={styles.muted}>Record sources you actually consulted. A citation is not a verification badge. Use only the layers relevant to this question; an empty layer is not a failure.</p>
 <div className={styles.counts}>{sourceLayers.map(layer=><span className={styles.tag} key={layer}>{sourceLayerLabels[layer]} · {value.sources.filter(s=>s.layer===layer).length}</span>)}</div>
 {value.sources.map((s,index)=>{
 const cited=value.notes.some(n=>n.sourceIds.includes(s.id));
 return <details className={styles.source} key={s.id} open><summary>Source {index+1} · {s.title||"Add the source title"}</summary>
 <Field label={"Source "+(index+1)+" title"} value={s.title} required max={500} onChange={title=>source(s.id,{title})}/>
 <label className={styles.field}><span>Source {index+1} layer</span><select value={s.layer} onChange={e=>source(s.id,{layer:e.target.value as ResearchSource["layer"]})}>{sourceLayers.map(layer=><option value={layer} key={layer}>{sourceLayerLabels[layer]}</option>)}</select></label>
 <Field label={"Source "+(index+1)+" reference"} value={s.reference} max={2000} required onChange={reference=>source(s.id,{reference})} hint="Edition, passage, page, section, or other precise location."/>
 <div className={styles.grid}><Field label={"Source "+(index+1)+" author or organization"} value={s.author} max={300} onChange={author=>source(s.id,{author})}/>
 <Field label={"Source "+(index+1)+" URL"} value={s.url??""} max={2000} type="url" onChange={v=>source(s.id,{url:v||null})}/>
 <Field label={"Source "+(index+1)+" publication date"} value={s.sourceDate??""} type="date" onChange={v=>source(s.id,{sourceDate:v||null})}/>
 <Field label={"Source "+(index+1)+" date consulted"} value={s.retrievedDate??""} type="date" onChange={v=>source(s.id,{retrievedDate:v||null})}/></div>
 <Field label={"Source "+(index+1)+" excerpt or recorded evidence"} value={s.excerpt} max={8000} multiline onChange={excerpt=>source(s.id,{excerpt})}/>
 <Field label={"Source "+(index+1)+" limitations or context"} value={s.comment} max={3000} multiline onChange={comment=>source(s.id,{comment})}/>
 <button type="button" disabled={cited} onClick={()=>update({sources:value.sources.filter(x=>x.id!==s.id)})}>Remove source {index+1}</button>
 {cited&&<p className={styles.muted}>Remove this source from its note citations before removing it here.</p>}
 </details>;})}
 <div className={styles.actions}><button type="button" disabled={value.sources.length>=40} onClick={()=>update({sources:[...value.sources,{id:crypto.randomUUID(),title:"",layer:"biblical_text",reference:"",author:"",url:null,sourceDate:null,retrievedDate:null,excerpt:"",comment:""}]})}>Add a source</button></div>
 </section>
 <section className={styles.section}><h2>What the evidence supports</h2><p className={styles.muted}>Keep observations, interpretations, questions, applications and AI synthesis distinct. Uncited notes remain visibly uncited.</p>
 {value.notes.map((n,index)=><fieldset className={styles.source} key={n.id}><legend>Note {index+1}</legend>
 <div className={styles.grid}><Choice label={"Note "+(index+1)+" type"} value={n.kind} values={["observation","interpretation","question","application","ai_synthesis"]} onChange={kind=>note(n.id,{kind:kind as ResearchNote["kind"],...(kind==="ai_synthesis"?{epistemicState:"inferred"}:{})})}/>
 <Choice label={"Note "+(index+1)+" status"} value={n.epistemicState} values={n.kind==="ai_synthesis"?["inferred"]:["user_stated","inferred","rejected"]} onChange={epistemicState=>note(n.id,{epistemicState:epistemicState as ResearchNote["epistemicState"]})}/></div>
 <Field label={"Note "+(index+1)+" text"} value={n.text} required max={8000} multiline onChange={text=>note(n.id,{text})}/>
 <fieldset><legend>Sources for note {index+1}</legend>{value.sources.map((s,si)=><label className={styles.check} key={s.id}><input type="checkbox" checked={n.sourceIds.includes(s.id)} onChange={e=>note(n.id,{sourceIds:e.target.checked?[...n.sourceIds,s.id]:n.sourceIds.filter(id=>id!==s.id)})}/><span>{si+1}. {s.title||"Untitled source"} — {sourceLayerLabels[s.layer]}</span></label>)}
 {!n.sourceIds.length&&<p className={styles.notice}>No source linked. This note is not source-supported within this project.</p>}</fieldset>
 <button type="button" onClick={()=>update({notes:value.notes.filter(x=>x.id!==n.id)})}>Remove note {index+1}</button>
 </fieldset>)}
 <div className={styles.actions}><button type="button" disabled={value.notes.length>=40} onClick={()=>update({notes:[...value.notes,{id:crypto.randomUUID(),kind:"observation",text:"",sourceIds:[],epistemicState:"user_stated"}]})}>Add a note</button></div>
 </section>
 <section className={styles.section}><h2>Shape the teaching</h2><Field label="Teaching outline" value={value.teachingOutline} max={60000} multiline onChange={teachingOutline=>update({teachingOutline})} hint="Build the argument, name tensions and uncertainties, and point back to your numbered sources. Saving or marking ready does not verify the teaching."/></section>
 </>;
}
