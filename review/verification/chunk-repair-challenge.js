'use strict';
// chunk-repair-challenge: routes to the same failure that difftests/chunk-repair.js did not cover.
//  U1: 11 turns, Undo; the delete of chunk 0001 fails once; click Retry save if offered; reload page 2; page 2 takes a turn.
//  U2: 10 turns, Undo (succeeds); new turn 10b whose chunk write fails once; turns 11b-12b; reload page 2; page 2 takes a turn.
//  R:  10 turns; Regenerate turn 10 with its chunk write failing once; turn 11; reload page 2 (which version of turn 10 is stored?).
//  DB: turn 10 chunk write fails; on turn 11 the chunk 0 repair succeeds but the chunk 0001 write fails; page 2 reloads in that window.
// Page 2 boots record every #status text (MutationObserver) to show what the player is told on load.
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || 'C:/Users/marcu/AppData/Local/Temp/wl-harness';
const BUILDS = {
  published: { htmlPath: ROOT + '/src/index.html', worldsDir: ROOT + '/src/worlds' },
  fixed: { htmlPath: ROOT + '/main/index.html', worldsDir: ROOT + '/main/worlds' },
};
const isTurnsPath = (p) => /^adventures\/[^/]+\/turns\/[^/]+$/.test(p);
const isAdvDoc = (p) => /^adventures\/[^/]+$/.test(p);
const tagOf = (s) => { const m = String(s || '').match(/Turn (\d+)\./g); return m ? m[m.length - 1].replace(/\D/g, '') : '?'; };

function storeView(store) {
  const k = [...store.keys()].filter(isAdvDoc)[0]; const d = store.get(k).data;
  const chunkKeys = [...store.keys()].filter((x) => x.startsWith(k + '/turns/')).sort();
  const turns = []; for (const ck of chunkKeys) for (const t of (store.get(ck).data.turns || [])) turns.push({ n: t.n, a: t.action, tag: tagOf(t.narrative) });
  return { turnCount: d.turnCount, time: d.state && d.state.time, chunks: chunkKeys.map((c) => c.split('/').pop() + ':' + (store.get(c).data.turns || []).map((t) => t.n).join(',')), turns };
}
function expectActs(v, acts) {
  const probs = []; const got = v.turns.map((t) => t.a);
  if (v.turnCount !== acts.length) probs.push('turnCount ' + v.turnCount + ' != ' + acts.length);
  for (const a of acts) if (!got.includes(a)) probs.push('missing ' + a);
  for (const a of got) if (!acts.includes(a)) probs.push('extra ' + a);
  const ns = v.turns.map((t) => t.n); if (new Set(ns).size !== ns.length) probs.push('dup n');
  if (!ns.every((n, i) => n === i + 1)) probs.push('n=' + ns.join(','));
  return probs;
}
function pageView(h) { return [...h.document.querySelectorAll('#feed article.turn:not(.draft)')].slice(1).map((el) => ((el.querySelector('.turn-meta .n') || {}).textContent || '').replace('Turn ', '') + '=' + ((el.querySelector('.turn-action') || {}).textContent || '')); }
function pageTag(h, idx) { const els = [...h.document.querySelectorAll('#feed article.turn:not(.draft)')].slice(1); const el = els[idx]; return el ? tagOf((el.querySelector('.narr') || {}).textContent) : 'none'; }
function times(h) { return [...h.document.querySelectorAll('#feed article.turn:not(.draft)')].slice(1).map((el) => ((el.querySelectorAll('.turn-meta span')[1] || {}).textContent || '')); }
function continuity(h) { const t = times(h); const bad = []; for (let i = 1; i < t.length; i++) { const p = /→ (\d\d:\d\d)/.exec(t[i - 1]); const c = /Day \d+ (\d\d:\d\d) →/.exec(t[i]); if (p && c && p[1] !== c[1]) bad.push('turn ' + (i + 1) + ' starts ' + c[1] + ' prev ended ' + p[1]); } return bad.length ? bad : 'ok'; }
function ui(h) { const st = h.$('#status'); return { note: h.$('#summaryNote').textContent.trim(), status: st.hidden ? '' : st.textContent.trim().slice(0, 120), btn: [...st.querySelectorAll('button')].map((b) => b.textContent).join('|') }; }

