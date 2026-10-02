'use strict';
// in-flight-commit: a turn (or roommate intro) still running must not be committed into whichever adventure is loaded
// when the reply arrives. Same scenarios against the published build (src) and the fixed build (main).
const path = require('path');
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
const turnReply = (mk) => JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: words(150) + ' ' + mk + '.', suggested_actions: ['Look around', 'Wait', 'Leave'], secret_info: '', state_updates: [], time_advance_minutes: 15, events: ['Day 1 10:10 ' + mk + ' event happened.'], beats: [mk + ' beat'], facts: [], exposures: [] });
const longTurnReply = (mk) => JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: words(900) + ' ' + mk + '.', suggested_actions: ['Look around', 'Wait', 'Leave'], secret_info: '', state_updates: [], time_advance_minutes: 15, events: ['Day 1 10:10 ' + mk + ' event happened.'], beats: [mk + ' beat'], facts: [], exposures: [] });
const introReply = (mk) => words(140) + ' ' + mk + '.';

// gate: holds the next turn call (armTurn) or roommate intro call (armIntro) until the script releases it
function installGate(mock, g) {
  mock.sampleHandler = (input, opts, call) => {
    const p = typeof input === 'string' ? input : input.map((m) => m.content).join('\n');
    const isIntro = /Write the roommate's first appearance/.test(p);
    const isOther = /Rewrite it to between|You maintain the long-term memory|Invent the people/.test(p);
    if (g.armTurn && !isIntro && !isOther) { g.armTurn = false; return new Promise((res, rej) => g.held.push({ kind: 'turn', res, rej })); }
    if (g.armFit && /Rewrite it to between/.test(p)) { g.armFit = false; return new Promise((res, rej) => g.held.push({ kind: 'fit', res, rej })); }
    if (g.armLong && !isIntro && !isOther) { g.armLong = false; return longTurnReply(g.mk); }
    if (g.armIntro && isIntro) { g.armIntro = false; return new Promise((res, rej) => g.held.push({ kind: 'intro', res, rej })); }
    return mock.defaultHandler(input, opts, call);
  };
}
const cloneStore = (m) => new Map([...m].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
function advs(store) {
  const out = {};
  for (const [k, v] of store) { const m = /^adventures\/([^/]+)$/.exec(k); if (m) out[m[1]] = v.data; }
  return out;
}
function advJson(store, id) { const o = {}; for (const [k, v] of store) if (k === 'adventures/' + id || k.startsWith('adventures/' + id + '/')) o[k] = JSON.stringify(v.data); return o; }
function hasMarker(store, id, mk) { return Object.values(advJson(store, id)).some((s) => s.includes(mk)); }
const idByTitle = (store, t) => Object.entries(advs(store)).filter(([, d]) => d.title === t).map(([id]) => id);
const st = (d) => d && d.state ? 'D' + d.state.day + ' ' + d.state.time + ' ' + d.state.location : '-';

async function openAdv(h) { h.click('#btnAdventures'); await h.settle(80, 4000); await waitFor(() => h.document.querySelectorAll('#advlist .advrow').length > 0, 3000); }
function closeAdv(h) { const d = h.$('#dlgAdventures'); if (d.hasAttribute('open')) d.close(); }
function rowByTitle(h, t) { return [...h.document.querySelectorAll('#advlist .advrow')].find((r) => r.querySelector('.t').textContent === t); }
function currentRow(h) { return [...h.document.querySelectorAll('#advlist .advrow')].find((r) => r.querySelector('[data-act="open"]').textContent === 'Current'); }
async function continueTitle(h, t) { await openAdv(h); const r = rowByTitle(h, t); if (!r) throw new Error('no row ' + t); h.click(r.querySelector('[data-act="open"]')); await h.settle(100, 5000); closeAdv(h); }
async function setClock(h, day, time, loc) { h.$('#ovrDay').value = String(day); h.$('#ovrTime').value = time; h.$('#ovrLocation').value = loc; h.click('#ovrClockSet'); await h.idle(8000); }
function pageState(h) { h.click('#ovrStateReset'); try { const s = JSON.parse(h.$('#ovrState').value); return 'D' + s.day + ' ' + s.time + ' ' + s.location; } catch (e) { return '?'; } }
async function pageCurrentTitle(h) { await openAdv(h); const r = currentRow(h); const t = r ? r.querySelector('.t').textContent : '(none)'; closeAdv(h); return t; }
async function importText(h, text) { const win = h.window; const file = new win.File([text], 'alpha.json', { type: 'application/json' }); const inp = h.$('#importFile'); Object.defineProperty(inp, 'files', { value: [file], configurable: true }); inp.dispatchEvent(new win.Event('change', { bubbles: true })); await h.settle(150, 8000); }
const statusText = (h) => (h.$('#status').hidden ? '' : h.$('#status').textContent).replace(/\s+/g, ' ').trim().slice(0, 110);

// ---------- seed: A = 'Alpha' (sundered, has a generated roommate), B = 'Bravo' (halloway) ----------
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
  await openAdv(h); h.click('#exportAdv'); await h.settle(100, 4000); closeAdv(h);
  const exp = h.mock.downloadsLog[h.mock.downloadsLog.length - 1];
  const A = idByTitle(store, 'Alpha')[0], B = idByTitle(store, 'Bravo')[0];
  const info = { errors: h.errors.length, viol: h.mock.violations.length, A: advs(store)[A], B: advs(store)[B] };
  h.close();
  return { store, exportText: exp && String(exp.data), A, B, info };
}

