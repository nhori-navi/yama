// YamaMiru 版15：暗い画面（layout.js のあと・inapp.js の前に読む）
// ・MichiMiru アプリの中では、MichiMiru の「画面の明るさ」に合わせる（MichiMiru 版37 が miruThemeSet(t) で知らせる。t = {dark, preset}）
// ・Chrome で単独で開いたときは、スマホの設定（ダークモード）に合わせる
// 色は MichiMiru の暗い画面（地 #1e2522・カード #28322e・文字 #f1f5f2）にそろえる。山並みの夜の色は main.js の draw()
(window.YAMA_FV = window.YAMA_FV || {}).theme = 15;
(function () {
  const st = document.createElement('style');
  st.id = 'yamaDark';
  const D = 'body.dark';
  st.textContent = [
    `${D}{--bg:#1e2522;--card:#28322e;--ink:#f1f5f2;--sub:#b9c5bd;--line:#3d4a45;background:#1e2522;color:#f1f5f2;color-scheme:dark}`,
    // ボタン・入力
    `${D} button,${D} input,${D} select{background:#34403b;color:#f1f5f2;border:1px solid #4a5852;border-radius:6px}`,
    `${D} input[type=checkbox],${D} input[type=radio],${D} input[type=range]{background:transparent;border:0}`,
    `${D} a{color:#8ec5ff}`,
    // 上の行・案内
    `${D} #status{color:#c9d3cd}${D} .small,${D} .note,${D} #zkNote,${D} #verT{color:#a9b5ad !important}`,
    `${D} #dirInfo{color:#ff8a7a}${D} #astro{color:#f0b47a}${D} #aim{color:#ffd257}${D} #err{color:#ff8a80}`,
    `${D} #previewBar{background:#1f2e3d;border-color:#36506b;color:#bcd7f2}`,
    `${D} #verWarn{background:#3a1d22;border-color:#7a3a36;color:#ff9b8f}`,
    `${D} #helpAll{background:#2e6b3f;color:#fff;border:0}${D} .qb{background:#28322e;color:#a8e0b4;border-color:#a8e0b4}`,
    `${D} #helpRow #syncBtn,${D} #mapTg{background:#28322e;color:#a8e0b4;border-color:#3aa85a}${D} #helpRow #syncBtn.on{background:#c0392b;color:#fff;border-color:#c0392b}`,
    // 山並み・地図
    `${D} #panoWrap{border-color:#3d4a45}${D} #mapWrap{border-color:#3d4a45}`,
    `${D} #map .mapboxgl-canvas{filter:brightness(.68) saturate(.85)}`,
    `${D} #info{color:#f1f5f2}${D} #hits .hit{border-color:#3d4a45}${D} #hits .hit:active{background:#3a3424}${D} #hits .head{color:#b9c5bd}`,
    `${D} #viewBox{color:#dfe6e1}${D} #viewBox .top{color:#a8e0b4}${D} #viewBox summary{color:#f0b47a}${D} #viewBox .sub{color:#a9b5ad}`,
    // くわしい操作・下のボタン
    `${D} #yMore{background:#28322e;border-color:#3d4a45}${D} #yMore>summary{color:#a8e0b4}`,
    `${D} #peakList .pk{background:#28322e;border-color:#4a5852;color:#f1f5f2}${D} #peakList .note{color:#a9b5ad}`,
    `${D} #yBar{background:#1a201d;border-color:#3d4a45;box-shadow:0 -2px 8px rgba(0,0,0,.5)}`,
    `${D} #yBar button{background:transparent;border:0;color:#f1f5f2}${D} #yBar button:active{background:#2c3a33}${D} #yBar #gpsBtn{color:#8fe3a3}`,
    `${D} #yBar #skyBtn.on,${D} #skyBtn.on{background:#2c4f94;color:#fff;border-color:#2c4f94}`,
    // 図鑑・今日のお題（画面いっぱいの窓）
    `${D} #zk,${D} #td,${D} #helpBox{background:#1e2522;color:#f1f5f2}`,
    `${D} #zk h3{color:#f0b47a}${D} #td h3{color:#8fd0e6}${D} #zkSum{color:#dfe6e1}`,
    `${D} #zk .sort button.on,${D} #zkTabs button.on{background:#8b4513;border-color:#b0652a;color:#fff}`,
    `${D} #zkList .row{border-color:#3d4a45}${D} #zkList .nm.f{color:#f0b47a}${D} #zkList .sub{color:#a9b5ad}`,
    `${D} #zkF100 span{color:#5e6b64}${D} #zkF100 span.got{color:#f0b47a}`,
    `${D} #zkBadges span{background:#2c3832;color:#7d8a83}${D} #zkBadges span.got{background:#4a3d1c;color:#f0d690}`,
    `${D} .wkbox,${D} .wk{color:#dfe6e1}${D} .wk .src{color:#a9b5ad}${D} .wk img{background:#2c3832}`,
    `${D} #qBox .q{border-color:#3d4a45}${D} #qBox .q.done{background:#1f3a28;color:#a8e0b4}`,
    `${D} #wxBox .pt{border-color:#3d4a45;background:#28322e}${D} #wxBox th{color:#a9b5ad}${D} #wxBox th.day{color:#dfe6e1;border-color:#3d4a45}`,
    `${D} #wxBox td{border-color:#3d4a45}${D} #wxBox td.pk{color:#dfe6e1}${D} #wxBox td.pk.f{color:#f0b47a}`,
    `${D} #wxBox td.lv3{color:#6fe08f}${D} #wxBox td.lv2{color:#79b8f0}${D} #wxBox td.lv1{color:#f0c060}${D} #wxBox td.lv0{color:#8a968f}${D} #wxBox td.lvn{color:#56625b}`,
    `${D} #wxBox .rec .on{background:#1f6f8b;border-color:#1f6f8b;color:#fff}`,
    `${D} #calBox .cal .day{background:#28322e;color:#c9d3cd}${D} #calBox .cal .day.yes{background:#1f4a2c}${D} #calBox .cal .day.no{background:#4a2a25}${D} #calBox .cal .wd,${D} #calBox .cal .fc{color:#a9b5ad}`,
    // ヘルプ・使い方ナビ
    `${D} #helpBox details{border-color:#3d4a45}${D} #helpBox summary{color:#a8e0b4}${D} #helpBox details[open] summary{color:#ffb3a8}`,
    `${D} #tip{background:#4a4220;border-color:#c9a227;color:#fff6d6}${D} #tip b{color:#ffe08a}${D} #tipX{background:transparent;border:0;color:#fff6d6}`,
    `${D} #sendInfo summary{color:#8ec5ff}${D} #sendInfo .si{color:#c9d3cd}${D} #appRow #appState{color:#a8e0b4}${D} #appHow{color:#c9d3cd}`,
    // index.html の中に直接書いた灰色の注記
    `${D} h3 span[style*="#888"]{color:#a9b5ad !important}`,
    `html.predark,html.predark body{background:#1e2522}`
  ].join('\n');
  document.head.appendChild(st);

  const michi = () => { try { const P = window.parent; if (P !== window && typeof P.miruTheme === 'function') return P.miruTheme(); } catch (e) {} return null; };
  const phoneDark = () => !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  let cur = null;
  function apply(t) {
    const m = (t && typeof t.dark === 'boolean') ? t : michi();
    const dark = m ? !!m.dark : phoneDark();
    document.documentElement.classList.remove('predark');
    if (cur === dark) return;
    cur = dark;
    document.body.classList.toggle('dark', dark);
    const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', dark ? '#1e2522' : '#2e7d32');
    if (typeof draw === 'function') { try { draw(); } catch (e) {} } // 山並みを夜の色で描き直す
  }
  window.miruThemeSet = t => apply(t);
  window.yamaTheme = apply;
  apply();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!michi()) apply(); }); } catch (e) {}
})();
