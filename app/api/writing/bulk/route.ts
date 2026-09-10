import { ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { getSourceBatch, saveSourceBatch } from "@/lib/writing/batch-server";
import { writingMutation } from "@/lib/writing/mutation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
export async function GET(request:Request) {
  try {
    const {client}=await authenticatedBundleClient(readBearerToken(request));
    return Response.json(await getSourceBatch(client),{headers});
  } catch(error) {
    const status=error instanceof BundleApiError?error.status:error instanceof ZodError?400:503;
    const message=error instanceof BundleApiError?error.message:status===400?"Check the staging request.":"Your private staging list could not be loaded. Retry before importing.";
    return Response.json({message},{status,headers});
  }
}
export async function POST(request:Request) { return writingMutation(request,saveSourceBatch,{missingMessage:"Add at least one staged resource.",tooLargeMessage:"This staging list is too large. Use no more than 20 resources and 500,000 extracted characters.",invalidMessage:"Check the staged titles, sources, types, and current version."}); }
