require("./_runs");
const test = require("node:test");
const assert = require("node:assert");
const { activeUsers, activeAdmins } = require("../src/users");

test("chỉ giữ người dùng đang hoạt động", () => {
  const users = [{ id: 1, active: true }, { id: 2, active: false }];
  assert.deepStrictEqual(activeUsers(users).map((u) => u.id), [1]);
});

test("lọc admin đang hoạt động", () => {
  const users = [{ id: 1, active: true, role: "admin" }, { id: 2, active: true, role: "member" }];
  assert.deepStrictEqual(activeAdmins(users).map((u) => u.id), [1]);
});
