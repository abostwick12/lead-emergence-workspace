import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { trustedWorkspaceOrigin } from "@/lib/http/origin";

export const professionalContextCsrfCookie = "workspace_pc_confirmation_csrf";

export class ProfessionalContextRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function createProfessionalContextCsrfToken() {
  return randomBytes(32).toString("base64url");
}

export function professionalContextCsrfCookieOptions(path: string) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path,
    maxAge: 30 * 60,
    priority: "high" as const,
  };
}

function tokensMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function assertFirstPartyProfessionalContextMutation(
  request: Request,
  submittedToken: string,
  cookieToken: string | undefined,
) {
  if (request.headers.has("authorization")) {
    throw new ProfessionalContextRequestError("Bearer authorization cannot confirm Professional Context changes.", 403);
  }
  const expectedOrigin = trustedWorkspaceOrigin(new URL(request.url).origin);
  if (request.headers.get("origin") !== expectedOrigin) {
    throw new ProfessionalContextRequestError("The confirmation request origin is not trusted.", 403);
  }
  if (request.headers.get("sec-fetch-site") !== "same-origin") {
    throw new ProfessionalContextRequestError("The confirmation must come from the first-party Workspace.", 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ProfessionalContextRequestError("The confirmation request format is invalid.", 415);
  }
  if (!cookieToken || !submittedToken || !tokensMatch(cookieToken, submittedToken)) {
    throw new ProfessionalContextRequestError("The confirmation session has expired. Reload the review.", 403);
  }
}
