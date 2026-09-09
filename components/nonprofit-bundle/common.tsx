"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useId,useState,type ReactNode} from "react";
import {useWorkspace} from "@/components/workspace-provider";
import {nonprofitKinds,nonprofitLabels,nonprofitCapabilities} from "@/lib/nonprofit-bundle/contracts";
import styles from "./nonprofit.module.css";
export {styles};
export function NonprofitFrame({title,description,children}:{title:string;description:string;children:ReactNode}){
 const {bundleExperience}=useWorkspace(),path=usePathname();const caps=bundleExperience?.capabilityIds??[];
 return <section className={styles.workspace}><header className={styles.header}><p className={styles.eyebrow}>Nonprofit Founder · Lead Emergence</p><h1>{title}</h1><p>{description}</p></header>
 <nav className={styles.nav} aria-label="Nonprofit workspace">{caps.includes("nonprofit.roadmap")&&<Link href="/workspace/nonprofit" aria-current={path==="/workspace/nonprofit"?"page":undefined}>Next moves</Link>}{nonprofitKinds.filter(k=>caps.includes(nonprofitCapabilities[k])).map(k=><Link key={k} href={"/workspace/nonprofit/"+k} aria-current={path.startsWith("/workspace/nonprofit/"+k)?"page":undefined}>{nonprofitLabels[k]}</Link>)}</nav>{children}</section>;
}
export function AccessState(){
 const {bundlesLoading,bundleError,refreshBundleExperience}=useWorkspace();
 return <NonprofitFrame title={bundlesLoading?"Opening Nonprofit…":bundleError?"Nonprofit is temporarily unavailable":"This Nonprofit area is not included"} description="Only your currently assigned capabilities can open private founder records."><div className={styles.empty}><p>{bundlesLoading?"Checking your access.":"Your administrator can assign access. If it just changed, check again."}</p><button onClick={refreshBundleExperience}>Check access again</button><p><Link href="/workspace">Return to Home</Link></p></div></NonprofitFrame>;
}
export function ReadState({loading,error,retry}:{loading:boolean;error:string|null;retry:()=>void}){return <div className={styles.empty} role={error?"alert":"status"}>{loading?"Opening your saved work…":error}<p>{error&&<button onClick={retry}>Try again</button>}</p></div>;}
export function Field({label,value,onChange,max=4000,multiline=false,type="text",hint,required=false}:{label:string;value:string;onChange:(value:string)=>void;max?:number;multiline?:boolean;type?:string;hint?:string;required?:boolean}){
 const id=useId(),description=hint?id+"-hint":undefined;
 return <div className={styles.field}><label htmlFor={id}>{label}{required?" *":""}</label>{multiline?<textarea id={id} aria-describedby={description} value={value} onChange={e=>onChange(e.target.value)} maxLength={max} rows={4} required={required}/>:<input id={id} aria-describedby={description} value={value} onChange={e=>onChange(e.target.value)} maxLength={max} type={type} required={required}/>} {hint&&<small id={description}>{hint}</small>}</div>;
}
export function Choice({label,value,values,onChange}:{label:string;value:string;values:readonly string[];onChange:(value:string)=>void}){
 const id=useId();return <div className={styles.field}><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e=>onChange(e.target.value)}>{values.map(v=><option value={v} key={v}>{v.replaceAll("_"," ")}</option>)}</select></div>;
}
export function Lines({label,values,onChange,max=4000,hint="One entry per line. Avoid duplicates."}:{label:string;values:string[];onChange:(values:string[])=>void;max?:number;hint?:string}){
 const [raw,setRaw]=useState(values.join("\n"));
 return <Field label={label} value={raw} max={max} multiline onChange={v=>{setRaw(v);onChange(v.split("\n").map(x=>x.trim()).filter(Boolean));}} hint={hint}/>;
}
export function Validation({message}:{message:string|null}){return message?<p className={styles.error} role="alert">{message}</p>:null;}
export function AdministrativeNotice(){return <p className={styles.notice}>For administration only. Keep patient information, therapy notes, diagnoses and treatment plans out of this workspace. Free text is not automatically screened for health information.</p>;}
export function Disclosure({summary,children,initialOpen=false}:{summary:ReactNode;children:ReactNode;initialOpen?:boolean}){
 const [open,setOpen]=useState(initialOpen);
 return <details className={styles.step} open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>{summary}</summary>{children}</details>;
}
