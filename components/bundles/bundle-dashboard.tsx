"use client";
import { useWorkspace } from "@/components/workspace-provider";
import { WritingAttention } from "@/components/writing/writing-attention";
import { MinistryAttention } from "@/components/ministry-bundle/attention";
import { NonprofitAttention } from "@/components/nonprofit-bundle/attention";
import { InvestorAttention } from "@/components/investor-bundle/attention";
import {WorkspaceAttentionWidget} from "./workspace-attention";
import { ExecutiveAttention } from "@/components/executive-bundle/attention";
// The shell consumes declarative contributions. Feature implementations live
// in this registry, never in identity- or client-specific navigation branches.
const widgets = { "workspace.widget.attention": WorkspaceAttentionWidget, "writer.widget.publication_queue": WritingAttention, "ministry.widget.upcoming_teaching": MinistryAttention, "nonprofit.widget.followups": NonprofitAttention, "investor.widget.thesis_changes": InvestorAttention, "executive.widget.attention_brief": ExecutiveAttention };
export function BundleDashboard() {
  const { bundleExperience, refreshBundleExperience } = useWorkspace();
  return <>{bundleExperience?.layout?.status==="unavailable" ? <section className="panel"><p role="status">Your saved layout is temporarily unavailable. Your work and access have not changed.</p><button className="button secondary" onClick={refreshBundleExperience}>Retry saved layout</button></section> : null}{bundleExperience?.ui.dashboardWidgets.map((item) => {
    const Widget = widgets[item.id as keyof typeof widgets];
    return Widget ? <Widget key={item.id} label={item.label} /> : null;
  })}</>;
}
