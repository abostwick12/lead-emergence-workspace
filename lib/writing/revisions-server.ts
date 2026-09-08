import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BundleApiError } from "@/lib/workspace/bundle-server";
import { resourceDetail } from "./contracts";
import { decideProposalInput, decisionReceipt, importReceipt, importResourceInput, proposalReceipt, proposeRevisionInput, savedProposal } from "./revision-contracts";
type Client = SupabaseClient<any, any, any, any, any>;
function checked<T>(result: { data: unknown; error: { code?: string } | null }, schema: z.ZodType<T>): T {
  if (result.error) {
    const code = result.error.code;
    throw new BundleApiError(
      code === "40001" ? "This revision or request has changed. Refresh and compare before trying again." :
      code === "22023" ? "Check the changes and source details. Review pending proposals if the limit has been reached." :
      code === "42501" ? "Your access has changed, or this action needs your approval in Workspace." :
      code === "P0002" ? "This resource or proposal is unavailable." : "We couldn't save this change. You can safely retry.",
      code === "40001" ? 409 : code === "22023" ? 400 : code === "42501" ? 403 : code === "P0002" ? 404 : 503
    );
  }
  return schema.parse(result.data);
}
export async function importWritingResource(client: Client, raw: unknown) {
  const input = importResourceInput.parse(raw);
  return checked(await client.rpc("writer_import_resource", { request_id: input.requestId, resource_input: input.resource }), importReceipt);
}
export async function proposeWritingRevision(client: Client, raw: unknown) {
  const input = proposeRevisionInput.parse(raw);
  return checked(await client.rpc("writer_propose_revision", {
    request_id: input.requestId, resource_id: input.resourceId, base_revision: input.baseRevision,
    proposed_patch: input.patch, proposal_reason: input.reason, source_evidence: input.evidence
  }), proposalReceipt);
}
export async function decideWritingProposal(client: Client, raw: unknown) {
  const input = decideProposalInput.parse(raw);
  return checked(await client.rpc("writer_decide_proposal", {
    proposal_id: input.proposalId, expected_revision: input.expectedRevision, decision: input.decision
  }), decisionReceipt);
}
export const revisionHistory = z.object({
  proposals: z.array(savedProposal),
  revisions: z.array(z.object({
    resource_id: z.string().uuid(), revision: z.number().int().positive(), snapshot: resourceDetail,
    reason: z.string(), origin: z.enum(["recorded","user_import","user_approved_proposal"]), recorded_at: z.string()
  }).strict())
}).strict();
export async function getWritingHistory(client: Client, id: string) {
  return checked(await client.rpc("writer_get_revision_history", { resource_id: z.string().uuid().parse(id) }), revisionHistory);
}
