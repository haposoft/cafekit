function roundTo(amount, step) {
  return Math.round(amount / step) * step;
}

module.exports = { roundTo };
