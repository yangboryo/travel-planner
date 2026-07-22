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
    if (hit.length) {
      var certain = hit.filter(function (t) { return t !== "spicy"; });
      var why = certain.length ? "贴合你的" + certain.map(function (t) { return CUISINE_LABEL[t] || t; }).join("、") + "偏好" : "";
      if (hit.indexOf("spicy") !== -1) why += (why ? " · " : "") + "该菜系通常偏辣";
      return why;
    }
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

/* ---------- 区域路由:中国大陆用 GCJ-02 与高德,其他地区用 WGS-84 与 OSM ---------- */

var GCJ_A = 6378245.0;
var GCJ_EE = 0.00669342162296594323;

/* 粗略国界盒。境外直接返回原坐标,不做偏移。 */
function outOfChina(lat, lon) {
  return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function inMainlandChina(lat, lon) {
  if (lat == null || lon == null || outOfChina(lat, lon)) return false;
  if (lat >= 22.13 && lat <= 22.58 && lon >= 113.82 && lon <= 114.44) return false;
  if (lat >= 22.10 && lat <= 22.22 && lon >= 113.52 && lon <= 113.60) return false;
  if (lat >= 21.85 && lat <= 25.35 && lon >= 119.30 && lon <= 122.05) return false;
  return true;
}

function gcjTransformLat(x, y) {
  var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function gcjTransformLon(x, y) {
  var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return ret;
}

/* GPS(WGS-84) → 火星坐标(GCJ-02)。中国大陆地图服务需要这一步,否则点位偏移数百米。 */
function wgs84ToGcj02(lat, lon) {
  if (lat == null || lon == null || outOfChina(lat, lon)) return { lat: lat, lon: lon };
  var dLat = gcjTransformLat(lon - 105.0, lat - 35.0);
  var dLon = gcjTransformLon(lon - 105.0, lat - 35.0);
  var radLat = lat / 180.0 * Math.PI;
  var magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI);
  dLon = (dLon * 180.0) / (GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lon: lon + dLon };
}

/* 地图链接:境内高德(坐标转 GCJ-02),境外 OSM。不使用在中国大陆不可用的服务。 */
function mapLink(lat, lon, name) {
  var label = encodeURIComponent(name || "目的地");
  if (lat == null || lon == null) {
    return "https://www.openstreetmap.org/search?query=" + label;
  }
  if (inMainlandChina(lat, lon)) {
    var g = wgs84ToGcj02(lat, lon);
    return "https://uri.amap.com/marker?position=" + g.lon.toFixed(6) + "," + g.lat.toFixed(6) +
      "&name=" + label + "&coordinate=gaode";
  }
  return "https://www.openstreetmap.org/?mlat=" + lat.toFixed(6) + "&mlon=" + lon.toFixed(6) +
    "#map=17/" + lat.toFixed(5) + "/" + lon.toFixed(5);
}

function mapProviderName(lat, lon) {
  return inMainlandChina(lat, lon) ? "高德地图" : "OpenStreetMap";
}

function osmTagsToCuisineTags(tags, anchorLat, anchorLon) {
  tags = tags || {};
  var result = [];
  var add = function (tag) { if (result.indexOf(tag) === -1) result.push(tag); };
  var isYesOrOnly = function (value) {
    value = String(value || "").toLowerCase().replace(/^\s+|\s+$/g, "");
    return value === "yes" || value === "only";
  };
  if (isYesOrOnly(tags["diet:halal"])) add("halal");
  if (isYesOrOnly(tags["diet:vegetarian"]) || isYesOrOnly(tags["diet:vegan"])) add("vegetarian");
  var cuisines = String(tags.cuisine || "").split(/[;,]/).map(function (value) {
    return value.toLowerCase().replace(/^\s+|\s+$/g, "");
  }).filter(Boolean);
  var spicy = ["sichuan", "hunan", "chongqing", "korean", "thai", "indian", "mexican"];
  var chinese = ["chinese", "sichuan", "hunan", "chongqing", "cantonese", "dumpling", "noodle", "hotpot", "shandong", "jiangzhe", "xinjiang"];
  cuisines.forEach(function (cuisine) {
    if (spicy.indexOf(cuisine) !== -1) add("spicy");
    if (inMainlandChina(anchorLat, anchorLon) && chinese.indexOf(cuisine) !== -1) add("local");
  });
  return result;
}

function osmAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"];
  return [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], tags["addr:city"]]
    .filter(Boolean).join(" ") || "地址请查看地图";
}

