import Link from "next/link";
import { resolveSotfRelease } from "@/lib/workspace/sotf-release";
import styles from "./sotf.module.css";

export function WorkflowDescriptions() {
  const release = resolveSotfRelease();
  const skill = release.manifest.skills[0];

  return <section className={styles.experience} style={{ minHeight: 0, paddingBottom: 0 }} aria-labelledby="sotf-workflows-title">
    <div className={styles.body}>
      <p className={styles.eyebrow}>SOTF Bundle · Pilot</p>
      <h2 id="sotf-workflows-title">Choose the transition work you need.</h2>
      <p>Explore the transition-loop skill and the workflows declared in this pilot release. These descriptions do not confirm a successful run.</p>
      <p className={styles.notice}>Pilot access is required. This bundle is not approved for the customer release. Workspace access and applicable bundle entitlement are separate from package installation and successful execution in ChatGPT. ChatGPT connection health is unknown here.</p>
      <p className={styles.help}>For any workflow below, manage Gmail, Slack, Calendar, and other third-party connections in your own ChatGPT account. Connect ChatGPT to Workspace separately. You can begin the web workflows with information you supply; no third-party connection is required by these definitions.</p>
      <div className={styles.twoColumns}>
        <article className={styles.sheet} aria-label="Transition-loop skill">
          <p className={styles.eyebrow}>Pilot · Setup not checked</p>
          <h3>Transition-loop skill</h3>
          <p>{skill.outcome}</p>
          <Link href="/sotf/connect">Read the ChatGPT setup and resume instructions</Link>
          <details>
            <summary>How the transition-loop skill works</summary>
            <dl>
              <dt><strong>Your input</strong></dt><dd>Your transition question, an opportunity or conversation to prepare, and evidence you explicitly choose to supply.</dd>
              <dt><strong>Access and connections</strong></dt><dd>Requires applicable Workspace access and bundle entitlement, enabled pilot access, and a separately authorized ChatGPT-to-Workspace connection for saved work. The skill must also be installed and discoverable in your ChatGPT host; that is unknown here. Manage third-party connections in ChatGPT.</dd>
              <dt><strong>Output and retention</strong></dt><dd>The working assessment appears in your conversation. Ordinary transition steps are retained in Workspace only through supported, explicitly confirmed saves; the skill alone does not provide storage.</dd>
              <dt><strong>Effects</strong></dt><dd>Proposes a next move. Reading this description performs no save, send, share, or scheduling action. Saving or executing a proposed action needs its own supported path and your confirmation.</dd>
              <dt><strong>Limits and next step</strong></dt><dd>Installation, connection health, and successful execution are unknown. Follow the setup guide, then ask ChatGPT to resume your SOTF Bundle and check which tools it can actually access. If the skill is absent, use the web workflows below; do not assume saved Workspace access. Protected Professional Context is unavailable in this pilot.</dd>
            </dl>
            <p className={styles.help} style={{ overflowWrap: "anywhere" }}>Definition: {skill.id} · Bundle version {release.version}</p>
          </details>
        </article>
        {release.manifest.workflows.map((workflow) => {
          let outcome: string;
          let input: string;
          let output: string;
          let effects: string;
          let next: string;
          let href: string;
          let action: string;
          switch (workflow.id) {
            case "sotf.workflow.clarify_direction":
              outcome = "Turn an uncertain transition into directions to test, decision criteria, and a next experiment.";
              input = "Your current question, timing, time available, work and environment preferences, and possible directions.";
              output = "Confirmed starting points and later direction reviews are saved in your SOTF Workspace. Review hypotheses, evidence, and criteria in Direction.";
              effects = "Completing the starting-point form or confirming a direction review saves ordinary transition records. It does not send, share, or schedule anything.";
              next = "Start with the form below if this is your first session. Otherwise choose Direction below, then review a direction or test another possibility. A hypothesis is not a proven fit.";
              href = "#sotf-saved-work";
              action = "Go to starting points and Direction";
              break;
            case "sotf.workflow.assess_opportunity":
              outcome = "Compare a real opportunity with your criteria and separate evidence from unanswered questions.";
              input = "A company and role, relevant job details, your confirmed criteria, and sources you have reviewed.";
              output = "The assessment appears in Opportunities. Confirmed opportunity details, evidence reviews, and your decision and next move are retained in SOTF Workspace.";
              effects = "Saving an opportunity or confirming a decision changes your transition records. Preparing an assessment does not submit an application, contact an employer, or send anything.";
              next = "Complete your starting points first if prompted. In Opportunities, choose Assess an opportunity, or review an existing role and record your decision. Missing evidence remains a question to investigate.";
              href = "/workspace/sotf/opportunities";
              action = "Open Opportunities";
              break;
            case "sotf.workflow.prepare_conversation":
              outcome = "Turn a person's reviewed context into useful questions and a conversation brief.";
              input = "A person, your learning objective, saved questions, reviewed source notes, and any agreed meeting details.";
              output = "Preparation appears in Networking under Conversation prep. Explicitly saved people, questions, source notes, and meeting records remain in SOTF Workspace; the generated brief is prepared from those records.";
              effects = "Saving people, questions, or a meeting changes your transition records. Preparing a brief does not send a message, share notes, or book a meeting. Outbound actions require separate review and manual execution.";
              next = "Complete starting points if prompted. Open Networking, add or select a person, then choose Prepare conversation. Without reviewed notes, preparation has gaps; do not treat suggested questions as researched facts.";
              href = "/workspace/sotf/networking";
              action = "Open Networking conversation prep";
              break;
            case "sotf.workflow.daily_brief":
              outcome = "See the next transition actions that need attention, with the reason to act and the consequence of waiting.";
              input = "Your saved commitments, meeting dates, opportunity deadlines, follow-ups, and current directions to test.";
              output = "The brief is prepared in the For today view from your saved SOTF records. It is recalculated when the view loads; this web view does not retain a separate daily-brief artifact.";
              effects = "Viewing the brief reads your transition state. It does not send notifications, change records, or create a recurring schedule. Acting on an item may open a separate confirmation step.";
              next = "Complete starting points if prompted. Open the daily brief and review For today. With no relevant saved work, there may be no immediate action. This is the bundle's web brief, not proof that the separate hosted daily-brief contract has run.";
              href = "/workspace/sotf/briefs";
              action = "Open the daily transition brief";
              break;
            case "sotf.workflow.weekly_learning":
              outcome = "Review what changed and decide what to start, stop, or change in your next week.";
              input = "Your hypotheses, experiments, reviewed evidence, decisions, commitments, and what you learned this week.";
              output = "Review questions appear in Learning. Your explicitly confirmed learning and next change are saved as a weekly review in SOTF Workspace.";
              effects = "Confirming the review saves your learning. Opening it does not change durable preferences, send a summary, share it with a coach, or activate a schedule.";
              next = "Complete starting points if prompted. Open Learning and choose Record what I will start, stop, and change. Review the evidence before confirming; declared automation support does not establish a running weekly schedule.";
              href = "/workspace/sotf/learning";
              action = "Open Learning";
              break;
            default:
              return null;
          }
          return <article key={workflow.id} className={styles.sheet} aria-label={workflow.name}>
            <p className={styles.eyebrow}>Pilot · Web workflow</p>
            <h3>{workflow.name}</h3>
            <p>{outcome}</p>
            <Link href={href}>{action}</Link>
            <details>
              <summary>How {workflow.name.toLowerCase()} works</summary>
              <dl>
                <dt><strong>Your input</strong></dt><dd>{input}</dd>
                <dt><strong>Access and connections</strong></dt><dd>Requires sign-in, enabled SOTF pilot access, Workspace authorization, and applicable bundle entitlement. Bundle entitlement is separate from ChatGPT setup. No external connection is required for supplied inputs; manage any third-party connections you use in ChatGPT. Host connection health and execution remain unknown here.</dd>
                <dt><strong>Output and retention</strong></dt><dd>{output}</dd>
                <dt><strong>Effects</strong></dt><dd>{effects}</dd>
                <dt><strong>Limits and next step</strong></dt><dd>{next} Keep private or sensitive context out of ordinary operational records; Protected Professional Context is unavailable in this pilot.</dd>
              </dl>
              <p className={styles.help} style={{ overflowWrap: "anywhere" }}>Definition: {workflow.id} · Version {workflow.version}</p>
            </details>
          </article>;
        })}
      </div>
      <p className={styles.help}>Declared automation definitions do not show running schedules. The separate hosted daily-brief contract and additional tool modes are outside this description slice. No last successful execution is claimed.</p>
    </div>
  </section>;
}
