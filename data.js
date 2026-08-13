// 无锡地图地点数据
// 字段：name 名称 / type 类型 / emoji 卡通玩偶 / lat,lng 坐标 / desc 简介
// 类型合集：景点 | 商场 | 美食 | 咖啡茶饮 | 文创书店

const SHOPS = [
  // ---------- 景点 ----------
  { name: '鼋头渚', type: '景点', emoji: '⛵', lat: 31.544, lng: 120.250, desc: '太湖佳绝处，无锡第一名胜，春天赏樱胜地。' },
  { name: '灵山大佛', type: '景点', emoji: '🗿', lat: 31.433, lng: 120.100, desc: '88米青铜释迦牟尼立像，庄严肃穆，气势恢宏。' },
  { name: '拈花湾', type: '景点', emoji: '🏮', lat: 31.420, lng: 120.080, desc: '禅意小镇，夜樱与灯光秀闻名，度假好去处。' },
  { name: '惠山古镇', type: '景点', emoji: '🏯', lat: 31.590, lng: 120.270, desc: '江南著名古祠堂建筑群，天下第二泉所在地。' },
  { name: '南禅寺', type: '景点', emoji: '🛕', lat: 31.575, lng: 120.298, desc: '南朝古寺，矗立于古运河畔，闹市中的清净地。' },
  { name: '蠡园', type: '景点', emoji: '🌸', lat: 31.515, lng: 120.253, desc: '范蠡西施传说发源地，江南经典园林。' },
  { name: '三国城', type: '景点', emoji: '⚔️', lat: 31.517, lng: 120.203, desc: '央视影视拍摄基地，梦回三国风云。' },
  { name: '梅园', type: '景点', emoji: '🌺', lat: 31.563, lng: 120.243, desc: '江南赏梅胜地，早春万株梅花竞放。' },
  { name: '清名桥古运河', type: '景点', emoji: '🌉', lat: 31.568, lng: 120.303, desc: '千年古运河历史文化街区，小桥流水人家。' },
  { name: '荡口古镇', type: '景点', emoji: '🏘️', lat: 31.530, lng: 120.538, desc: '千年水乡古镇，静谧悠然。' },
  { name: '雪浪山', type: '景点', emoji: '⛰️', lat: 31.470, lng: 120.290, desc: '生态休闲胜地，登高远眺太湖。' },
  { name: '无锡动物园', type: '景点', emoji: '🐼', lat: 31.520, lng: 120.270, desc: '亲子游玩好去处，萌宠云集。' },
  { name: '无锡大剧院', type: '景点', emoji: '🎭', lat: 31.517, lng: 120.277, desc: '蠡湖畔文化地标，造型别致的演出殿堂。' },
  { name: '锡惠公园', type: '景点', emoji: '⛲', lat: 31.590, lng: 120.267, desc: '江南名园，寄畅园与天下第二泉坐落其间。' },
  { name: '中国杜鹃园', type: '景点', emoji: '🌺', lat: 31.591, lng: 120.268, desc: '锡惠公园内，近500种杜鹃，长三角最美赏鹃胜地。' },
  { name: '太湖之星摩天轮', type: '景点', emoji: '🎡', lat: 31.512, lng: 120.258, desc: '蠡湖之畔摩天轮，升至最高俯瞰太湖，告白圣地。' },
  { name: '贡湖湾湿地公园', type: '景点', emoji: '🏞️', lat: 31.475, lng: 120.300, desc: '太湖边宝藏湿地，《爱情公寓》同款浪漫取景地。' },
  { name: '金匮公园', type: '景点', emoji: '🌸', lat: 31.528, lng: 120.280, desc: '樱花大道美到失语，风一吹就是漫天樱花雨。' },

  // ---------- 商场 ----------
  { name: '恒隆广场', type: '商场', emoji: '🛍️', lat: 31.575, lng: 120.301, desc: '无锡地标商业体，1-2层奢侈品集中。' },
  { name: '苏宁广场', type: '商场', emoji: '🛍️', lat: 31.574, lng: 120.299, desc: '328米北塔地标，全业态购物中心。' },
  { name: '大东方百货', type: '商场', emoji: '🛍️', lat: 31.576, lng: 120.300, desc: '中山路核心商圈高端精品百货。' },
  { name: '万象城', type: '商场', emoji: '🛍️', lat: 31.512, lng: 120.272, desc: '蠡湖湖畔滨水综合体，沿湖景色优美。' },
  { name: '荟聚购物中心', type: '商场', emoji: '🛍️', lat: 31.598, lng: 120.396, desc: '宜家系城市生活地标，约350家商户。' },
  { name: '海岸城', type: '商场', emoji: '🛍️', lat: 31.510, lng: 120.260, desc: '滨湖区人气购物休闲中心。' },
  { name: '滨湖万达广场', type: '商场', emoji: '🛍️', lat: 31.510, lng: 120.262, desc: '购物、餐饮、影院一站式商圈。' },
  { name: '八佰伴', type: '商场', emoji: '🛍️', lat: 31.570, lng: 120.295, desc: '老牌百货，市民逛街常去之地。' },

  // ---------- 美食 / 老字号 ----------
  { name: '王兴记', type: '美食', emoji: '🥟', lat: 31.575, lng: 120.300, desc: '百年老字号，无锡小笼包的代名词。' },
  { name: '三凤桥', type: '美食', emoji: '🍖', lat: 31.574, lng: 120.300, desc: '无锡酱排骨经典老店，甜咸醇厚。' },
  { name: '陆稿荐', type: '美食', emoji: '🦆', lat: 31.573, lng: 120.298, desc: '酱鸭卤味老字号，本地人钟爱。' },
  { name: '聚丰园', type: '美食', emoji: '🍜', lat: 31.570, lng: 120.296, desc: '本帮菜老字号，地道无锡风味。' },
  { name: '拱北楼', type: '美食', emoji: '🍜', lat: 31.573, lng: 120.302, desc: '百年面馆，一碗面一份烟火气。' },

  // ---------- 咖啡茶饮 / 文创书店 ----------
  { name: '古运河文创园', type: '文创书店', emoji: '📚', lat: 31.567, lng: 120.302, desc: '老厂房改造的文创街区，文艺气息浓厚。' },
  { name: '惠山书局', type: '文创书店', emoji: '📚', lat: 31.589, lng: 120.271, desc: '古镇旁的书香小站，静心阅读好去处。' },
  { name: '蠡湖咖啡', type: '咖啡茶饮', emoji: '☕', lat: 31.513, lng: 120.275, desc: '湖畔手冲咖啡店，边喝咖啡边看湖景。' },
  { name: '南长街茶馆', type: '咖啡茶饮', emoji: '🍵', lat: 31.566, lng: 120.303, desc: '古运河畔老茶馆，慢品江南时光。' },
];

