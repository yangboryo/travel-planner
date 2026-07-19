/* 数据层:全部 mock 数据。阶段二接真实 API 时只改这里。 */

const APP_DATA = {
  /* 护照信息默认为空,在"我的"页设置,存 localStorage */
  passport: { nationality: "", expiry: "" },

  /* 相对 AUD 的汇率:1 AUD = rate 单位外币 */
  fxRates: { AUD: 1, HKD: 5.1, MOP: 5.25, JPY: 97, THB: 23.5, CNY: 4.7, SGD: 0.88, KRW: 930, USD: 0.65, EUR: 0.61, GBP: 0.52, TWD: 21, MYR: 3.1, VND: 16400, IDR: 10500, PHP: 38 },

  /* 国家 → 默认币种，新建行程时自动匹配(可手动改) */
  countryCurrencies: {
    "中国": "CNY", "中国香港": "HKD", "中国澳门": "MOP", "中国台湾": "TWD",
    "日本": "JPY", "泰国": "THB", "新加坡": "SGD", "韩国": "KRW",
    "美国": "USD", "英国": "GBP", "澳大利亚": "AUD",
    "马来西亚": "MYR", "越南": "VND", "印度尼西亚": "IDR", "菲律宾": "PHP",
    "法国": "EUR", "德国": "EUR", "意大利": "EUR", "西班牙": "EUR", "荷兰": "EUR"
  },

  /* 目的地 → 签证规则(示例数据,实际以用户护照国籍对应规则为准) */
  visaRules: {
    "香港": { type: "免签", stayDays: 90, applyAheadDays: 0 },
    "东京": { type: "免签", stayDays: 90, applyAheadDays: 0 },
    "曼谷": { type: "免签", stayDays: 30, applyAheadDays: 0 },
    "新加坡": { type: "免签", stayDays: 90, applyAheadDays: 0 },
    "北京": { type: "需签证", stayDays: 0, applyAheadDays: 30 },
    "上海": { type: "需签证", stayDays: 0, applyAheadDays: 30 }
  },


  /* 目的地插座制式(type 含多个字母表示兼容多种) */
  plugTypes: {
    "香港": { type: "G", desc: "英式三脚方插" },
    "东京": { type: "A", desc: "两脚扁插" },
    "曼谷": { type: "AC", desc: "两脚扁/圆插混用" },
    "新加坡": { type: "G", desc: "英式三脚方插" },
    "北京": { type: "ACI", desc: "两脚扁/圆插与三脚扁插混用" },
    "上海": { type: "ACI", desc: "两脚扁/圆插与三脚扁插混用" }
  },

  /* 常住地 → 家用插座制式 */
  homePlugs: {
    "澳大利亚": { type: "I", desc: "八字两脚+地线三脚扁插" },
    "中国": { type: "ACI", desc: "两脚扁/圆插与三脚扁插" },
    "日本": { type: "A", desc: "两脚扁插" },
    "美国": { type: "AB", desc: "两脚扁插" },
    "英国": { type: "G", desc: "英式三脚方插" },
    "新西兰": { type: "I", desc: "八字两脚扁插" }
  },

  trips: [
    {
      id: "hk-2026-08",
      city: "香港",
      loc: { lat: 22.3193, lon: 114.1694, country: "中国香港" },
      flag: "🇭🇰",
      currency: "HKD",
      startDate: "2026-08-12",
      endDate: "2026-08-16",
      weather: [
        { date: "2026-08-12", icon: "🌤", high: 31, low: 27, desc: "多云转晴" },
        { date: "2026-08-13", icon: "☀️", high: 32, low: 28, desc: "晴" },
        { date: "2026-08-14", icon: "🌦", high: 30, low: 26, desc: "阵雨" },
        { date: "2026-08-15", icon: "⛈", high: 29, low: 26, desc: "雷阵雨" },
        { date: "2026-08-16", icon: "🌤", high: 31, low: 27, desc: "多云" }
      ],
      todos: [
        { offsetDays: 30, text: "预订酒店", done: true },
        { offsetDays: 21, text: "预订机票", done: true },
        { offsetDays: 7, text: "购买旅游保险", done: false },
        { offsetDays: 3, text: "兑换港币", done: false },
        { offsetDays: 1, text: "打包行李", done: false }
      ],
      packing: [],
      transport: {
        flights: [
          { platform: "携程", note: "直飞航线查询", url: "https://www.ctrip.com" },
          { platform: "飞猪", note: "比价 / 会员折扣", url: "https://www.fliggy.com" },
          { platform: "Trip.com", note: "英文界面 / 国际支付", url: "https://www.trip.com" }
        ],
        userFlights: [ { flightNo: "CX138", date: "2026-08-12", note: "示例航班,点击可删除" } ]
      },
      lodging: {
        name: "香港海景嘉福洲际酒店",
        address: "九龙尖沙咀梳士巴利道 70 号",
        checkIn: "8月12日 15:00",
        checkOut: "8月16日 12:00",
        confirmNo: "IC-88231207"
      },
      itinerary: [
        { day: 1, items: [ { time: "15:00", activity: "酒店入住" }, { time: "18:00", activity: "尖沙咀海滨长廊 · 幻彩咏香江" } ] },
        { day: 2, items: [ { time: "09:30", activity: "香港迪士尼乐园" }, { time: "20:00", activity: "东荟城奥特莱斯" } ] },
        { day: 3, items: [ { time: "10:00", activity: "太平山顶 · 山顶缆车" }, { time: "14:00", activity: "中环 · 石板街" }, { time: "19:00", activity: "庙街夜市" } ] },
        { day: 4, items: [ { time: "10:30", activity: "黄大仙祠" }, { time: "15:00", activity: "旺角购物" } ] },
        { day: 5, items: [ { time: "10:00", activity: "退房 · 机场快线" } ] }
      ],
      wishlist: [
        { name: "添好运点心(深水埗)", type: "🍜", scheduled: false },
        { name: "M+ 博物馆", type: "🏛", scheduled: false },
        { name: "兰芳园丝袜奶茶", type: "🥤", scheduled: true },
        { name: "大澳渔村", type: "🏞", scheduled: false }
      ],
      budget: [
        { category: "机票", amountLocal: 3200 },
        { category: "住宿", amountLocal: 6800 },
        { category: "餐饮", amountLocal: 2500 },
        { category: "交通", amountLocal: 600 },
        { category: "购物 / 门票", amountLocal: 3000 }
      ],
      emergency: { police: "999", ambulance: "999", consular: "", insuranceNo: "INS-2026-0812(示例)" },
      tips: {
        timezone: "GMT+8(与北京时间相同)",
        plug: "英式三脚插(G 型),需转换头",
        tipping: "一般无需小费,高档餐厅加收 10% 服务费",
        transitCard: "八达通(Octopus),机场可购,退卡退余额"
      }
    },
    {
      id: "tokyo-2026-10",
      city: "东京",
      loc: { lat: 35.6762, lon: 139.6503, country: "日本" },
      flag: "🇯🇵",
      currency: "JPY",
      startDate: "2026-10-14",
      endDate: "2026-10-20",
      weather: [
        { date: "2026-10-14", icon: "🌤", high: 21, low: 14, desc: "多云" },
        { date: "2026-10-15", icon: "☀️", high: 22, low: 15, desc: "晴" },
        { date: "2026-10-16", icon: "☀️", high: 23, low: 15, desc: "晴" },
        { date: "2026-10-17", icon: "🌧", high: 19, low: 13, desc: "小雨" },
        { date: "2026-10-18", icon: "🌤", high: 20, low: 14, desc: "多云" }
      ],
      todos: [
        { offsetDays: 45, text: "预订酒店", done: false },
        { offsetDays: 30, text: "预订机票", done: false },
        { offsetDays: 7, text: "购买旅游保险", done: false },
        { offsetDays: 3, text: "兑换日元", done: false },
        { offsetDays: 1, text: "打包行李", done: false }
      ],
      packing: [],
      transport: {
        flights: [
          { platform: "携程", note: "直飞航线查询", url: "https://www.ctrip.com" },
          { platform: "飞猪", note: "比价", url: "https://www.fliggy.com" },
          { platform: "Trip.com", note: "英文界面", url: "https://www.trip.com" }
        ],
        userFlights: []
      },
      lodging: { name: "新宿格拉斯丽酒店", address: "东京都新宿区歌舞伎町 1-19-1", checkIn: "10月14日 15:00", checkOut: "10月20日 11:00", confirmNo: "GR-55102014" },
      itinerary: [
        { day: 1, items: [ { time: "16:00", activity: "酒店入住 · 新宿散步" } ] },
        { day: 2, items: [ { time: "09:00", activity: "浅草寺 · 晴空塔" } ] },
        { day: 3, items: [ { time: "09:30", activity: "筑地市场 · 银座" } ] }
      ],
      wishlist: [
        { name: "一兰拉面(新宿店)", type: "🍜", scheduled: false },
        { name: "吉卜力美术馆", type: "🏛", scheduled: false }
      ],
      budget: [
        { category: "机票", amountLocal: 95000 },
        { category: "住宿", amountLocal: 120000 },
        { category: "餐饮", amountLocal: 60000 }
      ],
      emergency: { police: "110", ambulance: "119", consular: "", insuranceNo: "INS-2026-1014(示例)" },
      tips: {
        timezone: "GMT+9(比北京时间快 1 小时)",
        plug: "美式两脚扁插(A 型),需转换头",
        tipping: "无小费文化,给小费可能被婉拒",
        transitCard: "Suica / Pasmo,手机可开电子卡"
      }
    },
    {
      id: "bkk-2026-03",
      city: "曼谷",
      loc: { lat: 13.7563, lon: 100.5018, country: "泰国" },
      flag: "🇹🇭",
      currency: "THB",
      startDate: "2026-03-06",
      endDate: "2026-03-11",
      weather: [
        { date: "2026-03-06", icon: "☀️", high: 35, low: 27, desc: "炎热" },
        { date: "2026-03-07", icon: "☀️", high: 36, low: 28, desc: "炎热" },
        { date: "2026-03-08", icon: "🌤", high: 34, low: 27, desc: "多云" },
        { date: "2026-03-09", icon: "⛈", high: 33, low: 26, desc: "雷阵雨" },
        { date: "2026-03-10", icon: "☀️", high: 35, low: 27, desc: "晴" }
      ],
      todos: [
        { offsetDays: 30, text: "预订酒店", done: true },
        { offsetDays: 14, text: "预订机票", done: true },
        { offsetDays: 1, text: "打包行李", done: true }
      ],
      packing: [
        { text: "护照", checked: true, auto: true },
        { text: "防晒霜", checked: true, auto: true },
        { text: "泳衣", checked: true, auto: false }
      ],
      transport: {
        flights: [ { platform: "Trip.com", note: "已出行", url: "https://www.trip.com" } ],
        userFlights: []
      },
      lodging: { name: "曼谷暹罗凯宾斯基酒店", address: "991/9 Rama I Road, Pathumwan", checkIn: "3月6日 14:00", checkOut: "3月11日 12:00", confirmNo: "KP-33030601" },
      itinerary: [
        { day: 1, items: [ { time: "14:00", activity: "入住 · 暹罗广场" } ] },
        { day: 2, items: [ { time: "09:00", activity: "大皇宫 · 卧佛寺" } ] }
      ],
      wishlist: [ { name: "水门市场海南鸡饭", type: "🍜", scheduled: true } ],
      budget: [
        { category: "机票", amountLocal: 18000 },
        { category: "住宿", amountLocal: 25000 },
        { category: "餐饮", amountLocal: 8000 }
      ],
      emergency: { police: "191", ambulance: "1669", consular: "", insuranceNo: "INS-2026-0306(示例)" },
      tips: {
        timezone: "GMT+7(比北京时间慢 1 小时)",
        plug: "两脚扁/圆插混用(A/C 型),多数酒店通用",
        tipping: "服务好可给 20–50 泰铢小费",
        transitCard: "Rabbit 卡(BTS 轻轨)"
      }
    }
  ]
};
