import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: (process.env.SMTP_PORT || "587") === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export interface SendOtpEmailParams {
  to: string;
  name?: string;
  otp: string;
  purpose: "signup" | "password_reset";
  expiryMinutes?: number;
}

export async function sendOtpEmail({
  to,
  name,
  otp,
  purpose,
  expiryMinutes = 5,
}: SendOtpEmailParams): Promise<boolean> {
  const isSignup = purpose === "signup";
  const title = isSignup ? "Verify Your Avantika University Email" : "Reset Your AU Forms Password";
  const actionText = isSignup ? "complete your account registration" : "reset your account password";
  const displayName = name ? `Hello ${name},` : "Hello,";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAFAFA; margin: 0; padding: 24px; color: #1F2937; }
    .card { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #FFFFFF; border-bottom: 3px solid #F16222; padding: 28px 32px; text-align: center; }
    .header h1 { margin: 12px 0 0 0; color: #111827; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .badge { display: inline-block; padding: 4px 12px; background: #FEF4F0; color: #F16222; font-weight: 600; font-size: 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; }
    .content { padding: 32px; }
    .otp-box { background: #FEF4F0; border: 2px dashed #F16222; border-radius: 8px; text-align: center; padding: 20px; margin: 24px 0; }
    .otp-code { font-family: monospace, Courier, sans-serif; font-size: 36px; font-weight: 800; color: #F16222; letter-spacing: 8px; margin: 0; }
    .warning { font-size: 13px; color: #6B7280; text-align: center; margin-top: 8px; }
    .footer { padding: 20px 32px; background: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Avantika University</span>
      <h1>AU Forms Authentication</h1>
    </div>
    <div class="content">
      <p style="font-size: 16px; line-height: 1.5; margin-top: 0;">${displayName}</p>
      <p style="font-size: 15px; line-height: 1.6; color: #4B5563;">
        Use the single-use verification code below to ${actionText} on <strong>AU Forms</strong>:
      </p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="warning">Valid for <strong>${expiryMinutes} minutes</strong>. Do not share this code with anyone.</div>
      </div>
      <p style="font-size: 14px; line-height: 1.5; color: #6B7280;">
        This code is valid for 3 attempts only. If you did not request this verification, please safely ignore this email.
      </p>
    </div>
    <div class="footer">
      Avantika University &bull; Vishwagarma, Ujjain, Madhya Pradesh 456006<br/>
      Secure Form & Survey Infrastructure
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
${title} - Avantika University AU Forms

${displayName}

Your one-time verification code is: ${otp}

This single-use code is valid for ${expiryMinutes} minutes (maximum 3 attempts). Use it to ${actionText}.

If you did not request this email, please ignore it.

Avantika University - AU Forms
  `.trim();

  try {
    const fromAddress = process.env.EMAIL_FROM || `AU Forms <${process.env.SMTP_USER}>`;
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `${otp} is your AU Forms verification code`,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    throw error;
  }
}
