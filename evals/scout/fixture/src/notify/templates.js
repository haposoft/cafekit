// notify/templates: tiện ích nhỏ của khu vực notify.
function templates(input) {
  if (input === undefined || input === null) return null;
  return { area: "notify", kind: "templates", value: input };
}

module.exports = { templates };
