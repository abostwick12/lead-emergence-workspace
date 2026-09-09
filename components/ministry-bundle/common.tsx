"use client";
import Link from "next/link";
import {useId,useState,type ReactNode} from "react";
import {useWorkspace} from "@/components/workspace-provider";
import styles from "./ministry.module.css";
export {styles};
export function MinistryFrame({title,description,children}:{title:string;description:string;children:ReactNode}) {
 const {bundleExperience}=useWorkspace();const caps=bundleExperience?.capabilityIds??[];
 return <section className={styles.workspace}><header className={styles.header}><p className={styles.eyebrow}>Ministry • Lead Emergence</p><h1>{title}</h1><p>{description}</p></header>
 <nav className={styles.nav} aria-label="Ministry workspace">
 {caps.includes("ministry.research")&&<Link href="/workspace/ministry">Research & teaching</Link>}
 {caps.includes("ministry.archive")&&<Link href="/workspace/ministry/archive">Teaching archive</Link>}
 {caps.includes("ministry.profile")&&<Link href="/workspace/ministry/profile">Theological preferences</Link>}
 </nav>{children}</section>;
}
export function AccessState() {
 const {bundlesLoading,bundleError,refreshBundleExperience}=useWorkspace();
 return <MinistryFrame title={bundlesLoading?"Opening Ministry…":bundleError?"Ministry is temporarily unavailable":"Ministry access is not included"} description="Only your currently assigned capabilities can open private Ministry records."><div className={styles.empty}><p>{bundlesLoading?"Checking your access.":"Your administrator can assign access. If it just changed, check again."}</p><button onClick={refreshBundleExperience}>Check access again</button><p><Link href="/workspace">Return to Home</Link></p></div></MinistryFrame>;
}
export function ReadState({loading,error,retry}:{loading:boolean;error:string|null;retry:()=>void}) {return <div className={styles.empty} role={error?"alert":"status"}>{loading?"Opening your saved work…":error}<p>{error&&<button onClick={retry}>Try again</button>}</p></div>;}
export function Field({label,value,onChange,max=4000,multiline=false,type="text",hint,required=false}:{label:string;value:string;onChange:(value:string)=>void;max?:number;multiline?:boolean;type?:string;hint?:string;required?:boolean}) {
 const id=useId(),description=hint?id+"-hint":undefined;
 return <div className={styles.field}><label htmlFor={id}>{label}{required?" *":""}</label>{multiline?<textarea id={id} aria-describedby={description} value={value} onChange={e=>onChange(e.target.value)} maxLength={max} rows={5} required={required}/>:<input id={id} aria-describedby={description} value={value} onChange={e=>onChange(e.target.value)} maxLength={max} type={type} required={required}/>} {hint&&<small id={description}>{hint}</small>}</div>;
}
export function Choice({label,value,values,onChange}:{label:string;value:string;values:readonly string[];onChange:(value:string)=>void}) {return <label className={styles.field}><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{values.map(v=><option value={v} key={v}>{v?v.replaceAll("_"," "):"All statuses"}</option>)}</select></label>;}
export function Lines({label,values,onChange,max=4000}:{label:string;values:string[];onChange:(values:string[])=>void;max?:number}) {
 const [raw,setRaw]=useState(values.join("\n"));
 return <Field label={label} value={raw} max={max} multiline onChange={v=>{setRaw(v);onChange(v.split("\n").map(x=>x.trim()).filter(Boolean));}} hint="One entry per line. Avoid duplicates."/>;
}
export function Validation({message}:{message:string|null}) {return message?<p className={styles.error} role="alert">{message}</p>:null;}
