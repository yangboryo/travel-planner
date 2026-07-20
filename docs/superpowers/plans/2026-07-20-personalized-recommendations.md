# 个性化推荐重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给现有 v12 出行助理加个性化推荐:喜好档案 + 实时定位 + 精选推荐数据 + 共享推荐引擎/组件,落到"推荐"tab、行程详情两分区和 POI 详情页。

**Architecture:** 三层——数据层(`data.js` 存 `prefs` 默认值与 `destinationRecs`)、个性化引擎+渲染层(新 `js/recommend.js`,纯函数可单测 + 浏览器渲染函数)、视图层(`views-main.js`/`views-trip.js` 调用共享组件)。纯逻辑走 TDD(Node `assert`+`require`),UI 走"实现 + 浏览器/真机验证"。

**Tech Stack:** 纯 vanilla JS(ES5 风格,`var` + 函数)、无框架、无构建;测试用 Node 内置 `assert`,`node test/xxx.test.js` 运行;PWA(Service Worker 全量预缓存);浏览器 Geolocation API。

---

## 工程约定(动手前必读)

- **模块双用**:每个 `js/*.js` 在浏览器里是全局函数,在 Node 里靠文件尾部 `if (typeof module !== "undefined" && module.exports) module.exports = {...}` 暴露纯函数供测试。新文件 `recommend.js` 照此办理。
- **测试运行**:`node test/recommend.test.js`,无输出且退出码 0 即通过;`assert` 抛错即失败。没有测试框架、没有 `package.json`。
- **代码风格**:跟现有代码一致——`var`、`function`、字符串拼接 HTML、两空格缩进、中文注释。不要引入 `const/let/箭头函数/模板字符串`以外的新风格(现有文件是 ES5 风,保持一致)。
- **CSS**:尽量复用 `css/base.css`、`css/screens.css` 已有的类(`section-card`/`rec-item`/`rec-type`/`rec-info`/`rec-name`/`rec-desc`/`rec-add`/`profile-row`/`field-input`/`btn-primary`/`badge`/`wish-item` 等)。新样式追加到 `css/screens.css` 末尾。
- **提交**:每个 Task 末尾提交一次,message 用 `feat:`/`test:`/`refactor:` 前缀。
- **分支**:动手前先建分支(`git checkout -b feat/personalized-recommendations`),不要直接在 `main` 上做。

## 文件结构总览

| 文件 | 职责 | 本计划改动 |
|---|---|---|
| `js/recommend.js` | **新增**。纯函数:haversine、prefs 归一化、舱位排序、住宿/POI 排序打分;浏览器渲染:推荐卡、POI 详情、交通/住宿卡 | 全新 |
| `js/data.js` | mock 数据 | 加 `prefsDefault`、`destinationRecs`(迁移现有推荐) |
| `js/app.js` | store/导航/定位 | prefs 读写 + 迁移;`geoLoc` 获取;`screen-explore` 导航 |
| `js/views-main.js` | 主屏视图 | "我的"喜好卡;`renderExplore()` |
| `js/views-trip.js` | 行程详情视图 | 两分区;交通/住宿卡升级;餐厅/景点接 POI 详情 |
| `js/sync.js` | 同步/合并 | 合并纳入 `prefs` |
| `index.html` | 页面骨架 | 第 4 tab + `screen-explore` + 引入 `recommend.js` |
| `sw.js` | 离线缓存 | 升 `VERSION` v13;缓存加 `recommend.js` |
| `test/recommend.test.js` | **新增** | 引擎单测 |
| `test/sync.test.js` | 现有 | 补 `prefs` 合并测试 |

## 关键类型契约(各 Task 必须一致)

```
prefs = { budgetTier, cabinClass, lodgingTypes[], lodgingLocation, cuisine[], travelStyle }

destinationRecs[city] = {
  center: {lat, lon},
  transport: { intercity: [ {mode,label,durationH, cabins:[{class,priceLocal,note}], tip} ],
               local: [ {mode,name,priceRange,tier,tip} ] },
  lodging:  [ {name,type,area,pricePerNight,tier,location,lat,lon,tags[],desc} ],
  dining:   [ {name,cuisineTags[],priceLevel,rating,michelin,area,lat,lon,image,address,phone,website,hours,desc} ],
  attractions:[ {name,category,durationH,rating,lat,lon,image,address,phone,website,hours,desc,tips,bestFor[]} ]
}

引擎函数(recommend.js 导出):
  haversineM(lat1,lon1,lat2,lon2) -> 整数米
  normalizePrefs(prefs) -> 补全字段的 prefs
  orderCabins(cabins, cabinClass) -> [{...cabin, preferred:bool}] 偏好舱位置顶
  rankLodging(lodgingArr, prefs) -> [{...item, matched:bool, why:string}]
  poiWhy(poi, prefs, kind) -> string
  rankPois(pois, opts) opts={sort:"distance"|"rating", anchor:{lat,lon}|null, prefs, kind:"dining"|"attractions"}
      -> [{...poi, distanceM:(int|null), why:string}]

渲染函数(recommend.js,仅浏览器):
  renderRecTransport(rec, prefs, ctx)      ctx={originName}
  renderRecLodging(recArr, booked, prefs)  booked=trip.lodging 或 null
  renderPoiCard(poi, ctx)                  ctx={tripId, kind, wishNames[]}
  renderPoiDetail(poi, ctx)
```

---

# 阶段一:喜好档案地基

### Task 1: prefs 归一化纯函数(TDD)

**Files:**
- Create: `js/recommend.js`
- Test: `test/recommend.test.js`

- [ ] **Step 1: 写失败测试**

`test/recommend.test.js`:

```js
var assert = require("assert");
var rec = require("../js/recommend.js");

/* normalizePrefs: 缺失字段补默认值,已有字段保留 */
var d = rec.normalizePrefs(undefined);
assert.strictEqual(d.budgetTier, "comfort");
assert.strictEqual(d.cabinClass, "economy");
assert.deepStrictEqual(d.lodgingTypes, ["hotel"]);
assert.strictEqual(d.lodgingLocation, "central");
assert.deepStrictEqual(d.cuisine, []);
assert.strictEqual(d.travelStyle, "balanced");

var keep = rec.normalizePrefs({ cabinClass: "business", cuisine: ["local"] });
assert.strictEqual(keep.cabinClass, "business");
assert.deepStrictEqual(keep.cuisine, ["local"]);
assert.strictEqual(keep.budgetTier, "comfort"); /* 未给的仍补默认 */

console.log("Task1 OK");
```

- [ ] **Step 2: 运行,确认失败**

Run: `node test/recommend.test.js`
Expected: FAIL — `Cannot find module '../js/recommend.js'`

- [ ] **Step 3: 写最小实现**

`js/recommend.js`:

```js
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
```

- [ ] **Step 4: 运行,确认通过**

Run: `node test/recommend.test.js`
Expected: 输出 `Task1 OK`,退出码 0

- [ ] **Step 5: 提交**

```bash
git add js/recommend.js test/recommend.test.js
git commit -m "feat: add prefs normalizer with tests"
```

---

### Task 2: prefs 默认值与迁移接入 store

**Files:**
- Modify: `js/data.js`(在 `const APP_DATA = {` 内 `passport:` 之后加一行)
- Modify: `js/app.js:19-25`(兼容旧存档区块)

- [ ] **Step 1: data.js 加默认值**

在 `js/data.js` 的 `passport: { nationality: "", expiry: "" },` 之后插入:

```js
  /* 出行喜好默认值(个性化推荐用),在"我的"页可改 */
  prefsDefault: {
    budgetTier: "comfort", cabinClass: "economy",
    lodgingTypes: ["hotel"], lodgingLocation: "central",
    cuisine: [], travelStyle: "balanced"
  },
```

- [ ] **Step 2: app.js 迁移**

在 `js/app.js` 现有兼容区块(`if (!STATE.passport)…` 一段)里,紧接 `if (!Array.isArray(STATE.deletedTripIds)) STATE.deletedTripIds = [];` 之后插入:

```js
/* 兼容旧存档:补 prefs(用 recommend.js 的归一化,保证字段齐全) */
STATE.prefs = (typeof normalizePrefs === "function")
  ? normalizePrefs(STATE.prefs)
  : (STATE.prefs || JSON.parse(JSON.stringify(APP_DATA.prefsDefault)));
```

- [ ] **Step 3: app.js 加 getter/setter**

在 `js/app.js` 的 `function getPassport()` 附近加:

```js
function getPrefs() { return STATE.prefs; }

function setPrefsField(key, value) {
  STATE.prefs[key] = value;
  saveState();
}
```

- [ ] **Step 4: 手动验证**

在浏览器打开 `index.html`,控制台执行:
```js
JSON.stringify(getPrefs())
```
Expected: 打印含全部 6 个字段的对象。再执行 `setPrefsField("cabinClass","business"); getPrefs().cabinClass` → `"business"`,刷新后仍是 `"business"`(已存 localStorage)。

- [ ] **Step 5: 提交**

```bash
git add js/data.js js/app.js
git commit -m "feat: add prefs to store with legacy migration"
```

---

### Task 3: prefs 纳入云同步合并(TDD)

**Files:**
- Modify: `js/sync.js:133-138`(`mergeCloudData` 返回对象)
- Modify: `js/sync.js`(PULL 应用 remote、applyMergedData 两处)
- Modify: `js/sync.js`(上传封包处,serialize STATE 的地方)
- Test: `test/sync.test.js`(追加)

