import { ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { editorTarget, editorDraftChange, editorDraftSnapshot } from "@/vendor/lead-emergence-bundles/domain-contracts/editor-recovery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"no-store, private", Vary:"Authorization"};
async function handle(request: Request, mutation: boolean) {
  try {
    const {client} = await authenticatedBundleClient(readBearerToken(request));
    const params = new URL(request.url).searchParams;
    let rpc: string, args: Record<string,unknown>;
    if (mutation) {
      if (params.size) throw new BundleApiError("Use the draft request body only.",400);
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new BundleApiError("Use a JSON request.",415);
      const reader=request.body?.getReader();
      if (!reader) throw new BundleApiError("Add your working draft request.",400);
      const chunks:Uint8Array[]=[];let size=0;
      try {
        for (;;) {
          const {done,value}=await reader.read();if(done)break;
          size+=value.byteLength;
          if(size>650000){await reader.cancel();throw new BundleApiError("This working draft is too large. Shorten it or split the record.",413);}
          chunks.push(value);
        }
      } finally {reader.releaseLock();}
      let raw:unknown;
      try {raw=JSON.parse(Buffer.concat(chunks).toString("utf8"));}
      catch {throw new BundleApiError("Check the draft request format.",400);}
      args={p_change:editorDraftChange.parse(raw)};rpc="native_change_editor_draft";
    } else {
      if ([...params.keys()].some(k=>!["domain","kind","documentId"].includes(k)||params.getAll(k).length!==1))
        throw new BundleApiError("Choose a single editor target.",400);
      args={p_target:editorTarget.parse({domain:params.get("domain"),kind:params.get("kind"),documentId:params.get("documentId")})};
      rpc="native_editor_draft";
    }
    const {data,error}=await client.rpc(rpc,args);
    if (error) {
      const status=error.code==="42501"?403:error.code==="P0002"?404:error.code==="40001"?409:["22023","22P02"].includes(error.code)?400:503;
      throw new BundleApiError(status===403?"Your access changed. Refresh before continuing."
        :status===404?"This editor record is unavailable."
        :status===409?"The working draft or saved record changed. Your edits did not overwrite it. Compare the latest work before continuing."
        :status===400?"Check the draft, its version and your confirmation. Unfinished fields must pass final validation before saving a record."
        :"Working draft recovery is temporarily unavailable. Retry the exact request safely.",status);
    }
    const verified=editorDraftSnapshot.safeParse(data);
    if (!verified.success) throw new BundleApiError("The working draft response could not be verified. Retry safely.",503);
    const requested=mutation?(args.p_change as {target:unknown}).target:args.p_target;
    if (JSON.stringify(verified.data.target)!==JSON.stringify(requested)) throw new BundleApiError("The editor response did not match the requested record.",503);
    return Response.json(verified.data,{headers});
  } catch (error) {
    const status=error instanceof BundleApiError?error.status:error instanceof ZodError?400:503;
    return Response.json({message:error instanceof BundleApiError?error.message:status===400?"Check this editor's working draft fields.":"Working draft recovery is temporarily unavailable."},{status,headers});
  }
}
export async function GET(request:Request){return handle(request,false);}
export async function POST(request:Request){return handle(request,true);}
