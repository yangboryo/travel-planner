var assert = require("assert");
var sync = require("../js/sync.js");
var reconcile = sync.reconcile;

assert.strictEqual(reconcile("2026-07-20T10:00:00Z", "2026-07-20T09:00:00Z", "2026-07-20T09:00:00Z", true), "PUSH");
assert.strictEqual(reconcile("2026-07-20T09:00:00Z", "2026-07-20T10:00:00Z", "2026-07-20T09:00:00Z", false), "PULL");
assert.strictEqual(reconcile("2026-07-20T10:00:00Z", "2026-07-20T11:00:00Z", "2026-07-20T09:00:00Z", true), "MERGE");
assert.strictEqual(reconcile("2026-07-20T09:00:00Z", "2026-07-20T09:00:00Z", "2026-07-20T09:00:00Z", false), "NOOP");
assert.strictEqual(reconcile("2026-07-20T10:00:00Z", "", "", true), "PUSH");
assert.strictEqual(reconcile("2026-07-20T10:00:00Z", "2026-07-20T09:00:00Z", "", true), "MERGE");

var merged = sync.mergeCloudData({
  updatedAt: "2026-07-20T10:00:00Z",
  passport: { nationality: "澳大利亚", expiry: "" },
  deletedTripIds: [],
  trips: [{ id: "a", city: "东京", startDate: "2026-08-01", endDate: "2026-08-03",
    todos: [{ offsetDays: 1, text: "打包", done: false }], wishlist: [{ name: "浅草寺" }] }]
}, {
  updatedAt: "2026-07-20T11:00:00Z",
  passport: { nationality: "", expiry: "2031-01-01" },
  deletedTripIds: [],
  trips: [
    { id: "different-id", city: "东京", startDate: "2026-08-01", endDate: "2026-08-03",
      todos: [{ offsetDays: 1, text: "打包", done: true }], wishlist: [{ name: "晴空塔" }] },
    { id: "b", city: "巴黎", startDate: "2026-09-01", endDate: "2026-09-05" }
  ]
});
assert.strictEqual(merged.trips.length, 2, "相同行程合并,不同行程保留");
assert.strictEqual(merged.trips[0].id, "a", "合并后保留稳定 ID");
assert.strictEqual(merged.trips[0].todos[0].done, true, "待办完成状态取并集");
assert.deepStrictEqual(merged.trips[0].wishlist.map(function (w) { return w.name; }), ["浅草寺", "晴空塔"]);
assert.strictEqual(merged.passport.nationality, "澳大利亚");
assert.strictEqual(merged.passport.expiry, "2031-01-01");

var deleted = sync.mergeCloudData({
  updatedAt: "2026-07-20T10:00:00Z", passport: {}, deletedTripIds: ["gone"], trips: []
}, {
  updatedAt: "2026-07-20T11:00:00Z", passport: {}, deletedTripIds: [],
  trips: [{ id: "gone", city: "伦敦" }]
});
assert.strictEqual(deleted.trips.length, 0, "已删除行程不会被另一端复活");

console.log("sync reconcile tests passed");
