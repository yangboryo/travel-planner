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

function priceDollars(level) { return level ? new Array(level + 1).join("$") : ""; }
function distanceLabel(m) { return m == null ? "" : (m < 1000 ? m + "m" : (m / 1000).toFixed(1) + "km"); }

function renderPoiCard(poi, ctx) {
  var added = (ctx.wishNames || []).indexOf(poi.name) !== -1;
  var meta = [];
  if (poi.rating) meta.push('<span class="poi-meta">★ ' + poi.rating + '</span>');
  if (poi.distanceM != null) meta.push('<span class="poi-meta dist">' + (ctx.anchorLabel || "") + distanceLabel(poi.distanceM) + '</span>');
  if (ctx.kind === "dining" && poi.priceLevel) meta.push('<span class="poi-price">' + priceDollars(poi.priceLevel) + '</span>');
  if (ctx.kind === "attractions" && poi.durationH) meta.push('<span class="poi-meta">' + poi.durationH + 'h</span>');
  var safeName = poi.name.replace(/'/g, "\\'");
  var addBtn = added ? '<span class="badge">已想去</span>' :
    '<button class="rec-add" onclick="event.stopPropagation();addRecToWish(\'' + ctx.tripId + '\',\'' + safeName + '\',\'' +
    (ctx.kind === "dining" ? "🍜" : "📍") + '\')">+ 想去</button>';
  return '<div class="poi-card" onclick="openPoiDetail(\'' + ctx.tripId + '\',\'' + ctx.kind + '\',\'' + safeName + '\')">' +
    '<div class="poi-main"><div class="poi-name">' + poi.name + (poi.michelin ? ' <span class="badge">米其林</span>' : '') + '</div>' +
    '<div class="poi-metaline">' + meta.join("") + '</div><div class="rec-desc">' + (poi.desc || "") + '</div>' +
    (poi.why ? '<div class="poi-why">✨ ' + poi.why + '</div>' : '') + '</div><div class="poi-cardact">' + addBtn + '</div></div>';
}

function infoRow(icon, label, val, actionHTML) {
  if (!val) return "";
  return '<div class="poi-inforow"><span class="poi-infoicon">' + icon + '</span><div class="poi-infobody">' +
    '<div class="poi-infolabel">' + label + '</div><div class="poi-infoval">' + val + '</div></div>' + (actionHTML || "") + '</div>';
}

function renderPoiDetail(poi, ctx) {
  var img = poi.image ? '<img class="poi-photo" src="' + poi.image + '" alt="" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'noimg\')">' : "";
  var mapQ = encodeURIComponent(poi.name + " " + (poi.address || ""));
  var html = '<div class="poi-hero' + (poi.image ? "" : " noimg") + '">' + img + '<button class="poi-back" onclick="closePoiDetail()">‹</button></div>';
  html += '<div class="poi-detail-body"><div class="poi-detail-title">' + poi.name +
    (ctx.kind === "dining" && poi.priceLevel ? ' <span class="poi-price">' + priceDollars(poi.priceLevel) + '</span>' : '') +
    (poi.michelin ? ' <span class="badge">米其林</span>' : '') + '</div><div class="poi-detail-sub">' + (poi.area || poi.category || "") +
    (poi.rating ? ' · ★ ' + poi.rating : '') + '</div><div class="poi-detail-desc">' + (poi.desc || "") + '</div>';
  if (poi.why) html += '<div class="poi-why-box">✨ 为你推荐:' + poi.why + '</div>';
  if (poi.tips) html += '<div class="poi-why-box tip">💡 ' + poi.tips + '</div>';
  html += infoRow("📍", "地址", poi.address, '<a class="poi-infoact" href="https://maps.google.com/?q=' + mapQ + '" target="_blank" rel="noopener">地图 ›</a>');
  html += infoRow("📞", "电话", poi.phone, poi.phone ? '<a class="poi-infoact" href="tel:' + poi.phone.replace(/\s/g, "") + '">呼叫</a>' : "");
  html += infoRow("🌐", "网站", poi.website ? poi.website.replace(/^https?:\/\//, "") : "", poi.website ? '<a class="poi-infoact" href="' + poi.website + '" target="_blank" rel="noopener">打开 ›</a>' : "");
  html += infoRow("🕐", "营业时间", poi.hours, "");
  var added = (ctx.wishNames || []).indexOf(poi.name) !== -1, safeName = poi.name.replace(/'/g, "\\'");
  html += '<button class="btn-primary" style="width:100%;margin-top:14px;" onclick="addRecToWish(\'' + ctx.tripId + '\',\'' + safeName + '\',\'' +
    (ctx.kind === "dining" ? "🍜" : "📍") + '\');closePoiDetail()">' + (added ? '✓ 已在想去清单' : '+ 加入想去') + '</button></div>';
  return html;
}

function fmtMoney(n) { return Number(n).toLocaleString(); }
function renderRecTransport(rec, prefs, ctx) {
  if (!rec || !rec.intercity || !rec.intercity.length) return "";
  var route = rec.intercity[0], cabins = orderCabins(route.cabins, normalizePrefs(prefs).cabinClass);
  var html = '<div class="rec-transport"><div class="rt-origin">📍 从' + (ctx.originName || "出发地") + '出发 · ' +
    (route.label || "") + (route.durationH ? ' ' + route.durationH + 'h' : '') + '</div>';
  cabins.forEach(function (c) {
    var aud = ctx.toAUD ? ctx.toAUD(c.priceLocal, ctx.currency) : null;
    var cabinName = { economy: "经济舱", premium: "超经", business: "商务舱" }[c["class"]] || c["class"];
    html += '<div class="rt-cabin' + (c.preferred ? " pref" : "") + '"><div class="rt-cabin-top"><span>' + cabinName + '</span>' +
      (c.preferred ? '<span class="badge">你的偏好</span>' : '<span class="rt-min">' + (c["class"] === "economy" ? "最省" : "") + '</span>') +
      '</div><div class="rt-price">' + (ctx.currency || "") + ' ' + fmtMoney(c.priceLocal) +
      (aud != null ? ' <em>≈ ' + fmtMoney(aud) + ' AUD</em>' : '') + '</div></div>';
  });
  if (route.tip) html += '<div class="rt-tip">💡 ' + route.tip + '</div>';
  return html + '</div>';
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
