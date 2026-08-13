#!/usr/bin/env node
// ============================================================
// 城市 POI 数据自动生成脚本（腾讯位置服务）
//
// 作用：按城市批量拉取景点/博物馆/商场/美食/咖啡茶饮/文创书店/花店
//       等场所数据（名称 + 坐标 + 类型 + 简介），自动清洗过滤后
//       生成该城市的地图数据文件，并自动注册进页面。
//
// 用法：
//   单个城市：node scripts/generate-pois.js --city 无锡 --key wuxi --province jiangsu
//   指定批量：node scripts/generate-pois.js --cities 无锡,苏州,南京
//   全表批量：node scripts/generate-pois.js --all
//   本地试跑（不调 API，验证过滤管线）：node scripts/generate-pois.js --sample --city 无锡 --key wuxi --province jiangsu
//   可选：--lat 31.49 --lng 120.31 --zoom 12 --max 12
//
// 前置条件：
//   1. local-config.js 已配置腾讯 key（ipKey）
//   2. key 已在腾讯位置服务控制台开通 WebServiceAPI
//   3. 配额充足（每天重置，可在控制台申请提升）
//
// 输出：data/{province}-{key}.js（注册到 window.CITY_DATA）
// ============================================================

const fs = require('fs');
const path = require('path');

// ---------- 读取本地 key（local-config.js 已被 gitignore，不入库） ----------
global.window = global.window || {};
require(path.join(__dirname, '..', 'local-config.js'));
const KEY = (global.window.MAP_CONFIG || {}).ipKey;
if (!KEY) {
  console.error('❌ 未找到 key：请确认 local-config.js 存在且 ipKey 已填写');
  process.exit(1);
}

