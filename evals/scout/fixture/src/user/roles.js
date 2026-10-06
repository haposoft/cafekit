// user/roles: tiện ích nhỏ của khu vực user.
function roles(input) {
  if (input === undefined || input === null) return null;
  return { area: "user", kind: "roles", value: input };
}

module.exports = { roles };
