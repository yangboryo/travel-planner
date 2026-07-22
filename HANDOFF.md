# 当前交接

更新日期：2026-07-22

## 当前状态

- `main` 分支，提交 `89d4f9d`，版本 **v15，已合并并推送发布**。
- 线上：https://yangboryo.github.io/travel-planner/
- v15 做的是「按区域路由定位与地图」+「清除伪造数据」，没有新增功能。

## v15 改了什么

1. **坐标系纠偏**：新增 WGS-84 → GCJ-02 转换。此前把原始 GPS 坐标直接给地图，在中国大陆偏移约 480 米——这是"位置不准"的主因。
2. **地图按区域切换**：境内用高德 `uri.amap.com`（坐标已纠偏），境外用 OpenStreetMap。全项目已无 Google 地图链接（境内不可用）。
3. **停止伪造 POI 数据**：`priceLevel`、`durationH`、`bestFor` 原本被硬编码，导致每个 OSM 地点都显示假的 `$$`、`1.5h` 和毫无依据的"为你推荐"理由。现在没有数据就不显示。
4. **官网与资料来源分离**：不再拿 OSM 页面或 Google 地图搜索链接冒充商家官网。
5. **定位质量**：开启 `enableHighAccuracy`，旧坐标缓存窗口从 10 分钟收到 1 分钟；不再拿手填城市名给实测坐标贴标签（会张冠李戴）。
6. **附近排序**：撤掉"好吃好玩"排序（OSM 无评分，切换后顺序完全不变，是空转）。改为固定按距离，并显示定位精度；境内额外提示 OSM 收录稀疏。

## 已验证（2026-07-22 发布前复跑）

- 6 个 JS 文件语法通过；`recommend`/`sync`/`encryption` 三个测试全过；`git diff --check` 干净。
- `js/recommend.js` 在 `index.html` 与 `sw.js` 预缓存列表中均已就位，加载顺序早于 `views-main.js`。
- 渲染层端到端验证 14 项全过（境内走高德且坐标纠偏、境外走 OSM、不再输出伪造价位/时长/理由、精选数据的真实评分价位不受影响）。
- 上海坐标实测偏移 481 米，与预期一致。

**验证方式的限制**：本地起静态服务器后，Claude 的浏览器面板读不到 `Documents` 下的文件（沙箱限制，表现为全部 404），因此没有做成浏览器内的点击验证。上述渲染验证是用 Node 把 `recommend.js` 当浏览器脚本执行、检查真实 HTML 输出完成的。不必再尝试 preview 服务器，直接用 Node 验证渲染 + 真机验证交互。

## 尚未解决

1. **港澳台被误判为中国大陆（v15 引入，优先级最高）**
   `outOfChina()` 用的是粗略国界盒（经度 72–137.83，纬度 0.83–55.83），香港、澳门、台湾都落在盒内，于是：
   - "附近"页会对香港显示「⚠️ 当前位置在中国大陆…OSM 收录不全」——事实错误，香港的 OSM 收录很完整；
   - 香港 POI 的地图入口被强制切到高德，而 OSM/常规地图在港澳台可用且更合适。

   香港是本项目内置数据最完整的行程，这条会直接被看到。修法：拆出 `inMainlandChina()`，把港澳台排除在"大陆"判定之外，用它决定**横幅文案与地图供应商**；GCJ-02 坐标转换只在真正生成高德链接时才做。

2. **v15 未真机验证**：定位允许/拒绝、手填位置回退、高德链接在手机上能否正确唤起、PWA 缓存刷新。
3. **国内 POI 数据源维持现状**：附近推荐在中国大陆继续走 OpenStreetMap，收录稀疏。已决定不接高德/百度 POI（需注册账号、key 会暴露在前端、可能需中转），等后续确有需要再改。
4. **口味偏好对附近餐馆不生效**：OSM 的 `cuisine` 值（`chinese`/`pizza`）与本项目的 `local/halal/vegetarian/spicy/trending` 分类对不上，命中率近乎为零。因数据源确定维持 OSM，此项已可动工——做 OSM `cuisine` → 本项目分类的映射表。
5. 用户反馈可能还有其他体验问题，未逐项收集。

## 下次开始方式

从本文件开始。优先级：**修港澳台判定 → 口味偏好映射 → 真机验证 → 发 v16**。先复现再改代码，不主动扩展功能。

## 修改后必检

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

发布时同时提升 `js/app.js` 的 `APP_VERSION` 与 `sw.js` 的 `VERSION`。
