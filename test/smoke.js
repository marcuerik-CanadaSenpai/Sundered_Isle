// One-turn smoke test: boot on an empty store, create an adventure, take one turn, and check it was shown and saved.
// Exits 1 on any failed expectation, page error or runtime-contract violation.
const { boot } = require('./boot');
(async () => {
  const failures = [];
  const expect = (ok, what) => { if (!ok) failures.push(what); };
  const h = await boot({});
  const turnsShown = () => h.document.querySelectorAll('#feed .turn').length;
  try {
    expect(await h.settle(150, 6000), 'the page did not settle after boot');
    expect(h.$('#connText').textContent === 'Claude ready', 'connection reads "' + h.$('#connText').textContent + '"');
    expect(h.$('#dlgCreate').hasAttribute('open'), 'the create dialog did not open on an empty store');
    h.click('#cBegin');
    expect(await h.idle(15000), 'creating the adventure did not finish');
    expect(!h.$('#dlgCreate').hasAttribute('open'), 'the create dialog is still open after Begin');
    expect(turnsShown() === 1, 'expected the opening only, found ' + turnsShown() + ' turn elements');
    expect(await h.turn('I look around the room.'), 'the turn did not finish');
    expect(turnsShown() === 2, 'expected the opening and 1 turn, found ' + turnsShown() + ' turn elements');
    const status = h.$('#status');
    expect(status.hidden || !status.classList.contains('bad'), 'the status line shows an error: ' + status.textContent);
    expect(/^saved/.test(h.$('#summaryNote').textContent), 'the save note reads "' + h.$('#summaryNote').textContent + '"');
    const doc = [...h.mock.store.entries()].find(([k]) => /^adventures\/[^/]+$/.test(k));
    expect(doc && doc[1].data.turnCount === 1, 'the stored adventure has turnCount ' + (doc && doc[1].data.turnCount));
    const d = h.diagnostics();
    expect(!d.errors.length, d.errors.length + ' page error(s): ' + d.errors.map((e) => e.message.split('\n')[0]).join(' | '));
    expect(!d.violations.length, d.violations.length + ' contract violation(s): ' + JSON.stringify(d.violations));
  } catch (e) {
    failures.push('threw: ' + ((e && e.stack) || e));
  } finally { h.close(); }
  if (failures.length) { console.error('SMOKE FAILED\n- ' + failures.join('\n- ')); process.exit(1); }
  console.log('smoke passed: adventure created, 1 turn taken and saved, no page errors or contract violations');
  process.exit(0);
})().catch((e) => { console.error('SMOKE FAILED', e); process.exit(1); });
