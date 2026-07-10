"use client";
// app/page.tsx — root redirect
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.replace("/login"); return; }
    const role = (session.user as any)?.role;
    if (role === "VENDOR") router.replace("/vendor/dashboard");
    else if (role === "ADMIN") router.replace("/admin/dashboard");
    else router.replace("/browse");
  }, [session, status, router]);

  return null;
}
