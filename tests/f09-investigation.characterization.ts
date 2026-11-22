import { afterEach, beforeEach, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

// A file-backed synthetic transport, NOT PostgreSQL, PostgREST, RLS, or real Supabase.
// Historical reproduction: execute the exact pre-fix source at the investigated
// deployed SHA. Current caller regression coverage lives in capture-to-task.test.ts.
const baseline = execFileSync("git", ["show", "896ba4f0b28f0ece7dddd38fea092967f91498af:lib/workspace/repository.ts"], { encoding: "utf8" });
const compiled = ts.transpileModule(baseline, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const baselineModule = { exports: {} as { resolveCapture: (conversion: typeof input) => Promise<void> } };
new Function("require", "module", "exports", compiled)((name: string) => {
  if (name === "@/lib/supabase/client") return { getWorkspaceClient: () => syntheticClient() };
  if (name === "@/lib/workspace/timezones") return {};
  throw new Error(`Unexpected historical import: ${name}`);
}, baselineModule, baselineModule.exports);
const { resolveCapture } = baselineModule.exports;

type State = {
  tasks: { id: string; title: string }[];
  captures: { id: string; status: string; routed_task_id: string | null }[];
};
type Fault = "none" | "link-before-write" | "task-ack-lost" | "link-ack-lost" | "zero-row-link";
let directory: string;
let statePath: string;
let fault: Fault;
const input = {
  captureId: "synthetic-capture", workspaceId: "synthetic-workspace", userId: "synthetic-user",
  rawText: "Synthetic F09 task", domain: "general" as const
};

function readState(): State { return JSON.parse(readFileSync(statePath, "utf8")) as State; }
function writeState(state: State): void { writeFileSync(statePath, JSON.stringify(state)); }
function consumeFault(expected: Fault): boolean {
  if (fault !== expected) return false;
  fault = "none";
  return true;
}
function syntheticClient() {
  return {
    from(table: string) {
      if (table === "tasks") return {
        insert(row: { title: string }) {
          return { select: () => ({ single: async () => {
            const state = readState();
            const task = { id: `synthetic-task-${state.tasks.length + 1}`, title: row.title };
            state.tasks.push(task);
            writeState(state);
            if (consumeFault("task-ack-lost")) return { data: null, error: { message: "Synthetic task acknowledgement lost" } };
            return { data: task, error: null };
          } }) };
        }
      };
      if (table === "capture_inbox") return {
        update(patch: { status: string; routed_task_id: string }) {
          return { eq: async (column: string, value: string) => {
            expect(column).toBe("id");
            if (consumeFault("link-before-write")) return { error: { message: "Synthetic link write failed" } };
            if (consumeFault("zero-row-link")) return { error: null, count: 0 };
            const state = readState();
            const capture = state.captures.find((row) => row.id === value);
            if (capture) Object.assign(capture, patch);
            writeState(state);
            if (consumeFault("link-ack-lost")) return { error: { message: "Synthetic link acknowledgement lost" } };
            return { error: null };
          } };
        }
      };
      throw new Error(`Unexpected synthetic table: ${table}`);
    }
  };
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "f09-synthetic-"));
  statePath = join(directory, "state.json");
  fault = "none";
  writeState({ tasks: [], captures: [{ id: input.captureId, status: "unprocessed", routed_task_id: null }] });
});
afterEach(() => {
  const resolvedDirectory = resolve(directory);
  const tempRoot = resolve(tmpdir());
  if (!resolvedDirectory.startsWith(`${tempRoot}${sep}`) || !basename(resolvedDirectory).startsWith("f09-synthetic-")) {
    throw new Error("Refusing cleanup outside the synthetic temporary fixture directory");
  }
  rmSync(resolvedDirectory, { recursive: true });
});

test("control: one successful call persists one task and its capture link", async () => {
  await resolveCapture(input);
  expect(readState()).toEqual({ tasks: [{ id: "synthetic-task-1", title: input.rawText }], captures: [{ id: input.captureId, status: "processed", routed_task_id: "synthetic-task-1" }] });
});

test("link failure leaves an unlinked task; retry persists a second task", async () => {
  fault = "link-before-write";
  await expect(resolveCapture(input)).rejects.toThrow("Synthetic link write failed");
  expect(readState().tasks).toHaveLength(1);
  expect(readState().captures[0]).toMatchObject({ status: "unprocessed", routed_task_id: null });
  await resolveCapture(input);
  expect(readState().tasks).toHaveLength(2);
  expect(readState().captures[0].routed_task_id).toBe("synthetic-task-2");
});

test("lost task acknowledgement leaves a task; retry persists a duplicate", async () => {
  fault = "task-ack-lost";
  await expect(resolveCapture(input)).rejects.toThrow("Synthetic task acknowledgement lost");
  expect(readState().tasks).toHaveLength(1);
  expect(readState().captures[0].routed_task_id).toBeNull();
  await resolveCapture(input);
  expect(readState().tasks).toHaveLength(2);
  expect(readState().captures[0].routed_task_id).toBe("synthetic-task-2");
});

test("lost link acknowledgement persists completion; retry overwrites link with a duplicate", async () => {
  fault = "link-ack-lost";
  await expect(resolveCapture(input)).rejects.toThrow("Synthetic link acknowledgement lost");
  expect(readState().captures[0]).toMatchObject({ status: "processed", routed_task_id: "synthetic-task-1" });
  await resolveCapture(input);
  expect(readState().tasks).toHaveLength(2);
  expect(readState().captures[0].routed_task_id).toBe("synthetic-task-2");
});

test("concurrent calls both succeed with two persisted tasks and one final link", async () => {
  await Promise.all([resolveCapture(input), resolveCapture(input)]);
  const state = readState();
  expect(state.tasks).toHaveLength(2);
  expect(state.captures[0]).toMatchObject({ status: "processed", routed_task_id: "synthetic-task-2" });
});

test("zero-row successful update resolves without a capture link", async () => {
  fault = "zero-row-link";
  await expect(resolveCapture(input)).resolves.toBeUndefined();
  expect(readState().tasks).toHaveLength(1);
  expect(readState().captures[0]).toMatchObject({ status: "unprocessed", routed_task_id: null });
});
