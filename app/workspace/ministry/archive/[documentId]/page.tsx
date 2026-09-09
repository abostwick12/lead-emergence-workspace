import {MinistryEditorPage} from "@/components/ministry-bundle/editor";
export default async function Page({params}:{params:Promise<{documentId:string}>}){const {documentId}=await params;return <MinistryEditorPage kind="archive" documentId={documentId}/>;}
