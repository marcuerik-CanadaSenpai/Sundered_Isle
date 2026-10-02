'use strict';
// chunk-repair: a failed chunk (or adventure doc) write must be repaired on the next save, the page must warn while
// the save is failing, and a second page reloading from the shared store must match the first page.
const path = require('path');
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || 'C:/Users/marcu/AppData/Local/Temp/wl-harness';
const BUILDS = {
  published: { htmlPath: ROOT + '/src/index.html', worldsDir: ROOT + '/src/worlds' },
  fixed: { htmlPath: ROOT + '/main/index.html', worldsDir: ROOT + '/main/worlds' },
};
const isTurnsPath = (p) => /^adventures\/[^/]+\/turns\/[^/]+$/.test(p);
const isAdvDoc = (p) => /^adventures\/[^/]+$/.test(p);

function storeView(store) {
  const advKeys = [...store.keys()].filter(isAdvDoc);
  const out = [];
  for (const k of advKeys) {
    const id = k.split('/')[1]; const d = store.get(k).data;
    const chunkKeys = [...store.keys()].filter((x) => x.startsWith(k + '/turns/')).sort();
    const turns = []; for (const ck of chunkKeys) { const b = store.get(ck).data; for (const t of (b.turns || [])) turns.push({ n: t.n, a: t.action }); }
    out.push({ id, turnCount: d.turnCount, rev: d.rev, chunks: chunkKeys.map((c) => c.split('/').pop() + ':' + (store.get(c).data.turns || []).map((t) => t.n).join(',')), turns });
  }
  return out;
}
function checkConsistent(v, expectN) {
  // every turn exactly once, numbered 1..N in order, actions match, turnCount === N
  const probs = [];
  const ns = v.turns.map((t) => t.n);
  if (v.turnCount !== expectN) probs.push('turnCount ' + v.turnCount + ' != ' + expectN);
  if (v.turns.length !== expectN) probs.push('stored turns ' + v.turns.length + ' != ' + expectN);
  const dup = ns.filter((n, i) => ns.indexOf(n) !== i); if (dup.length) probs.push('duplicate n ' + [...new Set(dup)].join(','));
  for (let i = 1; i <= expectN; i++) { const t = v.turns.find((x) => x.a === 'Act ' + i); if (!t) probs.push('missing Act ' + i); else if (t.n !== i) probs.push('Act ' + i + ' has n=' + t.n); }
  return probs;
}
function pageView(h) {
  return [...h.document.querySelectorAll('#feed article.turn:not(.draft)')].slice(1).map((el) => {
    const n = (el.querySelector('.turn-meta .n') || {}).textContent || '';
    const a = (el.querySelector('.turn-action') || {}).textContent || '';
    return n.replace('Turn ', '') + '=' + a;
  });
}
function ui(h) {
  const st = h.$('#status');
  return { note: h.$('#summaryNote').textContent.trim(), status: st.hidden ? '' : st.textContent.trim().slice(0, 140), statusBad: st.classList.contains('bad'), retryBtn: !!st.querySelector('button') };
}
async function newPage(build, shared, setup) {
  const h = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { m.store = shared; if (setup) setup(w, m); } }));
  await h.settle(150, 6000);
  return h;
}
async function startAdventure(h) { h.click('#cBegin'); await h.idle(); }
const dlgOpen = (h, id) => { const d = h.$('#' + id); return !!(d && d.hasAttribute('open')); };

