'use strict';
// Prompt budget on a real game. fixtures/cow-roommate-25.json is a save played to turn 25, anonymised: the people's names changed
// and the player's prose and most of the narration replaced by neutral text of the same byte length, so every size is the real one
// (a cow roommate, "Turns sent verbatim" 4, rich density, the change pace uncapped, a dozen of the player's parts changing). Its
// fixed sections alone leave too little room under the size cap for everything else, so every turn sheds; on the page before the
// budget rework the narrator then read one verbatim turn of the four asked for and a story with holes in it. Six more turns are
// played on it (the replies are the save's own later turns again, so the narration is as long as the real thing). Each of them
// must keep the floors: at least two verbatim turns, the newest whole and the one before it to at least its last paragraph, and
// the lore of the kind changing the player (the roommate's kind). Every turn's prompt must also keep:
//   - under the page's own cap (PROMPT_CAP, read from the page), and a style example;
//   - every beat the summary does not hold yet, once: none missing and none it already holds sent again;
// the turn must say on the page, in plain words, how much of the recent turns the writer read when that was cut; and the memory
// fold (it runs on the fifth turn) gets each beat with its day and time, in the order the memory holds them.
// Run: node prompt-budget.js      (WL_HTML=<index.html> WL_WORLDS=<worlds dir> tests another build)
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { boot } = require('./boot');

