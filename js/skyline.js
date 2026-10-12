// YamaMiru：スカイラインによる自動補正（実験）
// カメラの映像から「空と山の境目」を探し、計算した山並みの線と左右・上下にずらして比べて、いちばん重なる位置を探す
// camera.js のあと、main.js の前に読み込む
const FIT_W = 200;              // 調べるときの画像の横幅（ピクセル。小さくして速くする）
const FIT_DX = 10, FIT_DY = 5;  // 探す範囲（度）：左右±10°、上下±5°
const FIT_OK = 50;              // この一致度（%）未満なら反映しない
let fitRes = null;              // 調べた結果（「この補正を使う」まで保存）

// ---------- 境目らしさと照合（画面に関係しない計算だけ） ----------
// px：RGBAの配列（w×h）、pred[x]：計算の山並みの高さ（上からのピクセル。なければ NaN）
// 返り値：{dx, dy（ピクセル）, confX・confY（左右・上下の一致度 0〜100）, flat（形の特徴が少ない）, edge（境目の強さ）}
function fitSkyline(px, w, h, pred, maxDx, maxDy) {
  // 各列について、上下の明るさ・青さの差（上が明るく青いほど「空と山の境目」らしい）を作る
  const L = new Float32Array(w * h), B = new Float32Array(w * h), bad = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    L[i] = 0.3 * r + 0.59 * g + 0.11 * b; B[i] = b - r; bad[i] = px[i * 4 + 3] < 250 ? 1 : 0; // 回したときにできた空白は使わない
  }
  const WIN = 3, D = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = WIN; y < h - WIN; y++) {
      let la = 0, lb = 0, ba = 0, bb = 0, ng = 0;
      for (let k = 1; k <= WIN; k++) {
        const a = (y - k) * w + x, c = (y + k) * w + x;
        la += L[a]; lb += L[c]; ba += B[a]; bb += B[c]; ng += bad[a] + bad[c];
      }
      if (ng) continue;
      const v = ((la - lb) + 0.7 * (ba - bb)) / WIN;
      D[y * w + x] = v > 0 ? Math.min(v, 60) : 0; // 強すぎる境目1か所に引っぱられないよう上限をつける
    }
  }
  // 計算の線をずらしながら、線の上の「境目らしさ」の平均を点数にする
  const cols = [];
  for (let x = 0; x < w; x++) if (!isNaN(pred[x])) cols.push(x);
  const nx = 2 * maxDx + 1, ny = 2 * maxDy + 1, S = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const dx = i - maxDx, dy = j - maxDy;
    let s = 0, n = 0;
    for (const x of cols) {
      const xx = x + dx; if (xx < 0 || xx >= w) continue;
      const y = Math.round(pred[x] + dy); if (y < WIN || y >= h - WIN) continue;
      s += Math.max(D[y * w + xx], 0.5 * Math.max(D[(y - 1) * w + xx], D[(y + 1) * w + xx])); n++;
    }
    S[j * nx + i] = n > cols.length * 0.5 ? s / n : 0;
  }
  let bi = 0;
  for (let k = 1; k < S.length; k++) if (S[k] > S[bi]) bi = k;
  const best = S[bi], bx = bi % nx, by = Math.floor(bi / nx);
  const sorted = Array.from(S).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
  const ys = cols.map(x => pred[x]), mean = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);
  const sd = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / (ys.length || 1)), flat = sd < 2.5;
  // 左右・上下それぞれについて、離れた位置でも同じくらいよく重なるなら「決めきれない」
  let secX = 0, secY = 0;
  for (let k = 0; k < S.length; k++) {
    const i = k % nx, j = Math.floor(k / nx);
    if (Math.abs(i - bx) > 6 && S[k] > secX) secX = S[k];
    if (Math.abs(j - by) > 4 && S[k] > secY) secY = S[k];
  }
  const contrast = best > 0 ? Math.min(1, (best - med) / best * 1.25) : 0;
  const cf = sec => best > 0 ? Math.round(100 * contrast * Math.min(1, (1 - sec / best) / 0.25)) : 0;
  let confX = flat ? 0 : cf(secX), confY = cf(secY);
  if (best < 6 || cols.length < w * 0.3) confX = confY = 0; // 境目がほとんど見えない・線が画面にあまり入っていない
  return {dx:bx - maxDx, dy:by - maxDy, confX, confY, flat, edge:best};
}

