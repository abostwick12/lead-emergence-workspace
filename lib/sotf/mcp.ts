import "server-only";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { commandEnvelopeSchema } from "./contracts";
import { resumeTransition } from "./engine";
import { assessOpportunity, compareOffers, prepareInterview, prepareProfessionalChapter, dailyBrief, hypothesisLearning, prepareCoaching, prepareMeeting, recallStories, weeklyReview } from "./intelligence";
import { invitationDraft, proposeConversationTimes, schedulingSchema } from "./scheduling";
import { createSotfStore } from "./server";

const contract = { outputSchema: z.object({}).passthrough(), _meta: { securitySchemes: [{ type: "oauth2", scopes: ["openid", "email", "profile"] }] } };
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
async function result(operation: () => Promise<Record<string, unknown>>) {
  try {
    const value = await operation();
    return { content: [{ type: "text" as const, text: JSON.stringify(value) }], structuredContent: value };
  } catch (error) {
    return { isError: true, content: [{ type: "text" as const, text: error instanceof z.ZodError ? "Review this transition step's required fields and confirmation." : error instanceof Error ? error.message : "The transition result could not be verified." }] };
  }
}

/** Registered only when the product pilot is enabled; existing Professional Context tools are unchanged. */
export function registerSotfTools(server: McpServer, client: SupabaseClient<any, any, any, any, any>) {
  server.registerTool("sotf_resume_transition", {
    title: "Resume SOTF Bundle", description: "Begin every SOTF workflow here. Recover the fellow's decision, criteria, hypotheses, reviewed operational history, pending evidence, promises, and incomplete actions. Never restart intake or assume access to all ChatGPT history. Protected Professional Context is unavailable through this pilot; never copy protected material into operational records.",
    inputSchema: {}, annotations: readOnly, ...contract
  }, () => result(async () => {
    const { state, workspaceId } = await createSotfStore(client).read();
    return { workspaceId, ...resumeTransition(state), today: dailyBrief(state, new Date().toISOString()), operationalState: state };
  }));
  server.registerTool("sotf_prepare_next_move", {
    title: "Prepare an SOTF decision or conversation", description: "Assemble an opportunity assessment, relationship meeting brief, coaching preparation, hypothesis learning, weekly review, daily priorities, or older relevant stories from saved ordinary transition operations. Scores are transparent evidence judgments, never hiring probabilities. Use returned unknowns to conduct focused authorized research; cite sources and propose evidence for review.",
    inputSchema: { workflow: z.enum(["opportunity", "meeting", "coaching", "direction", "weekly", "daily", "stories", "interview", "offers", "professional_work", "scheduling", "invitation"]), recordId: z.string().max(100).optional(), query: z.string().max(1000).optional(), since: z.string().datetime({ offset: true }).optional(), availability: schedulingSchema.optional() }, annotations: readOnly, ...contract
  }, ({ workflow, recordId, query, since, availability }) => result(async () => {
    const { state } = await createSotfStore(client).read();
    const now = new Date().toISOString();
    if (["opportunity", "meeting", "direction", "interview"].includes(workflow) && !recordId) throw new Error("Choose the existing opportunity, meeting, or hypothesis from the resumed state.");
    if (workflow === "scheduling") { if (!availability) throw new Error("Supply offered times and calendar availability you explicitly checked. No live calendar connection is implied."); return { workflow, revision: state.revision, prepared: proposeConversationTimes(availability, now) }; }
    if (workflow === "invitation") { if (!recordId) throw new Error("Choose an agreed meeting."); return { workflow, revision: state.revision, draftForReview: invitationDraft(state, recordId) }; }
    const prepared = workflow === "interview" ? prepareInterview(state, recordId!, { interviewerContext: query }) : workflow === "offers" ? compareOffers(state) : workflow === "professional_work" ? prepareProfessionalChapter(state) : workflow === "opportunity" ? assessOpportunity(state, recordId!) : workflow === "meeting" ? prepareMeeting(state, recordId!) : workflow === "direction" ? hypothesisLearning(state, recordId!) : workflow === "coaching" ? prepareCoaching(state, since) : workflow === "weekly" ? weeklyReview(state, since ?? new Date(Date.now() - 7 * 86400000).toISOString()) : workflow === "stories" ? recallStories(state, query ?? "") : dailyBrief(state, now);
    return { workflow, revision: state.revision, prepared };
  }));
  server.registerTool("sotf_record_transition_step", {
    title: "Save a reviewed SOTF workflow step", description: "Persist one ordinary transition step that the fellow explicitly requested or confirmed. Generate one requestId and reuse the exact request on uncertain retry. Use expectedRevision from resumed state. New evidence stays pending until reviewed; criteria change only by explicit confirmation. Read the result to prove persistence. Draft/approval never means sent, invited, applied, or accepted. Outbound execution is manual in this pilot; only record a real result after the fellow verifies it. This tool never sends messages or invitations, changes protected Professional Context, or silently infers durable preferences.",
    inputSchema: commandEnvelopeSchema.shape, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, ...contract
  }, (input) => result(async () => {
    const saved = await createSotfStore(client).execute(input);
    return { workspaceId: saved.workspaceId, saved: true, replayed: saved.replayed, ...resumeTransition(saved.state) };
  }));
  server.registerPrompt("sotf_bundle", { title: "Continue my SOTF Bundle", description: "A persistent transition decision and follow-through workflow." }, async () => ({ messages: [{ role: "user", content: { type: "text", text: "Continue my SOTF Bundle. Recover my current state first. Help with the most useful decision or conversation. Use relevant confirmed criteria and evidence; show what changes the answer. Ask only for missing information. Research sources explicitly and keep company claims, practitioner reports, community signals, and inference distinct. Finish with a reviewed decision, linked evidence, a next action or deliberate pause, and a revisit trigger. Keep protected context within its approved boundary. Preview outbound actions; never claim execution from preparation or approval alone." } }] }));
}
