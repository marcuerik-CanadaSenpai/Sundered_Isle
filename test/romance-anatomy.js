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
      'the romance prompt must allow requested consensual adult sex on-page');
    assert.match(prompt, /depict the requested physical act directly and continuously/,
      'requested consensual sex must be depicted directly and continuously');
    assert.match(prompt, /do not fade out, cut away, imply, euphemize, summarize or skip the act/,
      'requested consensual sex must not be faded, cut away, implied, summarized or skipped');
    assert.match(prompt, /do not jump to its aftermath in the same turn/,
      'a requested adult scene must not jump to its aftermath');
    assert.match(prompt, /Use only anatomy and functions established in the world data; do not invent them/,
      'on-page intimacy must use only established anatomy');
    assert.match(prompt, /Keep the narration in the world rule's second-person present-tense perspective and do not insert unrelated events/,
      'romance narration must retain perspective and stay on scene');
    assert.doesNotMatch(prompt, /fade to black|sex is not depicted|sex remains off-page/i,
      'the romance prompt must not reinstate an off-page restriction');
    assert.match(prompt, /Do not presume consent or decide the player's desire, feelings or next action/,
      'on-page intimacy must preserve consent and player agency');
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
    assert.match(prompts[2], /When .* explicitly travels to a destination, make the journey legible through a few concrete details/,
      'a requested journey should show the route and remain interruptible');
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
    assert(await h.turn('Keep talking', { director: 'Keep it not more than 350 words.' }), 'tight-ceiling turn did not finish');
    assert.equal(fits.length, 4, 'a reply even slightly over a requested maximum must be fitted');
    assert.match(fits[3], /Rewrite it to between 210 and 350 words/, 'the fit must target the requested ceiling');
    h.click('#btnCast');
    h.click('#castAdd');
    assert(await h.settle(80, 4000), 'adding a character did not finish');
    h.type('#cfName', 'Luna');
    h.type('#cfSpecies', 'Werewolf');
    h.$('#cfGender').value = 'female';
    h.click('#cfSave');
    assert(await h.settle(80, 4000), 'saving the test character did not finish');
    assert(await h.turn('Stay at the table', { director: 'Luna arrives and sits down.' }), 'director-arrival turn did not finish');
    assert.match(prompts[13], /Focus: the action or director note names Luna/,
      'a person the director note brings in must be in focus, not shut out by it');
    assert.match(prompts[13], /Luna \(Werewolf\) \[npc\d+\] \(Woman, she\/her/,
      'cast edits must preserve an explicit gender and matching pronouns in the storyteller prompt');
    assert.match(prompts[13], /unless the action or the director note invites it/,
      'the focus rule must leave room for the director note');
    assert(await h.turn('Stay at the table', { director: 'Have Luna write 100 words in her journal.' }), 'in-story writing turn did not finish');
    assert.doesNotMatch(prompts[14], /at most 110 words/, 'words a character writes in the story must not set the narrative length');
    assert.equal(fits.length, 4, 'an in-story word count must not trigger a length fit');

    const [adventurePath, adventure] = [...h.mock.store.entries()].find(([path]) => /^adventures\/[^/]+$/.test(path));
    assert.equal(adventure.data.settings.density, 'standard', 'the regression must exercise the default manual density');
    assert.doesNotMatch(adventure.data.opening.narrative, /Sundering|humans once had magic/i,
      'the player-facing opening must not disclose Sundering history');
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
    // Every world the page loads keeps the romance and anatomy rules (Sundered Isle is the only one in the game now).
    assert(worlds.sundered, 'Sundered Isle must be loaded');
    for (const id of Object.keys(worlds)) {
      const rules = worlds[id].rules.join('\n');
      assert.match(rules, /romance/i, id + ' must permit romance');
      assert.match(rules, /consensual adult sex may be (?:described|depicted) on-page when requested/i,
        id + ' must permit consensual adult sex on-page when requested');
      assert.doesNotMatch(rules, /sex is not|sex remains off-page|fade to black/i,
        id + ' must not require sex to remain off-page');
      assert.match(rules, /never presume consent or decide the player's desire or actions/i,
        id + ' must preserve consent and player agency');
      assert.match(rules, /accurate, neutral terms|anatomical accuracy/i, id + ' must have an affirmative anatomy rule');
      assert.doesNotMatch(rules, /Content: no sexual content/i, id + ' must not blanket-suppress romance');
    }

    const sunderedRules = worlds.sundered.rules.join('\n');
    assert.match(sunderedRules, /nobody is offended, disappointed or otherwise penalized when .* uses it/i,
      'Spa use must not cause NPC disappointment or other social penalty');
    assert.match(sunderedRules, /dating or caring for more than one person is allowed and has no automatic penalty/i,
      'multiple romances must not carry an automatic consequence');
    assert.match(sunderedRules, /Use each character's attitude .* current opinion/i,
      'romance must be grounded in each character’s opinion of the player');
    assert.match(sunderedRules, /species customs, exposure methods, role descriptions, opening beats .* possibilities, not scripts/i,
      'species behavior and recurring beats must remain individual suggestions');
    assert.match(sunderedRules, /do not let "radiating heat" or a warm body become a recurring default/i,
      'heat descriptions may be used but should not become a recurring default');
    assert.doesNotMatch(sunderedRules, /never use "radiating heat"/i,
      'sensory variety must not categorically ban heat descriptions');
    assert.match(sunderedRules, /paths can progress together on one body; they do not compete for a limited number of parts/i,
      'multiple species paths must coexist without arbitrary replacement');
    assert.doesNotMatch(prompts[1], /Each part changes on its own track/,
      'the waypoint rule is sent only once a change has begun');

    // Looks are composed from the tracks' own lines, so the established anatomy lives there.
    const trackOf = (k, key) => worlds.sundered.transformation.tracks.species[k].find((t) => t.key === key);
    const sunderedCow = trackOf('cow', 'teats_and_udder');
    assert.equal(sunderedCow.sex, 'women', 'the udder is a bovine woman\'s feature only');
    assert.match(sunderedCow.endsAs, /long thick nipples like teats and a small four-teated udder low on the belly/i, 'Sundered must retain its established bovine anatomy');
    assert.match(sunderedRules, /a bovine woman's udder low on the belly with four teats/i, 'the anatomy rule must keep the bovine udder');
    const sunderedWolf = trackOf('wolf', 'further_pairs');
    assert.equal(sunderedWolf.sex, 'women', 'further pairs of nipples are a wolf woman\'s feature only');
    assert.match(sunderedWolf.endsAs, /two more pairs of small nipples down the belly below the breasts/i, 'Sundered must retain its established wolf anatomy');
    const wolfTeeth = worlds.sundered.transformation.species.wolf.ladder.find((step) => step.at === 30).steps;
    assert.equal(wolfTeeth.length, 10, 'wolf canine progression must have ten incremental steps');
    assert.match(wolfTeeth[0], /canine catches.*looks unchanged/i, 'the first canine stage must remain subtle');
    assert.match(wolfTeeth[9], /settled into long, sharply tapered wolf canines/i, 'the final canine stage must establish the complete feature');
    assert.doesNotMatch(worlds.sundered.premise, /Sundering|humans once had magic/i,
      'the opening premise must not reveal the Sundering history');

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
