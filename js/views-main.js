/* 视图层(主屏):行程列表 / 日历 / 我的 */

/* ---------- 工具 ---------- */

function fmtDateRange(start, end) {
  var s = new Date(start), e = new Date(end);
  return (s.getMonth() + 1) + "月" + s.getDate() + "日 – " + (e.getMonth() + 1) + "月" + e.getDate() + "日";
}

function daysUntil(dateStr) {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function packingProgress(trip) {
  if (!trip.packing || trip.packing.length === 0) return null;
  var done = trip.packing.filter(function (p) { return p.checked; }).length;
  return done + "/" + trip.packing.length;
}

/* ---------- 行程列表页 ---------- */

function renderTripList() {
  var body = document.querySelector("#screen-trips .screen-body");
  var trips = getTrips();
  var upcoming = trips.filter(function (t) { return daysUntil(t.endDate) >= 0; })
    .sort(function (a, b) { return new Date(a.startDate) - new Date(b.startDate); });
  var past = trips.filter(function (t) { return daysUntil(t.endDate) < 0; })
    .sort(function (a, b) { return new Date(b.startDate) - new Date(a.startDate); });

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;">' +
    '<h1 class="page-title">我的行程</h1>' +
    '<button class="add-btn" onclick="openNewTripSheet()">+</button></div>';

  html += renderReminders(upcoming);

  if (upcoming.length) {
    html += '<div class="section-label">即将出行</div>';
    upcoming.forEach(function (t) {
      var cd = daysUntil(t.startDate);
      var w = t.weather && t.weather[0];
      var prog = packingProgress(t);
      html += '<div class="card trip-card" onclick="openTripDetail(\'' + t.id + '\')">' +
        '<div class="trip-card-top"><span class="trip-city">' + t.city + " " + t.flag + '</span>' +
        '<span class="trip-countdown">' + (cd > 0 ? "还有 " + cd + " 天" : "进行中") + '</span></div>' +
        '<div class="trip-dates">' + fmtDateRange(t.startDate, t.endDate) + '</div>' +
        '<div class="trip-badges">' +
        (w ? '<span class="badge">' + w.icon + " " + w.high + "°</span>" : "") +
        (prog ? '<span class="badge">清单 ' + prog + '</span>' : "") +
        '</div></div>';
    });
  }

  if (past.length) {
    html += '<div class="section-label">历史行程</div>';
    past.forEach(function (t) {
      html += '<div class="past-trip" onclick="openTripDetail(\'' + t.id + '\')">' +
        t.city + " " + t.flag + ' · ' + fmtDateRange(t.startDate, t.endDate) + '</div>';
    });
  }

  if (!upcoming.length && !past.length) {
    html += '<div class="empty-state">还没有行程,点右上角 + 新建一个吧</div>';
  }

  body.innerHTML = html;
}

/* ---------- 主界面出行提醒 ---------- */

function renderReminders(upcoming) {
  var items = [];
  var p = getPassport();
  var today = new Date(); today.setHours(0, 0, 0, 0);

  /* 护照有效期(全局) */
  if (p.expiry) {
    var monthsLeft = (new Date(p.expiry) - new Date()) / (30.44 * 86400000);
    if (monthsLeft < 9) {
      items.push({ icon: "🛂", text: "护照有效期不足 9 个月,部分国家可能拒绝入境", action: "goProfile()" });
    }
  }

  upcoming.forEach(function (t) {
    var goto = "openTripDetail('" + t.id + "')";

    /* 签证 */
    var rule = APP_DATA.visaRules[t.city];
    if (rule && rule.type !== "免签") {
      items.push({ icon: "⚠️", text: t.flag + " " + t.city + ":该目的地" + rule.type + ",建议提前 " + rule.applyAheadDays + " 天办理", action: goto });
    }

    /* 插座 */
    var pc = plugCheck(t.city);
    if (pc && !pc.compatible) {
      items.push({ icon: "🔌", text: t.flag + " " + t.city + ":插座 " + pc.dest.type + " 型(" + pc.dest.desc + "),与" + pc.homeName + " " + pc.home.type + " 型不通用,需备转换头", action: goto });
    }

    /* 逾期待办 */
    var overdue = (t.todos || []).filter(function (td) {
      var d = new Date(t.startDate); d.setDate(d.getDate() - td.offsetDays);
      return !td.done && d < today;
    }).length;
    if (overdue > 0) {
      items.push({ icon: "⏰", text: t.flag + " " + t.city + ":有 " + overdue + " 项待办已逾期", action: goto });
    }
  });

  /* 未设置常住地时给一次性引导(有即将出行的行程才提示) */
  if (!p.home && upcoming.length) {
    items.push({ icon: "💡", text: "设置常住地后,可自动提醒目的地插座是否需要转换头", action: "goProfile()" });
  }

  if (!items.length) return "";
  return '<div class="section-label">出行提醒</div>' +
    items.map(function (r) {
      return '<div class="reminder-card" onclick="' + r.action + '">' +
        '<span class="reminder-icon">' + r.icon + '</span>' +
        '<span class="reminder-text">' + r.text + '</span>' +
        '<span style="color:var(--text-faint)">›</span></div>';
    }).join("");
}

function goProfile() {
  showScreen("screen-profile");
  renderProfile();
}

/* ---------- 日历页 ---------- */

var CAL_STATE = { year: null, month: null }; /* month: 0-11 */

function tripCoversDate(trip, dateStr) {
  return trip.startDate <= dateStr && dateStr <= trip.endDate;
}

function renderCalendar(year, month) {
  if (year == null) {
    var now = new Date();
    year = CAL_STATE.year != null ? CAL_STATE.year : now.getFullYear();
    month = CAL_STATE.month != null ? CAL_STATE.month : now.getMonth();
  }
  CAL_STATE.year = year;
  CAL_STATE.month = month;

  var body = document.querySelector("#screen-calendar .screen-body");
  var trips = getTrips();
  var todayStr = toDateStr(new Date());

  var first = new Date(year, month, 1);
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  /* 周一起始:getDay() 周日=0 → 转为周一=0 */
  var leadBlanks = (first.getDay() + 6) % 7;

  var html = '<div class="cal-header">' +
    '<button class="cal-nav" onclick="calShift(-1)">‹</button>' +
    '<span class="cal-title">' + year + '年' + (month + 1) + '月</span>' +
    '<button class="cal-nav" onclick="calShift(1)">›</button></div>';

  html += '<div class="cal-grid cal-weekdays">' +
    ["一", "二", "三", "四", "五", "六", "日"].map(function (d) { return "<div>" + d + "</div>"; }).join("") +
    '</div><div class="cal-grid">';

  for (var b = 0; b < leadBlanks; b++) html += "<div></div>";
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    var covered = trips.some(function (t) { return tripCoversDate(t, ds); });
    var cls = "cal-day" + (covered ? " trip-day" : "") + (ds === todayStr ? " today" : "");
    html += '<div class="' + cls + '">' + d + "</div>";
  }
  html += "</div>";

  /* 本月行程列表 */
  var monthStart = year + "-" + String(month + 1).padStart(2, "0") + "-01";
  var monthEnd = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(daysInMonth).padStart(2, "0");
  var monthTrips = trips.filter(function (t) {
    return t.startDate <= monthEnd && t.endDate >= monthStart;
  });

  html += '<div class="section-label">本月行程</div>';
  if (monthTrips.length) {
    monthTrips.forEach(function (t) {
      html += '<div class="card trip-card" onclick="openTripDetail(\'' + t.id + '\')">' +
        '<div class="trip-card-top"><span class="trip-city">' + t.flag + " " + t.city + '</span>' +
        '<span class="trip-countdown">›</span></div>' +
        '<div class="trip-dates">' + fmtDateRange(t.startDate, t.endDate) + '</div></div>';
    });
  } else {
    html += '<div class="empty-state" style="padding:24px;">本月暂无行程</div>';
  }

  body.innerHTML = html;
}