- [ ] **Step 1: 追加失败测试**

在 `test/sync.test.js` 末尾追加:

```js
/* prefs 参与合并:较新一侧整体胜出,字段不丢 */
var mergedPrefs = sync.mergeCloudData(
  { updatedAt: "2026-07-20T10:00:00Z", passport: {}, deletedTripIds: [], trips: [],
    prefs: { cabinClass: "economy", cuisine: ["local"] } },
  { updatedAt: "2026-07-20T11:00:00Z", passport: {}, deletedTripIds: [], trips: [],
    prefs: { cabinClass: "business" } }
);
assert.strictEqual(mergedPrefs.prefs.cabinClass, "business", "较新侧舱位胜出");
assert.deepStrictEqual(mergedPrefs.prefs.cuisine, ["local"], "另一侧独有字段保留");
```

- [ ] **Step 2: 运行,确认失败**

Run: `node test/sync.test.js`
Expected: FAIL — `mergedPrefs.prefs` 为 `undefined`(TypeError 读取 cabinClass)。

- [ ] **Step 3: 实现——mergeCloudData 加 prefs**

`js/sync.js:133-138` 返回对象加一行(与 passport 同款):

```js
  return {
    trips: trips,
    passport: mergeSyncValue(local.passport || {}, remote.passport || {}, preferRemote),
    prefs: mergeSyncValue(local.prefs || {}, remote.prefs || {}, preferRemote),
    deletedTripIds: deleted,
    updatedAt: new Date().toISOString()
  };
```

- [ ] **Step 4: 实现——应用合并/拉取结果**

在 `js/sync.js` 中,凡是 `STATE.passport = merged.passport;`(applyMergedData)与 `STATE.passport = remote.passport;`(PULL 分支)之后,各补一行:

```js
STATE.prefs = normalizePrefs(merged.prefs); /* applyMergedData 处 */
```
```js
STATE.prefs = normalizePrefs(remote.prefs); /* PULL 处 */
```

并在上传封包(serialize STATE 上传云端的对象,与 `buildBackup`/云 payload 同处)中,凡包含 `passport: STATE.passport` 的对象补 `prefs: STATE.prefs`。用 `grep -n "passport: STATE.passport\|passport: STATE\b" js/sync.js js/app.js` 定位所有点并逐一补 `prefs`。

- [ ] **Step 5: 运行两个测试,确认通过**

Run: `node test/sync.test.js && node test/recommend.test.js`
Expected: 均无报错退出。

- [ ] **Step 6: 提交**

```bash
git add js/sync.js test/sync.test.js
git commit -m "feat: sync and merge prefs across devices"
```

---

### Task 4: "我的"页「出行喜好」卡片

**Files:**
- Modify: `js/views-main.js`(`renderProfile` 内,`护照档案` 卡之后插入)
- Modify: `css/screens.css`(如需,追加 chip 选择样式)

- [ ] **Step 1: 加喜好卡渲染**

在 `js/views-main.js` 的 `renderProfile` 里,`护照档案` 那张 `card` 结束(`expiryHTML + '</div>';`)之后、`汇率换算器` 之前,插入:

```js
  var pf = getPrefs();
  var prefLabels = {
    budgetTier: { title: "预算档次", map: { economy: "经济", comfort: "舒适", luxury: "豪华" } },
    cabinClass: { title: "舱位偏好", map: { economy: "经济舱", premium: "超经", business: "商务舱" } },
    lodgingLocation: { title: "住宿位置", map: { central: "市中心", "near-transit": "近地铁", quiet: "安静" } },
    travelStyle: { title: "出行风格", map: { packed: "暴走打卡", balanced: "均衡", relaxed: "悠闲深度" } }
  };
  var lodgeTypeMap = { hotel: "连锁酒店", boutique: "精品民宿", hostel: "青旅", resort: "度假村", apartment: "公寓" };
  var cuisineMap = { local: "本地菜", halal: "清真", vegetarian: "素食", spicy: "嗜辣", trending: "网红店" };

  html += '<div class="section-label">出行喜好(个性化推荐依据)</div><div class="card">';
  ["budgetTier", "cabinClass", "lodgingLocation", "travelStyle"].forEach(function (k) {
    var conf = prefLabels[k];
    html += '<div class="profile-row lodging-row" onclick="editPrefSingle(\'' + k + '\')">' +
      '<span class="profile-key">' + conf.title + '</span><span>' +
      (conf.map[pf[k]] || pf[k]) + '</span></div>';
  });
  html += '<div class="profile-row lodging-row" onclick="editPrefMulti(\'lodgingTypes\')">' +
    '<span class="profile-key">住宿类型</span><span>' +
    (pf.lodgingTypes.map(function (t) { return lodgeTypeMap[t] || t; }).join("、") || "不限") + '</span></div>';
  html += '<div class="profile-row lodging-row" onclick="editPrefMulti(\'cuisine\')">' +
    '<span class="profile-key">口味</span><span>' +
    (pf.cuisine.length ? pf.cuisine.map(function (t) { return cuisineMap[t] || t; }).join("、") : "不限") + '</span></div>';
  html += '</div>';
```

- [ ] **Step 2: 加编辑函数**

在 `js/views-main.js` 末尾(`delTripFromEdit` 之后)追加。单选用 `prompt` 循环选项过重,改用底部抽屉单选;多选用抽屉多选。为最小改动,单选先用现有 `prompt` + 数字选项:

```js
var PREF_OPTIONS = {
  budgetTier: [["economy","经济"],["comfort","舒适"],["luxury","豪华"]],
  cabinClass: [["economy","经济舱"],["premium","超经"],["business","商务舱"]],
  lodgingLocation: [["central","市中心"],["near-transit","近地铁"],["quiet","安静"]],
  travelStyle: [["packed","暴走打卡"],["balanced","均衡"],["relaxed","悠闲深度"]],
  lodgingTypes: [["hotel","连锁酒店"],["boutique","精品民宿"],["hostel","青旅"],["resort","度假村"],["apartment","公寓"]],
  cuisine: [["local","本地菜"],["halal","清真"],["vegetarian","素食"],["spicy","嗜辣"],["trending","网红店"]]
};

function editPrefSingle(key) {
  var opts = PREF_OPTIONS[key];
  var cur = getPrefs()[key];
  var lines = opts.map(function (o, i) { return (i + 1) + ". " + o[1] + (o[0] === cur ? " ✓" : ""); }).join("\n");
  var ans = prompt("选择(输入序号):\n" + lines);
  if (ans === null) return;
  var idx = parseInt(ans, 10) - 1;
  if (idx >= 0 && idx < opts.length) { setPrefsField(key, opts[idx][0]); renderProfile(); }
}

function editPrefMulti(key) {
  var opts = PREF_OPTIONS[key];
  var cur = getPrefs()[key] || [];
  var lines = opts.map(function (o, i) { return (i + 1) + ". " + o[1] + (cur.indexOf(o[0]) !== -1 ? " ✓" : ""); }).join("\n");
  var ans = prompt("多选(逗号分隔序号,如 1,3;留空=不限):\n" + lines);
  if (ans === null) return;
  var picked = ans.split(",").map(function (s) { return parseInt(s.trim(), 10) - 1; })
    .filter(function (i) { return i >= 0 && i < opts.length; })
    .map(function (i) { return opts[i][0]; });
  setPrefsField(key, picked);
  renderProfile();
}
```

- [ ] **Step 3: 手动验证**

浏览器打开 → "我的"页,应看到"出行喜好"卡 6 行。点"舱位偏好",输入 `3`,应变"商务舱";刷新仍在。点"口味",输入 `1,4`,显示"本地菜、嗜辣"。

- [ ] **Step 4: 提交**

```bash
git add js/views-main.js css/screens.css
git commit -m "feat: add travel preferences card in profile"
```

---

# 阶段二:精选数据 + 个性化引擎

### Task 5: destinationRecs 数据结构(以香港为模板)

**Files:**
- Modify: `js/data.js`(在 `localRecommendations` 之后新增 `destinationRecs`)

- [ ] **Step 1: 加香港完整样例**

在 `js/data.js` 的 `localRecommendations: { … }` 之后加(香港作为字段齐全的模板;坐标/价格为参考值):

