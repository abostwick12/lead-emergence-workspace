import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkflowEditor, definition } from "@/components/sotf/workflow-editor";
import { commandSchema, commandEnvelopeSchema, emptyPilotState } from "@/lib/sotf/contracts";
import { applyCommand } from "@/lib/sotf/engine";

const savedPerson = {
  id: "saved-person", name: "Fictional Taylor", company: "Fictional Northstar", role: "Program Lead",
  email: "taylor@example.invalid", source: "Synthetic workshop contact", testRecord: false,
  overlap: "Shared workshop", whyNow: "Relevant program leadership experience",
  objective: "Learn about program ownership", introductionPath: "Workshop host",
  hypothesisIds: []
};

function candidateForm(existingPersonId = savedPerson.id) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    existingPersonId, weekOf: "2026-10-06", name: "A new person", company: "New company",
    role: "New role", source: "New source", sourceUrl: "https://example.org/people/taylor",
    list: "Program leadership", alumniAffinity: "", motivation: "Relevant delivery work", posting: "",
    whyPerson: "Can explain the work", whyNow: "I am comparing program roles",
    overlap: "Shared workshop", contributionAngle: "Share a delivery perspective",
    objective: "Learn how decisions are owned", recommendedNextAction: "Prepare a conversation",
    pathway: "research_wait", introductionPath: "", nextTouch: ""
  })) form.set(key, value);
  return form;
}

