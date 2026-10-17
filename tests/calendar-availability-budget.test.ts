import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { postgresMock, queryMock, endMock } = vi.hoisted(() => ({
  postgresMock: vi.fn(),
  queryMock: vi.fn(),
  endMock: vi.fn().mockResolvedValue(undefined)
}));
vi.mock("postgres", () => ({ default: postgresMock }));

import { claimCalendarAvailabilityRead } from "../lib/calendar/availability-budget";

const workspaceId = "caaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterEach(() => {
  vi.unstubAllEnvs();
  postgresMock.mockReset();
  queryMock.mockReset();
  endMock.mockReset();
  endMock.mockResolvedValue(undefined);
});

function connectAsReader() {
  vi.stubEnv("WORKSPACE_CALENDAR_READER_DB_URL", "postgresql://synthetic@example.invalid/postgres");
  postgresMock.mockReturnValue(Object.assign(queryMock, { end: endMock }));
}

describe("Calendar availability read budget", () => {
  it("fails closed before opening a connection when configuration or owner binding is absent", async () => {
    expect(await claimCalendarAvailabilityRead(workspaceId)).toBe(false);
    connectAsReader();
    expect(await claimCalendarAvailabilityRead("not-a-workspace")).toBe(false);
    expect(postgresMock).not.toHaveBeenCalled();
  });

  it("allows only an accepted database claim through the dedicated Calendar reader", async () => {
    connectAsReader();
    queryMock.mockResolvedValueOnce([{ role: "workspace_calendar_reader" }])
      .mockResolvedValueOnce([{ allowed: true }]);
    expect(await claimCalendarAvailabilityRead(workspaceId)).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(endMock).toHaveBeenCalledOnce();
  });

  it("denies exhaustion, wrong reader role, and database failure without exposing details", async () => {
    connectAsReader();
    queryMock.mockResolvedValueOnce([{ role: "workspace_calendar_reader" }])
      .mockResolvedValueOnce([{ allowed: false }]);
    expect(await claimCalendarAvailabilityRead(workspaceId)).toBe(false);
    queryMock.mockResolvedValueOnce([{ role: "workspace_projection_writer" }]);
    expect(await claimCalendarAvailabilityRead(workspaceId)).toBe(false);
    queryMock.mockRejectedValueOnce(new Error("database unavailable"));
    expect(await claimCalendarAvailabilityRead(workspaceId)).toBe(false);
    expect(endMock).toHaveBeenCalledTimes(3);
  });
});
