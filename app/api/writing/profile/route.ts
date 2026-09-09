import {getWritingProfile,saveWritingProfile} from "@/lib/writing/profile-server";
import {preparationQuery,preparationRead} from "@/lib/writing/preparation-http";
import {writingMutation} from "@/lib/writing/mutation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){return preparationRead(request,client=>{preparationQuery(request,[]);return getWritingProfile(client);});}
export async function POST(request:Request){return writingMutation(request,saveWritingProfile);}
