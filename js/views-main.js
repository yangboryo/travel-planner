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

  html += renderHomeWeather();
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
        '</div>' +
        '<span class="trip-del" onclick="event.stopPropagation();delTrip(\'' + t.id + '\')" title="删除">✕</span>' +
        '</div>';
    });
  }

  if (past.length) {
    html += '<div class="section-label">历史行程</div>';
    past.forEach(function (t) {
      html += '<div class="past-trip" onclick="openTripDetail(\'' + t.id + '\')">' +
        t.city + " " + t.flag + ' · ' + fmtDateRange(t.startDate, t.endDate) +
        '<span class="trip-del" onclick="event.stopPropagation();delTrip(\'' + t.id + '\')" title="删除">✕</span></div>';
    });
  }

  if (!upcoming.length && !past.length) {
    html += '<div class="empty-state">还没有行程,点右上角 + 新建一个吧</div>';
  }

  body.innerHTML = html;
}

/* ---------- 城市搜索选择器(通用底部抽屉) ---------- */

function openCitySearch(title, onPick) {
  var overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = '<div class="sheet" onclick="event.stopPropagation()">' +
    '<div class="sheet-title">' + title + '</div>' +
    '<div class="pack-add" style="margin-top:0;">' +
    '<input id="cs-input" class="field-input" placeholder="输入城市名,如:悉尼 / 香港 / Tokyo">' +
    '<button class="btn-primary pack-add-btn" id="cs-btn">搜索</button></div>' +
    '<div id="cs-results"></div>' +
    '</div>';
  overlay.addEventListener("click", function () { overlay.remove(); });
  document.querySelector(".phone").appendChild(overlay);

  function doSearch() {
    var q = document.getElementById("cs-input").value.trim();
    if (!q) return;
    var box = document.getElementById("cs-results");
    box.innerHTML = '<div class="empty-inline">搜索中…</div>';
    searchCities(q, function (results) {
      if (!results.length) {
        box.innerHTML = '<div class="empty-inline">没找到,换个写法试试(支持中英文)</div>';
        return;
      }
      box.innerHTML = results.map(function (r, i) {
        /* admin2(市级)优先,解决部分城市 admin1(省级)不准确的问题,如腾冲 */
        var regionParts = [];
        if (r.admin2) regionParts.push(r.admin2);
        if (r.admin1 && r.admin1 !== r.admin2) regionParts.push(r.admin1);
        if (r.country) regionParts.push(r.country);
        var region = regionParts.join(" · ");
        return '<div class="city-result" data-i="' + i + '">' +
          '<span class="wish-type">' + flagEmoji(r.country_code) + '</span>' +
          '<div style="flex:1"><div>' + r.name + '</div>' +
          '<div class="tip-label">' + region + '</div></div></div>';
      }).join("");
      box.querySelectorAll(".city-result").forEach(function (el) {
        el.addEventListener("click", function () {
          var r = results[parseInt(el.dataset.i, 10)];
          overlay.remove();
          onPick({ name: r.name, country: r.country || "", countryCode: r.country_code || "",
            lat: r.latitude, lon: r.longitude });
        });
      });
    });
  }
  document.getElementById("cs-btn").addEventListener("click", doSearch);
  document.getElementById("cs-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") doSearch();
  });
  document.getElementById("cs-input").focus();
}

/* ---------- 主界面双城天气条 ---------- */

