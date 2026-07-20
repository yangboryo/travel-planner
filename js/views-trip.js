/* 视图层(行程详情页) */

var CURRENT_TRIP_ID = null;

/* 折叠卡生成器 */
function sectionCard(key, icon, title, summaryHTML, bodyHTML) {
  return '<div class="section-card" id="sc-' + key + '">' +
    '<div class="sc-head" onclick="toggleSection(\'' + key + '\')">' +
    '<span class="sc-icon">' + icon + '</span>' +
    '<span class="sc-title">' + title + '</span>' +
    '<span class="sc-summary">' + summaryHTML + '</span>' +
    '<span class="sc-chevron">›</span>' +
    '</div>' +
    '<div class="sc-body"><div class="sc-body-inner">' + bodyHTML + '</div></div>' +
    '</div>';
}

function toggleSection(key) {
  document.getElementById("sc-" + key).classList.toggle("open");
}

/* 详情页渲染 */
function renderTripDetail(trip) {
  var body = document.querySelector("#screen-trip-detail .screen-body");
  var cd = daysUntil(trip.startDate);

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;">' +
    '<button class="back-btn" onclick="closeTripDetail()">‹ 行程</button>' +
    '<button class="btn-sm" onclick="openEditTripSheet(\'' + trip.id + '\')">✎ 编辑</button></div>';

  /* 头图 */
  html += '<div class="detail-hero">' +
    '<div class="detail-city">' + trip.city + " " + trip.flag + '</div>' +
    '<div class="detail-dates">' + fmtDateRange(trip.startDate, trip.endDate) +
    (cd > 0 ? ' · 还有 ' + cd + ' 天' : (daysUntil(trip.endDate) >= 0 ? ' · 进行中' : ' · 已结束')) +
    '</div></div>';

  /* 签证状态条(按"我的"页设置的护照国籍表述) */
  var rule = APP_DATA.visaRules[trip.city];
  var pn = getPassport().nationality;
  var passportName = pn ? pn + "护照" : "你的护照";
  if (rule) {
    if (rule.type === "免签") {
      html += '<div class="visa-banner ok">🛂 ' + passportName + '免签 ' + rule.stayDays + ' 天(示例规则,出行前请核实)</div>';
    } else {
      html += '<div class="visa-banner warn" style="margin-bottom:12px;">⚠️ 该目的地对' + passportName + rule.type +
        ',建议提前 ' + rule.applyAheadDays + ' 天办理</div>';
    }
  } else {
    html += '<div class="visa-banner ok">🛂 签证要求未知,请出行前核实</div>';
  }

  /* 各板块(Task 7–9 逐个实现,先渲染已有的) */
  html += renderSections(trip);

  body.innerHTML = html;
}

/* 各板块拼装:后续任务在此追加 */
function renderSections(trip) {
  var html = '<div class="zone-label">行程安排</div>';
  if (typeof sectionWeather === "function") html += sectionWeather(trip);
  if (typeof sectionTodos === "function") html += sectionTodos(trip);
  if (typeof sectionPacking === "function") html += sectionPacking(trip);
  if (typeof sectionItinerary === "function") html += sectionItinerary(trip);
  if (typeof sectionBudget === "function") html += sectionBudget(trip);
  if (typeof sectionEmergency === "function") html += sectionEmergency(trip);
  if (typeof sectionTips === "function") html += sectionTips(trip);
  var pf = typeof getPrefs === "function" ? getPrefs() : {};
  var prefSummary = [
    { economy: "经济舱", premium: "超经", business: "商务舱" }[pf.cabinClass],
    pf.lodgingTypes && pf.lodgingTypes.length ? "精选住宿" : null,
    pf.cuisine && pf.cuisine.length ? "口味优先" : null
  ].filter(Boolean).join(" · ");
  html += '<div class="zone-label">为你推荐<span class="zone-sub">' + (prefSummary ? " · " + prefSummary : "") + '</span></div>';
  if (typeof sectionTransport === "function") html += sectionTransport(trip);
  if (typeof sectionLodging === "function") html += sectionLodging(trip);
  if (typeof sectionRecDining === "function") html += sectionRecDining(trip);
  if (typeof sectionRecAttractions === "function") html += sectionRecAttractions(trip);
  return html;
}

/* ---------- 板块:天气 ---------- */

