import { WorkspaceShell } from "@/components/workspace-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell sotfPilotEnabled={process.env.SOTF_PILOT_ENABLED === "true"}>{children}</WorkspaceShell>;
}
