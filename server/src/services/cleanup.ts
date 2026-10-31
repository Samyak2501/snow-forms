import { db, schema } from "../db/index.js";
import { eq, and, or, lt, ne, isNull, inArray } from "drizzle-orm";
import { deleteMediaAsset } from "./storage.js";

export interface CleanupResult {
  deletedOtps: number;
  deletedSessions: number;
  deletedVerifications: number;
  deletedOrphanedMedia: number;
  timestamp: string;
}

/**
 * Periodically deletes expired and consumed authentication records, expired sessions,
 * and abandoned temporary uploads from the Turso database to prevent storage waste.
 * Safe to call repeatedly. Never logs OTP codes, session tokens, or sensitive values.
 */
export async function cleanupExpiredAuthRecords(): Promise<CleanupResult> {
  const now = new Date();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let deletedOtps = 0;
  let deletedSessions = 0;
  let deletedVerifications = 0;
  let deletedOrphanedMedia = 0;

  try {
    // 1. Clean up expired OTPs or verified/consumed OTPs past the 1-hour grace period
    const expiredOtps = await db
      .select({ id: schema.otpVerification.id })
      .from(schema.otpVerification)
      .where(
        or(
          lt(schema.otpVerification.expiresAt, now),
          and(
            eq(schema.otpVerification.verified, true),
            lt(schema.otpVerification.updatedAt, oneHourAgo)
          )
        )
      );

    if (expiredOtps.length > 0) {
      await db
        .delete(schema.otpVerification)
        .where(
          inArray(
            schema.otpVerification.id,
            expiredOtps.map((o) => o.id)
          )
        );
      deletedOtps = expiredOtps.length;
    }

    // 2. Clean up expired Better Auth verification tokens
    const expiredVerifications = await db
      .select({ id: schema.verification.id })
      .from(schema.verification)
      .where(lt(schema.verification.expiresAt, now));

    if (expiredVerifications.length > 0) {
      await db
        .delete(schema.verification)
        .where(
          inArray(
            schema.verification.id,
            expiredVerifications.map((v) => v.id)
          )
        );
      deletedVerifications = expiredVerifications.length;
    }

    // 3. Clean up expired Better Auth sessions
    const expiredSessions = await db
      .select({ id: schema.session.id })
      .from(schema.session)
      .where(lt(schema.session.expiresAt, now));

    if (expiredSessions.length > 0) {
      await db
        .delete(schema.session)
        .where(
          inArray(
            schema.session.id,
            expiredSessions.map((s) => s.id)
          )
        );
      deletedSessions = expiredSessions.length;
    }

    // 4. Clean up abandoned temporary media uploads (formId is null and older than 24h)
    const abandonedMedia = await db
      .select()
      .from(schema.mediaUploads)
      .where(
        and(
          isNull(schema.mediaUploads.formId),
          lt(schema.mediaUploads.createdAt, twentyFourHoursAgo)
        )
      );

    if (abandonedMedia.length > 0) {
      for (const m of abandonedMedia) {
        if (m.publicId) {
          await deleteMediaAsset(
            m.publicId,
            m.provider as "cloudinary" | "local",
            m.resourceType as "image" | "video"
          );
        }
      }
      await db
        .delete(schema.mediaUploads)
        .where(
          inArray(
            schema.mediaUploads.id,
            abandonedMedia.map((m) => m.id)
          )
        );
      deletedOrphanedMedia = abandonedMedia.length;
    }

    if (deletedOtps > 0 || deletedSessions > 0 || deletedVerifications > 0 || deletedOrphanedMedia > 0) {
      console.info(
        `[Cleanup] Storage cleanup complete: Removed ${deletedOtps} expired/consumed OTPs, ${deletedSessions} expired sessions, ${deletedVerifications} expired verifications, and ${deletedOrphanedMedia} abandoned uploads.`
      );
    }
  } catch (err: any) {
    console.error("[Cleanup] Error during periodic database record cleanup:", err.message);
  }

  return {
    deletedOtps,
    deletedSessions,
    deletedVerifications,
    deletedOrphanedMedia,
    timestamp: now.toISOString(),
  };
}

/**
 * Cleans up media assets exclusively owned by a form being deleted.
 * Checks for reuse across other forms before removing any physical asset.
 */
export async function cleanupFormExclusiveMedia(formId: string): Promise<number> {
  let cleanedCount = 0;
  try {
    const formMedia = await db
      .select()
      .from(schema.mediaUploads)
      .where(eq(schema.mediaUploads.formId, formId));

    for (const m of formMedia) {
      if (!m.publicId) continue;

      // Check if any other form's mediaUploads table shares this file
      const otherReferences = await db
        .select({ id: schema.mediaUploads.id })
        .from(schema.mediaUploads)
        .where(
          and(
            ne(schema.mediaUploads.formId, formId),
            or(
              eq(schema.mediaUploads.publicId, m.publicId),
              eq(schema.mediaUploads.url, m.url)
            )
          )
        )
        .limit(1);

      if (otherReferences.length === 0) {
        // Exclusively owned by this form: safely delete physical asset
        await deleteMediaAsset(
          m.publicId,
          m.provider as "cloudinary" | "local",
          m.resourceType as "image" | "video"
        );
        cleanedCount++;
      }
    }

    // Remove mediaUploads database records linked to this form
    await db.delete(schema.mediaUploads).where(eq(schema.mediaUploads.formId, formId));
  } catch (err: any) {
    console.error(`[Cleanup] Error cleaning media for form ${formId}:`, err.message);
  }
  return cleanedCount;
}
