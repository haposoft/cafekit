function isSeasonActive(date) {
  if (!date) return false;
  const month = new Date(date).getMonth() + 1;
  return month === 12;
}

module.exports = { isSeasonActive };
