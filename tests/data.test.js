const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

test('all city data are loadable, unique, coordinate-range valid and internally linked', () => {
  const context = { window: {} };
  const files = fs.readdirSync(path.join(root, 'data')).filter(f => f.endsWith('.js'));
  for (const filename of files) vm.runInNewContext(fs.readFileSync(path.join(root, 'data', filename), 'utf8'), context);
  const cities = context.window.CITY_DATA;
  assert.equal(Object.keys(cities).length, files.length);
  for (const [key, city] of Object.entries(cities)) {
    assert.equal(typeof city.province, 'string', key);
    assert.equal(typeof city.name, 'string', key);
    assert.equal(city.coord.length, 2, key);
    const names = new Set();
    for (const shop of city.shops) {
      assert.ok(shop.name && !names.has(shop.name), `${key}: duplicate/empty ${shop.name}`);
      names.add(shop.name);
      assert.ok(Number.isFinite(shop.lat) && Math.abs(shop.lat) <= 90, `${key}: latitude`);
      assert.ok(Number.isFinite(shop.lng) && Math.abs(shop.lng) <= 180, `${key}: longitude`);
    }
    for (const hot of city.hot || []) {
      assert.ok(names.has(hot.name), `${key}: ranking ${hot.name} missing marker`);
      assert.ok(city.hotMap[hot.name], `${key}: ranking detail missing`);
    }
  }
});
