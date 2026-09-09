/** Presentation-only identifiers. A task fragment never grants access to a record. */
export type TaskTargetKind = "action" | "milestone" | "followup" | "watch_item" | "catalyst";
const targetPattern = /^task-(action|milestone|followup|watch_item|catalyst)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function taskTargetId(kind: TaskTargetKind, id: string): string {
  return "task-" + kind + "-" + id.toLowerCase();
}

export function taskTargetFromHash(hash: string): string | null {
  try {
    const target = decodeURIComponent(hash.replace(/^#/, "")).toLowerCase();
    return targetPattern.test(target) ? target : null;
  } catch {
    return null;
  }
}
