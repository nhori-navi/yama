// YamaMiru：パノラマの描画・操作・計算の実行・起動（いちばん最後に読み込む）
// ---------- パノラマ図 ----------
function draw() {
  const W = Math.round((360 + OFF * 2) * PXD), c = $('pano'), dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#d8e6f5'); sky.addColorStop(1, '#f6f9fc');
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
    g.fillStyle = COLS[b]; g.fill();
  }
  g.fillStyle = '#fff'; g.fillRect(0, plotBot, W, AXIS);
  g.textAlign = 'center';
  for (let az = -OFF; az <= 360 + OFF; az += 5) {
    const x = xOf(az), a = norm360(az);
    g.fillStyle = '#333'; g.fillRect(x, plotBot, 1, a % 45 === 0 ? 8 : 4);
    if (a % 45 === 0) { g.font = 'bold 13px sans-serif'; g.fillText(DIR8[a / 45], x, plotBot + 19); }
    else if (a % 15 === 0) { g.font = '11px sans-serif'; g.fillStyle = '#999'; g.fillText(a + '°', x, plotBot + 18); }
  }
  if (astroOn()) { try { drawAstro(g, yRaw, W, plotBot, lo, hi); } catch (e) { showErr('太陽と月の計算エラー：' + e.message); } }
  g.textAlign = 'center';
  const now = Date.now();
  labels.forEach((l, k) => {
    const sel = k === selIdx, name = l.name.length > 7 ? l.name.slice(0, 7) : l.name, py = y(l.a);
    const zk = zkKey(l), flash = zk === flashK && now < flashUntil, got = !!zukan.peaks[zk];
    const col = flash ? GOLD : sel ? '#c0392b' : (l.f100 ? '#8b4513' : '#222');
    [-360, 0, 360].forEach(s => {
      const x = xOf(l.az + s);
      if (x < -20 || x > W + 20) return;
      hits.push({x, k});
      g.strokeStyle = flash ? GOLD : sel ? '#c0392b' : (l.f100 ? '#8b4513' : '#555'); g.lineWidth = flash ? 3 : sel || l.f100 ? 2 : 1;
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
  if (Math.abs(vz) > 0.8) { vx = -cB * sA; vy = cA * cB; }
  return norm360(Math.atan2(vx, vy) / r);
}
function onOri(e) {
  let h;
  if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;
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
  sync = on;
  $('syncBtn').classList.toggle('on', on);
  $('syncBtn').textContent = on ? '向きに合わせる：ON' : '向きに合わせる';
  $('center').style.display = on ? 'block' : 'none';
  if (!on) $('dirInfo').textContent = '';
  if (on) setTimeout(() => { if (sync && !gotOri) { $('dirInfo').textContent = 'この端末では方位センサーが使えないようです'; } }, 1500);
}
$('syncBtn').onclick = () => setSync(!sync);
['touchstart', 'mousedown', 'wheel'].forEach(ev => $('panoWrap').addEventListener(ev, () => { if (sync) setSync(false); }, {passive:true}));
function showOffset() { $('offVal').textContent = (offset > 0 ? '+' : '') + offset + '°'; }
function changeOffset(d) {
  offset += d; showOffset();
  try { localStorage.setItem('yama_offset', String(offset)); } catch (e) {}
}
$('offMinus').onclick = () => changeOffset(-2);
$('offPlus').onclick = () => changeOffset(2);
showOffset();

// ---------- 実行 ----------
async function run(p) {
  if (running) return;
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
    curH0 = elev(obs, 0) + Math.max(0, Number($('eye').value) || 0);
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
  } catch (e) { showErr('計算エラー：' + e.message); }
  finally { running = false; }
  if ($('many').checked) addExtra();
  // 裏側で：古くなった地域の取り直し → 百名山の印の取り直し → 名山リストの読み込み
  (staleRegion ? fetchRegion(staleRegion.c).catch(() => {}) : Promise.resolve()).then(retryF100)
    .then(() => loadLists()).then(() => { checkBadges(); }).catch(() => {});
}
function useGps() {
  if (!('geolocation' in navigator)) { note = '※現在地が使えないため南大沢付近で計算　'; run(DEF); return; }
  status('現在地を取得中…');
  navigator.geolocation.getCurrentPosition(
    g => { note = ''; run([g.coords.longitude, g.coords.latitude]); },
    e => { note = '※現在地が取れないため南大沢付近で計算　'; showErr('位置情報：' + e.message); run(DEF); },
    {enableHighAccuracy:true, timeout:20000, maximumAge:60000});
}
$('gpsBtn').onclick = useGps;
$('pickBtn').onclick = () => { pick = true; status('地図上の地点をタップしてください'); };
$('many').onchange = () => { refreshLabels(); doneStatus(); if ($('many').checked && !running) addExtra(); };
$('eye').onchange = () => { if (obs) run(obs); };
$('refreshBtn').onclick = () => {
  if (running) return;
  if (!confirm('保存した山の一覧（細かい山も含む）を消して、取り直します。よろしいですか？')) return;
  try { [STORE, OSM_STORE, LIST_STORE, 'yama_peaks_v1'].forEach(k => localStorage.removeItem(k)); } catch (e) {} // 図鑑の記録は消さない
  lists = null;
  showStoreInfo();
  if (obs) run(obs);
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
