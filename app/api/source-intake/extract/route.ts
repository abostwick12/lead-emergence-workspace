import { z, ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { extractSourceBytes, intakeFailure, SourceIntakeFailure } from "@/lib/source-intake/extract";
import { sourceIntakeLimits } from "@/lib/source-intake/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", Vary: "Authorization", "X-Content-Type-Options": "nosniff" };
const purposeSchema = z.enum(["writer_resource", "ministry_archive"]);

async function boundedBody(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > sourceIntakeLimits.maximumRequestBytes) throw intakeFailure("request_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw intakeFailure("missing_file");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > sourceIntakeLimits.maximumRequestBytes) { await reader.cancel(); throw intakeFailure("request_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function POST(request: Request) {
  try {
    const { client } = await authenticatedBundleClient(readBearerToken(request));
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new BundleApiError("Use a multipart document request.", 415);
    const bytes = await boundedBody(request);
    let form: FormData;
    try { form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
    catch { throw new BundleApiError("Check the document request.", 400); }
    const keys = [...form.keys()];
    if (keys.some(key => !["purpose", "file"].includes(key)) || form.getAll("purpose").length !== 1 || form.getAll("file").length !== 1)
      throw new BundleApiError("Send one document and one supported destination only.", 400);
    const purpose = purposeSchema.parse(form.get("purpose"));
    const file = form.get("file");
    if (!(file instanceof File)) throw intakeFailure("missing_file");
    const { error } = await client.rpc("authorize_source_intake", { p_purpose: purpose });
    if (error) throw new BundleApiError(error.code === "42501" ? error.message : error.code === "22023" ? "Choose a supported source destination." : "Source intake authorization is temporarily unavailable.", error.code === "42501" ? 403 : error.code === "22023" ? 400 : 503);
    const result = await extractSourceBytes({ fileName: file.name, mediaType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    return Response.json(result, { headers });
  } catch (error) {
    const status = error instanceof SourceIntakeFailure ? error.status : error instanceof BundleApiError ? error.status : error instanceof ZodError ? 400 : 503;
    const message = error instanceof SourceIntakeFailure || error instanceof BundleApiError ? error.message
      : status === 400 ? "Choose a supported source destination." : "Source extraction is temporarily unavailable. Try a text export instead.";
    return Response.json({ message }, { status, headers });
  }
}
