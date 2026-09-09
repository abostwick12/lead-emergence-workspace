import {notFound} from "next/navigation";
import {nonprofitKind} from "@/lib/nonprofit-bundle/contracts";
import {NonprofitLibrary} from "@/components/nonprofit-bundle/library";
export default async function Page({params}:{params:Promise<{kind:string}>}){const parsed=nonprofitKind.safeParse((await params).kind);if(!parsed.success)notFound();return <NonprofitLibrary kind={parsed.data}/>;}
