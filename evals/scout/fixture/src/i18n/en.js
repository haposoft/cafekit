// i18n/en: tiện ích nhỏ của khu vực i18n.
function en(input) {
  if (input === undefined || input === null) return null;
  return { area: "i18n", kind: "en", value: input };
}

module.exports = { en };
