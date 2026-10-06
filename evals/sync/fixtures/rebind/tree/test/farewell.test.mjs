import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { farewell } from "../src/farewell.mjs";

test("farewell names the user", () => {
  const actual = farewell("An");
  if (actual !== "Tạm biệt, An!") execFileSync("node", [fileURLToPath(new URL("../scripts/nonce.mjs", import.meta.url)), "fail"], { stdio: "inherit" });
  assert.equal(actual, "Tạm biệt, An!");
});
