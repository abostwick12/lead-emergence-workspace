import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export function CapabilityLockedState({
  title,
  benefit,
  suspended = false
}: {
  title: string;
  benefit: string;
  suspended?: boolean;
}) {
  return <section className="workflow-page"><p className="eyebrow workflow-kicker">Plan &amp; capabilities</p><h1 className="page-title">{title}</h1><div className="useful-empty"><LockKeyhole size={22} /><div><h3>{suspended ? "Capability use is suspended" : "Not included with the current plan"}</h3><p>{benefit} {suspended ? "Your existing data is retained while use is suspended." : "Available with an upgraded plan."}</p><Link href="/workspace/settings#plan">Review plan capabilities</Link></div></div><p className="notice"><ShieldCheck size={16} />A plan state never changes which private records you own or bypasses Workspace authorization.</p></section>;
}
