# 个性化推荐重构 — 设计文档

> 历史设计归档：本文记录 v13 个性化推荐的设计背景，不是当前状态或待办清单。当前结论以项目根目录 `HANDOFF.md` 为准。

日期:2026-07-20

## 目标

在现有 v12 出行助理基础上,引入**个性化推荐**能力,让 App 从"信息记录工具"升级为"会替你安排的助理"。核心是一套共享的**个性化引擎 + 推荐渲染组件**,同时喂给三个场景:

1. **新增「推荐」tab** — 支持"附近(实时定位)"与"行程目的地(提前规划)"切换,按距离/评分推荐好吃好玩,并可浏览目的地四大模块。
2. **重构行程详情页** — 从"一长串折叠卡"改成"行程安排 + 为你推荐"两分区,交通/住宿/餐厅/景点按定位和喜好个性化。
3. **POI 详情页** — 餐厅/景点可点进,查看图片、地址、电话、网站、营业时间。

主打**个性化**:同一份精选数据,按用户喜好 + 实时定位筛选、排序、高亮。

## 关键背景与约束

- 现状:纯 vanilla JS 的 PWA,无框架;`data.js` 全是 mock 数据;已接天气/地理编码免费 API;加密跨设备同步(护照数据)。
- 用户档案现只有 `passport`(国籍、护照有效期、常住地 `homeLoc`、当前所在地 `currentLoc`),**无任何喜好字段**。
- 视觉沿用现有清新蓝白 iOS 风(白底 + 蓝 `#4A90D9`/`#185FA5` 强调、圆角卡片),基准设备 iPhone 竖屏。
- 本期不改动同步加密机制,只把新增用户数据(`prefs`)纳入现有同步与合并。

## 决策(已与用户确认)

| 决策点 | 选择 |
|---|---|
| 推荐数据来源 | **精选静态数据**(存 `data.js`,以后可无痛换真实 API/大模型) |
| 「推荐」tab 定位 | **目的地发现页 + 附近推荐**(与行程解耦的独立探索入口) |
| 喜好维度 | **四维全上**:预算档次、舱位与座位偏好、住宿类型偏好、口味与出行风格 |
| 行程详情页重构 | **两分区**:行程安排(规划卡折叠)+ 为你推荐(平铺展开) |
| 推荐模块展开 | 目的地四大模块**直接平铺**,不再点进列表 |
| POI 详情 | 餐厅/景点**可点进详情页**,含图片、地址、电话、网站、营业时间 |
| 定位 | 打开时**实时定位**,按距离/评分推荐;可切到行程目的地按酒店距离规划 |

## 诚实的取舍

- **静态数据无法覆盖"任意出发地→任意目的地"的真实实时票价**。交通模块以**目的地**为主存储:当地交通 + 典型跨城舱位价位带(经济舱/商务舱参考区间);出发地用 `currentLoc`/`geoLoc` 标注;价格标"参考价",复用现有汇率双币显示。
- **POI 的图片、地址、电话、网站、评分需为每个点手工录入**,数据量不小。接口设计好,阶段二可替换为真实 Places API。
- **图片联网加载**,离线用占位图兜底(PWA 不缓存第三方图片)。
- 数据层统一抽象,阶段二可整体替换为真实 API 而不动 UI。

---

## 架构:三层

```
数据层 (data.js)               —— prefs 默认值 + destinationRecs 精选数据
个性化引擎 + 渲染 (recommend.js) —— 距离/评分/喜好 打分排序 + 推荐卡与详情渲染(共享)
视图层                          —— 推荐 tab(views-main) + 行程详情(views-trip) 各自调用共享组件
```

新增 `js/recommend.js` 是核心:个性化逻辑与推荐卡渲染只写一份,被"推荐"tab、行程详情页、POI 详情共用,保证 DRY 且可单测。

---

## 1. 喜好档案(个性化地基)

`STATE` 新增 `prefs`,与 `passport` 一样纳入加密同步:

