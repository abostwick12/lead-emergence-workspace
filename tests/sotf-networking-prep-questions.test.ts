import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const scenario = vi.hoisted(() => ({ includeMeeting: true, historicalContact: false }));

vi.mock("@/lib/sotf/preview", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/sotf/preview")>();
  return {
    ...original,
    createPreviewState: () => {
      const state = original.createPreviewState();
      const person = state.people.find((item) => item.id === "morgan");
      if (!person) throw new Error("Expected the fictional preview person");
      person.conversationQuestions = ["How did the fictional team choose its budget owner?", "Describe the fictional team's weekly tradeoffs."];
      if (scenario.historicalContact) {
        person.networking!.weekOf = "2026-08-24";
        state.people.push({ ...person, id: "hidden-history-contact", name: "Fictional hidden history contact", testRecord: true });
      }
      if (!scenario.includeMeeting) state.meetings = state.meetings.filter((item) => item.kind !== "networking");
      return state;
    }
  };
});

import { SotfExperience } from "@/components/sotf/sotf-experience";
import { createPreviewState } from "@/lib/sotf/preview";
import { definition } from "@/components/sotf/workflow-editor";
import { networkingStrategy } from "@/lib/sotf/intelligence";

describe("Networking conversation prep", () => {
  it("offers meeting recording for a visible earlier-week contact using the existing person selection", () => {
    scenario.historicalContact = true;
    try {
      const state = createPreviewState();
      expect(networkingStrategy(state).candidates.map(({ person }) => person.id)).not.toContain("morgan");
      const html = renderToStaticMarkup(createElement(SotfExperience, { mode: "preview", initialSection: "networking" }));
      const history = html.split('aria-label="Contact history"')[1].split("</section>")[0];
      const card = [...history.matchAll(/<article[^>]*>[\s\S]*?<\/article>/g)].map(([markup]) => markup).find((markup) => markup.includes("Morgan"));
      expect(card).toBeDefined();
      expect(card).toContain(">Record a meeting</button>");
      expect(history).not.toContain("Fictional hidden history contact");
      const meeting = definition("meeting", state, "morgan");
      expect(meeting.fields.find((field) => field.name === "personId")?.value).toBe("morgan");
    } finally {
      scenario.historicalContact = false;
    }
  });

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
