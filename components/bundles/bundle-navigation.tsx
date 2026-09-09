"use client";
import Link from "next/link";
import { BookOpen, PenLine, ChartCandlestick } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
export function BundleNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { bundleExperience, bundleError, refreshBundleExperience } = useWorkspace();
  return <>
    {bundleExperience?.ui.primaryNavigation.filter(item=>item.route!=="/workspace").map((item) => {
      const Icon = item.icon === "pen-line" ? PenLine : item.icon === "chart-candlestick" ? ChartCandlestick : BookOpen;
      return <Link key={item.id} href={item.route} className="nav-link"
        data-active={pathname === item.route || pathname.startsWith(item.route + "/")} onClick={onNavigate}>
        <Icon size={18} /><span>{item.label}</span>
      </Link>;
    })}
    {bundleExperience?.layout?.status==="unavailable" ? <button className="sign-out" onClick={refreshBundleExperience}>Retry saved layout</button> : null}
    {bundleExperience?.capabilityIds.includes("workspace.personalize") ? <Link className="nav-link" href="/workspace/layout" onClick={onNavigate} data-active={pathname==="/workspace/layout"}>Workspace layout</Link> : null}
    {bundleExperience?.capabilityIds.includes("workspace.search") ? <Link className="nav-link" href="/workspace/search" onClick={onNavigate} data-active={pathname==="/workspace/search"}>Search saved work</Link> : null}
    {bundleExperience?.capabilityIds.includes("workspace.attention") ? <Link className="nav-link" href="/workspace/attention" onClick={onNavigate} data-active={pathname==="/workspace/attention"}>Attention</Link> : null}
    {bundleError ? <button className="sign-out" onClick={refreshBundleExperience}>Retry bundle access</button> : null}
  </>;
}
