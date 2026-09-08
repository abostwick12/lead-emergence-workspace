import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BundleApiError } from "@/lib/workspace/bundle-server";
import { libraryResult, resourceResult, resourceSearch } from "./contracts";
import { reviewResource } from "./review";

function throwReadError(error: { code?: string } | null) {
  if (!error) return;
  throw new BundleApiError(error.code === "P0002" ? "Resource unavailable." : "Writing access could not be verified.",
    error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 503);
}
export async function listWritingResources(client: SupabaseClient<any, any, any, any, any>, raw: unknown) {
  const input = resourceSearch.parse(raw);
  const { data, error } = await client.rpc("writer_list_resources", {
    search_text: input.search, publication_filter: input.state ?? null, page_offset: input.offset, page_size: input.limit
  });
  throwReadError(error);
  return libraryResult.parse(data);
}
export async function getWritingResource(client: SupabaseClient<any, any, any, any, any>, id: string) {
  const { data, error } = await client.rpc("writer_get_resource", { resource_id: id });
  throwReadError(error);
  const result = resourceResult.parse(data);
  return { ...result, review: reviewResource(result.resource) };
}
