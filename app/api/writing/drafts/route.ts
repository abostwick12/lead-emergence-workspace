import { ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { getWorkingDraft, saveWorkingDraft } from "@/lib/writing/library-server";
import { writingMutation } from "@/lib/writing/mutation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
  try {
    const {client}=await authenticatedBundleClient(readBearerToken(request)),params=new URL(request.url).searchParams;
    if([...params.keys()].some(key=>key!=="resourceId")) throw new BundleApiError("Use a resource ID only.",400);
    return Response.json(await getWorkingDraft(client,params.get("resourceId")),{headers});
  } catch(error) { return Response.json({message:"Your saved draft could not be loaded. Retry before editing."},{status:error instanceof BundleApiError?error.status:error instanceof ZodError?400:503,headers}); }
}
export async function POST(request:Request) { return writingMutation(request,saveWorkingDraft); }
