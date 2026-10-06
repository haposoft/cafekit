const test = require("node:test");
const assert = require("node:assert");
const { exportLegacy } = require("../src/legacy-export.js");
test("exportLegacy joins id and name", () => {
  assert.strictEqual(exportLegacy([{ id: 1, name: "Lan" }]), "1;Lan");
});
