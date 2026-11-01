import { connectedSotfExperience } from "./connected-experience";
import { WorkflowDescriptions } from "@/components/sotf/workflow-descriptions";

export default async function SotfBundlePage() {
  const experience = await connectedSotfExperience();
  return <><WorkflowDescriptions /><div id="sotf-saved-work" tabIndex={-1}>{experience}</div></>;
}
