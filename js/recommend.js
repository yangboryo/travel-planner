/* 个性化引擎 + 推荐渲染。纯函数可在 Node 单测;渲染函数仅浏览器用。 */

var PREFS_DEFAULT = {
  budgetTier: "comfort",
  cabinClass: "economy",
  lodgingTypes: ["hotel"],
  lodgingLocation: "central",
  cuisine: [],
  travelStyle: "balanced"
};

function normalizePrefs(prefs) {
  var p = prefs || {};
  return {
    budgetTier: p.budgetTier || PREFS_DEFAULT.budgetTier,
    cabinClass: p.cabinClass || PREFS_DEFAULT.cabinClass,
    lodgingTypes: Array.isArray(p.lodgingTypes) && p.lodgingTypes.length ? p.lodgingTypes : PREFS_DEFAULT.lodgingTypes.slice(),
    lodgingLocation: p.lodgingLocation || PREFS_DEFAULT.lodgingLocation,
    cuisine: Array.isArray(p.cuisine) ? p.cuisine : [],
    travelStyle: p.travelStyle || PREFS_DEFAULT.travelStyle
  };
}

function haversineM(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var toRad = function (d) { return d * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function orderCabins(cabins, cabinClass) {
  var out = (cabins || []).map(function (c) {
    return { "class": c["class"], priceLocal: c.priceLocal, note: c.note, preferred: c["class"] === cabinClass };
  });
  out.sort(function (a, b) { return (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0); });
  return out;
}

var TIER_RANK = { economy: 0, comfort: 1, luxury: 2 };
function rankLodging(lodgingArr, prefs) {
  var p = normalizePrefs(prefs);
  var scored = (lodgingArr || []).map(function (l) {
    var typeHit = p.lodgingTypes.indexOf(l.type) !== -1;
    var locHit = l.location === p.lodgingLocation;
    var tierGap = Math.abs((TIER_RANK[l.tier] == null ? 1 : TIER_RANK[l.tier]) - (TIER_RANK[p.budgetTier] == null ? 1 : TIER_RANK[p.budgetTier]));
    return { item: l, score: (typeHit ? 100 : 0) + (locHit ? 20 : 0) - tierGap * 10,
      matched: typeHit, why: (typeHit ? "贴合你偏好的住宿类型" : "") + (locHit ? (typeHit ? " · " : "") + "位置合你意" : "") };
  });
  scored.sort(function (a, b) { return b.score - a.score; });
  return scored.map(function (s) {
    var o = {}; for (var k in s.item) o[k] = s.item[k];
    o.matched = s.matched; o.why = s.why; return o;
  });
}

var CUISINE_LABEL = { local: "本地菜", halal: "清真", vegetarian: "素食", spicy: "嗜辣", trending: "网红店" };
function poiWhy(poi, prefs, kind) {
  var p = normalizePrefs(prefs);
  if (kind === "dining") {
    var hit = (poi.cuisineTags || []).filter(function (t) { return p.cuisine.indexOf(t) !== -1; });
    if (hit.length) return "贴合你的" + hit.map(function (t) { return CUISINE_LABEL[t] || t; }).join("、") + "偏好";
    return poi.michelin ? "米其林推荐" : "";
  }
  if (kind === "attractions" && (poi.bestFor || []).indexOf(p.travelStyle) !== -1) {
    return "适合你的" + ({ packed: "暴走打卡", balanced: "均衡", relaxed: "悠闲深度" }[p.travelStyle]) + "节奏";
  }
  return "";
}

function rankPois(pois, opts) {
  opts = opts || {};
  var p = normalizePrefs(opts.prefs), anchor = opts.anchor, kind = opts.kind;
  var list = (pois || []).map(function (poi) {
    var o = {}; for (var k in poi) o[k] = poi[k];
    o.distanceM = anchor && poi.lat != null && poi.lon != null ? haversineM(anchor.lat, anchor.lon, poi.lat, poi.lon) : null;
    o.why = poiWhy(poi, p, kind);
    o._hit = kind === "dining" ? (poi.cuisineTags || []).some(function (t) { return p.cuisine.indexOf(t) !== -1; }) :
      (kind === "attractions" && (poi.bestFor || []).indexOf(p.travelStyle) !== -1);
    return o;
  });
  list.sort(function (a, b) {
    if (opts.sort === "distance" && a.distanceM != null && b.distanceM != null) return a.distanceM - b.distanceM;
    if (a._hit !== b._hit) return (b._hit ? 1 : 0) - (a._hit ? 1 : 0);
    return (b.rating || 0) - (a.rating || 0);
  });
  list.forEach(function (o) { delete o._hit; });
  return list;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PREFS_DEFAULT: PREFS_DEFAULT,
    normalizePrefs: normalizePrefs,
    haversineM: haversineM,
    orderCabins: orderCabins,
    rankLodging: rankLodging,
    poiWhy: poiWhy,
    rankPois: rankPois
  };
}