const HTML = process.env.WL_HTML || path.join(__dirname, '..', 'windlass', 'index.html');
const CAP = Number((/const PROMPT_CAP = (\d+);/.exec(fs.readFileSync(HTML, 'utf8')) || [0, 63000])[1]);
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cow-roommate-25.json'), 'utf8'));
const B = (s) => Buffer.byteLength(s, 'utf8');
const promptOf = (c) => (Array.isArray(c.input) ? c.input.map((m) => m.content).join('\n') : String(c.input));
const block = (p, tag) => { const m = new RegExp('<' + tag + '\\b[^>]*>\\n([\\s\\S]*?)\\n</' + tag + '>').exec(p); return m ? m[1] : ''; };
const bare = (b) => String(b).replace(/[.!?]['"’”)]?$/, '');

async function main() {
  const h = await boot({
    setup: (w, mock) => {
      mock.store.set('adventures/' + SAVE.id, { data: SAVE.adventure, version: 1 });
      for (const [c, doc] of Object.entries(SAVE.turns)) mock.store.set('adventures/' + SAVE.id + '/turns/' + c, { data: doc, version: 1 });
    },
  });
  try {
    assert(await h.settle(150, 8000), 'the page did not settle'); assert(await h.idle(20000), 'the save did not load');
    const advDoc = () => h.mock.store.get('adventures/' + SAVE.id).data;
    const stored = () => [...h.mock.store.entries()].filter(([c]) => c.startsWith('adventures/' + SAVE.id + '/turns/')).sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([, v]) => v.data.turns);
    const real = SAVE.turns['0001'].turns.concat(SAVE.turns['0002'].turns);   // turns 11 to 25, replayed as the model's replies
    assert.equal(h.document.querySelectorAll('#feed article.turn[data-id]').length, 25, 'the save loaded with its 25 turns');
    assert.equal(advDoc().settings.window, 4, 'the save asks for four verbatim turns');
    let k = 0; const folds = [];
    h.mock.sampleHandler = (input, o, call) => {
      if (call.label === 'memory fold') { folds.push(promptOf({ input })); return Array.from({ length: 240 }, (_, i) => ['Owen', 'and', 'Ada', 'talked', 'in', 'room', '4B', 'on', 'Day', '2.'][i % 10]).join(' '); }
      if (call.label !== 'turn') return h.mock.defaultHandler(input, o, call);
      const t = real[k % real.length]; k += 1;
      // The beats are marked with the new turn's number, so each is told apart from the same line in the turn it came from.
      return JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: t.narrative, suggested_actions: t.suggestions, secret_info: '', state_updates: [], time_advance_minutes: 10,
        events: t.events, beats: t.beats.map((b) => b + ' (turn ' + (25 + k) + ')'), facts: t.facts, exposures: t.exposures || [], kinds_met: [], bond_shifts: [], spa_reset: [] });
    };
    for (let i = 0; i < 6; i++) {
      const beatsBefore = advDoc().memory.beats.slice(), turnsBefore = stored(), foldsBefore = folds.length;
      assert(await h.turn(real[i].action, { max: 30000 }), 'turn ' + (26 + i) + ' did not finish: ' + h.$('#status').textContent);
      const p = promptOf(h.mock.sampleCalls.filter((c) => c.label === 'turn').at(-1)), n = 26 + i;
      assert(B(p) <= CAP, 'turn ' + n + ': the prompt is ' + B(p) + ' bytes, over ' + CAP);
      const recent = block(p, 'recent_turns'), verbatim = (recent.match(/^Turn (\d+) \(Day/gm) || []).map((x) => Number(/\d+/.exec(x)[0]));
      // The floors, on every turn. They are what holds today; all 4 verbatim turns on every turn (only the first of these six gets
      // them) waits on the fixed sections of the prompt (rules, world, cast, narrator-only block, transformation block) being made
      // smaller, which is separate work. When that lands, raise the first check to the window the save asks for.
      assert(verbatim.length >= 2, 'turn ' + n + ': the writer read ' + verbatim.length + ' verbatim turn(s) of the 4 asked for; shedding must stop at two');
      const last = turnsBefore.at(-1), prev = turnsBefore.at(-2);
      assert(recent.includes(last.narrative), 'turn ' + n + ': the newest turn must be sent whole');
      assert(recent.includes(prev.narrative.split(/\n+/).filter((q) => q.trim()).at(-1)), 'turn ' + n + ': the turn before it keeps at least its last paragraph');
      assert.match(block(p, 'lore'), /<entry name="species: cow">/, 'turn ' + n + ': the lore of the kind changing the player stays');
      assert(block(p, 'style_examples').trim(), 'turn ' + n + ': at least one style example');
      // The beats not yet in the summary, each once: those of turns sent whole are in their narration, the rest (a turn cut to its
      // last paragraphs or its tail included) in <earlier_turns>.
      const lineOf = new Map(block(p, 'earlier_turns').split('\n').map((l) => [Number((/^Turn (\d+) \(/.exec(l) || [])[1]), l]));
      const byN = new Map(turnsBefore.map((t) => [t.n, t])), shown = new Set(verbatim.filter((m) => byN.has(m) && recent.includes(byN.get(m).narrative)));
      const owner = new Map(); for (const t of turnsBefore) for (const b of t.beats || []) owner.set(b, t.n);
      const missing = beatsBefore.filter((b) => !shown.has(owner.get(b)) && !(lineOf.get(owner.get(b)) || '').includes(bare(b)));
      assert.equal(missing.length, 0, 'turn ' + n + ': beats neither in the summary nor in the prompt: ' + missing.slice(0, 3).join(' | '));
      const resent = [...lineOf].flatMap(([m, l]) => ((byN.get(m) || {}).beats || []).filter((b) => !beatsBefore.includes(b) && l.includes(bare(b))));
      assert.equal(resent.length, 0, 'turn ' + n + ': beats the summary already holds were sent again: ' + resent.slice(0, 3).join(' | '));
      // What the writer read is on the turn itself when shedding cut it.
      const t = stored().at(-1); const cut = (t.notes || []).find((x) => /^prompt near the size cap/.test(x)) || '';
      // A stage that drops the lore's lists of parts sends the entries without them, as it costs them, so the lore the turn does not
      // name stays inside the stage's budget (the cow's entry, the only kind here changing the player or in the scene, is outside it).
      if (/without the lists of parts/.test(cut)) {
        const entries = [...block(p, 'lore').matchAll(/<entry name="([^"]*)">([\s\S]*?)<\/entry>/g)];
        assert(!entries.some((m) => /What changes \(/.test(m[2])), 'turn ' + n + ': the lore was sent with its lists of parts: ' + entries.map((m) => m[1]));
        const budget = Number((/lore budget (\d+) characters/.exec(cut) || [])[1]) || 0;
        const other = entries.filter((m) => m[1] !== 'species: cow').reduce((a, m) => a + m[2].length, 0);
        assert(other <= budget, 'turn ' + n + ': lore the turn does not need is ' + other + ' characters, over the stage\'s ' + budget);
      }
      const line = h.document.querySelector('#feed article.turn:last-of-type .turn-foot').textContent;
      if (/reduced to 1,.*recent turns cut to their last/.test(cut)) assert.match(line, /The writer read only the end of your last turn, to fit its size limit\./, 'turn ' + n + ': the turn says the writer read only the end of the last turn: ' + line);
      else if (/reduced to|cut to their last/.test(cut)) assert.match(line, new RegExp('The writer read ' + verbatim.length + ' of your last 4 turns'), 'turn ' + n + ': the turn says how much the writer read: ' + line);
      // The fold, when this turn ran one, got the memory's eighteen oldest beats in order, each with its own turn's day and time.
      if (folds.length > foldsBefore) {
        const stamp = new Map(); for (const u of stored()) for (const b of u.beats || []) stamp.set(b, '[Day ' + u.stateBefore.day + ' ' + u.stateBefore.time + '] ');
        const want = beatsBefore.concat(t.beats).slice(0, 18).map((b) => stamp.get(b) + b), got = block(folds.at(-1), 'beats').split('\n');
        assert.deepEqual(got, want, 'turn ' + n + ': the fold gets the oldest beats, each with its turn\'s day and time');
        assert.match(folds.at(-1), /never "today"/, 'and is told to write days, not "today"');
      }
      console.log('turn ' + n + ': ' + B(p) + ' bytes, ' + verbatim.length + ' verbatim turns, ' + (block(p, 'style_examples').split(/\n\n+/).length) + ' style example(s), lore ' + B(block(p, 'lore')) + ' bytes; ' + (cut || 'nothing shed'));
    }
    assert.equal(folds.length, 1, 'the memory fold ran once in six turns');
    const d = h.diagnostics(); assert.equal(d.errors.length, 0, 'page errors: ' + JSON.stringify(d.errors).slice(0, 400)); assert.equal(d.violations.length, 0, 'runtime violations: ' + JSON.stringify(d.violations).slice(0, 400));
    console.log('prompt budget passed');
  } finally { h.close(); }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
