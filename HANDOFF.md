# 当前交接

更新日期：2026-07-20

## 下一步：实现「个性化推荐重构」

v12 已发布(详见 `CHANGELOG.md`)。下一项工作是个性化推荐,**计划已写好、代码未动**。

### 直接开始(对 Claude 说这一句)

> 用 subagent-driven-development 执行 `docs/superpowers/plans/2026-07-20-personalized-recommendations.md`,在 `feat/personalized-recommendations` 分支上,从 Task 1 开始。

- **分支**:`feat/personalized-recommendations`(已建,勿在 `main` 上做)。
- **计划**:`docs/superpowers/plans/2026-07-20-personalized-recommendations.md`(22 个 TDD 小步 Task,含完整测试与代码)。
- **设计参考**:`docs/superpowers/specs/2026-07-20-personalized-recommendations-design.md`。

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

### 完成后

全部过审 → `superpowers:finishing-a-development-branch` 决定合并/PR → 真机验证:喜好联动、定位授权/拒绝、目的地按酒店距离、POI 详情外链、跨设备同步喜好。
