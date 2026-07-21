# 当前交接

更新日期：2026-07-21

## 当前状态

- 分支 `fix/region-aware-location`，提交 `f53230b`，版本 v15。**尚未合并 main、尚未发布。**
- 线上仍是 v14：https://yangboryo.github.io/travel-planner/
- 本轮做的是「按区域路由定位与地图」+「清除伪造数据」，没有新增功能。

## 本轮改了什么

1. **坐标系纠偏**：新增 WGS-84 → GCJ-02 转换。此前把原始 GPS 坐标直接给地图，在中国大陆偏移约 480 米——这是"位置不准"的主因。
2. **地图按区域切换**：境内用高德 `uri.amap.com`（坐标已纠偏），境外用 OpenStreetMap。**全项目已无 Google 地图链接**（境内不可用）。
3. **停止伪造 POI 数据**：`priceLevel`、`durationH`、`bestFor` 原本被硬编码，导致每个 OSM 地点都显示假的 `$$`、`1.5h` 和毫无依据的"为你推荐"理由。现在没有数据就不显示。
4. **官网与资料来源分离**：不再拿 OSM 页面或 Google 地图搜索链接冒充商家官网。
5. **定位质量**：开启 `enableHighAccuracy`，旧坐标缓存窗口从 10 分钟收到 1 分钟；不再拿手填城市名给实测坐标贴标签（会张冠李戴）。
6. **附近排序**：撤掉"好吃好玩"排序（OSM 无评分，切换后顺序完全不变，是空转）。改为固定按距离，并显示定位精度；境内额外提示 OSM 收录稀疏。

## 已验证

- 5 个 JS 文件语法通过；`recommend`/`sync`/`encryption` 三个测试全过。
- 渲染层端到端验证 14 项全过（境内走高德且坐标纠偏、境外走 OSM、不再输出伪造价位/时长/理由、精选数据的真实评分价位不受影响）。
- 上海坐标实测偏移 481 米，与预期一致。

## 尚未解决

1. **v15 未真机验证**：定位允许/拒绝、手填位置回退、高德链接在手机上能否正确唤起、PWA 缓存刷新。
2. **国内 POI 数据源未换**：附近推荐在中国大陆仍走 OpenStreetMap，收录稀疏。已决定"先做不需 key 的部分"，接高德/百度 POI 的决定仍待做（需注册账号、key 会暴露在前端、可能需中转）。
3. **口味偏好对附近餐馆不生效**：OSM 的 `cuisine` 值（`chinese`/`pizza`）与本项目的 `local/halal/vegetarian/spicy/trending` 分类对不上，命中率近乎为零。未修。
4. 用户反馈可能还有其他体验问题，未逐项收集。

## 下次开始方式

从本文件开始。优先级：**真机验证 v15 → 合并发布 → 国内 POI 数据源决策 → 口味偏好映射**。先复现再改代码，不主动扩展功能。

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
