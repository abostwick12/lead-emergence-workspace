"use client";
import { getWorkspaceClient } from "@/lib/supabase/client";
export class WorkspaceReadError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function workspaceRead<T>(path: string, signal?: AbortSignal): Promise<T> {
  const { data, error } = await getWorkspaceClient().auth.getSession();
  if (error || !data.session) throw new WorkspaceReadError("Sign in to continue.", 401);
  const response = await fetch(path, {
    headers: { Authorization: "Bearer " + data.session.access_token }, cache: "no-store", signal
  });
  if (!response.ok) throw new WorkspaceReadError(
    response.status === 403 ? "Your access to Writing has changed." :
    response.status === 404 ? "This resource is unavailable." : "We couldn't load this information. Please try again.", response.status);
  return response.json() as Promise<T>;
}
