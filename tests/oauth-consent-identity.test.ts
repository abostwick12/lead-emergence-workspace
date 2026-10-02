import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effect: undefined as (() => void | (() => void)) | undefined,
  captureEffect: true,
  authChanged: undefined as ((event: string, session: { user: { id: string; email?: string } } | null) => void) | undefined,
  approve: undefined as (() => void) | undefined,
  approveDisabled: true,
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  fetch: vi.fn(),
  replace: vi.fn(),
  assign: vi.fn(),
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
  useRef: <T>(initial: T) => {
    const index = fixture.index++;
    if (index === fixture.states.length) fixture.states.push({ current: initial });
    return fixture.states[index];
  },
  useEffect: (effect: () => void | (() => void)) => {
    if (fixture.captureEffect) fixture.effect = effect;
  }
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  getWorkspaceClient: () => ({ auth: {
    getUser: fixture.getUser, onAuthStateChange: fixture.onAuthStateChange
  } })
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
  const page = OAuthConsentPage();
  const actions = page.props.children.props.children.find(
    (child: { props?: { className?: string } } | null) => child?.props?.className === "consent-actions"
  );
  fixture.approve = actions.props.children[0].props.onClick;
  fixture.approveDisabled = actions.props.children[0].props.disabled;
  return renderToStaticMarkup(page);
}

describe("Workspace consent identity display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.states = [];
    fixture.index = 0;
    fixture.effect = undefined;
    fixture.captureEffect = true;
    fixture.authChanged = undefined;
    fixture.approve = undefined;
    fixture.approveDisabled = true;
    fixture.onAuthStateChange.mockImplementation((callback) => {
      fixture.authChanged = callback;
      return { data: { subscription: { unsubscribe: fixture.unsubscribe } } };
    });
    fixture.getUser.mockResolvedValue({ data: { user: { id: "verified-user", email: "andrew@leademergence.com" } }, error: null });
    fixture.resolveWorkspace.mockResolvedValue({ id: "workspace-1" });
    fixture.fetch.mockResolvedValue({ ok: true, json: async () => ({
      authorization_id: "a".repeat(32), client: { id: "client-1", name: "ChatGPT" }, scope: "openid email profile"
    }) });
    vi.stubGlobal("window", { location: {
      search: `?authorization_id=${"a".repeat(32)}&email=untrusted@example.test`,
      replace: fixture.replace,
      assign: fixture.assign
    } });
    vi.stubGlobal("fetch", fixture.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  async function loadConsent() {
    renderPage();
    fixture.captureEffect = false;
    const cleanup = fixture.effect?.();
    await vi.waitFor(() => expect(renderPage()).toContain("ChatGPT"));
    expect(fixture.approveDisabled).toBe(false);
    return cleanup;
  }

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

  it.each([
    { user: { id: "another-user", email: "andrew@leademergence.com" } },
    { user: { id: "verified-user", email: "another@example.test" } },
    null
  ])("invalidates the displayed identity and consent controls when the session changes", async (session) => {
    const cleanup = await loadConsent();
    const staleApprove = fixture.approve;
    fixture.authChanged?.("SIGNED_IN", session);
    const markup = renderPage();
    expect(markup).not.toContain("You are connecting as");
    expect(markup).toContain("signed-in account changed");
    expect(fixture.approveDisabled).toBe(true);
    staleApprove?.();
    expect(fixture.fetch).toHaveBeenCalledTimes(1);
    expect(fixture.assign).not.toHaveBeenCalled();
    if (typeof cleanup === "function") cleanup();
    expect(fixture.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not invalidate consent for a token refresh of the same identity", async () => {
    await loadConsent();
    fixture.authChanged?.("TOKEN_REFRESHED", { user: { id: "verified-user", email: "andrew@leademergence.com" } });
    expect(renderPage()).toContain("You are connecting as andrew@leademergence.com");
    expect(fixture.approveDisabled).toBe(false);
  });

  it("does not restore consent when account changes during initial loading", async () => {
    let finishWorkspace!: (workspace: { id: string }) => void;
    fixture.resolveWorkspace.mockImplementationOnce(() => new Promise((resolve) => { finishWorkspace = resolve; }));
    renderPage();
    fixture.captureEffect = false;
    fixture.effect?.();
    await vi.waitFor(() => expect(fixture.resolveWorkspace).toHaveBeenCalledTimes(1));
    fixture.authChanged?.("SIGNED_OUT", null);
    finishWorkspace({ id: "workspace-1" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(renderPage()).not.toContain("You are connecting as");
    expect(fixture.approveDisabled).toBe(true);
    expect(renderPage()).toContain("signed-in account changed");
  });

  it("blocks approval if identity changes during the fresh verification, even if it changes back", async () => {
    await loadConsent();
    let finishVerification!: (result: { data: { user: { id: string; email: string } }; error: null }) => void;
    fixture.getUser.mockImplementationOnce(() => new Promise((resolve) => { finishVerification = resolve; }));
    fixture.approve?.();
    fixture.authChanged?.("SIGNED_IN", { user: { id: "another-user", email: "another@example.test" } });
    fixture.authChanged?.("SIGNED_IN", { user: { id: "verified-user", email: "andrew@leademergence.com" } });
    finishVerification({ data: { user: { id: "verified-user", email: "andrew@leademergence.com" } }, error: null });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(renderPage()).not.toContain("You are connecting as");
    expect(fixture.approveDisabled).toBe(true);
    expect(fixture.fetch).toHaveBeenCalledTimes(1);
    expect(fixture.assign).not.toHaveBeenCalled();
  });

  it.each([
    { data: { user: { id: "another-user", email: "another@example.test" } }, error: null },
    { data: { user: null }, error: { message: "Invalid session" } }
  ])("rechecks identity before approval and sends no POST when it no longer matches", async (result) => {
    await loadConsent();
    fixture.getUser.mockResolvedValue(result);
    fixture.approve?.();
    await vi.waitFor(() => expect(renderPage()).toContain("signed-in account changed"));
    expect(renderPage()).not.toContain("You are connecting as");
    expect(fixture.approveDisabled).toBe(true);
    expect(fixture.getUser).toHaveBeenCalledTimes(2);
    expect(fixture.fetch).toHaveBeenCalledTimes(1);
    expect(fixture.assign).not.toHaveBeenCalled();
  });

  it("preserves approval for the same freshly verified identity", async () => {
    await loadConsent();
    fixture.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ redirect_url: "https://example.test/oauth/callback" }) });
    fixture.approve?.();
    await vi.waitFor(() => expect(fixture.assign).toHaveBeenCalledExactlyOnceWith("https://example.test/oauth/callback"));
    expect(fixture.getUser).toHaveBeenCalledTimes(2);
    expect(fixture.fetch).toHaveBeenLastCalledWith("/api/oauth/consent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorizationId: "a".repeat(32), decision: "approve" })
    });
  });
});
