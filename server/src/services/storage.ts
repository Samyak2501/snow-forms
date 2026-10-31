import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface UploadResult {
  url: string;
  publicId: string;
  provider: "cloudinary" | "local";
  resourceType: "image" | "video";
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  originalFilename: string;
}

export interface ValidationResult {
  valid: boolean;
  resourceType?: "image" | "video";
  detectedFormat?: string;
  error?: string;
}

// Configurable size limits (MB)
const MAX_IMAGE_SIZE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || "10", 10);
const MAX_VIDEO_SIZE_MB = parseInt(process.env.MAX_VIDEO_SIZE_MB || "50", 10);

// Allowed MIME types
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

// Magic byte verification helper
export function validateMediaBuffer(
  buffer: Buffer,
  filename: string,
  declaredMimeType: string
): ValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Uploaded file is empty." };
  }

  const ext = path.extname(filename).toLowerCase().replace(".", "");
  const mime = declaredMimeType.toLowerCase().trim();

  // 1. Check size limits
  const isVideoDeclared = ALLOWED_VIDEO_MIMES.has(mime) || ["mp4", "webm", "mov"].includes(ext);
  const isImageDeclared = ALLOWED_IMAGE_MIMES.has(mime) || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);

  if (isVideoDeclared) {
    const maxBytes = MAX_VIDEO_SIZE_MB * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return {
        valid: false,
        error: `Video exceeds the maximum allowed size of ${MAX_VIDEO_SIZE_MB}MB. Please compress or select a smaller video.`,
      };
    }
  } else if (isImageDeclared) {
    const maxBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return {
        valid: false,
        error: `Image exceeds the maximum allowed size of ${MAX_IMAGE_SIZE_MB}MB. Please choose a smaller image.`,
      };
    }
  }

  // 2. Validate Magic Bytes
  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, resourceType: "image", detectedFormat: "jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, resourceType: "image", detectedFormat: "png" };
  }

  // GIF: 47 49 46 38 ("GIF8")
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { valid: true, resourceType: "image", detectedFormat: "gif" };
  }

  // WebP: RIFF ... WEBP (starts with RIFF, bytes 8-11 are WEBP)
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { valid: true, resourceType: "image", detectedFormat: "webp" };
  }

  // WebM: 1A 45 DF A3 (EBML)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { valid: true, resourceType: "video", detectedFormat: "webm" };
  }

  // MP4 / MOV: bytes 4-8 is 'ftyp'
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return { valid: true, resourceType: "video", detectedFormat: "mp4" };
  }

  // Fallback check against declared MIME if header is non-standard
  if (ALLOWED_IMAGE_MIMES.has(mime)) {
    return { valid: true, resourceType: "image", detectedFormat: ext || "jpg" };
  }

  if (ALLOWED_VIDEO_MIMES.has(mime)) {
    return { valid: true, resourceType: "video", detectedFormat: ext || "mp4" };
  }

  return {
    valid: false,
    error: `Unsupported media format. Supported formats are: Images (JPEG, PNG, WebP, GIF) up to ${MAX_IMAGE_SIZE_MB}MB, and Videos (MP4, WebM) up to ${MAX_VIDEO_SIZE_MB}MB.`,
  };
}

// Check Cloudinary configuration
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

// Initialize Cloudinary if keys exist
if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Ensure local uploads directory exists
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch {}
}

export async function uploadMedia(
  buffer: Buffer,
  filename: string,
  declaredMimeType: string,
  formId?: string
): Promise<UploadResult> {
  const validation = validateMediaBuffer(buffer, filename, declaredMimeType);
  if (!validation.valid || !validation.resourceType) {
    throw new Error(validation.error || "File validation failed.");
  }

  const sanitizedOriginal = path
    .basename(filename)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);

  // 1. Cloudinary Persistent Object Storage (Production)
  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `au-forms/${formId || "general"}`,
          resource_type: validation.resourceType === "video" ? "video" : "image",
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error || !result) {
            console.error("Cloudinary upload failed:", error);
            return reject(new Error(error?.message || "Cloudinary upload failed."));
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            provider: "cloudinary",
            resourceType: validation.resourceType!,
            format: result.format || validation.detectedFormat,
            bytes: result.bytes || buffer.length,
            width: result.width,
            height: result.height,
            duration: result.duration,
            originalFilename: sanitizedOriginal,
          });
        }
      );

      uploadStream.end(buffer);
    });
  }

  // 2. Persistent Local Storage Fallback (for development / local running when Cloudinary keys are pending)
  console.info(
    "[Storage] Cloudinary credentials not configured in .env. Falling back to persistent local storage in ./uploads. For cloud CDN deployment, set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
  );

  const fileExt = validation.detectedFormat || path.extname(sanitizedOriginal).replace(".", "") || "bin";
  const uniqueId = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = path.join(UPLOADS_DIR, uniqueId);

  await fs.promises.writeFile(filePath, buffer);

  // Return server-hosted URL
  const publicUrl = `/uploads/${uniqueId}`;

  return {
    url: publicUrl,
    publicId: uniqueId,
    provider: "local",
    resourceType: validation.resourceType,
    format: fileExt,
    bytes: buffer.length,
    originalFilename: sanitizedOriginal,
  };
}

/**
 * Deletes a stored media asset safely.
 * For Cloudinary: invokes the destroy API for image or video.
 * For Local: deletes the file from UPLOADS_DIR if it exists.
 */
export async function deleteMediaAsset(
  publicId: string,
  provider: "cloudinary" | "local",
  resourceType: "image" | "video" = "image"
): Promise<boolean> {
  if (!publicId) return false;

  try {
    if (provider === "cloudinary" && isCloudinaryConfigured()) {
      const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType === "video" ? "video" : "image",
      });
      return res?.result === "ok";
    }

    if (provider === "local") {
      // Prevent directory traversal: only use basename
      const safeFilename = path.basename(publicId);
      const filePath = path.join(UPLOADS_DIR, safeFilename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
    }
  } catch (err) {
    console.error(`[Storage] Failed to delete media asset (publicId: ${publicId}):`, err);
  }

  return false;
}
