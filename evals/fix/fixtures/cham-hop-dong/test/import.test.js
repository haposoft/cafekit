require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { importRow } = require("../src/import/row");

test("nhận số tiền hợp lệ", () => {
  assert.deepStrictEqual(importRow({ id: 1, amount: "12.5" }), { id: 1, amount: 12.5 });
});

test("từ chối số tiền không phải số", () => {
  assert.throws(() => importRow({ id: 2, amount: "abc" }), /invalid amount/);
});

test("từ chối số tiền rỗng", () => {
  assert.throws(() => importRow({ id: 3, amount: "" }), /invalid amount/);
});
