// YamaMiru：共通の道具・地図・標高タイル・稜線の計算
const TOKEN = 'pk.eyJ1IjoiaG9yaWhha28iLCJhIjoiY211djd0ejljMDA5ZjMycHYxaTY3M3BsdSJ9.a1yefJYynC4k_YvllM5DVw';
mapboxgl.accessToken = TOKEN;
const $ = id => document.getElementById(id);
const DEF = [139.38, 35.61]; // 現在地が取れないときの地点（南大沢付近）
const R = 6371000, K = 0.13;          // 地球の半径、光の曲がり具合
const MAXD = 150000, NEAR = 15000;    // 計算する範囲、細かい地形を使う範囲（m）
const STEP = 0.2, PXD = 12;           // 稜線を計算する角度の刻み、横1度あたりの幅
const OFF = 60;                       // 北をまたいでつなげるための左右の余白（度）
const WAIT = 30000, WD_WAIT = 70000;  // 問い合わせを待つ上限（ミリ秒）
const FETCH_KM = 200;                 // Wikidataから一度に取る半径（km）
const STORE = 'yama_peaks_v2', KEEP_DAYS = 30;
const WD = 'https://query.wikidata.org/sparql?format=json&query=';
// 細かい山（OpenStreetMap）：縦横1度のマスごとに取ってスマホへ保存
const OSM_STORE = 'yama_osm_v1', OSM_DAYS = 90, OSM_MAX = 40;
const OSM_RETRY = 3, OSM_PAUSE = 30; // 3か所とも失敗したとき、30秒待ってやり直す回数
const MIRRORS = [ // 上から順に試す
  {name:'本家', url:'https://overpass-api.de/api/interpreter'},
  {name:'VK Maps', url:'https://maps.mail.ru/osm/tools/overpass/api/interpreter'},
  {name:'private.coffee', url:'https://overpass.private.coffee/api/interpreter'}
];
const BANDS = [10000, 30000, 70000, 150000];
const COLS = ['#4a5a6e', '#6b7f9a', '#93a5bd', '#c3cfdf'];
const DIR8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
const TOP = 118, AXIS = 22, H = 360;

const map = new mapboxgl.Map({container:'map', style:'mapbox://styles/mapbox/outdoors-v12', center:DEF, zoom:9});
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

let obs = null, obsMarker = null, pick = false, running = false, note = '', curH0 = 0, srcName = '';
let prof = null, baseVis = [], extraVis = [], extraFor = null, extraDone = false, extraBusy = false, osmPref = 0;
let allVis = [], labels = [], hits = [], selIdx = -1;
let sync = false, head = null, sx = 0, sy = 0, gotOri = false, offset = 0;
const tiles = new Map();
try { offset = Number(localStorage.getItem('yama_offset')) || 0; } catch (e) {}

// ---------- 共通 ----------
const status = t => { $('status').textContent = t; };
const showErr = t => { $('err').textContent = t; };
const tick = () => new Promise(r => setTimeout(r));
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
const norm360 = a => ((a % 360) + 360) % 360;
const xOf = az => (az + OFF) * PXD;
const obsKey = () => obs ? obs[0].toFixed(4) + ',' + obs[1].toFixed(4) : '';
function setData(id, f) { const s = map.getSource(id); if (s) s.setData({type:'FeatureCollection', features:f}); }
async function tfetch(url, opt, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, {...opt, signal:ctl.signal}); } finally { clearTimeout(t); }
}
const errText = (e, ms) => e.name === 'AbortError' ? `${ms / 1000}秒で応答なし` : e.message;
// Wikidataの返事を読む（時間切れで途中までしか届かなかった場合を見分ける）
async function readWd(r) {
  const text = await r.text();
  try { return JSON.parse(text); }
  catch (e) { throw new Error(/timeout/i.test(text) ? '時間切れ（Wikidataが混雑）' : 'データが途中で切れていました'); }
}
function distM(a, b) {
  const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function brg(a, b) {
  const r = Math.PI / 180, dl = (b[0] - a[0]) * r;
  const y = Math.sin(dl) * Math.cos(b[1] * r);
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos(dl);
  return norm360(Math.atan2(y, x) / r);
}
function dest(p, az, d) {
  const r = Math.PI / 180, la1 = p[1] * r, lo1 = p[0] * r, a = az * r, dr = d / R;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(dr) + Math.cos(la1) * Math.sin(dr) * Math.cos(a));
  const lo2 = lo1 + Math.atan2(Math.sin(a) * Math.sin(dr) * Math.cos(la1), Math.cos(dr) - Math.sin(la1) * Math.sin(la2));
  return [lo2 / r, la2 / r];
}
const dirName = az => DIR8[Math.round(norm360(az) / 45) % 8];
// 見上げる角度（度）：地球の丸みと光の曲がりを考慮
const ang = (h, d, h0) => Math.atan((h - h0 - d * d / (2 * R) * (1 - K)) / d) * 180 / Math.PI;
function circle(c, m) {
  const pts = [], kx = 111320 * Math.cos(c[1] * Math.PI / 180);
  for (let i = 0; i <= 64; i++) { const a = i / 64 * 2 * Math.PI; pts.push([c[0] + m / kx * Math.sin(a), c[1] + m / 110574 * Math.cos(a)]); }
  return {type:'Feature', properties:{}, geometry:{type:'Polygon', coordinates:[pts]}};
}