// ---------- カメラの映像で調べる ----------
function fitAuto() {
  const v = $('camV');
  if (!cam || head == null || cam.ux == null || v.readyState < 2) { toast('カメラと向きセンサーの準備ができてから押してください'); return; }
  const W = v.clientWidth, Hh = v.clientHeight, vw = v.videoWidth, vh = v.videoHeight, s = Math.max(W / vw, Hh / vh);
  const k = FIT_W / W, w = FIT_W, h = Math.round(Hh * k), r = Math.PI / 180;
  // 押した瞬間の向き（あとで反映するときは「ずれの量」だけを使うので、そのあと向きが変わっても大丈夫）
  const e = Math.asin(Math.max(-1, Math.min(1, cam.vz))) / r + camSet.tilt, roll = Math.atan2(cam.ux, cam.uy), hd = head, F = camF(), Fa = F * k;
  // 映像を、傾きを戻した向きで小さく写す（画面に見えている範囲と同じ）
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', {willReadFrequently:true});
  g.translate(w / 2, h / 2); g.scale(k, k); g.rotate(-roll); g.translate(-W / 2, -Hh / 2);
  g.drawImage(v, (W - vw * s) / 2, (Hh - vh * s) / 2, vw * s, vh * s);
  const px = g.getImageData(0, 0, w, h).data;
  // 計算の山並みの線を、同じ小さな画像の上の位置にする
  const far = prof[prof.length - 1], N = far.length, half = Math.atan(w / 2 / Fa) / r + FIT_DX + 1, pts = [];
  for (let a = -half; a <= half; a += STEP / 2) {
    const az = norm360(hd + a), f = az / STEP, i = Math.floor(f) % N, ww = f - Math.floor(f);
    const p = camProj(az, far[i] * (1 - ww) + far[(i + 1) % N] * ww, hd, e, Fa);
    if (p) pts.push([p[0] + w / 2, p[1] + h / 2]);
  }
  const pred = new Float32Array(w).fill(NaN);
  for (let q = 1; q < pts.length; q++) {
    const [x0, y0] = pts[q - 1], [x1, y1] = pts[q];
    for (let x = Math.ceil(Math.min(x0, x1)); x <= Math.floor(Math.max(x0, x1)) && x < w; x++) if (x >= 0 && x1 !== x0) pred[x] = y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  const maxDx = Math.round(Math.tan(FIT_DX * r) * Fa), maxDy = Math.round(Math.tan(FIT_DY * r) * Fa);
  const res = fitSkyline(px, w, h, pred, maxDx, maxDy);
  // ピクセルのずれを角度に直す（なぞって合わせるときと同じ向き）
  res.useX = res.confX >= FIT_OK && res.confY >= FIT_OK; res.useY = res.confY >= FIT_OK; // 左右だけ確かなことはまずないので、左右は上下も確かなときだけ
  res.conf = res.useX ? Math.min(res.confX, res.confY) : res.confY;
  if (!res.useX) res.dx = 0;
  res.dOff = -Math.atan(res.dx / Fa) / r; res.dTilt = Math.atan(res.dy / Fa) / r;
  res.F = Fa; res.k = k; res.roll = roll; res.pts = pts.map(p => [(p[0] - w / 2) / k + res.dx / k, (p[1] - h / 2) / k + res.dy / k]); // 見つかった位置の線（画面の大きさ）
  fitRes = res;
  fitShow();
}
// 結果の表示（「この補正を使う」「やめる」）
function fitShow() {
  const box = $('fitBox'); box.innerHTML = '';
  if (!fitRes) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  const r = fitRes, lr = Math.abs(r.dOff) < 0.3 ? '' : `${r.dOff < 0 ? '右' : '左'}に${Math.abs(r.dOff).toFixed(1)}°`;
  const ud = Math.abs(r.dTilt) < 0.3 ? '' : `${r.dTilt > 0 ? '下' : '上'}に${Math.abs(r.dTilt).toFixed(1)}°`;
  let msg;
  if (!r.useY) msg = `うまく見つけられませんでした（一致度 ${r.conf}%）。晴れて山の形がくっきり見えるときに、山並みが画面の中ほどに来るように持って、もう一度試してください`;
  else if (!r.useX) msg = `山並みの形に特徴が少ないので、左右は決めきれませんでした。上下だけ${ud ? '線を' + ud + '動かします' : 'このままでよく重なっています'}（一致度 ${r.conf}%）`;
  else msg = (lr || ud ? `線を${[lr, ud].filter(Boolean).join('・')}動かすと、よく重なります` : '今の位置でよく重なっています') + `（一致度 ${r.conf}%）`;
  box.appendChild(mkEl('div', '', msg));
  if (r.useY) {
    const ok = mkEl('button', '', 'この補正を使う');
    ok.onclick = () => {
      if (r.useX) offset = Math.round((offset + r.dOff) * 10) / 10;
      camSet.tilt = Math.round((camSet.tilt + r.dTilt) * 10) / 10;
      saveCam(); showOffset();
      try { localStorage.setItem('yama_offset', String(offset)); } catch (e) {}
      fitRes = null; fitShow(); toast('🎯 自動で合わせました');
    };
    box.appendChild(ok);
  }
  const no = mkEl('button', '', r.useY ? 'やめる' : '閉じる');
  no.onclick = () => { fitRes = null; fitShow(); };
  box.appendChild(no);
}
// 見つかった位置の線を、黄色の点線でカメラの画面に重ねる（camDraw のあとに描く）
const camDrawBase = camDraw;
camDraw = function () {
  camDrawBase();
  if (!cam || !fitRes || !fitRes.useY) return;
  const c = $('camC'), g = c.getContext('2d'), W = c.clientWidth, Hh = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.translate(W / 2, Hh / 2); g.rotate(fitRes.roll);
  g.setLineDash([6, 5]); g.strokeStyle = '#ffd257'; g.lineWidth = 2.5; g.beginPath();
  fitRes.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.stroke(); g.restore();
};
// カメラを閉じたら結果も消す
const camCloseBase = camClose;
camClose = function (keepMsg) { fitRes = null; fitShow(); camCloseBase(keepMsg); };
$('fitBtn').onclick = fitAuto;
