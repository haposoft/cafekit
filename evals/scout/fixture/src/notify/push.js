// notify/push: tiện ích nhỏ của khu vực notify.
function push(input) {
  if (input === undefined || input === null) return null;
  return { area: "notify", kind: "push", value: input };
}

module.exports = { push };
