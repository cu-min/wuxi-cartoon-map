#!/usr/bin/env node
// ============================================================
// 通用类别名清理脚本
//
// 作用：剔除 data/*.js 里"名字就是通用类别词"的 POI（如"超市"、
//       "cafe"、"花店"）——这类点无辨识度；纯英文名、短名保留。
//       剔除后若热度榜不足 8 条，自动从剩余 POI 重建补位。
//
// 用法：node scripts/clean-generic-names.js [城市key片段]   # 不带参数=全部
// 幂等：重跑无副作用（无命中则跳过不写文件）
// ============================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HOT_SIZES = 8;
const HOT_SCORES = [98, 93, 89, 85, 81, 77, 74, 71];

const GENERIC_NAMES = new Set(['超市', '商店', '便利店', '小卖部', '百货商店', '购物中心', '商场', '购物广场', '菜市场', '农贸市场', '水果店', '花店', '书店', '书城', '文具店', '咖啡', '咖啡厅', '咖啡店', 'cafe', 'café', 'coffee', '奶茶店', '茶饮店', '茶楼', '茶室', '美食城', '美食广场', '餐厅', '饭店', '餐馆', '快餐店', '小吃店', '药店', '药房', '诊所', '理发店', '美发店', '银行', '加油站', '宾馆', '旅馆', '招待所', '洗浴中心', '网吧', '网咖', '台球厅', '棋牌室', '健身房', '瑜伽馆', '母婴店', '服装店', '童装店', '鞋店', '手机店', '打印店', '图文店', '照相馆', '影楼', '宠物店', '宠物医院', '洗衣店', '干洗店', '房产中介', '停车场', '公共厕所', '厕所', '公园', '广场', '博物馆', '美术馆', '图书馆', '电影院', '剧院', '游乐场', '动物园', '植物园', '景区', '景点', '寺庙', '教堂', '民宿', '青年旅舍', '青旅', '酒吧', '游泳馆', '体育馆', '运动场', 'ktv', 'atm']);

function isGenericName(name) {
  const n = String(name || '').replace(/[（(][^）)]*[）)]/g, '').trim().toLowerCase();
  return GENERIC_NAMES.has(n);
}

function pickTop(shops, types) {
  const pools = types.map(t => shops.filter(s => s.type === t));
  const out = [];
  for (let round = 0; out.length < HOT_SIZES; round++) {
    let picked = false;
    for (const pool of pools) {
      if (out.length >= HOT_SIZES) break;
      if (pool[round]) { out.push(pool[round]); picked = true; }
    }
    if (!picked) break;
  }
  return out;
}

function extractAddress(desc) {
  if (!desc) return '见地图定位';
  const i = desc.indexOf(' ');
  return i > 0 ? desc.slice(i + 1).trim() : '见地图定位';
}

function placeholderTicket(type) {
  return (type === '景点' || type === '博物馆') ? '以现场公示为准' : '免费';
}

function placeholderHours(type) {
  if (type === '景点') return '全天开放';
  if (type === '博物馆') return '09:00-17:00';
  return '10:00-22:00';
}

function buildHot(city, shops) {
  const types = city.types && city.types.length ? city.types : [...new Set(shops.map(s => s.type))];
  const top = pickTop(shops, types);
  if (!top.length) return null;
  const hot = top.map((s, i) => ({ rank: i + 1, name: s.name, hot: HOT_SCORES[i] }));
  const hotMap = {};
  top.forEach((s, i) => {
    hotMap[s.name] = {
      rank: i + 1,
      hot: HOT_SCORES[i],
      address: extractAddress(s.desc),
      ticket: placeholderTicket(s.type),
      hours: placeholderHours(s.type),
      website: 'https://www.amap.com/search?query=' + encodeURIComponent(city.name + ' ' + s.name),
      comments: [],
    };
  });
  return { hot, hotMap };
}

function writeFile(outKey, city) {
  const head = `// ${city.name} POI 数据（已由 scripts/clean-generic-names.js 清理通用名，${new Date().toISOString().slice(0, 10)}）\n`;
  const obj = {
    province: city.province, name: city.name, coord: city.coord,
    zoom: city.zoom, minZoom: city.minZoom || 10,
    shops: city.shops, hot: city.hot, hotMap: city.hotMap, types: city.types,
  };
  const body = `window.CITY_DATA = window.CITY_DATA || {};\nwindow.CITY_DATA['${outKey}'] = ${JSON.stringify(obj, null, 2)};\n`;
  fs.writeFileSync(path.join(DATA_DIR, outKey + '.js'), head + body, 'utf8');
}

async function main() {
  const target = process.argv[2];
  let files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.js')).sort();
  if (target) files = files.filter(f => f.includes(target) || target.includes(f.replace('.js', '')));

  let cleaned = 0, untouched = 0, removedTotal = 0;

  for (const f of files) {
    const file = path.join(DATA_DIR, f);
    global.window = {};
    try { require(file); } catch (e) { console.error('  ❌ ' + f + ' 解析失败：' + e.message); continue; }
    const [key, city] = Object.entries(global.window.CITY_DATA)[0];
    delete require.cache[require.resolve(file)];
    if (!city) continue;

    const before = (city.shops || []).length;
    const shops = (city.shops || []).filter(s => !isGenericName(s.name));
    const removed = before - shops.length;
    const hotHadGeneric = (city.hot || []).some(h => isGenericName(h.name));

    if (!removed && !hotHadGeneric) { untouched++; continue; }

    city.shops = shops;
    const built = buildHot(city, shops);
    if (built) { city.hot = built.hot; city.hotMap = built.hotMap; }
    else { city.hot = city.hot || []; city.hotMap = city.hotMap || {}; }
    writeFile(key, city);
    cleaned++;
    removedTotal += removed;
    console.log('  ✅ ' + city.name + '：剔除 ' + removed + ' 个通用名，热度榜重排为 ' + (built ? built.hot.length : 0) + ' 条');
  }

  console.log('\n📊 汇总：清理 ' + cleaned + ' 城 / 无需处理 ' + untouched + ' / 共剔除 ' + removedTotal + ' 个 POI');
}

main();
