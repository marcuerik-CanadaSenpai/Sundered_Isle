'use strict';
// Regressions for intimate-scene pacing across turns (npm run pacing-scenes). One scenario per fix; each fails on the build before
// the fix and passes on the fixed one. Run one by name: node pacing-scenes.js directorActIsOneStage
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node pacing-scenes.js
const assert = require('node:assert/strict');
const { boot } = require('./boot');

let unhandled = 0; process.on('unhandledRejection', () => { unhandled += 1; });
const advDocs = (store) => [...store.entries()].filter(([p]) => /^adventures\/[^/]+$/.test(p));
const onlyAdv = (store) => { const d = advDocs(store); assert.equal(d.length, 1, 'expected one adventure, found ' + d.length); return { id: d[0][0].split('/')[1], data: d[0][1].data }; };
const storedTurns = (store, id) => [...store.entries()].filter(([p]) => p.startsWith('adventures/' + id + '/turns/')).sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([, v]) => v.data.turns);
const turnCalls = (h) => h.mock.sampleCalls.filter((c) => /^turn/.test(c.label));
const lastTurn = (h) => turnCalls(h).at(-1);
const promptOf = (c) => (Array.isArray(c.input) ? c.input.map((m) => m.content).join('\n') : String(c.input));
const section = (p, tag) => { const i = p.lastIndexOf('<' + tag); return i < 0 ? '' : p.slice(i, p.indexOf('</' + tag + '>', i)); };
const clean = (h) => assert(!h.errors.length && !h.mock.violations.length, 'page errors or contract violations: ' + JSON.stringify(h.errors.concat(h.mock.violations)).slice(0, 400));

async function begin(o) {
  o = o || {};
  const h = await boot({ setup: o.setup });
  assert(await h.settle(150, 6000), 'boot did not settle');
  if (o.rmSpecies) h.type('#cRmSpecies', o.rmSpecies);
  if (o.rmName) h.type('#cRmName', o.rmName);
  if (o.rmGender) { h.$('#cRmGender').value = o.rmGender; h.$('#cRmGender').dispatchEvent(new h.window.Event('change')); }
  h.click('#cBegin');
  assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
  return h;
}
// The narrator's next replies carry these fields (h.say.stage = 'begin', h.say.time_advance_minutes = 45 ...).
function narratorSays(h) {
  h.say = {};
  h.mock.sampleHandler = (input, o, call) => {
    const out = h.mock.defaultHandler(input, o, call);
    if (!/^turn/.test(call.label)) return out;
    const r = JSON.parse(out); Object.assign(r, h.say); return JSON.stringify(r);
  };
}
const stateOf = (h) => onlyAdv(h.mock.store).data.state;
const sceneOf = (h) => { const s = stateOf(h).scene; return { n: s.n, stage: s.stage }; };
const lastStored = (h) => { const { id } = onlyAdv(h.mock.store); return storedTurns(h.mock.store, id).at(-1); };
// Whether a style example from the world's scene pool is in the prompt: the longest placeholder-free run of each is the signature.
const sceneExample = (h, p) => {
  const Wd = h.window.WINDLASS_WORLDS.sundered, pool = (Wd.sceneExemplars || []).concat((Wd.exemplars || []).filter((e) => e && e.scene === 'intimate').map((e) => e.text));
  const sigs = pool.map((e) => e.split(/\{[^}]*\}/).sort((a, b) => b.length - a.length)[0]);
  assert(sigs.length && sigs.every((s) => s.length > 20), 'the world has scene style examples');
  const ex = section(p, 'style_examples');
  return sigs.some((s) => ex.includes(s));
};

