// YamaMiru：パノラマの描画・操作・計算の実行・起動（いちばん最後に読み込む）
// ---------- パノラマ図 ----------
function draw() {
  if (skyOn()) { hits = []; drawSky(); return; } // 星空の表示（stars.js）
  const W = Math.round((360 + OFF * 2) * PXD), c = $('pano'), dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 版15：暗い画面のときは夜の色（空は紺、山は暗い青灰、文字は明るく）
  const DK = document.body.classList.contains('dark');
  const C = DK ? {s0: '#16233a', s1: '#24324a', bands: ['#0d1420', '#1a2536', '#2a374b', '#3c4a60'], axis: '#1c2530', tick: '#cfd8e6', deg: '#8a94a6', name: '#e8eef5', line: '#8d9bb0', f100: '#e8a970', sel: '#ff7b6b'}
               : {s0: '#d8e6f5', s1: '#f6f9fc', bands: COLS, axis: '#fff', tick: '#333', deg: '#999', name: '#222', line: '#555', f100: '#8b4513', sel: '#c0392b'};
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, C.s0); sky.addColorStop(1, C.s1);
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  hits = [];
  if (!prof) return;
  const N = prof[0].length, offN = Math.round(OFF / STEP), far = prof[prof.length - 1];
  let lo = Infinity, hi = -Infinity;
  far.forEach(v => { if (v < lo) lo = v; if (v > hi) hi = v; });
  labels.forEach(l => { if (l.a > hi) hi = l.a; });
  lo -= 0.3; hi += 0.4;
  const plotBot = H - AXIS, yRaw = a => plotBot - (a - lo) / (hi - lo) * (plotBot - TOP), y = a => yRaw(Math.max(lo, a));
  for (let b = BANDS.length - 1; b >= 0; b--) {
    const arr = prof[b];
    g.beginPath(); g.moveTo(0, plotBot);
    for (let k = -offN; k <= N + offN; k++) g.lineTo(xOf(k * STEP), y(arr[((k % N) + N) % N]));
    g.lineTo(W, plotBot); g.closePath();
    g.fillStyle = C.bands[b]; g.fill();
  }
  g.fillStyle = C.axis; g.fillRect(0, plotBot, W, AXIS);
  g.textAlign = 'center';
  for (let az = -OFF; az <= 360 + OFF; az += 5) {
    const x = xOf(az), a = norm360(az);
    g.fillStyle = C.tick; g.fillRect(x, plotBot, 1, a % 45 === 0 ? 8 : 4);
    if (a % 45 === 0) { g.font = 'bold 13px sans-serif'; g.fillText(DIR8[a / 45], x, plotBot + 19); }
    else if (a % 15 === 0) { g.font = '11px sans-serif'; g.fillStyle = C.deg; g.fillText(a + '°', x, plotBot + 18); }
  }
  if (astroOn()) { try { drawAstro(g, yRaw, W, plotBot, lo, hi); } catch (e) { showErr('太陽と月の計算エラー：' + e.message); } }
  g.textAlign = 'center';
  const now = Date.now();
  labels.forEach((l, k) => {
    const sel = k === selIdx, name = l.name.length > 7 ? l.name.slice(0, 7) : l.name, py = y(l.a);
    const zk = zkKey(l), flash = zk === flashK && now < flashUntil, got = !!zukan.peaks[zk];
    const col = flash ? GOLD : sel ? C.sel : (l.f100 ? C.f100 : C.name);
    [-360, 0, 360].forEach(s => {
      const x = xOf(l.az + s);
      if (x < -20 || x > W + 20) return;
      hits.push({x, k});
      g.strokeStyle = flash ? GOLD : sel ? C.sel : (l.f100 ? C.f100 : C.line); g.lineWidth = flash ? 3 : sel || l.f100 ? 2 : 1;
      g.beginPath(); g.moveTo(x, 8 + name.length * 14); g.lineTo(x, py); g.stroke();
      g.fillStyle = col; g.font = (flash || sel || l.f100 ? 'bold ' : '') + '13px sans-serif';
      for (let i = 0; i < name.length; i++) g.fillText(name[i], x, 18 + i * 14);
      g.beginPath(); g.arc(x, py, l.f100 ? 3.5 : 2.5, 0, 7); g.fill();
      if (got) { g.fillStyle = GOLD; g.beginPath(); g.arc(x + 9, 7, 3, 0, 7); g.fill(); } // 見つけた山の印
      if (flash) { g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath(); g.arc(x, py, 9, 0, 7); g.stroke(); }
    });
  });
}
function scrollToAz(az) { $('panoWrap').scrollLeft = xOf(norm360(az)) - $('panoWrap').clientWidth / 2; }
$('pano').onclick = e => {
  if (panMoved) { panMoved = false; return; } // マウスで動かしたあとは選ばない
  if (skyOn() && skyTap(e)) return; // 星空で星座・星をタップしたとき（stars.js）
  const x = e.clientX - $('pano').getBoundingClientRect().left;
  let best = -1, bd = 10;
  hits.forEach(h => { const dd = Math.abs(h.x - x); if (dd < bd) { bd = dd; best = h.k; } });
  if (best !== selIdx) { searchId++; $('hits').textContent = ''; } // 別の山を選んだら探した結果を消す
  selIdx = best; draw(); showInfo();
};
function showInfo() {
  const l = labels[selIdx];
  if (!l) { $('info').textContent = '山名をタップすると詳細が出ます'; setData('sel', []); return; }
  const tags = listTags(l);
  $('info').textContent = `${l.name}${tags ? `（${tags}）` : ''}　レア度${stars(rarity(l.d, l.mg))}　標高${l.h.toLocaleString()}m・${dirName(l.az)}（方位${Math.round(l.az)}°）・${(l.d / 1000).toFixed(1)}km`;
  if (AST) {
    const b = document.createElement('button');
    b.textContent = '☀☾ この山に太陽・月が重なる日を探す';
    b.onclick = () => searchHits(l);
    $('info').appendChild(document.createElement('br')); $('info').appendChild(b);
  }
  const wb = mkEl('div', 'wkbox', ''); $('info').appendChild(wb); wikiBox(l, wb); // Wikipediaの説明
  setData('sel', [{type:'Feature', properties:{}, geometry:{type:'LineString', coordinates:[obs, l.p]}}]);
}

