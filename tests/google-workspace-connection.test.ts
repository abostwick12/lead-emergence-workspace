import { describe, expect, it } from "vitest";
import {
  connectedProviders,
  connectionScopes,
  GOOGLE_WORKSPACE_CONNECTION_IDS
} from "../lib/integrations/providers";

describe("Google Workspace connection", () => {
  it("requests one minimal combined grant for Gmail and Google Calendar", () => {
    expect(connectionScopes("gmail")).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/calendar.events.readonly"
    ]);
    expect(connectionScopes("google_calendar")).toEqual(connectionScopes("gmail"));
  });

  it("marks both Google cards connected after either consent entrypoint", () => {
    expect(connectedProviders("gmail")).toEqual(GOOGLE_WORKSPACE_CONNECTION_IDS);
    expect(connectedProviders("google_calendar")).toEqual(GOOGLE_WORKSPACE_CONNECTION_IDS);
    expect(connectedProviders("slack")).toEqual(["slack"]);
  });
});
