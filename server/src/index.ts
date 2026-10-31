import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import fastifyStatic from "@fastify/static";
import fs from "fs";

import { authRoutes } from "./routes/auth.js";
import { formRoutes } from "./routes/forms.js";
import { submissionRoutes } from "./routes/submissions.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { uploadRoutes } from "./routes/uploads.js";
import { cleanupExpiredAuthRecords } from "./services/cleanup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = parseInt(process.env.PORT || "4000", 10);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const fastify = Fastify({
  logger: true,
});

async function start() {
  try {
    // 1. Register CORS
    const allowedOrigins = [
      FRONTEND_URL,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4000",
    ].filter(Boolean);

    await fastify.register(cors, {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.endsWith(".netlify.app") ||
          origin.endsWith(".onrender.com") ||
          origin.endsWith(".render.com")
        ) {
          return cb(null, true);
        }
        return cb(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    });

    // 2. Register Cookie parser
    await fastify.register(cookie);

    // Allow empty JSON bodies without throwing FST_ERR_CTP_EMPTY_JSON_BODY
    fastify.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_req, body, defaultDone) => {
        if (!body || (typeof body === "string" && body.trim().length === 0)) {
          return defaultDone(null, {});
        }
        try {
          return defaultDone(null, JSON.parse(body as string));
        } catch (err: any) {
          return defaultDone(err, undefined);
        }
      }
    );

    // 3. Register Multipart for file uploads (max 50MB for video support)
    const maxVideoMB = parseInt(process.env.MAX_VIDEO_SIZE_MB || "50", 10);
    await fastify.register(multipart, {
      limits: {
        fileSize: maxVideoMB * 1024 * 1024,
      },
    });

    // 4. Register Static Files for Uploads
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    await fastify.register(fastifyStatic, {
      root: uploadsDir,
      prefix: "/uploads/",
      decorateReply: false,
    });

    // 5. Root & Health Check Endpoints
    fastify.get("/", async () => {
      return {
        status: "ok",
        app: "Snow Forms API",
        institution: "Avantika University",
        version: "1.0.0",
        endpoints: {
          health: "/health",
          apiHealth: "/api/health",
          docs: "Snow Forms Backend REST API"
        },
        time: new Date().toISOString(),
      };
    });

    fastify.get("/health", async () => {
      return { status: "ok" };
    });

    fastify.get("/healthz", async () => {
      return { status: "ok" };
    });

    fastify.get("/api/health", async () => {
      return {
        status: "ok",
        app: "Snow Forms Backend",
        institution: "Avantika University",
        time: new Date().toISOString(),
      };
    });

    // 6. Register Routes
    await fastify.register(authRoutes);
    await fastify.register(formRoutes);
    await fastify.register(submissionRoutes);
    await fastify.register(analyticsRoutes);
    await fastify.register(uploadRoutes);

    // 7. Listen
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Snow Forms Server listening on http://localhost:${PORT}`);

    // 8. Lightweight periodic database cleanup for expired authentication & temporary records (runs every 1 hour)
    const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
    setTimeout(() => {
      cleanupExpiredAuthRecords().catch((err) =>
        console.error("[Cleanup] Initial cleanup error:", err)
      );
    }, 10000);

    const cleanupTimer = setInterval(() => {
      cleanupExpiredAuthRecords().catch((err) =>
        console.error("[Cleanup] Interval cleanup error:", err)
      );
    }, CLEANUP_INTERVAL_MS);
    cleanupTimer.unref();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
