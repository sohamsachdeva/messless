// app/api/auth/send-otp/route.ts
// POST — sends OTP to email or phone
// Used by: student register, vendor register, forgot password

import { NextRequest, NextResponse } from "next/server";
import { createOTP, sendEmailOTP, sendSmsOTP } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, authRateLimit } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(authRateLimit, req);
  if (rl) return rl;

  const body = await req.json();
  const { target, type } = body;
  // target = email or phone
  // type   = "EMAIL_VERIFY" | "PHONE_VERIFY" | "PASSWORD_RESET"

  if (!target || !type) {
    return NextResponse.json({ error: "target and type are required" }, { status: 400 });
  }

  // ── Validate target format ────────────────────────────────
  if (type === "EMAIL_VERIFY" || (type === "PASSWORD_RESET" && target.includes("@"))) {
    if (!target.endsWith("@thapar.edu")) {
      return NextResponse.json({ error: "Only @thapar.edu emails are allowed" }, { status: 400 });
    }

    // For password reset, user must exist
    if (type === "PASSWORD_RESET") {
      const user = await prisma.user.findUnique({ where: { email: target } });
      if (!user) {
        // Don't reveal if email exists — generic message
        return NextResponse.json({ success: true, message: "If this email is registered, you'll receive an OTP shortly." });
      }
    }

    try {
      const otp = await createOTP(target, type);
      await sendEmailOTP(target, otp, type === "PASSWORD_RESET" ? "reset" : "verify");
      return NextResponse.json({ success: true, message: `OTP sent to ${target}` });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
  }

  if (type === "PHONE_VERIFY" || (type === "PASSWORD_RESET" && /^\d{10}$/.test(target))) {
    if (!/^[6-9]\d{9}$/.test(target)) {
      return NextResponse.json({ error: "Enter a valid 10-digit Indian phone number" }, { status: 400 });
    }

    // For password reset via phone
    if (type === "PASSWORD_RESET") {
      const user = await prisma.user.findFirst({
        where: { phone: target, role: "VENDOR" },
      });
      if (!user) {
        return NextResponse.json({ success: true, message: "If this number is registered, you'll receive an OTP shortly." });
      }
    }

    try {
      const otp = await createOTP(target, type);
      await sendSmsOTP(target, otp);
      return NextResponse.json({ success: true, message: `OTP sent to +91${target}` });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
  }

  return NextResponse.json({ error: "Invalid target or type" }, { status: 400 });
}