"use client";
import { useWorkspace } from "@/components/workspace-provider";
import { WritingAttention } from "@/components/writing/writing-attention";
import { MinistryAttention } from "@/components/ministry-bundle/attention";
import { NonprofitAttention } from "@/components/nonprofit-bundle/attention";
import { InvestorAttention } from "@/components/investor-bundle/attention";
import { ExecutiveAttention } from "@/components/executive-bundle/attention";
// The shell consumes declarative contributions. Feature implementations live
// in this registry, never in identity- or client-specific navigation branches.
const widgets = { "writer.widget.publication_queue": WritingAttention, "ministry.widget.upcoming_teaching": MinistryAttention, "nonprofit.widget.followups": NonprofitAttention, "investor.widget.thesis_changes": InvestorAttention, "executive.widget.attention_brief": ExecutiveAttention };
export function BundleDashboard() {
  const { bundleExperience } = useWorkspace();
  return <>{bundleExperience?.ui.dashboardWidgets.map((item) => {
    const Widget = widgets[item.id as keyof typeof widgets];
    return Widget ? <Widget key={item.id} label={item.label} /> : null;
  })}</>;
}
