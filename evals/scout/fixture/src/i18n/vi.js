// i18n/vi: tiện ích nhỏ của khu vực i18n.
function vi(input) {
  if (input === undefined || input === null) return null;
  return { area: "i18n", kind: "vi", value: input };
}

module.exports = { vi };
