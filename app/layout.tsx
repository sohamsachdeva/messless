// ============================================================
// app/layout.tsx
// Root layout — wraps every page with SessionProvider + Navbar + ThemeProvider
// ============================================================

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/shared/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ThemeColorMeta } from "@/components/providers/ThemeColorMeta";
import Navbar from "@/components/shared/Navbar";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "MessLess — Order food at Thapar",
  description: "Browse cafeterias, order ahead, pay online. Made by Thapar, for Thapar.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F8F8" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>
        <ThemeProvider>
          <ThemeColorMeta />
          <SessionProvider>
            <Navbar />
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
