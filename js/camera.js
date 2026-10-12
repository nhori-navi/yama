// YamaMiru：カメラ表示（背面カメラの映像に山並みの線と山名を重ねる）
// quest.js のあと、main.js の前に読み込む
// 保存：yama_cam {zoom:大きさの補正（倍）, tilt:上下の補正（度）}。左右の補正は今までの「補正」（yama_offset）と共通
const CAM_STORE = 'yama_cam';
const CAM_LONG_FOV = 66;      // カメラの長い辺に写る角度（度）の目安。機種ごとの違いは「＋」「−」で合わせる
const CAM_MAX_MS = 180000;    // 3分で自動で止める
let cam = null;               // 動いている間だけ {stream, raf, timer, wasSync, ux, uy, vz, sun, moon, sunT, drag}
let camSet = loadJson(CAM_STORE, {});
camSet.zoom = camSet.zoom || 1; camSet.tilt = camSet.tilt || 0;
const saveCam = () => saveJson(CAM_STORE, camSet);
// 画面1ピクセルあたりの大きさ（F：画面の中心から1ラジアン先までのピクセル数）
function camF() {
  const v = $('camV'), W = v.clientWidth, Hh = v.clientHeight, vw = v.videoWidth || 720, vh = v.videoHeight || 1280;
  const s = Math.max(W / vw, Hh / vh); // 映像は画面いっぱいに拡大して、はみ出たところは切れる
  return Math.max(vw, vh) / 2 / Math.tan(CAM_LONG_FOV / 2 * Math.PI / 180) * s * camSet.zoom;
}
// 向きセンサーから、上下の傾きと左右の傾きを取る（方位は main.js の head を使う）
// 立てて持つと gamma が +90°と−90°の間で飛ぶので、角度ではなく「上向きの成分」をならしてから使う
function camOri(e) {
  if (!cam || e.beta == null) return;
  const r = Math.PI / 180, cB = Math.cos(e.beta * r), sB = Math.sin(e.beta * r), cG = Math.cos((e.gamma || 0) * r), sG = Math.sin((e.gamma || 0) * r);
  const ux = -cB * sG, uy = sB, vz = -cB * cG; // 画面の横・縦方向とカメラの向きの、真上向きの成分
  if (cam.ux == null) { cam.ux = ux; cam.uy = uy; cam.vz = vz; return; }
  cam.ux = cam.ux * 0.8 + ux * 0.2; cam.uy = cam.uy * 0.8 + uy * 0.2; cam.vz = cam.vz * 0.8 + vz * 0.2;
}
const camEvt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';

// ---------- 開く・閉じる ----------
async function camOpen() {
  if (!prof) { toast('計算が終わってから使ってください'); return; }
  if (preview) { toast('予習中はカメラ表示は使えません。「現在地に戻る」を押してください', 3500); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('この端末・ブラウザではカメラが使えません', 3500); return; }
  $('cam').style.display = 'block'; $('camMsg').textContent = 'カメラを準備中…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}}, audio:false});
    cam = {stream, wasSync:sync, ux:null, uy:null, vz:null, sunT:0, drag:null};
    $('camV').srcObject = stream;
    await $('camV').play().catch(() => {});
    window.addEventListener(camEvt, camOri);
    setSync(true); // 向きに合わせる（中央の線で「見つける」も動く）
    cam.timer = setTimeout(() => { camClose(); toast('3分たったのでカメラを止めました（もう一度押すと再開）', 4000); }, CAM_MAX_MS);
    $('camMsg').textContent = '';
    cam.raf = requestAnimationFrame(camDraw);
  } catch (e) {
    $('camMsg').textContent = e.name === 'NotAllowedError' ? 'カメラの使用が許可されていません。ブラウザの設定でこのサイトのカメラを「許可」にしてください'
      : 'カメラを開けませんでした（' + (e.message || e.name) + '）';
    if (cam) camClose(true);
  }
}
function camClose(keepMsg) {
  if (cam) {
    cancelAnimationFrame(cam.raf); clearTimeout(cam.timer);
    cam.stream.getTracks().forEach(t => t.stop());
    window.removeEventListener(camEvt, camOri);
    setSync(cam.wasSync);
    cam = null;
  }
  $('camV').srcObject = null;
  if (!keepMsg) $('cam').style.display = 'none';
}
document.addEventListener('visibilitychange', () => { if (document.hidden && cam) camClose(); }); // ほかのアプリに切りかえたら止める

