# 当前交接

更新日期：2026-07-20

## 当前状态

- 今天的测试已结束，当前线上与 `main` 保持 v14。
- v14 产品提交：`300ecd7`；文档整理前提交：`6547762`。
- 线上地址：https://yangboryo.github.io/travel-planner/
- 本轮保留的更新：附近推荐使用设备真实坐标查询 5 公里内地点；出行喜好改为下拉框和复选框。
- `geoLoc` 只在当前设备内存中使用，不进入备份或云同步。

## 已确认

- `js/app.js` 与 `sw.js` 版本均为 v14。
- 推荐、同步、加密测试及 JavaScript 语法检查通过。
- 定位失败或未授权时仍可回退到用户填写的当前所在地。
- 景点和餐馆资料缺失时明确显示“暂无公开信息”或占位图，不伪造电话、地址和图片。

## 尚未解决

1. 附近地点来自 OpenStreetMap/Overpass，公开资料覆盖不完整，部分地点没有真实电话、完整地址或图片，查询也可能受网络和公共服务稳定性影响。
2. OpenStreetMap 通常没有统一评分，附近推荐的“按评分”排序目前参考价值有限。
3. 要稳定获得完整电话、实景图和评分，需要接入 Google Places 等商业地点数据源，并承担 API Key、计费和隐私配置；此决定尚未做出。
4. v14 仍需在真实手机上验证定位允许、定位拒绝、手填位置回退、喜好控件和 PWA 缓存刷新。
5. 用户反馈仍有其他体验问题。下次应先逐项复现和记录，再修改代码，不继续扩展功能。

## 下次开始方式

从本文件开始，只处理可复现的问题。优先顺序：真机定位与位置正确性 → 地点资料完整性 → 附近排序 → 喜好控件体验。历史过程只在 `CHANGELOG.md` 和 `docs/superpowers/` 中查阅。

## 修改后必检

```text
node --check js/sync.js
node --check js/app.js
node test/recommend.test.js
node test/sync.test.js
node test/encryption.test.js
git diff --check
```
