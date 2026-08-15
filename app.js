// ============================================================
// 中国 · 卡通迷你地图 — 单页应用
// 路由：
//   #/                 全国总览（34 个省级行政区）
//   #/p/{provinceKey}  省级视图（该省下辖地级市）
//   #/c/{cityKey}      城市视图（POI 卡通地图，数据来自 window.CITY_DATA）
// IP 自动跳转：进入网页时若已配置 key，则按 IP 定位到所在省/市
// ============================================================

// ---------- 工具 ----------
const $ = s => document.querySelector(s);

// HTML 转义：POI 名称/评论等外部数据进 innerHTML 前必须过这个
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 已覆盖城市索引：从已加载的 CITY_DATA 动态派生（惰性，调用时实时计算）
// 数据文件被 index.html 引入 → 城市自动上线，无需手动维护注册表
function getCoveredCities() {
  return Object.fromEntries(
    Object.entries(window.CITY_DATA || {}).map(([k, v]) => [k, { province: v.province, name: v.name }])
  );
}

// ---------- Leaflet 地图实例（全局复用） ----------
let map = null;
let activeLayers = [];
let currentView = null;

function getMap() {
  if (map) return map;
  map = L.map('map', { zoomControl: true, minZoom: 3, maxZoom: 18 });
  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    attribution: '© 高德地图',
    maxZoom: 18,
  }).addTo(map);
  return map;
}

function clearView() {
  activeLayers.forEach(l => { if (map) map.removeLayer(l); });
  activeLayers = [];
  const v = $('#view');
  if (v) v.innerHTML = '';
  if (map) map.closePopup();
}

