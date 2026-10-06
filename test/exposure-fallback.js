// Regression checks for first-person contact exposure fallback.
const { boot } = require('./boot');

(async () => {
  const failures = [];
  const expect = (ok, what) => { if (!ok) failures.push(what); };
  const h = await boot({});
  let replyExposures = [];
  const latestTurn = (hh = h) => {
    const id = [...hh.mock.store.keys()].find((key) => /^adventures\/[^/]+$/.test(key)).split('/')[1];
    const turns = [...hh.mock.store.entries()]
      .filter(([key]) => key.startsWith('adventures/' + id + '/turns/'))
      .flatMap(([, value]) => value.data.turns || []);
    return turns.sort((a, b) => a.n - b.n).at(-1);
  };
  const contains = (turn, species) => turn && turn.exposures.some((e) => e.species === species);
  try {
    expect(await h.settle(150, 6000), 'the page did not settle after boot');
    h.type('#cRmSpecies', 'fox');
    h.type('#cRmName', 'Rin Kitsuragi');
    // A pronoun checks against the roommate's own pronouns, so her gender is set rather than drawn at random.
    h.$('#cRmGender').value = 'female'; h.$('#cRmGender').dispatchEvent(new h.window.Event('change'));
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

    // The player's own words as he writes them: the imperative, a pronoun for the one person present, any clause of the action.
    const intensityIn = (turn, species) => { const e = turn && turn.exposures.find((x) => x.species === species); return e ? e.intensity : 0; };
    const sees = async (hh, species, list) => {
      for (const [action, level, description] of list) {
        replyExposures = [];
        expect(await hh.turn(action), description + ': the turn did not finish');
        expect(intensityIn(latestTurn(hh), species) === level, description + ' (' + JSON.stringify(action) + '): ' + species + ' intensity was ' + intensityIn(latestTurn(hh), species) + ', expected ' + level);
      }
    };
    await sees(h, 'fox', [
      ['Hug her.', 1, 'imperative, by pronoun'], ['Hug Rin.', 1, 'imperative, by name'], ['Cuddle up with her for a while.', 2, 'a long contact'], ['Sleep beside her.', 3, 'sleeping beside'],
      ['Make love to her.', 4, 'sex, by pronoun'], ['Go to the window, then hold her close and hug her.', 1, 'a later clause'],
      ['Say you hugged Rin yesterday.', 0, 'told, not done'], ['Tell her you want to kiss her.', 0, 'a wish'], ['Ask her what time class starts.', 0, 'no contact'], ["I won't hug her.", 0, 'a refusal'],
      ['I lick my lips.', 0, 'no person'], ['Thrust the door open.', 0, 'not sex'], ['Lie down on my bed with a book.', 0, 'not with her'], ['I drink from my water bottle.', 0, 'not from her'], ['Stay with her until the nurse comes.', 0, 'not sleeping'],
      ['Stroke her cheek.', 1, 'touching her'], ['I brush my teeth next to her.', 0, 'brushing beside her, not her'], ['Brush past her in the doorway.', 0, 'passing her'],
      ['I watch her sleep against the window.', 0, 'she sleeps against the window'],
    ]);
  } catch (e) {
    failures.push('threw: ' + ((e && e.stack) || e));
  } finally { h.close(); }
  // The same with a bovine roommate, whose contacts are milk, hugs and sleeping against her.
  const hc = await boot({});
  try {
    expect(await hc.settle(150, 6000), 'the page did not settle after boot (bovine)');
    hc.type('#cRmSpecies', 'cow'); hc.type('#cRmName', 'May Nakamura');
    hc.$('#cRmGender').value = 'female'; hc.$('#cRmGender').dispatchEvent(new hc.window.Event('change')); hc.click('#cBegin');
    expect(await hc.idle(30000), 'creating the adventure (bovine) did not finish');
    hc.mock.sampleHandler = () => JSON.stringify({
      evaluation: { stat: 'none', outcome: 'none' }, narrative: 'The quiet room holds its ordinary shape while the evening settles around you.',
      suggested_actions: ['Look around', 'Say hello', 'Leave'], state_updates: [], time_advance_minutes: 15, events: [], beats: [], facts: [], exposures: [],
    });
    const intensityIn = (turn, species) => { const e = turn && turn.exposures.find((x) => x.species === species); return e ? e.intensity : 0; };
    for (const [action, level, description] of [
      ['Fuck her hard.', 4, 'sex'], ['Drink from her.', 3, 'drinking from her'], ['I suck her nipple.', 3, 'sucking'], ['Milk her.', 3, 'milking'], ['Go to sleep against her.', 3, 'sleeping against her'],
      ['Wipe your mouth, then move to her breasts and suck to relieve those as well.', 3, 'sucking, her named earlier in the clause'], ['Take her hand and go down the stair together.', 1, 'holding a hand'],
      ['I nurse my sore ankle.', 0, 'nursing an ankle'], ['Order the chicken breast at the cafeteria.', 0, 'a breast of chicken'], ['I lick the envelope and hand it to her.', 0, 'licking an envelope'],
      ['Say the milk tasted good, and offer to milk her if she wants.', 0, 'an offer'], ['I watch her sleep against the window.', 0, 'she sleeps against the window'],
    ]) {
      expect(await hc.turn(action), description + ': the turn did not finish');
      expect(intensityIn(latestTurn(hc), 'cow') === level, description + ' (' + JSON.stringify(action) + '): cow intensity was ' + intensityIn(latestTurn(hc), 'cow') + ', expected ' + level);
    }
  } catch (e) {
    failures.push('threw (bovine): ' + ((e && e.stack) || e));
  } finally { hc.close(); }
  if (failures.length) { console.error('EXPOSURE FALLBACK FAILED\n- ' + failures.join('\n- ')); process.exit(1); }
  console.log('exposure fallback passed: only completed first-person contact is inferred (imperatives and pronouns included), and reply exposures are retained');
  process.exit(0);
})().catch((e) => { console.error('EXPOSURE FALLBACK FAILED', e); process.exit(1); });
