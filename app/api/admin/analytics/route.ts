// app/api/admin/analytics/route.ts
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

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Date 30 days ago for trend data
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  // ─── Aggregations ──────────────────────────────────────
  const [
    totalRevenue,
    todayRevenue,
    totalOrders,
    totalStudents,
    totalVendors,
    pendingVendors,
    orderStatusCounts,
    recentOrdersByDay,
    recentRevenueByDay,
    vendorRevenue,
    popularItems,
    hubPerformance,
    peakHours,
    userGrowth,
  ] = await Promise.all([
    // Total revenue from successful payments
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
    }),

    // Today's revenue
    prisma.payment.aggregate({
      where: { status: "SUCCESS", paidAt: { gte: todayStart } },
      _sum: { amount: true },
    }),

    // Total orders
    prisma.order.count(),

    // Total students
    prisma.user.count({ where: { role: "STUDENT" } }),

    // Total approved vendors
    prisma.vendor.count({ where: { isApproved: true } }),

    // Pending vendors
    prisma.vendor.count({ where: { isApproved: false } }),

    // Orders grouped by status
    prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // Orders per day (last 30 days)
    prisma.$queryRawUnsafe<{ date: string; count: number }[]>(
      `SELECT DATE(o.created_at) as date, COUNT(*)::int as count
       FROM orders o
       WHERE o.created_at >= $1
       GROUP BY DATE(o.created_at)
       ORDER BY date`,
      thirtyDaysAgo
    ),

    // Revenue per day (last 30 days) — all orders, not just paid
    prisma.$queryRawUnsafe<{ date: string; amount: number }[]>(
      `SELECT DATE(o.created_at) as date, SUM(o.total_amount)::float as amount
       FROM orders o
       WHERE o.created_at >= $1
       GROUP BY DATE(o.created_at)
       ORDER BY date`,
      thirtyDaysAgo
    ),

    // Top vendors by revenue (all orders, not just paid)
    prisma.vendor.findMany({
      where: { isApproved: true },
      select: {
        id: true,
        name: true,
        hubId: true,
        hub: { select: { name: true } },
        totalOrders: true,
        _count: { select: { menuItems: true } },
        orders: {
          select: { totalAmount: true },
        },
      },
      orderBy: { totalOrders: "desc" },
      take: 10,
    }),

    // Most popular menu items
    prisma.menuItem.findMany({
      where: { approvalStatus: "APPROVED" },
      select: {
        id: true,
        name: true,
        price: true,
        itemType: true,
        vendor: { select: { name: true } },
        _count: { select: { orderItems: true } },
      },
      orderBy: { orderItems: { _count: "desc" } },
      take: 10,
    }),

    // Orders per hub (all orders, not just paid)
    prisma.hub.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { vendors: true } },
        vendors: {
          select: {
            _count: { select: { orders: true } },
            orders: {
              select: { totalAmount: true },
            },
          },
        },
      },
    }),

    // Orders by hour of day
    prisma.$queryRawUnsafe<{ hour: number; count: number }[]>(
      `SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as count
       FROM orders
       GROUP BY hour
       ORDER BY hour`
    ),

    // Student registrations per day (last 30 days)
    prisma.$queryRawUnsafe<{ date: string; count: number }[]>(
      `SELECT DATE(created_at) as date, COUNT(*)::int as count
       FROM users
       WHERE role = 'STUDENT' AND created_at >= $1
       GROUP BY DATE(created_at)
       ORDER BY date`,
      thirtyDaysAgo
    ),
  ]);

  // ─── Process data ──────────────────────────────────────

  // Orders by day → fill missing days
  const ordersByDayMap = new Map<string, number>();
  for (const row of recentOrdersByDay) {
    const d = new Date(row.date).toISOString().slice(0, 10);
    ordersByDayMap.set(d, row.count);
  }

  // Revenue by day → fill missing days
  const revenueByDayMap = new Map<string, number>();
  for (const row of recentRevenueByDay) {
    const d = new Date(row.date).toISOString().slice(0, 10);
    revenueByDayMap.set(d, Number(row.amount));
  }

  // User growth by day → fill missing days
  const userGrowthMap = new Map<string, number>();
  for (const row of userGrowth) {
    const d = new Date(row.date).toISOString().slice(0, 10);
    userGrowthMap.set(d, row.count);
  }

  // Fill all 30 days
  const dailySeries: { date: string; orders: number; revenue: number; newUsers: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailySeries.push({
      date: key,
      orders: ordersByDayMap.get(key) ?? 0,
      revenue: Math.round((revenueByDayMap.get(key) ?? 0) * 100) / 100,
      newUsers: userGrowthMap.get(key) ?? 0,
    });
  }

  // Status distribution
  const statusDistribution = orderStatusCounts.map((s) => ({
    status: s.status,
    count: s._count.id,
  }));

  // Vendor revenue data
  const vendorsWithRevenue = vendorRevenue.map((v) => {
    const rev = v.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    return {
      id: v.id,
      name: v.name,
      hubName: v.hub?.name ?? "Unassigned",
      totalOrders: v.totalOrders,
      menuItemCount: v._count.menuItems,
      revenue: Math.round(rev),
    };
  });

  // Hub performance
  const hubs = hubPerformance.map((h) => {
    let totalOrders = 0;
    let totalRevenue = 0;
    for (const vendor of h.vendors) {
      totalOrders += vendor._count.orders;
      totalRevenue += vendor.orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    }
    return {
      id: h.id,
      name: h.name,
      vendorCount: h._count.vendors,
      totalOrders,
      totalRevenue: Math.round(totalRevenue),
    };
  });

  // Peak hours
  const peakHoursData = peakHours.map((h) => ({
    hour: h.hour,
    count: h.count,
  }));

  const result = {
    summary: {
      totalRevenue: Math.round(Number(totalRevenue._sum.amount ?? 0)),
      todayRevenue: Math.round(Number(todayRevenue._sum.amount ?? 0)),
      totalOrders,
      totalStudents,
      totalVendors,
      pendingVendors,
    },
    dailySeries,
    statusDistribution,
    topVendors: vendorsWithRevenue,
    popularItems: popularItems.map((i) => ({
      id: i.id,
      name: i.name,
      price: Number(i.price),
      itemType: i.itemType,
      vendorName: i.vendor.name,
      totalOrdered: i._count.orderItems,
    })),
    hubPerformance: hubs,
    peakHours: peakHoursData,
  };

  return NextResponse.json(result);
}

