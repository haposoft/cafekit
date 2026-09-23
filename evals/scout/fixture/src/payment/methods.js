// payment/methods: tiện ích nhỏ của khu vực payment.
function methods(input) {
  if (input === undefined || input === null) return null;
  return { area: "payment", kind: "methods", value: input };
}

module.exports = { methods };
