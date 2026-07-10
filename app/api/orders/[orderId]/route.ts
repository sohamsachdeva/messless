// ============================================================
// app/api/orders/[orderId]/route.ts
// GET /api/orders/:orderId — fetch a single order with full details
// Used by checkout page and order tracking page
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, orderRateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const rl = await checkRateLimit(orderRateLimit, _req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendor: { select: { id: true, name: true, location: true, phone: true } },
      orderItems: {
        include: {
          menuItem: { select: { id: true, name: true, imageUrl: true } },
        },
      },
      payment: true,
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Only the order owner or admin can view
  if (order.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(order);
}