```js
  /* 目的地精选推荐(个性化引擎输入)。POI 含坐标/评分/图片/联系方式。 */
  destinationRecs: {
    "香港": {
      center: { lat: 22.3027, lon: 114.1772 },
      transport: {
        intercity: [
          { mode: "flight", label: "直飞", durationH: 2.5, tip: "提前 6 周订价更优",
            cabins: [
              { class: "economy", priceLocal: 1400, note: "含税参考" },
              { class: "business", priceLocal: 4600, note: "含税参考" }
            ] }
        ],
        local: [
          { mode: "metro", name: "八达通(港铁)", priceRange: "5–20 港币/程", tier: "economy", tip: "机场可购,退卡退余额" },
          { mode: "taxi", name: "市区的士", priceRange: "起步约 27 港币", tier: "comfort", tip: "红色市区、绿色新界" }
        ]
      },
      lodging: [
        { name: "唐楼精品酒店", type: "boutique", area: "中环", pricePerNight: 1850, tier: "comfort",
          location: "near-transit", lat: 22.2830, lon: 114.1550, tags: ["精品", "近地铁"],
          desc: "中环老城区精品小店,步行到地铁站,夜生活方便" },
        { name: "尖沙咀海景连锁", type: "hotel", area: "尖沙咀", pricePerNight: 2200, tier: "comfort",
          location: "central", lat: 22.2950, lon: 114.1720, tags: ["海景", "购物近"],
          desc: "维港一线海景,楼下即购物区" }
      ],
      dining: [
        { name: "添好运点心", cuisineTags: ["local"], priceLevel: 1, rating: 4.6, michelin: true,
          area: "深水埗", lat: 22.3300, lon: 114.1620, image: "",
          address: "深水埗福荣街 9-11 号地铺", phone: "+852 2788 1226", website: "https://timhowan.com",
          hours: "10:00–21:30 · 每日营业", desc: "最平价米其林一星,酥皮焗叉烧包是招牌,几乎每桌必点" },
        { name: "镛记烧鹅", cuisineTags: ["local"], priceLevel: 3, rating: 4.4, michelin: false,
          area: "中环", lat: 22.2830, lon: 114.1540, image: "",
          address: "中环威灵顿街 32-40 号", phone: "+852 2522 1624", website: "",
          hours: "11:00–22:00", desc: "中环老字号,金牌烧鹅驰名中外" }
      ],
      attractions: [
        { name: "维多利亚港", category: "夜景", durationH: 1.5, rating: 4.8,
          lat: 22.2930, lon: 114.1690, image: "",
          address: "尖沙咀海滨长廊", phone: "", website: "", hours: "全天",
          desc: "世界三大夜景之一,幻彩咏香江灯光秀每晚 20:00",
          tips: "20:00 灯光秀,傍晚到最好", bestFor: ["packed", "balanced", "relaxed"] },
        { name: "太平山顶", category: "观景", durationH: 2, rating: 4.7,
          lat: 22.2759, lon: 114.1455, image: "",
          address: "山顶道 128 号凌霄阁", phone: "", website: "", hours: "10:00–23:00",
          desc: "俯瞰维港全景,山顶缆车体验",
          tips: "缆车常排队,可网上先购票", bestFor: ["packed", "balanced"] }
      ]
    }
  },
```

- [ ] **Step 2: 迁移其余城市**

把现有 `localRecommendations` 里的 东京、曼谷、新加坡、腾冲,按上面香港的 shape 补进 `destinationRecs`。规则:
- `spots[]` → `attractions[]`:`name`/`desc` 直接搬;`category` 用原 `type` 的语义(如"🛕"→"文化"),`durationH` 估值(景点默认 1.5,寺庙 1,乐园 5),`rating` 给合理值(4.3–4.8),`bestFor` 默认 `["packed","balanced","relaxed"]`;`lat/lon` 用该城 `center` 附近的真实坐标(可先都填 `center` 值,精度后续补);`image/address/phone/website/hours` 先留 `""`。
- `food[]` → `dining[]`:`name`/`desc` 直接搬;`cuisineTags` 至少含 `["local"]`;`priceLevel` 1–3;`rating` 4.2–4.7;`michelin` 据描述判断;其余联系字段先 `""`。
- `transport`/`lodging`:每城至少 1 条 intercity(经济+商务两舱)与 2 条 lodging,价格用该地典型参考值。
- `center`:用该城已知经纬度(可从 `trips` 里同名城市的 `loc` 取)。

> 这不是占位:shape 已完全固定,是把现有内容按新结构誊抄 + 补数值字段。缺的 `image/address/phone/website` 留空字符串,渲染层会兜底。

- [ ] **Step 3: 手动验证**

浏览器控制台:`Object.keys(APP_DATA.destinationRecs)` 应含 5 城;`APP_DATA.destinationRecs["香港"].dining[0].address` 有值。

- [ ] **Step 4: 提交**

```bash
git add js/data.js
git commit -m "feat: add structured destinationRecs dataset"
```

---

### Task 6: haversine 距离(TDD)

**Files:**
- Modify: `js/recommend.js`
- Modify: `test/recommend.test.js`

- [ ] **Step 1: 追加失败测试**

在 `test/recommend.test.js` 的 `console.log("Task1 OK")` 之前追加:

```js
/* haversine: 已知两点距离(香港中心→太平山顶约 3km 量级) */
var dm = rec.haversineM(22.3027, 114.1772, 22.2759, 114.1455);
assert.ok(dm > 3000 && dm < 5000, "香港中心到山顶约 3-5km,实测 " + dm);
assert.strictEqual(rec.haversineM(0, 0, 0, 0), 0);
assert.strictEqual(typeof dm, "number");
assert.strictEqual(dm, Math.round(dm), "返回整数米");
```

- [ ] **Step 2: 运行,确认失败**

Run: `node test/recommend.test.js`
Expected: FAIL — `rec.haversineM is not a function`。

- [ ] **Step 3: 实现**

在 `js/recommend.js` 的 `normalizePrefs` 之后加:

```js
function haversineM(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var toRad = function (d) { return d * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
```

并在文件尾 `module.exports` 对象里加 `haversineM: haversineM,`。

- [ ] **Step 4: 运行,确认通过**

Run: `node test/recommend.test.js`
Expected: 无报错。

- [ ] **Step 5: 提交**

```bash
git add js/recommend.js test/recommend.test.js
git commit -m "feat: add haversine distance"
```

---

### Task 7: 舱位排序 orderCabins(TDD)

**Files:**
- Modify: `js/recommend.js`
- Modify: `test/recommend.test.js`

- [ ] **Step 1: 追加失败测试**

```js
/* orderCabins: 偏好舱位置顶并标 preferred */
var cabins = [
  { class: "economy", priceLocal: 1400 },
  { class: "business", priceLocal: 4600 }
];
var ordered = rec.orderCabins(cabins, "business");
assert.strictEqual(ordered[0].class, "business", "偏好舱位置顶");
assert.strictEqual(ordered[0].preferred, true);
assert.strictEqual(ordered[1].preferred, false);
/* 偏好舱位数据里没有时:不崩,原顺序,均 preferred=false */
var noPref = rec.orderCabins(cabins, "premium");
assert.strictEqual(noPref.length, 2);
assert.strictEqual(noPref[0].preferred, false);
```

- [ ] **Step 2: 运行,确认失败**

Run: `node test/recommend.test.js`
Expected: FAIL — `rec.orderCabins is not a function`。

- [ ] **Step 3: 实现**

```js
function orderCabins(cabins, cabinClass) {
  var out = (cabins || []).map(function (c) {
    return { class: c.class, priceLocal: c.priceLocal, note: c.note, preferred: c.class === cabinClass };
  });
  out.sort(function (a, b) { return (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0); });
  return out;
}
```

尾部 `module.exports` 加 `orderCabins: orderCabins,`。

- [ ] **Step 4: 运行,确认通过**

Run: `node test/recommend.test.js` → 无报错。

- [ ] **Step 5: 提交**

```bash
git add js/recommend.js test/recommend.test.js
git commit -m "feat: order cabins by preference"
```

---

### Task 8: 住宿排序 rankLodging(TDD)

**Files:**
- Modify: `js/recommend.js`
- Modify: `test/recommend.test.js`

- [ ] **Step 1: 追加失败测试**

```js
/* rankLodging: 命中住宿类型 + 档次贴近的排前,并标 matched/why */
var lodging = [
  { name: "连锁A", type: "hotel", tier: "economy", location: "central" },
  { name: "精品B", type: "boutique", tier: "comfort", location: "near-transit" }
];
var prefsBoutique = rec.normalizePrefs({ lodgingTypes: ["boutique"], budgetTier: "comfort", lodgingLocation: "near-transit" });
var ranked = rec.rankLodging(lodging, prefsBoutique);
assert.strictEqual(ranked[0].name, "精品B", "命中类型的排最前");
assert.strictEqual(ranked[0].matched, true);
assert.ok(ranked[0].why.length > 0, "命中项有理由");
assert.strictEqual(ranked[1].matched, false);
/* lodgingTypes 为默认(不过滤命中所有 hotel)时不崩 */
var ranked2 = rec.rankLodging(lodging, rec.normalizePrefs({}));
assert.strictEqual(ranked2.length, 2);
```

- [ ] **Step 2: 运行,确认失败** — `rec.rankLodging is not a function`。

- [ ] **Step 3: 实现**

```js
var TIER_RANK = { economy: 0, comfort: 1, luxury: 2 };

function rankLodging(lodgingArr, prefs) {
  var p = normalizePrefs(prefs);
  var scored = (lodgingArr || []).map(function (l) {
    var typeHit = p.lodgingTypes.indexOf(l.type) !== -1;
    var locHit = l.location === p.lodgingLocation;
    var tierGap = Math.abs((TIER_RANK[l.tier] || 1) - (TIER_RANK[p.budgetTier] || 1));
    var score = (typeHit ? 100 : 0) + (locHit ? 20 : 0) - tierGap * 10;
    var reasons = [];
    if (typeHit) reasons.push("贴合你偏好的住宿类型");
    if (locHit) reasons.push("位置合你意");
    return { item: l, score: score, matched: typeHit, why: reasons.join(" · ") };
  });
  scored.sort(function (a, b) { return b.score - a.score; });
  return scored.map(function (s) {
    var o = {}; for (var k in s.item) o[k] = s.item[k];
    o.matched = s.matched; o.why = s.why;
    return o;
  });
}
```

尾部导出加 `rankLodging: rankLodging,`。

- [ ] **Step 4: 运行,确认通过** → 无报错。

- [ ] **Step 5: 提交**

```bash
git add js/recommend.js test/recommend.test.js
git commit -m "feat: rank lodging by preference"
```

