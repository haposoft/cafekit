// user/preferences: tiện ích nhỏ của khu vực user.
function preferences(input) {
  if (input === undefined || input === null) return null;
  return { area: "user", kind: "preferences", value: input };
}

module.exports = { preferences };
