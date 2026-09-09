import {notFound} from "next/navigation";
import {executiveKind} from "@/lib/executive-bundle/contracts";
import {ExecutiveProposals} from "@/components/executive-bundle/proposals";
export default async function Page({params}:{params:Promise<{kind:string}>}){const parsed=executiveKind.safeParse((await params).kind);if(!parsed.success)notFound();return <ExecutiveProposals kind={parsed.data}/>;}
