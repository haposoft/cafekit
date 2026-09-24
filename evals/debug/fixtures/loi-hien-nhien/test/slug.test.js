const test = require("node:test");
const assert = require("node:assert");
const { slugify } = require("../src/utils/slug");

test("slug viết thường, nối bằng gạch ngang", () => {
  assert.strictEqual(slugify("  Xin Chao Ban  "), "xin-chao-ban");
});
