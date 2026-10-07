'use strict';
// The term calendar: the world's set events (the mixer, the Creamery fair, the full-moon run, the Human Society evening, the storm,
// the exams, the feast) reach the narrator through <clock> as motives and places, never as forced scenes, and the closed places
// are tied to them instead of shutting without a word. Run one scenario by name: node calendar.js eventDayAims
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node calendar.js
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { boot } = require('./boot');

let unhandled = 0; process.on('unhandledRejection', () => { unhandled += 1; });
const turnCalls = (h) => h.mock.sampleCalls.filter((c) => /^turn/.test(c.label));
const promptOf = (c) => (Array.isArray(c.input) ? c.input.map((m) => m.content).join('\n') : String(c.input));
const sec = (p, tag) => { const m = p.match(new RegExp('\\n<' + tag + '[ >][\\s\\S]*?\\n</' + tag + '>')); assert(m, '<' + tag + '> is in the prompt'); return m[0]; };
const lineOf = (p, key) => (sec(p, 'characters').match(new RegExp('\\n- [^\\n]*\\[' + key + '\\][^\\n]*')) || [''])[0];
const aimOf = (p, key) => ((sec(p, 'characters').match(new RegExp('\\[' + key + '\\][^\\n]*')) || [''])[0].match(/Aim now: [^\n]*/) || [''])[0];
const advDoc = (h) => { const d = [...h.mock.store.entries()].filter(([k]) => /^adventures\/[^/]+$/.test(k)); assert.equal(d.length, 1, 'one adventure'); return { id: d[0][0].split('/')[1], data: d[0][1].data }; };
const storedTurns = (h, id) => [...h.mock.store.entries()].filter(([k]) => k.startsWith('adventures/' + id + '/turns/')).sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([, v]) => v.data.turns);
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cow-roommate-25.json'), 'utf8'));

async function begin(setup) {
  const h = await boot({ setup });
  assert(await h.settle(150, 6000), 'boot did not settle');
  h.type('#cName', 'Owen Pryce');
  h.click('#cBegin');
  assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
  return h;
}
// Every turn's reply: the given minutes pass and nothing in the state is set.
function quiet(h, minutes) {
  h.mock.sampleHandler = (input, o, call) => {
    const out = h.mock.defaultHandler(input, o, call);
    if (!/^turn/.test(call.label)) return out;
    const r = JSON.parse(out); r.time_advance_minutes = minutes; r.state_updates = []; r.exposures = []; return JSON.stringify(r);
  };
}
async function play(h, action, minutes) { quiet(h, minutes == null ? 15 : minutes); assert(await h.turn(action), 'turn: ' + action); return promptOf(turnCalls(h).at(-1)); }
async function setClock(h, day, time) { h.type('#ovrDay', String(day)); h.type('#ovrTime', time); h.click('#ovrClockSet'); assert(await h.settle(150, 6000), 'the clock override did not settle'); }
async function loadSave(save) {
  const h = await boot({
    setup: (w, mock) => {
      mock.store.set('adventures/' + save.id, { data: save.adventure, version: 1 });
      for (const [c, doc] of Object.entries(save.turns)) mock.store.set('adventures/' + save.id + '/turns/' + c, { data: doc, version: 1 });
    },
  });
  assert(await h.settle(150, 8000), 'the page did not settle'); assert(await h.idle(20000), 'the save did not load');
  return h;
}
function clean(h) {
  const d = h.diagnostics();
  assert.equal(d.errors.length, 0, 'page errors: ' + JSON.stringify(d.errors).slice(0, 600));
  assert.equal(unhandled, 0, 'unhandled rejections');
}

