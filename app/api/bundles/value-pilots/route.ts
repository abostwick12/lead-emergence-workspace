import { z, ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { bundleValuePilotDefinitions } from "@/lib/bundles/experience";
import { resolveBundleExperience } from "@/lib/bundles/server";
import { valuePilotChange, valuePilotDashboard, valuePilotSession } from "@/vendor/lead-emergence-bundles/domain-contracts/value-pilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", Vary: "Authorization" };
const storedDashboard = z.object({
  schemaVersion: z.literal("1.0"), generatedAt: z.iso.datetime({ offset: true }),
  sessions: z.array(z.unknown()).max(120)
}).strict();

async function boundedJson(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new BundleApiError("Use a JSON value-check request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new BundleApiError("Add the value-check request.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 40_000) { await reader.cancel(); throw new BundleApiError("The value-check request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new BundleApiError("Check the value-check request format.", 400); }
}

function rpcFailure(error: { code?: string }) {
  const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404
    : error.code === "40001" ? 409 : ["22023", "22P02", "23514"].includes(error.code ?? "") ? 400 : 503;
  return new BundleApiError(status === 403 ? "Your bundle access changed. Refresh before continuing."
    : status === 404 ? "This value check is unavailable."
    : status === 409 ? "This value check changed. Review its current result before continuing."
    : status === 400 ? "Check the bounded value-check answers."
    : "Value checks are temporarily unavailable. Retry the exact request safely.", status);
}

async function context(request: Request) {
  const { client, user } = await authenticatedBundleClient(readBearerToken(request));
  const experience = await resolveBundleExperience(client, user.id);
  return { client, definitions: bundleValuePilotDefinitions(experience.capabilityIds) };
}

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.size) throw new BundleApiError("Value checks do not accept URL input.", 400);
    const { client, definitions } = await context(request);
    const { data, error } = await client.rpc("native_bundle_value_pilot_dashboard");
    if (error) throw rpcFailure(error);
    const stored = storedDashboard.parse(data);
    const verified = valuePilotDashboard.safeParse({ ...stored, definitions, sessions: stored.sessions.map(session => valuePilotSession.parse(session)) });
    if (!verified.success) throw new BundleApiError("The value-check response could not be verified.", 503);
    return Response.json(verified.data, { headers });
  } catch (error) {
    const status = error instanceof BundleApiError ? error.status : error instanceof ZodError ? 503 : 503;
    return Response.json({ message: error instanceof BundleApiError ? error.message : "Value checks are temporarily unavailable." }, { status, headers });
  }
}

export async function POST(request: Request) {
  try {
    if (new URL(request.url).searchParams.size) throw new BundleApiError("Use the value-check request body only.", 400);
    const change = valuePilotChange.parse(await boundedJson(request));
    const { client, definitions } = await context(request);
    const definition = change.operation === "start" ? definitions.find(item => item.bundleKey === change.bundleKey) : null;
    if (definition && !definition.available) throw new BundleApiError("This bundle is not currently available.", 403);
    const { data, error } = await client.rpc("native_change_bundle_value_pilot", { p_change: change });
    if (error) throw rpcFailure(error);
    const verified = valuePilotSession.safeParse(data);
    if (!verified.success) throw new BundleApiError("The value-check result could not be verified.", 503);
    if (definition && (verified.data.bundleKey !== definition.bundleKey || verified.data.manifestVersion !== definition.manifestVersion
      || verified.data.targetMinutes !== definition.targetMinutes
      || JSON.stringify(verified.data.availableSignalIds) !== JSON.stringify(definition.successSignals.map(signal => signal.id))
      || JSON.stringify(verified.data.requiredGates) !== JSON.stringify(definition.qualityGates)))
      throw new BundleApiError("The value-check definition is out of sync. Refresh before continuing.", 503);
    return Response.json(verified.data, { headers });
  } catch (error) {
    const status = error instanceof BundleApiError ? error.status : error instanceof ZodError ? 400 : 503;
    return Response.json({ message: error instanceof BundleApiError ? error.message
      : status === 400 ? "Check the bounded value-check answers." : "Value checks are temporarily unavailable." }, { status, headers });
  }
}