// ---------- 轻提示 ----------
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---------- 视图 UI（返回按钮 + 顶部位置提示） ----------
// 顶部不再固定显示标题栏；进入省/市时在界面正上方弹一个提示，2 秒后自动消失
let topNoticeTimer = null;
function showTopNotice(text) {
  let el = document.getElementById('top-notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'top-notice';
    el.className = 'top-notice';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(topNoticeTimer);
  topNoticeTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// notice 为空 → 全国总览（无返回按钮）；有值 → 显示返回按钮 + 顶部提示
function setViewUI(notice) {
  $('#view').innerHTML = notice
    ? '<a class="back-home" href="#/" title="返回全国总览">🏠 全国</a>'
    : '';
  if (notice) showTopNotice(notice);
}

// IP 自动跳转的定制提示（跳转后由省/市视图消费）
let autoLocateNotice = null;
// IP 定位到的当前城市名（用于省级视图高亮"我在这里"）
let autoLocateCity = null;

// ---------- geoJSON 加载 ----------
// 主源：阿里 DataV（偶发超时/限流）；备源：geojson.cn
// 策略：每源重试 2 次 → 降级下一个源，单次请求 9s 超时
const GEO_SOURCES = [
  adcode => 'https://geo.datav.aliyun.com/areas_v3/bound/' + adcode + '_full.json',
  adcode => 'https://geojson.cn/api/china/' + adcode + '.json',
];

function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// 统一两源字段差异：geojson.cn 用 code/fullname，DataV 用 adcode/name
function normalizeGeo(geo) {
  (geo.features || []).forEach(f => {
    const p = f.properties || (f.properties = {});
    if (p.adcode === undefined && p.code !== undefined) p.adcode = p.code;
    if (p.fullname && p.name !== p.fullname) p.name = p.fullname;
  });
  return geo;
}

async function loadGeo(adcode) {
  let lastErr = null;
  for (const src of GEO_SOURCES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchWithTimeout(src(adcode), 9000);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return normalizeGeo(await res.json());
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }
  throw lastErr || new Error('load geo failed: ' + adcode);
}

// ============================================================
// 视图一：全国总览
// ============================================================
// 全国总览：省份列表面板（手机点地图 polygon 难命中，用列表选省）
function buildProvincePanel() {
  const panel = document.createElement('div');
  panel.className = 'city-panel province-panel';
  panel.innerHTML = `<div class="city-panel-title">🗺️ 全国 · 选择省份</div><div class="city-list"></div>`;
  $('#view').appendChild(panel);
  const listEl = panel.querySelector('.city-list');
  const covered = getCoveredCities();
  const hasCovered = p => Object.values(covered).some(c => c.province === p.key);
  listEl.innerHTML = PROVINCES.map(p => {
    return `<div class="city-item ${hasCovered(p) ? 'ready' : 'pending'}" data-prov="${p.key}">${p.name}${hasCovered(p) ? ' <span class="city-badge">✅</span>' : ''}</div>`;
  }).join('');
  listEl.querySelectorAll('.city-item').forEach(el => {
    el.onclick = () => { location.hash = '#/p/' + el.dataset.prov; };
  });
  panel.querySelector('.city-panel-title').onclick = () => panel.classList.toggle('collapsed');
}

async function renderOverview() {
  currentView = 'overview';
  document.body.dataset.view = 'overview';
  getMap();
  clearView();
  setViewUI(); // 全国总览：无标题、无返回按钮

  // 省份列表面板（手机选省更可靠）
  buildProvincePanel();

  // 初始视角（边界加载完成后会自动 fitBounds 最大化中国）
  map.setView([36, 104], 4);

  try {
    const geo = await loadGeo(100000);
    const layer = L.geoJSON(geo, {
      style: () => ({ color: '#ff9d6f', weight: 1.2, fillColor: '#ffd9c4', fillOpacity: 0.55 }),
      onEachFeature: (f, l) => {
        const prov = PROVINCES.find(p => String(p.adcode) === String(f.properties.adcode));
        l.on('click', () => {
          if (prov) location.hash = '#/p/' + prov.key;
          else toast('「' + f.properties.name + '」暂无数据');
        });
        l.bindTooltip(esc(f.properties.name), { direction: 'center', className: 'prov-tooltip' });
        l.on('mouseover', () => l.setStyle({ fillOpacity: 0.85, weight: 2 }));
        l.on('mouseout', () => l.setStyle({ fillOpacity: 0.55, weight: 1.2 }));
      },
    }).addTo(map);
    activeLayers.push(layer);

    // 视野框选中国主图（排除南海诸岛小框，让中国占满界面；南海诸岛仍在图上渲染）
    const cnBounds = L.latLngBounds([]);
    layer.eachLayer(l => {
      const nm = l.feature && l.feature.properties && l.feature.properties.name;
      if (nm === '南海诸岛') return;
      cnBounds.extend(l.getBounds());
    });
    if (cnBounds.isValid()) map.fitBounds(cnBounds, { padding: [14, 14] });

    // 省会标注（cities.js 的 coord 是 [lng, lat]，Leaflet 需要 [lat, lng]）
    PROVINCES.forEach(p => {
      const m = L.marker([p.coord[1], p.coord[0]], {
        icon: L.divIcon({ className: 'prov-label', html: `<span>${esc(p.capital)}</span>`, iconSize: [0, 0] }),
        interactive: false,
      }).addTo(map);
      activeLayers.push(m);
    });
  } catch (e) {
    // 边界全挂：保底显示中国视野，省份列表面板（本地数据）仍可正常选省
    map.setView([36, 104], 4);
    toast('行政区划数据加载失败，可点左侧省份列表进入');
  }
}

// ============================================================
// 视图二：省级视图
// ============================================================
let cityLayers = {}; // 省级视图内：城市名 → Leaflet 图层（供未上线城市定位）

// 普通城市边界 / 当前所在城市高亮边界（不起眼但一眼可见）
const CITY_BORDER_STYLE = { color: '#ff9d6f', weight: 1, fillColor: '#ffe3d1', fillOpacity: 0.6 };
const CITY_HIGHLIGHT_STYLE = { color: '#e0522f', weight: 3.5, fillColor: '#ffc9b8', fillOpacity: 0.75 };

// 城市视图里的边界：当前城市（粗边框）+ 相邻城市（细线区分），只描边不填充
const CITY_VIEW_CURRENT_STYLE = { color: '#e8693a', weight: 3, fillColor: '#ffd9c4', fillOpacity: 0 };
const CITY_VIEW_NEIGHBOR_STYLE = { color: '#d6a890', weight: 0.7, fillColor: '#fff5ee', fillOpacity: 0 };

// 省级 geoJSON 缓存（城市视图和省级视图共用，避免重复请求）
const provGeoCache = {};
function getProvGeo(adcode) {
  if (provGeoCache[adcode]) return Promise.resolve(provGeoCache[adcode]);
  return loadGeo(adcode)
    .then(geo => { provGeoCache[adcode] = geo; return geo; });
}

// geoJSON 城市名（"无锡市"） 与 业务城市名（"无锡"）匹配
function matchCityName(geoName, target) {
  if (!geoName || !target) return false;
  return geoName === target || geoName.replace('市', '') === target.replace('市', '');
}

function isCurrentCity(name) {
  return autoLocateCity && matchCityName(name, autoLocateCity);
}

// 左侧"下辖城市"列表面板（省级视图与城市视图共用）
// currentCityName 高亮当前所在城市；已上线 / 筹备中分组展示
async function buildCityPanel(prov, currentCityName) {
  const panel = document.createElement('div');
  panel.className = 'city-panel';
  // 直辖市（北京/天津/上海/重庆）下辖的是"区县"，其他省是"下辖城市"
  const isMunicipality = [110000, 120000, 310000, 500000].includes(prov.adcode);
  const subtitle = isMunicipality ? '下辖区县' : '下辖城市';
  panel.innerHTML = `<div class="city-panel-title">🏙️ ${prov.name} · ${subtitle}</div><div class="city-list"><div class="city-loading">加载中…</div></div>`;
  $('#view').appendChild(panel);
  // 标题点击折叠/展开（移动端底部抽屉）
  panel.querySelector('.city-panel-title').onclick = () => panel.classList.toggle('collapsed');
  try {
    const geo = await getProvGeo(prov.adcode);
    const listEl = panel.querySelector('.city-list');
    const names = geo.features.map(f => f.properties.name);
    const covered = Object.values(getCoveredCities()).filter(c => c.province === prov.key).map(c => c.name);
    const isReady = n => covered.some(c => n.includes(c) || c.includes(n));

    // 已上线：DataV 里名称匹配的 + 直辖市市级 POI 入口（直辖市名不在区名列表里，需手动加入）
    const matchedReadyNames = names.filter(isReady);
    const municipalEntries = isMunicipality
      ? Object.entries(getCoveredCities())
          .filter(([k, v]) => v.province === prov.key)
          .filter(([k, v]) => !matchedReadyNames.some(n => n.includes(v.name) || v.name.includes(n)))
          .map(([k, v]) => ({ key: k, name: v.name }))
      : [];
    const pendingNames = names.filter(n => !isReady(n));

    const itemHtml = n => {
      const isCurrent = matchCityName(n, currentCityName);
      return `<div class="city-item ${isReady(n) ? 'ready' : 'pending'} ${isCurrent ? 'current' : ''}" data-city="${esc(n)}">${isCurrent ? '📍 ' : ''}${esc(n)}</div>`;
    };
    const municipalHtml = municipalEntries.map(x => {
      const isCurrent = matchCityName(x.name, currentCityName);
      return `<div class="city-item ready ${isCurrent ? 'current' : ''}" data-muni="${x.key}">${isCurrent ? '📍 ' : ''}${esc(x.name)} <span class="city-badge">✅ POI 已上线</span></div>`;
    }).join('');

    let html = '';
    if (municipalEntries.length) html += `<div class="city-group-title">已上线 POI（${municipalEntries.length}）</div>` + municipalHtml;
    if (matchedReadyNames.length) html += `<div class="city-group-title">已上线（${matchedReadyNames.length}）</div>` + matchedReadyNames.map(itemHtml).join('');
    if (pendingNames.length) html += `<div class="city-group-title">筹备中（${pendingNames.length}）</div>` + pendingNames.map(itemHtml).join('');
    listEl.innerHTML = html || '<div class="city-loading">暂无数据</div>';

    // 普通城市点击
    listEl.querySelectorAll('.city-item[data-city]').forEach(el => {
      el.onclick = () => enterCity(prov, el.dataset.city);
    });
    // 直辖市市级 POI 入口点击
    listEl.querySelectorAll('.city-item[data-muni]').forEach(el => {
      el.onclick = () => { location.hash = '#/c/' + el.dataset.muni; };
    });
  } catch (e) {
    // 边界数据失败：降级为「已上线城市」本地列表（不依赖网络，仍可进城市视图）
    const listEl = panel.querySelector('.city-list');
    const covered = Object.entries(getCoveredCities()).filter(([k, v]) => v.province === prov.key);
    listEl.innerHTML = covered.length
      ? '<div class="city-group-title">已上线（' + covered.length + '）</div>' + covered.map(([k, v]) =>
          '<div class="city-item ready" data-muni="' + k + '">' + esc(v.name) + ' <span class="city-badge">✅ POI 已上线</span></div>').join('')
          + '<div class="city-loading">完整区县列表加载失败，仅显示已上线城市</div>'
      : '<div class="city-loading">区县列表加载失败，请检查网络后刷新</div>';
    listEl.querySelectorAll('.city-item[data-muni]').forEach(el => {
      el.onclick = () => { location.hash = '#/c/' + el.dataset.muni; };
    });
  }
}

async function renderProvince(key) {
  const prov = PROVINCES.find(p => p.key === key);
  if (!prov) { location.hash = '#/'; return; }

  currentView = 'province:' + key;
  document.body.dataset.view = 'province';
  getMap();
  clearView();
  cityLayers = {};
  setViewUI(autoLocateNotice || ('📍 ' + prov.fullName));
  autoLocateNotice = null;

  // 左侧城市列表面板（异步加载，不阻塞边界渲染）
  buildCityPanel(prov, null);

  try {
    const geo = await getProvGeo(prov.adcode);
    const layer = L.geoJSON(geo, {
      style: () => CITY_BORDER_STYLE,
      onEachFeature: (f, l) => {
        const cityName = f.properties.name;
        cityLayers[cityName] = l; // 保存城市图层，未上线时用来定位
        l.on('click', () => enterCity(prov, cityName));
        l.bindTooltip(esc(cityName), { direction: 'center', className: 'prov-tooltip' });
        l.on('mouseover', () => l.setStyle({ fillOpacity: 0.85, weight: isCurrentCity(cityName) ? 3.5 : 1.6 }));
        l.on('mouseout', () => l.setStyle(isCurrentCity(cityName) ? CITY_HIGHLIGHT_STYLE : CITY_BORDER_STYLE));
      },
    }).addTo(map);
    activeLayers.push(layer);

    // 高亮当前所在城市（定位到的城市，一眼看出"我在这里"）
    layer.eachLayer(l => {
      const nm = l.feature && l.feature.properties && l.feature.properties.name;
      if (isCurrentCity(nm)) {
        l.setStyle(CITY_HIGHLIGHT_STYLE);
        l.bringToFront();
      }
    });

    // 视野自动框住全省（让用户一眼看清省的范围和位置）
    map.fitBounds(layer.getBounds(), { padding: [24, 24] });
  } catch (e) {
    // 边界加载失败：飞到省会兜底，保证"点省份有反馈"，左面板已降级为已上线城市列表
    map.setView([prov.coord[1], prov.coord[0]], 7);
    toast('边界数据加载失败，已定位到' + prov.name + '，可点左侧城市进入');
  }
}

// 进入城市：有数据跳城市视图；没数据则地图飞到该城市位置
function enterCity(prov, cityName) {
  const key = findCity(prov, cityName);
  if (key) { location.hash = '#/c/' + key; return; }

  // 未上线：地图定位到该城市边界，让用户知道城市在哪
  const layer = (cityLayers || {})[cityName];
  if (layer && map) map.flyToBounds(layer.getBounds(), { duration: 0.5, maxZoom: 11 });
  toast('「' + cityName + '」地图数据筹备中，已定位过去 ✨');
}

// 城市名 → 已覆盖城市 key
function findCity(prov, cityName) {
  const name = (cityName || '').replace(/市$|地区$|盟$|自治州$/, '');
  if (!name) return null;
  for (const [k, v] of Object.entries(getCoveredCities())) {
    if (v.province === prov.key && (v.name === name || v.name.includes(name) || name.includes(v.name))) return k;
  }
  return null;
}

// ============================================================
// 视图三：城市视图（POI 卡通地图）
// ============================================================
function renderCity(cityKey) {
  const data = (window.CITY_DATA || {})[cityKey];
  if (!data) {
    toast('该城市地图数据筹备中，请稍后刷新 ✨');
    location.hash = '#/';
    return;
  }

  currentView = 'city:' + cityKey;
  document.body.dataset.view = 'city';
  getMap();
  clearView();
  setViewUI(autoLocateNotice || ('📍 ' + data.name));
  autoLocateNotice = null;

  // 左侧"下辖城市"列表（点击省份里的城市直接进城市视图时也要保留可跳转的面板）
  const prov = PROVINCES.find(p => p.key === data.province);
  if (prov) buildCityPanel(prov, data.name);

  map.setView(data.coord, data.zoom || 12);
  renderCityMap(data);

  // 城市边界：当前城市粗边框 + 相邻城市细线，区分城市与城市
  if (prov) drawCityBorders(prov, data.name);
}

// 加载该省所有城市边界：当前城市用粗边框，相邻城市用细线区分
function drawCityBorders(prov, cityName) {
  getProvGeo(prov.adcode).then(geo => {
    const borderLayer = L.geoJSON(geo, {
      interactive: false,
      style: f => matchCityName(f.properties && f.properties.name, cityName)
        ? CITY_VIEW_CURRENT_STYLE
        : CITY_VIEW_NEIGHBOR_STYLE,
    }).addTo(map);
    activeLayers.push(borderLayer);
  }).catch(() => { /* 边界加载失败不影响主视图 */ });
}

function renderCityMap(city) {
  const SHOPS = city.shops || [];
  const HOT = city.hot || [];
  const HOT_MAP = city.hotMap || {};
  const TYPES = city.types || [...new Set(SHOPS.map(s => s.type))];

  // 水域示意（可选）
  if (city.lake) {
    const lake = L.polygon(city.lake.polygon, {
      color: '#7fc4e8', weight: 3, opacity: 0.7,
      fillColor: '#aee0f5', fillOpacity: 0.45,
    }).addTo(map);
    activeLayers.push(lake);
    const label = L.marker(city.lake.label, {
      icon: L.divIcon({ className: 'decor', html: `<div class="decor-lake-label">${city.lake.labelText}</div>`, iconSize: [0, 0] }),
      interactive: false,
    }).addTo(map);
    activeLayers.push(label);
  }

  // 装饰元素（可选）
  (city.decors || []).forEach(d => {
    const m = L.marker([d.lat, d.lng], {
      icon: L.divIcon({ className: 'decor', html: `<span class="${d.cls}">${d.html}</span>`, iconSize: [0, 0] }),
      interactive: false,
    }).addTo(map);
    activeLayers.push(m);
  });

  // ---------- 立体小公仔 ----------
  const markers = {};
  const markerByName = {};

  function makeDollIcon(shop) {
    return L.divIcon({
      className: 'doll-icon',
      html: `
        <div class="doll">
          <div class="doll-head">
            <span class="doll-emoji">${shop.emoji}</span>
            <span class="eye eye-l"></span>
            <span class="eye eye-r"></span>
            <span class="blush blush-l"></span>
            <span class="blush blush-r"></span>
          </div>
          <div class="doll-tag">${esc(shop.name)}</div>
          <div class="doll-shadow"></div>
        </div>`,
      iconSize: [60, 80],
      iconAnchor: [30, 76],
    });
  }

  function stars(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function simplePopup(shop) {
    return `
      <div class="shop-popup">
        <span class="big-emoji">${shop.emoji}</span>
        <div class="shop-name">${esc(shop.name)}</div>
        <span class="shop-tag">${esc(shop.type)}</span>
        <div class="shop-desc">${esc(shop.desc)}</div>
      </div>`;
  }

  function hotPopup(shop, h) {
    const comments = (h.comments || []).map(c => `
      <div class="hp-comment">
        <div class="hp-c-head">
          <span class="hp-c-user">${esc(c.user)}</span>
          <span class="hp-c-platform">${esc(c.platform)}</span>
          <span class="hp-stars">${stars(c.stars)}</span>
        </div>
        <div class="hp-c-text">${esc(c.text)}</div>
        <div class="hp-c-likes">👍 ${c.likes}</div>
      </div>`).join('');

    return `
      <div class="hot-popup">
        <div class="hp-top">
          <span class="hp-emoji">${shop.emoji}</span>
          <div class="hp-name">${esc(shop.name)}</div>
          <span class="hp-tag">🔥 热度第${h.rank} · ${esc(String(h.hot))}</span>
        </div>
        <div class="hp-desc">${esc(shop.desc)}</div>
        <div class="hp-fields">
          <div class="hp-field"><span class="k">📍 地址</span><span class="v">${esc(h.address)}</span></div>
          <div class="hp-field"><span class="k">🎫 门票</span><span class="v">${esc(h.ticket)}</span></div>
          <div class="hp-field"><span class="k">🕘 时间</span><span class="v">${esc(h.hours)}</span></div>
          <div class="hp-field"><span class="k">🔗 导航</span><span class="v">${h.website ? `<a href="${esc(h.website)}" target="_blank" rel="noopener">在高德地图查看 ↗</a>` : '暂无'}</span></div>
        </div>
        ${comments
          ? '<div class="hp-comments-title">💬 用户评价</div>' + comments
          : '<div class="hp-comments-empty">💬 暂无评价，去打卡抢个沙发～</div>'}
      </div>`;
  }

  SHOPS.forEach(shop => {
    const marker = L.marker([shop.lat, shop.lng], { icon: makeDollIcon(shop) }).addTo(map);
    marker.bindTooltip(esc(shop.name), { direction: 'top', offset: [0, -52], className: 'shop-tooltip' });
    const h = HOT_MAP[shop.name];
    marker.bindPopup(h ? hotPopup(shop, h) : simplePopup(shop), { maxWidth: 320 });
    (markers[shop.type] = markers[shop.type] || []).push(marker);
    markerByName[shop.name] = marker;
    activeLayers.push(marker);
  });

  // ---------- 今日热度榜 ----------
  const panel = document.createElement('aside');
  panel.className = 'hot-panel';
  panel.innerHTML = `
    <div class="hot-header">
      <a class="hot-back-home" href="#/" title="返回全国总览">🏠 全国</a>
      <span class="hot-titles">
        <span class="hot-title">🔥 今日热度榜</span>
        <span class="hot-sub">${city.name} · 实时打卡热度</span>
      </span>
      <span class="hot-toggle">▾</span>
    </div>
    <div class="hot-list"></div>`;
  $('#view').appendChild(panel);
  // 标题点击折叠/展开（移动端底部抽屉）
  panel.querySelector('.hot-header').onclick = () => panel.classList.toggle('collapsed');
  // 移动端默认折叠（只显示标题条）
  if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
    panel.classList.add('collapsed');
  }

  HOT.forEach(item => {
    const shop = SHOPS.find(s => s.name === item.name);
    const div = document.createElement('div');
    div.className = 'hot-item';
    div.innerHTML = `
      <span class="hot-rank">${item.rank}</span>
      <span class="hot-emoji">${shop ? shop.emoji : '📍'}</span>
      <div class="hot-info">
        <div class="hot-name">${esc(item.name)}</div>
        <div class="hot-meta">${shop ? esc(shop.type) : ''}</div>
      </div>
      <span class="hot-heat">🔥${esc(String(item.hot))}</span>`;
    div.onclick = () => {
      const marker = markerByName[item.name];
      if (marker) {
        map.flyTo(marker.getLatLng(), 15, { duration: 0.5 });
        marker.openPopup();
      }
    };
    panel.querySelector('.hot-list').appendChild(div);
  });

  // ---------- 图例 / 筛选 ----------
  const legendEl = document.createElement('div');
  legendEl.className = 'legend';
  $('#view').appendChild(legendEl);

  const allBtn = document.createElement('button');
  allBtn.innerHTML = `<span class="dot">🗺️</span>全部`;
  allBtn.classList.add('active');
  allBtn.onclick = () => setFilter(null, allBtn);
  legendEl.appendChild(allBtn);

  TYPES.forEach(type => {
    const btn = document.createElement('button');
    const sample = SHOPS.find(s => s.type === type);
    btn.innerHTML = `<span class="dot">${sample ? sample.emoji : '📍'}</span>${type}`;
    btn.onclick = () => setFilter(type, btn);
    legendEl.appendChild(btn);
  });

  function setFilter(type, clickedBtn) {
    legendEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    clickedBtn.classList.add('active');
    Object.keys(markers).forEach(t => {
      const show = type === null || t === type;
      markers[t].forEach(m => {
        if (show) { if (!map.hasLayer(m)) m.addTo(map); }
        else { if (map.hasLayer(m)) m.remove(); }
      });
    });
  }

  // 视野自动框住所有 POI，公仔分布均匀不挤（maxZoom 限制避免太近）
  if (SHOPS.length) {
    const bounds = L.latLngBounds([]);
    SHOPS.forEach(s => bounds.extend([s.lat, s.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: data.zoom || 13, animate: true });
  }
}

// ============================================================
// IP 定位自动跳转（需在 config.js 配置腾讯位置服务 key）
// 说明：腾讯 WebServiceAPI 无 CORS 头，浏览器 fetch 会被跨域拦截，
//       因此用 JSONP（script 标签）调用，不受 CORS 限制
// ============================================================
function jsonpRequest(url, cbName, timeout) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { cleanup(); reject(new Error('jsonp timeout')); }, timeout || 6000);
    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
      script.remove();
    }
    window[cbName] = data => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('jsonp error')); };
    script.src = url;
    document.head.appendChild(script);
  });
}

