const test = require("node:test");
const assert = require("node:assert");
const items = require("../src/data/items");
const { listItems } = require("../src/api/list");

test("API danh sách trả 50 mục", () => {
  assert.strictEqual(listItems(items).length, 50);
});
