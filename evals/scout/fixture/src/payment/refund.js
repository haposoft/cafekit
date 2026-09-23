// payment/refund: tiện ích nhỏ của khu vực payment.
function refund(input) {
  if (input === undefined || input === null) return null;
  return { area: "payment", kind: "refund", value: input };
}

module.exports = { refund };
