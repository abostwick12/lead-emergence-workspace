import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BundleApiError } from "@/lib/workspace/bundle-server";
import {
  clearSourceBatchInput, commitSourceBatchInput, reviewSourceBatchInput, saveSourceBatchInput,
  sourceBatchCommit, sourceBatchReview, sourceBatchSnapshot
} from "./batch-contracts";

type Client = SupabaseClient<any,any,any,any,any>;
function checked<T>(result:{data:unknown;error:{code?:string}|null},schema:z.ZodType<T>):T {
  if(result.error) {
    const code=result.error.code;
    throw new BundleApiError(
      code==="40001" ? "The staging list or duplicate evidence changed. Your work was not overwritten; reload it and review again." :
      code==="42501" ? "Your access changed, or this action is only available in the native Writer workspace." :
      code==="22023" ? "Check the staged resources, current version, and duplicate review." :
      "The private staging list is temporarily unavailable. You can safely retry.",
      code==="40001"?409:code==="42501"?403:code==="22023"?400:503
    );
  }
  return schema.parse(result.data);
}
export async function getSourceBatch(client:Client) {
  return checked(await client.rpc("writer_get_import_batch"),sourceBatchSnapshot);
}
export async function saveSourceBatch(client:Client,raw:unknown) {
  const input=saveSourceBatchInput.parse(raw);
  return checked(await client.rpc("writer_save_import_batch",{
    expected_version:input.expectedVersion,request_id:input.requestId,items:input.items
  }),sourceBatchSnapshot);
}
export async function clearSourceBatch(client:Client,raw:unknown) {
  const input=clearSourceBatchInput.parse(raw);
  return checked(await client.rpc("writer_clear_import_batch",{expected_version:input.expectedVersion}),sourceBatchSnapshot);
}
export async function reviewSourceBatch(client:Client,raw:unknown) {
  const input=reviewSourceBatchInput.parse(raw);
  return checked(await client.rpc("writer_review_import_batch",{expected_version:input.expectedVersion}),sourceBatchReview);
}
export async function commitSourceBatch(client:Client,raw:unknown) {
  const input=commitSourceBatchInput.parse(raw);
  return checked(await client.rpc("writer_commit_import_batch",{
    expected_version:input.expectedVersion,request_id:input.requestId,review_token:input.reviewToken,confirmed:input.confirm
  }),sourceBatchCommit);
}
