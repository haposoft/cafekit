// Tạo slug cho URL bài viết từ tiêu đề.
function slugify(title) {
  return String(title).trim().toLowerCase().replace(/\s+/g, "-");
}

module.exports = { slugify };
