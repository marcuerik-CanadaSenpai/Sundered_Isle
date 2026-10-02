'use strict';
// Finding: a failed Continue leaves the other world loaded over the open adventure; the next save stamps the wrong worldId.
// Same scenarios against the published (src) and fixed (main) builds; prints a side-by-side table.
const path = require('path');
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || path.join(__dirname, '..');
const BUILDS = {
  published: { htmlPath: path.join(ROOT, 'src', 'index.html'), worldsDir: path.join(ROOT, 'src', 'worlds') },
  fixed: { htmlPath: path.join(ROOT, 'main', 'index.html'), worldsDir: path.join(ROOT, 'main', 'worlds') },
};
const TITLES = { halloway: 'Halloway College of Binding', sundered: 'The Sundered Isle', mythaven: 'Mythaven University' };
let UNHANDLED = [];
process.on('unhandledRejection', (e) => { UNHANDLED.push(String(e && e.message || e).slice(0, 90)); });
const cloneStore = (m) => new Map(JSON.parse(JSON.stringify([...m.entries()])));
const advDocs = (store) => [...store.entries()].filter(([k]) => /^adventures\/[^/]+$/.test(k)).map(([k, v]) => ({ id: k.split('/')[1], data: v.data, version: v.version }));

async function makeSeed(build) {
  const h = await boot(Object.assign({}, BUILDS[build]));
  await h.settle(150, 6000);
  h.click('#cBegin'); await h.idle();                      // B: default world (sundered)
  await h.turn('Seed B move');
  h.click('#btnAdventures'); await h.settle(80, 4000);
  h.type('#newWorld', 'halloway'); h.click('#newAdv'); await h.settle(120, 6000);
  h.click('#cBegin'); await h.idle();                      // A: halloway, saved last so it opens at boot
  await h.turn('Seed A move');
  const docs = advDocs(h.mock.store);
  const A = docs.find((d) => d.data.worldId === 'halloway'), B = docs.find((d) => d.data.worldId === 'sundered');
  const info = { errors: h.errors.length, violations: h.mock.violations.length, worldTitle: h.$('#worldTitle').textContent, docs: docs.map((d) => d.data.worldId + ':' + d.data.turnCount) };
  const seed = cloneStore(h.mock.store);
  h.close();
  return { seed, A: { id: A.id, title: A.data.title, world: 'halloway' }, B: { id: B.id, title: B.data.title, world: 'sundered' }, info };
}

const status = (h) => (h.$('#status').hidden ? '' : h.$('#status').textContent.trim());
async function openList(h) { h.click('#btnAdventures'); await h.settle(80, 4000); }
function rowOf(h, title) { return [...h.document.querySelectorAll('#advlist .advrow')].find((r) => r.querySelector('.t').textContent === title); }
function currentRowTitle(h) { const r = [...h.document.querySelectorAll('#advlist .advrow')].find((x) => /Current/.test(x.querySelector('[data-act="open"]').textContent)); return r ? r.querySelector('.t').textContent : '(none)'; }
function closeList(h) { const d = h.$('#dlgAdventures'); if (d.open) d.close(); }
async function importPayload(h, obj) {
  const win = h.window; const file = new win.File([JSON.stringify(obj)], 'save.json', { type: 'application/json' });
  const inp = h.$('#importFile'); Object.defineProperty(inp, 'files', { value: [file], configurable: true });
  inp.dispatchEvent(new win.Event('change', { bubbles: true })); await h.settle(150, 8000); await h.idle(8000);
}

