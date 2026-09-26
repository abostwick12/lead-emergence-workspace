import { afterEach, describe, expect, it, vi } from "vitest";

const authorizationId = "f4471ae2-7cbb-46c7-837c-519c134687e8";
const clientId = "30924308-553d-4f75-946a-e12c61567fa5";
const firstAttempt = "eea036f4-1c09-40c3-9314-81feb374ad28";
const secondAttempt = "0abecae7-3581-40cb-ad4e-077f280f39b5";
const redirectUrl = "https://chatgpt.com/connector/oauth/callback?code=do-not-log-this-code";

type Element = { type?: unknown; props?: Record<string, unknown> };

function findButtons(node: unknown): Array<{ props: { onClick: () => void } }> {
  if (Array.isArray(node)) return node.flatMap(findButtons);
  if (!node || typeof node !== "object") return [];
  const element = node as Element;
  const children = findButtons(element.props?.children);
  return element.type === "button" ? [{ props: element.props as { onClick: () => void } }, ...children] : children;
}

async function loadConsentPage(approval: ReturnType<typeof vi.fn>, diagnosticFetch?: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  const state: unknown[] = [];
  const effects: Array<() => void> = [];
  let hookIndex = 0;
  vi.doMock("react", () => ({
    useState: (initial: unknown) => {
      const index = hookIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (next: unknown) => { state[index] = typeof next === "function" ? (next as (value: unknown) => unknown)(state[index]) : next; }];
    },
    useEffect: (effect: () => void) => { effects.push(effect); },
  }));
  const deny = vi.fn();
  const client = { auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "2e19ed32-c317-4763-83a7-cc18a4380df5" } }, error: null }),
    oauth: {
      getAuthorizationDetails: vi.fn().mockResolvedValue({ data: { authorization_id: authorizationId, client: { id: clientId } }, error: null }),
      approveAuthorization: approval,
      denyAuthorization: deny,
    },
  } };
  vi.doMock("@/lib/supabase/client", () => ({ getWorkspaceClient: () => client }));
  vi.doMock("@/lib/workspace/provision", () => ({ resolvePersonalWorkspace: async () => ({ id: "workspace-test" }) }));
  vi.doMock("@/lib/workspace/repository", () => ({
    getPersonalPlan: async () => ({ status: "active", plan_key: "personal" }),
    listPlanCapabilities: async () => [],
  }));
  vi.doMock("@/lib/workspace/capabilities", () => ({ resolveCapabilities: () => ({ workspace_mcp: true }) }));
  const assign = vi.fn();
  const replace = vi.fn();
  vi.stubGlobal("window", { location: { search: `?authorization_id=${authorizationId}`, assign, replace } });
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce(firstAttempt).mockReturnValueOnce(secondAttempt) });
  const events: Array<Record<string, unknown>> = [];
  const fetchMock = diagnosticFetch ?? vi.fn(async (_url: string, options: { body: string }) => {
    events.push(JSON.parse(options.body));
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const { default: Page } = await import("@/app/oauth/consent/page");
  const render = () => { hookIndex = 0; return Page(); };
  render();
  effects[0]();
  await vi.waitFor(() => expect(state[0]).not.toBeNull());
  const clickAllow = () => findButtons(render())[0].props.onClick();
  return { state, events, assign, replace, approval, deny, clickAllow, fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("react");
  vi.doUnmock("@/lib/supabase/client");
  vi.doUnmock("@/lib/workspace/provision");
  vi.doUnmock("@/lib/workspace/repository");
  vi.doUnmock("@/lib/workspace/capabilities");
});

describe("OAuth consent page diagnostic sequence", () => {
  it("emits ordered success stages and preserves approval arguments and redirect destination", async () => {
    const approval = vi.fn().mockResolvedValue({ data: { redirect_url: redirectUrl }, error: null });
    const page = await loadConsentPage(approval);
    page.clickAllow();
    await vi.waitFor(() => expect(page.assign).toHaveBeenCalledWith(redirectUrl));
    expect(approval).toHaveBeenCalledExactlyOnceWith(authorizationId, { skipBrowserRedirect: true });
    expect(page.deny).not.toHaveBeenCalled();
    expect(page.replace).not.toHaveBeenCalled();
    expect(page.events.map(({ stage, sequence, attempt_id }) => ({ stage, sequence, attempt_id }))).toEqual([
      { stage: "allow_started", sequence: 0, attempt_id: firstAttempt },
      { stage: "approval_attempted", sequence: 1, attempt_id: firstAttempt },
      { stage: "approval_result", sequence: 2, attempt_id: firstAttempt },
      { stage: "redirect_selected", sequence: 3, attempt_id: firstAttempt },
    ]);
    expect(page.events[2]).toMatchObject({ outcome: "success", redirect_kind: "authorization_code" });
    expect(page.fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "same-origin", keepalive: true });
    expect(JSON.stringify(page.events)).not.toContain("do-not-log-this-code");
  });

  it("emits ordered failure stages, then uses a new attempt ID on retry", async () => {
    const approval = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { name: "AuthApiError", code: "invalid_request", status: 400, message: "secret-not-logged" } })
      .mockResolvedValueOnce({ data: { redirect_url: redirectUrl }, error: null });
    const page = await loadConsentPage(approval);
    page.clickAllow();
    await vi.waitFor(() => expect(page.state[3]).toBe("The authorization decision could not be completed safely."));
    expect(page.assign).not.toHaveBeenCalled();
    expect(page.events.map((event) => event.stage)).toEqual(["allow_started", "approval_attempted", "approval_result", "redirect_selected"]);
    expect(page.events[2]).toMatchObject({ outcome: "error", error_code: "invalid_request", error_status: 400 });
    expect(page.events[3]).toMatchObject({ branch: "stay_on_error" });
    page.clickAllow();
    await vi.waitFor(() => expect(page.assign).toHaveBeenCalledWith(redirectUrl));
    expect(page.events.map((event) => event.attempt_id)).toEqual([
      firstAttempt, firstAttempt, firstAttempt, firstAttempt,
      secondAttempt, secondAttempt, secondAttempt, secondAttempt,
    ]);
    expect(page.events.map((event) => event.sequence)).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
    expect(approval).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(page.events)).not.toContain("secret-not-logged");
  });

  it("continues the existing approval and redirect when diagnostic delivery fails", async () => {
    const approval = vi.fn().mockResolvedValue({ data: { redirect_url: redirectUrl }, error: null });
    const fetchMock = vi.fn().mockRejectedValue(new Error("diagnostic unavailable"));
    const page = await loadConsentPage(approval, fetchMock);
    page.clickAllow();
    await vi.waitFor(() => expect(page.assign).toHaveBeenCalledWith(redirectUrl));
    expect(approval).toHaveBeenCalledExactlyOnceWith(authorizationId, { skipBrowserRedirect: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("waits for each stage before sending the next one", async () => {
    const approval = vi.fn().mockResolvedValue({ data: { redirect_url: redirectUrl }, error: null });
    let releaseFirst: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { releaseFirst = resolve; }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    const page = await loadConsentPage(approval, fetchMock);
    page.clickAllow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(approval).not.toHaveBeenCalled();
    releaseFirst?.(new Response(null, { status: 204 }));
    await vi.waitFor(() => expect(page.assign).toHaveBeenCalledWith(redirectUrl));
    expect(fetchMock.mock.calls.map((call) => JSON.parse(call[1].body).sequence)).toEqual([0, 1, 2, 3]);
  });

  it("continues approval after bounded diagnostic timeouts", async () => {
    const approval = vi.fn().mockResolvedValue({ data: { redirect_url: redirectUrl }, error: null });
    const fetchMock = vi.fn(() => new Promise(() => {}));
    const page = await loadConsentPage(approval, fetchMock);
    vi.useFakeTimers();
    try {
      page.clickAllow();
      for (let stage = 0; stage < 4; stage += 1) await vi.advanceTimersByTimeAsync(750);
      expect(approval).toHaveBeenCalledExactlyOnceWith(authorizationId, { skipBrowserRedirect: true });
      expect(page.assign).toHaveBeenCalledWith(redirectUrl);
    } finally {
      vi.useRealTimers();
    }
  });
});
