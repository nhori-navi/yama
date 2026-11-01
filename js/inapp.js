// YamaMiru：版12（版13：MichiMiru 版23 の「戻る帯」があるときは 🚶 を出さない）MichiMiru の Android アプリの中で、MichiMiru の上に重ねて開いているときだけ動く部分（Chrome では何もしない）
// ・左上に「🚶」（MichiMiru に戻る）。スマホの「戻る」は、図鑑・今日・カメラなどを閉じてから MichiMiru に戻る
// ・記録の書き出しは、MichiMiru に頼んでスマホの「Documents」フォルダーへ（アプリの中ではダウンロードが使えないため）
(window.YAMA_FV = window.YAMA_FV || {}).inapp = 17;
const IN_MICHI = (() => { try { return window.parent !== window && typeof window.parent.miruClose === 'function'; } catch (e) { return false; } })();
(function () {
  if (!IN_MICHI) return;
  const P = window.parent;
  const say = m => { try { toast(m, 4500); } catch (e) {} };
  const st = document.createElement('style');
  st.textContent = '#miruBack{position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:9;width:44px;height:44px;border-radius:22px;border:0;' +
    'background:#1e7e34;color:#fff;font-size:21px;box-shadow:0 1px 5px rgba(0,0,0,.35)}';
  document.head.appendChild(st);
  const b = document.createElement('button');
  b.id = 'miruBack'; b.type = 'button'; b.title = 'MichiMiru に戻る'; b.textContent = '🚶';
  b.onclick = () => { try { P.miruClose(); } catch (e) {} };
  if (!P.miruStrip) document.body.appendChild(b); // 版13：MichiMiru 版23 からは画面の上の緑の帯で戻る
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && /^blob:/.test(this.href) && typeof P.nativeSaveFile === 'function') {
      const a = this, name = a.download;
      fetch(a.href).then(r => r.blob()).then(bl => { if (!P.nativeSaveFile(name, bl, (ok, m) => say(m))) click.call(a); }).catch(() => click.call(a));
      return;
    }
    return click.call(this);
  };
  if (typeof appUi === 'function') {
    appUi = function () {
      const s = $('appState'), a = $('appAdd'), h = $('appHow');
      if (s) s.textContent = '📱 MichiMiru アプリの中で開いています（' + (P.miruStrip ? '画面の上の緑の帯' : '左上の「🚶」') + 'で MichiMiru に戻ります）';
      if (a) a.style.display = 'none';
      if (h) h.style.display = 'none';
    };
    appUi();
  }
})();
// 版17：ホーム画面から開いたシリーズの TOP（Web 版のミルトコ）から来たときは、左上に「TOP に戻る」（ミルトコのアイコン。🚶 と同じ場所・同じ重なり順）
(function () {
  let web = false; try { web = !IN_MICHI && window.parent === window && sessionStorage.getItem('toko_web') === '1'; } catch (e) {}
  if (!web) return;
  const st = document.createElement('style');
  st.textContent = '#tokoBack{position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:9;width:44px;height:44px;border-radius:22px;border:0;padding:0;' +
    'background:#2f4c53;box-shadow:0 1px 5px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center}#tokoBack img{width:30px;height:30px;border-radius:8px}' +
    'body.toko-back #yTop{padding-left:60px}';   // 上の行（使い方ナビ・状況の文）がボタンに隠れないように右へ
  document.head.appendChild(st);
  const b = document.createElement('button');
  b.id = 'tokoBack'; b.type = 'button'; b.title = 'ミルトコの TOP に戻る'; b.setAttribute('aria-label', 'ミルトコの TOP に戻る');
  b.innerHTML = '<img src="../toko/img/icon.svg" alt="">';
  b.onclick = () => { location.href = '../?home=1'; };
  document.body.appendChild(b); document.body.classList.add('toko-back');
})();
