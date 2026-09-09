"use client";
import Link from "next/link";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useWorkspace} from "@/components/workspace-provider";
export default function WorkspaceStartPage(){
 const {bundleExperience,bundleError,refreshBundleExperience}=useWorkspace(),router=useRouter();
 const unavailable=bundleExperience?.layout?.status==="unavailable";
 useEffect(()=>{
  if(!bundleExperience||unavailable)return;
  const route=bundleExperience.layout?.status==="ready"?bundleExperience.ui.defaultWorkspaceRoute:"/workspace";
  router.replace(route||"/workspace");
 },[bundleExperience,unavailable,router]);
 return <section className="panel"><h1>Opening your workspace</h1>{unavailable||bundleError?<><p role="alert">Your starting workspace could not be verified. No saved preference was changed.</p><button className="button" onClick={refreshBundleExperience}>Retry saved layout</button></>:<p role="status">Checking your saved starting workspace…</p>}<Link className="button secondary" href="/workspace">Open Home</Link></section>;
}
