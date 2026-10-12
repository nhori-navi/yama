// YamaMiru：星空（山並みの上の星座・明るい星・月・惑星と、山並みから昇る・沈む時刻）
// 星座と星のデータは SoraMiru の constellations.js（CONSTEL）・data.js（STARS）を読み込んで使う
// astro.js・zukan.js のあと、main.js の前に読み込む
const SKY_OK = !!AST && typeof CONSTEL !== 'undefined' && typeof STARS !== 'undefined'; // 読み込めなかったら星空は出さない
const SKY_HI = 50;      // 描く高さの上限（度）
const SKY_SPAN = 960;   // 時刻を選べる幅（分）：選んだ日の16時から翌朝8時まで
const SKY_STEP = 5;     // 昇る・沈むを探す刻み（分）
const SKY_TOP = 14;     // 星空の図の上の余白（px）
const PLANETS = [['Venus', '金星', '#fff3c4'], ['Mars', '火星', '#ff8a65'], ['Jupiter', '木星', '#ffe2a8'], ['Saturn', '土星', '#e9d9a6']];
let skyMode = false, skyMin = 300, skyFollow = false, skyCache = null, skyListKey = '', skyHits = [], skyRaf = 0;
const skyOn = () => SKY_OK && skyMode && !!prof;
const skyBase = () => new Date(astroDate.getFullYear(), astroDate.getMonth(), astroDate.getDate(), 16).getTime(); // 選んだ日の16時
const skyTime = () => skyBase() + skyMin * 60000;
// 星の位置（2000年の赤経・赤緯）を向きの矢印にしておく。時刻ごとの回転で方位・高さに変える（地軸のずれも含む）
const skyVec = (ra, dec) => AST.VectorFromSphere(new AST.Spherical(dec, ra * 15, 1), new Date());
const SKY_LINES = SKY_OK ? CONSTEL.map(c => c[6].map(l => { const v = []; for (let i = 0; i < l.length; i += 2) v.push(skyVec(l[i], l[i + 1])); return v; })) : [];
const SKY_NAMEV = SKY_OK ? CONSTEL.map(c => skyVec(c[5][0], c[5][1])) : [];
const SKY_STARV = SKY_OK ? STARS.map(s => skyVec(s[1], s[2])) : [];
const skyRot = t => AST.Rotation_EQJ_HOR(new Date(t), observer());
function skyHor(m, v) { const s = AST.HorizonFromVector(AST.RotateVector(m, v), 'normal'); return {az:norm360(s.lon), alt:s.lat}; }
// 太陽の高さで空の色を変える（昼→夕焼け→薄明→夜）
const SKY_COLS = [[5, '#6fa3d8', '#cfe2f3'], [0, '#3d5f8f', '#e9b48a'], [-6, '#1a2a4d', '#4a5577'], [-12, '#0b1530', '#1b2848'], [-18, '#050a18', '#0e1730']];
function mixHex(a, b, w) {
  const p = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => pad2(Math.round(v + (B[i] - v) * w).toString(16))).join('');
}
function skyCols(sa) {
  if (sa >= SKY_COLS[0][0]) return SKY_COLS[0].slice(1);
  for (let i = 1; i < SKY_COLS.length; i++) {
    const [a0, t0, b0] = SKY_COLS[i - 1], [a1, t1, b1] = SKY_COLS[i];
    if (sa >= a1) { const w = (a0 - sa) / (a0 - a1); return [mixHex(t0, t1, w), mixHex(b0, b1, w)]; }
  }
  return SKY_COLS[SKY_COLS.length - 1].slice(1);
}
function skyState(sa) {
  return sa > 0 ? '昼間（星は見えません）' : sa > -6 ? '夕方・明け方の明るい空' : sa > -12 ? '空が暗くなりかけ（明るい星だけ）' : sa > -18 ? 'ほぼ暗い空' : '暗い夜空';
}
// 月の形（phase：0新月・180満月）。光っている側を右（満ちていく）／左（欠けていく）で描く
function drawMoon(g, x, y, r, phase) {
  const k = Math.cos(phase * Math.PI / 180), right = phase < 180, P = Math.PI / 2;
  g.fillStyle = 'rgba(120,125,140,0.55)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = '#f7ecbf'; g.beginPath();
  g.arc(x, y, r, -P, P, !right);
  g.ellipse(x, y, Math.max(0.01, r * Math.abs(k)), r, 0, P, -P, right === (k > 0));
  g.fill();
}

