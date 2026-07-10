// app/api/auth/verify-otp/route.ts
// POST — verifies OTP code
// Returns success/error, frontend proceeds based on result

import { NextRequest, NextResponse } from "next/server";
import { verifyOTP } from "@/lib/otp";
import { checkRateLimit, authRateLimit } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(authRateLimit, req);
  if (rl) return rl;

  const body = await req.json();
  const { target, code, type } = body;

  if (!target || !code || !type) {
    return NextResponse.json({ error: "target, code and type are required" }, { status: 400 });
  }

  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "OTP must be 6 digits" }, { status: 400 });
  }

  const result = await verifyOTP(target, code, type);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}