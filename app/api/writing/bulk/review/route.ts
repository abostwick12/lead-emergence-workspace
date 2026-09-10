import { reviewSourceBatch } from "@/lib/writing/batch-server";
import { writingMutation } from "@/lib/writing/mutation-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) { return writingMutation(request,reviewSourceBatch,{invalidMessage:"Save the current staging list before reviewing duplicates."}); }
