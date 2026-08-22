import "server-only";

export function trustedWorkspaceOrigin(requestOrigin: string) {
  if (process.env.NODE_ENV !== "production") {
    const parsed = new URL(requestOrigin);
    if (["localhost", "127.0.0.1"].includes(parsed.hostname)) return parsed.origin;
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://workspace.leademergence.com";
  const parsed = new URL(configured);
  if (parsed.username || parsed.password) throw new Error("Workspace origin cannot contain credentials.");
  if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("Workspace production origin must use HTTPS.");
  return parsed.origin;
}
