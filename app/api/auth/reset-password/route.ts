// app/api/auth/reset-password/route.ts
// POST — resets password after OTP verified

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, authRateLimit } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(authRateLimit, req);
  if (rl) return rl;

  const body = await req.json();
  const { target, newPassword } = body;
  // target = email (student) or phone (vendor)

  if (!target || !newPassword) {
    return NextResponse.json({ error: "Target and new password are required" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // ── Verify OTP was completed for this target ──────────────
  const verifiedOTP = await prisma.oTP.findFirst({
    where: {
      target,
      type:     "PASSWORD_RESET",
      verified: true,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verifiedOTP) {
    return NextResponse.json(
      { error: "OTP not verified or expired. Please start the reset process again." },
      { status: 403 }
    );
  }

  // ── Find user ─────────────────────────────────────────────
  let user;
  if (target.includes("@thapar.edu")) {
    user = await prisma.user.findUnique({ where: { email: target } });
  } else {
    user = await prisma.user.findFirst({
      where: { phone: target, role: "VENDOR" },
    });
  }
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Update password ───────────────────────────────────────
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data:  { password: hashedPassword },
  });

  // ── Cleanup OTP ───────────────────────────────────────────
  await prisma.oTP.deleteMany({ where: { target, type: "PASSWORD_RESET" } });

  return NextResponse.json({ success: true });
}