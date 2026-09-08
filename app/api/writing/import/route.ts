import { writingMutation } from "@/lib/writing/mutation-http";
import { importWritingResource } from "@/lib/writing/revisions-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return writingMutation(request, importWritingResource); }
