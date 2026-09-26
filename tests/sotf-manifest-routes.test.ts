import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }
}));

const access = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createWorkspaceServerClient: async () => ({ auth: { getUser: access.getUser }, rpc: access.rpc })
}));

import SotfBundlePage from "@/app/workspace/sotf/page";
import SotfSectionPage from "@/app/workspace/sotf/[section]/page";
import { SotfExperience, type SotfSection } from "@/components/sotf/sotf-experience";

const sectionPage = (section: string) => SotfSectionPage({ params: Promise.resolve({ section }) });

beforeEach(() => {
  vi.stubEnv("SOTF_PILOT_ENABLED", "true");
  access.getUser.mockReset().mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
  access.rpc.mockReset().mockResolvedValue({ data: true, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("SOTF UI manifest routes", () => {
  it.each([
    ["opportunities", "Is this worth more of your time?"],
    ["briefs", "For today"],
    ["learning", "What should change next week?"]
  ] as const)("opens the existing %s view", async (section, heading) => {
    const page = await sectionPage(section);
    expect(page.type).toBe(SotfExperience);
    expect(page.props).toMatchObject({ mode: "connected", initialSection: section });
    expect(access.rpc).toHaveBeenCalledExactlyOnceWith("sotf_has_access");

    const preview = renderToStaticMarkup(createElement(SotfExperience, { mode: "preview", initialSection: section as SotfSection }));
    expect(preview).toContain(heading);
  });

  it("preserves the base route's Today view", async () => {
    const page = await SotfBundlePage();
    expect(page.type).toBe(SotfExperience);
    expect(page.props.initialSection).toBeUndefined();
    expect(access.rpc).toHaveBeenCalledExactlyOnceWith("sotf_has_access");
  });

  it("rejects unlisted sections before opening the experience", async () => {
    await expect(sectionPage("unknown")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(access.getUser).not.toHaveBeenCalled();
  });

  it.each(["opportunities", "briefs", "learning"])("fails closed for %s when the pilot is off", async (section) => {
    vi.stubEnv("SOTF_PILOT_ENABLED", "false");
    await expect(sectionPage(section)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(access.getUser).not.toHaveBeenCalled();
    expect(access.rpc).not.toHaveBeenCalled();
  });

  it("uses the same sign-in redirect as the base route", async () => {
    access.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(sectionPage("briefs")).rejects.toThrow("NEXT_REDIRECT:/login");
    await expect(SotfBundlePage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(access.rpc).not.toHaveBeenCalled();
  });

  it.each(["opportunities", "briefs", "learning"])("fails closed for %s without effective SOTF access", async (section) => {
    access.rpc.mockResolvedValue({ data: false, error: null });
    await expect(sectionPage(section)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(access.rpc).toHaveBeenCalledExactlyOnceWith("sotf_has_access");
  });
});
