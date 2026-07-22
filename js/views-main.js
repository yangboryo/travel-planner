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

  html += '<div class="section-label">护照档案(开启后同步至私密 Gist)</div>' +
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

  var pf = getPrefs();
  html += '<div class="section-label">出行喜好(个性化推荐依据)</div><div class="card">';
  html += prefSelectHTML("budgetTier", "预算档次", pf.budgetTier);
  html += prefSelectHTML("cabinClass", "舱位偏好", pf.cabinClass);
  html += prefSelectHTML("lodgingLocation", "住宿位置", pf.lodgingLocation);
  html += prefSelectHTML("travelStyle", "出行风格", pf.travelStyle);
  html += prefChecksHTML("lodgingTypes", "住宿类型", pf.lodgingTypes);
  html += prefChecksHTML("cuisine", "口味偏好", pf.cuisine) + '</div>';

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
    '<div class="fx-note">参考汇率,以银行实际成交为准</div>' +
    '</div>';

  html += '<div class="section-label">跨设备云同步</div>' +
    '<div id="sync-section" class="card"></div>';

  html += '<div class="section-label">数据备份(重要)</div>' +
    '<div class="card">' +
    '<div class="fx-note" style="text-align:left;margin:0 0 10px;">iPhone 长期不打开可能会清空 App 数据。建议定期导出备份,换机或数据丢失后可恢复。</div>' +
    '<button class="btn-primary" style="width:100%;margin-bottom:8px;" onclick="exportBackup()">📤 导出备份</button>' +
    '<div class="date-row">' +
    '<button class="btn-secondary" style="flex:1;" onclick="restoreFromText()">📋 粘贴恢复</button>' +
    '<button class="btn-secondary" style="flex:1;" onclick="restoreFromFile()">📁 文件恢复</button>' +
    '</div></div>';

  html += '<div class="section-label">关于</div>' +
    '<div class="card"><div class="profile-row"><span class="profile-key">版本</span>' +
    '<span id="app-version">加载中…</span></div>' +
    '<div class="profile-row lodging-row" onclick="checkForUpdate()"><span>检查更新</span>' +
    '<span style="color:var(--primary)">立即检查 ›</span></div></div>';

  body.innerHTML = html;
  renderSyncSection();
  fxConvert("a");
  var vEl = document.getElementById("app-version");
  if (vEl) vEl.textContent = (typeof APP_VERSION !== "undefined" ? APP_VERSION : "—");
}

