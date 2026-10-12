// YamaMiru：今日は見える？予報（Open-Meteo）・お気に入り地点・見えた記録とカレンダー
// summit.js・stars.js のあと、quest.js の前に読み込む
// 保存：yama_fav_v1 [{id, name, p:[経度,緯度], peaks:[代表の山], t}]
//       yama_wx_v1  {場所キー:{t:取得日時, day:最初の日付, cl:低い雲, cm:中くらいの雲, pr:雨, vis:見通し, rh:湿度}}（5〜19時だけ、1時間有効）
//       yama_seen_v1 {記録キー:{n:地点名, d:{"日付":{v:見えた1・見えなかった0, fc:そのときの予報0〜3}}}}
const FAV_STORE = 'yama_fav_v1', WX_STORE = 'yama_wx_v1', SEEN_STORE = 'yama_seen_v1';
const FAV_MAX = 5, WX_MIN = 60, WX_H0 = 5, WX_HN = 15; // 予報は60分有効。1日のうち5時から15時間ぶんを保存
const SLOTS = [['朝', 6, 9], ['昼', 11, 14], ['夕', 15, 18]];
const WX_MARK = ['×', '△', '○', '◎'];
const DAY3 = ['今日', '明日', 'あさって'];
let wxBusy = null, wxErr = '', calKey = '', calMonth = null;
function loadJson(k, def) { try { return JSON.parse(localStorage.getItem(k) || 'null') || def; } catch (e) { return def; } }
function saveJson(k, v, what) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { if (what) showErr(what + 'の保存に失敗しました（容量不足の可能性）'); return false; } }
const loadFavs = () => loadJson(FAV_STORE, []);
const locKey = p => p[0].toFixed(2) + ',' + p[1].toFixed(2); // 約1kmの升目でまとめる
const midP = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// ---------- 予報を出す地点 ----------
// 代表の山：名山・遠い山を優先して最大3座（方角が10°以内の山は1つだけ）
function pickTargets(vis) {
  const sc = v => (listsOf(v).length || v.f100 ? 3 : 1) * v.d, out = [];
  vis.slice().sort((a, b) => sc(b) - sc(a)).forEach(v => {
    if (out.length < 3 && !out.some(o => Math.abs(norm180(o.az - v.az)) < 10)) out.push(v);
  });
  return out.map(v => ({name:v.name, p:[+v.p[0].toFixed(4), +v.p[1].toFixed(4)], d:Math.round(v.d), h:v.h, az:Math.round(v.az), id:v.id || '', f100:v.f100 || 0}));
}
// いま計算している地点（予習中は山頂）
function herePoint() {
  if (!obs || !baseVis.length) return null;
  const name = preview ? `${preview.name}山頂（予習中）` : '現在地' + (curPlace ? `（${curPlace}）` : '');
  return {id:'here', here:1, name, p:[+obs[0].toFixed(4), +obs[1].toFixed(4)], peaks:pickTargets(baseVis)};
}
const wxPoints = () => { const h = herePoint(); return (h ? [h] : []).concat(loadFavs()); };
const seenKey = pt => pt.here ? 'p:' + locKey(pt.p) : pt.id;

