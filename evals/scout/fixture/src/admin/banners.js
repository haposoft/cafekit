// admin/banners: tiện ích nhỏ của khu vực admin.
function banners(input) {
  if (input === undefined || input === null) return null;
  return { area: "admin", kind: "banners", value: input };
}

module.exports = { banners };
