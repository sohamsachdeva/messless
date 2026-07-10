// ============================================================
// app/api/cart/route.ts
// GET    /api/cart  — fetch current user's cart
// POST   /api/cart  — add item to cart
// DELETE /api/cart  — clear entire cart
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, orderRateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

// ── GET — fetch cart ────────────────────────────────────────
export async function GET() {
  const rl = await checkRateLimit(orderRateLimit);
  if (rl) return rl;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: {
      menuItem: {
        include: {
          vendor: {
            select: { id: true, name: true, location: true, supportsTakeaway: true, supportsDineIn: true, supportsDelivery: true },
          },
        },
      },
    },
    orderBy: { addedAt: "asc" },
  });

  return NextResponse.json(cartItems);
}

// ── POST — add item to cart ─────────────────────────────────
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(orderRateLimit, req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { menuItemId, quantity } = body;

  if (!menuItemId || !quantity || quantity < 1) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Check item exists and is available
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: { vendor: true },
  });

  if (!menuItem || !menuItem.isAvailable) {
    return NextResponse.json({ error: "Item not available" }, { status: 404 });
  }

  // Enforce single-vendor cart — check if cart has items from a different vendor
  const existingCartItem = await prisma.cartItem.findFirst({
    where: { userId: session.user.id },
    include: { menuItem: true },
  });

  if (existingCartItem && existingCartItem.menuItem.vendorId !== menuItem.vendorId) {
    return NextResponse.json(
      { error: "DIFFERENT_VENDOR", message: "Your cart has items from another shop. Clear cart to add from this shop." },
      { status: 409 }
    );
  }

  // Upsert: add or increment quantity
  const cartItem = await prisma.cartItem.upsert({
    where: { userId_menuItemId: { userId: session.user.id, menuItemId } },
    update: { quantity: { increment: quantity } },
    create: { userId: session.user.id, menuItemId, quantity },
  });

  return NextResponse.json(cartItem, { status: 201 });
}

// ── DELETE — clear cart ─────────────────────────────────────
export async function DELETE() {
  const rl = await checkRateLimit(orderRateLimit);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.cartItem.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ success: true });
}
