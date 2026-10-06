require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { activeUsers } = require("../src/users");

test("chỉ giữ người dùng đang hoạt động", () => {
  const users = [{ id: 1, active: true }, { id: 2, active: false }];
  assert.deepStrictEqual(activeUsers(users).map((u) => u.id), [1]);
});
