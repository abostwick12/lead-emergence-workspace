const DEFAULT_WORKSPACE_PATH = "/workspace";
const INERT_ORIGIN = "https://workspace-return-path.invalid";
const OAUTH_CONSENT_CONTINUATION = /^\/oauth\/consent\?authorization_id=[a-z2-7]{32}$/;

/**
 * Returns a normalized internal post-login path. Workspace queries and fragments
 * remain discarded; only an exact OAuth consent authorization ID may survive.
 */
export function normalizeWorkspaceReturnPath(candidate: string | null | undefined): string {
  if (typeof candidate !== "string" || !candidate || candidate.length > 2048) return DEFAULT_WORKSPACE_PATH;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || /[%\\\u0000-\u001f\u007f]/.test(candidate)) return DEFAULT_WORKSPACE_PATH;

  if (OAUTH_CONSENT_CONTINUATION.test(candidate)) return candidate;

  try {
    const parsed = new URL(candidate, INERT_ORIGIN);
    const pathname = parsed.pathname;
    return pathname === DEFAULT_WORKSPACE_PATH || pathname.startsWith(`${DEFAULT_WORKSPACE_PATH}/`)
      ? pathname
      : DEFAULT_WORKSPACE_PATH;
  } catch {
    return DEFAULT_WORKSPACE_PATH;
  }
}

export function workspaceLoginHref(currentPath: string | null | undefined): string {
  return `/login?next=${encodeURIComponent(normalizeWorkspaceReturnPath(currentPath))}`;
}