// ---------- 天気の取得（Open-Meteo） ----------
// 足りない場所・古くなった場所だけまとめて1回で問い合わせる
async function ensureWx(pts) {
  while (wxBusy) await wxBusy; // ほかの問い合わせ中なら終わるのを待ってから、足りない分を調べる
  const st = loadJson(WX_STORE, {}), now = Date.now(), today = dateStr(new Date()), need = new Map();
  const want = p => { const k = locKey(p), v = st[k]; if (!v || now - v.t > WX_MIN * 60000 || v.day !== today) need.set(k, p); };
  pts.forEach(pt => { want(pt.p); pt.peaks.forEach(k => { want(k.p); if (k.d > 50000) want(midP(pt.p, k.p)); }); });
  if (!need.size) return st;
  wxBusy = (async () => {
    const ps = [...need.values()];
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + ps.map(p => p[1].toFixed(2)).join(',') + '&longitude=' + ps.map(p => p[0].toFixed(2)).join(',') +
      '&hourly=cloud_cover_low,cloud_cover_mid,precipitation,visibility,relative_humidity_2m&forecast_days=3&timezone=Asia%2FTokyo';
    const r = await tfetch(url, {}, 15000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let js = await r.json();
    if (!Array.isArray(js)) js = [js];
    js.forEach((j, i) => {
      const hr = j.hourly || {}, tm = hr.time || [], o = {t:now, day:today, cl:[], cm:[], pr:[], vis:[], rh:[]};
      tm.forEach((s, n) => {
        const dd = Math.round((new Date(s.slice(0, 10) + 'T00:00') - new Date(today + 'T00:00')) / 86400000), h = +s.slice(11, 13);
        if (dd < 0 || dd > 2 || h < WX_H0 || h >= WX_H0 + WX_HN) return;
        const x = dd * WX_HN + h - WX_H0, g = a => (a && a[n] != null ? Math.round(a[n]) : null);
        o.cl[x] = g(hr.cloud_cover_low); o.cm[x] = g(hr.cloud_cover_mid); o.pr[x] = hr.precipitation && hr.precipitation[n] != null ? +hr.precipitation[n] : null;
        o.vis[x] = g(hr.visibility); o.rh[x] = g(hr.relative_humidity_2m);
      });
      st[locKey(ps[i])] = o;
    });
    Object.keys(st).forEach(k => { if (now - st[k].t > 6 * 3600000) delete st[k]; }); // 6時間より古いものは消す
    saveJson(WX_STORE, st);
    wxErr = '';
    return st;
  })().catch(e => { wxErr = '天気予報を取得できませんでした（' + errText(e, 15000) + '）'; return st; }).finally(() => { wxBusy = null; });
  return wxBusy;
}
// 1時間ごとの見え方 0×・1△・2○・3◎（データがなければ null）
function hourLevel(o, pk, mid, k, x) {
  if (!o || !pk || pk.cl[x] == null) return null;
  const n = v => v || 0;
  if (Math.max(n(o.pr[x]), n(pk.pr[x])) >= 0.5) return 0;                 // 雨・雪
  let c = Math.max(n(pk.cl[x]), (k.h >= 2500 ? 1 : 0.5) * n(pk.cm[x]));   // 山の場所の雲（高い山は中くらいの雲も）
  if (mid) c = Math.max(c, 0.8 * n(mid.cl[x]));                           // 遠い山は途中の雲も
  c = Math.max(c, 0.6 * n(o.cl[x]));                                      // 足元の霧・低い雲
  let lv = c < 25 ? 3 : c < 50 ? 2 : c < 75 ? 1 : 0;
  const vis = o.vis[x];
  if (vis != null) { if (vis < k.d * 0.3 && vis < 15000) lv = 0; else if (vis < Math.min(k.d, 20000)) lv = Math.max(0, lv - 1); }
  if (k.d > 50000 && n(o.rh[x]) >= 85) lv = Math.max(0, lv - 1);          // 湿っぽい日は遠くがかすむ
  return lv;
}
// 時間帯ごと（その時間帯でいちばんよいとき）。[日][朝昼夕] の表
function peakLevels(st, pt, k) {
  const o = st[locKey(pt.p)], pk = st[locKey(k.p)], mid = k.d > 50000 ? st[locKey(midP(pt.p, k.p))] : null;
  return DAY3.map((_, dd) => SLOTS.map(([, h0, h1]) => {
    let best = null;
    for (let h = h0; h <= h1; h++) { const lv = hourLevel(o, pk, mid, k, dd * WX_HN + h - WX_H0); if (lv != null && (best == null || lv > best)) best = lv; }
    return best;
  }));
}
// いまの時間帯（朝・昼・夕のどれか。時間帯の外なら近いほう）
function curSlot() { const h = new Date().getHours(); return h < 10 ? 0 : h < 15 ? 1 : 2; }
// その地点の今日の見え方（代表の山でいちばんよいもの）。今日のお題の「天気が悪い日」判定にも使う
function pointToday(st, pt) {
  if (!pt || !pt.peaks.length) return null;
  const lv = pt.peaks.map(k => peakLevels(st, pt, k)[0]);
  return SLOTS.map((_, s) => { const v = lv.map(a => a[s]).filter(x => x != null); return v.length ? Math.max(...v) : null; });
}
// 今日これからの時間帯がすべて×なら true（データがないときは false）
function badToday(st, pt) {
  const t = pointToday(st, pt); if (!t) return false;
  const rest = t.slice(curSlot()).filter(v => v != null);
  return rest.length > 0 && rest.every(v => v === 0);
}

// ---------- お気に入り ----------
function addFav() {
  if (running || !obs || !baseVis.length) { toast('計算が終わってから登録してください'); return; }
  if (preview) { toast('予習中の山頂は登録できません。現在地か地図で選んだ地点で登録してください', 3500); return; }
  const favs = loadFavs(), p = [+obs[0].toFixed(4), +obs[1].toFixed(4)];
  const name = ($('favName').value.trim() || curPlace || '地点' + (favs.length + 1)).slice(0, 12);
  const same = favs.find(f => distM(f.p, p) < 1000);
  if (same) { same.name = name; same.peaks = pickTargets(baseVis); same.t = Date.now(); }
  else {
    if (favs.length >= FAV_MAX) { toast(`お気に入りは${FAV_MAX}か所までです。どれかを削除してください`, 3500); return; }
    favs.push({id:'f' + Date.now().toString(36), name, p, peaks:pickTargets(baseVis), t:Date.now()});
  }
  saveJson(FAV_STORE, favs, 'お気に入り');
  $('favName').value = '';
  toast(`⭐ ${name} を${same ? '更新' : '登録'}しました`);
  renderWx(true);
}
function delFav(id) {
  const favs = loadFavs(), f = favs.find(x => x.id === id);
  if (!f || !confirm(`お気に入り「${f.name}」を削除します（見えた記録は残ります）。よろしいですか？`)) return;
  saveJson(FAV_STORE, favs.filter(x => x.id !== id), 'お気に入り');
  renderWx();
}

// ---------- 見えた記録 ----------
function recordSeen(pt, v, st) {
  const all = loadJson(SEEN_STORE, {}), k = seenKey(pt), day = dateStr(new Date()), t = pointToday(st, pt);
  all[k] = all[k] || {n:pt.name, d:{}};
  all[k].n = pt.name.replace('（予習中）', '');
  all[k].d[day] = {v, fc:t ? t[curSlot()] : null};
  saveJson(SEEN_STORE, all, '見えた記録');
  calKey = k; calMonth = null;
  toast(v ? `👀 ${pt.name}：見えた！を記録しました` : `🙈 ${pt.name}：見えなかったを記録しました`);
  if (typeof questEvent === 'function') questEvent('seen', {v});
  renderWx(); renderCal();
}

// ---------- 画面 ----------
// 予報の表（重い問い合わせは fetch=true のときだけ）
async function renderWx(doFetch) {
  const box = $('wxBox'), pts = wxPoints();
  const draw1 = st => {
    box.innerHTML = '';
    if (!pts.length) { box.appendChild(mkEl('div', 'note', '「現在地で計算」が終わると、ここに予報が出ます')); return; }
    if (wxErr) box.appendChild(mkEl('div', 'err', wxErr));
    const seen = loadJson(SEEN_STORE, {}), today = dateStr(new Date()), cs = curSlot();
    pts.forEach(pt => {
      const card = mkEl('div', 'pt', ''), head = mkEl('div', 'ptHead', '');
      head.appendChild(mkEl('span', 'ptName', (pt.here ? '📍 ' : '⭐ ') + pt.name));
      if (!pt.here) {
        const go = mkEl('button', '', 'この地点で計算');
        go.onclick = () => { $('td').style.display = 'none'; preview = null; setSync(false); run(pt.p); };
        const del = mkEl('button', '', '削除'); del.onclick = () => delFav(pt.id);
        head.appendChild(go); head.appendChild(del);
      }
      card.appendChild(head);
      if (!pt.peaks.length) { card.appendChild(mkEl('div', 'note', '見える山の情報がありません')); box.appendChild(card); return; }
      const tb = document.createElement('table'), r1 = document.createElement('tr'), r2 = document.createElement('tr');
      r1.appendChild(mkEl('th', '', '')); r2.appendChild(mkEl('th', '', ''));
      DAY3.forEach(d => { const th = mkEl('th', 'day', d); th.colSpan = 3; r1.appendChild(th); SLOTS.forEach(s => r2.appendChild(mkEl('th', '', s[0]))); });
      tb.appendChild(r1); tb.appendChild(r2);
      pt.peaks.forEach(k => {
        const tr = document.createElement('tr'), lv = peakLevels(st, pt, k);
        tr.appendChild(mkEl('td', 'pk' + (k.f100 ? ' f' : ''), `${k.name}\n${dirName(k.az)}・${Math.round(k.d / 1000)}km`));
        lv.forEach((row, dd) => row.forEach((v, s) => tr.appendChild(mkEl('td', 'lv' + (v == null ? 'n' : v) + (dd === 0 && s < cs ? ' past' : ''), v == null ? '－' : WX_MARK[v]))));
        tb.appendChild(tr);
      });
      card.appendChild(tb);
      // 見えた記録
      const rec = mkEl('div', 'rec', ''), mine = seen[seenKey(pt)], td = mine && mine.d[today];
      if (pt.here && preview) rec.appendChild(mkEl('span', 'note', '予習中は記録できません'));
      else {
        const b1 = mkEl('button', td && td.v === 1 ? 'on' : '', '👀 見えた'), b0 = mkEl('button', td && td.v === 0 ? 'on' : '', '🙈 見えなかった');
        b1.onclick = () => recordSeen(pt, 1, st); b0.onclick = () => recordSeen(pt, 0, st);
        rec.appendChild(b1); rec.appendChild(b0);
        if (td) rec.appendChild(mkEl('span', 'note', `今日：${td.v ? '見えた' : '見えなかった'}${td.fc != null ? `（予報${WX_MARK[td.fc]}）` : ''}`));
      }
      card.appendChild(rec);
      box.appendChild(card);
    });
    box.appendChild(mkEl('div', 'note', '◎くっきり　○たぶん見える　△雲が多め　×見えない（その時間帯でいちばんよいとき。朝6〜9時・昼11〜14時・夕15〜18時）'));
  };
  draw1(loadJson(WX_STORE, {}));
  if (doFetch && pts.length) {
    box.appendChild(mkEl('div', 'note', '天気予報を取得中…'));
    const st = await ensureWx(pts);
    if ($('td').style.display === 'block') draw1(st);
  }
}
// 見えた記録のカレンダー
function renderCal() {
  const box = $('calBox'), all = loadJson(SEEN_STORE, {}), keys = Object.keys(all);
  box.innerHTML = '';
  if (!keys.length) { box.appendChild(mkEl('div', 'note', 'まだ記録はありません。予報の下の「👀 見えた」「🙈 見えなかった」で記録できます')); return; }
  if (!all[calKey]) calKey = keys[0];
  if (!calMonth) { const d = new Date(); calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
  const sel = document.createElement('select');
  keys.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = all[k].n; if (k === calKey) o.selected = true; sel.appendChild(o); });
  sel.onchange = () => { calKey = sel.value; renderCal(); };
  const nav = mkEl('div', 'calNav', ''), pv = mkEl('button', '', '◀'), nx = mkEl('button', '', '▶');
  pv.onclick = () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCal(); };
  nx.onclick = () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCal(); };
  nav.appendChild(sel); nav.appendChild(pv); nav.appendChild(mkEl('span', 'ym', `${calMonth.getFullYear()}年${calMonth.getMonth() + 1}月`)); nav.appendChild(nx);
  box.appendChild(nav);
  const grid = mkEl('div', 'cal', ''), y = calMonth.getFullYear(), m = calMonth.getMonth(), d = all[calKey].d;
  WEEK.split('').forEach(w => grid.appendChild(mkEl('div', 'wd', w)));
  for (let i = 0; i < calMonth.getDay(); i++) grid.appendChild(mkEl('div', '', ''));
  let yes = 0, no = 0, hit = 0, cnt = 0;
  for (let n = 1; n <= new Date(y, m + 1, 0).getDate(); n++) {
    const r = d[dateStr(new Date(y, m, n))], cell = mkEl('div', 'day' + (r ? (r.v ? ' yes' : ' no') : ''), String(n));
    if (r) {
      cell.appendChild(mkEl('div', 'mk', r.v ? '👀' : '🙈'));
      if (r.fc != null) { cell.appendChild(mkEl('div', 'fc', '予報' + WX_MARK[r.fc])); cnt++; if ((r.fc >= 2) === !!r.v) hit++; }
      if (r.v) yes++; else no++;
    }
    grid.appendChild(cell);
  }
  box.appendChild(grid);
  box.appendChild(mkEl('div', 'note', `この月：見えた ${yes}日・見えなかった ${no}日` + (cnt ? `　予報の当たり ${cnt}回中${hit}回（◎○で見えた・△×で見えなかったを当たりとして数えます）` : '')));
}
