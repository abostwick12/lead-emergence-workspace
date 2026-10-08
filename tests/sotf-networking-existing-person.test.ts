import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
