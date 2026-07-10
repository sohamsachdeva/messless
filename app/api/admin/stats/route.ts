// app/api/admin/stats/route.ts
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

  const stats = await Promise.all([
    prisma.vendor.count({ where: { isApproved: false } }),
    prisma.menuItem.count({ where: { approvalStatus: "PENDING" } }),
    prisma.vendor.count({ where: { isApproved: true } }),
    prisma.order.count(),
    prisma.user.count({ where: { role: "STUDENT" } }),
  ]);

  const result = {
    pendingVendors: stats[0],
    pendingMenuItems: stats[1],
    totalVendors: stats[2],
    totalOrders: stats[3],
    totalStudents: stats[4],
  };

  return NextResponse.json(result);
}