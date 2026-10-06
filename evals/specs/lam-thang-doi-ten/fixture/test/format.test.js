const test = require("node:test");
const assert = require("node:assert");
const { fmtName } = require("../src/format.js");
test("fmtName puts the last name first", () => {
  assert.strictEqual(fmtName({ firstName: "Lan", lastName: "Nguyen" }), "NGUYEN, Lan");
});
