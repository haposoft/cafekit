// payment/receipt: tiện ích nhỏ của khu vực payment.
function receipt(input) {
  if (input === undefined || input === null) return null;
  return { area: "payment", kind: "receipt", value: input };
}

module.exports = { receipt };
