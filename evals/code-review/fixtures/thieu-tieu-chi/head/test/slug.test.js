require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { slugify } = require("../src/slug");

test("AC-01: bỏ khoảng trắng đầu cuối và viết thường", () => {
  assert.strictEqual(slugify("  Hello "), "hello");
});

test("AC-02: mỗi cụm khoảng trắng thành một dấu gạch", () => {
  assert.strictEqual(slugify("a  b c"), "a-b-c");
});