---

### Task 9: POI 排序 rankPois + poiWhy(TDD)

**Files:**
- Modify: `js/recommend.js`
- Modify: `test/recommend.test.js`

- [ ] **Step 1: 追加失败测试**

```js
/* rankPois: 按评分排序;按距离排序;景点叠加 travelStyle;dining 口味生成 why */
var dining = [
  { name: "本地菜馆", cuisineTags: ["local"], rating: 4.2, lat: 22.30, lon: 114.17 },
  { name: "网红店", cuisineTags: ["trending"], rating: 4.8, lat: 22.31, lon: 114.20 }
];
var byRating = rec.rankPois(dining, { sort: "rating", anchor: null, prefs: rec.normalizePrefs({}), kind: "dining" });
assert.strictEqual(byRating[0].name, "网红店", "评分高排前");
assert.strictEqual(byRating[0].distanceM, null, "无 anchor 时距离为 null");

var anchor = { lat: 22.30, lon: 114.17 };
var byDist = rec.rankPois(dining, { sort: "distance", anchor: anchor, prefs: rec.normalizePrefs({}), kind: "dining" });
assert.strictEqual(byDist[0].name, "本地菜馆", "近的排前");
assert.ok(byDist[0].distanceM < byDist[1].distanceM);

var likesLocal = rec.normalizePrefs({ cuisine: ["local"] });
var byRatingLocal = rec.rankPois(dining, { sort: "rating", anchor: null, prefs: likesLocal, kind: "dining" });
assert.strictEqual(byRatingLocal[0].name, "本地菜馆", "口味命中加权盖过评分");
assert.ok(byRatingLocal[0].why.indexOf("本地菜") !== -1 || byRatingLocal[0].why.length > 0);

var attractions = [
  { name: "暴走点", rating: 4.5, bestFor: ["packed"], lat: 22.30, lon: 114.17 },
  { name: "深度点", rating: 4.5, bestFor: ["relaxed"], lat: 22.30, lon: 114.17 }
];
var relaxed = rec.normalizePrefs({ travelStyle: "relaxed" });
var byStyle = rec.rankPois(attractions, { sort: "rating", anchor: null, prefs: relaxed, kind: "attractions" });
assert.strictEqual(byStyle[0].name, "深度点", "风格命中的排前");
```

- [ ] **Step 2: 运行,确认失败** — `rec.rankPois is not a function`。

- [ ] **Step 3: 实现**

```js
var CUISINE_LABEL = { local: "本地菜", halal: "清真", vegetarian: "素食", spicy: "嗜辣", trending: "网红店" };

function poiWhy(poi, prefs, kind) {
  var p = normalizePrefs(prefs);
  if (kind === "dining") {
    var hit = (poi.cuisineTags || []).filter(function (t) { return p.cuisine.indexOf(t) !== -1; });
    if (hit.length) return "贴合你的" + hit.map(function (t) { return CUISINE_LABEL[t] || t; }).join("、") + "偏好";
    if (poi.michelin) return "米其林推荐";
    return "";
  }
  if (kind === "attractions") {
    if ((poi.bestFor || []).indexOf(p.travelStyle) !== -1) {
      var styleLabel = { packed: "暴走打卡", balanced: "均衡", relaxed: "悠闲深度" }[p.travelStyle];
      return "适合你的" + styleLabel + "节奏";
    }
    return "";
  }
  return "";
}

function rankPois(pois, opts) {
  opts = opts || {};
  var p = normalizePrefs(opts.prefs);
  var anchor = opts.anchor;
  var kind = opts.kind;
  var list = (pois || []).map(function (poi) {
    var o = {}; for (var k in poi) o[k] = poi[k];
    o.distanceM = (anchor && poi.lat != null) ? haversineM(anchor.lat, anchor.lon, poi.lat, poi.lon) : null;
    o.why = poiWhy(poi, p, kind);
    o._cuisineHit = kind === "dining" && (poi.cuisineTags || []).some(function (t) { return p.cuisine.indexOf(t) !== -1; });
    o._styleHit = kind === "attractions" && (poi.bestFor || []).indexOf(p.travelStyle) !== -1;
    return o;
  });
  list.sort(function (a, b) {
    if (opts.sort === "distance" && a.distanceM != null && b.distanceM != null) {
      return a.distanceM - b.distanceM;
    }
    /* 默认/rating:先个性化命中,再评分 */
    var aHit = (a._cuisineHit || a._styleHit) ? 1 : 0;
    var bHit = (b._cuisineHit || b._styleHit) ? 1 : 0;
    if (aHit !== bHit) return bHit - aHit;
    return (b.rating || 0) - (a.rating || 0);
  });
  list.forEach(function (o) { delete o._cuisineHit; delete o._styleHit; });
  return list;
}
```

尾部导出加 `poiWhy: poiWhy, rankPois: rankPois,`。

- [ ] **Step 4: 运行,确认通过** → 无报错。

- [ ] **Step 5: 提交**

```bash
git add js/recommend.js test/recommend.test.js
git commit -m "feat: rank POIs by distance/rating with personalization"
```

---

# 阶段三:共享渲染组件

### Task 10: POI 卡与详情渲染

**Files:**
- Modify: `js/recommend.js`(渲染函数,不进 module.exports)
- Modify: `css/screens.css`(追加 POI 详情样式)

- [ ] **Step 1: 加 renderPoiCard**

在 `js/recommend.js` 的导出块之前加(纯浏览器渲染,复用现有 `rec-item`/`rec-info` 类):

```js
function priceDollars(level) { return level ? new Array(level + 1).join("$") : ""; }

function distanceLabel(m) {
  if (m == null) return "";
  return m < 1000 ? m + "m" : (m / 1000).toFixed(1) + "km";
}

/* ctx = { tripId, kind, wishNames[], anchorLabel } */
function renderPoiCard(poi, ctx) {
  var added = (ctx.wishNames || []).indexOf(poi.name) !== -1;
  var meta = [];
  if (poi.rating) meta.push('<span class="poi-meta">★ ' + poi.rating + '</span>');
  if (poi.distanceM != null) meta.push('<span class="poi-meta dist">' + (ctx.anchorLabel || "") + distanceLabel(poi.distanceM) + '</span>');
  if (ctx.kind === "dining" && poi.priceLevel) meta.push('<span class="poi-price">' + priceDollars(poi.priceLevel) + '</span>');
  if (ctx.kind === "attractions" && poi.durationH) meta.push('<span class="poi-meta">' + poi.durationH + 'h</span>');

  var addBtn = added
    ? '<span class="badge">已想去</span>'
    : '<button class="rec-add" onclick="event.stopPropagation();addRecToWish(\'' + ctx.tripId + '\',\'' +
      poi.name.replace(/'/g, "\\'") + '\',\'' + (ctx.kind === "dining" ? "🍜" : "📍") + '\')">+ 想去</button>';

  return '<div class="poi-card" onclick="openPoiDetail(\'' + ctx.tripId + '\',\'' + ctx.kind + '\',\'' +
    poi.name.replace(/'/g, "\\'") + '\')">' +
    '<div class="poi-main"><div class="poi-name">' + poi.name +
    (poi.michelin ? ' <span class="badge">米其林</span>' : '') + '</div>' +
    '<div class="poi-metaline">' + meta.join("") + '</div>' +
    '<div class="rec-desc">' + (poi.desc || "") + '</div>' +
    (poi.why ? '<div class="poi-why">✨ ' + poi.why + '</div>' : '') + '</div>' +
    '<div class="poi-cardact">' + addBtn + '</div></div>';
}
```

- [ ] **Step 2: 加 renderPoiDetail**

```js
function infoRow(icon, label, val, actionHTML) {
  if (!val) return "";
  return '<div class="poi-inforow"><span class="poi-infoicon">' + icon + '</span>' +
    '<div class="poi-infobody"><div class="poi-infolabel">' + label + '</div>' +
    '<div class="poi-infoval">' + val + '</div></div>' + (actionHTML || "") + '</div>';
}

function renderPoiDetail(poi, ctx) {
  var img = poi.image
    ? '<img class="poi-photo" src="' + poi.image + '" alt="" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'noimg\')">'
    : "";
  var mapQ = encodeURIComponent(poi.name + " " + (poi.address || ""));
  var html = '<div class="poi-hero' + (poi.image ? "" : " noimg") + '">' + img +
    '<button class="poi-back" onclick="closePoiDetail()">‹</button></div>';
  html += '<div class="poi-detail-body">';
  html += '<div class="poi-detail-title">' + poi.name +
    (ctx.kind === "dining" && poi.priceLevel ? ' <span class="poi-price">' + priceDollars(poi.priceLevel) + '</span>' : '') +
    (poi.michelin ? ' <span class="badge">米其林</span>' : '') + '</div>';
  html += '<div class="poi-detail-sub">' + (poi.area || poi.category || "") +
    (poi.rating ? ' · ★ ' + poi.rating : '') + '</div>';
  html += '<div class="poi-detail-desc">' + (poi.desc || "") + '</div>';
  if (poi.why) html += '<div class="poi-why-box">✨ 为你推荐:' + poi.why + '</div>';
  if (poi.tips) html += '<div class="poi-why-box tip">💡 ' + poi.tips + '</div>';
  html += infoRow("📍", "地址", poi.address, '<a class="poi-infoact" href="https://maps.google.com/?q=' + mapQ + '" target="_blank" rel="noopener">地图 ›</a>');
  html += infoRow("📞", "电话", poi.phone, poi.phone ? '<a class="poi-infoact" href="tel:' + poi.phone.replace(/\s/g, "") + '">呼叫</a>' : "");
  html += infoRow("🌐", "网站", poi.website ? poi.website.replace(/^https?:\/\//, "") : "", poi.website ? '<a class="poi-infoact" href="' + poi.website + '" target="_blank" rel="noopener">打开 ›</a>' : "");
  html += infoRow("🕐", "营业时间", poi.hours, "");
  var added = (ctx.wishNames || []).indexOf(poi.name) !== -1;
  html += '<button class="btn-primary" style="width:100%;margin-top:14px;" onclick="addRecToWish(\'' + ctx.tripId + '\',\'' +
    poi.name.replace(/'/g, "\\'") + '\',\'' + (ctx.kind === "dining" ? "🍜" : "📍") + '\');closePoiDetail()">' +
    (added ? '✓ 已在想去清单' : '+ 加入想去') + '</button>';
  html += '</div>';
  return html;
}
```

