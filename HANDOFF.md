# 当前交接

更新日期：2026-07-20

## 当前状态：v13 功能分支已完成

`feat/personalized-recommendations` 已完成计划中的 22 个 Task；尚未合并 `main` 或发布。

### 已完成

- 4 个 Tab、出行喜好、结构化精选数据、共享推荐引擎和实时定位。
- 行程详情“两分区”、交通舱位对比、住宿推荐、餐厅/景点平铺与 POI 详情。
- 推荐 Tab 的附近/目的地模式、距离/评分排序和目的地发现。
- `geoLoc` 不写入本地存档或云端；APP/SW 均为 v13。
- `recommend`、`sync`、`encryption` 测试、语法、diff 和浏览器回归通过。

### 做的是什么

4 个 tab(加"推荐")、出行喜好档案、实时定位、精选推荐数据、共享推荐引擎;行程详情改"行程安排 + 为你推荐"两分区(交通舱位对比、住宿已订+推荐、餐厅/景点平铺可点进 POI 详情);推荐 tab 做附近推荐与目的地提前规划。

### 执行纪律

- 一次一个 implementer subagent,别并行;把 Task 全文喂给它,别让它去读计划文件。
- 每个 Task 后两段审核都要过:先 spec 合规 ✅,再代码质量 ✅;有问题同一 subagent 修到过再进下一个。
- 连续执行,不要每个 Task 停下来问"要继续吗"。
- 纯逻辑 Task 先看到测试 FAIL 再实现(TDD)。
- 建议模型:引擎/纯函数 Task 用便宜快模型,多文件集成 Task 用标准模型,reviewer 用标准或更强。

### 本项目红线

- 测试:`node test/xxx.test.js`,退出码 0 = 过(无框架、无 package.json)。
- 新 `js/recommend.js` 尾部要有 `module.exports`(Node 可测)。
- 代码风格 ES5(`var`/`function`/字符串拼 HTML),跟现有文件一致。
- `STATE.geoLoc` 坐标**绝不上传**。
- 收尾:`sw.js` VERSION 与 `js/app.js` 的 `APP_VERSION` 都要是 `v13`。

### 下一步

完成最终分支审查后决定合并/PR，再真机验证：喜好联动、定位授权/拒绝、目的地按酒店距离、POI 详情外链、跨设备同步喜好。
