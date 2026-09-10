"use client";
import {useWorkspace} from "@/components/workspace-provider";
import {NotificationCenter} from "@/components/bundles/notification-center";
export default function NotificationsPage(){
 const {user,workspace,bundleExperience,bundlesLoading,bundleError,refreshBundleExperience}=useWorkspace();
 if(bundlesLoading)return <p role="status">Checking notification access…</p>;
 if(bundleError)return <section className="panel"><p role="alert">Notification access could not be verified.</p><button className="button" onClick={refreshBundleExperience}>Retry access</button></section>;
 if(!bundleExperience?.capabilityIds.includes("workspace.notifications")||!workspace)return <section className="panel"><h1>Notifications are unavailable</h1><p>This account does not currently have native notification access. Your saved work is unchanged.</p></section>;
 return <><NotificationCenter key={user?.id+":"+workspace.id+":"+bundleExperience.revision} workspaceId={workspace.id} authorityRevision={bundleExperience.revision}/>
 <button className="button secondary" onClick={refreshBundleExperience}>Refresh workspace access</button></>;
}
