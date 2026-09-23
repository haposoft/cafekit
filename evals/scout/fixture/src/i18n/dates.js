// i18n/dates: tiện ích nhỏ của khu vực i18n.
function dates(input) {
  if (input === undefined || input === null) return null;
  return { area: "i18n", kind: "dates", value: input };
}

module.exports = { dates };
