// notify/queue: tiện ích nhỏ của khu vực notify.
function queue(input) {
  if (input === undefined || input === null) return null;
  return { area: "notify", kind: "queue", value: input };
}

module.exports = { queue };
