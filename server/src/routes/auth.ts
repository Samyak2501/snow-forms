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
import {
  getOAuthConsentUrl,
  exchangeOAuthCode,
  setGmailTokens,
  getGmailStatus,
  verifyGmailService,
  persistRefreshTokenToRender,
  sendGmailMessage,
  SENDER_EMAIL,
} from "../services/gmail.js";

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number." };
  }
  if (/^\d+$/.test(password)) {
    return { valid: false, error: "Numeric-only passwords are not allowed. Please include letters." };
  }
  const commonWeak = new Set([
    "password", "password1", "password123", "12345678", "123456789",
    "1234466789", "1234567890", "01234567", "qwerty123", "admin123",
    "welcome1", "letmein1", "avantika123", "snowforms123", "student123",
    "password@123", "admin@123"
  ]);
  if (commonWeak.has(password.toLowerCase().trim())) {
    return { valid: false, error: "This password is too common or weak. Please choose a stronger password." };
  }
  if (/^(.)\1+$/.test(password)) {
    return { valid: false, error: "Password cannot consist of a single repeated character." };
  }
  return { valid: true };
}

const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .superRefine((val, ctx) => {
    const check = validatePasswordStrength(val);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error || "Password does not meet strength requirements",
      });
    }
  });

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
      password: passwordRule,
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
      password: passwordRule,
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

  // 7. Gmail API Health Status Endpoint
  fastify.get("/api/health/gmail", async (request, reply) => {
    try {
      const status = getGmailStatus();
      const verification = await verifyGmailService();

      const isHealthy = status.configured && verification.ok;
      const proto =
        (request.headers["x-forwarded-proto"] as string) ||
        (request.headers.host?.includes("localhost") ? "http" : "https");
      return reply.status(isHealthy ? 200 : 503).send({
        status: isHealthy ? "healthy" : "action_required",
        sender: SENDER_EMAIL,
        configured: status.configured,
        details: {
          hasClientId: status.hasClientId,
          hasClientSecret: status.hasClientSecret,
          hasRefreshToken: status.hasRefreshToken,
          tokenValid: verification.ok,
          tokenExpiresInSeconds: verification.tokenExpiresInSeconds ?? 0,
        },
        error: verification.error || null,
        reauthorizeUrl: `${proto}://${request.headers.host}/api/oauth/google/authorize`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({
        status: "error",
        error: err.message,
      });
    }
  });

  // 8. Test Send Email Endpoint
  fastify.all("/api/oauth/google/test-send", async (request, reply) => {
    try {
      const targetEmail = SENDER_EMAIL;
      const testTimestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

      const result = await sendGmailMessage({
        to: targetEmail,
        subject: `Snow Forms - Gmail API Verification (${testTimestamp})`,
        text: `Snow Forms Gmail API verification successful!\n\nSent to: ${targetEmail}\nTimestamp: ${testTimestamp}\nSender: ${SENDER_EMAIL}\nStatus: Active and sending normally.`,
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;margin:20px auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
            <div style="border-bottom:2px solid #F16222;padding-bottom:12px;margin-bottom:16px;">
              <span style="font-size:12px;font-weight:700;color:#F16222;text-transform:uppercase;letter-spacing:1px;">Snow Forms &bull; Avantika University</span>
              <h2 style="margin:6px 0 0;color:#111827;font-size:20px;">Gmail API Integration Verified</h2>
            </div>
            <p style="color:#374151;font-size:15px;line-height:1.6;">
              This confirms that the Gmail API OAuth 2.0 integration on <strong>Snow Forms</strong> is functioning properly and authorized to send transactional emails.
            </p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:13px;color:#4b5563;">
              <p style="margin:4px 0;"><strong>Sender:</strong> ${SENDER_EMAIL}</p>
              <p style="margin:4px 0;"><strong>Recipient:</strong> ${targetEmail}</p>
              <p style="margin:4px 0;"><strong>Delivered At:</strong> ${testTimestamp} IST</p>
            </div>
            <p style="color:#10b981;font-weight:600;font-size:14px;margin-bottom:0;">
              &check; OAuth 2.0 Access Token is valid and ready for registration OTPs.
            </p>
          </div>
        `,
        senderName: "Snow Forms Verification",
      });

      return reply.send({
        success: true,
        messageId: result.id,
        recipient: targetEmail,
        timestamp: testTimestamp,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  // 9. Gmail API OAuth 2.0 Authorization Endpoint
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

  // 10. Gmail API OAuth 2.0 Callback Endpoint
  fastify.get("/api/oauth/google/callback", async (request, reply) => {
    const query = request.query as { code?: string; error?: string };

    if (query.error) {
      return reply.status(400).type("text/html").send(`
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:600px;margin:40px auto;border:1px solid #fee2e2;background:#fff5f5;border-radius:12px;">
          <h2 style="color:#b91c1c;margin-top:0;">Google OAuth Error</h2>
          <p style="color:#374151;">Google returned an error during authorization:</p>
          <pre style="background:#fee2e2;padding:12px;border-radius:6px;color:#991b1b;">${query.error}</pre>
          <div style="margin-top:20px;">
            <a href="/api/oauth/google/authorize" style="display:inline-block;background:#2563eb;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500;">Try Again</a>
          </div>
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
            <p style="color:#374151;line-height:1.6;">
              Google authenticated successfully, but did not include a new refresh token. This happens if the account already has active authorized access for this Client ID.
            </p>
            <p style="color:#374151;line-height:1.6;">
              To force Google to issue a new refresh token, visit <a href="https://myaccount.google.com/permissions" target="_blank" style="color:#2563eb;font-weight:600;">Google Account Security &gt; Third-party apps</a>, remove access for Snow Forms, and then click below:
            </p>
            <div style="margin-top:20px;">
              <a href="/api/oauth/google/authorize" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:500;">Re-Authorize Application</a>
            </div>
          </div>
        `);
      }

      // 1. Immediately activate tokens in running server memory
      setGmailTokens(tokens.refresh_token, tokens.access_token, tokens.expires_in);

      // 2. Persist to Render environment variables if RENDER_API_KEY is configured
      const persistStatus = await persistRefreshTokenToRender(tokens.refresh_token);

      return reply.type("text/html").send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Snow Forms - Gmail Authorization Complete</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 32px 16px; color: #1f2937; }
            .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); overflow: hidden; }
            .header { background: #065f46; color: white; padding: 28px 32px; }
            .header h1 { margin: 8px 0 0; font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
            .content { padding: 32px; }
            .badge { display: inline-block; padding: 4px 10px; background: rgba(255,255,255,0.2); border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
            .status-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 20px 0; }
            .status-title { font-weight: 600; color: #166534; font-size: 14px; margin-bottom: 6px; }
            .status-desc { font-size: 13px; color: #374151; margin: 0; line-height: 1.5; }
            .token-container { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 16px 0; font-family: monospace; font-size: 12px; word-break: break-all; color: #0f172a; position: relative; }
            .btn { display: inline-block; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s ease; }
            .btn-primary { background: #F16222; color: white; }
            .btn-primary:hover { background: #d94e10; }
            .btn-secondary { background: #e5e7eb; color: #1f2937; margin-left: 8px; }
            .btn-secondary:hover { background: #d1d5db; }
            .action-card { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 20px; margin-top: 24px; }
            #testResult { margin-top: 12px; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <span class="badge">Avantika University &bull; Snow Forms</span>
              <h1>&check; Gmail API OAuth 2.0 Success</h1>
            </div>
            <div class="content">
              <p style="font-size:15px;line-height:1.6;margin-top:0;">
                The sender account <strong>${SENDER_EMAIL}</strong> has successfully granted Gmail sending permissions to Snow Forms.
              </p>

              <div class="status-box">
                <div class="status-title">&bull; In-Memory Status: Active Immediately</div>
                <p class="status-desc">
                  The new token is already active in backend memory. You can immediately send verification OTPs without waiting for a server restart.
                </p>
                <div class="status-title" style="margin-top:12px;">&bull; Render Persistence Status:</div>
                <p class="status-desc">
                  ${persistStatus.message}
                </p>
              </div>

              <div>
                <label style="font-size:13px;font-weight:600;color:#374151;">Refresh Token:</label>
                <div class="token-container" id="tokenBox">${tokens.refresh_token}</div>
                <button type="button" class="btn btn-secondary" onclick="copyToken()" id="copyBtn">Copy Token</button>
              </div>

              <div class="action-card">
                <h3 style="margin:0 0 8px;color:#9a3412;font-size:16px;">Verify Email Delivery Now</h3>
                <p style="margin:0 0 16px;font-size:13px;color:#431407;line-height:1.5;">
                  Click below to dispatch an automated test email to <strong>${SENDER_EMAIL}</strong> through the Gmail API:
                </p>
                <button type="button" class="btn btn-primary" id="testBtn" onclick="runEmailTest()">
                  Send Test Verification Email
                </button>
                <div id="testResult"></div>
              </div>

              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
                <a href="https://snow-forms.netlify.app" target="_blank" style="color:#2563eb;font-size:14px;font-weight:500;text-decoration:none;">
                  &larr; Open Snow Forms Frontend
                </a>
                <a href="/api/health/gmail" target="_blank" style="color:#6b7280;font-size:13px;text-decoration:none;">
                  Check Health Endpoint &rarr;
                </a>
              </div>
            </div>
          </div>

          <script>
            function copyToken() {
              const text = document.getElementById('tokenBox').innerText;
              navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('copyBtn');
                btn.innerText = 'Copied!';
                setTimeout(() => { btn.innerText = 'Copy Token'; }, 2500);
              });
            }

            async function runEmailTest() {
              const btn = document.getElementById('testBtn');
              const resBox = document.getElementById('testResult');
              btn.disabled = true;
              btn.innerText = 'Sending email...';
              resBox.innerHTML = '<span style="color:#6b7280;">Contacting Gmail API...</span>';

              try {
                const res = await fetch('/api/oauth/google/test-send', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  resBox.innerHTML = '<div style="background:#f0fdf4;border:1px solid #86efac;color:#166534;padding:12px;border-radius:6px;margin-top:10px;"><strong>&check; Success!</strong> Verification email sent to ' + data.recipient + '<br/><span style="font-size:11px;color:#15803d;">Message ID: ' + data.messageId + '</span></div>';
                  btn.innerText = '&check; Delivered';
                } else {
                  resBox.innerHTML = '<div style="background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;padding:12px;border-radius:6px;margin-top:10px;"><strong>Error:</strong> ' + (data.error || 'Failed to send') + '</div>';
                  btn.disabled = false;
                  btn.innerText = 'Retry Test';
                }
              } catch (e) {
                resBox.innerHTML = '<div style="background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;padding:12px;border-radius:6px;margin-top:10px;"><strong>Network Error:</strong> ' + e.message + '</div>';
                btn.disabled = false;
                btn.innerText = 'Retry Test';
              }
            }
          </script>
        </body>
        </html>
      `);
    } catch (err: any) {
      return reply.status(500).type("text/html").send(`
        <div style="font-family:system-ui,-apple-system,sans-serif;padding:40px;max-width:600px;margin:40px auto;border:1px solid #fee2e2;background:#fff5f5;border-radius:12px;">
          <h2 style="color:#b91c1c;margin-top:0;">Failed to Exchange Token</h2>
          <p style="color:#374151;">${err.message}</p>
          <div style="margin-top:20px;">
            <a href="/api/oauth/google/authorize" style="display:inline-block;background:#2563eb;color:white;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500;">Try Authorizing Again</a>
          </div>
        </div>
      `);
    }
  });
}