// ---------- 描く ----------
// 方位 az・高さ alt（度）の点が、画面のどこに来るか（カメラの向き h・e は度、F はピクセル）。後ろなら null
function camProj(az, alt, h, e, F) {
  const r = Math.PI / 180, ca = Math.cos(alt * r), d = [ca * Math.sin(az * r), ca * Math.cos(az * r), Math.sin(alt * r)];
  const sh = Math.sin(h * r), ch = Math.cos(h * r), se = Math.sin(e * r), ce = Math.cos(e * r);
  const Z = d[0] * ce * sh + d[1] * ce * ch + d[2] * se;           // 前
  if (Z < 0.05) return null;
  const X = d[0] * ch - d[1] * sh;                                   // 右
  const Y = -d[0] * se * sh - d[1] * se * ch + d[2] * ce;            // 上
  return [X / Z * F, -Y / Z * F];
}
function camDraw() {
  if (!cam) return;
  cam.raf = requestAnimationFrame(camDraw);
  const c = $('camC'), W = c.clientWidth, Hh = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(Hh * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
  // 表示の上の帯：補正の値・中央の照準・お知らせ（もとの画面の表示を写す）
  const tst = $('toast');
  $('camToast').style.display = tst.style.display; $('camToast').textContent = tst.textContent;
  $('camAim').textContent = $('aim').textContent;
  $('camInfo').textContent = head == null ? '方位センサーを待っています…（この端末では使えないことがあります）'
    : `${dirName(head)} ${Math.round(head)}°　補正 ${offset > 0 ? '+' : ''}${offset.toFixed(1)}°・上下 ${camSet.tilt > 0 ? '+' : ''}${camSet.tilt.toFixed(1)}°・画角 ${Math.round(2 * Math.atan(W / 2 / camF()) * 180 / Math.PI)}°`;
  if (screen.orientation && screen.orientation.angle) { $('camMsg').textContent = 'スマホを縦向きにしてください'; return; }
  if (head == null || cam.ux == null) return;
  const r = Math.PI / 180;
  const e = Math.asin(Math.max(-1, Math.min(1, cam.vz))) / r + camSet.tilt; // カメラの上下の向き（水平が0°）
  const roll = Math.atan2(cam.ux, cam.uy);                                  // 左右の傾き
  $('camMsg').textContent = Math.abs(e) > 60 ? 'スマホを立てて、山のほうに向けてください' : '';
  if (Math.abs(e) > 60) return;
  const F = camF(), h = head, half = Math.atan(Math.hypot(W, Hh) / 2 / F) / r + 2; // 画面に入る範囲（度）
  g.save(); g.translate(W / 2, Hh / 2); g.rotate(roll);
  // 山並みの線（いちばん遠くまで見た稜線）
  const far = prof[prof.length - 1], N = far.length, pts = [];
  for (let a = -half; a <= half; a += STEP) {
    const az = norm360(h + a), f = az / STEP, i = Math.floor(f) % N, w = f - Math.floor(f);
    const p = camProj(az, far[i] * (1 - w) + far[(i + 1) % N] * w, h, e, F);
    if (p) pts.push(p);
  }
  g.lineJoin = 'round';
  [['rgba(0,0,0,0.55)', 5], ['#fff', 2]].forEach(([col, lw]) => {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.stroke();
  });
  // 太陽と月（いまの位置。2秒ごとに計算し直す）
  if (AST && astroOn()) {
    const now = Date.now();
    if (now - cam.sunT > 2000) { const ob = observer(); cam.sun = bodyPos(AST.Body.Sun, now, ob); cam.moon = bodyPos(AST.Body.Moon, now, ob); cam.sunT = now; }
    [[cam.sun, '#ffb347', '☀ 太陽'], [cam.moon, '#f7ecbf', '☾ 月']].forEach(([b, col, name]) => {
      const p = b && b.alt > -2 && camProj(b.az, b.alt, h, e, F);
      if (!p) return;
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], 12, 0, 7); g.stroke();
      g.font = 'bold 13px sans-serif'; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.strokeText(name, p[0] + 15, p[1] + 4); g.fillStyle = col; g.fillText(name, p[0] + 15, p[1] + 4);
    });
  }
  // 山の名前
  const now = Date.now();
  g.textAlign = 'center';
  labels.forEach((l, k) => {
    if (Math.abs(norm180(l.az - h)) > half) return;
    const p = camProj(l.az, l.a, h, e, F); if (!p) return;
    const zk = zkKey(l), flash = zk === flashK && now < flashUntil, got = !!zukan.peaks[zk], sel = k === selIdx;
    const col = flash ? GOLD : sel ? '#ff6b5b' : l.f100 ? '#ffcf8a' : '#fff';
    const top = p[1] - 46;
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(p[0], top + 6); g.lineTo(p[0], p[1] - 4); g.stroke();
    g.strokeStyle = col; g.lineWidth = flash || sel ? 2 : 1; g.beginPath(); g.moveTo(p[0], top + 6); g.lineTo(p[0], p[1] - 4); g.stroke();
    g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], l.f100 ? 3.5 : 2.5, 0, 7); g.fill();
    const t1 = (got ? '● ' : '') + l.name, t2 = `${Math.round(l.d / 1000)}km`;
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.font = (l.f100 || flash || sel ? 'bold ' : '') + '14px sans-serif'; g.strokeText(t1, p[0], top - 10); g.fillText(t1, p[0], top - 10);
    g.font = '11px sans-serif'; g.strokeText(t2, p[0], top + 3); g.fillText(t2, p[0], top + 3);
  });
  g.restore();
  $('camLine').style.background = aim ? GOLD : '#c0392b';
}

