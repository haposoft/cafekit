function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

module.exports = { formatDate };
