// ============================================================
// app/api/vendors/[id]/route.ts
// GET  /api/vendors/:id  — single vendor with full menu
// PATCH /api/vendors/:id — vendor updates own info
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateVendorSchema } from "@/lib/validators";
import { checkRateLimit, apiRateLimit } from "@/lib/rateLimiter";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rl = await checkRateLimit(apiRateLimit, _req);
  if (rl) return rl;

  const vendor = await prisma.vendor.findUnique({
    where: { id: id, isApproved: true },
    include: {
      hub: {
        select: { id: true, name: true },
      },
      menuItems: {
        where: { isAvailable: true },
        orderBy: [
          { isPopular: "desc" },
          { sortOrder: "asc" },
        ],
      },
    },
  });

  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  return NextResponse.json(vendor);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rl = await checkRateLimit(apiRateLimit, req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { id: id } });
  if (!vendor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only owner or admin can update
  if (vendor.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.vendor.update({
    where: { id: id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}