function weatherStripHTML(days) {
  return days.map(function (w) {
    var d = new Date(w.date);
    return '<div class="weather-day">' +
      '<div class="wd-date">' + (d.getMonth() + 1) + "/" + d.getDate() + '</div>' +
      '<div class="wd-icon">' + w.icon + '</div>' +
      '<div class="wd-temp">' + w.high + "°</div>" +
      '<div class="wd-low">' + w.low + "°</div>" +
      '<div class="wd-desc">' + w.desc + '</div>' +
      '</div>';
  }).join("");
}

function sectionWeather(trip) {
  var summary = "加载中…";
  var stripHTML, noteHTML = "";
  if (trip.weather && trip.weather.length) {
    var first = trip.weather[0];
    summary = first.high + "° / " + first.low + "° · " + first.desc;
    stripHTML = weatherStripHTML(trip.weather);
    noteHTML = '<div class="fx-note" id="tw-note">示例数据,联网后自动更新</div>';
  } else {
    summary = "—";
    stripHTML = "";
    noteHTML = '<div class="empty-inline" id="tw-note">出行日期进入 16 天内后自动显示逐日预报</div>';
  }

  var body = '<div class="tw-now" id="tw-now">📍 ' + trip.city + ' 现在:获取中…</div>' +
    '<div class="weather-strip" id="tw-strip">' + stripHTML + '</div>' + noteHTML;

  /* 异步:目的地当前天气 + 出行日期真实预报 */
  setTimeout(function () {
    fetchCurrentWeather(trip.loc, function (w) {
      var el = document.getElementById("tw-now");
      if (!el) return;
      el.innerHTML = w
        ? "📍 " + trip.city + " 现在:" + wmoInfo(w.code).icon + " " + w.temp + "°C · " + wmoInfo(w.code).desc
        : "📍 " + trip.city + " 现在:离线,暂无数据";
    });
    fetchForecast(trip.loc, trip.startDate, trip.endDate, function (days) {
      if (!days || !days.length) return;
      var strip = document.getElementById("tw-strip");
      var note = document.getElementById("tw-note");
      var head = document.querySelector("#sc-weather .sc-summary");
      if (strip) strip.innerHTML = weatherStripHTML(days);
      if (note) note.outerHTML = '<div class="fx-note">出行期实时预报 · Open-Meteo</div>';
      if (head) head.textContent = days[0].high + "° / " + days[0].low + "° · " + days[0].desc;
    });
  }, 0);

  return sectionCard("weather", "🌤", "天气预报", summary, body);
}

/* ---------- 板块:待办时间线 ---------- */

function todoDate(trip, offsetDays) {
  var d = new Date(trip.startDate);
  d.setDate(d.getDate() - offsetDays);
  return d;
}

function ensureVisaTodo(trip) {
  var rule = APP_DATA.visaRules[trip.city];
  if (rule && rule.type !== "免签") {
    var has = trip.todos.some(function (t) { return t.text.indexOf("签证") !== -1; });
    if (!has) {
      trip.todos.push({ offsetDays: rule.applyAheadDays, text: "办理签证", done: false });
      saveState();
    }
  }
}

function sectionTodos(trip) {
  ensureVisaTodo(trip);
  var sorted = trip.todos.slice().sort(function (a, b) { return b.offsetDays - a.offsetDays; });
  var doneCount = trip.todos.filter(function (t) { return t.done; }).length;
  var today = new Date(); today.setHours(0, 0, 0, 0);

  /* 逾期数:未完成且日期已过 */
  var overdueCount = trip.todos.filter(function (td) {
    return !td.done && todoDate(trip, td.offsetDays) < today;
  }).length;

  var body = '<div class="todo-line">' + sorted.map(function (td) {
    var idx = trip.todos.indexOf(td);
    var d = todoDate(trip, td.offsetDays);
    var overdue = !td.done && d < today;
    return '<div class="todo-item' + (td.done ? " done" : "") + (overdue ? " overdue" : "") + '">' +
      '<span class="todo-check" onclick="toggleTodo(\'' + trip.id + '\',' + idx + ')">' + (td.done ? "☑" : "☐") + '</span>' +
      '<span class="todo-date">' + (d.getMonth() + 1) + "/" + d.getDate() + '</span>' +
      '<span class="todo-text">' + td.text + (overdue ? ' <em>已逾期</em>' : "") + '</span>' +
      '</div>';
  }).join("") + "</div>";

  var summary = doneCount + "/" + trip.todos.length +
    (overdueCount ? ' <span class="overdue-tag">⚠ ' + overdueCount + ' 项逾期</span>' : "");
  if (overdueCount) {
    body = '<div class="overdue-banner">⚠️ 有 ' + overdueCount + ' 项待办已过期未完成,请尽快处理</div>' + body;
  }
  return sectionCard("todos", "✅", "待办时间线", summary, body);
}

