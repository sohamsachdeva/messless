// app/api/admin/vendors/[vendorId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, adminRateLimit } from "@/lib/rateLimiter";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, hubId } = await req.json();

  const rl = await checkRateLimit(adminRateLimit, req);
  if (rl) return rl;

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Must assign a hub when approving
  if (action === "approve" && !hubId) {
    return NextResponse.json(
      { error: "Please select a hub before approving this vendor." },
      { status: 400 }
    );
  }

  const vendor = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      isApproved: action === "approve",
      isActive:   action === "approve",
      hubId:      action === "approve" ? hubId : null,
      // Reset location placeholder when approved
      ...(action === "approve" && {
        location: (await prisma.vendor.findUnique({ where: { id: vendorId } }))?.location === "Pending — admin will set location"
          ? `${(await prisma.hub.findUnique({ where: { id: hubId } }))?.name ?? ""} — location TBD`
          : undefined,
      }),
    },
    include: {
      hub: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(vendor);
}