// ---------- scenario A / B: one transient failure on the turn that fills chunk 0 (turn 10) ----------
async function transient(build, target) {
  const shared = new Map(); const R = { build, target };
  let armed = false, fired = 0;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => { if (armed && op === 'set' && (target === 'chunk' ? isTurnsPath(p) : isAdvDoc(p))) { armed = false; fired++; return { code: 'unavailable', message: 'injected transient failure' }; } return null; }; });
  await startAdventure(h1);
  for (let i = 1; i <= 9; i++) await h1.turn('Act ' + i);
  armed = true; await h1.turn('Act 10');
  R.fired = fired;
  R.uiDuringFailure = ui(h1);
  R.storeDuringFailure = storeView(shared).map((v) => ({ turnCount: v.turnCount, chunks: v.chunks }));
  for (let i = 11; i <= 13; i++) await h1.turn('Act ' + i);
  R.uiAfterNextSave = ui(h1);
  const v = storeView(shared); R.advDocs = v.length;
  R.store = { turnCount: v[0].turnCount, chunks: v[0].chunks };
  R.storeProblems = checkConsistent(v[0], 13);
  R.page1 = pageView(h1);
  // reload on a second device sharing the store
  const h2 = await newPage(build, shared);
  R.page2CreateOpen = dlgOpen(h2, 'dlgCreate');
  R.page2 = pageView(h2);
  R.page2Status = ui(h2).status;
  R.pagesMatch = JSON.stringify(R.page1) === JSON.stringify(R.page2);
  // keep playing on device 2: does the damage cascade?
  await h2.turn('Act 14');
  const v2 = storeView(shared);
  R.afterPage2Turn = { chunks: v2[0].chunks, turnCount: v2[0].turnCount, problems: checkConsistent(v2[0], 14) };
  R.page2Last = pageView(h2).slice(-2);
  R.errors = h1.errors.length + h2.errors.length; R.errMsgs = h1.errors.concat(h2.errors).slice(0, 2).map((e) => e.message.slice(0, 160));
  R.violations = h1.mock.violations.concat(h2.mock.violations).map((x) => x.kind);
  h1.close(); h2.close();
  return R;
}

// ---------- scenario C: permanent quota_exceeded on every chunk write from turn 6 on ----------
async function permanent(build) {
  const shared = new Map(); const R = { build };
  let on = false;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => (on && op === 'set' && isTurnsPath(p)) ? { code: 'quota_exceeded', message: 'database holds at most 5000 documents' } : null; });
  await startAdventure(h1);
  for (let i = 1; i <= 5; i++) await h1.turn('Act ' + i);
  on = true;
  R.ui = [];
  for (let i = 6; i <= 8; i++) { await h1.turn('Act ' + i); R.ui.push(Object.assign({ turn: i }, ui(h1))); }
  R.page1Turns = pageView(h1).length;
  const v = storeView(shared); R.store = { turnCount: v[0].turnCount, chunks: v[0].chunks, storedTurns: v[0].turns.length };
  const h2 = await newPage(build, shared);
  R.page2Turns = pageView(h2).length; R.page2Status = ui(h2).status;
  R.errors = h1.errors.length + h2.errors.length;
  R.violations = h1.mock.violations.concat(h2.mock.violations).map((x) => x.kind);
  h1.close(); h2.close();
  return R;
}

function metaTimes(h) {
  return [...h.document.querySelectorAll('#feed article.turn:not(.draft)')].slice(1).map((el) => {
    const sp = el.querySelectorAll('.turn-meta span');
    return ((sp[0] || {}).textContent || '') + ' ' + ((sp[1] || {}).textContent || '') + ' [' + ((el.querySelector('.turn-action') || {}).textContent || '') + ']';
  });
}

// time continuity: each turn must start at the time the previous turn ended (state matches the log)
function continuity(mt) {
  const bad = [];
  for (let i = 1; i < mt.length; i++) { const p = /→ (\d\d:\d\d)/.exec(mt[i - 1]); const c = /Day \d+ (\d\d:\d\d) →/.exec(mt[i]); if (p && c && p[1] !== c[1]) bad.push(mt[i].split(' Day')[0] + ' starts ' + c[1] + ' but previous ended ' + p[1]); }
  return bad.length ? bad : 'ok';
}
// numbering only: stored turns numbered 1..N once each, turnCount === N
function numbering(v) { const ns = v.turns.map((t) => t.n); const ok = ns.every((n, i) => n === i + 1) && v.turnCount === ns.length; return ok ? 'ok (' + ns.length + ' turns)' : 'bad: n=' + ns.join(',') + ' turnCount=' + v.turnCount; }

