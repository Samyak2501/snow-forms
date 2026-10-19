import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log("Testing Turso connection...");
  console.log("URL:", url);
  console.log("Token configured:", !!authToken);

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  }

  const client = createClient({
    url,
    authToken,
  });

  const res = await client.execute("SELECT 1 as connected;");
  console.log("Connection success! Result:", res.rows);

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
  );
  console.log("Existing tables in database:", tables.rows.map(r => r.name));
}

main().catch((err) => {
  console.error("Turso connection error:", err);
  process.exit(1);
});
