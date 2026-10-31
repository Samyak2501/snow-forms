import { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { uploadMedia, isCloudinaryConfigured } from "../services/storage.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

export async function uploadRoutes(fastify: FastifyInstance) {
  // Ensure media_uploads table exists in SQLite/Turso
  try {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS media_uploads (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        form_id TEXT REFERENCES forms(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        public_id TEXT,
        provider TEXT NOT NULL DEFAULT 'cloudinary',
        resource_type TEXT NOT NULL,
        format TEXT,
        bytes INTEGER,
        original_filename TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS media_user_idx ON media_uploads(user_id);
      CREATE INDEX IF NOT EXISTS media_form_idx ON media_uploads(form_id);
    `);
  } catch (err) {
    console.warn("Could not automatically check/create media_uploads table:", err);
  }

  // 1. Upload media for a specific form (Images or Videos)
  fastify.post("/api/forms/:formId/upload", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const { formId } = request.params as { formId: string };

    // Verify ownership or collaboration
    const formRecord = await db
      .select({ id: schema.forms.id, ownerId: schema.forms.ownerId })
      .from(schema.forms)
      .where(eq(schema.forms.id, formId))
      .limit(1);

    if (formRecord.length === 0) {
      return reply.status(404).send({ error: "Form not found." });
    }

    if (formRecord[0].ownerId !== authData.user.id) {
      // Check collaborator permission
      const collab = await db
        .select()
        .from(schema.formCollaborators)
        .where(
          and(
            eq(schema.formCollaborators.formId, formId),
            eq(schema.formCollaborators.userId, authData.user.id)
          )
        )
        .limit(1);

      if (collab.length === 0 || collab[0].role !== "editor") {
        return reply.status(403).send({ error: "Unauthorized. You do not have permission to edit this form." });
      }
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file provided in upload request." });
    }

    try {
      const buffer = await data.toBuffer();
      const uploadResult = await uploadMedia(buffer, data.filename, data.mimetype, formId);

      // Save metadata in media_uploads
      try {
        await db.insert(schema.mediaUploads).values({
          id: crypto.randomUUID(),
          userId: authData.user.id,
          formId,
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          provider: uploadResult.provider,
          resourceType: uploadResult.resourceType,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          originalFilename: uploadResult.originalFilename,
          createdAt: new Date(),
        });
      } catch (dbErr) {
        console.warn("Could not record media upload in media_uploads table:", dbErr);
      }

      return reply.send({
        success: true,
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        provider: uploadResult.provider,
        resourceType: uploadResult.resourceType,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        originalFilename: uploadResult.originalFilename,
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      return reply.status(400).send({
        error: err.message || "Failed to process and upload media file.",
      });
    }
  });

  // 2. Generic authenticated media upload (e.g. Header Banners, Profile media)
  fastify.post("/api/upload", async (request, reply) => {
    const authData = await requireAuth(request, reply);
    if (!authData) return;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file provided in upload request." });
    }

    try {
      const buffer = await data.toBuffer();
      const uploadResult = await uploadMedia(buffer, data.filename, data.mimetype);

      try {
        await db.insert(schema.mediaUploads).values({
          id: crypto.randomUUID(),
          userId: authData.user.id,
          formId: null,
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          provider: uploadResult.provider,
          resourceType: uploadResult.resourceType,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
          originalFilename: uploadResult.originalFilename,
          createdAt: new Date(),
        });
      } catch (dbErr) {
        console.warn("Could not record media upload in media_uploads table:", dbErr);
      }

      return reply.send({
        success: true,
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        provider: uploadResult.provider,
        resourceType: uploadResult.resourceType,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        originalFilename: uploadResult.originalFilename,
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      return reply.status(400).send({
        error: err.message || "Failed to process and upload media file.",
      });
    }
  });

  // 3. Storage status inspection (never exposes secrets!)
  fastify.get("/api/upload/status", async (request, reply) => {
    return reply.send({
      cloudinaryConfigured: isCloudinaryConfigured(),
      provider: isCloudinaryConfigured() ? "cloudinary" : "local",
      maxImageSizeMB: parseInt(process.env.MAX_IMAGE_SIZE_MB || "10", 10),
      maxVideoSizeMB: parseInt(process.env.MAX_VIDEO_SIZE_MB || "50", 10),
      supportedImageFormats: ["JPEG", "PNG", "WebP", "GIF"],
      supportedVideoFormats: ["MP4", "WebM"],
    });
  });
}
