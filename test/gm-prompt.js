'use strict';
// The game-master parts of the turn prompt: <gm_only>, <skills> and <world> stay small in an ordinary scene and grow, whole, when
// the scene needs them. Run one scenario by name: node gm-prompt.js closedPlaces
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node gm-prompt.js
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { boot } = require('./boot');

let unhandled = 0; process.on('unhandledRejection', () => { unhandled += 1; });
const bytes = (s) => Buffer.byteLength(s, 'utf8');
const turnCalls = (h) => h.mock.sampleCalls.filter((c) => /^turn/.test(c.label));
const promptOf = (c) => (Array.isArray(c.input) ? c.input.map((m) => m.content).join('\n') : String(c.input));
const sec = (p, tag) => { const m = p.match(new RegExp('\\n<' + tag + '[ >][\\s\\S]*?\\n</' + tag + '>')); assert(m, '<' + tag + '> is in the prompt'); return m[0]; };
const loadWorld = () => { const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(process.env.WL_WORLDS || path.join(__dirname, '..', 'windlass', 'worlds'), 'sundered.js'), 'utf8'), ctx); return ctx.window.WINDLASS_WORLDS.sundered; };
const PLACES = ['Wrath', 'Pride', 'Envy', 'Greed', 'Lust', 'Gluttony', 'Sloth'];
const placeLine = (gm, sin) => (gm.match(new RegExp('^- ' + sin + ' \\(key [a-z]+\\)[^\\n]*', 'm')) || [''])[0];

async function begin(setup) {
  const h = await boot({ setup });
  assert(await h.settle(150, 6000), 'boot did not settle');
  h.type('#cName', 'Owen Pryce');
  h.click('#cBegin');
  assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
  return h;
}
function patchTurns(h, patch) {
  h.mock.sampleHandler = (input, o, call) => {
    const out = h.mock.defaultHandler(input, o, call);
    if (!/^turn/.test(call.label)) return out;
    const r = JSON.parse(out); patch(r); return JSON.stringify(r);
  };
}
async function play(h, action) { assert(await h.turn(action), 'turn: ' + action); return promptOf(turnCalls(h).at(-1)); }

