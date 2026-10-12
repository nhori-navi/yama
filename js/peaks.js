// YamaMiru：山の一覧（Wikidata・OpenStreetMap）と見えるかの判定
// ---------- 山の一覧（Wikidata）を地域ごとにスマホへ保存 ----------
// 保存形式：{regions:[{c:[経度,緯度], r:半径km, t:取得日時, nf:百名山の印が未取得なら1}], list:[[名前, 経度, 緯度, 標高, 百名山=1, ID]]}
function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s && Array.isArray(s.list) && Array.isArray(s.regions)) return s;
  } catch (e) {}
  return {regions:[], list:[]};
}
function saveStore(s) {
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { showErr('スマホへの保存に失敗しました（容量不足の可能性）'); }
}
function showStoreInfo() {
  const s = loadStore(), n = Object.keys(loadOsm().tiles).length;
  $('storeInfo').textContent = (s.regions.length
    ? `保存済み：${s.regions.length}地域・${s.list.length.toLocaleString()}座`
    : '山の一覧はまだ保存されていません') + (n ? `／細かい山 ${n}マス` : '');
}
// 日本百名山に属する山のID（Wikidata の「一部である」P361）
async function fetchF100() {
  const q = `SELECT ?i WHERE { ?h rdfs:label "日本百名山"@ja. ?i wdt:P361 ?h. }`;
  const r = await tfetch(WD + encodeURIComponent(q), {}, WAIT);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const ids = new Set(((await readWd(r)).results.bindings || []).map(b => b.i.value.replace(/.*\//, '')));
  if (ids.size < 50) throw new Error('百名山の一覧が足りません');
  return ids;
}
// 前回、百名山の印を取れなかった地域があれば取り直す
async function retryF100() {
  if (!loadStore().regions.some(x => x.nf)) return;
  try {
    const ids = await fetchF100(), s = loadStore();
    s.list.forEach(v => { if (ids.has(v[5])) v[4] = 1; });
    s.regions.forEach(x => { delete x.nf; });
    saveStore(s);
    let changed = false;
    baseVis.forEach(v => { if (v.id && ids.has(v.id) && !v.f100) { v.f100 = 1; changed = true; } });
    if (changed && !running) { refreshLabels(); doneStatus(); }
  } catch (e) {}
}
// この地点の計算範囲をまるごと含む保存済み地域
const coveringRegion = (s, p) => s.regions.find(r => distM(r.c, p) <= (r.r || FETCH_KM) * 1000 - MAXD);
async function fetchRegion(center) {
  // 位置の索引で近くの場所を先に絞り込み、その中から山を探す
  const q = `SELECT ?i ?l ?c ?e WHERE {
    SERVICE wikibase:around {
      ?i wdt:P625 ?c.
      bd:serviceParam wikibase:center "Point(${center[0].toFixed(4)} ${center[1].toFixed(4)})"^^geo:wktLiteral.
      bd:serviceParam wikibase:radius "${FETCH_KM}".
    }
    VALUES ?t { wd:Q8502 wd:Q8072 wd:Q169358 wd:Q54050 }
    ?i wdt:P31 ?t.
    OPTIONAL { ?i wdt:P2044 ?e }
    ?i rdfs:label ?l. FILTER(LANG(?l) = "ja")
  }`;
  const r = await tfetch(WD + encodeURIComponent(q), {}, WD_WAIT);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await readWd(r), byId = new Map();
  ((j.results && j.results.bindings) || []).forEach(b => {
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.c.value);
    if (!m) return;
    const id = b.i.value.replace(/.*\//, ''), e = b.e ? Math.round(parseFloat(b.e.value)) : 0, old = byId.get(id);
    if (old) { if (e > old[3]) old[3] = e; return; }
    byId.set(id, [b.l.value, +(+m[1]).toFixed(4), +(+m[2]).toFixed(4), isFinite(e) ? e : 0, 0, id]);
  });
  if (!byId.size) throw new Error('この地域の山が見つかりませんでした');
  let f100ok = false;
  try { // 日本百名山の印
    const ids = await fetchF100();
    byId.forEach((v, id) => { if (ids.has(id)) v[4] = 1; });
    f100ok = true;
  } catch (e) {}
  const s = loadStore(), all = new Map(s.list.map(v => [v[5], v]));
  byId.forEach((v, id) => { const old = all.get(id); if (!f100ok && old && old[4]) v[4] = 1; all.set(id, v); });
  s.list = [...all.values()];
  const reg = {c:center, r:FETCH_KM, t:Date.now()};
  if (!f100ok) reg.nf = 1; // 百名山の印が未取得（次回取り直す）
  s.regions = s.regions.filter(x => distM(x.c, center) > 1000).concat([reg]);
  saveStore(s); showStoreInfo();
  return s;
}
function nearList(list) {
  const dLat = MAXD / 110574 + 0.01, dLon = MAXD / (111320 * Math.cos(obs[1] * Math.PI / 180)) + 0.01;
  return list.filter(v => Math.abs(v[2] - obs[1]) < dLat && Math.abs(v[1] - obs[0]) < dLon)
    .map(v => ({lon:v[1], lat:v[2], tags:{name:v[0], ele:String(v[3] || '')}, f100:v[4], id:v[5]}));
}

// ---------- 細かい山（OpenStreetMap）をマスごとにスマホへ保存 ----------
// 保存形式：{tiles:{"経度,緯度"（マスの南西の角）:{t:取得日時, l:[[名前, 経度, 緯度, 標高]]}}}
function loadOsm() {
  try {
    const c = JSON.parse(localStorage.getItem(OSM_STORE) || 'null');
    if (c && c.tiles && typeof c.tiles === 'object') return c;
  } catch (e) {}
  return {tiles:{}};
}
// 1マス分を保存（ほかの処理が保存した分を消さないよう、読み直してから足す）
function saveTile(k, tile) {
  const c = loadOsm(); c.tiles[k] = tile;
  let keys = Object.keys(c.tiles).sort((a, b) => c.tiles[a].t - c.tiles[b].t);
  while (keys.length > OSM_MAX) delete c.tiles[keys.shift()]; // 多すぎたら古いマスから消す
  for (let n = 0; n < 3; n++) {
    try { localStorage.setItem(OSM_STORE, JSON.stringify(c)); return; }
    catch (e) { // 容量不足なら古いマスを半分消して保存し直す
      keys = keys.filter(x => x !== k);
      if (!keys.length) break;
      keys.splice(0, Math.ceil(keys.length / 2)).forEach(x => delete c.tiles[x]);
    }
  }
  showErr('細かい山の保存に失敗しました（容量不足の可能性）');
}
// 計算範囲（半径150km）にかかるマス。近い順
function osmKeys(p) {
  const dLat = MAXD / 110574, dLon = MAXD / (111320 * Math.cos(p[1] * Math.PI / 180)), list = [];
  for (let x = Math.floor(p[0] - dLon); x <= Math.floor(p[0] + dLon); x++)
    for (let y = Math.floor(p[1] - dLat); y <= Math.floor(p[1] + dLat); y++) {
      const q = [Math.min(x + 1, Math.max(x, p[0])), Math.min(y + 1, Math.max(y, p[1]))], d = distM(p, q);
      if (d <= MAXD) list.push({k:x + ',' + y, x, y, d});
    }
  return list.sort((a, b) => a.d - b.d);
}
// 1マス分を取得。取得先を順に試す（前回うまくいった取得先から）
async function fetchTile(x, y) {
  const q = `[out:json][timeout:25];node["natural"~"^(peak|volcano)$"]["name"](${y},${x},${y + 1},${x + 1});out body;`;
  const errs = [];
  for (let n = 0; n < MIRRORS.length; n++) {
    const m = (osmPref + n) % MIRRORS.length;
    try {
      const r = await tfetch(MIRRORS[m].url, {method:'POST', body:'data=' + encodeURIComponent(q),
        headers:{'Content-Type':'application/x-www-form-urlencoded'}}, WAIT);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.remark && /error|timed out/i.test(j.remark)) throw new Error('時間切れ');
      osmPref = m;
      return (j.elements || []).map(e => {
        const t = e.tags || {}, name = t['name:ja'] || t.name;
        if (!name || !isFinite(e.lon) || !isFinite(e.lat)) return null;
        const h = parseFloat(String(t.ele || '').replace(/[^\d.]/g, ''));
        return [name, +e.lon.toFixed(4), +e.lat.toFixed(4), isFinite(h) ? Math.round(h) : 0];
      }).filter(Boolean);
    } catch (e) { errs.push(MIRRORS[m].name + ' ' + errText(e, WAIT)); }
  }
  throw new Error(errs.join('、'));
}
// この地点の細かい山。足りないマス・古いマスだけ取りに行く
async function osmPeaks(key, label) {
  const list = osmKeys(obs), now = Date.now(), old = t => !t || now - t.t > OSM_DAYS * 86400000;
  let c = loadOsm(), lastErr = '';
  const need = list.filter(m => old(c.tiles[m.k]));
  tiles: for (let i = 0; i < need.length; i++) {
    for (let round = 0; ; round++) {
      if (key !== obsKey()) return null;
      status(`${label}を取得中… ${i + 1}/${need.length}マス（初回のみ。混んでいるときは時間がかかります）`);
      try {
        saveTile(need[i].k, {t:Date.now(), l:await fetchTile(need[i].x, need[i].y)});
        lastErr = ''; await sleep(1); break; // サーバーに負担をかけないよう1秒あけて次のマスへ
      } catch (e) {
        lastErr = e.message;
        if (round >= OSM_RETRY) break tiles; // やり直しても無理なら、今回はここまで（次回は続きから）
        for (let s = OSM_PAUSE; s > 0; s--) { // 30秒待ってやり直す
          if (key !== obsKey()) return null;
          status(`${label}：取得先が混んでいます。${s}秒後にやり直します（${round + 1}/${OSM_RETRY}回目）　${i}/${need.length}マス取得済み`);
          await sleep(1);
        }
      }
    }
  }
  if (key !== obsKey()) return null;
  c = loadOsm(); showStoreInfo();
  const els = [];
  list.forEach(m => { const t = c.tiles[m.k]; if (t) t.l.forEach(v => els.push({lon:v[1], lat:v[2], tags:{name:v[0], ele:String(v[3] || '')}})); });
  return {els, lastErr, total:list.length,
    missing:list.filter(m => !c.tiles[m.k]).length, done:!list.some(m => old(c.tiles[m.k]))};
}
async function addExtra() {
  const key = obsKey();
  if ((extraFor === key && extraDone) || !prof || extraBusy) return;
  extraBusy = true;
  try {
    const res = await osmPeaks(key, '細かい山');
    if (!res) return;
    const base = baseVis.map(v => v.p), baseNames = baseVis.map(v => v.name);
    const fresh = res.els.filter(e => {
      const p = [e.lon, e.lat], n = e.tags.name;
      return !base.some((b, i) => { const d = distM(b, p); return d < 150 || (baseNames[i] === n && d < 3000); });
    });
    const vis = await checkPeaks(fresh, curH0);
    if (key !== obsKey()) return;
    extraVis = vis; extraFor = key; extraDone = res.done;
    refreshLabels(); doneStatus();
    if (res.lastErr) showErr(`細かい山：${res.missing ? `${res.total}マス中${res.missing}マスを取得できませんでした` : '古い保存データで表示しています'}（${res.lastErr}）。チェックを入れ直すか、次に計算したときに、足りない分だけ続きから取ります`);
  } catch (e) { showErr('細かい山の表示に失敗：' + e.message); doneStatus(); }
  finally {
    extraBusy = false;
    if (key !== obsKey() && $('many').checked && !running) addExtra(); // 途中で地点が変わったとき
  }
}

// ---------- 見えるかの判定 ----------
async function checkPeaks(els, h0) {
  const vis = [];
  for (let k = 0; k < els.length; k++) {
    const e = els[k], p = [e.lon, e.lat], D = distM(obs, p);
    if (D < 200 || D > MAXD || !e.tags) continue;
    const tagH = parseFloat(String(e.tags.ele || '').replace(/[^\d.]/g, ''));
    const h = Math.max(isFinite(tagH) ? tagH : 0, elev(p, D));
    const az = brg(obs, p), target = ang(h, D, h0), stop = D - Math.max(150, D * 0.015);
    // 先に計算した稜線で、手前の山に隠れているのがはっきりしている山は細かい判定を省く
    if (prof) {
      const N = prof[0].length, i0 = Math.floor(az / STEP) % N, i1 = (i0 + 1) % N;
      let b = -1; while (b + 1 < BANDS.length && BANDS[b + 1] < stop) b++;
      if (b >= 0 && Math.min(prof[b][i0], prof[b][i1]) > target + 0.05) {
        if (k % 200 === 0) { status(`見える山を判定中… ${k}/${els.length}`); await tick(); }
        continue;
      }
    }
    let d = 30, ok = true, mf = -90; // mf：手前でいちばん高く見える地形の角度
    while (d < stop) {
      const a2 = ang(elev(dest(obs, az, d), d), d, h0);
      if (a2 > target + 0.02) { ok = false; break; }
      if (a2 > mf) mf = a2;
      d += Math.max(30, d * 0.008);
    }
    // mg：手前の地形より山頂がどれだけ上に出ているか（度）。小さいほど「ぎりぎり見える」
    if (ok) vis.push({name:e.tags['name:ja'] || e.tags.name, h:Math.round(h), d:D, az, a:target, p, f100:e.f100 || 0, id:e.id, mg:target - mf});
    if (k % 200 === 0) { status(`見える山を判定中… ${k}/${els.length}`); await tick(); }
  }
  return vis;
}
function placeLabels() {
  const sp = $('many').checked ? 11 : 17, W = 360 * PXD;
  labels = [];
  [...allVis].sort((x, y) => (y.h + y.f100 * 3000) - (x.h + x.f100 * 3000)).forEach(v => {
    const x = v.az * PXD;
    if (labels.some(l => { const dx = Math.abs(l.az * PXD - x); return dx < sp || dx > W - sp; })) return;
    labels.push(v);
  });
}
function refreshLabels() {
  allVis = baseVis.concat($('many').checked ? extraVis : []);
  placeLabels(); selIdx = -1; draw(); showInfo(); showAstro();
}
function doneStatus() {
  const extra = $('many').checked && extraFor === obsKey() ? `＋細かい山 ${extraVis.length}座` : '';
  status(`${note}見える山 ${baseVis.length}座${extra}（表示 ${labels.length}座）　山名：${srcName}　この地点の標高 約${Math.round(curH0)}m`);
}
