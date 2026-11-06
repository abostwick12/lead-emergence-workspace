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
      <h2>More pilot preparation</h2>
      <p>These are additional modes of the existing preparation tool, not separate released workflow definitions. Each reads saved ordinary transition work. ChatGPT setup and tool discovery are not checked here; no successful execution is claimed.</p>
      <div className={styles.twoColumns}>
        {(["coaching", "networking", "stories", "interview", "offers", "professional_work", "scheduling", "invitation"] as const).map((mode) => {
          let name: string;
          let outcome: string;
          let input: string;
          let output: string;
          let effects: string;
          let next: string;
          let href: string;
          let action: string;
          switch (mode) {
            case "coaching":
              name = "Prepare a coaching session";
              outcome = "Bring changed decisions, completed or blocked commitments, and questions into your next SOTF session.";
              input = "Saved transition work and, optionally in ChatGPT, the date to review from. Without a date, preparation starts from your last coaching debrief or chapter start.";
              output = "The agenda and reviewable summary appear in the web session panel or ChatGPT response. Preparation does not save a separate session brief; its source records remain in Workspace.";
              effects = "Preparation reads saved records. It does not share the summary with a coach, send anything, or schedule a session. Review any summary before sharing it yourself.";
              next = "Complete starting points if prompted. Follow the link to your saved work, choose Today, then Prepare my SOTF session. Missing or unrecorded developments will not appear.";
              href = "#sotf-saved-work";
              action = "Go to saved work for session preparation";
              break;
            case "networking":
              name = "Plan a networking week";
              outcome = "Review the people in your weekly plan, the reason to contact each, and the next relationship step.";
              input = "Saved people, reasons to connect, relationship history, and a networking week. When you do not select a week, preparation uses the current week in Chicago.";
              output = "The plan and progress appear in Networking or the ChatGPT response. Confirmed people, weekly plans, and actual outcomes are retained in Workspace; preparation itself does not save a new plan.";
              effects = "Opening preparation reads saved work. Adding a person or confirming a weekly review saves records through separate controls. A planned contact is not a sent message or completed conversation.";
              next = "Open Networking and add or select a person for the week. Review their next step and record only actual outcomes. Empty plans and missing context remain visible; no outreach is sent automatically.";
              href = "/workspace/sotf/networking";
              action = "Open the networking week";
              break;
            case "stories":
              name = "Find a relevant accomplishment";
              outcome = "Find saved examples that match a question or skill, including older accomplishments.";
              input = "A question or skill to search for and accomplishments you have deliberately saved in the ordinary operational story bank.";
              output = "Matching saved examples appear in the web examples panel or ChatGPT response. The search does not save a new story or rewrite the source accomplishment.";
              effects = "Search reads saved examples. It does not invent accomplishments, change approved language, send anything, or share your story bank.";
              next = "Complete starting points if prompted. Follow the link to saved work, choose Today, then Find an example and enter your question. No match means more evidence is needed; this does not search all ChatGPT history.";
              href = "#sotf-saved-work";
              action = "Go to saved work to find an example";
              break;
            case "interview":
              name = "Prepare for an interview";
              outcome = "Choose relevant examples, practice questions, and the most consequential gaps for an existing opportunity.";
              input = "An existing saved opportunity, interviewer context you supply, and any saved interview debriefs and reviewed accomplishments.";
              output = "Preparation appears in the ChatGPT response from saved Workspace records. Practice answers are conversation output; saving a debrief or accomplishment requires a separate confirmed step.";
              effects = "Preparation reads records. It does not submit an application, contact an interviewer, save practice answers, or invent employer feedback or metrics.";
              next = "Follow the setup and resume instructions, then ask ChatGPT: Resume my SOTF Bundle, select my saved opportunity, and prepare my interview using the interviewer context I provide. If the preparation tool is absent, use Opportunities to review that role. Missing evidence remains unresolved.";
              href = "/sotf/connect";
              action = "Read the ChatGPT setup and resume instructions";
              break;
            case "offers":
              name = "Compare saved offers";
              outcome = "Compare offer terms against the same confirmed criteria and identify tradeoffs, promises, and questions to resolve.";
              input = "Saved offers linked to existing opportunities, sourced terms, confirmed criteria, negotiation priorities, and unresolved questions.";
              output = "The comparison appears in the ChatGPT response. Saved offer terms and their sources remain in Workspace; preparation does not retain a new comparison artifact.";
              effects = "Comparison reads records. It does not negotiate, accept or decline an offer, contact an employer, or decide a winner for you.";
              next = "Follow the setup and resume instructions, then ask ChatGPT: Resume my SOTF Bundle and compare my saved offers against my confirmed criteria; show unresolved terms and recruiting promises. If no offers are saved or the tool is absent, open Opportunities to record reviewed terms. Unconfirmed promises stay uncertain.";
              href = "/sotf/connect";
              action = "Read the ChatGPT setup and resume instructions";
              break;
            case "professional_work":
              name = "Prepare the next professional chapter";
              outcome = "After an actual offer acceptance, prepare manager alignment, stakeholder learning, and an early contribution to test.";
              input = "A saved offer with your explicitly recorded actual acceptance, the linked role, recruiting promises, and any saved checkpoints or carry-forward learning.";
              output = "Preparation appears in the ChatGPT response using saved Workspace records. Your accepted offer and confirmed plans remain in Workspace; preparation alone does not save a new plan.";
              effects = "Preparation reads records. It does not accept the offer, change chapter status, create commitments, notify your manager, or schedule checkpoints.";
              next = "Follow the setup and resume instructions, then ask ChatGPT: Resume my SOTF Bundle and prepare my next professional chapter from my recorded actual acceptance. Without recorded acceptance, the tool asks you to compare the offer and record what actually happened first. If absent, review Offer details and first 90 days in Opportunities.";
              href = "/sotf/connect";
              action = "Read the ChatGPT setup and resume instructions";
              break;
            case "scheduling":
              name = "Propose conversation times";
              outcome = "Find up to three possible conversation times within the windows you explicitly checked.";
              input = "The person's offered window, your available and busy windows, the availability source, a recent calendar check, time zone, duration, and buffer.";
              output = "Proposed times appear in the Find a time dialog or ChatGPT response. On the web, Save the draft for review separately retains an email draft in Workspace; proposing times alone saves nothing.";
              effects = "Preparation does not read your calendars automatically, send a reply, reserve a slot, or book a meeting. The separate web save changes only the draft record.";
              next = "Complete starting points if prompted. Follow the link to saved work, choose People, then Find a time for a saved person. Check all your calendars and enter windows you can offer. In ChatGPT, resume SOTF and ask to propose times from those checked windows. A stale check or no shared window requires a new check or another window.";
              href = "#sotf-saved-work";
              action = "Go to saved work to find a time";
              break;
            case "invitation":
              name = "Prepare an invitation draft";
              outcome = "Prepare reviewable invitation text for a meeting whose time has already been agreed.";
              input = "A saved meeting with accepted status, agreed start and end times, a linked person, and the conversation objective.";
              output = "The ChatGPT preparation response contains a proposed draft without saving it. On the web, Prepare invitation draft saves an action draft in Workspace for review; it does not create a calendar event.";
              effects = "ChatGPT preparation is read-only. The separate web action saves the draft. Neither sends an invitation, creates an event, or proves the recipient accepted a calendar invitation.";
              next = "Complete starting points if prompted. Follow the link to saved work, choose People, and find the agreed meeting under Conversations; choose Prepare invitation draft. The button also requires an accepted meeting linked to a person with no saved debrief. Or resume SOTF in ChatGPT and ask to prepare an invitation draft for that agreed meeting. Record actual agreement first; review recipient, local time, and location in your own calendar before sending manually.";
              href = "#sotf-saved-work";
              action = "Go to saved work to review the agreed meeting";
              break;
          }
          return <article key={mode} className={styles.sheet} aria-label={name}>
            <p className={styles.eyebrow}>Pilot · Preparation mode · Setup not checked</p>
            <h3>{name}</h3>
            <p>{outcome}</p>
            <Link href={href}>{action}</Link>
            <details>
              <summary>How {name.toLowerCase()} works</summary>
              <dl>
                <dt><strong>Your input</strong></dt><dd>{input}</dd>
                <dt><strong>Access and connections</strong></dt><dd>Requires sign-in, enabled SOTF pilot access, Workspace authorization, and applicable bundle entitlement. ChatGPT use also needs a separately authorized Workspace connection and discovery of the preparation tool. Installation, discovery, connection health, and execution are not established here. Manage third-party connections in your own ChatGPT account; supplied inputs do not require a native Workspace connection.</dd>
                <dt><strong>Output and retention</strong></dt><dd>{output}</dd>
                <dt><strong>Effects</strong></dt><dd>{effects}</dd>
                <dt><strong>Limits and next step</strong></dt><dd>{next} Keep private or sensitive context out of ordinary operational records; Protected Professional Context is unavailable in this pilot.</dd>
              </dl>
              <p className={styles.help} style={{ overflowWrap: "anywhere" }}>Existing contract: sotf_prepare_next_move · Mode: {mode}. These modes have no independent workflow version.</p>
            </details>
          </article>;
        })}
      </div>
      <p className={styles.help}>Declared automation definitions do not show running schedules. The separate hosted daily-brief contract remains outside this description slice. No last successful execution is claimed.</p>
    </div>
  </section>;
}