function poiPlaceholderImage(kind, name) {
  var icon = kind === "dining" ? "🍽" : "📍";
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520"><rect width="100%" height="100%" fill="#B5D4F4"/>' +
    '<text x="50%" y="42%" text-anchor="middle" font-size="80">' + icon + '</text><text x="50%" y="62%" text-anchor="middle" font-size="34" fill="#0C447C">' +
    String(name || "附近地点").replace(/[&<>]/g, "") + ' · 暂无公开实景图</text></svg>';
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function osmImage(tags, kind, name) {
  if (tags.image && /^https?:\/\//.test(tags.image)) return tags.image;
  var commons = tags.wikimedia_commons || "";
  if (commons.indexOf("File:") === 0) {
    return "https://commons.wikimedia.org/wiki/Special:Redirect/file/" + encodeURIComponent(commons.slice(5));
  }
  return poiPlaceholderImage(kind, name);
}

function osmElementToPoi(el, kind, anchor) {
  var tags = el.tags || {};
  var lat = el.lat != null ? el.lat : el.center && el.center.lat;
  var lon = el.lon != null ? el.lon : el.center && el.center.lon;
  var name = tags["name:zh"] || tags.name || tags.brand || "未命名地点";
  var phone = tags["contact:phone"] || tags.phone || "暂无公开电话";
  /* 官网只认商家自己的网址;OSM 页面是资料来源,单独放 sourceUrl,不冒充官网。 */
  var website = tags["contact:website"] || tags.website || "";
  return {
    name: name, lat: lat, lon: lon,
    distanceM: anchor && lat != null && lon != null ? haversineM(anchor.lat, anchor.lon, lat, lon) : null,
    image: osmImage(tags, kind, name), address: osmAddress(tags), phone: phone, website: website,
    hours: tags.opening_hours || "营业时间请联系商家或查看地图", area: tags["addr:suburb"] || tags["addr:city"] || "附近",
    desc: tags.description || (kind === "dining" ? (tags.cuisine ? "菜系: " + tags.cuisine : "附近餐饮") : (tags.tourism || "附近景点")),
    /* 以下字段 OSM 没有权威数据,一律留空,渲染层会跳过,绝不填默认值冒充真实资料。 */
    cuisineTags: osmTagsToCuisineTags(tags, anchor && anchor.lat, anchor && anchor.lon), rawCuisine: tags.cuisine || "",
    priceLevel: null, rating: null, michelin: false,
    category: tags.tourism || tags.leisure || "景点", durationH: null, bestFor: [],
    source: "OpenStreetMap", sourceUrl: "https://www.openstreetmap.org/" + el.type + "/" + el.id
  };
}

function priceDollars(level) { return level ? new Array(level + 1).join("$") : ""; }
function distanceLabel(m) { return m == null ? "" : (m < 1000 ? m + "m" : (m / 1000).toFixed(1) + "km"); }

function renderPoiCard(poi, ctx) {
  var added = (ctx.wishNames || []).indexOf(poi.name) !== -1;
  var canWish = typeof getTrip === "function" && !!getTrip(ctx.tripId);
  var meta = [];
  if (poi.rating) meta.push('<span class="poi-meta">★ ' + poi.rating + '</span>');
  if (poi.distanceM != null) meta.push('<span class="poi-meta dist">' + (ctx.anchorLabel || "") + distanceLabel(poi.distanceM) + '</span>');
  if (ctx.kind === "dining" && poi.priceLevel) meta.push('<span class="poi-price">' + priceDollars(poi.priceLevel) + '</span>');
  if (ctx.kind === "attractions" && poi.durationH) meta.push('<span class="poi-meta">' + poi.durationH + 'h</span>');
  var safeName = poi.name.replace(/'/g, "\\'");
  var addBtn = !canWish ? "" : (added ? '<span class="badge">已想去</span>' :
    '<button class="rec-add" onclick="event.stopPropagation();addRecToWish(\'' + ctx.tripId + '\',\'' + safeName + '\',\'' +
    (ctx.kind === "dining" ? "🍜" : "📍") + '\')">+ 想去</button>');
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
  var mapHref = mapLink(poi.lat, poi.lon, poi.name);
  var mapName = mapProviderName(poi.lat, poi.lon);
  var html = '<div class="poi-hero' + (poi.image ? "" : " noimg") + '">' + img + '<button class="poi-back" onclick="closePoiDetail()">‹</button></div>';
  html += '<div class="poi-detail-body"><div class="poi-detail-title">' + poi.name +
    (ctx.kind === "dining" && poi.priceLevel ? ' <span class="poi-price">' + priceDollars(poi.priceLevel) + '</span>' : '') +
    (poi.michelin ? ' <span class="badge">米其林</span>' : '') + '</div><div class="poi-detail-sub">' + (poi.area || poi.category || "") +
    (poi.rating ? ' · ★ ' + poi.rating : '') + '</div><div class="poi-detail-desc">' + (poi.desc || "") + '</div>';
  if (poi.why) html += '<div class="poi-why-box">✨ 为你推荐:' + poi.why + '</div>';
  if (poi.tips) html += '<div class="poi-why-box tip">💡 ' + poi.tips + '</div>';
  if (poi.source) {
    html += '<div class="poi-detail-sub">资料来源: ' + poi.source +
      (poi.sourceUrl ? ' · <a href="' + poi.sourceUrl + '" target="_blank" rel="noopener">查看原始记录</a>' : '') +
      '，出发前请再次核实</div>';
  }
  html += infoRow("📍", "地址", poi.address, '<a class="poi-infoact" href="' + mapHref + '" target="_blank" rel="noopener">' + mapName + ' ›</a>');
  var canCall = poi.phone && /\d/.test(poi.phone) && poi.phone.indexOf("暂无") === -1;
  html += infoRow("📞", "电话", poi.phone, canCall ? '<a class="poi-infoact" href="tel:' + poi.phone.replace(/\s/g, "") + '">呼叫</a>' : "");
  html += infoRow("🌐", "网站", poi.website ? poi.website.replace(/^https?:\/\//, "") : "", poi.website ? '<a class="poi-infoact" href="' + poi.website + '" target="_blank" rel="noopener">打开 ›</a>' : "");
  html += infoRow("🕐", "营业时间", poi.hours, "");
  var added = (ctx.wishNames || []).indexOf(poi.name) !== -1, safeName = poi.name.replace(/'/g, "\\'");
  if (typeof getTrip === "function" && getTrip(ctx.tripId)) {
    html += '<button class="btn-primary" style="width:100%;margin-top:14px;" onclick="addRecToWish(\'' + ctx.tripId + '\',\'' + safeName + '\',\'' +
      (ctx.kind === "dining" ? "🍜" : "📍") + '\');closePoiDetail()">' + (added ? '✓ 已在想去清单' : '+ 加入想去') + '</button>';
  }
  html += '</div>';
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

function renderRecLodging(recArr, booked, prefs, ctx) {
  var html = "";
  if (booked && booked.name) html += '<div class="rl-booked"><span class="badge ok">已预订</span> <strong>' + booked.name + '</strong>' +
    (booked.address ? '<div class="rec-desc">' + booked.address + (booked.checkIn ? ' · ' + booked.checkIn : '') + '</div>' : '') + '</div>';
  var ranked = rankLodging(recArr || [], prefs);
  if (ranked.length) {
    html += '<div class="field-label">' + (booked && booked.name ? "还想看看?为你精选" : "为你精选") + '</div>';
    ranked.slice(0, 3).forEach(function (l) {
      html += '<div class="rl-item' + (l.matched ? " pref" : "") + '"><div class="rl-top"><span>' + l.name + ' · ' + l.area + '</span>' +
        '<span class="rl-price">' + (ctx.currency || "") + ' ' + fmtMoney(l.pricePerNight) + '<em>/晚</em></span></div>' +
        '<div class="rl-tags">' + (l.tags || []).map(function (t) { return '<span class="rl-tag">' + t + '</span>'; }).join("") + '</div>' +
        (l.why ? '<div class="poi-why">✨ ' + l.why + '</div>' : '') + '</div>';
    });
  }
  return html;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PREFS_DEFAULT: PREFS_DEFAULT,
    normalizePrefs: normalizePrefs,
    haversineM: haversineM,
    orderCabins: orderCabins,
    rankLodging: rankLodging,
    poiWhy: poiWhy,
    rankPois: rankPois,
    osmAddress: osmAddress,
    osmElementToPoi: osmElementToPoi,
    outOfChina: outOfChina,
    inMainlandChina: inMainlandChina,
    osmTagsToCuisineTags: osmTagsToCuisineTags,
    wgs84ToGcj02: wgs84ToGcj02,
    mapLink: mapLink,
    mapProviderName: mapProviderName
  };
}
