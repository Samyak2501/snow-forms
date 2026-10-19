import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});
