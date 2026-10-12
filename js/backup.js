// YamaMiru：記録の書き出し・読み込み（スマホとパソコンなど、端末ごとに別々の記録を移すため）
// zukan.js・quest.js・forecast.js のあと、main.js の前に読み込む
// 書き出す記録：図鑑（見つけた山・登った山・スコア・バッジ）、お題、見えた記録、お気に入り地点
// 補正やカメラの合わせは機種ごとに違うので移さない。SoraMiru など同じ場所に保存しているほかのアプリの記録も含めない
const BK_KEYS = ['yama_zukan_v1', 'yama_quest_v1', 'yama_seen_v1', 'yama_fav_v1'];
// 記録の中身のあらまし（確認の文に使う）
function bkSummary(z) {
  const peaks = Object.keys((z && z.peaks) || {}).length, climbs = Object.keys((z && z.climbs) || {}).length;
  return `見つけた山 ${peaks}座・登った山 ${climbs}座・スコア ${((z && z.score) || 0).toLocaleString()}点`;
}
function bkExport() {
  saveZukan(); // いまの記録を保存し直してから書き出す
  const data = {};
  BK_KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v) data[k] = JSON.parse(v); } catch (e) {} });
  if (!data.yama_zukan_v1) { toast('書き出す記録がありません'); return; }
  const body = JSON.stringify({app:'YamaMiru', ver:1, t:Date.now(), data});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], {type:'application/json'}));
  a.download = `YamaMiru記録_${dateStr(new Date())}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  toast(`記録を書き出しました（${bkSummary(data.yama_zukan_v1)}）`, 4000);
}
function bkImport(file) {
  const rd = new FileReader();
  rd.onload = () => {
    let j = null;
    try { j = JSON.parse(rd.result); } catch (e) {}
    if (!j || j.app !== 'YamaMiru' || !j.data || !j.data.yama_zukan_v1 || !j.data.yama_zukan_v1.peaks) {
      alert('YamaMiru の記録のファイルではないようです。「記録を書き出す」で作ったファイルを選んでください。'); return;
    }
    const when = new Date(j.t || 0);
    if (!confirm(`${when.getFullYear()}年${mdw(when)}に書き出した記録（${bkSummary(j.data.yama_zukan_v1)}）を読み込みます。\n\nこの端末の今の記録（${bkSummary(zukan)}）は置きかわります。よろしいですか？`)) return;
    try {
      BK_KEYS.forEach(k => { if (j.data[k]) localStorage.setItem(k, JSON.stringify(j.data[k])); else localStorage.removeItem(k); });
    } catch (e) { alert('読み込めませんでした（保存する場所が足りない可能性があります）'); return; }
    alert('記録を読み込みました。画面を読み込み直します。');
    location.reload(); // 読み込んだ記録で画面を作り直す
  };
  rd.onerror = () => alert('ファイルを読めませんでした');
  rd.readAsText(file);
}
$('bkOut').onclick = bkExport;
$('bkIn').onclick = () => { $('bkFile').value = ''; $('bkFile').click(); };
$('bkFile').onchange = () => { const f = $('bkFile').files[0]; if (f) bkImport(f); };
