// ============================================================
// app/api/vendor/orders/route.ts
// GET   /api/vendor/orders    — fetch all orders for vendor's shop
// PATCH /api/vendor/orders    — update order status
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, apiRateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

const VALID_TRANSITIONS: Record<string, string[]> = {
  PLACED:    ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY:     ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],
  CANCELLED: [],
};

// ── GET — fetch paginated orders for the vendor's shop ────────
export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(apiRateLimit);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  // ── Parse pagination & filter params ───────────────────────
  const url = new URL(req.url);
  const page   = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit  = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const filter = url.searchParams.get("filter") ?? "active"; // "active" | "completed" | "all"
  const skip   = (page - 1) * limit;

  // ── Build where clause ──────────────────────────────────────
  const where: Record<string, any> = { vendorId: vendor.id };
  if (filter === "active") {
    where.status = { in: ["PLACED", "CONFIRMED", "PREPARING", "READY"] };
  } else if (filter === "completed") {
    where.status = { in: ["PICKED_UP", "CANCELLED"] };
  }

  // ── Fetch total count + orders in parallel ─────────────────
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, phone: true, thaparId: true },
        },
        orderItems: {
          include: {
            menuItem: { select: { id: true, name: true, imageUrl: true } },
          },
        },
        payment: {
          select: { status: true, amount: true, method: true, paidAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const result = { orders, total, page, limit, totalPages };

  return NextResponse.json(result);
}

// ── PATCH — update order status ──────────────────────────────
export async function PATCH(req: NextRequest) {
  const rl = await checkRateLimit(apiRateLimit, req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId, status } = await req.json();

  if (!orderId || !status) {
    return NextResponse.json({ error: "orderId and status are required" }, { status: 400 });
  }

  // Verify vendor owns this order's shop
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendor: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.vendor.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate status transition
  const allowed = VALID_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${order.status} to ${status}. Allowed: ${allowed.join(", ") || "none"}` },
      { status: 400 }
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  return NextResponse.json(updated);
}
