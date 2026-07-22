# v16 实施计划：修港澳台判定 + OSM 口味映射

制定日期：2026-07-22 ｜ 基线：`main` @ `80f52ab`（v15 已发布）

本文件是给编码方（ChatGPT）的**自包含**任务说明。阅读者读不到制定它的会话上下文，所以下面包含全部必要的现状代码、判断依据与验收标准。

**通用约束（两个任务都适用）：**

- 项目是无构建工具的原生 JS 静态站，`var` 风格、ES5 语法，不引入任何依赖、不改文件结构。
- `js/recommend.js` 同时在浏览器（普通 `<script>`）和 Node（`module.exports`）下运行，新增的导出函数必须挂到文件末尾的 `module.exports` 里。
- 不要新增功能，只做本文件写明的修正。
- 不要伪造数据：拿不到权威值的字段留空，由渲染层跳过——这是 v15 刚确立的原则，别退回去。
- 改完 `js/app.js` 的 `APP_VERSION` 与 `sw.js` 的 `VERSION` 一起升到 `"v16"`。
- 交付前必须跑完文末的检查清单，并把实际输出贴出来。

---

## Task A：`outOfChina()` 把港澳台误判为中国大陆（优先级最高）

### 现状

`js/recommend.js` 第 92 行起有区域路由。判定函数是一个粗略国界盒：

```js
/* 粗略国界盒。境外直接返回原坐标,不做偏移。 */
function outOfChina(lat, lon) {
  return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271;
}
```

它有两个使用点：

1. `js/recommend.js` 的 `mapLink()` / `mapProviderName()` —— 决定地图入口给高德还是 OpenStreetMap。
2. `js/views-main.js` 的 `renderNearby()` —— 决定是否显示这条横幅：

```js
if (!outOfChina(loc.lat, loc.lon)) {
  html += '<div class="nearby-privacy warn">⚠️ 当前位置在中国大陆，附近数据来自 OpenStreetMap，收录不全，仅供参考。地图链接已切换为高德并做过坐标纠偏。</div>';
}
```

### 问题

香港（约 22.30, 114.17）、澳门（约 22.19, 113.54）、台湾（约 23.7, 121.0）都落在这个盒子里，于是：

- 香港会被显示「⚠️ 当前位置在中国大陆…OSM 收录不全」——**事实错误**，香港的 OSM 收录相当完整；
- 香港/澳门/台湾的 POI 地图入口被强制切到高德，而这些地区 OpenStreetMap 完全可用且对旅行者更合适。

香港是本项目内置数据最完整的行程（`js/data.js` 里 `visaRules["香港"]` 与整套香港 trip 数据），这条缺陷会被直接看到。

### 要求

1. 新增 `inMainlandChina(lat, lon)`：在原有国界盒判定为「境内」的基础上，再排除下列三个矩形范围，落在其中的返回 `false`：
   - 香港：纬度 22.13–22.58，经度 113.82–114.44
   - 澳门：纬度 22.10–22.22，经度 113.52–113.60
   - 台湾：纬度 21.85–25.35，经度 119.30–122.05
   坐标为 `null`/`undefined` 时返回 `false`（未知位置不当作大陆处理）。
2. **`mapLink()` 与 `mapProviderName()` 改用 `inMainlandChina()`**：只有真正的中国大陆走高德，港澳台与境外一律走 OpenStreetMap。
3. **GCJ-02 转换的调用条件同步收紧**：`wgs84ToGcj02()` 只在生成高德链接时调用。`outOfChina()` 本身与 `wgs84ToGcj02()` 内部的守卫**保持原样不动**（它是坐标系算法的固有边界，不是行政区划判断），只是不再有代码路径让港澳台坐标进入转换。
4. `js/views-main.js` 的横幅判断改成 `if (inMainlandChina(loc.lat, loc.lon))`。文案保持不变。
5. `inMainlandChina` 加入 `module.exports`。`outOfChina` 的导出保留（已有测试依赖它）。

### 验收标准（在 `test/recommend.test.js` 末尾、`console.log("Task1 OK")` 之前追加）

