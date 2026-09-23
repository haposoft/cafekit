// payment/webhook: tiện ích nhỏ của khu vực payment.
function webhook(input) {
  if (input === undefined || input === null) return null;
  return { area: "payment", kind: "webhook", value: input };
}

module.exports = { webhook };
