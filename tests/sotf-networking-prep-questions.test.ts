import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const scenario = vi.hoisted(() => ({ includeMeeting: true }));

vi.mock("@/lib/sotf/preview", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/sotf/preview")>();
  return {
    ...original,
    createPreviewState: () => {
      const state = original.createPreviewState();
      const person = state.people.find((item) => item.id === "morgan");
      if (!person) throw new Error("Expected the fictional preview person");
      person.conversationQuestions = ["How did the fictional team choose its budget owner?", "Describe the fictional team's weekly tradeoffs."];
      if (!scenario.includeMeeting) state.meetings = state.meetings.filter((item) => item.kind !== "networking");
      return state;
    }
  };
});

import { SotfExperience } from "@/components/sotf/sotf-experience";

describe("Networking conversation prep", () => {
  it("renders saved questions for an agreed conversation", () => {
    scenario.includeMeeting = true;
    const html = renderToStaticMarkup(createElement(SotfExperience, { mode: "preview", initialSection: "networking" }));
    expect(html).toContain("How did the fictional team choose its budget owner?");
    expect(html).toContain("Describe the fictional team&#x27;s weekly tradeoffs.");
    expect(html).toContain("Edit questions");
  });

  it("renders saved questions before a meeting is recorded", () => {
    scenario.includeMeeting = false;
    const html = renderToStaticMarkup(createElement(SotfExperience, { mode: "preview", initialSection: "networking" }));
    expect(html).toContain("No meeting agreed or recorded");
    expect(html).toContain("How did the fictional team choose its budget owner?");
    expect(html).toContain("Describe the fictional team&#x27;s weekly tradeoffs.");
    expect(html).not.toContain("What does a normal week look like for you at Fictional Northstar?");
  });
});
