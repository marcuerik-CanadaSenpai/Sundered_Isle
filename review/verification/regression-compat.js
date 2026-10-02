'use strict';
// regression-compat: (a) old saves written by the PUBLISHED build, loaded and continued by the FIXED build;
// (b) the same normal flows in all three worlds on both builds; (c) rollback: the published build reading the store after the fixed build wrote to it.
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || 'C:/Users/marcu/AppData/Local/Temp/wl-harness';
const B = {
  pub: { htmlPath: ROOT + '/src/index.html', worldsDir: ROOT + '/src/worlds' },
  fix: { htmlPath: ROOT + '/main/index.html', worldsDir: ROOT + '/main/worlds' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => JSON.parse(JSON.stringify(o));
const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };

// ---------- page helpers ----------
const feedN = (h) => h.document.querySelectorAll('#feed .turn').length - 1; // turns, excluding Turn 0
const lastNarr = (h) => { const n = h.document.querySelectorAll('#feed .turn .narr'); return n.length ? n[n.length - 1].textContent : ''; };
const noteTxt = (h) => (h.$('#summaryNote') || {}).textContent || '';
const statusTxt = (h) => (h.$('#status') || {}).textContent || '';
async function waitFor(cond, max = 3000) { const t0 = Date.now(); while (Date.now() - t0 < max) { try { if (cond()) return true; } catch (e) {} await sleep(10); } return false; }
async function act(h, fn, max) { const before = h.mock.sampleCalls.length; const db0 = h.mock.calls.db; fn(); await waitFor(() => h.mock.sampleCalls.length > before || h.mock.calls.db > db0, 800); await h.idle(max || 20000); await sleep(30); await h.idle(max || 20000); }
const closeDlg = (h, id) => { const b = h.$('[data-close="' + id + '"]'); if (b && h.$('#' + id).hasAttribute('open')) h.click(b); };

// ---------- store helpers ----------
const advIds = (store) => [...store.keys()].filter((k) => /^adventures\/[^/]+$/.test(k)).map((k) => k.split('/')[1]);
const advDocOf = (store, id) => (store.get('adventures/' + id) || {}).data;
function turnsOf(store, id) {
  const ch = [...store.keys()].filter((k) => k.startsWith('adventures/' + id + '/turns/')).sort().map((k) => store.get(k).data);
  ch.sort((a, b) => a.c - b.c); const t = []; ch.forEach((c) => t.push(...(c.turns || []))); return t;
}
function idByTitle(store, title) { return advIds(store).find((id) => (advDocOf(store, id) || {}).title === title); }
function storeCheck(store, id) {
  const d = advDocOf(store, id); const t = turnsOf(store, id);
  const ns = t.map((x) => x.n); const contiguous = ns.every((n, i) => n === i + 1);
  return { turnCount: d && d.turnCount, chunkTurns: t.length, contiguous, ok: !!d && d.turnCount === t.length && contiguous };
}
function diffPaths(a, b, p, acc, lim) {
  if (acc.length >= lim) return acc;
  if (a === b) return acc;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { if (JSON.stringify(a) !== JSON.stringify(b)) acc.push(p || '(root)'); return acc; }
  if (Array.isArray(a) !== Array.isArray(b)) { acc.push(p + '[type]'); return acc; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) diffPaths(a[k], b[k], p ? p + '.' + k : k, acc, lim);
  return acc;
}

// ---------- flows ----------
async function createAdventure(h, worldId, title) {
  if (!h.$('#dlgCreate').hasAttribute('open')) {
    h.click('#btnAdventures'); await h.settle(60, 3000);
    h.type('#newWorld', worldId); h.click('#newAdv'); await h.settle(150, 6000);
  } else {
    await h.settle(150, 6000);
  }
  h.type('#cTitle', title);
  const checks = [...h.document.querySelectorAll('#cStrengths input')];
  if (checks.length && checks.filter((c) => c.checked).length !== 2) { checks.forEach((c, i) => { c.checked = i < 2; }); checks[0].dispatchEvent(new h.window.Event('change', { bubbles: true })); }
  await act(h, () => h.click('#cBegin'), 60000);
  await waitFor(() => !h.$('#dlgCreate').hasAttribute('open'), 20000);
  await h.idle(30000); await sleep(100); await h.idle(30000);
  return { closed: !h.$('#dlgCreate').hasAttribute('open'), note: h.$('#cNote').textContent.slice(0, 80), id: idByTitle(h.mock.store, title) };
}
async function turns(h, n, tag) { let bad = 0; for (let i = 1; i <= n; i++) { const b = feedN(h); await h.turn(tag + ' action ' + i); if (feedN(h) !== b + 1 || /failed/.test(noteTxt(h))) bad++; } return bad; }
async function regen(h) { const b = feedN(h), nar = lastNarr(h); await act(h, () => h.click('#regen')); return feedN(h) === b && lastNarr(h) !== nar && !!h.$('[data-prevver]'); }
async function regenWith(h) { const b = feedN(h), nar = lastNarr(h); h.click('#regenWith'); h.type('#rewrite', 'Make it quieter and shorter.'); await act(h, () => h.click('#rewriteGo')); return feedN(h) === b && lastNarr(h) !== nar; }
async function prevVersion(h) { const pv = h.$('[data-prevver]'); if (!pv) return 'no-button'; const b = feedN(h), nar = lastNarr(h); await act(h, () => h.click(pv)); return feedN(h) === b && lastNarr(h) !== nar ? true : 'unchanged'; }
async function undo(h) { const b = feedN(h); await act(h, () => h.click('#undo')); return feedN(h) === b - 1; }
async function settingsChange(h, id) {
  h.click('#btnSettings'); await h.settle(30, 1000);
  h.type('#setDensity', 'rich'); await h.idle(); h.type('#setWindow', '4'); await h.idle(); h.type('#setPace', 'fast'); await h.idle();
  closeDlg(h, 'dlgSettings');
  const d = advDocOf(h.mock.store, id) || {}; const s = d.settings || {};
  return s.density === 'rich' && Number(s.window) === 4 && s.pace === 'fast';
}
async function exportIt(h) {
  const n0 = h.mock.downloadsLog.length; h.click('#btnAdventures'); await h.settle(60, 3000);
  await act(h, () => h.click('#exportAdv')); await h.settle(60, 3000); closeDlg(h, 'dlgAdventures');
  const d = h.mock.downloadsLog[n0]; if (!d) return 'no-download: ' + statusTxt(h).slice(0, 60);
  let p; try { p = JSON.parse(String(d.data)); } catch (e) { return 'bad-json'; }
  return /\.json$/.test(d.filename) && Array.isArray(p.turns) && p.turns.length === feedN(h) ? true : 'turns ' + (p.turns || []).length + ' vs ' + feedN(h);
}
async function exportPayload(h) {
  const n0 = h.mock.downloadsLog.length; h.click('#btnAdventures'); await h.settle(60, 3000);
  await act(h, () => h.click('#exportAdv')); await h.settle(60, 3000); closeDlg(h, 'dlgAdventures');
  const d = h.mock.downloadsLog[n0]; return d ? JSON.parse(String(d.data)) : null;
}
async function castEdit(h, newName) {
  h.click('#btnCast'); await h.settle(30, 1000);
  const btn = [...h.document.querySelectorAll('#castList button')].find((b) => b.dataset.key !== 'roommate');
  if (!btn) { closeDlg(h, 'dlgCast'); return 'no-cast'; }
  const key = btn.dataset.key; h.click(btn); await h.settle(30, 1000);
  h.type('#cfName', newName); h.type('#cfAttitude', '7');
  await act(h, () => h.click('#cfSave'));
  const ok = /Saved/.test(h.$('#cfNote').textContent) && h.$('#castList').textContent.includes(newName);
  closeDlg(h, 'dlgCast');
  return ok ? true : 'note=' + h.$('#cfNote').textContent;
}
const REPLY = (tag) => JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: 'Override narrative for ' + tag + '. You stand by the window and the afternoon goes on around you, unhurried and ordinary, and nobody asks you anything at all.', suggested_actions: ['Wait', 'Leave'], secret_info: '', state_updates: [], time_advance_minutes: 10, events: ['Day 1 12:00 Override event for ' + tag + '.'], beats: ['Override beat ' + tag], facts: [], exposures: [] });
async function overrideReply(h, tag) {
  h.click('#btnOverride'); await h.settle(30, 1000);
  const b = feedN(h); h.type('#ovrAction', 'Override action ' + tag); h.type('#ovrReply', REPLY(tag));
  h.click('#ovrReplyApply'); await waitFor(() => !/working/.test(h.$('#ovrReplyNote').textContent), 15000); await h.idle();
  const note = h.$('#ovrReplyNote').textContent; closeDlg(h, 'dlgOverride');
  return /^Applied as turn \d+\.$/.test(note) && feedN(h) === b + 1 ? true : 'note=' + note + ' n=' + feedN(h);
}
async function overrideState(h, id, loc) {
  h.click('#btnOverride'); await h.settle(30, 1000);
  const st = JSON.parse(h.$('#ovrState').value); st.location = loc; h.$('#ovrState').value = JSON.stringify(st);
  h.click('#ovrStateApply'); await h.idle(); await sleep(30);
  const note = h.$('#ovrStateNote').textContent; closeDlg(h, 'dlgOverride');
  const d = advDocOf(h.mock.store, id) || {};
  return d.state && d.state.location === loc ? true : 'note=' + note + ' loc=' + (d.state && d.state.location);
}
async function openByTitle(h, title) {
  h.click('#btnAdventures'); await h.settle(80, 4000);
  const row = [...h.document.querySelectorAll('#advlist .advrow')].find((r) => (r.querySelector('.t') || {}).textContent === title);
  if (!row) { closeDlg(h, 'dlgAdventures'); return 'no-row'; }
  const b = row.querySelector('[data-act="open"]');
  if (b.textContent === 'Current') { closeDlg(h, 'dlgAdventures'); return true; }
  await act(h, () => h.click(b)); await h.idle(); closeDlg(h, 'dlgAdventures');
  return /Could not load/.test(statusTxt(h)) ? 'load-failed: ' + statusTxt(h).slice(0, 120) : true;
}
const readSettings = async (h) => { h.click('#btnSettings'); await h.settle(30, 1000); const r = h.$('#setDensity').value + '/' + h.$('#setWindow').value + '/' + h.$('#setPace').value; closeDlg(h, 'dlgSettings'); return r; };
const readCastNames = async (h) => { h.click('#btnCast'); await h.settle(30, 1000); const r = h.$('#castList').textContent; closeDlg(h, 'dlgCast'); return r; };
const readLocation = async (h) => { h.click('#btnOverride'); await h.settle(30, 1000); const r = h.$('#ovrLocation').value; closeDlg(h, 'dlgOverride'); return r; };
const errSum = (h) => h.errors.length + (h.errors.length ? ' [' + h.errors[0].message.replace(/\s+/g, ' ').slice(0, 160) + ']' : '');
const vioSum = (h) => h.mock.violations.length + (h.mock.violations.length ? ' [' + h.mock.violations.slice(0, 3).map((v) => v.kind + ':' + String(v.detail).slice(0, 60)).join('; ') + ']' : '');

