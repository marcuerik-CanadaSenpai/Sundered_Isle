'use strict';
// Challenge for: a failed Continue leaves the other world loaded over the open adventure; the next save stamps the wrong worldId.
// Routes the original test did not cover: a failure AFTER setWorld (corrupt doc -> ensureTf/migrateAdv throws, exercising the
// fixed build's restore branch), a third world (mythaven), the delete-current fallback, the boot load, and import variants.
const path = require('path');
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || path.join(__dirname, '..');
const BUILDS = {
  published: { htmlPath: path.join(ROOT, 'src', 'index.html'), worldsDir: path.join(ROOT, 'src', 'worlds') },
  fixed: { htmlPath: path.join(ROOT, 'main', 'index.html'), worldsDir: path.join(ROOT, 'main', 'worlds') },
};
const TITLES = { halloway: 'Halloway College of Binding', sundered: 'The Sundered Isle', mythaven: 'Mythaven University' };
const worldOfTitle = (t) => Object.keys(TITLES).find((k) => TITLES[k] === t) || ('?' + t);
let UNHANDLED = [];
process.on('unhandledRejection', (e) => { UNHANDLED.push(String(e && e.message || e).slice(0, 90)); });
const cloneStore = (m) => new Map(JSON.parse(JSON.stringify([...m.entries()])));
const advDocs = (store) => [...store.entries()].filter(([k]) => /^adventures\/[^/]+$/.test(k)).map(([k, v]) => ({ id: k.split('/')[1], data: v.data }));
const status = (h) => (h.$('#status').hidden ? '' : h.$('#status').textContent.trim());
const click = (h, el) => el.dispatchEvent(new h.window.MouseEvent('click', { bubbles: true }));
async function openList(h) { h.click('#btnAdventures'); await h.settle(80, 4000); }
function closeList(h) { const d = h.$('#dlgAdventures'); if (d.open) d.close(); }
function rows(h) { return [...h.document.querySelectorAll('#advlist .advrow')]; }
function rowOf(h, title) { return rows(h).find((r) => r.querySelector('.t').textContent === title); }
function currentRowTitle(h) { const r = rows(h).find((x) => /Current/.test(x.querySelector('[data-act="open"]').textContent)); return r ? r.querySelector('.t').textContent : '(none)'; }
async function importPayload(h, obj) {
  const win = h.window; const file = new win.File([JSON.stringify(obj)], 'save.json', { type: 'application/json' });
  const inp = h.$('#importFile'); Object.defineProperty(inp, 'files', { value: [file], configurable: true });
  inp.dispatchEvent(new win.Event('change', { bubbles: true })); await h.settle(150, 8000); await h.idle(8000);
}

async function makeSeed(build) {
  const h = await boot(Object.assign({}, BUILDS[build]));
  await h.settle(150, 6000);
  h.click('#cBegin'); await h.idle(); await h.turn('Seed B move');                       // B: sundered (default)
  h.click('#btnAdventures'); await h.settle(80, 4000);
  h.type('#newWorld', 'mythaven'); h.click('#newAdv'); await h.settle(120, 6000);
  h.click('#cBegin'); await h.idle(); await h.turn('Seed C move');                       // C: mythaven
  h.click('#btnAdventures'); await h.settle(80, 4000);
  h.type('#newWorld', 'halloway'); h.click('#newAdv'); await h.settle(120, 6000);
  h.click('#cBegin'); await h.idle(); await h.turn('Seed A move');                       // A: halloway, newest
  const docs = advDocs(h.mock.store);
  const pick = (w) => { const d = docs.find((x) => x.data.worldId === w); return d ? { id: d.id, title: d.data.title, world: w } : null; };
  const S = { seed: cloneStore(h.mock.store), A: pick('halloway'), B: pick('sundered'), C: pick('mythaven'), seedErrors: h.errors.length, seedViolations: h.mock.violations.length, docs: docs.map((d) => d.data.worldId + ':' + d.data.turnCount).join(' ') };
  h.close();
  return S;
}
function payloadFromStore(store, id) {
  const d = JSON.parse(JSON.stringify(store.get('adventures/' + id).data));
  const turns = []; for (const [k, v] of store.entries()) if (k.startsWith('adventures/' + id + '/turns/')) turns.push(...v.data.turns);
  return { format: 'windlass-save-1', exportedAt: new Date().toISOString(), world: { id: d.worldId, title: TITLES[d.worldId] }, adventure: d, turns: JSON.parse(JSON.stringify(turns)) };
}

