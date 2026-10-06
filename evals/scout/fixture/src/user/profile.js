// user/profile: tiện ích nhỏ của khu vực user.
function profile(input) {
  if (input === undefined || input === null) return null;
  return { area: "user", kind: "profile", value: input };
}

module.exports = { profile };
