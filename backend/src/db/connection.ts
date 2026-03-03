import { Pool } from 'pg';

let pool: Pool;

export async function connectDB(): Promise<void> {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();
    console.log('[DB] PostgreSQL connected successfully');
    client.release();
  } catch (error) {
    console.error('[DB] Connection failed:', error);
    throw error;
  }
}

export function getPool(): Pool {
  if (!pool) throw new Error('Database not initialized. Call connectDB() first.');
  return pool;
}

/**
 * Execute a parameterized query — never use string concatenation
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  const result = await getPool().query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('[DB] Query', { text: text.substring(0, 80), duration, rows: result.rowCount });
  }
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

export async function getClient() {
  return getPool().connect();
}
