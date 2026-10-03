'use strict';
const assert = require('node:assert/strict');
const { boot } = require('./boot');

async function startAdventure() {
  const h = await boot({});
  assert(await h.settle(150, 6000), 'the page did not settle after boot');
  h.click('#cBegin');
  assert(await h.idle(15000), 'creating the adventure did not finish');
  return h;
}

async function main() {
  const h = await startAdventure();
  try {
    const prompts = []; const fits = [];
    h.mock.sampleHandler = (input) => {
      const prompt = Array.isArray(input) ? input.map((m) => m.content).join('\n') : String(input);
      if (/Rewrite it to between/.test(prompt)) { fits.push(prompt); return Array(640).fill('moment').join(' '); }
      if (prompt.includes('You are the storyteller for an interactive text adventure')) prompts.push(prompt);
      return JSON.stringify({
        evaluation: { stat: 'none', outcome: 'none' },
        narrative: Array(380).fill('moment').join(' '),
        suggested_actions: ['Stay close', 'Speak', 'Step away'],
        secret_info: '', state_updates: [], time_advance_minutes: 15,
        events: [], beats: [], facts: [], exposures: []
      });
    };

    assert(await h.turn('Spend the night sleeping together and kiss slowly'), 'romantic turn did not finish');
    assert(prompts.length > 0, 'the storyteller prompt was not captured');
    const prompt = prompts[0];
    assert.match(prompt, /Romance scene pacing \(binding\)/, 'the scene-specific romance directive must reach the narrator');
    assert.match(prompt, /one specific reciprocal beat at a time/, 'intimacy must be paced as discrete beats');
    assert.match(prompt, /Consensual adult sex may be depicted on-page when requested/,
      'the romance prompt must not require sex to remain off-page');
    assert.match(prompt, /do not fade to black, cut away, or end the scene merely because requested consensual sex begins/,
      'the romance prompt must explicitly prohibit reintroducing a sex-triggered cutaway');
    assert.doesNotMatch(prompt, /sex is not depicted|sex remains off-page/i,
      'the romance prompt must not reinstate the off-page restriction');
    assert.match(prompt, /Body detail \(binding\)/, 'scene-specific anatomical guidance must reach the narrator');
    assert.match(prompt, /Do not replace a named feature with generic warmth or euphemism/, 'established anatomy must not be euphemized');
    assert.match(prompt, /Narrative length:.*640 words/i, 'the rich scene band must be enforced for romance');
    assert(await h.turn('I read the program quietly in the huge courtyard'), 'ordinary turn did not finish');
    assert(prompts.length > 1, 'the ordinary storyteller prompt was not captured');
    assert.doesNotMatch(prompts[1], /Romance scene pacing \(binding\)/,
      'ordinary words containing romance roots must not trigger romance pacing');
    assert(await h.turn('Stay at the table', { director: 'Walk with Luna to the quad and stop there.' }),
      'director-note turn did not finish');
    assert(prompts.length > 2, 'the director-note storyteller prompt was not captured');
    assert.match(prompts[2], /Director note \(binding\): Walk with Luna to the quad and stop there\./,
      'the exact director note must reach the narrator');
    assert.match(prompts[2], /Treat its concrete actions, requested people, and ending as required for this turn/,
      'the narrator must treat concrete director-note instructions as required');
    assert.match(prompts[2], /overrides prior-scene momentum, default pacing, and the generic stop-at-choice instruction/,
      'a director note must take precedence over generic scene pacing');
    assert.doesNotMatch(prompts[2], /shorter whenever .* reaches a choice sooner/,
      'the generic short-scene instruction must not undermine a director note');
    assert.match(prompts[2], /ending at the binding director note's requested ending/,
      'the output format must not contradict the director-note ending');
    assert.match(prompts[2], /Actions the note gives \S+ are the player's own instruction for this turn/,
      'protagonist actions in a director note must count as part of the stated player action');
    assert.match(prompts[2], /still add no desire, consent, dialogue or further action/,
      'a director note must not license unstated choices for the protagonist');
    assert(await h.turn('Keep talking', { director: 'Tell it in about 600 words.' }), 'director length turn did not finish');
    assert(prompts.length > 3, 'the director-length storyteller prompt was not captured');
    assert.match(prompts[3], /Narrative length: at most 660 words; 510 to 660/, 'a director-requested length must set the prompt band');
    assert.match(prompts[3], /"narrative": string, at most 660 words/, 'the output format must use the director-requested length');
    assert(await h.turn('Keep talking', { director: 'Tell it in 600+ words.' }), 'director lower-bound turn did not finish');
    assert.match(prompts[4], /Narrative length: at most 750 words; at least 600, as the director note requires/, 'a requested lower bound must stay a lower bound');
    assert.equal(fits.length, 1, 'only the reply below a requested minimum must be fitted');
    assert.match(fits[0], /Rewrite it to between 600 and 750 words/, 'a reply below a requested minimum must be expanded into the band');
    assert(await h.turn('Look around', { director: 'Read the 100 words on the plaque aloud.' }), 'incidental word-count turn did not finish');
    assert.doesNotMatch(prompts[5], /at most 100 words/, 'a word count mentioned for another reason must not set the length');
    assert(await h.turn('Keep talking', { director: 'Write 600 words.' }), 'plain length turn did not finish');
    assert.match(prompts[6], /Narrative length: at most 660 words; 510 to 660/, 'a plain "write N words" must set the length');
    assert(await h.turn('Look around', { director: 'Read between 100 and 200 words from the plaque aloud.' }), 'incidental range turn did not finish');
    assert.doesNotMatch(prompts[7], /at most 200 words/, 'a range of words read from something in the story must not set the length');
    assert(await h.turn('Look around', { director: 'Describe the plaque containing 100 words.' }), 'incidental description turn did not finish');
    assert.doesNotMatch(prompts[8], /at most 110 words/, 'a count describing something in the story must not set the length');
    assert(await h.turn('Keep talking', { director: 'Read 100 words aloud, then write about 600 words.' }), 'mixed-count turn did not finish');
    assert.match(prompts[9], /Narrative length: at most 660 words; 510 to 660/, 'a later narrative length must win over an earlier incidental count');
    assert.equal(fits.length, 1, 'turns without a requested minimum must not be expanded');
    assert(await h.turn('Keep talking', { director: 'Keep it not more than 300 words.' }), 'not-more-than turn did not finish');
    assert.match(prompts[10], /Narrative length: at most 300 words; 180 to 300/, '"not more than" must set a ceiling');
    assert(await h.turn('Keep talking', { director: 'Write at least 700 words.' }), 'short-expansion turn did not finish');
    assert.equal(fits.length, 3, 'the overlong reply and the reply below a requested minimum must both be fitted');
    assert.match(fits[1], /Rewrite it to between 180 and 300 words/, 'an overlong reply must be fitted to the requested ceiling');
    assert.match(fits[2], /Rewrite it to between 700 and 875 words/, 'the expansion must target the requested band');

    const [adventurePath, adventure] = [...h.mock.store.entries()].find(([path]) => /^adventures\/[^/]+$/.test(path));
    assert.equal(adventure.data.settings.density, 'standard', 'the regression must exercise the default manual density');
    const id = adventurePath.split('/')[1];
    const savedTurns = h.mock.store.get('adventures/' + id + '/turns/0000').data.turns;
    assert.deepEqual(Array.from(savedTurns[0].band), Array.from(h.window.WINDLASS_WORLDS.sundered.wordBands.rich),
      'romance must use the rich band even when standard density is selected');
    assert.deepEqual(Array.from(savedTurns[1].band), Array.from(h.window.WINDLASS_WORLDS.sundered.wordBands.standard),
      'ordinary scenes must continue to honor the selected standard density');
    assert.deepEqual(Array.from(savedTurns[3].band), [510, 660],
      'a director-requested length must set the band the length fit uses');
    assert.deepEqual(Array.from(savedTurns[4].band), [600, 750], 'a requested lower bound must reach the saved band');
    assert.equal(savedTurns[4].words, 640, 'the expanded reply must be the one saved');
    const laterTurns = h.mock.store.get('adventures/' + id + '/turns/0001').data.turns;
    assert.equal(laterTurns[1].words, 380, 'an expansion that stays below the requested minimum must not replace the reply');
    assert.deepEqual(Array.from(savedTurns[5].band), Array.from(h.window.WINDLASS_WORLDS.sundered.wordBands.standard),
      'an incidental word count must leave the selected band alone');
    assert.deepEqual(Array.from(savedTurns[6].band), [510, 660], 'a plain "write N words" must reach the saved band');
    assert.deepEqual(Array.from(savedTurns[7].band), Array.from(h.window.WINDLASS_WORLDS.sundered.wordBands.standard),
      'an incidental word range must leave the selected band alone');

    const worlds = h.window.WINDLASS_WORLDS;
    for (const id of ['sundered', 'mythaven', 'halloway']) {
      const rules = worlds[id].rules.join('\n');
      assert.match(rules, /romance/i, id + ' must permit romance');
      assert.match(rules, /consensual adult sex may be (?:described|depicted) on-page when requested/i,
        id + ' must permit consensual adult sex on-page when requested');
      assert.match(rules, /do not fade to black or cut away merely because requested consensual sex begins/i,
        id + ' must prevent a sex-triggered fade-out');
      assert.doesNotMatch(rules, /sex is not|sex remains off-page/i,
        id + ' must not require sex to remain off-page');
      assert.match(rules, /accurate, neutral terms|anatomical accuracy/i, id + ' must have an affirmative anatomy rule');
      assert.doesNotMatch(rules, /Content: no sexual content/i, id + ' must not blanket-suppress romance');
    }

    const sunderedCow = worlds.sundered.genPools.species.cow.bodyByGender.female.join(' ');
    assert.match(sunderedCow, /udder.*four teats/i, 'Sundered must retain its established bovine anatomy');
    const sunderedWolf = worlds.sundered.genPools.species.wolf.bodyByGender.female.join(' ');
    assert.match(sunderedWolf, /two rows of small nipples run down the abdomen/i, 'Sundered must retain its established wolf anatomy');
    const mythavenUdder = worlds.mythaven.transformation.species.cow.ladder.find((step) => step.at === 85).trait;
    assert.match(mythavenUdder, /udder develops low on the abdomen with four teats/i, 'Mythaven must use the sourced bovine anatomy');
    assert.match(worlds.mythaven.genPools.species.cow.bodyByGender.female.join(' '), /udder.*four teats/i,
      'Mythaven roommate profiles must retain the sourced bovine anatomy');

    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
