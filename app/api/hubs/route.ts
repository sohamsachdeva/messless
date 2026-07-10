// ============================================================
// app/api/hubs/route.ts
// GET /api/hubs — returns all hubs with vendor count
// Called by the browse page to populate hub cards
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, apiRateLimit } from "@/lib/rateLimiter";

export async function GET(_req: NextRequest) {
  const start = Date.now();

  const rl = await checkRateLimit(apiRateLimit, _req);
  if (rl) return rl;

  const hubs = await prisma.hub.findMany({
    include: {
      _count: {
        select: {
          vendors: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const totalMs = Date.now() - start;
  console.log(`[timing] /api/hubs total=${totalMs}ms`);

  return NextResponse.json(hubs);
}
