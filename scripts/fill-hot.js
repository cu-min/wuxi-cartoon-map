#!/usr/bin/env node
// ============================================================
// 热度榜填充脚本
//
// 作用：为 data/ 下所有 hot 为空的城市数据自动生成「今日热度榜」
//       （hot + hotMap），让城市视图的 🔥 热度榜直接可用。
//
// 热度选取规则：跨类型轮转（round-robin）取前 8 个 POI，
//       保证榜单类型多样；热度指数按名次递减（98→71）。
//       POI 顺序沿用生成时的腾讯综合热度排序。
//
// 填充的字段（均为占位，待 AI 润色/真实数据替换）：
//   address  从 desc 中提取（分类后拼接的地址部分）
//   ticket   景点/博物馆 =「以现场公示为准」，其余 =「免费」
//   hours    景点 =「全天开放」，博物馆 =「09:00-17:00」，其余 =「10:00-22:00」
//   website  高德地图搜索链接（真实可用，非编造）
//   comments 留空 []，前端对空评论隐藏评价区
//
// 用法：node scripts/fill-hot.js
// 幂等：hot 已非空的城市自动跳过（不会覆盖人工/AI 润色过的数据）
// ============================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HOT_SIZES = 8;
const HOT_SCORES = [98, 93, 89, 85, 81, 77, 74, 71];

function pickTop(shops, types) {
  // 跨类型轮转：types 顺序循环，每轮每类取 1 个，凑满 8 个
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
  // desc 格式："分类:子类 地址" 或 "分类 地址" —— 取第一个空格后的部分
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

function buildHot(city) {
  const shops = city.shops || [];
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

function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.js'));
  let filled = 0, skipped = 0, failed = 0;

  for (const f of files) {
    const file = path.join(DATA_DIR, f);
    let text = fs.readFileSync(file, 'utf8');

    // 仅处理「hot 为空」的城市（幂等，不覆盖已有数据）
    if (!/  hot: \[\],\r?\n  hotMap: \{\},/.test(text)) { skipped++; continue; }

    global.window = global.window || {};
    global.window.CITY_DATA = {};
    try {
      require(file);
    } catch (e) { console.error('  ❌ ' + f + ' 解析失败：' + e.message); failed++; continue; }
    const city = Object.values(global.window.CITY_DATA)[0];
    if (!city) { failed++; continue; }

    const built = buildHot(city);
    if (!built) { console.warn('  ⚠️ ' + city.name + ' 无 POI，跳过'); skipped++; continue; }

    const hotCode = JSON.stringify(built.hot, null, 2).replace(/\n/g, '\n  ');
    const mapCode = JSON.stringify(built.hotMap, null, 2).replace(/\n/g, '\n  ');
    text = text.replace(
      /  hot: \[\],\r?\n  hotMap: \{\},/,
      '  hot: ' + hotCode + ',\n  hotMap: ' + mapCode + ','
    );
    fs.writeFileSync(file, text, 'utf8');
    filled++;
    console.log('  ✅ ' + city.name + '：热度榜 ' + built.hot.length + ' 条');
    delete require.cache[require.resolve(file)];
  }

  console.log('\n📊 汇总：填充 ' + filled + ' / 跳过 ' + skipped + ' / 失败 ' + failed);

  // 顺带报告高优先级覆盖缺口
  const CITY_CONFIG = require('./city-config.js');
  const have = new Set(files.map(f => f.replace('.js', '')));
  const missing = CITY_CONFIG.filter(c => c.priority === 'high' && !have.has(c.province + '-' + c.key));
  console.log('\n🗺️ 高优先级城市：已覆盖 ' + (CITY_CONFIG.filter(c => c.priority === 'high').length - missing.length) +
    '，还缺 ' + missing.length + ' 个：' + missing.map(c => c.name).join('、'));
}

main();
