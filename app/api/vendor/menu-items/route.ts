// ============================================================
// app/api/vendor/menu-items/route.ts
// GET  — fetch vendor's own menu items
// POST — submit new item for admin approval
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, apiRateLimit } from "@/lib/rateLimiter";

export async function GET() {
  const rl = await checkRateLimit(apiRateLimit);
  if (rl) return rl;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get vendor owned by this user
  const vendor = await prisma.vendor.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!vendor) {
    return NextResponse.json({ error: "No vendor found for this account" }, { status: 404 });
  }

  const items = await prisma.menuItem.findMany({
    where: { vendorId: vendor.id },
    orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(apiRateLimit, req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { ownerId: session.user.id, isApproved: true },
  });

  if (!vendor) {
    return NextResponse.json({ error: "Your vendor account is not approved yet" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, price, itemType } = body;

  if (!name || !price || price <= 0) {
    return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: {
      vendorId: vendor.id,
      name: name.trim(),
      description: description?.trim() || null,
      price,
      itemType: itemType ?? "VEG",
      isAvailable: false,        // not available until approved
      approvalStatus: "PENDING", // admin must approve
    },
  });

  return NextResponse.json(item, { status: 201 });
}