require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { buildReportQuery } = require("../src/report");

test("sắp xếp theo cột hợp lệ", () => {
  assert.match(buildReportQuery("total"), /ORDER BY total$/);
});

test("từ chối cột ngoài danh sách", () => {
  assert.throws(() => buildReportQuery("total; DROP TABLE orders"), /unsupported sort column/);
});
