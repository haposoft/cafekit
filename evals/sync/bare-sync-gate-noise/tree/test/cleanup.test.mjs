import test from "node:test";
import assert from "node:assert/strict";
import { trimAll } from "../src/cleanup.mjs";

test("cleanup trims every item", () => {
  assert.deepEqual(trimAll([" a ", "b "]), ["a", "b"]);
});