// ---------- scenario D: reload on page 2 DURING the failure window (before any repair), then page 2 plays on ----------
async function midReload(build, target) {
  const shared = new Map(); const R = { build, target };
  let armed = false;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => { if (armed && op === 'set' && (target === 'chunk' ? isTurnsPath(p) : isAdvDoc(p))) { armed = false; return { code: 'unavailable', message: 'injected' }; } return null; }; });
  await startAdventure(h1);
  for (let i = 1; i <= 9; i++) await h1.turn('Act ' + i);
  armed = true; await h1.turn('Act 10');
  R.page1Last = metaTimes(h1).slice(-2);
  const v = storeView(shared); R.store = { turnCount: v[0].turnCount, chunks: v[0].chunks };
  const h2 = await newPage(build, shared);
  R.page2Count = pageView(h2).length; R.page2Status = ui(h2).status;
  await h2.turn('Act 11');
  const mt = metaTimes(h2); R.page2Last = mt.slice(-3); R.continuity = continuity(mt);
  const v2 = storeView(shared); R.storeAfter = { turnCount: v2[0].turnCount, chunks: v2[0].chunks, numbering: numbering(v2[0]) };
  R.errors = h1.errors.length + h2.errors.length; R.violations = h1.mock.violations.concat(h2.mock.violations).map((x) => x.kind);
  h1.close(); h2.close();
  return R;
}

// ---------- scenario E: chunk write of turn 10 fails, player presses the Retry save button (no new turn) ----------
async function retryButton(build) {
  const shared = new Map(); const R = { build };
  let armed = false;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => { if (armed && op === 'set' && isTurnsPath(p)) { armed = false; return { code: 'unavailable', message: 'injected' }; } return null; }; });
  await startAdventure(h1);
  for (let i = 1; i <= 9; i++) await h1.turn('Act ' + i);
  armed = true; await h1.turn('Act 10');
  const btn = h1.$('#status button');
  R.button = btn ? btn.textContent : null;
  if (btn) { h1.click(btn); await h1.idle(); }
  R.ui = ui(h1);
  const v = storeView(shared); R.store = { turnCount: v[0].turnCount, chunks: v[0].chunks }; R.problems = checkConsistent(v[0], 10);
  R.errors = h1.errors.length; R.violations = h1.mock.violations.map((x) => x.kind);
  h1.close();
  return R;
}

// ---------- scenario F: two consecutive failures (turn 10 chunk write, and the repair attempt on turn 11), then turns 12-13 ----------
async function doubleFail(build) {
  const shared = new Map(); const R = { build };
  let left = 0;
  const h1 = await newPage(build, shared, (w, m) => { m.dbFail = (op, p) => { if (left > 0 && op === 'set' && isTurnsPath(p)) { left--; return { code: 'unavailable', message: 'injected' }; } return null; }; });
  await startAdventure(h1);
  for (let i = 1; i <= 9; i++) await h1.turn('Act ' + i);
  left = 1; await h1.turn('Act 10');
  left = 1; await h1.turn('Act 11');
  R.uiAfter11 = ui(h1);
  for (let i = 12; i <= 13; i++) await h1.turn('Act ' + i);
  const v = storeView(shared); R.store = { turnCount: v[0].turnCount, chunks: v[0].chunks }; R.problems = checkConsistent(v[0], 13);
  const h2 = await newPage(build, shared);
  R.pagesMatch = JSON.stringify(pageView(h1)) === JSON.stringify(pageView(h2));
  R.errors = h1.errors.length + h2.errors.length; R.violations = h1.mock.violations.concat(h2.mock.violations).map((x) => x.kind);
  h1.close(); h2.close();
  return R;
}

