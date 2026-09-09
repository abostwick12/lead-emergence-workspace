import {notFound} from "next/navigation";
import {investorKind} from "@/lib/investor-bundle/contracts";
import {InvestorEditorPage} from "@/components/investor-bundle/editor";
export default async function Page({params}:{params:Promise<{kind:string;documentId:string}>}){const {kind,documentId}=await params,parsed=investorKind.safeParse(kind);if(!parsed.success)notFound();return <InvestorEditorPage kind={parsed.data} documentId={documentId}/>;}
