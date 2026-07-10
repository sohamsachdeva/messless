// ============================================================
// app/api/keep-alive/route.ts
// Lightweight endpoint that pings the database to prevent
// Neon's scale-to-zero from suspending the compute.
// Should be called every 4 minutes via cron.
// ============================================================

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  const start = Date.now();

  try {
    // Minimal query — just wakes up the compute
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - start;

    return NextResponse.json({
      ok: true,
      ms,
      message: ms > 2000
        ? "Database was cold — woke up and cached"
        : "Database was warm",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Keep-alive query failed" },
      { status: 500 },
    );
  }
}