async function locateAndJump() {
  const key = (window.MAP_CONFIG || {}).ipKey;
  if (!key) { console.log('[定位] 未配置 key，跳过自动跳转'); return; }
  console.log('[定位] 开始 IP 定位…');

  try {
    const cbName = '__wbtLoc_' + Date.now();
    const url = 'https://apis.map.qq.com/ws/location/v1/ip?key=' + encodeURIComponent(key) + '&output=jsonp&callback=' + cbName;
    const d = await jsonpRequest(url, cbName);
    console.log('[定位] API 返回:', JSON.stringify(d).slice(0, 200));

    if (d.status !== 0 || !d.result || !d.result.ad_info) {
      console.warn('[定位] 返回异常:', d.status, d.message);
      return;
    }
    const { province, city } = d.result.ad_info;
    console.log('[定位] 定位到:', province, '/', city);

    const prov = PROVINCES.find(p => province && (p.fullName === province || p.name === province || p.key === province));
    if (!prov) { console.warn('[定位] 省份匹配失败:', province); return; }

    const cityKey = findCity(prov, city);
    console.log('[定位] 匹配结果:', cityKey ? ('跳城市 ' + cityKey) : ('跳省视图 ' + prov.key));

    if (cityKey) {
      autoLocateNotice = '📍 检测到您当前在' + city + '，已自动跳转';
      autoLocateCity = city; // 记住当前城市，省级视图用它高亮"我在这里"
      location.hash = '#/c/' + cityKey;
    } else {
      autoLocateNotice = '📍 检测到您当前在' + province + '，已为您定位';
      autoLocateCity = null;
      location.hash = '#/p/' + prov.key;
    }
  } catch (e) {
    console.error('[定位] 失败:', e);
    toast('📍 定位失败，已显示全国总览');
  }
}

// ============================================================
// 路由
// ============================================================
function router() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'p' && parts[1]) renderProvince(parts[1]);
  else if (parts[0] === 'c' && parts[1]) renderCity(parts[1]);
  else renderOverview();
}

window.addEventListener('hashchange', router);
router();

// 首次进入（hash 为空 或 默认的 #/）→ 尝试 IP 自动跳转
// 注：不能只判断 !location.hash，因为地址栏常显示为 #/ 会被误判为已有路由
const initRoute = location.hash.replace(/^#\/?$/, '');
if (!initRoute) locateAndJump();
