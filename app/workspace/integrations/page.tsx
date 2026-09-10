"use client";
import {useWorkspace} from "@/components/workspace-provider";
import {ConnectionCenter} from "@/components/bundles/connection-center";
export default function IntegrationsPage(){
 const {user,workspace,bundleExperience}=useWorkspace();
 if(!user||!workspace)return <p role="status">Checking Workspace ownership…</p>;
 return <ConnectionCenter key={user.id+":"+workspace.id} workspaceId={workspace.id} bundleKeys={bundleExperience?.bundleKeys??[]}/>;
}
