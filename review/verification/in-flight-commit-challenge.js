'use strict';
// in-flight-commit-challenge: routes the first tester did not try.
//  ceTurnFit : Adventures > Continue Bravo, close the dialog (Escape) while Bravo loads, Take turn on Alpha; the load lands while the
//              length-fit call runs. Does Alpha's turn end up in Bravo?
//  ceRegen   : same race, but Regenerate on Alpha; the load lands while the regen reply is pending. onRegenerate's own restore
//              (adv.turns.push(old); adv.state = restore.state) reads the global adv.
//  ceTurn    : control. Same race with Take turn, load lands while the main reply is pending (the fixed build's stale check window).
//  bootRegen : boot load slowed; Override 'Apply as turn' on the placeholder, then Regenerate; the boot load lands while the regen
//              reply is pending.
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || 'C:/Users/marcu/AppData/Local/Temp/wl-harness';
const BUILDS = {
  pub: { htmlPath: ROOT + '/src/index.html', worldsDir: ROOT + '/src/worlds' },
  fix: { htmlPath: ROOT + '/main/index.html', worldsDir: ROOT + '/main/worlds' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond, max = 5000) { const t0 = Date.now(); while (Date.now() - t0 < max) { try { if (cond()) return true; } catch (e) {} await sleep(10); } return false; }
const W = ['The', 'lamp', 'gutters', 'and', 'the', 'hall', 'goes', 'quiet', 'around', 'you', 'while', 'rain', 'ticks', 'on', 'glass.'];
const words = (n) => Array.from({ length: n }, (_, i) => W[i % W.length]).join(' ');
const reply = (mk, n) => JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: words(n || 150) + ' ' + mk + '.', suggested_actions: ['Look around', 'Wait', 'Leave'], secret_info: '', state_updates: [], time_advance_minutes: 15, events: ['Day 1 10:10 ' + mk + ' event happened.'], beats: [mk + ' beat'], facts: [], exposures: [] });

