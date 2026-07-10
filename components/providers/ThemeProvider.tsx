"use client";

// ============================================================
// components/providers/ThemeProvider.tsx
// Wraps next-themes ThemeProvider to enable dark/light mode
// ============================================================

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
