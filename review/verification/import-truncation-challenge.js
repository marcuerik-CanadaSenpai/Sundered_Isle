'use strict';
// Challenge for import-truncation. Routes the tester did not cover, run on published (src) and fixed (main):
//  A  undo twice right after a 25-turn import (same page), check state, take a turn, reload on a second page
//     (+ cross: published 25-turn save into fixed; + baseline: undo x2 in a normally played 4-turn game)
//  B  import while a turn is running (model call held open), then reload
//  C  Halloway 12-turn save imported while a Sundered Isle adventure is open, reload, next turn, reload
//  D  oversized save: 11 turns with ~30 KiB narratives (chunk 0 would be over 256 KiB)
//  E  db failure on the adventure document write (not a chunk) during import
//  F  hand-edited save with the turns array reversed, then a turn and a reload
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || 'C:/Users/marcu/AppData/Local/Temp/wl-harness';
const BUILDS = {
  src: { htmlPath: ROOT + '/src/index.html', worldsDir: ROOT + '/src/worlds' },
  main: { htmlPath: ROOT + '/main/index.html', worldsDir: ROOT + '/main/worlds' },
};
const unhandled = [];
let phase = 'init';
process.on('unhandledRejection', (e) => { unhandled.push(phase + ': ' + String((e && e.stack) || e).split(/\r?\n/).slice(0, 2).join(' <- ').slice(0, 160)); });
const pages = [];
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';

