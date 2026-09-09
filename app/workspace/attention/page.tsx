"use client";
import {useWorkspace} from "@/components/workspace-provider";
import {WorkspaceAttention} from "@/components/bundles/workspace-attention";
export default function AttentionPage(){
 const {user,workspace,bundleExperience,bundlesLoading,bundleError,refreshBundleExperience}=useWorkspace();
 if(bundlesLoading)return <p role="status">Checking attention access…</p>;
 if(bundleError)return <section className="panel"><p role="alert">Attention access could not be verified.</p><button className="button" onClick={refreshBundleExperience}>Retry access</button></section>;
 if(!bundleExperience?.capabilityIds.includes("workspace.attention"))return <section className="panel"><h1>Workspace attention is unavailable</h1><p>This account does not currently have shared attention access. Your saved work is unchanged.</p></section>;
 return <WorkspaceAttention key={user?.id+":"+workspace?.id+":"+bundleExperience.revision} experience={bundleExperience}/>;
}