```js
/* 港澳台不是中国大陆:地图走 OSM,不加 GCJ 偏移,不显示大陆横幅 */
assert.strictEqual(rec.inMainlandChina(31.2304, 121.4737), true, "上海是大陆");
assert.strictEqual(rec.inMainlandChina(39.9042, 116.4074), true, "北京是大陆");
assert.strictEqual(rec.inMainlandChina(22.3027, 114.1772), false, "香港不是大陆");
assert.strictEqual(rec.inMainlandChina(22.1987, 113.5439), false, "澳门不是大陆");
assert.strictEqual(rec.inMainlandChina(25.0330, 121.5654), false, "台北不是大陆");
assert.strictEqual(rec.inMainlandChina(-33.8688, 151.2093), false, "悉尼不是大陆");
assert.strictEqual(rec.inMainlandChina(null, null), false, "坐标缺失不算大陆");

var hkLink = rec.mapLink(22.3027, 114.1772, "维多利亚港");
assert.ok(hkLink.indexOf("openstreetmap.org") !== -1, "香港用 OSM");
assert.ok(hkLink.indexOf("amap.com") === -1, "香港不得用高德");
assert.ok(hkLink.indexOf("22.3027") !== -1, "香港链接用未偏移的原始坐标");
assert.strictEqual(rec.mapProviderName(22.3027, 114.1772), "OpenStreetMap");
assert.strictEqual(rec.mapProviderName(31.2304, 121.4737), "高德地图");
```

已有的上海/悉尼断言必须继续通过。

---

## Task B：OSM `cuisine` 与本项目口味分类做映射

**前置：Task A 完成后再做**（B 要用到 `inMainlandChina`）。

### 现状

本项目的口味偏好有 5 个，定义在 `js/views-main.js:734`：

```js
cuisine: [["local","本地菜"],["halal","清真"],["vegetarian","素食"],["spicy","嗜辣"],["trending","网红店"]]
```

`js/recommend.js` 用它做两件事——`poiWhy()` 生成「贴合你的 X 偏好」文案（第 59 行起），`rankPois()` 用 `_hit` 把命中项排前面（第 72 行起）。两者都是直接比对 `poi.cuisineTags`。

而「附近」的 POI 由 `osmElementToPoi()` 生成，`cuisineTags` 直接取 OSM 原始值（第 189 行）：

```js
cuisineTags: tags.cuisine ? tags.cuisine.split(/[;,]/) : [],
```

OSM 的 `cuisine` 值是 `chinese`、`pizza`、`sushi`、`noodle` 这类**菜系名**，和本项目的 `local/halal/vegetarian/spicy/trending` 这套**偏好维度**根本不是一个体系，命中率近乎为零。用户勾了口味偏好，对附近餐馆完全不起作用。

### 关键判断（先看懂再动手，不要想当然）

1. **清真和素食不在 `cuisine` 标签里**。OSM 用独立的 diet 标签：`diet:halal=yes`、`diet:vegetarian=yes`/`only`、`diet:vegan=yes`/`only`。只解析 `cuisine` 永远匹配不到这两项。`osmElementToPoi()` 拿得到完整 `tags` 对象，直接读即可。
2. **`local`（本地菜）依赖所在地**。`cuisine=chinese` 在中国大陆是本地菜，在东京不是。本项目对「附近」只有设备坐标、没有可靠的国家信息，能可靠判断的只有「是否中国大陆」（Task A 的 `inMainlandChina`）。**所以：只在中国大陆把中餐系菜系判为 `local`；其他地区判不出来就不判**，绝不为了让功能"看起来生效"而乱贴标签。
3. **`trending`（网红店）在 OSM 里没有任何对应数据**。OSM 没有热度、评分、点评量。**不要映射，不要拿 `amenity=cafe`、连锁品牌之类的东西凑数。** 保持这一项对附近餐馆不生效，并在下面第 4 条里向用户讲明。
4. **`spicy`（嗜辣）**可从菜系推断：`sichuan`、`hunan`、`chongqing`、`korean`、`thai`、`indian`、`mexican` 属于普遍偏辣的菜系。这是推断不是事实，可以用于排序，但 `poiWhy()` 的文案要留有余地（例如「川菜，通常偏辣」而不是「贴合你的嗜辣偏好」）。

### 要求

1. 在 `js/recommend.js` 新增 `osmTagsToCuisineTags(tags, anchorLat, anchorLon)`，返回本项目分类数组（可能为空数组）：
   - 读 `tags["diet:halal"]`，值为 `yes`/`only` → 加 `halal`
   - 读 `tags["diet:vegetarian"]` 与 `tags["diet:vegan"]`，值为 `yes`/`only` → 加 `vegetarian`
   - 解析 `tags.cuisine`（按 `[;,]` 拆分、小写、去空格）：
     - 命中辣味菜系表 → 加 `spicy`
     - 命中中餐系表（`chinese`、`sichuan`、`hunan`、`cantonese`、`dumpling`、`noodle`、`hotpot`、`shandong`、`jiangzhe`、`xinjiang` 等）**且** `inMainlandChina(anchorLat, anchorLon)` 为真 → 加 `local`
   - 永不产出 `trending`
   - 结果去重
