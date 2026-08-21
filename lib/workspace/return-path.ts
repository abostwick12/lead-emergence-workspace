const DEFAULT_WORKSPACE_PATH = "/workspace";
const INERT_ORIGIN = "https://workspace-return-path.invalid";

/**
 * Returns a normalized, internal Workspace pathname for post-login navigation.
 * Query and fragment values are deliberately discarded so legacy URLs cannot
 * forward identifiers, sessions, or other unreviewed state into Workspace.
 */
export function normalizeWorkspaceReturnPath(candidate: string | null | undefined): string {
  if (typeof candidate !== "string" || !candidate || candidate.length > 2048) return DEFAULT_WORKSPACE_PATH;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || /[%\\\u0000-\u001f\u007f]/.test(candidate)) return DEFAULT_WORKSPACE_PATH;

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
