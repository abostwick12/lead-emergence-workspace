"use client";
import { useState } from "react";
import type { PilotState } from "@/lib/sotf/contracts";
import { compareOffers, prepareInterview } from "@/lib/sotf/intelligence";
import styles from "./sotf.module.css";

export function InterviewPreparation({ state, opportunityId }: { state: PilotState; opportunityId: string }) {
  const [round, setRound] = useState("");
  const [interviewerContext, setInterviewerContext] = useState("");
  const prepared = prepareInterview(state, opportunityId, { round, interviewerContext });
  return <details className={styles.sheet}><summary>Prepare from what you already know</summary>
    <div className={styles.twoColumns}><label>Round<input value={round} onChange={(event) => setRound(event.target.value)} placeholder="Recruiter, hiring manager, panel…" maxLength={240} /></label><label>Known interviewer context<input value={interviewerContext} onChange={(event) => setInterviewerContext(event.target.value)} placeholder="Only information you actually have" maxLength={1000} /></label></div>
    <h3>Practice with evidence you can support</h3><ul>{prepared.questionsToPractice.map((question) => <li key={question}>{question}</li>)}</ul>
    <h3>Choose an example you can stand behind</h3>{prepared.stories.length ? prepared.stories.map(({ story, matchedTerms }) => <article key={story.id}><h4>{story.title}</h4><p>{story.approvedLanguage}</p><p className={styles.help}>Relevant to: {matchedTerms.join(", ")}. Your scope: {story.scope}</p></article>) : <p>No relevant approved example is available. Identify missing proof before drafting an answer.</p>}
    <h3>Use the last interview to prepare for this one</h3>{prepared.selfAssessment.map((item, index) => <p key={index}>{item.round}: {item.assessment}<br />Next: {item.nextPreparation}</p>)}{prepared.employerFeedback.map((item, index) => <p key={index}>Employer feedback: {item.feedback} — {item.source}</p>)}
    <h3>Questions for the interviewer</h3><ul>{prepared.questionsForInterviewer.map((question) => <li key={question}>{question}</li>)}</ul><p className={styles.help}>{prepared.practiceInstructions}</p><a href="/sotf/connect">Continue the practice conversation in ChatGPT</a>
  </details>;
}

export function OfferComparison({ state }: { state: PilotState }) {
  const comparison = compareOffers(state);
  if (!comparison.offers.length) return null;
  return <section><h3>Compare against the same criteria</h3><div className={styles.tableScroll} role="region" aria-label="Offer comparison" tabIndex={0}><table><thead><tr><th>Criteria</th>{comparison.offers.map(({ offer, opportunity }) => <th key={offer.id}>{opportunity.company} · {opportunity.role}</th>)}</tr></thead><tbody>
    <tr><th>Eligibility</th>{comparison.offers.map(({ offer, assessment }) => <td key={offer.id}>{assessment.eligibility}<br />{assessment.blockers.join("; ")}</td>)}</tr>
    {comparison.criteria.map(({ criterion, values }) => <tr key={criterion.id}><th>{criterion.label}{criterion.nonNegotiable ? " · non-negotiable" : ""}<br />{criterion.desired}</th>{values.map((value) => <td key={value.offerId}>{value.supporting.map((item) => <p key={item.id}>Supports: {item.statement}</p>)}{value.conflicting.map((item) => <p key={item.id}>Concern: {item.statement}</p>)}{!value.supporting.length && !value.conflicting.length ? "Not established" : null}</td>)}</tr>)}
    {comparison.terms.map(({ label, values }) => <tr key={label}><th>{label}</th>{values.map(({ offerId, terms }) => <td key={offerId}>{terms.length ? terms.map((term, index) => <p key={index}>{term.value}<br /><span className={styles.help}>{term.certainty} · {term.source}</span></p>) : "Not supplied"}</td>)}</tr>)}
  </tbody></table></div><ul>{comparison.decisionQuestions.map((question) => <li key={question}>{question}</li>)}</ul><p className={styles.help}>Use the tradeoffs to make your own decision. Missing terms stay unknown; the table does not choose an offer.</p></section>;
}
