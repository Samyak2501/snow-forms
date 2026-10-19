import { client } from "../src/db/index.js";

async function main() {
  const res = await client.execute("SELECT name, sql FROM sqlite_master WHERE type='table';");
  console.log("sqlite_master tables:", res.rows);
}

main().catch(console.error);
