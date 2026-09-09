import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BundleApiError } from "@/lib/workspace/bundle-server";
import { bundleAuthoritySchema, composeBundleExperience } from "./experience";
import { personalizeBundleExperience } from "./layout";

// Native preferences are intentionally not used by the MCP tool registry.
export async function resolveNativeBundleExperience(client: SupabaseClient<any, any, any, any, any>, subjectId: string) {
 const base=await resolveBundleExperience(client,subjectId);
 if(!base.capabilityIds.includes("workspace.personalize")) return base;
 try { const {data,error}=await client.rpc("get_workspace_layout"); return personalizeBundleExperience(base,error?null:data); }
 catch { return personalizeBundleExperience(base,null); }
}
export async function resolveBundleExperience(client: SupabaseClient<any, any, any, any, any>, subjectId: string) {
  const { data, error } = await client.rpc("get_bundle_experience");
  if (error) throw new BundleApiError("Bundle access could not be verified.", error.code === "42501" ? 403 : 503);
  const parsed = bundleAuthoritySchema.safeParse(data);
  if (!parsed.success || parsed.data.subjectId !== subjectId) throw new BundleApiError("Bundle access could not be verified.", 503);
  return composeBundleExperience(parsed.data);
}
