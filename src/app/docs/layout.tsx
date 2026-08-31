import type { Metadata } from "next";
import { DocsShell } from "@/components/docs/DocsShell";

export const metadata: Metadata = {
  title: {
    template: "%s | Verdict Docs",
    default: "Verdict Documentation",
  },
  description:
    "Comprehensive documentation for Verdict, the autonomous growth intelligence platform and programmatic x402 audit API.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DocsShell>{children}</DocsShell>;
}
