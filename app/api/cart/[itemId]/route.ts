// ============================================================
// app/api/cart/[itemId]/route.ts
// PATCH  /api/cart/:itemId  — update quantity of one cart item
// DELETE /api/cart/:itemId  — remove one item from cart
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, orderRateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const rl = await checkRateLimit(orderRateLimit, req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { quantity } = await req.json();

  if (quantity < 1) {
    // If quantity drops to 0 or below, remove the item
    await prisma.cartItem.deleteMany({
      where: { id: itemId, userId: session.user.id },
    });
    return NextResponse.json({ deleted: true });
  }

  const updated = await prisma.cartItem.updateMany({
    where: { id: itemId, userId: session.user.id },
    data: { quantity },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const rl = await checkRateLimit(orderRateLimit, _req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.cartItem.deleteMany({
    where: { id: itemId, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
