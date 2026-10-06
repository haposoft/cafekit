import test from "node:test";
import assert from "node:assert/strict";
import { strongEnough } from "../src/password.mjs";

test("password needs eight characters", () => {
  assert.equal(strongEnough("mat-khau"), true);
  assert.equal(strongEnough("ngan"), false);
});
