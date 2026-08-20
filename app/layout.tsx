import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Lead Emergence Workspace",
  description: "Private personal workspace for projects, planning, and leadership work."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
