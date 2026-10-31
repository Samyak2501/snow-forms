import * as dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

export const SENDER_EMAIL =
  process.env.GMAIL_SENDER_EMAIL || "samyak.jain1@avantika.edu.in";

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Returns a valid OAuth 2.0 access token for the Gmail API.
 * Automatically refreshes the token using GMAIL_REFRESH_TOKEN if expired.
 */
export async function getGmailAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Gmail API OAuth credentials not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN."
    );
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await tokenRes.json()) as any;

  if (!tokenRes.ok || !data.access_token) {
    console.error("[Gmail OAuth Error] Failed to refresh access token:", data);
    throw new Error(
      `Failed to refresh Gmail API access token: ${data.error_description || data.error || "Unknown error"}`
    );
  }

  cachedAccessToken = data.access_token as string;
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  tokenExpiresAt = now + expiresIn * 1000;

  return cachedAccessToken;
}

/**
 * Encodes a string into RFC 4648 Base64URL without padding.
 */
function toBase64Url(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Constructs an RFC 2822/5322 MIME message and sends it via Gmail API users.messages.send
 */
export async function sendGmailMessage({
  to,
  subject,
  html,
  text,
  senderName = "Snow Forms",
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  senderName?: string;
}): Promise<{ id: string; threadId: string }> {
  const accessToken = await getGmailAccessToken();
  const senderAddress = SENDER_EMAIL;

  const boundary = `__boundary_${Date.now()}__`;
  const rawMessage = [
    `From: ${senderName} <${senderAddress}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    text || "",
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  const base64Encoded = toBase64Url(rawMessage);

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: base64Encoded,
      }),
    }
  );

  const result = (await res.json()) as any;

  if (!res.ok) {
    console.error("[Gmail API Send Error]", result);
    throw new Error(
      `Gmail API failed to send message: ${result.error?.message || JSON.stringify(result)}`
    );
  }

  return result;
}

/**
 * Generates the one-time OAuth 2.0 authorization URL for granting gmail.send scope.
 */
export function getOAuthConsentUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.send");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("login_hint", SENDER_EMAIL);
  if (state) url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Exchanges the authorization code received at the callback URL for tokens.
 */
export async function exchangeOAuthCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(
      data.error_description || data.error || "Failed to exchange authorization code."
    );
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}
