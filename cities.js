// ============================================================
// 全国省级行政区元数据（34 个）
// key      : 拼音标识，用于路由（#/p/{key}）
// adcode   : 阿里 DataV 行政区划编码，用于加载 geoJSON 边界
// name     : 简称（地图展示）
// fullName : 全称（用于 IP 定位结果匹配）
// capital  : 省会/首府
// coord    : 省会/首府坐标（[lng, lat]，GCJ-02 近似值，仅用于标注）
// ============================================================
window.PROVINCES = [
  { key: 'beijing',     adcode: 110000, name: '北京', fullName: '北京市',             capital: '北京', coord: [116.40, 39.90] },
  { key: 'tianjin',     adcode: 120000, name: '天津', fullName: '天津市',             capital: '天津', coord: [117.20, 39.08] },
  { key: 'hebei',       adcode: 130000, name: '河北', fullName: '河北省',             capital: '石家庄', coord: [114.51, 38.04] },
  { key: 'shanxi',      adcode: 140000, name: '山西', fullName: '山西省',             capital: '太原', coord: [112.55, 37.87] },
  { key: 'neimenggu',   adcode: 150000, name: '内蒙古', fullName: '内蒙古自治区',     capital: '呼和浩特', coord: [111.75, 40.84] },
  { key: 'liaoning',    adcode: 210000, name: '辽宁', fullName: '辽宁省',             capital: '沈阳', coord: [123.43, 41.80] },
  { key: 'jilin',       adcode: 220000, name: '吉林', fullName: '吉林省',             capital: '长春', coord: [125.32, 43.82] },
  { key: 'heilongjiang', adcode: 230000, name: '黑龙江', fullName: '黑龙江省',       capital: '哈尔滨', coord: [126.53, 45.80] },
  { key: 'shanghai',    adcode: 310000, name: '上海', fullName: '上海市',             capital: '上海', coord: [121.47, 31.23] },
  { key: 'jiangsu',     adcode: 320000, name: '江苏', fullName: '江苏省',             capital: '南京', coord: [118.80, 32.06] },
  { key: 'zhejiang',    adcode: 330000, name: '浙江', fullName: '浙江省',             capital: '杭州', coord: [120.15, 30.28] },
  { key: 'anhui',       adcode: 340000, name: '安徽', fullName: '安徽省',             capital: '合肥', coord: [117.23, 31.82] },
  { key: 'fujian',      adcode: 350000, name: '福建', fullName: '福建省',             capital: '福州', coord: [119.30, 26.08] },
  { key: 'jiangxi',     adcode: 360000, name: '江西', fullName: '江西省',             capital: '南昌', coord: [115.86, 28.68] },
  { key: 'shandong',    adcode: 370000, name: '山东', fullName: '山东省',             capital: '济南', coord: [117.12, 36.65] },
  { key: 'henan',       adcode: 410000, name: '河南', fullName: '河南省',             capital: '郑州', coord: [113.63, 34.75] },
  { key: 'hubei',       adcode: 420000, name: '湖北', fullName: '湖北省',             capital: '武汉', coord: [114.30, 30.59] },
  { key: 'hunan',       adcode: 430000, name: '湖南', fullName: '湖南省',             capital: '长沙', coord: [112.94, 28.23] },
  { key: 'guangdong',   adcode: 440000, name: '广东', fullName: '广东省',             capital: '广州', coord: [113.26, 23.13] },
  { key: 'guangxi',     adcode: 450000, name: '广西', fullName: '广西壮族自治区',     capital: '南宁', coord: [108.37, 22.82] },
  { key: 'hainan',      adcode: 460000, name: '海南', fullName: '海南省',             capital: '海口', coord: [110.32, 20.03] },
  { key: 'chongqing',   adcode: 500000, name: '重庆', fullName: '重庆市',             capital: '重庆', coord: [106.55, 29.56] },
  { key: 'sichuan',     adcode: 510000, name: '四川', fullName: '四川省',             capital: '成都', coord: [104.07, 30.57] },
  { key: 'guizhou',     adcode: 520000, name: '贵州', fullName: '贵州省',             capital: '贵阳', coord: [106.63, 26.65] },
  { key: 'yunnan',      adcode: 530000, name: '云南', fullName: '云南省',             capital: '昆明', coord: [102.83, 24.88] },
  { key: 'xizang',      adcode: 540000, name: '西藏', fullName: '西藏自治区',         capital: '拉萨', coord: [91.14, 29.65] },
  { key: 'shaanxi',     adcode: 610000, name: '陕西', fullName: '陕西省',             capital: '西安', coord: [108.94, 34.34] },
  { key: 'gansu',       adcode: 620000, name: '甘肃', fullName: '甘肃省',             capital: '兰州', coord: [103.83, 36.06] },
  { key: 'qinghai',     adcode: 630000, name: '青海', fullName: '青海省',             capital: '西宁', coord: [101.78, 36.62] },
  { key: 'ningxia',     adcode: 640000, name: '宁夏', fullName: '宁夏回族自治区',     capital: '银川', coord: [106.23, 38.49] },
  { key: 'xinjiang',    adcode: 650000, name: '新疆', fullName: '新疆维吾尔自治区',   capital: '乌鲁木齐', coord: [87.62, 43.83] },
  { key: 'taiwan',      adcode: 710000, name: '台湾', fullName: '台湾省',             capital: '台北', coord: [121.56, 25.03] },
  { key: 'hongkong',    adcode: 810000, name: '香港', fullName: '香港特别行政区',     capital: '香港', coord: [114.17, 22.32] },
  { key: 'macao',       adcode: 820000, name: '澳门', fullName: '澳门特别行政区',     capital: '澳门', coord: [113.55, 22.20] },
];