async function page(build, store) {
  const h = await boot({ htmlPath: BUILDS[build].htmlPath, worldsDir: BUILDS[build].worldsDir, setup(w, m) { m.store = store; } });
  pages.push({ build, h });
  await h.settle(150, 6000); await h.idle(8000);
  return h;
}
async function begin(h) { h.click('#cBegin'); await h.settle(100, 8000); await h.idle(15000); }
function feed(h) {
  return [...h.document.querySelectorAll('#feed article.turn')].filter((e) => !e.classList.contains('draft')).map((e) => {
    const n = ((e.querySelector('.turn-meta .n') || {}).textContent || '').trim();
    const a = e.querySelector('.turn-action');
    return { n, action: a && a.firstChild ? String(a.firstChild.textContent).trim() : '' };
  });
}
function closeAdv(h) { const d = h.$('#dlgAdventures'); if (d && d.hasAttribute('open')) d.close(); }
async function listRows(h) {
  h.click('#btnAdventures'); await h.sleep(20); await h.settle(80, 4000);
  return [...h.document.querySelectorAll('#advlist .advrow')].map((r) => ({ title: r.querySelector('.t').textContent, meta: r.querySelector('.m').textContent, open: r.querySelector('[data-act="open"]') }));
}
async function current(h) { const rows = await listRows(h); const c = rows.find((r) => r.open && r.open.textContent === 'Current'); closeAdv(h); return c ? c.title : null; }
const statusOf = (h) => ((h.$('#status') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 110);
async function exportNow(h) {
  const before = h.mock.downloadsLog.length;
  h.click('#btnAdventures'); await h.settle(80, 4000);
  h.click('#exportAdv'); await h.sleep(20); await h.settle(80, 4000);
  closeAdv(h);
  const d = h.mock.downloadsLog[before];
  return d ? String(d.data) : (h.$('#exportText') ? h.$('#exportText').value : null);
}
async function fireImport(h, text, name) {
  const win = h.window; const file = new win.File([text], name || 'save.json', { type: 'application/json' });
  const inp = h.$('#importFile'); Object.defineProperty(inp, 'files', { value: [file], configurable: true });
  inp.dispatchEvent(new win.Event('change', { bubbles: true }));
}
async function importText(h, text, name) { await fireImport(h, text, name); await h.sleep(60); await h.settle(200, 15000); await h.idle(15000); return statusOf(h); }
const advDocs = (store) => [...store.keys()].filter((k) => /^adventures\/[^/]+$/.test(k));
const range = (arr) => { if (!arr.length) return 'none'; const out = []; let s = arr[0], p = arr[0]; for (let i = 1; i <= arr.length; i++) { const x = arr[i]; if (x === p + 1) { p = x; continue; } out.push(s === p ? String(s) : s + '-' + p); s = p = x; } return out.join(','); };
const nums = (f) => f.filter((r) => r.n !== 'Turn 0').map((r) => Number(r.n.replace('Turn ', '')));
const desc = (f) => { const x = nums(f); return x.length + ' [' + range(x) + ']'; };
// open the row whose title matches re (switching away first if it is already current), return feed + status
async function openRow(h, re) {
  let rows = await listRows(h); let r = rows.find((x) => re.test(x.title));
  if (!r) { closeAdv(h); return { found: false, rows: rows.map((x) => x.title + ' ' + x.meta).join(' / ') }; }
  if (r.open.textContent === 'Current') { const other = rows.find((x) => !re.test(x.title)); if (other) { other.open.click(); await h.idle(8000); rows = await listRows(h); r = rows.find((x) => re.test(x.title)); } }
  const meta = r.meta; if (r.open.textContent !== 'Current') { r.open.click(); await h.idle(8000); }
  closeAdv(h);
  return { found: true, meta: meta.split('·')[1] ? meta.split('·')[1].trim() : meta, feed: feed(h), status: statusOf(h), cur: await current(h) };
}
async function stateCheck(h) {
  try { h.click('#btnOverride'); await h.sleep(20); const v = h.$('#ovrState').value; const d = h.$('#dlgOverride'); if (d && d.hasAttribute('open')) d.close(); const s = JSON.parse(v); return Object.keys(s).length + ' keys, items=' + (s.items ? 'yes' : 'NO') + ', attitudes=' + (s.attitudes ? 'yes' : 'NO'); } catch (e) { return 'check threw ' + String(e.message).slice(0, 60); }
}
async function undoTwiceThenTurn(h, label) {
  const u0 = unhandled.length;
  h.click('#undo'); await h.sleep(30); await h.idle(8000); const u1 = nums(feed(h)).length;
  h.click('#undo'); await h.sleep(30); await h.idle(8000); const u2 = nums(feed(h)).length;
  const st = await stateCheck(h);
  await h.turn(label);
  const f = feed(h); const last = f[f.length - 1];
  return { u1, u2, state: st, afterTurn: desc(f) + ' last=' + (last ? last.n + ' ' + last.action : 'none'), status: statusOf(h), rejections: unhandled.length - u0 };
}
function storedDocSummary(store, re) {
  const k = advDocs(store).find((x) => re.test(String(store.get(x).data.title)));
  if (!k) return 'no doc';
  const d = store.get(k).data;
  const chunks = [...store.keys()].filter((x) => x.startsWith(k + '/turns/')).length;
  return 'doc turnCount=' + d.turnCount + ' memory=' + (d.memory === null ? 'NULL' : typeof d.memory) + ' state.items=' + (d.state && d.state.items ? 'yes' : 'NO') + ' chunks=' + chunks;
}

async function seed(b) {
  const S0 = new Map(); const A = await page(b, S0); await begin(A);
  for (let i = 1; i <= 25; i++) await A.turn('Action ' + i);
  const E25 = await exportNow(A);
  A.click('#btnAdventures'); await A.settle(80, 4000);
  A.type('#newWorld', 'halloway'); A.click('#newAdv'); await A.settle(120, 6000);
  await begin(A);
  for (let i = 1; i <= 12; i++) await A.turn('Hall ' + i);
  const H12 = await exportNow(A);
  const hw = JSON.parse(H12);
  console.log('[' + b + '] seed: sundered export ' + JSON.parse(E25).turns.length + ' turns, halloway export ' + hw.turns.length + ' turns world=' + (hw.adventure.worldId || hw.world.id) + ' (' + el() + ')');
  A.close();
  return { E25, H12 };
}

async function routeA(b, E25, tag) {
  phase = tag + ' A';
  const S = new Map(); const P = await page(b, S); await begin(P); await P.turn('Base 1');
  const st = await importText(P, E25, 'a.json');
  const before = desc(feed(P));
  const u = await undoTwiceThenTurn(P, 'After undo');
  P.close();
  const Q = await page(b, S); const bootStatus = statusOf(Q);
  const o = await openRow(Q, /\(imported\)/);
  Q.close();
  return 'import="' + st.slice(0, 40) + '" page ' + before + ' | undo1=' + u.u1 + ' undo2=' + u.u2 + ' state ' + u.state + ' rejections=' + u.rejections + ' | next turn ' + u.afterTurn + ' status="' + u.status.slice(0, 70) + '" | ' + storedDocSummary(S, /\(imported\)/) + ' | reload boot="' + bootStatus.slice(0, 60) + '" open ' + (o.found ? desc(o.feed) + ' list=' + o.meta + ' cur=' + o.cur + ' status="' + o.status.slice(0, 70) + '"' : 'ROW MISSING ' + o.rows);
}
async function baseline(b) {
  phase = b + ' baseline';
  const S = new Map(); const P = await page(b, S); await begin(P);
  for (let i = 1; i <= 4; i++) await P.turn('Play ' + i);
  const u = await undoTwiceThenTurn(P, 'After undo');
  P.close();
  const Q = await page(b, S); const f = feed(Q); const s = statusOf(Q); const cur = await current(Q); Q.close();
  return 'undo1=' + u.u1 + ' undo2=' + u.u2 + ' state ' + u.state + ' rejections=' + u.rejections + ' | next turn ' + u.afterTurn + ' | ' + storedDocSummary(S, /./) + ' | reload ' + desc(f) + ' cur=' + cur + ' status="' + s.slice(0, 60) + '"';
}
async function routeB(b, E25) {
  phase = b + ' B';
  const S = new Map(); const P = await page(b, S); await begin(P); await P.turn('Keep 1'); await P.turn('Keep 2');
  const curBefore = await current(P);
  let release; const gate = new Promise((r) => { release = r; }); let armed = true;
  P.mock.sampleHandler = async (input, opts, call) => { if (armed) { armed = false; await gate; } return P.mock.defaultHandler(input, opts, call); };
  P.$('#action').value = 'Mid turn'; P.click('#send');
  const tw = Date.now(); while (Date.now() - tw < 3000 && armed) await P.sleep(10);
  const busyShown = !P.$('#stop').hidden;
  await fireImport(P, E25, 'mid.json'); await P.sleep(300);
  const stDuring = statusOf(P);
  release(); P.mock.sampleHandler = null;
  await P.idle(20000); await P.settle(200, 8000);
  const curAfter = await current(P); const fP = feed(P); const lastP = fP[fP.length - 1];
  const stAfter = statusOf(P);
  P.close();
  const Q = await page(b, S); const rows = await listRows(Q); closeAdv(Q);
  const listing = rows.map((r) => r.title.replace(/ at The Sundered Isle/, '') + ' ' + (r.meta.split('·')[1] || '').trim()).join(' / ');
  const orig = await openRow(Q, new RegExp('^' + String(curBefore).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  const imp = rows.some((r) => /\(imported\)/.test(r.title)) ? await openRow(Q, /\(imported\)/) : null;
  Q.close();
  return 'busy=' + busyShown + ' status during="' + stDuring.slice(0, 60) + '" after="' + stAfter.slice(0, 50) + '" | page cur ' + (curAfter === curBefore ? 'kept' : 'switched') + ' ' + desc(fP) + ' last=' + (lastP && lastP.n + ' ' + lastP.action) + ' | reload list: ' + listing + ' | original reopened ' + (orig.found ? desc(orig.feed) + ' last=' + (orig.feed.length ? orig.feed[orig.feed.length - 1].action : '') : 'MISSING') + (imp ? ' | imported reopened ' + desc(imp.feed) + ' last=' + (imp.feed.length ? imp.feed[imp.feed.length - 1].action : '') : ' | no imported row');
}
async function routeC(b, H12) {
  phase = b + ' C';
  const exp = JSON.parse(H12).turns.map((t) => t.n);
  const S = new Map(); const P = await page(b, S); await begin(P); await P.turn('Base 1');
  const st = await importText(P, H12, 'hall.json'); const pf = desc(feed(P)); P.close();
  const Q = await page(b, S); const o = await openRow(Q, /\(imported\)/);
  const world = (Q.$('#worldTitle') || Q.$('header h1') || {}).textContent || '';
  let after = 'n/a';
  if (o.found) { await Q.turn('Hall after'); after = desc(feed(Q)); }
  Q.close();
  const R = await page(b, S); const o2 = await openRow(R, /\(imported\)/); R.close();
  const ok = o.found && JSON.stringify(nums(o.feed)) === JSON.stringify(exp);
  return (ok ? 'PASS' : 'FAIL') + ' import="' + st.slice(0, 50) + '" page ' + pf + ' | reload open ' + (o.found ? desc(o.feed) + ' list=' + o.meta : 'MISSING') + ' world="' + world.trim().slice(0, 30) + '" | ' + storedDocSummary(S, /\(imported\)/) + ' | next turn ' + after + ' | reload2 ' + (o2.found ? desc(o2.feed) : 'MISSING');
}
async function routeD(b, E25) {
  phase = b + ' D';
  const p = JSON.parse(E25); p.turns = p.turns.slice(0, 11);
  const pad = 'The harbour wind carries salt and old rope smells through the shutters. '.repeat(430); // ~30 KiB
  p.turns.forEach((t) => { t.narrative = t.narrative + ' ' + pad; });
  p.adventure.turnCount = 11;
  const S = new Map(); const P = await page(b, S); await begin(P); await P.turn('Keep 1'); await P.turn('Keep 2');
  const curBefore = await current(P); const v0 = P.mock.violations.length;
  const st = await importText(P, JSON.stringify(p), 'big.json');
  const curAfter = await current(P); const viol = P.mock.violations.slice(v0).map((v) => v.kind).join(',');
  const docs = advDocs(S).length; const orphan = [...S.keys()].filter((k) => /\/turns\//.test(k) && !advDocs(S).some((d) => k.startsWith(d + '/'))).length;
  await P.turn('Keep 3'); const fP = desc(feed(P)); P.close();
  const Q = await page(b, S); const qcur = await current(Q); const fq = desc(feed(Q));
  const imp = (await listRows(Q)).find((r) => /\(imported\)/.test(r.title)); closeAdv(Q);
  const impOpen = imp ? await openRow(Q, /\(imported\)/) : null; Q.close();
  return 'status="' + st.slice(0, 70) + '" cur ' + (curAfter === curBefore ? 'kept' : 'switched') + ' violations=[' + viol + '] adv docs=' + docs + ' orphan chunks=' + orphan + ' | next turn page ' + fP + ' | reload cur=' + (qcur === curBefore ? 'original' : qcur) + ' ' + fq + (impOpen ? ' | imported row opens ' + desc(impOpen.feed) + ' list=' + impOpen.meta : ' | no imported row');
}
async function routeE(b, E25) {
  phase = b + ' E';
  const S = new Map(); const P = await page(b, S); await begin(P); await P.turn('Keep 1'); await P.turn('Keep 2');
  const curBefore = await current(P); const keep = new Set(advDocs(S));
  P.mock.dbFail = (op, path) => (op === 'set' && /^adventures\/[^/]+$/.test(path) && !keep.has(path) ? { code: 'unavailable', message: 'injected doc failure' } : null);
  const st = await importText(P, E25, 'e.json');
  P.mock.dbFail = null;
  const curAfter = await current(P); const fA = desc(feed(P));
  const orphan = [...S.keys()].filter((k) => /\/turns\//.test(k) && !advDocs(S).some((d) => k.startsWith(d + '/'))).length;
  await P.turn('Keep 3'); const fP = desc(feed(P)); const lastP = feed(P).slice(-1)[0];
  P.close();
  const Q = await page(b, S); const qcur = await current(Q); const fq = desc(feed(Q)); const rows = await listRows(Q); closeAdv(Q); Q.close();
  return 'status="' + st.slice(0, 60) + '" cur ' + (curAfter === curBefore ? 'kept' : 'switched') + ' page ' + fA + ' orphan chunks=' + orphan + ' | next turn ' + fP + ' last=' + (lastP && lastP.action) + ' | reload cur=' + (qcur === curBefore ? 'original' : qcur) + ' ' + fq + ' rows=' + rows.length;
}
async function routeF(b, H12) {
  phase = b + ' F';
  const p = JSON.parse(H12); p.turns.reverse();
  const S = new Map(); const P = await page(b, S); await begin(P); await P.turn('Base 1');
  const st = await importText(P, JSON.stringify(p), 'rev.json'); const pf = feed(P);
  await P.turn('Rev after'); const f2 = feed(P); const last = f2[f2.length - 1]; P.close();
  const Q = await page(b, S); const o = await openRow(Q, /\(imported\)/); Q.close();
  return 'import="' + st.slice(0, 45) + '" page order [' + nums(pf).slice(0, 4).join(',') + '...] | next turn numbered ' + (last && last.n) + ' | ' + storedDocSummary(S, /\(imported\)/) + ' | reload open ' + (o.found ? desc(o.feed) + ' status="' + o.status.slice(0, 70) + '" cur=' + o.cur : 'MISSING');
}

(async () => {
  const out = { src: {}, main: {} }; const ex = {};
  for (const b of ['src', 'main']) {
    phase = b + ' seed'; ex[b] = await seed(b);
    out[b].A = await routeA(b, ex[b].E25, b); console.log('[' + b + '] A ' + out[b].A + ' (' + el() + ')');
    out[b].base = await baseline(b); console.log('[' + b + '] baseline ' + out[b].base + ' (' + el() + ')');
    out[b].B = await routeB(b, ex[b].E25); console.log('[' + b + '] B ' + out[b].B + ' (' + el() + ')');
    out[b].C = await routeC(b, ex[b].H12); console.log('[' + b + '] C ' + out[b].C + ' (' + el() + ')');
    out[b].D = await routeD(b, ex[b].E25); console.log('[' + b + '] D ' + out[b].D + ' (' + el() + ')');
    out[b].E = await routeE(b, ex[b].E25); console.log('[' + b + '] E ' + out[b].E + ' (' + el() + ')');
    out[b].F = await routeF(b, ex[b].H12); console.log('[' + b + '] F ' + out[b].F + ' (' + el() + ')');
  }
  out.cross = await routeA('main', ex.src.E25, 'cross');
  console.log('\n===== SIDE BY SIDE (src = published, main = fixed) =====');
  const L = { A: 'A undo x2 after 25-turn import', base: 'baseline undo x2 normal 4-turn game', B: 'B import while a turn runs', C: 'C halloway 12-turn import', D: 'D oversized 11-turn save', E: 'E adventure doc write fails', F: 'F reversed turns array' };
  for (const k of Object.keys(L)) console.log(L[k] + '\n  src : ' + out.src[k] + '\n  main: ' + out.main[k]);
  console.log('cross A (published 25-turn save into fixed): ' + out.cross);
  for (const b of ['src', 'main']) {
    const ps = pages.filter((x) => x.build === b);
    const errs = ps.reduce((n, p) => n + p.h.errors.length, 0); const samples = [...new Set(ps.flatMap((p) => p.h.errors.map((e) => e.message.split('\n')[0].slice(0, 120))))].slice(0, 3);
    const viol = ps.flatMap((p) => p.h.mock.violations.map((v) => v.kind + ': ' + String(v.detail).slice(0, 80)));
    console.log(b + ' totals: page errors=' + errs + ' ' + JSON.stringify(samples) + ' | violations=' + viol.length + ' ' + JSON.stringify([...new Set(viol)].slice(0, 3)));
  }
  console.log('unhandled rejections: ' + unhandled.length + ' ' + JSON.stringify(unhandled.slice(0, 8)));
  console.log('elapsed ' + el());
  for (const p of pages) { try { p.h.close(); } catch (e) {} }
  process.exit(0);
})().catch((e) => { console.error('TEST CRASH', e); for (const p of pages) { try { p.h.close(); } catch (x) {} } process.exit(1); });