- [ ] **Step 3: 加样式**

`css/screens.css` 末尾追加(复用现有变量 `--primary`/`--text-faint` 等):

```css
.poi-card{display:flex;gap:10px;padding:12px 0;border-top:.5px solid var(--border);cursor:pointer}
.poi-main{flex:1}
.poi-name{font-weight:500}
.poi-metaline{display:flex;gap:10px;margin:3px 0;font-size:12px}
.poi-meta{color:var(--text-faint)} .poi-meta.dist{color:var(--primary)} .poi-price{color:#3B6D11}
.poi-why{font-size:12px;color:var(--primary);margin-top:2px}
.poi-cardact{align-self:center}
.poi-hero{position:relative;height:170px;background:#B5D4F4;display:flex;align-items:center;justify-content:center}
.poi-hero.noimg::after{content:"图片";color:#0C447C;font-size:12px}
.poi-photo{width:100%;height:100%;object-fit:cover}
.poi-back{position:absolute;top:12px;left:12px;width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,.9);font-size:18px}
.poi-detail-body{padding:14px}
.poi-detail-title{font-size:19px;font-weight:500}
.poi-detail-sub{font-size:12px;color:var(--text-faint);margin-top:4px}
.poi-detail-desc{font-size:14px;line-height:1.6;margin-top:12px}
.poi-why-box{background:var(--bg-accent,#E6F1FB);color:#0C447C;border-radius:10px;padding:9px 11px;margin-top:12px;font-size:12px}
.poi-why-box.tip{background:var(--warn-bg,#FAEEDA);color:#854F0B}
.poi-inforow{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:.5px solid var(--border)}
.poi-infoicon{font-size:16px}.poi-infobody{flex:1}
.poi-infolabel{font-size:11px;color:var(--text-faint)}.poi-infoval{font-size:13px}
.poi-infoact{font-size:12px;color:var(--primary);white-space:nowrap;text-decoration:none}
```

- [ ] **Step 4: 提交**(渲染函数暂无调用,下一 Task 接线后一起验证)

```bash
git add js/recommend.js css/screens.css
git commit -m "feat: add shared POI card and detail renderers"
```

---

### Task 11: POI 详情页导航接线

**Files:**
- Modify: `index.html`(加 `screen-poi-detail` 屏 + 引入 `recommend.js`)
- Modify: `js/app.js`(`openPoiDetail`/`closePoiDetail`;`showScreen` 隐藏 tab-bar 规则)

- [ ] **Step 1: index.html 加屏与脚本**

在 `<section id="screen-trip-detail"…>` 之后加:

```html
  <section id="screen-poi-detail" class="screen no-tab">
    <div class="screen-body"></div>
  </section>
```

并在 `<script src="js/data.js"></script>` 之后、`sync.js` 之前加:

```html
<script src="js/recommend.js"></script>
```

- [ ] **Step 2: app.js 导航函数**

在 `js/app.js` 的 `closeTripDetail` 之后加:

```js
var POI_RETURN = "screen-trip-detail";

function openPoiDetail(tripId, kind, name) {
  var trip = getTrip(tripId);
  var city = trip ? trip.city : tripId; /* 推荐 tab 传城市名 */
  var recs = APP_DATA.destinationRecs[city] ||
    APP_DATA.destinationRecs[String(city).replace(/市$/, "")];
  if (!recs) return;
  var list = kind === "dining" ? recs.dining : recs.attractions;
  var poi = (list || []).find(function (p) { return p.name === name; });
  if (!poi) return;
  var wishNames = (trip && trip.wishlist || []).map(function (w) { return w.name; });
  POI_RETURN = document.querySelector(".screen.active").id;
  document.querySelector("#screen-poi-detail .screen-body").innerHTML =
    renderPoiDetail(poi, { tripId: tripId, kind: kind, wishNames: wishNames });
  showScreen("screen-poi-detail");
}

function closePoiDetail() { showScreen(POI_RETURN); }
```

- [ ] **Step 3: app.js — showScreen 隐藏 tab-bar**

把 `js/app.js:275` 的 `var isDetail = id === "screen-trip-detail";` 改为:

```js
  var isDetail = id === "screen-trip-detail" || id === "screen-poi-detail";
```

- [ ] **Step 4: sw.js 缓存新文件 + 升版本**

`sw.js:3` 改 `var VERSION = "v13";`;`ASSETS` 数组里 `"./js/data.js",` 之后加 `"./js/recommend.js",`。

- [ ] **Step 5: 手动验证**

临时在控制台跑:
```js
openPoiDetail("hk-2026-08","dining","添好运点心")
```
应跳到详情页,显示地址/电话/网站/营业时间行,tab-bar 隐藏;点返回回到原屏。

- [ ] **Step 6: 提交**

```bash
git add index.html js/app.js sw.js
git commit -m "feat: wire POI detail screen navigation"
```

---

# 阶段四:行程详情两分区重构

### Task 12: 详情页分区骨架

**Files:**
- Modify: `js/views-trip.js:60-74`(`renderSections`)
- Modify: `css/screens.css`(分区标题样式)

- [ ] **Step 1: 改 renderSections 为两分区**

把 `js/views-trip.js` 的 `renderSections` 替换为:

```js
function renderSections(trip) {
  var html = '<div class="zone-label">行程安排</div>';
  if (typeof sectionWeather === "function") html += sectionWeather(trip);
  if (typeof sectionTodos === "function") html += sectionTodos(trip);
  if (typeof sectionPacking === "function") html += sectionPacking(trip);
  if (typeof sectionItinerary === "function") html += sectionItinerary(trip);
  if (typeof sectionBudget === "function") html += sectionBudget(trip);
  if (typeof sectionEmergency === "function") html += sectionEmergency(trip);
  if (typeof sectionTips === "function") html += sectionTips(trip);

  var pf = (typeof getPrefs === "function") ? getPrefs() : {};
  var prefSummary = [
    { economy: "经济舱", premium: "超经", business: "商务舱" }[pf.cabinClass],
    (pf.lodgingTypes && pf.lodgingTypes.length) ? "精选住宿" : null,
    (pf.cuisine && pf.cuisine.length) ? "口味优先" : null
  ].filter(Boolean).join(" · ");
  html += '<div class="zone-label">为你推荐<span class="zone-sub">' + (prefSummary ? " · " + prefSummary : "") + '</span></div>';
  if (typeof sectionTransport === "function") html += sectionTransport(trip);
  if (typeof sectionLodging === "function") html += sectionLodging(trip);
  if (typeof sectionRecDining === "function") html += sectionRecDining(trip);
  if (typeof sectionRecAttractions === "function") html += sectionRecAttractions(trip);
  return html;
}
```

> 注:移除了旧 `sectionWishlist` 与 `sectionLocalRecs` 的调用(其能力被"为你推荐"分区取代)。`sectionWishlist` 函数保留但不在详情页渲染(想去状态在推荐卡上体现);想去清单如需独立入口,后续再定。

- [ ] **Step 2: 样式**

`css/screens.css` 追加:

```css
.zone-label{font-size:13px;font-weight:500;color:var(--text-secondary,#666);margin:18px 4px 8px}
.zone-sub{font-weight:400;color:var(--text-faint)}
```

- [ ] **Step 3: 手动验证**

打开香港行程详情,应看到"行程安排"与"为你推荐"两个分区标题,规划卡在上。交通/住宿暂用旧渲染(下一 Task 升级),餐厅/景点两块暂空(Task 15 补)。页面不报错。

- [ ] **Step 4: 提交**

```bash
git add js/views-trip.js css/screens.css
git commit -m "refactor: split trip detail into planning and recommend zones"
```

---

### Task 13: 交通卡升级(舱位对比)

**Files:**
- Modify: `js/recommend.js`(加 `renderRecTransport`)
- Modify: `js/views-trip.js`(`sectionTransport` 顶部插入推荐)

- [ ] **Step 1: recommend.js 加 renderRecTransport**

