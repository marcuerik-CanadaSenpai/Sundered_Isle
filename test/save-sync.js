'use strict';
// Saves, sync between devices, interrupted writes and save migration, played on a real 25-turn save (the anonymised fixture, or
// WL_SAVE_DIR with adventures/<id>.json and adventures/<id>/turns/000N.json). Exits 1 on any failed expectation.
// Run one scenario with: node save-sync.js <name>
const fs = require('fs'), path = require('path');
const { boot } = require('./boot');
// WL_SAVE_DIR points at a real save on disk; without it the anonymised 25-turn fixture (the same game, see prompt-budget.js) is used.
const SAVE_DIR = process.env.WL_SAVE_DIR || '', FIXTURE = path.join(__dirname, 'fixtures', 'cow-roommate-25.json');
const ID = 'advmuvpigxlqpae', DOC = 'adventures/' + ID;
// Three scenarios need the second, older save on disk (advmuq6y2ozresh, 47 turns, from before the looks rebuild); they are skipped without it.
const SECOND = 'advmuq6y2ozresh', hasSecond = !!SAVE_DIR && fs.existsSync(path.join(SAVE_DIR, SECOND + '.json')), NEEDS_SECOND = ['migrationSameEverywhere', 'renameKeepsOrder', 'deleteCutShort'];
// The save as store entries, one fresh copy per call.
function realSave(id = ID) {
  const file = SAVE_DIR && path.join(SAVE_DIR, id + '.json');
  if (!file || !fs.existsSync(file)) {
    const F = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')), m = new Map([['adventures/' + F.id, { data: F.adventure, version: 1 }]]);
    for (const [c, doc] of Object.entries(F.turns)) m.set('adventures/' + F.id + '/turns/' + c, { data: doc, version: 1 });
    return m;
  }
  const m = new Map([['adventures/' + id, { data: JSON.parse(fs.readFileSync(file, 'utf8')), version: 1 }]]);
  for (let c = 0; ; c++) { const p = path.join(SAVE_DIR, id, 'turns', String(c).padStart(4, '0') + '.json'); if (!fs.existsSync(p)) break; m.set('adventures/' + id + '/turns/' + String(c).padStart(4, '0'), { data: JSON.parse(fs.readFileSync(p, 'utf8')), version: 1 }); }
  return m;
}
const WORDS = 'lantern corridor whispers copper stairwell dust laughter threshold below hay milk warm slow low heavy hand wall door bed breath skin quiet'.split(' ');
const words = (n, seed) => Array.from({ length: n }, (_, i) => WORDS[(i * 7 + seed) % WORDS.length]).join(' ');
// A narrator whose every turn is marked: VERSION-<n> in the narrative, FACT-<n>/EVENT-<n> in memory, and a clock step that differs.
function narrator(mock, tag) {
  let n = 0;
  mock.sampleHandler = (input, o, call) => {
    const p = typeof input === 'string' ? input : '';
    if (/Rewrite it to between|long-term memory|first appearance|Invent the people/.test(p) || !/<output_format>/.test(p)) return mock.defaultHandler(input, o, call);
    n++;
    return JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: (tag || '') + 'VERSION-' + n + ' ' + words(300, n), suggested_actions: ['a', 'b', 'c'], secret_info: '', state_updates: [], time_advance_minutes: 3 + n * 10,
      events: ['Day 2 08:00 ' + (tag || '') + 'EVENT-' + n + ' ' + words(8, n)], beats: [(tag || '') + 'BEAT-' + n], facts: [(tag || '') + 'FACT-' + n], exposures: [] });
  };
}
async function open(store, tag, setup) { const h = await boot({ setup(w, m) { m.store = store; narrator(m, tag); if (setup) setup(w, m); } }); await h.settle(300, 15000); await h.idle(15000); return h; }
const statusOf = (h) => (h.$('#status').hidden ? '' : h.$('#status').textContent.replace(/\s+/g, ' '));
const storedTurns = (store) => [...store.keys()].filter((k) => k.startsWith(DOC + '/turns/')).sort().flatMap((k) => store.get(k).data.turns);
const record = (store) => store.get(DOC).data;
const feedCount = (h) => h.document.querySelectorAll('#feed .turn').length - 1;
const clean = (h, fail, label) => { if (h.errors.length || h.mock.violations.length) fail(label + ': page errors or contract violations ' + JSON.stringify(h.errors.concat(h.mock.violations)).slice(0, 300)); };

