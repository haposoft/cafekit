import { pool } from "./db.js";

// Mỗi request tìm kiếm đều truy vấn thẳng vào Postgres.
export async function searchProducts(q) {
  const { rows } = await pool.query(
    "SELECT id, name, price, stock FROM products WHERE search_vector @@ plainto_tsquery($1) LIMIT 20",
    [q],
  );
  return rows;
}