// ---------- part (b): normal flows ----------
async function partB(buildKey) {
  const h = await boot(Object.assign({}, B[buildKey]));
  await h.settle(150, 6000);
  const res = {};
  for (const w of ['sundered', 'halloway', 'mythaven']) {
    const r = {}; const title = 'Flow ' + w;
    try {
      const c = await createAdventure(h, w, title); r.create = c.closed && !!c.id ? true : 'closed=' + c.closed + ' id=' + c.id + ' note=' + c.note;
      const id = c.id;
      r.turns5 = (await turns(h, 5, w)) === 0 ? true : 'bad';
      r.regen = await regen(h);
      r.regenWith = await regenWith(h);
      r.prevVersion = await prevVersion(h);
      r.undo = await undo(h);
      r.settings = await settingsChange(h, id);
      r.export = await exportIt(h);
      r.cast = await castEdit(h, 'Quentin Testerly');
      r.ovrReply = await overrideReply(h, w);
      r.ovrState = await overrideState(h, id, 'Override Hall ' + w);
      r.turnAfter = (await turns(h, 1, w + '-after')) === 0 ? true : 'bad';
      const sc = storeCheck(h.mock.store, id); r.store = sc.ok && sc.turnCount === feedN(h) ? true : JSON.stringify(sc) + ' feed=' + feedN(h);
      r.note = noteTxt(h); r.feed = feedN(h);
    } catch (e) { r.exception = String(e && e.stack || e).slice(0, 200); }
    res[w] = r;
  }
  res.errors = errSum(h); res.violations = vioSum(h);
  const store = h.mock.store; h.close();
  // reboot the same build on that store: every adventure must come back with its turns, settings, cast edit and state
  const h2 = await boot(Object.assign({}, B[buildKey], { setup: (win, m) => { m.store = store; } }));
  await h2.settle(200, 8000); await h2.idle();
  const rl = {};
  for (const w of ['sundered', 'halloway', 'mythaven']) {
    const id = idByTitle(store, 'Flow ' + w); const want = (advDocOf(store, id) || {}).turnCount;
    const o = await openByTitle(h2, 'Flow ' + w);
    const s = await readSettings(h2); const cn = (await readCastNames(h2)).includes('Quentin Testerly'); const loc = await readLocation(h2);
    rl[w] = (o === true && feedN(h2) === want && s === 'rich/4/fast' && cn && loc === 'Override Hall ' + w) ? true : ('open=' + o + ' feed=' + feedN(h2) + '/' + want + ' set=' + s + ' cast=' + cn + ' loc=' + loc);
  }
  rl.errors = errSum(h2); rl.violations = vioSum(h2);
  h2.close();
  return { res, reload: rl };
}

