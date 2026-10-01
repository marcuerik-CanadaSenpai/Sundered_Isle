// Twelve-turn smoke test: create an adventure, take twelve turns, and check every turn was shown and saved in the store.
// Exits 1 on any failed expectation, rejected promise, page error or runtime-contract violation.
const { boot } = require('./boot');
const TURNS = 12;
(async () => {
  const failures = [];
  const expect = (ok, what) => { if (!ok) failures.push(what); };
  const h = await boot({});
  const turnsShown = () => h.document.querySelectorAll('#feed .turn').length;
  try {
    expect(await h.settle(150, 6000), 'the page did not settle after boot');
    h.click('#cBegin');
    expect(await h.idle(15000), 'creating the adventure did not finish');
    for (let i = 1; i <= TURNS; i++) {
      const before = turnsShown();
      expect(await h.turn('Action ' + i), 'turn ' + i + ' did not finish');
      expect(turnsShown() === before + 1, 'turn ' + i + ' was not added to the feed (' + before + ' -> ' + turnsShown() + ' turn elements)');
    }
    expect(turnsShown() === TURNS + 1, 'expected the opening and ' + TURNS + ' turns, found ' + turnsShown() + ' turn elements');
    const doc = [...h.mock.store.entries()].find(([k]) => /^adventures\/[^/]+$/.test(k));
    expect(doc && doc[1].data.turnCount === TURNS, 'the stored adventure has turnCount ' + (doc && doc[1].data.turnCount));
    const id = doc ? doc[0].split('/')[1] : '';
    const stored = [...h.mock.store.entries()].filter(([k]) => k.startsWith('adventures/' + id + '/turns/')).reduce((n, [, v]) => n + ((v.data && v.data.turns) || []).length, 0);
    expect(stored === TURNS, 'the store holds ' + stored + ' turn records, expected ' + TURNS);
    const d = h.diagnostics();
    expect(!d.errors.length, d.errors.length + ' page error(s): ' + d.errors.map((e) => e.message.split('\n')[0]).join(' | '));
    expect(!d.violations.length, d.violations.length + ' contract violation(s): ' + JSON.stringify(d.violations));
  } catch (e) {
    failures.push('threw: ' + ((e && e.stack) || e));
  } finally { h.close(); }
  if (failures.length) { console.error('TURN SMOKE FAILED\n- ' + failures.join('\n- ')); process.exit(1); }
  console.log('turn smoke passed: ' + TURNS + ' turns shown and stored, no page errors or contract violations');
  process.exit(0);
})().catch((e) => { console.error('TURN SMOKE FAILED', e); process.exit(1); });
