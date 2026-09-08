import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BundleApiError } from "@/lib/workspace/bundle-server";
import { bundleAuthoritySchema, composeBundleExperience } from "./experience";

export async function resolveBundleExperience(client: SupabaseClient<any, any, any, any, any>, subjectId: string) {
  const { data, error } = await client.rpc("get_bundle_experience");
  if (error) throw new BundleApiError("Bundle access could not be verified.", error.code === "42501" ? 403 : 503);
  const parsed = bundleAuthoritySchema.safeParse(data);
  if (!parsed.success || parsed.data.subjectId !== subjectId) throw new BundleApiError("Bundle access could not be verified.", 503);
  return composeBundleExperience(parsed.data);
}