function calShift(delta) {
  var m = CAL_STATE.month + delta;
  var y = CAL_STATE.year;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  renderCalendar(y, m);
}

function toDateStr(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* ---------- 我的页 ---------- */

function renderProfile() {
  var body = document.querySelector("#screen-profile .screen-body");
  var p = getPassport();

  var html = '<h1 class="page-title">我的</h1>';

  var expiryHTML = "";
  if (p.expiry) {
    /* 护照有效期:距到期 < 9 个月提醒 */
    var monthsLeft = (new Date(p.expiry) - new Date()) / (30.44 * 86400000);
    expiryHTML = monthsLeft < 9
      ? '<div class="visa-banner warn" style="margin-top:10px;">⚠️ 护照有效期不足 9 个月,部分国家可能拒绝入境,请尽快换发</div>'
      : '<div class="profile-ok">✅ 有效期充足(剩余约 ' + Math.floor(monthsLeft / 12) + ' 年)</div>';
  }

  html += '<div class="section-label">护照档案(仅存本机)</div>' +
    '<div class="card">' +
    '<div class="profile-row lodging-row" onclick="editPassport(\'nationality\',\'国籍\')">' +
    '<span class="profile-key">国籍</span><span>' + (p.nationality || '<span style="color:var(--text-faint)">点击设置</span>') + '</span></div>' +
    '<div class="profile-row lodging-row" onclick="editPassport(\'expiry\',\'护照有效期(如 2031-05-20)\')">' +
    '<span class="profile-key">护照有效期至</span><span>' + (p.expiry || '<span style="color:var(--text-faint)">点击设置</span>') + '</span></div>' +
    '<div class="profile-row lodging-row" onclick="editHome()">' +
    '<span class="profile-key">常住地(用于插座提醒)</span><span>' + (p.home || '<span style="color:var(--text-faint)">点击设置</span>') + '</span></div>' +
    expiryHTML +
    '</div>';

  html += '<div class="section-label">汇率换算器</div>' +
    '<div class="card">' +
    '<div class="fx-row">' +
    '<input id="fx-amount-a" class="field-input" type="number" value="100" oninput="fxConvert(\'a\')">' +
    '<select id="fx-cur-a" class="field-input fx-select" onchange="fxConvert(\'a\')">' + fxOptions("AUD") + '</select>' +
    '</div>' +
    '<div class="fx-swap">⇅</div>' +
    '<div class="fx-row">' +
    '<input id="fx-amount-b" class="field-input" type="number" oninput="fxConvert(\'b\')">' +
    '<select id="fx-cur-b" class="field-input fx-select" onchange="fxConvert(\'a\')">' + fxOptions("HKD") + '</select>' +
    '</div>' +
    '<div class="fx-note">mock 汇率,阶段二接入实时汇率</div>' +
    '</div>';

  html += '<div class="section-label">设置</div>' +
    '<div class="card" style="padding:4px 16px;">' +
    ['🔔 出行提醒', '🌐 语言', 'ℹ️ 关于'].map(function (s) {
      return '<div class="profile-row settings-row"><span>' + s + '</span><span style="color:var(--text-faint)">›</span></div>';
    }).join("") +
    '</div>';

  body.innerHTML = html;
  fxConvert("a");
}

function editPassport(key, label) {
  var cur = getPassport()[key] || "";
  var val = prompt("设置" + label, cur);
  if (val === null) return;
  setPassportField(key, val.trim());
  renderProfile();
}

function editHome() {
  var options = Object.keys(APP_DATA.homePlugs).join(" / ");
  var cur = getPassport().home || "";
  var val = prompt("设置常住地(支持:" + options + ")", cur);
  if (val === null) return;
  val = val.trim();
  if (val && !APP_DATA.homePlugs[val]) {
    alert("暂不认识这个地区的插座制式,目前支持:" + options);
    return;
  }
  setPassportField("home", val);
  renderProfile();
}

function fxOptions(selected) {
  return Object.keys(APP_DATA.fxRates).map(function (c) {
    return '<option' + (c === selected ? " selected" : "") + '>' + c + "</option>";
  }).join("");
}

/* 双向换算:from='a' 用 A 面金额算 B 面,反之亦然 */
function fxConvert(from) {
  var rates = APP_DATA.fxRates;
  var curA = document.getElementById("fx-cur-a").value;
  var curB = document.getElementById("fx-cur-b").value;
  var amtA = document.getElementById("fx-amount-a");
  var amtB = document.getElementById("fx-amount-b");
  if (from === "a") {
    var v = parseFloat(amtA.value);
    amtB.value = isNaN(v) ? "" : ((v / rates[curA]) * rates[curB]).toFixed(2);
  } else {
    var v2 = parseFloat(amtB.value);
    amtA.value = isNaN(v2) ? "" : ((v2 / rates[curB]) * rates[curA]).toFixed(2);
  }
}

/* ---------- 新建行程抽屉 ---------- */

var FLAG_OPTIONS = ["🇭🇰", "🇯🇵", "🇹🇭", "🇸🇬", "🇨🇳", "🇦🇺", "🇺🇸", "🇬🇧", "🇫🇷", "🌍"];

function openNewTripSheet() {
  var overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = '<div class="sheet" onclick="event.stopPropagation()">' +
    '<div class="sheet-title">新建行程</div>' +
    '<label class="field-label">目的地城市</label>' +
    '<input id="nt-city" class="field-input" placeholder="如:新加坡">' +
    '<label class="field-label">国旗</label>' +
    '<div class="flag-row">' + FLAG_OPTIONS.map(function (f, i) {
      return '<span class="flag-opt' + (i === 0 ? " selected" : "") + '" onclick="selectFlag(this)">' + f + "</span>";
    }).join("") + '</div>' +
    '<label class="field-label">币种</label>' +
    '<select id="nt-currency" class="field-input">' +
    Object.keys(APP_DATA.fxRates).filter(function (c) { return c !== "AUD"; })
      .map(function (c) { return '<option>' + c + "</option>"; }).join("") +
    '</select>' +
    '<div class="date-row">' +
    '<div style="flex:1"><label class="field-label">出发日期</label><input id="nt-start" type="date" class="field-input"></div>' +
    '<div style="flex:1"><label class="field-label">返回日期</label><input id="nt-end" type="date" class="field-input"></div>' +
    '</div>' +
    '<button class="btn-primary" style="width:100%;margin-top:16px;" onclick="submitNewTrip()">创建行程</button>' +
    '</div>';
  overlay.addEventListener("click", function () { overlay.remove(); });
  document.querySelector(".phone").appendChild(overlay);
}

function selectFlag(el) {
  document.querySelectorAll(".flag-opt").forEach(function (f) { f.classList.remove("selected"); });
  el.classList.add("selected");
}

function submitNewTrip() {
  var city = document.getElementById("nt-city").value.trim();
  var start = document.getElementById("nt-start").value;
  var end = document.getElementById("nt-end").value;
  var currency = document.getElementById("nt-currency").value;
  var flag = document.querySelector(".flag-opt.selected").textContent;
  if (!city || !start || !end) { alert("请填写目的地和起止日期"); return; }
  if (new Date(end) < new Date(start)) { alert("返回日期不能早于出发日期"); return; }

  var trip = {
    id: "trip-" + Date.now(),
    city: city, flag: flag, currency: currency,
    startDate: start, endDate: end,
    weather: [], todos: [
      { offsetDays: 30, text: "预订酒店", done: false },
      { offsetDays: 21, text: "预订机票", done: false },
      { offsetDays: 3, text: "兑换外币", done: false },
      { offsetDays: 1, text: "打包行李", done: false }
    ],
    packing: [], transport: { flights: [
      { platform: "携程", note: "机票查询", url: "https://www.ctrip.com" },
      { platform: "飞猪", note: "机票查询", url: "https://www.fliggy.com" },
      { platform: "Trip.com", note: "机票查询", url: "https://www.trip.com" }
    ], userFlights: [] },
    lodging: { name: "", address: "", checkIn: "", checkOut: "", confirmNo: "" },
    itinerary: [], wishlist: [], budget: [],
    emergency: { police: "", ambulance: "", consular: "", insuranceNo: "" },
    tips: { timezone: "", plug: "", tipping: "", transitCard: "" }
  };
  addTrip(trip);
  document.querySelector(".sheet-overlay").remove();
  renderTripList();
}
