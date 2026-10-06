const SORTABLE = Object.freeze(["name", "created_at", "total"]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw) {
  if (raw == null) return DEFAULT_LIMIT; // null lẫn undefined đều là "không truyền"
  if (!/^[1-9]\d*$/.test(String(raw))) throw new RangeError("limit must be a positive integer");
  return Math.min(Number(raw), MAX_LIMIT);
}

function buildReportQuery(column, direction, rawLimit) {
  if (!SORTABLE.includes(column)) throw new Error("unsupported sort column");
  const dir = direction === "desc" ? "DESC" : "ASC";
  const limit = parseLimit(rawLimit);
  return `SELECT id, name, created_at, total FROM orders ORDER BY ${column} ${dir} LIMIT ${limit}`;
}

module.exports = { buildReportQuery, parseLimit, SORTABLE, DEFAULT_LIMIT, MAX_LIMIT };