async function scenario(build, S, kind) {
  const r = { kind };
  const h = await boot(Object.assign({}, BUILDS[build], { setup: (w, m) => { m.store = cloneStore(S.seed); } }));
  await h.settle(150, 6000); await h.idle();
  const A = Object.assign({}, S.A), B = S.B, store = h.mock.store;
  r.bootWorld = h.$('#worldTitle').textContent;
  const err0 = h.errors.length, vio0 = h.mock.violations.length; UNHANDLED = [];
  const aDoc0 = JSON.parse(JSON.stringify(store.get('adventures/' + A.id).data));
  const bDoc0 = JSON.parse(JSON.stringify(store.get('adventures/' + B.id).data));
  const advCount0 = advDocs(store).length;
  const feed0 = h.document.querySelectorAll('#feed .turn').length;
  const injected = { code: 'unavailable', message: 'injected db failure' };

  if (kind === 'continue-query-fail' || kind === 'continue-get-fail') {
    await openList(h);
    const row = rowOf(h, B.title); if (!row) throw new Error('no row for B');
    h.mock.dbFail = kind === 'continue-query-fail'
      ? (op, p) => (op === 'query' && p === 'adventures/' + B.id + '/turns' ? injected : null)
      : (op, p) => (op === 'get' && p === 'adventures/' + B.id ? injected : null);
    row.querySelector('[data-act="open"]').dispatchEvent(new h.window.MouseEvent('click', { bubbles: true }));
    await h.settle(120, 6000); await h.idle(6000);
    h.mock.dbFail = null;
  } else if (kind.startsWith('import-')) {
    await openList(h);
    h.click('#exportAdv'); await h.settle(80, 4000);
    const dl = h.mock.downloadsLog[h.mock.downloadsLog.length - 1];
    const p = JSON.parse(String(dl.data));
    if (kind === 'import-unknown') { p.adventure.worldId = 'atlantis'; p.world.id = 'atlantis'; }
    if (kind === 'import-constructor') { p.adventure.worldId = 'constructor'; p.world.id = 'constructor'; }
    if (kind === 'import-otherworld-nomemory') { p.adventure.worldId = 'sundered'; p.world.id = 'sundered'; delete p.adventure.memory; }
    await importPayload(h, p);
  }
  r.afterWorld = h.$('#worldTitle').textContent;
  r.status = status(h).slice(0, 90);
  await openList(h); r.currentRow = currentRowTitle(h) === A.title ? 'A' : currentRowTitle(h) === B.title ? 'B' : currentRowTitle(h).slice(0, 30); closeList(h);
  // following turn on A
  const callsBefore = h.mock.sampleCalls.length;
  await h.turn('Alpha check after failure');
  const turnCall = h.mock.sampleCalls.slice(callsBefore).find((c) => typeof c.input === 'string' ? /Alpha check after failure/.test(c.input) : JSON.stringify(c.input).includes('Alpha check after failure'));
  const pt = turnCall ? (typeof turnCall.input === 'string' ? turnCall.input : JSON.stringify(turnCall.input)) : '';
  r.promptWorld = !turnCall ? 'no-call' : (pt.includes(TITLES.halloway) && !pt.includes(TITLES.sundered) ? 'halloway' : pt.includes(TITLES.sundered) && !pt.includes(TITLES.halloway) ? 'sundered' : 'mixed/none');
  r.feedDelta = h.document.querySelectorAll('#feed .turn').length - feed0;
  r.saveNote = h.$('#summaryNote').textContent.slice(0, 40);
  const aDoc1 = store.get('adventures/' + A.id) && store.get('adventures/' + A.id).data;
  const bDoc1 = store.get('adventures/' + B.id) && store.get('adventures/' + B.id).data;
  r.aWorldId = aDoc1 ? aDoc1.worldId : '(gone)';
  r.aTurnDelta = aDoc1 ? (aDoc1.turnCount - aDoc0.turnCount) : 'n/a';
  r.bUnchanged = !!bDoc1 && bDoc1.rev === bDoc0.rev && bDoc1.worldId === bDoc0.worldId && bDoc1.turnCount === bDoc0.turnCount;
  r.strayAdvDocs = advDocs(store).length - advCount0;
  r.strayWorlds = advDocs(store).filter((d) => d.id !== A.id && d.id !== B.id).map((d) => d.data.worldId).join(',') || '-';
  r.worldAfterTurn = h.$('#worldTitle').textContent;
  r.statusAfterTurn = status(h).slice(0, 90);
  // a save that does not need a model turn: Override > Add fact (persist -> advDoc stamps worldId from the loaded world)
  const errF = h.errors.length;
  h.type('#ovrFact', 'Fact added after the failure'); h.click('#ovrFactAdd'); await h.settle(120, 5000); await h.idle(5000);
  const aDoc2 = store.get('adventures/' + A.id) && store.get('adventures/' + A.id).data;
  r.factSaved = !!aDoc2 && JSON.stringify(aDoc2.memory || {}).includes('Fact added after the failure');
  r.aWorldIdAfterFact = aDoc2 ? aDoc2.worldId : '(gone)';
  r.factErrors = h.errors.length - errF;
  // another save that skips rendering: Adventures > Rename on the current row (persist -> advDoc)
  {
    await openList(h); const rr = rowOf(h, A.title);
    if (rr) {
      rr.querySelector('[data-act="rename"]').dispatchEvent(new h.window.MouseEvent('click', { bubbles: true }));
      const c = rr.querySelector('.confirm'); c.querySelector('input').value = 'Renamed A';
      c.querySelectorAll('button')[0].dispatchEvent(new h.window.MouseEvent('click', { bubbles: true }));
      await h.settle(120, 5000); await h.idle(5000);
    }
    const aDoc3 = store.get('adventures/' + A.id) && store.get('adventures/' + A.id).data;
    r.renameSaved = !!aDoc3 && aDoc3.title === 'Renamed A';
    r.aWorldIdAfterRename = aDoc3 ? aDoc3.worldId : '(gone)';
    if (aDoc3) A.title = aDoc3.title;
    closeList(h);
  }
  // normal Continue to B still works afterwards (only for the Continue routes)
  if (kind.startsWith('continue')) {
    await openList(h); const row = rowOf(h, B.title);
    if (row) { row.querySelector('[data-act="open"]').dispatchEvent(new h.window.MouseEvent('click', { bubbles: true })); await h.settle(120, 6000); await h.idle(6000); }
    r.retryContinueB = h.$('#worldTitle').textContent === TITLES.sundered && !h.$('#dlgAdventures').open ? 'ok' : 'FAIL(' + h.$('#worldTitle').textContent + ')';
    const bDoc2 = store.get('adventures/' + B.id).data; r.bWorldAfterRetry = bDoc2.worldId;
  }
  r.errors = h.errors.length - err0; r.errMsg = h.errors.slice(err0).map((e) => e.message.split('\n')[0].slice(0, 80)).join(' / ');
  r.violations = h.mock.violations.length - vio0;
  r.unhandled = UNHANDLED.length ? UNHANDLED.join(' / ') : 0;
  h.close();
  return r;
}

