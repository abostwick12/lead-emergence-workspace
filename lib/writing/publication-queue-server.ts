import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BundleApiError } from "@/lib/workspace/bundle-server";
import {
  publicationEvidenceInput, publicationQueueItem, publicationQueueReceipt,
  publicationQueueResult, publicationQueueSaveInput, publicationQueueStage
} from "./publication-readiness";

type Client = SupabaseClient<any,any,any,any,any>;
export const publicationQueueQuery = z.object({
  stage: publicationQueueStage.exclude(["removed"]).optional(),
  offset: z.number().int().min(0).max(10_000).default(0),
  limit: z.number().int().min(1).max(50).default(25)
}).strict();

function checked<T>(result:{data:unknown;error:{code?:string}|null},schema:z.ZodType<T>):T {
  if(result.error) {
    const code=result.error.code;
    throw new BundleApiError(
      code==="40001"?"The resource or publication queue changed. Your work was not overwritten; reload and review the latest version.":
      code==="42501"?"Publication readiness is unavailable, or this action requires your own confirmation in Workspace.":
      code==="P0002"?"Publication queue item unavailable.":
      code==="22023"?"Review the exact revision, destination, evidence, and confirmations before continuing.":
      "The publication queue is temporarily unavailable. You can safely retry.",
      code==="40001"?409:code==="42501"?403:code==="P0002"?404:code==="22023"?400:503
    );
  }
  return schema.parse(result.data);
}

export async function listPublicationQueue(client:Client,raw:unknown) {
  const input=publicationQueueQuery.parse(raw);
  return checked(await client.rpc("writer_list_publication_queue",{
    stage_filter:input.stage??null,page_offset:input.offset,page_size:input.limit
  }),publicationQueueResult);
}

export async function getPublicationQueueItem(client:Client,resourceId:unknown) {
  const id=z.string().uuid().parse(resourceId);
  return checked(await client.rpc("writer_get_publication_queue_item",{resource_id:id}),publicationQueueItem.nullable());
}

export async function savePublicationQueue(client:Client,raw:unknown) {
  const input=publicationQueueSaveInput.parse(raw);
  return checked(await client.rpc("writer_save_publication_queue",{
    resource_id:input.resourceId,expected_resource_revision:input.expectedResourceRevision,expected_version:input.expectedVersion,
    request_id:input.requestId,destination_url:input.destinationUrl,queue_note:input.note,queue_stage:input.stage,
    review_confirmations:input.confirmations,confirm_queue_change:input.confirmQueueChange
  }),publicationQueueReceipt);
}

export async function recordPublicationLink(client:Client,raw:unknown) {
  const input=publicationEvidenceInput.parse(raw);
  return checked(await client.rpc("writer_record_publication_link",{
    queue_id:input.queueId,expected_version:input.expectedVersion,request_id:input.requestId,observed_result:input.result,
    final_url:input.finalUrl,evidence_note:input.note,confirm_observation:input.confirmObservation
  }),publicationQueueReceipt);
}