const S = {
  // 1. The seven closed places are one line each until one is found or its keywords are in play: a quiet scene lists all seven by
  // place and holds gm_only under 2,500 bytes; the action naming a place's keywords (a pantry, the bell) brings that place whole,
  // with how it opens; a place found brings its trial and guardian; the story naming the trapdoor keeps the bell cellar whole on
  // a neutral action, while a bare mention of the tower in the story does not bring the doorless tower.
  async closedPlaces() {
    const h = await begin();
    try {
      let p = await play(h, 'I look around the room.'); let gm = sec(p, 'gm_only');
      for (const s of PLACES) assert(placeLine(gm, s), s + ' is listed in a quiet scene: ' + gm.slice(-900));
      assert(!/\bOpens /.test(gm) && !/Inside:|Guardian:/.test(gm), 'a quiet scene sends no place\'s way of opening: ' + (gm.match(/Opens [^\n]{0,80}/) || [''])[0]);
      assert(bytes(gm) <= 2500, 'gm_only in a quiet scene is at most 2,500 bytes, was ' + bytes(gm));
      assert(/the closed places answer/.test(gm) && /Dean .* alone knows all of this/.test(gm), 'the humanity line and the keeper are kept');
      p = await play(h, 'I ask the cook about the pantry and the cold room behind it.'); gm = sec(p, 'gm_only');
      assert(/fasts through a feast/.test(gm) && /Gluttony \(key gluttony\)[^\n]*: under the dining hall, past the cook/.test(gm), 'the pantry brings the Cold Larder whole: ' + placeLine(gm, 'Gluttony'));
      assert(!/strikes the bell|stands at its foot/.test(gm), 'only the place in play comes whole');
      p = await play(h, 'I climb the bell tower and ring the bell.'); gm = sec(p, 'gm_only');
      assert(/strikes the bell by hand/.test(gm), 'the bell brings the Bell Cellar whole');
      assert(!/Inside:|Guardian:/.test(gm), 'a place not yet found keeps its trial and guardian back');
      // The story names the trapdoor; the next action is neutral and the place stays whole.
      patchTurns(h, (r) => { r.narrative = 'Under the coiled rope the trapdoor lifts a finger-width and settles. ' + r.narrative; r.state_updates = []; });
      await play(h, 'I wait by the quad.');
      patchTurns(h, (r) => { r.state_updates = []; });
      gm = sec(await play(h, 'I sit down.'), 'gm_only');
      assert(/strikes the bell by hand/.test(gm), 'the story naming the trapdoor keeps the Bell Cellar whole on a neutral action');
      assert(!/stands at its foot/.test(gm), 'the doorless tower stays one line');
      // A found place comes whole with its trial and guardian on any action.
      patchTurns(h, (r) => { r.state_updates = [{ key: 'flags.dungeon_pride_found', op: 'set', value: true }]; });
      await play(h, 'I sit down.');
      patchTurns(h, (r) => { r.state_updates = []; });
      gm = sec(await play(h, 'I stand up.'), 'gm_only');
      assert(/Pride \(key pride\)[^\n]*\[found, not yet passed\][^\n]*\n\s+Inside: [^\n]*\n\s+Guardian: the Peacock/.test(gm), 'a found place is whole with its trial and guardian: ' + gm.slice(gm.indexOf('Pride (key')).slice(0, 300));
      assert(/The truth, released to you because a closed place has been found/.test(gm), 'the truth fragments follow a found place');
    } finally { h.close(); }
  },

  // 2. The passing oddities rotate, a few each turn, and every one comes round; the keeper and her rules are kept whole.
  async oddityRotation() {
    const h = await begin();
    try {
      const sets = [];
      for (let i = 0; i < 4; i++) { const gm = sec(await play(h, 'I look around the room. ' + 'x'.repeat(i)), 'gm_only'); const block = (gm.match(/Oddities[^\n]*\n((?:- [^\n]*\n?)+)/) || [, ''])[1]; sets.push(block.split('\n').filter(Boolean)); }
      assert(sets.every((s) => s.length >= 1 && s.length <= 3), 'a few oddities each turn: ' + JSON.stringify(sets.map((s) => s.length)));
      assert.notDeepEqual(sets[0], sets[1], 'the oddities change from turn to turn');
      assert.equal(new Set(sets.flat()).size, loadWorld().secrets.hints.length, 'every oddity comes round in four turns: ' + JSON.stringify(sets));
      const gm = sec(await play(h, 'I look around the room.'), 'gm_only');
      for (const f of ['human once', 'could not pass them', 'only to what is still human', 'chimera of everything she took', 'cannot be it', 'collects the humans who see through glamours', 'hoping without expecting', 'tells nobody what they have not earned', 'in her sight or hearing', 'finds a closed place, faces a guardian, shows unusual courage, restraint or kindness', 'sideways', 'never an explanation', 'some doors are closed for good reasons', 'means it kindly', 'never says what she is or what she hopes']) assert(gm.replace(/\s+/g, ' ').includes(f), 'the keeper still says: ' + f);
    } finally { h.close(); }
  },

  // 3. The levels, the learning rule and the roll rule go out every turn; each skill's description and where it is learned only when
  // a class, a club session, practice or magic is in the scene, or the clock is at a class.
  async skillsGate() {
    const h = await begin();
    try {
      const quiet = sec(await play(h, 'I look around the room.'), 'skills');
      assert(bytes(quiet) <= 800, 'skills in a quiet scene is at most 800 bytes, was ' + bytes(quiet));
      assert(/glamour 0, alchemy 0, artificing 0, wardcraft 0, beastcraft 0/.test(quiet) && /none, fumbling, basic, reliable, skilled, masterful/.test(quiet), 'the levels are listed: ' + quiet);
      assert(/report each such session this turn in "learning"[^\n]*one point per skill per day/.test(quiet) && /its level is added to the die/.test(quiet), 'the learning rule and the roll rule stay');
      assert(!/Learned at:/.test(quiet), 'no descriptions in a quiet scene');
      for (const a of ['I go to the Alchemy Society meeting tonight.', 'I try a small glamour on the mirror.', 'I practise the sigil on the desk.', 'I ask Daisy what the lecture covers.']) {
        const full = sec(await play(h, a), 'skills');
        assert(/Learned at: Applied Alchemy lab/.test(full) && /Illusion and charm-magic/.test(full) && /level 0, none/.test(full), 'the descriptions come with: ' + a);
      }
      // The clock at a class.
      const store = new Map([...h.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
      const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k)); store.get(key).data.state.time = '09:30'; store.get(key).data.state.weekday = 'Monday';
      h.close();
      const h2 = await boot({ setup(w, m) { m.store = store; } });
      try {
        assert(await h2.settle(150, 8000)); await h2.idle(10000); await h2.settle(100, 4000);
        const atClass = sec(await play(h2, 'I take a seat.'), 'skills');
        assert(/Learned at: Glamour Theory/.test(atClass), 'a class on the clock brings the descriptions: ' + atClass.slice(0, 200));
      } finally { h2.close(); }
    } finally { try { h.close(); } catch (e) { /* closed above */ } }
  },

  // 4. <world> carries the setting in 3,000 bytes, with the player in the third person and no stale "this evening".
  async worldBlock() {
    const h = await begin();
    try {
      const w = sec(await play(h, 'I look around the room.'), 'world');
      assert(bytes(w) <= 3000, '<world> is at most 3,000 bytes, was ' + bytes(w));
      assert(!/\bYou are |\byou saw\b|This evening is the cross-species mixer/.test(w), 'the narrator is not told "You are" or that it is still the first evening');
      const flat = w.replace(/\s+/g, ' ');
      for (const f of ['Mythaven University', 'goblins, harpies, werewolves, fox, cat, rabbit, horse, donkey and mouse or rat mythkin, merfolk, dryads, fairies and bovine mythkin', 'most humans go their whole lives without knowingly meeting one', 'live among humans under glamours', 'Owen Pryce is nineteen and human, the only human first-year this year, invited as the others were', 'is up to the player',
        'appears on no chart', 'four miles long', 'a lake in its middle', 'a cliff path with a rail', 'weather of its own', 'twice a day', 'a mile out', 'an hour', 'not to look down', 'older than its records', 'a wall with doors bricked up', 'a tower with no door at all', 'a bell nobody rings, which keeps no hours',
        'the Aerie, a roofless harpy tower where nobody sleeps lying down', 'rooms half underwater', 'the Greenhouse Quarter', 'fairy rings are mown into the lawns', 'goblin arcade under the old chapel, a market every Monday night', 'the Creamery, run by the bovine students', 'the Moon Field', 'the Edge, where the cliff path meets the cloud',
        'taken for tall people, odd people, people with hats', 'lost it in the Sundering', 'A few dozen humans', 'upper-years', 'letter from the Dean\'s office', 'none knows why they were asked', 'decided how human to stay', 'sensitive to mythkin magic', 'laissez-faire', 'Restoration Spa reverses any change, free and without limit',
        'rivalries are personal and cross kind', 'not a species-wide personality or obligation', 'draw close in their own ways, or not at all', 'seen the changes come to someone']) assert(flat.includes(f), '<world> still says: ' + f);
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
    } catch (e) { failed += 1; console.log('FAIL', n, '-', String((e && e.message) || e).split('\n')[0].slice(0, 400)); if (process.env.AUDIT_STACK) console.log(e && e.stack); }
  }
  if (failed) { console.error('GM PROMPT FAILED: ' + failed + ' of ' + names.length + ' scenarios'); process.exit(1); }
  console.log('gm prompt passed: ' + names.length + ' scenarios');
  process.exit(0);
})();