```js
prefs: {
  budgetTier: "comfort",          // "economy" | "comfort" | "luxury"
  cabinClass: "economy",          // "economy" | "premium" | "business"
  lodgingTypes: ["hotel"],        // 多选: hotel|boutique|hostel|resort|apartment
  lodgingLocation: "central",     // "central" | "near-transit" | "quiet"
  cuisine: [],                    // 多选: local|halal|vegetarian|spicy|trending
  travelStyle: "balanced"         // "packed" | "balanced" | "relaxed"
}
```

- "我的"页新增**「出行喜好」卡片**,可点击编辑(沿用现有 `prompt`/底部抽屉范式,多选用抽屉多选)。
- **不做独立引导向导**(YAGNI)。未设置时用中庸默认值,推荐仍可正常工作。
- 旧存档迁移:`app.js` 启动时若缺 `prefs` 则补默认值(同现有 `passport` 兼容逻辑)。

## 2. 实时定位(`geoLoc`)

- 打开 App(或首次进入"推荐"tab)时调用浏览器 **Geolocation API** 获取实时位置,存 `STATE.geoLoc = { lat, lon, name, at }`。
- **仅本机、不同步**(是设备当前状态,非用户资料)。
- 隐私:坐标只在本机做距离计算(haversine)与已有的天气/地理编码 API;**不外发给任何第三方**。授权请求带清晰说明,遵循最小化原则。
- 兜底链:`geoLoc`(授权) → `passport.currentLoc`(手填) → 提示"用『我的』里的所在地"。
- 反向地理编码得到城市名用于顶部显示(复用现有 geocoding 接口)。

## 3. 精选推荐数据(`data.js` 扩展)

现有 `localRecommendations[城市] = {spots, food}` 升级为结构化 `destinationRecs`:

```js
destinationRecs["香港"] = {
  center: { lat: 22.30, lon: 114.17 },   // 城市中心,无酒店时算距离用
  transport: {
    intercity: [ // 怎么去(以 currentLoc/geoLoc 为出发点标注)
      { mode: "flight", label: "直飞", durationH: 2.5,
        cabins: [
          { class: "economy",  priceLocal: 1400, note: "含税参考" },
          { class: "business", priceLocal: 4600, note: "含税参考" } ],
        tip: "提前 6 周订价更优" } ],
    local: [ { mode: "metro", name: "八达通", priceRange: "…", tier: "economy", tip: "…" } ]
  },
  lodging: [
    { name: "唐楼精品酒店", type: "boutique", area: "中环",
      pricePerNight: 1850, tier: "comfort", location: "near-transit",
      lat: 22.28, lon: 114.15, tags: ["精品","近地铁"], desc: "…" } ],
  dining: [
    { name: "添好运点心", cuisineTags: ["local"], priceLevel: 1, rating: 4.6,
      michelin: true, area: "深水埗", lat: 22.33, lon: 114.16,
      image: "https://…", address: "深水埗福荣街 9-11 号地铺",
      phone: "+852 2788 1226", website: "https://timhowan.com",
      hours: "10:00–21:30 · 每日营业",
      desc: "…", why: "" } ],  // why 由引擎按 prefs 动态生成
  attractions: [
    { name: "维多利亚港", category: "夜景", durationH: 1.5, rating: 4.8,
      lat: 22.29, lon: 114.17, image: "https://…",
      address: "尖沙咀海滨长廊", phone: "", website: "",
      hours: "全天", desc: "…", tips: "20:00 灯光秀,傍晚去最好",
      bestFor: ["packed","balanced","relaxed"] } ]
}
```

- 迁移:保留现有城市的 `spots`/`food` 内容映射进 `attractions`/`dining`(缺的新字段先留空/占位,不丢数据)。
- 未收录城市:沿用现有"探索方向"兜底,四模块各给通用建议,避免空白。

## 4. 个性化引擎(`recommend.js`,纯函数 + 单测)

输入 `(destinationRec, prefs, context)`,`context = { origin, anchor, sort }`(origin=出发地,anchor=距离基准点[酒店或 geoLoc],sort=`distance|rating`),输出排序/标注后的列表:

