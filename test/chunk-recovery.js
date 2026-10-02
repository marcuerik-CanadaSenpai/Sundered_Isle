'use strict';
// Pass/fail: when the chunk saves ran ahead of the adventure document (an interrupted save), loadAdventure recovers
// the complete turns from the chunks and rebuilds the current state from the last complete turn.
const { boot } = require('./boot');
(async () => {
  const h = await boot({});
  await h.settle(150, 6000);
  h.click('#cBegin'); await h.idle(15000);
  for (let i = 1; i <= 6; i++) if (!(await h.turn('Explore the isle ' + i))) throw new Error('turn ' + i + ' did not finish');

  const advPath = [...h.mock.store.keys()].find((k) => /^adventures\/[^/]+$/.test(k));
  const entry = h.mock.store.get(advPath);
  const realCount = entry.data.turnCount;

  // Simulate the crash: roll the document's turnCount, state and memory back while the chunks keep every turn.
  const stale = JSON.parse(JSON.stringify(entry.data));
  stale.turnCount = realCount - 3;
  stale.state.day = 0; stale.state.time = 'STALE'; stale.state.location = 'STALE-LOC';
  stale.memory.events = stale.memory.events.slice(0, 1);
  h.mock.store.set(advPath, { data: stale, version: entry.version + 1 });

  h.click('#reloadAdv'); await h.idle(15000);
  const status = h.$('#status').textContent;
  const turnsShown = h.document.querySelectorAll('#feed .turn').length - 1;   // minus the opening

  // A fresh turn re-saves; the recovered (not the stale) state must be written back.
  if (!(await h.turn('Confirm recovery'))) throw new Error('post-recovery turn did not finish');
  const after = h.mock.store.get(advPath).data;

  const { errors, violations } = h.diagnostics();
  const fail = (m) => { console.error('chunk recovery FAILED: ' + m + '\n  status: ' + status); h.close(); process.exit(1); };
  if (!/Recovered/.test(status)) fail('no recovery warning shown');
  if (turnsShown !== realCount) fail('expected ' + realCount + ' turns after reload, saw ' + turnsShown);
  if (after.state.time === 'STALE' || after.state.location === 'STALE-LOC') fail('stale document state was not replaced by the recovered state');
  if (after.turnCount !== realCount + 1) fail('re-save did not persist the recovered turns (turnCount ' + after.turnCount + ')');
  if (errors.length) fail('page errors: ' + errors.map((e) => e.message.slice(0, 120)).join(' | '));
  if (violations.length) fail('contract violations: ' + JSON.stringify(violations.slice(0, 3)));

  console.log('chunk recovery passed: ' + realCount + ' complete turns recovered from chunks, stale state replaced, re-saved');
  h.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
