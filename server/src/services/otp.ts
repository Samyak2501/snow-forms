import crypto from "crypto";
import { db, schema } from "../db/index.js";
import { eq, and, desc, gt } from "drizzle-orm";
import { sendOtpEmail } from "./email.js";

const COLLEGE_DOMAIN = process.env.COLLEGE_EMAIL_DOMAIN || "avantika.edu.in";
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 45;

function hashOtp(otp: string, email: string): string {
  return crypto
    .createHash("sha256")
    .update(`${otp}:${email.toLowerCase().trim()}:${process.env.BETTER_AUTH_SECRET || "salt"}`)
    .digest("hex");
}

export function validateCollegeEmail(email: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = email.toLowerCase().trim();
  const domainPart = normalized.split("@")[1];

  if (!domainPart) {
    return { valid: false, normalized, error: "Please enter a valid email address." };
  }

  if (domainPart !== COLLEGE_DOMAIN && !domainPart.endsWith(`.${COLLEGE_DOMAIN}`)) {
    return {
      valid: false,
      normalized,
      error: `Registration is restricted to Avantika University accounts (@${COLLEGE_DOMAIN}).`,
    };
  }

  return { valid: true, normalized };
}

export async function requestOtp({
  email,
  name,
  purpose,
}: {
  email: string;
  name?: string;
  purpose: "signup" | "password_reset";
}): Promise<{ success: boolean; message: string; cooldownSeconds?: number }> {
  const validation = validateCollegeEmail(email);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const normalizedEmail = validation.normalized;

  // Check if account already exists for signup or doesn't exist for password_reset
  const existingUser = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, normalizedEmail))
    .limit(1);

  if (purpose === "signup" && existingUser.length > 0) {
    throw new Error("An account with this college email already exists. Please sign in instead.");
  }

  if (purpose === "password_reset" && existingUser.length === 0) {
    throw new Error("No account was found with this college email address.");
  }

  // Check for resend cooldown / rate limit
  const recentOtp = await db
    .select()
    .from(schema.otpVerification)
    .where(
      and(
        eq(schema.otpVerification.email, normalizedEmail),
        eq(schema.otpVerification.purpose, purpose)
      )
    )
    .orderBy(desc(schema.otpVerification.createdAt))
    .limit(1);

  if (recentOtp.length > 0) {
    const elapsedSeconds = (Date.now() - recentOtp[0].createdAt.getTime()) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      throw new Error(`Please wait ${remaining} seconds before requesting another code.`);
    }
  }

  // Generate 6-digit numeric OTP cryptographically
  const otpNumber = crypto.randomInt(100000, 1000000);
  const otp = otpNumber.toString();
  const otpHash = hashOtp(otp, normalizedEmail);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any active, unverified codes for this email and purpose
  await db
    .delete(schema.otpVerification)
    .where(
      and(
        eq(schema.otpVerification.email, normalizedEmail),
        eq(schema.otpVerification.purpose, purpose),
        eq(schema.otpVerification.verified, false)
      )
    );

  // Store new OTP record
  await db.insert(schema.otpVerification).values({
    id: crypto.randomUUID(),
    email: normalizedEmail,
    otpHash,
    purpose,
    attempts: 0,
    maxAttempts: 3,
    expiresAt,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Send branded email
  await sendOtpEmail({
    to: normalizedEmail,
    name: name || (existingUser[0]?.name ?? undefined),
    otp,
    purpose,
    expiryMinutes: OTP_EXPIRY_MINUTES,
  });

  return {
    success: true,
    message: `A 6-digit verification code has been sent to ${normalizedEmail}.`,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
  };
}

export async function verifyOtpCode({
  email,
  code,
  purpose,
}: {
  email: string;
  code: string;
  purpose: "signup" | "password_reset";
}): Promise<{ success: boolean; tempToken: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const cleanCode = code.trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    throw new Error("Verification code must be exactly 6 digits.");
  }

  const records = await db
    .select()
    .from(schema.otpVerification)
    .where(
      and(
        eq(schema.otpVerification.email, normalizedEmail),
        eq(schema.otpVerification.purpose, purpose),
        eq(schema.otpVerification.verified, false),
        gt(schema.otpVerification.expiresAt, new Date())
      )
    )
    .orderBy(desc(schema.otpVerification.createdAt))
    .limit(1);

  if (records.length === 0) {
    throw new Error("No active code found or the code has expired. Please request a new code.");
  }

  const record = records[0];

  // Enforce max attempts
  if (record.attempts >= record.maxAttempts) {
    await db.delete(schema.otpVerification).where(eq(schema.otpVerification.id, record.id));
    throw new Error("Maximum attempts exceeded. This code has been invalidated. Please request a new code.");
  }

  const expectedHash = hashOtp(cleanCode, normalizedEmail);

  if (record.otpHash !== expectedHash) {
    const nextAttempts = record.attempts + 1;
    await db
      .update(schema.otpVerification)
      .set({ attempts: nextAttempts, updatedAt: new Date() })
      .where(eq(schema.otpVerification.id, record.id));

    const remaining = record.maxAttempts - nextAttempts;
    if (remaining <= 0) {
      await db.delete(schema.otpVerification).where(eq(schema.otpVerification.id, record.id));
      throw new Error("Incorrect code. Maximum attempts exceeded. Code has been invalidated.");
    }

    throw new Error(`Incorrect verification code. ${remaining} attempt(s) remaining.`);
  }

  // Verified! Generate single-use temporary token valid for 10 minutes to authorize password creation
  const tempToken = crypto.randomBytes(32).toString("hex");

  await db
    .update(schema.otpVerification)
    .set({
      verified: true,
      tempToken,
      updatedAt: new Date(),
    })
    .where(eq(schema.otpVerification.id, record.id));

  return {
    success: true,
    tempToken,
  };
}

export async function validateTempToken({
  email,
  tempToken,
  purpose,
}: {
  email: string;
  tempToken: string;
  purpose: "signup" | "password_reset";
}): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  const record = await db
    .select()
    .from(schema.otpVerification)
    .where(
      and(
        eq(schema.otpVerification.email, normalizedEmail),
        eq(schema.otpVerification.tempToken, tempToken),
        eq(schema.otpVerification.purpose, purpose),
        eq(schema.otpVerification.verified, true),
        gt(schema.otpVerification.expiresAt, new Date(Date.now() - 10 * 60 * 1000))
      )
    )
    .limit(1);

  return record.length > 0;
}

export async function consumeTempToken({
  email,
  tempToken,
  purpose,
}: {
  email: string;
  tempToken: string;
  purpose: "signup" | "password_reset";
}): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  await db
    .delete(schema.otpVerification)
    .where(
      and(
        eq(schema.otpVerification.email, normalizedEmail),
        eq(schema.otpVerification.tempToken, tempToken),
        eq(schema.otpVerification.purpose, purpose)
      )
    );
}
