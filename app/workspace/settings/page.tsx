"use client";

import { ClockSettings } from "@/components/clock-settings";
import { useWorkspace } from "@/components/workspace-provider";

export default function SettingsPage() {
  const { user, workspace } = useWorkspace();
  return <><p className="eyebrow workflow-kicker">Workspace</p><h1 className="page-title">Settings</h1><p className="page-lede">Manage the context for this private Lead Emergence Workspace.</p><section className="grid two"><article className="card"><h2>Membership</h2><p><strong>Owner:</strong> {user?.email}</p><p><strong>Workspace:</strong> {workspace?.name}</p><p><strong>Type:</strong> personal</p></article><article className="card"><h2>Leader Mode</h2><p className="notice">Leader Mode appears in the command center when it has been granted to this Workspace.</p></article><ClockSettings /></section></>;
}
