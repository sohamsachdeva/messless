"use client";

// ============================================================
// components/shared/SessionProvider.tsx
// Client wrapper for NextAuth SessionProvider
// Required because layout.tsx is a server component
// ============================================================

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
