/* 应用层:store(localStorage)、导航切换、入口 */

var APP_VERSION = "v10"; /* 与 sw.js 的 VERSION 保持一致 */

/* ---------- store ---------- */

var STORE_KEY = "travel-planner";

function loadState() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* 数据损坏时回退到初始 mock */ }
  return { trips: JSON.parse(JSON.stringify(APP_DATA.trips)) };
}

var STATE = loadState();
/* 兼容旧版本存档:补上缺失的字段 */
if (!STATE.passport) STATE.passport = { nationality: "", expiry: "" };
if (STATE.passport.home === undefined) STATE.passport.home = "";
if (!STATE.updatedAt) {
  STATE.updatedAt = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(STATE));
}

/* 插座兼容判断:两地 type 字母有交集即兼容 */
function plugCheck(city) {
  var p = getPassport();
  /* 优先用常住地城市的国家,回退旧的手填字段 */
  var home = (p.homeLoc && p.homeLoc.country) || p.home;
  var dest = APP_DATA.plugTypes[city];
  if (!home || !dest) return null;
  var homePlug = APP_DATA.homePlugs[home];
  if (!homePlug) return null;
  var compatible = dest.type.split("").some(function (c) {
    return homePlug.type.indexOf(c) !== -1;
  });
  return { compatible: compatible, dest: dest, home: homePlug, homeName: home };
}

function getPassport() { return STATE.passport; }

function setPassportField(key, value) {
  STATE.passport[key] = value;
  saveState();
}

function saveState(options) {
  var userChange = !options || options.sync !== false;
  if (userChange) STATE.updatedAt = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(STATE));
  if (userChange && typeof markSyncDirty === "function") markSyncDirty();
}

function getTrips() { return STATE.trips; }

function getTrip(id) {
  return STATE.trips.find(function (t) { return t.id === id; });
}

function addTrip(trip) {
  STATE.trips.push(trip);
  saveState();
}

function deleteTrip(id) {
  STATE.trips = STATE.trips.filter(function (t) { return t.id !== id; });
  saveState();
}

function updateTrip(id, updates) {
  var trip = getTrip(id);
  if (!trip) return;
  Object.keys(updates).forEach(function (k) { trip[k] = updates[k]; });
  saveState();
}

/* ---------- 数据备份/恢复(防 iOS 清空本地存储) ---------- */

/* 导出:剔除天气缓存(可重新获取),只备份真正的用户数据 */
function buildBackup() {
  var backup = { trips: STATE.trips, passport: STATE.passport, _v: 1, _at: new Date().toISOString() };
  return JSON.stringify(backup);
}

function exportBackup() {
  var text = buildBackup();
  /* 主方案:复制到剪贴板 */
  var copied = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {}).catch(function () {});
    copied = true;
  }
  /* 补充:尝试下载文件 */
  try {
    var blob = new Blob([text], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "出行助理备份-" + toDateStr(new Date()) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) { /* 部分 iOS 独立 PWA 不支持下载,靠剪贴板兜底 */ }
  alert(copied
    ? "备份已复制到剪贴板 ✓\n请粘贴到「备忘录」或发给自己的邮件保存。\n(同时尝试下载了备份文件)"
    : "已生成备份文件,请保存到「文件」App。");
}

/* 从文本恢复 */
function restoreFromText() {
  var text = prompt("粘贴之前导出的备份内容:");
  if (!text) return;
  applyBackup(text);
}

/* 从文件恢复 */
function restoreFromFile() {
  var input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", function () {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { applyBackup(reader.result); };
    reader.readAsText(file);
  });
  input.click();
}

function applyBackup(text) {
  var data;
  try { data = JSON.parse(text); } catch (e) { alert("备份内容格式不对,无法恢复。"); return; }
  if (!data || !Array.isArray(data.trips)) { alert("这不是有效的出行助理备份。"); return; }
  if (!confirm("将用备份覆盖当前数据(" + data.trips.length + " 个行程),确定吗?")) return;
  STATE.trips = data.trips;
  if (data.passport) STATE.passport = data.passport;
  saveState();
  alert("恢复成功 ✓");
  location.reload();
}

/* ---------- 天气服务(Open-Meteo,免费无密钥) ---------- */

if (!STATE.weatherCache) STATE.weatherCache = {};

/* WMO 天气代码 → 图标与描述 */
function wmoInfo(code) {
  if (code === 0) return { icon: "☀️", desc: "晴" };
  if (code <= 2) return { icon: "🌤", desc: "多云转晴" };
  if (code === 3) return { icon: "☁️", desc: "阴" };
  if (code === 45 || code === 48) return { icon: "🌫", desc: "雾" };
  if (code >= 51 && code <= 57) return { icon: "🌦", desc: "毛毛雨" };
  if (code >= 61 && code <= 67) return { icon: "🌧", desc: "雨" };
  if (code >= 71 && code <= 77) return { icon: "🌨", desc: "雪" };
  if (code >= 80 && code <= 82) return { icon: "🌦", desc: "阵雨" };
  if (code >= 95) return { icon: "⛈", desc: "雷阵雨" };
  return { icon: "🌤", desc: "—" };
}

