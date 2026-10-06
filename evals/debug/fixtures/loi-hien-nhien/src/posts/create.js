const { slugify } = require("../utils/slug");
const { formatDate } = require("../utils/format-date");

function createPost(title, date) {
  return { title, slug: slugify(title), date: formatDate(date) };
}

module.exports = { createPost };
