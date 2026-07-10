// ============================================================
// app/api/vendors/menu-items/[itemId]/route.ts
// PATCH — vendor toggles availability of approved items
// DELETE — vendor removes an item
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, apiRateLimit } from "@/lib/rateLimiter";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ iItemId: string }> }
) {
  const { iItemId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: iItemId },
    include: { vendor: true },
  });

  const rl = await checkRateLimit(apiRateLimit, req);
  if (rl) return rl;

  if (!item || item.vendor.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only approved items can be toggled
  if (item.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "Item must be approved before toggling availability" }, { status: 400 });
  }

  const body = await req.json();
  const updated = await prisma.menuItem.update({
    where: { id: iItemId },
    data: { isAvailable: body.isAvailable },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ iItemId: string }> }
) {
  const { iItemId } = await params;
  const rl = await checkRateLimit(apiRateLimit, _req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: iItemId },
    include: { vendor: true },
  });

  if (!item || item.vendor.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.menuItem.delete({ where: { id: iItemId } });

  return NextResponse.json({ success: true });
}