// app/api/vendor/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, apiRateLimit } from "@/lib/rateLimiter";

export async function GET(_req: NextRequest) {
  const rl = await checkRateLimit(apiRateLimit, _req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const vendors = await prisma.vendor.findMany({
  where: { ownerId: session.user.id, isApproved: true },
  include: { hub: { select: { id: true, name: true } } },
});

const vendor = vendors[0]; // primary shop

  if (!vendor) {
    return NextResponse.json({ vendor: null, todayOrders: 0, totalRevenue: 0, pendingItems: 0, liveItems: 0, recentOrders: [] });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayOrders, todayAmounts, allAmounts, pendingItems, liveItems, recentOrders] = await Promise.all([
    prisma.order.count({
      where: { vendorId: vendor.id, createdAt: { gte: todayStart } },
    }),
    prisma.order.findMany({
      where: { vendorId: vendor.id, createdAt: { gte: todayStart } },
      select: { totalAmount: true },
    }),
    prisma.order.findMany({
      where: { vendorId: vendor.id },
      select: { totalAmount: true },
    }),
    prisma.menuItem.count({
      where: { vendorId: vendor.id, approvalStatus: "PENDING" },
    }),
    prisma.menuItem.count({
      where: { vendorId: vendor.id, approvalStatus: "APPROVED" },
    }),
    prisma.order.findMany({
      where: { vendorId: vendor.id },
      include: {
        user: { select: { name: true } },
        orderItems: {
          include: { menuItem: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalRevenue = allAmounts.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const todayRevenue = todayAmounts.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const data = {
    vendor,
    todayOrders,
    totalRevenue: Math.round(totalRevenue),
    todayRevenue: Math.round(todayRevenue),
    pendingItems,
    liveItems,
    recentOrders,
  };

  return NextResponse.json(data);
}