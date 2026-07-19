/* 应用层:store(localStorage)、导航切换、入口 */

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

function getPassport() { return STATE.passport; }

function setPassportField(key, value) {
  STATE.passport[key] = value;
  saveState();
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(STATE));
}

function getTrips() { return STATE.trips; }

function getTrip(id) {
  return STATE.trips.find(function (t) { return t.id === id; });
}

function addTrip(trip) {
  STATE.trips.push(trip);
  saveState();
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

/* ---------- 入口 ---------- */

renderTripList();
showScreen("screen-trips");
