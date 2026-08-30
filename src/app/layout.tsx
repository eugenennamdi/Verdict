import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { HumanWalletProvider } from "@/providers/HumanWalletProvider";
import { PostHogProvider } from "@/providers/PostHogProvider";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Verdict | Autonomous Growth Auditor",
  description: "An autonomous growth auditor that strips away AI positivity bias to deliver YC-grade startup teardowns. Built for founders to harden their go-to-market positioning, and designed for VCs and accelerators to automate deal-flow screening at scale.",
  verification: {
    google: "VJKxh7mmwYaLQq_Uq1--l1kopc3hJR9SCV7kgnH7Ovo",
  },
  openGraph: {
    title: "Verdict | Autonomous Growth Auditor",
    description: "An autonomous growth auditor that strips away AI positivity bias to deliver YC-grade startup teardowns. Built for founders to harden their go-to-market positioning, and designed for VCs and accelerators to automate deal-flow screening at scale.",
    url: "https://verdict.ai",
    siteName: "Verdict",
    type: "website",
    images: [
      {
        url: "/og-banner-v2.png",
        width: 1200,
        height: 630,
        alt: "Verdict | Autonomous Growth Auditor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Verdict | Autonomous Growth Auditor",
    description: "An autonomous growth auditor that strips away AI positivity bias to deliver YC-grade startup teardowns. Built for founders to harden their go-to-market positioning, and designed for VCs and accelerators to automate deal-flow screening at scale.",
    images: ["/og-banner-v2.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`antialiased bg-slate-50 dark:bg-slate-950 ${geistSans.variable}`}
    >
      <body className="min-h-screen flex flex-col font-sans text-slate-900 dark:text-slate-50">
        <PostHogProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            disableTransitionOnChange
          >
            <HumanWalletProvider>{children}</HumanWalletProvider>
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
