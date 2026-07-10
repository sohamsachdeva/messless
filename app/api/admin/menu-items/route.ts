// app/api/admin/menu-items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, adminRateLimit } from "@/lib/rateLimiter";

export async function GET(_req: NextRequest) {
  const rl = await checkRateLimit(adminRateLimit, _req);
  if (rl) return rl;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.menuItem.findMany({
    include: {
      vendor: { select: { id: true, name: true } },
    },
    orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(items);
}