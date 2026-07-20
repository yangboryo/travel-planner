# 私人出行助理(travel-planner)Implementation Plan

> 历史实施计划：初版任务已经结束，文中的勾选项和 agent 执行说明不再用于当前工作。当前结论以项目根目录 `HANDOFF.md` 为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按设计文档 `docs/superpowers/specs/2026-07-19-travel-planner-design.md` 实现 iPhone 16 竖屏优先的"私人出行助理"原型(mock 数据 + localStorage)。

**Architecture:** 无构建工具的多文件静态站:`index.html` 承载三个 Tab 屏与详情屏容器,JS 按"数据层(data.js)→ 视图层(views-*.js)→ 应用层(app.js)"分层;所有状态变更走 `app.js` 的 store 封装并同步 localStorage。浏览器直接打开即可运行,无任何外部网络请求。

**Tech Stack:** 原生 HTML/CSS/JS(ES6 modules 不用——`file://` 下有 CORS 限制,用普通 `<script>` 顺序加载)。

**验证方式:** 纯 UI 项目,无单测框架;每个任务完成后在浏览器(DevTools iPhone 16 视口 393×852)按任务内"验证"步骤走查。

**设计规范速查(所有任务共用):**
- 颜色:背景 `#F5F8FC`、卡片 `#FFFFFF`、主色 `#4A90D9`、渐变 `linear-gradient(135deg,#4A90D9,#67B8F7)`、主文字 `#1B2A41`、次文字 `#7A8CA5`、警示横幅底 `#FFF7E0` 字 `#8A6D1A`、阴影 `rgba(30,80,160,0.08)`
- 圆角:卡片 16px、徽章/按钮全圆角;字体:`-apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
- 手机容器:`max-width:430px`,桌面居中,外部背景 `#E9EFF6`

---

### Task 1: 骨架、基础样式与 Tab 导航

**Files:**
- Create: `index.html`
- Create: `css/base.css`
- Create: `css/screens.css`(本任务先建空文件占位)
- Create: `js/app.js`

- [ ] **Step 1:** `index.html`:手机容器 `.phone` 内含 4 个屏容器 `#screen-trips` `#screen-calendar` `#screen-profile` `#screen-trip-detail`(detail 默认隐藏、无 tab 高亮),底部 `.tab-bar` 三个按钮(✈️ 行程 / 📅 日历 / 👤 我的),按顺序引入 `css/base.css`、`css/screens.css`、`js/data.js`、`js/views-main.js`、`js/views-trip.js`、`js/app.js`(后三个 JS 文件本任务先建为空文件避免 404)
- [ ] **Step 2:** `css/base.css`:`:root` 设计变量(上方速查表)、reset、`.phone` 手机容器与桌面居中布局、`.screen`(display:none)与 `.screen.active`、`.tab-bar` 固定底部、通用组件类:`.card` `.badge` `.btn-primary` `.section-card`(折叠卡)
- [ ] **Step 3:** `js/app.js`:`showScreen(id)` 切屏函数 + tab 点击绑定 + 默认显示行程屏
- [ ] **Step 4(验证):** 浏览器打开,393×852 视口:三 Tab 可切换、当前 Tab 高亮、桌面宽度下手机容器居中

### Task 2: mock 数据层 data.js

**Files:**
- Create: `js/data.js`(其余 JS 空文件在 Task 1 已建)

- [ ] **Step 1:** 写入全局对象 `APP_DATA`,结构如下(内容完整写死,不留空字段):

```js
const APP_DATA = {
  passport: { nationality: "用户设置", expiry: "2031-05-20" },
  fxRates: { AUD: 1, HKD: 5.1, JPY: 97, THB: 23.5, CNY: 4.7 },
  visaRules: {
    // key: 目的地城市
    "香港": { type: "免签", stayDays: 90, applyAheadDays: 0 },
    "东京": { type: "免签", stayDays: 90, applyAheadDays: 0 },
    "曼谷": { type: "免签", stayDays: 30, applyAheadDays: 0 },
    "北京": { type: "需签证", stayDays: 0, applyAheadDays: 30 }
  },
  trips: [ /* 3 个行程:香港(8月)、东京(10月)、曼谷(3月,历史) */ ]
};
```