function verdict(kind, r) {
  const okWorld = r.afterWorld === TITLES.halloway && r.worldAfterTurn === TITLES.halloway;
  const okDoc = r.aWorldId === 'halloway' && r.aTurnDelta === 1 && r.bUnchanged && r.strayAdvDocs === 0 && r.aWorldIdAfterFact === 'halloway' && r.factSaved && r.aWorldIdAfterRename === 'halloway' && r.renameSaved;
  const okTurn = r.feedDelta === 1 && /saved/.test(r.saveNote) && !/fail/.test(r.saveNote) && r.promptWorld === 'halloway';
  const okMsg = kind === 'baseline' ? true : r.status.length > 0;
  const okClean = r.errors === 0 && r.violations === 0 && !r.unhandled;
  const okRetry = !kind.startsWith('continue') || (r.retryContinueB === 'ok' && r.bWorldAfterRetry === 'sundered');
  return (okWorld && okDoc && okTurn && okMsg && okClean && okRetry) ? 'PASS' : 'FAIL';
}

(async () => {
  const KINDS = ['baseline', 'continue-query-fail', 'continue-get-fail', 'import-unknown', 'import-constructor', 'import-otherworld-nomemory'];
  const out = {};
  for (const build of ['published', 'fixed']) {
    const S = await makeSeed(build);
    console.log('[' + build + '] seed: A=' + S.A.title + ' (halloway) B=' + S.B.title + ' (sundered) docs=' + S.info.docs.join(' ') + ' seedErrors=' + S.info.errors + ' seedViolations=' + S.info.violations);
    out[build] = {};
    for (const k of KINDS) {
      try { out[build][k] = await scenario(build, S, k); } catch (e) { out[build][k] = { kind: k, crash: String(e && e.message || e) }; }
    }
  }
  const fields = ['bootWorld', 'afterWorld', 'status', 'currentRow', 'promptWorld', 'feedDelta', 'saveNote', 'aWorldId', 'aTurnDelta', 'bUnchanged', 'strayAdvDocs', 'strayWorlds', 'worldAfterTurn', 'statusAfterTurn', 'factSaved', 'aWorldIdAfterFact', 'factErrors', 'renameSaved', 'aWorldIdAfterRename', 'retryContinueB', 'bWorldAfterRetry', 'errors', 'errMsg', 'violations', 'unhandled', 'crash'];
  for (const k of KINDS) {
    console.log('\n=== ' + k + ' ===  published=' + (out.published[k].crash ? 'CRASH' : verdict(k, out.published[k])) + ' | fixed=' + (out.fixed[k].crash ? 'CRASH' : verdict(k, out.fixed[k])));
    for (const f of fields) {
      const a = out.published[k][f], b = out.fixed[k][f];
      if (a === undefined && b === undefined) continue;
      console.log('  ' + f.padEnd(16) + ' | published=' + JSON.stringify(a) + ' | fixed=' + JSON.stringify(b));
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