// ---------- 手で合わせる ----------
// 画面をなぞる：左右は「補正」、上下は「上下の補正」。指を離したら保存
const camPane = $('camC');
camPane.addEventListener('pointerdown', ev => { if (cam) { cam.drag = {x:ev.clientX, y:ev.clientY, off:offset, tilt:camSet.tilt}; camPane.setPointerCapture(ev.pointerId); } });
camPane.addEventListener('pointermove', ev => {
  if (!cam || !cam.drag) return;
  const F = camF(), d = cam.drag;
  offset = Math.round((d.off - Math.atan((ev.clientX - d.x) / F) * 180 / Math.PI) * 10) / 10;
  camSet.tilt = Math.round((d.tilt + Math.atan((ev.clientY - d.y) / F) * 180 / Math.PI) * 10) / 10;
});
const camDragEnd = () => {
  if (!cam || !cam.drag) return;
  cam.drag = null; saveCam(); showOffset();
  try { localStorage.setItem('yama_offset', String(offset)); } catch (e) {}
};
camPane.addEventListener('pointerup', camDragEnd);
camPane.addEventListener('pointercancel', camDragEnd);
function camZoom(k) { camSet.zoom = Math.round(Math.min(3, Math.max(0.4, camSet.zoom * k)) * 100) / 100; saveCam(); }
$('camBtn').onclick = camOpen;
$('camClose').onclick = () => camClose();
$('camIn').onclick = () => camZoom(1.05);
$('camOut').onclick = () => camZoom(1 / 1.05);
$('camReset').onclick = () => {
  if (!confirm('カメラ表示の合わせ（大きさ・上下）を最初の状態に戻します。左右の補正はそのままです。よろしいですか？')) return;
  camSet.zoom = 1; camSet.tilt = 0; saveCam();
};