// ---------- スマホの向き ----------
// 背面カメラが向いている方角（立てて持つ）。水平に近いときは上端の向き
function headingFrom(a, b, g) {
  const r = Math.PI / 180, cA = Math.cos(a * r), sA = Math.sin(a * r), cB = Math.cos(b * r), sB = Math.sin(b * r),
    cG = Math.cos(g * r), sG = Math.sin(g * r);
  let vx = -(cG * sA * sB + cA * sG), vy = -(sA * sG - cA * cG * sB);
  const vz = -cB * cG;
  if (vz < -0.8) { vx = -cB * sA; vy = cA * cB; }      // 水平に置いたとき（画面が上）は上端の向き
  else if (vz > 0.8) { vx = cB * sA; vy = -cA * cB; }  // 見上げたときは下端の向き（カメラの向きとそろう）
  return norm360(Math.atan2(vx, vy) / r);
}
// 磁北と真北のずれ（偏角、西向きが正の度）。日本のおおよその値：東京約7.5°、札幌約9°、那覇約5°
const magDecl = p => p ? 7.5 + 0.3 * (p[1] - 36) - 0.05 * (p[0] - 139) : 7.5;
// iPhone：向きセンサーは、ボタンを押したときに許可を求める決まりがある（ほかの端末では何もしない）
let oriPerm = null; // 'asking'（確認中）・'granted'（許可）・'denied'（不許可）
function askOri() {
  const D = window.DeviceOrientationEvent;
  if (!D || typeof D.requestPermission !== 'function' || oriPerm) return;
  oriPerm = 'asking';
  D.requestPermission().then(r => {
    oriPerm = r;
    if (r === 'granted') window.addEventListener('deviceorientation', onOri);
    else showErr('向きセンサーの使用が許可されませんでした。ページを開き直して、もう一度「向きに合わせる」を押し、「許可」を選んでください');
  }).catch(e => { oriPerm = null; showErr('向きセンサーを使えませんでした（' + e.message + '）'); });
}
function onOri(e) {
  let h;
  if (e.webkitCompassHeading != null) h = e.webkitCompassHeading - magDecl(obs); // iPhone は磁北が基準なので真北に直す
  else if (e.alpha != null && (e.type === 'deviceorientationabsolute' || e.absolute)) h = headingFrom(e.alpha, e.beta || 0, e.gamma || 0);
  else return;
  gotOri = true;
  const r = Math.PI / 180;
  sx = sx * 0.8 + Math.sin(h * r) * 0.2; sy = sy * 0.8 + Math.cos(h * r) * 0.2;
  head = norm360(Math.atan2(sx, sy) / r + offset);
}
function loop(now) {
  if (sync && head != null) {
    scrollToAz(head);
    $('dirInfo').textContent = `いま向いている方向：${dirName(head)} ${Math.round(head)}°`;
  }
  checkAim(now || performance.now());
  requestAnimationFrame(loop);
}
function setSync(on) {
  if (on && !sensorOk()) { toast('「向きに合わせる」' + PHONE_ONLY, 4000); return; }
  if (on) askOri(); // iPhone では、ここで向きセンサーの許可を求める
  sync = on;
  $('syncBtn').classList.toggle('on', on);
  $('syncBtn').textContent = on ? '向きに合わせる：ON' : '向きに合わせる';
  $('center').style.display = on ? 'block' : 'none';
  if (!on) $('dirInfo').textContent = '';
  if (on) setTimeout(() => { if (sync && !gotOri && oriPerm !== 'asking') { $('dirInfo').textContent = 'この端末では方位センサーが使えないようです'; } }, 1500);
}
$('syncBtn').onclick = () => setSync(!sync);
['touchstart', 'mousedown', 'wheel'].forEach(ev => $('panoWrap').addEventListener(ev, () => { if (sync) setSync(false); }, {passive:true}));
// パソコン：パノラマをマウスでつかんで左右に動かす・ホイールで左右に動かす
let panDrag = null, panMoved = false;
$('panoWrap').addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) { panDrag = {x:e.clientX, s:$('panoWrap').scrollLeft}; panMoved = false; } });
window.addEventListener('pointermove', e => {
  if (!panDrag) return;
  const dx = e.clientX - panDrag.x;
  if (Math.abs(dx) > 4) panMoved = true;
  if (panMoved) { $('panoWrap').scrollLeft = panDrag.s - dx; $('panoWrap').style.cursor = 'grabbing'; }
});
window.addEventListener('pointerup', () => { panDrag = null; $('panoWrap').style.cursor = ''; });
$('panoWrap').addEventListener('wheel', e => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $('panoWrap').scrollLeft += e.deltaY; e.preventDefault(); }
}, {passive:false});
function showOffset() { $('offVal').textContent = (offset > 0 ? '+' : '') + offset + '°'; }
function changeOffset(d) {
  offset += d; showOffset();
  try { localStorage.setItem('yama_offset', String(offset)); } catch (e) {}
}
$('offMinus').onclick = () => changeOffset(-2);
$('offPlus').onclick = () => changeOffset(2);
showOffset();

