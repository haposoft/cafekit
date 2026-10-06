// notify/sms: tiện ích nhỏ của khu vực notify.
function sms(input) {
  if (input === undefined || input === null) return null;
  return { area: "notify", kind: "sms", value: input };
}

module.exports = { sms };
