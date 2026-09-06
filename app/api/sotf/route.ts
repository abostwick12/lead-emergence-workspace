import { ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { RevisionConflict, resumeTransition } from "@/lib/sotf/engine";
import { createSotfStore, SotfPilotUnavailable } from "@/lib/sotf/server";
import { OperationNotApplied } from "@/lib/sotf/persistence";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private" };
function failure(error: unknown) {
  const status = error instanceof BundleApiError ? error.status : error instanceof SotfPilotUnavailable ? 503 : error instanceof RevisionConflict ? 409 : 400;
  const message = error instanceof ZodError ? "Review the required fields before saving. Only ordinary transition operations are accepted here." : error instanceof Error ? error.message : "The transition operation could not be verified.";
  // A transport error may occur after the event committed. Never claim the change was not saved.
  const knownNotSaved = error instanceof ZodError || error instanceof SyntaxError || error instanceof BundleApiError || error instanceof SotfPilotUnavailable || error instanceof RevisionConflict || error instanceof OperationNotApplied;
  return Response.json({ message, saved: knownNotSaved ? false : null, retry: status === 409 ? "refresh_and_review" : "verify_before_retry" }, { status, headers });
}
export async function GET(request: Request) {
  try {
    const { client } = await authenticatedBundleClient(readBearerToken(request));
    const result = await createSotfStore(client).read();
    return Response.json({ ...result, resume: resumeTransition(result.state) }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const { client } = await authenticatedBundleClient(readBearerToken(request));
    if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ message: "Use a JSON transition operation.", saved: false }, { status: 415, headers });
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 64000) return Response.json({ message: "This step is too large. Keep the operational excerpt focused.", saved: false }, { status: 413, headers });
    const result = await createSotfStore(client).execute(JSON.parse(body));
    return Response.json({ ...result, resume: resumeTransition(result.state), saved: true }, { headers });
  } catch (error) { return failure(error); }
}
