// Regression checks for first-person contact exposure fallback.
const { boot } = require('./boot');

(async () => {
  const failures = [];
  const expect = (ok, what) => { if (!ok) failures.push(what); };
  const h = await boot({});
  let replyExposures = [];
  const latestTurn = () => {
    const id = [...h.mock.store.keys()].find((key) => /^adventures\/[^/]+$/.test(key)).split('/')[1];
    const turns = [...h.mock.store.entries()]
      .filter(([key]) => key.startsWith('adventures/' + id + '/turns/'))
      .flatMap(([, value]) => value.data.turns || []);
    return turns.sort((a, b) => a.n - b.n).at(-1);
  };
  const contains = (turn, species) => turn && turn.exposures.some((e) => e.species === species);
  try {
    expect(await h.settle(150, 6000), 'the page did not settle after boot');
    h.type('#cRmSpecies', 'fox');
    h.type('#cRmName', 'Rin Kitsuragi');
    h.click('#cBegin');
    expect(await h.idle(30000), 'creating the adventure did not finish');

    const adventure = [...h.mock.store.entries()].find(([key]) => /^adventures\/[^/]+$/.test(key))[1].data;
    const other = adventure.cast.generated.characters.find((c) => c.species && c.species !== 'human');
    expect(!!other, 'no non-human cast member was generated for the NPC-to-NPC check');
    const longNarrative = Array(180).fill('The quiet room holds its ordinary shape while the evening settles around you.').join(' ');
    h.mock.sampleHandler = () => JSON.stringify({
      evaluation: { stat: 'none', outcome: 'none' }, narrative: longNarrative,
      suggested_actions: ['Look around', 'Say hello', 'Leave'], state_updates: [],
      time_advance_minutes: 15, events: [], beats: [], facts: [], exposures: replyExposures,
    });

    const check = async (action, expected, description, reported = []) => {
      replyExposures = reported;
      expect(await h.turn(action), description + ': the turn did not finish');
      const turn = latestTurn();
      expect(!!turn, description + ': no saved turn was found');
      expect(contains(turn, 'fox') === expected, description + ': fox exposure was ' + contains(turn, 'fox'));
    };
    await check('I tell Rin good night and go to sleep.', false, 'unrelated sleep mention');
    await check('I ask Rin to hug me.', false, 'requested contact');
    await check("I didn't hug Rin.", false, 'negated contact');
    await check('Rin hugged ' + other.first + '.', false, 'NPC-to-NPC contact');
    await check('I hugged Rin.', true, 'completed first-person contact');
    await check('I read by the window.', true, 'reply-reported exposure', [{ species: 'fox', method: 'reply report', intensity: 2 }]);
  } catch (e) {
    failures.push('threw: ' + ((e && e.stack) || e));
  } finally { h.close(); }
  if (failures.length) { console.error('EXPOSURE FALLBACK FAILED\n- ' + failures.join('\n- ')); process.exit(1); }
  console.log('exposure fallback passed: only completed first-person contact is inferred, and reply exposures are retained');
  process.exit(0);
})().catch((e) => { console.error('EXPOSURE FALLBACK FAILED', e); process.exit(1); });