function toggleTodo(tripId, idx) {
  var trip = getTrip(tripId);
  trip.todos[idx].done = !trip.todos[idx].done;
  saveState();
  refreshTripDetail();
}

/* ---------- 板块:智能打包清单 ---------- */

function generatePacking(trip) {
  var items = ["护照", "充电器"];
  /* 插座:不通用才生成转换头;未设置常住地时保守生成 */
  var pc = plugCheck(trip.city);
  if (!pc) {
    items.push("转换插头");
  } else if (!pc.compatible) {
    items.push("电源转换头(" + pc.dest.type + " 型)");
  }
  var days = Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000) + 1;
  var maxHigh = 0, minLow = 99, hasRain = false;
  (trip.weather || []).forEach(function (w) {
    if (w.high > maxHigh) maxHigh = w.high;
    if (w.low < minLow) minLow = w.low;
    if (w.desc.indexOf("雨") !== -1) hasRain = true;
  });
  if (maxHigh >= 28) items.push("防晒霜", "太阳镜", "短袖衣物");
  if (minLow <= 10) items.push("厚外套");
  if (hasRain) items.push("雨伞");
  if (days > 4) items.push("洗衣袋");
  return items.map(function (t) { return { text: t, checked: false, auto: true }; });
}

function sectionPacking(trip) {
  /* 初次打开:无 auto 项则生成 */
  if (!trip.packing.some(function (p) { return p.auto; })) {
    trip.packing = generatePacking(trip).concat(trip.packing);
    saveState();
  }
  var done = trip.packing.filter(function (p) { return p.checked; }).length;

  var body = trip.packing.map(function (p, i) {
    return '<div class="pack-item' + (p.checked ? " done" : "") + '">' +
      '<span class="todo-check" onclick="togglePack(\'' + trip.id + '\',' + i + ')">' + (p.checked ? "☑" : "☐") + '</span>' +
      '<span class="todo-text">' + p.text + '</span>' +
      (p.auto ? '<span class="auto-tag">智能</span>' : "") +
      '<span class="pack-del" onclick="removePack(\'' + trip.id + '\',' + i + ')">✕</span>' +
      '</div>';
  }).join("");
  body += '<div class="pack-add"><input id="pack-new-' + trip.id + '" class="field-input" placeholder="添加物品…">' +
    '<button class="btn-primary pack-add-btn" onclick="addPack(\'' + trip.id + '\')">添加</button></div>';

  return sectionCard("packing", "🧳", "智能打包清单", done + "/" + trip.packing.length, body);
}

function togglePack(tripId, idx) {
  var trip = getTrip(tripId);
  trip.packing[idx].checked = !trip.packing[idx].checked;
  saveState();
  refreshTripDetail();
}

function removePack(tripId, idx) {
  var trip = getTrip(tripId);
  trip.packing.splice(idx, 1);
  saveState();
  refreshTripDetail();
}

function addPack(tripId) {
  var input = document.getElementById("pack-new-" + tripId);
  var text = input.value.trim();
  if (!text) return;
  getTrip(tripId).packing.push({ text: text, checked: false, auto: false });
  saveState();
  refreshTripDetail();
}

/* ---------- 板块:交通 ---------- */