function renderHomeWeather() {
  var p = getPassport();
  var slots = [
    { label: "常住地", loc: p.homeLoc, id: "hw-home" },
    { label: "所在地", loc: p.currentLoc, id: "hw-cur" }
  ];
  var html = '<div class="dual-weather">' + slots.map(function (s) {
    if (!s.loc) {
      return '<div class="dw-chip empty" onclick="goProfile()">' +
        '<div class="dw-label">' + s.label + '</div>' +
        '<div class="dw-main">点击设置</div></div>';
    }
    return '<div class="dw-chip" id="' + s.id + '" onclick="goProfile()">' +
      '<div class="dw-label">' + s.label + ' · ' + s.loc.name + '</div>' +
      '<div class="dw-main">…</div></div>';
  }).join("") + "</div>";

  /* 异步填充温度 */
  setTimeout(function () {
    slots.forEach(function (s) {
      if (!s.loc) return;
      fetchCurrentWeather(s.loc, function (w) {
        var el = document.getElementById(s.id);
        if (!el) return;
        el.querySelector(".dw-main").innerHTML = w
          ? wmoInfo(w.code).icon + " " + w.temp + "°C · " + wmoInfo(w.code).desc
          : "离线 · 暂无数据";
      });
    });
  }, 0);

  return html;
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
    '<div class="profile-row lodging-row" onclick="pickHomeLoc()">' +
    '<span class="profile-key">常住地(插座/天气)</span><span>' +
    (p.homeLoc ? p.homeLoc.name + " · " + p.homeLoc.country : '<span style="color:var(--text-faint)">点击设置</span>') + '</span></div>' +
    '<div class="profile-row lodging-row" onclick="pickCurrentLoc()">' +
    '<span class="profile-key">现在所在地(天气)</span><span>' +
    (p.currentLoc ? p.currentLoc.name + " · " + p.currentLoc.country : '<span style="color:var(--text-faint)">点击设置</span>') + '</span></div>' +
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

function pickHomeLoc() {
  openCitySearch("设置常住地", function (loc) {
    setPassportField("homeLoc", loc);
    renderProfile();
  });
}

function pickCurrentLoc() {
  openCitySearch("设置现在所在地", function (loc) {
    setPassportField("currentLoc", loc);
    renderProfile();
  });
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

var NT_SELECTED = null; /* 新建行程时选中的城市 */

function openNewTripSheet() {
  NT_SELECTED = null;
  var overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = '<div class="sheet" onclick="event.stopPropagation()">' +
    '<div class="sheet-title">新建行程</div>' +
    '<label class="field-label">目的地城市</label>' +
    '<div id="nt-city-display" class="field-input nt-city-pick" onclick="pickTripCity()">' +
    '<span style="color:var(--text-faint)">点击搜索城市(全球)</span></div>' +
    '<label class="field-label">币种（选完目的地自动匹配）</label>' +
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

function pickTripCity() {
  openCitySearch("选择目的地城市", function (loc) {
    NT_SELECTED = loc;
    var el = document.getElementById("nt-city-display");
    if (el) el.innerHTML = flagEmoji(loc.countryCode) + " " + loc.name + ' <span class="tip-label">' + loc.country + "</span>";
    /* 根据目的地国家自动匹配币种(先中文名,再 ISO 码保底) */
    var autoCur = APP_DATA.countryCurrencies[loc.country] || APP_DATA.countryCodeCurrencies[loc.countryCode];
    if (autoCur) {
      var sel = document.getElementById("nt-currency");
      if (sel) sel.value = autoCur;
    }
  });
}

function submitNewTrip() {
  var start = document.getElementById("nt-start").value;
  var end = document.getElementById("nt-end").value;
  var currency = document.getElementById("nt-currency").value;
  if (!NT_SELECTED || !start || !end) { alert("请选择目的地城市并填写起止日期"); return; }
  var city = NT_SELECTED.name;
  var flag = flagEmoji(NT_SELECTED.countryCode);
  if (new Date(end) < new Date(start)) { alert("返回日期不能早于出发日期"); return; }

  var trip = {
    id: "trip-" + Date.now(),
    city: city, flag: flag, currency: currency,
    loc: { lat: NT_SELECTED.lat, lon: NT_SELECTED.lon, country: NT_SELECTED.country },
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

/* 删除行程(确认后) */
function delTrip(id) {
  var trip = getTrip(id);
  if (!trip) return;
  if (!confirm("确定删除「" + trip.flag + " " + trip.city + "」行程吗？")) return;
  deleteTrip(id);
  renderTripList();
}

/* 编辑行程(弹窗,预填已有数据) */
function openEditTripSheet(tripId) {
  var trip = getTrip(tripId);
  if (!trip) return;
  NT_SELECTED = { name: trip.city, country: trip.loc.country, countryCode: "",
    lat: trip.loc.lat, lon: trip.loc.lon };
  var overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = '<div class="sheet" onclick="event.stopPropagation()">' +
    '<div class="sheet-title">编辑行程</div>' +
    '<label class="field-label">目的地城市</label>' +
    '<div id="nt-city-display" class="field-input nt-city-pick" onclick="pickTripCity()">' +
    trip.flag + ' ' + trip.city + ' <span class="tip-label">' + (trip.loc.country || '') + '</span></div>' +
    '<label class="field-label">币种（选完目的地自动匹配）</label>' +
    '<select id="nt-currency" class="field-input">' +
    Object.keys(APP_DATA.fxRates).filter(function (c) { return c !== "AUD"; })
      .map(function (c) { return '<option' + (c === trip.currency ? ' selected' : '') + '>' + c + '</option>'; }).join("") +
    '</select>' +
    '<div class="date-row">' +
    '<div><label class="field-label">出发日期</label><input id="nt-start" type="date" class="field-input" value="' + trip.startDate + '"></div>' +
    '<div><label class="field-label">返回日期</label><input id="nt-end" type="date" class="field-input" value="' + trip.endDate + '"></div>' +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-top:16px;">' +
    '<button class="btn-primary" style="flex:1" onclick="submitEditTrip(\'' + tripId + '\')">保存</button>' +
    '<button class="btn-danger" style="flex:1" onclick="delTripFromEdit(\'' + tripId + '\')">删除行程</button>' +
    '</div>' +
    '</div>';
  overlay.addEventListener("click", function () { overlay.remove(); });
  document.querySelector(".phone").appendChild(overlay);
}

function submitEditTrip(tripId) {
  var trip = getTrip(tripId);
  if (!trip) return;
  var start = document.getElementById("nt-start").value;
  var end = document.getElementById("nt-end").value;
  var currency = document.getElementById("nt-currency").value;
  if (!start || !end) { alert("请填写起止日期"); return; }
  if (new Date(end) < new Date(start)) { alert("返回日期不能早于出发日期"); return; }

  var updates = { startDate: start, endDate: end, currency: currency };
  /* 如果重新选了目的地城市,也更新 */
  if (NT_SELECTED && NT_SELECTED.name !== trip.city) {
    updates.city = NT_SELECTED.name;
    updates.flag = flagEmoji(NT_SELECTED.countryCode);
    updates.loc = { lat: NT_SELECTED.lat, lon: NT_SELECTED.lon, country: NT_SELECTED.country };
  }
  updateTrip(tripId, updates);
  document.querySelector(".sheet-overlay").remove();
  refreshTripDetail();
  renderTripList();
}

function delTripFromEdit(tripId) {
  document.querySelector(".sheet-overlay").remove();
  delTrip(tripId);
  closeTripDetail();
}
