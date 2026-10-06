import test from "node:test";
import assert from "node:assert/strict";
import { greet } from "../src/greet.mjs";

test("greet names the user", () => {
  assert.equal(greet("An"), "Xin chào, An!");
});