/* 当前天气(带 30 分钟缓存,离线回退缓存) */
function fetchCurrentWeather(loc, cb) {
  if (!loc || loc.lat == null) { cb(null); return; }
  var key = "cur:" + loc.lat.toFixed(2) + "," + loc.lon.toFixed(2);
  var cached = STATE.weatherCache[key];
  if (cached && Date.now() - cached.at < 30 * 60000) { cb(cached.data); return; }
  fetch("https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon +
    "&current=temperature_2m,weather_code&timezone=auto")
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var data = { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code };
      STATE.weatherCache[key] = { at: Date.now(), data: data };
      saveState({ sync: false });
      cb(data);
    })
    .catch(function () { cb(cached ? cached.data : null); });
}

/* 日期区间预报(Open-Meteo 可预报未来 16 天) */
function fetchForecast(loc, startDate, endDate, cb) {
  if (!loc || loc.lat == null) { cb(null); return; }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var max = new Date(today); max.setDate(max.getDate() + 15);
  var s = new Date(startDate), e = new Date(endDate);
  if (s > max) { cb(null); return; } /* 太远,无法预报 */
  var clampEnd = e > max ? toDateStr(max) : endDate;
  var clampStart = s < today ? toDateStr(today) : startDate;
  var key = "fc:" + loc.lat.toFixed(2) + "," + loc.lon.toFixed(2) + ":" + clampStart + ":" + clampEnd;
  var cached = STATE.weatherCache[key];
  if (cached && Date.now() - cached.at < 60 * 60000) { cb(cached.data); return; }
  fetch("https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto" +
    "&start_date=" + clampStart + "&end_date=" + clampEnd)
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var days = j.daily.time.map(function (d, i) {
        var w = wmoInfo(j.daily.weather_code[i]);
        return { date: d, icon: w.icon, desc: w.desc,
          high: Math.round(j.daily.temperature_2m_max[i]),
          low: Math.round(j.daily.temperature_2m_min[i]) };
      });
      STATE.weatherCache[key] = { at: Date.now(), data: days };
      saveState({ sync: false });
      cb(days);
    })
    .catch(function () { cb(cached ? cached.data : null); });
}

/* 城市搜索(中文优先) */
function searchCities(query, cb) {
  fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(query) +
    "&count=6&language=zh&format=json")
    .then(function (r) { return r.json(); })
    .then(function (j) { cb(j.results || []); })
    .catch(function () { cb([]); });
}

/* ISO 国家码 → 国旗 emoji */
function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return "🌍";
  return String.fromCodePoint.apply(null, cc.toUpperCase().split("").map(function (c) {
    return 0x1F1E6 + c.charCodeAt(0) - 65;
  }));
}

/* ---------- 导航 ---------- */

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.toggle("active", s.id === id);
  });
  document.querySelectorAll(".tab-item").forEach(function (t) {
    t.classList.toggle("active", t.dataset.screen === id);
  });
  var isDetail = id === "screen-trip-detail";
  document.querySelector(".tab-bar").classList.toggle("hidden", isDetail);
  document.getElementById(id).scrollTop = 0;
}

document.querySelectorAll(".tab-item").forEach(function (btn) {
  btn.addEventListener("click", function () {
    showScreen(btn.dataset.screen);
    if (btn.dataset.screen === "screen-calendar") renderCalendar();
    if (btn.dataset.screen === "screen-profile") renderProfile();
  });
});

/* 详情页导航 */
var DETAIL_FROM = "screen-trips"; /* 记录来源屏,返回时回去 */

function openTripDetail(id) {
  var trip = getTrip(id);
  if (!trip) return;
  CURRENT_TRIP_ID = id;
  DETAIL_FROM = document.querySelector(".screen.active").id;
  renderTripDetail(trip);
  showScreen("screen-trip-detail");
}

function closeTripDetail() {
  CURRENT_TRIP_ID = null;
  showScreen(DETAIL_FROM);
  if (DETAIL_FROM === "screen-trips") renderTripList();
  if (DETAIL_FROM === "screen-calendar") renderCalendar();
}

/* ---------- PWA 更新检测(桌面版自动拉新) ---------- */

if ("serviceWorker" in navigator) {
  /* SW 更新就绪后自动刷新,确保桌面 PWA 始终用最新版 */
  navigator.serviceWorker.register("./sw.js").then(function (reg) {
    reg.addEventListener("updatefound", function () {
      var newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", function () {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          /* 新 SW 已安装但旧版还在控制中→弹提示刷新 */
          if (confirm("有新版本可用,立即刷新?")) {
            window.location.reload();
          }
        }
      });
    });
  });

  /* 页面已由 SW 控制时,每次切回前台检测更新 */
  var refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  /* 切回前台时主动检查更新 */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && navigator.serviceWorker.controller) {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg) reg.update();
      });
    }
  });
}

/* ---------- 入口 ---------- */

renderTripList();
showScreen("screen-trips");
if (typeof syncNow === "function" && SYNC_STATE.token) syncNow();
window.addEventListener("online", function () {
  if (typeof syncNow === "function" && SYNC_STATE.token) syncNow();
});
