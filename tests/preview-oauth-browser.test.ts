import { afterEach, expect, it, vi } from "vitest";
import { getWorkspaceClient } from "@/lib/supabase/client";
import { previewBrowserConfiguration, previewOAuthConfiguration, PREVIEW_PROJECT_URL, PREVIEW_SESSION_COOKIE } from "@/lib/auth/preview-oauth";

const createBrowserClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));
vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

afterEach(() => vi.unstubAllEnvs());

it("initializes Preview browser sessions with public configuration while the private origin pin is unavailable", () => {
  const origin = "https://workspace-preview-abc.vercel.app";
  const clientId = "11111111-1111-4111-8111-111111111111";
  vi.stubEnv("NEXT_PUBLIC_ENTRY_FIRST_PARTY_PREVIEW_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", PREVIEW_PROJECT_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public-key");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  vi.stubEnv("NEXT_PUBLIC_ENTRY_PREVIEW_CLIENT_ID", clientId);
  vi.stubEnv("ENTRY_PREVIEW_APPROVED_ORIGIN", undefined);

  expect(() => previewOAuthConfiguration()).toThrow("Preview OAuth boundary is not configured.");
  expect(() => getWorkspaceClient()).not.toThrow();
  expect(createBrowserClient).toHaveBeenCalledWith(PREVIEW_PROJECT_URL, "synthetic-public-key", expect.objectContaining({
    cookieOptions: { name: PREVIEW_SESSION_COOKIE, secure: true },
    global: { fetch: expect.any(Function) }
  }));
});

it.each([
  ["https://wrong.example", "https://workspace-preview-abc.vercel.app", "11111111-1111-4111-8111-111111111111"],
  [PREVIEW_PROJECT_URL, "http://workspace-preview-abc.vercel.app", "11111111-1111-4111-8111-111111111111"],
  [PREVIEW_PROJECT_URL, "https://workspace-preview-abc.vercel.app", "invalid"]
])("rejects invalid public Preview browser configuration %#", (project, origin, clientId) => {
  expect(() => previewBrowserConfiguration("true", project, origin, clientId)).toThrow("Preview OAuth boundary is not configured.");
});
