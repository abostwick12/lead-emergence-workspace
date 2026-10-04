import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), revokeGrant: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ getWorkspaceClient: () => ({
  rpc: fixture.rpc, from: fixture.from, auth: { oauth: { revokeGrant: fixture.revokeGrant } }
}) }));
import { confirmPersonalAssistantConnectionHost } from "@/lib/workspace/repository";

const connectionId = "ee8f92a9-b80e-41b0-aee2-ab4b49a5b5e3";
describe("native owner host declaration adapter", () => {
  beforeEach(() => vi.clearAllMocks());
  it("sends only the connection and explicit declaration through the dedicated RPC", async () => {
    const result = { connection_id: connectionId, assistant_provider: "chatgpt", changed: true };
    fixture.rpc.mockResolvedValue({ data: result, error: null });
    expect(await confirmPersonalAssistantConnectionHost(connectionId, "chatgpt")).toEqual(result);
    expect(fixture.rpc).toHaveBeenCalledWith("confirm_personal_assistant_connection_host", {
      target_connection_id: connectionId, target_assistant: "chatgpt"
    });
    expect(fixture.from).not.toHaveBeenCalled();
    expect(fixture.revokeGrant).not.toHaveBeenCalled();
  });
  it("uses the same owner boundary for withdrawal without revoking existing access", async () => {
    fixture.rpc.mockResolvedValue({ data: { connection_id: connectionId, assistant_provider: "other", changed: true }, error: null });
    await confirmPersonalAssistantConnectionHost(connectionId, "other");
    expect(fixture.rpc).toHaveBeenCalledWith("confirm_personal_assistant_connection_host", {
      target_connection_id: connectionId, target_assistant: "other"
    });
    expect(fixture.from).not.toHaveBeenCalled();
    expect(fixture.revokeGrant).not.toHaveBeenCalled();
  });
  it("does not report success when authorization is denied", async () => {
    fixture.rpc.mockResolvedValue({ data: null, error: { message: "Access denied" } });
    await expect(confirmPersonalAssistantConnectionHost(connectionId, "chatgpt")).rejects.toThrow("Access denied");
  });
  it("rejects a response for another connection or classification", async () => {
    fixture.rpc.mockResolvedValue({ data: { connection_id: "another-connection", assistant_provider: "chatgpt", changed: true }, error: null });
    await expect(confirmPersonalAssistantConnectionHost(connectionId, "chatgpt")).rejects.toThrow("could not be verified");
  });
});
