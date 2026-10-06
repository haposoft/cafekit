// admin/flags: tiện ích nhỏ của khu vực admin.
function flags(input) {
  if (input === undefined || input === null) return null;
  return { area: "admin", kind: "flags", value: input };
}

module.exports = { flags };