async function scenario(build, S, kind) {
  const r = { kind };
  const injected = { code: 'unavailable', message: 'injected db failure' };
  const seed = cloneStore(S.seed);
  const doc = (x) => seed.get('adventures/' + x.id).data;
  // newest non-A doc (what the delete-current fallback will load)
  const fallback = [S.B, S.C].sort((a, b) => String(doc(b).updatedAt).localeCompare(String(doc(a).updatedAt)))[0];
  let bootFail = null;
  if (kind === 'continue-B-tf-corrupt') doc(S.B).state.tf = {};
  if (kind === 'continue-B-cast-corrupt') doc(S.B).cast = Object.assign({}, doc(S.B).cast || {}, { added: 'bad' });
  if (kind === 'delete-A-fallback-corrupt') doc(fallback).state.tf = {};
  if (kind === 'boot-newest-corrupt') { doc(S.B).state.tf = {}; doc(S.B).updatedAt = '2099-01-01T00:00:00.000Z'; }
  if (kind === 'boot-newest-queryfail') { doc(S.B).updatedAt = '2099-01-01T00:00:00.000Z'; bootFail = (op, p) => (op === 'query' && p === 'adventures/' + S.B.id + '/turns' ? injected : null); }
  if (kind === 'boot-A-no-worldid') { delete doc(S.A).worldId; }
  const h = await boot(Object.assign({}, BUILDS[build], { setup: (w, m) => { m.store = seed; if (bootFail) m.dbFail = bootFail; } }));
  await h.settle(150, 6000); await h.idle();
  h.mock.dbFail = null;
  const store = h.mock.store;
  const ids = { A: S.A.id, B: S.B.id, C: S.C.id };
  const nameOf = (id) => Object.keys(ids).find((k) => ids[k] === id) || 'NEW';
  r.bootWorld = worldOfTitle(h.$('#worldTitle').textContent);
  const err0 = h.errors.length, vio0 = h.mock.violations.length; UNHANDLED = [];
  const snap0 = new Map(advDocs(store).map((d) => [d.id, JSON.parse(JSON.stringify(d.data))]));
  const origWorld = { [S.A.id]: 'halloway', [S.B.id]: 'sundered', [S.C.id]: 'mythaven' };
  const feed0 = h.document.querySelectorAll('#feed .turn').length;

  if (kind === 'continue-B-tf-corrupt' || kind === 'continue-B-cast-corrupt' || kind === 'continue-C-queryfail') {
    const T = kind === 'continue-C-queryfail' ? S.C : S.B;
    await openList(h); const row = rowOf(h, T.title); if (!row) throw new Error('no row for target');
    if (kind === 'continue-C-queryfail') h.mock.dbFail = (op, p) => (op === 'query' && p === 'adventures/' + T.id + '/turns' ? injected : null);
    r.btnDisabled = row.querySelector('[data-act="open"]').disabled;
    click(h, row.querySelector('[data-act="open"]'));
    await h.settle(120, 6000); await h.idle(6000);
    h.mock.dbFail = null;
  } else if (kind === 'race-continue-B-queryfail-during-turn') {
    // Slow, failing load of B started from Continue; a turn on A is taken while it is pending and commits after it fails.
    await openList(h); const row = rowOf(h, S.B.title); if (!row) throw new Error('no row for B');
    h.mock.dbFail = (op, p) => (op === 'query' && p === 'adventures/' + S.B.id + '/turns' ? injected : null);
    h.mock.dbLatency = 600; h.mock.sampleLatency = 1500;
    click(h, row.querySelector('[data-act="open"]'));
    await h.sleep(40); h.mock.dbLatency = 2;
    closeList(h);
    const before = h.mock.sampleCalls.length;
    h.$('#action').value = 'Race turn on A'; h.click('#send');
    await h.sleep(1200); h.mock.dbFail = null; h.mock.sampleLatency = 3;
    await h.idle(15000); await h.settle(120, 5000);
    const call = h.mock.sampleCalls.slice(before).find((c) => (typeof c.input === 'string' ? c.input : JSON.stringify(c.input)).includes('Race turn on A'));
    r.raceTurnCalled = !!call;
    const aNow = store.get('adventures/' + S.A.id).data;
    r.raceAWorld = aNow.worldId + ':' + (aNow.turnCount - snap0.get(S.A.id).turnCount);
    r.raceStatus = status(h).slice(0, 90);
  } else if (kind === 'delete-A-fallback-corrupt' || kind === 'delete-A-fallback-queryfail') {
    r.fallbackTo = nameOf(fallback.id);
    if (kind === 'delete-A-fallback-queryfail') h.mock.dbFail = (op, p) => (op === 'query' && p === 'adventures/' + fallback.id + '/turns' ? injected : null);
    await openList(h); const row = rowOf(h, S.A.title); if (!row) throw new Error('no row for A');
    click(h, row.querySelector('[data-act="delete"]'));
    const c = row.querySelector('.confirm'); click(h, c.querySelectorAll('button')[0]);
    await h.settle(150, 8000); await h.idle(8000);
    h.mock.dbFail = null;
    r.aDeleted = !store.has('adventures/' + S.A.id);
  } else if (kind.startsWith('import-')) {
    const p = payloadFromStore(store, S.B.id);
    if (kind === 'import-B-noworldid') { delete p.adventure.worldId; delete p.world.id; }
    if (kind === 'import-B-persistfail') h.mock.dbFail = (op, pth) => (op === 'set' && /^adventures\//.test(pth) && !Object.values(ids).some((i) => pth.includes(i)) ? injected : null);
    await openList(h);
    await importPayload(h, p);
    h.mock.dbFail = null;
  }
  r.afterWorld = worldOfTitle(h.$('#worldTitle').textContent);
  r.status = status(h).slice(0, 90);
  closeList(h); await openList(h);
  const curTitle = currentRowTitle(h);
  r.currentAdv = curTitle === S.A.title ? 'A' : curTitle === S.B.title ? 'B' : curTitle === S.C.title ? 'C' : curTitle.slice(0, 30);
  closeList(h);
  // following turn
  const callsBefore = h.mock.sampleCalls.length;
  await h.turn('Alpha check after failure');
  const turnCall = h.mock.sampleCalls.slice(callsBefore).find((c) => (typeof c.input === 'string' ? c.input : JSON.stringify(c.input)).includes('Alpha check after failure'));
  const pt = turnCall ? (typeof turnCall.input === 'string' ? turnCall.input : JSON.stringify(turnCall.input)) : '';
  const inPrompt = Object.keys(TITLES).filter((k) => pt.includes(TITLES[k]));
  r.promptWorld = !turnCall ? 'no-call' : (inPrompt.join('+') || 'none');
  r.feedDelta = h.document.querySelectorAll('#feed .turn').length - feed0;
  r.saveNote = h.$('#summaryNote').textContent.slice(0, 40);
  r.statusAfterTurn = status(h).slice(0, 90);
  // fact (save without rendering) and rename current row
  h.type('#ovrFact', 'Fact added after the failure'); h.click('#ovrFactAdd'); await h.settle(120, 5000); await h.idle(5000);
  await openList(h);
  const cr = rows(h).find((x) => /Current/.test(x.querySelector('[data-act="open"]').textContent));
  if (cr) {
    click(h, cr.querySelector('[data-act="rename"]'));
    const c = cr.querySelector('.confirm'); c.querySelector('input').value = 'Renamed current';
    click(h, c.querySelectorAll('button')[0]); await h.settle(120, 5000); await h.idle(5000);
  }
  closeList(h);
  // which docs changed, and with what worldId
  const changes = [];
  let wrongStamp = 0;
  for (const d of advDocs(store)) {
    const before = snap0.get(d.id);
    const nm = nameOf(d.id);
    if (!before) { changes.push(nm + '(new):' + d.data.worldId + (d.data.memory && JSON.stringify(d.data.memory).includes('Fact added after the failure') ? '+fact' : '')); continue; }
    if (before.rev !== d.data.rev || before.worldId !== d.data.worldId || before.title !== d.data.title) {
      const ok = d.data.worldId === origWorld[d.id];
      if (!ok) wrongStamp++;
      changes.push(nm + ':' + d.data.worldId + (ok ? '' : '!WRONG') + (d.data.title === 'Renamed current' ? '+ren' : '') + (JSON.stringify(d.data.memory || {}).includes('Fact added after the failure') ? '+fact' : ''));
    }
  }
  for (const id of snap0.keys()) if (!store.has('adventures/' + id)) changes.push(nameOf(id) + ':gone');
  r.docChanges = changes.join(' ') || '-';
  r.wrongStamp = wrongStamp;
  // normal flow afterwards: Continue to C (mythaven) unless C was the failing target
  if (!kind.startsWith('boot') && kind !== 'continue-C-queryfail') {
    await openList(h); const row = rowOf(h, S.C.title);
    if (row && !/Current/.test(row.querySelector('[data-act="open"]').textContent)) { click(h, row.querySelector('[data-act="open"]')); await h.settle(120, 6000); await h.idle(6000); }
    r.continueC = worldOfTitle(h.$('#worldTitle').textContent) === 'mythaven' ? 'ok' : 'FAIL(' + h.$('#worldTitle').textContent + ')';
    closeList(h);
  }
  r.errors = h.errors.length - err0; r.errMsg = h.errors.slice(err0).map((e) => e.message.split('\n')[0].slice(0, 80)).join(' / ');
  r.violations = h.mock.violations.length - vio0;
  r.unhandled = UNHANDLED.length ? UNHANDLED.join(' / ').slice(0, 160) : 0;
  h.close();
  return r;
}

(async () => {
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  const KINDS = (only || ['continue-B-tf-corrupt', 'continue-B-cast-corrupt', 'continue-C-queryfail', 'delete-A-fallback-corrupt', 'delete-A-fallback-queryfail', 'boot-newest-corrupt', 'boot-newest-queryfail', 'import-B-ok', 'import-B-persistfail', 'import-B-noworldid', 'boot-A-no-worldid']);
  const out = {};
  for (const build of ['published', 'fixed']) {
    const t0 = Date.now();
    const S = await makeSeed(build);
    console.log('[' + build + '] seed docs=' + S.docs + ' seedErrors=' + S.seedErrors + ' seedViolations=' + S.seedViolations + ' A=' + (S.A && S.A.id) + ' B=' + (S.B && S.B.id) + ' C=' + (S.C && S.C.id));
    out[build] = {};
    for (const k of KINDS) {
      try { out[build][k] = await scenario(build, S, k); } catch (e) { out[build][k] = { kind: k, crash: String(e && e.stack || e).slice(0, 300) }; }
    }
    console.log('[' + build + '] took ' + Math.round((Date.now() - t0) / 1000) + 's');
  }
  const fields = ['bootWorld', 'btnDisabled', 'raceTurnCalled', 'raceAWorld', 'raceStatus', 'fallbackTo', 'aDeleted', 'afterWorld', 'status', 'currentAdv', 'promptWorld', 'feedDelta', 'saveNote', 'statusAfterTurn', 'docChanges', 'wrongStamp', 'continueC', 'errors', 'errMsg', 'violations', 'unhandled', 'crash'];
  for (const k of KINDS) {
    console.log('\n=== ' + k + ' ===');
    for (const f of fields) {
      const a = out.published[k][f], b = out.fixed[k][f];
      if (a === undefined && b === undefined) continue;
      console.log('  ' + f.padEnd(15) + ' | published=' + JSON.stringify(a) + ' | fixed=' + JSON.stringify(b));
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
