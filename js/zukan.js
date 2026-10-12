// YamaMiru：山の図鑑・名山リスト・バッジ・見つける判定
// ---------- 山の図鑑 ----------
// 保存形式：{peaks:{キー:{n:名前, h:標高, f:百名山=1, id:WikidataのID, p:[経度,緯度], t1:初めて見つけた日時, t2:最後に見つけた日時,
//   c:見つけた回数, from:[経度,緯度]（初めて見つけた場所）, place:初めて見つけた市区町村, pl:{市区町村:日時}（場所スタンプ）,
//   d:初めて見つけた距離m, dm:いちばん遠くから見つけた距離m, r:いちばん高かったレア度}},
//   score:合計点, days:{"日付":その日に見つけた数}, dusk:日の出・日の入りの時間に見つけた=1, badges:{バッジID:獲得日時}}
const ZK_STORE = 'yama_zukan_v1', LIST_STORE = 'yama_lists_v1';
const CATCH_DEG = 2, CATCH_MS = 2000; // 赤い線の±2°以内に2秒で「見つけた」
const GOLD = '#d4a017';
// 名山リスト（Wikidataの項目。二百・三百名山は追加分だけ登録されているので、前のリストを足して数える）
const LISTS = [
  {k:'f100', name:'日本百名山', q:'Q1156761'},
  {k:'n200', name:'日本二百名山', q:'Q11086204', base:'f100'},
  {k:'n300', name:'日本三百名山', q:'Q11507122', base:'n200'},
  {k:'gunma', name:'ぐんま百名山', q:'Q109358527'},
  {k:'y100', name:'山梨百名山'}
];
// バッジ：[ID, 名前, 条件, 判定]
const BADGES = [
  ['n1', 'はじめの一座', '山を1座見つける', s => s.n >= 1],
  ['n10', '10座', '山を10座見つける', s => s.n >= 10],
  ['n50', '50座', '山を50座見つける', s => s.n >= 50],
  ['n100', '100座', '山を100座見つける', s => s.n >= 100],
  ['f1', '百名山デビュー', '日本百名山を1座', s => s.f100 >= 1],
  ['f10', '百名山10座', '日本百名山を10座', s => s.f100 >= 10],
  ['f30', '百名山30座', '日本百名山を30座', s => s.f100 >= 30],
  ['l200', '二百名山20座', '日本二百名山を20座', s => s.n200 >= 20],
  ['l300', '三百名山30座', '日本三百名山を30座', s => s.n300 >= 30],
  ['gunma', 'ぐんま百名山10座', 'ぐんま百名山を10座', s => s.gunma >= 10],
  ['y100', '山梨百名山10座', '山梨百名山を10座', s => s.y100 >= 10],
  ['d50', '50km超え', '50km以上離れた山を見つける', s => s.far >= 50000],
  ['d100', '100km超え', '100km以上離れた山を見つける', s => s.far >= 100000],
  ['r5', 'ぎりぎりの山', 'レア度★5の山を見つける', s => s.r5],
  ['day10', '1日に10座', '1日で10座見つける', s => s.day >= 10],
  ['same3', '三方から', '同じ山を3つの市区町村から見つける', s => s.same >= 3],
  ['pl5', '5つの町から', '5つの市区町村から山を見つける', s => s.places >= 5],
  ['dusk', '朝焼け・夕焼け', '日の出・日の入りの時間に山を見つける', s => s.dusk]
];
let zukan = loadZukan(), aim = null, flashK = '', flashUntil = 0, toastTimer = 0, zkSort = 'new', zkTab = 'f100';
let lists = null, listsErr = '', listsBusy = null, curPlace = '', placeFor = '';
const caughtNow = new Set(); // 今回の起動中に、同じ場所で見つけた山（何度も数えないため）
// レア度★1〜5：距離で★1〜4。手前の地形からぎりぎり（0.1°未満）頭を出している山は★を1つ足す
function rarity(d, mg) {
  const r = d < 20000 ? 1 : d < 50000 ? 2 : d < 100000 ? 3 : 4;
  return Math.min(5, r + (mg < 0.1 ? 1 : 0));
}
const stars = r => '★'.repeat(r) + '☆'.repeat(5 - r);
function loadZukan() {
  let z = null;
  try { z = JSON.parse(localStorage.getItem(ZK_STORE) || 'null'); } catch (e) {}
  if (!z || !z.peaks) z = {peaks:{}};
  z.score = z.score || 0; z.days = z.days || {}; z.badges = z.badges || {};
  Object.values(z.peaks).forEach(v => { // 前の版の記録を新しい形にそろえる
    if (!v.pl) v.pl = v.place ? {[v.place]:v.t1} : {};
    if (!v.r) v.r = rarity(v.dm || v.d || 0, 99);
  });
  return z;
}
function saveZukan() {
  try { localStorage.setItem(ZK_STORE, JSON.stringify(zukan)); } catch (e) { showErr('図鑑の保存に失敗しました（容量不足の可能性）'); }
}
const zkKey = l => l.id || ('osm:' + l.name + ':' + l.p[0].toFixed(3) + ',' + l.p[1].toFixed(3));
function toast(t, ms) {
  const el = $('toast'); el.textContent = t; el.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms || 2800);
}
// 計算している地点の市区町村名（場所スタンプ用。Mapboxで調べる）
async function updatePlace() {
  const key = obsKey();
  if (!obs || placeFor === key) return;
  placeFor = key; curPlace = '';
  try {
    const r = await tfetch(`https://api.mapbox.com/search/geocode/v6/reverse?longitude=${obs[0].toFixed(5)}&latitude=${obs[1].toFixed(5)}&types=place&language=ja&access_token=${TOKEN}`, {}, 10000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const f = ((await r.json()).features || [])[0], pr = f && f.properties, name = pr && (pr.name_preferred || pr.name);
    if (key === obsKey()) { curPlace = name || ''; if (!name) placeFor = ''; }
  } catch (e) { if (key === obsKey()) placeFor = ''; } // 失敗したら次の機会に調べ直す
}
// ---- 名山リスト ----
const normName = s => String(s || '').replace(/[ヶケヵ]/g, '').replace(/ッ/g, 'つ').replace(/竜/g, '龍').replace(/\s/g, '');
async function loadLists() {
  if (lists) return lists;
  try {
    const c = JSON.parse(localStorage.getItem(LIST_STORE) || 'null');
    if (c && c.sets && Date.now() - c.t < 90 * 86400000) return (lists = prepLists(c));
  } catch (e) {}
  if (!listsBusy) listsBusy = fetchLists().finally(() => { listsBusy = null; });
  return listsBusy;
}
async function fetchLists() {
  const qs = LISTS.filter(L => L.q).map(L => 'wd:' + L.q).join(' ');
  const q1 = `SELECT ?h ?i ?l ?c WHERE { VALUES ?h { ${qs} } { ?i wdt:P361 ?h } UNION { ?h wdt:P527 ?i }
    OPTIONAL { ?i rdfs:label ?l. FILTER(LANG(?l) = "ja") } OPTIONAL { ?i wdt:P625 ?c } }`;
  // 山梨百名山：Wikipediaの記事名からWikidataのIDを調べる
  const titles = Y100.map(v => JSON.stringify(v[2] || v[0]) + '@ja').join(' ');
  const q2 = `SELECT ?t ?i WHERE { VALUES ?t { ${titles} } ?a schema:about ?i; schema:isPartOf <https://ja.wikipedia.org/>; schema:name ?t. }`;
  const post = q => tfetch('https://query.wikidata.org/sparql', {method:'POST', body:'format=json&query=' + encodeURIComponent(q),
    headers:{'Content-Type':'application/x-www-form-urlencoded', 'Accept':'application/sparql-results+json'}}, WAIT)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return readWd(r); });
  const [j1, j2] = await Promise.all([post(q1), post(q2)]);
  const sets = {}, kOf = {};
  LISTS.forEach(L => { if (L.q) { sets[L.k] = {}; kOf[L.q] = L.k; } });
  (j1.results.bindings || []).forEach(b => {
    const k = kOf[b.h.value.replace(/.*\//, '')], id = b.i.value.replace(/.*\//, '');
    if (!k || !/^Q\d+$/.test(id) || sets[k][id]) return;
    const lat = /Point\([-\d.]+ ([-\d.]+)\)/.exec(b.c ? b.c.value : '');
    sets[k][id] = [b.l ? b.l.value : id, lat ? +(+lat[1]).toFixed(3) : 0];
  });
  const yid = {};
  (j2.results.bindings || []).forEach(b => { yid[b.t.value] = b.i.value.replace(/.*\//, ''); });
  if (Object.keys(sets.f100).length < 50) throw new Error('一覧が足りません');
  const c = {t:Date.now(), sets, yid};
  try { localStorage.setItem(LIST_STORE, JSON.stringify(c)); } catch (e) {}
  return (lists = prepLists(c));
}
function prepLists(c) {
  const out = {};
  LISTS.forEach(L => {
    let m;
    if (L.k === 'y100') m = Y100.map((v, i) => ({id:c.yid[v[2] || v[0]] || '', name:v[0], no:i + 1, h:v[1], alt:[v[0], ...(v[3] || [])].map(normName)}));
    else {
      m = Object.entries(c.sets[L.k] || {}).map(([id, v]) => ({id, name:v[0], lat:v[1]}));
      if (L.base) { const have = new Set(m.map(x => x.id)); out[L.base].m.forEach(x => { if (!have.has(x.id)) m.push(x); }); }
      m.sort((a, b) => b.lat - a.lat); // 北から順
    }
    out[L.k] = {...L, m, ids:new Set(m.map(x => x.id).filter(Boolean))};
  });
  return out;
}
// 山梨百名山の名前・標高・場所での照合（IDで見つからないとき用。同じ名前の別の山を取り違えないよう、標高差40m以内・山梨県付近に限る）
const yMatch = (o, x) => !!o.p && o.p[0] > 138.1 && o.p[0] < 139.2 && o.p[1] > 35.1 && o.p[1] < 36.1 &&
  x.alt.includes(normName(o.n || o.name)) && Math.abs(x.h - (o.h || 0)) <= 40;
// その山が入っている名山リストのキー
function listsOf(o) {
  if (!lists) return o.f100 || o.f ? ['f100'] : [];
  return LISTS.filter(L => {
    const S = lists[L.k];
    if (o.id && S.ids.has(o.id)) return true;
    return L.k === 'y100' && S.m.some(x => yMatch(o, x));
  }).map(L => L.k);
}
// 表示用（百名山なら二百・三百名山は書かない）
function listTags(o) {
  const ks = listsOf(o);
  return ks.filter(k => !(k === 'n200' && ks.includes('f100')) && !(k === 'n300' && (ks.includes('n200') || ks.includes('f100'))))
    .map(k => LISTS.find(L => L.k === k).name).join('・');
}
function gotOf(k) { // そのリストで見つけた山（リストの順番どおりの印の配列）
  const S = lists && lists[k]; if (!S) return [];
  const all = Object.values(zukan.peaks), ids = new Set(all.map(v => v.id).filter(Boolean));
  return S.m.map(x => (x.id && ids.has(x.id)) || (k === 'y100' && all.some(v => yMatch(v, x))));
}
const countGot = k => gotOf(k).filter(Boolean).length;
// ---- バッジ ----
function zkStats() {
  const all = Object.values(zukan.peaks), places = new Set();
  all.forEach(v => Object.keys(v.pl || {}).forEach(p => places.add(p)));
  const s = {n:all.length, far:Math.max(0, ...all.map(v => v.dm || 0)), r5:all.some(v => v.r >= 5),
    day:Math.max(0, ...Object.values(zukan.days)), same:Math.max(0, ...all.map(v => Object.keys(v.pl || {}).length)),
    places:places.size, dusk:!!zukan.dusk, f100:all.filter(v => v.f).length};
  if (lists) LISTS.forEach(L => { s[L.k] = countGot(L.k); });
  return s;
}
function checkBadges() { // 新しく取ったバッジの名前を返す
  const s = zkStats(), got = [];
  BADGES.forEach(([id, name, , test]) => { if (!zukan.badges[id] && test(s)) { zukan.badges[id] = Date.now(); got.push(name); } });
  if (got.length) saveZukan();
  return got;
}
// ---- 見つける ----
function catchPeak(l) {
  const k = zkKey(l), sk = obsKey() + '|' + k, now = Date.now();
  flashK = k; flashUntil = now + 2000; setTimeout(draw, 2100);
  if (caughtNow.has(sk)) { toast(`${l.name}（記録済み）`); draw(); return; }
  caughtNow.add(sk);
  if (!curPlace) updatePlace();
  const r = rarity(l.d, l.mg), dist = Math.round(l.d), place = curPlace;
  let e = zukan.peaks[k], pts = 0, msg;
  if (!e) { // はじめての山：★×20点
    e = zukan.peaks[k] = {n:l.name, h:l.h, f:l.f100 ? 1 : 0, id:l.id || '', p:l.p, t1:now, t2:now, c:1,
      from:[+obs[0].toFixed(4), +obs[1].toFixed(4)], place, pl:place ? {[place]:now} : {}, d:dist, dm:dist, r};
    pts = r * 20;
    msg = `はじめて見つけた！ ${l.name}` + (l.f100 ? `（百名山${Object.values(zukan.peaks).filter(v => v.f).length}座目）` : '');
  } else {
    e.t2 = now; e.c++; if (dist > e.dm) e.dm = dist; if (l.f100) e.f = 1; if (r > (e.r || 0)) e.r = r;
    if (place && !e.pl[place]) { e.pl[place] = now; pts = r * 10; msg = `${l.name}　${place}のスタンプ！`; } // 新しい市区町村から：★×10点
    else msg = `見つけた！ ${l.name}（${e.c}回目）`;
  }
  zukan.score += pts;
  const day = dateStr(new Date()); zukan.days[day] = (zukan.days[day] || 0) + 1;
  if (AST && obs) { try { const s = bodyPos(AST.Body.Sun, now, observer()); if (s.alt > -2 && s.alt < 5) zukan.dusk = 1; } catch (er) {} }
  saveZukan();
  const badges = checkBadges();
  if (navigator.vibrate) navigator.vibrate(pts || badges.length ? [80, 60, 120] : 60);
  toast(`${msg}　${'★'.repeat(r)}${pts ? ` +${pts}点` : ''}` + badges.map(b => `　🏅${b}`).join(''), badges.length ? 4500 : 3000);
  draw();
}
// 毎フレーム：赤い線の近くに山があるかを見て、2秒保ったら「見つけた」
function checkAim(now) {
  let best = null;
  if (sync && head != null && gotOri && !running && labels.length) {
    let bd = CATCH_DEG;
    labels.forEach(l => { const d = Math.abs(norm180(l.az - head)); if (d <= bd) { bd = d; best = l; } });
  }
  if (!best) { if (aim) { aim = null; $('aim').textContent = ''; $('center').style.background = '#c0392b'; } return; }
  const k = zkKey(best);
  if (!aim || aim.k !== k) aim = {k, since:now, done:false};
  $('center').style.background = GOLD;
  if (aim.done) { $('aim').textContent = `✓ ${best.name}`; return; }
  const el = now - aim.since, n = Math.min(5, Math.floor(el / CATCH_MS * 5));
  $('aim').textContent = `🎯 ${best.name}　${'●'.repeat(n)}${'○'.repeat(5 - n)}`;
  if (el >= CATCH_MS) { aim.done = true; catchPeak(best); }
}
// ---- 図鑑の画面 ----
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const ymdhm = t => `${ymd(t)} ${hm(new Date(t))}`;
const km = m => (m / 1000).toFixed(1) + 'km';
function renderZukan() {
  const all = Object.values(zukan.peaks), s = zkStats();
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = txt; return e; };
  // まとめ
  const far = all.reduce((a, v) => (!a || v.dm > a.dm ? v : a), null), high = all.reduce((a, v) => (!a || v.h > a.h ? v : a), null);
  $('zkSum').textContent = all.length
    ? `スコア ${zukan.score.toLocaleString()}点\n見つけた山 ${all.length}座　山を見た市区町村 ${s.places}か所\nいちばん遠く：${far.n}（${km(far.dm)}）\nいちばん高い：${high.n}（${high.h.toLocaleString()}m）`
    : 'まだ見つけた山はありません。「向きに合わせる」をONにして、山名を赤い線に2秒合わせると見つけられます。';
  $('zkSum').style.whiteSpace = 'pre-line';
  // バッジ
  const bb = $('zkBadges'); bb.innerHTML = '';
  BADGES.forEach(([id, name, desc]) => {
    const g = zukan.badges[id];
    bb.appendChild(el('span', g ? 'got' : '', g ? `🏅${name}\n${ymd(g)}` : `${name}\n${desc}`));
  });
  // 名山スタンプ帳
  const tabs = $('zkTabs'); tabs.innerHTML = '';
  LISTS.forEach(L => {
    const b = el('button', L.k === zkTab ? 'on' : '', L.name + (lists ? ` ${countGot(L.k)}/${lists[L.k].m.length}` : ''));
    b.onclick = () => { zkTab = L.k; renderZukan(); };
    tabs.appendChild(b);
  });
  const fb = $('zkF100'); fb.innerHTML = '';
  if (lists) {
    const S = lists[zkTab], got = gotOf(zkTab);
    S.m.forEach((x, i) => fb.appendChild(el('span', got[i] ? 'got' : '', (got[i] ? '✓' : '') + (x.no ? x.no + '.' : '') + x.name)));
    $('zkNote').textContent = zkTab === 'y100' ? '※Wikipediaの一覧表をもとに番号順に並べています。'
      : (S.base ? `※Wikidataの登録分に${lists[S.base].name}を足して数えています（${S.m.length}座）。` : (S.m.length !== 100 ? `※Wikidataでは${S.m.length}項目あります。` : '')) + '北から順に並べています。';
  } else { fb.textContent = listsErr || '名山リストを読み込み中…'; $('zkNote').textContent = ''; }
  // 見つけた山の一覧
  document.querySelectorAll('#zk .sort button').forEach(b => b.classList.toggle('on', b.dataset.s === zkSort));
  const sorted = all.slice().sort((a, b) => zkSort === 'far' ? b.dm - a.dm : zkSort === 'high' ? b.h - a.h : zkSort === 'rare' ? b.r - a.r || b.dm - a.dm : b.t2 - a.t2);
  const box = $('zkList'); box.innerHTML = '';
  sorted.forEach(v => {
    const row = el('div', 'row', ''), tags = listTags(v), pl = Object.keys(v.pl || {});
    row.appendChild(el('div', 'nm' + (v.f ? ' f' : ''), v.n + (tags ? `（${tags}）` : '')));
    row.appendChild(el('div', 'sub', `${stars(v.r)}　標高${v.h.toLocaleString()}m・見つけた回数 ${v.c}回・いちばん遠くから ${km(v.dm)}`));
    row.appendChild(el('div', 'sub', `初めて：${ymdhm(v.t1)}（${km(v.d)}）`));
    if (pl.length) row.appendChild(el('div', 'sub', `見た場所：${pl.join('・')}（${pl.length}か所）`));
    row.onclick = () => { // タップで説明を開く・閉じる
      const open = row.querySelector('.wkbox');
      if (open) { open.remove(); return; }
      const wb = el('div', 'wkbox', ''); row.appendChild(wb); wikiBox(v, wb);
    };
    box.appendChild(row);
  });
}
async function openZukan() {
  $('zk').style.display = 'block'; renderZukan();
  if (!lists) {
    try { await loadLists(); listsErr = ''; const b = checkBadges(); if (b.length) toast(b.map(x => '🏅' + x).join('　'), 4500); }
    catch (e) { listsErr = '名山リストを読み込めませんでした（' + errText(e, WAIT) + '）。開き直すと再度読み込みます'; }
    renderZukan();
  }
}
