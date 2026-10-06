export function toCsv(rows) {
  return rows.map((r) => r.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\n");
}