// ---------- 星空の図 ----------
function drawSky() {
  const W = Math.round((360 + OFF * 2) * PXD), c = $('pano'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const N = prof[0].length, offN = Math.round(OFF / STEP), far = prof[prof.length - 1];
  let lo = Infinity; far.forEach(v => { if (v < lo) lo = v; });
  lo = Math.min(-1, lo) - 0.5;
  const plotBot = SKY_TOP + Math.round((SKY_HI - lo) * PXD), Hs = plotBot + AXIS; // 縦も横と同じ1度＝PXDピクセル（実際の見え方と同じ比率）
  c.width = W * dpr; c.height = Hs * dpr; c.style.width = W + 'px'; c.style.height = Hs + 'px';
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const yA = a => plotBot - (a - lo) * PXD;
  const t = skyTime(), ob = observer(), sa = bodyPos(AST.Body.Sun, t, ob).alt, night = sa < 0;
  const [cTop, cBot] = skyCols(sa), grad = g.createLinearGradient(0, 0, 0, plotBot);
  grad.addColorStop(0, cTop); grad.addColorStop(1, cBot);
  g.fillStyle = grad; g.fillRect(0, 0, W, Hs);
  const fade = sa > 0 ? 0.3 : sa > -6 ? 0.55 : sa > -12 ? 0.8 : 1; // 空が明るいほど星をうすく
  const wrap = (az, f) => [-360, 0, 360].forEach(s => { const x = xOf(az + s); if (x > -60 && x < W + 60) f(x); });
  skyHits = [];
  g.save(); g.beginPath(); g.rect(0, 0, W, plotBot); g.clip();
  // 高さの目盛り（10°ごと）と地平線（0°）
  g.lineWidth = 1; g.font = '10px sans-serif'; g.textAlign = 'left';
  for (let a = 0; a <= SKY_HI; a += 10) {
    const y = yA(a);
    g.strokeStyle = a ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.35)'; g.setLineDash(a ? [] : [4, 4]);
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    for (let az = -OFF; az <= 360 + OFF; az += 45) g.fillText(a ? a + '°' : '地平線 0°', xOf(az) + 3, y - 3);
  }
  g.setLineDash([]);
  const m = skyRot(t);
  // 星座の線
  g.globalAlpha = fade; g.strokeStyle = 'rgba(130,175,255,0.6)'; g.fillStyle = 'rgba(235,240,255,0.9)'; g.lineWidth = 1.2;
  SKY_LINES.forEach(ls => ls.forEach(vs => {
    const ps = vs.map(v => skyHor(m, v));
    for (let i = 1; i < ps.length; i++) {
      const p = ps[i - 1], q = ps[i], qa = p.az + norm180(q.az - p.az); // 北をまたいでもつなぐ
      if (Math.max(p.alt, q.alt) < lo - 2 || Math.min(p.alt, q.alt) > SKY_HI + 5) continue;
      wrap(p.az, x => { g.beginPath(); g.moveTo(x, yA(p.alt)); g.lineTo(x + (qa - p.az) * PXD, yA(q.alt)); g.stroke(); });
    }
    ps.forEach(p => { if (p.alt > lo - 1 && p.alt < SKY_HI + 2) wrap(p.az, x => { g.beginPath(); g.arc(x, yA(p.alt), 1.4, 0, 7); g.fill(); }); });
  }));
  // 星座の名前
  g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#9fc4ff';
  CONSTEL.forEach((cn, i) => {
    const p = skyHor(m, SKY_NAMEV[i]);
    if (p.alt < lo || p.alt > SKY_HI) return;
    wrap(p.az, x => { g.fillText(cn[1], x, yA(p.alt)); skyHits.push({x, y:yA(p.alt) - 4, kind:'c', i, az:p.az, alt:p.alt}); });
  });
  // 明るい星（等級が小さいほど大きく）
  g.textAlign = 'left'; g.font = '11px sans-serif';
  STARS.forEach((s, i) => {
    const p = skyHor(m, SKY_STARV[i]);
    if (p.alt < lo - 1 || p.alt > SKY_HI + 1) return;
    const r = Math.max(1.6, 3.4 - s[3] * 0.8);
    wrap(p.az, x => {
      const y = yA(p.alt);
      g.fillStyle = 'rgba(255,250,225,0.25)'; g.beginPath(); g.arc(x, y, r + 2.5, 0, 7); g.fill();
      g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = '#ffeeb0'; g.fillText(s[0], x + r + 3, y + 4);
      skyHits.push({x, y, kind:'s', i, az:p.az, alt:p.alt});
    });
  });
  // 惑星
  g.globalAlpha = Math.max(fade, 0.6);
  PLANETS.forEach(([b, name, col], i) => {
    const p = bodyPos(AST.Body[b], t, ob);
    if (p.alt < lo - 1 || p.alt > SKY_HI + 1) return;
    wrap(p.az, x => {
      const y = yA(p.alt);
      g.fillStyle = col; g.beginPath(); g.arc(x, y, 3.6, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 6, 0, 7); g.stroke();
      g.font = 'bold 12px sans-serif'; g.fillText(name, x + 8, y + 4);
      skyHits.push({x, y, kind:'p', i, az:p.az, alt:p.alt});
    });
  });
  g.globalAlpha = 1;
  // 月と太陽
  const mp = bodyPos(AST.Body.Moon, t, ob), phase = AST.MoonPhase(new Date(t));
  if (mp.alt > lo - 1 && mp.alt < SKY_HI + 1) wrap(mp.az, x => {
    const y = yA(mp.alt);
    drawMoon(g, x, y, 8, phase);
    g.fillStyle = '#f7ecbf'; g.font = 'bold 12px sans-serif'; g.fillText('月', x + 11, y + 4);
    skyHits.push({x, y, kind:'m', az:mp.az, alt:mp.alt});
  });
  const sp = bodyPos(AST.Body.Sun, t, ob);
  if (sp.alt > lo - 1) wrap(sp.az, x => { g.fillStyle = '#ffb347'; g.beginPath(); g.arc(x, yA(sp.alt), 9, 0, 7); g.fill(); });
  g.restore();
  // 山並み（黒いシルエット。星より手前にあるので、山に隠れる星は見えなくなる）
  const ncol = night ? ['#06080c', '#0c1017', '#121822', '#1a2230'] : COLS, y = a => yA(Math.max(lo, a));
  for (let b = BANDS.length - 1; b >= 0; b--) {
    const arr = prof[b];
    g.beginPath(); g.moveTo(0, plotBot);
    for (let k = -offN; k <= N + offN; k++) g.lineTo(xOf(k * STEP), y(arr[((k % N) + N) % N]));
    g.lineTo(W, plotBot); g.closePath();
    g.fillStyle = ncol[b]; g.fill();
  }
  // 方位の目盛り
  g.fillStyle = night ? '#10141c' : '#fff'; g.fillRect(0, plotBot, W, AXIS);
  g.textAlign = 'center';
  for (let az = -OFF; az <= 360 + OFF; az += 5) {
    const x = xOf(az), a = norm360(az);
    g.fillStyle = night ? '#cfd8e6' : '#333'; g.fillRect(x, plotBot, 1, a % 45 === 0 ? 8 : 4);
    if (a % 45 === 0) { g.font = 'bold 13px sans-serif'; g.fillText(DIR8[a / 45], x, plotBot + 19); }
    else if (a % 15 === 0) { g.font = '11px sans-serif'; g.fillStyle = '#8a94a6'; g.fillText(a + '°', x, plotBot + 18); }
  }
  // 山の名前（山頂の上に小さく縦書き）
  const now = Date.now();
  labels.forEach((l, k) => {
    const sel = k === selIdx, name = l.name.length > 7 ? l.name.slice(0, 7) : l.name, py = y(l.a);
    const zk = zkKey(l), flash = zk === flashK && now < flashUntil, got = !!zukan.peaks[zk];
    const col = flash ? GOLD : sel ? '#ff6b5b' : l.f100 ? (night ? '#e8b27a' : '#8b4513') : (night ? 'rgba(225,232,245,0.85)' : '#222');
    wrap(l.az, x => {
      hits.push({x, k});
      g.fillStyle = col; g.font = (flash || sel || l.f100 ? 'bold ' : '') + '11px sans-serif';
      for (let i = 0; i < name.length; i++) g.fillText(name[i], x, py - 8 - (name.length - 1 - i) * 12);
      g.beginPath(); g.arc(x, py, l.f100 ? 2.5 : 1.8, 0, 7); g.fill();
      if (got) { g.fillStyle = GOLD; g.beginPath(); g.arc(x + 7, py - 8 - name.length * 12, 2.5, 0, 7); g.fill(); }
    });
  });
  skyList();
}

