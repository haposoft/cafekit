export function total(rows) {
  return rows.reduce((sum, r) => sum + r.amount, 0);
}
