import { ZodError } from "zod";
import { authenticatedBundleClient, BundleApiError, readBearerToken } from "@/lib/workspace/bundle-server";
import { findWritingConnections } from "@/lib/writing/library-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{resourceId:string}>}) {
  const headers={"Cache-Control":"no-store, private",Vary:"Authorization"};
  try {
    const {client}=await authenticatedBundleClient(readBearerToken(request)),{resourceId}=await context.params;
    return Response.json(await findWritingConnections(client,{resourceId}),{headers});
  } catch(error) { return Response.json({message:"Resource connections are unavailable. Please retry."},{status:error instanceof BundleApiError?error.status:error instanceof ZodError?400:503,headers}); }
}