const S = {
  // 1. <clock> names the next set event with its day, time, place and what it is for, says it is a chance and not a scene, and the
  // coming days mark the day it falls on; the header clock's tooltip names it too. On Day 1 before seven it is the mixer, today;
  // on Day 2 it is the Creamery fair, Day 6.
  async nextEventInClock() {
    const h = await begin();
    try {
      let clock = sec(await play(h, 'I look around the room.'), 'clock');
      assert(/Today: the cross-species mixer from 19:00, the quad: /.test(clock), 'Day 1 before the mixer names it as today: ' + clock);
      await setClock(h, 2, '09:30');
      clock = sec(await play(h, 'I walk to the library.'), 'clock');
      assert(/Next event: the Creamery fair, Day 6 Saturday 15:30, the Creamery yard: [^\n]+\. A chance, not a scene: Owen goes only by choice, and missing it costs nothing\./.test(clock), 'the clock names the next event: ' + clock);
      assert(/Day 6 Saturday \([^)]*EVENT the Creamery fair 15:30/.test(clock), 'the coming days mark the event\'s day: ' + clock);
      assert(!/mixer/.test(clock), 'the mixer is once only and over: ' + clock);
      assert(/Day 6 Saturday: the Creamery fair 15:30/.test(h.document.querySelector('#clock').title), 'the header clock\'s tooltip names it: ' + h.document.querySelector('#clock').title);
      clean(h);
    } finally { h.close(); }
  },

  // 2. On an event's day the people it lists lean toward it in their aim for every slot until it is over (the roommate and the
  // fair's people at breakfast on its Saturday), and anyone it does not list keeps their own aim; the day before, nobody does.
  async eventDayAims() {
    const h = await begin();
    try {
      await setClock(h, 5, '08:10');
      let p = await play(h, 'I eat breakfast.');
      assert(!/Creamery fair \(/.test(aimOf(p, 'roommate')), 'the day before, the roommate does not lean toward the fair: ' + aimOf(p, 'roommate'));
      await setClock(h, 6, '08:10');
      const before = p; p = await play(h, 'I eat breakfast.');
      // The roommate may stand in for one of the fair's people (a cow roommate replaces the Creamery's regular).
      const listed = ['roommate', 'creamery', 'warren', 'stall'].filter((k) => sec(p, 'characters').includes('[' + k + ']'));
      assert(listed.length >= 3 && listed.includes('roommate'), 'the fair\'s people are in the cast: ' + listed.join(', '));
      for (const k of listed) assert(/Aim now: be at the Creamery fair \(the Creamery yard, 15:30\) and ask Owen along once; Owen may say no\./.test(aimOf(p, k)), k + ' leans toward the fair on its day: ' + aimOf(p, k));
      // The aim does not bring anyone near: whoever had the index line the day before keeps it, with only the aim added.
      const line = (q, k) => lineOf(q, k).replace(/ Aim now: [^\n]*$/, '');
      const far = listed.filter((k) => !/ Close up: | Ways, | Dress: /.test(line(before, k)));   // those lines turn with the turn
      assert(far.length >= 2, 'some of the fair\'s people are away from breakfast: ' + far.join(', '));
      for (const k of far) assert.equal(line(p, k), line(before, k), k + '\'s line is the day before\'s plus the aim');
      assert(!/Creamery fair/.test(aimOf(p, 'dean')), 'the Dean is not listed for the fair and keeps her own aim: ' + aimOf(p, 'dean'));
      assert(/Today: the Creamery fair from 15:30/.test(sec(p, 'clock')), 'the clock marks today\'s event');
      clean(h);
    } finally { h.close(); }
  },

  // 2b. An intimate scene on an event's day is not interrupted by it: while the player makes love with the roommate, neither the
  // clock nor the roommate's aim points at the fair; the next ordinary turn the aim is back.
  async eventDayScene() {
    const h = await begin();
    try {
      await setClock(h, 6, '09:10');
      let p = await play(h, 'I sit on my bed.');
      const nm = (sec(p, 'characters').match(/\n- (\S+)[^\n]*\[roommate\]/) || [])[1];
      assert(nm, 'the roommate is in the cast');
      p = await play(h, 'I kiss ' + nm + ' and pull her onto the bed, undressing her, and we start to make love.');
      assert(/Scene note \(binding\)/.test(p), 'the turn is an intimate scene');
      assert(!/Creamery fair \(/.test(aimOf(p, 'roommate')), 'the roommate is not sent off to the fair mid-scene: ' + aimOf(p, 'roommate'));
      assert(!/Creamery fair \(/.test(sec(p, 'characters')), 'nobody is sent off to the fair mid-scene');
      assert(!/Today: the Creamery fair/.test(sec(p, 'clock')), 'the clock leaves the fair out mid-scene');
      p = await play(h, 'I get dressed and look out of the window.');
      assert(/Aim now: be at the Creamery fair \(/.test(aimOf(p, 'roommate')), 'the next ordinary turn the roommate leans toward the fair again: ' + aimOf(p, 'roommate'));
      clean(h);
    } finally { h.close(); }
  },

  // 2c. An event runs until its own end, past dinner and past midnight: the storm (Day 13, 15:30 until 04:00) is the Sleeping Wing's
  // chance, a foggy night for whoever is awake at three, so with the wing in play <gm_only> names the storm of Day 13 at 22:00 and
  // at 02:50 the next day (not the next term's), and the clock still names it; at 04:30 it is over.
  async eventPastMidnight() {
    const h = await begin();
    try {
      const wait = 'I wait on the landing by the papered door to the east wing, in the fog.';
      await setClock(h, 13, '22:00');
      let p = await play(h, wait);
      assert(/Next chance: the storm, Day 13\./.test(sec(p, 'gm_only')), 'at 22:00 the wing\'s chance is tonight\'s storm: ' + (sec(p, 'gm_only').match(/Sloth[^\n]*/) || [''])[0]);
      assert(/Today: the storm from 15:30 until 04:00/.test(sec(p, 'clock')), 'at 22:00 the clock still names the storm: ' + sec(p, 'clock'));
      await setClock(h, 14, '02:50');
      p = await play(h, wait);
      assert(/Next chance: the storm, Day 13\./.test(sec(p, 'gm_only')), 'at 02:50 the wing\'s chance is still the storm of Day 13: ' + (sec(p, 'gm_only').match(/Sloth[^\n]*/) || [''])[0]);
      assert(/Still on: the storm since Day 13 15:30 until 04:00/.test(sec(p, 'clock')), 'at 02:50 the clock still names the storm: ' + sec(p, 'clock'));
      await setClock(h, 14, '04:30');
      p = await play(h, wait);
      assert(/Next chance: the storm, Day 41\./.test(sec(p, 'gm_only')), 'once the storm is over the next chance is the next term\'s');
      assert(!/the storm/.test(sec(p, 'clock').split('\n').find((l) => /^(Today|Still on|Next event):/.test(l)) || ''), 'at 04:30 the clock has moved on: ' + sec(p, 'clock'));
      clean(h);
    } finally { h.close(); }
  },

  // 2d. Events nobody is asked along to get their own words: nobody goes to the storm, a missed exam is not free, and the professor
  // and the Dean are not told to ask Owen along to the exams or the feast (the whole university is at the feast anyway).
  async noInviteEvents() {
    const h = await begin();
    try {
      await setClock(h, 12, '10:00');
      let clock = sec(await play(h, 'I walk to the library.'), 'clock');
      assert(/Next event: the storm, Day 13 Saturday 15:30 until 04:00, the whole Isle: Sallow Pier closes/.test(clock), 'the storm is named as weather: ' + clock);
      assert(!/goes only by choice|costs nothing/.test(clock), 'nobody goes to a storm: ' + clock);
      await setClock(h, 22, '09:30');
      let p = await play(h, 'I look for the exam room.');
      clock = sec(p, 'clock');
      assert(/Today: the midterm exams from 09:00[^\n]*a missed paper is a failed one/.test(clock), 'the exams say what missing one means: ' + clock);
      assert(!/costs nothing/.test(clock), 'missing the exams is not free: ' + clock);
      assert(/Aim now: invigilate the papers/.test(aimOf(p, 'historian')), 'the professor invigilates: ' + aimOf(p, 'historian'));
      assert(/Aim now: sit the papers/.test(aimOf(p, 'roommate')), 'the roommate sits the papers: ' + aimOf(p, 'roommate'));
      assert(!/along/.test(aimOf(p, 'historian') + aimOf(p, 'roommate')), 'nobody is told to ask Owen along to the exams');
      await setClock(h, 25, '12:10');
      const before = await play(h, 'I eat lunch.');
      await setClock(h, 26, '12:10');
      p = await play(h, 'I eat lunch.');
      // The Dean, away from lunch, keeps her index line on the feast's day with only the aim added, not her whole brief.
      assert.equal(lineOf(p, 'dean').replace(/ Aim now: [^\n]*$/, ''), lineOf(before, 'dean').replace(/ Aim now: [^\n]*$/, ''), 'the Dean\'s line is the day before\'s plus the aim');
      assert(/Aim now: give the speech at the end-of-exams feast/.test(aimOf(p, 'dean')), 'the Dean gives the feast speech: ' + aimOf(p, 'dean'));
      assert(!/along/.test(aimOf(p, 'dean')), 'the Dean does not ask Owen along to a feast the whole university attends');
      assert(/A chance, not a scene: Owen goes only by choice, and missing it costs nothing\./.test(sec(p, 'clock')), 'skipping the feast is still free: ' + sec(p, 'clock'));
      clean(h);
    } finally { h.close(); }
  },

  // 2e. An event stands in for the week's fixture it replaces instead of sitting beside it (the full-moon run is that Tuesday's dusk
  // run, the Human Society evening that Thursday's tea), and it reaches the captain of the Moonrunners, whose evening aim names the
  // club but not the run (a whole-word match on the event's name, not "moon" inside "Moonrunners").
  async eventStandsIn() {
    const h = await begin();
    try {
      await setClock(h, 8, '10:00');
      let clock = sec(await play(h, 'I walk to the library.'), 'clock');
      assert(/Day 9 Tuesday \([^)]*Sigil Circle, practice yard 19:30; EVENT the Moonrunners' full-moon run 19:30\)/.test(clock), 'the run stands in for the dusk run, the other club stays: ' + clock);
      assert(!/dusk run/.test(clock), 'no dusk run beside the full-moon run: ' + clock);
      assert(/Day 11 Thursday \([^)]*lake night swim 19:30; EVENT the Human Society evening 19:30\)/.test(clock) && !/Human Society tea/.test(clock), 'the evening stands in for the tea: ' + clock);
      await setClock(h, 5, '10:00');
      clock = sec(await play(h, 'I walk to the library.'), 'clock');
      assert(/Day 6 Saturday \(EVENT the Creamery fair 15:30\)/.test(clock), 'one Creamery fair on its day, not two: ' + clock);
      await setClock(h, 9, '19:45');
      const p = await play(h, 'I walk out to the Moon Field.');
      assert(/Now: the Moonrunners' full-moon run|Now: Sigil Circle/.test(sec(p, 'clock')) && !/dusk run/.test(sec(p, 'clock')), 'the clock\'s Now is not the dusk run: ' + sec(p, 'clock'));
      assert(sec(p, 'characters').includes('[moonrunners]'), 'the captain is in the cast');
      assert(/Aim now: be at the Moonrunners' full-moon run \(/.test(aimOf(p, 'moonrunners')), 'the captain leans toward the run: ' + aimOf(p, 'moonrunners'));
      clean(h);
    } finally { h.close(); }
  },

  // 3. Skipping an event costs nothing: Owen spends the fair's afternoon elsewhere and the clock passes it; the state the engine
  // keeps (flags, items) is what it was, no engine note speaks of the fair, nobody's aim still points at it, and the clock
  // moves on to the next event (the full-moon run on Day 9).
  async skipCostsNothing() {
    const h = await begin();
    try {
      await setClock(h, 6, '15:00');
      let p = await play(h, 'I stay in the library and read.', 15);
      assert(/Today: the Creamery fair/.test(sec(p, 'clock')), 'the fair is today');
      const before = JSON.parse(JSON.stringify(advDoc(h).data.state));
      p = await play(h, 'I keep reading until dinner.', 200);
      const { id, data: { state: s } } = advDoc(h);
      assert(s.day === 6 && s.time >= '18:00', 'the clock passed the fair: ' + s.day + ' ' + s.time);
      for (const k of ['flags', 'items']) assert.deepEqual(s[k], before[k], k + ' are unchanged by skipping the fair');
      const notes = storedTurns(h, id).slice(-2).flatMap((t) => t.notes || []).join(' | ');
      assert(!/fair|missed|skipp/i.test(notes), 'no engine note speaks of the skipped fair: ' + notes);
      p = await play(h, 'I go to dinner.');
      assert(/Next event: the Moonrunners' full-moon run, Day 9 Tuesday 19:30/.test(sec(p, 'clock')), 'the clock moves on to the next event: ' + sec(p, 'clock'));
      assert(!/Creamery fair \(/.test(sec(p, 'characters')), 'no aim still points at the fair once it is over');
      clean(h);
    } finally { h.close(); }
  },

  // 4. An older save picks the calendar up on load: the anonymised turn-25 save (Day 2, Tuesday, from before the calendar) is
  // loaded and played one turn, and its <clock> names the Creamery fair on Day 6.
  async olderSave() {
    const h = await loadSave(SAVE);
    try {
      assert.equal(SAVE.adventure.state.day, 2, 'the save stands on Day 2');
      const clock = sec(await play(h, 'I get up.'), 'clock');
      assert(/Next event: the Creamery fair, Day 6 Saturday 15:30/.test(clock), 'the older save\'s clock names the next event: ' + clock);
      clean(h);
    } finally { h.close(); }
  },

  // 5. The closed places are on the calendar instead of shutting without a word. With the pantry in play the Cold Larder names its
  // next chance, the feast, by day; below the humanity line (the turn-25 save with every cow part at its full extent) <gm_only> has
  // a closed place the player can feel refuse, where it had the doors simply stay shut.
  async closedPlacesTimetable() {
    let h = await begin();
    try {
      const gm = sec(await play(h, 'I ask the cook about the pantry and the cold room behind it.'), 'gm_only');
      assert(/fasts through a feast[^\n]* Next chance: the end-of-exams feast, Day 26\./.test(gm), 'the Cold Larder names its next chance: ' + (gm.match(/Gluttony[^\n]*/) || [''])[0]);
      assert(/Above 40 the closed places answer\./.test(gm), 'above the line the places answer: ' + (gm.match(/humanity: [^\n]{0,40}/) || [''])[0]);
      clean(h);
    } finally { h.close(); }
    const far = JSON.parse(JSON.stringify(SAVE));
    for (const r of Object.values(far.adventure.state.tf.prog.cow.tracks)) r.p = Math.max(r.p || 0, r.e || 0);
    h = await loadSave(far);
    try {
      const gm = sec(await play(h, 'I sit down.'), 'gm_only');
      assert(/humanity: [0-3]?\d of 100/.test(gm), 'humanity is below the line: ' + (gm.match(/humanity: [^\n]{0,40}/) || [''])[0]);
      assert(/Below the line of 15: [^\n]*At a closed place \w+ can feel it refuse \(cold, still, deaf to a knock\); nobody says why\./.test(gm), 'below the line a closed place is felt to refuse: ' + gm.slice(0, 400));
      assert(!/stay shut/.test(gm), 'the doors do not simply stay shut');
      // Below the line no chance is offered: <gm_only> does not say both that no place opens and when the next one could.
      const gm2 = sec(await play(h, 'I ask the cook about the pantry and the cold room behind it.'), 'gm_only');
      assert(/fasts through a feast/.test(gm2), 'the Cold Larder is in play: ' + (gm2.match(/Gluttony[^\n]*/) || [''])[0]);
      assert(!/Next chance/.test(gm2), 'below the line no next chance is named: ' + (gm2.match(/Gluttony[^\n]*/) || [''])[0]);
      clean(h);
    } finally { h.close(); }
  },

  // The humanity line is set by the pace, so the closed places answer for a like share of the game on every pace: a fresh game on the
  // unbounded pace, an hour of intimate contact with two kinds every turn, keeps them answering on most of its first thirty turns
  // (with the standard pace's line it fell below at turn seventeen), and the standard pace keeps its line of 40.
  async closedPlacesEveryPace() {
    const lineIn = (gm) => { const m = /humanity: (\d+) of 100[^\n]*?(?:Above (\d+) the closed places answer|Below the line of (\d+):)/.exec(gm); assert(m, 'the humanity line is in <gm_only>: ' + gm.slice(0, 300)); return { h: +m[1], line: +(m[2] || m[3]) }; };
    for (const pace of ['standard', 'unbounded']) {
      const h = await boot({ seed: 11 });
      try {
        assert(await h.settle(150, 6000), 'boot did not settle');
        h.type('#cName', 'Tom Ashby'); h.$('#cGender').value = 'male'; h.$('#cGender').dispatchEvent(new h.window.Event('change'));
        h.type('#cRmSpecies', 'cow'); h.type('#cRmName', 'Daisy Holm');
        h.$('#cPace').value = pace; h.$('#cPace').dispatchEvent(new h.window.Event('change'));
        h.click('#cBegin'); assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
        assert.equal(advDoc(h).data.settings.pace, pace, 'the pace is set on the creation form');
        h.mock.sampleHandler = (input, o, call) => {
          const out = h.mock.defaultHandler(input, o, call);
          if (!/^turn/.test(call.label)) return out;
          const r = JSON.parse(out); r.time_advance_minutes = 60; r.exposures = ['cow', 'wolf'].map((k) => ({ species: k, method: 'the evening with Daisy', intensity: 4 }));
          r.state_updates = [{ key: 'present', op: 'append', value: ['Daisy Holm'] }]; return JSON.stringify(r);
        };
        const seen = [];
        for (let i = 0; i < (pace === 'standard' ? 2 : 30); i++) { assert(await h.turn('I spend the evening with Daisy.'), 'turn ' + (i + 1)); seen.push(lineIn(sec(promptOf(turnCalls(h).at(-1)), 'gm_only'))); }
        if (pace === 'standard') { assert.equal(seen[0].line, 40, 'the standard pace keeps the line of 40'); continue; }
        const open = seen.filter((x) => x.h >= x.line).length;
        assert(open >= 20, 'on the unbounded pace the closed places answer on most of thirty turns: ' + open + ' of 30 (' + seen.map((x) => x.h + '/' + x.line).join(' ') + ')');
        assert(seen.every((x) => x.line < 40), 'the unbounded pace uses a lower line: ' + seen[0].line);
        clean(h);
      } finally { h.close(); }
    }
  },
};

(async () => {
  const pick = process.argv.slice(2), names = pick.length ? pick : Object.keys(S);
  let failed = 0;
  for (const n of names) {
    try { await S[n](); console.log('ok ' + n); }
    catch (e) { failed += 1; console.error('FAIL ' + n + '\n' + (e && e.stack || e)); }
  }
  console.log(failed ? 'calendar: ' + failed + ' of ' + names.length + ' failed' : 'calendar passed (' + names.length + ')');
  process.exit(failed ? 1 : 0);
})();
