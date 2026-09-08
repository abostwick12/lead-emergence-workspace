import type { WritingResource } from "./contracts";

export function reviewResource(resource: WritingResource) {
  const findings: Array<{ field: string; reason: string; nextAction: string }> = [];
  if (!resource.author?.trim()) findings.push({ field: "Author", reason: "No author is recorded.", nextAction: "Confirm the author before publishing." });
  if (!resource.audience?.trim()) findings.push({ field: "Audience", reason: "The intended reader is not recorded.", nextAction: "Name the audience so the introduction and description can serve them." });
  if (!resource.abstract?.trim()) findings.push({ field: "Summary", reason: "No resource summary is recorded.", nextAction: "Prepare a short description for someone deciding whether to read it." });
  if (!resource.topics.length) findings.push({ field: "Topics", reason: "No topics are recorded.", nextAction: "Choose a few terms readers would use to find this resource." });
  if (!resource.body_text.trim()) findings.push({ field: "Source text", reason: "The full text is not available in this record.", nextAction: "Read the original before making editorial or theological claims." });
  if (["inferred", "suggested", "hypothesized", "stale", "rejected"].includes(resource.epistemic_state)) {
    findings.unshift({ field: "Evidence status", reason: "This record is marked " + resource.epistemic_state + ".", nextAction: "Confirm the source information before treating it as settled." });
  }
  return {
    resourceId: resource.id,
    method: "Recorded metadata checks; no AI editorial judgment or external link verification.",
    findings,
    nextAction: findings[0]?.nextAction ?? "Read the source and confirm the final editorial and publication decisions.",
    wordCount: resource.body_text.trim() ? resource.body_text.trim().split(/\s+/u).length : 0,
    publicationDecision: "Human review required; recorded publication status is not approval."
  };
}
export type ResourceReview = ReturnType<typeof reviewResource>;
