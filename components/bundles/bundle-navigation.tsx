"use client";
import Link from "next/link";
import { BookOpen, PenLine, ChartCandlestick } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
export function BundleNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { bundleExperience, bundleError, refreshBundleExperience } = useWorkspace();
  return <>
    {bundleExperience?.ui.primaryNavigation.map((item) => {
      const Icon = item.icon === "pen-line" ? PenLine : item.icon === "chart-candlestick" ? ChartCandlestick : BookOpen;
      return <Link key={item.id} href={item.route} className="nav-link"
        data-active={pathname === item.route || pathname.startsWith(item.route + "/")} onClick={onNavigate}>
        <Icon size={18} /><span>{item.label}</span>
      </Link>;
    })}
    {bundleError ? <button className="sign-out" onClick={refreshBundleExperience}>Retry bundle access</button> : null}
  </>;
}
