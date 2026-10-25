import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkflowEditor, definition } from "@/components/sotf/workflow-editor";
import { commandSchema, commandEnvelopeSchema, persistedCommandEnvelopeSchema, emptyPilotState } from "@/lib/sotf/contracts";
import { applyCommand } from "@/lib/sotf/engine";
import { replayEvents, type WorkflowEvent } from "@/lib/sotf/persistence";

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
      expect(definition("networking-candidate", state, undefined, "2026-10-19T05:30:00Z").fields.find((item) => item.name === "weekOf")?.value).toBe("2026-10-19");
      vi.setSystemTime(new Date("2026-10-19T05:30:00Z"));
      expect(definition("networking-candidate", state).fields.find((item) => item.name === "weekOf")?.value).toBe("2026-10-19");
      expect(definition("networking-candidate", state, undefined, "2026-10-19T04:30:00Z").fields.find((item) => item.name === "weekOf")?.value).toBe("2026-10-12");
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
    expect(config.fields.some((item) => item.name === "pathway")).toBe(false);
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
    expect(saved.person).not.toHaveProperty("networking");
    expect(saved.person.conversationQuestions).toEqual(state.people[0].conversationQuestions);

    for (const key of ["question1", "question2", "question3"]) form.set(key, "");
    const cleared = commandSchema.parse(config.build(form));
    expect(cleared.type).toBe("save_person");
    if (cleared.type !== "save_person") throw new Error("Expected a person update");
    expect(cleared.person.conversationQuestions).toEqual([]);
  });

  it.each(["direct_outreach", "thoughtful_comment", "warm_introduction"])("saves an owner-selected %s approach from a research hold without drafting or changing status", (pathway) => {
    let state = emptyPilotState();
    const events: WorkflowEvent[] = [];
    const save = (command: unknown, at: string) => {
      const envelope = commandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true, dataClass: "ordinary_transition_operations", command });
      const recorded = envelope.command.type === "prepare_outreach" ? persistedCommandEnvelopeSchema.parse({ ...envelope, command: { ...envelope.command, draftTemplateVersion: "preparation_v2" } }) : envelope;
      state = applyCommand(state, recorded, at, "persisted_event");
      events.push({ revision: state.revision, envelope: recorded, recorded_at: at });
    };
    save({ type: "save_person", person: { ...savedPerson, networking: {
      weekOf: "2026-10-19", sourceUrl: "https://example.org/people/taylor", whyPerson: "Can explain program ownership",
      lamp: { list: "Program leads", alumniAffinity: "", motivation: "Relevant work", posting: "" },
      contributionAngle: "Share workshop notes", recommendedNextAction: "Check the program details",
      pathway: "research_wait", status: "replied"
    } } }, "2026-10-19T15:00:00Z");
    save({ type: "save_person", person: { ...savedPerson, id: "other-person" } }, "2026-10-19T15:01:00Z");
    save({ type: "prepare_outreach", personId: "other-person" }, "2026-10-19T15:02:00Z");
    const before = structuredClone(state);
    const prepare = commandEnvelopeSchema.parse({ requestId: randomUUID(), expectedRevision: state.revision, userConfirmed: true, dataClass: "ordinary_transition_operations", command: { type: "prepare_outreach", personId: savedPerson.id } });
    expect(() => applyCommand(state, prepare, "2026-10-20T15:00:00Z")).toThrow("marked for more research");
    expect(state).toEqual(before);

    const config = definition("person", state, savedPerson.id);
    const approach = config.fields.find((item) => item.name === "pathway");
    expect(approach).toMatchObject({ label: "Contact approach", value: "research_wait", help: "Changing the approach does not draft or send a message." });
    expect(approach?.options?.map((option) => option.value)).toEqual(["direct_outreach", "thoughtful_comment", "warm_introduction", "research_wait"]);
    const markup = renderToStaticMarkup(createElement(WorkflowEditor, { intent: "person", state, recordId: savedPerson.id, onSave: async () => {}, onClose: () => {} }));
    expect(markup).toContain("Contact approach");
    expect(markup).toContain('value="research_wait" selected=""');
    expect(markup).toContain("Changing the approach does not draft or send a message.");
    const form = new FormData();
    for (const item of config.fields) {
      if (typeof item.value === "string") form.set(item.name, item.value);
      else if (Array.isArray(item.value)) item.value.forEach((value) => form.append(item.name, value));
    }
    const unchanged = commandSchema.parse(config.build(form));
    expect(unchanged.type === "save_person" && unchanged.person.networking?.pathway).toBe("research_wait");
    form.delete("pathway");
    const omitted = commandSchema.parse(config.build(form));
    expect(omitted.type === "save_person" && omitted.person.networking?.pathway).toBe("research_wait");
    form.set("pathway", pathway);
    save(config.build(form), "2026-10-20T15:01:00Z");
    expect(state.people[0].networking).toEqual({ ...before.people[0].networking, pathway });
    expect(state.actions).toEqual(before.actions);
    expect(state.people[1]).toEqual(before.people[1]);
    expect(state.changes.slice(0, -1)).toEqual(before.changes);
    expect(state.receipts.slice(0, -1)).toEqual(before.receipts);
    expect(state.changes.at(-1)?.kind).toBe("save_person");
    // Rebuild the projection from serialized events, as a reload does.
    const reloaded = replayEvents(JSON.parse(JSON.stringify({ workspace_id: "70000000-0000-4000-8000-000000000001", revision: state.revision, events }))).state;
    expect(reloaded).toEqual(state);
    expect(definition("person", reloaded, savedPerson.id).fields.find((item) => item.name === "pathway")?.value).toBe(pathway);
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