async function newPage(build, shared, setup, recordStatus) {
  const statusLog = [];
  const h = await boot(Object.assign({}, BUILDS[build], { setup(w, m) {
    m.store = shared; if (setup) setup(w, m);
    if (recordStatus) w.addEventListener('DOMContentLoaded', () => { const st = w.document.querySelector('#status'); if (!st) return; const rec = () => { const t = st.hidden ? '' : st.textContent.trim().slice(0, 110); if (t && statusLog[statusLog.length - 1] !== t) statusLog.push(t); }; new w.MutationObserver(rec).observe(st, { childList: true, subtree: true, characterData: true, attributes: true }); });
  } }));
  await h.settle(150, 6000); await h.idle();
  h.statusLog = statusLog;
  return h;
}
async function start(h) { h.click('#cBegin'); await h.idle(); }
async function clickAndWait(h, sel, expectSample) {
  const before = h.mock.sampleCalls.length; h.click(sel);
  if (expectSample) { const t0 = Date.now(); while (Date.now() - t0 < 800 && h.mock.sampleCalls.length === before) await h.sleep(10); }
  else await h.sleep(30);
  await h.idle();
}
async function clickRetry(h) { const b = [...h.document.querySelectorAll('#status button')].find((x) => /Retry save/.test(x.textContent)); if (!b) return false; h.click(b); await h.sleep(30); await h.idle(); return true; }
function tally(R, ...hs) { R.errors = hs.reduce((a, h) => a + h.errors.length, 0); R.violations = hs.flatMap((h) => h.mock.violations.map((v) => v.kind)); }

// U1: Undo across the chunk boundary, the chunk delete fails once, player presses Retry save
async function U1(build) {
  const shared = new Map(); const R = {}; let armDel = false;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => (armDel && op === 'delete' && isTurnsPath(p)) ? (armDel = false, { code: 'unavailable', message: 'injected' }) : null; });
  await start(h1);
  for (let i = 1; i <= 11; i++) await h1.turn('Act ' + i);
  armDel = true; await clickAndWait(h1, '#undo', false);
  R.uiAfterUndo = ui(h1);
  R.retried = await clickRetry(h1);
  R.uiAfterRetry = ui(h1);
  R.page1 = pageView(h1).length;
  const v = storeView(shared); R.store = { turnCount: v.turnCount, chunks: v.chunks }; R.problems = expectActs(v, Array.from({ length: 10 }, (_, i) => 'Act ' + (i + 1)));
  const h2 = await newPage(build, shared, null, true);
  R.page2 = pageView(h2).length + ' turns, last ' + pageView(h2).slice(-1)[0]; R.page2StatusSeq = h2.statusLog;
  await h2.turn('Act 11b');
  const v2 = storeView(shared); R.afterPage2Turn = { chunks: v2.chunks, turnCount: v2.turnCount, last3: pageView(h2).slice(-3), problems: expectActs(v2, Array.from({ length: 10 }, (_, i) => 'Act ' + (i + 1)).concat(['Act 11b'])) };
  tally(R, h1, h2); h1.close(); h2.close(); return R;
}

// U2: Undo turn 10 (succeeds), the new turn 10b's chunk write fails once, then 11b and 12b are saved normally
async function U2(build) {
  const shared = new Map(); const R = {}; let arm = false;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => (arm && op === 'set' && isTurnsPath(p)) ? (arm = false, { code: 'unavailable', message: 'injected' }) : null; });
  await start(h1);
  for (let i = 1; i <= 10; i++) await h1.turn('Act ' + i);
  await clickAndWait(h1, '#undo', false);
  R.afterUndo = storeView(shared).chunks;
  arm = true; await h1.turn('Act 10b');
  R.uiDuringFailure = ui(h1);
  await h1.turn('Act 11b'); await h1.turn('Act 12b');
  R.uiAfter = ui(h1);
  const acts = Array.from({ length: 9 }, (_, i) => 'Act ' + (i + 1)).concat(['Act 10b', 'Act 11b', 'Act 12b']);
  const v = storeView(shared); R.store = { turnCount: v.turnCount, chunks: v.chunks }; R.problems = expectActs(v, acts);
  R.page1 = pageView(h1).length;
  const h2 = await newPage(build, shared, null, true);
  R.page2 = pageView(h2).length; R.page2StatusSeq = h2.statusLog;
  await h2.turn('Act 13b');
  const v2 = storeView(shared); R.afterPage2Turn = { chunks: v2.chunks, turnCount: v2.turnCount, problems: expectActs(v2, acts.concat(['Act 13b'])) };
  tally(R, h1, h2); h1.close(); h2.close(); return R;
}

