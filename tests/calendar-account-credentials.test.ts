import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { postgresMock, queryMock, endMock } = vi.hoisted(() => ({
  postgresMock: vi.fn(),
  queryMock: vi.fn(),
  endMock: vi.fn()
}));
vi.mock("postgres", () => ({ default: postgresMock }));

import {
  calendarAccountConnected,
  calendarCredentialAAD,
  decryptCalendarCredential,
  encryptCalendarCredential,
  readCalendarCredential
} from "../lib/calendar/credentials";

const alice = "caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bob = "cbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const secret = "calendar-test-secret-that-is-long-enough-to-be-safe";

describe("Calendar credential boundary", () => {
  afterEach(() => {
    delete process.env.WORKSPACE_CALENDAR_READER_DB_URL;
    delete process.env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY;
    postgresMock.mockReset();
    queryMock.mockReset();
    endMock.mockReset();
  });

  it("binds ciphertext to the exact Workspace and account slot", () => {
    const ciphertext = encryptCalendarCredential("synthetic-refresh-token", secret, alice, "personal");
    expect(ciphertext).not.toContain("synthetic-refresh-token");
    expect(decryptCalendarCredential(ciphertext, secret, alice, "personal")).toBe("synthetic-refresh-token");
    expect(() => decryptCalendarCredential(ciphertext, secret, alice, "business")).toThrow();
    expect(() => decryptCalendarCredential(ciphertext, secret, bob, "personal")).toThrow();
  });

  it("rejects invalid slot and Workspace bindings", () => {
    expect(calendarCredentialAAD(alice, "business")).toBe(`${alice}:calendar:business`);
    expect(() => calendarCredentialAAD("not-a-workspace", "personal")).toThrow();
    expect(() => calendarCredentialAAD(alice, "other" as "personal")).toThrow();
  });

  it("fails closed without dedicated reader configuration", async () => {
    await expect(readCalendarCredential(alice, "personal")).rejects.toThrow("not configured");
    process.env.WORKSPACE_CALENDAR_READER_DB_URL = "https://example.invalid";
    process.env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY = secret;
    await expect(readCalendarCredential(alice, "personal")).rejects.toThrow("not configured");
  });

  it("rejects a database URL that authenticates as any other role before querying ciphertext", async () => {
    process.env.WORKSPACE_CALENDAR_READER_DB_URL = "postgresql://synthetic@example.invalid/postgres";
    process.env.WORKSPACE_INTEGRATION_ENCRYPTION_KEY = secret;
    queryMock.mockResolvedValueOnce([{ role: "workspace_projection_writer" }]);
    postgresMock.mockReturnValue(Object.assign(queryMock, { end: endMock }));

    await expect(readCalendarCredential(alice, "personal")).rejects.toThrow("unavailable");
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(endMock).toHaveBeenCalledOnce();
  });

  it("returns sanitized status from the dedicated reader without selecting ciphertext", async () => {
    process.env.WORKSPACE_CALENDAR_READER_DB_URL = "postgresql://synthetic@example.invalid/postgres";
    queryMock.mockResolvedValueOnce([{ role: "workspace_calendar_reader" }])
      .mockResolvedValueOnce([{ refresh_token_present: true }]);
    postgresMock.mockReturnValue(Object.assign(queryMock, { end: endMock }));
    await expect(calendarAccountConnected(alice, "personal")).resolves.toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(endMock).toHaveBeenCalledOnce();
  });

  it("reports an empty slot as disconnected and fails closed on reader errors", async () => {
    process.env.WORKSPACE_CALENDAR_READER_DB_URL = "postgresql://synthetic@example.invalid/postgres";
    postgresMock.mockReturnValue(Object.assign(queryMock, { end: endMock }));
    queryMock.mockResolvedValueOnce([{ role: "workspace_calendar_reader" }]).mockResolvedValueOnce([]);
    await expect(calendarAccountConnected(alice, "business")).resolves.toBe(false);
    queryMock.mockResolvedValueOnce([{ role: "other_role" }]);
    await expect(calendarAccountConnected(alice, "business")).rejects.toThrow("status is unavailable");
  });
});