function sectionTransport(trip) {
  var tr = trip.transport || (trip.transport = { flights: [], userFlights: [] });
  if (!tr.userFlights) tr.userFlights = []; /* 兼容旧存档 */
  var todayStr = toDateStr(new Date());

  /* 我的航班:手动录入 */
  var body = '<div class="field-label" style="margin-top:0;">我的航班</div>';
  if (tr.userFlights.length) {
    body += tr.userFlights.map(function (f, i) {
      var isToday = f.date === todayStr;
      return '<div class="flight-status' + (isToday ? " live" : "") + '">' +
        '<div class="fs-row"><span class="fs-no">✈️ ' + f.flightNo + '</span>' +
        '<span>' + (isToday ? '<span class="badge">今天出发</span> ' : "") +
        '<span class="pack-del" onclick="removeFlight(\'' + trip.id + '\',' + i + ')">✕</span></span></div>' +
        '<div class="fs-gate">' + f.date + (f.note ? " · " + f.note : "") + '</div>' +
        '</div>';
    }).join("");
  } else {
    body += '<div class="empty-inline">订好机票后把航班号记在这里</div>';
  }
  body += '<button class="btn-primary pack-add-btn" style="margin:8px 0 4px;" onclick="addFlight(\'' + trip.id + '\')">+ 添加航班</button>';

  body += '<div class="field-label">购票入口</div>';
  body += tr.flights.map(function (f) {
    return '<a class="flight-link" href="' + f.url + '" target="_blank" rel="noopener">' +
      '<span class="fl-platform">' + f.platform + '</span>' +
      '<span class="fl-note">' + f.note + '</span>' +
      '<span style="color:var(--text-faint)">›</span></a>';
  }).join("");

  var summary = tr.userFlights.length ? tr.userFlights.length + " 个航班" : "未添加航班";
  return sectionCard("transport", "🚄", "交通", summary, body);
}

function addFlight(tripId) {
  var no = prompt("航班号(如 CX138)");
  if (no === null || !no.trim()) return;
  var date = prompt("出发日期(格式 2026-08-12)", getTrip(tripId).startDate);
  if (date === null || !date.trim()) return;
  var note = prompt("备注(可选,如 出发地 → 目的地)") || "";
  getTrip(tripId).transport.userFlights.push({ flightNo: no.trim().toUpperCase(), date: date.trim(), note: note.trim() });
  saveState();
  refreshTripDetail();
}

function removeFlight(tripId, idx) {
  getTrip(tripId).transport.userFlights.splice(idx, 1);
  saveState();
  refreshTripDetail();
}

/* ---------- 板块:住宿 ---------- */

function sectionLodging(trip) {
  var l = trip.lodging || {};
  var fields = [
    { key: "name", label: "酒店" }, { key: "address", label: "地址" },
    { key: "checkIn", label: "入住" }, { key: "checkOut", label: "退房" },
    { key: "confirmNo", label: "确认号" }
  ];
  var body = fields.map(function (f) {
    return '<div class="profile-row lodging-row" onclick="editLodging(\'' + trip.id + '\',\'' + f.key + '\',\'' + f.label + '\')">' +
      '<span class="profile-key">' + f.label + '</span>' +
      '<span class="lodging-val">' + (l[f.key] || '<span style="color:var(--text-faint)">点击填写</span>') + '</span></div>';
  }).join("");
  return sectionCard("lodging", "🏨", "住宿", l.name || "未填写", body);
}

function editLodging(tripId, key, label) {
  var trip = getTrip(tripId);
  var cur = trip.lodging[key] || "";
  var val = prompt("编辑" + label, cur);
  if (val === null) return;
  trip.lodging[key] = val.trim();
  saveState();
  refreshTripDetail();
}

/* ---------- 板块:每日日程 ---------- */

function sectionItinerary(trip) {
  if (!trip.itinerary || !trip.itinerary.length) {
    return sectionCard("itinerary", "🗓", "每日日程", "未安排", '<div class="empty-inline">还没有日程安排</div>');
  }
  var body = trip.itinerary.map(function (dayPlan) {
    return '<div class="iti-day"><div class="iti-day-label">Day ' + dayPlan.day + '</div>' +
      dayPlan.items.map(function (it) {
        return '<div class="iti-item"><span class="iti-time">' + it.time + '</span>' +
          '<span class="iti-act">' + it.activity + '</span></div>';
      }).join("") + '</div>';
  }).join("");
  var total = trip.itinerary.reduce(function (n, d) { return n + d.items.length; }, 0);
  return sectionCard("itinerary", "🗓", "每日日程", "Day 1–" + trip.itinerary.length + " · " + total + " 项", body);
}

/* ---------- 板块:想去清单 ---------- */

