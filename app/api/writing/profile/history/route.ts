import {getWritingProfileHistory} from "@/lib/writing/profile-server";
import {preparationQuery,preparationRead} from "@/lib/writing/preparation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){return preparationRead(request,client=>{preparationQuery(request,[]);return getWritingProfileHistory(client);});}
