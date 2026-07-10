// ============================================================
// app/api/hubs/[id]/route.ts
// GET /api/hubs/:id
// Returns one hub + all its approved vendors
// Called by hub/[hubId]/page.tsx
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, apiRateLimit } from "@/lib/rateLimiter";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rl = await checkRateLimit(apiRateLimit, _req);
  if (rl) return rl;

  const hub = await prisma.hub.findUnique({
    where: { id: id },
    include: {
      vendors: {
        where: {
          isApproved: true,
          isActive: true,
        },
        include: {
          _count: {
            select: { menuItems: true },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!hub) {
    return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  }

  return NextResponse.json(hub);
}
