// YamaMiru：夜のカメラ表示（星座・明るい星・惑星・月を重ねる）と「⭐ 星で合わせる」
// stars.js・camera.js・skyline.js のあと、main.js の前に読み込む
// 太陽が地平線の下6°より低いときだけ星を描く。山並みより下の星は描かない
const CS_CAL_MAX = 20, CS_CAL_MIN_EL = 5, CS_CAL_MAX_EL = 65, CS_CAL_MAX_DAZ = 30; // 合わせに使う天体：照準から20°以内、高さ5〜65°
let csSky = null, csUndo = null; // csSky：最後に計算した星の位置（5秒ごとに計算し直す）
const csNight = () => !!(csSky && csSky.night);
let camMaxEl = () => csNight() ? 82 : 60; // 夜は頭の上近くまで見られる（camera.js が使う）
// 星・星座・惑星・月の方位と高さ（重いので5秒ごと）
function csCalc() {
  const now = Date.now();
  if (csSky && now - csSky.t < 5000 && csSky.key === obsKey()) return csSky;
  const ob = observer(), sun = bodyPos(AST.Body.Sun, now, ob), out = {t:now, key:obsKey(), night:sun.alt < -6, lines:[], names:[], stars:[], planets:[], moon:null};
  if (out.night) {
    if (SKY_OK) {
      const m = skyRot(now);
      SKY_LINES.forEach(ls => out.lines.push(ls.map(vs => vs.map(v => skyHor(m, v)))));
      CONSTEL.forEach((c, i) => out.names.push({name:c[1], ...skyHor(m, SKY_NAMEV[i])}));
      STARS.forEach((s, i) => out.stars.push({name:s[0], mag:s[3], ...skyHor(m, SKY_STARV[i])}));
    }
    PLANETS.forEach(([b, name, col]) => out.planets.push({name, col, ...bodyPos(AST.Body[b], now, ob)}));
    out.moon = {name:'月', ...bodyPos(AST.Body.Moon, now, ob), phase:AST.MoonPhase(new Date(now))};
  }
  return (csSky = out);
}
const csUp = p => p.alt > ridgeAt(p.az) - 0.2; // 山並みより上に出ているか
// いまのカメラの向き（camera.js と同じ計算）
function csView() {
  const c = $('camC'), W = c.clientWidth, Hh = c.clientHeight, r = Math.PI / 180;
  return {W, Hh, h:head, e:Math.asin(Math.max(-1, Math.min(1, cam.vz))) / r + camSet.tilt, roll:Math.atan2(cam.ux, cam.uy), F:camF()};
}
// カメラの画面に星を重ねる（camera.js・skyline.js の描画のあとに描く）
const camDrawBase2 = camDraw;
camDraw = function () {
  camDrawBase2();
  if (!cam || !AST || !prof || head == null || cam.ux == null) return;
  const sky = csCalc();
  $('fitBtn').style.display = sky.night ? 'none' : ''; // 夜は空と山の境目が見えないので、自動で合わせるは隠す
  $('starCalBtn').style.display = sky.night ? '' : 'none';
  if (!sky.night) return;
  const v = csView();
  if (Math.abs(v.e) > camMaxEl()) return;
  const c = $('camC'), g = c.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const P = p => camProj(p.az, p.alt, v.h, v.e, v.F), lim = Math.hypot(v.W, v.Hh) / 2 + 40;
  const inView = q => q && Math.abs(q[0]) < lim && Math.abs(q[1]) < lim;
  g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.translate(v.W / 2, v.Hh / 2); g.rotate(v.roll);
  // 星座の線と、線の角の星
  g.strokeStyle = 'rgba(150,185,255,0.75)'; g.fillStyle = 'rgba(230,238,255,0.95)'; g.lineWidth = 1.4;
  sky.lines.forEach(ls => ls.forEach(ps => {
    const qs = ps.map(p => (csUp(p) ? P(p) : null));
    for (let i = 1; i < qs.length; i++) {
      const a = qs[i - 1], b = qs[i];
      if (!a || !b || !(inView(a) || inView(b))) continue;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    qs.forEach(q => { if (inView(q)) { g.beginPath(); g.arc(q[0], q[1], 1.6, 0, 7); g.fill(); } });
  }));
  const label = (txt, x, y, col, font) => {
    g.font = font; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y);
  };
  // 星座の名前
  g.textAlign = 'center';
  sky.names.forEach(n => { if (!csUp(n)) return; const q = P(n); if (inView(q)) label(n.name, q[0], q[1], '#a9cbff', '13px sans-serif'); });
  // 明るい星（等級が小さいほど大きく）
  g.textAlign = 'left';
  sky.stars.forEach(s => {
    if (!csUp(s)) return;
    const q = P(s); if (!inView(q)) return;
    const r = Math.max(1.8, 3.6 - s.mag * 0.8);
    g.fillStyle = 'rgba(255,250,225,0.3)'; g.beginPath(); g.arc(q[0], q[1], r + 3, 0, 7); g.fill();
    g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill();
    label(s.name, q[0] + r + 4, q[1] + 4, '#ffeeb0', '12px sans-serif');
  });
  // 惑星と月
  sky.planets.forEach(p => {
    if (!csUp(p)) return;
    const q = P(p); if (!inView(q)) return;
    g.fillStyle = p.col; g.beginPath(); g.arc(q[0], q[1], 4, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.stroke();
    label(p.name, q[0] + 10, q[1] + 4, p.col, 'bold 13px sans-serif');
  });
  if (sky.moon && csUp(sky.moon)) {
    const q = P(sky.moon);
    if (inView(q)) { drawMoon(g, q[0], q[1], 11, sky.moon.phase); label('月', q[0] + 15, q[1] + 5, '#f7ecbf', 'bold 13px sans-serif'); }
  }
  g.restore();
  // 画面の中央の照準（星で合わせるときに、ここへ天体を入れる）
  g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.strokeStyle = 'rgba(255,214,90,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(v.W / 2, v.Hh / 2, 16, 0, 7); g.stroke();
  g.restore();
};
// ---------- ⭐ 星で合わせる ----------
// 中央の照準に本物の月・惑星・明るい星を入れて押すと、計算の位置とのずれを補正に足す
function csAngSep(az1, el1, az2, el2) {
  const r = Math.PI / 180, c = Math.sin(el1 * r) * Math.sin(el2 * r) + Math.cos(el1 * r) * Math.cos(el2 * r) * Math.cos((az1 - az2) * r);
  return Math.acos(Math.max(-1, Math.min(1, c))) / r;
}
function csShow(msg, undo) {
  const box = $('starCalBox'); box.innerHTML = ''; box.style.display = msg ? 'block' : 'none';
  if (!msg) return;
  box.appendChild(mkEl('div', '', msg));
  if (undo) { const b = mkEl('button', '', '元に戻す'); b.onclick = csUndoDo; box.appendChild(b); }
  const x = mkEl('button', '', '閉じる'); x.onclick = () => csShow(''); box.appendChild(x);
}
function csCalibrate() {
  if (!cam || head == null || cam.ux == null) { csShow('向きセンサーの準備ができてから押してください'); return; }
  const sky = csCalc(), v = csView();
  if (!sky.night) { csShow('暗くなってから使えます。明るいうちは「🎯 自動で合わせる」か、画面をなぞって合わせてください'); return; }
  const cand = [sky.moon, ...sky.planets, ...sky.stars.filter(s => s.mag <= 1.5)]
    .filter(s => s && s.alt >= CS_CAL_MIN_EL && s.alt <= CS_CAL_MAX_EL && csUp(s));
  let best = null;
  cand.forEach(s => { const d = csAngSep(v.h, v.e, s.az, s.alt); if (d <= CS_CAL_MAX && (!best || d < best.d)) best = {s, d}; });
  if (!best) {
    csShow(v.e > CS_CAL_MAX_EL ? `真上に近すぎます。高さ${CS_CAL_MAX_EL}°より低い月・惑星・明るい星で合わせてください`
      : `照準の近く（${CS_CAL_MAX}°以内）に、合わせに使える天体がありません。月・惑星・明るい星（1等星くらいまで）を黄色の輪に入れてください`);
    return;
  }
  const s = best.s, dAz = norm180(s.az - v.h), dEl = s.alt - v.e, sg = x => (x >= 0 ? '＋' : '−') + Math.abs(x).toFixed(1);
  if (Math.abs(dAz) > CS_CAL_MAX_DAZ) { csShow(`${s.name}とのずれが大きすぎます（左右${sg(dAz)}°）。輪に入れ直してから押してください`); return; }
  csUndo = {offset, tilt:camSet.tilt};
  offset = Math.round((offset + dAz) * 10) / 10;
  camSet.tilt = Math.round((camSet.tilt + dEl) * 10) / 10;
  saveCam(); showOffset();
  try { localStorage.setItem('yama_offset', String(offset)); } catch (e) {}
  csShow(`${s.name}で合わせました：左右 ${sg(dAz)}°・上下 ${sg(dEl)}° 直しました`, true);
}
function csUndoDo() {
  if (!csUndo) return;
  offset = csUndo.offset; camSet.tilt = csUndo.tilt; csUndo = null;
  saveCam(); showOffset();
  try { localStorage.setItem('yama_offset', String(offset)); } catch (e) {}
  csShow('元に戻しました');
}
$('starCalBtn').onclick = csCalibrate;
// カメラを閉じたら結果の表示も消す
const camCloseBase2 = camClose;
camClose = function (keepMsg) { csShow(''); csSky = null; camCloseBase2(keepMsg); };
