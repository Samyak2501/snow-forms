import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET || "f780501033d7dd683eb701b3e4b70f2a1bfc355413767fe3cb663bbce31de4c4",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // We enforce verification via our custom secure college OTP flow
  },
  trustedOrigins: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:4000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4000",
  ],
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
});
