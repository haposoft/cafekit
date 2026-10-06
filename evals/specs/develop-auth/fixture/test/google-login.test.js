const test = require("node:test");
const assert = require("node:assert");
const { matchGoogleUser } = require("../src/google-login.js");
const users = [{ id: 7, email: "lan@example.com" }];
test("a verified Google email that matches an account returns that account", () => {
  assert.deepStrictEqual(matchGoogleUser({ email: "lan@example.com", email_verified: true }, users), users[0]);
});
test("an unverified email never matches", () => {
  assert.strictEqual(matchGoogleUser({ email: "lan@example.com", email_verified: false }, users), null);
});
test("an unknown email returns null", () => {
  assert.strictEqual(matchGoogleUser({ email: "x@example.com", email_verified: true }, users), null);
});
