"use client";

import type { User } from "@supabase/supabase-js";
import { getWorkspaceClient } from "@/lib/supabase/client";
import type { WorkspaceRecord } from "@/lib/workspace/types";

function workspaceName(user: User): string {
  const profileName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  return `${profileName || user.email?.split("@")[0] || "My"}'s Workspace`;
}

export async function provisionPersonalWorkspace(user: User): Promise<WorkspaceRecord> {
  const supabase = getWorkspaceClient();
  const ensureOwnerMembership = async (workspaceId: string) => {
    const { error } = await supabase
      .from("workspace_memberships")
      .upsert({ workspace_id: workspaceId, user_id: user.id, role: "owner", status: "active" }, { onConflict: "workspace_id,user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  };
  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      display_name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() || null : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago"
    },
    { onConflict: "user_id" }
  );
  if (profileError) throw new Error(profileError.message);

  const lookup = () =>
    supabase
      .from("workspaces")
      .select("id, name, workspace_type, owner_user_id")
      .eq("workspace_type", "personal")
      .eq("owner_user_id", user.id)
      .maybeSingle<WorkspaceRecord>();
  const { data: existing, error: existingError } = await lookup();
  if (existingError) throw new Error(existingError.message);
  if (existing) {
    await ensureOwnerMembership(existing.id);
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from("workspaces")
    .insert({ workspace_type: "personal", name: workspaceName(user), owner_user_id: user.id })
    .select("id, name, workspace_type, owner_user_id")
    .single<WorkspaceRecord>();

  if (createError) {
    const { data: concurrent, error: concurrentError } = await lookup();
    if (concurrentError || !concurrent) throw new Error(createError.message);
    await ensureOwnerMembership(concurrent.id);
    return concurrent;
  }

  await ensureOwnerMembership(created.id);
  return created;
}
