// ============================================================
// lib/razorpay.ts
// Razorpay client + helper functions
// - createRazorpayOrder: called before checkout
// - verifyPaymentSignature: called in webhook to confirm payment
// ============================================================

import Razorpay from "razorpay";
import crypto from "crypto";

// Singleton Razorpay instance
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ============================================================
// createRazorpayOrder
// Call this when student hits "Pay Now"
// Returns a Razorpay order object with an order ID
// ============================================================
export async function createRazorpayOrder(amountInRupees: number, orderId: string) {
  const order = await razorpay.orders.create({
    amount: Math.round(amountInRupees * 100), // Razorpay uses paise (1 INR = 100 paise)
    currency: "INR",
    receipt: orderId, // Link back to your DB order ID
    notes: {
      platform: "Thapar Campus Commerce",
    },
  });

  return order;
}

// ============================================================
// verifyPaymentSignature
// Call this in your webhook handler BEFORE marking order paid
// Prevents fake payment confirmations
// ============================================================
export function verifyPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  signature,
}: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const body = razorpayOrderId + "|" + razorpayPaymentId;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
}
