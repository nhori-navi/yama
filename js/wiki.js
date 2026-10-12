// YamaMiru：山の説明（Wikipedia）
// ---------- 山の説明（Wikipedia） ----------
// 保存形式：{items:{WikidataのID:{t:取得日時, title:記事名, text:冒頭の説明, img:写真のURL, url:記事のURL, loc:[所在地], range:[山系]}}}
const WIKI_STORE = 'yama_wiki_v1', WIKI_DAYS = 180, WIKI_MAX = 300, WIKI_WAIT = 15000;
const WDAPI = 'https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetentities';
const wikiReq = {}; // 同じ山を同時に何度も取りに行かないため
const mkEl = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = txt; return e; };
function wikiCache() {
  try { const c = JSON.parse(localStorage.getItem(WIKI_STORE) || 'null'); if (c && c.items) return c; } catch (e) {}
  return {items:{}};
}
function wikiSave(id, v) {
  const c = wikiCache(); c.items[id] = v;
  const keys = Object.keys(c.items).sort((a, b) => c.items[a].t - c.items[b].t);
  while (keys.length > WIKI_MAX) delete c.items[keys.shift()]; // 多すぎたら古いものから消す
  try { localStorage.setItem(WIKI_STORE, JSON.stringify(c)); } catch (e) {}
}
async function getWiki(id) {
  const c = wikiCache().items[id];
  if (c && Date.now() - c.t < WIKI_DAYS * 86400000) return c;
  if (!wikiReq[id]) wikiReq[id] = fetchWiki(id).finally(() => { delete wikiReq[id]; });
  return wikiReq[id];
}
async function fetchWiki(id) {
  // 1. Wikidata：日本語版Wikipediaの記事名、所在地（P131）、山系（P4552）
  const r = await tfetch(`${WDAPI}&ids=${id}&props=sitelinks|claims&sitefilter=jawiki`, {}, WIKI_WAIT);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const e = ((await r.json()).entities || {})[id] || {};
  const title = e.sitelinks && e.sitelinks.jawiki && e.sitelinks.jawiki.title;
  const ids = p => ((e.claims || {})[p] || []).map(s => s.mainsnak && s.mainsnak.datavalue && s.mainsnak.datavalue.value && s.mainsnak.datavalue.value.id).filter(Boolean);
  const locIds = ids('P131').slice(0, 3), rangeIds = ids('P4552').slice(0, 2), labels = {};
  if (locIds.length + rangeIds.length) {
    try {
      const r2 = await tfetch(`${WDAPI}&ids=${[...locIds, ...rangeIds].join('|')}&props=labels&languages=ja`, {}, WIKI_WAIT);
      if (r2.ok) Object.entries((await r2.json()).entities || {}).forEach(([k, x]) => { if (x.labels && x.labels.ja) labels[k] = x.labels.ja.value; });
    } catch (er) {}
  }
  const v = {t:Date.now(), loc:locIds.map(x => labels[x]).filter(Boolean), range:rangeIds.map(x => labels[x]).filter(Boolean)};
  // 2. Wikipedia：記事の要約と代表の写真
  if (title) {
    const r3 = await tfetch('https://ja.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')), {}, WIKI_WAIT);
    if (r3.ok) {
      const s = await r3.json(), sent = String(s.extract || '').split(/(?<=。)/).slice(0, 3).join(''); // 最初の3文
      v.title = title;
      v.text = sent.length > 160 ? sent.slice(0, 158) + '…' : sent;
      v.img = (s.thumbnail && s.thumbnail.source) || '';
      v.url = (s.content_urls && s.content_urls.mobile && s.content_urls.mobile.page) || 'https://ja.wikipedia.org/wiki/' + encodeURIComponent(title);
    } else if (r3.status !== 404) throw new Error('HTTP ' + r3.status);
  }
  wikiSave(id, v);
  return v;
}
// 説明の欄を作る（o：山。id があるときだけ説明を取りに行く）
function wikiBox(o, box) {
  box.innerHTML = '';
  if (!o.id) { box.textContent = '（この山の説明はありません）'; return; }
  box.dataset.id = o.id; box.textContent = '説明を読み込み中…';
  getWiki(o.id).then(v => {
    if (box.dataset.id !== o.id || !box.isConnected) return; // 別の山に切り替わっていたら表示しない
    box.innerHTML = '';
    const facts = [v.loc.length ? '所在地：' + v.loc.join('・') : '', v.range.length ? '山系：' + v.range.join('・') : ''].filter(Boolean).join('　');
    if (!v.text && !facts) { box.textContent = '（この山の説明はまだありません）'; return; }
    const wrap = mkEl('div', 'wk', ''), tx = mkEl('div', '', '');
    if (v.img) { const im = document.createElement('img'); im.src = v.img; im.alt = ''; im.loading = 'lazy'; wrap.appendChild(im); }
    if (v.text) tx.appendChild(mkEl('div', '', v.text));
    if (facts) tx.appendChild(mkEl('div', 'src', facts));
    if (v.url) {
      const s = mkEl('div', 'src', ''), a = mkEl('a', '', 'Wikipediaで続きを読む');
      a.href = v.url; a.target = '_blank'; a.rel = 'noopener'; a.onclick = ev => ev.stopPropagation();
      s.appendChild(a); s.appendChild(document.createTextNode('（出典：Wikipedia）')); tx.appendChild(s);
    }
    wrap.appendChild(tx); box.appendChild(wrap);
  }).catch(er => { if (box.dataset.id === o.id) box.textContent = '説明を読み込めませんでした（' + errText(er, WIKI_WAIT) + '）'; });
}
