// admin/users: tiện ích nhỏ của khu vực admin.
function users(input) {
  if (input === undefined || input === null) return null;
  return { area: "admin", kind: "users", value: input };
}

module.exports = { users };
