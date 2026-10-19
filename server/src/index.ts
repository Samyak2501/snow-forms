import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { authRoutes } from "./routes/auth.js";
import { formRoutes } from "./routes/forms.js";
import { submissionRoutes } from "./routes/submissions.js";
import { analyticsRoutes } from "./routes/analytics.js";

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
    await fastify.register(cors, {
      origin: [
        FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4000",
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    });

    // 2. Register Cookie parser
    await fastify.register(cookie);

    // 3. Register Multipart for file uploads (max 10MB default)
    await fastify.register(multipart, {
      limits: {
        fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10)) * 1024 * 1024,
      },
    });

    // 4. Health Check
    fastify.get("/api/health", async () => {
      return {
        status: "ok",
        app: "AU Forms Backend",
        institution: "Avantika University",
        time: new Date().toISOString(),
      };
    });

    // 5. Register Routes
    await fastify.register(authRoutes);
    await fastify.register(formRoutes);
    await fastify.register(submissionRoutes);
    await fastify.register(analyticsRoutes);

    // 6. Listen
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`AU Forms Server listening on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
