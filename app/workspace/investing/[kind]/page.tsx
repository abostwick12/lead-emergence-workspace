import {notFound} from "next/navigation";
import {investorKind} from "@/lib/investor-bundle/contracts";
import {InvestorLibrary} from "@/components/investor-bundle/library";
export default async function Page({params}:{params:Promise<{kind:string}>}){const parsed=investorKind.safeParse((await params).kind);if(!parsed.success)notFound();return <InvestorLibrary kind={parsed.data}/>;}
