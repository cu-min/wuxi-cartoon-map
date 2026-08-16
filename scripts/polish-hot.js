#!/usr/bin/env node
// ============================================================
// 热度榜详情增强脚本（DeepSeek）
//
// 作用：给每个城市热度榜 Top8 生成更丰富的展示字段：
//   longDesc  长简介（60~90字，弹窗主文案）
//   duration  建议游玩时长（如 "1-2小时"）
//   price     人均参考（如 "免费" / "30-60元"）
//   bestTime  最佳打卡时间（如 "傍晚日落时分"）
// 写入 data/*.js 的 hotMap[name]，原有字段全部保留。
//
// 用法：
//   node scripts/polish-hot.js              # 所有未完成城市
//   node scripts/polish-hot.js jiangsu-wuxi # 单城强制重跑
//
// 依赖：local-config.js 里配置 POLISH_CONFIG（baseUrl/apiKey/model）
// 幂等：scripts/.hot-polish-progress.json 记录进度，重跑自动跳过
// ============================================================

const fs = require('fs');
const path = require('path');

global.window = global;
require(path.join(__dirname, '..', 'local-config.js'));
const POLISH = global.window.POLISH_CONFIG || {};
if (!POLISH.apiKey) {
  console.error('❌ local-config.js 缺少 POLISH_CONFIG.apiKey');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROGRESS = path.join(__dirname, '.hot-polish-progress.json');
const INTERVAL = 600;

function buildPrompt(cityName, items) {
  return `你是文旅编辑，为卡通手绘地图「${cityName}」的热度榜地点补充展示信息。
对以下每个地点输出：longDesc（60~90字，两到三句，口语化有画面感，讲特色亮点，末尾带一句实用小贴士；不出现地址、电话）、duration（建议游玩时长，如"1-2小时"/"半天"）、price（人均参考，免费景点写"免费"，其余写区间如"40-80元"）、bestTime（最佳打卡时间，如"傍晚日落时分"/"上午人少"）。
- name 必须原样返回（作为匹配键）
- 严格只输出 JSON 数组：[{"name":"...","longDesc":"...","duration":"...","price":"...","bestTime":"..."}]，不要 markdown、不要解释

${JSON.stringify(items)}`;
}

async function callDeepSeek(content) {
  const res = await fetch(POLISH.baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + POLISH.apiKey },
    body: JSON.stringify({ model: POLISH.model, messages: [{ role: 'user', content }], max_tokens: 8000, temperature: 0.8 }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const d = await res.json();
  return d.choices[0].message.content;
}

function parseJsonArray(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('返回中没有 JSON 数组');
  return JSON.parse(m[0]);
}

// 与 generate-pois.js / polish-desc.js 的文件模板保持同一结构
function writeFile(outKey, city) {
  const head = `// ${city.name} POI 数据（热度榜详情已由 scripts/polish-hot.js 增强，${new Date().toISOString().slice(0, 10)}）\n`;
  const obj = {
    province: city.province, name: city.name, coord: city.coord,
    zoom: city.zoom, minZoom: city.minZoom || 10,
    shops: city.shops, hot: city.hot, hotMap: city.hotMap, types: city.types,
  };
  const body = `window.CITY_DATA = window.CITY_DATA || {};\nwindow.CITY_DATA['${outKey}'] = ${JSON.stringify(obj, null, 2)};\n`;
  fs.writeFileSync(path.join(DATA_DIR, outKey + '.js'), head + body, 'utf8');
}

async function polishCity(file) {
  global.window.CITY_DATA = {};
  require(file);
  const [key, city] = Object.entries(global.window.CITY_DATA)[0];
  delete require.cache[require.resolve(file)];

  const hotMap = city.hotMap || {};
  const items = Object.entries(hotMap).map(([name]) => ({ name, type: (city.shops.find(s => s.name === name) || {}).type || '' }));
  if (!items.length) return { key, skipped: '无热度榜' };

  let results;
  let retried = false;
  while (true) {
    try {
      results = parseJsonArray(await callDeepSeek(buildPrompt(city.name, items)));
      break;
    } catch (e) {
      if (retried) throw e;
      retried = true;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  let n = 0;
  for (const it of results) {
    if (!it || !it.name || !hotMap[it.name]) continue;
    const h = hotMap[it.name];
    if (typeof it.longDesc === 'string' && it.longDesc.trim()) h.longDesc = it.longDesc.trim().slice(0, 120);
    if (typeof it.duration === 'string' && it.duration.trim()) h.duration = it.duration.trim().slice(0, 12);
    if (typeof it.price === 'string' && it.price.trim()) h.price = it.price.trim().slice(0, 12);
    if (typeof it.bestTime === 'string' && it.bestTime.trim()) h.bestTime = it.bestTime.trim().slice(0, 12);
    n++;
  }
  if (!n) return { key, failed: '无匹配结果' };
  writeFile(key, city);
  return { key, polished: n, total: items.length };
}

async function main() {
  const target = process.argv[2];
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.js')).sort();
  let done = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : {};

  let todo;
  if (target) {
    const hit = files.filter(f => f.includes(target) || target.includes(f.replace('.js', '')));
    if (!hit.length) { console.error('❌ 找不到城市：' + target); process.exit(1); }
    todo = hit;
    for (const f of hit) delete done[f];
  } else {
    todo = files.filter(f => !done[f]);
  }
  console.log('待增强：' + todo.length + ' 个城市\n');

  let ok = 0, fail = 0;
  for (const f of todo) {
    try {
      const r = await polishCity(path.join(DATA_DIR, f));
      if (r.polished) {
        ok++;
        done[f] = { date: new Date().toISOString().slice(0, 10), polished: r.polished, total: r.total };
        console.log('  ✅ ' + r.key + '：' + r.polished + '/' + r.total + ' 条热度榜已增强');
      } else {
        console.log('  ⚠️ ' + (r.key || f) + '：' + (r.skipped || r.failed));
      }
    } catch (e) {
      fail++;
      console.error('  ❌ ' + f + '：' + e.message);
    }
    fs.writeFileSync(PROGRESS, JSON.stringify(done, null, 2));
    await new Promise(r => setTimeout(r, INTERVAL));
  }
  console.log('\n📊 完成 ' + ok + ' / 失败 ' + fail + '（进度存于 scripts/.hot-polish-progress.json）');
}

main();
