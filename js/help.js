// YamaMiru の使い方：はじめての紹介・使い方ナビ（レクチャー）・ヘルプ（「？ 使い方」と各欄の「？」）
// ほかのミルシリーズ（TenMiru・MichiMiru・ChariMiru）の help.js と同じ作り。いちばん最後（main.js・app.js のあと）に読む
// 保存：yama_help_v1 {intro:紹介を見た, on:ナビON, done:{終わった手順}, ev:{}}（端末ごとなので、記録の書き出しには入れない）
(window.YAMA_FV = window.YAMA_FV || {}).help = 2;
(function () {
  const H = loadJson('yama_help_v1', {});
  H.done = H.done || {}; H.ev = H.ev || {};
  if (H.on == null) H.on = true;
  const hSave = () => saveJson('yama_help_v1', H);

  // ---------- 見た目 ----------
  const st = document.createElement('style');
  st.textContent = `
#helpRow{display:flex;align-items:center;gap:6px;margin:0 0 4px}
#helpRow label{font-size:13px;margin:0}
#helpAll{font-size:13px;padding:3px 10px;background:#2e6b3f;color:#fff;border:none;border-radius:12px}
#tip{display:none;position:fixed;left:0;right:0;bottom:0;z-index:20;padding:9px 38px 10px 12px;background:#fff4c2;border-top:2px solid #f0c419;font-size:14px;line-height:1.55;box-shadow:0 -2px 8px rgba(0,0,0,.18)}
#tip b{color:#7a5a00}
#tipX{position:absolute;top:4px;right:4px;border:none;background:none;font-size:20px;padding:2px 8px;margin:0}
.hl{outline:3px solid #f0c419 !important;outline-offset:2px;animation:hlp 1.2s ease-in-out infinite}
@keyframes hlp{0%,100%{outline-color:#f0c419}50%{outline-color:rgba(240,196,25,.25)}}
.qb{display:inline-block;width:22px;height:22px;line-height:20px;padding:0;margin:0 0 0 4px;font-size:13px;font-weight:bold;text-align:center;border:1px solid #2e6b3f;color:#2e6b3f;background:#fff;border-radius:50%;vertical-align:middle;cursor:pointer}
#camBottom .qb{background:rgba(255,255,255,.9)}
#helpBox,#intro{display:none;position:fixed;inset:0;z-index:45;background:#fff;overflow:auto;padding:12px;line-height:1.7;font-size:15px}
#helpBox .top{display:flex;justify-content:space-between;align-items:center}
#helpBox h2{font-size:18px;margin:4px 0}
#helpBox details{border-bottom:1px solid #e3e3e3;padding:4px 0}
#helpBox summary{font-weight:bold;color:#2e6b3f;padding:6px 0;cursor:pointer}
#helpBox details[open] summary{color:#c0392b}
#helpBox .hb{padding:0 4px 8px}
#helpBox ul{margin:4px 0;padding-left:20px}
#helpBox .foot{margin:14px 0 30px}
#helpBox .foot button{font-size:14px;margin:4px 6px 4px 0}
#intro{background:linear-gradient(#2e6b3f,#5b9bd5);color:#fff;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:24px}
#intro .ic{font-size:64px;line-height:1.2}
#intro h2{margin:12px 0 8px;font-size:22px}
#intro p{max-width:460px;margin:0 auto;font-size:16px;line-height:1.8}
#intro .dots{margin:18px 0}
#intro .dots span{display:inline-block;width:9px;height:9px;margin:0 4px;border-radius:50%;background:rgba(255,255,255,.35)}
#intro .dots span.on{background:#fff}
#intro button{font-size:16px;padding:8px 18px;margin:4px;border-radius:20px;border:none}
#introNext{background:#ffd54f;color:#333;font-weight:bold}
#introSkip,#introPrev{background:rgba(255,255,255,.2);color:#fff}`;
  document.head.appendChild(st);

  // ---------- 使い方ナビの行と吹き出し ----------
  const row = document.createElement('div'); row.id = 'helpRow';
  row.innerHTML = '<label><input type="checkbox" id="helpChk">使い方ナビ</label><button id="helpAll">？ 使い方</button>';
  $('ctrl').prepend(row);
  const tip = document.createElement('div'); tip.id = 'tip';
  tip.innerHTML = '<div id="tipText"></div><button id="tipX" aria-label="閉じる">×</button>';
  document.body.appendChild(tip);
  const vis = el => el && el.offsetParent !== null;
  const shown = id => $(id) && $(id).style.display === 'block';
  let tipKey = '', closedKey = '', hlEl = null, finishAt = 0;
  function setTip(key, html, el) {
    if (hlEl && hlEl !== el) { hlEl.classList.remove('hl'); hlEl = null; }
    if (!key || key === closedKey) { tip.style.display = 'none'; tipKey = key || ''; if (hlEl) { hlEl.classList.remove('hl'); hlEl = null; } return; }
    if (key !== tipKey) { $('tipText').innerHTML = html; tipKey = key; if (el && vis(el) && el.scrollIntoView) el.scrollIntoView({block:'center', behavior:'smooth'}); }
    tip.style.display = 'block';
    if (el && vis(el)) { el.classList.add('hl'); hlEl = el; }
  }
  $('helpChk').checked = !!H.on;
  $('helpChk').onchange = () => { H.on = $('helpChk').checked; if (H.on && H.done.finish) H.done = {}; hSave(); tipKey = ''; closedKey = ''; helpTick(); };

  // ---------- ヘルプの中身 ----------
  const SEC = [
    ['about', 'YamaMiru とは', `<p>今いる場所から見える山並みを描いて、山の名前が分かるアプリです（山座同定）。150km先までの地形から、本当に見える山だけに名前を付けます。</p>
<p>スマホを山に向けて「見つけた」山を図鑑に集めたり、名山のスタンプ帳を埋めたり、登頂を記録したりできます。太陽・月・星と山の関係や、山が見えそうかの予報も見られます。</p>`],
    ['screen', '画面の見方', `<ul><li>上は地図、下の横長の図がパノラマ（ぐるり360°の山並み）です。指やマウスで左右に動かせます。</li>
<li>山並みの色は、濃いほど近く、うすいほど遠い山です。パノラマは高さ方向を強調して描いています。</li>
<li>山の名前：<b>茶色</b>＝日本百名山、黒＝そのほかの山。名前の右上の金色の点は、もう見つけた山です。</li>
<li>山名をタップすると、標高・方角・距離・レア度と、Wikipedia の説明が出ます。地図には現在地からその山への赤い線が出ます。</li>
<li>「小さな山も表示」で、OpenStreetMap の小さな山も出します。「目の高さ」を上げると、建物の上などから見たときの見え方になります。</li>
<li>「地図で地点を選ぶ」で、地図をタップした場所からの眺めを計算します。</li></ul>`],
    ['sync', '向きに合わせる・補正・見つける', `<ul><li>「向きに合わせる」を ON にすると、スマホを向けた方向にパノラマが動きます（スマホ専用。写真を撮るときのように立てて持ちます）。</li>
<li>山名を中央の赤い線に<b>2秒</b>合わせると「見つけた」になり、図鑑に記録されます。</li>
<li>方位センサーは5〜10°ほどずれることがあります。実際の山と合わないときは「補正」の −2°／＋2° で合わせます（カメラ表示で合わせた値と共通です）。</li>
<li>iPhone では、最初に押したときに「動作と方向へのアクセス」を「許可」してください。</li>
<li>このアプリは道案内ではありません。歩きながら画面を見ないでください。</li></ul>`],
    ['zukan', '図鑑・名山スタンプ帳・レア度とスコア・バッジ', `<ul><li><b>レア度</b>：遠い山ほど高く（20km・50km・100kmで★が増える）、手前の山からぎりぎり頭を出している山は★がもう1つ増えます。</li>
<li><b>スコア</b>：初めて見つけた山は ★×20点、別の市区町村から見つけると ★×10点（場所スタンプ）。同じ場所からの2回目以降は点なしです。</li>
<li><b>名山スタンプ帳</b>：日本百名山・二百名山・三百名山・ぐんま百名山・山梨百名山の、見つけた山に印が付きます。</li>
<li><b>バッジ</b>：座数・名山・遠くの山・登頂・お題の連続日数などで手に入ります。</li>
<li>見つけた山や登った山をタップすると、Wikipedia の説明が出ます。</li></ul>`],
    ['summit', '登頂の記録', `<ul><li>山頂で「現在地で計算」を押すと、登頂が記録されます（山頂から100m以内、GPSの誤差50m以下、山頂との高さの差60m以内のとき）。</li>
<li>初めての山は標高で★1〜5 ×30点。2回目以降は日付だけ増えます（同じ日は1回）。</li>
<li>地図で選んだ地点や予習では記録されません。</li></ul>`],
    ['preview', '展望の予習（山名で探す）', `<ul><li>「山名で探す」に山の名前を入れて候補を選ぶと、その山頂からの眺めを計算します。登る前の下見にどうぞ。</li>
<li>保存した一覧にない山は Wikidata で探します。</li>
<li>予習中は「見つける」と登頂の記録は動きません。終わったら「現在地に戻る」を押します。</li></ul>`],
    ['sun', '太陽と月・ダイヤモンド富士', `<ul><li>「太陽と月」が ON のとき、パノラマにその日の通り道を描きます（オレンジ＝太陽、黄色＝月、点は10分ごと、点線は山の陰）。</li>
<li>日の出・日の入りは、山並みから出る・山並みに隠れる時刻です。◀ ▶ と日付で、ほかの日も見られます。</li>
<li>山名をタップして「この山に太陽・月が重なる日を探す」を押すと、この先1年でダイヤモンド（太陽）・パール（満月に近い月）になる日を探します。</li>
<li>時刻は数分ずれることがあります。</li></ul>`],
    ['sky', '🌌 星空', `<ul><li>「🌌 星空」で、パノラマが夜空になります。山並みの上の星座・明るい星・月・惑星を、縦と横を同じ縮尺（実際の見え方と同じ比率）で描きます。</li>
<li>スライダーで夕方16時から翌朝8時まで時刻を動かせます。「いま」でいまの空に戻ります。</li>
<li>下の一覧は、その夜に星座・明るい星・月・惑星が<b>実際の山並みから</b>昇る・沈む時刻です。タップするとその時刻になります。</li>
<li>星座・星をタップすると説明が出ます。街明かりや地平線近くのかすみで、見えにくい星もあります。</li></ul>`],
    ['camera', '📷 カメラ表示', `<ul><li>カメラの映像に、山並みの白い線・山名・太陽・月を重ねます（スマホ専用。3分で自動で止まります）。暗くなると、星座・明るい星・惑星も重ねます。</li>
<li><b>合わせ方</b>：画面をなぞると線を左右・上下に動かせます。山と山の間隔が合わないときは「大きさ −／＋」。</li>
<li><b>🎯 自動で合わせる</b>（昼・実験）：空と山の境目を見つけて合わせます。晴れて山の形がくっきり見えるときに使います。</li>
<li><b>⭐ 星で合わせる</b>（夜）：本物の月・惑星・明るい星を中央の黄色の輪に入れて押すと、方角を合わせます。</li>
<li>夜の映像はほとんど写りません。本物の星は肉眼で見て、画面の線と見比べてください。</li></ul>`],
    ['today', '☀ 今日（お題・見える？予報・見えた記録）', `<ul><li><b>今日のお題</b>：毎日3つ。達成すると1つ＋30点、3つ全部で＋50点。1つ以上達成した日が続くとバッジがもらえます。天気が悪い日や、パソコンでは家でもできるお題になります。</li>
<li><b>今日は見える？</b>：雲・雨・見通し・湿度から、代表の山が見えそうかを ◎○△× で出します（朝・昼・夕、3日分）。遠くの山の「かすみ」は予報が苦手です。</li>
<li><b>お気に入り</b>：いま計算している地点を5か所まで登録でき、そこからの予報も出ます。</li>
<li><b>見えた記録</b>：「👀 見えた」「🙈 見えなかった」を記録すると、カレンダーと予報の当たり具合が分かります。</li></ul>`],
    ['data', '現在地と記録の保存', `<ul><li>現在地は、山並みの計算と場所スタンプ（市区町村名）のためだけに使います。</li>
<li>パソコンでは現在地を Wi-Fi などから推定するので、数km以上ずれることがあります。そのときは「地図で地点を選ぶ」が正確です。現在地が分からないときも、地図をタップして場所を選べます。</li>
<li>記録（図鑑・お題・見えた記録・お気に入り）は、この端末のブラウザの中だけに保存されます。スマホとパソコンで別々です。</li>
<li>別の端末へ移すときは、図鑑のいちばん下の「記録を書き出す」でファイルを作り、移す先の「記録を読み込む」で選びます（読み込むと、その端末の記録は置きかわります）。</li>
<li><b>ホーム画面のアプリ</b>：画面のいちばん下の「📲 ホーム画面に追加」で、アドレスの帯のないアプリとして開けます。iPhone では、ホーム画面のアプリと Safari で記録の置き場所が別なので、「記録を書き出す」→「記録を読み込む」で移してください。</li>
<li>どこへ何を送っているかは、画面のいちばん下の「この端末の外へ送る情報」で見られます。カメラの映像は端末の外へ送りません。</li></ul>`],
    ['trouble', 'うまくいかないとき・出典', `<ul><li><b>山名が出ない・取得に失敗</b>：混雑していることがあります。少し待って「現在地で計算」を押し直してください。初めての地域は一覧の取得に最大70秒ほどかかります。</li>
<li><b>方角がずれる</b>：「補正」で合わせます。スマホを8の字に何回か振ると、方位センサーの精度がよくなることがあります。車や鉄骨の近くでは大きくずれます。</li>
<li><b>「向きに合わせる」「カメラ」が使えない</b>：パソコンなど向きセンサーのない端末では使えません。iPhone で許可しなかったときは、ページを開き直してください。</li>
<li><b>おかしな表示が続く</b>：「山の一覧を取り直す」を押すと、保存した山の一覧を取り直します（図鑑の記録は消えません）。</li>
<li><b>赤い「⚠ ファイルの版が合いません」</b>：新しい版にしたすぐあとは、古いファイルがブラウザに残っていることがあります。10分ほど待ってから開き直してください。</li>
<li><b>赤い「⚠ 思わぬエラー」</b>：画面を読み込み直してください。続くときは、その文をそのまま伝えてください。</li>
<li><b>「記録を保存できませんでした」</b>：この端末の保存する場所がいっぱいの可能性があります。「記録を書き出す」で控えを取ってください。</li></ul>
<p style="font-size:13px;color:#666">標高：国土地理院 標高タイル／山名：Wikidata、© OpenStreetMap contributors／山の説明：Wikipedia／天体計算：Astronomy Engine／天気：Open-Meteo.com（CC BY 4.0）／星座と星のデータ：TenMiru（星座の線は d3-celestial　Copyright (c) 2015, Olaf Frohn　BSD 3-Clause License）</p>`]
  ];
  const box = document.createElement('div'); box.id = 'helpBox';
  box.innerHTML = '<div class="top"><h2>？ YamaMiru の使い方</h2><button id="helpClose">閉じる</button></div>' +
    SEC.map(([id, t, b]) => `<details id="hs_${id}"><summary>${t}</summary><div class="hb">${b}</div></details>`).join('') +
    '<div class="foot"><button id="introAgain">はじめての紹介をもう一度</button><button id="naviAgain">使い方ナビを最初から</button></div>';
  document.body.appendChild(box);
  const helpOpen = () => box.style.display === 'block';
  // スマホの「戻る」操作で閉じられるように、開いたときに履歴を1つ足す
  function openHelp(id) {
    box.style.display = 'block';
    box.querySelectorAll('details').forEach(d => { d.open = !!id && d.id === 'hs_' + id; });
    if (id) setTimeout(() => $('hs_' + id).scrollIntoView({block:'start'}), 30); else box.scrollTop = 0;
    if (!history.state || !history.state.help) history.pushState({help:1}, '');
    setTip('', '');
  }
  function closeHelp() { box.style.display = 'none'; helpTick(); }
  window.addEventListener('popstate', () => { if (helpOpen()) closeHelp(); });
  $('helpAll').onclick = () => openHelp('');
  $('helpClose').onclick = () => { if (history.state && history.state.help) history.back(); else closeHelp(); };
  $('introAgain').onclick = () => { $('helpClose').onclick(); showIntro(0); };
  $('naviAgain').onclick = () => { H.done = {}; H.ev = {}; H.on = true; $('helpChk').checked = true; hSave(); tipKey = ''; closedKey = ''; $('helpClose').onclick(); };
  // 各欄の「？」
  const qb = (id, where, how) => {
    if (!where) return;
    const b = document.createElement('button'); b.className = 'qb'; b.textContent = '？'; b.title = '説明';
    b.onclick = e => { e.stopPropagation(); e.preventDefault(); openHelp(id); };
    if (how === 'before') where.parentNode.insertBefore(b, where); else if (how === 'after') where.after(b); else where.appendChild(b);
  };
  const h3 = txt => [...document.querySelectorAll('h3')].find(h => h.textContent.startsWith(txt));
  qb('sync', $('offPlus'), 'after');
  qb('preview', $('peakQ'), 'after');
  qb('sun', $('astroOn').parentNode, 'after');
  qb('sky', $('skyNow'), 'after');
  qb('zukan', h3('バッジ')); qb('zukan', h3('名山スタンプ帳'));
  qb('summit', h3('登った山'));
  qb('data', h3('記録の書き出し'));
  qb('today', h3('🎯 今日のお題')); qb('today', h3('🌤 今日は見える')); qb('today', h3('📅 見えた記録'));
  qb('camera', $('camReset'), 'after');

  // ---------- はじめての紹介（初めて開いたときだけ） ----------
  const CARDS = [
    ['🏔', '見える山の名前が分かる', '今いる場所から見える山並みを、150km先まで描いて山の名前を付けます。山名をタップすると、標高や説明が出ます。'],
    ['🎯', '見つけて集める', 'スマホを山に向けて、山名を赤い線に2秒合わせると「見つけた」。図鑑・名山スタンプ帳・バッジ・登頂の記録が集まります。'],
    ['☀', '今日のお題と「今日は見える？」', '毎日3つのお題と、山が見えそうかの予報。見えた・見えなかったの記録も付けられます。'],
    ['🌌', '太陽・月・星', 'ダイヤモンド富士の日、山から昇る星座、夜のカメラ表示。山と空の関係が分かります。'],
    ['📍', '位置情報と記録の置き場所', '現在地は山並みの計算だけに使います。記録はこの端末の中だけにあり、別の端末へは「記録の書き出し」で移せます。位置情報の確認が出たら「許可」を選んでください。']
  ];
  const intro = document.createElement('div'); intro.id = 'intro';
  document.body.appendChild(intro);
  let ci = 0;
  function showIntro(i) {
    ci = Math.max(0, Math.min(CARDS.length - 1, i));
    const [ic, t, p] = CARDS[ci];
    intro.innerHTML = `<div class="ic">${ic}</div><h2>${t}</h2><p>${p}</p>
<div class="dots">${CARDS.map((_, k) => `<span class="${k === ci ? 'on' : ''}"></span>`).join('')}</div>
<div>${ci ? '<button id="introPrev">戻る</button>' : ''}<button id="introNext">${ci === CARDS.length - 1 ? 'はじめる' : '次へ'}</button></div>
<div><button id="introSkip">飛ばす</button></div>`;
    intro.style.display = 'flex';
    $('introNext').onclick = () => (ci === CARDS.length - 1 ? endIntro() : showIntro(ci + 1));
    if ($('introPrev')) $('introPrev').onclick = () => showIntro(ci - 1);
    $('introSkip').onclick = endIntro;
    setTip('', '');
  }
  function endIntro() { intro.style.display = 'none'; H.intro = 1; hSave(); helpTick(); }

  // ---------- 使い方ナビ（レクチャー） ----------
  // 手順（上から順に、まだ終わっていない最初のものを出す）。t：文、el：光らせる場所、ok：終わった条件、on：出してよい条件
  const STEPS = [
    {id:'sel', t:'パノラマの<b>山の名前をタップ</b>してみましょう。標高・方角・距離と、山の説明が出ます。', el:() => $('panoWrap'), ok:() => selIdx >= 0, on:() => labels.length > 0},
    {id:'sync', t:'<b>「向きに合わせる」</b>を押して、スマホを写真を撮るように立てて、山のほうへ向けてみましょう。', el:() => $('syncBtn'), ok:() => sync, on:() => sensorOk() && labels.length > 0},
    {id:'find', t:'山の名前を<b>中央の赤い線に2秒</b>合わせると「見つけた」！ 図鑑に記録されます。', el:() => sync ? $('panoBox') : $('syncBtn'), ok:() => Object.keys(zukan.peaks).length > 0, on:() => sensorOk() && labels.length > 0},
    {id:'zukan', t:'<b>「📖 図鑑」</b>を開いてみましょう。見つけた山・名山スタンプ帳・バッジが見られます。', el:() => $('zkBtn'), ok:() => H.done.zukanOpen, on:() => true},
    {id:'today', t:'<b>「☀ 今日」</b>を開くと、今日のお題と「今日は見える？」予報が見られます。', el:() => $('tdBtn'), ok:() => H.done.tdOpen, on:() => true},
    {id:'preview', t:'<b>「山名で探す」</b>に山の名前（例：富士山）を入れて候補を選ぶと、その山頂からの眺めを予習できます。', el:() => $('peakQ'), ok:() => H.done.prev, on:() => true},
    {id:'sky', t:'<b>「🌌 星空」</b>を押すと、山並みの上の星座や、今夜山から昇る星が分かります。', el:() => $('skyBtn'), ok:() => H.done.skyOpen, on:() => SKY_OK && !!prof},
    {id:'cam', t:'<b>「📷 カメラ」</b>で、カメラの映像に山の名前を重ねて見られます。合わないときは画面をなぞって合わせます。', el:() => $('camBtn'), ok:() => H.done.camOpen, on:() => sensorOk() && !!prof}
  ];
  $('tipX').onclick = () => { closedKey = tipKey; setTip('', ''); };
  // 終わった印（画面を開いた）
  $('zkBtn').addEventListener('click', () => { H.done.zukanOpen = 1; hSave(); });
  $('tdBtn').addEventListener('click', () => { H.done.tdOpen = 1; hSave(); });
  $('skyBtn').addEventListener('click', () => { H.done.skyOpen = 1; hSave(); });
  $('camBtn').addEventListener('click', () => { if (sensorOk()) { H.done.camOpen = 1; hSave(); } });
  function helpTick() {
    if (intro.style.display === 'flex' || helpOpen()) return setTip('', '');
    if (shown('zk') || shown('td') || shown('cam')) return setTip('', ''); // 図鑑・今日・カメラの画面の上には出さない
    if (preview) H.done.prev = 1;
    // いつでも出すもの（ナビ OFF でも）：地図で場所を選んでいる間
    if (pick) return setTip('pick', '<b>地図をタップ</b>して、山を見たい場所を選んでください。拡大してから選ぶと正確です。', $('map'));
    if (!H.on) return setTip('', '');
    if (!obs && /現在地を取得中/.test($('status').textContent)) return setTip('pos', '現在地を探しています。位置情報の確認が出たら<b>「許可」</b>を選んでください（見える山を計算するためだけに使います）。', $('gpsBtn'));
    if (running || !prof) return setTip('', '');
    // 予習中は「現在地に戻る」を案内
    if (preview) return setTip('back', '山頂からの眺めを予習中です。山名をタップして説明を見たり、🌌 星空を見たりできます。終わったら<b>「現在地に戻る」</b>。', $('previewBar').querySelector('button'));
    // レクチャー
    let step = null;
    for (const s of STEPS) {
      if (H.done[s.id]) continue;
      if (s.ok()) { H.done[s.id] = 1; hSave(); continue; }
      if (s.on()) { step = s; break; }
    }
    if (step) return setTip('s:' + step.id, step.t, step.el());
    // 全部終わった（スマホ専用の手順は、パソコンでは数えない）
    const must = s => !((s.id === 'sync' || s.id === 'find' || s.id === 'cam') && !sensorOk()) && !(s.id === 'sky' && !SKY_OK);
    if (!H.done.finish && STEPS.every(s => H.done[s.id] || !must(s))) {
      if (!finishAt) finishAt = Date.now();
      if (Date.now() - finishAt > 10000) { H.done.finish = 1; H.on = false; $('helpChk').checked = false; hSave(); return setTip('', ''); }
      return setTip('finish', '<b>レクチャー完了！</b> いつでも「？ 使い方」で説明を見られます。使い方ナビはまもなく自動で OFF になります。', $('helpAll'));
    }
    setTip('', '');
  }
  setInterval(() => { if (!document.hidden) helpTick(); }, 1000);
  if (!H.intro) showIntro(0); else helpTick(); // 初めて開いたときだけ紹介
})();