function sectionWishlist(trip) {
  if (!trip.wishlist || !trip.wishlist.length) {
    return sectionCard("wishlist", "📍", "想去清单", "空", '<div class="empty-inline">把种草的景点、餐厅记在这里</div>');
  }
  var body = trip.wishlist.map(function (w, i) {
    return '<div class="wish-item">' +
      '<span class="wish-type">' + w.type + '</span>' +
      '<span class="todo-text">' + w.name + '</span>' +
      '<span class="wish-sched' + (w.scheduled ? " on" : "") + '" onclick="toggleWish(\'' + trip.id + '\',' + i + ')">' +
      (w.scheduled ? "已排入日程" : "排入日程") + '</span></div>';
  }).join("");
  var sched = trip.wishlist.filter(function (w) { return w.scheduled; }).length;
  return sectionCard("wishlist", "📍", "想去清单", sched + "/" + trip.wishlist.length + " 已排入", body);
}

function toggleWish(tripId, idx) {
  var trip = getTrip(tripId);
  trip.wishlist[idx].scheduled = !trip.wishlist[idx].scheduled;
  saveState();
  refreshTripDetail();
}

/* ---------- 板块:预算(双币) ---------- */

function toAUD(amountLocal, currency) {
  var rates = APP_DATA.fxRates;
  return Math.round(amountLocal / rates[currency]);
}

function sectionBudget(trip) {
  if (!trip.budget || !trip.budget.length) {
    return sectionCard("budget", "💰", "预算", "未设置", '<div class="empty-inline">还没有预算项</div>');
  }
  var totalLocal = 0;
  var body = trip.budget.map(function (b) {
    totalLocal += b.amountLocal;
    return '<div class="budget-row"><span>' + b.category + '</span>' +
      '<span class="budget-amt">' + b.amountLocal.toLocaleString() + " " + trip.currency +
      ' <em>≈ ' + toAUD(b.amountLocal, trip.currency).toLocaleString() + ' AUD</em></span></div>';
  }).join("");
  var totalAUD = toAUD(totalLocal, trip.currency);
  body += '<div class="budget-row total"><span>合计</span>' +
    '<span class="budget-amt">' + totalLocal.toLocaleString() + " " + trip.currency +
    ' <em>≈ ' + totalAUD.toLocaleString() + ' AUD</em></span></div>';
  return sectionCard("budget", "💰", "预算", "≈ " + totalAUD.toLocaleString() + " AUD", body);
}

/* ---------- 板块:紧急信息卡 ---------- */

function sectionEmergency(trip) {
  var e = trip.emergency || {};
  var rows = [
    { label: "当地报警", val: e.police }, { label: "当地急救", val: e.ambulance },
    { label: "本国领事紧急热线", val: e.consular }, { label: "旅游保险单号", val: e.insuranceNo },
    { label: "酒店地址", val: (trip.lodging && trip.lodging.address) || "" }
  ];
  var body = rows.map(function (r) {
    return '<div class="profile-row"><span class="profile-key">' + r.label + '</span>' +
      '<span class="emg-val">' + (r.val || "—") + '</span></div>';
  }).join("") + '<div class="fx-note">本卡数据存于本地,离线可查</div>';
  return sectionCard("emergency", "🆘", "紧急信息卡", "离线可查", body);
}

/* ---------- 板块:目的地小贴士 ---------- */

function sectionTips(trip) {
  var tp = trip.tips || {};

  /* 插座:有常住地设置时显示对比结论 */
  var plugVal = tp.plug || "—";
  var pc = plugCheck(trip.city);
  if (pc) {
    plugVal = trip.city + " " + pc.dest.type + " 型(" + pc.dest.desc + ")· " +
      pc.homeName + " " + pc.home.type + " 型(" + pc.home.desc + ")<br>" +
      (pc.compatible
        ? '<strong style="color:#3D8B5F">✓ 与家里通用,无需转换头</strong>'
        : '<strong style="color:var(--warn-text)">✗ 不通用,需购买 ' + pc.dest.type + ' 型转换头</strong>');
  }

  var rows = [
    { icon: "🕐", label: "时差", val: tp.timezone }, { icon: "🔌", label: "插座", val: plugVal },
    { icon: "💵", label: "小费", val: tp.tipping }, { icon: "🚇", label: "交通卡", val: tp.transitCard }
  ];
  var body = rows.map(function (r) {
    return '<div class="tip-row"><span class="tip-icon">' + r.icon + '</span>' +
      '<div><div class="tip-label">' + r.label + '</div>' +
      '<div class="tip-val">' + (r.val || "—") + '</div></div></div>';
  }).join("");
  return sectionCard("tips", "🔌", "目的地小贴士", "", body);
}

/* ---------- 板块:当地景点 & 美食推荐 ---------- */