const S = {
  // 1. The plain words a player types for an act count as an intimate scene, not only "kiss", "make love" and "have sex": the
  // romance pacing line and the scene note reach the narrator. Ordinary sentences with the same letters, a sworn "fuck" and
  // "lick your lips" do not.
  async actWords() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      for (const a of ['Fuck her.', 'Keep fucking her until you finish inside her.', 'Play with your nipples and masturbate.', 'Suck her nipples.', 'Climb on top of her and ride her.',
        'Strip her slowly.', 'Take off her top.', 'Slide your cock into her.', 'Cum inside her.', 'Pick up the pace and thrust harder.', 'Engage in lovemaking.', 'Lick her pussy until she comes.',
        'Pick up the pace and jack hammer her pussy.', 'Let\'s have sex.', 'I have sex with her.', 'Make her orgasm with your mouth.', 'Go down on her.', 'Finger her slowly.', 'Rub her nipples.', 'Eat her out.', 'Bend her over the desk.']) {
        assert(await h.turn(a), a + ' did not finish');
        const p = promptOf(lastTurn(h));
        assert.match(p, /Romance scene pacing \(binding\)/, a + ' gets the romance pacing');
        assert.match(p, /Scene note \(binding\)/, a + ' gets the scene note');
      }
      assert(await h.turn('Take her hand', { director: 'engage in lovemaking' }), 'director turn did not finish');
      assert.match(promptOf(lastTurn(h)), /Scene note \(binding\)/, 'a director note that names the act is a scene on its own, with no "kiss" in the action');
      // A kiss, a date or a hug is romance, with the romance lines, but not yet an act with a stage. So is turning sex down, or
      // asking or talking about it: the engine never presumes consent.
      for (const a of ['I kiss Rin.', 'Kiss her again, slower.', 'I hug Rin.', 'Say: I do not want to have sex tonight.', 'I am not ready for sex yet, I tell her.',
        'Ask Rin about sexual customs on the Isle.', 'Tell her no sex until we know each other better.', 'I joke that she is sex on legs.', 'Ask Rin whether she has ever made love.']) {
        assert(await h.turn(a), a + ' did not finish');
        const p = promptOf(lastTurn(h));
        assert.match(p, /Romance scene pacing \(binding\)/, a + ' is romance');
        assert.doesNotMatch(p, /Scene note \(binding\)|"stage":/, a + ' is not yet an act with a stage');
      }
      for (const a of ['I look at the sextant.', 'I ride her bike to the Creamery.', 'Come inside, it is cold.', 'I lick the spoon clean.', 'I suck on a lemon.', 'I put the book on top of her piano.',
        'I fuel the stove.', 'I read about the cumin harvest.', 'I strip the bed.', 'I thrust the letter into my pocket.', 'I read the climax of the novel.', 'Look down at your own chest and see what she sees.',
        'What is happening, you say; as you get up to look in the mirror. The milk, and cum and on your body fueling the rapid changes.', 'I check how far the sex change has gone.',
        'Fuck, what is happening to my hands?', 'Ask May what the fuck she put in the milk.', 'Fuck me, that is a hoof.', 'Lick your lips and look at the bowl of milk.', 'You lick your fingers clean.',
        'Suck your thumb.', 'Lick her hand.', 'I suck air through my teeth.', 'I touch her ear.', 'Stroke her neck.', 'I tease her about the hat.', 'Pound on the door.']) {
        assert(await h.turn(a), a + ' did not finish');
        assert.doesNotMatch(promptOf(lastTurn(h)), /Romance scene pacing|Scene note \(binding\)/, a + ' is not an act');
      }
      clean(h);
    } finally { h.close(); }
  },

  // 2. A director note that names an act and no ending asks for its next stage, not the whole act: the prompt no longer says to
  // reach the act's ending, or to stop at the first choice after "carrying out" all of it; it says where to stop.
  async directorActIsOneStage() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      assert(await h.turn('Kiss her again, slower.', { director: 'engage in lovemaking' }));
      const p = promptOf(lastTurn(h)), act = section(p, 'action'), fmt = section(p, 'output_format');
      assert.match(act, /Director note \(binding\): engage in lovemaking/);
      assert.match(act, /Scene note \(binding\): turn 1 of this act\./, 'a first turn of the act');
      assert.match(act, /carry it one stage on, from where the story stands \(the stages run: undressing and first contact; entry and the first rhythm; a build: a change of position, pace or act\)/, 'the stages run from undressing to a build');
      assert.match(act, /then stop mid-act on the partner's next move or line/, 'the turn ends mid-act');
      assert.match(act, /No peak for \S+ and no aftermath unless the action itself reaches them/, 'the peak and aftermath belong to the action');
      assert.doesNotMatch(act, /reach its requested ending before stopping; if it gives no ending, stop at the first choice after carrying out its requested actions/,
        'the director line no longer reads an act as a task to finish');
      assert.match(act, /Carry out the binding director note; stop where the scene note says unless the note itself says how far this turn goes\./);
      assert.doesNotMatch(act, /long enough to carry out all compatible requested actions/, 'no length push on a scene turn');
      assert.match(act, /Treat its concrete actions, requested people, and ending as required for this turn/, 'the director note is still binding');
      assert.match(act, /overrides prior-scene momentum, default pacing, and the generic stop-at-choice instruction, but never world facts, established mechanics, or other rules/);
      assert.match(act, /do not fade out, cut away, imply, euphemize, summarize or skip the act/, 'and the act is still written on the page');
      assert.match(act, /write its peak and aftermath only when the action itself reaches or asks for them/, 'the peak and aftermath are the player\'s');
      assert.doesNotMatch(act, /fade to black|off-page/i, 'no off-page rule');
      assert.match(fmt, /"stage": begin\|enter\|build\|peak\|after\|none, chosen before the narrative: where it will end/, 'the stage is named before the narrative');
      assert(fmt.indexOf('"stage"') < fmt.indexOf('"narrative"'), 'the stage field comes before the narrative field');
      assert.match(fmt, /"narrative": string, at most \d+ words, second person present tense, ending where the scene note says/, 'the ending the format asks for is the scene note\'s');
      assert.match(fmt, /"suggested_actions": exactly three strings, 12 words or fewer each: three different next moves in the act as it stands/, 'the suggestions are next moves');
      assert.match(fmt, /from the second turn of an act, one may take it to its peak/, 'one of them may be the player\'s own peak');
      assert.doesNotMatch(fmt, /none stops it/, 'a pause or a word is still a move');
      // An ordinary turn keeps the ordinary text.
      assert(await h.turn('I look at the lake.'));
      const q = promptOf(lastTurn(h));
      assert.doesNotMatch(q, /Scene note \(binding\)|"stage":/);
      assert.match(section(q, 'output_format'), /plausible things \S+ would actually consider doing next/, 'ordinary suggestions are unchanged');
      assert.match(section(q, 'action'), /Stop at the first moment \S+ would speak or choose\./);
      // A director note that states its own scope sets this turn's ending.
      assert(await h.turn('Make love to her.', { director: 'Write the whole encounter through to the aftermath in this one turn.' }));
      const r = section(promptOf(lastTurn(h)), 'action');
      assert.match(r, /Scene note \(binding\): turn 1 of this act\. The action itself carries \S+ to the peak and what it names after/, 'a stated scope wins over the stage');
      assert.doesNotMatch(r, /No peak for/);
      clean(h);
    } finally { h.close(); }
  },

  // 3. The scene is remembered between turns: the narrator names the stage its turn ends at; the next turn (whose action has
  // none of the act words) gets the scene note, one stage further on, and the clock carries no countdown. An action that walks
  // away, or a reply with no stage, ends it.
  async sceneContinuesAcrossTurns() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.stage = 'begin';
      assert(await h.turn('Take her hand', { director: 'engage in lovemaking' }));
      assert.deepEqual(sceneOf(h), { n: 1, stage: 'begin' }, 'the engine counts the turn and keeps the stage');
      h.say.stage = 'enter';
      assert(await h.turn('Hold her hips and take the rhythm from her'));
      let p = promptOf(lastTurn(h)), act = section(p, 'action');
      assert.match(act, /Romance scene pacing \(binding\)/, 'a turn with none of the act words is still the scene');
      assert.match(act, /Scene note \(binding\): turn 2 of this act\. The last turn ended at undressing and first contact\./);
      assert.match(act, /carry it one stage on, to entry and the first rhythm/);
      assert.doesNotMatch(section(p, 'clock'), /Next:/, 'no countdown to the next event while the act is on');
      assert.deepEqual(sceneOf(h), { n: 2, stage: 'enter' });
      h.say.stage = 'build';
      assert(await h.turn('Roll her onto her back'));
      act = section(promptOf(lastTurn(h)), 'action');
      assert.match(act, /turn 3 of this act\. The last turn ended at entry/);
      assert.match(act, /carry it one stage on, to a build: a change of position, pace or act/);
      // Its band is the rich one while the scene is on, whatever the words.
      assert.match(act, new RegExp('Narrative length: at most ' + h.window.WINDLASS_WORLDS.sundered.wordBands.rich[1] + ' words'));
      // Verbs of the act that happen to open like leaving keep the scene.
      for (const a of ['Run your hands down her back.', 'Go down on her.', 'Stop teasing and take her.', 'Eat her out.']) {
        const n = sceneOf(h).n;
        assert(await h.turn(a));
        assert.match(section(promptOf(lastTurn(h)), 'action'), /Scene note \(binding\)/, a + ' is the scene going on');
        assert.equal(sceneOf(h).n, n + 1, a + ' counts as a turn of the act');
      }
      // Walking away ends it, even though the narrator still says "build".
      assert(await h.turn('I go down to the library.'));
      p = promptOf(lastTurn(h));
      assert.doesNotMatch(p, /Scene note \(binding\)/, 'an action that walks away is not the scene');
      assert.match(section(p, 'clock'), /Next:/, 'and the clock has its next event again');
      assert.deepEqual(sceneOf(h), { n: 0, stage: '' }, 'and the scene is over');
      // A reply with no stage carries nothing over.
      h.say.stage = 'build';
      assert(await h.turn('Make love to her.'));
      assert.equal(stateOf(h).scene.n, 1);
      delete h.say.stage;
      assert(await h.turn('Hold her hips.'));
      assert.deepEqual(sceneOf(h), { n: 0, stage: '' }, 'no stage, no scene');
      assert(await h.turn('I look out of the window.'));
      assert.doesNotMatch(promptOf(lastTurn(h)), /Scene note \(binding\)/);
      // "Stop" ends it too.
      h.say.stage = 'enter';
      assert(await h.turn('Make love to her.'));
      assert(await h.turn('Stop, and ask her what is wrong.'));
      assert.doesNotMatch(promptOf(lastTurn(h)), /Scene note \(binding\)/, 'a stop is not carried on as the act');
      assert.deepEqual(sceneOf(h), { n: 0, stage: '' });
      // So do a meal, a wash and going back to one's room.
      for (const a of ['Eat breakfast with her.', 'Shower, then get dressed.', 'Run back to my room.']) {
        h.say.stage = 'enter';
        assert(await h.turn('Make love to her.'));
        assert.equal(stateOf(h).scene.n, 1);
        assert(await h.turn(a));
        assert.doesNotMatch(promptOf(lastTurn(h)), /Scene note \(binding\)/, a + ' leaves the act');
        assert.deepEqual(sceneOf(h), { n: 0, stage: '' }, a + ' ends the scene');
      }
      clean(h);
    } finally { h.close(); }
  },

  // 4. Only the player's own action reaches the player's peak. An action that names it is written as given and stops on its last
  // beat; one that does not gets "no peak"; a narrator that runs on to the peak is noted; after a peak the next turn is the
  // aftermath only if the action asks, and its suggestions are ordinary ones.
  async peakIsThePlayersOwn() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.stage = 'enter';
      assert(await h.turn('Make love to her.'));
      let t = lastStored(h);
      assert.match(promptOf(lastTurn(h)), /No peak for \S+ and no aftermath unless the action itself reaches them/);
      // Holding the peak back is not asking for it, whatever word names it.
      h.say.stage = 'build';
      for (const a of ['Hold back your orgasm and keep going slowly.', 'Try not to finish inside her yet.', 'Don\'t cum inside her; pull out first.']) {
        assert(await h.turn(a));
        assert.match(section(promptOf(lastTurn(h)), 'action'), /No peak for \S+ and no aftermath unless the action itself reaches them/, a + ': holding back is not asking for the peak');
        assert.equal(stateOf(h).scene.stage, 'build', a + ': the act goes on');
      }
      // The partner's peak is a beat the action names like any other, not the player's.
      h.say.stage = 'build';
      assert(await h.turn('Lick her pussy until she comes.'));
      assert.match(section(promptOf(lastTurn(h)), 'action'), /No peak for \S+ and no aftermath unless the action itself reaches them/, 'her peak is not the player\'s');
      h.say.stage = 'peak';
      assert(await h.turn('Keep going, slowly.'));
      t = lastStored(h);
      assert(t.notes.some((n) => /the narrator ended this turn at the peak, which the action did not reach/.test(n)), 'a peak the action did not ask for is noted: ' + JSON.stringify(t.notes));
      h.say.stage = 'build';
      assert(await h.turn('Pick up the pace and keep fucking her until you finish inside her, then lie on top of her and kiss her.'));
      let p = promptOf(lastTurn(h)), act = section(p, 'action');
      assert.match(act, /The action itself carries \S+ to the peak and what it names after: write it as given, in order, in plain words, and stop on the last beat it names \(at most one line of the partner's answer\)/);
      assert.match(act, /Nothing after: no wrap-up, no talk, no time skip, no new act\. A change note below is told as a sensation inside the act, in a sentence\./);
      assert.doesNotMatch(act, /No peak for/, 'an action that names the peak is not told to hold it back');
      assert.doesNotMatch(act, /left for the next turn/, 'a change note is never deferred (the engine would not show it again)');
      assert.match(section(p, 'output_format'), /plausible things \S+ would actually consider doing next/, 'the suggestions after the peak are ordinary ones');
      h.say.stage = 'peak';
      assert(await h.turn('Pick up the pace and keep fucking her until you finish inside her.'));
      t = lastStored(h);
      assert(!t.notes.some((n) => /did not reach/.test(n)), 'a peak the action asked for is not noted');
      assert.equal(stateOf(h).scene.stage, 'peak');
      h.say.stage = 'after';
      assert(await h.turn('Stay where you are and hold her.'));
      p = promptOf(lastTurn(h));
      assert.match(section(p, 'action'), /The last turn ended on \S+'s peak\. Write what the action asks and no more: the aftermath only if it asks, no new act it does not name\./);
      assert.match(section(p, 'output_format'), /plausible things \S+ would actually consider doing next/, 'and so are the suggestions after it');
      // A regeneration note that names the peak counts as the player's own word too.
      h.say.stage = 'enter';
      assert(await h.turn('Make love to her.'));
      h.click('#regenWith'); h.$('#rewrite').value = 'Keep going until you finish inside her.'; h.click('#rewriteGo'); assert(await h.idle(15000));
      assert.match(section(promptOf(lastTurn(h)), 'action'), /Regeneration note \(binding, for this rewrite only; it says what to change from the version the player rejected\): Keep going until you finish inside her\./);
      assert.match(section(promptOf(lastTurn(h)), 'action'), /The action itself carries \S+ to the peak/, 'a regeneration note that names the peak is the player\'s word');
      clean(h);
    } finally { h.close(); }
  },

  // 5. A solo act is paced like any other, but its note speaks of the player's own body: no partner, nobody arrives.
  async soloAct() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.stage = 'begin';
      assert(await h.turn('Play with your nipples and masturbate.'));
      let act = section(promptOf(lastTurn(h)), 'action');
      assert.match(act, /Scene note \(binding\): turn 1 of this act\./);
      assert.match(act, /the stages run: undressing and the first touch; the first rhythm; a change of pace or touch/, 'solo stages');
      assert.match(act, /then stop mid-act on \S+'s next sensation or movement; nobody arrives and nothing interrupts\./);
      assert.doesNotMatch(act, /partner/, 'no partner is spoken of');
      assert.equal(stateOf(h).scene.solo, true);
      h.say.stage = 'enter';
      assert(await h.turn('Keep going, and milk yourself as your toes fuse.'));
      act = section(promptOf(lastTurn(h)), 'action');
      assert.match(act, /turn 2 of this act\. The last turn ended at undressing and the first touch\./);
      assert.match(act, /carry it one stage on, to the first rhythm/);
      assert.doesNotMatch(act, /partner/);
      // With a partner the ordinary stages come back.
      h.say.stage = 'begin';
      assert(await h.turn('I go to the window.'));
      assert(await h.turn('Make love to her.'));
      act = section(promptOf(lastTurn(h)), 'action');
      assert.match(act, /the stages run: undressing and first contact; entry and the first rhythm/);
      assert.equal(stateOf(h).scene.solo, false);
      clean(h);
    } finally { h.close(); }
  },

  // 6. The scene state is part of the saved state: Undo and Regenerate put it back with the rest, and a reload keeps it.
  async sceneStateIsUndoSafe() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    let store;
    try {
      narratorSays(h);
      h.say.stage = 'begin'; assert(await h.turn('Make love to her.'));
      h.say.stage = 'enter'; assert(await h.turn('Hold her hips.'));
      assert.deepEqual(sceneOf(h), { n: 2, stage: 'enter' });
      h.click('#regen'); assert(await h.idle(15000));
      assert.match(section(promptOf(lastTurn(h)), 'action'), /turn 2 of this act\. The last turn ended at undressing and first contact/, 'a regenerated turn is told the same scene note');
      assert.deepEqual(sceneOf(h), { n: 2, stage: 'enter' }, 'and counts once');
      h.click('#undo'); assert(await h.idle(15000));
      assert.deepEqual(sceneOf(h), { n: 1, stage: 'begin' }, 'Undo puts the stage back');
      h.say.stage = 'build'; assert(await h.turn('Roll her over.'));
      assert.match(section(promptOf(lastTurn(h)), 'action'), /turn 2 of this act\. The last turn ended at undressing and first contact/);
      store = h.mock.store;
      clean(h);
    } finally { h.close(); }
    const h2 = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h2.settle(150, 8000)); await h2.idle(10000);
      narratorSays(h2); h2.say.stage = 'build';
      assert(await h2.turn('Keep going.'));
      assert.match(section(promptOf(lastTurn(h2)), 'action'), /turn 3 of this act\. The last turn ended at a build/, 'a reload keeps the scene');
      clean(h2);
    } finally { h2.close(); }
  },

  // 7. An act under way takes minutes, and is recorded as going on: the engine cuts a long time advance on a turn that ends
  // mid-act, and tells the narrator to record the act as going on in beats, events and facts. Without a stage nothing changes.
  async actTakesMinutes() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.stage = 'begin'; h.say.time_advance_minutes = 45;
      assert(await h.turn('Make love to her.'));
      assert.match(section(promptOf(lastTurn(h)), 'action'), /Beats, events and facts say the act is going on, never done; the turn is 5 to 15 minutes\./);
      const t = lastStored(h), min = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
      assert.equal(min(t.stateAfter.time) - min(t.stateBefore.time), 20, 'the clock moved 20 minutes, not 45: ' + t.stateBefore.time + ' -> ' + t.stateAfter.time);
      assert(t.notes.some((n) => /time advance 45 cut to 20: the turn ends mid-act/.test(n)), JSON.stringify(t.notes));
      delete h.say.stage;
      assert(await h.turn('I sit at the desk and read.'));
      const u = lastStored(h);
      assert.equal(min(u.stateAfter.time) - min(u.stateBefore.time), 45, 'a turn with no stage keeps the narrator\'s own time');
      clean(h);
    } finally { h.close(); }
  },

  // 8. The style example for a scene turn is one of the world's intimate ones, and it is still the one example left when the
  // prompt sheds down to one; an ordinary turn never gets one.
  async sceneExemplar() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      for (let i = 0; i < 4; i++) {
        assert(await h.turn('Make love to her.'));
        assert(sceneExample(h, promptOf(lastTurn(h))), 'a scene turn carries an intimate style example');
      }
      assert(await h.turn('I walk the long way round. ' + 'The path winds past the Creamery and on along the old wall by the river, and I take it slowly. '.repeat(200) + ' Then I make love to her.'));
      const t = lastStored(h);
      assert(t.notes.some((n) => /one style example/.test(n)), 'the prompt shed to one style example: ' + JSON.stringify(t.notes.filter((n) => /size cap/.test(n))));
      assert(sceneExample(h, promptOf(lastTurn(h))), 'and the one left is the intimate one');
      for (let i = 0; i < 6; i++) { assert(await h.turn('I look at the lake.')); assert(!sceneExample(h, promptOf(lastTurn(h))), 'an ordinary turn has no intimate example'); }
      clean(h);
    } finally { h.close(); }
  },

  // 9. The world's Romance pacing rule says an act runs over several turns and that the peak and aftermath are the player's.
  async romancePacingRule() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      assert(await h.turn('I look at the lake.'));
      const rules = section(promptOf(lastTurn(h)), 'rules');
      assert.match(rules, /An intimate act runs over several turns, one stage a turn, each ending mid-act; \S+'s peak and the aftermath come only when the player's own action reaches or asks for them\./);
      assert.match(rules, /Never decide the player's desire, feelings, consent or next action\./);
      clean(h);
    } finally { h.close(); }
  },

  // 10. The engine's note about a waiting NPC bid does not cut into a scene.
  async noInitiativeInAScene() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      let seen = false, skipped = false;
      for (let i = 0; i < 6; i++) {
        h.say.stage = i % 2 ? 'enter' : 'begin';
        assert(await h.turn(i === 0 ? 'Make love to her.' : 'Hold her hips.'));
        const act = section(promptOf(lastTurn(h)), 'action');
        assert.doesNotMatch(act, /NPC initiative window/, 'turn ' + (i + 1) + ': no initiative window in a scene');
        skipped = true;
      }
      delete h.say.stage;
      for (let i = 0; i < 3; i++) { assert(await h.turn('I sit at the desk.')); if (/NPC initiative window/.test(section(promptOf(lastTurn(h)), 'action'))) seen = true; }
      assert(seen && skipped, 'an ordinary turn still gets its initiative window every third turn');
      clean(h);
    } finally { h.close(); }
  },

  // 11. The length line is one sentence after another: the rich-scene clause no longer runs on from the one before it.
  async lengthLineReads() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      assert(await h.turn('I kiss Rin.'));
      const act = section(promptOf(lastTurn(h)), 'action');
      assert.match(act, /sooner\. If romance or a bodily change is central/, 'a full stop before the rich-scene sentence');
      assert.doesNotMatch(act, /sooner If romance/);
      clean(h);
    } finally { h.close(); }
  },

  // 11b. A director note that skips time or moves on ends the act as the action would: no "stop mid-act" and no scene carried over,
  // even beside an act word, and the skip is not read as the player's peak. A skip turned down, a cut to the act, or a writing note
  // ends nothing.
  async directorSkipLeaves() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h); h.say.stage = 'build';
      for (const [a, d] of [['Kiss her.', 'Skip to the next morning.'], ['Make love to her.', 'Then jump ahead to breakfast.'], ['Hold her.', 'Go back to the dorm.'], ['Kiss her neck.', 'They get dressed and leave.']]) {
        assert(await h.turn('Make love to her.', { director: '' }));
        assert(await h.turn('Make love to her.', { director: '' })); assert.equal(sceneOf(h).n, 2, 'the act is under way');
        assert(await h.turn(a, { director: d }));
        const p = promptOf(lastTurn(h));
        assert.doesNotMatch(p, /stop mid-act|Scene note \(binding\)/, d + ' is not held mid-act');
        assert.doesNotMatch(p, /carries \S+ to the peak/, d + ' is not read as the peak');
        assert.deepEqual(sceneOf(h), { n: 0, stage: '' }, d + ' ends the scene');
      }
      assert(await h.turn('Make love to her.', { director: 'Take it slowly.' })); assert.match(promptOf(lastTurn(h)), /stop mid-act/, 'a director note that stays in the act keeps it');
      // Not a time skip: one turned down, a cut to the act itself, or a clause that asks for the act. The act goes on a turn.
      // Nor is a note about the writing: only the player's action walks away by a stop, a wake or a dress.
      for (const d of ['Don\'t skip ahead; stay in the moment.', 'Do not cut to the next morning.', 'No fast-forward, take it slowly.', 'Skip to the part where they have sex.', 'Cut to them in bed together.', 'Later that night they make love.',
        'Stop here.', 'Enough euphemism; use plain words.', 'Pull back the narration and keep it close.', 'Wake her slowly with kisses.', 'Leave her wanting more.']) {
        const n = sceneOf(h).n; assert(n > 0, 'the act is under way before: ' + d);
        assert(await h.turn(/^(?:Stop|Enough|Pull|Wake|Leave)/.test(d) ? 'Kiss her neck.' : 'Kiss her and keep going.', { director: d }));
        assert.match(promptOf(lastTurn(h)), /Scene note \(binding\): turn \d+ of this act[^\n]*stop mid-act/, d + ' keeps the act');
        assert.equal(sceneOf(h).n, n + 1, d + ' carries the act on a turn');
      }
      assert(await h.turn('Take her to bed.', { director: 'Skip to the bedroom.' })); assert.match(promptOf(lastTurn(h)), /Scene note \(binding\)/, 'a cut to the bedroom is not a time skip');
      const n = sceneOf(h).n; h.click('#regenWith'); h.$('#rewrite').value = 'Stop here, on her plea.'; h.click('#rewriteGo'); assert(await h.idle(15000));
      assert.match(promptOf(lastTurn(h)), /Regeneration note[^\n]*Stop here, on her plea\.[\s\S]*stop mid-act|stop mid-act[\s\S]*Regeneration note[^\n]*Stop here, on her plea\./, 'a regeneration note about where to stop keeps the act');
      assert.equal(sceneOf(h).n, n, 'the regenerated turn stands where the one it replaces stood');
      clean(h);
    } finally { h.close(); }
  },

  // 12. The scene examples presume no anatomy (neither body enters the other; no genital named) and agree with a non-binary
  // roommate's "they": every scene example reaches the prompt in turn, none reads "They undoes" or "they says", and the bovine
  // example is not shown when no bovine is present.
  async sceneExemplarAgrees() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi', rmGender: 'nonbinary' });
    try {
      const Wd = h.window.WINDLASS_WORLDS.sundered;
      for (const e of Wd.sceneExemplars) assert.doesNotMatch(e, /\byou in\b|part way|the rest of the way|\binside\b|\b(cock|pussy|penis|vagina|clit)/i, 'a scene example presumes a body: ' + e.slice(0, 80));
      // Each ends by handing the next move to the player: its last line is the partner's question or invitation, with nothing after
      // it but who says it (no order the partner holds the player to, no move made for the player).
      for (const e of Wd.sceneExemplars) {
        const q = (e.match(/"[^"]*"/g) || []).at(-1) || '', after = e.slice(e.lastIndexOf('"') + 1);
        assert.match(q, /\?"$|tell me what you want/i, 'a scene example ends on a question or an invitation to the player: ' + e.slice(-120));
        assert.match(after, /^(?:\s*\{rm_they\} [^.!?",]*(?:, and wait\{rm_s\})?\.)?$/, 'nothing follows the last line but who says it: ' + e.slice(-120));
      }
      const seen = new Set(); let kinded = false;
      for (let i = 0; i < 6; i++) {
        assert(await h.turn('Make love to Rin.'));
        const ex = section(promptOf(lastTurn(h)), 'style_examples');
        assert.doesNotMatch(ex, /\b[Tt]hey (undoes|guides|says|lifts|rolls|settles|breathes|stops|finds)\b/, 'a scene example does not agree with "they": ' + ex.slice(0, 300));
        Wd.sceneExemplars.forEach((e, k) => { if (ex.includes(e.split(/\{[^}]*\}/).sort((a, b) => b.length - a.length)[0])) seen.add(k); });
        kinded = kinded || Wd.exemplars.some((e) => e.kind && ex.includes(e.text.slice(0, 60)));
      }
      assert.equal(seen.size, Wd.sceneExemplars.length, 'every scene example was checked: ' + [...seen]);
      assert(!kinded, 'an example tagged with a kind nobody present has (a bovine woman\'s udder and hooves) is not shown in a human roommate\'s scene');
      clean(h);
    } finally { h.close(); }
  },

  // 12b. The bovine woman's example (her udder, teats and the rest) is shown with a bovine woman present and never with a bovine man,
  // whose body it would hand the narrator in his scene.
  async kindExampleMatchesSex() {
    for (const [g, want] of [['female', true], ['male', false]]) {
      const h = await begin({ rmSpecies: 'cow', rmName: 'Rin Kitsuragi', rmGender: g });
      try {
        const cow = h.window.WINDLASS_WORLDS.sundered.exemplars.find((e) => e.kind === 'cow'); assert(cow && cow.sex === 'female', 'the bovine example is tagged a woman\'s');
        let seen = false;
        for (let i = 0; i < 4; i++) { assert(await h.turn('Make love to Rin.')); seen = seen || section(promptOf(lastTurn(h)), 'style_examples').includes(cow.text.slice(0, 60)); }
        assert.equal(seen, want, 'the bovine woman\'s example with a ' + g + ' bovine roommate');
        clean(h);
      } finally { h.close(); }
    }
  },
};

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(S);
  let failed = 0;
  for (const n of names) {
    const before = unhandled;
    try {
      if (!S[n]) throw new Error('no such scenario');
      await S[n](); await new Promise((r) => setTimeout(r, 50));
      assert.equal(unhandled - before, 0, 'unhandled promise rejections during the scenario');
      console.log('PASS', n);
    } catch (e) { failed += 1; console.log('FAIL', n, '-', String((e && e.message) || e).split('\n')[0].slice(0, 300)); if (process.env.AUDIT_STACK) console.log(e && e.stack); }
  }
  if (failed) { console.error('PACING SCENES FAILED: ' + failed + ' of ' + names.length + ' scenarios'); process.exit(1); }
  console.log('pacing scenes passed: ' + names.length + ' scenarios');
  process.exit(0);
})();
