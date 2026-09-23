// user/address: tiện ích nhỏ của khu vực user.
function address(input) {
  if (input === undefined || input === null) return null;
  return { area: "user", kind: "address", value: input };
}

module.exports = { address };
