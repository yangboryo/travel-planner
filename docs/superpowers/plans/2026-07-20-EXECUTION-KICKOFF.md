# 执行启动说明 — 个性化推荐重构

> 这份是"下次直接开跑"的操作卡。计划本体见
> [`2026-07-20-personalized-recommendations.md`](./2026-07-20-personalized-recommendations.md),
> 设计见 [`../specs/2026-07-20-personalized-recommendations-design.md`](../specs/2026-07-20-personalized-recommendations-design.md)。

## 一句话恢复

下次开始时,对 Claude 说:

> **"用 subagent-driven-development 执行 `docs/superpowers/plans/2026-07-20-personalized-recommendations.md`,在 `feat/personalized-recommendations` 分支上,从 Task 1 开始。"**

Claude 会:读取计划 → 提取全部 22 个 Task 建 TodoWrite → 逐个派 implementer subagent 实现(TDD)→ 每个 Task 后跑两段审核(先 spec 合规、再代码质量)→ 全部完成后整体复审 → 走 finishing-a-development-branch。

## 当前准备状态(已就绪)

- ✅ 分支已建:`feat/personalized-recommendations`(不要在 `main` 上做)。
- ✅ 设计文档 + 实现计划已提交(`317c190`)。
- ✅ 计划为 TDD 小步格式,纯逻辑给了完整测试+实现代码,UI 给了完整实现代码 + 验证步骤。
- ⬜ 尚未写任何产品代码——这是下次的工作。

## 执行前先确认(第一个 subagent 之前)

1. 处于 `feat/personalized-recommendations` 分支:`git branch --show-current`。
2. 测试能跑:`node test/sync.test.js && node test/encryption.test.js` 应无报错(现有测试基线)。
3. 若想要完全隔离的工作区,可用 `superpowers:using-git-worktrees` 开 worktree;否则当前分支即可。

## 每个 Task 的建议模型(省成本/提速)

subagent-driven-development 主张"能用弱模型就别用强的"。按 Task 性质:

| Task | 性质 | 建议 implementer 模型 |
|---|---|---|
| 1 · prefs 归一化(TDD) | 单文件纯函数,代码已给全 | 便宜快模型(haiku 级) |
| 2 · 接入 store + 迁移 | 两文件,机械插入 | 便宜快模型 |
| 3 · 同步合并 prefs(TDD) | 多点插入 + 测试 | 标准模型(sonnet 级) |
| 4 · 喜好卡 UI | 单文件 UI,代码已给 | 标准模型 |
| 5 · destinationRecs 数据迁移 | 需按 shape 誊抄现有数据 + 补数值,有判断 | 标准模型 |
| 6/7/8/9 · 引擎纯函数(TDD) | 单文件纯函数,测试+代码已给全 | 便宜快模型 |
| 10 · POI 卡与详情渲染 | 单文件渲染 + CSS | 标准模型 |
| 11 · 详情页导航接线 | 多文件(html/app/sw) | 标准模型 |
| 12–15 · 详情页两分区 + 卡升级 | 多文件集成,需理解现有 section 范式 | 标准模型 |
| 16–20 · 推荐 tab + 定位 | 多文件集成,交互状态 | 标准模型 |
| 21 · 版本 + 全量测试 | 机械 + 核对 | 便宜快模型 |
| 22 · 文档 | 机械 | 便宜快模型 |

reviewer(spec 合规 / 代码质量)统一用**标准或更强模型**,审核比实现更需要判断力。

## 执行纪律(subagent-driven 的硬规则)

- 一次只派**一个** implementer subagent(并行会冲突)。
- 不让 subagent 去读计划文件——**把该 Task 的完整文本 + 上下文直接喂给它**。
- 每个 Task 后**两段审核都要过**:先 spec 合规 ✅,再代码质量 ✅;reviewer 挑出问题 → 同一 implementer 修 → 再审,直到通过才进下一个。
- **连续执行**,不要每个 Task 后停下来问"要继续吗"。只有 BLOCKED、真歧义、或全部完成才停。
- 纯逻辑 Task 必须先看到测试 FAIL 再实现(TDD)。

## 本项目特有注意

- **模块双用**:新 `js/recommend.js` 尾部要有 `if (typeof module !== "undefined" && module.exports) module.exports = {...}`,否则 Node 测不了、浏览器多包一层也无妨。
- **测试运行**:`node test/xxx.test.js`,退出码 0 = 过;无框架、无 `package.json`。
- **代码风格**:ES5 风(`var`/`function`/字符串拼 HTML),跟现有文件一致,别引入新范式。
- **隐私红线**:`STATE.geoLoc` 坐标**绝不上传**;Task 3 已确保 mergeCloudData/上传封包不含它,实现时别破坏。
- **验收把关**:UI Task 没有单测,靠"浏览器/真机验证"步骤;硬刷新避开 Service Worker 旧缓存。
- **收尾**:全部完成后 `sw.js` VERSION 与 `js/app.js` 的 `APP_VERSION` 都要是 `v13`。

## 完成后

所有 Task 过审后,用 `superpowers:finishing-a-development-branch` 决定合并/PR/清理,并按 `HANDOFF.md` 流程做真机验证(喜好联动、定位授权/拒绝、目的地按酒店距离、POI 详情外链、跨设备同步喜好)。
