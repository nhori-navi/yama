// YamaMiru：山頂モード（登頂スタンプ）・展望の予習（山名で探して山頂から見る）・ここから見える名山
// zukan.js・wiki.js のあと、main.js の前に読み込む
// ---------- 山頂モード ----------
// 図鑑の保存（yama_zukan_v1）に climbs を足す：{キー:{n:名前, h:標高, id:WikidataのID, p:[経度,緯度], f:百名山=1, r:★, d:[登頂した日時]}}
const SUMMIT_M = 100, SUMMIT_ACC = 50, SUMMIT_DH = 60; // 山頂から水平100m以内、GPSの誤差50m以下、山頂との高さの差60m以内
let runOpt = {}, preview = null, summitNow = null;
zukan.climbs = zukan.climbs || {};
// 登頂のレア度（標高で決める）：1000m未満★1、1500m未満★2、2000m未満★3、3000m未満★4、3000m以上★5
const summitStars = h => h >= 3000 ? 5 : h >= 2000 ? 4 : h >= 1500 ? 3 : h >= 1000 ? 2 : 1;
// 現在地からいちばん近い山頂（保存してある山の一覧と、細かい山のマスから探す）
function nearestSummit(p) {
  let best = null, bd = SUMMIT_M;
  const take = (name, lon, lat, h, f, id) => {
    const d = distM(p, [lon, lat]);
    if (d <= bd) { bd = d; best = {name, p:[lon, lat], h:h || 0, f100:f || 0, id:id || '', d}; }
  };
  loadStore().list.forEach(v => take(v[0], v[1], v[2], v[3], v[4], v[5]));
  if (!best) Object.values(loadOsm().tiles).forEach(t => t.l.forEach(v => take(v[0], v[1], v[2], v[3])));
  return best;
}
// GPSで計算したときだけ、山頂にいるかを調べる
function checkSummit(opt) {
  summitNow = null;
  if (!opt.gps || !obs) return;
  const s = nearestSummit(obs);
  if (!s) return;
  if (!(opt.acc <= SUMMIT_ACC)) { // 誤差が大きいときは記録しない
    showErr(`${s.name}の山頂の近くですが、GPSの誤差が大きいため登頂を記録できません（誤差 約${Math.round(opt.acc || 0)}m）。少し待って「現在地で計算」を押し直してください`);
    return;
  }
  const peakH = Math.max(s.h, elev(s.p, s.d)); // 山頂の高さ（一覧の標高と地形データの高いほう）
  if (elev(obs, 0) < peakH - SUMMIT_DH) return;  // 山頂の下を通る道やトンネルは数えない
  summitNow = s;
  recordClimb(s);
}
function recordClimb(s) {
  const k = zkKey(s), now = Date.now(), day = dateStr(new Date()), r = summitStars(s.h);
  let c = zukan.climbs[k], pts = 0, msg;
  if (!c) {
    c = zukan.climbs[k] = {n:s.name, h:s.h, id:s.id, p:s.p, f:s.f100 ? 1 : 0, r, d:[now]};
    pts = r * 30; zukan.score += pts;
    msg = `${s.name} 登頂！`;
  } else if (!c.d.some(t => dateStr(new Date(t)) === day)) { // 同じ日は1回だけ記録
    c.d.push(now); msg = `${s.name} 登頂！（${c.d.length}回目）`;
  } else { toast(`🏔 ${s.name} 山頂（今日は記録済み）`); return; }
  saveZukan();
  const badges = checkBadges();
  if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 200]);
  toast(`🏔 ${msg}　${'★'.repeat(r)}${pts ? ` +${pts}点` : ''}` + badges.map(b => `　🏅${b}`).join(''), 5000);
}
// 登頂のバッジ（図鑑のバッジ一覧に足す）
BADGES.push(
  ['c1', '初登頂', '山頂で「現在地で計算」をして登頂を記録', s => s.cN >= 1],
  ['c5', '5座登頂', '5つの山に登頂', s => s.cN >= 5],
  ['c10', '10座登頂', '10の山に登頂', s => s.cN >= 10],
  ['cf', '百名山に登頂', '日本百名山に登頂', s => s.cF >= 1],
  ['c2k', '2000m峰', '標高2000m以上の山に登頂', s => s.cH >= 2000],
  ['c3k', '3000m峰', '標高3000m以上の山に登頂', s => s.cH >= 3000]
);
const zkStatsBase = zkStats;
zkStats = function () {
  const s = zkStatsBase(), cl = Object.values(zukan.climbs || {});
  s.cN = cl.length;
  s.cF = cl.filter(v => v.f || listsOf(v).includes('f100')).length;
  s.cH = Math.max(0, ...cl.map(v => v.h || 0));
  return s;
};
// 図鑑に「登った山」を足す
const renderZukanBase = renderZukan;
renderZukan = function () {
  renderZukanBase();
  const box = $('zkClimbs'); if (!box) return;
  box.innerHTML = '';
  const cl = Object.values(zukan.climbs || {}).sort((a, b) => b.d[b.d.length - 1] - a.d[a.d.length - 1]);
  if (!cl.length) { box.textContent = 'まだ登った山はありません。山頂で「現在地で計算」を押すと記録されます。'; return; }
  cl.forEach(v => {
    const row = mkEl('div', 'row', ''), tags = listTags(v);
    row.appendChild(mkEl('div', 'nm' + (v.f ? ' f' : ''), `🏔 ${v.n}` + (tags ? `（${tags}）` : '')));
    row.appendChild(mkEl('div', 'sub', `${stars(v.r)}　標高${(v.h || 0).toLocaleString()}m・登頂 ${v.d.length}回`));
    row.appendChild(mkEl('div', 'sub', '登頂した日：' + v.d.map(t => ymd(t)).join('、')));
    row.onclick = () => {
      const open = row.querySelector('.wkbox');
      if (open) { open.remove(); return; }
      const wb = mkEl('div', 'wkbox', ''); row.appendChild(wb); wikiBox(v, wb);
    };
    box.appendChild(row);
  });
};

