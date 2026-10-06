import test from "node:test";
import assert from "node:assert/strict";
import { login } from "../src/login.mjs";

test("login accepts the demo user", () => {
  assert.equal(login("an", "mat-khau"), true);
});
