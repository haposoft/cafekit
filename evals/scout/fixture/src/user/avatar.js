// user/avatar: tiện ích nhỏ của khu vực user.
function avatar(input) {
  if (input === undefined || input === null) return null;
  return { area: "user", kind: "avatar", value: input };
}

module.exports = { avatar };
