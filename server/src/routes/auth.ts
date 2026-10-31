import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/index.js";
import {
  requestOtp,
  verifyOtpCode,
  validateTempToken,
  consumeTempToken,
  validateCollegeEmail,
} from "../services/otp.js";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import crypto from "crypto";
import { getOAuthConsentUrl, exchangeOAuthCode } from "../services/gmail.js";

export async function authRoutes(fastify: FastifyInstance) {
  // 1. Better Auth catch-all route for standard Better Auth endpoints
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request: FastifyRequest, reply: FastifyReply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host || "localhost:4000"}`);
        const headers = fromNodeHeaders(request.headers);

        let body: string | undefined = undefined;
        if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
          body = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
        }

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          body,
        });

        const response = await auth.handler(req);

        reply.status(response.status);

        // Forward set-cookie headers properly (crucial for clearing session cookies on sign-out)
        const setCookies =
          typeof (response.headers as any).getSetCookie === "function"
            ? (response.headers as any).getSetCookie()
            : [];

        if (setCookies && setCookies.length > 0) {
          reply.raw.setHeader("set-cookie", setCookies);
        } else {
          const cookieHeader = response.headers.get("set-cookie");
          if (cookieHeader) {
            reply.raw.setHeader("set-cookie", cookieHeader);
          }
        }

        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "set-cookie") {
            reply.header(key, value);
          }
        });

        const responseText = await response.text();
        return reply.send(responseText);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: "Internal Auth Error", message: error.message });
      }
    },
  });

  // 2. Request OTP for College Email Signup or Password Reset
  fastify.post("/api/auth/otp/send", async (request, reply) => {
    const schemaZ = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      purpose: z.enum(["signup", "password_reset"]).default("signup"),
    });

    const parsed = schemaZ.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    try {
      const result = await requestOtp({
        email: parsed.data.email,
        name: parsed.data.name,
        purpose: parsed.data.purpose,
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 3. Verify 6-digit OTP code
  fastify.post("/api/auth/otp/verify", async (request, reply) => {
    const schemaZ = z.object({
      email: z.string().email(),
      code: z.string().length(6),
      purpose: z.enum(["signup", "password_reset"]).default("signup"),
    });

    const parsed = schemaZ.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    try {
      const result = await verifyOtpCode({
        email: parsed.data.email,
        code: parsed.data.code,
        purpose: parsed.data.purpose,
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 4. Set Password after OTP verification (Finalize Signup)
  fastify.post("/api/auth/otp/set-password", async (request, reply) => {
    const schemaZ = z.object({
      email: z.string().email(),
      tempToken: z.string().min(10),
      password: z.string().min(8, "Password must be at least 8 characters"),
      name: z.string().min(2, "Name must be at least 2 characters"),
    });

    const parsed = schemaZ.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { email, tempToken, password, name } = parsed.data;

    const isValidToken = await validateTempToken({
      email,
      tempToken,
      purpose: "signup",
    });

    if (!isValidToken) {
      return reply.status(401).send({ error: "Invalid or expired verification session. Please request a new code." });
    }

    try {
      // Create user and account using Better Auth server API
      const signUpRes = await auth.api.signUpEmail({
        body: {
          name,
          email: email.toLowerCase().trim(),
          password,
        },
        asResponse: true,
      });

      if (!signUpRes.ok) {
        const errorText = await signUpRes.text();
        return reply.status(400).send({ error: "Signup failed", details: errorText });
      }

      // Mark emailVerified = true in database
      await db
        .update(schema.user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(schema.user.email, email.toLowerCase().trim()));

      // Consume single-use temp token
      await consumeTempToken({ email, tempToken, purpose: "signup" });

      // Forward session cookies to client
      signUpRes.headers.forEach((val, key) => {
        if (key.toLowerCase() === "set-cookie") {
          reply.header("set-cookie", val);
        }
      });

      const bodyJson = (await signUpRes.json()) as any;
      return reply.status(201).send({
        success: true,
        message: "Account created and verified successfully!",
        user: bodyJson.user,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Failed to finalize account: " + err.message });
    }
  });

  // 5. Reset Password after OTP verification
  fastify.post("/api/auth/otp/reset-password", async (request, reply) => {
    const schemaZ = z.object({
      email: z.string().email(),
      tempToken: z.string().min(10),
      password: z.string().min(8, "Password must be at least 8 characters"),
    });

    const parsed = schemaZ.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const { email, tempToken, password } = parsed.data;

    const isValidToken = await validateTempToken({
      email,
      tempToken,
      purpose: "password_reset",
    });

    if (!isValidToken) {
      return reply.status(401).send({ error: "Invalid or expired verification session. Please request a new code." });
    }

    try {
      // Find existing user
      const users = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, email.toLowerCase().trim()))
        .limit(1);

      if (users.length === 0) {
        return reply.status(404).send({ error: "User not found." });
      }

      // Hash new password using Better Auth's cryptographic hasher
      const hashedPassword = await hashPassword(password);

      // Check if account record exists for credential provider
      const existingAccount = await db
        .select()
        .from(schema.account)
        .where(
          and(
            eq(schema.account.userId, users[0].id),
            eq(schema.account.providerId, "credential")
          )
        )
        .limit(1);

      if (existingAccount.length > 0) {
        await db
          .update(schema.account)
          .set({
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(schema.account.id, existingAccount[0].id));
      } else {
        await db.insert(schema.account).values({
          id: crypto.randomUUID(),
          userId: users[0].id,
          providerId: "credential",
          accountId: users[0].id,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Ensure user is marked verified
      await db
        .update(schema.user)
        .set({
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, users[0].id));

      await consumeTempToken({ email, tempToken, purpose: "password_reset" });

      return reply.send({
        success: true,
        message: "Password reset successfully. You can now log in with your new password.",
      });
    } catch (err: any) {
      return reply.status(500).send({ error: "Failed to reset password: " + err.message });
    }
  });

  // 6. Get Current User profile with counts
  fastify.get("/api/auth/me", async (request, reply) => {
    const headers = fromNodeHeaders(request.headers);
    const session = await auth.api.getSession({ headers });

    if (!session || !session.user) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    // Get user stats
    const userForms = await db
      .select()
      .from(schema.forms)
      .where(eq(schema.forms.ownerId, session.user.id));

    const publishedCount = userForms.filter((f) => f.status === "published").length;
    const draftCount = userForms.filter((f) => f.status === "draft").length;
    const closedCount = userForms.filter((f) => f.status === "closed").length;

    return reply.send({
      user: session.user,
      session: session.session,
      stats: {
        totalForms: userForms.length,
        publishedForms: publishedCount,
        draftForms: draftCount,
        closedForms: closedCount,
      },
    });
  });

  // 7. Gmail API OAuth 2.0 Authorization Endpoint
  fastify.get("/api/oauth/google/authorize", async (request, reply) => {
    try {
      const proto =
        (request.headers["x-forwarded-proto"] as string) ||
        (request.headers.host?.includes("localhost") ? "http" : "https");
      const redirectUri =
        process.env.GOOGLE_REDIRECT_URI ||
        `${proto}://${request.headers.host}/api/oauth/google/callback`;

      const consentUrl = getOAuthConsentUrl(redirectUri);
      return reply.redirect(consentUrl);
    } catch (err: any) {
      return reply.status(500).type("text/html").send(`
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:600px;margin:40px auto;border:1px solid #fee2e2;background:#fff5f5;border-radius:12px;">
          <h2 style="color:#b91c1c;margin-top:0;">OAuth Authorization Setup Error</h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;">${err.message}</p>
          <p style="color:#6b7280;font-size:13px;">Please make sure <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> are configured in your environment variables.</p>
        </div>
      `);
    }
  });

  // 8. Gmail API OAuth 2.0 Callback Endpoint
  fastify.get("/api/oauth/google/callback", async (request, reply) => {
    const query = request.query as { code?: string; error?: string };

    if (query.error) {
      return reply.status(400).type("text/html").send(`
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:600px;margin:40px auto;border:1px solid #fee2e2;background:#fff5f5;border-radius:12px;">
          <h2 style="color:#b91c1c;margin-top:0;">Google OAuth Error</h2>
          <p style="color:#374151;">Google returned an error during authorization:</p>
          <pre style="background:#fee2e2;padding:12px;border-radius:6px;color:#991b1b;">${query.error}</pre>
        </div>
      `);
    }

    if (!query.code) {
      return reply.status(400).type("text/html").send(`
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:600px;margin:40px auto;">
          <h2 style="color:#b91c1c;">Missing Authorization Code</h2>
          <p>No <code>code</code> parameter received from Google.</p>
        </div>
      `);
    }

    try {
      const proto =
        (request.headers["x-forwarded-proto"] as string) ||
        (request.headers.host?.includes("localhost") ? "http" : "https");
      const redirectUri =
        process.env.GOOGLE_REDIRECT_URI ||
        `${proto}://${request.headers.host}/api/oauth/google/callback`;

      const tokens = await exchangeOAuthCode(query.code, redirectUri);

      if (!tokens.refresh_token) {
        return reply.type("text/html").send(`
          <div style="font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:650px;margin:40px auto;border:1px solid #fed7aa;background:#fffbeb;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <h2 style="color:#c2410c;margin-top:0;">Notice: No Refresh Token Returned</h2>
            <p style="color:#374151;line-height:1.6;">Google authenticated successfully, but did not return a new refresh token. This happens if the account already has active authorized access for this Client ID.</p>
            <p style="color:#374151;line-height:1.6;">To generate a new refresh token, visit <a href="https://myaccount.google.com/permissions" target="_blank" style="color:#2563eb;font-weight:600;">Google Account Security &gt; Third-party apps</a>, remove access for this app, and click authorize again:</p>
            <div style="margin-top:20px;">
              <a href="/api/oauth/google/authorize" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500;">Re-Authorize Application</a>
            </div>
          </div>
        `);
      }

      return reply.type("text/html").send(`
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:680px;margin:40px auto;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <span style="font-size:32px;">🎉</span>
            <h2 style="color:#15803d;margin:0;font-size:24px;">Gmail API OAuth 2.0 Success!</h2>
          </div>
          <p style="color:#374151;font-size:15px;line-height:1.6;">
            Google has successfully authorized Gmail message sending permissions.
          </p>
          <p style="color:#374151;font-size:15px;font-weight:600;margin-bottom:8px;">
            Your Refresh Token:
          </p>
          <div style="background:#ffffff;border:1px solid #86efac;padding:16px;border-radius:8px;font-family:Consolas,Monaco,monospace;word-break:break-all;font-size:14px;color:#166534;user-select:all;">
            ${tokens.refresh_token}
          </div>
          <div style="margin-top:20px;padding:16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
            <p style="color:#111827;font-size:14px;font-weight:600;margin-top:0;margin-bottom:8px;">Next Step:</p>
            <p style="color:#4b5563;font-size:13px;margin:0;line-height:1.5;">
              Copy the refresh token above and add it to your Render Environment Variables as <code>GMAIL_REFRESH_TOKEN</code>.
            </p>
          </div>
        </div>
      `);
    } catch (err: any) {
      return reply.status(500).type("text/html").send(`
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:600px;margin:40px auto;border:1px solid #fee2e2;background:#fff5f5;border-radius:12px;">
          <h2 style="color:#b91c1c;margin-top:0;">Failed to Exchange Token</h2>
          <p style="color:#374151;">${err.message}</p>
        </div>
      `);
    }
  });
}
