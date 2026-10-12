// YamaMiru：今日のお題（毎日3つ）と「☀ 今日」の画面
// forecast.js のあと、main.js の前に読み込む
// 保存：yama_quest_v1 {day:お題の日付, list:[{k:種類, txt:文, done:達成日時, …}], bad:天気が悪い日, bonus:3つ達成の点をもらった,
//        caught:[今日見つけた山のキー], days:{"日付":達成した数}, best:いちばん長い連続日数}
const QUEST_STORE = 'yama_quest_v1', Q_PTS = 30, Q_BONUS = 50;
let quest = loadJson(QUEST_STORE, {}), qMaking = null;
quest.days = quest.days || {}; quest.best = quest.best || 0;
const saveQuest = () => saveJson(QUEST_STORE, quest, 'お題');
const todayStr = () => dateStr(new Date());
// 日付と場所から決まる乱数（同じ日・同じ場所なら同じお題）
function seeded(s) {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}
const qPick = (arr, r) => arr[Math.floor(r() * arr.length)];
// 今日、山並みに太陽が沈む時刻（山並みがまだなければ地平線）
function sunsetToday() {
  if (!AST || !obs) return null;
  const ob = observer(), t0 = today0().getTime(), g = t => { const p = bodyPos(AST.Body.Sun, t, ob); return p.alt - (prof ? ridgeAt(p.az) : 0); };
  for (let m = 12 * 60; m < 21 * 60; m += 10) {
    const a = t0 + m * 60000, b = a + 600000;
    if (g(a) > 0 && g(b) <= 0) return bisect(g, a, b, 10);
  }
  return null;
}
// ---------- お題の種類 ----------
// make：今日・この場所で達成できるときだけお題を返す。home：家でもできる（天気が悪い日用）
// hit：アプリの中のできごと（type）で達成したか
const QUESTS = [
  {k:'name', home:false, make:r => {
    const c = labels.filter(l => !zukan.peaks[zkKey(l)]);
    if (!c.length) return null;
    const v = qPick(c, r);
    return {txt:`${v.name}を見つけよう（${dirName(v.az)}・${Math.round(v.d / 1000)}km）`, id:zkKey(v)};
  }, hit:(q, t, o) => t === 'catch' && zkKey(o) === q.id},
  {k:'star3', home:false, make:() => labels.some(l => rarity(l.d, l.mg) >= 3) ? {txt:'レア度★3以上の山を見つけよう'} : null,
    hit:(q, t, o) => t === 'catch' && rarity(o.d, o.mg) >= 3},
  {k:'far', home:false, make:() => labels.some(l => l.d >= 50000) ? {txt:'50km以上先の山を見つけよう'} : null,
    hit:(q, t, o) => t === 'catch' && o.d >= 50000},
  {k:'count', home:false, make:() => labels.length >= 3 ? {txt:'ちがう山を3座見つけよう'} : null,
    hit:(q, t) => t === 'catch' && (quest.caught || []).length >= 3},
  {k:'dusk', home:false, make:() => {
    const s = sunsetToday();
    if (!s || !labels.length || Date.now() > s + 20 * 60000) return null;
    return {txt:`日の入り（${hm(new Date(s))}ごろ）の前後30分に山を見つけよう`, t:s};
  }, hit:(q, t) => t === 'catch' && Math.abs(Date.now() - q.t) <= 30 * 60000},
  {k:'moon', home:true, make:() => {
    if (!SKY_OK || !prof || !obs) return null;
    const ob = observer(), base = today0().getTime() + 16 * 3600000;
    for (let m = 0; m <= 960; m += 20) { // 今夜、暗い時間に月が山並みより上に出ているか
      const t = base + m * 60000, p = bodyPos(AST.Body.Moon, t, ob);
      if (p.alt > ridgeAt(p.az) + 1 && bodyPos(AST.Body.Sun, t, ob).alt < -6) return {txt:'今夜の月を「🌌 星空」で見つけてタップしよう'};
    }
    return null;
  }, hit:(q, t, o) => t === 'sky' && o.kind === 'm'},
  {k:'const', home:true, make:r => {
    if (!SKY_OK || !prof || !obs || dateStr(astroDate) !== todayStr()) return null;
    const ev = skyEvents().ev.filter(e => e.kind === 'c' && e.rise && CONSTEL[e.i][3] >= 2);
    if (!ev.length) return null;
    const e = qPick(ev, r);
    return {txt:`今夜${skyHm(e.t)}ごろ${dirName(e.az)}の山から昇る${e.name}を「🌌 星空」でタップしよう`, name:e.name};
  }, hit:(q, t, o) => t === 'sky' && o.kind === 'c' && CONSTEL[o.i][1] === q.name},
  {k:'wiki', home:true, make:() => ({txt:'山の説明（Wikipedia）を1つ読もう（山名や図鑑の山をタップ）'}), hit:(q, t) => t === 'wiki'},
  {k:'preview', home:true, make:r => {
    const c = loadStore().list.filter(v => v[4] && !Object.values(zukan.climbs || {}).some(x => x.id === v[5]));
    if (!c.length) return {txt:'好きな山の山頂からの眺めを予習しよう（「山名で探す」で）'};
    const v = qPick(c, r);
    return {txt:`${v[0]}の山頂からの眺めを予習しよう（「山名で探す」で）`, name:v[0], id:v[5]};
  }, hit:(q, t, o) => t === 'preview' && (!q.name || o.id === q.id || normName(o.name) === normName(q.name))},
  {k:'seen', home:true, make:() => ({txt:'今日の山の見え方を記録しよう（予報の下の「👀 見えた／🙈 見えなかった」）'}), hit:(q, t) => t === 'seen'}
];
// ---------- お題を作る（1日1回） ----------
async function ensureQuests() {
  if (quest.day === todayStr() && quest.list) return;
  if (qMaking) return qMaking;
  qMaking = (async () => {
    const here = herePoint();
    let st = loadJson(WX_STORE, {});
    if (here) st = await Promise.race([ensureWx([here]), sleep(8)]) || st; // 天気は8秒まで待つ
    const day = todayStr(), r = seeded(day + '|' + (obs ? obs[0].toFixed(1) + ',' + obs[1].toFixed(1) : ''));
    const bad = badToday(st, here);
    let cand = [];
    QUESTS.forEach(q => { try { const o = q.make(r); if (o) cand.push({k:q.k, home:q.home, ...o, done:0}); } catch (e) {} });
    if (bad) cand = cand.filter(q => q.home);
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    const out = [];
    cand.forEach(q => { if (out.length < 3 && (q.home || out.filter(x => !x.home).length < 2)) out.push(q); }); // 見つけるお題は2つまで
    if (quest.day === day && quest.list) return; // 作っている間にほかで作られていたら何もしない
    quest.day = day; quest.list = out; quest.bad = bad; quest.bonus = 0; quest.caught = [];
    saveQuest(); qLabel();
    if ($('td').style.display === 'block') renderQuest();
  })().finally(() => { qMaking = null; });
  return qMaking;
}
// ---------- 達成の判定 ----------
// 今日を含めて、1つ以上達成した日が何日続いているか（今日がまだ0なら昨日まで）
function streakNow() {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  if (!quest.days[dateStr(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (quest.days[dateStr(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
// お題のお知らせは順番に1つずつ出す（重なって消えないように）
const qToastQ = [];
let qToastBusy = false;
function qToast(msg, wait) { qToastQ.push(msg); if (!qToastBusy) { qToastBusy = true; setTimeout(qToastNext, wait); } }
function qToastNext() { const m = qToastQ.shift(); if (!m) { qToastBusy = false; return; } toast(m, 4500); setTimeout(qToastNext, 4700); }
function questEvent(type, o) {
  if (quest.day !== todayStr() || !quest.list) return;
  if (type === 'catch') { quest.caught = quest.caught || []; const k = zkKey(o); if (!quest.caught.includes(k)) quest.caught.push(k); }
  const newly = [];
  quest.list.forEach(q => {
    const def = QUESTS.find(x => x.k === q.k);
    if (!q.done && def && def.hit(q, type, o)) { q.done = Date.now(); newly.push(q); }
  });
  if (!newly.length) { if (type === 'catch') saveQuest(); return; }
  let pts = newly.length * Q_PTS, msg = newly.map(q => '🎯 お題達成！ ' + q.txt.replace(/（[^（）]*）$/, '')).join('　');
  const day = todayStr(); quest.days[day] = quest.list.filter(q => q.done).length;
  if (quest.list.every(q => q.done) && !quest.bonus) { quest.bonus = 1; pts += Q_BONUS; msg += `　🎉 3つ全部達成！ボーナス+${Q_BONUS}`; }
  quest.best = Math.max(quest.best, streakNow());
  zukan.score += pts; saveZukan(); saveQuest();
  const badges = checkBadges();
  qToast(`${msg}　+${pts}点` + badges.map(b => `　🏅${b}`).join(''), type === 'catch' ? 3200 : 300); // 見つけたときの表示のあとに出す
  if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 160]);
  qLabel();
  if ($('td').style.display === 'block') renderQuest();
}
// ほかのファイルの処理に「お題の判定」を足す
const catchPeakBase = catchPeak;
catchPeak = function (l) {
  const fresh = !caughtNow.has(obsKey() + '|' + zkKey(l)); // 同じ場所で2回目は数えない
  catchPeakBase(l);
  if (fresh) questEvent('catch', l);
};
const wikiBoxBase = wikiBox;
wikiBox = function (o, box) { wikiBoxBase(o, box); if (o && o.id) questEvent('wiki', o); };
const startPreviewBase = startPreview;
startPreview = function (v) { const was = running; startPreviewBase(v); if (!was) questEvent('preview', v); };
const skyTapBase = skyTap;
skyTap = function (e) {
  const rc = $('pano').getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
  let best = null, bd = 22;
  skyHits.forEach(h => { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } });
  const ok = skyTapBase(e);
  if (ok && best) questEvent('sky', best);
  return ok;
};
// 計算が終わったら（予習でなければ）今日のお題を用意する
const summitAfterBase2 = summitAfter;
summitAfter = function (opt) { summitAfterBase2(opt); if (!opt.preview) ensureQuests().catch(() => {}); };
// 連続日数のバッジ
BADGES.push(
  ['q3', 'お題3日連続', '1つ以上お題を達成した日が3日続く', s => s.qBest >= 3],
  ['q7', 'お題7日連続', '1つ以上お題を達成した日が7日続く', s => s.qBest >= 7],
  ['q30', 'お題30日連続', '1つ以上お題を達成した日が30日続く', s => s.qBest >= 30]
);
const zkStatsBase2 = zkStats;
zkStats = function () { const s = zkStatsBase2(); s.qBest = quest.best || 0; return s; };

// ---------- 「☀ 今日」の画面 ----------
function qLabel() {
  const ok = quest.day === todayStr() && quest.list;
  $('tdBtn').textContent = ok ? `☀ 今日 ${quest.list.filter(q => q.done).length}/${quest.list.length}` : '☀ 今日';
}
function renderQuest() {
  const box = $('qBox'); box.innerHTML = '';
  if (quest.day !== todayStr() || !quest.list) { box.appendChild(mkEl('div', 'note', '今日のお題を用意しています…（「現在地で計算」が終わると出ます）')); return; }
  if (quest.bad) box.appendChild(mkEl('div', 'note', '☔ 今日は山が見えにくい予報なので、家でもできるお題にしました'));
  quest.list.forEach(q => box.appendChild(mkEl('div', 'q' + (q.done ? ' done' : ''), `${q.done ? '✅' : '⬜'} ${q.txt}　${q.done ? '達成 ' + hm(new Date(q.done)) : '+' + Q_PTS + '点'}`)));
  const n = quest.list.filter(q => q.done).length;
  box.appendChild(mkEl('div', 'note', `${n}/${quest.list.length} 達成${quest.bonus ? '（3つ全部達成！）' : `　3つ全部で ボーナス+${Q_BONUS}点`}　連続 ${streakNow()}日（最高 ${quest.best}日）`));
}
async function openToday() {
  $('td').style.display = 'block';
  renderQuest(); renderWx(true); renderCal();
  if (!running && prof) ensureQuests().then(renderQuest).catch(() => {}); // 計算中は、終わってから作る
}
$('tdBtn').onclick = openToday;
$('tdClose').onclick = () => { $('td').style.display = 'none'; };
$('favBtn').onclick = addFav;
qLabel();
