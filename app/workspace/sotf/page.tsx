import { notFound, redirect } from "next/navigation";
import { SotfExperience } from "@/components/sotf/sotf-experience";
import { createWorkspaceServerClient } from "@/lib/supabase/server";

export default async function SotfBundlePage() {
  if (process.env.SOTF_PILOT_ENABLED !== "true") notFound();
  const supabase = await createWorkspaceServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) redirect("/login");
  const { data: allowed, error } = await supabase.rpc("sotf_has_access");
  if (error || allowed !== true) notFound();
  return <SotfExperience mode="connected" />;
}