describe("Networking candidate saved-person selection", () => {
  it("defaults the Networking week to Chicago Monday across Sunday night", () => {
    const state = emptyPilotState();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-19T04:30:00Z"));
      expect(definition("networking-candidate", state).fields.find((item) => item.name === "weekOf")?.value).toBe("2026-10-12");
      vi.setSystemTime(new Date("2026-10-19T05:30:00Z"));
      expect(definition("networking-candidate", state).fields.find((item) => item.name === "weekOf")?.value).toBe("2026-10-19");
    } finally {
      vi.useRealTimers();
    }
  });

  it("excludes test people from ordinary person selectors while keeping real choices", () => {
    const state = emptyPilotState();
    state.people = [savedPerson, { ...savedPerson, id: "test-person", name: "Synthetic test person", testRecord: true }, { ...savedPerson, id: "other-test-person", name: "Other synthetic person", testRecord: true }];
    state.meetings = [{ id: "linked-test-meeting", title: "Existing test meeting", personId: "test-person", hypothesisIds: [], kind: "networking", startsAt: "2026-10-14T15:00:00.000Z", endsAt: "2026-10-14T15:30:00.000Z", status: "accepted", provider: "manual", objective: "Retain the linked person" }];
    const savedOptions = definition("networking-candidate", state).fields.find((item) => item.name === "existingPersonId")?.options;
    const carryOptions = definition("close-chapter", state).fields.find((item) => item.name === "carryForward")?.options;
    const newMeetingOptions = definition("meeting", state).fields.find((item) => item.name === "personId")?.options;
    const linkedMeetingOptions = definition("meeting", state, "linked-test-meeting").fields.find((item) => item.name === "personId")?.options;
    expect(savedOptions?.map((item) => item.value)).toEqual([savedPerson.id]);
    expect(carryOptions?.filter((item) => item.label.startsWith("Person: ")).map((item) => item.value)).toEqual([savedPerson.id]);
    expect(newMeetingOptions?.map((item) => item.value)).toEqual([savedPerson.id]);
    expect(linkedMeetingOptions?.map((item) => item.value)).toEqual([savedPerson.id, "test-person"]);
    expect(() => definition("networking-candidate", state).build(candidateForm("test-person")))
      .toThrow("Choose an unplanned saved person.");
  });

  it("prefills reviewed questions in the Person editor and allows an explicit clear", () => {
    const state = emptyPilotState();
    state.people = [{ ...savedPerson, conversationQuestions: ["Who owns the program budget?", "What changes the weekly plan?"] }];
    const config = definition("person", state, savedPerson.id);
    const markup = renderToStaticMarkup(createElement(WorkflowEditor, {
      intent: "person", state, recordId: savedPerson.id, onSave: async () => {}, onClose: () => {}
    }));
    expect(markup).toContain("Question 1");
    expect(markup).toContain("Who owns the program budget?");
    expect(config.fields.find((item) => item.name === "question2")?.value).toBe("What changes the weekly plan?");

    const form = new FormData();
    for (const item of config.fields) {
      if (typeof item.value === "string") form.set(item.name, item.value);
      else if (Array.isArray(item.value)) item.value.forEach((value) => form.append(item.name, value));
    }
    const saved = commandSchema.parse(config.build(form));
    expect(saved.type).toBe("save_person");
    if (saved.type !== "save_person") throw new Error("Expected a person update");
    expect(saved.person.conversationQuestions).toEqual(state.people[0].conversationQuestions);

    for (const key of ["question1", "question2", "question3"]) form.set(key, "");
    const cleared = commandSchema.parse(config.build(form));
    expect(cleared.type).toBe("save_person");
    if (cleared.type !== "save_person") throw new Error("Expected a person update");
    expect(cleared.person.conversationQuestions).toEqual([]);
  });

  it("offers an unplanned saved person and updates that record without duplicating identity", () => {
    const state = emptyPilotState();
    state.people = [savedPerson];
    const markup = renderToStaticMarkup(createElement(WorkflowEditor, {
      intent: "networking-candidate", state, onSave: async () => {}, onClose: () => {}
    }));
    expect(markup).toContain('name="existingPersonId"');
    expect(markup).toContain('value="saved-person"');

    const defaults = Object.fromEntries(definition("networking-candidate", state, savedPerson.id).fields.map(({ name, value }) => [name, value]));
    expect(defaults).toMatchObject({ overlap: savedPerson.overlap, whyNow: savedPerson.whyNow, objective: savedPerson.objective });
    const form = candidateForm();
    for (const name of ["overlap", "whyNow", "objective"] as const) form.set(name, savedPerson[name]);
    form.delete("sourceUrl");
    const command = commandSchema.parse(definition("networking-candidate", state).build(form));
    expect(command.type).toBe("save_person");
    if (command.type !== "save_person") throw new Error("Expected a person update");
    expect(command.person).toMatchObject({
      id: savedPerson.id, name: savedPerson.name, company: savedPerson.company,
      role: savedPerson.role, email: savedPerson.email, source: savedPerson.source,
      testRecord: false, introductionPath: savedPerson.introductionPath,
      overlap: savedPerson.overlap, whyNow: savedPerson.whyNow, objective: savedPerson.objective,
      networking: { weekOf: "2026-10-06", status: "identified", sourceUrl: undefined }
    });
    const envelope = commandEnvelopeSchema.parse({
      requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true,
      dataClass: "ordinary_transition_operations", command
    });
    const updated = applyCommand(state, envelope, "2026-10-07T12:00:00Z");
    expect(updated.people).toHaveLength(1);
    expect(updated.people[0].id).toBe(savedPerson.id);
    expect(updated.people[0].networking?.weekOf).toBe("2026-10-06");
    expect(updated.people[0]).toMatchObject({ overlap: savedPerson.overlap, whyNow: savedPerson.whyNow, objective: savedPerson.objective });

    form.set("objective", "Learn how a specific program decision is made");
    const edited = commandSchema.parse(definition("networking-candidate", state).build(form));
    expect(edited.type).toBe("save_person");
    if (edited.type !== "save_person") throw new Error("Expected a person update");
    expect(edited.person.objective).toBe("Learn how a specific program decision is made");
  });

  it("rejects a stale saved-person choice instead of creating a second person", () => {
    const state = emptyPilotState();
    state.people = [savedPerson];
    expect(() => definition("networking-candidate", state).build(candidateForm("missing-person")))
      .toThrow("Choose an unplanned saved person.");
  });

  it("still requires a public URL for a brand-new networking candidate", () => {
    const state = emptyPilotState();
    const form = candidateForm("");
    form.delete("sourceUrl");
    const command = commandSchema.parse(definition("networking-candidate", state).build(form));
    const envelope = commandEnvelopeSchema.parse({
      requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true,
      dataClass: "ordinary_transition_operations", command
    });
    expect(() => applyCommand(state, envelope, "2026-10-07T12:00:00Z"))
      .toThrow("A public source URL is required for a new networking candidate.");
  });
});