```js
function fmtMoney(n) { return Number(n).toLocaleString(); }

/* ctx = { originName, currency, toAUD } */
function renderRecTransport(rec, prefs, ctx) {
  if (!rec || !rec.intercity || !rec.intercity.length) return "";
  var p = normalizePrefs(prefs);
  var route = rec.intercity[0];
  var cabins = orderCabins(route.cabins, p.cabinClass);
  var html = '<div class="rec-transport">';
  html += '<div class="rt-origin">📍 从' + (ctx.originName || "出发地") + '出发 · ' +
    (route.label || "") + (route.durationH ? ' ' + route.durationH + 'h' : '') + '</div>';
  cabins.forEach(function (c) {
    var aud = ctx.toAUD ? ctx.toAUD(c.priceLocal, ctx.currency) : null;
    var cabinName = { economy: "经济舱", premium: "超经", business: "商务舱" }[c.class] || c.class;
    html += '<div class="rt-cabin' + (c.preferred ? " pref" : "") + '">' +
      '<div class="rt-cabin-top"><span>' + cabinName + '</span>' +
      (c.preferred ? '<span class="badge">你的偏好</span>' : '<span class="rt-min">' + (c.class === "economy" ? "最省" : "") + '</span>') + '</div>' +
      '<div class="rt-price">' + (ctx.currency || "") + ' ' + fmtMoney(c.priceLocal) +
      (aud != null ? ' <em>≈ ' + fmtMoney(aud) + ' AUD</em>' : '') + '</div></div>';
  });
  if (route.tip) html += '<div class="rt-tip">💡 ' + route.tip + '</div>';
  return html + '</div>';
}
```

样式追加 `css/screens.css`:

```css
.rec-transport{margin-bottom:10px}
.rt-origin{font-size:12px;color:var(--text-faint);margin-bottom:8px}
.rt-cabin{border:.5px solid var(--border);border-radius:10px;padding:9px 11px;margin-bottom:7px}
.rt-cabin.pref{border:2px solid var(--primary)}
.rt-cabin-top{display:flex;justify-content:space-between;font-size:13px}
.rt-price{font-size:17px;font-weight:500;margin-top:4px}
.rt-price em{font-size:12px;color:var(--text-secondary);font-style:normal}
.rt-cabin.pref .rt-price{color:#0C447C;font-size:19px}
.rt-tip{font-size:12px;color:var(--text-secondary);margin-top:4px}
```

- [ ] **Step 2: sectionTransport 顶部插推荐**

在 `js/views-trip.js` 的 `sectionTransport` 里,`var body = '<div class="field-label" style="margin-top:0;">我的航班</div>';` 之前插入,把推荐放最前:

```js
  var recs = APP_DATA.destinationRecs[trip.city] ||
    APP_DATA.destinationRecs[String(trip.city).replace(/市$/, "")];
  var recHTML = "";
  if (recs && typeof renderRecTransport === "function") {
    var pp = getPassport();
    var originName = (pp.currentLoc && pp.currentLoc.name) || (pp.homeLoc && pp.homeLoc.name) || "";
    recHTML = renderRecTransport(recs.transport, getPrefs(),
      { originName: originName, currency: trip.currency, toAUD: toAUD });
  }
  var body = recHTML;
  body += '<div class="field-label"' + (recHTML ? '' : ' style="margin-top:0;"') + '>我的航班</div>';
```

(删掉原来那行单独的 `var body = '<div class="field-label" style="margin-top:0;">我的航班</div>';`。)

- [ ] **Step 3: 手动验证**

香港详情"交通"卡:顶部出现"从…出发",商务舱/经济舱两卡,若"我的"里 prefs.cabinClass=business 则商务舱高亮置顶;下方仍有"我的航班 CX138"与购票入口。改 prefs 为 economy 后重开,高亮切到经济舱。

- [ ] **Step 4: 提交**

```bash
git add js/recommend.js js/views-trip.js css/screens.css
git commit -m "feat: upgrade transport card with cabin comparison"
```

---

### Task 14: 住宿卡升级(已订 + 推荐)

**Files:**
- Modify: `js/recommend.js`(加 `renderRecLodging`)
- Modify: `js/views-trip.js`(`sectionLodging`)

- [ ] **Step 1: recommend.js 加 renderRecLodging**

```js
/* ctx = { currency, toAUD } */
function renderRecLodging(recArr, booked, prefs, ctx) {
  var html = "";
  if (booked && booked.name) {
    html += '<div class="rl-booked"><span class="badge ok">已预订</span> <strong>' + booked.name + '</strong>' +
      (booked.address ? '<div class="rec-desc">' + booked.address + (booked.checkIn ? ' · ' + booked.checkIn : '') + '</div>' : '') +
      '</div>';
  }
  var ranked = rankLodging(recArr || [], prefs);
  if (ranked.length) {
    html += '<div class="field-label">' + (booked && booked.name ? "还想看看?为你精选" : "为你精选") + '</div>';
    ranked.slice(0, 3).forEach(function (l) {
      var aud = ctx.toAUD ? ctx.toAUD(l.pricePerNight, ctx.currency) : null;
      html += '<div class="rl-item' + (l.matched ? " pref" : "") + '">' +
        '<div class="rl-top"><span>' + l.name + ' · ' + l.area + '</span>' +
        '<span class="rl-price">' + (ctx.currency || "") + ' ' + fmtMoney(l.pricePerNight) + '<em>/晚</em></span></div>' +
        '<div class="rl-tags">' + (l.tags || []).map(function (t) { return '<span class="rl-tag">' + t + '</span>'; }).join("") + '</div>' +
        (l.why ? '<div class="poi-why">✨ ' + l.why + '</div>' : '') + '</div>';
    });
  }
  return html;
}
```

样式追加:

```css
.rl-booked{border:.5px solid var(--border-strong,#ccc);border-radius:10px;padding:9px 11px;margin-bottom:8px}
.badge.ok{background:var(--ok-bg,#E1F5EE);color:#0F6E56}
.rl-item{border:.5px solid var(--border);border-radius:10px;padding:9px 11px;margin-bottom:7px}
.rl-item.pref{border:2px solid var(--primary)}
.rl-top{display:flex;justify-content:space-between;font-size:13px;font-weight:500}
.rl-price{color:#0C447C}.rl-price em{font-size:11px;color:var(--text-secondary);font-style:normal;font-weight:400}
.rl-tags{display:flex;gap:6px;margin-top:7px}
.rl-tag{background:var(--surface-1,#f4f4f4);font-size:11px;padding:2px 8px;border-radius:20px;color:var(--text-secondary)}
```

- [ ] **Step 2: sectionLodging 改造**

把 `js/views-trip.js` 的 `sectionLodging` 里的 `var body = fields.map(...).join("");` 之后,`return sectionCard(...)` 之前,改为先拼推荐再拼已订字段:

```js
  var recs = APP_DATA.destinationRecs[trip.city] ||
    APP_DATA.destinationRecs[String(trip.city).replace(/市$/, "")];
  var recHTML = (recs && typeof renderRecLodging === "function")
    ? renderRecLodging(recs.lodging, l, getPrefs(), { currency: trip.currency, toAUD: toAUD })
    : "";
  var body = recHTML + '<div class="field-label">已订酒店信息</div>' + fields.map(function (f) {
    return '<div class="profile-row lodging-row" onclick="editLodging(\'' + trip.id + '\',\'' + f.key + '\',\'' + f.label + '\')">' +
      '<span class="profile-key">' + f.label + '</span>' +
      '<span class="lodging-val">' + (l[f.key] || '<span style="color:var(--text-faint)">点击填写</span>') + '</span></div>';
  }).join("");
```

(删除原 `var body = fields.map(...).join("");` 那一段,用上面替换。)

- [ ] **Step 3: 手动验证**

香港详情"住宿"卡:顶部"已预订 香港海景嘉福洲际"绿标 + 已订字段;下面"为你精选"若干,prefs 命中的加蓝框 + 理由。曼谷(已订)同理。新建的空行程无推荐数据时只显示已订字段区,不报错。

- [ ] **Step 4: 提交**

```bash
git add js/recommend.js js/views-trip.js css/screens.css
git commit -m "feat: upgrade lodging card with booked plus recommendations"
```

---

### Task 15: 餐厅 & 景点推荐板块(平铺 + POI 详情)

**Files:**
- Modify: `js/views-trip.js`(新增 `sectionRecDining`/`sectionRecAttractions`)

- [ ] **Step 1: 加两个板块函数**

在 `js/views-trip.js` 末尾(`refreshTripDetail` 之前)加:

```js
function poiSectionBody(trip, kind) {
  var recs = APP_DATA.destinationRecs[trip.city] ||
    APP_DATA.destinationRecs[String(trip.city).replace(/市$/, "")];
  if (!recs) return null;
  var list = kind === "dining" ? recs.dining : recs.attractions;
  if (!list || !list.length) return null;
  var anchor = (trip.lodging && trip.lodging.lat != null)
    ? { lat: trip.lodging.lat, lon: trip.lodging.lon }
    : (recs.center || null);
  var ranked = rankPois(list, { sort: "rating", anchor: anchor, prefs: getPrefs(), kind: kind });
  var wishNames = (trip.wishlist || []).map(function (w) { return w.name; });
  return ranked.map(function (poi) {
    return renderPoiCard(poi, { tripId: trip.id, kind: kind, wishNames: wishNames, anchorLabel: "" });
  }).join("");
}

function sectionRecDining(trip) {
  var body = poiSectionBody(trip, "dining");
  if (body == null) return "";
  return sectionCard("recdining", "🍜", "餐厅", "按你的口味排序", body);
}

function sectionRecAttractions(trip) {
  var body = poiSectionBody(trip, "attractions");
  if (body == null) return "";
  return sectionCard("recattractions", "🏞", "景点", "按你的风格排序", body);
}
```

