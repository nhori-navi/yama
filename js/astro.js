// YamaMiru：太陽と月・ダイヤモンド富士探し
// ---------- 太陽と月 ----------
const AST = window.Astronomy || null;  // 天体計算の部品（読み込めなかったときは null）
const SUN_R = 0.267, MOON_R = 0.26;    // 見かけの半径（度）
const HIT_DEG = 0.4;                   // 山頂に重なったとみなす横のずれ（度）
const WEEK = '日月火水木金土';
let astroDate = null, astroCache = null, searchId = 0;
const pad2 = n => String(n).padStart(2, '0');
const dateStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hm = d => `${d.getHours()}:${pad2(d.getMinutes())}`;
const mdw = d => `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;
const norm180 = a => ((a % 360) + 540) % 360 - 180;
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const astroOn = () => !!AST && $('astroOn').checked;
const observer = () => new AST.Observer(obs[1], obs[0], curH0);
// 太陽・月の方位と高さ（大気による光の曲がりを含む見かけの高さ）
function bodyPos(body, t, ob) {
  const e = AST.Equator(body, new Date(t), ob, true, true), h = AST.Horizon(new Date(t), ob, e.ra, e.dec, 'normal');
  return {az:h.azimuth, alt:h.altitude};
}
// その方位の山並みの高さ（いちばん遠い山まで含めた見かけの角度）
function ridgeAt(az) {
  const far = prof[prof.length - 1], N = far.length, f = norm360(az) / STEP, i = Math.floor(f) % N, w = f - Math.floor(f);
  return far[i] * (1 - w) + far[(i + 1) % N] * w;
}
// t0〜t1 の間で g(t) の正負が入れかわる時刻を、半分ずつ絞り込んで探す
function bisect(g, t0, t1, n) {
  let g0 = g(t0);
  for (let k = 0; k < n; k++) {
    const tm = (t0 + t1) / 2, gm = g(tm);
    if ((gm > 0) === (g0 > 0)) { t0 = tm; g0 = gm; } else t1 = tm;
  }
  return (t0 + t1) / 2;
}
// 選んだ日の太陽・月の通り道と、山並みから出る・隠れる時刻（地点・日付ごとに1回だけ計算）
function astroDay() {
  if (!AST || !prof || !obs || !astroDate) return null;
  const key = obsKey() + '|' + dateStr(astroDate) + '|' + Math.round(curH0);
  if (astroCache && astroCache.key === key) return astroCache;
  const ob = observer(), t0 = astroDate.getTime(), res = {key};
  [['sun', AST.Body.Sun, SUN_R], ['moon', AST.Body.Moon, MOON_R]].forEach(([k, body, rad]) => {
    const pts = [];
    for (let m = 0; m <= 1440; m += 2) { const t = t0 + m * 60000; pts.push({t, ...bodyPos(body, t, ob)}); }
    // 上の縁が山並みより上なら「見えている」
    const gv = p => p.alt + rad - ridgeAt(p.az), g = t => gv(bodyPos(body, t, ob));
    let rise = null, set = null;
    for (let i = 1; i < pts.length; i++) {
      const ga = gv(pts[i - 1]), gb = gv(pts[i]);
      if (ga <= 0 && gb > 0 && rise === null) rise = bisect(g, pts[i - 1].t, pts[i].t, 10);
      if (ga > 0 && gb <= 0) set = bisect(g, pts[i - 1].t, pts[i].t, 10);
    }
    const ev = t => t === null ? null : {t, ...bodyPos(body, t, ob)};
    res[k] = {pts, rise:ev(rise), set:ev(set)};
  });
  const noon = new Date(t0 + 12 * 3600000);
  res.age = AST.MoonPhase(noon) / 360 * 29.53;  // 月齢（おおよそ）
  astroCache = res;
  return res;
}
// その方位の近くにある、見えている山の名前
function nearPeak(az) {
  let best = null, bd = 1.5;
  allVis.forEach(v => { const d = Math.abs(norm180(v.az - az)); if (d < bd) { bd = d; best = v; } });
  return best ? `（${best.name}付近）` : '';
}
function showAstro() {
  const el = $('astro');
  if (!AST) { el.textContent = '太陽と月：計算用の部品を読み込めませんでした（電波のよい所で開き直してください）'; return; }
  if (!astroOn() || !prof) { el.textContent = ''; return; }
  const r = astroDay(); if (!r) return;
  const ev = (e, w) => `${w} ${e ? hm(new Date(e.t)) + nearPeak(e.az) : 'なし'}`;
  el.textContent = `${mdw(astroDate)}　☀${ev(r.sun.rise, '日の出')}・${ev(r.sun.set, '日の入り')}　☾${ev(r.moon.rise, '月の出')}・${ev(r.moon.set, '月の入り')}・月齢${r.age.toFixed(1)}`;
}
function setAstroDate(d) {
  astroDate = d; $('dIn').value = dateStr(d);
  draw(); showAstro();
}
// パノラマに太陽・月の通り道を描く
function drawAstro(g, yRaw, W, plotBot, lo, hi) {
  const r = astroDay(); if (!r) return;
  g.save();
  g.beginPath(); g.rect(0, TOP - 6, W, plotBot - TOP + 6); g.clip();
  const t0 = astroDate.getTime();
  [['moon', '#b8960c', r.moon], ['sun', '#e67e22', r.sun]].forEach(([k, col, b]) => {
    const pts = b.pts;
    [-360, 0, 360].forEach(s => {
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i];
        if (Math.abs(q.az - p.az) > 180) continue;                       // 北をまたぐところはつながない
        if ((p.alt < lo - 1 && q.alt < lo - 1) || (p.alt > hi + 1 && q.alt > hi + 1)) continue;
        const x1 = xOf(p.az + s), x2 = xOf(q.az + s);
        if (Math.max(x1, x2) < 0 || Math.min(x1, x2) > W) continue;
        const vis = (p.alt + q.alt) / 2 > ridgeAt((p.az + q.az) / 2);
        g.strokeStyle = col; g.globalAlpha = vis ? 1 : 0.45; g.lineWidth = vis ? 2 : 1; g.setLineDash(vis ? [] : [3, 3]);
        g.beginPath(); g.moveTo(x1, yRaw(p.alt)); g.lineTo(x2, yRaw(q.alt)); g.stroke();
      }
      g.setLineDash([]); g.globalAlpha = 1; g.fillStyle = col; g.textAlign = 'left';
      pts.forEach(p => { // 10分ごとの点、20分ごとの時刻
        const m = Math.round((p.t - t0) / 60000);
        if (m % 10) return;
        const x = xOf(p.az + s), y = yRaw(p.alt);
        if (x < -20 || x > W + 20 || y < TOP - 6 || y > plotBot) return;
        g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill();
        if (m % 20 === 0) { g.font = '10px sans-serif'; g.fillText(hm(new Date(p.t)), x + 4, y - 4); }
      });
      [b.rise, b.set].forEach(e => { // 山並みから出る・隠れる位置
        if (!e) return;
        const x = xOf(e.az + s), y = yRaw(e.alt);
        if (x < -20 || x > W + 20) return;
        g.strokeStyle = col; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke();
        g.font = 'bold 12px sans-serif'; g.fillText(hm(new Date(e.t)), x + 7, y + 14);
      });
    });
  });
  if (dateStr(astroDate) === dateStr(new Date())) { // いまの位置
    const ob = observer(), now = Date.now();
    [['☾', '#b8960c', AST.Body.Moon], ['☀', '#e67e22', AST.Body.Sun]].forEach(([mark, col, body]) => {
      const p = bodyPos(body, now, ob), y = yRaw(p.alt);
      if (y < TOP - 6 || y > plotBot) return;
      [-360, 0, 360].forEach(s => {
        const x = xOf(p.az + s);
        if (x < -20 || x > W + 20) return;
        g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.stroke();
        g.font = 'bold 11px sans-serif'; g.fillText('いま', x + 8, y - 6);
      });
    });
  }
  g.restore();
}
// この山の山頂に、太陽・月が重なる日をこの先1年分さがす
async function searchHits(l) {
  const id = ++searchId, key = obsKey(), box = $('hits');
  const ob = observer(), start = today0().getTime(), hits = [];
  let near = null; // 太陽がいちばん近づく日（重ならないとき用）
  const bodies = [['太陽', AST.Body.Sun], ['月', AST.Body.Moon]];
  for (let day = 0; day < 366; day++) {
    if (id !== searchId || key !== obsKey()) return;
    if (day % 8 === 0) { box.textContent = `${l.name}に太陽・月が重なる日を探しています… ${Math.round(day / 366 * 100)}%`; await tick(); }
    const t0 = start + day * 86400000;
    for (const [bn, body] of bodies) {
      const g = t => bodyPos(body, t, ob).alt - l.a; // 中心が山頂の高さに来たか
      let tp = t0, gp = g(tp);
      for (let m = 30; m <= 1440; m += 30) {
        const t = t0 + m * 60000, gt = g(t);
        if ((gp > 0) !== (gt > 0)) {
          const tc = bisect(g, tp, t, 12), off = norm180(bodyPos(body, tc, ob).az - l.az);
          if (bn === '太陽' && (!near || Math.abs(off) < Math.abs(near.off))) near = {t:tc, off};
          if (Math.abs(off) <= HIT_DEG) {
            const h = {bn, t:tc, rising:gt > gp, off};
            if (bn === '月') {
              h.illum = AST.Illumination(AST.Body.Moon, new Date(tc)).phase_fraction;
              h.bright = bodyPos(AST.Body.Sun, tc, ob).alt > -4; // 空が明るい時間
            }
            hits.push(h);
          }
        }
        tp = t; gp = gt;
      }
    }
  }
  if (id !== searchId) return;
  box.innerHTML = '';
  const head = document.createElement('div'); head.className = 'head';
  if (hits.length) head.textContent = `${l.name}の山頂に重なる日（この先1年）。タップするとその日の通り道を表示します`;
  else {
    head.textContent = `この先1年で、太陽・月が${l.name}の山頂に重なる日は見つかりませんでした。`;
    if (near && Math.abs(near.off) < 3) head.textContent += `太陽がいちばん近づくのは${mdw(new Date(near.t))} ${hm(new Date(near.t))}（山頂の${near.off > 0 ? '右' : '左'}${Math.abs(near.off).toFixed(1)}°）です。`;
    else head.textContent += 'この山の方角には、一年を通して太陽が昇り沈みしません。';
  }
  box.appendChild(head);
  hits.forEach(h => {
    const d = new Date(h.t), row = document.createElement('div'); row.className = 'hit';
    const io = h.rising ? '出' : '入り';
    const kind = h.bn === '太陽' ? `☀ ダイヤモンド（日の${io}）` : `☾ ${h.illum >= 0.9 ? 'パール' : '月'}（月の${io}）`;
    const off = Math.abs(h.off) < 0.1 ? 'ほぼ山頂' : `山頂の${h.off > 0 ? '右' : '左'}${Math.abs(h.off).toFixed(1)}°`;
    let note = '';
    if (h.bn === '月') note = `・月の明るさ${Math.round(h.illum * 100)}%` + (h.illum < 0.1 ? '（新月前後で見えません）' : '') + (h.bright ? '・空が明るい時間' : '');
    row.textContent = `${d.getFullYear()}年${mdw(d)} ${hm(d)}　${kind}　${off}${note}`;
    row.onclick = () => { setSync(false); setAstroDate(new Date(d.getFullYear(), d.getMonth(), d.getDate())); scrollToAz(l.az); };
    box.appendChild(row);
  });
}
