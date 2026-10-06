const { fmtName } = require("./format");
// Plain-text list for the weekly sales email.
function weeklyList(customers) {
  return customers.map((c) => `- ${fmtName(c)}`).join("\n");
}
module.exports = { weeklyList };