// ---------- part (a): old saves from the published build ----------
async function partA() {
  const shared = new Map();
  const hp = await boot(Object.assign({}, B.pub, { setup: (w, m) => { m.store = shared; } }));
  await hp.settle(150, 6000);
  const fx = {};
  // Sundered: 25 turns with an undo across a chunk boundary, a regenerate and a previous version; settings and cast edits
  let c = await createAdventure(hp, 'sundered', 'Compat Sundered'); fx.sCreate = c.closed && !!c.id;
  fx.sSettings = await settingsChange(hp, c.id);
  fx.sCast = await castEdit(hp, 'Old Save Renamed');
  fx.s21 = await turns(hp, 21, 'old');
  fx.sUndo = await undo(hp);               // 21 -> 20 (chunk 0002 delete path)
  fx.s5 = await turns(hp, 5, 'old2');      // 25
  fx.sRegen = await regen(hp);
  fx.sPrev = await prevVersion(hp);
  fx.sFeed = feedN(hp);
  c = await createAdventure(hp, 'halloway', 'Compat Halloway'); fx.hCreate = c.closed && !!c.id;
  fx.h3 = await turns(hp, 3, 'hold'); fx.hCast = await castEdit(hp, 'Halloway Renamed');
  c = await createAdventure(hp, 'mythaven', 'Compat Mythaven'); fx.mCreate = c.closed && !!c.id;
  fx.m3 = await turns(hp, 3, 'mold'); fx.mRegen = await regen(hp); fx.mSettings = await settingsChange(hp, c.id);
  fx.pubErrors = errSum(hp); fx.pubViolations = vioSum(hp); fx.pubNote = noteTxt(hp);
  hp.close();
  const gt = new Map([...shared.entries()].map(([k, v]) => [k, clone(v)]));
  const titles = ['Compat Sundered', 'Compat Halloway', 'Compat Mythaven'];
  const gtInfo = titles.map((t) => { const id = idByTitle(gt, t); return { t, id, sc: storeCheck(gt, id) }; });
  log('A fixture (published):', JSON.stringify(fx));
  log('A fixture store:', gtInfo.map((x) => x.t.split(' ')[1] + ' turns=' + x.sc.turnCount + ' chunkTurns=' + x.sc.chunkTurns + ' ok=' + x.sc.ok).join(' | '), '| docs=' + gt.size);

  // fixed build on the same store
  const hf = await boot(Object.assign({}, B.fix, { setup: (w, m) => { m.store = shared; } }));
  await hf.settle(200, 8000); await hf.idle();
  const firstLoaded = hf.$('#worldTitle').textContent + ' feed=' + feedN(hf) + ' status=' + statusTxt(hf).slice(0, 60) + ' create-open=' + hf.$('#dlgCreate').hasAttribute('open');
  hf.click('#btnDebug'); await hf.settle(30, 1000); const dbgNotes = hf.$('#dbgNotes').textContent; closeDlg(hf, 'dlgDebug');
  log('A fixed boot loaded:', firstLoaded, '| load-failed notes:', /load failed/.test(dbgNotes) ? dbgNotes.slice(0, 200) : 'none');
  const ar = {};
  for (const x of gtInfo) {
    const r = {}; const w = x.t.split(' ')[1];
    r.open = await openByTitle(hf, x.t);
    r.feed = feedN(hf) + '/' + x.sc.turnCount;
    r.mismatchNote = /expected/.test(statusTxt(hf));
    const p = await exportPayload(hf);
    const gd = advDocOf(gt, x.id); const gtTurns = turnsOf(gt, x.id);
    if (p) {
      const strip = (d) => { const o = clone(d); delete o.updatedAt; delete o.rev; delete o.lastLine; return o; };
      r.docDiff = diffPaths(strip(gd), strip(p.adventure), '', [], 8);
      r.turnsDiff = diffPaths(gtTurns, p.turns, '', [], 6);
    } else r.docDiff = 'no export';
    r.settings = await readSettings(hf);
    const cl = await readCastNames(hf); r.castKept = w === 'Sundered' ? cl.includes('Old Save Renamed') : w === 'Halloway' ? cl.includes('Halloway Renamed') : 'n/a';
    // continue playing on the old save
    if (w === 'Sundered') {
      const ch0 = JSON.stringify((shared.get('adventures/' + x.id + '/turns/0000') || {}).data);
      r.prevOld = await prevVersion(hf);
      r.regen = await regen(hf);
      r.undo = await undo(hf);
      r.turns = await turns(hf, 3, 'new');
      r.chunk0Untouched = JSON.stringify((shared.get('adventures/' + x.id + '/turns/0000') || {}).data) === ch0;
    } else r.turns = await turns(hf, 2, 'new');
    const sc = storeCheck(shared, x.id); r.store = sc; r.feedAfter = feedN(hf); r.note = noteTxt(hf);
    ar[w] = r;
    log('A fixed', w + ':', JSON.stringify(r));
  }
  const fixErr = errSum(hf), fixVio = vioSum(hf);
  log('A fixed errors:', fixErr, '| violations:', fixVio);
  hf.close();

  // (c) rollback / mixed devices: the published page on the store the fixed build has written to
  const hp2 = await boot(Object.assign({}, B.pub, { setup: (w, m) => { m.store = shared; } }));
  await hp2.settle(200, 8000); await hp2.idle();
  const rb = {};
  for (const x of gtInfo) {
    const w = x.t.split(' ')[1]; const o = await openByTitle(hp2, x.t); const want = (advDocOf(shared, x.id) || {}).turnCount;
    rb[w] = (o === true && feedN(hp2) === want) ? 'ok ' + want : 'open=' + o + ' feed=' + feedN(hp2) + '/' + want;
  }
  rb.turn = (await turns(hp2, 1, 'pubagain')) === 0; rb.errors = errSum(hp2); rb.violations = vioSum(hp2);
  log('C published reads fixed-written store:', JSON.stringify(rb));
  hp2.close();
}

