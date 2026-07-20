var assert = require("assert");
var reconcile = require("../js/sync.js").reconcile;

assert.strictEqual(reconcile("2026-07-20T10:00:00Z", "2026-07-20T09:00:00Z", "2026-07-20T09:00:00Z", true), "PUSH");
assert.strictEqual(reconcile("2026-07-20T09:00:00Z", "2026-07-20T10:00:00Z", "2026-07-20T09:00:00Z", false), "PULL");
assert.strictEqual(reconcile("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z", "2026-07-20T09:00:00Z", true), "CONFLICT");
assert.strictEqual(reconcile("2026-07-20T09:00:00Z", "2026-07-20T09:00:00Z", "2026-07-20T09:00:00Z", false), "NOOP");
assert.strictEqual(reconcile("2026-07-20T10:00:00Z", "", "", true), "PUSH");
assert.strictEqual(reconcile("2026-07-20T10:00:00Z", "2026-07-20T09:00:00Z", "", true), "PULL");

console.log("sync reconcile tests passed");
