import type { Metadata } from "next";
import { SotfExperience } from "@/components/sotf/sotf-experience";

export const metadata: Metadata = { title: "SOTF Bundle · fictional workflow preview", robots: { index: false, follow: false } };
export default function PreviewPage() { return <main><SotfExperience mode="preview" /></main>; }