// 类型 → 图例显示（按出现顺序去重）
const TYPES = [...new Set(SHOPS.map(s => s.type))];

// ============================================================
// 今日热度榜（真实社交媒体热度快照）
// 字段：name / rank / hot / address / ticket / hours / website / comments
// ============================================================
const HOT = [
  {
    name: '鼋头渚', rank: 1, hot: '98.6w',
    address: '无锡市滨湖区鼋渚路1号',
    ticket: '90元（樱花季约80-105元）',
    hours: '08:00-17:00（樱花季7:30-18:00）',
    website: 'https://baike.baidu.com/item/鼋头渚',
    comments: [
      { user: '一颗汤圆吖', platform: '小红书', stars: 5, likes: 2314, text: '世界三大赏樱地不是吹的！一定要赶早，7点前冲进去，人少能拍出包场大片，太湖仙岛游船也值回票价。' },
      { user: '阿北的旅行手账', platform: '大众点评', stars: 5, likes: 876, text: '樱花季人挤人但真的值得，站在充山隐秀看整片樱花海，绝了。冬天还能喂红嘴鸥，拍照超灵。' },
      { user: '摄影老张', platform: '携程', stars: 4, likes: 342, text: '风景顶级，但旺季一定要提前预约，现场买票排队一小时起。错峰下午去光线最好。' },
    ],
  },
  {
    name: '灵山大佛', rank: 2, hot: '82.3w',
    address: '无锡市滨湖区马山镇灵山路1号',
    ticket: '210元（含梵宫）',
    hours: '08:00-17:00',
    website: 'https://baike.baidu.com/item/灵山大佛',
    comments: [
      { user: '芝士就是力量', platform: '小红书', stars: 5, likes: 1580, text: '88米大佛抬头看真的会起鸡皮疙瘩，梵宫内部金碧辉煌，建议留足3小时慢慢逛。' },
      { user: '桃桃乌龙', platform: '大众点评', stars: 5, likes: 664, text: '九龙灌浴表演和梵宫值得看，晚上有灯光秀。门票小贵但全程震撼，值。' },
      { user: '驴友小马', platform: '携程', stars: 4, likes: 210, text: '台阶挺多的，带老人小孩可以坐观光车。整体神圣又出片。' },
    ],
  },
  {
    name: '拈花湾', rank: 3, hot: '76.9w',
    address: '无锡市滨湖区马山镇环山西路68号',
    ticket: '120-150元（18:00后夜游79元）',
    hours: '09:00-21:00',
    website: 'https://baike.baidu.com/item/拈花湾',
    comments: [
      { user: '橘子汽水气泡', platform: '小红书', stars: 5, likes: 2011, text: '唐风建筑一步一禅意，晚上灯笼亮起来直接美哭，无人机孔明灯秀一定要看！住景区里可以免门票。' },
      { user: '摄影师林一', platform: '微博', stars: 5, likes: 980, text: '《禅行》夜秀和《花开五叶》水上舞太梦幻了，拍汉服绝佳地，建议傍晚入园连看夜景。' },
      { user: '周末去哪儿', platform: '大众点评', stars: 4, likes: 455, text: '夜景比白天好看十倍，白天稍显普通。吃饭选择不多，可以自带点零食。' },
    ],
  },
  {
    name: '惠山古镇', rank: 4, hot: '64.5w',
    address: '无锡市梁溪区宝善街18号',
    ticket: '古镇免费（文物古迹区另收费）',
    hours: '08:00-17:00（商业区至21:00）',
    website: 'https://baike.baidu.com/item/惠山古镇',
    comments: [
      { user: '青衫客', platform: '小红书', stars: 5, likes: 1345, text: '免费！120座祠堂群像露天博物馆，寄畅园是江南园林鼻祖，穿汉服来拍国风大片绝配。' },
      { user: '无锡土著老王', platform: '大众点评', stars: 5, likes: 702, text: '本地人周末常去，天下第二泉泡茶，出来顺手买三凤桥酱排骨，地道。' },
      { user: '慢慢逛的小鹿', platform: '携程', stars: 4, likes: 318, text: '古镇商业区氛围不错，泥人博物馆可以带娃看。节假日人有点多。' },
    ],
  },
  {
    name: '清名桥古运河', rank: 5, hot: '58.2w',
    address: '无锡市梁溪区南长街（清名桥古运河景区）',
    ticket: '免费（全天开放）',
    hours: '全天（店铺约10:00-22:00）',
    website: 'https://baike.baidu.com/item/清名桥',
    comments: [
      { user: '夜猫子阿离', platform: '小红书', stars: 5, likes: 1892, text: '南长街夜景yyds！红灯笼亮起氛围感拉满，19:00-21:30最美，坐运河游船看夜景超浪漫。' },
      { user: '一口吃掉彩虹', platform: '大众点评', stars: 5, likes: 823, text: '青砖黛瓦混搭咖啡馆书店，清名桥拍水乡倒影一绝，周新里文创园也好逛。' },
      { user: 'citywalk爱好者', platform: '微博', stars: 4, likes: 402, text: '白天安静文艺，晚上热闹，两种感觉都很棒。就是节假日人太多，建议工作日去。' },
    ],
  },
  {
    name: '中国杜鹃园', rank: 6, hot: '51.7w',
    address: '无锡市梁溪区锡惠公园内',
    ticket: '含于锡惠公园门票（约30-70元）',
    hours: '08:00-17:00',
    website: 'https://baike.baidu.com/item/锡惠公园',
    comments: [
      { user: '花见小路', platform: '小红书', stars: 5, likes: 1670, text: '2026年4月的顶流没跑了！醉红坡、踯躅廊、照影亭，近500种杜鹃，两天三万人次不是没道理。' },
      { user: '踏青小分队', platform: '大众点评', stars: 5, likes: 640, text: '长三角最美赏鹃胜地，早8点前入园最好，晚了拍的全是人头。' },
      { user: '花花世界', platform: '携程', stars: 4, likes: 289, text: '花是真的多真的艳，盛花期一定要来，错过等一年。' },
    ],
  },
  {
    name: '蠡园', rank: 7, hot: '47.3w',
    address: '无锡市滨湖区环湖路18号',
    ticket: '约45元',
    hours: '08:00-17:00',
    website: 'https://baike.baidu.com/item/蠡园',
    comments: [
      { user: '恋爱脑小张', platform: '小红书', stars: 5, likes: 1120, text: '范蠡西施的爱情地标，樱花桃花一起开太美了，还可以划皮划艇，情侣约会首选。' },
      { user: '桃蹊柳曲', platform: '大众点评', stars: 4, likes: 388, text: '比鼋头渚人少，出片率反而高，人少景美，适合慢慢逛。' },
      { user: '园林控', platform: '携程', stars: 5, likes: 256, text: '小巧精致的江南园林，四季有花，春天樱花桃花同框难得。' },
    ],
  },
  {
    name: '南禅寺', rank: 8, hot: '42.6w',
    address: '无锡市梁溪区老城核心（地铁1号线直达）',
    ticket: '免费',
    hours: '08:00-17:00',
    website: 'https://baike.baidu.com/item/南禅寺',
    comments: [
      { user: '佛系青年', platform: '小红书', stars: 5, likes: 890, text: '南朝四百八十寺之一，闹市里的清净地，免费！周边小吃街一条龙，拜完直接开吃。' },
      { user: '吃货小王', platform: '大众点评', stars: 4, likes: 310, text: '寺庙本身不大，重点是旁边的小吃街，梅花糕、玉兰饼安排上。' },
    ],
  },
  {
    name: '太湖之星摩天轮', rank: 9, hot: '38.9w',
    address: '无锡市滨湖区蠡湖之畔（蠡湖公园旁）',
    ticket: '约50元',
    hours: '09:00-21:00',
    website: 'https://baike.baidu.com/item/蠡湖公园',
    comments: [
      { user: '心动信号', platform: '小红书', stars: 5, likes: 756, text: '情侣告白绝佳处！升到最高点俯瞰整片太湖，傍晚去能看到绝美日落，浪漫到犯规。' },
      { user: '周末遛娃爸', platform: '大众点评', stars: 4, likes: 198, text: '孩子超喜欢，一圈十几分钟，风景很好，晚上亮灯更好看。' },
    ],
  },
  {
    name: '贡湖湾湿地公园', rank: 10, hot: '33.4w',
    address: '无锡市滨湖区贡湖湾（太湖边）',
    ticket: '免费',
    hours: '全天开放',
    website: 'https://baike.baidu.com/item/贡湖湾湿地公园',
    comments: [
      { user: '追剧达人', platform: '小红书', stars: 5, likes: 688, text: '《爱情公寓》同款取景地！太湖边的宝藏湿地，人少景美，野餐拍照都合适。' },
      { user: '自然观察员', platform: '微博', stars: 4, likes: 175, text: '湿地生态很好，鸟多，适合散步骑行，就是位置略偏。' },
    ],
  },
];

// name -> HOT 数据，供 popup 查询
const HOT_MAP = Object.fromEntries(HOT.map(h => [h.name, h]));
