"use client";

import type { User } from "@supabase/supabase-js";
import { getWorkspaceClient } from "@/lib/supabase/client";
import type { WorkspaceRecord } from "@/lib/workspace/types";

export async function resolvePersonalWorkspace(user: User): Promise<WorkspaceRecord> {
  const supabase = getWorkspaceClient();
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle<{ workspace_id: string }>();
  if (membershipError) throw new Error(membershipError.message);
  if (!membership) throw new Error("No active personal Workspace membership was found for this account.");

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, name, workspace_type, owner_user_id")
    .eq("id", membership.workspace_id)
    .eq("workspace_type", "personal")
    .eq("owner_user_id", user.id)
    .maybeSingle<WorkspaceRecord>();
  if (workspaceError) throw new Error(workspaceError.message);
  if (!workspace) throw new Error("The active membership does not resolve to this account's personal Workspace.");
  return workspace;
}
