require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { buildReportQuery, parseLimit } = require("../src/report");

test("sắp xếp theo cột hợp lệ, mặc định tăng dần", () => {
  assert.match(buildReportQuery("total"), /ORDER BY total ASC LIMIT 50$/);
});

test("giảm dần khi direction là desc", () => {
  assert.match(buildReportQuery("name", "desc", "10"), /ORDER BY name DESC LIMIT 10$/);
});

test("từ chối cột ngoài danh sách", () => {
  assert.throws(() => buildReportQuery("total; DROP TABLE orders"), /unsupported sort column/);
});

test("limit: mặc định, trần và giá trị sai", () => {
  assert.strictEqual(parseLimit(undefined), 50);
  assert.strictEqual(parseLimit(null), 50);
  assert.strictEqual(parseLimit("500"), 200);
  for (const bad of ["0", "-3", "2.5", "10abc", "", "0x10", "1e2", " 5"]) {
    assert.throws(() => parseLimit(bad), RangeError, bad);
  }
});
