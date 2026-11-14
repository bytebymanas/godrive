import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function withActor(userId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(userId)]);
    } else {
      await client.query("SELECT set_config('app.current_user_id', '', true)");
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
