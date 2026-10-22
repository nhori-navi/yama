// YamaMiru：アプリとしての共通の仕組み（版11）
// ・ホーム画面のアプリ（sw.js の登録と「ホーム画面に追加」ボタン）
// ・スマホの「戻る」で図鑑・今日・カメラの画面を閉じる
// ・カメラ表示中は画面を消さない（Wake Lock）
// ・版の表示と、古いファイル・読み込めなかったファイルの知らせ
// main.js のあと、help.js の前に読み込む
(window.YAMA_FV = window.YAMA_FV || {}).app = 1;

// ---------- スマホの「戻る」で画面を閉じる ----------
// 画面を開いたら履歴を1つ足し、戻るで閉じる。ボタンで閉じたときは足した履歴を戻しておく
// ヘルプ（help.js）も同じ考え方。ヘルプが開いているときの戻るはヘルプに任せる
const OV = ['cam', 'td', 'zk']; // 上に重なりやすい順
let ovSkipPop = false;
const ovShown = id => $(id).style.display === 'block';
function ovClose(id) {
  if (id === 'cam') camClose(); else $(id).style.display = 'none';
}
function ovWatch(id) {
  let was = ovShown(id);
  new MutationObserver(() => {
    const now = ovShown(id);
    if (now === was) return;
    was = now;
    if (now) {
      if (!history.state || history.state.ov !== id) history.pushState({ov:id}, '');
    } else if (history.state && history.state.ov === id) {
      ovSkipPop = true; history.back(); // ボタンなどで閉じたときは、足した履歴を取り消す
    }
    if (id === 'cam') wakeSet(now);
  }).observe($(id), {attributes:true, attributeFilter:['style']});
}
window.addEventListener('popstate', () => {
  if (ovSkipPop) { ovSkipPop = false; return; }
  const hb = $('helpBox');
  if (hb && hb.style.display === 'block') return; // ヘルプを閉じるのは help.js
  const id = OV.find(ovShown);
  if (id) ovClose(id);
});
// 読み込み直したときに古い履歴の印が残っていたら消す
if (history.state && (history.state.ov || history.state.help)) history.replaceState(null, '');
OV.forEach(ovWatch);

// ---------- カメラ表示中は画面を消さない ----------
let wakeLock = null, wakeWant = false;
async function wakeSet(on) {
  wakeWant = on;
  if (!('wakeLock' in navigator)) return; // 古い iPhone（iOS 16.3 以前）などは対応していない
  if (on && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
      if (!wakeWant) { wakeLock.release().catch(() => {}); wakeLock = null; } // 待っている間に閉じられた
    } catch (e) { wakeLock = null; }
  } else if (!on && wakeLock) {
    const w = wakeLock; wakeLock = null; w.release().catch(() => {});
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && wakeWant && !wakeLock) wakeSet(true); });

// ---------- ホーム画面のアプリ ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
const isApp = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEv = null;
function appUi() {
  const st = $('appState'), btn = $('appAdd'), how = $('appHow');
  if (isApp()) { st.textContent = '📱 ホーム画面のアプリとして起動中'; btn.style.display = 'none'; how.style.display = 'none'; return; }
  st.textContent = '';
  btn.style.display = '';
  how.innerHTML = isIOS
    ? 'iPhone：Safari（または Chrome）の<b>共有ボタン</b>（四角から上向きの矢印）→<b>「ホーム画面に追加」</b>。<br>※iPhone では、ホーム画面のアプリと Safari で記録の置き場所が別です。移すときは、図鑑のいちばん下の「記録を書き出す」→ アプリで「記録を読み込む」を使ってください。'
    : installEv ? '' : 'Chrome の右上の<b>︙</b> →<b>「ホーム画面に追加」</b>（または「アプリをインストール」）。';
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; appUi(); });
window.addEventListener('appinstalled', () => { installEv = null; appUi(); toast('ホーム画面に YamaMiru を追加しました', 3500); });
$('appAdd').onclick = async () => {
  if (installEv) {
    const ev = installEv; installEv = null;
    try { ev.prompt(); await ev.userChoice; } catch (e) {}
    appUi(); return;
  }
  $('appHow').style.display = 'block';
};
appUi();

// ---------- 版の表示と古いファイルの知らせ ----------
// index.html の YAMA_NEED に書いた版と、各ファイルの先頭の YAMA_FV の版を比べる
// 版の印のないファイルは、中の関数があるかどうかで「読み込めたか」だけを調べる
const YAMA_SIG = {core:'tfetch', peaks:'loadStore', astro:'bodyPos', zukan:'loadZukan', wiki:'wikiSave', summit:'checkSummit',
  stars:'skyHor', forecast:'loadJson', quest:'sunsetToday', camera:'camF', skyline:'fitSkyline', camsky:'csCalc', backup:'bkExport', main:'draw'};
function verCheck() {
  const fv = window.YAMA_FV || {}, need = window.YAMA_NEED || {}, bad = [];
  const has = name => { try { return new Function('return typeof ' + name)() === 'function'; } catch (e) { return false; } };
  Object.keys(YAMA_SIG).forEach(f => { if (!(f in need) && !has(YAMA_SIG[f])) bad.push(f + '.js：読み込めていません'); });
  Object.keys(need).forEach(f => {
    if (fv[f] === undefined) bad.push(f + '.js：読み込めていません');
    else if (fv[f] !== need[f]) bad.push(`${f}.js：${fv[f] < need[f] ? '古い' : '新しい'}版（版${fv[f]}、必要なのは版${need[f]}）`);
  });
  $('verT').textContent = `YamaMiru　版${window.YAMA_V || '?'}${window.YAMA_DATE ? '（' + window.YAMA_DATE + '）' : ''}`;
  const w = $('verWarn');
  if (bad.length) {
    w.innerHTML = '⚠ ファイルの版が合いません：' + bad.join('／') + '<br>10分ほど待ってから開き直してください。続くときは、アップロードし忘れたファイルがないか確かめてください。';
    w.style.display = 'block';
  } else w.style.display = 'none';
  return bad;
}
// help.js まで全部読み込んでから調べる
window.addEventListener('load', verCheck);
