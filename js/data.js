/* 数据层:全部 mock 数据。阶段二接真实 API 时只改这里。 */

const APP_DATA = {
  /* 护照信息默认为空,在"我的"页设置,存 localStorage */
  passport: { nationality: "", expiry: "" },
  /* 出行喜好默认值(个性化推荐用),在"我的"页可改 */
  prefsDefault: {
    budgetTier: "comfort", cabinClass: "economy",
    lodgingTypes: ["hotel"], lodgingLocation: "central",
    cuisine: [], travelStyle: "balanced"
  },

  /* 相对 AUD 的汇率:1 AUD = rate 单位外币(阶段二接入实时汇率)
     仅保留主要货币 + 亚太常用货币 */
  fxRates: {
    AUD: 1, USD: 0.65, EUR: 0.61, GBP: 0.52, CHF: 0.59,
    JPY: 97, CNY: 4.7, HKD: 5.1, MOP: 5.25, TWD: 21, KRW: 930,
    SGD: 0.88, THB: 23.5, MYR: 3.1, IDR: 10500, VND: 16400, PHP: 38,
    INR: 55, NZD: 1.11, CAD: 0.91, AED: 2.4
  },

  /* 国家 → 默认币种，新建行程时自动匹配(可手动改) */
  countryCurrencies: {
    "中国": "CNY", "中国香港": "HKD", "中国澳门": "MOP", "中国台湾": "TWD",
    "日本": "JPY", "泰国": "THB", "新加坡": "SGD", "韩国": "KRW",
    "美国": "USD", "英国": "GBP", "澳大利亚": "AUD",
    "马来西亚": "MYR", "越南": "VND", "印度尼西亚": "IDR", "菲律宾": "PHP",
    "法国": "EUR", "德国": "EUR", "意大利": "EUR", "西班牙": "EUR", "荷兰": "EUR"
  },

  /* ISO 国家码 → 币种(保底匹配,覆盖全球主要国家/地区) */
  countryCodeCurrencies: {
    "CN": "CNY", "HK": "HKD", "MO": "MOP", "TW": "TWD",
    "JP": "JPY", "TH": "THB", "SG": "SGD", "KR": "KRW",
    "US": "USD", "GB": "GBP", "AU": "AUD", "CA": "CAD", "NZ": "NZD",
    "MY": "MYR", "VN": "VND", "ID": "IDR", "PH": "PHP",
    "IN": "INR", "KH": "KHR", "LA": "LAK", "MM": "MMK",
    "FR": "EUR", "DE": "EUR", "IT": "EUR", "ES": "EUR", "NL": "EUR",
    "BE": "EUR", "AT": "EUR", "PT": "EUR", "GR": "EUR", "IE": "EUR",
    "FI": "EUR", "SE": "SEK", "DK": "DKK", "NO": "NOK", "PL": "PLN",
    "CZ": "CZK", "HU": "HUF", "CH": "CHF", "TR": "TRY", "RU": "RUB",
    "BR": "BRL", "MX": "MXN", "AR": "ARS", "CL": "CLP",
    "AE": "AED", "SA": "SAR", "QA": "QAR", "EG": "EGP",
    "ZA": "ZAR", "KE": "KES", "MA": "MAD",
    "IS": "ISK", "HR": "EUR", "RO": "RON", "BG": "BGN"
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

  /* 目的地 → 景点/美食推荐 */
  localRecommendations: {
    "香港": {
      spots: [
        { name: "维多利亚港", type: "🏞", desc: "世界三大夜景之一，每晚幻彩咏香江灯光秀" },
        { name: "太平山顶", type: "🏔", desc: "俯瞰维港全景，山顶缆车体验" },
        { name: "迪士尼乐园", type: "🎢", desc: "全球最小迪士尼，适合一日游" },
        { name: "海洋公园", type: "🎢", desc: "海滨缆车+海洋剧场+熊猫馆" },
        { name: "天坛大佛", type: "🛕", desc: "大屿山宝莲禅寺，世界最高户外青铜坐佛" }
      ],
      food: [
        { name: "添好运点心", type: "🥟", desc: "最平价米其林，酥皮叉烧包必点" },
        { name: "镛记烧鹅", type: "🦆", desc: "中环老字号，金牌烧鹅驰名中外" },
        { name: "兰芳园", type: "🥤", desc: "丝袜奶茶发源地，港式茶餐厅代表" },
        { name: "阿甘虾餐厅", type: "🍤", desc: "凌霄阁内美式海鲜，配维港景观" },
        { name: "澳洲牛奶公司", type: "🍳", desc: "炖奶+炒蛋多士，地道港式早餐" }
      ]
    },
    "东京": {
      spots: [
        { name: "浅草寺", type: "🛕", desc: "东京最古老寺庙，雷门灯笼打卡" },
        { name: "晴空塔", type: "🗼", desc: "634米世界第一高塔，360度展望台" },
        { name: "涩谷十字路口", type: "🏙", desc: "世界最繁忙路口，涩谷天空展望台" },
        { name: "筑地场外市场", type: "🏪", desc: "东京厨房，新鲜海鲜+寿司朝食" },
        { name: "秋叶原", type: "🕹", desc: "电器街+动漫圣地，女仆咖啡体验" }
      ],
      food: [
        { name: "一兰拉面", type: "🍜", desc: "博多豚骨拉面，一人一格独享体验" },
        { name: "筑地寿司大", type: "🍣", desc: "场外市场排队名店，板前握寿司" },
        { name: "天丼金子半之助", type: "🍤", desc: "日本桥排队天丼，炸虾+穴子豪华碗" },
        { name: "叙叙苑烧肉", type: "🥩", desc: "高级和牛烧肉，午市套餐超值" },
        { name: "AFURI 柚子盐拉面", type: "🍜", desc: "清爽柚子风味，中目黑潮流拉面" }
      ]
    },
    "曼谷": {
      spots: [
        { name: "大皇宫", type: "🛕", desc: "曼谷地标，玉佛寺+壁画长廊" },
        { name: "卧佛寺", type: "🛕", desc: "46米金卧佛，泰式按摩发源地" },
        { name: "黎明寺", type: "🗼", desc: "昭披耶河畔黎明寺（郑王庙），日落绝美" },
        { name: "洽图洽周末市集", type: "🏪", desc: "15000+摊位，世界最大周末市场" },
        { name: "暹罗广场", type: "🛍", desc: "曼谷潮流中心，购物+美食集合地" }
      ],
      food: [
        { name: "水门市场海南鸡饭", type: "🍗", desc: "曼谷第一海南鸡饭，排队必吃" },
        { name: "Jay Fai", type: "🦀", desc: "米其林一星街边摊，蟹肉蛋卷传奇" },
        { name: "Pe Aor 冬阴功", type: "🍲", desc: "龙虾冬阴功面，汤底浓郁" },
        { name: "After You 甜品", type: "🍧", desc: "蜜糖吐司+泰奶刨冰，网红打卡" },
        { name: "Thip Samai 蛋包炒粉", type: "🍝", desc: "曼谷最老 Pad Thai 店，蛋皮包裹" }
      ]
    },
    "新加坡": {
      spots: [
        { name: "滨海湾花园", type: "🌿", desc: "超级树灯光秀+云雾林温室" },
        { name: "圣淘沙岛", type: "🏖", desc: "环球影城+S.E.A.海洋馆+沙滩" },
        { name: "鱼尾狮公园", type: "🦁", desc: "新加坡地标，滨海湾天际线" },
        { name: "牛车水", type: "🏘", desc: "唐人街，佛牙寺+麦士威熟食中心" },
        { name: "乌节路", type: "🛍", desc: "购物天堂，ION+义安城+百利宫" }
      ],
      food: [
        { name: "天天海南鸡饭", type: "🍗", desc: "麦士威熟食中心排队王，滑嫩鸡饭" },
        { name: "松发肉骨茶", type: "🍖", desc: "胡椒味肉骨茶，汤浓骨酥" },
        { name: "328 加东叻沙", type: "🍜", desc: "椰浆叻沙，椰奶浓郁+蚶肉鲜甜" },
        { name: "珍宝海鲜", type: "🦀", desc: "辣椒螃蟹+黑胡椒蟹，新加坡名片" },
        { name: "亚坤咖椰吐司", type: "🥪", desc: "咖椰酱+牛油烤吐司+半熟蛋" }
      ]
    },
    "腾冲": {
      spots: [
        { name: "腾冲热海风景区", type: "♨️", desc: "火山地热景观集中地，可看大滚锅与温泉群" },
        { name: "和顺古镇", type: "🏘", desc: "滇西侨乡古镇，古宅、宗祠与湿地相连" },
        { name: "腾冲火山地热国家地质公园", type: "🌋", desc: "保存完整的火山锥群，可徒步登顶看火山口" },
        { name: "北海湿地", type: "🌿", desc: "高原火山堰塞湖湿地，春夏草排景观突出" },
        { name: "国殇墓园", type: "🏛", desc: "滇西抗战纪念地，适合与纪念馆一同参观" }
      ],
      food: [
        { name: "土锅子", type: "🍲", desc: "腾冲传统宴席菜，荤素食材分层炖煮" },
        { name: "大救驾", type: "🥘", desc: "腾冲代表性炒饵块，配肉片、鸡蛋和蔬菜" },
        { name: "稀豆粉", type: "🥣", desc: "豌豆磨浆熬制的本地早餐，常配油条或饵丝" },
        { name: "铜瓢牛肉", type: "🥩", desc: "滇西风味牛肉火锅，汤浓肉香" },
        { name: "松花糕", type: "🍰", desc: "以松花粉制作的腾冲传统甜点" }
      ]
    }
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

/* 目的地精选推荐。由现有内容迁移为统一 shape,后续可直接替换真实 API。 */
(function () {
  var cityMeta = {
    "香港": { center: [22.3027, 114.1772], flight: 1400, hotel: 1850 },
    "东京": { center: [35.6762, 139.6503], flight: 4200, hotel: 18000 },
    "曼谷": { center: [13.7563, 100.5018], flight: 2600, hotel: 4200 },
    "新加坡": { center: [1.3521, 103.8198], flight: 3600, hotel: 320 },
    "腾冲": { center: [25.0203, 98.4973], flight: 1800, hotel: 520 }
  };
  APP_DATA.destinationRecs = {};
  Object.keys(cityMeta).forEach(function (city) {
    var meta = cityMeta[city], old = APP_DATA.localRecommendations[city];
    APP_DATA.destinationRecs[city] = {
      center: { lat: meta.center[0], lon: meta.center[1] },
      transport: {
        intercity: [{ mode: "flight", label: "直飞/中转参考", durationH: 3, tip: "建议提前比价",
          cabins: [{ "class": "economy", priceLocal: meta.flight, note: "含税参考" },
            { "class": "business", priceLocal: meta.flight * 3, note: "含税参考" }] }],
        local: [{ mode: "metro", name: "公共交通", priceRange: "按当地票价", tier: "economy", tip: "优先使用交通卡" }]
      },
      lodging: [
        { name: city + "市中心酒店", type: "hotel", area: "市中心", pricePerNight: meta.hotel,
          tier: "comfort", location: "central", lat: meta.center[0], lon: meta.center[1], tags: ["市中心"], desc: "交通与用餐方便" },
        { name: city + "近交通精品住宿", type: "boutique", area: "交通枢纽", pricePerNight: Math.round(meta.hotel * 0.8),
          tier: "comfort", location: "near-transit", lat: meta.center[0] + 0.01, lon: meta.center[1] + 0.01,
          tags: ["精品", "近交通"], desc: "适合重视出行效率的旅客" }
      ],
      dining: old.food.map(function (x, i) { return {
        name: x.name, cuisineTags: ["local"], priceLevel: i % 3 + 1, rating: 4.7 - i * 0.1,
        michelin: x.desc.indexOf("米其林") !== -1, area: "", lat: meta.center[0] + i * 0.002,
        lon: meta.center[1] + i * 0.002, image: "", address: "", phone: "", website: "", hours: "", desc: x.desc
      }; }),
      attractions: old.spots.map(function (x, i) { return {
        name: x.name, category: x.type, durationH: x.type.indexOf("🎢") !== -1 ? 5 : 1.5,
        rating: 4.8 - i * 0.1, lat: meta.center[0] + i * 0.002, lon: meta.center[1] - i * 0.002,
        image: "", address: "", phone: "", website: "", hours: "", desc: x.desc, tips: "",
        bestFor: ["packed", "balanced", "relaxed"]
      }; })
    };
  });
  var hk = APP_DATA.destinationRecs["香港"].dining[0];
  hk.address = "深水埗福荣街 9-11 号地铺";
  hk.phone = "+852 2788 1226";
  hk.website = "https://timhowan.com";
  hk.hours = "10:00–21:30 · 每日营业";
}());
