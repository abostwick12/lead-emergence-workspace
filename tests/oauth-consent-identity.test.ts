import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effect: undefined as (() => void) | undefined,
  captureEffect: true,
  getUser: vi.fn(),
  fetch: vi.fn(),
  replace: vi.fn(),
  resolveWorkspace: vi.fn()
}));

// Exercise the page's async effect and render its resulting state without adding a DOM dependency.
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: <T>(initial: T) => {
    const index = fixture.index++;
    if (index === fixture.states.length) fixture.states.push(initial);
    return [fixture.states[index] as T, (next: T | ((previous: T) => T)) => {
      fixture.states[index] = typeof next === "function"
        ? (next as (previous: T) => T)(fixture.states[index] as T)
        : next;
    }];
  },
  useEffect: (effect: () => void) => {
    if (fixture.captureEffect) fixture.effect = effect;
  }
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  getWorkspaceClient: () => ({ auth: { getUser: fixture.getUser } })
}));
vi.mock("@/lib/workspace/provision", () => ({ resolvePersonalWorkspace: fixture.resolveWorkspace }));
vi.mock("@/lib/workspace/repository", () => ({
  getPersonalPlan: async () => ({ plan_key: "personal", status: "active" }),
  listPlanCapabilities: async () => []
}));
vi.mock("@/lib/workspace/capabilities", () => ({ resolveCapabilities: () => ({ workspace_mcp: true }) }));

import OAuthConsentPage from "@/app/oauth/consent/page";

function renderPage() {
  fixture.index = 0;
  return renderToStaticMarkup(createElement(OAuthConsentPage));
}

describe("Workspace consent identity display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.states = [];
    fixture.index = 0;
    fixture.effect = undefined;
    fixture.captureEffect = true;
    fixture.getUser.mockResolvedValue({ data: { user: { id: "verified-user", email: "andrew@leademergence.com" } }, error: null });
    fixture.resolveWorkspace.mockResolvedValue({ id: "workspace-1" });
    fixture.fetch.mockResolvedValue({ ok: true, json: async () => ({
      authorization_id: "a".repeat(32), client: { id: "client-1", name: "ChatGPT" }, scope: "openid email profile"
    }) });
    vi.stubGlobal("window", { location: {
      search: `?authorization_id=${"a".repeat(32)}&email=untrusted@example.test`,
      replace: fixture.replace
    } });
    vi.stubGlobal("fetch", fixture.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(["andrew@leademergence.com", "another@example.test"])("renders verified email %s, never the URL email", async (email) => {
    fixture.getUser.mockResolvedValue({ data: { user: { id: "verified-user", email } }, error: null });
    expect(renderPage()).not.toContain("You are connecting as");
    fixture.captureEffect = false;
    fixture.effect?.();
    await vi.waitFor(() => expect(renderPage()).toContain("ChatGPT"));

    const markup = renderPage();
    expect(markup).toContain(`You are connecting as ${email}`);
    expect(markup).not.toContain("untrusted@example.test");
    expect(markup).toContain("Allow access to Workspace?");
    expect(markup).toContain("Requested identity scopes: openid, email, profile");
    expect(fixture.getUser).toHaveBeenCalledTimes(1);
    expect(fixture.fetch).toHaveBeenCalledExactlyOnceWith(
      `/api/oauth/consent?authorization_id=${"a".repeat(32)}`, { cache: "no-store" }
    );
    expect(fixture.replace).not.toHaveBeenCalled();
  });

  it.each([
    { data: { user: null }, error: null },
    { data: { user: { email: "unverified@example.test" } }, error: { message: "Invalid session" } }
  ])("does not display identity or fetch consent when getUser fails", async (result) => {
    fixture.getUser.mockResolvedValue(result);
    renderPage();
    fixture.captureEffect = false;
    fixture.effect?.();
    await vi.waitFor(() => expect(fixture.replace).toHaveBeenCalledExactlyOnceWith(
      `/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${"a".repeat(32)}`)}`
    ));
    expect(renderPage()).not.toContain("You are connecting as");
    expect(fixture.fetch).not.toHaveBeenCalled();
    expect(fixture.resolveWorkspace).not.toHaveBeenCalled();
  });
});
