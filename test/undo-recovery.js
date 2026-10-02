// Recovery of turns saved ahead of a stale adventure record, after Undo. Exits 1 on any failed expectation.
// 1. Fold at turn F, two more turns (F is trimmed), two Undos (F is newest again), then a reload from the record as it was
//    after turn F-1: turn F and its folded summary must be recovered.
// 2. A save whose newest turn ahead of the record is trimmed opens at the record's turns, with a warning, and plays on.
// 3 to 5 are below.
const { boot } = require('./boot');
const J = (x) => JSON.parse(JSON.stringify(x));
const copy = (store) => new Map([...store].map(([k, v]) => [k, J(v)]));
const advKey = (store) => [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k));
const chunks = (store, dk) => [...store.keys()].filter((k) => k.startsWith(dk + '/turns/')).sort();
const turnsOf = (store, dk) => chunks(store, dk).flatMap((k) => store.get(k).data.turns);
const statusOf = (h) => (h.$('#status').hidden ? '' : h.$('#status').textContent);
async function newGame() { const h = await boot({}); await h.settle(150, 6000); h.click('#cBegin'); await h.idle(15000); return h; }
async function twoUndos(fail) {
  const h = await newGame(); const records = {}; let F = -1;
  for (let i = 0; i < 45 && F < 0; i++) {
    await h.turn('I keep going, step ' + i + '.');
    const dk = advKey(h.mock.store); const d = h.mock.store.get(dk).data; records[d.turnCount] = J(d);
    const folded = turnsOf(h.mock.store, dk).find((t) => t.memAfter); if (folded) F = folded.n;
  }
  if (F < 0) { fail('no memory fold happened in 45 turns'); h.close(); return; }
  await h.turn('After the fold, one.'); await h.turn('After the fold, two.');
  h.click('#undo'); await h.idle(10000); h.click('#undo'); await h.idle(10000);
  const store = copy(h.mock.store); const dk = advKey(store); h.close();
  const ts = turnsOf(store, dk); const newest = ts[ts.length - 1];
  if (newest.n !== F) fail('after two Undos the newest turn is ' + newest.n + ', expected ' + F);
  if (!newest.memAfter) fail('the newest turn holds no fold record after two Undos');
  const stale = J(records[F - 1]); stale.rev = (store.get(chunks(store, dk).pop()).data.rev || 1) - 1; store.set(dk, { data: stale, version: 1 });
  const h2 = await boot({ setup(w, m) { m.store = store; } }); await h2.settle(150, 8000); await h2.idle(10000);
  const shown = h2.document.querySelectorAll('#feed .turn').length - 1;
  if (shown !== F) fail('two Undos: reload shows ' + shown + ' turns, expected ' + F + ' (' + statusOf(h2).slice(0, 120) + ')');
  if (!/Recovered/.test(statusOf(h2))) fail('two Undos: no recovery note (' + statusOf(h2).slice(0, 120) + ')');
  if (h2.$('#summary').value !== records[F].memory.summary) fail('two Undos: the folded summary was not recovered');
  if (h2.errors.length || h2.mock.violations.length) fail('two Undos: page errors or contract violations');
  h2.close();
}
async function trimmedTail(fail) {
  const h = await newGame();
  for (const a of ['One.', 'Two.', 'Three.']) await h.turn(a);
  const store = copy(h.mock.store); const dk = advKey(store); h.close();
  const chunk = store.get(chunks(store, dk)[0]).data; const t3 = chunk.turns[2];
  t3.stateAfter = { day: t3.stateAfter.day, time: t3.stateAfter.time, location: t3.stateAfter.location, present: t3.stateAfter.present }; t3._trimmed = true; t3.memBefore = null;
  const doc = store.get(dk).data; doc.turnCount = 2; doc.rev = (chunk.rev || 1) - 1; doc.state = J(t3.stateBefore);
  const h2 = await boot({ setup(w, m) { m.store = store; } }); await h2.settle(150, 8000); await h2.idle(10000);
  const shown = h2.document.querySelectorAll('#feed .turn').length - 1;
  if (shown !== 2) fail('trimmed tail: reload shows ' + shown + ' turns, expected 2 (' + statusOf(h2).slice(0, 120) + ')');
  if (!/could not be recovered/.test(statusOf(h2))) fail('trimmed tail: no warning about the turn that could not be recovered');
  if (!(await h2.turn('Four.'))) fail('trimmed tail: the next turn did not finish');
  const after = turnsOf(h2.mock.store, dk); const rec = h2.mock.store.get(dk).data;
  if (h2.document.querySelectorAll('#feed .turn').length - 1 !== 3) fail('trimmed tail: the page does not show 3 turns after playing on');
  if (rec.turnCount !== 3 || after.length !== 3 || after[2].action !== 'Four.') fail('trimmed tail: the next turn was not saved as turn 3 (record ' + rec.turnCount + ', stored ' + after.length + ', last action ' + JSON.stringify(after[after.length - 1] && after[after.length - 1].action) + ')');
  if (h2.errors.length || h2.mock.violations.length) fail('trimmed tail: page errors or contract violations');
  h2.close();
}
// 3. After two Undos and two new turns, the turn whose after-state Undo restored is trimmed again (save size stays bounded).
async function retrimAfterUndo(fail) {
  const h = await newGame();
  for (const a of ['One.', 'Two.', 'Three.']) await h.turn(a);
  h.click('#undo'); await h.idle(10000); h.click('#undo'); await h.idle(10000);
  await h.turn('Two again.'); await h.turn('Three again.');
  const dk = advKey(h.mock.store); const t1 = turnsOf(h.mock.store, dk).find((t) => t.n === 1);
  if (!t1 || !t1._trimmed || (t1.stateAfter && t1.stateAfter.items)) fail('re-trim: turn 1 kept its whole after-state after two Undos and two new turns');
  if (h.errors.length || h.mock.violations.length) fail('re-trim: page errors or contract violations');
  h.close();
}
// 4. A stored previous version that carries a fold record (from an older build) loses it on load, so the next save drops it.
async function altRecordDropped(fail) {
  const h = await newGame();
  await h.turn('One.'); h.click('#regen'); await h.idle(20000);
  const store = copy(h.mock.store); const dk = advKey(store); h.close();
  const chunk = store.get(chunks(store, dk)[0]).data; const t1 = chunk.turns[0];
  if (!t1.alts || !t1.alts.length) { fail('alt record: Regenerate kept no previous version'); return; }
  t1.alts[0].memAfter = { summary: 'old fold', beats: ['x'], facts: [] };
  const h2 = await boot({ setup(w, m) { m.store = store; } }); await h2.settle(150, 8000); await h2.idle(10000);
  h2.click('#btnSettings'); h2.$('#setDensity').value = h2.$('#setDensity').value === 'rich' ? 'standard' : 'rich'; h2.$('#setDensity').dispatchEvent(new h2.window.Event('change')); await h2.idle(8000);
  const alts = turnsOf(h2.mock.store, dk).flatMap((t) => t.alts || []);
  if (alts.some((a) => a && a.memAfter)) fail('alt record: a stored previous version still carries a fold record after load and save');
  if (h2.errors.length || h2.mock.violations.length) fail('alt record: page errors or contract violations');
  h2.close();
}
// 5. A save written by 1.0 keeps a whole memory copy on every turn that folded. On load all but the newest are dropped, and
//    an older, full block that held one is written again on the next save.
async function legacyRecordsDropped(fail) {
  const h = await newGame();
  for (let i = 1; i <= 12; i++) await h.turn('Step ' + i + '.');
  const store = copy(h.mock.store); const dk = advKey(store); h.close();
  const ck = chunks(store, dk); const first = store.get(ck[0]).data;
  const mem = J(store.get(dk).data.memory);
  first.turns[2].memAfter = J(mem); first.turns[2]._trimmed = true; first.turns[6].memAfter = J(mem);
  const h2 = await boot({ setup(w, m) { m.store = store; } }); await h2.settle(150, 8000); await h2.idle(10000);
  await h2.turn('Step 13.');
  const left = turnsOf(h2.mock.store, dk).filter((t) => t.memAfter).map((t) => t.n);
  if (left.length) fail('legacy records: turns ' + left.join(', ') + ' still carry a fold record after load and a save');
  if (turnsOf(h2.mock.store, dk).length !== 13) fail('legacy records: expected 13 stored turns after playing on');
  if (h2.errors.length || h2.mock.violations.length) fail('legacy records: page errors or contract violations');
  h2.close();
}
(async () => {
  const failures = []; const fail = (m) => failures.push(m);
  try { await twoUndos(fail); await trimmedTail(fail); await retrimAfterUndo(fail); await altRecordDropped(fail); await legacyRecordsDropped(fail); } catch (e) { failures.push('threw: ' + ((e && e.stack) || e)); }
  if (failures.length) { console.error('UNDO RECOVERY FAILED\n- ' + failures.join('\n- ')); process.exit(1); }
  console.log('undo recovery passed: two Undos then a stale record recover the folded turn; a trimmed tail opens with a warning; restored state is re-trimmed; old fold records leave previous versions and older turns');
  process.exit(0);
})();
