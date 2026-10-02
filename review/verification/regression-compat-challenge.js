'use strict';
// regression-compat-challenge: different routes to the fixed build refusing saves the published build still opens.
// Route I : no failure injection. The published build's own import writes only the last chunk; after a reload the published
//           page numbers the next turn by position, so turn numbers repeat. Then: does each build open that save?
// Route R : rescue. Export the damaged adventure from the published page and import it into the fixed page.
// Route X : healthy cross-build export/import in both directions (published export -> fixed import -> reload, and back).
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || 'C:/Users/marcu/AppData/Local/Temp/wl-harness';
const B = {
  pub: { htmlPath: ROOT + '/src/index.html', worldsDir: ROOT + '/src/worlds' },
  fix: { htmlPath: ROOT + '/main/index.html', worldsDir: ROOT + '/main/worlds' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));
const log = (...a) => console.log(a.join(' '));

const feedN = (h) => h.document.querySelectorAll('#feed .turn').length - 1;
const noteTxt = (h) => (h.$('#summaryNote') || {}).textContent || '';
const statusTxt = (h) => (h.$('#status') || {}).textContent || '';
async function waitFor(cond, max = 3000) { const t0 = Date.now(); while (Date.now() - t0 < max) { try { if (cond()) return true; } catch (e) {} await sleep(10); } return false; }
async function act(h, fn, max) { const before = h.mock.sampleCalls.length; const db0 = h.mock.calls.db; fn(); await waitFor(() => h.mock.sampleCalls.length > before || h.mock.calls.db > db0, 800); await h.idle(max || 20000); await sleep(30); await h.idle(max || 20000); }
const closeDlg = (h, id) => { const b = h.$('[data-close="' + id + '"]'); if (b && h.$('#' + id) && h.$('#' + id).hasAttribute('open')) h.click(b); };
const advIds = (store) => [...store.keys()].filter((k) => /^adventures\/[^/]+$/.test(k)).map((k) => k.split('/')[1]);
const advDocOf = (store, id) => (store.get('adventures/' + id) || {}).data;
const idByTitle = (store, title) => advIds(store).find((id) => (advDocOf(store, id) || {}).title === title);
function storeNs(store, id) {
  const ch = [...store.keys()].filter((k) => k.startsWith('adventures/' + id + '/turns/')).map((k) => store.get(k).data).sort((a, b) => a.c - b.c);
  return ch.map((c) => 'c' + c.c + '[' + (c.turns || []).map((t) => t.n).join(',') + ']').join(' ');
}
function dupNs(store, id) {
  const ns = []; [...store.keys()].filter((k) => k.startsWith('adventures/' + id + '/turns/')).forEach((k) => (store.get(k).data.turns || []).forEach((t) => ns.push(t.n)));
  return [...new Set(ns.filter((n, i) => ns.indexOf(n) !== i))];
}
const errSum = (h) => h.errors.length + (h.errors.length ? ' [' + h.errors[0].message.replace(/\s+/g, ' ').slice(0, 140) + ']' : '');
const vioSum = (h) => h.mock.violations.length + (h.mock.violations.length ? ' [' + h.mock.violations.slice(0, 3).map((v) => v.kind + ':' + String(v.detail).slice(0, 60)).join('; ') + ']' : '');

