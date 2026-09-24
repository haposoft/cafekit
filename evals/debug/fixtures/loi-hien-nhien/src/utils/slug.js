function slugify(title) {
  return title.trim().toLowerCase.replace(/\s+/g, "-");
}

module.exports = { slugify };
