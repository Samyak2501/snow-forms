import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function verifySmtp() {
  console.log("=== VERIFYING GMAIL SMTP CONFIGURATION ===");
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  console.log("Host:", host);
  console.log("Port:", port);
  console.log("User:", user);
  console.log("Password configured:", !!pass);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // false for 587
    auth: {
      user,
      pass: (pass || "").replace(/\s+/g, ""),
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const verified = await transporter.verify();
  console.log("✓ Transporter verified successfully with Gmail SMTP:", verified);
}

verifySmtp().catch((err) => {
  console.error("SMTP verification error:", err);
  process.exit(1);
});