// ---------- routes tried while the call is held ----------
const ROUTES = {
  async continueOther(h, ctx) { await openAdv(h); const r = rowByTitle(h, ctx.other); if (!r) return 'no row'; h.click(r.querySelector('[data-act="open"]')); await h.settle(150, 6000); closeAdv(h); return 'clicked Continue ' + ctx.other; },
  async newBegin(h, ctx) { await openAdv(h); h.$('#newWorld').value = ctx.newWorld; h.click('#newAdv'); await h.settle(100, 4000); h.type('#cTitle', ctx.newTitle); h.click('#cBegin'); await h.settle(200, 15000); const note = h.$('#cNote').textContent.slice(0, 90); if (h.$('#dlgCreate').hasAttribute('open')) h.$('#dlgCreate').close(); return 'Begin ' + ctx.newWorld + (note ? ' cNote=' + note : ''); },
  async importFile(h, ctx) { await openAdv(h); await importText(h, ctx.exportText); closeAdv(h); return 'imported Alpha export'; },
  async deleteCurrent(h) { await openAdv(h); const r = currentRow(h); if (!r) return 'no current row'; const t = r.querySelector('.t').textContent; h.click(r.querySelector('[data-act="delete"]')); const ok = r.querySelector('.confirm button'); if (!ok) return 'no confirm'; h.click(ok); await h.settle(200, 8000); closeAdv(h); return 'deleted current ' + t; },
};