// ---------- part (d): a published save damaged by a failed chunk write, then continued on the published page ----------
// The published build's chunk write can fail (its own 256 KiB chunk overflow, quota, transient errors). The stale chunk leaves a gap;
// after a reload the published page numbers new turns by position, so turn numbers repeat. Does the fixed build still open that save?
async function partD() {
  const shared = new Map();
  const h1 = await boot(Object.assign({}, B.pub, { setup: (w, m) => { m.store = shared; } }));
  await h1.settle(150, 6000);
  const c = await createAdventure(h1, 'sundered', 'Damaged Save'); const id = c.id;
  await turns(h1, 9, 'dmg');
  h1.mock.dbFail = (op, path) => (op === 'set' && /\/turns\/0000$/.test(path) ? { code: 'unavailable', message: 'injected chunk failure' } : null);
  await turns(h1, 1, 'dmg10');
  const failNote = noteTxt(h1);
  h1.mock.dbFail = null;
  await turns(h1, 2, 'dmg11');
  const e1 = errSum(h1); h1.close();
  const afterGap = storeCheck(shared, id);
  // published page reopened (another device or a revisit): plays one more turn on the gapped save
  const h2 = await boot(Object.assign({}, B.pub, { setup: (w, m) => { m.store = shared; } }));
  await h2.settle(200, 8000); await h2.idle();
  const pubLoaded = feedN(h2); await turns(h2, 1, 'dmgpub'); const pubAfter = feedN(h2); const e2 = errSum(h2); h2.close();
  const ns = turnsOf(shared, id).map((t) => t.n);
  const dupN = ns.filter((n, i) => ns.indexOf(n) !== i);
  const damaged = clone([...shared.entries()]);
  log('D damaged fixture: failNote=' + failNote + ' afterGap=' + JSON.stringify(afterGap) + ' storeNs=' + ns.join(',') + ' dup=' + dupN.join(','));
  // published page once more: does it open it?
  const h3 = await boot(Object.assign({}, B.pub, { setup: (w, m) => { m.store = new Map(clone(damaged)); } }));
  await h3.settle(200, 8000); await h3.idle();
  const pubOpen = { feed: feedN(h3), createOpen: h3.$('#dlgCreate').hasAttribute('open'), status: statusTxt(h3).slice(0, 80) };
  pubOpen.turnOk = (await turns(h3, 1, 'dmgpub2')) === 0; pubOpen.errors = errSum(h3); h3.close();
  log('D published opens damaged save:', JSON.stringify(pubOpen), '| earlier pub errors:', e1, e2, '| pub loaded', pubLoaded, '->', pubAfter);
  // fixed page on the same damaged store
  const h4 = await boot(Object.assign({}, B.fix, { setup: (w, m) => { m.store = new Map(clone(damaged)); } }));
  await h4.settle(200, 8000); await h4.idle();
  const fixOpen = { feed: feedN(h4), createOpen: h4.$('#dlgCreate').hasAttribute('open'), saveNote: noteTxt(h4), status: statusTxt(h4).slice(0, 100) };
  h4.click('#btnDebug'); await h4.settle(30, 1000); fixOpen.debug = h4.$('#dbgNotes').textContent.replace(/\s+/g, ' ').slice(0, 120); closeDlg(h4, 'dlgDebug');
  closeDlg(h4, 'dlgCreate'); await h4.idle();
  fixOpen.continue = await openByTitle(h4, 'Damaged Save');
  fixOpen.errors = errSum(h4); fixOpen.violations = vioSum(h4);
  h4.close();
  log('D fixed opens damaged save:', JSON.stringify(fixOpen));
  // and the same damage without the published continuation (gap only, no repeated numbers)
}