- **交通**:`intercity` 默认展开 `prefs.cabinClass` 对应舱位并置顶高亮,并列显示其他舱位价格对比;`local` 按 `budgetTier` 排序。
- **住宿**:按 `lodgingTypes` 命中过滤(空则不过滤),再按 `budgetTier`(价位贴近偏好档)+ `lodgingLocation` 匹配打分排序,命中项打"贴合你的喜好"标签并生成一句理由。
- **餐厅 / 景点**:
  - `sort=distance`:按 `anchor` 的 haversine 距离升序。
  - `sort=rating`(好吃好玩):按 `rating` 降序;景点再叠加 `travelStyle` 命中 `bestFor`。
  - 餐厅按 `cuisine` 标签命中加权;每项生成"为你"理由(如"贴合你的本地菜偏好")。
- **距离基准 `anchor`**:附近模式=`geoLoc`;目的地模式=该行程 `lodging` 坐标,无酒店回退 `center`。
- 每条推荐带 `distanceM`、`rating`、`priceLevel`、`why` 供渲染。

单测(`test/recommend.test.js`):舱位默认展开与高亮、住宿过滤+排序、餐厅口味加权、`distance`/`rating` 两种排序、`travelStyle` 影响景点、prefs 全空默认行为、haversine 正确性。

## 5. 推荐渲染组件(`recommend.js`)

共享 HTML 渲染,多处复用:

- `renderRecTransport(rec, prefs, ctx)` — 舱位价格对比卡(高亮偏好舱位,双币)。
- `renderRecLodging(rec, prefs, ctx)` — 住宿推荐(每晚价/区域/类型/贴合标签)。
- `renderPoiCard(poi, ctx)` — 餐厅/景点列表卡(名称、价位符号 `$/$$$`、⭐评分、距离、简介、"为你"理由、想去按钮)。可点 → POI 详情。
- `renderPoiDetail(poi, ctx)` — **POI 详情页/抽屉**:图片(联网+占位兜底)、名称价位标签、简介、"为你"理由、信息行(地址→地图 / 电话→呼叫 / 网站→打开 / 营业时间)、加入想去 / 排入日程。
- 卡片动作沿用现有 `wishlist` 机制(`addRecToWish`);已在清单的标"已想去"。

## 6. 「推荐」tab(新 `screen-explore`)

`index.html` 底部 Tab Bar 加第 4 项 **🧭 推荐**;新增 `<section id="screen-explore">`。结构:

1. **地点切换器**(顶部横向 chip):`附近·<定位城市>`(默认)/ 各即将出行行程目的地(`香港·8月`…)。
2. **附近模式**(选中"附近"):
   - 排序切换 `离我最近 / 好吃好玩`。
   - **好吃 / 好玩分两组**推荐,每卡显示 ⭐评分 + 步行距离 + 价位/时长。
   - 未授权定位 → 兜底提示用手填所在地。
3. **目的地模式**(选中某行程):
   - 提示条"提前规划 · 距离基于你的酒店"。
   - 排序 `离酒店近 / 好吃好玩`,好吃/好玩分组(距离相对酒店)。
   - 底部"打开 XX 行程"入口。
   - 也可展开该目的地的交通/住宿(平铺,复用共享组件)。
4. **目的地发现**(切换器之外的浏览):按喜好挑选的目的地卡列表 → 目的地详情(四大模块平铺 + "新建去这里的行程"/"加入想去")。
- 导航:`app.js` tab 点击逻辑加 `screen-explore` 分支,调用 `renderExplore()`。

## 7. 行程详情页重构(两分区)

`views-trip.js` 的 `renderSections` 改为按分区组织:

- **区一 · 行程安排**(保留现有规划卡片,折叠摘要态):
  天气 / 待办时间线 / 智能打包 / 每日日程 / 预算 / 紧急信息卡 / 目的地贴士。