// ---------- ここから見える名山 ----------
function showViewBox() {
  const box = $('viewBox'); if (!box) return;
  box.innerHTML = '';
  if (summitNow) box.appendChild(mkEl('div', 'top', `🏔 ${summitNow.name} 山頂（${(summitNow.h || 0).toLocaleString()}m）にいます`));
  if (!baseVis.length) return;
  const by = {};
  LISTS.forEach(L => { by[L.k] = []; });
  baseVis.forEach(v => listsOf(v).forEach(k => by[k].push(v)));
  const parts = LISTS.filter(L => by[L.k].length).map(L => `${L.name} ${by[L.k].length}座`);
  if (!parts.length) return;
  const det = document.createElement('details'), sum = mkEl('summary', '', 'ここから見える名山：' + parts.join('・'));
  det.appendChild(sum);
  LISTS.filter(L => by[L.k].length).forEach(L => {
    const names = by[L.k].sort((a, b) => a.d - b.d).map(v => `${v.name}（${(v.d / 1000).toFixed(0)}km）`);
    det.appendChild(mkEl('div', 'sub', `${L.name}：${names.join('、')}`));
  });
  box.appendChild(det);
}

// ---------- 展望の予習（山名で探す） ----------
let peakTimer = 0, peakSeq = 0;
function showPreviewBar() {
  const bar = $('previewBar'); if (!bar) return;
  bar.innerHTML = '';
  if (!preview) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  bar.appendChild(mkEl('span', '', `🔭 ${preview.name}（${(preview.h || 0).toLocaleString()}m）山頂からの眺め（予習）　`));
  const b = mkEl('button', '', '現在地に戻る');
  b.onclick = () => { preview = null; showPreviewBar(); useGps(); };
  bar.appendChild(b);
}
// 保存してある山の一覧から探す
function searchLocal(q) {
  const nq = normName(q), out = [];
  loadStore().list.forEach(v => { if (normName(v[0]).includes(nq)) out.push({name:v[0], p:[v[1], v[2]], h:v[3], f100:v[4], id:v[5]}); });
  return out.sort((a, b) => (normName(b.name) === nq) - (normName(a.name) === nq) || b.f100 - a.f100 || b.h - a.h).slice(0, 8);
}
// Wikidataで名前から探す（保存した一覧にないとき）
async function searchRemote(q) {
  const r = await tfetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=ja&uselang=ja&type=item&limit=15&format=json&origin=*`, {}, 10000);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const hits = (await r.json()).search || [];
  if (!hits.length) return [];
  const r2 = await tfetch(`${WDAPI}&ids=${hits.map(h => h.id).join('|')}&props=claims|labels&languages=ja`, {}, 10000);
  if (!r2.ok) throw new Error('HTTP ' + r2.status);
  const ents = (await r2.json()).entities || {};
  const val = (e, p) => { const c = ((e.claims || {})[p] || [])[0]; return c && c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value; };
  return hits.map(h => {
    const e = ents[h.id] || {}, c = val(e, 'P625'), el = val(e, 'P2044');
    if (!c || c.longitude < 122 || c.longitude > 154 || c.latitude < 20 || c.latitude > 46) return null; // 日本の範囲で位置があるものだけ
    const name = (e.labels && e.labels.ja && e.labels.ja.value) || h.label;
    return {name, p:[+c.longitude.toFixed(4), +c.latitude.toFixed(4)], h:el ? Math.round(parseFloat(el.amount)) : 0, f100:0, id:h.id, desc:h.description || ''};
  }).filter(Boolean).slice(0, 8);
}
function showCandidates(list, note) {
  const box = $('peakList'); box.innerHTML = '';
  if (note) box.appendChild(mkEl('div', 'note', note));
  list.forEach(v => {
    const b = mkEl('button', 'pk', `${v.name}（${v.h ? v.h.toLocaleString() + 'm' : '標高不明'}${v.desc ? '・' + v.desc : ''}）`);
    b.onclick = () => startPreview(v);
    box.appendChild(b);
  });
}
async function onPeakInput() {
  const q = $('peakQ').value.trim(), seq = ++peakSeq;
  if (!q) { $('peakList').innerHTML = ''; return; }
  const local = searchLocal(q);
  showCandidates(local, local.length ? '' : '保存した山の一覧にはありません。Wikidataで探しています…');
  if (local.length >= 3 || q.length < 2) return;
  try {
    const remote = (await searchRemote(q)).filter(v => !local.some(x => x.id && x.id === v.id));
    if (seq !== peakSeq) return;
    const all = local.concat(remote);
    showCandidates(all, all.length ? '' : '見つかりませんでした');
  } catch (e) { if (seq === peakSeq) showCandidates(local, '検索できませんでした（' + errText(e, 10000) + '）'); }
}
function startPreview(v) {
  if (running) { toast('計算中です。終わってから選んでください'); return; }
  preview = v; $('peakList').innerHTML = ''; $('peakQ').value = v.name;
  setSync(false); showPreviewBar();
  run(v.p, {preview:v});
}
// 予習中は「見つける」を動かさない
const checkAimBase = checkAim;
checkAim = function (now) {
  if (preview) { if (aim) { aim = null; $('aim').textContent = ''; $('center').style.background = '#c0392b'; } return; }
  checkAimBase(now);
};
// 計算を始めたとき／終わったときに main.js の run から呼ぶ
function summitBefore(opt) {
  runOpt = opt; summitNow = null;
  if (!opt.preview) preview = null;
  showPreviewBar(); showViewBox();
}
function summitAfter(opt) {
  checkSummit(opt);
  showViewBox();
  loadLists().then(showViewBox).catch(() => {}); // 名山リストを読み込めたら数え直す
}