function evaluate(h, sd, store, mk, allowedId, pageTitle, extra) {
  const seedAdvs = advs(sd.store), now = advs(store);
  const markerIn = Object.keys(now).filter((id) => hasMarker(store, id, mk)).map((id) => now[id].title);
  const bJ0 = advJson(sd.store, sd.B), bJ1 = advJson(store, sd.B);
  const bSame = JSON.stringify(bJ0) === JSON.stringify(bJ1);
  const aDoc = now[sd.A], a0 = seedAdvs[sd.A];
  let aOut;
  if (!aDoc) aOut = 'deleted';
  else if (aDoc.turnCount === a0.turnCount + 1 && hasMarker(store, sd.A, mk)) aOut = 'got-turn';
  else if (JSON.stringify(advJson(sd.store, sd.A)) === JSON.stringify(advJson(store, sd.A))) aOut = 'untouched';
  else if (aDoc.turnCount === a0.turnCount && !hasMarker(store, sd.A, mk)) aOut = 'no-turn(changed:' + st(aDoc) + ')';
  else aOut = 'odd(tc ' + a0.turnCount + '->' + aDoc.turnCount + ', marker ' + hasMarker(store, sd.A, mk) + ')';
  const others = Object.keys(now).filter((id) => !seedAdvs[id]).map((id) => now[id].title + '[tc ' + now[id].turnCount + (hasMarker(store, id, mk) ? ',MARKER' : '') + ']');
  const feedMarker = h.$('#feed').textContent.includes(mk);
  const pageAllowedMarker = pageTitle === (allowedId && now[allowedId] ? now[allowedId].title : (allowedId === sd.A ? 'Alpha' : '#'));
  const wrong = markerIn.filter((t) => !(allowedId && now[allowedId] && now[allowedId].title === t));
  const pass = wrong.length === 0 && bSame && !(feedMarker && !pageAllowedMarker) && h.errors.length === 0 && h.mock.violations.length === 0 && (!extra || extra.ok !== false);
  return { pass, markerIn: markerIn.join('|') || 'none', Bsame: bSame, Bnow: st(now[sd.B]), A: aOut, Anow: st(aDoc), newAdvs: others.join(' ') || '-', page: pageTitle, pageState: pageState(h), feedMarker, errors: h.errors.length, viol: h.mock.violations.length };
}

async function turnRoute(bk, sd, route, mode) {
  const store = cloneStore(sd.store); const g = { held: [] }; const mk = 'ZQ' + bk + route + mode + 'MK';
  const h = await boot({ htmlPath: BUILDS[bk].htmlPath, worldsDir: BUILDS[bk].worldsDir, setup(w, m) { m.store = store; installGate(m, g); } });
  await h.idle(10000);
  const start = await pageCurrentTitle(h);
  g.armTurn = true; h.$('#action').value = 'Gated turn ' + route; h.click('#send');
  const held = await waitFor(() => g.held.length === 1, 5000);
  const ui = { stop: !h.$('#stop').hidden, advBtnDisabled: h.$('#btnAdventures').disabled };
  const ctx = { other: 'Bravo', newWorld: 'halloway', newTitle: 'NewHal', exportText: sd.exportText };
  const tried = held ? await ROUTES[route](h, ctx) : 'turn never started';
  const midStatus = statusText(h);
  if (g.held[0]) { if (mode === 'ok') g.held[0].res(turnReply(mk)); else g.held[0].rej({ code: 'upstream_error', message: 'injected failure' }); }
  await h.idle(20000);
  const endStatus = statusText(h);
  const pageTitle = await pageCurrentTitle(h);
  const ev = evaluate(h, sd, store, mk, sd.A, pageTitle);
  let follow = null;
  if (mode === 'fail') {
    // rollback check: take an ordinary turn on Bravo and see which state it starts from
    if (pageTitle !== 'Bravo') await continueTitle(h, 'Bravo');
    const bPageBefore = pageState(h);
    await h.turn('Follow-up on Bravo');
    const bd = advs(store)[sd.B]; const last = (() => { const ks = [...store.keys()].filter((k) => k.startsWith('adventures/' + sd.B + '/turns/')).sort(); const ch = store.get(ks[ks.length - 1]).data; return ch.turns[ch.turns.length - 1]; })();
    const sb = last && last.stateBefore ? 'D' + last.stateBefore.day + ' ' + last.stateBefore.time + ' ' + last.stateBefore.location : '?';
    follow = { bPageBefore, nextTurnStateBefore: sb, storedB: st(bd), ok: /Bravo Hall/.test(sb) && /^D22 /.test(sb) };
    ev.pass = ev.pass && follow.ok && /Bravo Hall/.test(bPageBefore);
  }
  const r = { build: bk, route: route + (mode === 'fail' ? '+fail' : ''), start, ui, tried, midStatus, endStatus, ...ev, follow };
  h.close();
  return r;
}

