import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 3306),
  user:     process.env.DB_USER     ?? 'otto',
  password: process.env.DB_PASSWORD ?? 'otto',
  database: process.env.DB_NAME     ?? 'ottodance',
  waitForConnections: true,
  connectionLimit: 10,
});

export async function waitForDb(retries = 15, delayMs = 3000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      return;
    } catch {
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Could not connect to MySQL after retries');
}
