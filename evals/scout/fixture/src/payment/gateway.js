// payment/gateway: tiện ích nhỏ của khu vực payment.
function gateway(input) {
  if (input === undefined || input === null) return null;
  return { area: "payment", kind: "gateway", value: input };
}

module.exports = { gateway };