(async () => {
  const t0 = Date.now();
  const res = {};
  for (const b of ['published', 'fixed']) {
    res[b] = {};
    res[b].A = await transient(b, 'chunk');
    res[b].B = await transient(b, 'doc');
    res[b].C = await permanent(b);
    res[b].Dc = await midReload(b, 'chunk');
    res[b].Dd = await midReload(b, 'doc');
    res[b].E = await retryButton(b);
    res[b].F = await doubleFail(b);
  }
  const line = (k, f) => console.log(k.padEnd(34), '| published:', f(res.published), '\n' + ''.padEnd(34), '| fixed:    ', f(res.fixed));
  for (const S of ['A', 'B']) {
    console.log('\n=== Scenario ' + S + ': one transient unavailable on the ' + (S === 'A' ? 'chunk' : 'adventure doc') + ' write of turn 10, then turns 11-13, reload on page 2, page 2 takes turn 14 ===');
    line('failures injected', (r) => r[S].fired);
    line('UI right after failing turn', (r) => JSON.stringify(r[S].uiDuringFailure));
    line('store during failure', (r) => JSON.stringify(r[S].storeDuringFailure));
    line('UI after next save (turn 13)', (r) => JSON.stringify(r[S].uiAfterNextSave));
    line('store after turn 13', (r) => JSON.stringify(r[S].store));
    line('store problems after turn 13', (r) => JSON.stringify(r[S].storeProblems));
    line('page1 turns', (r) => r[S].page1.length + ' ' + JSON.stringify(r[S].page1.slice(8, 11)));
    line('page2 turns (reload)', (r) => r[S].page2.length + ' ' + JSON.stringify(r[S].page2.slice(8, 11)) + ' createDlg=' + r[S].page2CreateOpen);
    line('page2 status', (r) => JSON.stringify(r[S].page2Status));
    line('pages match', (r) => r[S].pagesMatch);
    line('after page2 turn 14', (r) => JSON.stringify(r[S].afterPage2Turn) + ' last=' + JSON.stringify(r[S].page2Last));
    line('errors / violations', (r) => r[S].errors + ' ' + JSON.stringify(r[S].errMsgs) + ' / ' + JSON.stringify(r[S].violations));
    line('VERDICT', (r) => (r[S].storeProblems.length === 0 && r[S].pagesMatch && r[S].afterPage2Turn.problems.length === 0 && (/fail/i.test(r[S].uiDuringFailure.note + r[S].uiDuringFailure.status)) && r[S].errors === 0 && r[S].violations.length === 0) ? 'PASS' : 'FAIL');
  }
  console.log('\n=== Scenario C: permanent quota_exceeded on every chunk write from turn 6 (turns 6-8), reload on page 2 ===');
  line('UI per failing turn', (r) => JSON.stringify(r.C.ui));
  line('page1 turns / store', (r) => r.C.page1Turns + ' / ' + JSON.stringify(r.C.store));
  line('page2 reload', (r) => r.C.page2Turns + ' turns, status ' + JSON.stringify(r.C.page2Status));
  line('errors / violations', (r) => r.C.errors + ' / ' + JSON.stringify(r.C.violations));
  for (const S of ['Dc', 'Dd']) {
    console.log('\n=== Scenario ' + S + ': transient unavailable on the ' + (S === 'Dc' ? 'chunk' : 'adventure doc') + ' write of turn 10, page 2 reloads BEFORE any repair, page 2 takes turn 11 ===');
    line('page1 last two turns', (r) => JSON.stringify(r[S].page1Last));
    line('store during failure', (r) => JSON.stringify(r[S].store));
    line('page2 on reload', (r) => r[S].page2Count + ' turns, status ' + JSON.stringify(r[S].page2Status));
    line('page2 last three after its turn', (r) => JSON.stringify(r[S].page2Last));
    line('page2 time continuity', (r) => JSON.stringify(r[S].continuity));
    line('store after page2 turn', (r) => JSON.stringify(r[S].storeAfter));
    line('errors / violations', (r) => r[S].errors + ' / ' + JSON.stringify(r[S].violations));
  }
  console.log('\n=== Scenario E: chunk write of turn 10 fails, player clicks the button in the status bar ===');
  line('button', (r) => JSON.stringify(r.E.button));
  line('UI after click', (r) => JSON.stringify(r.E.ui));
  line('store / problems', (r) => JSON.stringify(r.E.store) + ' ' + JSON.stringify(r.E.problems));
  line('errors / violations', (r) => r.E.errors + ' / ' + JSON.stringify(r.E.violations));
  console.log('\n=== Scenario F: chunk write fails on turn 10 and again on turn 11, then turns 12-13, reload ===');
  line('UI after turn 11', (r) => JSON.stringify(r.F.uiAfter11));
  line('store / problems', (r) => JSON.stringify(r.F.store) + ' ' + JSON.stringify(r.F.problems));
  line('pages match / errors / violations', (r) => r.F.pagesMatch + ' / ' + r.F.errors + ' / ' + JSON.stringify(r.F.violations));
  console.log('\nelapsed',Math.round((Date.now() - t0) / 1000) + 's');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
