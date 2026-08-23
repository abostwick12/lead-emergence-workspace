"use client";

import type { User } from "@supabase/supabase-js";
import { getWorkspaceClient } from "@/lib/supabase/client";
import type { WorkspaceRecord } from "@/lib/workspace/types";

export async function resolvePersonalWorkspace(user: User): Promise<WorkspaceRecord> {
  const supabase = getWorkspaceClient();
  const { data, error } = await supabase.rpc("ensure_personal_workspace").single<WorkspaceRecord>();
  if (error) throw new Error(error.message);
  if (!data || data.owner_user_id !== user.id || data.workspace_type !== "personal") {
    throw new Error("The verified account did not resolve to its Personal Workspace.");
  }
  return data;
}
