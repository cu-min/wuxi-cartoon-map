const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let browser, server, base;
const feature = (name, adcode) => ({ type: 'Feature', properties: { name, adcode }, geometry: { type: 'Polygon', coordinates: [[[119,31],[121,31],[121,33],[119,33],[119,31]]] } });
const boundaries = code => ({ type: 'FeatureCollection', features: code === '100000' ? [feature('江苏省',320000)] : [feature('无锡市',320200), feature('南京市',320100)] });

before(async () => {
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, bytes) => {
      if (error) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)] || 'application/octet-stream');
      res.end(bytes);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : fs.existsSync('/usr/bin/chromium') ? { executablePath:'/usr/bin/chromium' } : {}), args:['--no-sandbox'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function pageFor(options = {}) {
  const page = await browser.newPage({ viewport: options.viewport || { width: 1365, height: 900 }, reducedMotion:'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/**', async route => {
    const filename = new URL(route.request().url()).pathname.split('/dist/')[1];
    await route.fulfill({ path: path.join(root,'node_modules/leaflet/dist',filename), contentType:filename.endsWith('.js')?'text/javascript':'text/css' });
  });
  await page.route('https://webrd*.is.autonavi.com/**', route => route.fulfill({status:200, contentType:'image/png', body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}));
  await page.route(/https:\/\/(geo\.datav\.aliyun\.com|geojson\.cn)\//, async route => {
    const code = route.request().url().match(/(\d{6})/)[1];
    if(options.delayGeo) await new Promise(resolve => setTimeout(resolve,options.delayGeo));
    await route.fulfill({ json:boundaries(code) });
  });
  return { page, errors };
}

test('overview loads no city payload; opening Wuxi loads only Wuxi without runtime errors', async () => {
  const { page, errors } = await pageFor();
  const dataRequests=[]; page.on('request',r=>{ if (/\/data\/.+\.js/.test(r.url())) dataRequests.push(r.url()); });
  await page.goto(base);
  await page.locator('.province-panel').waitFor();
  assert.equal(dataRequests.length,0);
  await page.evaluate(()=>location.hash='#/c/jiangsu-wuxi');
  await page.locator('.hot-item').first().waitFor();
  await page.waitForTimeout(150);
  assert.equal(dataRequests.length,1);
  assert.ok(dataRequests[0].endsWith('/data/jiangsu-wuxi.js'));
  assert.deepEqual(errors,[]);
  await page.close();
});

test('late overview boundary cannot overwrite a newer city route', async () => {
  const { page, errors } = await pageFor({delayGeo:700});
  await page.goto(base);
  await page.locator('.province-panel').waitFor();
  await page.evaluate(()=>location.hash='#/c/jiangsu-wuxi');
  await page.locator('.hot-item').first().waitFor();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('body').getAttribute('data-view'),'city');
  assert.equal(await page.locator('.prov-label').count(),0);
  assert.deepEqual(errors,[]);
  await page.close();
});

test('ranking restores filtered markers and opens a popup', async () => {
  const { page, errors } = await pageFor();
  await page.goto(base+'/#/c/jiangsu-wuxi');
  await page.locator('.hot-item').first().waitFor();
  const firstType = await page.locator('.hot-item .hot-meta').first().textContent();
  const buttons = page.locator('.legend button');
  for(let i=1;i<await buttons.count();i++) if(!(await buttons.nth(i).textContent()).includes(firstType)) { await buttons.nth(i).click(); break; }
  await page.locator('.hot-item').first().click();
  await page.locator('.leaflet-popup').waitFor();
  assert.ok(await page.locator('.leaflet-popup').isVisible());
  assert.deepEqual(errors,[]);
  await page.close();
});

test('mobile controls stay within viewport and province choices work from keyboard', async () => {
  const { page, errors } = await pageFor({ viewport:{width:390,height:844} });
  await page.goto(base);
  const choice = page.locator('.city-item[data-prov="jiangsu"]');
  await choice.waitFor();
  await choice.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/#/p/jiangsu');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  await page.close();
});
