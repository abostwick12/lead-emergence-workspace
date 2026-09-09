import {notFound} from "next/navigation";
import {nonprofitKind} from "@/lib/nonprofit-bundle/contracts";
import {NonprofitEditorPage} from "@/components/nonprofit-bundle/editor";
export default async function Page({params}:{params:Promise<{kind:string;documentId:string}>}){const {kind,documentId}=await params,parsed=nonprofitKind.safeParse(kind);if(!parsed.success)notFound();return <NonprofitEditorPage kind={parsed.data} documentId={documentId}/>;}
