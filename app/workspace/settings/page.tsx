"use client";

import { useWorkspace } from "@/components/workspace-provider";

export default function SettingsPage() {
  const { user, workspace } = useWorkspace();
  return <><h1 className="page-title">Workspace settings</h1><p className="page-lede">This is a personal Workspace, not a ministry team or organization account.</p><section className="grid two"><article className="card"><h2>Membership</h2><p><strong>Owner:</strong> {user?.email}</p><p><strong>Workspace:</strong> {workspace?.name}</p><p><strong>Type:</strong> personal</p></article><article className="card"><h2>Leader Mode</h2><p className="notice">The entitlement foundation exists in the database as `leader_mode`. No entitlement can be self-granted through this application.</p></article></section></>;
}
