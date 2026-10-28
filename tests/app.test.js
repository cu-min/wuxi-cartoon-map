const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname,'..');
const source = name => fs.readFileSync(path.join(root,name),'utf8');
const deferred = () => { let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b}); return {promise,resolve,reject}; };
const geo = {type:'FeatureCollection',features:[{type:'Feature',properties:{name:'无锡市',adcode:320200},geometry:{type:'Polygon',coordinates:[[[119,31],[121,31],[121,33],[119,33],[119,31]]]}}]};
const flush = () => new Promise(resolve=>setTimeout(resolve,30));
function app({hash='#/c/jiangsu-wuxi',fetchImpl,loadImpl}={}) {
  const dom = new JSDOM('<div id="map"></div><div id="view"></div><div id="toast"></div>',{url:'http://localhost/'+hash,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
  for(const dimension of ['clientWidth','offsetWidth']) Object.defineProperty(w.HTMLElement.prototype,dimension,{get(){return 1200}});
  for(const dimension of ['clientHeight','offsetHeight']) Object.defineProperty(w.HTMLElement.prototype,dimension,{get(){return 800}});
  w.fetch=fetchImpl || (async()=>({ok:true,json:async()=>structuredClone(geo)}));
  w.eval(source('node_modules/leaflet/dist/leaflet.js'));
  w.L.Browser.svg=true;
  for(const f of ['config.js','cities.js','city-catalog.js'])w.eval(source(f));
  w.loadCityData=loadImpl || (async key=>{w.eval(source('data/'+key+'.js'));return w.CITY_DATA[key]});
  w.eval(source('app.js'));
  return {dom,w};
}

test('real Leaflet + DOM renders city, filters and restores ranking marker',async()=>{
  const {dom,w}=app();
  try{
    await flush();
    assert.equal(w.document.body.dataset.view,'city');
    assert.equal(w.document.querySelectorAll('.hot-item').length,8);
    assert.ok(w.document.querySelectorAll('.doll-icon').length>0);
    const first=w.document.querySelector('.hot-item');
    const type=first.querySelector('.hot-meta').textContent;
    const filter=[...w.document.querySelectorAll('.legend button')].slice(1).find(b=>!b.textContent.includes(type));
    filter.click();
    assert.equal(filter.getAttribute('aria-pressed'),'true');
    first.click();
    assert.ok(w.document.querySelector('.leaflet-popup'));
    assert.equal(w.document.querySelector('.legend button').getAttribute('aria-pressed'),'true');
    const disclosure=w.document.querySelector('.hot-titles');
    disclosure.click();
    assert.equal(disclosure.getAttribute('aria-expanded'),'false');
    assert.equal(w.document.querySelector('.hot-list').hidden,true);
  }finally{dom.window.close()}
});

test('stale overview and city border responses do not reattach old layers',async()=>{
  const pending=deferred();
  const {dom,w}=app({hash:'#/',fetchImpl:()=>pending.promise});
  try{
    w.location.hash='#/c/jiangsu-wuxi'; await flush();
    assert.equal(w.document.body.dataset.view,'city');
    pending.resolve({ok:true,json:async()=>structuredClone(geo)});
    await flush();
    assert.equal(w.document.querySelectorAll('.prov-label').length,0);
    assert.equal(w.document.body.dataset.view,'city');
  }finally{dom.window.close()}
});

test('city load completing after navigation never overwrites the new route',async()=>{
  const pending=deferred();
  const {dom,w}=app({loadImpl:()=>pending.promise});
  try{
    assert.equal(w.document.body.dataset.view,'loading');
    w.location.hash='#/'; await flush();
    w.eval(source('data/jiangsu-wuxi.js'));pending.resolve(w.CITY_DATA['jiangsu-wuxi']);
    await flush();
    assert.equal(w.document.body.dataset.view,'overview');
    assert.equal(w.document.querySelectorAll('.hot-panel').length,0);
  }finally{dom.window.close()}
});

test('late IP geolocation never redirects after a user navigation',async()=>{
  const {dom,w}=app({hash:'#/'});
  try{
    const pending=deferred();
    w.MAP_CONFIG.ipKey='test';
    w.jsonpRequest=()=>pending.promise;
    const locating=w.locateAndJump();
    w.location.hash='#/c/jiangsu-wuxi';await flush();
    pending.resolve({status:0,result:{ad_info:{province:'浙江省',city:'杭州市'}}});
    await locating;
    assert.equal(w.location.hash,'#/c/jiangsu-wuxi');
  }finally{dom.window.close()}
});

test('fetch timeout remains active until response JSON body is read',async()=>{
  const {dom,w}=app();
  try{
    await flush();
    w.fetch=async(_url,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))});
    await assert.rejects(w.fetchWithTimeout('http://example.test',10),/aborted/);
  }finally{dom.window.close()}
});

test('unsafe external link protocols are rejected',async()=>{
  const {dom,w}=app();
  try{
    await flush();
    assert.equal(w.safeWebUrl('javascript:alert(1)'), '');
    assert.equal(w.safeWebUrl('data:text/html,test'), '');
    assert.equal(w.safeWebUrl('https://example.test/path'), 'https://example.test/path');
  }finally{dom.window.close()}
});

test('city load error offers a working retry without reload',async()=>{
  let attempts=0;
  const {dom,w}=app({loadImpl:async key=>{if(++attempts===1)throw new Error('offline');w.eval(source('data/'+key+'.js'));return w.CITY_DATA[key]}});
  try{
    await flush();
    const retry=w.document.querySelector('.route-status button');
    assert.ok(retry);
    retry.click();await flush();
    assert.equal(w.document.body.dataset.view,'city');
    assert.equal(attempts,2);
  }finally{dom.window.close()}
});

test('all catalog cities render and open a ranking popup with the real Leaflet library',async()=>{
  const {dom,w}=app();
  try{
    await flush();
    for(const key of Object.keys(w.CITY_CATALOG)) {
      await w.renderCity(key);
      assert.equal(w.document.body.dataset.view,'city',key);
      assert.ok(w.document.querySelector('.doll-icon'),key);
      const item=w.document.querySelector('.hot-item');
      if(item){item.click();assert.ok(w.document.querySelector('.leaflet-popup'),key);}
    }
  }finally{dom.window.close()}
});