- **区二 · 为你推荐**(平铺展开,按 `prefs` 个性化;分区标题带喜好摘要如"商务舱·精品住宿·本地菜"):
  - 🚄 **交通**:定位推荐方式 + **商务舱/经济舱价格对比**(高亮偏好舱位);保留"我的航班"手动录入与购票平台入口。
  - 🏨 **住宿**:已订酒店(标"已预订"置顶)+ 喜好筛选的精选推荐(每晚价/区域/类型/理由)。
  - 🍜 **餐厅** & 🏞 **景点**:现有推荐平铺 — 价位符号、评分、时长、"为什么推荐给你"、个性化排序;每项可点进 POI 详情;"想去/排入日程"沿用 `wishlist`。
- "想去清单"仍作为承接推荐的落点,`addRecToWish` 复用。

---

## 数据流

```
打开 App → Geolocation → STATE.geoLoc(本机)
用户在"我的"设喜好 → STATE.prefs → saveState/加密同步
                           │
推荐 tab / 行程详情 渲染 ────┴→ recommend.js 引擎(destinationRec + prefs + context)
                           → 共享渲染组件(卡片 / POI 详情)
用户点"加入想去" → trip.wishlist → saveState
```

## 涉及文件

| 文件 | 改动 |
|---|---|
| `index.html` | 加第 4 tab(🧭 推荐)+ `screen-explore` 屏;引入 `recommend.js` |
| `js/data.js` | `prefs` 默认值 + `destinationRecs`(POI 带 image/address/phone/website/hours/lat/lon/rating,迁移现有推荐) |
| `js/recommend.js` | **新增** — 距离/评分/喜好引擎 + 推荐卡与 POI 详情渲染 |
| `js/app.js` | prefs 读写 + 迁移;`geoLoc` 定位获取与兜底;`screen-explore` 导航分支;haversine 工具 |
| `js/views-main.js` | "我的"页「出行喜好」卡;`renderExplore()` 推荐页(切换器/附近/目的地) |
| `js/views-trip.js` | 详情页两分区;交通/住宿卡升级;餐厅/景点接 POI 详情 |
| `js/sync.js` | 合并规则纳入 `prefs`(对象递归合并);`geoLoc` 不同步 |
| `sw.js` | 升 `APP_VERSION`(v13);缓存清单加 `recommend.js`;不缓存第三方图片 |
| `test/recommend.test.js` | **新增** — 引擎排序/过滤/距离/评分/舱位高亮测试 |

## 错误处理与边界

- `prefs`/字段缺失 → 用默认值,推荐不崩。
- 定位被拒/超时 → 回退手填所在地;都没有则隐藏"附近"距离、只按评分推荐并提示设置。
- POI 图片加载失败 / 离线 → 占位图。
- 未收录城市 → 四模块通用兜底。
- 汇率缺失币种 → 沿用现有回退。
- 外部链接(地图/网站/电话)→ 走系统确认,不静默跳转。

## 测试策略

- `recommend.test.js` 覆盖引擎全部规则(见第 4 节)。
- `sync.test.js` 补一条:`prefs` 参与合并且不丢字段;`geoLoc` 不进云端。
- 真机验证(沿用 HANDOFF 流程):授权定位后看"附近"好吃好玩排序;切到行程目的地按酒店距离;POI 详情图片/地址/电话/网站;设喜好后详情页与推荐排序随之变化;跨设备同步喜好。

## 分期(建议实现顺序)

1. **地基**:`prefs` 模型 + 迁移 + "我的"喜好卡 + 同步合并。
2. **数据 + 引擎**:`destinationRecs`(含 POI 新字段)+ `recommend.js` 引擎 + haversine + 单测。
3. **共享渲染**:推荐卡 + POI 详情页组件。
4. **行程详情重构**:两分区 + 交通/住宿/餐厅/景点(先在已有数据城市验证)。
5. **推荐 tab**:定位获取 + `screen-explore`(切换器/附近/目的地/发现)。
6. **收尾**:升版本、缓存、真机验证、CHANGELOG/HANDOFF。

## 不在本期范围

- 真实航班/酒店/餐厅/Places API(接口预留,阶段二接入)。
- 大模型实时生成推荐。
- 独立喜好引导向导(用可编辑卡片替代)。
- 推荐 tab 的跨城"为你推荐 feed"(本期做按目的地/附近浏览的发现页)。
- 地图内嵌(外链到系统地图 App)。
