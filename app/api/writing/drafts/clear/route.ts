import { clearWorkingDraft } from "@/lib/writing/library-server";
import { writingMutation } from "@/lib/writing/mutation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) { return writingMutation(request,clearWorkingDraft); }
