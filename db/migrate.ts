/**
 * Aplica db/schema.sql no banco apontado por DATABASE_URL (.env.local).
 * Uso: npm run db:migrate
 */
import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const envLocal = path.join(__dirname, "..", ".env.local");
loadEnv({ path: existsSync(envLocal) ? envLocal : path.join(__dirname, "..", ".env") });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL não definida. Configure o .env.local (veja .env.example) com a connection string do Neon."
    );
    process.exit(1);
  }

  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  console.log("Aplicando schema.sql...");
  try {
    await pool.query(sql);
    console.log("Schema aplicado com sucesso.");
  } catch (err) {
    console.error("Erro ao aplicar schema:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
