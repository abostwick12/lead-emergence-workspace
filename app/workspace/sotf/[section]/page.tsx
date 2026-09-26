import { notFound } from "next/navigation";
import { connectedSotfExperience } from "../connected-experience";
import type { SotfSection } from "@/components/sotf/sotf-experience";

const sections: SotfSection[] = ["opportunities", "briefs", "learning"];

export default async function SotfSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as SotfSection)) notFound();
  return connectedSotfExperience(section as SotfSection);
}
