// stored-xss-challenge: routes the first stored-xss test did not cover, published (src) vs fixed (main).
//  PREV  : a real Regenerate leaves the old turn in turns[last].alts[]. Only alts[0].n is poisoned. Load validation checks
//          turns[].n but not alts[]; one click on 'Previous version' swaps the alt in and renders it. Import + store routes.
//  PREVC : control, same save unpoisoned, Previous version click must still work (normal flow).
//  SYNC  : page A is open on a clean save; another device writes a newer rev whose last turn has alts={length:payload}.
//          No reload, no click: a window focus event runs syncFromStore and renders it.
//  HAL   : Halloway world (no transformation), alts={length:payload} via store (zero-click) and alt.n via import + click.
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const H = (process.env.WL_ROOT ? process.env.WL_ROOT + '/' : 'C:/Users/marcu/AppData/Local/Temp/wl-harness/');
const BUILDS = { src: { htmlPath: H + 'src/index.html', worldsDir: H + 'src/worlds' }, main: { htmlPath: H + 'main/index.html', worldsDir: H + 'main/worlds' } };
const clone = (x) => JSON.parse(JSON.stringify(x));
const PAY = (tag) => '<img src=x onerror=window.__pwned=1 data-f=' + tag + '><svg data-f=' + tag + ' onload=window.__pwned=2>';

function instrument(win) {
  win.__sink = []; win.__injEls = []; win.__mo = new Set();
  const re = /<(?:img|svg)\b[^>]*\bdata-f=([\w-]+)/gi;
  const rec = (html, el, sink) => { const s = String(html); let m; const tags = new Set(); re.lastIndex = 0; while ((m = re.exec(s))) tags.add(m[1]); if (tags.size) win.__sink.push({ sink, at: (el && (el.id || el.className || el.tagName)) || '?', tags: [...tags] }); return tags.size; };
  const findDesc = (name) => { let p = win.Element.prototype; while (p) { const d = Object.getOwnPropertyDescriptor(p, name); if (d) return d; p = Object.getPrototypeOf(p); } return null; };
  for (const name of ['innerHTML', 'outerHTML']) {
    const d = findDesc(name); if (!d || !d.set) continue;
    Object.defineProperty(win.Element.prototype, name, { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { const hit = rec(v, this, name); const parent = name === 'outerHTML' ? this.parentNode : null; d.set.call(this, v); if (hit) { const root = name === 'outerHTML' ? parent : this; if (root && root.querySelectorAll) win.__injEls.push(...root.querySelectorAll('[data-f]')); } } });
  }
  const iah = win.Element.prototype.insertAdjacentHTML;
  win.Element.prototype.insertAdjacentHTML = function (pos, html) { const hit = rec(html, this, 'insertAdjacentHTML'); const r = iah.call(this, pos, html); if (hit) win.__injEls.push(...(this.parentNode || this).querySelectorAll('[data-f]')); return r; };
  const mo = new win.MutationObserver((list) => { for (const r of list) for (const n of r.addedNodes) { if (n.nodeType !== 1) continue; if (n.matches('[data-f]')) win.__mo.add(n.getAttribute('data-f')); n.querySelectorAll('[data-f]').forEach((e) => win.__mo.add(e.getAttribute('data-f'))); } });
  mo.observe(win.document, { childList: true, subtree: true });
}
function scan(h) {
  const w = h.window, d = h.document;
  const domEls = [...d.querySelectorAll('[data-f]')];
  let onAttrs = 0; for (const el of d.querySelectorAll('*')) for (const a of el.attributes) if (/^on/i.test(a.name) && /__pwned/.test(a.value)) onAttrs++;
  for (const el of new Set([...domEls, ...w.__injEls])) { try { el.dispatchEvent(new w.Event(el.tagName.toLowerCase() === 'img' ? 'error' : 'load')); } catch (e) {} }
  const tags = new Set(w.__sink.flatMap((x) => x.tags)); domEls.forEach((e) => tags.add(e.getAttribute('data-f'))); w.__mo.forEach((t) => tags.add(t));
  return { tags: [...tags].sort().join(',') || 'none', dom: domEls.length, onAttrs, pwned: w.__pwned, sinks: [...new Set(w.__sink.map((x) => x.at))].join(' ') || 'none' };
}
const turnLabels = (h) => [...h.document.querySelectorAll('#feed .turn .turn-meta .n')].map((e) => e.textContent.slice(0, 30)).join('|');
const lastNarr = (h) => { const t = [...h.document.querySelectorAll('#feed .turn .narr')].pop(); return t ? t.textContent.slice(-12) : ''; };

async function waitTurnFrom(h, before) { const t0 = Date.now(); while (Date.now() - t0 < 1500 && h.mock.sampleCalls.length === before) await h.sleep(10); await h.idle(20000); }

