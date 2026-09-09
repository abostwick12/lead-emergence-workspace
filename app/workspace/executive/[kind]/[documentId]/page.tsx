import {notFound} from "next/navigation";
import {executiveKind} from "@/lib/executive-bundle/contracts";
import {ExecutiveEditorPage} from "@/components/executive-bundle/editor";
export default async function Page({params}:{params:Promise<{kind:string;documentId:string}>}){const {kind,documentId}=await params,parsed=executiveKind.safeParse(kind);if(!parsed.success)notFound();return <ExecutiveEditorPage kind={parsed.data} documentId={documentId}/>;}
