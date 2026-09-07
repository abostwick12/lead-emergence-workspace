import "server-only";

import { createHmac } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { trustedWorkspaceOrigin } from "@/lib/http/origin";
import { createWorkspaceBearerClient } from "@/lib/supabase/server";

export class BundleApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function readBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) throw new BundleApiError("Sign in before managing a bundle.", 401);
  return token;
}

export async function authenticatedBundleClient(accessToken: string): Promise<{
  client: SupabaseClient<any, any, any, any, any>;
  user: User;
}> {
  const client = createWorkspaceBearerClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new BundleApiError("Sign in before managing a bundle.", 401);
  return { client, user: data.user };
}

export function stableBundleInviteToken(input: {
  operatorUserId: string;
  recipientEmail: string;
  bundleKey: string;
  idempotencyKey: string;
}, configuredSecret = process.env.BUNDLE_INVITE_TOKEN_SECRET): string {
  const secret = configuredSecret?.trim();
  if (!secret || secret.length < 32) {
    throw new BundleApiError("Bundle invite issuance is not configured.", 503);
  }
  const payload = [
    "lead-emergence-bundle-invite-v1",
    input.operatorUserId,
    input.recipientEmail.toLowerCase(),
    input.bundleKey,
    input.idempotencyKey
  ].join("\n");
  return `bi1.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function bundleInviteUrl(token: string): string {
  const url = new URL("/workspace/bundles/invite", trustedWorkspaceOrigin(process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"));
  url.searchParams.set("token", token);
  return url.toString();
}

export async function bundleRpc<T>(
  client: SupabaseClient<any, any, any, any, any>,
  functionName: string,
  parameters: Record<string, unknown>,
  fallbackMessage: string
): Promise<T> {
  const { data, error } = await client.rpc(functionName, parameters);
  if (error) {
    const authorizationFailure = error.code === "42501";
    throw new BundleApiError(authorizationFailure ? error.message : fallbackMessage, authorizationFailure ? 403 : 400);
  }
  if (data === null || data === undefined) throw new BundleApiError(fallbackMessage, 400);
  return data as T;
}

export function bundleErrorResponse(error: unknown, fallbackMessage: string): Response {
  if (error instanceof BundleApiError) {
    return Response.json({ message: error.message }, { status: error.status });
  }
  return Response.json({ message: fallbackMessage }, { status: 400 });
}