async function introRoute(bk, sd, route) {
  const store = cloneStore(sd.store); const g = { held: [] }; const mk = 'ZQ' + bk + 'intro' + route + 'MK';
  const h = await boot({ htmlPath: BUILDS[bk].htmlPath, worldsDir: BUILDS[bk].worldsDir, setup(w, m) { m.store = store; installGate(m, g); } });
  await h.idle(10000);
  await openAdv(h); h.$('#newWorld').value = 'sundered'; h.click('#newAdv'); await h.settle(100, 4000);
  h.type('#cTitle', 'NewSun'); g.armIntro = true; h.click('#cBegin');
  const held = await waitFor(() => g.held.length === 1, 20000);
  await h.settle(100, 4000);
  const ui = { stop: !h.$('#stop').hidden, advBtnDisabled: h.$('#btnAdventures').disabled };
  const ctx = { other: 'Alpha', newWorld: 'sundered', newTitle: 'NewSun2', exportText: sd.exportText };
  const tried = held ? await ROUTES[route](h, ctx) : 'intro never started';
  const midStatus = statusText(h);
  if (g.held[0]) g.held[0].res(introReply(mk));
  await h.idle(20000);
  const endStatus = statusText(h);
  const pageTitle = await pageCurrentTitle(h);
  const newSun = idByTitle(store, 'NewSun')[0] || null;
  const ev = evaluate(h, sd, store, mk, newSun, pageTitle);
  // Alpha's stored opening must be unchanged unless Alpha was deleted
  const aSame = JSON.stringify(advJson(sd.store, sd.A)) === JSON.stringify(advJson(store, sd.A));
  ev.pass = ev.pass && aSame;
  const r = { build: bk, route: 'intro:' + route, ui, tried, midStatus, endStatus, Asame: aSame, newSunExists: !!newSun, ...ev };
  h.close();
  return r;
}

// boot-load route: a turn typed on the placeholder before the boot load swaps in the most recent save
async function bootRoute(bk, sd) {
  const store = cloneStore(sd.store); const g = { held: [] }; const mk = 'ZQ' + bk + 'bootMK';
  const h = await boot({ htmlPath: BUILDS[bk].htmlPath, worldsDir: BUILDS[bk].worldsDir, setup(w, m) { m.store = store; m.dbLatency = 120; installGate(m, g); } });
  await waitFor(() => !h.$('#send').disabled, 3000);
  g.armTurn = true; h.$('#action').value = 'Early turn'; h.click('#send');
  const held = await waitFor(() => g.held.length === 1, 5000);
  const loaded = await waitFor(() => /Welcome back/.test(h.$('#status').textContent) || h.window.localStorage.getItem('windlass.last') === sd.A, 6000);
  h.mock.dbLatency = 2;
  const midStatus = statusText(h);
  if (g.held[0]) g.held[0].res(turnReply(mk));
  await h.idle(20000);
  const endStatus = statusText(h);
  const pageTitle = await pageCurrentTitle(h);
  // the placeholder was never saved, so the only acceptable outcome is: Alpha untouched (or Alpha gets nothing from the placeholder turn)
  const ev = evaluate(h, sd, store, mk, null, pageTitle);
  const r = { build: bk, route: 'bootload', tried: 'turn sent before boot load (held=' + held + ', loadedDuring=' + loaded + ')', midStatus, endStatus, ...ev };
  h.close();
  return r;
}