// ---------- 城市配置表（全量 333 地级行政区，见 scripts/city-config.js） ----------
const CITY_CONFIG = require('./city-config.js');

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
function opt(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
const SAMPLE = args.includes('--sample');   // 本地试跑模式（不调 API）
const zoomDefault = parseInt(opt('--zoom') || '12', 10);
const maxDefault = parseInt(opt('--max') || '0', 10);        // 0 = 按城市优先级自动（普通10 / 重点20）
const pagesDefault = parseInt(opt('--pages') || '3', 10);    // 每个关键词翻页数（尽量拉全，默认3页=最多60条）

// 解析要跑的城市
let citiesToRun = [];
if (args.includes('--all')) {
  citiesToRun = CITY_CONFIG.slice();
} else if (args.includes('--high')) {
  citiesToRun = CITY_CONFIG.filter(c => c.priority === 'high'); // 只跑热门/省会城市
} else if (opt('--cities')) {
  const names = opt('--cities').split(',').map(s => s.trim());
  citiesToRun = CITY_CONFIG.filter(c => names.includes(c.name));
  const missing = names.filter(n => !citiesToRun.some(c => c.name === n));
  if (missing.length) console.warn(`⚠️ 配置表中未找到：${missing.join('、')}，请检查城市名或手动添加到 CITY_CONFIG`);
} else if (opt('--city')) {
  citiesToRun = [{ name: opt('--city'), key: opt('--key'), province: opt('--province'), priority: 'high' }];
}
if (!citiesToRun.length) {
  console.log('用法：');
  console.log('  node scripts/generate-pois.js --high                    # 只跑热门/省会城市（约60个）');
  console.log('  node scripts/generate-pois.js --cities 无锡,苏州,南京   # 指定城市批量');
  console.log('  node scripts/generate-pois.js --all                     # 全配置表批量（333 个地级行政区）');
  console.log('  node scripts/generate-pois.js --sample --city 无锡 --key wuxi --province jiangsu   # 本地试跑');
  process.exit(1);
}

// ---------- 类型配置（可扩展，新增类型只需加一行 + emoji） ----------
const TYPE_CFG = [
  { type: '景点',     keywords: ['旅游景点', '风景名胜', '公园'] },
  { type: '博物馆',   keywords: ['博物馆', '纪念馆'] },
  { type: '商场',     keywords: ['购物中心', '商场'] },
  { type: '美食',     keywords: ['美食', '老字号'] },
  { type: '咖啡茶饮', keywords: ['咖啡', '茶馆'] },
  { type: '文创书店', keywords: ['书店', '文创'] },
  { type: '花店',     keywords: ['花店', '鲜花'] },
];

const EMOJI = {
  '景点': '⛰️', '博物馆': '🏛️', '商场': '🛍️', '美食': '🍜',
  '咖啡茶饮': '☕', '文创书店': '📚', '花店': '💐',
};
const SCENE_EMOJI = [
  ['公园', '🌳'], ['寺庙', '🛕'], ['古镇', '🏯'], ['古村', '🏘️'], ['园林', '🌸'],
  ['博物馆', '🏛️'], ['美术馆', '🎨'], ['湖', '🌊'], ['山', '⛰️'], ['塔', '🗼'],
  ['岛', '🏝️'], ['街', '🏘️'], ['教堂', '⛪'], ['动物园', '🐼'], ['乐园', '🎢'],
  ['温泉', '♨️'], ['纪念馆', '🏛️'], ['故居', '🏚️'], ['桥', '🌉'], ['花', '💐'],
];

// 黑名单：这些词出现即视为无效 POI（售票处/停车场等）
const BLACKLIST = ['售票处', '停车场', '卫生间', '洗手间', '入口', '出口', '服务中心', '游客中心', '公交站', '地铁站', '招商', '广告', '租售'];

function pickEmoji(type, category) {
  const c = category || '';
  if (type === '景点' || type === '博物馆') {
    for (const [kw, e] of SCENE_EMOJI) if (c.includes(kw)) return e;
  }
  return EMOJI[type] || '📍';
}

// ---------- 腾讯 POI 搜索 API ----------
const API = 'https://apis.map.qq.com/ws/place/v1/search';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchKeyword(cityName, kw, maxPages) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${API}?keyword=${encodeURIComponent(kw)}&boundary=${encodeURIComponent(`region(${cityName},0)`)}&page_size=20&page_index=${page}&key=${KEY}`;
    const res = await fetch(url);
    const d = await res.json();
    if (d.status !== 0) {
      if (d.status === 199) throw new Error('❌ key 未开通 WebServiceAPI：请到腾讯位置服务控制台「配额管理 → WebServiceAPI」开通后再运行');
      if (/上限|配额/.test(d.message)) throw new Error(`❌ key 当日调用配额已用完（${d.message}）：可明天再跑，或在控制台「配额管理」申请提升`);
      console.warn(`    [跳过] ${kw} p${page}: ${d.message}`);
      break;
    }
    const list = d.data || [];
    all.push(...list);
    if (list.length < 20) break; // 本页不满一页说明到底了
    await sleep(150);
  }
  return all;
}

// ============================================================
// 自动化筛选管线
// ============================================================

// 1. 名称清洗
function cleanName(raw) {
  return (raw || '').replace(/\s+/g, '').trim();
}

// 2. 类型判定（title + category 关键词）
function matchType(name, category) {
  const text = `${name} ${category}`;
  if (/书店|书城|图书馆/.test(text)) return '文创书店';
  if (/咖啡|茶馆|茶饮|奶茶/.test(text)) return '咖啡茶饮';
  if (/花店|鲜花|园艺/.test(text)) return '花店';
  if (/博物馆|纪念馆|美术馆|展览馆/.test(text)) return '博物馆';
  if (/购物中心|商场|百货|步行街|广场/.test(text)) return '商场';
  if (/餐厅|美食|饭店|老字号|小吃|面馆|菜馆|酒楼/.test(text)) return '美食';
  if (/公园|风景|名胜|寺|庙|古镇|园林|山|湖|塔|岛|遗址|街区|乐园/.test(text)) return '景点';
  return null; // 无法判定 → 丢弃
}

// 3. 清洗 + 过滤（去重 / 黑名单 / 坐标有效 / 无信息水货）
function filterPois(rawList) {
  const seen = new Set();
  const out = [];
  for (const p of rawList) {
    const name = cleanName(p.name);
    if (!name || seen.has(name)) continue;
    if (name.length > 28) continue;                    // 超长名大概率是广告位/转让信息
    if (BLACKLIST.some(b => name.includes(b))) continue;
    const lat = parseFloat((p.location || {}).lat);
    const lng = parseFloat((p.location || {}).lng);
    if (!(lat > 3 && lat < 54 && lng > 73 && lng < 136)) continue; // 中国范围粗校验
    if (!(p.address || '').trim() && !(p.category || '').trim()) continue; // 无地址无分类 = 水货
    seen.add(name);
    out.push({ name, category: p.category || '', address: p.address || '', lat, lng });
  }
  return out;
}

// 4. 按类型分组（保持 API 返回顺序 = 腾讯综合热度排序，热门优先）
function buildShops(filtered) {
  const groups = {};
  for (const p of filtered) {
    const t = matchType(p.name, p.category);
    if (!t) continue;
    (groups[t] = groups[t] || []).push(p);
  }
  return groups;
}

// ---------- 生成数据文件 + 注册 ----------
function writeCityData(cfg, shops) {
  const outKey = `${cfg.province}-${cfg.key}`;
  const outFile = path.join(__dirname, '..', 'data', `${outKey}.js`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const types = [...new Set(shops.map(s => s.type))];
  const cLat = +(shops.reduce((s, x) => s + x.lat, 0) / shops.length).toFixed(5);
  const cLng = +(shops.reduce((s, x) => s + x.lng, 0) / shops.length).toFixed(5);
  const zoom = cfg.zoom || zoomDefault;

  const cleanShops = shops.map(s => ({
    name: s.name, type: s.type, emoji: s.emoji,
    lat: +s.lat.toFixed(5), lng: +s.lng.toFixed(5),
    desc: s.desc,
  }));

  const code = `// ${cfg.name} POI 数据（由 scripts/generate-pois.js 自动生成，${new Date().toISOString().slice(0, 10)}）
// 如需人工润色简介，直接编辑 desc 字段
window.CITY_DATA = window.CITY_DATA || {};
window.CITY_DATA['${outKey}'] = {
  province: '${cfg.province}',
  name: '${cfg.name}',
  coord: [${cLat}, ${cLng}],
  zoom: ${zoom},
  minZoom: 10,
  shops: ${JSON.stringify(cleanShops, null, 2)},
  hot: [],
  hotMap: {},
  types: ${JSON.stringify(types)},
};
`;
  fs.writeFileSync(outFile, code, 'utf8');

  // 自动注册 1：index.html（幂等）
  const indexHtml = path.join(__dirname, '..', 'index.html');
  let html = fs.readFileSync(indexHtml, 'utf8');
  if (!html.includes(`data/${outKey}.js`)) {
    html = html.replace('</body>', `  <script src="data/${outKey}.js"></script>\n</body>`);
    fs.writeFileSync(indexHtml, html, 'utf8');
    return { outFile, outKey, types, registered: true };
  }
  return { outFile, outKey, types, registered: false };
}

// ---------- 单个城市完整流程 ----------
async function runCity(cfg) {
  const limit = maxDefault || (cfg.priority === 'high' ? 20 : 10);
  console.log(`\n📡 ${SAMPLE ? '[试跑] ' : ''}「${cfg.name}」…`);

  // 1. 拉取原始数据（多关键词 + 多翻页，尽量拉全）
  const rawList = [];
  if (SAMPLE) {
    rawList.push(...SAMPLE_POIS);
  } else {
    for (const t of TYPE_CFG) {
      process.stdout.write(`    ${t.type}: `);
      let got = 0;
      for (const kw of t.keywords) {
        const list = await searchKeyword(cfg.name, kw, pagesDefault);
        for (const p of list) {
          const title = cleanName(p.title);
          if (title && !rawList.some(x => x.name === title)) {
            rawList.push({ name: title, category: p.category || '', address: p.address || '', location: p.location || {} });
            got++;
          }
        }
        await sleep(120);
      }
      console.log(`${got} 条原始`);
    }
  }

  // 2. 清洗过滤
  const filtered = filterPois(rawList);
  // 3. 类型分组 + 限量
  const groups = buildShops(filtered);

  // 4. 组装 shops
  const shops = [];
  for (const t of TYPE_CFG.map(c => c.type)) {
    const list = (groups[t] || []).slice(0, limit);
    for (const p of list) {
      shops.push({
        name: p.name,
        type: t,
        emoji: pickEmoji(t, p.category),
        lat: p.lat,
        lng: p.lng,
        desc: makeDesc(p, t),
      });
    }
  }

  if (!shops.length) {
    console.warn(`    ⚠️ 无有效数据（原始 ${rawList.length} 条 → 过滤后 0 条）`);
    return { cfg, ok: false };
  }

  // 每类数量统计
  const perType = {};
  shops.forEach(s => { perType[s.type] = (perType[s.type] || 0) + 1; });

  const { outFile, outKey, types, registered } = writeCityData(cfg, shops);
  console.log(`    ✅ ${outFile}（共 ${shops.length} 个：${Object.entries(perType).map(([t, n]) => `${t}×${n}`).join('、')}${registered ? '，已注册 index.html' : ''}）`);
  return { cfg, ok: true, count: shops.length, types, dropped: filtered.length - shops.length };
}

// ---------- 主流程（批量） ----------
async function main() {
  console.log(`🚀 共 ${citiesToRun.length} 个城市待处理${SAMPLE ? '（试跑模式，不消耗配额）' : ''}`);
  const okList = [], failList = [];
  for (const cfg of citiesToRun) {
    try {
      const r = await runCity(cfg);
      if (r.ok) okList.push(r);
      else failList.push(cfg.name);
    } catch (e) {
      console.error(`    ❌ ${cfg.name} 失败：${e.message}`);
      if (!/配额|上限/.test(e.message)) failList.push(cfg.name);
      else { console.log('\n⏹️ 配额问题，停止批量。'); process.exit(1); }
    }
  }
  console.log(`\n📊 汇总：成功 ${okList.length} / ${citiesToRun.length}`);
  if (failList.length) console.log(`  失败/无数据：${failList.join('、')}`);
}

// ---------- 其他工具 ----------
function makeDesc(p, type) {
  const cat = (p.category || '').split(';').filter(Boolean).join(' · ');
  const addr = p.address ? ` ${p.address}` : '';
  return `${cat || type}${addr}`;
}

// ---------- 试跑样例数据（--sample 用，验证过滤管线） ----------
const SAMPLE_POIS = [
  { name: '鼋头渚', category: '旅游景点;风景名胜', address: '滨湖区鼋渚路1号', location: { lat: 31.544, lng: 120.250 } },
  { name: '灵山大佛', category: '旅游景点;风景名胜', address: '马山镇灵山路1号', location: { lat: 31.433, lng: 120.100 } },
  { name: '惠山古镇', category: '古镇', address: '梁溪区宝善街', location: { lat: 31.590, lng: 120.270 } },
  { name: '太湖之星摩天轮', category: '游乐场', address: '蠡湖公园', location: { lat: 31.512, lng: 120.258 } },
  { name: '售票处', category: '旅游景点', address: '景区门口', location: { lat: 31.5, lng: 120.2 } },
  { name: '锡惠公园停车场', category: '停车场', address: '锡惠公园', location: { lat: 31.589, lng: 120.268 } },
  { name: '无锡博物馆', category: '博物馆', address: '钟书路100号', location: { lat: 31.573, lng: 120.295 } },
  { name: '恒隆广场', category: '购物中心', address: '中山路168号', location: { lat: 31.575, lng: 120.301 } },
  { name: '万象城', category: '购物中心', address: '蠡湖大道', location: { lat: 31.512, lng: 120.272 } },
  { name: '王兴记', category: '美食;老字号', address: '中山路', location: { lat: 31.575, lng: 120.300 } },
  { name: '三凤桥', category: '美食;老字号', address: '中山路240号', location: { lat: 31.574, lng: 120.300 } },
  { name: '某不知名超长名称店铺广告位招商中欢迎咨询', category: '美食', address: '', location: { lat: 31.57, lng: 120.29 } },
  { name: '猫屎咖啡', category: '咖啡厅', address: '南长街', location: { lat: 31.566, lng: 120.303 } },
  { name: '西西弗书店', category: '书店', address: '恒隆广场4F', location: { lat: 31.576, lng: 120.302 } },
  { name: '花涧堂花店', category: '花店', address: '清扬路', location: { lat: 31.568, lng: 120.295 } },
  { name: '越界坐标', category: '其他', address: '', location: { lat: 99, lng: 99 } },
];

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