// a real save from the published build: 2 turns, then Regenerate so the last turn carries a genuine alts[] entry
async function makeBase(world) {
  const h = await boot(BUILDS.src);
  await h.settle(150, 6000);
  if (world && world !== 'sundered') { h.click('#cBegin'); await h.idle(); h.click('#btnAdventures'); await h.settle(80, 4000); h.type('#newWorld', world); h.click('#newAdv'); await h.settle(120, 6000); }
  h.click('#cBegin'); await h.idle();
  await h.turn('Look around'); await h.turn('Walk on');
  const n0 = h.mock.sampleCalls.length; h.click('#regen'); await waitTurnFrom(h, n0);
  h.click('#btnAdventures'); await h.idle(); h.click('#exportAdv'); await h.idle();
  const p = JSON.parse(h.mock.downloadsLog[h.mock.downloadsLog.length - 1].data);
  h.close(); return p;
}

async function importInto(h, save) {
  h.click('#btnAdventures'); await h.idle();
  const file = new h.window.File([JSON.stringify(save)], 'save.json', { type: 'application/json' });
  const inp = h.$('#importFile'); Object.defineProperty(inp, 'files', { value: [file], configurable: true });
  inp.dispatchEvent(new h.window.Event('change', { bubbles: true })); await h.idle(); await h.settle(100, 6000);
  if (h.$('#dlgAdventures').hasAttribute('open')) h.$('#dlgAdventures').close();
}
function storeDoc(m, save, id, extra) {
  const doc = clone(save.adventure); doc.id = id; doc.updatedAt = new Date().toISOString(); doc.turnCount = save.turns.length; Object.assign(doc, extra || {});
  m.store.set('adventures/' + id, { data: doc, version: 1 });
  m.store.set('adventures/' + id + '/turns/0000', { data: { c: 0, turns: clone(save.turns) }, version: 1 });
}

async function runPrev(build, save, route, label, noClick) {
  const out = { label, build, route };
  let h;
  if (route === 'import') { h = await boot(Object.assign({}, BUILDS[build], { setup(w) { instrument(w); } })); await h.settle(150, 6000); h.click('#cBegin'); await h.idle(); await importInto(h, save); out.status = (h.$('#status').textContent || '').slice(0, 70); }
  else { h = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { instrument(w); storeDoc(m, save, 'advchal' + label.toLowerCase()); } })); await h.settle(200, 8000); await h.idle(); out.status = (h.$('#status').textContent || '').slice(0, 70); }
  out.beforeClick = scan(h); out.labelsBefore = turnLabels(h); out.narrBefore = lastNarr(h);
  const pv = h.$('[data-prevver]'); out.prevBtn = pv ? pv.textContent : 'none';
  if (pv && !noClick) { h.click(pv); await h.idle(); await h.settle(100, 4000); }
  out.after = scan(h); out.labelsAfter = turnLabels(h); out.narrAfter = lastNarr(h);
  out.errors = h.errors.map((e) => e.message.split('\n')[0].slice(0, 140)); out.viol = h.mock.violations.map((v) => v.kind);
  // what was persisted for the swapped-in turn
  const chunk = [...h.mock.store.entries()].filter(([k]) => /\/turns\/\d+$/.test(k)).map(([, v]) => v.data.turns).flat().pop();
  out.storedLastN = chunk ? String(chunk.n).slice(0, 25) : '-';
  h.close(); return out;
}

async function runSync(build, cleanSave, badSave, label) {
  const out = { label, build, route: 'sync-focus' };
  const id = 'advsync' + label.toLowerCase();
  const h = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { instrument(w); storeDoc(m, cleanSave, id); } }));
  await h.settle(200, 8000); await h.idle();
  out.loadedClean = h.document.querySelectorAll('#feed .turn').length; out.clean = scan(h);
  // the other device writes a newer save (higher rev, later updatedAt) with a poisoned last turn
  const cur = h.mock.store.get('adventures/' + id).data;
  const doc = clone(badSave.adventure); doc.id = id; doc.turnCount = badSave.turns.length; doc.rev = (cur.rev || 0) + 3; doc.updatedAt = new Date(Date.now() + 60000).toISOString();
  h.mock.store.set('adventures/' + id, { data: doc, version: 99 });
  h.mock.store.set('adventures/' + id + '/turns/0000', { data: { c: 0, turns: clone(badSave.turns) }, version: 99 });
  h.window.dispatchEvent(new h.window.Event('focus')); await h.sleep(50); await h.idle(); await h.settle(100, 4000);
  out.status = (h.$('#status').textContent || '').slice(0, 80);
  out.after = scan(h);
  out.errors = h.errors.map((e) => e.message.split('\n')[0].slice(0, 140)); out.viol = h.mock.violations.map((v) => v.kind);
  h.close(); return out;
}