async function createAdventure(h, worldId, title) {
  if (h.$('#dlgCreate').hasAttribute('open')) { await h.settle(150, 6000); closeDlg(h, 'dlgCreate'); await h.idle(); }
  h.click('#btnAdventures'); await h.settle(60, 3000); h.type('#newWorld', worldId); h.click('#newAdv'); await h.settle(150, 6000);
  const wt = (h.$('#dlgCreate h3') || {}).textContent || '';
  h.type('#cTitle', title);
  const checks = [...h.document.querySelectorAll('#cStrengths input')];
  if (checks.length && checks.filter((c) => c.checked).length !== 2) { checks.forEach((c, i) => { c.checked = i < 2; }); checks[0].dispatchEvent(new h.window.Event('change', { bubbles: true })); }
  await act(h, () => h.click('#cBegin'), 60000);
  await waitFor(() => !h.$('#dlgCreate').hasAttribute('open'), 20000);
  await h.idle(30000); await sleep(100); await h.idle(30000);
  return idByTitle(h.mock.store, title);
}
async function turns(h, n, tag) { let bad = 0; for (let i = 1; i <= n; i++) { const b = feedN(h); await h.turn(tag + ' action ' + i); if (feedN(h) !== b + 1 || /failed/.test(noteTxt(h))) bad++; } return bad; }
async function exportPayload(h) {
  const n0 = h.mock.downloadsLog.length; h.click('#btnAdventures'); await h.settle(60, 3000);
  await act(h, () => h.click('#exportAdv')); await h.settle(60, 3000); closeDlg(h, 'dlgAdventures');
  const d = h.mock.downloadsLog[n0]; return d ? JSON.parse(String(d.data)) : null;
}
async function importText(h, text) {
  closeDlg(h, 'dlgCreate'); h.click('#btnAdventures'); await h.settle(60, 3000);
  const inp = h.$('#importFile');
  const f = new h.window.File([text], 'save.json', { type: 'application/json' });
  Object.defineProperty(inp, 'files', { value: [f], configurable: true });
  await act(h, () => inp.dispatchEvent(new h.window.Event('change', { bubbles: true })));
  await waitFor(() => /Import/.test(statusTxt(h)), 8000); await h.idle();
  closeDlg(h, 'dlgAdventures');
  return statusTxt(h).slice(0, 110);
}
async function openByTitle(h, title) {
  closeDlg(h, 'dlgCreate'); h.click('#btnAdventures'); await h.settle(80, 4000);
  const row = [...h.document.querySelectorAll('#advlist .advrow')].find((r) => (r.querySelector('.t') || {}).textContent === title);
  if (!row) { closeDlg(h, 'dlgAdventures'); return 'no-row'; }
  const b = row.querySelector('[data-act="open"]');
  if (b.textContent === 'Current') { closeDlg(h, 'dlgAdventures'); return true; }
  await act(h, () => h.click(b)); await h.idle(); closeDlg(h, 'dlgAdventures');
  return /Could not load/.test(statusTxt(h)) ? 'load-failed: ' + statusTxt(h).slice(0, 110) : true;
}
const bootOn = async (k, store) => { const h = await boot(Object.assign({}, B[k], { setup: (w, m) => { m.store = store; } })); await h.settle(200, 8000); await h.idle(); return h; };

async function routeImport(world) {
  const W = world.charAt(0).toUpperCase() + world.slice(1);
  // 1. published: a normal 12-turn game in this world, exported
  const s1 = new Map(); let h = await bootOn('pub', s1);
  await createAdventure(h, world, 'Src ' + W); await turns(h, 12, world);
  const payload = await exportPayload(h); const e1 = errSum(h); h.close();
  // 2. published, another store with one healthy adventure; the player imports the exported file
  const s2 = new Map(); h = await bootOn('pub', s2);
  await createAdventure(h, 'sundered', 'Healthy Other'); await turns(h, 2, 'oth');
  const impStatus = await importText(h, JSON.stringify(payload)); const impFeed = feedN(h);
  const impId = idByTitle(s2, 'Src ' + W + ' (imported)');
  const afterImport = 'turnCount=' + (advDocOf(s2, impId) || {}).turnCount + ' chunks=' + storeNs(s2, impId);
  const e2 = errSum(h); h.close();
  // 3. published, reopened (revisit or second device): plays one turn on the imported adventure
  h = await bootOn('pub', s2);
  const o3 = await openByTitle(h, 'Src ' + W + ' (imported)'); const reFeed = feedN(h);
  await turns(h, 1, 'after-reload'); const reFeed2 = feedN(h); const e3 = errSum(h) + ' vio=' + vioSum(h); h.close();
  const damaged = clone([...s2.entries()]);
  log('I ' + W + ' published: export turns=' + (payload && payload.turns.length) + ' | import status=' + impStatus + ' feed=' + impFeed + ' | store after import ' + afterImport + ' | reload open=' + o3 + ' feed ' + reFeed + '->' + reFeed2 + ' | store now ' + storeNs(s2, impId) + ' dup=' + dupNs(s2, impId).join(',') + ' | errs ' + e1 + ' ' + e2 + ' ' + e3);
  // 4. both builds open the damaged store
  const out = {};
  for (const k of ['pub', 'fix']) {
    const st = new Map(clone(damaged)); h = await bootOn(k, st);
    const bootView = (h.$('#worldTitle') || {}).textContent + ' feed=' + feedN(h) + ' status=' + statusTxt(h).slice(0, 60);
    const o = await openByTitle(h, 'Src ' + W + ' (imported)'); const f = feedN(h);
    let t = 'skipped'; if (o === true) { t = (await turns(h, 1, 'post-' + k)) === 0 ? 'ok' : 'bad'; }
    // rescue: export whatever this page has open now
    out[k] = { bootView, open: o, feed: f, turn: t, errors: errSum(h), violations: vioSum(h) };
    if (k === 'pub') { out.rescuePayload = await exportPayload(h); }
    h.close();
    log('I ' + W + ' ' + k + ' opens damaged store: ' + JSON.stringify(out[k]));
  }
  // 5. rescue route: the published export of the damaged adventure imported into the fixed build (fresh store and damaged store)
  const rp = out.rescuePayload; const rpNs = rp ? rp.turns.map((t) => t.n) : [];
  for (const k of ['pub', 'fix']) {
    const st = new Map(); h = await bootOn(k, st);
    await createAdventure(h, 'halloway', 'Rescue Host'); await turns(h, 1, 'host');
    const s = rp ? await importText(h, JSON.stringify(rp)) : 'no payload';
    log('R ' + W + ' ' + k + ' imports published export of damaged save (ns ' + rpNs.join(',') + '): status=' + s + ' feed=' + feedN(h) + ' errors=' + errSum(h) + ' vio=' + vioSum(h));
    h.close();
  }
  return payload;
}

