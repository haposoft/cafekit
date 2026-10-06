// Old CSV export from the 1.x API. No route has called it since 1.3.
function exportLegacy(rows) {
  return rows.map((r) => [r.id, r.name].join(";")).join("\n");
}
module.exports = { exportLegacy };
