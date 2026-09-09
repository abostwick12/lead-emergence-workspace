"use client";
import {useWorkspace} from "@/components/workspace-provider";
import {WorkspaceLayoutEditor} from "@/components/bundles/workspace-layout-editor";
export default function WorkspaceLayoutPage(){
 const {user,workspace,bundleExperience,bundlesLoading,bundleError,refreshBundleExperience}=useWorkspace();
 if(bundlesLoading)return <p role="status">Checking workspace layout access…</p>;
 if(bundleError)return <section className="panel"><p role="alert">Workspace access could not be verified.</p><button className="button" onClick={refreshBundleExperience}>Retry access</button></section>;
 if(!bundleExperience?.capabilityIds.includes("workspace.personalize"))return <section className="panel"><h1>Workspace layout is unavailable</h1><p>This account does not currently have layout personalization access. Your saved work is unchanged.</p></section>;
 return <WorkspaceLayoutEditor key={user?.id+":"+workspace?.id} workspaceId={bundleExperience.workspaceId}/>;
}
