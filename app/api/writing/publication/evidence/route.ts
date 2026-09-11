import { recordPublicationLink } from "@/lib/writing/publication-queue-server";
import { writingMutation } from "@/lib/writing/mutation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){return writingMutation(request,recordPublicationLink,{missingMessage:"Add the observed destination result.",invalidMessage:"Record the exact public destination result you observed."});}
