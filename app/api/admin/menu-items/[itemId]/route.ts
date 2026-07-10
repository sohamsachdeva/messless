// app/api/admin/menu-items/[itemId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, adminRateLimit } from "@/lib/rateLimiter";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, adminNote } = await req.json();

  const rl = await checkRateLimit(adminRateLimit, req);
  if (rl) return rl;

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const item = await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      approvalStatus: action === "approve" ? "APPROVED" : "REJECTED",
      isAvailable:    action === "approve",  // goes live immediately on approval
      adminNote:      adminNote ?? null,
    },
  });

  return NextResponse.json(item);
} 