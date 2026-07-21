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

/* OSM 没有的字段一律为空,不得填充默认值冒充真实资料 */
assert.strictEqual(osmPoi.priceLevel, null, "OSM 无价位数据,不得硬编码 $$");
assert.strictEqual(osmPoi.rating, null, "OSM 无评分");
assert.deepStrictEqual(osmPoi.bestFor, [], "OSM 无出行风格依据,不得全命中");
var osmSpot = rec.osmElementToPoi({ type: "node", id: 2, lat: 31.2, lon: 121.47,
  tags: { name: "测试公园", leisure: "park" } }, "attractions", null);
assert.strictEqual(osmSpot.durationH, null, "OSM 无游玩时长,不得硬编码 1.5h");
assert.strictEqual(osmSpot.website, "", "无商家官网时留空,不能拿 OSM 页面冒充官网");
assert.ok(osmSpot.sourceUrl.indexOf("openstreetmap.org") !== -1, "OSM 页面作为资料来源单独给出");
/* 空 bestFor 不应产生"为你推荐"理由 */
assert.strictEqual(rec.poiWhy(osmSpot, { travelStyle: "relaxed" }, "attractions"), "");

/* 区域判断:中国大陆内外 */
assert.strictEqual(rec.outOfChina(31.2304, 121.4737), false, "上海在境内");
assert.strictEqual(rec.outOfChina(-33.8688, 151.2093), true, "悉尼在境外");

/* WGS-84 → GCJ-02:境内产生偏移,境外原样返回 */
var sh = rec.wgs84ToGcj02(31.2304, 121.4737);
var shift = rec.haversineM(31.2304, 121.4737, sh.lat, sh.lon);
assert.ok(shift > 50 && shift < 1000, "上海坐标偏移应在数百米量级,实测 " + shift);
var syd = rec.wgs84ToGcj02(-33.8688, 151.2093);
assert.strictEqual(syd.lat, -33.8688, "境外纬度不变");
assert.strictEqual(syd.lon, 151.2093, "境外经度不变");

/* 地图链接按区域切换 */
var cnLink = rec.mapLink(31.2304, 121.4737, "外滩");
assert.ok(cnLink.indexOf("amap.com") !== -1, "境内用高德");
assert.ok(cnLink.indexOf("google") === -1, "境内不得用 Google 地图");
var auLink = rec.mapLink(-33.8688, 151.2093, "Opera House");
assert.ok(auLink.indexOf("openstreetmap.org") !== -1, "境外用 OSM");

console.log("Task1 OK");
