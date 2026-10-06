// admin/audit: tiện ích nhỏ của khu vực admin.
function audit(input) {
  if (input === undefined || input === null) return null;
  return { area: "admin", kind: "audit", value: input };
}

module.exports = { audit };
