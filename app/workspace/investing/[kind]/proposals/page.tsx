import {notFound} from "next/navigation";
import {investorKind} from "@/lib/investor-bundle/contracts";
import {InvestorProposals} from "@/components/investor-bundle/proposals";
export default async function Page({params}:{params:Promise<{kind:string}>}){const parsed=investorKind.safeParse((await params).kind);if(!parsed.success)notFound();return <InvestorProposals kind={parsed.data}/>;}
