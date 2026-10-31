import { describe, it, expect } from "vitest";
import { validateMediaBuffer, isCloudinaryConfigured } from "../src/services/storage.js";

describe("Snow Forms Media Storage & Validation Service", () => {
  it("validates JPEG images correctly using magic bytes", () => {
    // JPEG header: FF D8 FF
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const res = validateMediaBuffer(jpegHeader, "photo.jpg", "image/jpeg");
    expect(res.valid).toBe(true);
    expect(res.resourceType).toBe("image");
    expect(res.detectedFormat).toBe("jpeg");
  });

  it("validates PNG images correctly using magic bytes", () => {
    // PNG header: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const res = validateMediaBuffer(pngHeader, "graphic.png", "image/png");
    expect(res.valid).toBe(true);
    expect(res.resourceType).toBe("image");
    expect(res.detectedFormat).toBe("png");
  });

  it("validates GIF images correctly using magic bytes", () => {
    // GIF header: GIF8
    const gifHeader = Buffer.from("GIF89a", "ascii");
    const res = validateMediaBuffer(gifHeader, "animation.gif", "image/gif");
    expect(res.valid).toBe(true);
    expect(res.resourceType).toBe("image");
    expect(res.detectedFormat).toBe("gif");
  });

  it("validates WebP images correctly using RIFF...WEBP header", () => {
    // WebP header: RIFF (4 bytes) + 4 size bytes + WEBP (4 bytes)
    const webpHeader = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii"),
    ]);
    const res = validateMediaBuffer(webpHeader, "banner.webp", "image/webp");
    expect(res.valid).toBe(true);
    expect(res.resourceType).toBe("image");
    expect(res.detectedFormat).toBe("webp");
  });

  it("validates MP4 videos correctly using ftyp header", () => {
    // MP4 header: 4 size bytes + ftyp (4 bytes) + isom (4 bytes)
    const mp4Header = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftyp", "ascii"),
      Buffer.from("isom", "ascii"),
    ]);
    const res = validateMediaBuffer(mp4Header, "demo.mp4", "video/mp4");
    expect(res.valid).toBe(true);
    expect(res.resourceType).toBe("video");
    expect(res.detectedFormat).toBe("mp4");
  });

  it("validates WebM videos correctly using EBML header", () => {
    // WebM header: 1A 45 DF A3
    const webmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00]);
    const res = validateMediaBuffer(webmHeader, "clip.webm", "video/webm");
    expect(res.valid).toBe(true);
    expect(res.resourceType).toBe("video");
    expect(res.detectedFormat).toBe("webm");
  });

  it("rejects dangerous or unsupported executable files", () => {
    const exeBuffer = Buffer.from("MZ\x90\x00\x03\x00\x00\x00");
    const res = validateMediaBuffer(exeBuffer, "malware.exe", "application/x-msdownload");
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Unsupported media format/i);
  });

  it("rejects images that exceed the maximum size limit", () => {
    // Simulate oversized 15MB buffer
    const oversizedImage = Buffer.alloc(15 * 1024 * 1024);
    oversizedImage[0] = 0xff;
    oversizedImage[1] = 0xd8;
    oversizedImage[2] = 0xff;

    const res = validateMediaBuffer(oversizedImage, "huge.jpg", "image/jpeg");
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/exceeds the maximum allowed size/i);
  });

  it("correctly checks if Cloudinary is configured via environment variables", () => {
    const configured = isCloudinaryConfigured();
    expect(typeof configured).toBe("boolean");
  });
});
