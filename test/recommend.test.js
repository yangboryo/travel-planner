var assert = require("assert");
var rec = require("../js/recommend.js");

/* normalizePrefs: 缺失字段补默认值,已有字段保留 */
var d = rec.normalizePrefs(undefined);
assert.strictEqual(d.budgetTier, "comfort");
assert.strictEqual(d.cabinClass, "economy");
assert.deepStrictEqual(d.lodgingTypes, ["hotel"]);
assert.strictEqual(d.lodgingLocation, "central");
assert.deepStrictEqual(d.cuisine, []);
assert.strictEqual(d.travelStyle, "balanced");

var keep = rec.normalizePrefs({ cabinClass: "business", cuisine: ["local"] });
assert.strictEqual(keep.cabinClass, "business");
assert.deepStrictEqual(keep.cuisine, ["local"]);
assert.strictEqual(keep.budgetTier, "comfort");

var dm = rec.haversineM(22.3027, 114.1772, 22.2759, 114.1455);
assert.ok(dm > 3000 && dm < 5000);
assert.strictEqual(rec.haversineM(0, 0, 0, 0), 0);
assert.strictEqual(dm, Math.round(dm));

var cabins = [{ "class": "economy", priceLocal: 1400 }, { "class": "business", priceLocal: 4600 }];
var ordered = rec.orderCabins(cabins, "business");
assert.strictEqual(ordered[0]["class"], "business");
assert.strictEqual(ordered[0].preferred, true);
assert.strictEqual(ordered[1].preferred, false);
assert.strictEqual(rec.orderCabins(cabins, "premium")[0].preferred, false);

console.log("Task1 OK");
