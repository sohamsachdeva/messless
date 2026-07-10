// app/api/auth/vendor-register/route.ts
// POST — creates vendor account ONLY after phone OTP verified

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, authRateLimit } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(authRateLimit, req);
  if (rl) return rl;

  const body = await req.json();
  const { phone, password, shopName } = body;

  // ── Validation ────────────────────────────────────────────
  if (!phone || !password || !shopName) {
    return NextResponse.json({ error: "Phone, password and shop name are required" }, { status: 400 });
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid 10-digit Indian phone number" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // ── Check OTP was verified ────────────────────────────────
  const verifiedOTP = await prisma.oTP.findFirst({
    where: {
      target:   phone,
      type:     "PHONE_VERIFY",
      verified: true,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verifiedOTP) {
    return NextResponse.json(
      { error: "Phone not verified. Please verify your number with OTP first." },
      { status: 403 }
    );
  }

  // ── Check duplicate ───────────────────────────────────────
  const existing = await prisma.user.findFirst({
    where: { phone, role: "VENDOR" },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This phone number is already registered. Please sign in." },
      { status: 409 }
    );
  }

  // ── Create vendor user + pending vendor record ────────────
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name:     shopName.trim(),
      phone,
      password: hashedPassword,
      role:     "VENDOR",
    },
  });

  await prisma.vendor.create({
    data: {
      name:        shopName.trim(),
      location:    "Pending — admin will set location",
      category:    "FOOD",
      ownerId:     user.id,
      isApproved:  false,
      isActive:    false,
      phone,
    },
  });

  // ── Cleanup OTP ───────────────────────────────────────────
  await prisma.oTP.deleteMany({ where: { target: phone, type: "PHONE_VERIFY" } });

  return NextResponse.json({ success: true }, { status: 201 });
}