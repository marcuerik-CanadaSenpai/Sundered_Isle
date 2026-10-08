'use strict';
// Regressions for conversations paced across turns (npm run talk-scenes). One scenario per behaviour; each fails on the build
// before talk scenes and passes on the build with them. Run one by name: node talk-scenes.js talkContinuesAcrossTurns
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node talk-scenes.js
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
const talkOf = (h) => (stateOf(h).talk || { n: 0 }).n;
const lastStored = (h) => { const { id } = onlyAdv(h.mock.store); return storedTurns(h.mock.store, id).at(-1); };
const min = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
const TALK = /Talk note \(binding\)/;
// The talk note gives the player's stated words and the other person's answer and nothing more: the narrator never writes a second
// line for the player (CLAUDE.md: never decide the player's actions), and the turn ends on the other person's line.
function assertAgency(act, a) {
  const note = (act.match(/Talk note \(binding\)[^\n]*/) || [''])[0];
  assert.match(note, /(\S+)'s stated words and the other person's answer/, a + ': the note names the words given and the answer');
  assert.match(note, /\S+ says nothing the action does not give/, a + ': the note forbids words the action does not give');
  assert.match(note, /End on the other person's line or a pause, before \S+ answers/, a + ': the note ends on the other person');
  assert.doesNotMatch(note, /\btwo\b|exchanges/, a + ': no second exchange, which would need words the player did not give');
}

const S = {
  // 1. An action that is speech, with someone here, is a talk turn: the narrator is told to write the player's stated words and
  // the other person's answer and end on that line, with no words the action does not give; the band is the short one unless the action is long;
  // the suggestions are things to say next and the "talk" field comes before the narrative. Nobody here, no speech, no words or a second act after them: no talk.
  async talkTurnGetsNoteAndBand() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      const bands = h.window.WINDLASS_WORLDS.sundered.wordBands;
      // The first turn after creation keeps its band whatever it says (the opening's own suggestions are talk), so the talk turns start on the second.
      assert(await h.turn('I unpack my bag.'), 'the opening turn did not finish');
      for (const a of ['Say: Where did you grow up?', '"Do you ever miss home?" I ask quietly.', 'Ask Rin what she studies.', 'Tell her about my sister.', 'Answer her honestly.',
        'Say: Come and sit with me.', 'Say: Sit down. Drink this.', 'Say: I am tired. I want to go home.']) {
        assert(await h.turn(a), a + ' did not finish');
        const p = promptOf(lastTurn(h)), act = section(p, 'action'), fmt = section(p, 'output_format');
        assert.match(act, /Talk note \(binding\): turn 1 of this conversation\./, a + ' gets the talk note');
        assertAgency(act, a);
        assert.match(act, new RegExp('Narrative length: at most ' + bands.terse[1] + ' words'), a + ' takes the short band');
        assert.doesNotMatch(act, /NPC initiative window/, a + ': the talk is the focus');
        assert.match(act, /Narrative length: at most \d+ words\.\n/, a + ': the length line sets no word floor, which would pad the turn past the words given, and leaves the ending to the talk note');
        assert.doesNotMatch(act, /reaches a choice sooner|Stop at the first moment|when the scene earns it|\d+ to \d+ words|words; \d+ to \d+/);
        assert.match(fmt, /"narrative": string, at most \d+ words, second person present tense, ending where the talk note says/);
        assert.match(fmt, /"talk": true\|false, chosen before the narrative/, a + ' asks whether the talk goes on');
        assert(fmt.indexOf('"talk"') < fmt.indexOf('"narrative"'), 'the talk field comes before the narrative field');
        assert.match(fmt, /"suggested_actions": exactly three strings, 12 words or fewer each: three different things \S+ would say or ask next, in character \(<player>\), to the people here where the narrative ends/, a + ': the suggestions are things to say, in character, to the people here');
        assert.doesNotMatch(p, /Scene note \(binding\)|"stage":/, a + ' is not an act');
      }
      // A long action gets the ordinary band.
      assert(await h.turn('Say: I grew up on a farm past the ridge, with two brothers and a dog that never once came when it was called, and I left because the harvest failed twice and my father said there was nothing left to stay for.'));
      assert.match(section(promptOf(lastTurn(h)), 'action'), new RegExp('Narrative length: at most ' + bands.standard[1] + ' words'), 'a long action takes the standard band');
      // An action that is not speech is an ordinary turn.
      for (const a of ['I look at the lake.', 'I sit at the desk and read.', 'I pick up the "Lake Survey" pamphlet and read the first page about the tides.']) {
        assert(await h.turn(a), a + ' did not finish');
        const p = promptOf(lastTurn(h));
        assert.doesNotMatch(p, TALK, a + ' is no talk');
        assert.doesNotMatch(section(p, 'output_format'), /"talk":/);
        assert.match(section(p, 'output_format'), /plausible things \S+ would actually consider doing next/, a + ' keeps the ordinary suggestions');
      }
      // Saying nothing, answering a door, or words with a second act after them ("Say yes, and let her ...") is no talk turn.
      for (const a of ['Say nothing.', 'Answer the door.', 'Say nothing, and let yourself go to sleep against her.', 'Say yes, and let her take the ache out.',
        'Tell her about the lump at the base of my spine. try bending toes and fingers', "Tell her she doesn't have to hurry; we'll be late together. drink deeply and smile at her", 'Say goodbye and go to class.', '"Hi," I say, and sit down at the desk.',
        'Say: I love you. Then I kiss her.', 'Say: Goodnight, and kiss her.', 'Say: See you tomorrow. Then I pick up my bag.', 'Say: Fine, and hand her the cup.',
        'Say: Bye. I leave.', 'Say: Bye. I head home.', 'Say: See you tomorrow. I pick up my bag.', 'Say: Fine. I hand her the cup.', 'Say: Fine and hand her the cup.', 'Say: Goodnight, and I kiss you.', 'Say: Goodnight, and wrap your arms around her.']) {
        assert(await h.turn(a), a + ' did not finish');
        assert.doesNotMatch(promptOf(lastTurn(h)), TALK, a + ' is no talk turn');
      }
      // Nobody here to talk to.
      narratorSays(h);
      h.say.state_updates = [{ key: 'present', op: 'set', value: [stateOf(h).present[0]] }];
      assert(await h.turn('I walk to the window.'));
      delete h.say.state_updates;
      assert.equal(stateOf(h).present.length, 1, 'only the player is here');
      assert(await h.turn('Say: Hello? Is anyone there?'));
      assert.doesNotMatch(promptOf(lastTurn(h)), TALK, 'talking to an empty room is no conversation');
      clean(h);
    } finally { h.close(); }
  },

  // 2. The talk stays open across turns: the narrator says whether it is still going; the next turn (speech, or a short move with no
  // other business in it) carries it on; the clock moves by minutes while it lasts. A narrator that says it is over ends it.
  async talkContinuesAcrossTurns() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.talk = true; h.say.time_advance_minutes = 45;
      assert(await h.turn('Say: Where did you grow up?'));
      assert.equal(talkOf(h), 1, 'the engine counts the talk turn');
      const t = lastStored(h);
      assert.equal(min(t.stateAfter.time) - min(t.stateBefore.time), 10, 'the clock moved 10 minutes, not 45: ' + t.stateBefore.time + ' -> ' + t.stateAfter.time);
      assert(t.notes.some((n) => /time advance 45 cut to 10: the talk goes on/.test(n)), JSON.stringify(t.notes));
      assert(await h.turn('I pour her more tea.'));
      const act = section(promptOf(lastTurn(h)), 'action');
      assert.match(act, /Talk note \(binding\): turn 2 of this conversation, carried on from its last line\./, 'a short move with no other business carries the talk on');
      assertAgency(act, 'I pour her more tea.');
      assert.equal(talkOf(h), 2);
      h.say.talk = false;
      assert(await h.turn('Nod and wait.'));
      assert.match(section(promptOf(lastTurn(h)), 'action'), /turn 3 of this conversation/);
      assert.equal(talkOf(h), 0, 'the narrator says the talk is over, and it is');
      assert(lastStored(h).notes.includes('talk: ended'));
      assert(await h.turn('I pour more tea.'));
      assert.doesNotMatch(promptOf(lastTurn(h)), TALK, 'no talk once it is over');
      // A reply with no talk field carries nothing over either.
      delete h.say.talk;
      assert(await h.turn('Say: More tea?'));
      assert.equal(talkOf(h), 0, 'no field, no talk carried over');
      assert(await h.turn('I pour more tea.'));
      assert.doesNotMatch(promptOf(lastTurn(h)), TALK);
      clean(h);
    } finally { h.close(); }
  },

  // 3. Walking away ends the talk, even though the narrator still says it is going.
  async leaveEndsTalk() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.talk = true;
      for (const a of ['I go down to the library.', 'Leave the room.', 'Stop.']) {
        assert(await h.turn('Say: Tell me about the Isle.'));
        assert.equal(talkOf(h), 1, 'the talk is open before: ' + a);
        assert(await h.turn(a));
        assert.doesNotMatch(promptOf(lastTurn(h)), TALK, a + ' is not the talk going on');
        assert.equal(talkOf(h), 0, a + ' ends the talk');
        // Back with Rin for the next round.
        h.say.talk = false; h.say.state_updates = [{ key: 'present', op: 'set', value: stateOf(h).present.concat(['Rin Kitsuragi']) }];
        assert(await h.turn('I find Rin again.'));
        delete h.say.state_updates; h.say.talk = true;
      }
      clean(h);
    } finally { h.close(); }
  },

  // 4. An act takes precedence over talk: an act word in a talk (even in a "Say:" line) is the act, with the scene note and the
  // stage, and no talk note; the talk is over once the act begins.
  async actTakesPrecedence() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.talk = true;
      for (const a of ['Make love to her.', 'Say: Come here. Then strip her slowly.']) {
        assert(await h.turn('Say: I have wanted you all evening.'));
        assert.equal(talkOf(h), 1, 'the talk is open before: ' + a);
        h.say.stage = 'begin';
        assert(await h.turn(a));
        const p = promptOf(lastTurn(h)), act = section(p, 'action'), fmt = section(p, 'output_format');
        assert.match(act, /Scene note \(binding\)/, a + ' is the act');
        assert.doesNotMatch(act, TALK, a + ' gets no talk note');
        assert.match(fmt, /"stage": begin/);
        assert.doesNotMatch(fmt, /"talk":/);
        assert.match(fmt, /three different next moves in the act as it stands/, 'the suggestions are moves in the act');
        assert.equal(talkOf(h), 0, 'the talk ended where the act began');
        delete h.say.stage;
        assert(await h.turn('I get up.'));
      }
      // A turn in the run of an act, with words in quotes, is still the act.
      h.say.stage = 'enter';
      assert(await h.turn('Make love to her.'));
      assert(await h.turn('"Slower," I whisper.'));
      const act = section(promptOf(lastTurn(h)), 'action');
      assert.match(act, /Scene note \(binding\): turn 2 of this act/);
      assert.doesNotMatch(act, TALK);
      clean(h);
    } finally { h.close(); }
  },

  // 5. A kiss or a touch in the middle of a talk leaves the talk, so the romance lines apply untouched (CLAUDE.md): no talk
  // note, no talk field, no talk suggestions, the rich band, and the talk is over after it.
  async kissDuringTalk() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      const bands = h.window.WINDLASS_WORLDS.sundered.wordBands;
      narratorSays(h);
      h.say.talk = true;
      for (const a of ['Kiss her softly.', 'I kiss her.', 'I pull her close and kiss her.', '"I\'m sorry," I say, and kiss her.', 'Say: I love you. Then I kiss her.', 'Say: Goodnight, and kiss her.']) {
        assert(await h.turn('Say: I am glad you are my roommate.'));
        assert.equal(talkOf(h), 1, 'the talk is open before: ' + a);
        assert(await h.turn(a), a + ' did not finish');
        const p = promptOf(lastTurn(h)), act = section(p, 'action'), fmt = section(p, 'output_format');
        assert.match(act, /Romance scene pacing \(binding\)/, a + ': the romance lines stay');
        assert.match(act, /Consensual adult sex may be depicted on-page when requested/);
        assert.match(act, /Body detail \(binding\)/);
        assert.doesNotMatch(act, TALK, a + ' leaves the talk');
        assert.doesNotMatch(fmt, /"talk":|would say or ask next/, a + ': no talk field and no talk suggestions');
        assert.match(act, new RegExp('Narrative length: ' + bands.rich.join(' to ') + ' words, and up to ' + h.window.WINDLASS_WORLDS.sundered.wordRoom.rich + ' words when the scene needs it'), a + ' takes the rich band and its room');
        assert.doesNotMatch(act, /Scene note \(binding\)/, 'a kiss is not yet an act');
        assert.doesNotMatch(act, /fade to black|off-page/i);
        assert.equal(talkOf(h), 0, a + ' ends the talk');
      }
      clean(h);
    } finally { h.close(); }
  },

  // 6. A talk carries on only while the turn is still talk: fighting, sleeping, searching, reading, waiting the day out, saying
  // nothing, answering the door, undressing, a hand on someone, a blow, a lock, a window, getting up or storming out ends it, with
  // no talk note on that turn, even when the narrator still says it is going.
  async otherBusinessEndsTalk() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.talk = true;
      for (const a of ['I draw my sword and check the corridor.', 'I fall asleep.', 'I wait until evening.', 'I search the desk drawers.', 'I read the letter.', 'Say nothing.', 'Answer the door.', 'Say yes, and let her take the ache out.',
        'I take off my shirt.', 'I slip my hand under her shirt.', 'I hit him.', 'I pick the lock.', 'I sneak out the window.', 'I check the window.', 'I get up to leave.', 'I storm out.', 'I stalk off.', 'I rush out.',
        'Say: See you tomorrow. Then I pick up my bag.', 'Say: Fine, and hand her the cup.',
        'Say: Bye. I leave.', 'Say: Bye. I head home.', 'Say: See you tomorrow. I pick up my bag.', 'Say: Fine. I hand her the cup.', 'Say: Fine and hand her the cup.', 'Say: Goodnight, and I kiss you.', 'Say: Goodnight, and wrap your arms around her.']) {
        assert(await h.turn('Say: Where did you grow up?'));
        assert.equal(talkOf(h), 1, 'the talk is open before: ' + a);
        assert(await h.turn(a), a + ' did not finish');
        const p = promptOf(lastTurn(h));
        assert.doesNotMatch(p, TALK, a + ' does not carry the talk on');
        assert.doesNotMatch(section(p, 'output_format'), /"talk":/, a + ': no talk field');
        assert.equal(talkOf(h), 0, a + ' ends the talk');
      }
      clean(h);
    } finally { h.close(); }
  },

  // 7. A director note wins over the talk: no talk note, the director line's own ending, the clock not held to minutes, and the
  // talk is over after it.
  async directorNoteWinsOverTalk() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.talk = true; h.say.time_advance_minutes = 45;
      assert(await h.turn('Say: Where did you grow up?'));
      assert.equal(talkOf(h), 1);
      assert(await h.turn('Say: Will you come to the festival with me?', { director: 'She agrees, they say goodnight and part for the night.' }));
      const p = promptOf(lastTurn(h)), act = section(p, 'action');
      assert.doesNotMatch(act, TALK, 'a director note turn gets no talk note');
      assert.match(act, /Carry out the binding director note and reach its requested ending before stopping/);
      assert.doesNotMatch(section(p, 'output_format'), /"talk":/);
      const t = lastStored(h);
      assert(!t.notes.some((n) => /cut to 10: the talk goes on/.test(n)), 'the talk does not hold the clock: ' + JSON.stringify(t.notes));
      assert.equal(talkOf(h), 0, 'the talk is over after a director note');
      // A first talk turn with a director note is no talk turn either.
      assert(await h.turn('Ask Rin what she studies.', { director: 'She answers at length and then leaves for class.' }));
      assert.doesNotMatch(promptOf(lastTurn(h)), TALK);
      clean(h);
    } finally { h.close(); }
  },

  // 8. The talk ends once nobody else is here, even when the narrator still says it is going.
  async talkEndsWhenAlone() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      narratorSays(h);
      h.say.talk = true;
      assert(await h.turn('Say: Where did you grow up?'));
      assert.equal(talkOf(h), 1);
      h.say.state_updates = [{ key: 'present', op: 'set', value: [stateOf(h).present[0]] }];
      assert(await h.turn('Say: Wait, where are you going?'));
      delete h.say.state_updates;
      assert.equal(stateOf(h).present.length, 1, 'only the player is here');
      assert.equal(talkOf(h), 0, 'the talk ends when the other person has gone');
      assert(lastStored(h).notes.includes('talk: ended'));
      assert(await h.turn('I pour more tea.'));
      assert.doesNotMatch(promptOf(lastTurn(h)), TALK, 'no talk in an empty room');
      clean(h);
    } finally { h.close(); }
  },

  // 9. A talk turn runs one step below the player's density setting, not always terse: rich gives standard.
  async talkDensityStepBelowSetting() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      const bands = h.window.WINDLASS_WORLDS.sundered.wordBands;
      h.click('#btnSettings'); h.$('#setDensity').value = 'rich'; h.$('#setDensity').dispatchEvent(new h.window.Event('change')); assert(await h.idle(8000));
      assert.match(h.$('#setDensityNote').textContent, /a short exchange of talk a step below the setting/i, 'the Settings note says so');
      assert(await h.turn('I unpack my bag.'), 'the opening turn did not finish');   // the first turn after creation is never stepped down
      assert(await h.turn('Say: Where did you grow up?'));
      const act = section(promptOf(lastTurn(h)), 'action');
      assert.match(act, TALK);
      assert.match(act, new RegExp('Narrative length: at most ' + bands.standard[1] + ' words'), 'rich gives a talk turn the standard band');
      h.$('#setDensity').value = 'terse'; h.$('#setDensity').dispatchEvent(new h.window.Event('change')); assert(await h.idle(8000));
      assert(await h.turn('Say: I grew up on a farm past the ridge, with two brothers and a dog that never once came when it was called, and I left because the harvest failed twice and my father said there was nothing left to stay for.'));
      assert.match(section(promptOf(lastTurn(h)), 'action'), new RegExp('Narrative length: at most ' + bands.terse[1] + ' words'), 'a long speech never rises above terse');
      clean(h);
    } finally { h.close(); }
  },

  // 10. A change on the page wins over the talk: the turn is rich and gets no talk note, so the change has room.
  async changeNoteWinsOverTalk() {
    const h0 = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    const store = h0.mock.store; let id;
    try { assert(await h0.turn('I sit at the desk.')); id = onlyAdv(store).id; } finally { h0.close(); }
    const doc = store.get('adventures/' + id).data;
    doc.state.talk = { n: 1 };
    doc.pendingNotes = ['The change continues: a warm ache spreads along the forearms as the skin there tightens.'];
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 6000));
      assert(await h.turn('Say: Does my arm look strange to you?'));
      const act = section(promptOf(lastTurn(h)), 'action');
      assert.match(act, /The change continues/, 'the change note is in the prompt');
      assert.doesNotMatch(act, TALK, 'a change on the page gets no talk note');
      clean(h);
    } finally { h.close(); }
  },

  // A consent-first ask in plain act words ("Ask Rin if I may touch her breasts") is romance, not a talk turn: the romance pacing
  // and body detail lines, the rich band and no talk note, with no scene note or stage (consent is never presumed). A plain
  // question stays a talk turn.
  async consentAskIsRomanceNotTalk() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      const bands = h.window.WINDLASS_WORLDS.sundered.wordBands;
      for (const a of ['Ask Rin if I may touch her breasts.', 'I ask Rin if I can touch her breasts.', 'Ask her whether I can suck her nipples.', 'Say: May I touch your breasts?', '"Can I touch your breasts?" I ask.']) {
        assert(await h.turn(a), a + ' did not finish');
        const p = promptOf(lastTurn(h)), act = section(p, 'action');
        assert.doesNotMatch(act, TALK, a + ' is no talk turn');
        assert.match(act, /Romance scene pacing \(binding\)/, a + ' is romance');
        assert.match(act, /Body detail \(binding\)/, a + ' gets the body detail line');
        assert.match(act, new RegExp('Narrative length: ' + bands.rich.join(' to ') + ' words, and up to ' + h.window.WINDLASS_WORLDS.sundered.wordRoom.rich + ' words when the scene needs it'), a + ' takes the rich band and its room');
        assert.doesNotMatch(p, /Scene note \(binding\)|"stage":/, a + ' is not the act');
      }
      assert(await h.turn('Ask Rin what she studies.'));
      assert.match(section(promptOf(lastTurn(h)), 'action'), TALK, 'a plain question is still a talk turn');
      clean(h);
    } finally { h.close(); }
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
  if (failed) { console.error('TALK SCENES FAILED: ' + failed + ' of ' + names.length + ' scenarios'); process.exit(1); }
  console.log('talk scenes passed: ' + names.length + ' scenarios');
  process.exit(0);
})();
