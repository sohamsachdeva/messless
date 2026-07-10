// app/api/auth/register/route.ts
// POST — creates student account ONLY after OTP verified

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, authRateLimit } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(authRateLimit, req);
  if (rl) return rl;

  const body = await req.json();
  const { name, email, thaparId, phone, password } = body;

  // ── Validation ────────────────────────────────────────────
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
  }
  if (!email.endsWith("@thapar.edu")) {
    return NextResponse.json({ error: "Only @thapar.edu emails are allowed" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (thaparId && !/^\d{10}$/.test(thaparId)) {
    return NextResponse.json({ error: "Thapar ID must be exactly 10 digits" }, { status: 400 });
  }

  
  // ── Check OTP was verified ────────────────────────────────
  const verifiedOTP = await prisma.oTP.findFirst({
    where: {
      target:   email,
      type:     "EMAIL_VERIFY",
      verified: true,
      expiresAt: { gte: new Date() }, // still within expiry window
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verifiedOTP) {
    return NextResponse.json(
      { error: "Email not verified. Please verify your email with OTP first." },
      { status: 403 }
    );
  }

  // ── Check duplicates ──────────────────────────────────────
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(thaparId ? [{ thaparId }] : []),
      ],
    },
  });

  if (existing) {
    if (existing.email === email) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "This Thapar ID is already registered." }, { status: 409 });
  }

  // ── Create user ───────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      thaparId: thaparId?.trim() || null,
      phone: phone?.trim() || null,
      password: hashedPassword,
      role: "STUDENT",
    },
    select: { id: true, name: true, email: true, role: true },
  });

  // ── Cleanup OTP ───────────────────────────────────────────
  await prisma.oTP.deleteMany({ where: { target: email, type: "EMAIL_VERIFY" } });

  return NextResponse.json({ success: true, user }, { status: 201 });
}