// ---------- 今夜、山並みから昇る・沈む星 ----------
// 選んだ夜（16時〜翌8時）のあいだ、5分ごとに高さを調べて、山並みの高さと入れかわる時刻を探す
function skyEvents() {
  const key = obsKey() + '|' + dateStr(astroDate) + '|' + Math.round(curH0);
  if (skyCache && skyCache.key === key) return skyCache;
  const ob = observer(), base = skyBase(), n = SKY_SPAN / SKY_STEP, ts = [], mats = [], sun = [];
  for (let k = 0; k <= n; k++) { const t = base + k * SKY_STEP * 60000; ts.push(t); mats.push(skyRot(t)); sun.push(bodyPos(AST.Body.Sun, t, ob).alt); }
  const objs = [];
  CONSTEL.forEach((c, i) => objs.push({name:c[1], kind:'c', i, pos:(t, k) => skyHor(k == null ? skyRot(t) : mats[k], SKY_NAMEV[i])}));
  STARS.forEach((s, i) => { if (s[3] <= 1.0 || s[0] === 'すばる') objs.push({name:s[0], kind:'s', i, pos:(t, k) => skyHor(k == null ? skyRot(t) : mats[k], SKY_STARV[i])}); });
  objs.push({name:'月', kind:'m', rad:MOON_R, pos:t => bodyPos(AST.Body.Moon, t, ob)});
  PLANETS.forEach(([b, name], i) => objs.push({name, kind:'p', i, pos:t => bodyPos(AST.Body[b], t, ob)}));
  const ev = [];
  objs.forEach(o => {
    const gv = p => p.alt + (o.rad || 0) - ridgeAt(p.az), gt = t => gv(o.pos(t));
    let prev = gv(o.pos(ts[0], 0));
    for (let k = 1; k <= n; k++) {
      const cur = gv(o.pos(ts[k], k));
      if ((prev > 0) !== (cur > 0)) {
        const tc = bisect(gt, ts[k - 1], ts[k], 8), p = o.pos(tc);
        if (bodyPos(AST.Body.Sun, tc, ob).alt < -6) ev.push({t:tc, name:o.name, kind:o.kind, i:o.i, rise:cur > 0, az:p.az}); // 空が暗い時間だけ
      }
      prev = cur;
    }
  });
  ev.sort((a, b) => a.t - b.t);
  // 暗くなる・明るくなる時刻（太陽が地平線の下12°）
  let darkS = null, darkE = null;
  const gs = t => bodyPos(AST.Body.Sun, t, ob).alt + 12;
  for (let k = 1; k <= n; k++) {
    if (sun[k - 1] + 12 > 0 && sun[k] + 12 <= 0 && darkS === null) darkS = bisect(gs, ts[k - 1], ts[k], 8);
    if (sun[k - 1] + 12 <= 0 && sun[k] + 12 > 0) darkE = bisect(gs, ts[k - 1], ts[k], 8);
  }
  skyCache = {key, ev, darkS, darkE};
  return skyCache;
}
// 時刻の表示（翌日なら「翌」をつける）
const skyHm = t => (new Date(t).getDate() !== astroDate.getDate() ? '翌' : '') + hm(new Date(t));
const skyIcon = k => ({c:'✨', s:'⭐', m:'☾', p:'🪐'})[k];
function skyList() {
  const box = $('skyList'), r = skyEvents(), key = r.key + '|' + allVis.length, t = skyTime();
  if (key !== skyListKey) {
    skyListKey = key; box.innerHTML = '';
    const dark = r.darkS || r.darkE ? `（暗い時間 ${r.darkS ? skyHm(r.darkS) : '—'}〜${r.darkE ? skyHm(r.darkE) : '—'}）` : '';
    box.appendChild(mkEl('div', 'head', `${mdw(astroDate)}の夜、山並みから昇る・沈む星${dark}。タップするとその時刻の星空を表示します`));
    if (!r.ev.length) box.appendChild(mkEl('div', 'head', 'この夜、暗い時間に山並みから昇る・沈む星はありません'));
    r.ev.forEach(e => {
      const row = mkEl('div', 'ev', `${skyHm(e.t)}　${skyIcon(e.kind)} ${e.name}が${e.rise ? '昇る' : '沈む'}　${dirName(e.az)}${nearPeak(e.az)}`);
      row.dataset.t = e.t;
      row.onclick = () => { skyFollow = false; skyMin = Math.round((e.t - skyBase()) / 60000); setSync(false); skyUi(); draw(); scrollToAz(e.az); };
      box.appendChild(row);
    });
    box.querySelectorAll('.ev').forEach(row => row.classList.toggle('past', Number(row.dataset.t) < t - 60000));
    const next = box.querySelector('.ev:not(.past)'); // これから起きるものが上に見えるようにする
    if (next) box.scrollTop = next.offsetTop - box.offsetTop - 30;
    return;
  }
  box.querySelectorAll('.ev').forEach(row => row.classList.toggle('past', Number(row.dataset.t) < t - 60000));
}
function skyUi() {
  $('skyBtn').classList.toggle('on', skyMode);
  $('skyBox').style.display = $('skyList').style.display = skyMode ? 'block' : 'none';
  if (!skyMode) return;
  $('skyT').value = skyMin;
  const t = skyTime(), sa = obs ? bodyPos(AST.Body.Sun, t, observer()).alt : 0;
  $('skyTime').textContent = `🌌 ${mdw(astroDate)}の夜　${skyHm(t)}　${obs ? skyState(sa) : ''}${skyFollow ? '（いまの空）' : ''}`;
}
// いまの空にする（昼間なら21時）
function skyGoNow(fromBtn) {
  const now = Date.now(), d = new Date();
  if (obs && bodyPos(AST.Body.Sun, now, observer()).alt < 0) {
    const day = d.getHours() < 12 ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1) : today0(); // 夜中・明け方は前の日の夜
    const m = Math.round((now - (day.getTime() + 16 * 3600000)) / 60000);
    if (m >= 0 && m <= SKY_SPAN) {
      if (dateStr(day) !== dateStr(astroDate)) setAstroDate(day);
      skyFollow = true; skyMin = m; skyUi(); draw(); return;
    }
  }
  if (dateStr(astroDate) !== dateStr(today0())) setAstroDate(today0());
  skyFollow = false; skyMin = 300; skyUi(); draw();
  if (fromBtn) toast('いまは昼間なので、今夜21時の星空を表示します', 3000);
}
// 星空の図で星座・星・月・惑星をタップしたとき
function skyTap(e) {
  const rc = $('pano').getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
  let best = null, bd = 22;
  skyHits.forEach(h => { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } });
  if (!best) return false;
  let txt;
  if (best.kind === 'c') { const c = CONSTEL[best.i]; txt = `✨ ${c[1]}（${c[2]}の星座・見つけやすさ${'★'.repeat(c[3])}）${c[4]}`; }
  else if (best.kind === 's') { const s = STARS[best.i]; txt = `⭐ ${s[0]}（${s[3]}等級）${s[4]}`; }
  else if (best.kind === 'p') txt = `🪐 ${PLANETS[best.i][1]}`;
  else { const t = skyTime(); txt = `☾ 月（月齢${(AST.MoonPhase(new Date(t)) / 360 * 29.53).toFixed(1)}・明るさ${Math.round(AST.Illumination(AST.Body.Moon, new Date(t)).phase_fraction * 100)}%）`; }
  txt += `　${dirName(best.az)}（方位${Math.round(best.az)}°）・高さ${best.alt.toFixed(1)}°`;
  const name = best.kind === 'c' ? CONSTEL[best.i][1] : best.kind === 's' ? STARS[best.i][0] : best.kind === 'p' ? PLANETS[best.i][1] : '月';
  const evs = skyEvents().ev.filter(v => v.name === name).map(v => `${skyHm(v.t)} ${v.rise ? '昇る' : '沈む'}（${dirName(v.az)}${nearPeak(v.az)}）`);
  if (evs.length) txt += `　この夜：${evs.join('・')}`;
  searchId++; $('hits').textContent = '';
  selIdx = -1; draw();
  $('info').textContent = txt; setData('sel', []);
  return true;
}
// ---------- ボタンとスライダー ----------
if (SKY_OK) $('skyBtn').style.display = '';
$('skyBtn').onclick = () => {
  skyMode = !skyMode; skyUi();
  if (skyMode) { if (dateStr(astroDate) === dateStr(today0())) skyGoNow(false); else { skyFollow = false; skyMin = 300; skyUi(); draw(); } }
  else { skyUi(); draw(); $('info').textContent = '山名をタップすると詳細が出ます'; }
};
$('skyT').oninput = () => {
  skyMin = Number($('skyT').value); skyFollow = false; skyUi();
  cancelAnimationFrame(skyRaf); skyRaf = requestAnimationFrame(() => draw()); // 動かしている間は1コマに1回だけ描く
};
$('skyNow').onclick = () => skyGoNow(true);
// 日付を変えたときは「いまの空」をやめて、時刻の表示を直す
const setAstroDateBase = setAstroDate;
setAstroDate = function (d) { skyFollow = false; setAstroDateBase(d); skyUi(); };
// 「いまの空」のときは1分ごとに進める
setInterval(() => {
  if (!skyOn() || !skyFollow) return;
  const m = Math.round((Date.now() - skyBase()) / 60000);
  if (m < 0 || m > SKY_SPAN) { skyFollow = false; skyUi(); return; }
  skyMin = m; skyUi(); draw();
}, 60000);