// 1. Two devices take a turn from the same save at the same moment. Each page that ends without its turn in the store must say
//    so (the "saved from another device" choice) by the time it is next looked at; neither may report "saved" over a lost turn.
//    Run with both writes landing together, and with B's writes slow so that A finishes first.
async function twoDevices(fail) {
  for (const slow of [0, 150]) {
    const store = realSave();
    const A = await open(store, 'A-'), B = await open(store, 'B-', (w, m) => { if (slow) m.dbDelay = (op) => (op === 'set' ? slow : 0); });
    A.$('#action').value = 'A: say nothing'; A.click('#send'); B.$('#action').value = 'B: ask her about the barn'; B.click('#send');
    await Promise.all([A.idle(30000), B.idle(30000)]);
    for (const h of [A, B]) { h.window.dispatchEvent(new h.window.Event('focus')); await h.settle(300, 8000); }
    const actions = storedTurns(store).map((t) => t.action);
    for (const [h, act, who] of [[A, 'A: say nothing', 'A'], [B, 'B: ask her about the barn', 'B']]) {
      if (!actions.includes(act) && !/saved from another device/.test(statusOf(h))) fail('two devices (B slow ' + slow + ' ms): ' + who + '\'s turn is not in the store and ' + who + ' does not say so (status "' + statusOf(h).slice(0, 120) + '", note "' + h.$('#summaryNote').textContent + '")');
    }
    if (record(store).turnCount !== storedTurns(store).length) fail('two devices: the record says ' + record(store).turnCount + ' turns, the blocks hold ' + storedTurns(store).length);
    clean(A, fail, 'two devices A'); clean(B, fail, 'two devices B'); A.close(); B.close();
  }
}
// 2. One device plays, the other picks the save up and plays on: no false "another device" choice from the writer check.
async function handOver(fail) {
  const store = realSave();
  const A = await open(store, 'A-'), B = await open(store, 'B-');
  await A.turn('A plays', { max: 30000 });
  B.window.dispatchEvent(new B.window.Event('focus')); await B.settle(300, 8000); await B.idle(15000);
  if (!/Picked up the newer save/.test(statusOf(B))) fail('hand over: B did not pick up A\'s turn (' + statusOf(B).slice(0, 120) + ')');
  await B.turn('B plays on', { max: 30000 });
  if (/another device/.test(statusOf(B))) fail('hand over: B was asked about another device after a clean pick-up (' + statusOf(B).slice(0, 120) + ')');
  A.window.dispatchEvent(new A.window.Event('focus')); await A.settle(300, 8000); await A.idle(15000);
  if (/another device after/.test(statusOf(A))) fail('hand over: A, which had saved cleanly, was offered a conflict instead of picking up B\'s turn');
  const acts = storedTurns(store).map((t) => t.action);
  if (acts[acts.length - 2] !== 'A plays' || acts[acts.length - 1] !== 'B plays on') fail('hand over: the store does not end with A\'s then B\'s turn: ' + JSON.stringify(acts.slice(-3)));
  clean(A, fail, 'hand over A'); clean(B, fail, 'hand over B'); A.close(); B.close();
}
// 3. Undo whose last record write is refused (the block was written), then the page is closed: the reload must open at the
//    turn Undo went back to, with its clock and memory, and without claiming that history is missing.
async function undoInterrupted(fail) {
  const store = realSave(); const h = await open(store);
  await h.turn('T26 say nothing', { max: 60000 }); await h.turn('T27 still nothing', { max: 60000 });
  let blockWritten = false;
  h.mock.dbFail = (op, p) => { if (op === 'set' && p.startsWith(DOC + '/turns/')) blockWritten = true; return op === 'set' && p === DOC && blockWritten ? { code: 'unavailable', message: 'refused' } : null; };
  h.click('#undo'); await h.idle(30000); h.mock.dbFail = null; h.close();
  const t26 = storedTurns(store)[25];
  const R = await open(store);
  if (feedCount(R) !== 26) fail('undo interrupted: reload shows ' + feedCount(R) + ' turns, expected 26');
  if (!R.$('#clock').textContent.includes(t26.stateAfter.time)) fail('undo interrupted: the clock reads "' + R.$('#clock').textContent.replace(/\s+/g, ' ').slice(0, 50) + '", expected turn 26\'s ' + t26.stateAfter.time);
  if (/may be missing/.test(statusOf(R))) fail('undo interrupted: the reload claims history is missing (' + statusOf(R).slice(0, 140) + ')');
  if ((record(store).memory.facts || []).includes('FACT-2')) fail('undo interrupted: the record still holds the undone turn\'s fact');
  clean(R, fail, 'undo interrupted'); R.close();
}
// 4. Regenerate whose record write is refused, then the page is closed: the reload shows the new version, so its clock and
//    memory must be the new version's, not the discarded one's.
async function regenInterrupted(fail) {
  const store = realSave(); const h = await open(store);
  await h.turn('T26 say nothing', { max: 60000 });
  h.mock.dbFail = (op, p) => (op === 'set' && p === DOC ? { code: 'unavailable', message: 'refused' } : null);
  h.click('#regen'); await h.idle(60000); h.mock.dbFail = null; h.close();
  const last = storedTurns(store)[25];
  if (!/^VERSION-2/.test(last.narrative)) { fail('regenerate interrupted: the block does not hold the new version (setup)'); return; }
  const R = await open(store);
  const narrs = R.document.querySelectorAll('#feed .turn .narr');
  if (!/VERSION-2/.test(narrs[narrs.length - 1].textContent)) fail('regenerate interrupted: the reload does not show the new version');
  if (!R.$('#clock').textContent.includes(last.stateAfter.time)) fail('regenerate interrupted: the clock reads "' + R.$('#clock').textContent.replace(/\s+/g, ' ').slice(0, 50) + '", expected the new version\'s ' + last.stateAfter.time);
  const facts = record(store).memory.facts || [];
  if (!facts.includes('FACT-2') || facts.includes('FACT-1')) fail('regenerate interrupted: memory after reload holds ' + JSON.stringify(facts.filter((f) => /^FACT-/.test(f))) + ', expected only the new version\'s FACT-2');
  clean(R, fail, 'regenerate interrupted'); R.close();
}
// 5. Older turns keep only what is shown or replayed: the real save is opened and played one turn, which rewrites its blocks
//    without each older turn's debug debris (state diff, notes for the next turn, raw updates, bond shifts, the
//    evaluation beyond its outcome). Nothing the player sees of the 25 turns changes, and Undo still goes back two turns.
async function olderTurnsShrink(fail) {
  const store = realSave();
  const bytes = (o) => Buffer.byteLength(JSON.stringify(o));
  const trimmedBytes = () => storedTurns(store).filter((t) => t._trimmed).reduce((a, t) => a + bytes(t), 0);
  const before = trimmedBytes();
  const shown = (h) => [...h.document.querySelectorAll('#feed .turn')].slice(1, 26).map((el) => ['.turn-meta', '.turn-action', '.narr', '[data-panel="secret"]', '[data-panel="changes"]'].map((q) => { const e = el.querySelector(q); const x = e ? e.textContent : ''; const at = x.search(/Engine notes|Exposures reported/); return q !== '[data-panel="changes"]' ? x : at < 0 ? '' : x.slice(at); }).join(' | '));
  const h = await open(store); h.click('#toggleHidden'); await h.settle(100, 2000);
  const seen = shown(h);
  await h.turn('T26 say nothing', { max: 60000 }); h.close();
  const after = trimmedBytes(), turns = storedTurns(store);
  const debris = turns.filter((t) => t._trimmed && ['diff', 'pendingAfter', 'updates', 'bondShifts'].some((k) => t[k] !== undefined));
  if (debris.length) fail('older turns: ' + debris.length + ' stored older turns still carry debug debris (turn ' + debris[0].n + ')');
  if (after > before * 0.75) fail('older turns: the older turns take ' + after + ' bytes, ' + before + ' before; expected at least a quarter less');
  const R = await open(store); R.click('#toggleHidden'); await R.settle(100, 2000);
  const again = shown(R);
  const changed = seen.map((x, i) => (x === again[i] ? 0 : i + 1)).filter(Boolean);
  if (seen.length !== 25 || changed.length) fail('older turns: what the player sees changed in turn(s) ' + changed.join(', ') + (changed.length ? ': ' + JSON.stringify(seen[changed[0] - 1].slice(0, 200)) + ' became ' + JSON.stringify(again[changed[0] - 1].slice(0, 200)) : ''));
  const t24 = turns[23];
  R.click('#undo'); await R.idle(30000); R.click('#undo'); await R.idle(30000);
  if (feedCount(R) !== 24 || !R.$('#clock').textContent.includes(t24.stateAfter.time)) fail('older turns: two Undos do not go back to turn 24 (feed ' + feedCount(R) + ', clock "' + R.$('#clock').textContent.replace(/\s+/g, ' ').slice(0, 40) + '", status "' + statusOf(R).slice(0, 120) + '")');
  clean(R, fail, 'older turns'); R.close();
}
// 6. A turn whose save failed is not thrown away without a question: Reload from save and Continue on another adventure ask
//    first (Cancel keeps the turn), and once the player goes ahead the failed save's banner does not follow onto the other save.
async function unsavedAsks(fail) {
  const store = realSave();
  const other = JSON.parse(JSON.stringify(record(store))); other.id = 'advother000000'; other.title = 'Other game'; other.turnCount = 0; other.updatedAt = '2026-01-01T00:00:00.000Z'; other.lastTurnId = '';
  store.set('adventures/advother000000', { data: other, version: 1 });
  const h = await open(store);
  h.mock.dbFail = (op, p) => (op === 'set' ? { code: 'unavailable', message: 'refused' } : null);
  await h.turn('T26 never saved', { max: 60000 }); h.mock.dbFail = null;
  if (!/Save failed/.test(statusOf(h))) { fail('unsaved: the failed save was not reported (setup): ' + statusOf(h).slice(0, 100)); return; }
  h.click('#btnAdventures'); await h.settle(150, 4000);
  h.click('#reloadAdv'); await h.settle(150, 4000);
  const ask = h.$('#dlgAdventures .row .confirm');
  if (!ask || !/not in the save/.test(ask.textContent)) fail('unsaved: Reload from save did not ask first');
  if (feedCount(h) !== 26) fail('unsaved: Reload from save dropped the unsaved turn without asking (feed ' + feedCount(h) + ')');
  if (ask) h.click(ask.querySelectorAll('button')[1]);
  const row = [...h.document.querySelectorAll('#advlist .advrow')].find((r) => /Other game/.test(r.textContent));
  h.click(row.querySelector('[data-act="open"]')); await h.settle(150, 4000);
  const ask2 = row.querySelector('.confirm');
  if (!ask2 || feedCount(h) !== 26) fail('unsaved: Continue on another adventure did not ask first (feed ' + feedCount(h) + ')');
  if (ask2) { h.click(ask2.querySelector('button')); await h.idle(15000); }
  if (feedCount(h) !== 0) fail('unsaved: going ahead did not open the other adventure (feed ' + feedCount(h) + ')');
  if (/Save failed|changes remain/.test(statusOf(h)) || /failed/.test(h.$('#summaryNote').textContent)) fail('unsaved: the failed save\'s banner sits over the other adventure: ' + statusOf(h).slice(0, 120));
  clean(h, fail, 'unsaved'); h.close();
}
// 7. A save from before the looks rebuild and the change tracks (the 47-turn test save advmuq6y2ozresh) is brought up to date on
//    load. Two devices that each open it and save must store the same people and the same change paths, not two random draws.
async function migrationSameEverywhere(fail) {
  const OLD = 'advmuq6y2ozresh', saved = [];
  for (let i = 0; i < 2; i++) {
    const store = realSave(OLD); const h = await open(store);
    h.click('#btnSettings'); const sel = h.$('#setDensity'); sel.value = sel.value === 'rich' ? 'standard' : 'rich'; sel.dispatchEvent(new h.window.Event('change')); await h.idle(15000);
    saved.push(store.get('adventures/' + OLD).data); clean(h, fail, 'migration ' + i); h.close();
  }
  const [a, b] = saved;
  if (!a.roommate.looksV || !a.state.tf.prog) { fail('migration: the old save was not brought up to date (setup)'); return; }
  if (a.roommate.looks !== b.roommate.looks) fail('migration: the roommate\'s looks differ between two devices: ' + JSON.stringify(a.roommate.looks.slice(0, 80)) + ' / ' + JSON.stringify(b.roommate.looks.slice(0, 80)));
  const ga = a.cast.generated.characters, gb = b.cast.generated.characters, diff = ga.filter((c, i) => c.looks !== gb[i].looks).length;
  if (diff) fail('migration: ' + diff + ' of ' + ga.length + ' people\'s looks differ between two devices');
  if (JSON.stringify(a.state.tf) !== JSON.stringify(b.state.tf)) fail('migration: the change paths differ between two devices');
}
// 8. Renaming an older adventure from the list does not make it the newest save: the next page load still opens the game in play.
async function renameKeepsOrder(fail) {
  const store = realSave(); for (const [k, v] of realSave('advmuq6y2ozresh')) store.set(k, v);
  const h = await open(store);
  h.click('#btnAdventures'); await h.settle(150, 4000);
  const row = [...h.document.querySelectorAll('#advlist .advrow')].find((r) => /Test 1/.test(r.textContent));
  h.click(row.querySelector('[data-act="rename"]')); row.querySelector('.confirm input').value = 'Old test'; h.click(row.querySelector('.confirm button')); await h.idle(15000);
  if (store.get('adventures/advmuq6y2ozresh').data.title !== 'Old test') fail('rename: the title was not stored (setup)');
  h.close();
  const R = await open(store);
  if (feedCount(R) !== 25) fail('rename: the next page load opened the renamed adventure (' + feedCount(R) + ' turns) instead of the game in play');
  clean(R, fail, 'rename'); R.close();
}
// 9. Saves run one at a time, a passing "unavailable" is retried, and a turn pressed while a sync check runs is not dropped.
//    a) one refused record write: the turn is saved without a banner; b) Retry save pressed twice: no overlapping writes;
//    c) Take turn pressed 100 ms into a slow sync check: the turn is taken once the check answers.
async function savesInOrder(fail) {
  const store = realSave(); const h = await open(store);
  let once = true; h.mock.dbFail = (op, p) => { if (once && op === 'set' && p === DOC) { once = false; return { code: 'unavailable', message: 'passing' }; } return null; };
  await h.turn('T26 a passing refusal', { max: 60000 });
  if (record(store).turnCount !== 26 || /Save failed/.test(statusOf(h))) fail('in order: one passing refusal was not retried (record ' + record(store).turnCount + ' turns, status "' + statusOf(h).slice(0, 80) + '")');
  h.mock.dbFail = (op) => (op === 'set' ? { code: 'unavailable', message: 'refused' } : null);
  await h.turn('T27 refused', { max: 60000 }); h.mock.dbFail = null;
  const retry = [...h.document.querySelectorAll('#status button')].find((b) => b.textContent === 'Retry save');
  if (!retry) fail('in order: no Retry save after a refused save (setup)');
  else { retry.click(); retry.click(); await h.idle(15000); await h.settle(300, 8000); }
  if (h.mock.violations.some((v) => /overlapping/.test(v.kind))) fail('in order: two saves wrote at once: ' + JSON.stringify(h.mock.violations.find((v) => /overlapping/.test(v.kind))).slice(0, 200));
  if (record(store).turnCount !== 27) fail('in order: Retry save did not save turn 27 (record ' + record(store).turnCount + ')');
  h.mock.dbDelay = (op, p) => (op === 'get' && p === DOC ? 1500 : 0);
  h.window.dispatchEvent(new h.window.Event('focus')); await h.sleep(100);
  h.$('#action').value = 'T28 during a sync check'; h.click('#send'); await h.sleep(1600); await h.idle(30000); h.mock.dbDelay = null;
  if (feedCount(h) !== 28) fail('in order: Take turn pressed during a sync check was dropped (feed ' + feedCount(h) + ', action box "' + h.$('#action').value + '")');
  if (h.errors.length) fail('in order: page errors ' + JSON.stringify(h.errors).slice(0, 200));
  h.close();
}
// 10. A save written by a newer build (a higher schema) is neither opened nor written over by this one.
async function newerSchemaRefused(fail) {
  const store = realSave(); record(store).schema = 99; record(store).bookmarks = ['kept'];
  const h = await open(store);
  if (!/newer version of Windlass/.test(statusOf(h))) fail('newer schema: the page did not say the save is from a newer version (' + statusOf(h).slice(0, 140) + ')');
  h.click('#btnSettings'); const sel = h.$('#setDensity'); sel.value = sel.value === 'rich' ? 'standard' : 'rich'; sel.dispatchEvent(new h.window.Event('change')); await h.idle(15000);
  if (record(store).schema !== 99 || !record(store).bookmarks) fail('newer schema: the newer save was written over');
  h.close();
}
// 11. Import: plain words for a cut-off file and for a world this game no longer has; a day stored as text is a number again;
//     a re-imported save is not titled "(imported) (imported)".
async function importChecks(fail) {
  const store = realSave(); const h = await open(store);
  const turns = storedTurns(store), rec = JSON.parse(JSON.stringify(record(store)));
  const imp = async (text) => { h.click('#btnAdventures'); await h.settle(80, 4000); const input = h.$('#importFile'); Object.defineProperty(input, 'files', { value: [new h.window.File([text], 'save.json', { type: 'application/json' })], configurable: true }); input.dispatchEvent(new h.window.Event('change', { bubbles: true })); await h.idle(30000); await h.settle(150, 8000); return statusOf(h); };
  const whole = JSON.stringify({ format: 'windlass-save-1', world: { id: rec.worldId }, adventure: rec, turns });
  const cut = await imp(whole.slice(0, Math.floor(whole.length * 0.6)));
  if (!/cut off/.test(cut) || /position \d+/.test(cut)) fail('import: a cut-off file reads "' + cut.slice(0, 120) + '"');
  const gone = JSON.parse(whole); gone.adventure.worldId = 'halloway'; gone.world.id = 'halloway';
  const w = await imp(JSON.stringify(gone));
  if (!/world "halloway", which this game no longer has/.test(w)) fail('import: a save from a removed world reads "' + w.slice(0, 120) + '"');
  const again = JSON.parse(whole); again.adventure.title = 'Owen at the Isle (imported)'; again.adventure.state.day = '2';
  const ok = await imp(JSON.stringify(again));
  const added = [...h.mock.store.entries()].find(([k, v]) => /^adventures\/[^/]+$/.test(k) && k !== DOC && v.data.title && /imported/.test(v.data.title));
  if (!added) { fail('import: the save was not imported (' + ok.slice(0, 120) + ')'); h.close(); return; }
  if (added[1].data.title !== 'Owen at the Isle (imported)') fail('import: the title became "' + added[1].data.title + '"');
  if (added[1].data.state.day !== 2) fail('import: the day was stored as ' + JSON.stringify(added[1].data.state.day));
  clean(h, fail, 'import'); h.close();
}
// 12. A Delete cut short before its last step leaves a save marked as being removed, not a hollow game listed with its old turn
//     count: the next boot passes over it, Adventures says so, and Delete there finishes it. Every failure record goes too.
async function deleteCutShort(fail) {
  const store = realSave(); for (const [k, v] of realSave('advmuq6y2ozresh')) store.set(k, v);
  for (let i = 0; i < 130; i++) store.set(DOC + '/failures/f' + String(i).padStart(3, '0'), { data: { at: 'x', raw: 'y' }, version: 1 });
  const h = await open(store);
  h.click('#btnAdventures'); await h.settle(150, 4000);
  const rowOf = (p) => [...p.document.querySelectorAll('#advlist .advrow')].find((r) => r.querySelector('[data-act="open"]').textContent === 'Current' || /Being removed/.test(r.textContent));
  let row = rowOf(h); h.mock.dbFail = (op, p) => (op === 'delete' && p === DOC ? { code: 'unavailable', message: 'refused' } : null);
  h.click(row.querySelector('[data-act="delete"]')); h.click(row.querySelector('.confirm button')); await h.idle(30000); await h.settle(150, 4000); h.mock.dbFail = null; h.close();
  const left = [...store.keys()].filter((k) => k.startsWith(DOC + '/'));
  if (left.length) fail('delete cut short: ' + left.length + ' blocks or failure records of the removed game are left (' + left[0] + ')');
  const R = await open(store);
  if (feedCount(R) !== 47) fail('delete cut short: the next boot opened ' + feedCount(R) + ' turns, not the remaining 47-turn game (' + statusOf(R).slice(0, 120) + ')');
  R.click('#btnAdventures'); await R.settle(150, 4000);
  row = [...R.document.querySelectorAll('#advlist .advrow')].find((r) => !/Test 1/.test(r.textContent));
  if (!row || !/Being removed/.test(row.textContent) || !row.querySelector('[data-act="open"]').disabled) fail('delete cut short: Adventures does not show the save as being removed: ' + (row ? row.textContent.slice(0, 120) : 'no row'));
  if (row) { R.click(row.querySelector('[data-act="delete"]')); R.click(row.querySelector('.confirm button')); await R.idle(30000); }
  if (store.has(DOC)) fail('delete cut short: Delete did not finish the removal');
  clean(R, fail, 'delete cut short'); R.close();
}

const SCENARIOS = { twoDevices, handOver, undoInterrupted, regenInterrupted, olderTurnsShrink, unsavedAsks, migrationSameEverywhere, renameKeepsOrder, savesInOrder, newerSchemaRefused, importChecks, deleteCutShort };
(async () => {
  const only = process.argv[2]; const failures = [];
  for (const [name, fn] of Object.entries(SCENARIOS)) {
    if (only && only !== name) continue;
    if (NEEDS_SECOND.includes(name) && !hasSecond) { console.log('skip ' + name + ' (needs the second save on disk: set WL_SAVE_DIR)'); continue; }
    const mine = []; const t0 = Date.now();
    try { await fn((m) => mine.push(m)); } catch (e) { mine.push('threw: ' + ((e && e.stack) || e)); }
    console.log((mine.length ? 'FAIL ' : 'ok   ') + name + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)'); for (const m of mine) console.log('   - ' + m);
    failures.push(...mine);
  }
  process.exit(failures.length ? 1 : 0);
})();