// R: Regenerate turn 10 with its chunk write failing once, then turn 11
async function RG(build) {
  const shared = new Map(); const R = {}; let arm = false;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => (arm && op === 'set' && isTurnsPath(p)) ? (arm = false, { code: 'unavailable', message: 'injected' }) : null; });
  await start(h1);
  for (let i = 1; i <= 10; i++) await h1.turn('Act ' + i);
  R.tagBefore = pageTag(h1, 9);
  arm = true; await clickAndWait(h1, '#regen', true);
  R.tagAfterRegen = pageTag(h1, 9); R.uiDuringFailure = ui(h1);
  await h1.turn('Act 11');
  R.uiAfter = ui(h1);
  const v = storeView(shared); R.store = { turnCount: v.turnCount, chunks: v.chunks, storedTag10: (v.turns[9] || {}).tag };
  R.page1Tag10 = pageTag(h1, 9);
  const h2 = await newPage(build, shared, null, true);
  R.page2Tag10 = pageTag(h2, 9); R.page2StatusSeq = h2.statusLog;
  R.page2PrevVersionBtn = !!h2.document.querySelector('[data-prevver]');
  tally(R, h1, h2); h1.close(); h2.close(); return R;
}

// DB: chunk 0 write of turn 10 fails; on turn 11 the chunk 0 repair succeeds and the chunk 0001 write fails; page 2 reloads in the window
async function DB(build) {
  const shared = new Map(); const R = {}; let mode = 0;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => {
    if (op !== 'set' || !isTurnsPath(p)) return null;
    if (mode === 1) { mode = 0; return { code: 'unavailable', message: 'injected' }; }
    if (mode === 2 && /\/turns\/0001$/.test(p)) { mode = 0; return { code: 'unavailable', message: 'injected' }; }
    return null; } });
  await start(h1);
  for (let i = 1; i <= 9; i++) await h1.turn('Act ' + i);
  mode = 1; await h1.turn('Act 10');
  mode = 2; await h1.turn('Act 11');
  R.uiPage1 = ui(h1);
  const v = storeView(shared); R.store = { turnCount: v.turnCount, docTime: v.time, chunks: v.chunks };
  const h2 = await newPage(build, shared, null, true);
  R.page2 = pageView(h2).length; R.page2StatusSeq = h2.statusLog;
  await h2.turn('Act 11 on page 2');
  R.page2Continuity = continuity(h2); R.page2Last2 = times(h2).slice(-2);
  const v2 = storeView(shared); R.storeAfter = { turnCount: v2.turnCount, chunks: v2.chunks };
  tally(R, h1, h2); h1.close(); h2.close(); return R;
}

