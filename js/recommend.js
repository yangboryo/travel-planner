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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PREFS_DEFAULT: PREFS_DEFAULT,
    normalizePrefs: normalizePrefs
  };
}