function installGate(mock, g) {
  mock.sampleHandler = (input, opts, call) => {
    const p = typeof input === 'string' ? input : input.map((m) => m.content).join('\n');
    const isIntro = /Write the roommate's first appearance/.test(p);
    const isOther = /Rewrite it to between|You maintain the long-term memory|Invent the people/.test(p);
    if (g.armTurn && !isIntro && !isOther) { g.armTurn = false; return new Promise((res, rej) => g.held.push({ kind: 'turn', res, rej })); }
    if (g.armFit && /Rewrite it to between/.test(p)) { g.armFit = false; return new Promise((res, rej) => g.held.push({ kind: 'fit', res, rej })); }
    if (g.armLong && !isIntro && !isOther) { g.armLong = false; return reply(g.mk, 900); }
    return mock.defaultHandler(input, opts, call);
  };
}
// slow exactly one db op matching (op, path): dbFail runs synchronously right before the op reads dbLatency
function installSlow(m) {
  const ctl = { rules: [], pending: null, hits: [] };
  m.dbFail = (op, path) => { const i = ctl.rules.findIndex((r) => r.op === op && r.re.test(path)); if (i >= 0) { ctl.pending = ctl.rules[i].ms; ctl.hits.push(op + ' ' + path); ctl.rules.splice(i, 1); } return null; };
  Object.defineProperty(m, 'dbLatency', { configurable: true, get: () => { if (ctl.pending != null) { const v = ctl.pending; ctl.pending = null; return v; } return 2; }, set: () => {} });
  return ctl;
}
const cloneStore = (m) => new Map([...m].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
function advs(store) { const out = {}; for (const [k, v] of store) { const m = /^adventures\/([^/]+)$/.exec(k); if (m) out[m[1]] = v.data; } return out; }
function advJson(store, id) { const o = {}; for (const [k, v] of store) if (k === 'adventures/' + id || k.startsWith('adventures/' + id + '/')) o[k] = JSON.stringify(v.data); return o; }
function storedTurns(store, id) { const ks = [...store.keys()].filter((k) => k.startsWith('adventures/' + id + '/turns/')).sort(); const t = []; for (const k of ks) t.push(...(store.get(k).data.turns || [])); return t; }
const idByTitle = (store, t) => Object.entries(advs(store)).filter(([, d]) => d.title === t).map(([id]) => id);
const st = (d) => d && d.state ? 'D' + d.state.day + ' ' + d.state.time + ' ' + d.state.location : '-';
const sb = (t) => t && t.stateBefore ? 'D' + t.stateBefore.day + ' ' + t.stateBefore.time + ' ' + String(t.stateBefore.location).slice(0, 24) : '?';

async function openAdv(h) { h.click('#btnAdventures'); await h.settle(80, 4000); await waitFor(() => h.document.querySelectorAll('#advlist .advrow').length > 0, 3000); }
function closeAdv(h) { const d = h.$('#dlgAdventures'); if (d.hasAttribute('open')) d.close(); }
function rowByTitle(h, t) { return [...h.document.querySelectorAll('#advlist .advrow')].find((r) => r.querySelector('.t').textContent === t); }
function currentRow(h) { return [...h.document.querySelectorAll('#advlist .advrow')].find((r) => r.querySelector('[data-act="open"]').textContent === 'Current'); }
async function continueTitle(h, t) { await openAdv(h); const r = rowByTitle(h, t); h.click(r.querySelector('[data-act="open"]')); await h.settle(100, 5000); closeAdv(h); }
async function setClock(h, day, time, loc) { h.$('#ovrDay').value = String(day); h.$('#ovrTime').value = time; h.$('#ovrLocation').value = loc; h.click('#ovrClockSet'); await h.idle(8000); }
function pageState(h) { h.click('#ovrStateReset'); try { const s = JSON.parse(h.$('#ovrState').value); return 'D' + s.day + ' ' + s.time + ' ' + s.location; } catch (e) { return '?'; } }
async function pageCurrentTitle(h) { await openAdv(h); const r = currentRow(h); const t = r ? r.querySelector('.t').textContent : '(none)'; closeAdv(h); return t; }
const clock = (h) => h.$('#clock').title || h.$('#clock').textContent;
const statusText = (h) => (h.$('#status').hidden ? '' : h.$('#status').textContent).replace(/\s+/g, ' ').trim().slice(0, 100);


// fresh device on the resulting store: what opens at boot, and can the damaged adventure still be continued?
async function reloadCheck(bk, store, title) {
  const h2 = await boot({ htmlPath: BUILDS[bk].htmlPath, worldsDir: BUILDS[bk].worldsDir, setup(w, m) { m.store = store; } });
  await h2.settle(150, 6000); await h2.idle(8000);
  const bootLoc = clock(h2).split(' · ').pop().slice(0, 24); const bootStatus = statusText(h2).slice(0, 60);
  await openAdv(h2); const r = rowByTitle(h2, title); let cont = 'no row';
  if (r) { const btn = r.querySelector('[data-act="open"]'); if (btn.textContent === 'Current') cont = 'already current'; else { h2.click(btn); await h2.settle(150, 6000); cont = statusText(h2).slice(0, 70) || 'loaded'; } }
  closeAdv(h2); const loc = clock(h2).split(' · ').pop().slice(0, 24); const e = h2.errors.length; h2.close();
  return 'boot:' + bootLoc + ' [' + bootStatus + '] continue ' + title + ': ' + cont + ' -> ' + loc + ' err ' + e;
}
async function seed(bk) {
  const store = new Map(); const g = { held: [] };
  const h = await boot({ htmlPath: BUILDS[bk].htmlPath, worldsDir: BUILDS[bk].worldsDir, setup(w, m) { m.store = store; installGate(m, g); } });
  await h.settle(150, 6000);
  h.type('#cTitle', 'Alpha'); h.click('#cBegin'); await h.idle(30000);
  await h.turn('Seed A one');
  await openAdv(h); h.$('#newWorld').value = 'halloway'; h.click('#newAdv'); await h.settle(100, 4000);
  h.type('#cTitle', 'Bravo'); h.click('#cBegin'); await h.idle(30000);
  await h.turn('Seed B one');
  await setClock(h, 22, '13:30', 'Bravo Hall');
  await continueTitle(h, 'Alpha'); await h.idle();
  await h.turn('Seed A two');
  await setClock(h, 11, '09:15', 'Alpha Quay');
  const A = idByTitle(store, 'Alpha')[0], B = idByTitle(store, 'Bravo')[0];
  const info = { errors: h.errors.length, viol: h.mock.violations.length };
  h.close();
  return { store, A, B, info };
}

// Continue Bravo, close the dialog while Bravo's turn chunks load (slowed), then act on Alpha.
async function continueEsc(bk, sd, kind) {
  const store = cloneStore(sd.store); const mk = 'ZQ' + bk + kind + 'MK'; const g = { held: [], mk }; let slow;
  const h = await boot({ htmlPath: BUILDS[bk].htmlPath, worldsDir: BUILDS[bk].worldsDir, setup(w, m) { m.store = store; installGate(m, g); slow = installSlow(m); } });
  await waitFor(() => /Alpha Quay/.test(clock(h)), 6000); await h.idle(8000);
  const startClock = clock(h).split(' · ').pop();
  await openAdv(h);
  const row = rowByTitle(h, 'Bravo');
  slow.rules.push({ op: 'query', re: new RegExp('^adventures/' + sd.B + '/turns$'), ms: 1500 });
  h.click(row.querySelector('[data-act="open"]'));
  await sleep(5); closeAdv(h);                                   // Escape: the Continue handler keeps loading in the background
  const dlgOpen = h.$('#dlgAdventures').hasAttribute('open');
  const sendEnabled = !h.$('#send').disabled, regenEnabled = !h.$('#regen').disabled;
  if (kind === 'ceTurnFit') { g.armLong = true; g.armFit = true; h.$('#action').value = 'Race turn ' + mk; h.click('#send'); }
  else if (kind === 'ceTurn') { g.armTurn = true; h.$('#action').value = 'Race turn ' + mk; h.click('#send'); }
  else if (kind === 'ceRegen') { g.armTurn = true; h.click('#regen'); }
  const held = await waitFor(() => g.held.length === 1, 4000);
  const heldKind = g.held[0] ? g.held[0].kind : 'none';
  const landedBeforeRelease = /Bravo Hall/.test(clock(h));
  const landed = await waitFor(() => /Bravo Hall/.test(clock(h)), 6000);
  const midStatus = statusText(h);
  if (g.held[0]) g.held[0].res(heldKind === 'fit' ? h.mock.defaultHandler('Rewrite it to between', {}, {}) : reply(mk));
  await h.idle(20000);
  const endStatus = statusText(h);
  const pageAfter = pageState(h);
  const title = await pageCurrentTitle(h);
  // follow-up on whatever is current (expected Bravo): does Bravo's next turn start from Alpha's state, and does Bravo's store pick up Alpha's material?
  let follow = '-';
  if (title === 'Bravo') { await h.turn('Follow-up on Bravo'); const bt = storedTurns(store, sd.B); follow = 'B turns:' + bt.map((t) => t.action.slice(0, 12)).join('/') + ' lastStateBefore:' + sb(bt[bt.length - 1]); }
  const bt = storedTurns(store, sd.B); const bDoc = advs(store)[sd.B];
  const bHasA = bt.some((t) => /Seed A|Race turn/.test(t.action)) || JSON.stringify(advJson(store, sd.B)).includes(mk) || /Alpha Quay/.test(st(bDoc));
  const aJ = JSON.stringify(advJson(store, sd.A));
  const aGot = aJ.includes(mk) ? 'got-turn' : (aJ === JSON.stringify(advJson(sd.store, sd.A)) ? 'untouched' : 'changed');
  const reload = await reloadCheck(bk, store, 'Bravo');
  // The race must really have happened: Bravo's slowed chunk query was hit (exactly once: one rule is installed) and Bravo
  // finished loading with Bravo's own state; and the page must have refused new actions while it loaded (controls disabled).
  // A page that never left Alpha fails.
  const raced = slow.hits.length === 1 && landed && title === 'Bravo' && /Bravo Hall/.test(pageAfter);
  const pass = raced && !sendEnabled && !regenEnabled && !bHasA && h.errors.length === 0 && h.mock.violations.length === 0;
  const r = { build: bk, route: kind, start: startClock, dlgOpenAfterEsc: dlgOpen, sendEnabled, regenEnabled, held: held + ':' + heldKind, landedBeforeRelease, landed, slowHits: slow.hits.length, midStatus, endStatus, page: title, pageStateAfterRelease: pageAfter, follow, Bstored: st(bDoc) + ' tc ' + (bDoc && bDoc.turnCount), BhasAlphaMaterial: bHasA, A: aGot, reload, errors: h.errors.length, viol: h.mock.violations.length, pass };
  h.close();
  return r;
}

// Boot load slowed; Override Apply puts a turn on the placeholder; Regenerate it; the boot load lands while the regen reply is pending.
async function bootRegen(bk, sd) {
  const store = cloneStore(sd.store); const mk = 'ZQ' + bk + 'bootRegenMK'; const g = { held: [], mk }; let slow;
  const h = await boot({ htmlPath: BUILDS[bk].htmlPath, worldsDir: BUILDS[bk].worldsDir, setup(w, m) { m.store = store; installGate(m, g); slow = installSlow(m); slow.rules.push({ op: 'query', re: /^adventures\/[^/]+\/turns$/, ms: 2500 }); } });
  await waitFor(() => !h.$('#send').disabled, 3000);
  const placeholderClock = clock(h).split(' · ').pop();
  h.$('#ovrAction').value = 'Override placeholder'; h.$('#ovrReply').value = reply('OVR' + mk); h.click('#ovrReplyApply');
  await waitFor(() => /Applied|Could not/.test(h.$('#ovrReplyNote').textContent), 3000);
  const ovrNote = h.$('#ovrReplyNote').textContent;
  await sleep(50);
  const regenEnabled = !h.$('#regen').disabled;
  g.armTurn = true; h.click('#regen');
  const held = await waitFor(() => g.held.length === 1, 3000);
  const loadedBeforeRelease = /Alpha Quay/.test(clock(h));
  const landed = await waitFor(() => /Alpha Quay/.test(clock(h)), 6000);
  if (g.held[0]) g.held[0].res(reply(mk));
  await h.idle(20000);
  const endStatus = statusText(h);
  const pageAfter = pageState(h);
  const title = await pageCurrentTitle(h);
  let follow = '-';
  if (title === 'Alpha') { await h.turn('Follow-up on Alpha'); const at = storedTurns(store, sd.A); follow = 'A turns:' + at.map((t) => 'n' + t.n + ' ' + t.action.slice(0, 14)).join('/') + ' lastStateBefore:' + sb(at[at.length - 1]); }
  const at = storedTurns(store, sd.A);
  const aHasPlaceholder = at.some((t) => /Override placeholder/.test(t.action)) || JSON.stringify(advJson(store, sd.A)).includes(mk);
  const dupN = at.length !== new Set(at.map((t) => t.n)).size;
  const reload = await reloadCheck(bk, store, 'Alpha');
  // The race must really have happened: the slowed boot query was hit, the Override turn applied, the regenerate call was
  // held while the boot load landed, and Alpha ended up open with Alpha's own state.
  const raced = slow.hits.length > 0 && /Applied/.test(ovrNote) && held && landed && title === 'Alpha' && /Alpha Quay/.test(pageAfter);
  const pass = raced && !aHasPlaceholder && h.errors.length === 0 && h.mock.violations.length === 0;
  const r = { build: bk, route: 'bootRegen', placeholderClock, ovrNote, regenEnabled, held, loadedBeforeRelease, landed, endStatus, page: title, pageStateAfterRelease: pageAfter, follow, AhasPlaceholderTurn: aHasPlaceholder, dupN, reload, errors: h.errors.length, viol: h.mock.violations.length, pass };
  h.close();
  return r;
}

(async () => {
  const t0 = Date.now(); const seeds = {};
  for (const bk of ['pub', 'fix']) { seeds[bk] = await seed(bk); const s = seeds[bk]; console.log('SEED', bk, 'A', st(advs(s.store)[s.A]), '| B', st(advs(s.store)[s.B]), '| errors', s.info.errors, 'viol', s.info.viol); }
  const results = [];
  for (const kind of ['ceTurn', 'ceTurnFit', 'ceRegen', 'bootRegen']) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(kind)) continue;
    for (const bk of ['pub', 'fix']) {
      let r; try { r = kind === 'bootRegen' ? await bootRegen(bk, seeds[bk]) : await continueEsc(bk, seeds[bk], kind); } catch (e) { r = { build: bk, route: kind, pass: false, crash: String(e && e.stack || e).slice(0, 400) }; }
      results.push(r); console.log(JSON.stringify(r));
    }
  }
  console.log('\n=== SIDE BY SIDE ===');
  const rows = {}; for (const r of results) { rows[r.route] = rows[r.route] || {}; rows[r.route][r.build] = r; }
  const fmt = (r) => !r ? '-' : r.crash ? 'CRASH ' + r.crash.slice(0, 80) : (r.pass ? 'PASS' : 'FAIL') + ' page:' + r.page + ' pageState:' + r.pageStateAfterRelease + ' | end:' + (r.endStatus || '').slice(0, 70) + ' | ' + r.follow + ' | err ' + r.errors + ' viol ' + r.viol + (r.reload ? ' | RELOAD ' + r.reload : '');
  for (const [route, v] of Object.entries(rows)) console.log(route, '\n   PUB:', fmt(v.pub), '\n   FIX:', fmt(v.fix));
  console.log('total seconds', Math.round((Date.now() - t0) / 1000));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
