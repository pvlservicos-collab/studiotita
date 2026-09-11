import { Pool } from "pg";

// Pool único reaproveitado entre requests (Next.js reusa o módulo em dev/serverless).
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new DbConfigError(
      "DATABASE_URL não configurada. Defina no .env.local a connection string do Neon (veja .env.example)."
    );
  }
  if (!global.__pgPool) {
    global.__pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return global.__pgPool;
}

export class DbConfigError extends Error {}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
