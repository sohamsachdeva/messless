// ============================================================
// app/api/orders/route.ts
// GET  /api/orders — user's order history
// POST /api/orders — place new order (cart → order transaction)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, orderRateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET() {
  const rl = await checkRateLimit(orderRateLimit);
  if (rl) return rl;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: {
      vendor: { select: { id: true, name: true, location: true } },
      orderItems: { include: { menuItem: { select: { id: true, name: true, imageUrl: true } } } },
      payment: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(orderRateLimit, req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { vendorId, orderMode, note, deliveryLocation } = body;

  if (!vendorId || !orderMode) {
    return NextResponse.json({ error: "vendorId and orderMode are required" }, { status: 400 });
  }

  // Fetch cart items
  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: { menuItem: true },
  });

  if (cartItems.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Calculate total
  const totalAmount = cartItems.reduce(
    (sum, item) => sum + Number(item.menuItem.price) * item.quantity,
    0
  );

  // Atomic transaction: create order + items + clear cart
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId: session.user.id,
        vendorId,
        totalAmount,
        orderMode,
        note: note ?? null,
        deliveryLocation: deliveryLocation ?? null,
        status: "PLACED",
        orderItems: {
          create: cartItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.menuItem.price,
          })),
        },
      },
      include: {
        orderItems: true,
        vendor: { select: { id: true, name: true } },
      },
    });

    // Clear cart
    await tx.cartItem.deleteMany({ where: { userId: session.user.id } });

    return newOrder;
  });

  return NextResponse.json(order, { status: 201 });
}
