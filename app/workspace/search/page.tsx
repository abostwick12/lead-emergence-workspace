"use client";
import "./search.css";
import {useWorkspace} from "@/components/workspace-provider";
import {WorkspaceSearch} from "@/components/bundles/workspace-search";
export default function SearchPage(){
 const {user,workspace,bundleExperience,bundlesLoading,bundleError,refreshBundleExperience}=useWorkspace();
 if(bundlesLoading)return <p role="status">Checking search access…</p>;
 if(bundleError)return <section className="panel"><p role="alert">Search access could not be verified.</p><button className="button" onClick={refreshBundleExperience}>Retry access</button></section>;
 if(!bundleExperience?.capabilityIds.includes("workspace.search"))return <section className="panel"><h1>Workspace search is unavailable</h1><p>This account does not currently have shared search access. Your saved work is unchanged.</p></section>;
 return <WorkspaceSearch key={user?.id+":"+workspace?.id+":"+bundleExperience.revision} experience={bundleExperience}/>;
}