每个 trip 对象字段:`id, city, flag, currency, startDate, endDate, weather[5]{date,icon,high,low,desc}, todos[]{offsetDays,text,done}, packing[]{text,checked,auto}, transport{flights[]{platform,note,url}, flightStatus{no,gate,status}}, lodging{name,address,checkIn,checkOut,confirmNo}, itinerary[]{day,items[]{time,activity}}, wishlist[]{name,type,scheduled}, budget[]{category,amountLocal}, emergency{police,ambulance,consular,insuranceNo}, tips{timezone,plug,tipping,transitCard}`。香港行程数据最完整(每字段都有真实感内容),东京/曼谷可精简但字段齐全。
- [ ] **Step 2(验证):** 浏览器 Console 输入 `APP_DATA.trips.length` 得 3;`APP_DATA.visaRules["北京"].type` 得 "需签证"

### Task 3: 行程列表页 + 新建行程 + localStorage

**Files:**
- Modify: `js/views-main.js`(renderTripList)
- Modify: `js/app.js`(store 封装、新建弹层逻辑)
- Modify: `css/screens.css`(列表页样式)

- [ ] **Step 1:** `app.js` 加 store:`loadState()`/`saveState()` 用 `localStorage["travel-planner"]` 存 `{trips, checks}`;首次加载合并 `APP_DATA.trips`
- [ ] **Step 2:** `views-main.js` `renderTripList()`:按日期分"即将出行"(大卡片:国旗+城市、日期、倒计时徽章、天气徽章、清单进度徽章)与"历史行程"(灰色小条);卡片点击调 `openTripDetail(id)`(本任务先 console.log 占位)
- [ ] **Step 3:** 新建行程:右上 + 按钮弹出底部抽屉表单(城市、国旗 emoji 选择、币种下拉、起止日期),提交后生成含默认空板块的 trip 存入 store 并重渲染
- [ ] **Step 4(验证):** 列表正确分组排序;新建"新加坡"行程出现在列表;刷新后仍在;倒计时天数与系统日期一致

### Task 4: 日历页

**Files:**
- Modify: `js/views-main.js`(renderCalendar)
- Modify: `css/screens.css`

- [ ] **Step 1:** `renderCalendar(year, month)`:周一起始月网格、‹ › 翻月、今天描点;行程日期段单元格蓝底白字(用 trip 起止日期区间判断)
- [ ] **Step 2:** 日历下方"本月行程"卡片列表(无则显示空状态文案),点击进详情
- [ ] **Step 3(验证):** 切到 2026年8月,12–16 日高亮;翻到无行程月份显示空状态;点击行程卡触发 openTripDetail

### Task 5: "我的"页(护照档案 + 汇率换算器)

**Files:**
- Modify: `js/views-main.js`(renderProfile)
- Modify: `css/screens.css`

- [ ] **Step 1:** 护照档案卡:国籍、有效期;当 `expiry - today < 9个月` 显示黄色提醒条(用 mock 日期验证两种状态)
- [ ] **Step 2:** 汇率换算器卡:金额输入 + 两个币种下拉(数据来自 `fxRates`),双向实时换算
- [ ] **Step 3:** 设置占位列表(仅样式)
- [ ] **Step 4(验证):** 输入 100 AUD → 510 HKD(按 mock 汇率手算核对);反向换算一致

### Task 6: 详情页框架(头图 + 签证状态条 + 折叠卡机制)

**Files:**
- Modify: `js/views-trip.js`(renderTripDetail 框架、collapsible 机制)
- Modify: `js/app.js`(openTripDetail 实现、返回逻辑)
- Modify: `css/screens.css`

