import {notFound} from "next/navigation";
import {nonprofitKind} from "@/lib/nonprofit-bundle/contracts";
import {NonprofitProposals} from "@/components/nonprofit-bundle/proposals";
export default async function Page({params}:{params:Promise<{kind:string}>}){const parsed=nonprofitKind.safeParse((await params).kind);if(!parsed.success)notFound();return <NonprofitProposals kind={parsed.data}/>;}