// mode 'persist': after the poisoned Previous-version click, reboot the same build on the same store and see what loads.
async function runPersist(build, save) {
  const shared = new Map();
  const h = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { m.store = shared; instrument(w); storeDoc(m, save, 'advpersist'); } }));
  await h.settle(200, 8000); await h.idle();
  const pv = h.$('[data-prevver]'); if (pv) { h.click(pv); await h.idle(); await h.settle(100, 4000); }
  const first = scan(h); h.close();
  const h2 = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { m.store = shared; instrument(w); } }));
  await h2.settle(200, 8000); await h2.idle();
  const second = scan(h2);
  const out = { build, firstPwned: first.pwned, reboot: { pwned: second.pwned, tags: second.tags, status: (h2.$('#status').textContent || '').slice(0, 80), note: h2.$('#summaryNote').textContent, createOpen: h2.$('#dlgCreate').hasAttribute('open'), turns: h2.document.querySelectorAll('#feed .turn').length }, errors: h2.errors.length, viol: h2.mock.violations.length };
  h2.close(); return out;
}
if (process.argv[2] === 'persist') {
  (async () => { const base = await makeBase('sundered'); const bad = clone(base); bad.turns[bad.turns.length - 1].alts[0].n = PAY('altn');
    for (const b of ['src', 'main']) console.log('[PERSIST / ' + b + '] ' + JSON.stringify(await runPersist(b, bad)));
    process.exit(0); })().catch((e) => { console.error(e); process.exit(1); });
}
process.on('unhandledRejection', (e) => console.log('UNHANDLED: ' + String(e && e.message || e).slice(0, 160)));
if (process.argv[2] !== 'persist') (async () => {
  const t0 = Date.now();
  const base = await makeBase('sundered');
  const last = base.turns[base.turns.length - 1];
  console.log('sundered base: turns', base.turns.length, 'last.alts', Array.isArray(last.alts) ? last.alts.length : typeof last.alts, 'alt0.n', last.alts && last.alts[0] && last.alts[0].n, 'alt0 keys', last.alts && last.alts[0] ? Object.keys(last.alts[0]).length : 0);

  const prevBad = clone(base); prevBad.turns[prevBad.turns.length - 1].alts[0].n = PAY('altn');
  const altsObj = clone(base); altsObj.turns[altsObj.turns.length - 1].alts = { length: PAY('altslen') };

  const R = [];
  for (const route of ['import', 'store']) for (const b of ['src', 'main']) R.push(await runPrev(b, base, route, 'PREVC'));
  for (const route of ['import', 'store']) for (const b of ['src', 'main']) R.push(await runPrev(b, prevBad, route, 'PREV'));
  for (const b of ['src', 'main']) R.push(await runSync(b, base, altsObj, 'SYNC'));

  const hal = await makeBase('halloway');
  const hl = hal.turns[hal.turns.length - 1];
  console.log('halloway base: world', hal.adventure.worldId, 'turns', hal.turns.length, 'last.alts', Array.isArray(hl.alts) ? hl.alts.length : typeof hl.alts, 'tf', !!(hal.adventure.state.tf));
  const halAlts = clone(hal); halAlts.turns[halAlts.turns.length - 1].alts = { length: PAY('halalts') };
  const halPrev = clone(hal); halPrev.turns[halPrev.turns.length - 1].alts[0].n = PAY('halaltn');
  for (const b of ['src', 'main']) R.push(await runPrev(b, halAlts, 'store', 'HALALTS', true));
  for (const b of ['src', 'main']) R.push(await runPrev(b, halPrev, 'import', 'HALPREV'));

  console.log('\n=== SIDE BY SIDE ===');
  for (const r of R) {
    if (r.route === 'sync-focus') {
      console.log('\n[' + r.label + ' / ' + r.route + ' / ' + r.build + '] loadedClean=' + r.loadedClean + ' cleanTags=' + r.clean.tags + ' | after focus: pwned=' + r.after.pwned + ' tags=' + r.after.tags + ' onAttrs=' + r.after.onAttrs + ' sinks=' + r.after.sinks + ' errors=' + r.errors.length + ' viol=' + r.viol.length);
      console.log('  status: ' + JSON.stringify(r.status));
    } else {
      console.log('\n[' + r.label + ' / ' + r.route + ' / ' + r.build + '] before click: pwned=' + r.beforeClick.pwned + ' tags=' + r.beforeClick.tags + ' | prevBtn=' + JSON.stringify(r.prevBtn) + ' | after click: pwned=' + r.after.pwned + ' tags=' + r.after.tags + ' onAttrs=' + r.after.onAttrs + ' sinks=' + r.after.sinks + ' errors=' + r.errors.length + ' viol=' + r.viol.length);
      console.log('  status: ' + JSON.stringify(r.status) + ' | labels before ' + JSON.stringify(r.labelsBefore) + ' after ' + JSON.stringify(r.labelsAfter) + ' | narr ' + JSON.stringify(r.narrBefore) + ' -> ' + JSON.stringify(r.narrAfter) + ' | storedLastN=' + JSON.stringify(r.storedLastN));
    }
    if (r.errors.length) console.log('  errors: ' + r.errors.slice(0, 3).join(' || '));
    if (r.viol.length) console.log('  violations: ' + r.viol.slice(0, 5).join(','));
  }
  console.log('\nelapsed', Math.round((Date.now() - t0) / 1000), 's');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
