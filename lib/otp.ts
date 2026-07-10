// ============================================================
// lib/otp.ts
// OTP utilities — generate, send, verify, rate-limit
// ============================================================

import  prisma  from "@/lib/prisma";

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_MINUTES = 1; // min gap between resends

// ── Generate a 6-digit OTP ───────────────────────────────────
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Create or replace OTP in DB ──────────────────────────────
export async function createOTP(target: string, type: "EMAIL_VERIFY" | "PHONE_VERIFY" | "PASSWORD_RESET") {
  // Rate limit: check if a recent OTP was already sent
  const recent = await prisma.oTP.findFirst({
    where: {
      target,
      type,
      createdAt: {
        gte: new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000),
      },
    },
  });

  if (recent) {
    const waitSeconds = Math.ceil(
      (RATE_LIMIT_MINUTES * 60 * 1000 - (Date.now() - recent.createdAt.getTime())) / 1000
    );
    throw new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`);
  }

  // Delete any existing OTPs for this target+type
  await prisma.oTP.deleteMany({ where: { target, type } });

  // Use fixed OTP "123456" in dev mode OR when NEXT_PUBLIC_DEMO_MODE is true (for pitch/college demo)
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const code = (process.env.NODE_ENV !== "production" || isDemo) ? "123456" : generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.oTP.create({
    data: { target, code, type, expiresAt },
  });

  return code;
}

// ── Verify OTP ────────────────────────────────────────────────
export async function verifyOTP(
  target: string,
  code: string,
  type: "EMAIL_VERIFY" | "PHONE_VERIFY" | "PASSWORD_RESET"
): Promise<{ success: boolean; error?: string }> {
  const otp = await prisma.oTP.findFirst({
    where: { target, type, verified: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { success: false, error: "No OTP found. Please request a new one." };
  }

  if (new Date() > otp.expiresAt) {
    await prisma.oTP.delete({ where: { id: otp.id } });
    return { success: false, error: "OTP has expired. Please request a new one." };
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    await prisma.oTP.delete({ where: { id: otp.id } });
    return { success: false, error: "Too many incorrect attempts. Please request a new OTP." };
  }

  if (otp.code !== code.trim()) {
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = MAX_ATTEMPTS - otp.attempts - 1;
    return { success: false, error: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` };
  }

  // Mark as verified and invalidate
  await prisma.oTP.update({
    where: { id: otp.id },
    data: { verified: true },
  });

  return { success: true };
}

// ── Send email OTP via Nodemailer ────────────────────────────
// Install: npm install nodemailer @types/nodemailer
export async function sendEmailOTP(email: string, otp: string, type: "verify" | "reset") {
  // Always log OTP so users can see it in dev or when SMTP is not configured
  console.log(`\n📧 OTP for ${email}: ${otp}\n`);

  // Skip actual email if SMTP credentials aren't configured
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.log(`📧 SMTP not configured — OTP for ${email}: ${otp}`);
    return;
  }

  const nodemailer = await import("nodemailer");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD, // Gmail App Password
    },
  });

  const subject = type === "verify"
    ? "Verify your MessLess account"
    : "Reset your MessLess password";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 48px; height: 48px; background: #9B1B1B; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 22px; margin-bottom: 12px;">M</div>
        <h1 style="font-size: 22px; font-weight: 800; color: #1C1C1C; margin: 0;">MessLess</h1>
      </div>

      <h2 style="font-size: 18px; font-weight: 700; color: #1C1C1C; margin-bottom: 8px; text-align: center;">
        ${type === "verify" ? "Verify your email" : "Reset your password"}
      </h2>
      <p style="font-size: 14px; color: #686B78; text-align: center; margin-bottom: 28px; line-height: 1.6;">
        ${type === "verify"
          ? "Enter this OTP in the MessLess app to verify your email address."
          : "Enter this OTP to reset your password. Do not share this with anyone."}
      </p>

      <div style="background: #F8F8F8; border: 2px dashed #E9E9EB; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <p style="font-size: 13px; color: #93959F; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">Your OTP</p>
        <p style="font-size: 40px; font-weight: 800; color: #9B1B1B; letter-spacing: 12px; margin: 0;">${otp}</p>
      </div>

      <p style="font-size: 13px; color: #93959F; text-align: center; margin-bottom: 8px;">
        ⏱ This OTP expires in <strong>10 minutes</strong>
      </p>
      <p style="font-size: 12px; color: #BEBFC5; text-align: center;">
        If you didn't request this, you can safely ignore this email.
      </p>

      <hr style="border: none; border-top: 1px solid #E9E9EB; margin: 24px 0;">
      <p style="font-size: 11px; color: #BEBFC5; text-align: center; margin: 0;">
        MessLess · Made by Thapar, for Thapar
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"MessLess" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject,
    html,
  });
}

// ── Send SMS OTP via Twilio (or MSG91) ───────────────────────
// Option A: Twilio — npm install twilio
// Option B: MSG91 (Indian, cheaper) — use their REST API
// For now uses MSG91 REST API (no extra package needed)
export async function sendSmsOTP(phone: string, otp: string) {
  // Using MSG91 — Indian SMS gateway, works well with Indian numbers
  // Sign up at msg91.com, get API key + template ID
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📱 DEV MODE — OTP for ${phone}: ${otp}\n`);
    return;  // ← skip SMS send
  }
  const apiKey    = process.env.MSG91_API_KEY;
  const senderId  = process.env.MSG91_SENDER_ID ?? "MSLESS";
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!apiKey || !templateId) {
    // In dev, just log OTP to console
    console.log(`\n DEV MODE — OTP for ${phone}: ${otp}\n`);
    return;
  }

  const response = await fetch("https://api.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: apiKey,
    },
    body: JSON.stringify({
      template_id: templateId,
      mobile: `91${phone}`, // India country code
      authkey: apiKey,
      otp,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`SMS send failed: ${err}`);
  }
}