const SORTABLE = Object.freeze(["name", "created_at", "total"]);

function buildReportQuery(column) {
  if (!SORTABLE.includes(column)) throw new Error("unsupported sort column");
  return `SELECT id, name, created_at, total FROM orders ORDER BY ${column}`;
}

module.exports = { buildReportQuery, SORTABLE };
