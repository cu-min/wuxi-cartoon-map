// ---------- 初始化地图 ----------
const map = L.map('map', {
  center: [31.49, 120.31],   // 无锡市区
  zoom: 12,
  minZoom: 10,
  maxZoom: 18,
  zoomControl: true,
});

// 彩色底图：高德地图瓦片（国内节点、中文标注、加载快）
L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
  subdomains: ['1', '2', '3', '4'],
  attribution: '© 高德地图',
  maxZoom: 18,
}).addTo(map);

// ---------- 场景装饰层 ----------

// 太湖水域（无锡南部，示意半透明蓝色水面）
const taihuPoly = L.polygon([
  [31.52, 120.10], [31.46, 120.04], [31.36, 120.14],
  [31.31, 120.29], [31.40, 120.46], [31.50, 120.36],
], {
  color: '#7fc4e8', weight: 3, opacity: 0.7,
  fillColor: '#aee0f5', fillOpacity: 0.45,
}).addTo(map);

// 太湖文字标注
L.marker([31.41, 120.24], {
  icon: L.divIcon({ className: 'decor', html: '<div class="decor-lake-label">🌊 太湖</div>', iconSize: [0, 0] }),
  interactive: false,
}).addTo(map);

// 装饰小元素（云朵 / 小船 / 树 / 飞鸟）——纯视觉，不可交互
const decors = [
  { html: '☁️', cls: 'decor-cloud', lat: 31.62, lng: 120.18 },
  { html: '☁️', cls: 'decor-cloud', lat: 31.63, lng: 120.40 },
  { html: '☁️', cls: 'decor-cloud', lat: 31.60, lng: 120.52 },
  { html: '⛵', cls: 'decor-ship', lat: 31.45, lng: 120.22 },
  { html: '🛶', cls: 'decor-ship', lat: 31.42, lng: 120.30 },
  { html: '🌳', cls: 'decor-tree', lat: 31.50, lng: 120.25 },
  { html: '🌳', cls: 'decor-tree', lat: 31.58, lng: 120.28 },
  { html: '🌳', cls: 'decor-tree', lat: 31.55, lng: 120.38 },
  { html: '🕊️', cls: 'decor-bird', lat: 31.61, lng: 120.30 },
  { html: '🕊️', cls: 'decor-bird', lat: 31.60, lng: 120.22 },
];

decors.forEach(d => {
  L.marker([d.lat, d.lng], {
    icon: L.divIcon({ className: 'decor', html: `<span class="${d.cls}">${d.html}</span>`, iconSize: [0, 0] }),
    interactive: false,
  }).addTo(map);
});

// ---------- 渲染立体小公仔 ----------
const markers = {};        // type -> marker[]
const markerByName = {};   // name -> marker

function makeDollIcon(shop) {
  return L.divIcon({
    className: '',
    html: `
      <div class="doll">
        <div class="doll-head">
          <span class="doll-emoji">${shop.emoji}</span>
          <span class="eye eye-l"></span>
          <span class="eye eye-r"></span>
          <span class="blush blush-l"></span>
          <span class="blush blush-r"></span>
        </div>
        <div class="doll-tag">${shop.name}</div>
        <div class="doll-shadow"></div>
      </div>`,
    iconSize: [60, 80],
    iconAnchor: [30, 76],
  });
}

// 星级字符串
function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// 简单 popup（普通地点）
function simplePopup(shop) {
  return `
    <div class="shop-popup">
      <span class="big-emoji">${shop.emoji}</span>
      <div class="shop-name">${shop.name}</div>
      <span class="shop-tag">${shop.type}</span>
      <div class="shop-desc">${shop.desc}</div>
    </div>`;
}

// 丰富 popup（热度榜地点）
function hotPopup(shop, h) {
  const comments = h.comments.map(c => `
    <div class="hp-comment">
      <div class="hp-c-head">
        <span class="hp-c-user">${c.user}</span>
        <span class="hp-c-platform">${c.platform}</span>
        <span class="hp-stars">${stars(c.stars)}</span>
      </div>
      <div class="hp-c-text">${c.text}</div>
      <div class="hp-c-likes">👍 ${c.likes}</div>
    </div>`).join('');

  return `
    <div class="hot-popup">
      <div class="hp-top">
        <span class="hp-emoji">${shop.emoji}</span>
        <div class="hp-name">${shop.name}</div>
        <span class="hp-tag">🔥 热度第${h.rank} · ${h.hot}</span>
      </div>
      <div class="hp-desc">${shop.desc}</div>
      <div class="hp-fields">
        <div class="hp-field"><span class="k">📍 地址</span><span class="v">${h.address}</span></div>
        <div class="hp-field"><span class="k">🎫 门票</span><span class="v">${h.ticket}</span></div>
        <div class="hp-field"><span class="k">🕘 时间</span><span class="v">${h.hours}</span></div>
        <div class="hp-field"><span class="k">🔗 官网</span><span class="v"><a href="${h.website}" target="_blank" rel="noopener">${h.website}</a></span></div>
      </div>
      <div class="hp-comments-title">💬 用户评价</div>
      ${comments}
    </div>`;
}

SHOPS.forEach(shop => {
  const marker = L.marker([shop.lat, shop.lng], { icon: makeDollIcon(shop) }).addTo(map);

  marker.bindTooltip(shop.name, {
    direction: 'top', offset: [0, -52], className: 'shop-tooltip',
  });

  // 热度榜地点用丰富资料卡
  const h = HOT_MAP[shop.name];
  marker.bindPopup(h ? hotPopup(shop, h) : simplePopup(shop), { maxWidth: 320 });

  (markers[shop.type] = markers[shop.type] || []).push(marker);
  markerByName[shop.name] = marker;
});

// ---------- 今日热度榜 ----------
function renderHotList() {
  const listEl = document.getElementById('hot-list');
  listEl.innerHTML = '';

  HOT.forEach(item => {
    const shop = SHOPS.find(s => s.name === item.name);
    const div = document.createElement('div');
    div.className = 'hot-item';
    div.innerHTML = `
      <span class="hot-rank">${item.rank}</span>
      <span class="hot-emoji">${shop ? shop.emoji : '📍'}</span>
      <div class="hot-info">
        <div class="hot-name">${item.name}</div>
        <div class="hot-meta">${shop ? shop.type : ''}</div>
      </div>
      <span class="hot-heat">🔥${item.hot}</span>`;

    div.onclick = () => {
      const marker = markerByName[item.name];
      if (marker) {
        map.flyTo(marker.getLatLng(), 15, { duration: 0.8 });
        marker.openPopup();
      }
    };
    listEl.appendChild(div);
  });
}

// ---------- 图例 / 筛选 ----------
const legendEl = document.getElementById('legend');

function renderLegend() {
  const allBtn = document.createElement('button');
  allBtn.dataset.type = 'all';
  allBtn.innerHTML = `<span class="dot">🗺️</span>全部`;
  allBtn.classList.add('active');
  allBtn.onclick = () => setFilter(null, allBtn);
  legendEl.appendChild(allBtn);

  TYPES.forEach(type => {
    const btn = document.createElement('button');
    btn.dataset.type = type;
    const sample = SHOPS.find(s => s.type === type);
    btn.innerHTML = `<span class="dot">${sample.emoji}</span>${type}`;
    btn.onclick = () => setFilter(type, btn);
    legendEl.appendChild(btn);
  });
}

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

renderLegend();
renderHotList();
