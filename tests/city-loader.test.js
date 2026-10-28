const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
function setup() {
  const scripts = [];
  const window = { CITY_CATALOG: { 'jiangsu-wuxi': { name: '无锡', province: 'jiangsu' } } };
  const document = { createElement: () => ({ remove() {} }), head: { appendChild: el => scripts.push(el) } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'city-loader.js'), 'utf8'), { window, document, setTimeout, clearTimeout });
  return { window, scripts };
}
test('city loader deduplicates concurrent loads and caches registered data', async () => {
  const { window, scripts } = setup();
  const first = window.loadCityData('jiangsu-wuxi');
  assert.equal(window.loadCityData('jiangsu-wuxi'), first);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'data/jiangsu-wuxi.js');
  const data = { name: '无锡' };
  window.CITY_DATA['jiangsu-wuxi'] = data;
  scripts[0].onload();
  assert.equal(await first, data);
  assert.equal(await window.loadCityData('jiangsu-wuxi'), data);
  assert.equal(scripts.length, 1);
});
test('failed city loads are retryable', async () => {
  const { window, scripts } = setup();
  const first = window.loadCityData('jiangsu-wuxi');
  scripts[0].onerror();
  await assert.rejects(first, /could not be loaded/);
  const second = window.loadCityData('jiangsu-wuxi');
  assert.equal(scripts.length, 2);
  window.CITY_DATA['jiangsu-wuxi'] = {};
  scripts[1].onload();
  await second;
});
test('missing data registration rejects without poisoning cache', async () => {
  const { window, scripts } = setup();
  const first = window.loadCityData('jiangsu-wuxi');
  scripts[0].onload();
  await assert.rejects(first, /did not register/);
});
test('unknown keys, prototype names and paths never create scripts', async () => {
  const { window, scripts } = setup();
  for (const key of ['../config', 'toString', '__proto__', 'missing-city', 'https://example.com']) {
    await assert.rejects(window.loadCityData(key), /Unknown city/);
  }
  assert.equal(scripts.length, 0);
});
test('catalog describes every data file and index has no eager POI scripts', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'city-catalog.js'), 'utf8'), context);
  const files = fs.readdirSync(path.join(root, 'data')).filter(f => f.endsWith('.js'));
  assert.equal(Object.keys(context.window.CITY_CATALOG).length, files.length);
  for (const file of files) {
    const cityContext = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'data', file), 'utf8'), cityContext);
    const key = file.slice(0, -3);
    const city = cityContext.window.CITY_DATA[key];
    assert.deepEqual(JSON.parse(JSON.stringify(context.window.CITY_CATALOG[key])), { province: city.province, name: city.name });
  }
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<script[^>]+src="data\//);
});
test('POI generator refreshes metadata without modifying index or eager scripts', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/generate-pois.js'), 'utf8');
  const start = source.indexOf('function writeCityData(');
  const end = source.indexOf('// ---------- 单个城市完整流程', start);
  const writes = [];
  let refreshed = 0;
  const context = {
    fs: { mkdirSync() {}, writeFileSync: (file, content) => writes.push({ file, content }) },
    path, __dirname: path.join(root, 'scripts'), zoomDefault: 12,
    require: name => {
      assert.equal(name, './generate-city-catalog');
      return () => { refreshed++; };
    },
  };
  vm.runInNewContext(source.slice(start, end), context);
  context.writeCityData({ province: 'jiangsu', key: 'wuxi', name: '无锡' }, [
    { name: '测试地点', type: '景点', emoji: '📍', lat: 31.5, lng: 120.3, desc: 'Fixture only' },
  ]);
  assert.equal(refreshed, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].file, path.join(root, 'data/jiangsu-wuxi.js'));
  assert.doesNotMatch(writes[0].content, /<script/);
});
test('Leaflet is self-hosted with its license and referenced assets', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /src="vendor\/leaflet\/leaflet.js"/);
  assert.match(html, /href="vendor\/leaflet\/leaflet.css"/);
  assert.doesNotMatch(html, /cdn.jsdelivr/);
  for (const file of ['leaflet.js', 'leaflet.css', 'LICENSE', 'images/marker-icon.png', 'images/marker-icon-2x.png', 'images/marker-shadow.png', 'images/layers.png', 'images/layers-2x.png']) {
    assert.ok(fs.statSync(path.join(root, 'vendor/leaflet', file)).size > 0);
  }
});
