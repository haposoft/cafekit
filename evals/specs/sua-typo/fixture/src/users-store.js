const rows = [];
module.exports = { findByEmail: async (e) => rows.find((u) => u.email === e) || null };
