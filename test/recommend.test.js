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

var lodging = [
  { name: "连锁A", type: "hotel", tier: "economy", location: "central" },
  { name: "精品B", type: "boutique", tier: "comfort", location: "near-transit" }
];
var ranked = rec.rankLodging(lodging, rec.normalizePrefs({ lodgingTypes: ["boutique"], budgetTier: "comfort", lodgingLocation: "near-transit" }));
assert.strictEqual(ranked[0].name, "精品B");
assert.strictEqual(ranked[0].matched, true);
assert.ok(ranked[0].why.length > 0);
assert.strictEqual(ranked[1].matched, false);

var dining = [
  { name: "本地菜馆", cuisineTags: ["local"], rating: 4.2, lat: 22.30, lon: 114.17 },
  { name: "网红店", cuisineTags: ["trending"], rating: 4.8, lat: 22.31, lon: 114.20 }
];
assert.strictEqual(rec.rankPois(dining, { sort: "rating", anchor: null, prefs: {}, kind: "dining" })[0].name, "网红店");
assert.strictEqual(rec.rankPois(dining, { sort: "distance", anchor: { lat: 22.30, lon: 114.17 }, prefs: {}, kind: "dining" })[0].name, "本地菜馆");
var localFirst = rec.rankPois(dining, { sort: "rating", anchor: null, prefs: { cuisine: ["local"] }, kind: "dining" });
assert.strictEqual(localFirst[0].name, "本地菜馆");
assert.ok(localFirst[0].why.length > 0);
var attractions = [{ name: "暴走点", rating: 4.5, bestFor: ["packed"] }, { name: "深度点", rating: 4.5, bestFor: ["relaxed"] }];
assert.strictEqual(rec.rankPois(attractions, { sort: "rating", prefs: { travelStyle: "relaxed" }, kind: "attractions" })[0].name, "深度点");

var osmPoi = rec.osmElementToPoi({ type: "node", id: 1, lat: 22.3, lon: 114.17, tags: {
  name: "测试餐厅", amenity: "restaurant", cuisine: "chinese", phone: "+852 1234 5678",
  "addr:street": "测试街", "addr:housenumber": "8", opening_hours: "10:00-22:00"
}}, "dining", { lat: 22.3, lon: 114.17 });
assert.strictEqual(osmPoi.name, "测试餐厅");
assert.strictEqual(osmPoi.phone, "+852 1234 5678");
assert.ok(osmPoi.address.indexOf("测试街") !== -1);
assert.ok(osmPoi.image.length > 0, "公开图片缺失时仍有明确的示意图");
assert.strictEqual(osmPoi.distanceM, 0);

console.log("Task1 OK");
