// ============================================================
// app/api/razorpay/create-order/route.ts
// POST — creates a Razorpay order before showing payment modal
// Called by checkout page when student clicks "Pay Now"
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Razorpay from "razorpay";
import { PLATFORM_FEE } from "@/lib/constants";
import { checkRateLimit, paymentRateLimit } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(paymentRateLimit, req);
  if (rl) return rl;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await req.json();

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  // Fetch the order from DB
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendor: { select: { name: true } } },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Security: only the order owner can pay
  if (order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Platform fee
  ;
  const totalWithFee = Number(order.totalAmount) + PLATFORM_FEE;

  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalWithFee * 100), // paise
    currency: "INR",
    receipt: orderId,
    notes: {
      platform: "MessLess",
      vendor: order.vendor.name,
      studentId: session.user.id,
    },
  });

  // Save Razorpay order ID in Payment table
  await prisma.payment.upsert({
    where: { orderId },
    update: { razorpayOrderId: razorpayOrder.id, amount: totalWithFee },
    create: {
      orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: totalWithFee,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,       // in paise
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    vendorName: order.vendor.name,
    studentName: session.user.name,
    studentEmail: session.user.email,
  });
}