function sectionLocalRecs(trip) {
  var cityName = String(trip.city || "").replace(/市$/, "");
  var recs = APP_DATA.localRecommendations[trip.city] || APP_DATA.localRecommendations[cityName];
  if (!recs && !trip.city) return "";

  /* 未收录城市也提供可加入清单的探索方向，避免整块内容空白。 */
  if (!recs) {
    recs = {
      spots: [
        { name: trip.city + "必去地标", type: "📍", desc: "出发前按评分与开放时间筛选当地代表性地标" },
        { name: trip.city + "博物馆与历史街区", type: "🏛", desc: "适合了解城市历史，也可作为雨天行程" },
        { name: trip.city + "自然风景与观景点", type: "🌿", desc: "优先选择交通便利、近期评价稳定的地点" }
      ],
      food: [
        { name: trip.city + "本地特色菜", type: "🍲", desc: "搜索当地代表菜，再按距离与近期评价选店" },
        { name: trip.city + "传统早餐", type: "🥣", desc: "从菜市场、老街或本地早餐店开始探索" },
        { name: trip.city + "夜市与小吃", type: "🍢", desc: "留意营业日期、卫生情况与返程交通" }
      ]
    };
  }

  /* 检查已加入想去清单的项目 */
  var wishNames = (trip.wishlist || []).map(function (w) { return w.name; });

  var body = "";

  if (recs.spots && recs.spots.length) {
    body += '<div class="rec-label">🏞 景点</div>';
    body += recs.spots.map(function (s) {
      var added = wishNames.indexOf(s.name) !== -1;
      return '<div class="rec-item' + (added ? " added" : "") + '">' +
        '<span class="rec-type">' + s.type + '</span>' +
        '<div class="rec-info"><div class="rec-name">' + s.name + '</div>' +
        '<div class="rec-desc">' + s.desc + '</div></div>' +
        '<span class="rec-add' + (added ? " done" : "") + '" onclick="addRecToWish(\'' + trip.id + '\',\'' +
        s.name.replace(/'/g, "\\'") + '\',\'' + s.type + '\')">' +
        (added ? '已添加' : '+ 想去') + '</span>' +
        '</div>';
    }).join("");
  }

  if (recs.food && recs.food.length) {
    body += '<div class="rec-label" style="margin-top:8px;">🍜 美食</div>';
    body += recs.food.map(function (f) {
      var added = wishNames.indexOf(f.name) !== -1;
      return '<div class="rec-item' + (added ? " added" : "") + '">' +
        '<span class="rec-type">' + f.type + '</span>' +
        '<div class="rec-info"><div class="rec-name">' + f.name + '</div>' +
        '<div class="rec-desc">' + f.desc + '</div></div>' +
        '<span class="rec-add' + (added ? " done" : "") + '" onclick="addRecToWish(\'' + trip.id + '\',\'' +
        f.name.replace(/'/g, "\\'") + '\',\'' + f.type + '\')">' +
        (added ? '已添加' : '+ 想去') + '</span>' +
        '</div>';
    }).join("");
  }

  var totalSpots = (recs.spots || []).length + (recs.food || []).length;
  var addedCount = (recs.spots || []).concat(recs.food || []).filter(function (r) {
    return wishNames.indexOf(r.name) !== -1;
  }).length;

  return sectionCard("localrecs", "🏙", "当地推荐 · " + trip.city,
    addedCount ? addedCount + "/" + totalSpots + " 已收藏" : totalSpots + " 个推荐", body);
}

/* 将推荐项加入想去清单 */
function addRecToWish(tripId, name, type) {
  var trip = getTrip(tripId);
  if (!trip) return;
  if (!trip.wishlist) trip.wishlist = [];
  var found = trip.wishlist.find(function (w) { return w.name === name; });
  if (found) {
    /* 已存在,移除 */
    trip.wishlist = trip.wishlist.filter(function (w) { return w.name !== name; });
  } else {
    trip.wishlist.push({ name: name, type: type, scheduled: false });
  }
  saveState();
  refreshTripDetail();
}

function refreshTripDetail() {
  var trip = getTrip(CURRENT_TRIP_ID);
  if (trip) {
    /* 记住已展开的板块,重渲染后恢复 */
    var openKeys = Array.from(document.querySelectorAll(".section-card.open"))
      .map(function (el) { return el.id; });
    renderTripDetail(trip);
    openKeys.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add("open");
    });
  }
}
