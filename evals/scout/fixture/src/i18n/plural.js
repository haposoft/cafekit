// i18n/plural: tiện ích nhỏ của khu vực i18n.
function plural(input) {
  if (input === undefined || input === null) return null;
  return { area: "i18n", kind: "plural", value: input };
}

module.exports = { plural };
