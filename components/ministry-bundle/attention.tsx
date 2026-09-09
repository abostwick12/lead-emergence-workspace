"use client";
import Link from "next/link";
import {useMinistryRead} from "./use-ministry";
import {styles} from "./common";
type Attention={items:{id:string;title:string;dueDate:string;reason:string;priority:"high"|"normal"}[]};
export function MinistryAttention({label}:{label:string}) {
 const read=useMinistryRead<Attention>("/api/ministry/attention","ministry.research");
 if(!read.enabled)return null;
 return <article className={styles.workspace} aria-label="Ministry teaching attention"><div className={styles.section}><p className={styles.eyebrow}>Ministry · {label}</p><h2>{read.loading?"Checking teaching dates…":read.error?"Teaching dates couldn't be checked":read.data?.items.length?"Bring your next teaching into focus.":"No teaching date needs attention."}</h2>
 {read.error?<button onClick={read.retry}>Try again</button>:<>{read.data?.items.slice(0,3).map(item=><Link className={styles.row} key={item.id} href={"/workspace/ministry/research/"+item.id}><h3>{item.title}</h3><p>{item.dueDate} · {item.reason}</p></Link>)}<p className={styles.muted}>Based on saved project dates, including overdue work and the next seven days. No reminders are sent automatically.</p><Link href="/workspace/ministry">Open Ministry research</Link></>}</div></article>;
}
