import {notFound} from "next/navigation";
import {executiveKind} from "@/lib/executive-bundle/contracts";
import {ExecutiveLibrary} from "@/components/executive-bundle/library";
export default async function Page({params}:{params:Promise<{kind:string}>}){const parsed=executiveKind.safeParse((await params).kind);if(!parsed.success)notFound();return <ExecutiveLibrary kind={parsed.data}/>;}
