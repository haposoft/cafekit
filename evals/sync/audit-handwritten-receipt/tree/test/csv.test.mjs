import test from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../src/csv.mjs";

test("csv quotes cells with commas", () => {
  assert.equal(toCsv([["a", "b,c"]]), 'a,"b,c"');
});
