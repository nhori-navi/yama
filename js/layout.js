// YamaMiru：版14 画面の並べ替え（help.js のあと、inapp.js の前に読み込む）
// いちばん見たい山並みを上に。上から：短い状態の行 → 山並み → 山の詳細 → 地図（小さめ。「▾ 大きく」で広がる）→「⚙ くわしい操作」（たたんでおく）
// よく使う5つ（現在地で計算・カメラ・図鑑・今日・星空）は画面の下に固定（ほかの Miru アプリの下のタブと同じ位置）
// 要素は動かすだけ（id もボタンの動きもそのまま）。地図の大きさ yama_mapbig、くわしい操作の開け閉め yama_more
(window.YAMA_FV = window.YAMA_FV || {}).layout = 14;
const yLs = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
const ySet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
// 使い方ナビが「くわしい操作」の中のボタンを指すときは、開いてから指す（help.js から呼ぶ）
function yMoreEl(id) {
  const el = $(id), d = $('yMore');
  if (el && d && !d.open && d.contains(el)) { d.open = true; ySet('yama_more', '1'); }
  return el;
}
(function () {
  const st = document.createElement('style');
  st.textContent = 'body{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))}' +
    '#yTop{padding:4px 10px 2px}#yTop #helpRow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}#yTop #status{margin:2px 0}#yTop #astro{margin:2px 0}' +
    '#map{height:160px}body.ymapbig #map{height:42vh}#mapWrap{position:relative;border-top:1px solid #ccc}' +
    '#mapTg{position:absolute;right:8px;bottom:8px;z-index:2;margin:0;padding:4px 10px;font-size:13px;border-radius:14px;border:1px solid #2e7d32;background:#fff;color:#2e7d32;box-shadow:0 1px 4px rgba(0,0,0,.25)}' +
    '#yMore{margin:6px 8px;border:1px solid #d6e3d4;border-radius:10px;background:#fff}#yMore>summary{padding:10px 12px;font-size:15px;font-weight:bold;color:#2e7d32;cursor:pointer;list-style:none}#yMore>summary::-webkit-details-marker{display:none}' +
    '#yMore>summary::after{content:"▾";float:right}#yMore[open]>summary::after{content:"▴"}#yMore #ctrl{padding:0 10px 8px}' +
    '#yBar{position:fixed;left:0;right:0;bottom:0;z-index:8;display:flex;background:#fff;border-top:1px solid #d6e3d4;padding:4px 2px calc(4px + env(safe-area-inset-bottom,0px));box-shadow:0 -2px 8px rgba(0,0,0,.08)}' +
    '#yBar button{flex:1;min-width:0;margin:0 2px;padding:6px 2px;min-height:52px;border:0;border-radius:10px;background:transparent;font-size:12px;line-height:1.25;color:#1d2b22;white-space:normal;word-break:keep-all}' +
    '#helpRow #syncBtn{margin:0 0 0 auto;padding:4px 12px;font-size:13px;border-radius:14px;border:1px solid #2e7d32;background:#fff;color:#2e7d32}#helpRow #syncBtn.on{background:#c0392b;color:#fff;border-color:#c0392b}#yTop #dirInfo:empty,#yTop #aim:empty{min-height:0}' +
    '#yBar button:active{background:#e8f3e7}#yBar #gpsBtn{color:#2e7d32;font-weight:bold}#yBar #skyBtn.on{background:#1a2a4d;color:#fff}#yBar #syncBtn.on{background:#c0392b;color:#fff}';
  document.head.appendChild(st);
  const ctrl = $('ctrl'), pano = $('panoBox'); if (!ctrl || !pano) return;
  const mk = (tag, id, html) => { const e = document.createElement(tag); if (id) e.id = id; if (html) e.innerHTML = html; return e; };
  // 上の行（使い方ナビ・版の警告・状態・予習中・向きの案内・太陽と月）
  const top = mk('div', 'yTop');
  ['helpRow', 'verWarn', 'previewBar', 'status', 'err', 'dirInfo', 'aim', 'astro'].forEach(id => { if ($(id)) top.appendChild($(id)); });
  document.body.insertBefore(top, document.body.firstChild);
  // 山並み → 星空の時刻 → 山の詳細 …（今の順のまま、地図だけ下へ）
  top.after(pano);
  if ($('skyBox')) pano.after($('skyBox'));
  // 地図：山の一覧の下に小さめ
  const mw = mk('div', 'mapWrap'), map0 = $('map');
  const anchor = $('hits') || $('info');
  anchor.after(mw); mw.appendChild(map0);
  if ($('viewBox')) mw.before($('viewBox'));
  const tg = mk('button', 'mapTg'); tg.type = 'button'; mw.appendChild(tg);
  const big = on => { document.body.classList.toggle('ymapbig', on); tg.textContent = on ? '▴ 小さく' : '▾ 地図を大きく'; ySet('yama_mapbig', on ? '1' : '0'); setTimeout(() => { try { map.resize(); } catch (e) {} }, 60); };
  tg.onclick = () => big(!document.body.classList.contains('ymapbig'));
  big(yLs('yama_mapbig', '0') === '1');
  // くわしい操作（残りの操作をたたむ）
  const more = mk('details', 'yMore', '<summary>⚙ くわしい操作<span style="font-weight:normal;font-size:12px;color:#5b6b61">（地点・山名で探す・目の高さ・補正・向き・日付）</span></summary>');
  mw.after(more); more.appendChild(ctrl);
  more.open = yLs('yama_more', '0') === '1';
  more.addEventListener('toggle', () => ySet('yama_more', more.open ? '1' : '0'));
  // 「向きに合わせる」は上の行の右（山に向けて「見つけた」を集めるのに毎回使うので、たたまない。山並みの上に置くと山の名前に重なる）
  if ($('syncBtn') && $('helpRow')) $('helpRow').appendChild($('syncBtn'));
  // 下に固定のボタン
  const bar = mk('div', 'yBar');
  if ($('gpsBtn')) $('gpsBtn').textContent = '📍 現在地で計算';
  ['gpsBtn', 'camBtn', 'zkBtn', 'tdBtn', 'skyBtn'].forEach(id => { const b = $(id); if (b) bar.appendChild(b); });
  document.body.appendChild(bar);
  // 「現在地で計算」などを押したら、山並みが見える位置へ戻す
  ['gpsBtn', 'skyBtn'].forEach(id => $(id) && $(id).addEventListener('click', () => { if (scrollY > pano.offsetTop) scrollTo({top: 0, behavior: 'smooth'}); }));
  setTimeout(() => { try { map.resize(); } catch (e) {} }, 100);
})();