> `sectionCard` 默认折叠。若希望"平铺展开",在渲染后给这两张卡加 `open` 类:在 `renderTripDetail` 末尾(`body.innerHTML = html;` 之后)加:
> ```js
> ["sc-recdining","sc-recattractions"].forEach(function(id){var e=document.getElementById(id);if(e)e.classList.add("open");});
> ```

- [ ] **Step 2: 手动验证**

香港详情底部出现"餐厅""景点"两卡且默认展开;每项显示评分/价位/时长、简介、"为你"理由、"想去"按钮;点卡片进 POI 详情(图片占位、地址/电话/网站/营业时间);点"想去"后该项变"已想去"且写入 wishlist(刷新保留)。

- [ ] **Step 3: 提交**

```bash
git add js/views-trip.js
git commit -m "feat: add dining and attraction recommendation sections"
```

---

# 阶段五:推荐 tab + 实时定位

### Task 16: 第 4 tab 与 explore 屏骨架

**Files:**
- Modify: `index.html`(tab-bar 加项 + `screen-explore` 屏)
- Modify: `js/app.js`(tab 点击分支)

- [ ] **Step 1: index.html**

在 `<section id="screen-profile"…>` 之后加:

```html
  <section id="screen-explore" class="screen">
    <div class="screen-body"></div>
  </section>
```

`<nav class="tab-bar">` 里,在"日历"与"我的"之间插入:

```html
    <button class="tab-item" data-screen="screen-explore">
      <span class="tab-icon">🧭</span><span class="tab-label">推荐</span>
    </button>
```

- [ ] **Step 2: app.js tab 分支**

在 `js/app.js` 的 tab 点击监听里,`if (btn.dataset.screen === "screen-profile") renderProfile();` 旁边加:

```js
    if (btn.dataset.screen === "screen-explore") renderExplore();
```

- [ ] **Step 3: 占位 renderExplore**

先在 `js/views-main.js` 末尾加占位,保证不报错:

```js
function renderExplore() {
  document.querySelector("#screen-explore .screen-body").innerHTML =
    '<h1 class="page-title">推荐</h1><div class="empty-state">加载中…</div>';
}
```

- [ ] **Step 4: 手动验证**

底部出现 4 个 tab,点"推荐"切到占位页,不报错。

- [ ] **Step 5: 提交**

```bash
git add index.html js/app.js js/views-main.js
git commit -m "feat: add explore tab scaffold"
```

---

### Task 17: 实时定位获取

**Files:**
- Modify: `js/app.js`(geoLoc 获取 + 兜底)

- [ ] **Step 1: 加定位函数**

在 `js/app.js` 的天气服务区附近加:

```js
/* 实时定位(仅本机,不同步);拒绝/失败回退手填所在地 */
function getAnchorLoc() {
  if (STATE.geoLoc && STATE.geoLoc.lat != null) return STATE.geoLoc;
  var p = getPassport();
  return p.currentLoc || null;
}

function requestGeo(cb) {
  if (!navigator.geolocation) { cb(getAnchorLoc()); return; }
  navigator.geolocation.getCurrentPosition(function (pos) {
    var loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: "", at: Date.now() };
    STATE.geoLoc = loc;
    /* 反向地理编码取城市名(复用现有 geocoding,失败不影响) */
    fetch("https://geocoding-api.open-meteo.com/v1/search?latitude=" + loc.lat + "&longitude=" + loc.lon)
      .catch(function () {});
    cb(loc);
  }, function () { cb(getAnchorLoc()); }, { timeout: 8000, maximumAge: 600000 });
}
```

> `STATE.geoLoc` 不进 `saveState` 的同步(它天然只在内存/本机;若要跨会话保留可存,但**绝不上传**——Task 3 已确保 mergeCloudData/上传封包不含 geoLoc)。

- [ ] **Step 2: 手动验证**

控制台执行 `requestGeo(function(l){console.log(l)})`,浏览器弹定位授权;允许后打印带 lat/lon 的对象;拒绝后打印手填所在地或 null。

- [ ] **Step 3: 提交**

```bash
git add js/app.js
git commit -m "feat: acquire realtime geolocation with fallback"
```

---

### Task 18: 推荐页——地点切换器 + 附近/目的地 + 排序

**Files:**
- Modify: `js/views-main.js`(`renderExplore` 全量实现)
- Modify: `css/screens.css`(切换器/排序样式)

- [ ] **Step 1: 状态与主渲染**

替换 `js/views-main.js` 的占位 `renderExplore`:

```js
var EXPLORE_STATE = { place: "nearby", sort: "distance" }; /* place: "nearby" 或 tripId */

function renderExplore() {
  var body = document.querySelector("#screen-explore .screen-body");
  var upcoming = getTrips().filter(function (t) { return daysUntil(t.endDate) >= 0; })
    .sort(function (a, b) { return new Date(a.startDate) - new Date(b.startDate); });

  var html = '<h1 class="page-title">推荐</h1>';

  /* 地点切换器 */
  html += '<div class="place-switch">';
  html += '<span class="place-chip' + (EXPLORE_STATE.place === "nearby" ? " on" : "") +
    '" onclick="switchPlace(\'nearby\')">📍 附近</span>';
  upcoming.forEach(function (t) {
    var mo = new Date(t.startDate).getMonth() + 1;
    html += '<span class="place-chip' + (EXPLORE_STATE.place === t.id ? " on" : "") +
      '" onclick="switchPlace(\'' + t.id + '\')">' + t.city + ' · ' + mo + '月</span>';
  });
  html += '</div>';

  html += '<div id="explore-content"></div>';
  body.innerHTML = html;
  renderExploreContent();
}

function switchPlace(place) {
  EXPLORE_STATE.place = place;
  EXPLORE_STATE.sort = place === "nearby" ? "distance" : "distance";
  renderExplore();
}

function setExploreSort(sort) { EXPLORE_STATE.sort = sort; renderExploreContent(); }
```

- [ ] **Step 2: 内容渲染(附近 vs 目的地)**

```js
function renderExploreContent() {
  var box = document.getElementById("explore-content");
  if (!box) return;

  if (EXPLORE_STATE.place === "nearby") {
    renderNearby(box);
    return;
  }
  renderDestinationPlan(box, EXPLORE_STATE.place);
}

function sortToggleHTML(distLabel) {
  return '<div class="sort-toggle">' +
    '<span class="' + (EXPLORE_STATE.sort === "distance" ? "on" : "") + '" onclick="setExploreSort(\'distance\')">' + distLabel + '</span>' +
    '<span class="' + (EXPLORE_STATE.sort === "rating" ? "on" : "") + '" onclick="setExploreSort(\'rating\')">好吃好玩</span></div>';
}

function poiGroupHTML(list, kind, anchor, tripId, wishNames, anchorLabel) {
  var ranked = rankPois(list, { sort: EXPLORE_STATE.sort, anchor: anchor, prefs: getPrefs(), kind: kind });
  return ranked.map(function (poi) {
    return renderPoiCard(poi, { tripId: tripId, kind: kind, wishNames: wishNames, anchorLabel: anchorLabel });
  }).join("");
}

function renderNearby(box) {
  box.innerHTML = '<div class="empty-inline">定位中…</div>';
  requestGeo(function (loc) {
    if (!loc) {
      box.innerHTML = '<div class="empty-state">未获取到定位。<span style="color:var(--primary)" onclick="goProfile()">去「我的」设置所在地</span></div>';
      return;
    }
    /* 附近:汇总所有 destinationRecs 里离 loc 最近的 POI(演示用当前城市;可扩展多城) */
    var near = nearbyPois(loc);
    var html = '<div class="explore-head"><span>附近</span>' + sortToggleHTML("离我最近") + '</div>';
    html += '<div class="poi-group-label">🍽 好吃</div>' +
      (poiGroupHTML(near.dining, "dining", loc, near.city, [], "") || '<div class="empty-inline">附近暂无收录</div>');
    html += '<div class="poi-group-label">🎡 好玩</div>' +
      (poiGroupHTML(near.attractions, "attractions", loc, near.city, [], "") || '<div class="empty-inline">附近暂无收录</div>');
    box.innerHTML = html;
  });
}

/* 选出距 loc 最近城市的 POI(静态数据下的近似"附近") */
function nearbyPois(loc) {
  var best = null, bestD = Infinity, bestCity = "";
  Object.keys(APP_DATA.destinationRecs).forEach(function (city) {
    var r = APP_DATA.destinationRecs[city];
    if (!r.center) return;
    var d = haversineM(loc.lat, loc.lon, r.center.lat, r.center.lon);
    if (d < bestD) { bestD = d; best = r; bestCity = city; }
  });
  return best ? { dining: best.dining || [], attractions: best.attractions || [], city: bestCity }
              : { dining: [], attractions: [], city: "" };
}
```

- [ ] **Step 3: 样式**

```css
.place-switch{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px}
.place-chip{white-space:nowrap;font-size:12px;padding:6px 12px;border-radius:20px;background:var(--surface-1,#f0f0f0);color:var(--text-secondary)}
.place-chip.on{background:var(--primary);color:#fff}
.explore-head{display:flex;justify-content:space-between;align-items:center;margin:6px 2px 6px;font-size:15px;font-weight:500}
.sort-toggle{display:flex;background:var(--surface-1,#f0f0f0);border-radius:20px;padding:2px}
.sort-toggle span{font-size:12px;padding:5px 12px;border-radius:18px;color:var(--text-secondary)}
.sort-toggle span.on{background:var(--primary);color:#fff}
.poi-group-label{font-size:12px;font-weight:500;color:var(--text-secondary);margin:12px 2px 4px}
```