// retry mode: after the U2 / RG failure, the player clicks Retry save instead of playing on
async function U2r(build) {
  const shared = new Map(); const R = {}; let arm = false;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => (arm && op === 'set' && isTurnsPath(p)) ? (arm = false, { code: 'unavailable', message: 'injected' }) : null; });
  await start(h1);
  for (let i = 1; i <= 10; i++) await h1.turn('Act ' + i);
  await clickAndWait(h1, '#undo', false);
  arm = true; await h1.turn('Act 10b');
  R.retried = await clickRetry(h1); R.ui = ui(h1);
  const acts = Array.from({ length: 9 }, (_, i) => 'Act ' + (i + 1)).concat(['Act 10b']);
  const v = storeView(shared); R.store = { turnCount: v.turnCount, chunks: v.chunks }; R.problems = expectActs(v, acts);
  tally(R, h1); h1.close(); return R;
}
async function RGr(build) {
  const shared = new Map(); const R = {}; let arm = false;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => (arm && op === 'set' && isTurnsPath(p)) ? (arm = false, { code: 'unavailable', message: 'injected' }) : null; });
  await start(h1);
  for (let i = 1; i <= 10; i++) await h1.turn('Act ' + i);
  arm = true; await clickAndWait(h1, '#regen', true);
  R.page1Tag10 = pageTag(h1, 9);
  R.retried = await clickRetry(h1); R.ui = ui(h1);
  const v = storeView(shared); R.store = { turnCount: v.turnCount, chunks: v.chunks, storedTag10: (v.turns[9] || {}).tag };
  tally(R, h1); h1.close(); return R;
}

if (process.argv[2] === 'retry') {
  (async () => {
    const res = {};
    for (const b of ['published', 'fixed']) res[b] = { U2r: await U2r(b), RGr: await RGr(b) };
    const J = JSON.stringify; const line = (k, f) => console.log(k.padEnd(28), '| published:', f(res.published), '\n' + ''.padEnd(28), '| fixed:    ', f(res.fixed));
    console.log('\n=== U2r: Undo turn 10, new turn 10b chunk write fails once, player clicks Retry save ===');
    for (const k of ['retried', 'ui', 'store', 'problems', 'errors', 'violations']) line(k, (r) => J(r.U2r[k]));
    console.log('\n=== RGr: Regenerate turn 10, its chunk write fails once, player clicks Retry save ===');
    for (const k of ['page1Tag10', 'retried', 'ui', 'store', 'errors', 'violations']) line(k, (r) => J(r.RGr[k]));
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
} else
(async () => {
  const t0 = Date.now(); const res = {};
  for (const b of ['published', 'fixed']) { res[b] = {}; res[b].U1 = await U1(b); res[b].U2 = await U2(b); res[b].RG = await RG(b); res[b].DB = await DB(b); }
  const line = (k, f) => console.log(k.padEnd(28), '| published:', f(res.published), '\n' + ''.padEnd(28), '| fixed:    ', f(res.fixed));
  const J = JSON.stringify;
  console.log('\n=== U1: 11 turns, Undo, the delete of chunk 0001 fails once, click Retry save if offered, reload page 2, page 2 takes a turn ===');
  for (const k of ['uiAfterUndo', 'retried', 'uiAfterRetry', 'page1', 'store', 'problems', 'page2', 'page2StatusSeq', 'afterPage2Turn', 'errors', 'violations']) line(k, (r) => J(r.U1[k]));
  console.log('\n=== U2: 10 turns, Undo, new turn 10b chunk write fails once, turns 11b-12b, reload page 2, page 2 takes 13b ===');
  for (const k of ['afterUndo', 'uiDuringFailure', 'uiAfter', 'store', 'problems', 'page1', 'page2', 'page2StatusSeq', 'afterPage2Turn', 'errors', 'violations']) line(k, (r) => J(r.U2[k]));
  console.log('\n=== RG: 10 turns, Regenerate turn 10 with its chunk write failing once, turn 11, reload page 2 ===');
  for (const k of ['tagBefore', 'tagAfterRegen', 'uiDuringFailure', 'uiAfter', 'store', 'page1Tag10', 'page2Tag10', 'page2PrevVersionBtn', 'page2StatusSeq', 'errors', 'violations']) line(k, (r) => J(r.RG[k]));
  console.log('\n=== DB: turn 10 chunk write fails; turn 11 repairs chunk 0 but its chunk 0001 write fails; page 2 reloads, takes a turn ===');
  for (const k of ['uiPage1', 'store', 'page2', 'page2StatusSeq', 'page2Continuity', 'page2Last2', 'storeAfter', 'errors', 'violations']) line(k, (r) => J(r.DB[k]));
  console.log('\nelapsed', Math.round((Date.now() - t0) / 1000) + 's');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