function renderSyncSection() {
  var el = document.getElementById("sync-section");
  if (!el || typeof SYNC_STATE === "undefined") return;
  var labels = {
    local: "⚪ 仅本机", dirty: "🟠 待同步", syncing: "🔵 正在同步",
    synced: "🟢 已同步", offline: "🟡 离线", conflict: "🔴 有冲突", error: "🔴 同步失败"
  };
  var html = '<div class="profile-row"><span class="profile-key">状态</span>' +
    '<span id="sync-status">' + (labels[SYNC_STATE.status] || labels.local) + '</span></div>' +
    '<div class="fx-note" style="text-align:left;margin:8px 0 12px;word-break:break-word;">' +
    escapeHTML(SYNC_STATE.message || "") +
    (SYNC_STATE.lastSyncAt ? '<br>上次成功: ' + formatSyncTime(SYNC_STATE.lastSyncAt) : "") + '</div>';
  if (!SYNC_STATE.token || !SYNC_STATE.encryptionKey) {
    html += '<input id="sync-token" class="field-input" type="password" autocomplete="off" ' +
      'placeholder="粘贴 GitHub classic token (仅 gist 权限)">' +
      '<input id="sync-password" class="field-input" type="password" autocomplete="new-password" ' +
      'style="margin-top:8px;" placeholder="设置同步密码 (至少 10 个字符)">' +
      '<input id="sync-password-confirm" class="field-input" type="password" autocomplete="new-password" ' +
      'style="margin-top:8px;" placeholder="再次输入同步密码">' +
      '<button class="btn-primary" style="width:100%;margin-top:10px;" onclick="saveSyncCredentials()">建立加密同步</button>' +
      '<div class="fx-note" style="text-align:left;margin-top:10px;">数据在本机加密后才上传。token 和派生密钥只保存在本机；其他设备需输入相同同步密码。忘记密码将无法解密云端数据。</div>';
  } else {
    html += '<div class="date-row">' +
      '<button class="btn-primary" style="flex:1;" onclick="syncNow()">立即同步</button>' +
      '<button class="btn-secondary" style="flex:1;" onclick="clearSyncToken()">清除 token</button></div>';
  }
  el.innerHTML = html;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
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

var NT_SELECTED = null; /* 新建/编辑行程时选中的城市 */
var NT_CITY_CHANGED = false;

function openNewTripSheet() {
  NT_SELECTED = null;
  NT_CITY_CHANGED = false;
  var overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = '<div class="sheet" onclick="event.stopPropagation()">' +
    '<div class="sheet-title">新建行程</div>' +
    '<label class="field-label">目的地城市</label>' +
    '<div id="nt-city-display" class="field-input nt-city-pick" onclick="pickTripCity()">' +
    '<span style="color:var(--text-faint)">点击搜索城市(全球)</span></div>' +
    '<label class="field-label">币种（选完目的地自动匹配）</label>' +
    '<select id="nt-currency" class="field-input">' +
    Object.keys(APP_DATA.fxRates)
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
    NT_CITY_CHANGED = true;
    var el = document.getElementById("nt-city-display");
    if (el) el.innerHTML = flagEmoji(loc.countryCode) + " " + loc.name + ' <span class="tip-label">' + loc.country + "</span>";
    /* 根据目的地国家自动匹配币种(先中文名,再 ISO 码保底) */
    var autoCur = APP_DATA.countryCurrencies[loc.country] || APP_DATA.countryCodeCurrencies[loc.countryCode];
    /* 若匹配到的币种已被精简掉,回退到 USD */
    if (autoCur && !APP_DATA.fxRates[autoCur]) autoCur = "USD";
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
    loc: { lat: NT_SELECTED.lat, lon: NT_SELECTED.lon, country: NT_SELECTED.country,
      countryCode: NT_SELECTED.countryCode || "" },
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
  var oldLoc = trip.loc || {};
  NT_SELECTED = { name: trip.city || "", country: oldLoc.country || "", countryCode: oldLoc.countryCode || "",
    lat: oldLoc.lat, lon: oldLoc.lon };
  NT_CITY_CHANGED = false;
  var overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = '<div class="sheet" onclick="event.stopPropagation()">' +
    '<div class="sheet-title">编辑行程</div>' +
    '<label class="field-label">目的地城市</label>' +
    '<div id="nt-city-display" class="field-input nt-city-pick" onclick="pickTripCity()">' +
    (trip.flag || "🌍") + ' ' + trip.city + ' <span class="tip-label">' + (oldLoc.country || '') + '</span></div>' +
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
  /* 只要用户重新选择过城市就完整更新地点；同名城市纠偏也必须保存。 */
  if (NT_CITY_CHANGED && NT_SELECTED) {
    updates.city = NT_SELECTED.name;
    updates.flag = flagEmoji(NT_SELECTED.countryCode);
    updates.loc = { lat: NT_SELECTED.lat, lon: NT_SELECTED.lon, country: NT_SELECTED.country,
      countryCode: NT_SELECTED.countryCode || "" };
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

var EXPLORE_STATE = { place: "nearby", sort: "distance" };
function renderExplore() {
  var body = document.querySelector("#screen-explore .screen-body");
  var upcoming = getTrips().filter(function (t) { return daysUntil(t.endDate) >= 0; })
    .sort(function (a, b) { return new Date(a.startDate) - new Date(b.startDate); });
  var html = '<h1 class="page-title">推荐</h1><div class="place-switch">' +
    '<span class="place-chip' + (EXPLORE_STATE.place === "nearby" ? " on" : "") + '" onclick="switchPlace(\'nearby\')">📍 附近</span>';
  upcoming.forEach(function (t) {
    html += '<span class="place-chip' + (EXPLORE_STATE.place === t.id ? " on" : "") + '" onclick="switchPlace(\'' + t.id + '\')">' +
      t.city + ' · ' + (new Date(t.startDate).getMonth() + 1) + '月</span>';
  });
  body.innerHTML = html + '</div><div id="explore-content"></div>';
  renderExploreContent();
}

function switchPlace(place) { EXPLORE_STATE.place = place; EXPLORE_STATE.sort = "distance"; renderExplore(); }
function setExploreSort(sort) { EXPLORE_STATE.sort = sort; renderExploreContent(); }
function renderExploreContent() {
  var box = document.getElementById("explore-content");
  if (!box) return;
  if (EXPLORE_STATE.place === "nearby") renderNearby(box); else renderDestinationPlan(box, EXPLORE_STATE.place);
}
function sortToggleHTML(distLabel) {
  return '<div class="sort-toggle"><span class="' + (EXPLORE_STATE.sort === "distance" ? "on" : "") + '" onclick="setExploreSort(\'distance\')">' +
    distLabel + '</span><span class="' + (EXPLORE_STATE.sort === "rating" ? "on" : "") + '" onclick="setExploreSort(\'rating\')">好吃好玩</span></div>';
}
function poiGroupHTML(list, kind, anchor, tripId, wishNames, anchorLabel) {
  return rankPois(list, { sort: EXPLORE_STATE.sort, anchor: anchor, prefs: getPrefs(), kind: kind }).map(function (poi) {
    return renderPoiCard(poi, { tripId: tripId, kind: kind, wishNames: wishNames, anchorLabel: anchorLabel });
  }).join("");
}
var NEARBY_CACHE = { dining: [], attractions: [] };

function uniqueNearby(list) {
  var seen = {};
  return list.filter(function (p) {
    var key = p.name + "|" + Math.round(p.lat * 10000) + "|" + Math.round(p.lon * 10000);
    if (seen[key]) return false;
    seen[key] = true; return true;
  });
}

function fetchNearbyPois(loc, cb) {
  var around = "(around:5000," + loc.lat + "," + loc.lon + ")";
  var query = '[out:json][timeout:20];(' +
    'nwr' + around + '[amenity~"^(restaurant|cafe|fast_food)$"][name];' +
    'nwr' + around + '[tourism~"^(attraction|museum|gallery|viewpoint|zoo|theme_park)$"][name];' +
    'nwr' + around + '[leisure="park"][name];);out center tags 100;';
  fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query)).then(function (resp) {
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return resp.json();
  }).then(function (data) {
    var dining = [], attractions = [];
    (data.elements || []).forEach(function (el) {
      var kind = el.tags && el.tags.amenity ? "dining" : "attractions";
      var poi = osmElementToPoi(el, kind, loc);
      if (poi.lat == null || poi.lon == null) return;
      (kind === "dining" ? dining : attractions).push(poi);
    });
    dining = uniqueNearby(dining).sort(function (a, b) { return a.distanceM - b.distanceM; }).slice(0, 20);
    attractions = uniqueNearby(attractions).sort(function (a, b) { return a.distanceM - b.distanceM; }).slice(0, 20);
    NEARBY_CACHE = { dining: dining, attractions: attractions };
    cb(null, NEARBY_CACHE);
  }).catch(function (err) { cb(err); });
}

function renderNearby(box) {
  /* 附近数据源(OSM)没有评分,只有距离是可信信号,固定按距离排。 */
  EXPLORE_STATE.sort = "distance";
  box.innerHTML = '<div class="empty-inline">正在获取真实位置…</div>';
  requestGeo(function (loc) {
    if (!loc) { box.innerHTML = '<div class="empty-state">未获取到定位。请到「我的」设置现在所在地。</div>'; return; }
    box.innerHTML = '<div class="empty-inline">正在查询 5 公里内的餐馆和景点…</div>';
    fetchNearbyPois(loc, function (err, near) {
      if (err) { box.innerHTML = '<div class="empty-state">附近数据查询失败，请检查网络后重试。<br><button class="btn-secondary" onclick="renderExploreContent()">重新查询</button></div>'; return; }
      var isReal = loc.accuracyM != null;
      var posLine = isReal
        ? "📍 设备实测定位，精度约 ±" + loc.accuracyM + " 米"
        : "📍 未取得实测定位，使用「我的」里手填的" + (loc.name || "所在地");
      var html = '<div class="nearby-privacy">' + posLine +
        '；查询 5 公里范围，坐标仅用于本次查询，不保存、不上传同步。</div>';
      /* 中国大陆的 OSM 收录稀疏,先讲清楚,不让用户误以为"附近真的没店"。 */
      if (inMainlandChina(loc.lat, loc.lon)) {
        html += '<div class="nearby-privacy warn">⚠️ 当前位置在中国大陆，附近数据来自 OpenStreetMap，收录不全，仅供参考。地图链接已切换为高德并做过坐标纠偏。</div>';
      }
      if ((getPrefs().cuisine || []).indexOf("trending") !== -1) {
        html += '<div class="nearby-privacy">附近数据源没有热度信息，“网红店”偏好对附近餐馆不生效。</div>';
      }
      html += '<div class="explore-head"><span>我的真实附近</span><span class="sort-note">按距离排序</span></div>' +
        '<div class="poi-group-label">🍽 好吃</div>' + (poiGroupHTML(near.dining, "dining", loc, "nearby", [], "") || '<div class="empty-inline">5 公里内暂无有名称的餐饮数据</div>') +
        '<div class="poi-group-label">🎡 好玩</div>' + (poiGroupHTML(near.attractions, "attractions", loc, "nearby", [], "") || '<div class="empty-inline">5 公里内暂无有名称的景点数据</div>');
      box.innerHTML = html;
    });
  });
}

function renderDestinationPlan(box, tripId) {
  var trip = getTrip(tripId);
  if (!trip) { box.innerHTML = '<div class="empty-state">行程不存在</div>'; return; }
  var recs = APP_DATA.destinationRecs[trip.city] || APP_DATA.destinationRecs[String(trip.city).replace(/市$/, "")];
  if (!recs) { box.innerHTML = '<div class="empty-state">' + trip.city + ' 暂未收录推荐</div>'; return; }
  var hasHotel = trip.lodging && trip.lodging.lat != null;
  var anchor = hasHotel ? { lat: trip.lodging.lat, lon: trip.lodging.lon } : recs.center;
  var wishNames = (trip.wishlist || []).map(function (w) { return w.name; });
  var html = '<div class="plan-banner">📅 ' + trip.city + ' · 提前规划 · 距离基于' + (hasHotel ? "你的酒店" : "城市中心") + '</div>' +
    '<div class="explore-head"><span>吃喝玩</span>' + sortToggleHTML(hasHotel ? "离酒店近" : "离中心近") + '</div>' +
    '<div class="poi-group-label">🍽 好吃</div>' + poiGroupHTML(recs.dining || [], "dining", anchor, trip.id, wishNames, hasHotel ? "距酒店 " : "") +
    '<div class="poi-group-label">🎡 好玩</div>' + poiGroupHTML(recs.attractions || [], "attractions", anchor, trip.id, wishNames, hasHotel ? "距酒店 " : "") +
    '<button class="btn-secondary" style="width:100%;margin-top:14px;" onclick="openTripDetail(\'' + trip.id + '\')">→ 打开' + trip.city + '行程</button>';
  box.innerHTML = html;
}

function previewDestination(city) {
  if (confirm("为「" + city + "」新建一个行程来规划吗?")) openNewTripSheet();
}

var PREF_OPTIONS = {
  budgetTier: [["economy","经济"],["comfort","舒适"],["luxury","豪华"]],
  cabinClass: [["economy","经济舱"],["premium","超经"],["business","商务舱"]],
  lodgingLocation: [["central","市中心"],["near-transit","近地铁"],["quiet","安静"]],
  travelStyle: [["packed","暴走打卡"],["balanced","均衡"],["relaxed","悠闲深度"]],
  lodgingTypes: [["hotel","连锁酒店"],["boutique","精品民宿"],["hostel","青旅"],["resort","度假村"],["apartment","公寓"]],
  cuisine: [["local","本地菜"],["halal","清真"],["vegetarian","素食"],["spicy","嗜辣"],["trending","网红店"]]
};

function prefSelectHTML(key, title, current) {
  return '<div class="profile-row pref-control-row"><span class="profile-key">' + title + '</span>' +
    '<select class="pref-select" onchange="setPrefsField(\'' + key + '\',this.value)">' +
    PREF_OPTIONS[key].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === current ? ' selected' : '') + '>' + o[1] + '</option>'; }).join("") +
    '</select></div>';
}

function prefChecksHTML(key, title, current) {
  current = current || [];
  return '<div class="pref-check-row"><div class="profile-key">' + title + '</div><div class="pref-checks">' +
    PREF_OPTIONS[key].map(function (o) {
      return '<label><input type="checkbox"' + (current.indexOf(o[0]) !== -1 ? ' checked' : '') +
        ' onchange="togglePrefMulti(\'' + key + '\',\'' + o[0] + '\',this.checked)"> ' + o[1] + '</label>';
    }).join("") + '</div></div>';
}

function togglePrefMulti(key, value, checked) {
  var current = (getPrefs()[key] || []).slice();
  if (checked && current.indexOf(value) === -1) current.push(value);
  if (!checked) current = current.filter(function (v) { return v !== value; });
  setPrefsField(key, current);
}