// boot-load landing during the length-fit call (after the fixed build's single stale check, before commitReply touches adv)
async function bootFitRoute(bk, sd) {
  const store = cloneStore(sd.store); const mk = 'ZQ' + bk + 'bootfitMK'; const g = { held: [], mk };
  const h = await boot({ htmlPath: BUILDS[bk].htmlPath, worldsDir: BUILDS[bk].worldsDir, setup(w, m) { m.store = store; m.dbLatency = 120; installGate(m, g); } });
  await waitFor(() => !h.$('#send').disabled, 3000);
  g.armLong = true; g.armFit = true; h.$('#action').value = 'Early long turn'; h.click('#send');
  const held = await waitFor(() => g.held.length === 1, 5000);
  const loaded = await waitFor(() => /Welcome back/.test(h.$('#status').textContent) || h.window.localStorage.getItem('windlass.last') === sd.A, 6000);
  h.mock.dbLatency = 2;
  const midStatus = statusText(h);
  if (g.held[0]) g.held[0].res(h.mock.defaultHandler('Rewrite it to between', {}, {}));
  await h.idle(20000);
  const endStatus = statusText(h);
  const pageTitle = await pageCurrentTitle(h);
  const ev = evaluate(h, sd, store, mk, null, pageTitle);
  const ks = [...store.keys()].filter((k) => k.startsWith('adventures/' + sd.A + '/turns/')).sort();
  const lastA = ks.length ? (() => { const ch = store.get(ks[ks.length - 1]).data; return ch.turns[ch.turns.length - 1]; })() : null;
  ev.AlastTurn = lastA ? 'n' + lastA.n + ' action=' + lastA.action + ' stateBefore=D' + lastA.stateBefore.day + ' ' + lastA.stateBefore.time + ' ' + String(lastA.stateBefore.location).slice(0, 30) : '-';
  const r = { build: bk, route: 'bootload-during-fit', tried: 'turn sent before boot load; fit call held until boot load done (held=' + held + ', loadedDuring=' + loaded + ')', midStatus, endStatus, ...ev };
  h.close();
  return r;
}

(async () => {
  const t0 = Date.now();
  const seeds = {};
  for (const bk of ['pub', 'fix']) { seeds[bk] = await seed(bk); const s = seeds[bk]; console.log('SEED', bk, 'A', s.A, st(s.info.A), 'tc', s.info.A && s.info.A.turnCount, '| B', s.B, st(s.info.B), 'tc', s.info.B && s.info.B.turnCount, '| export', s.exportText ? s.exportText.length : 0, '| errors', s.info.errors, 'viol', s.info.viol); }
  const results = [];
  const plan = [
    ['turn', 'continueOther', 'ok'], ['turn', 'newBegin', 'ok'], ['turn', 'importFile', 'ok'], ['turn', 'deleteCurrent', 'ok'],
    ['turn', 'continueOther', 'fail'], ['turn', 'deleteCurrent', 'fail'],
    ['intro', 'continueOther'], ['intro', 'newBegin'], ['intro', 'importFile'], ['intro', 'deleteCurrent'],
    ['boot'], ['bootfit'],
  ];
  for (const p of plan) {
    if (process.env.ONLY && !process.env.ONLY.split(',').some((o) => p.join(':') === o)) continue;
    for (const bk of ['pub', 'fix']) {
      let r;
      try { r = p[0] === 'turn' ? await turnRoute(bk, seeds[bk], p[1], p[2]) : p[0] === 'intro' ? await introRoute(bk, seeds[bk], p[1]) : p[0] === 'bootfit' ? await bootFitRoute(bk, seeds[bk]) : await bootRoute(bk, seeds[bk]); }
      catch (e) { r = { build: bk, route: p.join(':'), pass: false, crash: String(e && e.stack || e).slice(0, 300) }; }
      results.push(r);
      console.log(JSON.stringify(r));
    }
  }
  console.log('\n=== SIDE BY SIDE (pass = no reply in the wrong adventure, Bravo untouched, page consistent, no errors/violations) ===');
  const rows = {};
  for (const r of results) { rows[r.route] = rows[r.route] || {}; rows[r.route][r.build] = r; }
  const fmt = (r) => !r ? '-' : (r.crash ? 'CRASH ' + r.crash.slice(0, 60) : (r.pass ? 'PASS' : 'FAIL') + ' marker:' + r.markerIn + ' Bsame:' + r.Bsame + ' A:' + r.A + ' page:' + r.page + (r.follow ? ' nextB.stateBefore:' + r.follow.nextTurnStateBefore : '') + ' | ' + (r.midStatus || '').slice(0, 60));
  for (const [route, v] of Object.entries(rows)) { console.log(route.padEnd(22), '\n   PUB:', fmt(v.pub), '\n   FIX:', fmt(v.fix)); }
  console.log('total seconds', Math.round((Date.now() - t0) / 1000));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