// ---------- 実行 ----------
async function run(p, opt = {}) { // opt：{gps:GPSで取った, acc:GPSの誤差m, preview:予習で選んだ山}
  if (running) return;
  summitBefore(opt);
  lowAcc = !!(opt.gps && opt.acc > 1000);
  running = true; obs = p; selIdx = -1; prof = null; labels = []; allVis = []; baseVis = []; extraVis = []; extraFor = null; extraDone = false;
  searchId++; $('hits').textContent = ''; $('astro').textContent = '';
  showErr(''); draw(); showInfo(); placeObs();
  updatePlace(); // 場所スタンプ用の市区町村名を裏側で調べる
  const errs = [];
  let staleRegion = null;
  try {
    const st = loadStore(), reg = coveringRegion(st, obs);
    let listP;
    if (reg) {
      listP = Promise.resolve(st.list);
      if (Date.now() - reg.t > KEEP_DAYS * 86400000) staleRegion = reg;
    } else {
      const center = [+obs[0].toFixed(2), +obs[1].toFixed(2)];
      listP = fetchRegion(center).then(s => s.list).catch(e => { errs.push('Wikidata：' + errText(e, WD_WAIT)); return null; });
    }
    await loadAll(tileList(obs, MAXD, 10).concat(tileList(obs, NEAR + 2000, 12)));
    // 予習では、地形データの高さが山頂より低く出ることがあるので、一覧の標高と高いほうを使う
    curH0 = Math.max(elev(obs, 0), opt.preview ? opt.preview.h || 0 : 0) + Math.max(0, Number($('eye').value) || 0);
    prof = await computeProfile(curH0);
    draw(); showAstro(); // 山並み（と太陽・月）を先に表示
    status(reg ? '山名を判定中…' : 'この地域の山の一覧を取得中…（初回のみ、最大70秒ほど）');
    const list = await listP;
    let els;
    if (list) {
      els = nearList(list); srcName = 'スマホに保存した一覧';
      const r2 = coveringRegion(loadStore(), obs);
      if (r2 && r2.nf) errs.push('百名山の印を取得できませんでした（次回の計算で取り直します）');
    } else { // Wikidataが使えないときは OpenStreetMap で代わりに
      const res = await osmPeaks(obsKey(), '予備の山名');
      els = res ? res.els : []; srcName = els.length ? 'OpenStreetMap' : 'なし';
      if (res && res.lastErr) errs.push('OpenStreetMap：' + res.lastErr);
    }
    if (errs.length) showErr((list || els.length ? '' : '山名を取得できませんでした。少し待って「現在地で計算」を押し直してください　') + errs.join(' ／ '));
    baseVis = await checkPeaks(els, curH0);
    refreshLabels();
    if (labels[0] && !sync) scrollToAz(labels[0].az);
    doneStatus();
    summitAfter(opt); // 山頂にいるかの確認と、ここから見える名山
  } catch (e) { showErr('計算エラー：' + e.message); }
  finally { running = false; }
  if ($('many').checked) addExtra();
  // 裏側で：古くなった地域の取り直し → 百名山の印の取り直し → 名山リストの読み込み
  (staleRegion ? fetchRegion(staleRegion.c).catch(() => {}) : Promise.resolve()).then(retryF100)
    .then(() => loadLists()).then(() => { checkBadges(); }).catch(() => {});
}
// 現在地が分からないときは、地図を日本全体にして、場所を選んでもらう
function askPick(why) {
  pick = true;
  map.jumpTo({center:JAPAN, zoom:4.3});
  status(`${why}地図をタップして、山を見たい場所を選んでください`);
}
function useGps() {
  if (!('geolocation' in navigator)) { askPick('この端末では現在地が使えません。'); return; }
  status('現在地を取得中…');
  navigator.geolocation.getCurrentPosition(
    g => {
      const acc = g.coords.accuracy;
      // パソコンなどは Wi-Fi やインターネットの接続先から推定するので、数km以上ずれることがある
      note = acc > 1000 ? `※現在地の精度が粗いため（誤差 約${(acc / 1000).toFixed(acc < 10000 ? 1 : 0)}km）、場所がずれているかもしれません。「地図で地点を選ぶ」が正確です　` : '';
      run([g.coords.longitude, g.coords.latitude], {gps:true, acc});
    },
    e => { askPick(e.code === 1 ? '位置情報の使用が許可されていません。' : '現在地を取得できませんでした（' + e.message + '）。'); },
    {enableHighAccuracy:true, timeout:20000, maximumAge:60000});
}
$('gpsBtn').onclick = useGps;
$('pickBtn').onclick = () => { pick = true; status('地図上の地点をタップしてください'); };
$('many').onchange = () => { refreshLabels(); doneStatus(); if ($('many').checked && !running) addExtra(); };
$('eye').onchange = () => { if (obs) run(obs, runOpt); };
$('refreshBtn').onclick = () => {
  if (running) return;
  if (!confirm('保存した山の一覧（細かい山も含む）を消して、取り直します。よろしいですか？')) return;
  try { [STORE, OSM_STORE, LIST_STORE, 'yama_peaks_v1'].forEach(k => localStorage.removeItem(k)); } catch (e) {} // 図鑑の記録は消さない
  lists = null;
  showStoreInfo();
  if (obs) run(obs, runOpt);
};
document.querySelectorAll('button[data-az]').forEach(b => b.onclick = () => { setSync(false); scrollToAz(Number(b.dataset.az)); });
// 太陽と月の日付
const shiftDay = n => setAstroDate(new Date(astroDate.getFullYear(), astroDate.getMonth(), astroDate.getDate() + n));
$('dPrev').onclick = () => shiftDay(-1);
$('dNext').onclick = () => shiftDay(1);
$('dToday').onclick = () => setAstroDate(today0());
$('dIn').onchange = () => {
  const v = $('dIn').value.split('-').map(Number);
  if (v.length === 3 && v[0]) setAstroDate(new Date(v[0], v[1] - 1, v[2]));
};
try { if (localStorage.getItem('yama_astro') === '0') $('astroOn').checked = false; } catch (e) {}
$('astroOn').onchange = () => {
  try { localStorage.setItem('yama_astro', $('astroOn').checked ? '1' : '0'); } catch (e) {}
  draw(); showAstro();
};
astroDate = today0(); $('dIn').value = dateStr(astroDate);
// 展望の予習：山名で探す（入力が止まって0.3秒後に探す）
$('peakQ').oninput = () => { clearTimeout(peakTimer); peakTimer = setTimeout(onPeakInput, 300); };
// 図鑑
$('zkBtn').onclick = openZukan;
$('zkClose').onclick = () => { $('zk').style.display = 'none'; };
document.querySelectorAll('#zk .sort button').forEach(b => b.onclick = () => { zkSort = b.dataset.s; renderZukan(); });
// 今日を表示しているときは、1分ごとに「いま」の位置を描き直す
setInterval(() => { if (astroOn() && prof && dateStr(astroDate) === dateStr(new Date())) draw(); }, 60000);
// 向きセンサーと毎フレームの処理を開始（ほかのファイルを全部読み込んだあとで始める）
if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOri);
else window.addEventListener('deviceorientation', onOri);
requestAnimationFrame(loop);
try { localStorage.removeItem('yama_peaks_v1'); localStorage.removeItem('yama_f100_v1'); } catch (e) {} // 前の版の保存データは使わないので消す
saveZukan(); // 前の版の図鑑の記録を新しい形で保存し直す
showStoreInfo();
draw();
useGps();
