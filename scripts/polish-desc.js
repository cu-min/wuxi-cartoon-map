#!/usr/bin/env node
// ============================================================
// desc AI 润色脚本
//
// 作用：调用 DeepSeek（deepseek-chat = v4-flash 无思考基础版）
//       批量把 data/*.js 里"分类+地址"式的水货 desc 改写成
//       一句话卡通地图简介。
//
// 用法：
//   node scripts/polish-desc.js            # 润色所有未完成城市
//   node scripts/polish-desc.js jiangsu-wuxi   # 只润色指定城市（文件名片段）
//
// 依赖：local-config.js 里配置 POLISH_CONFIG（baseUrl/apiKey/model）
// 幂等：scripts/.polish-progress.json 记录已完成城市，重跑自动跳过
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
const PROGRESS = path.join(__dirname, '.polish-progress.json');
const BATCH = 60;      // 每次请求处理的 POI 数上限
const INTERVAL = 600;  // 两次请求之间的间隔 ms

function buildPrompt(city, shops) {
  return `你是文旅文案编辑，给卡通手绘地图写地点简介。为「${city}」的以下地点各写一句简介。
要求：
- 每条不超过 26 个字；口语化、有画面感，突出特色或卖点
- 不出现地址、电话、价格，也不用"位于""是一家"这类句式
- name 必须原样返回（作为匹配键）
- 严格只输出 JSON 数组：[{"name":"...","desc":"..."}]，不要 markdown、不要解释

${JSON.stringify(shops.map(s => ({ name: s.name, type: s.type })))}`;
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
  const m = text.match(/\[[\s\S]*\]/); // 容错：剥掉可能的 ```json 包裹
  if (!m) throw new Error('返回中没有 JSON 数组');
  return JSON.parse(m[0]);
}

// 与 generate-pois.js 的文件模板保持同一结构
function writeFile(outKey, city) {
  const head = `// ${city.name} POI 数据（desc 已由 scripts/polish-desc.js AI 润色，${new Date().toISOString().slice(0, 10)}）\n// 如需人工微调简介，直接编辑 desc 字段\n`;
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

  const shops = city.shops || [];
  if (!shops.length) return { key, skipped: '无 POI' };

  const map = {};
  for (let i = 0; i < shops.length; i += BATCH) {
    const batch = shops.slice(i, i + BATCH);
    let retried = false;
    while (true) {
      try {
        const text = await callDeepSeek(buildPrompt(city.name, batch));
        for (const it of parseJsonArray(text)) {
          if (it && it.name && typeof it.desc === 'string' && it.desc.trim()) {
            const d = it.desc.trim().slice(0, 40);
            map[it.name] = d;
          }
        }
        break;
      } catch (e) {
        if (retried) throw e;
        retried = true; // 单次重试
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    await new Promise(r => setTimeout(r, INTERVAL));
  }

  let n = 0;
  for (const s of shops) { if (map[s.name]) { s.desc = map[s.name]; n++; } }
  if (!n) return { key, failed: '无匹配结果' };
  writeFile(key, city);
  return { key, polished: n, total: shops.length };
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
    for (const f of hit) delete done[f]; // 单城模式强制重跑
  } else {
    todo = files.filter(f => !done[f]);
  }
  console.log('待润色：' + todo.length + ' 个城市\n');

  let ok = 0, fail = 0;
  for (const f of todo) {
    try {
      const r = await polishCity(path.join(DATA_DIR, f));
      if (r.polished) {
        ok++;
        done[f] = { date: new Date().toISOString().slice(0, 10), polished: r.polished, total: r.total };
        console.log('  ✅ ' + r.key + '：' + r.polished + '/' + r.total + ' 条已更新');
      } else {
        console.log('  ⚠️ ' + (r.key || f) + '：' + (r.skipped || r.failed));
      }
    } catch (e) {
      fail++;
      console.error('  ❌ ' + f + '：' + e.message);
    }
    fs.writeFileSync(PROGRESS, JSON.stringify(done, null, 2));
  }
  console.log('\n📊 完成 ' + ok + ' / 失败 ' + fail + '（进度存于 scripts/.polish-progress.json）');
}

main();
