// user/session: tiện ích nhỏ của khu vực user.
function session(input) {
  if (input === undefined || input === null) return null;
  return { area: "user", kind: "session", value: input };
}

module.exports = { session };