- [ ] **Step 1:** `openTripDetail(id)`:切到 detail 屏,渲染头图(渐变底、城市+国旗、日期、倒计时)、‹ 返回按钮
- [ ] **Step 2:** 签证状态条:查 `visaRules[city]`——免签→低调小字;需签证/电子签→黄色横幅"⚠️ 需提前办理签证(建议提前 N 天)"
- [ ] **Step 3:** 折叠卡机制:`sectionCard(icon, title, summaryHTML, bodyHTML)` 生成器,点击标题行展开/收起(max-height 过渡动画),同屏允许多张展开
- [ ] **Step 4(验证):** 香港详情显示免签小字;手改 mock 把"北京"设为某行程目的地(或新建北京行程)出现黄色横幅;折叠展开动画流畅

### Task 7: 详情板块 A——天气 / 待办时间线 / 打包清单

**Files:**
- Modify: `js/views-trip.js`
- Modify: `css/screens.css`

- [ ] **Step 1:** 天气卡:5 天横向滚动条(星期/图标/高低温),摘要行显示"31° / 27° · 多云转晴"
- [ ] **Step 2:** 待办时间线:按 `offsetDays` 生成日期(出发日倒推),竖向时间线样式;可勾选存 store;`日期<今天 && 未完成` 标红;若目的地需签证且无签证待办,自动插入"办理签证"项(offsetDays 取 visaRules.applyAheadDays)
- [ ] **Step 3:** 打包清单:初次打开若 `packing` 中无 `auto` 项,按规则生成——`最高温≥28`:防晒霜/太阳镜/短袖;`最低温≤10`:厚外套;`desc含雨`:雨伞;`天数>4`:洗衣袋;固定项:护照/充电器/转换插头。可勾选/添加/删除,摘要行显示进度 n/m
- [ ] **Step 4(验证):** 香港(31°)清单含防晒霜;勾选两项刷新后保留;把系统日期无关的过期待办显示为红色(用 mock offset 验证)

### Task 8: 详情板块 B——交通 / 住宿 / 日程

**Files:**
- Modify: `js/views-trip.js`
- Modify: `css/screens.css`

- [ ] **Step 1:** 交通卡:三个平台跳转按钮(携程/飞猪/Trip.com,`href` 用各平台官网首页 + `target=_blank`);航班动态子卡(航班号/值机口/状态徽章),仅当 `今天==startDate` 高亮显示,否则灰色"出行日可查"
- [ ] **Step 2:** 住宿卡:酒店名/地址/入住退房/确认号,点击字段可编辑(prompt 即可)存 store
- [ ] **Step 3:** 日程卡:Day 1–N 分组时间线(时间+活动)
- [ ] **Step 4(验证):** 平台按钮新开页;修改酒店确认号刷新后保留;日程按 Day 分组正确

### Task 9: 详情板块 C——想去清单 / 预算 / 紧急卡 / 小贴士

**Files:**
- Modify: `js/views-trip.js`
- Modify: `css/screens.css`

- [ ] **Step 1:** 想去清单:名称+类型 emoji(🏞/🍜),"已排入日程"标记切换存 store
- [ ] **Step 2:** 预算卡:分类行(类目、当地币金额、AUD 换算值 = amountLocal / fxRates[currency] 保留整数),底部合计双币;摘要行显示总额
- [ ] **Step 3:** 紧急信息卡:当地报警/急救电话、本国领事紧急热线(用户填写)、保险单号、酒店地址(从 lodging 取)
- [ ] **Step 4:** 小贴士卡:时差/插座/小费/交通卡四行
- [ ] **Step 5(验证):** 香港预算 HKD 与 AUD 换算手算一致;紧急卡酒店地址与住宿卡一致

### Task 10: 整体走查与收尾

**Files:**
- Verify: 全部

- [ ] **Step 1:** 对照设计文档逐板块核对(12 个板块、3 Tab、视觉规范色值)
- [ ] **Step 2:** iPhone 16 视口全流程走查:列表→详情全板块展开→返回→日历→我的;新建行程→详情;刷新验证所有持久化
- [ ] **Step 3:** 桌面宽度走查(手机容器居中);确认 `@media (min-width:600px)` 折叠屏断点注释已留
- [ ] **Step 4:** 无 console 报错、无外部网络请求(Network 面板核对)
