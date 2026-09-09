export function executiveFixtures(today = new Date().toISOString().slice(0, 10)) {
  const common = { title: "Fictional Executive record", notes: "Synthetic acceptance only", priority: "normal", reviewState: "user_stated", reviewDate: today, references: [] };
  return {
    commitment: { ...common, recordType: "commitment", state: "open", owner: "Fictional owner",
      outcome: "Deliver an illustrative outline", nextAction: "Review the outline", dueDate: today, followupDate: null, completedOn: null, blocker: "" },
    decision: { ...common, recordType: "decision", state: "open", question: "Which illustrative step should come first?",
      owner: "Fictional owner", dueDate: today, nextAction: "Compare alternatives", options: [], selectedOptionId: null, decidedOn: null, rationale: "", revisitTrigger: "" },
    meeting: { ...common, recordType: "meeting", state: "planned", objective: "Align on an illustrative next move",
      participants: [], agenda: "Review the goal", startsAt: today + "T15:00:00Z", timeZone: "UTC", durationMinutes: 30,
      agreement: "not_agreed", location: "", outcome: "", actions: [] },
    daily_brief: { ...common, recordType: "daily_brief", state: "draft", periodStart: today, periodEnd: today,
      focus: "What deserves attention today?", summary: "Review the recorded illustrative work", observations: [], actions: [], reflection: "" },
    weekly_review: { ...common, recordType: "weekly_review", state: "draft", periodStart: today, periodEnd: today,
      focus: "What changed in the illustrative work?", summary: "", observations: [], actions: [], reflection: "" }
  };
}