2. `osmElementToPoi(el, kind, anchor)` 改用它：`cuisineTags: osmTagsToCuisineTags(tags, anchor && anchor.lat, anchor && anchor.lon)`。原始 OSM 菜系名保留到新字段 `rawCuisine`（字符串，无则空串），供 `desc` 与详情页显示，**不要**再混进 `cuisineTags`。
3. `poiWhy()` 对 `spicy` 用推断口吻的文案（见上面第 4 条），`local`/`halal`/`vegetarian` 沿用现有「贴合你的 X 偏好」。
4. `js/views-main.js` 的 `renderNearby()`：当用户勾选了 `trending` 时，在结果区顶部加一条提示，说明附近数据源没有热度信息、该项偏好对附近餐馆不生效（复用已有的 `.nearby-privacy` 样式，不要新造样式类）。
5. 精选静态数据（`js/data.js` 的 `destinationRecs`）的 `cuisineTags` 是人工维护的本项目分类，**不受本次改动影响**，不要动。

### 验收标准（追加到 `test/recommend.test.js`）

```js
/* OSM 标签 → 本项目口味分类 */
var hkTags = { cuisine: "chinese;cantonese" };
assert.deepStrictEqual(rec.osmTagsToCuisineTags(hkTags, 22.3027, 114.1772), [], "香港不判 local(非大陆)");
assert.ok(rec.osmTagsToCuisineTags(hkTags, 31.2304, 121.4737).indexOf("local") !== -1, "上海的中餐算 local");

assert.ok(rec.osmTagsToCuisineTags({ "diet:halal": "yes" }, 31.2, 121.4).indexOf("halal") !== -1);
assert.ok(rec.osmTagsToCuisineTags({ "diet:vegetarian": "only" }, 31.2, 121.4).indexOf("vegetarian") !== -1);
assert.ok(rec.osmTagsToCuisineTags({ "diet:vegan": "yes" }, 31.2, 121.4).indexOf("vegetarian") !== -1);
assert.ok(rec.osmTagsToCuisineTags({ cuisine: "sichuan" }, 31.2, 121.4).indexOf("spicy") !== -1);
assert.ok(rec.osmTagsToCuisineTags({ cuisine: "thai" }, 13.75, 100.5).indexOf("spicy") !== -1);

/* trending 永不产出;无相关标签则为空 */
var all = rec.osmTagsToCuisineTags({ cuisine: "chinese;sichuan", "diet:halal": "yes" }, 31.2, 121.4);
assert.strictEqual(all.indexOf("trending"), -1, "OSM 无热度数据,不得产出 trending");
assert.strictEqual(all.length, new Set(all).size, "结果需去重");
assert.deepStrictEqual(rec.osmTagsToCuisineTags({ cuisine: "pizza" }, 48.85, 2.35), [], "无对应分类返回空");
assert.deepStrictEqual(rec.osmTagsToCuisineTags({}, 31.2, 121.4), []);

/* osmElementToPoi 接线正确,原始菜系名单独保留 */
var poi = rec.osmElementToPoi(
  { type: "node", id: 1, lat: 31.2305, lon: 121.4738, tags: { name: "某川菜馆", cuisine: "sichuan" } },
  "dining", { lat: 31.2304, lon: 121.4737 });
assert.ok(poi.cuisineTags.indexOf("spicy") !== -1);
assert.ok(poi.cuisineTags.indexOf("sichuan") === -1, "原始 OSM 菜系名不得混进 cuisineTags");
assert.strictEqual(poi.rawCuisine, "sichuan");
assert.strictEqual(poi.priceLevel, null, "v15 原则:无权威数据的字段保持留空");
assert.strictEqual(poi.durationH, null);
```

---

## 交付前必检（贴出实际输出）

```text
node --check js/sync.js
node --check js/app.js
node --check js/recommend.js
node --check js/views-main.js
node --check js/views-trip.js
node --check js/data.js
node test/recommend.test.js
node test/sync.test.js
node test/encryption.test.js
git diff --check
```

`test/recommend.test.js` 末尾应仍打印 `Task1 OK`，三个测试文件全部零退出。

---

## 本次不做（已明确排除，别顺手扩展）

- **不接高德/百度 POI**：需注册账号、key 会暴露在前端、可能需中转服务，已决定维持 OpenStreetMap。
- **附近景点的「出行风格」匹配**：v15 把 OSM 景点的 `bestFor` 置为 `[]`，所以 `travelStyle` 偏好对附近景点同样不生效。OSM 没有可靠依据推断游玩节奏，本轮不处理，留待后续决定是否要在 UI 上向用户说明。
- 任何新功能、任何 UI 重构。
