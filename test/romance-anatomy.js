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
    const prompts = [];
    h.mock.sampleHandler = (input) => {
      const prompt = Array.isArray(input) ? input.map((m) => m.content).join('\n') : String(input);
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
    assert.match(prompt, /fade to black at that boundary/, 'sex must remain off-page without skipping the lead-in');
    assert.match(prompt, /do not depict sex or append a morning-after\/time-skip in this turn/, 'the turn must not jump past the intimate scene');
    assert.match(prompt, /Body detail \(binding\)/, 'scene-specific anatomical guidance must reach the narrator');
    assert.match(prompt, /Do not replace a named feature with generic warmth or euphemism/, 'established anatomy must not be euphemized');
    assert.match(prompt, /Narrative length:.*640 words/i, 'the rich scene band must be enforced for romance');
    assert(await h.turn('I read the program quietly in the huge courtyard'), 'ordinary turn did not finish');
    assert.doesNotMatch(prompts[1], /Romance scene pacing \(binding\)/,
      'ordinary words containing romance roots must not trigger romance pacing');

    const [adventurePath, adventure] = [...h.mock.store.entries()].find(([path]) => /^adventures\/[^/]+$/.test(path));
    assert.equal(adventure.data.settings.density, 'standard', 'the regression must exercise the default manual density');
    const id = adventurePath.split('/')[1];
    const savedTurns = h.mock.store.get('adventures/' + id + '/turns/0000').data.turns;
    assert.deepEqual(Array.from(savedTurns[0].band), Array.from(h.window.WINDLASS_WORLDS.sundered.wordBands.rich),
      'romance must use the rich band even when standard density is selected');
    assert.deepEqual(Array.from(savedTurns[1].band), Array.from(h.window.WINDLASS_WORLDS.sundered.wordBands.standard),
      'ordinary scenes must continue to honor the selected standard density');

    const worlds = h.window.WINDLASS_WORLDS;
    for (const id of ['sundered', 'mythaven', 'halloway']) {
      const rules = worlds[id].rules.join('\n');
      assert.match(rules, /romance/i, id + ' must permit romance');
      assert.match(rules, /sex (?:is )?(?:not|off-page)|sex remains off-page/i, id + ' must keep sex off-page');
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
