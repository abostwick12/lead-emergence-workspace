import { beforeEach, expect, test, vi } from "vitest";
import type { TaskRecord } from "@/lib/workspace/types";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ getWorkspaceClient: () => ({ rpc, from }) }));
import { dismissCapture, listCaptures, listTasks, resolveCapture } from "@/lib/workspace/repository";

const input = { captureId: "capture-1", workspaceId: "workspace-1", domain: "life" as const };
const task: TaskRecord = {
  id: "task-1", workspace_id: input.workspaceId, domain: "general", title: "Stored capture content",
  description: null, status: "todo", priority: "medium", due_date: null, tags: [],
  created_at: "2026-11-19T12:00:00Z", updated_at: "2026-11-19T12:00:00Z"
};
beforeEach(() => { vi.resetAllMocks(); });

test.each([false, true])("returns canonical task and replay acknowledgement (%s) using only the native operation", async (alreadyProcessed) => {
  rpc.mockResolvedValue({ data: { task, already_processed: alreadyProcessed }, error: null });
  expect(await resolveCapture(input)).toEqual({ status: "confirmed", task, alreadyProcessed });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("resolve_capture_to_task", {
    target_workspace_id: input.workspaceId, target_capture_id: input.captureId, task_domain: "life"
  });
  expect(from).not.toHaveBeenCalled();
});

test.each(["22023", "42501", "P0001"])("acknowledged rollback %s is recoverable without a fallback task", async (code) => {
  rpc.mockResolvedValue({ data: null, error: { code, message: "Untrusted database detail" } });
  expect(await resolveCapture(input)).toMatchObject({ status: "rejected", message: expect.stringContaining("Conversion was not applied") });
  expect(from).not.toHaveBeenCalled();
});

test.each([
  { data: null, error: null },
  { data: { task, already_processed: "false" }, error: null },
  { data: { task: { ...task, workspace_id: "other-workspace" }, already_processed: false }, error: null },
  { data: { task: { id: "partial-task" }, already_processed: false }, error: null },
  { data: { task: { ...task, tags: [1] }, already_processed: false }, error: null },
  { data: { task: { ...task, status: "unsupported" }, already_processed: false }, error: null },
  { data: null, error: { code: "40001", message: "serialization or transport details" } },
  { data: null, error: { message: "Failed to fetch" } }
])("unreadable acknowledgement or unclassified error stays uncertain: %j", async (response) => {
  rpc.mockResolvedValue(response);
  expect(await resolveCapture(input)).toEqual({ status: "uncertain", message: "We couldn't confirm whether this became a task. Check its status or retry this capture." });
  expect(from).not.toHaveBeenCalled();
});

test("lost response can retry the same capture and accepts the first committed task without rewriting the requested domain", async () => {
  rpc.mockRejectedValueOnce(new Error("connection interrupted after commit"))
    .mockResolvedValueOnce({ data: { task, already_processed: true }, error: null });
  expect(await resolveCapture(input)).toMatchObject({ status: "uncertain" });
  expect(await resolveCapture(input)).toEqual({ status: "confirmed", task, alreadyProcessed: true });
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(from).not.toHaveBeenCalled();
});

test.each(["captures", "tasks"])("recovery reads %s by workspace and exact ID before any list cap", async (kind) => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn().mockResolvedValue({ data: [task], error: null }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); from.mockReturnValue(query);
  if (kind === "tasks") await listTasks(input.workspaceId, task.id);
  else await listCaptures(input.workspaceId, input.captureId);
  expect(query.eq.mock.calls).toEqual([["workspace_id", input.workspaceId], ["id", kind === "tasks" ? task.id : input.captureId]]);
  expect(query.order).toHaveBeenCalledOnce();
});

test("only an acknowledged validation rejection permits validation-specific recovery", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: "22023" } }).mockResolvedValueOnce({ data: null, error: { code: "42501" } });
  expect(await resolveCapture(input)).toMatchObject({ status: "rejected", reason: "validation" });
  expect(await resolveCapture(input)).toMatchObject({ status: "rejected", reason: "unavailable" });
});

test.each(["processed", "discarded", "unavailable"])("a stale discard reports %s after zero affected rows without changing the winner", async (status) => {
  const capture = { id: input.captureId, workspace_id: input.workspaceId, status, routed_task_id: status === "processed" ? task.id : null };
  const update = { update: vi.fn(), eq: vi.fn(), select: vi.fn().mockResolvedValue({ data: [], error: null }) };
  update.update.mockReturnValue(update); update.eq.mockReturnValue(update);
  const read = { select: vi.fn(), eq: vi.fn(), order: vi.fn().mockResolvedValue({ data: status === "unavailable" ? [] : [capture], error: null }) };
  read.select.mockReturnValue(read); read.eq.mockReturnValue(read);
  from.mockReturnValueOnce(update).mockReturnValueOnce(read);
  expect(await dismissCapture(input.workspaceId, input.captureId)).toEqual(status === "unavailable" ? null : capture);
  expect(update.eq.mock.calls).toEqual([["workspace_id", input.workspaceId], ["id", input.captureId], ["status", "unprocessed"]]);
  expect(read.eq.mock.calls).toEqual([["workspace_id", input.workspaceId], ["id", input.captureId]]);
  expect(update.update).toHaveBeenCalledExactlyOnceWith({ status: "discarded" });
});

test("a successful conditional discard returns the changed row without an unnecessary read", async () => {
  const capture = { id: input.captureId, workspace_id: input.workspaceId, status: "discarded", routed_task_id: null };
  const update = { update: vi.fn(), eq: vi.fn(), select: vi.fn().mockResolvedValue({ data: [capture], error: null }) };
  update.update.mockReturnValue(update); update.eq.mockReturnValue(update); from.mockReturnValue(update);
  expect(await dismissCapture(input.workspaceId, input.captureId)).toEqual(capture);
  expect(from).toHaveBeenCalledOnce();
});

test("a failed conditional discard propagates its error instead of reporting success", async () => {
  const update = { update: vi.fn(), eq: vi.fn(), select: vi.fn().mockResolvedValue({ data: null, error: { message: "Access unavailable" } }) };
  update.update.mockReturnValue(update); update.eq.mockReturnValue(update); from.mockReturnValue(update);
  await expect(dismissCapture(input.workspaceId, input.captureId)).rejects.toThrow("Access unavailable");
  expect(from).toHaveBeenCalledOnce();
});
