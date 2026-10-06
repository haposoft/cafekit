import test from "node:test";
import assert from "node:assert/strict";
import { total } from "../src/report.mjs";

test("report total sums amounts", () => {
  assert.equal(total([{ amount: 2 }, { amount: 3 }]), 5);
});
