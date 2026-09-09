"use client";
import {sourceUrl,type NonprofitResearch,type NonprofitSource} from "@/lib/nonprofit-bundle/contracts";
import {Field,Choice,Disclosure,styles} from "./common";
export function ResearchFields({value,onChange}:{value:NonprofitResearch;onChange:(value:NonprofitResearch)=>void}){
 const put=(key:string,v:unknown)=>onChange({...value,[key]:v});
 const sourceChange=(source:NonprofitSource)=>put("sources",value.sources.map(s=>s.id===source.id?source:s));
 return <><section className={styles.section}><h2>Start with the precise question</h2>
 <Field label="Research title" value={value.title} max={240} required onChange={v=>put("title",v)}/>
 <Field label="Question to resolve" value={value.question} multiline required onChange={v=>put("question",v)}/>
 <div className={styles.grid}><Field label="Research jurisdiction" value={value.jurisdiction} max={500} required onChange={v=>put("jurisdiction",v)}/><Choice label="Research category" value={value.category} values={["formation","governance","fundraising","grant","regulatory","policy"]} onChange={v=>put("category",v)}/></div>
 <p className={styles.notice}>Source-first decision support, not legal advice or a compliance verdict. Record what an authority actually says, then separate your interpretation and unresolved questions. This page does not automatically fetch or verify sources.</p></section>
 <section className={styles.section}><h2>The evidence behind the answer</h2><p className={styles.muted}>Prefer the responsible government authority, legislature or grantmaker. Record the page you actually inspected and its retrieval date. Never send private operational notes in a public search.</p>
 {!value.sources.length&&<p className={styles.notice}>No sources recorded. This question is not yet evidence-backed.</p>}
 {value.sources.map((s,i)=><Disclosure key={s.id} initialOpen={!s.title} summary={<><span className={styles.pill}>Source {i+1}</span><strong>{s.title||"Record a source"}</strong></>}>
 <Field label="Source title" value={s.title} max={500} required onChange={v=>sourceChange({...s,title:v})}/>
 <div className={styles.grid}><Field label="Issuing authority or grantmaker" value={s.authority} max={500} required onChange={v=>sourceChange({...s,authority:v})}/><Choice label="Authority type" value={s.authorityType} values={["government","grantmaker","primary_organization","secondary"]} onChange={v=>sourceChange({...s,authorityType:v as NonprofitSource["authorityType"]})}/></div>
 <Field label="Source URL" value={s.url} max={2000} type="url" required onChange={v=>sourceChange({...s,url:v})}/>
 {sourceUrl.safeParse(s.url).success&&<a href={s.url} target="_blank" rel="noopener noreferrer">Open recorded source in a new tab</a>}
 <Field label="Section, rule or source reference" value={s.reference} max={2000} onChange={v=>sourceChange({...s,reference:v})}/>
 <Field label="Source jurisdiction or grant coverage" value={s.jurisdiction} max={500} required onChange={v=>sourceChange({...s,jurisdiction:v})}/>
 <div className={styles.grid}><Field label="Date retrieved" type="date" value={s.retrievedDate} required onChange={v=>sourceChange({...s,retrievedDate:v})}/><Field label="Effective date, if stated" type="date" value={s.effectiveDate??""} onChange={v=>sourceChange({...s,effectiveDate:v||null})}/></div>
 <Field label="Source publication date, if stated" type="date" value={s.sourceDate??""} onChange={v=>sourceChange({...s,sourceDate:v||null})}/>
 <Field label="Authority finding" value={s.finding} max={8000} multiline required onChange={v=>sourceChange({...s,finding:v})} hint="What does this source actually say? Distinguish a concise paraphrase from a direct quotation."/>
 <button type="button" onClick={()=>{if(!s.title||window.confirm("Remove this source from the draft? Earlier saved revisions remain recoverable."))put("sources",value.sources.filter(x=>x.id!==s.id));}}>Remove source {i+1}</button>
 </Disclosure>)}
 <div className={styles.actions}><button type="button" disabled={value.sources.length>=30} onClick={()=>put("sources",[...value.sources,{id:crypto.randomUUID(),title:"",authority:"",authorityType:"government",url:"",reference:"",jurisdiction:value.jurisdiction,retrievedDate:"",effectiveDate:null,sourceDate:null,finding:""}])}>Add a source</button></div></section>
 <section className={styles.section}><h2>Interpretation is not the source finding</h2>
 <Field label="Interpretation" value={value.interpretation} max={8000} multiline onChange={v=>put("interpretation",v)}/>
 <Field label="Uncertainty and applicability gaps" value={value.uncertainty} multiline required onChange={v=>put("uncertainty",v)} hint="Name conflicting evidence, missing facts, stale material or unresolved applicability."/>
 <Field label="Required next action" value={value.requiredAction} multiline onChange={v=>put("requiredAction",v)}/>
 <Field label="Professional review recommendation" value={value.professionalReview} max={2000} multiline required onChange={v=>put("professionalReview",v)}/>
 <div className={styles.grid}><Choice label="Research status" value={value.status} values={["open","researching","review_required","reviewed","archived"]} onChange={v=>put("status",v)}/><Choice label="Interpretation evidence state" value={value.epistemicState} values={["inferred","user_stated","stale","rejected"]} onChange={v=>put("epistemicState",v)}/></div>
 <p className={styles.muted}>“Reviewed” means you reviewed recorded evidence. It does not certify legal compliance, eligibility or professional approval. Assistant-authored interpretations remain inferred.</p>
 <div className={styles.grid}><Field label="Research owner" value={value.owner} max={200} onChange={v=>put("owner",v)}/><Field label="Review date" type="date" value={value.reviewDate??""} onChange={v=>put("reviewDate",v||null)}/></div></section></>;
}