// ---------- part (e): the same damage reached naturally, through the published build's own chunk overflow (long narratives) ----------
async function partE() {
  const W10 = (n, seed) => Array.from({ length: n }, (_, i) => ['lantern', 'corridor', 'whispers', 'copper', 'stairwell', 'dust', 'laughter', 'threshold', 'somewhere', 'below'][(i * 7 + seed) % 10]).join(' ');
  let n = 0;
  const handler = (mock) => (input, opts, call) => {
    const p = typeof input === 'string' ? input : input.map((m) => m.content).join('\n');
    if (!/Return|JSON|narrative/i.test(p) || /Rewrite it to between|long-term memory|first appearance|Invent the people/.test(p)) return mock.defaultHandler(input, opts, call);
    n++;
    return JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: W10(380, n) + ' *A thought, turn ' + n + '.*', suggested_actions: ['Look around the quad again', 'Ask the porter about the lanterns', 'Go back to the room and unpack'], secret_info: '', state_updates: [], time_advance_minutes: 20,
      events: [1, 2, 3].map((k) => 'Day ' + (1 + Math.floor(n / 6)) + ' 1' + k + ':' + (10 + n % 40) + ' ' + W10(14, n + k)), beats: [W10(16, n), W10(16, n + 3)], facts: [W10(12, n + 5)], exposures: [] });
  };
  const shared = new Map();
  const h1 = await boot(Object.assign({}, B.pub, { setup: (w, m) => { m.store = shared; m.sampleHandler = handler(m); } }));
  await h1.settle(150, 6000);
  const c = await createAdventure(h1, 'sundered', 'Long Save'); const id = c.id;
  let firstFail = null, i = 0;
  for (i = 1; i <= 70; i++) { await h1.turn('Long action ' + i); if (!firstFail && /failed/.test(noteTxt(h1))) firstFail = i; if (firstFail && i >= Math.ceil(firstFail / 10) * 10 + 1 && !/failed/.test(noteTxt(h1))) break; }
  const s1 = storeCheck(shared, id); const e1 = errSum(h1); h1.close();
  let dup = [], j = 0;
  const h2 = await boot(Object.assign({}, B.pub, { setup: (w, m) => { m.store = shared; m.sampleHandler = handler(m); } }));
  await h2.settle(200, 8000); await h2.idle(); const pubLoaded = feedN(h2);
  for (j = 1; j <= 15; j++) { await h2.turn('After reload ' + j); const ns = turnsOf(shared, id).map((t) => t.n); dup = ns.filter((x, k) => ns.indexOf(x) !== k); if (dup.length) break; }
  const pubFeed = feedN(h2); h2.close();
  log('E natural overflow: firstSaveFail=turn ' + firstFail + ' stoppedAt=' + i + ' store=' + JSON.stringify(s1) + ' pubReloadFeed=' + pubLoaded + ' pubTurnsAfterReload=' + j + ' pubFeed=' + pubFeed + ' dupNs=' + dup.join(',') + ' errs=' + e1);
  const damaged = clone([...shared.entries()]);
  const h3 = await boot(Object.assign({}, B.pub, { setup: (w, m) => { m.store = new Map(clone(damaged)); } }));
  await h3.settle(200, 8000); await h3.idle(); const pubOpen = 'feed=' + feedN(h3) + ' createOpen=' + h3.$('#dlgCreate').hasAttribute('open'); h3.close();
  const h4 = await boot(Object.assign({}, B.fix, { setup: (w, m) => { m.store = new Map(clone(damaged)); } }));
  await h4.settle(200, 8000); await h4.idle();
  const fixOpen = 'storeTurnCount=' + (advDocOf(new Map(damaged), id) || {}).turnCount + ' feed=' + feedN(h4) + ' createOpen=' + h4.$('#dlgCreate').hasAttribute('open') + ' note=' + noteTxt(h4) + ' status=' + statusTxt(h4).slice(0, 90); h4.close();
  log('E published reopen:', pubOpen, '| fixed reopen:', fixOpen);
}

(async () => {
  const t0 = Date.now();
  if (process.argv.includes('--d-only')) { await partD(); process.exit(0); }
  if (process.argv.includes('--e-only')) { await partE(); log('elapsed s:', Math.round((Date.now() - t0) / 1000)); process.exit(0); }
  await partA();
  await partD();
  await partE();
  for (const k of ['pub', 'fix']) {
    const r = await partB(k);
    for (const w of ['sundered', 'halloway', 'mythaven']) log('B', k, w + ':', JSON.stringify(r.res[w]));
    log('B', k, 'errors:', r.res.errors, '| violations:', r.res.violations);
    log('B', k, 'reload:', JSON.stringify(r.reload));
  }
  log('elapsed s:', Math.round((Date.now() - t0) / 1000));
  process.exit(0);
})().catch((e) => { console.error('TEST CRASHED', e); process.exit(1); });