- [ ] **Step 4: 手动验证**

"推荐"tab:顶部 chip"附近"+ 各行程;授权定位后显示"好吃/好玩"分组,每项有评分+距离;点排序"好吃好玩"切成按评分排;拒绝定位显示兜底。

- [ ] **Step 5: 提交**

```bash
git add js/views-main.js css/screens.css
git commit -m "feat: explore tab nearby recommendations with switcher"
```

---

### Task 19: 目的地模式(提前规划,按酒店距离)

**Files:**
- Modify: `js/views-main.js`(`renderDestinationPlan`)

- [ ] **Step 1: 实现目的地规划视图**

在 `js/views-main.js` 加:

```js
function renderDestinationPlan(box, tripId) {
  var trip = getTrip(tripId);
  if (!trip) { box.innerHTML = '<div class="empty-state">行程不存在</div>'; return; }
  var recs = APP_DATA.destinationRecs[trip.city] ||
    APP_DATA.destinationRecs[String(trip.city).replace(/市$/, "")];
  if (!recs) {
    box.innerHTML = '<div class="empty-state">' + trip.city + ' 暂未收录推荐,可在行程详情添加想去清单</div>';
    return;
  }
  var hasHotel = trip.lodging && trip.lodging.lat != null;
  var anchor = hasHotel ? { lat: trip.lodging.lat, lon: trip.lodging.lon } : (recs.center || null);
  var wishNames = (trip.wishlist || []).map(function (w) { return w.name; });

  var html = '<div class="plan-banner">📅 ' + trip.city + ' · 提前规划' +
    (hasHotel ? ' · 距离基于你的酒店' : ' · 距离基于城市中心') + '</div>';
  html += '<div class="explore-head"><span>吃喝玩</span>' + sortToggleHTML(hasHotel ? "离酒店近" : "离中心近") + '</div>';
  html += '<div class="poi-group-label">🍽 好吃</div>' +
    poiGroupHTML(recs.dining || [], "dining", anchor, trip.id, wishNames, hasHotel ? "距酒店 " : "");
  html += '<div class="poi-group-label">🎡 好玩</div>' +
    poiGroupHTML(recs.attractions || [], "attractions", anchor, trip.id, wishNames, hasHotel ? "距酒店 " : "");
  html += '<button class="btn-secondary" style="width:100%;margin-top:14px;" onclick="openTripDetail(\'' + trip.id + '\')">→ 打开' + trip.city + '行程</button>';
  box.innerHTML = html;
}
```

样式追加:

```css
.plan-banner{background:var(--bg-accent,#E6F1FB);color:#0C447C;border-radius:10px;padding:9px 11px;margin:6px 0 10px;font-size:12px}
```

- [ ] **Step 2: 手动验证**

"推荐"tab 点"香港·8月":显示"提前规划 · 距离基于你的酒店"横幅;好吃/好玩按距酒店排序,POI 卡显示"距酒店 550m"式距离;切"好吃好玩"按评分排;点"打开香港行程"进详情;点 POI 进详情页。已在想去清单的项标"已想去"。

- [ ] **Step 3: 提交**

```bash
git add js/views-main.js css/screens.css
git commit -m "feat: destination planning mode by hotel distance"
```

---

### Task 20: 目的地发现列表(浏览未成行的城市)

**Files:**
- Modify: `js/views-main.js`(附近视图下追加"发现更多目的地")

- [ ] **Step 1: 发现区**

在 `renderNearby` 的 `box.innerHTML = html;` 之前,把发现区并入 html:

```js
    /* 发现更多:未在行程里的收录城市 */
    var tripCities = getTrips().map(function (t) { return t.city; });
    var discover = Object.keys(APP_DATA.destinationRecs).filter(function (c) {
      return tripCities.indexOf(c) === -1;
    });
    if (discover.length) {
      html += '<div class="poi-group-label">🌏 发现更多目的地</div>';
      discover.forEach(function (city) {
        var r = APP_DATA.destinationRecs[city];
        var cabinPrice = r.transport && r.transport.intercity && r.transport.intercity[0];
        var priceHint = "";
        if (cabinPrice) {
          var biz = (cabinPrice.cabins || []).find(function (c) { return c.class === "business"; });
          if (biz) priceHint = " · 商务舱约 " + biz.priceLocal;
        }
        html += '<div class="card trip-card" onclick="previewDestination(\'' + city + '\')">' +
          '<div class="trip-card-top"><span class="trip-city">' + city + '</span><span>›</span></div>' +
          '<div class="trip-dates">' + ((r.dining || []).length + (r.attractions || []).length) + ' 个推荐' + priceHint + '</div></div>';
      });
    }
```

- [ ] **Step 2: previewDestination(临时新建行程入口)**

最小实现:引导用户为该城市新建行程再规划(复用现有新建抽屉)。加:

```js
function previewDestination(city) {
  if (confirm("为「" + city + "」新建一个行程来规划吗?")) {
    openNewTripSheet();
    /* 预填城市名提示,用户在抽屉里搜索确认 */
    var input = document.getElementById("cs-input");
  }
}
```

> 说明:静态数据下,发现页目的地详情与"目的地模式"共用同一套 POI 渲染;完整"新建去这里的行程"预填在后续迭代增强,当前先复用新建抽屉,避免重复实现城市选择逻辑。

- [ ] **Step 3: 手动验证**

"推荐"tab 附近视图底部出现"发现更多目的地",列出不在行程里的收录城市(如无行程覆盖的城市),点击弹新建行程确认。

- [ ] **Step 4: 提交**

```bash
git add js/views-main.js
git commit -m "feat: discover more destinations in explore tab"
```

---

# 阶段六:收尾

### Task 21: 版本升级与缓存核对

**Files:**
- Modify: `sw.js`(确认 VERSION=v13 且含 recommend.js)
- Modify: `js/app.js:3`(`APP_VERSION`)

- [ ] **Step 1: 核对版本一致**

确认 `sw.js` 的 `VERSION = "v13"`、`ASSETS` 含 `"./js/recommend.js"`;`js/app.js:3` 的 `APP_VERSION = "v13"`。

- [ ] **Step 2: 全量测试**

Run: `node test/recommend.test.js && node test/sync.test.js && node test/encryption.test.js`
Expected: 三个都无报错退出。

- [ ] **Step 3: 手动全流程验证**

浏览器硬刷新(避免 SW 旧缓存):设喜好 → 交通/住宿/餐厅/景点随喜好变化 → POI 详情四类信息 → 推荐 tab 附近(授权/拒绝两条路径)→ 切目的地按酒店距离 → 想去清单联动。控制台无报错。

- [ ] **Step 4: 提交**

```bash
git add sw.js js/app.js
git commit -m "chore: bump app and cache version to v13"
```

---

### Task 22: 文档更新

**Files:**
- Modify: `CHANGELOG.md`、`HANDOFF.md`、`README.md`(功能列表)

- [ ] **Step 1: CHANGELOG 加 v13 条目**

在 `CHANGELOG.md` 顶部加:

```markdown
## v13 — 个性化推荐与推荐 tab

- 日期:2026-07-20
- 新增「出行喜好」档案(预算/舱位/住宿/口味/风格),纳入加密同步。
- 新增精选推荐数据 `destinationRecs`,POI 带坐标、评分、图片、地址、电话、网站、营业时间。
- 新增个性化引擎 `recommend.js`(距离/评分/喜好排序,舱位对比高亮),配单元测试。
- 行程详情页重构为「行程安排 + 为你推荐」两分区;交通/住宿升级为推荐驱动;餐厅/景点平铺并可点进 POI 详情。
- 新增「推荐」tab:实时定位的附近推荐(按距离/评分,好吃好玩分组),可切到行程目的地按酒店距离提前规划。
- 应用与离线缓存版本升级为 v13。
```

- [ ] **Step 2: HANDOFF 更新"当前状态"与"真机验证"**

把 `HANDOFF.md` 的"当前状态"更新为 v13 已完成、待真机验证;"后续验证"改为:喜好联动、定位授权/拒绝、目的地按酒店距离、POI 详情外链(地图/电话/网站)、跨设备同步喜好。

- [ ] **Step 3: README 功能列表补推荐/喜好/定位**

- [ ] **Step 4: 提交**

```bash
git add CHANGELOG.md HANDOFF.md README.md
git commit -m "docs: document v13 personalized recommendations"
```

---

## 自检清单(实现全程回看)

- [ ] 引擎纯函数全部有 TDD 覆盖(Task 1/6/7/8/9)。
- [ ] `prefs` 从 store → 同步 → 引擎 → UI 全链路打通(Task 2/3/4)。
- [ ] `geoLoc` 只在本机、坐标不外发、拒绝有兜底(Task 3/17)。
- [ ] POI 详情外链走 `target=_blank`/`tel:`,不静默跳转(Task 10)。
- [ ] 未收录城市 / 空行程 / 缺图片 各有兜底,不报错(Task 5/14/15/19)。
- [ ] `sw.js` VERSION 与 `APP_VERSION` 一致且含 `recommend.js`(Task 11/21)。
- [ ] 函数名跨 Task 一致:`normalizePrefs`/`haversineM`/`orderCabins`/`rankLodging`/`rankPois`/`poiWhy`/`renderPoiCard`/`renderPoiDetail`/`renderRecTransport`/`renderRecLodging`/`openPoiDetail`/`closePoiDetail`/`renderExplore`。
