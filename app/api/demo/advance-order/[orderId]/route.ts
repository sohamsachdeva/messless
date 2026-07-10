// app/api/demo/advance-order/[orderId]/route.ts
// DEMO ONLY — auto-advances order status for pitch demos
// Remove this file before going to production

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, apiRateLimit } from "@/lib/rateLimiter";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const rl = await checkRateLimit(apiRateLimit, req);
  if (rl) return rl;

  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const { status } = await req.json();

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  return NextResponse.json(order);
}