async function routeCross(payload) {
  // published export (healthy, 12 turns) imported by each build, then reloaded by the same build; then the fixed export back into published
  const res = {};
  let fixExport = null;
  for (const k of ['pub', 'fix']) {
    const st = new Map(); let h = await bootOn(k, st);
    await createAdventure(h, 'sundered', 'Cross Host ' + k); await turns(h, 1, 'host');
    const s = await importText(h, JSON.stringify(payload)); const f = feedN(h);
    const title = payload.adventure.title + ' (imported)'; const id = idByTitle(st, title);
    const sto = 'turnCount=' + (advDocOf(st, id) || {}).turnCount + ' ' + storeNs(st, id);
    const ee = errSum(h) + ' vio=' + vioSum(h); h.close();
    h = await bootOn(k, st); const o = await openByTitle(h, title); const f2 = feedN(h);
    const t = (await turns(h, 1, 'cross-' + k)) === 0 ? 'ok' : 'bad';
    if (k === 'fix') fixExport = await exportPayload(h);
    res[k] = 'import=' + s.slice(0, 50) + ' feed=' + f + ' store ' + sto + ' | reload open=' + o + ' feed=' + f2 + ' turn=' + t + ' feedAfter=' + feedN(h) + ' | errs ' + ee + ' / ' + errSum(h) + ' vio=' + vioSum(h);
    h.close();
    log('X ' + k + ' imports published 12-turn export: ' + res[k]);
  }
  // fixed export -> published import (rollback path), same session view
  {
    const st = new Map(); const h = await bootOn('pub', st);
    await createAdventure(h, 'sundered', 'Back Host'); await turns(h, 1, 'host');
    const s = fixExport ? await importText(h, JSON.stringify(fixExport)) : 'no fixed export';
    log('X pub imports fixed export (turns ' + (fixExport ? fixExport.turns.length : 0) + ', n ' + (fixExport ? fixExport.turns.map((t) => t.n).join(',') : '') + '): status=' + s + ' feed=' + feedN(h) + ' errors=' + errSum(h) + ' vio=' + vioSum(h));
    h.close();
  }
}

(async () => {
  const t0 = Date.now();
  const p1 = await routeImport('halloway');
  await routeImport('mythaven');
  await routeCross(p1);
  log('elapsed s: ' + Math.round((Date.now() - t0) / 1000));
  process.exit(0);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(1); });
