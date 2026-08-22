import type { NextRequest } from "next/server";
import { updateWorkspaceSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateWorkspaceSession(request);
}

export const config = {
  matcher: ["/workspace/:path*", "/login", "/auth/:path*", "/oauth/:path*"]
};