// ---------- 地図 ----------
map.on('load', () => {
  const empty = {type:'FeatureCollection', features:[]};
  map.addSource('range', {type:'geojson', data:empty});
  map.addLayer({id:'range', type:'line', source:'range', paint:{'line-color':'#1f6fd1', 'line-width':1.5, 'line-dasharray':[2, 2]}});
  map.addSource('sel', {type:'geojson', data:empty});
  map.addLayer({id:'sel', type:'line', source:'sel', paint:{'line-color':'#c0392b', 'line-width':3}});
  if (obs) setData('range', [circle(obs, MAXD)]);
});
map.on('click', e => { if (pick) { pick = false; note = ''; run([e.lngLat.lng, e.lngLat.lat]); } });
function placeObs() {
  if (!obsMarker) obsMarker = new mapboxgl.Marker({color:'#1e90ff'}).setLngLat(obs).addTo(map);
  else obsMarker.setLngLat(obs);
  setData('range', [circle(obs, MAXD)]);
  map.jumpTo({center:obs, zoom:10});
}

// ---------- 標高タイル（国土地理院） ----------
const tc = document.createElement('canvas'); tc.width = tc.height = 256;
const tcx = tc.getContext('2d', {willReadFrequently:true});
function tileXY(lon, lat, z) {
  const n = 2 ** z, r = lat * Math.PI / 180;
  return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n];
}
async function loadTile(z, x, y) {
  const key = z + '/' + x + '/' + y;
  if (tiles.has(key)) return;
  tiles.set(key, null);
  try {
    const r = await fetch(`https://cyberjapandata.gsi.go.jp/xyz/dem_png/${key}.png`);
    if (!r.ok) return;
    const bmp = await createImageBitmap(await r.blob());
    tcx.clearRect(0, 0, 256, 256); tcx.drawImage(bmp, 0, 0);
    const d = tcx.getImageData(0, 0, 256, 256).data, a = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) {
      const v = d[i * 4] * 65536 + d[i * 4 + 1] * 256 + d[i * 4 + 2];
      a[i] = v === 8388608 ? 0 : (v < 8388608 ? v : v - 16777216) * 0.01;
    }
    tiles.set(key, a);
  } catch (e) {}
}
function tileList(c, m, z) {
  const dLat = m / 110574, dLon = m / (111320 * Math.cos(c[1] * Math.PI / 180));
  const [x0, y0] = tileXY(c[0] - dLon, c[1] + dLat, z), [x1, y1] = tileXY(c[0] + dLon, c[1] - dLat, z), list = [];
  for (let x = Math.floor(x0); x <= Math.floor(x1); x++)
    for (let y = Math.floor(y0); y <= Math.floor(y1); y++) list.push([z, x, y]);
  return list;
}
async function loadAll(list) {
  let i = 0, done = 0;
  const worker = async () => {
    while (i < list.length) { const t = list[i++]; await loadTile(...t); done++; status(`地形を読み込み中… ${done}/${list.length}`); }
  };
  await Promise.all(Array.from({length:8}, worker));
}
function elevZ(lon, lat, z) {
  const [xf, yf] = tileXY(lon, lat, z), x = Math.floor(xf), y = Math.floor(yf);
  const a = tiles.get(z + '/' + x + '/' + y);
  if (a === undefined) return null;
  if (!a) return 0;
  return a[Math.min(255, Math.floor((yf - y) * 256)) * 256 + Math.min(255, Math.floor((xf - x) * 256))];
}
function elev(p, d) {
  if (d < NEAR) { const h = elevZ(p[0], p[1], 12); if (h !== null) return h; }
  return elevZ(p[0], p[1], 10) ?? 0;
}

// ---------- 稜線の計算 ----------
async function computeProfile(h0) {
  const N = Math.round(360 / STEP), cum = BANDS.map(() => new Float32Array(N).fill(-90));
  for (let i = 0; i < N; i++) {
    const az = i * STEP; let d = 30, b = 0, mx = -90;
    while (d <= MAXD) {
      while (b < BANDS.length && d > BANDS[b]) { cum[b][i] = mx; b++; }
      const a = ang(elev(dest(obs, az, d), d), d, h0);
      if (a > mx) mx = a;
      d += Math.max(30, d * 0.008);
    }
    for (; b < BANDS.length; b++) cum[b][i] = mx;
    if (i % 60 === 0) { status(`稜線を計算中… ${Math.round(i / N * 100)}%`); await tick(); }
  }
  return cum;
}
