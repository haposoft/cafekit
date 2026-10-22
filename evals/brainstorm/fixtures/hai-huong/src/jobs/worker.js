// Worker giả: lấy job từ bảng `jobs` trên Postgres rồi xử lý.
import pg from "pg";

const db = new pg.Pool();

export async function runOnce(handle) {
  const { rows } = await db.query("SELECT id, payload FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1");
  if (rows.length === 0) return false;
  await handle(rows[0].payload);
  await db.query("UPDATE jobs SET status = 'done' WHERE id = $1", [rows[0].id]);
  return true;
}
