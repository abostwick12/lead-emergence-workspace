import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BundleApiError } from "@/lib/workspace/bundle-server";
import { clearDraftInput, saveDraftInput, workingDraft } from "./draft-contracts";
import { connectionInput, writingConnections } from "./discovery-contracts";
type Client = SupabaseClient<any,any,any,any,any>;
function checked<T>(data:unknown,error:{code?:string}|null,schema:z.ZodType<T>) {
  if(error) throw new BundleApiError(
    error.code === "40001" ? "Another version was saved. Your edits have not overwritten it. Copy your work before loading the saved draft." :
    error.code === "42501" ? "Your access has changed, or this action is only available in the native editor." :
    error.code === "P0002" ? "Resource unavailable." : error.code === "22023" ? "Check the draft size and fields." : "This information is temporarily unavailable. Please retry.",
    error.code === "40001" ? 409 : error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "22023" ? 400 : 503
  );
  return schema.parse(data);
}
export async function getWorkingDraft(client:Client,resourceId:string|null) {
  const {data,error}=await client.rpc("writer_get_working_draft",{resource_id:z.string().uuid().nullable().parse(resourceId)});
  return checked(data,error,workingDraft);
}
export async function saveWorkingDraft(client:Client,raw:unknown) {
  const i=saveDraftInput.parse(raw);
  const {data,error}=await client.rpc("writer_save_working_draft",{resource_id:i.resourceId,expected_version:i.expectedVersion,base_revision:i.baseRevision,request_id:i.requestId,draft_values:i.values});
  return checked(data,error,workingDraft);
}
export async function clearWorkingDraft(client:Client,raw:unknown) {
  const i=clearDraftInput.parse(raw),{data,error}=await client.rpc("writer_clear_working_draft",{resource_id:i.resourceId,expected_version:i.expectedVersion});
  return checked(data,error,workingDraft);
}
export async function findWritingConnections(client:Client,raw:unknown) {
  const i=connectionInput.parse(raw),{data,error}=await client.rpc("writer_find_connections",{resource_id:i.resourceId,result_limit:i.limit});
  return checked(data,error,writingConnections);
}
