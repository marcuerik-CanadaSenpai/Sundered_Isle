'use strict';
// Regressions for the audit fixes: one scenario per fix. Each passes on the fixed page and fails on the page before the fixes
// (2512da3); sunderedOnly fails on the last three-world page (d985886). Run one scenario by name: node audit-fixes.js romanceDetection
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node audit-fixes.js
// Halloway and Mythaven have left the game; hallowayAttunement reads the last Halloway world file from test/fixtures/halloway.js
// to exercise runProgression, the engine code only a world with a progression reaches.
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { boot } = require('./boot');
const { seedFor, mulberry32 } = require('./lib/rng');
const KNOWN_RED = require('./lib/known-red');
const { loadGenerator } = require('./lib/generator');
const blockOf = (p, tag) => { const m = new RegExp('<' + tag + '\\b[^>]*>\\n([\\s\\S]*?)\\n</' + tag + '>').exec(p); return m ? m[1] : ''; };
const utf8Bytes = (x) => Buffer.byteLength(x, 'utf8');

const HTML = process.env.WL_HTML || path.join(__dirname, '..', 'windlass', 'index.html');
const WORLDS = process.env.WL_WORLDS || path.join(__dirname, '..', 'windlass', 'worlds');
const PROMPT_CAP = Number((/const PROMPT_CAP = (\d+);/.exec(fs.readFileSync(HTML, 'utf8')) || [0, 63000])[1]);
let unhandled = 0; process.on('unhandledRejection', () => { unhandled += 1; });

const advDocs = (store) => [...store.entries()].filter(([p]) => /^adventures\/[^/]+$/.test(p));
const gmOf = (p) => (/<gm_only[^>]*>\n([\s\S]*?)\n<\/gm_only>/.exec(p) || [])[1] || '';
const onlyAdv = (store) => { const d = advDocs(store); assert.equal(d.length, 1, 'expected one adventure, found ' + d.length); return { id: d[0][0].split('/')[1], data: d[0][1].data }; };
const storedTurns = (store, id) => [...store.entries()].filter(([p]) => p.startsWith('adventures/' + id + '/turns/')).sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([, v]) => v.data.turns);
const turnCalls = (h) => h.mock.sampleCalls.filter((c) => /^turn/.test(c.label));
const lastTurn = (h) => turnCalls(h).at(-1);
const promptOf = (c) => (Array.isArray(c.input) ? c.input.map((m) => m.content).join('\n') : String(c.input));
// The ceiling the length line names: the band's ("240 to 460 words") or an asked or talk turn's ("at most 460 words"); the room past a band is not it.
const lengthTop = (p) => { const m = /Narrative length: (?:at most (\d+) words|(\d+) to (\d+) words)/.exec(p); return m ? +(m[1] || m[3]) : NaN; };
const statusText = (h) => (h.$('#status').hidden ? '' : h.$('#status').textContent);
const statusButtons = (h) => [...h.document.querySelectorAll('#status button')];
const clean = (h) => assert(!h.errors.length && !h.mock.violations.length, 'page errors or contract violations: ' + JSON.stringify(h.errors.concat(h.mock.violations)).slice(0, 400));

async function begin(o) {
  o = o || {};
  const h = await boot({ setup: o.setup, seed: o.seed });
  assert(await h.settle(150, 6000), 'boot did not settle');
  if (o.world) { h.click('#btnAdventures'); h.$('#newWorld').value = o.world; h.click('#newAdv'); await h.settle(150, 6000); }
  if (o.name) h.type('#cName', o.name);
  if (o.gender) { h.$('#cGender').value = o.gender; h.$('#cGender').dispatchEvent(new h.window.Event('change')); }
  if (o.body) h.$('#cBody').value = o.body;
  if (o.rmSpecies) h.type('#cRmSpecies', o.rmSpecies);
  if (o.rmName) h.type('#cRmName', o.rmName);
  if (o.rmGender) { h.$('#cRmGender').value = o.rmGender; h.$('#cRmGender').dispatchEvent(new h.window.Event('change')); }
  if (o.glimpse != null) h.type('#cGlimpse', o.glimpse);
  if (o.background != null) h.type('#cBackground', o.background);
  if (o.personality != null) h.type('#cPersonality', o.personality);
  h.click('#cBegin');
  assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
  return h;
}
async function setWriter(h, value) {
  h.click('#btnSettings'); h.$('#setNarrTier').value = value; h.$('#setNarrTier').dispatchEvent(new h.window.Event('change'));
  await h.idle(8000); h.click('[data-close="dlgSettings"]');
}
// Settings changed the way a player changes them, on the Settings screen. Editing the mock store's copy after boot does not reach
// the page, which holds its own adventure and writes it back over the edit.
async function setSettings(h, s) {
  h.click('#btnSettings');
  for (const [k, v] of Object.entries(s)) { const el = h.$('#set' + k[0].toUpperCase() + k.slice(1)); el.value = String(v); el.dispatchEvent(new h.window.Event('change')); assert(await h.idle(8000), 'saving ' + k + ' did not finish'); }
  h.click('[data-close="dlgSettings"]');
}
// The clock, and the place when one is given, set through the Override panel the way a player with spoilers on sets them.
async function setClock(h, day, time, loc) { h.type('#ovrDay', String(day)); h.type('#ovrTime', time); h.type('#ovrLocation', loc || ''); h.click('#ovrClockSet'); assert(await h.settle(150, 6000), 'the clock override did not settle'); }
// The turn model's reply, with the given changes made to the default mock reply.
function patchTurns(h, patch) {
  h.mock.sampleHandler = (input, o, call) => {
    const out = h.mock.defaultHandler(input, o, call);
    if (!/^turn/.test(call.label)) return out;
    const r = JSON.parse(out); patch(r); return JSON.stringify(r);
  };
}

const loadWorld = () => { const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx); return ctx.window.WINDLASS_WORLDS.sundered; };
// The lore entries a prompt sends, by name, and the kinds <transformation> lists under "What raises influence".
const loreNames = (p) => (p.match(/<entry name="[^"]*"/g) || []).map((x) => x.slice(13, -1));
const raisesOf = (p) => (/What raises influence:\n((?:- [^\n]*\n?)+)/.exec(((/<transformation[^>]*>([\s\S]*?)<\/transformation>/.exec(p) || [])[1] || '')) || [])[1] || '';
// One turn on a fresh copy of the cow-roommate fixture (twenty-five turns, shed every turn), its settings changed as given: the
// lore budget the turn was shed to (none when it was not), the lore entries sent and the turn's notes.
async function playCowFixture(action, director, settings) {
  const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cow-roommate-25.json'), 'utf8'));
  const adv = JSON.parse(JSON.stringify(SAVE.adventure)); Object.assign(adv.settings, settings || {});
  const h = await boot({ setup: (w, mock) => {
    mock.store.set('adventures/' + SAVE.id, { data: adv, version: 1 });
    for (const [c, doc] of Object.entries(SAVE.turns)) mock.store.set('adventures/' + SAVE.id + '/turns/' + c, { data: doc, version: 1 });
  } });
  try {
    assert(await h.settle(150, 8000)); assert(await h.idle(20000), 'the save did not load');
    assert(await h.turn(action, { max: 30000, director }), 'the turn did not finish');
    const t = storedTurns(h.mock.store, SAVE.id).at(-1), cut = Number((/lore budget (\d+) characters/.exec(t.notes.join('\n')) || [])[1]);
    const entries = loreNames(promptOf(lastTurn(h)));
    clean(h);
    return { cut, entries, notes: t.notes };
  } finally { h.close(); }
}
// A game whose transformation state is set by hand: one turn played to make the save, then tf replaced and the page booted on it.
async function seededTf(o, makeTf, settings) {
  const first = await begin(o); let store;
  try { assert(await first.turn('I unpack.')); store = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
  const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = store.get(key).data;
  doc.state.tf = makeTf(loadWorld()); Object.assign(doc.settings, settings || {});
  const h = await boot({ setup(w, m) { m.store = store; } });
  assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
  return { h, id: key.split('/')[1] };
}
// A copy of a store, to boot a page on or to edit before booting.
const copyStore = (store) => new Map([...store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
// A game made by one played turn, as a copied store with its adventure document, to edit before booting a page on it.
async function savedGame(o) {
  const first = await begin(o); let store;
  try { assert(await first.turn('I unpack.')); store = copyStore(first.mock.store); } finally { first.close(); }
  const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k));
  return { store, key, id: key.split('/')[1], doc: store.get(key).data };
}
async function bootOn(store) {
  const h = await boot({ setup(w, m) { m.store = store; } });
  assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
  return h;
}
const stageAt = (j, n) => Math.ceil(j * 100 / n - 1e-9);
const emptyPath = () => ({ sex: null, sexTold: [], formTold: [], day: 1, order: [], eye: 'dark eyes, wide', breasts: 'heavy breasts', colour: 'red-and-white', draws: [] });
const baseTf = (kind, influence, prog) => ({ influence: { [kind]: influence }, traits: [], rungs: {}, arcs: [], tracks: [], paths: { [kind]: emptyPath() }, prog: { [kind]: prog }, last: { [kind]: 0 }, drifted: {} });
// Every part held where it stands until contact, except the ones named with open: true; { told: 'done' } is a finished part.
const heldParts = (M, set) => Object.fromEntries(M.map((t) => { const o = set[t.key] || {}, n = t.stages.length, told = o.told === 'done' ? n : o.told || 0; return [t.key, Object.assign({ s: o.s || 8, e: o.e || 30, p: o.p != null ? o.p : stageAt(told, n), told, ext: o.ext || 0, nextAt: o.nextAt || 0 }, o.at != null ? { at: o.at } : {}, o.open || o.told === 'done' ? {} : { eased: 0 })]; }));

// A man with a bovine roommate at the unbounded pace, an hour of intimate contact every turn, the path kept a man's (no way over): the
// waypoints told, one entry per turn that told one, and every turn prompt.
async function tfGame(turnsToRun, patch, who) {
  const h = await begin(Object.assign({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' }, who));
  const store = h.mock.store, id = onlyAdv(store).id;
  h.click('#btnSettings');
  for (const [sel, v] of [['#setPace', 'unbounded'], ['#setDensity', 'rich']]) { h.$(sel).value = v; h.$(sel).dispatchEvent(new h.window.Event('change')); assert(await h.idle(8000), 'the setting did not save'); }
  h.click('[data-close="dlgSettings"]');
  h.window.WINDLASS_WORLDS.sundered.transformation.sexChange.cow.chance = 0;
  patchTurns(h, (r) => { r.time_advance_minutes = 60; r.exposures = [{ species: 'cow', method: 'the evening with Daisy', intensity: 4 }]; r.state_updates = (r.state_updates || []).concat([{ key: 'present', op: 'append', value: ['Daisy Holm'] }]); if (patch) patch(r); });
  const prompts = [], told = [];
  for (let i = 0; i < turnsToRun; i++) {
    assert(await h.turn('I spend the evening with Daisy.'), 'turn ' + (i + 1));
    prompts.push(promptOf(lastTurn(h)));
    const t = storedTurns(store, id).at(-1);
    const m = t.notes.map((n) => /^change (begins|continues|complete): cow (.*?)(?: waypoint (\d+) of (\d+))?$/.exec(n)).filter(Boolean)[0];
    if (m) told.push({ turn: i + 1, kind: m[1], part: m[2].replace(/^\((.*)\)$/, '$1'), j: m[3] ? +m[3] : 1 });
  }
  return { h, store, id, prompts, told, tf: () => onlyAdv(store).data.state.tf };
}

const S = {
  // Halloway Attunement: salt taken during a stage-crossing fever keeps that crossing's marks owed; no second crossing while
  // they are pending; a matched kin draws +1 a night from Stage 0. Halloway is no longer in the game, so its world file comes
  // from WL_WORLDS when a build there still has it, otherwise from test/fixtures; runProgression comes from the page under test.
  async hallowayAttunement() {
    const src = fs.readFileSync(HTML, 'utf8');
    const a = src.indexOf('  function runProgression'), b = src.indexOf('  // ---------- per-species');
    assert(a > 0 && b > a, 'runProgression not found in the page');
    const local = path.join(WORLDS, 'halloway.js');
    // The retired world is kept as a test fixture (its last version), so the check needs no repository history.
    const hallowaySrc = fs.readFileSync(fs.existsSync(local) ? local : path.join(__dirname, 'fixtures', 'halloway.js'), 'utf8');
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(hallowaySrc, ctx);
    const W = ctx.window.WINDLASS_WORLDS.halloway;
    const runProgression = new Function('W', 'firstName', src.slice(a, b) + '\nreturn runProgression;')(W, () => 'Wren');
    const fresh = () => ({ items: JSON.parse(JSON.stringify(W.initialState.items)), flags: {} });
    const sk = W.progression.stateKey, pk = W.progression.progressKey;

    const s = fresh(); s.items[sk] = 1; s.items[pk] = 100;
    let r = runProgression(s, 0, []);
    assert.equal(s.items[sk], 2, 'progress 100 at Stage 1 must cross into Stage 2');
    assert(r.next.some((n) => /crossed into Stage 2/.test(n)), 'the crossing must be announced');
    // Next turn: reach-salt, enough to fill the bar again.
    s.items[pk] = 80; s.flags.salt_taken_this_turn = true;
    r = runProgression(s, 0, []);
    assert.equal(s.items[sk], 2, 'no second crossing while the Stage 2 marks are still owed');
    assert.equal(s.items[pk], 100, 'the salt adds its progress, which waits at 100');
    const breaks = [];
    for (let night = 1; night <= 3; night++) {
      r = runProgression(s, 1, []);
      breaks.push(...r.next.filter((n) => /fever has broken/.test(n)));
      if (night < 3) assert.equal(s.items[sk], 2, 'no second crossing during the fever (night ' + night + ')');
    }
    assert.equal(breaks.length, 1, 'the fever must break after three nights');
    assert.match(breaks[0], /Describe the new Stage 2 marks/, 'the broken fever must still bring the Stage 2 marks: ' + breaks[0]);
    assert.doesNotMatch(breaks[0], /no new marks appear/, 'the salt must not cancel the owed marks');

    // A matched kin at Stage 0: +1 a night; none matched: nothing.
    const k = fresh(); k.items[sk] = 0; k.items[pk] = 0; k.items.kin = 'Sable, a marsh fox (matched Day 3)';
    for (let i = 0; i < 3; i++) runProgression(k, 1, []);
    assert.equal(k.items[pk], 3, 'a matched kin at Stage 0 must add 1 progress a night');
    const n = fresh(); n.items[sk] = 0; n.items[pk] = 0; n.items.kin = 'none yet';
    for (let i = 0; i < 3; i++) runProgression(n, 1, []);
    assert.equal(n.items[pk], 0, 'no kin, no progress');
  },

  // The open adventure deleted on another device can be restored from this page with one button.
  async deletedElsewhereRestore() {
    const store = new Map();
    const a = await boot({ setup(w, m) { m.store = store; } });
    const b0 = [];
    try {
      assert(await a.settle(150, 6000)); a.click('#cBegin'); assert(await a.idle(15000));
      assert(await a.turn('I look around.'));
      const { id, data } = onlyAdv(store); const before = storedTurns(store, id).map((t) => t.action);
      assert.equal(before.length, data.turnCount);
      const b = await boot({ setup(w, m) { m.store = store; } }); b0.push(b);
      assert(await b.settle(150, 6000));
      for (const k of [...store.keys()]) if (k.startsWith('adventures/')) store.delete(k);   // Delete on device A
      b.$('#action').value = 'I open the window.'; b.click('#send'); await b.idle(5000);
      assert.match(statusText(b), /deleted from another device/, 'the deletion must be reported: ' + statusText(b));
      const btn = statusButtons(b).find((x) => /Restore it here/.test(x.textContent));
      assert(btn, 'the status must offer "Restore it here"; buttons: ' + JSON.stringify(statusButtons(b).map((x) => x.textContent)));
      b.click(btn); assert(await b.idle(10000)); await b.settle(100, 4000);
      const restored = onlyAdv(store);
      assert.equal(restored.id, id, 'the same adventure is restored');
      assert.deepEqual(storedTurns(store, id).map((t) => t.action), before, 'every turn is restored');
      assert(await b.turn('I open the window.'), 'the next turn did not finish');
      const after = onlyAdv(store);
      assert.equal(after.data.turnCount, before.length + 1, 'the following turn is saved');
      assert.equal(storedTurns(store, id).at(-1).action, 'I open the window.');
      clean(b);
    } finally { a.close(); b0.forEach((x) => x.close()); }
  },

  // A background sync reload (focus) of the open adventure gives way when the player opens another adventure meanwhile.
  async syncYieldsToOpen() {
    const store = new Map(); const pages = [];
    try {
      const a = await boot({ setup(w, m) { m.store = store; } }); pages.push(a);
      assert(await a.settle(150, 6000)); a.click('#cBegin'); assert(await a.idle(15000));
      assert(await a.turn('I look around.'));
      a.click('#btnAdventures'); await a.settle(100, 3000);
      a.click(a.$('#advlist .advrow [data-act="copy"]'));
      a.$('#advlist .confirm input').value = 'Copy Y';
      a.click(a.$('#advlist .confirm button')); assert(await a.idle(5000));
      const ids = advDocs(store).map(([k, v]) => ({ id: k.split('/')[1], title: v.data.title }));
      assert.equal(ids.length, 2, 'the copy must be saved');
      const X = ids.find((x) => x.title !== 'Copy Y').id, Y = ids.find((x) => x.title === 'Copy Y').id;
      a.$('#dlgAdventures').close();
      const b = await boot({ setup(w, m) { m.store = store; } }); pages.push(b);
      assert(await b.settle(150, 6000));
      assert.equal(b.window.localStorage.getItem('windlass.last'), X, 'B opens X, the most recently played');
      assert(await a.turn('A: a newer turn on X.'));
      // B's reload of X is held by a gate; while it is held, the player opens Y; then the reload finishes.
      let release, held = false; const gate = new Promise((r) => { release = r; });
      b.mock.dbGate = (op, p) => (p === 'adventures/' + X + '/turns' ? ((held = true), gate) : null);
      b.click('#btnAdventures'); await b.settle(100, 3000);
      b.window.dispatchEvent(new b.window.Event('focus'));
      await b.until(() => held, 'the reload of X to start');
      const yRow = [...b.document.querySelectorAll('#advlist .advrow')].find((r) => /Copy Y/.test(r.textContent));
      b.click(yRow.querySelector('[data-act="open"]'));
      await b.until(() => b.window.localStorage.getItem('windlass.last') === Y, 'Y to open while the reload of X is held');
      b.mock.dbGate = null; release();
      assert(await b.idle(10000)); await b.settle(100, 3000); await b.idle(5000);
      assert.equal(b.window.localStorage.getItem('windlass.last'), Y, 'the adventure the player opened must stay open');
      assert(!b.$('#feed').textContent.includes('A: a newer turn'), 'the sync must not put X back on screen');
      assert.doesNotMatch(statusText(b), /Picked up the newer save/, 'no sync message for an adventure no longer open');
      clean(b);
    } finally { pages.forEach((x) => x.close()); }
  },

  // A turn taken on the placeholder while the saves still load is refused and saves nothing.
  async turnDuringSlowBoot() {
    const store = new Map(); const pages = [];
    try {
      const a = await boot({ setup(w, m) { m.store = store; } }); pages.push(a);
      assert(await a.settle(150, 6000)); a.click('#cBegin'); assert(await a.idle(15000));
      assert(await a.turn('I look around.'));
      const { id } = onlyAdv(store); a.close(); pages.length = 0;
      // The saves query is held by a gate, not a delay, so a slow machine cannot let it finish before the turn is tried.
      let release, held = false; const gate = new Promise((r) => { release = r; });
      const b = await boot({ setup(w, m) { m.store = store; m.dbGate = (op, p) => (op === 'query' && p === 'adventures' ? ((held = true), gate) : null); } }); pages.push(b);
      await b.until(() => held, 'the saves query to be held');
      const callsBefore = turnCalls(b).length;
      assert(await b.turn('I unpack my bag.', { refused: true }), 'no turn call on the placeholder');
      await b.until(() => /still loading/.test(statusText(b)), 'the turn to be refused: ' + statusText(b));
      assert(!b.mock.dbLog.some((e) => e.op === 'query' && e.path === 'adventures'), 'the saves were still loading when the turn was tried');
      assert.equal(turnCalls(b).length, callsBefore, 'no turn call on the placeholder');
      release();
      assert(await b.idle(15000)); await b.sleep(300); await b.idle(5000);
      assert.equal(advDocs(store).length, 1, 'no adventure document may be created for the placeholder');
      assert.equal(onlyAdv(store).id, id);
      assert(!b.$('#feed').textContent.includes('I unpack my bag'), 'the refused turn is not shown');
      // h.turn() says when no turn ran: an empty action is refused, and {refused: true} is false once a turn does run.
      assert(await b.turn('   ', { refused: true }), 'an empty action starts no turn');
      assert.match(statusText(b), /Write an action first/, 'and says why');
      assert.equal(await b.turn('I unpack my bag.', { refused: true }), false, 'a turn that runs is not a refusal');
      assert(await b.idle(15000));
      clean(b);
    } finally { pages.forEach((x) => x.close()); }
  },

  // resource_exhausted is a passing refusal: Retry save; quota_exceeded says the store is full.
  async saveErrorCodes() {
    for (const [code, msg] of [['resource_exhausted', 'per-viewer call rate exceeded'], ['quota_exceeded', 'quota exceeded']]) {
      const h = await begin();
      try {
        const n0 = onlyAdv(h.mock.store).data.turnCount;
        h.mock.dbFail = (op) => (op === 'set' ? { code, message: msg } : null);
        await h.turn('I look around.');
        const labels = statusButtons(h).map((x) => x.textContent);
        if (code === 'resource_exhausted') {
          assert(labels.includes('Retry save'), code + ' must offer Retry save; got ' + JSON.stringify(labels) + ' / ' + statusText(h));
          assert(!labels.includes('Export a copy'), code + ' must not send the player to export');
          h.mock.dbFail = null;
          h.click(statusButtons(h).find((x) => x.textContent === 'Retry save')); assert(await h.idle(8000));
          assert.equal(onlyAdv(h.mock.store).data.turnCount, n0 + 1, 'Retry save saves the turn');
          assert.equal(statusText(h), '', 'the error clears once saved');
        } else {
          assert.match(statusText(h), /store is full/, code + ' must say the store is full: ' + statusText(h));
        }
        // A refused save is reported by the page, not thrown.
        assert(!h.errors.some((e) => e.kind === 'jsdomError'), JSON.stringify(h.errors));
      } finally { h.close(); }
    }
  },

  // Free-form invention cannot add anatomy that is absent from the kind's world data.
  async inventedAnatomyDropped() {
    const h = await begin({
      name: 'Mira Holt', rmSpecies: 'cow',
      setup(w, m) {
        m.sampleHandler = (input, o, call) => {
          const r = m.defaultHandler(input, o, call);
          if (call.label !== 'cast invention') return r;
          const d = JSON.parse(r);
          for (const p of d.people) {
            if (p.key === 'roommate') { p.detail = 'a forked tongue behind the teeth'; p.quirk = 'flexes small folded wings at the shoulder blades when nervous'; }
            if (p.key === 'runner_human') { p.detail = 'five arms folded beneath the coat'; p.quirk = 'tucks a forked tail into a coat pocket'; }
            if (p.key === 'creamery') { p.detail = 'a chipped front tooth'; p.quirk = 'hums the same three bars while counting change'; }
            if (p.key === 'choir') p.quirk = 'scratches her second head when thinking';
          }
          return JSON.stringify(d);
        };
      },
    });
    try {
      const { data } = onlyAdv(h.mock.store);
      const people = [data.roommate].concat(data.cast.generated.characters);
      const all = JSON.stringify(people);
      assert(people.length > 3 && data.cast.generated.characters.some((c) => c.key === 'runner_human'), 'the generated cast must include runner_human');
      assert.doesNotMatch(all, /forked tongue|five arms|forked tail|second head/, 'free-form anatomy must never reach a description or quirk');
      assert.doesNotMatch(all, /third arm/, 'an extra arm must never reach a description');
      assert.doesNotMatch(JSON.stringify(data.roommate), /folded wings/, 'wings on a kind without wings must never reach a quirk');
      const cream = data.cast.generated.characters.find((c) => c.key === 'creamery');
      assert.doesNotMatch(JSON.stringify(cream), /chipped front tooth/, 'free-form anatomy details are not appended to the world-defined body');
      // A harmless invented habit is still kept: only habits naming a body part the kind lacks are dropped.
      assert.match(JSON.stringify(cream), /hums the same three bars while counting change/, 'a harmless invented quirk is kept in the character');
      clean(h);
    } finally { h.close(); }
  },

  // The page's own anatomy check against the Sundered cow: impossible counts and ordinals are refused, the kind's own
  // structures and counts and ordinary habits pass.
  async anatomyCounts() {
    const src = fs.readFileSync(HTML, 'utf8');
    const a = src.indexOf('  const ANATOMY_WORDS'), b = src.indexOf('  // Draws one person from the pools');
    assert(a > 0 && b > a, 'the anatomy check must be in the page');
    const escRe = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const { anatomyFits: fits, kindAnatomy } = new Function('escRe', src.slice(a, b) + '\nreturn { anatomyFits, kindAnatomy };')(escRe);
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    // A kind's body as the page reads it for a woman of the kind: the pool and the finished track lines for her sex.
    const Wk = ctx.window.WINDLASS_WORLDS.sundered, species = Object.fromEntries(Object.entries(Wk.genPools.species).map(([k, sp]) => [k, kindAnatomy(Wk, k, sp, 'female')])), cow = species.cow;
    for (const t of ['flicks her two tails when amused', 'has eleven arms', 'scratches her second head when thinking', 'rubs three long muscular arms', 'a third arm folded away',
      'a second smaller head', 'a second, smaller head that sleeps', 'grows a second pair of arms', 'grows an extra pair of arms', 'talks out of her other mouth', 'has two heads', 'keeps a spare tail',
      'folds her three pairs of arms', 'scratches her fourth pair of arms', 'stretches two pairs of legs', 'grows a third pair of arms', 'flicks her two pairs of tails',
      'folds her seven pairs of arms', 'stretches twelve sets of legs', 'scratches her seventh pair of arms', 'shakes her seven heads', 'has twenty heads', 'flicks her 13th tail',
      'scratches her third pair of eyes', 'grows a fourth pair of hands', 'opens a 3rd set of eyes',
      // Ordinals on the kind's own parts are counts: the cow has one tail, two ears, two horns and four teats. A pair past the first
      // is a body's after "her", in a row, or of any part at all when "extra".
      'scratches her third pair of ears', 'polishes her fourth set of horns', 'flicks her second tail', 'twitches her third ear', 'tugs her fifth teat', 'grows an extra pair of ears',
      'scratches her second pair of eyes', 'scratches her 2nd pair of eyes', 'rubs her extra pair of hands', 'blinks her second row of eyes', 'blinks a second row of eyes',
      'blinks her third and fourth pairs of eyes', 'blinks her third, smaller pair of eyes', 'blinks her twenty-first pair of eyes', 'blinks her twenty-second pair of eyes', 'has twenty-one arms',
      'tugs her fifth, swollen teat', 'flicks her second, smaller tail', 'scratches her third, torn ear', 'taps her seventh hoof', 'has nine hooves', 'has four hoof-thumbs']) assert.equal(fits(t, cow), false, 'refused: ' + t);
    // Time, idiom and a pronoun or preposition between the number and the part are not anatomy.
    for (const t of ['swishes her tail when amused', 'hums while counting change', 'taps two fingers on the table',
      'takes a second to scratch her head before answering', 'gives another shake of her head', 'touches the other side of her face when thinking',
      'for the third time rubs her eyes', 'counts to three and closes her eyes', 'takes a second glance, head tilted', 'pauses a split second, head tilted',
      'waits a second, mouth open', 'holds her mug in her spare hand', 'never wants another mouth to feed', 'could use an extra pair of hands',
      'spends two hours brushing her tail', 'counts to two while swishing her tail', 'hums three notes while her tail sways',
      'could use a second pair of eyes', 'wishes for two pairs of hands', 'scans two rows of faces in the choir', 'buys three pairs of socks for her legs',
      'counts to seventeen while her tail sways', 'for the seventh time rubs her eyes',
      // A pair of things, then her own hands or eyes; a teat she has; "a second" as time before a comma.
      'darns her third pair of stockings, both hands busy', 'sits in the third row of benches, both hands in her lap', 'hauls the third set of nets, bare hands raw', 'reads the third set of minutes, tired eyes narrowed',
      'tugs her fourth teat', 'tugs her fourth, swollen teat', 'scratches her second ear', 'taps her second hoof', 'taps her third hoof', 'has three hooves on each hand', 'grips the mug with two hoof-fingers', 'pauses a second, long tail swishing', 'waits one second, long tail swishing', 'gives it another second, soft ears forward', 'waits a second then flicks her tail', 'a second later her tail flicks']) assert.equal(fits(t, cow), true, 'kept: ' + t);
    // Horns are a bull's: a bovine man's second horn is his own, a bovine woman has none to count.
    assert.equal(fits('polishes his second horn', kindAnatomy(Wk, 'cow', Wk.genPools.species.cow, 'male')), true, 'a bovine man has two horns');
    assert.equal(fits('polishes her second horn', cow), false, 'a bovine woman has no horns');
    // The kind's own counts set the bar: the fox's two tails, the cat's three more pairs of nipples (four at the most), the wolf's two more pairs.
    // The fox's tail runs to "two or three full tails" at the most, so a third is hers and a fourth is not.
    for (const t of ['flicks her second tail', 'flicks her third tail']) assert.equal(fits(t, species.fox), true, 'the fox has it: ' + t);
    for (const t of ['flicks her fourth tail', 'flicks her second pair of tails']) assert.equal(fits(t, species.fox), false, 'refused for the fox: ' + t);
    assert.equal(fits('the fur over her third pair of nipples is paler', species.cat), true, 'the cat has more pairs');
    assert.equal(fits('the fur over her fifth pair of nipples is paler', species.cat), false, 'the cat has no fifth pair');
    for (const t of ['the fur over her fifth and third pairs of nipples is paler', 'the fur over her third, fifth and second pairs of nipples is paler', 'the fur over her third or fifth pairs of nipples is paler']) assert.equal(fits(t, species.cat), false, 'joined ordinals take the largest: ' + t);
    assert.equal(fits('the fur over her second and third pairs of nipples is paler', species.cat), true, 'joined ordinals the cat has');
    assert.equal(fits('the fur over her second pair of nipples is paler', species.wolf), true, 'the wolf has two more pairs');
    assert.equal(fits('the fur over her second pair of nipples is paler', cow), false, 'the cow has no pairs');
    // A figure is the same count as the word: the fox's own two tails pass either way, and no kind has two heads.
    const fox = species.fox;
    for (const t of ['flicks her two tails when amused', 'flicks her 2 tails when amused', 'flicks her three tails', 'flicks her 3 tails']) { assert.equal(fits(t, fox), true, 'the fox kept: ' + t); assert.equal(fits(t, cow), false, 'the cow refused: ' + t); }
    for (const t of ['has 2 heads', 'flicks her 4 tails', 'flicks her four tails', 'flicks her two pairs of tails', 'flicks her thirteen tails', 'flicks her twenty tails']) assert.equal(fits(t, fox), false, 'the fox refused: ' + t);
    // A pair or row the kind's own text gives passes: a kind written with two rows of teats keeps a habit about them.
    const rows = { body: ['two rows of small teats down the belly'] };
    assert.equal(fits('counts her two rows of teats', rows), true, 'the kind\'s own rows kept');
    assert.equal(fits('counts her three rows of teats', rows), false, 'three rows refused');
  },

  // A cast invention prompt carries the rule for a field only when someone in its batch is asked for that field (names and
  // register always): a batch that asks nobody's background or personality has no rule for them, and nothing asks for a free
  // detail of the body.
  async inventPromptCarriesOnlyAskedRules() {
    const h = await begin({ rmSpecies: 'cow' });
    try {
      const calls = h.mock.sampleCalls.filter((c) => /^cast invention/.test(c.label));
      assert(calls.length, 'the cast was invented');
      for (const c of calls) {
        const p = promptOf(c), asked = new Set((blockOf(p, 'people').match(/Fields: [^.]*/g) || []).flatMap((x) => x.slice(8).split(', ')));
        const keys = (blockOf(p, 'rules').match(/^- (\w+):/gm) || []).map((x) => x.slice(2, -1)).filter((k) => k !== 'Names' && k !== 'Register');
        assert.match(blockOf(p, 'rules'), /^- Names:/m, 'the rules were read: ' + blockOf(p, 'rules').slice(0, 200));
        assert.deepEqual(keys.filter((k) => !asked.has(k)), [], c.label + ' carries rules for fields nobody in it is asked for (asked: ' + [...asked].join(', ') + ')');
        assert.doesNotMatch(p, /Detail seed:|^- detail:/m, c.label + ' asks for a detail of the body');
      }
      clean(h);
    } finally { h.close(); }
  },

  // The generated cast never takes the player's first name, and an invented first name with a space is refused.
  async inventedNames() {
    const h = await begin({
      name: 'Mira Holt', rmSpecies: 'cow',
      setup(w, m) {
        m.sampleHandler = (input, o, call) => {
          const r = m.defaultHandler(input, o, call);
          if (call.label !== 'cast invention') return r;
          const d = JSON.parse(r);
          const others = d.people.filter((p) => !['roommate', 'creamery', 'choir'].includes(p.key) && 'first' in p);
          if (others[0]) others[0].first = 'MIRA';
          if (others[1]) others[1].last = 'Holt Lane';
          for (const p of d.people) {
            if (p.key === 'roommate') { p.first = 'Tessa'; p.last = 'Holt Lane'; }
            if (p.key === 'creamery') { p.first = 'Mira'; p.last = 'Quell'; }
            if (p.key === 'choir') { p.first = 'Mary Ann'; p.last = 'Stroud'; }
          }
          return JSON.stringify(d);
        };
      },
    });
    try {
      const { data } = onlyAdv(h.mock.store);
      const chars = data.cast.generated.characters;
      assert(chars.some((c) => c.key === 'creamery') && chars.some((c) => c.key === 'choir'));
      for (const c of chars) {
        assert.notEqual(String(c.first || c.name.split(' ')[0]).toLowerCase(), 'mira', c.key + ' must not share the player\'s first name: ' + c.name);
        assert.doesNotMatch(c.name, /Mary Ann/, c.key + ' must not take a two-word first name: ' + c.name);
        assert(!/\s/.test(c.first || ''), c.key + ' first name has a space: ' + c.first);
        assert.doesNotMatch(String(c.last || ''), /holt/i, c.key + ' must not take the player\'s surname, however written: ' + c.name);
      }
      assert.notEqual(data.roommate.first, 'Mira');
      assert.doesNotMatch(data.roommate.last, /Holt/i, 'an invented roommate cannot embed the player surname in a multiword name');
      clean(h);
    } finally { h.close(); }
  },

  // Renaming the roommate in the Cast editor reaches every {rm_*} in the next turn prompt; the aliases follow the name.
  async roommateRename() {
    // The narrator may list her by her given name alone; the rename must carry that entry over too.
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    let seeded; try { seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)); seeded.get(advKey).data.state.present = ['Daisy'];
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      assert.deepEqual(Array.from(onlyAdv(h.mock.store).data.state.present), ['Daisy'], 'the roommate is listed present by given name');
      h.click('#btnCast'); await h.sleep(20);
      assert.equal(h.$('#cfName').value, 'Daisy Clover', 'the roommate is selected in the Cast editor');
      h.$('#cfName').value = 'Bess Morrow'; h.$('#cfAliases').value = 'Daisy, Clover, Dee';
      h.click('#cfSave'); assert(await h.idle(10000));
      h.click('[data-close="dlgCast"]');
      assert(await h.turn('I say hello to my roommate.'));
      const p = promptOf(lastTurn(h));
      const sections = (p.match(/<(lore|style_examples)\b[^>]*>[\s\S]*?<\/\1>/g) || []).join('\n');
      assert(/<lore\b/.test(sections), 'the lore section must be in the prompt');
      assert(/The roommate is Bess Morrow/.test(sections), 'the world text filled with {rm_name} must name Bess Morrow');
      assert.doesNotMatch(sections, /Daisy/, 'the old name must not reach the lore or style examples: ' + (sections.match(/[^\n]{0,80}Daisy[^\n]{0,40}/) || [''])[0]);
      assert.match(p, /Bess/);
      const { data } = onlyAdv(h.mock.store);
      const ov = data.cast.overrides[data.roommate.key];
      assert(ov, 'the rename is saved as an override');
      assert(!data.state.present.some((x) => /Daisy/.test(x)) && data.state.present.includes('Bess'), 'a given-name presence entry follows the rename: ' + JSON.stringify(data.state.present));
      assert.deepEqual(Array.from(ov.aliases), ['Bess', 'Morrow', 'Dee'], 'the old given name and surname are swapped for the new ones; other aliases stay');
      clean(h);
    } finally { h.close(); }
  },

  // Presence entries in any case, by the surname's last word, or with a "(Race)" label follow a rename, and the reset to how
  // the adventure first wrote the person carries them back, so the roommate stays present through both.
  async renameResetPresence() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holt Lane' });
    let seeded; try { seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k));
    const rm = seeded.get(advKey).data.roommate;
    assert.equal(rm.name, 'Daisy Holt Lane', 'the roommate keeps the three-word name: ' + rm.name);
    seeded.get(advKey).data.state.present = ['daisy (Cow)', 'Lane', 'Someone Else'];
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      const present = () => Array.from(onlyAdv(h.mock.store).data.state.present);
      assert.deepEqual(present(), ['daisy (Cow)', 'Lane', 'Someone Else']);
      h.click('#btnCast'); await h.sleep(20);
      assert.equal(h.$('#cfName').value, 'Daisy Holt Lane', 'the roommate is selected in the Cast editor');
      h.$('#cfName').value = 'Bess Morrow';
      h.click('#cfSave'); assert(await h.idle(10000));
      assert.deepEqual(present(), ['Bess (Cow)', 'Morrow', 'Someone Else'], 'a lower-case given name keeps its label and the final surname word follows the rename');
      h.click('#cfReset'); assert(await h.idle(10000)); await h.sleep(20);
      assert.equal(h.$('#cfName').value, 'Daisy Holt Lane', 'the reset restores the world\'s name');
      assert.deepEqual(present(), ['Daisy (Cow)', 'Holt Lane', 'Someone Else'], 'the reset carries the given name and surname entries back');
      clean(h);
    } finally { h.close(); }
  },

  // A tight lore budget sheds what the recent story only brushed past before what the player's own action names: the
  // dorm entry the action asks for stays in, ahead of a higher-priority kind the last turn happened to mention.
  async loreFromAction() {
    const first = await begin({ rmSpecies: 'cow' });
    let seeded; try { seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)); seeded.get(advKey).data.settings.loreBudget = 1000;
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      patchTurns(h, (r) => { r.narrative = 'A harpy feather drifts down past the window and settles on the sill. ' + r.narrative; });
      assert(await h.turn('I look out of the window.'));
      assert(await h.turn('I go back up to room 4B and sit on my bed.'));
      const entries = (promptOf(lastTurn(h)).match(/<entry name="[^"]*"/g) || []).map((x) => x.slice(13, -1));
      assert(entries.includes('Kettle Hall and room 4B'), 'the entry the action names must survive the budget: ' + JSON.stringify(entries));
      clean(h);
    } finally { h.close(); }
  },

  // 8d. Everyday words in the story pull no lore: a lake view, a bead of milk, warm hide, somewhere below, the quad, a lap, a
  // ring, the library, a ledge and the pool bring no mer, cat or fairy entry, no charms, glamours, places, Isle or mixer, when
  // nobody of those kinds is about, and <transformation> lists no contacts for those kinds. Nor do turning back to someone,
  // the edge of the bed or feeling healthy in the action bring the Spa or the Edge.
  async loreEverydayWords() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      // Two verbatim turns, both of them this text, so the opening's own mentions (the mixer, the Isle) are out of the window.
      h.click('#btnSettings'); h.$('#setWindow').value = '2'; h.$('#setWindow').dispatchEvent(new h.window.Event('change')); assert(await h.idle(8000)); h.click('[data-close="dlgSettings"]');
      patchTurns(h, (r) => { r.narrative = 'Daisy sits by the window with its view of the lake, a mug held in her lap, a bead of milk at the rim. The quad is loud somewhere below; the room smells of hay and warm hide, and the dark ring of the lamp on the ceiling does not move. This evening she means to stay in, and tonight the bell will ring. She came back from the library and set her book on the window ledge by the pool schedule.'; r.state_updates = [{ key: 'present', op: 'set', value: ['Daisy Clover'] }]; });
      assert(await h.turn('I sit down with Daisy.'));
      assert(await h.turn('I listen to Daisy.'));
      assert(await h.turn('I turn back to Daisy, sit on the edge of the bed and ask if she is feeling healthy.'));
      const p = promptOf(lastTurn(h)), entries = (p.match(/<entry name="[^"]*"/g) || []).map((x) => x.slice(13, -1));
      assert(entries.includes('species: cow'), 'the kind in the scene keeps its entry: ' + JSON.stringify(entries));
      const stray = entries.filter((n) => ['species: mer', 'species: cat', 'species: fairy', 'charms, curses and the Unpriced Table', 'glamours and the world below', 'places', 'the Isle and the Edge', 'the mixer', 'daily life', 'the Restoration Spa'].includes(n));
      assert.deepEqual(stray, [], 'everyday words pulled unrelated lore: ' + JSON.stringify(entries));
      const raise = (/What raises influence:\n((?:- [^\n]*\n?)+)/.exec(((/<transformation[^>]*>([\s\S]*?)<\/transformation>/.exec(p) || [])[1] || '')) || [])[1] || '';
      assert.match(raise, /^- cow /m, 'the kind in the scene has its contacts: ' + raise.slice(0, 200));
      assert.doesNotMatch(raise, /^- (?:cat|mer|fairy) /m, 'everyday words listed contacts for kinds nobody in the scene belongs to: ' + raise);
      clean(h);
    } finally { h.close(); }
  },

  // 8e. On a game that sheds every turn (the cow-roommate fixture, here with its lore cut to 1,500 characters), the entry the
  // player's action asks about comes ahead of the player's own kind and of what the story only mentioned: asking how the
  // Restoration Spa works gets the Spa's lore, and asking what a charm at the night market does gets the charms entry, not the
  // goblins' (whose lore shares the market and the charm but whom the action does not name); the kind stays too. And on a low lore
  // setting of the player's own (2,000) the kind changing the player is counted first, ahead of the Unpriced Table asked about.
  async loreAskedBeatsOwnKind() {
    const play = playCowFixture;
    // A long director note pushes the turn down the shedding chain to a lore budget of 1,500 characters; a shorter one if that went
    // a step further (lore for the kinds alone), since a longer action needs less of a push.
    for (const [action, asked] of [['I ask how the Restoration Spa works.', 'the Restoration Spa'], ['I browse the charms at the night market and ask what a charm does.', 'charms, curses and the Unpriced Table']]) {
      let r;
      for (let len = 6000; len >= 4000; len -= 500) { r = await play(action, 'Keep the scene in the room. '.repeat(215).slice(0, len)); if (r.cut || !r.notes.some((n) => /lore only for the kinds/.test(n))) break; }
      const { cut, entries, notes } = r;
      assert(cut && cut <= 2000, action + ' sheds its lore to a tight budget: ' + JSON.stringify(notes));
      assert(entries.includes(asked), 'the entry the action asks about survives the budget: ' + JSON.stringify(entries));
      assert(entries.includes('species: cow'), 'the kind changing the player stays: ' + JSON.stringify(entries));
    }
    const { entries } = await play('I ask about the Unpriced Table.', '', { loreBudget: 2000 });
    assert(entries.includes('species: cow'), 'on a low lore setting the kind changing the player is kept: ' + JSON.stringify(entries));
  },

  // A kind asked after in the plural, or by a name people give it, is asked after: "What are wolves like?" brings the werewolves'
  // lore and lists their contacts as "What is a werewolf like?" does, for every kind. On a game that sheds every turn, asking what
  // rabbits are like keeps the rabbits' entry as asking what a rabbit is like does.
  async lorePluralAsk() {
    const h = await begin({ rmSpecies: 'harpy', rmName: 'Wren Skye' });
    try {
      for (const [kind, words] of [['wolf', 'wolves'], ['dryad', 'dryads'], ['goblin', 'goblins'], ['fox', 'foxes'], ['cow', 'cows'], ['cat', 'cats'], ['mer', 'mermen'], ['rabbit', 'rabbits'], ['fairy', 'fairies']]) {
        assert(await h.turn('What are ' + words + ' like?'), 'the turn about ' + words + ' did not finish');
        const p = promptOf(lastTurn(h));
        assert(loreNames(p).includes('species: ' + kind), '"' + words + '" brings the ' + kind + ' lore: ' + JSON.stringify(loreNames(p)));
        assert.match(raisesOf(p), new RegExp('^- ' + kind + ' \\(', 'm'), '"' + words + '" lists the ' + kind + ' contacts: ' + raisesOf(p).slice(0, 300));
      }
      clean(h);
    } finally { h.close(); }
    let r;
    for (let len = 6000; len >= 4000; len -= 500) { r = await playCowFixture('I ask what rabbits are like.', 'Keep the scene in the room. '.repeat(215).slice(0, len)); if (r.cut || !r.notes.some((n) => /lore only for the kinds/.test(n))) break; }
    assert(r.cut && r.cut <= 2000, 'the turn sheds its lore to a tight budget: ' + JSON.stringify(r.notes));
    assert(r.entries.includes('species: rabbit'), 'the kind asked after in the plural survives the budget: ' + JSON.stringify(r.entries));
  },

  // Everyday words in the player's own action pull no kind into the scene: packing a bag, a nap, a game of cards, a purring
  // kettle and a pass by a fluke bring no werewolf, cat, fox or mer lore and list no contacts for those kinds while only the
  // bovine roommate is about. Asking after the
  // Moonrunners, the werewolves' own run, still brings both.
  async loreEverydayActionWords() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      patchTurns(h, (r) => { r.state_updates = [{ key: 'present', op: 'set', value: ['Daisy Clover'] }]; });
      for (const action of ['I pack my bag for class.', 'I take a nap on my bed.', 'I play a game of cards and make a bet.', 'The kettle purrs and I tell her my pass was a fluke.']) {
        assert(await h.turn(action), action + ' did not finish');
        const p = promptOf(lastTurn(h));
        assert.deepEqual(loreNames(p).filter((n) => /^species: (?:wolf|cat|fox|mer)$/.test(n)), [], action + ' pulled lore of a kind nobody here belongs to: ' + JSON.stringify(loreNames(p)));
        assert.doesNotMatch(raisesOf(p), /^- (?:wolf|cat|fox|mer) /m, action + ' listed contacts for a kind nobody here belongs to: ' + raisesOf(p));
      }
      assert(await h.turn('I ask Daisy about the Moonrunners.'));
      const p = promptOf(lastTurn(h));
      assert.match(raisesOf(p), /^- wolf /m, 'the werewolves\' own run brings their contacts: ' + raisesOf(p));
      assert(loreNames(p).includes('species: wolf'), 'and their lore: ' + JSON.stringify(loreNames(p)));
      clean(h);
    } finally { h.close(); }
  },

  // A minor figure in an intimate scene is here as a cast member is: with a bovine woman among the minor figures the only one
  // present, the bovine woman's example is among the style examples the narrator is shown.
  async minorKindExample() {
    const first = await begin({ rmSpecies: 'harpy', rmName: 'Wren Skye' }); let store;
    try { store = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const doc = store.get([...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k))).data, m = (doc.cast.generated.minors || [])[0];
    assert(m, 'the test needs a minor figure');
    Object.assign(m, { species: 'cow', gender: 'female', pronouns: { they: 'she', them: 'her', their: 'her', theirs: 'hers', themself: 'herself' } });
    const h = await boot({ setup(w, mk) { mk.store = store; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      const cow = h.window.WINDLASS_WORLDS.sundered.exemplars.find((e) => e.kind === 'cow' && e.scene === 'intimate');
      patchTurns(h, (r) => { r.state_updates = [{ key: 'present', op: 'set', value: [m.name] }]; });
      let seen = false;
      for (let i = 0; i < 4; i++) { assert(await h.turn('Make love to ' + m.first + '.'), 'turn did not finish'); seen = seen || blockOf(promptOf(lastTurn(h)), 'style_examples').includes(cow.text.slice(0, 60)); }
      assert(seen, 'the bovine woman\'s example is shown with ' + m.name + ', a bovine woman among the minor figures, present');
      clean(h);
    } finally { h.close(); }
  },

  // A minor figure in the scene is here as a cast member is: with the fox who teaches Glamour present and nobody naming the
  // kind, the foxes' lore is sent along with their contacts.
  async minorKindLoreInScene() {
    const h = await begin({ rmSpecies: 'harpy', rmName: 'Wren Skye', seed: 14 });
    try {
      const m = (onlyAdv(h.mock.store).data.cast.generated.minors || []).find((x) => x.key === 'glamour_prof');
      assert(m && m.species === 'fox', 'the test needs the Glamour professor to be a fox: ' + JSON.stringify(m && [m.name, m.species]));
      patchTurns(h, (r) => { r.state_updates = [{ key: 'present', op: 'set', value: ['Wren Skye', m.name] }]; });
      assert(await h.turn('I find a seat near the front.'));
      assert(await h.turn('I look around the room.'));
      const p = promptOf(lastTurn(h));
      assert.doesNotMatch('I look around the room.\n' + m.name, /\bfox|kitsune/i, 'the test needs the kind unnamed');
      assert(loreNames(p).includes('species: fox'), 'the kind of a minor figure in the scene has its lore: ' + JSON.stringify(loreNames(p)));
      assert.match(raisesOf(p), /^- fox /m, 'and its contacts: ' + raisesOf(p));
      clean(h);
    } finally { h.close(); }
  },

  // The roommate's kind reads as one person's in the memory the narrator is sent, "(harpy, second-year)", not the kind's plural,
  // and a kind whose name carries a bracket gives no bracket inside a bracket. A kind changed in the Cast editor is changed there too.
  async roommateKindLabel() {
    for (const [sp, want] of [['harpy', /Tamsin Varrow \(harpy, second-year\)/], ['fox', /Tamsin Varrow \((?:kitsune|fox), second-year\)/]]) {
      const h = await begin({ rmSpecies: sp, rmName: 'Tamsin Varrow' });
      try {
        assert(await h.turn('I unpack.'));
        const p = promptOf(lastTurn(h)), mem = blockOf(p, 'facts') + '\n' + blockOf(p, 'timeline');
        assert.match(blockOf(p, 'facts'), want, sp + ': the facts name one person\'s kind: ' + blockOf(p, 'facts').slice(0, 400));
        assert.doesNotMatch(mem, /\((?:harpies|fox mythkin)|, harpies,|\(\(|\)\)/, sp + ': the memory names the kind in the plural or nests brackets: ' + mem.slice(0, 600));
        if (sp === 'harpy') {
          h.click('#btnCast'); await h.sleep(20);
          assert.equal(h.$('#cfName').value, 'Tamsin Varrow', 'the roommate is selected in the Cast editor');
          h.type('#cfSpecies', 'Werewolf'); h.click('#cfSave'); assert(await h.idle(10000)); h.click('[data-close="dlgCast"]');
          assert(await h.turn('I look around.'));
          const q = promptOf(lastTurn(h)), qm = blockOf(q, 'facts') + '\n' + blockOf(q, 'timeline');
          assert.match(blockOf(q, 'facts'), /Tamsin Varrow \(werewolf, second-year\)/, 'the kind changed in Cast reaches the facts: ' + blockOf(q, 'facts').slice(0, 400));
          assert.doesNotMatch(qm, /Tamsin Varrow[ (,]+harp/i, 'and the old kind is gone from the memory: ' + qm.slice(0, 600));
        }
        clean(h);
      } finally { h.close(); }
    }
  },

  // 9. A cast member listed present by first name only gets the full sheet and the Focus line, even when nothing else they
  // answer to (aliases cleared in the Cast editor) carries that first name: the given name counts on its own.
  async firstNamePresent() {
    const h = await begin();
    try {
      const { data } = onlyAdv(h.mock.store);
      const c = data.cast.generated.characters.find((x) => x.key === 'historian');
      assert(c && c.first && /^Professor /.test(c.name), 'the historian must be a titled cast member with a first name: ' + (c && c.name));
      h.click('#btnCast'); await h.sleep(20);
      h.click(h.$('#castList [data-key="historian"]')); await h.sleep(20);
      assert.equal(h.$('#cfName').value, c.name, 'the historian is selected in the Cast editor');
      h.$('#cfAliases').value = '';
      h.click('#cfSave'); assert(await h.idle(10000));
      h.click('[data-close="dlgCast"]');
      const ov = onlyAdv(h.mock.store).data.cast.overrides.historian;
      assert(ov && Array.isArray(ov.aliases) && ov.aliases.length === 0, 'the cleared aliases are saved: ' + JSON.stringify(ov && ov.aliases));
      patchTurns(h, (r) => { r.state_updates = [{ key: 'present', op: 'set', value: [c.first] }]; r.narrative = c.first + ' looks up from the lectern and nods at you. ' + r.narrative; });
      assert(await h.turn('I look around.'));
      assert(await h.turn('I ask ' + c.first + ' about the Sundering.'));
      const p = promptOf(lastTurn(h));
      const chars = (/<characters[^>]*>([\s\S]*?)<\/characters>/.exec(p) || [])[1] || '';
      const line = chars.split('\n').find((l) => l.includes('[historian]')) || '';
      assert(line, 'the historian must be in <characters>');
      const sheetOnly = /Teaches the Sundering \(history\)/;   // the sheet's sentence; the brief joins it with a semicolon
      assert.match(c.sheet, sheetOnly, 'the generated sheet changed shape: ' + c.sheet.slice(0, 120));
      assert.match(line, sheetOnly, 'the historian in the scene and named must get the full sheet: ' + line.slice(0, 200));
      assert.match(p, new RegExp('Focus: the action names ' + c.first + '\\b'), 'the Focus line must name ' + c.first);
      clean(h);
    } finally { h.close(); }
  },

  // Surname-only actions name the generated cast member in the Focus line.
  async surnameFocus() {
    const h = await begin({
      setup(w, m) {
        m.sampleHandler = (input, o, call) => {
          const r = m.defaultHandler(input, o, call);
          if (call.label !== 'cast invention') return r;
          const d = JSON.parse(r);
          const creamery = d.people.find((p) => p.key === 'creamery');
          creamery.first = 'Tessa'; creamery.last = 'Varga';
          return JSON.stringify(d);
        };
      },
    });
    try {
      assert(await h.turn('Ask Varga about the Quiet Table.'));
      assert.match(promptOf(lastTurn(h)), /Focus: the action names Tessa\b/, 'the surname must resolve to the generated cast member');
      clean(h);
    } finally { h.close(); }
  },

  // Cast screen: unsaved edits survive a stray close. A back gesture or Esc (the dialog's cancel event) is refused, a screen the
  // browser closes anyway comes straight back with the typed text, and Close or another name asks once before dropping edits.
  async castEditsKept() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      const dlg = h.$('#dlgCast'), looks = h.$('#cfLooks'), note = () => h.$('#cfNote').textContent;
      const typed = (el, text) => { el.value = text; el.dispatchEvent(new h.window.Event('input', { bubbles: true })); };
      h.click('#btnCast'); await h.sleep(20);
      assert(dlg.open && h.$('#cfName').value === 'Daisy Clover', 'the Cast screen opens on the roommate');
      // Nothing typed yet: Close closes at once.
      h.click('[data-close="dlgCast"]'); assert(!dlg.open, 'with nothing unsaved, Close closes at once');
      h.click('#btnCast'); await h.sleep(20); assert(dlg.open);
      typed(looks, 'Short and soft, with a long dark tail.');
      const cancel = new h.window.Event('cancel', { cancelable: true }); dlg.dispatchEvent(cancel);
      assert(cancel.defaultPrevented, 'a close request (back gesture, Esc) is refused while edits are unsaved');
      assert(dlg.open && looks.value === 'Short and soft, with a long dark tail.', 'the screen stays open with the edits');
      dlg.close(); await h.sleep(20);
      assert(dlg.open, 'closed by the browser anyway, the screen comes back');
      assert.equal(looks.value, 'Short and soft, with a long dark tail.', 'the typed text is kept when the screen comes back');
      // Another name: the first tap asks, typing again disarms, two taps in a row switch.
      const other = [...h.document.querySelectorAll('#castList button')].find((b) => b.dataset.key !== 'roommate'); assert(other, 'another character is listed');
      other.click(); assert.equal(h.$('#cfName').value, 'Daisy Clover', 'the first tap on another name keeps the edited form');
      assert.match(note(), /Unsaved edits to Daisy Clover/, 'the player is told why: ' + note());
      typed(looks, looks.value + ' Horns polished.'); assert.equal(note(), '', 'typing clears the question');
      other.click(); assert.equal(h.$('#cfName').value, 'Daisy Clover', 'after more typing the next tap asks again');
      other.click(); assert.notEqual(h.$('#cfName').value, 'Daisy Clover', 'the second tap in a row switches character');
      // Back to the roommate: the switch dropped the edits, so the world's text shows; edit again, then Close twice.
      h.document.querySelector('#castList button[data-key="roommate"]').click();
      assert.equal(h.$('#cfName').value, 'Daisy Clover'); assert.doesNotMatch(looks.value, /Short and soft/, 'dropped edits are gone');
      typed(looks, 'Petite, with a swinging tail.');
      h.click('[data-close="dlgCast"]'); assert(dlg.open, 'the first Close with unsaved edits keeps the screen open'); assert.match(note(), /tap Close again/);
      h.click('[data-close="dlgCast"]'); assert(!dlg.open, 'the second Close closes it');
      // Saved edits close at once, and the save holds.
      h.click('#btnCast'); await h.sleep(20); typed(looks, 'Petite, with a swinging tail.');
      h.click('#cfSave'); assert(await h.idle(10000));
      h.click('[data-close="dlgCast"]'); assert(!dlg.open, 'after Save, Close closes at once');
      assert.equal(onlyAdv(h.mock.store).data.cast.overrides.roommate.looks, 'Petite, with a swinging tail.', 'the saved looks are stored');
      clean(h);
    } finally { h.close(); }
  },

  // Fade deadlines are absolute: a long quiet turn that passes two of them eases one step now and the other next turn.
  async fadeCatchesUp() {
    const h0 = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    const store = h0.mock.store; let id;
    try { assert(await h0.turn('I sit at the desk.')); id = onlyAdv(store).id; } finally { h0.close(); }
    const doc = store.get('adventures/' + id).data;
    const nowMin = ((doc.state.day || 1) - 1) * 1440 + (() => { const [hh, mm] = doc.state.time.split(':').map(Number); return hh * 60 + mm; })();
    doc.state.tf = Object.assign(doc.state.tf || {}, {
      influence: Object.assign(doc.state.tf.influence || {}, { cow: 20 }), rungs: { cow: 1 },
      traits: [{ species: 'cow', trait: 'ears lengthen and soften', day: 1, settled: false }], arcs: [], paths: {},
      tracks: [{ species: 'cow', rung: 1, kind: 'body', trait: 'ears lengthen and soften', steps: ['a first ear sensation', 'a second ear sign', 'a third ear sign', 'a fourth ear sign', 'the ear change complete'], anatomy: '', habits: [], noticed: '', i: 2, nextAt: 1e9, beganAt: nowMin }],
      last: { cow: nowMin }, drifted: {},
    });
    doc.pendingNotes = [];
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 6000));
      const tf = () => onlyAdv(h.mock.store).data.state.tf, track = () => tf().tracks.find((t) => t.species === 'cow' && t.kind === 'body');
      let advance = 720;
      patchTurns(h, (r) => { r.time_advance_minutes = advance; r.exposures = []; });
      // Twelve quiet hours in one turn pass the six-hour and twelve-hour deadlines: one step eases now, the other is owed.
      assert(await h.turn('I sleep the day away.'));
      assert.equal(track().i, 1, 'one step eases per turn'); assert.equal(track().fadeAt, nowMin + 720, 'the next deadline is the twelve-hour one, not six hours from now');
      advance = 30;
      assert(await h.turn('I stretch.'));
      assert(!track(), 'the owed step eases on the next turn, half an hour later, and the change is gone'); assert.equal(tf().rungs.cow, 0);
      clean(h);
    } finally { h.close(); }
  },

  // Elements on the die: a settled change carries its kind's element. A magical working through a carried element is one
  // easier, through any other element one harder; a player with no change has no bonus, no bar and no "element" field.
  async elementsOnDice() {
    const h0 = await begin({ rmSpecies: 'harpy', rmName: 'Wren Skye' });
    const store = h0.mock.store; let id;
    try {
      patchTurns(h0, (r) => { r.evaluation = { rules_in_play: [], stat: 'wits', element: 'air', d6: 3, total: 7, difficulty: 'Medium', outcome: 'success', reason: 'a ward sung on the air' }; });
      assert(await h0.turn('I try to sing the small ward Wren taught me.')); id = onlyAdv(store).id;
      const p0 = promptOf(lastTurn(h0)); const t0 = storedTurns(store, id).at(-1);
      assert.match(p0, /carries no element yet/, 'a human with no change carries no element');
      assert.doesNotMatch(p0, /Elements on the die/, 'no dice-line adjustment without a carried element');
      assert.doesNotMatch(p0, /"element": "air\|/, 'the evaluation schema has no element field without a carried element');
      assert.equal(t0.roll.total, t0.roll.d6 + t0.roll.statValue, 'no element: the total is the die plus Wits');
      assert.equal(t0.roll.elementMod, undefined, 'no adjustment recorded');
    } finally { h0.close(); }
    // A settled harpy change: the player carries air.
    const doc = store.get('adventures/' + id).data;
    doc.state.tf = Object.assign(doc.state.tf || {}, {
      influence: Object.assign(doc.state.tf.influence || {}, { harpy: 15 }), rungs: { harpy: 1 },
      traits: [{ species: 'harpy', trait: 'down along the forearms', day: 1, settled: true }], arcs: [], paths: {}, tracks: [], last: {}, drifted: {},
    });
    doc.pendingNotes = [];
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 6000));
      let element = 'air';
      patchTurns(h, (r) => { r.evaluation = { rules_in_play: [], stat: 'wits', element, d6: 3, total: 0, difficulty: 'Medium', outcome: 'success', reason: 'a working' }; });  // a total no die and stat can make, so the correction note always fires
      assert(await h.turn('I sing the ward again, on the air.'));
      let p = promptOf(lastTurn(h)), t = storedTurns(h.mock.store, id).at(-1);
      assert.match(p, /carries air \(Harpy\)/, 'the body line names the carried element: ' + (p.match(/carries [^.]*/) || [''])[0]);
      assert.match(p, /Elements on the die: \w+ carries air\./, 'the dice line names it too');
      assert.match(p, /"element": "air\|water\|/, 'the evaluation schema gains the element field');
      assert.equal(t.roll.element, 'air'); assert.equal(t.roll.elementMod, 1, 'through a carried element the working is one easier');
      assert.equal(t.roll.total, t.roll.d6 + t.roll.statValue + 1, 'the total carries the adjustment');
      assert(t.notes.some((n) => /corrected to \d+ \(d6 \d \+ Wits \d \+ 1 \(air carried\)\)/.test(n)), 'the correction note shows the element: ' + JSON.stringify(t.notes));
      element = 'water';
      assert(await h.turn('I try to still the water in the basin.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(t.roll.elementMod, -1, 'through any other element the working is one harder'); assert.equal(t.roll.total, t.roll.d6 + t.roll.statValue - 1);
      element = 'none';
      assert(await h.turn('I pick the lock with a hairpin.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(t.roll.elementMod, undefined, 'plain craft is unchanged'); assert.equal(t.roll.total, t.roll.d6 + t.roll.statValue);
      clean(h);
    } finally { h.close(); }
  },

  // The most intimate contact counts for the most: sex with someone of the kind is intensity 4 (16 at the kind's rate), it is
  // read from the player's own words, and it doubles the day's limit for that kind.
  async intimacyScale() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      const tf = () => onlyAdv(h.mock.store).data.state.tf, id = onlyAdv(h.mock.store).id, last = () => storedTurns(h.mock.store, id).at(-1);
      let exposures = [];
      patchTurns(h, (r) => { r.exposures = exposures; });
      assert(await h.turn('I have sex with Daisy.'));
      assert(last().notes.some((n) => /explicit player action \(cow, intensity 4\)/.test(n)), 'sex named by the player is read as intensity 4: ' + JSON.stringify(last().notes));
      assert.equal(tf().influence.cow, 16, 'intensity 4 at rate 4 gives 16, past the usual 10-a-day limit');
      exposures = [{ species: 'cow', method: 'a mug of warm milk', intensity: 1 }];
      assert(await h.turn('I drink the milk she pours.'));
      assert.equal(tf().influence.cow, 20, 'the day\'s limit is doubled to 20 by the intimate contact');
      assert(await h.turn('I drink another.'));
      assert.equal(tf().influence.cow, 20, 'and holds there');
      assert(last().notes.some((n) => /capped: 20 a day at the standard pace, doubled by intimate contact/.test(n)), 'the cap note says why: ' + JSON.stringify(last().notes));
      const p = promptOf(lastTurn(h));
      assert.match(p, /4 intimate \(sex with someone of the kind/, 'the narrator is told the scale');
      assert.match(p, /"intensity": 1\|2\|3\|4/, 'the schema allows 4');
      clean(h);
    } finally { h.close(); }
  },

  // Charms, curses and the Spa: a worn charm is one contact a story day with its kind, a cursed piece bites deeper each day,
  // a curse runs its days and lifts, and the Spa slips off the kind's cursed pieces and lifts its curses while ordinary charms stay.
  async charmsCursesSpa() {
    const h0 = await begin({ rmSpecies: 'rabbit', rmName: 'Clover Dell' });
    const store = h0.mock.store; let id;
    try { assert(await h0.turn('I unpack.')); id = onlyAdv(store).id; } finally { h0.close(); }
    const doc = store.get('adventures/' + id).data;
    doc.settings.pace = 'unbounded';  // no day cap and no fading, so the daily counts read plainly
    doc.state.items.wearing = ['a goblin copper warming-bracelet', 'a tarnished silver collar that closes by itself'];
    doc.state.items.curses = ['the fairy-ring mark'];
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 6000));
      const data = () => onlyAdv(h.mock.store).data, inf = () => data().state.tf.influence, last = () => storedTurns(h.mock.store, id).at(-1);
      let advance = 15, spa = null;
      patchTurns(h, (r) => { r.time_advance_minutes = advance; r.exposures = []; if (spa) r.spa_reset = spa; });
      assert(await h.turn('I look at the bracelet.'));
      assert.equal(inf().goblin, 4, 'the bracelet counts once (intensity 1): ' + JSON.stringify(inf()));
      assert.equal(inf().cat, 4, 'the cursed collar bites at 1 on its first day');
      assert.equal(inf().fairy, 8, 'the mark counts at its intensity of 2');
      let notes = last().notes;
      assert(notes.some((n) => /^charm worn: a goblin copper warming-bracelet \(goblin, intensity 1\)/.test(n)), 'the bracelet is noted: ' + JSON.stringify(notes));
      assert(notes.some((n) => /^charm worn: a tarnished silver collar[^(]*\(cat, intensity 1, cursed, day 1\)/.test(n)), 'the collar is noted as cursed');
      assert(notes.some((n) => /^curse active: the fairy-ring mark \(fairy, intensity 2, day 1 of 3\)/.test(n)), 'the mark is noted');
      assert(await h.turn('I turn it on my wrist.'));
      assert.deepEqual([inf().goblin, inf().cat, inf().fairy], [4, 4, 8], 'a second turn the same day adds nothing');
      assert(!last().notes.some((n) => /^charm worn|^curse active/.test(n)), 'and is not noted again');
      const p1 = promptOf(lastTurn(h));
      assert.match(p1, /Charms and curses: a charm worn against the skin/, 'the narrator is told how charms work');
      assert.match(p1, /Worn now: a goblin copper warming-bracelet \(goblin\); a tarnished silver collar that closes by itself \(cat, cursed: will not come off by hand/, 'and what is worn');
      assert.match(p1, /Under: the fairy-ring mark \(fairy, 3 days\)\./, 'and what curse is on');
      assert.doesNotMatch(p1, /a fox-fire bead|a mer-pearl on a chain/, 'the catalogue stays out of the prompt until it comes up');
      // Day two, three and four: the bracelet keeps its one, the collar bites 2 then 3, the mark runs its three days and lifts.
      advance = 720;
      assert(await h.turn('I sleep.')); assert.equal(data().state.day, 2);
      assert.deepEqual([inf().goblin, inf().cat, inf().fairy], [8, 12, 16], 'day two: ' + JSON.stringify(inf()));
      assert(last().notes.some((n) => /cursed, day 2\)/.test(n)), 'the collar is on its second day');
      assert(await h.turn('I go about the day.')); assert(await h.turn('I sleep again.')); assert.equal(data().state.day, 3);
      assert.deepEqual([inf().goblin, inf().cat, inf().fairy], [12, 24, 24], 'day three: ' + JSON.stringify(inf()));
      assert(await h.turn('I go about the day.')); assert(await h.turn('I sleep a third time.')); assert.equal(data().state.day, 4);
      assert.deepEqual([inf().goblin, inf().cat, inf().fairy], [16, 36, 24], 'day four: the mark has lifted and adds nothing: ' + JSON.stringify(inf()));
      assert.deepEqual(data().state.items.curses, [], 'the mark is gone from the curses list');
      assert(last().notes.some((n) => /^curse lifted: the fairy-ring mark after 3 days/.test(n)), 'and noted: ' + JSON.stringify(last().notes));
      assert(await h.turn('I stretch.'));
      assert.match(promptOf(lastTurn(h)), /Note from the engine: The curse has run its course \(the fairy-ring mark, fairies\)/, 'the narrator is told the curse has lifted');
      // The Spa, for the cat kind: the collar slips off and the cat influence is gone; the goblin bracelet stays where it is. A visit
      // takes every part back one waypoint, so a part grown several waypoints deep needs as many visits; each one lowers the influence.
      spa = ['cat'];
      let was = inf().cat;
      assert(await h.turn('I go to the Restoration Spa and ask for the cat to be washed out of me.'));
      assert.deepEqual(data().state.items.wearing, ['a goblin copper warming-bracelet'], 'the cursed collar has slipped off; the bracelet stays');
      assert(last().notes.some((n) => /^Spa: slipped off a tarnished silver collar/.test(n)), 'and it is noted: ' + JSON.stringify(last().notes));
      advance = 15; let next = null;
      for (let v = 1; inf().cat > 0 && v < 5; v++) {
        assert(inf().cat < was, 'each Spa visit lowers the cat influence: ' + was + ' then ' + inf().cat); was = inf().cat;
        assert(await h.turn('I go back to the Restoration Spa for the cat.'));
        if (next == null) next = promptOf(lastTurn(h));
      }
      assert.equal(inf().cat, 0, 'the Spa clears the cat influence');
      spa = null; advance = 720;
      assert(await h.turn('I sleep.'));
      assert.match(next == null ? promptOf(lastTurn(h)) : next, /slipped off a tarnished silver collar that closes by itself, which lies inert on the bath's edge/, 'the narrator is told so on the next turn');
      assert(await h.turn('I sleep on.'));
      assert.equal(inf().cat, 0, 'with the collar gone the cat kind no longer grows');
      assert.equal(inf().goblin, 24, 'the bracelet goes on counting (day six)');
      clean(h);
    } finally { h.close(); }
  },

  // Every woman in the cast has her own chest (cup, nipple, areola) and her hair from the kind's pools; a bovine woman's
  // breasts are full, veined and long-nippled, shown and never explained; a harpy has hair with her crest through it; nothing leaks a placeholder.
  async castBreastsAndHair() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const Wc = ctx.window.WINDLASS_WORLDS.sundered;
    for (const [k, sp] of Object.entries(Wc.genPools.species)) {
      assert(Array.isArray(sp.hair) && sp.hair.length >= 2, k + ' has a hair pool');
      // Looks are composed (Height, Build, Bust, Hair ...), so no kind keeps a written lead or a body line by sex.
      assert(!sp.leadByGender && !sp.bodyByGender, k + ': no written lead or body line by sex');
      assert(!(sp.body || []).some((t) => /\bhair\b/.test(t)), k + ': hair is in its own pool, not the body lines: ' + (sp.body || []).find((t) => /\bhair\b/.test(t)));
    }
    assert(Wc.genPools.breasts.length >= 10 && Wc.genPools.breasts.some((t) => /\bA cup\b/.test(t)) && Wc.genPools.breasts.some((t) => /\bDD\b/.test(t)) && Wc.genPools.breasts.some((t) => /puffy/.test(t)) && Wc.genPools.breasts.every((t) => /nipple/.test(t)), 'the shared pool runs from an A cup up, with nipples and puffiness');
    assert(Wc.genPools.species.cow.breasts.every((t) => /vein/.test(t) && /long/.test(t) && !/milk|lactat/.test(t)), 'bovine women are veined and long-nippled, a look and not a lecture on milk');
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female' });
    try {
      const { data } = onlyAdv(h.mock.store);
      const rm = data.roommate; assert.equal(rm.gender, 'female', 'the roommate is a woman'); const looks = rm.looks || (rm.gen && rm.gen.looks) || '';
      assert.match(looks, /\b(?:[C-H]|DD|DDD) cup\b|\ba (?:DD|DDD)\b/, 'the bovine roommate has a cup size, a C or more: ' + looks);
      assert.match(looks, /nipple|teats/, 'and nipples, or the teats they have become: ' + looks);
      assert.match(looks, /vein/, 'and veins');
      assert.doesNotMatch(looks, /milk|lactat/, 'and no word on milk, which is not a look');
      assert.match(looks, /udder/, 'and the udder');
      assert.match(looks.split('. ').slice(0, 2).join('. '), /\b(?:hair|plaits?|braid|crop|fringe)\b/i, 'and hair, in the hair sentence that follows the height and build: ' + looks);
      assert.doesNotMatch(looks, /\{|Small breasts/, 'no placeholder or stock chest: ' + looks);
      for (const c of data.cast.generated.characters) {
        if (!c.looks || c.looks.indexOf('{') >= 0) assert(!c.looks || c.looks.indexOf('{') < 0, c.name + ' leaks a placeholder: ' + c.looks);
        if (c.gen === false || !c.species) continue;
        assert.match(c.looks.split('. ').slice(0, 2).join('. '), /\bhair\b/i, c.name + ' (' + c.species + ') has hair in the hair sentence, whatever grows through it: ' + c.looks);
        if (c.gender === 'female') assert.match(c.looks, /\bcup\b|\bbreasts?\b/i, c.name + ' (' + c.species + ') has her chest in the look: ' + c.looks);
      }
      assert(await h.turn('I look around the room.'));
      const p = promptOf(lastTurn(h));
      assert.match(p, /Hair, style and colour, is in every look\./, 'the appearance rule names hair');
      assert.match(p, /Breasts differ from woman to woman/, 'the anatomy rule names the variety');
      clean(h);
    } finally { h.close(); }
    const g = await begin({ rmSpecies: 'harpy', rmName: 'Wren Skye' });
    try {
      const rm = onlyAdv(g.mock.store).data.roommate; const looks = rm.looks || (rm.gen && rm.gen.looks) || '';
      assert.match(looks, /\bplumage\b/i, 'the harpy has her plumage: ' + looks);
      assert.match(looks, /\bhair\b/i, 'and her hair, with the crest through it: ' + looks);
      assert.match(looks, /\bcrest\b/i, 'and her crest: ' + looks);
      assert.match(looks, /\b(A|B) cup\b/, 'and has her own light chest: ' + looks);
      assert.doesNotMatch(looks, /\{/, 'no placeholder: ' + looks);
      clean(g);
    } finally { g.close(); }
  },

  // A harpy's arms are her wings, feathered from the shoulder, and each ends in a hand whose fingers are talons, for gripping;
  // the tracks the looks are composed from, the roommate's look, the 70 and 85 rungs and the species lore all say so, and none keeps
  // the old forearm-only wing.
  async harpyWingArms() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const Wc = ctx.window.WINDLASS_WORLDS.sundered;
    const old = /from the elbow|bird's arms|wing structure|hands to the wrist/;
    const track = (key) => Wc.transformation.tracks.species.harpy.find((t) => t.key === key);
    assert.match(track('wings').endsAs, /the arms as wings/, 'the arms are the wings: ' + track('wings').endsAs);
    assert.match(track('arm_feathers').endsAs, /from shoulder/, 'feathered from the shoulder: ' + track('arm_feathers').endsAs);
    assert.match(track('hands').endsAs, /a thumb and two clawed fingers/, 'the hand at the end of the wing grips: ' + track('hands').endsAs);
    assert.match(track('talons').endsAs, /three toes forward and one back/, 'the feet are talons: ' + track('talons').endsAs);
    for (const t of Wc.transformation.tracks.species.harpy) for (const x of [t.endsAs].concat(Object.values(t.range || {}))) assert.doesNotMatch(String(x), old, 'no forearm-only wing: ' + x);
    const r70 = Wc.transformation.species.harpy.ladder.find((r) => r.at === 70), r85 = Wc.transformation.species.harpy.ladder.find((r) => r.at === 85);
    assert.match(r70.trait, /arms become wings, each ending in a hand with talons/, 'the 70 rung: ' + r70.trait);
    assert.match(r70.anatomy, /The wings: the arms themselves, feathered from the shoulder/, 'the 70 anatomy: ' + r70.anatomy);
    assert.match(r70.anatomy, /each finger ending in a black talon, curved, for gripping/, 'and the taloned hand: ' + r70.anatomy);
    assert(r70.steps.some((t) => /fingernails have thickened and darkened and curve/.test(t)), 'the nails go to talons as a step of their own');
    assert(r70.steps.some((t) => /from the shoulder down the whole arm, and the hands are still there at the end of each wing/.test(t)), 'the flight feathers run the whole arm and the hand stays at its end');
    assert.match(r85.anatomy, /arms that are wings, each ending in a hand with talons for fingers/, 'the finished shape: ' + r85.anatomy);
    for (const r of Wc.transformation.species.harpy.ladder) for (const t of [r.trait, r.anatomy].concat(r.steps)) assert.doesNotMatch(t, old, 'rung ' + r.at + ' keeps no forearm-only wing: ' + t.slice(0, 120));
    const lore = Wc.lore.find((l) => l.name === 'species: harpy');
    assert.match(lore.text, /arms are her wings, feathered from the shoulder, and each ends in a hand of a thumb and two clawed fingers, for gripping/, 'the species lore states the anatomy: ' + lore.text);
    assert.match(lore.text, /no other wings and no beak/, 'and what she does not have: ' + lore.text);
    const h = await begin({ rmSpecies: 'harpy', rmName: 'Wren Skye' });
    try {
      const rm = onlyAdv(h.mock.store).data.roommate; const looks = rm.looks || (rm.gen && rm.gen.looks) || '';
      assert.match(looks, /\b(?:scaled|talons?|three toes forward)/i, 'the roommate\'s look has talons for feet: ' + looks);
      // The wings are the arms in every column of the roommate's one draw (least, standard or most), never wings of their own.
      for (const c of Object.values(track('wings').range)) assert.match(c, /\barms\b/i, 'every wings column is the arms: ' + c);
      assert.match(looks, /\b(?:arms as (?:great )?wings|feathered arms)\b/i, 'and her arms are wings: ' + looks);
      assert.doesNotMatch(looks, /Arms: arms\b|\barms arms\b/i, 'the arms do not echo their name: ' + looks);
      assert.match(looks, /clawed finger/, 'with a gripping hand at the end of each: ' + looks);
      assert.doesNotMatch(looks, old, 'with no bare wrist or forearm-only wing: ' + looks);
      clean(h);
    } finally { h.close(); }
  },

  // The harness seeds the page: the same seed draws the same roommate (so a failure on seed N replays on seed N), and another
  // seed draws another.
  async seededBoots() {
    const roommate = async (seed) => {
      const h = await begin({ seed, rmSpecies: 'harpy' });
      try { const rm = onlyAdv(h.mock.store).data.roommate; clean(h); return JSON.stringify([rm.name, rm.looks || (rm.gen && rm.gen.looks)]); } finally { h.close(); }
    };
    const a = await roommate(4242), b = await roommate(4242), c = await roommate(4243);
    assert.equal(b, a, 'the same seed draws the same roommate');
    assert.notEqual(c, a, 'another seed draws another roommate');
  },

  // The PR #49 review: no step is told twice (a rung's sex steps never repeat its women steps), a lead line never fixes a hair
  // length the Cast's hair draw might contradict, and the grown chest (Tanner stage five) is the draw's shape alone, so a bovine
  // woman's milk comes in her own later form step and never with the breasts.
  async chestToldOnce() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const Wd = ctx.window.WINDLASS_WORLDS.sundered, T = Wd.transformation;
    for (const [k, sp] of Object.entries(T.species)) for (const r of sp.ladder) {
      for (const x of r.sex || []) {
        assert(!(r.women || []).includes(x), k + ' rung ' + r.at + ': a sex step repeats a women step: ' + x);
        assert(!/\{teats\}/.test(x), k + ' rung ' + r.at + ': the teats are the kind\'s form, told in the women steps, not the sex steps: ' + x);
        if (r.women) for (const w of r.women) assert(!/udder/.test(x) || !/udder/.test(w) || r.at === 85, k + ' rung ' + r.at + ': the udder is told in one track: ' + x);
      }
    }
    // No written lead line is left to fix a hair length the Cast's hair draw might contradict: looks are composed, hair from its pool.
    const leads = [];
    (function walk(o) { if (!o || typeof o !== 'object') return; if (o.leadByGender) leads.push(o.leadByGender); for (const v of Object.values(o)) walk(v); })(Wd);
    assert.deepEqual(leads, [], 'no lead lines remain to fix a hair length');
    assert.match(T.sexStages.tanner5, /\{chest\}$/, 'Tanner stage five names the chest by its shape: ' + T.sexStages.tanner5);
    assert.doesNotMatch(T.sexStages.tanner5, /\{breasts\}/, 'not the whole draw, milk and all');
    const cow = Wd.genPools.species.cow.breasts || [];
    assert(cow.length >= 3, 'the bovine chest pool is found');
    for (const b of cow) assert.doesNotMatch(b.split(';')[0], /milk|lactat/i, 'a bovine draw keeps its milk after the shape: ' + b);
    // A chest draw also fills the player's Tanner stages and grown-chest summary, so it names no one's pronouns.
    const draws = [].concat(Wd.genPools.breasts || [], ...Object.values(Wd.genPools.species || {}).map((sp) => sp.breasts || []));
    assert(draws.length > 10, 'the chest pools are found');
    for (const b of draws) assert.doesNotMatch(b, /\b(she|her|hers|herself|he|him|his)\b/i, 'a chest draw is person-neutral: ' + b);
  },

  // Form steps are never assumed told, and a kind on tracks tells none from its ladder. A save from before they were kept, on a
  // path still going over with no form track, shows none of its rungs' form (the milk above all); and a man's path that never had
  // form tracks, on a body that has since gone over on another path, lists none either. The kind's womanly parts are its by-sex
  // tracks now, so the rungs such a save kept queue no ladder form step on top of them.
  async formStepsNotAssumed() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const T = ctx.window.WINDLASS_WORLDS.sundered.transformation;
    const run = async (label, tfSeed, k) => {
      const first = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi', gender: 'male' });
      let seeded; try { seeded = new Map([...first.mock.store].map(([key, v]) => [key, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
      const advKey = [...seeded.keys()].find((key) => /^adventures\/[^/]+$/.test(key)); const doc = seeded.get(advKey).data;
      doc.state.tf = Object.assign({ arcs: [], last: {}, drifted: {} }, tfSeed); doc.settings.pace = 'unbounded';
      const h = await boot({ setup(w, m) { m.store = seeded; } });
      try {
        assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
        patchTurns(h, (r) => { r.time_advance_minutes = 240; r.exposures = []; });
        const tf = () => onlyAdv(h.mock.store).data.state.tf;
        // Each form step by a fragment free of placeholders; a summary may list only those already told as a step.
        const key = (x) => x.replace(/\{\w+\}/g, '').replace(/^[\s,]+/, '').slice(0, 25);
        const keys = Object.values(T.species).flatMap((sp) => sp.ladder.flatMap((r) => r.women || [])).map(key);
        const seen = new Set();
        for (let n = 0; n < 4; n++) {
          assert(await h.turn('I get on with the day.'));
          const p = promptOf(lastTurn(h));
          // A step rolled at the end of a turn is told, and kept, from the next prompt on.
          for (const m of p.matchAll(/the kind's form on a woman's body\): ([^\n]*)/g)) for (const x of keys) if (m[1].includes(x)) seen.add(x);
          const summary = (p.match(/The kind's form on a woman's body, told so far: [^\n]*/) || [''])[0];
          for (const x of keys) if (summary.includes(x)) assert(seen.has(x), label + ': a form step is listed before it was told (turn ' + (n + 1) + '): ' + x);
          assert.doesNotMatch(p, /Body now[^\n]*milk: a bead of it/, label + ': the milk is never listed as established');
          assert.doesNotMatch(p, /the kind's form on a woman's body/, label + ': no ladder form step is told on a kind on tracks (turn ' + (n + 1) + ')');
          assert(!tf().tracks.some((t) => t.species === k && t.kind === 'form'), label + ': and none is queued: ' + JSON.stringify(tf().tracks.map((t) => [t.species, t.kind, t.rung, t.i, t.catchUp, t.after])));
        }
        assert.equal(seen.size, 0, label + ': no ladder form step was told: ' + [...seen].join(' | '));
        clean(h);
      } finally { h.close(); }
    };
    // A v68/v69 cow save at rung 5, going over, its rung-5 sex steps unfinished and no form track: the old rebuild listed every rung's
    // form, the milk among them.
    await run('legacy cow', {
      influence: { cow: 90 }, rungs: { cow: 5 }, traits: [{ species: 'cow', trait: 'the body fills toward the bovine shape', day: 1, settled: false }],
      paths: { cow: { sex: 'female', sexTold: ['{tanner2}'], day: 1, order: [0, 1, 2, 3, 4, 5], eye: 'brown' } },
      tracks: [{ species: 'cow', rung: 5, kind: 'sex', to: 'female', trait: 'the body fills toward the bovine shape', steps: ['{tanner5}', '{genitals}'], i: 0, nextAt: 1e9, day: 1 }],
    }, 'cow');
    // A man's fox path that is not going over (built as 1e47c04 built one, with no form history), on a body that has gone over on the harpy path.
    await run('fox after the harpy path', {
      influence: { fox: 75, harpy: 90 }, rungs: { fox: 4, harpy: 5 },
      traits: [{ species: 'fox', trait: 'a brush of a tail', day: 1, settled: true }, { species: 'harpy', trait: 'wings', day: 1, settled: true }],
      paths: { fox: { sex: null, sexTold: [], day: 1, order: [0, 1, 2, 3, 4, 5], eye: 'amber' }, harpy: { sex: 'female', sexTold: [], formTold: [], day: 1, order: [0, 1, 2, 3, 4, 5], eye: 'gold' } },
      tracks: [], sex: { to: 'female', species: 'harpy', rung: 5, day: 1 },
    }, 'fox');
  },

  // A woman's save from before the tracks kept the ladder rungs she had climbed. Opened on the tracks, her chest is told by the
  // kind's own by-sex tracks alone: no ladder form step is queued or told for those rungs, and one already queued by a later save
  // is dropped when it opens.
  async preTracksWomanNoLadderForm() {
    const sp = loadWorld().transformation.species.cow;
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'female', name: 'Ana Reyes' });
    g.doc.state.tf = { influence: { cow: 40 }, traits: [{ species: 'cow', trait: sp.ladder[0].trait, day: 1, settled: true }, { species: 'cow', trait: sp.ladder[1].trait, day: 1, settled: true }], rungs: { cow: 2 }, arcs: [], tracks: [], paths: { cow: { sex: null, sexTold: [], formTold: [], day: 1, order: [0, 1, 2, 3, 4, 5], eye: 'dark eyes' } }, last: { cow: 0 }, drifted: {} };
    g.doc.settings.pace = 'unbounded';
    const tf = (h) => onlyAdv(h.mock.store).data.state.tf, forms = (h) => JSON.stringify(tf(h).tracks.filter((t) => t.kind === 'form'));
    const play = async (h, label) => {
      patchTurns(h, (r) => { r.time_advance_minutes = 120; r.exposures = []; r.state_updates = []; });
      for (let n = 0; n < 4; n++) {
        assert(await h.turn('I get on with the day.'));
        assert.doesNotMatch(promptOf(lastTurn(h)), /the kind's form on a woman's body/, label + ': no ladder form step is told on the tracks (turn ' + (n + 1) + ')');
        assert(!storedTurns(h.mock.store, g.id).at(-1).notes.some((x) => /form steps of rung/.test(x)), label + ': none is noted as told');
        assert.equal(forms(h), '[]', label + ': and none is queued');
      }
    };
    let later;
    const h = await bootOn(copyStore(g.store));
    try { await play(h, 'opened from the ladder'); later = copyStore(h.mock.store); clean(h); } finally { h.close(); }
    const d = later.get(g.key).data;
    d.state.tf.tracks.push({ species: 'cow', rung: 2, kind: 'form', catchUp: true, trait: sp.ladder[1].trait, steps: sp.ladder[1].women.slice(0, 1), i: 0, nextAt: 0, day: d.state.day });
    const h2 = await bootOn(later);
    try { await play(h2, 'a form step queued by a later save'); clean(h2); } finally { h2.close(); }
  },

  // Every kind's ladder carries the change-tracks document's lines, folded into the steps, women steps and habits of the kinds that
  // exist (the kitsune is the fox): one of each kind's distinctive lines is here, and the fold kept the ladder's pinned facts and shape.
  async docTracksFold() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const T = ctx.window.WINDLASS_WORLDS.sundered.transformation;
    const textOf = (sp) => sp.ladder.flatMap((r) => [].concat(r.steps, r.women || [], r.sex || [])).concat(sp.habits || []).join('\n');
    const lines = {
      wolf: [/dusk is the best light there is/, /the jaw muscle standing at the hinge/], cow: [/let down by warmth, touch, arousal or strong feeling/, /heel wants to lift and resists coming down/],
      fox: [/what the asker wants and what they are hiding/, /rims of the human ears gone thin and hot/], cat: [/swivel apart to follow two voices at once/, /slow wave for thought, a lash for temper/],
      rabbit: [/every room is entered knowing where its doors are/, /faint sounds sharpen/], harpy: [/whistles and trills come by themselves/, /opened into pins, then into soft down/],
      mer: [/the cold tap in the morning does not bite/, /toes feel long in their shoes/], dryad: [/fine rootlets creep from the soles/, /knows from across the Isle when it is thirsty/],
      goblin: [/a bargain once struck sits in the chest like a debt/], fairy: [/colours moving in it like the inside of a shell/, /fingernails gleam as if polished/]
    };
    for (const [k, res] of Object.entries(lines)) { const t = textOf(T.species[k]); for (const re of res) assert.match(t, re, k + ' carries the document\'s line ' + re); }
    // The fold is prose only and the body never takes an animal's shape: the whole-animal rungs are gone, every ladder keeps its 30/50/70/85 rungs with the Tanner stages, and no step ends in a full stop.
    for (const k of ['wolf', 'fox', 'cat']) { const last = T.species[k].ladder[T.species[k].ladder.length - 1]; assert(last.at < 100 && !/whole (?:fox|cat)|true muzzle|(?:shape|form|change)s? at will/.test(last.steps.concat(last.trait).join(' ')), k + ' has no whole-animal rung: the body never takes an animal\'s shape'); }
    for (const [k, sp] of Object.entries(T.species)) {
      const at = (n) => sp.ladder.find((r) => r.at === n);
      assert(at(30).sex.includes('{tanner2}') && at(50).sex.includes('{tanner3}') && at(70).sex.includes('{tanner4}') && at(85).sex[0] === '{genitals}', k + ' keeps the Tanner stages on their rungs');
      for (const r of sp.ladder) for (const x of [].concat(r.steps, r.women || [])) { assert(!/\.$/.test(x), k + ' rung ' + r.at + ': a step ends in a full stop: ' + x.slice(-60)); assert(!/[\u201c\u201d]/.test(x) && !/\s{2,}/.test(x), k + ' rung ' + r.at + ': stray quotes or spaces: ' + x.slice(0, 60)); }
      for (const h of sp.habits) assert(!/\.$/.test(h), k + ': a habit ends in a full stop: ' + h);
    }
  },
  // The change-tracks model: each kind changes on weighted tracks of evenly spaced waypoints, driven by influence through windows
  // drawn once per path, never past the next waypoint not yet told; one waypoint a turn; needs and by-sex tracks gate; the
  // body's sex goes over on its own ten tracks (Tanner chest stages, the drawn chest, the genitals stated once) and finishes the
  // body; a bond is nine facets that rise and fall and derive the attitude; the whole-animal rungs are gone; an older save migrates.
  // Fails on bef6c76 (no track data in the world, no tracks in the engine).
  async changeTracks() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const Wd = ctx.window.WINDLASS_WORLDS.sundered, T = Wd.transformation, TR = T.tracks;
    assert(TR && TR.species && TR.woman && TR.man && TR.bond, 'the world carries the track model');
    const sum = (m, sex) => m.filter((t) => !t.sex || t.sex === sex).reduce((a, t) => a + t.weight, 0);
    const stageAt = (j, n) => Math.ceil(j * 100 / n - 1e-9);
    for (const [k, m] of Object.entries(TR.species)) {
      assert(T.species[k], k + ' has a kind in the world');
      assert.equal(sum(m, 'women'), 100, k + ' weights sum to 100 for a woman\'s body');
      if (m.some((t) => t.sex === 'men')) assert.equal(sum(m, 'men'), 100, k + ' weights sum to 100 for a man\'s body');
      for (const t of m) {
        assert(t.stages.length >= 3 && t.stages.length <= 5, k + ' ' + t.key + ' has three to five stages');
        assert(!t.stages.some((s) => /Found:/.test(s)), k + ' ' + t.key + ' has no Found: line');
        for (const s of t.stages) for (const tok of s.match(/\{[^{}\s]+\}/g) || []) assert(/^\{(eye|eyes|breasts|teats)\}$/.test(tok), k + ' ' + t.key + ' uses a token the engine fills: ' + tok);
        for (const n of t.needs || []) {
          const target = m.find((x) => x.key === n.track) || TR.woman.find((x) => x.key === n.track);
          assert(target, k + ' ' + t.key + ' needs a real track: ' + n.track);
          assert(n.stage === 'finished' || (Number(n.stage) >= 1 && Number(n.stage) <= target.stages.length), k + ' ' + t.key + ' needs a stage that exists');
        }
        if (t.range) assert(t.range.least && t.range.standard && t.range.most, k + ' ' + t.key + ' range has its three ends');
      }
    }
    // The reused stage lists are the same text: the coats are the werewolf's pelts, the kitsune's hands the werewolf's, the cat's spine line the bovine's strip.
    const wolf = TR.species.wolf, byKey = (m, k) => m.find((t) => t.key === k);
    for (const k of ['cow', 'fox', 'cat', 'rabbit']) { assert.deepEqual(byKey(TR.species[k], 'forearm_coat').stages, byKey(wolf, 'forearm_pelt').stages, k + ' forearm coat reuses the werewolf\'s forearm pelt'); if (k !== 'cow') assert.deepEqual(byKey(TR.species[k], 'leg_and_hip_coat').stages, byKey(wolf, 'leg_and_hip_pelt').stages, k + ' leg and hip coat reuses the werewolf\'s'); }
    // A hooved kind's coat runs from the hooves, never from paws it does not have.
    assert.doesNotMatch(JSON.stringify(byKey(TR.species.cow, 'leg_and_hip_coat').stages), /paw/i, 'the bovine leg coat names no paws'); assert.match(byKey(TR.species.cow, 'leg_and_hip_coat').stages.at(-1), /hoove/i, 'and runs from the hooves');
    assert.deepEqual(byKey(TR.species.fox, 'hands').stages, byKey(wolf, 'hands').stages, 'the kitsune\'s hands are the werewolf\'s');
    assert.deepEqual(byKey(TR.species.cat, 'spine_line').stages, byKey(TR.species.cow, 'spine_strip').stages, 'the cat\'s spine line is the bovine\'s strip');
    for (const k of ['woman', 'man', 'bond']) assert.equal(TR[k].reduce((a, t) => a + t.weight, 0), 100, k + ' weights sum to 100');
    const chest = byKey(TR.woman, 'chest'); assert.equal(chest.stages.length, 5); for (let i = 0; i < 5; i++) assert.match(chest.stages[i], new RegExp('^Tanner ' + (i + 1)), 'a woman\'s chest runs the five Tanner stages');
    const manChest = byKey(TR.man, 'chest'); assert.match(manChest.stages[0], /Tanner 5/); assert.match(manChest.stages[4], /^Tanner 1/, 'a man\'s chest runs them backward');
    assert.deepEqual(JSON.parse(JSON.stringify(byKey(TR.woman, 'rhythms').needs)), [{ track: 'chest', stage: 4, from: 3 }], 'the first bleed waits for Chest at stage 4');
    assert.doesNotMatch(byKey(TR.bond, 'intimacy').stages[4], /scene closes/, 'no cutaway when sex begins');
    for (const k of ['wolf', 'fox', 'cat']) { const last = T.species[k].ladder[T.species[k].ladder.length - 1]; assert(last.at < 100 && !/(?:shape|form|change)s? at will/.test(last.trait), k + ' has no whole-animal rung'); }

    // The engine: a man with a bovine roommate, the path rolled toward a woman's body, the unbounded pace.
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      const store = h.mock.store; const id = onlyAdv(store).id;
      await setSettings(h, { pace: 'unbounded' });
      assert.equal(onlyAdv(store).data.settings.pace, 'unbounded', 'the pace is set the way a player sets it');
      h.window.WINDLASS_WORLDS.sundered.transformation.sexChange.cow.chance = 1;
      const data = () => onlyAdv(store).data, tf = () => data().state.tf, last = () => storedTurns(store, id).at(-1);
      let shifts = [], updates = [], spa = null;
      patchTurns(h, (r) => { r.time_advance_minutes = 180; r.exposures = spa ? [] : [{ species: 'cow', method: 'the evening with Daisy', intensity: 3 }]; r.bond_shifts = shifts; if (updates.length) r.state_updates = updates; if (spa) r.spa_reset = spa; r.state_updates = (r.state_updates || []).concat([{ key: 'present', op: 'append', value: ['Daisy Holm'] }]); });
      const stepNotes = (t) => t.notes.filter((n) => /^change (?:begins|continues|complete):|^cow path: .* waypoint/.test(n));
      const M = TR.species.cow, SM = TR.woman; let firstSeen = false, waypoints = 0, teatsOpened = false, udWaits = 0;
      const a0 = data().state.attitudes.roommate; assert(typeof a0 === 'number');
      // Before any change: the waypoint and story-thread rules are not sent, and only the kinds in the scene have their contacts listed.
      let b0 = null, preTotal = null, lastTotal = null, chestAt3 = null; const prompts = [];
      // Twenty-six turns, then up to ten more while Chest stands at stage 3 and the udder has not yet told a waypoint, so the udder's
      // wait in the queue is followed on more draws.
      for (let i = 0; i < 36; i++) {
        if (i >= 26 && (teatsOpened || chestAt3 == null)) break;
        shifts = i === 3 ? [{ who: 'roommate', facet: 'trust', dir: 'up', why: 'a secret kept' }] : i === 4 ? [{ who: 'roommate', facet: 'trust', dir: 'down', why: 'a promise broken' }] : [];
        updates = i === 5 ? [{ key: 'attitudes.roommate', op: 'inc', value: 1 }] : [];
        const was = JSON.parse(JSON.stringify(tf() || {}));
        assert(await h.turn('I spend the evening with Daisy.'), 'turn ' + (i + 1));
        const t = last(), st = tf(), pr = st.prog.cow, sx = st.sexprog, notes = stepNotes(t); waypoints += notes.length; prompts.push(promptOf(lastTurn(h)));
        preTotal = lastTotal; lastTotal = Math.round(M.reduce((a, t2) => a + t2.weight * pr.tracks[t2.key].p / 100, 0));
        if (chestAt3 == null && sx.tracks.chest.told >= 3) chestAt3 = i + 1;
        if (i === 0) { const p0 = promptOf(lastTurn(h)); assert.doesNotMatch(p0, /Each part changes on its own track/, 'the waypoint rule waits for a change'); assert.doesNotMatch(p0, /Story thread:/, 'the story thread waits for a change'); assert.match(p0, /- cow \(bovine mythkin\): /, 'the roommate\'s kind has its contacts listed'); assert.doesNotMatch(p0, /- dryad \(/, 'a kind not in the scene is not'); assert.doesNotMatch(p0, /Charms and curses: a charm/, 'nor the charm rules with no charm in play'); }
        if (!b0) { b0 = JSON.parse(JSON.stringify(data().state.bonds.roommate)); assert.equal(b0.attraction.p, 0, 'a new bond starts with no attraction'); for (const f of ['touch', 'intimacy', 'openness', 'standing']) assert.equal(b0[f].p, stageAt(1, TR.bond.find((t) => t.key === f).stages.length), 'a new bond starts at ' + f + '\'s starting line and no further'); assert.equal(b0.ease.p, Math.min(a0 * 10, 45), 'ease is seeded from the attitude'); }
        assert(notes.length <= 1, 'one waypoint a turn: ' + JSON.stringify(notes));
        assert(!t.notes.some((n) => /capped: \d+ a day/.test(n)), 'the unbounded pace has no daily cap: ' + JSON.stringify(t.notes.filter((n) => /capped/.test(n))));
        if (!firstSeen && notes.length) { assert.match(notes[0], /^change begins: cow/, 'the kind\'s first waypoint is its beginning: ' + JSON.stringify(notes)); firstSeen = true; }
        if (i === 0) {
          assert(t.notes.some((n) => /^cow path drawn: the body will also go toward a woman's/.test(n)), 'a man on a bovine path at chance 1 goes toward a woman\'s body: ' + JSON.stringify(t.notes));
          assert(sx && sx.to === 'female' && sx.species === 'cow' && Object.keys(sx.tracks).length === SM.length, 'the sex change runs on its ten tracks');
          assert.equal(Object.keys(pr.tracks).length, M.length, 'every bovine track has its window');
          assert([-1, 0, 1].includes(pr.lean) && pr.face >= 0 && pr.face <= 30, 'the body\'s lean and the face are drawn once');
          for (const t2 of M) { const r = pr.tracks[t2.key]; assert(r.s >= 12 && r.s <= 50 && r.e > r.s && r.e <= 100, t2.key + ' window within influence: ' + JSON.stringify(r)); }
        }
        // Progress sits between the last waypoint told and the next: the body goes only as far as what has been lived through.
        for (const t2 of M) { const r = pr.tracks[t2.key], n = t2.stages.length; assert(r.p <= stageAt(r.told + 1, n) && r.p >= stageAt(r.told, n) - 1, t2.key + ' progress held to the told waypoint: ' + JSON.stringify(r)); }
        assert.equal(pr.tracks.horns_and_crest.told, 0, 'a path rolled toward a woman\'s body never opens the men\'s tracks');
        if (pr.tracks.milk.told > 0) assert(pr.tracks.teats_and_udder.told >= 4, 'milk waits for the teats and udder at stage 4');
        if (pr.tracks.teats_and_udder.told > 0) { teatsOpened = true; assert(sx.tracks.chest.told >= 3, 'a body going over opens the udder only with Chest at stage 3'); }
        // The udder on the way over (the engine's rule, followed on every draw): it is shut, with no progress, until Chest has told
        // stage 3; the turn after, with influence past its window's start, it moves. It then waits in the one-waypoint-a-turn queue like
        // any part: while it is due and untold, the one waypoint told each turn is the part in its focus run, a private part held back,
        // or a part not yet begun whose window starts no later than the udder's (a part already begun waits behind it). On some draws
        // (seeds 2 and 4) that queue holds it for a dozen turns or more, so a turn count is not the rule.
        const ud = pr.tracks.teats_and_udder, udN = byKey(M, 'teats_and_udder').stages.length, FR = T.focusRun == null ? 3 : T.focusRun;
        if (ud.p > 0) assert(sx.tracks.chest.told >= 3, 'the udder moves only once Chest is at stage 3 on the way over: ' + JSON.stringify({ udder: ud, chest: sx.tracks.chest }));
        if (chestAt3 != null && i + 1 > chestAt3 && st.influence.cow > ud.s) assert(ud.p > 0, 'Chest at stage 3 opens the udder, and its progress moves the turn after (turn ' + (i + 1) + '): ' + JSON.stringify(ud));
        if (ud.told === 0 && Math.floor(ud.p * udN / 100 + 1e-9) >= 1) {
          const wasPr = ((was.prog || {}).cow || {}).tracks || {}, wasSx = (was.sexprog || {}).tracks || {};
          const moved = M.map((t2) => ({ id: 'track:cow:' + t2.key, t: t2, r: pr.tracks[t2.key], r0: wasPr[t2.key], sex: false })).concat(SM.map((t2) => ({ id: 'sex:cow:' + t2.key, t: t2, r: sx.tracks[t2.key], r0: wasSx[t2.key], sex: true }))).filter((x) => x.r && x.r.told > ((x.r0 || {}).told || 0));
          assert.equal(moved.length, 1, 'a waypoint is told each turn the udder waits (turn ' + (i + 1) + '): ' + JSON.stringify(moved.map((x) => x.id)));
          const x = moved[0], fo = was.focus, ahead = (fo && fo.id === x.id && fo.run < FR) || !!x.t.tell || (!((x.r0 || {}).told) && (x.sex ? x.r.s < ud.s : x.r.s <= ud.s));
          assert(ahead, 'the udder waits only behind the parts ahead of it in the queue (turn ' + (i + 1) + '): ' + x.id + ' was told ' + JSON.stringify({ told: x.r, before: x.r0, focus: fo, udder: ud }));
          udWaits += 1;
        }
        if (sx.tracks.rhythms.told >= 3) assert(sx.tracks.chest.told >= 4, 'the first bleed waits for Chest at stage 4');
        if (pr.tracks.feet_and_stance.told > 0) assert(pr.tracks.toes_and_hooves.told >= 2, 'the stance waits for the toes at stage 2');
        if (i === 3) { assert.equal(data().state.bonds.roommate.trust.p, b0.trust.p + 10, 'a trust shift up moves one notch'); }
        if (i === 4) { assert.equal(data().state.bonds.roommate.trust.p, b0.trust.p, 'a trust shift down takes it back'); assert.equal(data().state.attitudes.roommate, a0, 'a shift and its undoing leave the attitude where it was'); }
        if (i === 5) { assert.equal(data().state.bonds.roommate.liking.p, b0.liking.p + 13, 'an older attitude update moves liking one notch'); assert.equal(data().state.attitudes.roommate, Math.min(10, a0 + 1), 'and sets the attitude it asked for'); }
        if (i < 3) assert.equal(data().state.attitudes.roommate, a0, 'seeding the bond never moves the attitude');
      }
      assert(waypoints >= 6, 'twenty-six turns tell many waypoints: ' + waypoints + ' over ' + storedTurns(store, id).length + ' stored turns');
      assert(Object.values(tf().sexprog.tracks).some((r) => r.told > 0), 'the way over has told a waypoint');
      assert(teatsOpened || chestAt3 == null || chestAt3 === prompts.length || udWaits > 0, 'the udder opens once Chest reaches stage 3 on the way over, or waits in the queue (Chest at stage 3 on turn ' + chestAt3 + ', ' + prompts.length + ' turns played)');
      const p = promptOf(lastTurn(h)); const block = p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>'));
      // The last prompt was built before the last turn's progress, so its total is the one after the turn before it.
      const total = Math.round(M.reduce((a, t) => a + t.weight * tf().prog.cow.tracks[t.key].p / 100, 0));
      assert([total, preTotal].some((v) => block.includes('Body now (bovine mythkin, ' + v + ' of 100): ')), 'the body line carries the weighted total: ' + (block.match(/Body now[^\n]{0,80}/) || [''])[0]);
      assert(!/[{}]/.test(block), 'every token is filled in the transformation block');
      assert.match(block, /Each part changes on its own track of waypoints[^\n]*a finished part is rendered only at its last waypoint/, 'once a change is under way, the in-between rule is sent');
      assert.match(block, /Story thread:/, 'and the story thread');
      assert.match(block, /- cow \(bovine mythkin\): /, 'the kind in the scene has its contacts listed');
      assert.match(block, /Other kinds \([a-z, ]+\): their contacts are listed here once one of them is in the scene/, 'the rest are named only');
      assert.match(block, /Toward a woman's body so far \(\d+ of 100, bovine mythkin path\): /, 'the sex change is summarised by its tracks');
      // A chest waypoint is given in full by its note on the turn after it is told, and under the way over after that.
      if (tf().sexprog.tracks.chest.told > 1) assert(prompts.some((q) => /Tanner \d/.test(q.slice(q.indexOf('<transformation>'), q.indexOf('</transformation>'))) || /Note from the engine: Alongside [^\n]*Chest \(waypoint \d+ of \d+\): Tanner \d/.test(q)), 'the chest lines are the Tanner stages');
      assert(!/\.\.|\.;/.test(block.split('\n').find((l) => /^Body now/.test(l)) || ''), 'no doubled stops in the body line');
      assert(prompts.some((q) => /Note from the engine: (?:The change (?:continues|completes a part)|A (?:new part begins|change is beginning)) \(bovine mythkin/.test(q)), 'a waypoint is announced to the narrator: ' + JSON.stringify(storedTurns(store, id).map((t) => stepNotes(t)).filter((x) => x.length)) + ' | ' + JSON.stringify(prompts.map((q) => (q.match(/Note from the engine: [^\n]{0,90}/g) || []).join(' / ')).filter(Boolean).slice(-6)));
      assert.match(p, /<bonds note="[^"]*">\n- Daisy \[roommate\] \(bond \d+ of 100\): /, 'the bonds block lists the roommate\'s facets');
      assert.match(p, /"bond_shifts": array of \{"who": character key, "facet": ease\|knowing\|trust\|liking\|attraction\|touch\|intimacy\|openness\|standing/, 'the reply contract asks for bond shifts');
      const turn4 = storedTurns(store, id).find((t) => t.n === 5), bondNote = (turn4 && turn4.pendingAfter || []).concat(storedTurns(store, id).flatMap((t) => t.pendingAfter || [])).find((n) => /^Bond with Daisy: trust reaches "/.test(n)) || prompts.find((q) => /Bond with Daisy: trust reaches "/.test(q));   // older turns keep no pending notes: the next turn's prompt carries it
      const trustStage = (v) => Math.floor(v * 5 / 100 + 1e-9);
      if (trustStage(b0.trust.p + 10) > trustStage(b0.trust.p)) assert(bondNote, 'a facet crossing a stage is announced to the narrator');
      // The character sheet lists the parts under way per track; the engine's humanity reads the totals.
      h.click('#toggleHidden'); await h.settle(100, 2000);
      assert.match(h.$('#traits').innerHTML, /Bovine · [A-Z][a-z ]+ · \d of \d/, 'the sheet lists the tracks under way: ' + h.$('#traits').textContent.slice(0, 200));
      assert.match(h.$('#influence').textContent, /body \d+/, 'the influence bar carries the body\'s total');
      // The Spa heals the kind's whole set one step a visit: every bovine change told goes back a waypoint and the influence falls
      // with them; the draws and the way over (the body's sex, healed on its own) stay.
      const toldBefore = Object.fromEntries(Object.entries(tf().prog.cow.tracks).map(([k, r]) => [k, r.told])), infBefore = tf().influence.cow;
      spa = ['cow']; shifts = [];
      assert(await h.turn('I visit the Restoration Spa.'));
      // A change another stands on waits a visit while the other goes back first (the toes under the stance).
      const waited = Object.entries(toldBefore).filter(([k, b]) => b > 0 && tf().prog.cow.tracks[k].told === b).map(([k]) => k);
      for (const [k, b] of Object.entries(toldBefore)) assert(tf().prog.cow.tracks[k].told === Math.max(0, b - 1) || waited.includes(k), k + ' goes back one waypoint: ' + b + ' -> ' + tf().prog.cow.tracks[k].told);
      for (const k of waited) { const deps = TR.species.cow.filter((t) => (t.needs || []).some((nd) => nd.track === k)).map((t) => t.key); assert(deps.some((d) => toldBefore[d] > 0), k + ' waits only for a change that stands on it: ' + deps); }
      assert(Object.entries(toldBefore).some(([k, b]) => b > 0 && tf().prog.cow.tracks[k].told === b - 1), 'something goes back');
      assert(tf().sexprog && tf().influence.cow < infBefore, 'the way over stays and the influence falls: ' + JSON.stringify({ sx: !!tf().sexprog, inf: tf().influence.cow, infBefore }));
      clean(h);
    } finally { h.close(); }

    // The way over finishes on a seeded path one waypoint from done on every track: the body becomes a woman's, the chest ends as the
    // drawn shape, what lasted is summarised, and the ten lines no longer repeat.
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    let seeded, advKey; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)); const doc = seeded.get(advKey).data; const seedId = advKey.split('/')[1];
    const sexTracks = Object.fromEntries(TR.woman.map((t) => [t.key, { s: 12, e: 20, p: stageAt(t.stages.length - 1, t.stages.length), told: t.stages.length - 1, nextAt: 0 }]));
    doc.state.tf = { influence: { cow: 100 }, traits: [], rungs: {}, arcs: [], tracks: [], paths: { cow: { sex: 'female', sexTold: [], formTold: [], day: 1, order: [], eye: 'eyes dark with a blue cast like a calf\'s', breasts: 'full, heavy breasts; the nipples long and dark' } }, prog: { cow: { lean: 0, face: 15, tracks: {} } }, sexprog: { species: 'cow', to: 'female', tracks: sexTracks }, last: {}, drifted: {} };
    doc.settings.pace = 'unbounded';
    const h2 = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h2.settle(150, 8000)); await h2.idle(10000); await h2.settle(100, 4000);
      patchTurns(h2, (r) => { r.time_advance_minutes = 240; r.exposures = []; });
      const tf2 = () => onlyAdv(h2.mock.store).data.state.tf, turns = () => storedTurns(h2.mock.store, seedId);
      for (let i = 0; i < 24 && !tf2().sex; i++) assert(await h2.turn('I get on with the day.'));
      assert(tf2().sex && tf2().sex.to === 'female' && tf2().sex.species === 'cow', 'the body is a woman\'s once every track is told: ' + JSON.stringify(tf2().sexprog && tf2().sexprog.tracks) + ' ' + JSON.stringify(turns().flatMap((t) => t.notes).slice(-12)));
      const all = turns().flatMap((t) => t.notes); assert(all.some((n) => /^the body is a woman's now \(cow path\)/.test(n)), 'the engine notes the body going over');
      assert(await h2.turn('I get on with the day.'));
      const p2 = promptOf(lastTurn(h2));
      // The last waypoints are told on the turn the body goes over, so their notes reach the prompt after it.
      const prompts = turnCalls(h2).map(promptOf).join('\n');
      assert.match(prompts, /Chest \(waypoint 5 of 5\): Tanner 5, finished\.[^\n]*The size and shape drawn: [Ff]ull, heavy breasts\./, 'the chest ends as the shape drawn for the path: ' + (prompts.match(/Chest \(waypoint 5 of 5\)[^\n]{0,400}/) || ['none'])[0]);
      assert(prompts.includes('Below (waypoint 5 of 5): ') && prompts.includes(T.sexStages.genitals.replace(/\{[^}]+\}/g, '').slice(0, 40)), 'what is below is stated once, in the world\'s words: ' + (prompts.match(/Below \(waypoint[^\n]{0,300}/) || ['none'])[0] + ' | ' + T.sexStages.genitals.slice(0, 120));
      assert.match(p2, /Settled on the way over \(bovine mythkin path\): /, 'what lasted of the way over is summarised');
      assert.match(p2, /The breasts grown on this path: [Ff]ull, heavy breasts\./, 'with the chest grown: ' + (p2.match(/Settled on the way over[^\n]{0,600}/) || ['none'])[0]);
      assert.doesNotMatch(p2, /Toward a woman's body so far/, 'the running summary stops once the body is over');
      assert.match(p2, /Tom's body is a woman's now, the whole of it/, 'the body line says so');
      clean(h2);
    } finally { h2.close(); }

    // A save from before the tracks (ladder rungs, a running step track) opens on the tracks: progress read from its influence and
    // marked told, so nothing is announced again; the ladder's step tracks for the kind are dropped.
    const old = JSON.parse(JSON.stringify(doc)); const cow = T.species.cow;
    old.state.tf = { influence: { cow: 55, fox: 20 }, rungs: { cow: 3, fox: 1 }, traits: [{ species: 'cow', trait: cow.ladder[0].trait, day: 1, settled: true }, { species: 'cow', trait: cow.ladder[2].trait, day: 2, settled: false }], arcs: [], paths: { cow: { sex: null, sexTold: [], formTold: [], day: 1, order: [0, 1, 2, 3, 4], eye: 'brown' } },
      tracks: [{ species: 'cow', rung: 3, kind: 'body', trait: cow.ladder[2].trait, steps: ['a', 'b', 'c'], anatomy: '', habits: [], noticed: '', i: 1, nextAt: 0, day: 2, beganAt: 0 }], last: {}, drifted: {} };
    seeded.get(advKey).data = old;
    const h3 = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h3.settle(150, 8000)); await h3.idle(10000); await h3.settle(100, 4000);
      patchTurns(h3, (r) => { r.time_advance_minutes = 60; r.exposures = []; });
      assert(await h3.turn('I get on with the day.'));
      const st = onlyAdv(h3.mock.store).data.state.tf, t = storedTurns(h3.mock.store, seedId).at(-1);
      assert(st.prog && st.prog.cow && st.prog.fox, 'the kinds with influence have their tracks');
      assert(!st.tracks.some((x) => x.species === 'cow'), 'the ladder\'s step track for the kind is dropped');
      assert(!t.notes.some((n) => /^change begins/.test(n)), 'nothing already lived through is announced again: ' + JSON.stringify(t.notes));
      for (const t2 of TR.species.cow) { const r = st.prog.cow.tracks[t2.key]; assert(r.told >= Math.floor(r.p * t2.stages.length / 100 + 1e-9) - 0 || r.p <= stageAt(r.told + 1, t2.stages.length), t2.key + ' migrated progress is marked told'); }
      assert(st.traits.every((x) => x.settled !== false), 'the running ladder change counts as settled');
      clean(h3);
    } finally { h3.close(); }
  },

  // The body fights off a small change: after a quiet story day with nothing of its kind, a part at half or less eases back a
  // waypoint, then another each quiet day, the latest told first, until it is gone; a part past half never falls; contact again lets
  // an eased part go on. Influence drifts down after a quiet day only to where the latest part still told began. Fails on 4b2530d
  // (on tracks nothing eased).
  async partsEaseBack() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const TR = ctx.window.WINDLASS_WORLDS.sundered.transformation.tracks; assert(TR && TR.species && TR.species.cow, 'the world carries the track model');
    const stageAt = (j, n) => Math.ceil(j * 100 / n - 1e-9);
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    let seeded; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data, id = advKey.split('/')[1];
    const plain = TR.species.cow.filter((t) => !t.sex && !t.needs && t.stages.length >= 3);
    const small = plain.slice(0, 3).map((t) => t.key), set = plain[3];
    assert(set, 'a fourth plain track to hold past half');
    const setTold = set.stages.length - 1;
    const tracks = Object.fromEntries(TR.species.cow.map((t) => [t.key, small.includes(t.key) ? { s: 30, e: 80, p: stageAt(1, t.stages.length), told: 1, nextAt: 0 }
      : t.key === set.key ? { s: 20, e: 95, p: stageAt(setTold, t.stages.length), told: setTold, nextAt: 0 } : { s: 70, e: 95, p: 0, told: 0, nextAt: 0 }]));
    doc.state.tf = { influence: { cow: 34 }, traits: [], rungs: {}, arcs: [], tracks: [], paths: { cow: { sex: null, sexTold: [], formTold: [], day: 1, order: [], eye: 'eyes dark with a blue cast like a calf\'s' } }, prog: { cow: { lean: 0, face: 15, tracks } }, last: {}, drifted: {} };
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      patchTurns(h, (r) => { r.time_advance_minutes = 720; r.exposures = []; });
      const tf = () => onlyAdv(h.mock.store).data.state.tf, told = (k) => tf().prog.cow.tracks[k].told;
      let eased = 0, sawPrompt = false;
      for (let i = 0; i < 12; i++) {
        const before = small.map(told);
        assert(await h.turn('I keep to myself and study.'), 'turn ' + (i + 1));
        const after = small.map(told), down = before.reduce((a, b, x) => a + b - after[x], 0);
        assert(down >= 0 && down <= 1, 'at most one part eases a turn: ' + before + ' -> ' + after);
        eased += down;
        assert.equal(told(set.key), setTold, 'the part past half never falls');
        const p = promptOf(lastTurn(h)), block = p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>'));
        if (/Note from the engine: The body (?:has fought|is fighting) off a change/.test(p)) sawPrompt = true;
        if (i === 0) assert.equal(down, 0, 'nothing eases before a quiet day has passed');
        assert(tf().influence.cow >= 20, 'influence never drifts below where the latest part still told began: ' + tf().influence.cow);
      }
      assert.equal(eased, 3, 'the three small parts each ease back to nothing, a quiet day apart');
      assert(small.every((k) => told(k) === 0), 'the small parts are gone: ' + small.map(told));
      assert(sawPrompt, 'the narrator is told the body fights the change off');
      assert(storedTurns(h.mock.store, id).some((t) => t.notes.some((n) => /^cow change easing: /.test(n))), 'the easing is noted');
      assert(storedTurns(h.mock.store, id).some((t) => t.notes.some((n) => /^cow influence -\d/.test(n))), 'influence does drift on quiet days');
      assert(small.every((k) => tf().prog.cow.tracks[k].eased != null), 'an eased part is held where it eased to');
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = [{ species: 'cow', method: 'a hug', intensity: 1 }]; });
      assert(await h.turn('I hug Daisy.'));
      assert(small.every((k) => tf().prog.cow.tracks[k].eased == null), 'contact again lets an eased part go on');
      clean(h);
    } finally { h.close(); }
  },
  // A long quiet with earned waypoints still to tell: the telling goes on, and the body fights off only a part that has stood a
  // quiet day since it was told, never the one just begun or just moved on.
  async quietDoesNotUndoNewParts() {
    const W = loadWorld(), TR = W.transformation.tracks.species.cow, after = W.transformation.fade.trackAfterHours * 60;
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    const plain = TR.filter((t) => !t.sex && !t.needs && t.stages.length >= 3);
    const tracks = Object.fromEntries(TR.map((t) => [t.key, plain.includes(t) ? { s: 12, e: 60, p: 0, told: 0, nextAt: 0 } : { s: 70, e: 95, p: 0, told: 0, nextAt: 0 }]));
    g.doc.state.tf = { influence: { cow: 40 }, traits: [], rungs: {}, arcs: [], tracks: [], paths: { cow: { sex: null, sexTold: [], formTold: [], day: 1, order: [], eye: 'eyes dark with a blue cast like a calf\'s' } }, prog: { cow: { lean: 0, face: 15, tracks } }, last: {}, drifted: {} };
    g.doc.settings.pace = 'standard';
    const h = await bootOn(g.store);
    try {
      patchTurns(h, (r) => { r.time_advance_minutes = 720; r.exposures = []; });
      const tf = () => onlyAdv(h.mock.store).data.state.tf, rec = (k) => tf().prog.cow.tracks[k];
      let eased = 0;
      for (let i = 0; i < 12; i++) {
        const before = Object.fromEntries(TR.map((t) => [t.key, rec(t.key).told]));
        assert(await h.turn('I keep to myself and study.'), 'turn ' + (i + 1));
        const notes = storedTurns(h.mock.store, g.id).at(-1).notes;
        for (const t of TR) {
          const r = rec(t.key); if (r.told >= before[t.key]) continue;
          eased++;
          assert(r.at == null || r.eased - r.at >= after, t.name + ' is fought off ' + Math.round((r.eased - r.at) / 60) + ' h after it was told (turn ' + (i + 1) + '): ' + JSON.stringify(notes));
        }
      }
      assert(eased > 0, 'the quiet still eases a part that has stood');
      clean(h);
    } finally { h.close(); }
  },
  // Healing: the body never changes back by itself, but the Spa heals on purpose, one waypoint a visit, the earlier stage line
  // returning: one change (named by the narrator as kind and track), a change the body's sex stands on, a kind's whole set, the sex,
  // or everything. A change another needs goes back with it, the other first, and the healer says so beforehand; at 0 the part is
  // the person's own again. The draws stay, a healed part waits for new contact, and bonds are never touched. Fails on f73fe18.
  async spaHealsStepByStep() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const TR = ctx.window.WINDLASS_WORLDS.sundered.transformation.tracks, stageAt = (j, n) => Math.ceil(j * 100 / n - 1e-9);
    const byKey = (M, k) => M.find((t) => t.key === k), n = (k) => byKey(TR.species.cow, k).stages.length;
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    let seeded; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data, id = advKey.split('/')[1];
    const told = { tail: n('tail'), ears: 1, toes_and_hooves: 2, feet_and_stance: 2, teats_and_udder: 1 };
    const tracks = Object.fromEntries(TR.species.cow.map((t) => [t.key, { s: 20, e: 60, p: stageAt(told[t.key] || 0, t.stages.length), told: told[t.key] || 0, ext: 0, nextAt: 0, eased: 0 }]));
    const sexTold = { chest: 3, voice: 2 };
    const sexTracks = Object.fromEntries(TR.woman.map((t) => [t.key, { s: 20, e: 60, p: stageAt(sexTold[t.key] || 0, t.stages.length), told: sexTold[t.key] || 0, nextAt: 0, eased: 0 }]));
    // Every part is held where it stands (as the body holds a part it has fought back) until contact, so only the Spa moves them.
    doc.state.tf = { influence: { cow: 60 }, traits: [{ species: 'cow', trait: 'Tail: ' + byKey(TR.species.cow, 'tail').endsAs, day: 1, settled: true, track: 'tail' }], rungs: {}, arcs: [], tracks: [],
      paths: { cow: { sex: 'female', sexTold: [], formTold: [], day: 1, order: [], eye: 'eyes dark with a blue cast like a calf\'s', breasts: 'full, heavy breasts; the nipples long and dark' } },
      prog: { cow: { lean: 1, face: 22, tracks } }, sexprog: { species: 'cow', to: 'female', tracks: sexTracks }, last: { cow: 0 }, drifted: {} };
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      let spa = null, contact = [];
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = contact; r.spa_reset = spa || []; });
      const data = () => onlyAdv(h.mock.store).data, tf = () => data().state.tf, last = () => storedTurns(h.mock.store, id).at(-1);
      const cow = (k) => tf().prog.cow.tracks[k], sex = (k) => tf().sexprog.tracks[k];
      const bonds0 = JSON.stringify(data().state.bonds || {});
      // At the Spa the narrator is told the links before the bath, and the reply contract names what can be healed.
      assert(await h.turn('I walk to the Restoration Spa and ask what it can do.'));
      const p0 = promptOf(lastTurn(h));
      assert.match(p0, /Healing links \(the Spa's healer says these before the bath, plainly\): [^\n]*Toes and hooves cannot go back below stage 2 while Feet and stance stands; Feet and stance goes back with it/, 'the healer knows the toes wait on the stance: ' + (p0.match(/Healing links[^\n]*/) || ['none'])[0]);
      assert.match(p0, /Chest cannot go back below stage 3 while Teats and udder stands/, 'and that the udder stands on the chest');
      assert.match(p0, /"spa_reset": \[\] normally; when Tom uses the Restoration Spa this turn, what Tom asks it to heal: "all" \(everything\), a species key[^\n]*"sex\.<track>"; each visit takes each change named back one step/, 'the contract names the targets');
      assert.match(p0, /any change can be healed on purpose at the Restoration Spa[^\n]*one step a visit|the Spa heals any on purpose, one step a visit\./, 'and the narrator knows healing is on purpose, a step a visit');
      // One change, named as the narrator would name it: the tail goes back one waypoint, its earlier line returning; the rest stay.
      spa = ['bovine mythkin: Tail'];
      assert(await h.turn('I ask the healer to take the tail back.'));
      assert.equal(cow('tail').told, n('tail') - 1, 'the tail goes back one waypoint');
      assert.equal(cow('tail').p, stageAt(n('tail') - 1, n('tail')), 'its progress sits at the earlier waypoint');
      assert.deepEqual([cow('ears').told, cow('toes_and_hooves').told, cow('feet_and_stance').told, tf().influence.cow], [1, 2, 2, 60], 'nothing else is healed and the influence stays: ' + JSON.stringify(last().notes));
      assert(!tf().traits.some((x) => x.track === 'tail'), 'the finished tail is no longer a settled change');
      assert(cow('tail').eased > 0 && [cow('tail').s, cow('tail').e, cow('tail').ext, tf().prog.cow.lean, tf().prog.cow.face].join() === '20,60,0,1,22', 'the draws stay and the healed part is held');
      assert(last().notes.some((x) => /^Spa heal \(cow\.tail\): cow Tail 4→3/.test(x)), 'the heal is noted: ' + JSON.stringify(last().notes));
      spa = null;
      assert(await h.turn('I wake in the rest room.'));
      const p1 = promptOf(lastTurn(h)), tail = byKey(TR.species.cow, 'tail').stages;
      assert(p1.includes('Tom used the Restoration Spa last turn (bovine mythkin: tail): each change went back one step, the same slow morph in reverse.'), 'the narrator is told of the visit');
      assert(p1.includes('Tail (bovine mythkin): ' + tail[3].replace(/\.$/, '').slice(0, 40)) && p1.includes('back to ' + tail[2].replace(/\.$/, '').slice(0, 40)), 'with the earlier stage line as the state it returns to');
      assert.match(p1, /whether it is a relief, a loss or both is the player's/, 'what Tom makes of it is the player\'s');
      // The toes stand under the stance: healing them takes the stance back first, and the toes follow once it is back far enough.
      spa = ['cow.toes_and_hooves'];
      assert(await h.turn('I go back to the Spa about the toes.'));
      assert.deepEqual([cow('toes_and_hooves').told, cow('feet_and_stance').told], [2, 1], 'the stance goes back first; the toes wait');
      spa = null; assert(await h.turn('I sleep it off.'));
      assert.match(promptOf(lastTurn(h)), /Before the bath the healer said so: Feet and stance had to go back with Toes and hooves, since the one is built on the other/, 'the healer said so');
      assert.match(promptOf(lastTurn(h)), /Toes and hooves stays as it is this visit, until Feet and stance is back far enough/, 'and why the toes waited');
      spa = ['cow.toes_and_hooves'];
      assert(await h.turn('I go back to the Spa about the toes again.'));
      assert.deepEqual([cow('toes_and_hooves').told, cow('feet_and_stance').told], [1, 0], 'the stance is gone and the toes go back with it');
      spa = null; assert(await h.turn('I sleep it off again.'));
      assert.match(promptOf(lastTurn(h)), /Feet and stance \(bovine mythkin\): [^\n]*? no longer; the part is Tom's own again[^\n]*tell once what is missing/, 'at 0 the part is the person\'s own again, its absence told once: ' + (promptOf(lastTurn(h)).match(/Tom used the Restoration Spa[^\n]*/) || ['none'])[0]);
      // The body's sex: the chest going back under stage 3 takes the udder (a woman's track on a body going over) back with it.
      spa = ['sex.Chest'];
      assert(await h.turn('I ask the Spa to start on the chest.'));
      assert.deepEqual([cow('teats_and_udder').told, sex('chest').told], [0, 2], 'the udder goes back with the chest, in one visit');
      // A kind's whole set: every bovine change one step, the influence down to just under the next waypoint, the draws kept.
      const before = Object.fromEntries(Object.entries(tf().prog.cow.tracks).map(([k, r]) => [k, r.told]));
      spa = ['cow'];
      assert(await h.turn('I ask the Spa to take back the bovine changes.'));
      for (const [k, b] of Object.entries(before)) assert.equal(cow(k).told, Math.max(0, b - 1), k + ' goes back one step');
      assert(tf().influence.cow < 60 && tf().influence.cow >= 0, 'the influence falls with them: ' + tf().influence.cow);
      assert.equal(sex('voice').told, 2, 'the body\'s sex is not part of the kind\'s set');
      assert(tf().prog.cow && tf().prog.cow.lean === 1 && tf().paths.cow.breasts, 'the draws are kept for a change taken up again');
      // Everything: the rest of every track one step, the sex included; the bonds untouched throughout.
      spa = ['all'];
      assert(await h.turn('I ask the Spa for everything.'));
      assert.deepEqual([sex('voice').told, sex('chest').told], [1, 1], 'the sex goes back a step with everything');
      assert.equal(JSON.stringify(data().state.bonds || {}), bonds0, 'bonds are never healed');
      // A single hug does not undo the visit; a night of new contact lets a healed part go on again, the same as it was.
      spa = null; contact = [{ species: 'cow', method: 'a hug', intensity: 1 }];
      assert(await h.turn('I hug Daisy.'));
      assert(cow('tail').eased != null, 'one hug does not undo a Spa visit');
      contact = [{ species: 'cow', method: 'a night sleeping against Daisy', intensity: 3 }];
      patchTurns(h, (r) => { r.time_advance_minutes = 480; r.exposures = contact; r.spa_reset = []; });
      assert(await h.turn('I sleep beside Daisy tonight.'));
      assert(cow('tail').eased == null, 'contact again lets a healed part go on');
      clean(h);
    } finally { h.close(); }
  },
  // A Spa visit on the very turn the body's easing falls due takes the part asked for back its one step, not two: the healed part is
  // not also fought off, and the narrator is told of the visit alone for it. A whole kind's visit leaves each part one step down.
  async spaTurnDoesNotEaseTheHealedPart() {
    const W = loadWorld(), TR = W.transformation.tracks.species.cow, kind = W.transformation.species.cow.name;
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    const run = async (spa) => {
      const store = copyStore(g.store), doc = store.get(g.key).data; doc.state.day += 2;
      const m = /^(\d{1,2}):(\d{2})/.exec(doc.state.time), start = (doc.state.day - 1) * 1440 + (+m[1]) * 60 + (+m[2]);
      const told = { ears: 2, tail: 1 };
      const tracks = Object.fromEntries(TR.map((t) => [t.key, { s: 10, e: 50, p: stageAt(told[t.key] || 0, t.stages.length), told: told[t.key] || 0, ext: 0, nextAt: 0 }]));
      // Two hour-long turns: the quiet is under a day on the first and just past it on the second, the Spa's.
      doc.state.tf = { influence: { cow: 30 }, traits: [], rungs: {}, arcs: [], tracks: [], paths: { cow: { sex: null, sexTold: [], formTold: [], day: 1, order: [], eye: 'dark eyes' } }, prog: { cow: { lean: 1, face: 22, tracks } }, last: { cow: start + 120 - 1470 }, drifted: {} };
      doc.settings.pace = 'standard';
      const h = await bootOn(store);
      try {
        let now = [];
        patchTurns(h, (r) => { r.time_advance_minutes = 60; r.exposures = []; r.spa_reset = now; });
        const rec = (k) => onlyAdv(h.mock.store).data.state.tf.prog.cow.tracks[k], last = () => storedTurns(h.mock.store, g.id).at(-1);
        assert(await h.turn('I keep to myself.'));
        assert.deepEqual([rec('ears').told, rec('tail').told], [2, 1], spa + ': nothing eases before the quiet day is out: ' + JSON.stringify(last().notes));
        now = spa;
        assert(await h.turn('I go to the Restoration Spa.'));
        const notes = last().notes;
        assert.equal(rec('ears').told, 1, spa + ': the ears go back one step, not two: ' + JSON.stringify(notes));
        assert(!notes.some((x) => /^cow change easing: Ears/.test(x)), spa + ': the healed ears are not fought off as well: ' + JSON.stringify(notes));
        if (spa[0] === 'cow') assert.equal(rec('tail').told, 0, spa + ': each part of the kind goes one step down');
        now = [];
        assert(await h.turn('I wake in the rest room.'));
        const p = promptOf(lastTurn(h));
        assert.match(p, /Tom used the Restoration Spa last turn/, spa + ': the narrator is told of the visit');
        assert(!p.includes('The body has fought off a change (' + kind + '): Ears'), spa + ': and not that the body fought the ears off: ' + (p.match(/Note from the engine: The body has fought[^\n]{0,200}/) || ['none'])[0]);
        assert.match(p, /Body detail \(binding\)/, spa + ': the visit is told as a change on the page');
        clean(h);
      } finally { h.close(); }
    };
    await run(['cow.ears']);
    await run(['cow']);
  },
  // A kind healed whole keeps the influence just under the next waypoint of a part that can move on this body: a part closed to a
  // man's body, or one that waits on another part the heal took back, does not pull it lower.
  async spaKindHealSkipsClosedTracks() {
    const TR = loadWorld().transformation.tracks.species.cow;
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    const told = { tail: 2, ears: 2, toes_and_hooves: 1, feet_and_stance: 1 };
    const after = { tail: 1, ears: 1 };
    // What the override reads: the least influence at which a part open to a man's body, and free of any need, takes its next waypoint.
    const want = Math.min(...TR.filter((t) => t.sex !== 'women' && !(t.needs && t.needs.length)).map((t) => 40 + Math.ceil(stageAt((after[t.key] || 0) + 1, t.stages.length) * 40 / 100))) - 1;
    for (const low of ['teats_and_udder', 'feet_and_stance']) {
      const store = copyStore(g.store), doc = store.get(g.key).data;
      const tracks = Object.fromEntries(TR.map((t) => [t.key, Object.assign({ s: 40, e: 80, p: stageAt(told[t.key] || 0, t.stages.length), told: told[t.key] || 0, ext: 0, nextAt: 0 }, t.key === low ? { s: 14, e: 54 } : {})]));
      doc.state.tf = baseTf('cow', 62, { lean: 0, face: 15, tracks });
      const h = await bootOn(store);
      try {
        let spa = ['cow'];
        patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; r.spa_reset = spa; });
        assert(await h.turn('I go to the Restoration Spa and ask it to take the bovine changes back.'));
        const tf = onlyAdv(h.mock.store).data.state.tf;
        assert.deepEqual([tf.prog.cow.tracks.tail.told, tf.prog.cow.tracks.ears.told, tf.prog.cow.tracks.toes_and_hooves.told, tf.prog.cow.tracks.feet_and_stance.told], [1, 1, 0, 0], low + ': each part goes back one step');
        assert.equal(tf.influence.cow, want, low + ' (a part that cannot move) does not set the influence: ' + JSON.stringify(storedTurns(h.mock.store, g.id).at(-1).notes));
        clean(h);
      } finally { h.close(); }
    }
  },

  // A Spa target is read as the narrator writes it: a list in one string is split, a part named by a word of its name that no
  // other part has is found, and a target the engine cannot read is noted and the narrator told the healer could not tell.
  async spaTargetsReadOrNoted() {
    const TR = loadWorld().transformation.tracks.species.cow;
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    const told = { tail: 4, ears: 2, toes_and_hooves: 2, feet_and_stance: 2 };
    for (const [spa, check] of [
      ['cow.ears, cow.tail', (rec, notes) => { assert.deepEqual([rec('ears').told, rec('tail').told], [1, 3], 'a list in one string heals each: ' + JSON.stringify(notes)); }],
      [['cow.hooves'], (rec, notes) => { assert(notes.some((x) => /^Spa heal \(cow\.toes_and_hooves\)/.test(x)), 'a part named by a word of its own name is found: ' + JSON.stringify(notes)); }],
      [['ears and tail'], (rec, notes, p) => {
        assert(notes.includes('ignored Spa target "ears and tail"'), 'a target that cannot be read is noted: ' + JSON.stringify(notes));
        assert.deepEqual([rec('ears').told, rec('tail').told], [2, 4], 'and nothing is healed');
        assert.match(p, /Tom went to the Restoration Spa last turn, but the healer could not tell which change was meant \("ears and tail"\)/, 'the narrator is told the healer could not tell: ' + (p.match(/Note from the engine: [^\n]*Spa[^\n]{0,200}/) || ['none'])[0]);
      }]]) {
      const store = copyStore(g.store), doc = store.get(g.key).data;
      doc.state.tf = baseTf('cow', 60, { lean: 0, face: 15, tracks: heldParts(TR, Object.fromEntries(Object.entries(told).map(([k, j]) => [k, { told: j }]))) });
      const h = await bootOn(store);
      try {
        let now = spa;
        patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; r.spa_reset = now; });
        const rec = (k) => onlyAdv(h.mock.store).data.state.tf.prog.cow.tracks[k];
        assert(await h.turn('I go to the Restoration Spa.'));
        const notes = storedTurns(h.mock.store, g.id).at(-1).notes;
        now = [];
        assert(await h.turn('I wake in the rest room.'));
        check(rec, notes, promptOf(lastTurn(h)));
        clean(h);
      } finally { h.close(); }
    }
  },

  // A kind healed whole before any of it showed: the pull it was gathering is cleared, and the narrator is told so, not that nothing
  // changed.
  async spaClearsAPullBeforeAnyChange() {
    const TR = loadWorld().transformation.tracks.species.cow;
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    g.doc.state.tf = baseTf('cow', 30, { lean: 0, face: 15, tracks: heldParts(TR, {}) });
    const h = await bootOn(g.store);
    try {
      let spa = ['cow'];
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; r.spa_reset = spa; });
      assert(await h.turn('I go to the Restoration Spa and ask it to take the bovine pull away.'));
      const t = storedTurns(h.mock.store, g.id).at(-1);
      assert.equal(onlyAdv(h.mock.store).data.state.tf.influence.cow, 0, 'the pull is cleared');
      assert(t.diff.some((x) => x.path === 'tf.influence.cow' && x.to === 0), 'and the diff says so');
      assert(!t.notes.some((x) => /nothing to heal/.test(x)) && t.notes.some((x) => /pull cleared \(cow 30→0\)/.test(x)), 'the engine notes the pull cleared, not nothing to heal: ' + JSON.stringify(t.notes));
      spa = [];
      assert(await h.turn('I wake in the rest room.'));
      const p = promptOf(lastTurn(h));
      assert.doesNotMatch(p, /nothing of it on the body to take back[^\n]*nothing changed/, 'the narrator is not told nothing changed');
      assert.match(p, /was washed out with the bath, and nothing of it comes on again without new contact/, 'it is told the gathering pull was washed out');
      clean(h);
    } finally { h.close(); }
  },
  // A body that went over on the ladder, before the tracks, opens with its way over finished on the tracks: the settled lines read
  // it, and the Spa can take the body's sex back a step as it can on a body gone over on the tracks.
  async ladderSexSaveHeals() {
    const W4 = loadWorld().transformation.tracks.woman;
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    g.doc.state.tf = { influence: { cow: 90 }, traits: [{ species: 'cow', trait: 'ears lengthen and soften', day: 2, settled: true }], rungs: { cow: 5 }, arcs: [], tracks: [],
      paths: { cow: { sex: 'female', sexTold: ['{tanner2}', '{tanner3}', '{tanner4}', '{genitals}'], formTold: [], day: 1, order: [0, 1, 2, 3, 4], eye: 'dark eyes' } },
      sex: { to: 'female', species: 'cow', rung: 5, day: 5 }, last: { cow: 0 }, drifted: {} };
    const h = await bootOn(g.store);
    try {
      let spa = [];
      patchTurns(h, (r) => { r.time_advance_minutes = 120; r.exposures = []; r.spa_reset = spa; });
      const tf = () => onlyAdv(h.mock.store).data.state.tf;
      assert(await h.turn('I sit quietly.'));
      const sx = tf().sexprog;
      assert(sx && sx.species === 'cow' && sx.to === 'female' && W4.every((t) => sx.tracks[t.key] && sx.tracks[t.key].told === t.stages.length), 'the way over is on the tracks, every track finished: ' + JSON.stringify(sx && sx.tracks));
      assert.match(promptOf(lastTurn(h)), /Settled on the way over \(bovine mythkin path\): /, 'the settled lines read it');
      spa = ['sex'];
      assert(await h.turn('I go to the Restoration Spa and ask it to take the change of sex back.'));
      const notes = storedTurns(h.mock.store, g.id).at(-1).notes;
      assert(notes.some((x) => /^Spa heal \(sex\): (?!nothing)/.test(x)), 'the Spa takes the body\'s sex back a step: ' + JSON.stringify(notes));
      assert(!tf().sex, 'and the body is on its way back');
      clean(h);
    } finally { h.close(); }
  },
  // The doc's fields and behaviours folded into the game. Every kind's ways (its senses, appetites and instincts, and the by-sex
  // nature lines) go beside a person's looks in the scene, a bovine woman's milk left to the lore; a bovine woman's Bust is the chest's
  // shape, its nipples told by Teats and udder; the cat carries three more pairs. A path draws the coat's colour and the kind's other
  // per-person draws (a werewolf's fur and its pads and claws) once, and says them where a line brings them up. A finished part shows in a
  // way the body already has, not one not yet begun. A second track of a range row takes the first's draw, so a kitsune at the least
  // grows no second tail. A body that is a man's through another path goes over again on the rabbit's. Fails on f73fe18.
  async docFoldBehaviours() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const Wd = ctx.window.WINDLASS_WORLDS.sundered, TR = Wd.transformation.tracks, L = Wd.genPools.looks.kinds, stageAt = (j, n) => Math.ceil(j * 100 / n - 1e-9);
    const byKey = (k, key) => TR.species[k].find((t) => t.key === key);
    for (const k of Object.keys(TR.species)) {
      assert(L[k] && Array.isArray(L[k].ways) && L[k].ways.length >= 5, k + ' lists its ways');
      for (const key of L[k].ways) assert(byKey(k, key), k + ' way ' + key + ' is one of its tracks');
    }
    assert(!L.cow.ways.includes('milk'), 'a bovine woman\'s milk is left to the lore');
    assert.match(byKey('cat', 'further_pairs').range.least, /^Two more pairs/, 'the cat\'s least is two more pairs');
    for (const [k, key, on] of [['fox', 'second_tail', 'tail'], ['rabbit', 'belly_fur', 'leg_and_hip_coat']]) { const t = byKey(k, key); assert.equal(t.extentWith, on, k + ' ' + key + ' takes its extent from ' + on); assert.match(t.range.least, /^None$/, 'and has none at the least'); }
    assert(Wd.genPools.species.cow.breasts.every((b) => /;/.test(b) && !/nipple/.test(b.split(';')[0])), 'a bovine chest draw is its shape, then its nipples');
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', gender: 'female', name: 'Ana Reyes' });
    let seeded; try {
      assert(await first.turn('I unpack and say hello to Daisy.'));
      const p0 = promptOf(lastTurn(first)), daisy = (p0.split('\n').find((l) => /^- Daisy Holm/.test(l)) || '');
      assert.match(daisy, /Ways \(show, never explain\): (weather, water and grass read by nose[^;.]*|greens and grain, eaten slowly and chewed twice|a heavy, warm body[^;.]*|placid[^;.]*|a low hum and a carrying low|warm hide, hay and milk)\./, 'the roommate in the scene carries one of her kind\'s ways a turn: ' + daisy.slice(0, 200));
      assert.doesNotMatch(daisy, /being in milk/, 'and not the milk');
      // In the paragraph the chest sentence is the shape alone, and stands just before the teats and udder sentence, which tells the rest.
      const said = ((/ Looks: (.*?) (?:Not on this body:|Dress:)/.exec(daisy) || [])[1] || '').replace(/\.$/, '').split(/\. (?=[A-Z])/), at = said.findIndex((s) => /\b(?:teats|udder)\b/.test(s));
      const bust = at > 0 ? said[at - 1] : ''; assert(bust && /\bbreasts\b/.test(bust) && !/nipple/.test(bust), 'her chest sentence is its shape, before the teats: ' + bust + ' | ' + daisy.slice(0, 600));
      assert.match(said[at] || '', /nipples|teats/, 'and the teats and udder sentence tells the rest');
      seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data, id = advKey.split('/')[1];
    // Every seeded part is held where it stands but the ones under test: the werewolf's hands one waypoint short of finished with
    // its smell finished, and the kitsune's second tail on a body at the least whose first tail is finished.
    const held = (k, told, open) => Object.fromEntries(TR.species[k].map((t) => { const j = told[t.key] || 0, n = t.stages.length; return [t.key, Object.assign({ s: 5, e: 30, p: stageAt(j, n), told: j, ext: 0, nextAt: 0 }, open.includes(t.key) ? {} : { eased: 0 })]; }));
    const wolf = held('wolf', { smell: byKey('wolf', 'smell').stages.length, hands: 3 }, ['hands']); wolf.hands.p = 100;
    const fox = held('fox', { tail: byKey('fox', 'tail').stages.length }, ['second_tail']);
    const man = Object.fromEntries(TR.man.map((t) => [t.key, { s: 5, e: 30, p: 100, told: t.stages.length, nextAt: 0 }]));
    doc.state.tf = { influence: { wolf: 60, fox: 90 }, traits: [], rungs: {}, arcs: [], tracks: [],
      paths: { wolf: { sex: null, sexTold: [], formTold: [], day: 1, order: [], eye: 'amber eyes' }, fox: { sex: 'male', sexTold: [], formTold: [], day: 1, order: [], eye: 'yellow eyes' } },
      prog: { wolf: { lean: 0, face: 15, tracks: wolf }, fox: { lean: -1, face: 15, tracks: fox } },
      sex: { to: 'male', species: 'fox', day: 1 }, sexprog: { species: 'fox', to: 'male', tracks: man }, last: { wolf: 0, fox: 0 }, drifted: {} };
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      let contact = [{ species: 'rabbit', method: 'a hug', intensity: 1 }];
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = contact; });
      const data = () => onlyAdv(h.mock.store).data, tf = () => data().state.tf, last = () => storedTurns(h.mock.store, id).at(-1);
      assert(await h.turn('I hug a rabbit girl from the Warren.'));
      // The rabbit's path on a body that is a man's through the kitsune's: it goes over again, from the man's body.
      assert.deepEqual([tf().sexprog.species, tf().sexprog.to, (tf().sexprog.from || {}).to, tf().sex, tf().paths.rabbit.sex], ['rabbit', 'female', 'male', undefined, 'female'], 'the rabbit path goes over again: ' + JSON.stringify(last().notes));
      assert(last().notes.some((x) => /^rabbit path drawn: the body will go over again, toward a woman's/.test(x)), 'and says so');
      assert(tf().paths.rabbit.colour && last().notes.some((x) => /^rabbit path drawn: coat \S/.test(x)), 'the rabbit path draws its coat colour: ' + JSON.stringify(last().notes));
      // The second tail at the least: none, so it never grows, though the influence is far past its window.
      assert.equal(tf().prog.fox.tracks.second_tail.p, 0, 'no second tail at the least');
      const w = tf().paths.wolf; assert(w.colour && w.draws && w.draws.map((d) => d.label).join() === 'fur,pads and claws', 'an older path draws its colour and draws when first asked: ' + JSON.stringify(w));
      contact = [];
      assert(await h.turn('I go back to my room.'));
      const p1 = promptOf(lastTurn(h));
      assert.match(p1, /The body is a man's now, along the [^.]+ path, and going over again on the [^.]+ path/, 'the player block says the body is going over again');
      const done = (p1.match(/The change completes a part \([^)]*\): Hands[^\n]*/) || [''])[0];
      assert.match(done, /Drawn for this body: [^.]*pads and claws [^.]+\./, 'the hands\' line says the pads and claws drawn: ' + done.slice(0, 300));
      assert.match(done, /let it show in how Ana moves, eats, sleeps or reacts \(the world read by scent first\)/, 'and shows in a way the body already has: ' + done.slice(0, 600));
      assert.match(p1, /Drawn for this body, for when it shows: pelt [^;.]+; fur [^;.]+; pads and claws [^;.]+\./, 'the body now carries what was drawn');
      clean(h);
    } finally { h.close(); }
  },
  // The doc's engine rules for the tracks: one waypoint a turn; the way over, on whichever path carries it, opens the tracks
  // of the body it goes toward at their point (a season at Rhythms 3, the rest at Chest 3) and, once begun, closes the other
  // body's on every kind (before it begins, the other kinds' go on); its draws (face type, figure, height) are made once from the
  // kind's own pools and said with it; Rhythms 3 names the season that takes the cycle's place; Below waits until the player is
  // alone and is told in private, never by a cutaway; a finished part whose range row covers a later one keeps that extent back;
  // a finished track is said once; the contact rule agrees with the easing; the woman's waist and hips run with Chest 2 to 4.
  // Fails on bf487f4.
  async docFoldEngine() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const Wd = ctx.window.WINDLASS_WORLDS.sundered, T = Wd.transformation, TR = T.tracks, stageAt = (j, n) => Math.ceil(j * 100 / n - 1e-9);
    assert(T.sexDraws && T.sexDraws.woman.face.length && T.sexDraws.man.beard.length, 'the world carries the draws for the way over');
    for (const [k, key] of [['wolf', 'season'], ['fox', 'season'], ['cat', 'season'], ['mer', 'spring_tides'], ['harpy', 'laying'], ['rabbit', 'year_round'], ['dryad', 'flowering'], ['wolf', 'answering'], ['fox', 'winter_roaming'], ['cat', 'roaming'], ['cow', 'the_bulls_ground'], ['mer', 'display'], ['dryad', 'catkins']])
      assert.deepEqual(JSON.parse(JSON.stringify(TR.species[k].find((t) => t.key === key).crossAt)), { track: 'rhythms', stage: 3 }, k + ' ' + key + ' opens at Rhythms 3 on a body going over');
    // A man's body on the werewolf's path going toward a woman's, Chest at 4 and Rhythms at 2; the bovine and kitsune paths carry no
    // way over of their own. Every part is held but the ones under test.
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    let seeded; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data, id = advKey.split('/')[1];
    const held = (M, set) => Object.fromEntries(M.map((t) => { const o = set[t.key] || {}, n = t.stages.length, told = o.told === 'done' ? n : o.told || 0; return [t.key, Object.assign({ s: o.s || 8, e: 30, p: o.p != null ? o.p : stageAt(told, n), told, ext: 0, nextAt: 0 }, o.open ? {} : { eased: 0 })]; }));
    const W4 = TR.woman, n4 = (key) => W4.find((t) => t.key === key).stages.length;
    doc.state.tf = { influence: { wolf: 90, cow: 90, fox: 60 }, rungs: {}, arcs: [], tracks: [], last: { wolf: 0, cow: 0, fox: 0 }, drifted: {},
      traits: [{ species: 'wolf', trait: 'Smell: the world read by scent first', day: 1, settled: true, track: 'smell' }, { species: 'fox', trait: 'Tail: a thick tail', day: 1, settled: true, track: 'tail' }],
      paths: { wolf: { sex: 'female', sexTold: [], formTold: [], day: 1, order: [], eye: 'amber eyes' }, cow: { sex: null, sexTold: [], formTold: [], day: 1, order: [], eye: 'brown eyes' }, fox: { sex: null, sexTold: [], formTold: [], day: 1, order: [], eye: 'yellow eyes' } },
      prog: {
        wolf: { lean: 0, face: 15, tracks: held(TR.species.wolf, { hands: { told: 1, open: true, s: 1 }, smell: { told: 'done' }, spine_ruff: { told: 'done' }, further_pairs: { open: true }, mantle: { open: true }, season: { open: true } }) },
        cow: { lean: 0, face: 15, tracks: held(TR.species.cow, { tail: { told: 1, open: true }, teats_and_udder: { open: true }, horns_and_crest: { open: true } }) },
        fox: { lean: 0, face: 15, tracks: held(TR.species.fox, { tail: { told: 'done' } }) }
      },
      sexprog: { species: 'wolf', to: 'female', tracks: held(W4, { chest: { told: 4 }, rhythms: { told: 2, p: stageAt(3, n4('rhythms')), open: true, s: 2 }, below: { told: 0, p: stageAt(1, n4('below')), open: true, s: 3 } }) } };
    doc.state.present = ['Daisy Holm (roommate)'];
    const pristine = JSON.stringify([...seeded]), fresh = () => { const m = new Map(JSON.parse(pristine)); return { m, d: m.get(advKey).data }; };
    const toldSum = (tf) => Object.values(tf.prog).concat([tf.sexprog]).reduce((a, pr) => a + Object.values(pr.tracks).reduce((b, r) => b + r.told, 0), 0), before = toldSum(doc.state.tf);
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      // Daisy is in the room for three turns; then she goes and the player is alone.
      let turn = 0; patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; if (turn === 3) r.state_updates = (r.state_updates || []).filter((u) => u.key !== 'present').concat([{ key: 'present', op: 'set', value: [] }]); });
      const tf = () => onlyAdv(h.mock.store).data.state.tf, prompts = [];
      for (let i = 0; i < 6; i++) { turn = i; assert(await h.turn(i < 3 ? 'I look around the room.' : 'I sit alone in the room.'), 'turn ' + (i + 1)); prompts.push(promptOf(lastTurn(h))); if (i === 2) assert.equal(tf().sexprog.tracks.below.told, 0, 'Below waits while Daisy is in the room'); if (i === 0) {
        assert.equal(toldSum(tf()) - before, 1, 'one waypoint a turn though six are due');
        const w = tf().prog.wolf.tracks, c = tf().prog.cow.tracks;
        assert(w.further_pairs.p > 0 && c.teats_and_udder.p > 0, 'a woman\'s tracks of every kind open at Chest 3 on the way over: ' + JSON.stringify([w.further_pairs.p, c.teats_and_udder.p]));
        assert.equal(c.horns_and_crest.p, 0, 'a man\'s tracks of another kind close on a body going toward a woman\'s');
        assert.equal(w.mantle.p, 0, 'and of its own');
        assert.equal(w.season.p, 0, 'the season waits for Rhythms 3');
      } }
      assert(tf().prog.wolf.tracks.season.p > 0, 'and opens when Rhythms reaches 3');
      const [p1, , p3] = prompts, p6 = prompts[5], block = (p) => p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>'));
      const so = (/Changes so far: ([^\n]*)/.exec(block(p1)) || [])[1] || '';
      assert(!/Smell:/.test(so) && /2 finished parts, given in the body lines below/.test(so), 'a finished track is said in the body lines, not twice: ' + so);
      assert.match(p1, /A part past half never (?:changes back|reverts) by itself/, 'the contact rule agrees with the easing');
      assert.doesNotMatch(p1, /The body never (?:changes back|reverts) by itself/, 'and does not say no part ever eases');
      const foxLine = (block(p1).split('\n').find((l) => l.startsWith('Body now (' + T.species.fox.name)) || '');
      assert(/Tail \(finished\)/.test(foxLine) && !/a second with age/.test(foxLine), 'the first tail keeps the second back until it grows: ' + foxLine);
      const drawn = (s) => ((/Toward a woman's body so far \([^)]*\): [^\n]*Drawn for this body: ([^\n]*)/.exec(s) || [])[1] || '');
      assert.match(drawn(p1), /^face type [^;]+; figure [^;]*waist[^;]*hips[^;]*thighs[^;]*rear; height about \w+ foot/, 'the way over says its draws: ' + drawn(p1));
      assert.equal(drawn(p6), drawn(p1), 'and they hold from turn to turn');
      assert.match(p3, /Rhythms \(waypoint 3 of 4\): [^\n]*What starts here, as the kind gives it: [^.]*Season \(/, 'Rhythms 3 names the season that takes the cycle\'s place');
      const below = /Below \(waypoint 1 of 5\): [^\n]*told plainly, briefly and in private: found when Tom is next alone [^\n]*never by cutting away from the scene in play/;
      assert(!prompts.slice(0, 4).some((p) => below.test(p)) && prompts.slice(4).some((p) => below.test(p)), 'Below is told once Tom is alone, in private and with no cutaway');
      clean(h);
    } finally { h.close(); }
    // A way over rolled on the werewolf's path that has not begun leaves a man's tracks of the other kinds going on.
    const second = fresh(), d2 = second.d.state;
    d2.tf.sexprog = { species: 'wolf', to: 'female', tracks: held(W4, {}) };
    d2.tf.prog.wolf.tracks = held(TR.species.wolf, {}); d2.tf.traits = [];
    d2.tf.prog.cow.tracks = held(TR.species.cow, { horns_and_crest: { told: 1, open: true } });
    const nb = await boot({ setup(w, m) { m.store = second.m; } });
    try {
      assert(await nb.settle(150, 8000)); await nb.idle(10000); await nb.settle(100, 4000);
      patchTurns(nb, (r) => { r.time_advance_minutes = 30; r.exposures = []; });
      assert(await nb.turn('I look around the room.'));
      const horns = onlyAdv(nb.mock.store).data.state.tf.prog.cow.tracks.horns_and_crest, n = TR.species.cow.find((t) => t.key === 'horns_and_crest').stages.length;
      assert(horns.p >= stageAt(2, n), 'a man\'s horns go on while the way over on another path has not begun: ' + JSON.stringify(horns));
      clean(nb);
    } finally { nb.close(); }
    // A new way over: the woman's waist and hips are paced with Chest from its second waypoint to its fourth, and the draws are made
    // from the kind's own pools (a fairy's slight figure; a fairy man beardless and smooth).
    const L = Wd.genPools.looks, F = L.kinds.fairy, pool = (to, side) => [].concat(...Object.keys(L.build[to]).map((part) => (F.build[to] || {})[part] || L.build[to][part]), (F.sexDraws[side] || {}).rear || []);
    for (const [gender, name, to] of [['male', 'Tom Ashby', 'female'], ['female', 'Ana Reyes', 'male']]) {
      const g = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender, name });
      try {
        // A chance of 1 would make the fairy an all-women kind, where a woman never crosses.
        g.window.WINDLASS_WORLDS.sundered.transformation.sexChange.fairy.chance = to === 'female' ? 1 : 0.9999;
        patchTurns(g, (r) => { r.time_advance_minutes = 60; r.exposures = [{ species: 'fairy', method: 'a dance in the ring', intensity: 3 }]; });
        assert(await g.turn('I dance in the fairy ring.'));
        const sx = onlyAdv(g.mock.store).data.state.tf.sexprog; assert(sx && sx.species === 'fairy' && sx.to === to, 'the way over is rolled toward a ' + to + ' body');
        if (to === 'female') {
          const c = sx.tracks.chest, w = sx.tracks.waist_and_hips, C = c.e - c.s;
          assert(Math.abs(w.s - (c.s + 0.3 * C)) <= 1 && w.e === Math.max(w.s + 10, Math.round(c.s + 0.8 * C)), 'waist and hips run with Chest 2 to 4: ' + JSON.stringify({ c, w }));
          assert(sx.draws && sx.draws.face && sx.draws.figure, 'the way over\'s draws are made when it is rolled: ' + JSON.stringify(sx.draws));
          // The figure word comes first ("figure slight, with a slim waist, ..."); the parts after it are the pools' phrases.
          const words = sx.draws.figure.replace(/^figure \w+, with /, '').split(/, | and /);
          assert(words.every((x) => pool('female', 'woman').includes(x)), 'a fairy figure is drawn from the fairy\'s pools: ' + sx.draws.figure);
        } else assert(sx.draws && sx.draws.beard === 'no beard' && /^smooth/.test(sx.draws.bodyHair) && /slight|slim|narrow/.test(sx.draws.build), 'a fairy man is beardless, smooth and slight: ' + JSON.stringify(sx.draws));
        clean(g);
      } finally { g.close(); }
    }
  },
  // A part of a kind that belongs to one sex goes with that body when the way over finishes on another kind's path: a man's bovine
  // horns once the rabbit path has made the body a woman's, a woman's half-grown udder once the kitsune path has made it a man's. The
  // narrator is told once that it went, the body lines and the State panel drop it, it is named among the parts not on the body, it
  // does not grow again under contact, and a man's body settled on the way over has its chest said. A save that went over before
  // this keeps nothing of the old body's parts either.
  async bySexPartsGoWithTheOldBody() {
    const TR = loadWorld().transformation.tracks, T = loadWorld().transformation;
    const nearlyDone = (M) => Object.fromEntries(M.map((t) => [t.key, { s: 5, e: 30, p: 100, told: t.stages.length - 1, nextAt: 0 }]));
    const pathOf = (sex, extra) => Object.assign(emptyPath(), { sex }, extra || {});
    const tfBlock = (p) => blockOf(p, 'transformation'), bodyLine = (p, k) => tfBlock(p).split('\n').find((l) => l.startsWith('Body now (' + T.species[k].name)) || '';
    const horns = { species: 'cow', trait: 'Horns and crest: two short thick horns', day: 1, settled: true, track: 'horns_and_crest' };
    const traitsShown = async (h) => { if (h.$('#tfPanel').hidden) h.click('#toggleHidden'); await h.settle(100, 2000); return [...h.$('#traits').querySelectorAll('li')].map((li) => li.textContent.trim()); };
    // A man on the rabbit path, one waypoint from done on every track of the way over, his bovine horns finished.
    const a = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    a.doc.settings.pace = 'unbounded'; a.doc.state.present = [];
    a.doc.state.tf = { influence: { cow: 70, rabbit: 100 }, rungs: {}, arcs: [], tracks: [], last: { cow: 0, rabbit: 0 }, drifted: {}, traits: [horns],
      paths: { cow: pathOf(null), rabbit: pathOf('female') },
      prog: { cow: { lean: 0, face: 15, tracks: heldParts(TR.species.cow, { horns_and_crest: { told: 'done' }, ears: { told: 'done' } }) }, rabbit: { lean: 0, face: 15, tracks: heldParts(TR.species.rabbit, { ears: { told: 'done' } }) } },
      sexprog: { species: 'rabbit', to: 'female', tracks: nearlyDone(TR.woman) } };
    const ha = await bootOn(a.store);
    try {
      patchTurns(ha, (r) => { r.time_advance_minutes = 240; r.exposures = []; });
      const tf = () => onlyAdv(ha.mock.store).data.state.tf;
      for (let n = 0; n < 14 && !tf().sex; n++) assert(await ha.turn('I get on with the day.'));
      assert(tf().sex && tf().sex.to === 'female', 'the engine carries the body over: ' + JSON.stringify(tf().sex));
      assert.equal(tf().prog.cow.tracks.horns_and_crest.told, 0, 'the horns went with the old body');
      assert(!tf().traits.some((x) => x.track === 'horns_and_crest'), 'and their finished trait with them');
      const note = (onlyAdv(ha.mock.store).data.pendingNotes || []).find((n) => /^The body has finished going over/.test(n)) || '';
      assert.match(note, /went with it: [^.]*Horns and crest \(bovine mythkin\)/, 'the narrator is told once that they went: ' + note.slice(0, 300));
      assert(await ha.turn('I look at myself in the mirror, naked.'));
      const p = promptOf(lastTurn(ha));
      assert.match(p, /Tom's body is a woman's now/, 'the prompt says the body is a woman\'s');
      assert.doesNotMatch(bodyLine(p, 'cow'), /Horns and crest/, 'the bovine body lines drop the horns: ' + bodyLine(p, 'cow'));
      assert.match(tfBlock(p), /Not on Tom's body[^\n]*horns and crest/, 'and say they are not on the body: ' + ((/Not on [^\n]*/.exec(tfBlock(p)) || [''])[0]));
      const items = await traitsShown(ha);
      assert(!items.some((x) => /Horns and crest/.test(x)), 'the State panel drops the horns: ' + JSON.stringify(items));
      clean(ha);
    } finally { ha.close(); }
    // A woman on the kitsune path going toward a man's, her udder half-grown on the bovine path; Daisy's contact goes on after.
    const b = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'female', name: 'Ana Reyes' });
    b.doc.settings.pace = 'unbounded'; b.doc.state.present = [];
    b.doc.state.tf = { influence: { cow: 100, fox: 100 }, rungs: {}, arcs: [], tracks: [], last: { cow: 0, fox: 0 }, drifted: {}, traits: [],
      paths: { cow: pathOf(null), fox: pathOf('male') },
      prog: { cow: { lean: 0, face: 15, tracks: heldParts(TR.species.cow, { teats_and_udder: { told: 2, open: true }, ears: { told: 'done' } }) }, fox: { lean: 0, face: 15, tracks: heldParts(TR.species.fox, { ears: { told: 'done' } }) } },
      sexprog: { species: 'fox', to: 'male', tracks: nearlyDone(TR.man) } };
    const hb = await bootOn(b.store);
    try {
      patchTurns(hb, (r) => { r.time_advance_minutes = 240; r.exposures = [{ species: 'cow', intensity: 2, method: 'an evening with Daisy' }]; });
      const tf = () => onlyAdv(hb.mock.store).data.state.tf;
      for (let n = 0; n < 14 && !tf().sex; n++) assert(await hb.turn('I spend the evening with Daisy.'));
      assert(tf().sex && tf().sex.to === 'male', 'the engine carries the body over: ' + JSON.stringify(tf().sex));
      for (let i = 0; i < 3; i++) assert(await hb.turn('I spend the evening with Daisy.'));
      assert(await hb.turn('I look at myself in the mirror, naked.'));
      const p = promptOf(lastTurn(hb)), u = tf().prog.cow.tracks.teats_and_udder;
      assert.match(p, /Ana's body is a man's now/, 'the prompt says the body is a man\'s');
      assert.doesNotMatch(bodyLine(p, 'cow'), /Teats and udder/, 'the half-grown udder is not on a man\'s body: ' + bodyLine(p, 'cow'));
      assert(u.told === 0 && u.p === 0, 'and does not grow again under contact: ' + JSON.stringify(u));
      assert.match(tfBlock(p), /Settled on the way over[^\n]*A man's chest, flat and broad/, 'a man\'s body settled on the way over has its chest said: ' + ((/Settled on the way over[^\n]*/.exec(tfBlock(p)) || [''])[0]).slice(0, 400));
      clean(hb);
    } finally { hb.close(); }
    // A save that went over before this, the horns still told: they are gone as soon as it is opened.
    const c = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    c.doc.state.tf = Object.assign({}, a.doc.state.tf, { sex: { to: 'female', species: 'rabbit', day: 1 }, sexprog: { species: 'rabbit', to: 'female', tracks: nearlyDone(TR.woman) } });
    for (const r of Object.values(c.doc.state.tf.sexprog.tracks)) r.told += 1;
    const hc = await boot({ setup(w, m) { m.store = c.store; w.localStorage.setItem('windlass.spoilers', '1'); } });
    try {
      assert(await hc.settle(150, 8000)); await hc.idle(10000); await hc.settle(100, 4000);
      const items = await traitsShown(hc);
      assert(items.some((x) => /a woman's now/.test(x)) && !items.some((x) => /Horns and crest/.test(x)), 'an older save that went over shows no horns: ' + JSON.stringify(items));
      clean(hc);
    } finally { hc.close(); }
  },
  // The way over's figure is drawn within the cups of the chest the path grows, as a born woman's is: a slight or heavy figure never
  // comes with a chest its cups rule out. Read from the narrator's settled line on a body gone over whose draws the page makes, and
  // from the draws made when the rabbit path is rolled, over several draws each.
  async wayOverFigureFitsTheChest() {
    const Wd = loadWorld(), TR = Wd.transformation.tracks, figs = Wd.genPools.looks.figures.female;
    const CUP = /\b(?:an?|neat|small|full|soft|generous|big) (AA|A|B|C|D|DD|E|F|G)\b|\b(AA|A|B|C|D|DD|E|F|G) cup\b/, cupOf = (b) => { const m = CUP.exec(String(b || '').split(';')[0]); return m ? m[1] || m[2] : ''; };
    const aCup = Wd.genPools.breasts.find((b) => cupOf(b) === 'A'); assert(aCup, 'the shared pool has an A-cup chest');
    const allows = (word, cup) => { const f = figs.find((x) => x.word === word); return !!f && (!f.cups || f.cups.includes(cup)); };
    const done = (M) => Object.fromEntries(M.map((t) => [t.key, { s: 5, e: 30, p: 100, told: t.stages.length, nextAt: 0 }]));
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    g.doc.state.tf = { influence: { rabbit: 100 }, rungs: {}, arcs: [], tracks: [], last: { rabbit: 0 }, drifted: {}, traits: [], sex: { to: 'female', species: 'rabbit', day: 1 },
      paths: { rabbit: Object.assign(emptyPath(), { sex: 'female', breasts: aCup }) }, prog: { rabbit: { lean: 0, face: 15, tracks: heldParts(TR.species.rabbit, { ears: { told: 'done' } }) } },
      sexprog: { species: 'rabbit', to: 'female', tracks: done(TR.woman) } };
    const words = [];
    for (let i = 0; i < 6; i++) {
      const h = await bootOn(copyStore(g.store));
      try {
        patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; });
        assert(await h.turn('I look at myself in the mirror.'));
        const line = (/Settled on the way over[^\n]*/.exec(blockOf(promptOf(lastTurn(h)), 'transformation')) || [''])[0], word = (/Drawn for this body: [^\n]*?figure (\w+)/.exec(line) || [])[1];
        assert(word && line.toLowerCase().includes(aCup.split(',')[0].toLowerCase()), 'the settled line gives the chest and the figure: ' + line.slice(line.indexOf('The breasts grown')));
        words.push(word); clean(h);
      } finally { h.close(); }
    }
    assert(words.every((w) => allows(w, 'A')), 'every figure drawn allows the path\'s A cup: ' + words.join(', '));
    // A man who meets a rabbit-kind: the rabbit path always carries him over, and the draws are made as it is rolled.
    const r0 = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' }), drawn = [];
    for (let i = 0; i < 6; i++) {
      const h = await bootOn(copyStore(r0.store));
      try {
        patchTurns(h, (r) => { r.time_advance_minutes = 60; r.exposures = [{ species: 'rabbit', method: 'a night with a rabbit-kind', intensity: 4 }]; });
        assert(await h.turn('I spend the night at the Burrow.'));
        const tf = onlyAdv(h.mock.store).data.state.tf, sx = tf.sexprog, breasts = tf.paths.rabbit && tf.paths.rabbit.breasts;
        assert(sx && sx.to === 'female' && sx.draws && sx.draws.figure && breasts, 'the way over and its chest are drawn: ' + JSON.stringify({ draws: sx && sx.draws, breasts }));
        drawn.push([(/^figure (\w+)/.exec(sx.draws.figure) || [])[1], cupOf(breasts)]); clean(h);
      } finally { h.close(); }
    }
    assert(drawn.every(([w, c]) => allows(w, c)), 'each figure drawn allows the chest drawn with it: ' + JSON.stringify(drawn));
    // A way over rolled before this whose figure rules out its chest, nothing of it told yet: its draws are made again from the chest.
    const clash = figs.find((f) => f.cups && !f.cups.includes('A')); assert(clash, 'some figure rules out an A cup');
    const o = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    o.doc.state.tf = { influence: { rabbit: 20 }, rungs: {}, arcs: [], tracks: [], last: { rabbit: 0 }, drifted: {}, traits: [],
      paths: { rabbit: Object.assign(emptyPath(), { sex: 'female', breasts: aCup }) }, prog: { rabbit: { lean: 0, face: 15, tracks: heldParts(TR.species.rabbit, {}) } },
      sexprog: { species: 'rabbit', to: 'female', tracks: heldParts(TR.woman, {}), draws: { face: 'face type heart-shaped', figure: 'figure ' + clash.word + ', with a soft waist', height: 'height about five foot' } } };
    const ho = await bootOn(o.store);
    try {
      patchTurns(ho, (r) => { r.time_advance_minutes = 30; r.exposures = []; });
      assert(await ho.turn('I sit at the desk.'));
      const sx = onlyAdv(ho.mock.store).data.state.tf.sexprog, w = (/^figure (\w+)/.exec(sx.draws.figure) || [])[1];
      assert(allows(w, 'A') && Object.values(sx.tracks).every((r) => !r.told), 'an untold way over is drawn again to fit its chest: ' + sx.draws.figure);
      clean(ho);
    } finally { ho.close(); }
  },

  // Rhythms at its third waypoint names a season only from a kind whose influence is into that season's window: a werewolf met
  // once and barely (influence under the window), met and gone (influence back to nothing), or several kinds each touched lightly,
  // leave the monthly cycle the body's; a werewolf path well under way still names its season.
  async rhythmsSeasonOnlyFromADrivenKind() {
    const TR = loadWorld().transformation.tracks, W4 = TR.woman, n4 = (key) => W4.find((t) => t.key === key).stages.length;
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    const light = ['fox', 'cat', 'harpy', 'rabbit', 'mer', 'dryad'];
    const cases = [['a werewolf barely met', { wolf: 6 }, false], ['a werewolf met and gone', { wolf: 0 }, false], ['six kinds touched lightly', Object.assign({ wolf: 6 }, Object.fromEntries(light.map((k) => [k, 3]))), false], ['a werewolf path under way', { wolf: 90 }, true]];
    for (const [what, inf, named] of cases) {
      const store = copyStore(g.store), doc = store.get(g.key).data, kinds = Object.keys(inf);
      doc.state.present = [];
      doc.state.tf = { influence: Object.assign({ cow: 80 }, inf), rungs: {}, arcs: [], tracks: [], last: Object.fromEntries(['cow'].concat(kinds).map((k) => [k, 0])), drifted: {}, traits: [],
        paths: Object.assign({ cow: Object.assign(emptyPath(), { sex: 'female' }) }, Object.fromEntries(kinds.map((k) => [k, emptyPath()]))),
        prog: Object.assign({ cow: { lean: 0, face: 15, tracks: heldParts(TR.species.cow, { ears: { told: 1 } }) } }, Object.fromEntries(kinds.map((k) => [k, { lean: 0, face: 15, tracks: heldParts(TR.species[k], {}) }]))),
        sexprog: { species: 'cow', to: 'female', tracks: heldParts(W4, { chest: { told: 4 }, rhythms: { told: 2, p: stageAt(3, n4('rhythms')), open: true } }) } };
      const h = await bootOn(store);
      try {
        patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; });
        assert(await h.turn('I sit at the desk.'), what);
        const note = (onlyAdv(h.mock.store).data.pendingNotes || []).find((n) => /Rhythms \(waypoint 3 of /.test(n)) || '';
        assert(note, what + ': Rhythms reaches its third waypoint');
        if (named) assert.match(note, /What starts here, as the kind gives it: [^.]*Season \(/, what + ': the season takes the cycle\'s place');
        else { assert.doesNotMatch(note, /What starts here/, what + ': no season is named: ' + ((/Rhythms \(waypoint 3[^]*?(?:What starts here[^.]*\.|cycle is the body's\.)/.exec(note) || [''])[0]).slice(-300)); assert.match(note, /No kind on this body has a season of its own, so the monthly cycle is the body's/, what + ': the cycle is the body\'s'); }
        clean(h);
      } finally { h.close(); }
    }
  },

  // The PR #52 review fixes. The world data keeps to each kind's body: the bovine coat runs from hooves, the kitsune's stance waits
  // for its toes, the cat's claws sheathe and it carries three more pairs, the harpy's light bones name breasts only once a body's chest is a woman's
  // and only a woman lays, the mer's gills sit either side of the ribs as the doc gives them, and no rung gives a whole animal. A three-waypoint track reaches its first waypoint (stage 1
  // of 3 is progress 34, not 33). A lore key ending in * matches its word's forms ("Moonrunners"); a person named in the action
  // brings their kind's contacts though they are elsewhere; the whole-animal rule is not sent; an older save's whole-animal trait
  // goes. Fails on e21a35c.
  async trackReviewFixes() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const T = ctx.window.WINDLASS_WORLDS.sundered.transformation, TR = T.tracks; assert(TR && TR.species, 'the world carries the track model');
    const byKey = (k, key) => TR.species[k].find((t) => t.key === key), txt = (t) => JSON.stringify(t);
    assert.doesNotMatch(txt(byKey('cow', 'leg_and_hip_coat')), /paw/i, 'the bovine coat names no paws');
    assert((byKey('fox', 'feet_and_stance').needs || []).some((n) => n.track === 'toes_and_claws' && Number(n.stage) === 2), 'the kitsune stance waits for the toes at stage 2');
    assert.match(byKey('cat', 'toes_and_claws').stages.at(-1), /sheathe/, 'the cat\'s claws sheathe');
    const pairs = byKey('cat', 'further_pairs'); assert.match(pairs.range.standard, /^Three more pairs/, 'the cat carries three more pairs at the standard'); assert.match(pairs.stages.at(-1), /three more pairs/, 'and its last waypoint says so');
    const bones = byKey('harpy', 'light_bones'); assert((bones.needs || []).some((n) => n.track === 'chest' && Number(n.stage) === 3 && Number(n.from) === 3), 'the harpy\'s light bones wait for a woman\'s chest before they name breasts');
    assert.doesNotMatch(bones.stages.slice(0, 2).join(' '), /breast(?!bone)/i, 'and name none before');
    assert.equal(byKey('harpy', 'laying').sex, 'women', 'only a woman\'s body lays');
    const gills = byKey('mer', 'gills'); assert.match(gills.endsAs, /either side of the ribs/, 'the mer gills sit either side of the ribs'); assert.doesNotMatch(txt(gills), /\bthroat\b/, 'not at the throat');
    for (const [k, sp] of Object.entries(T.species)) for (const r of sp.ladder) assert.doesNotMatch(String(r.trait), /whole \w+ at will|an? (?:wolf|fox|cat|rabbit) at will/, k + ' rung ' + r.at + ' gives no whole animal');
    const stageAt = (j, n) => Math.ceil(j * 100 / n - 1e-9), eyes = byKey('cow', 'eyes'); assert.equal(eyes.stages.length, 3, 'the bovine eyes are a three-waypoint track');
    // A cow path with only the eyes in reach; a rabbit trait from an older build's last rung.
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    let seeded; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data;
    const tracks = Object.fromEntries(TR.species.cow.map((t) => [t.key, t.key === 'eyes' ? { s: 10, e: 40, p: 0, told: 0, nextAt: 0 } : { s: 95, e: 100, p: 0, told: 0, nextAt: 0 }]));
    doc.state.tf = { influence: { cow: 60 }, traits: [], rungs: {}, arcs: [], tracks: [], paths: { cow: { sex: null, sexTold: [], formTold: [], day: 1, order: [], eye: 'eyes dark with a blue cast like a calf\'s' } }, prog: { cow: { lean: 0, face: 15, tracks } }, last: {}, drifted: {} };
    const other = (doc.cast.generated.characters || []).find((c) => c.species === 'dryad'); assert(other, 'the cast has a dryad');
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      patchTurns(h, (r) => { r.time_advance_minutes = 240; r.exposures = []; });
      const tf = () => onlyAdv(h.mock.store).data.state.tf, block = () => { const p = promptOf(lastTurn(h)); return p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>')); };
      assert(await h.turn('I study in my room.'));
      assert.doesNotMatch(block(), /- wolf \(/, 'no werewolf in the scene yet'); assert.doesNotMatch(block(), /- dryad \(/, 'nor a dryad');
      assert.doesNotMatch(block(), /Whole-animal shifts|whole animal in it/, 'the whole-animal rule is not sent: no one takes an animal\'s shape');
      assert(await h.turn('I ask Daisy whether the Moonrunners would let me run.')); assert.match(block(), /- wolf \(/, 'a lore key ending in * matches its plural (Moonrunner* in "Moonrunners")');
      assert(await h.turn('I wonder whether ' + other.first + ' is free this evening.')); assert.match(block(), /- dryad \(/, 'a person named, though elsewhere, brings their kind\'s contacts');
      assert(await h.turn('I keep studying.'));
      const r = tf().prog.cow.tracks.eyes; assert(r.p >= stageAt(1, 3) && r.told >= 1, 'a three-waypoint track reaches its first waypoint: ' + JSON.stringify(r));
      clean(h);
    } finally { h.close(); }
    // An older save (no track progress) whose rabbit trait is a whole rabbit at will: the migration drops it and keeps the rest.
    const old = new Map([...seeded].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])), od = old.get(advKey).data;
    od.state.tf = { influence: { rabbit: 100 }, traits: [{ species: 'rabbit', trait: 'the shift: a whole rabbit at will, and the warren-sense', day: 1 }, { species: 'rabbit', trait: 'greens before anything; a nose that will not stay still; a freeze at a sudden noise', day: 1 }], rungs: { rabbit: [30, 50, 70, 85, 100] }, arcs: [], tracks: [], paths: {}, last: {}, drifted: {} };
    const m = await boot({ setup(w, mk) { mk.store = old; } });
    try {
      assert(await m.settle(150, 8000)); await m.idle(10000); await m.settle(100, 4000);
      patchTurns(m, (r) => { r.exposures = []; });
      assert(await m.turn('I look in the mirror.'));
      const traits = onlyAdv(m.mock.store).data.state.tf.traits.map((t) => t.trait).join(' | ');
      assert.doesNotMatch(traits, /whole rabbit at will/, 'the migration drops the whole-animal trait: ' + traits);
      assert.match(traits, /greens before anything/, 'and keeps the rest');
      clean(m);
    } finally { m.close(); }
  },
  // Copilot's second review of the track work: seasons that leave the wanting to the player, a minor's kind in the scene, one
  // relationship cause moving a bond once, track stages drawn through the path, and a pending path shown beside told tracks.
  async secondTrackReview() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const T = ctx.window.WINDLASS_WORLDS.sundered.transformation, TR = T.tracks; assert(TR && TR.species && TR.bond, 'the world carries the track and bond models');
    for (const [k, list] of Object.entries(TR.species)) for (const t of list.filter((x) => x.sex === 'men'))
      assert.doesNotMatch(JSON.stringify(t), /drawn (?:hard|to any)|measure of him|grace or without|hard to stand anywhere else|too attentive|feels it pull|for the pleasure of it/, k + ' ' + t.key + ' leaves the wanting to the player');
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    let seeded; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data;
    const castKinds = new Set((doc.cast.generated.characters || []).map((c) => c.species).concat(['cow', 'human', 'wolf']));
    // The draw can leave every minor of a cast member's kind; one of them then takes a kind nobody in the cast has.
    const minors = doc.cast.generated.minors || [], spare = Object.keys(TR.species).find((k) => T.species[k] && !castKinds.has(k));
    let minor = minors.find((m) => T.species[m.species] && !castKinds.has(m.species));
    if (!minor && minors.length && spare) { minor = minors[0]; minor.species = spare; }
    assert(minor, 'a minor of a kind no cast member has');
    // A wolf path with the eyes told and a woman's body still to come; the minor present.
    const eyes = TR.species.wolf.find((t) => t.key === 'eyes');
    const tracks = Object.fromEntries(TR.species.wolf.map((t) => [t.key, t.key === 'eyes' ? { s: 10, e: 40, p: 100, told: eyes.stages.length, nextAt: 0 } : { s: 95, e: 100, p: 0, told: 0, nextAt: 0 }]));
    doc.state.tf = { influence: { wolf: 30 }, traits: [], rungs: {}, arcs: [], tracks: [], paths: { wolf: { sex: 'female', sexTold: [], formTold: [], day: 1, order: [], eye: 'amber' } }, prog: { wolf: { lean: 0, face: 15, tracks } }, last: {}, drifted: {} };
    doc.state.present = [minor.name, 'Daisy Holm'];   // the roommate in the scene too: a bond rises only for someone there
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      if (h.$('#tfPanel').hidden) h.click('#toggleHidden');
      const panel = h.$('#traits').textContent;
      assert.doesNotMatch(panel, /\{eye\}/, 'a told stage is drawn through the path, not left as a token: ' + panel.slice(0, 200));
      assert.match(panel, /amber/, 'the path\'s eye colour is shown');
      assert.match(panel, /also going toward a woman's body/, 'a pending path is listed beside the told tracks');
      const st = () => onlyAdv(h.mock.store).data.state, block = () => { const p = promptOf(lastTurn(h)); return p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>')); };
      const before = JSON.parse(JSON.stringify(st().bonds && st().bonds.roommate ? st().bonds.roommate : {}));
      patchTurns(h, (r) => { r.time_advance_minutes = 10; r.exposures = []; r.state_updates = (r.state_updates || []).filter((u) => !/^present$/.test(u.key)).concat([{ key: 'attitudes.roommate', op: 'inc', value: 1 }]); r.bond_shifts = [{ who: 'roommate', facet: 'liking', dir: 'up', why: 'a shared joke' }]; });
      assert(await h.turn('I sit quietly and listen.'));
      assert.match(block(), new RegExp('- ' + minor.species + ' \\('), 'a minor present brings their kind\'s contacts (' + minor.species + ')');
      assert.doesNotMatch(promptOf(lastTurn(h)), /attitude changes only with a cause/, 'with bonds on, attitudes move only through bond_shifts');
      const liking = TR.bond.find((t) => t.key === 'liking'), notch = Math.round(100 / (2 * liking.stages.length));
      const b0 = (before.liking && before.liking.p) || 0, b1 = st().bonds.roommate.liking.p;
      assert.equal(b1 - b0, Math.min(notch, 100 - b0), 'one cause moves liking one notch, not two: ' + b0 + ' -> ' + b1);
      clean(h);
    } finally { h.close(); }
  },
  // The looks show rather than explain. No pool line or ladder step lectures on a kind's biology or custom ("in the way of
  // bovine mythkin", "bovine women lactate, and these breasts do", "accommodated by the wrap"); a chest draw is shape first and names
  // nobody; a harpy's hair line is hair (her crest goes through it); and a bovine roommate's sheet still carries her udder, teats and
  // hooves, shown, with the horns (a bull's) named only as absent in the closing line, and no word on milk.
  async looksShowNotTell() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const Wd = ctx.window.WINDLASS_WORLDS.sundered;
    const LECTURE = /in the way of \w+ mythkin|as every \w+ woman|women lactate|lactate, and|accommodated by|is cut to (?:hold|support)|cut to support|does not think about it|mythkin do\b|the way \w+ mythkin do|as (?:all|every) \w+ do\b/i;
    const bad = [];
    for (const [k, sp] of Object.entries(Wd.genPools.species)) {
      const pools = { lead: [].concat(...Object.values(sp.leadByGender || {})), hair: sp.hair, body: sp.body || [], bodyByGender: [].concat(...Object.values(sp.bodyByGender || {})), breasts: sp.breasts || [], senses: sp.senses || [] };
      for (const [name, arr] of Object.entries(pools)) for (const t of arr) { if (LECTURE.test(t)) bad.push(k + '.' + name + ': ' + t.slice(0, 90)); if (name !== 'senses' && /\.$/.test(t)) bad.push(k + '.' + name + ' ends with a full stop: ' + t.slice(0, 60)); }
      if (k === 'harpy') for (const t of sp.hair) assert.match(t, /\bhair\b/, 'a harpy\'s hair line is hair: ' + t);
    }
    for (const t of Wd.genPools.breasts) { if (LECTURE.test(t)) bad.push('breasts: ' + t.slice(0, 90)); if (/\.$/.test(t)) bad.push('breasts ends with a full stop: ' + t.slice(0, 60)); }
    for (const [k, sp] of Object.entries(Wd.transformation.species)) for (const r of sp.ladder) for (const t of [r.trait, r.anatomy].concat(r.steps || [], r.sex || [], r.women || [])) if (t && LECTURE.test(t)) bad.push(k + ' rung ' + r.at + ': ' + t.slice(0, 90));
    // The narrator's own rules keep a bovine woman's milk a look, never a fact to state ("they lactate", "as ordinary as the Creamery").
    for (const t of Wd.rules) if (/\blactat|as ordinary on the Isle as/i.test(t)) bad.push('rule: ' + t.slice(0, 90));
    assert.deepEqual(bad, [], 'a look or a step explains instead of showing: ' + bad.join(' | '));
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female' });
    try {
      const rm = onlyAdv(h.mock.store).data.roommate; const looks = rm.looks || (rm.gen && rm.gen.looks) || '';
      assert.doesNotMatch(looks, LECTURE, 'the bovine roommate\'s sheet shows and does not explain: ' + looks);
      for (const re of [/udder/, /nipple|teat/, /\bhoo(?:f|ves)\b/]) assert.match(looks, re, 'and still carries her kind\'s anatomy ' + re + ': ' + looks);
      const body = looks.replace(/\. No [a-z][^.]*\.$/, '.');
      for (const re of [/horn/, /milk|lactat/]) assert.doesNotMatch(body, re, 'and nothing a bovine woman\'s look does not hold ' + re + ': ' + looks);
      assert.match(looks, /\. No horns\b[^.]*\.$/, 'and the closing line names the horns as absent: ' + looks);
      assert(await h.turn('I look at Daisy.'));
      assert.match(promptOf(lastTurn(h)), /shown in passing, as part of the person, never recited from the sheet as a list or explained as biology or custom/, 'the appearance rule reaches the narrator');
      clean(h);
    } finally { h.close(); }
  },

  // The State panel's Transformation row lists a change from its first told waypoint. The track model keeps no trait for a
  // part under way, so a body with fourteen parts changing read "No engine-confirmed body changes yet" next to a Condition line
  // full of them. The row is the engine's list, a turn ahead of what the story has shown, so it is a hidden item: it appears
  // with spoilers on, and with them off the State panel names no part (ui-panels.js stateRowFollowsToggle).
  async stateShowsChangesUnderWay() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const T = ctx.window.WINDLASS_WORLDS.sundered.transformation, TR = T.tracks.species;
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    let seeded; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const doc = seeded.get([...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k))).data;
    const row = (h) => { const dt = [...h.document.querySelectorAll('#items dt')].find((d) => d.textContent === 'Transformation'); return dt ? dt.nextElementSibling.textContent : ''; };
    const tracks = (told) => Object.fromEntries(TR.cow.map((t) => [t.key, { s: 50, e: 100, p: told[t.key] ? 30 : 0, told: told[t.key] || 0, nextAt: 0 }]));
    const hands = TR.cow.find((t) => t.key === 'hands'), ears = TR.cow.find((t) => t.key === 'ears');
    doc.state.tf = Object.assign(doc.state.tf || {}, { influence: { cow: 30 }, traits: [], rungs: {}, arcs: [], tracks: [], paths: { cow: { sex: null, sexTold: [], formTold: [], day: 1, order: [] } }, prog: { cow: { lean: 0, face: 15, tracks: tracks({ hands: 1, ears: 1 }) } }, last: {}, drifted: {} });
    const spoil = (w, m) => { m.store = seeded; w.localStorage.setItem('windlass.spoilers', '1'); };
    const h = await boot({ setup: spoil });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      assert.match(row(h), new RegExp('^' + T.species.cow.short + ': 2 parts under way \\((?:' + hands.name.toLowerCase() + ', ' + ears.name.toLowerCase() + '|' + ears.name.toLowerCase() + ', ' + hands.name.toLowerCase() + ')\\)$'), 'parts told once show as under way: ' + row(h));
      assert.doesNotMatch(row(h), /No engine-confirmed/, 'and the row no longer says none');
      clean(h);
    } finally { h.close(); }
    for (const k of Object.keys(doc.state.tf.prog.cow.tracks)) doc.state.tf.prog.cow.tracks[k].told = 0;
    const h2 = await boot({ setup: spoil });
    try {
      assert(await h2.settle(150, 8000)); await h2.idle(10000); await h2.settle(100, 4000);
      assert.equal(row(h2), 'none told yet', 'a body with nothing told still reads none: ' + row(h2));
      clean(h2);
    } finally { h2.close(); }
  },

  // Playtest findings: a present-tense dairy action ("I drink the cocoa") is a bovine contact like the past-tense one; the
  // length line of a rich scene ends one sentence before starting the next (no ".."); the short transformation block says
  // "none yet" instead of an empty list when no kind has influence, and no prompt line carries a doubled space.
  async promptPlaytest() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female' });
    try {
      assert(await h.turn('I drink the cocoa Daisy brings me from the Creamery stand.'));
      const { id } = onlyAdv(h.mock.store);
      let t = storedTurns(h.mock.store, id).at(-1);
      assert(t.notes.some((n) => /transformation contact confirmed from the explicit player action \(cow, intensity 1\)/.test(n)), 'drinking Creamery cocoa in the present tense is a bovine contact: ' + JSON.stringify(t.notes));
      assert.equal(t.stateAfter.tf.influence.cow, 4, 'and it counts');
      // "I have" is drinking only with a measure of it; owning or being allergic to milk is not a contact.
      assert(await h.turn('I have a milk allergy, I tell Daisy at the Creamery.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert(!t.notes.some((n) => /transformation contact confirmed from the explicit player action/.test(n)), 'a milk allergy is not drinking: ' + JSON.stringify(t.notes));
      assert.equal(t.stateAfter.tf.influence.cow, 4, 'and nothing was counted');
      assert(await h.turn('I have the milk in my bag for later.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(t.stateAfter.tf.influence.cow, 4, 'carrying milk is not drinking: ' + JSON.stringify(t.notes));
      assert(await h.turn('I have a cup of cocoa with Daisy at the Creamery.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert(t.notes.some((n) => /transformation contact confirmed from the explicit player action \(cow, intensity 1\)/.test(n)), 'having a cup of Creamery cocoa is drinking: ' + JSON.stringify(t.notes));
      assert.equal(t.stateAfter.tf.influence.cow, 8, 'and it counts once');
      // "I had" is the meal told after: bare or "some" dairy counts, and the milk still in the bag does not.
      assert(await h.turn('I had some milk at the Creamery, I tell Daisy.'));
      t = storedTurns(h.mock.store, id).at(-1);
      const contact = (notes) => notes.some((n) => /transformation contact confirmed from the explicit player action \(cow, intensity 1\)/.test(n));
      assert(contact(t.notes), 'having had some milk is drinking: ' + JSON.stringify(t.notes));
      assert(await h.turn('I had cheese with Daisy at the Creamery.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert(contact(t.notes), 'having had cheese is eating: ' + JSON.stringify(t.notes));
      assert(await h.turn('I had the milk in my bag the whole time.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert(!contact(t.notes), 'milk in the bag is not drinking: ' + JSON.stringify(t.notes));
      for (const carried of ['I had milk in my bag the whole time, I tell Daisy at the Creamery.', 'I had cheese in my bag for later when I left the Creamery.', 'I have a cup of cocoa in my bag from the Creamery stand.', 'I had some cream with me on the walk to the Creamery.']) {
        assert(await h.turn(carried));
        t = storedTurns(h.mock.store, id).at(-1);
        assert(!contact(t.notes), 'dairy carried is not dairy taken: ' + carried + ' ' + JSON.stringify(t.notes));
      }
      const p1 = promptOf(lastTurn(h));
      assert.doesNotMatch(p1, /[^\n ]  +\S/, 'no doubled space in the prompt: ' + (p1.match(/.{0,60}[^\n ]  +\S.{0,20}/) || [''])[0]);
      assert(await h.turn('I kiss Daisy.'));
      const p2 = promptOf(lastTurn(h));
      assert.match(p2, /Romance scene pacing/, 'a kiss is a romance scene');
      assert.doesNotMatch(p2, /\.\.(?!\.)/, 'no doubled full stop: ' + (p2.match(/.{0,80}\.\.(?!\.).{0,20}/) || [''])[0]);
      assert.doesNotMatch(p2, /[^\n ]  +\S/, 'no doubled space in a romance prompt');
      clean(h);
    } finally { h.close(); }
    // The short form of the transformation block with no influence anywhere says so in words, not with an empty list.
    const h2 = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female' });
    try {
      patchTurns(h2, (r) => { r.exposures = []; });
      // Some twenty thousand characters of action push the prompt, which starts well under the cap, into the short form.
      assert(await h2.turn('I walk the long way round. ' + 'The path winds past the Creamery and on along the old wall by the river, and I take it slowly. '.repeat(200)));
      const t = storedTurns(h2.mock.store, onlyAdv(h2.mock.store).id).at(-1);
      assert(t, 'the long turn was stored: ' + h2.$('#status').textContent);
      assert(t.notes.some((n) => /transformation block in its short form/.test(n)), 'the prompt was compacted: ' + JSON.stringify(t.notes.filter((n) => /size cap/.test(n))));
      assert.deepEqual(Object.values(t.stateAfter.tf.influence).filter(Boolean), [], 'no kind has influence');
      const line = (promptOf(lastTurn(h2)).match(/^Influence now [^\n]*/m) || [''])[0];
      assert.match(line, /\): none yet \(every kind 0\)\.$/, 'the short form says none yet (every kind 0): ' + line);
      clean(h2);
    } finally { h2.close(); }
  },

  // A woman's looks open with her height and build, part by part; the kind's anatomy follows as plain labelled fact.
  // The Cast note is a live region so a screen reader hears the unsaved-edits question.
  async looksLeadFirst() {
    const h = await begin({ rmSpecies: 'harpy', rmName: 'Wren Skye' });
    try {
      h.click('#btnCast'); await h.sleep(20);
      assert.equal(h.$('#cfName').value, 'Wren Skye');
      const looks = h.$('#cfLooks').value;
      assert.match(looks, /^About (?:four|five|six) foot[^.;]*; \w+, with [^.]*waist[^.]*hips[^.]*thighs\./, 'the looks open with an absolute height and a build told part by part: ' + looks.slice(0, 160));
      assert.doesNotMatch(looks, /\byou(?:r)?\b/i, 'and are never measured against the player: ' + looks);
      assert.match(looks, /\. (?:Arms as (?:great )?wings|For wings, feathered arms)[^.]+\. /, 'the body follows as short sentences of its own: ' + looks.slice(0, 400));
      assert.doesNotMatch(looks, /(?:^|\. )(?:Height|Build|Hair|Eyes|Plumage|Wings|Hands|Feet|Tail|Crest|Face|Frame|Bust): /, 'with no label: ' + looks);
      assert.match(looks, /\. No wings on the back apart from the arms, no beak\.$/, 'and close with what the body never has: ' + looks.slice(-120));
      assert.match(looks, /\b(A|B) cup\b|\bbreasts\b/, 'her chest is described, drawn from the harpy pool: ' + looks);
      assert.equal(h.$('#cfNote').getAttribute('role'), 'status'); assert.equal(h.$('#cfNote').getAttribute('aria-live'), 'polite');
      clean(h);
    } finally { h.close(); }
  },

  // The cast by distance from the scene. People present or named get the full sheet; people whose place now, or whose role's
  // places, are in the scene text (the location, the action, the clock's slot, the latest narration) get the brief and the aim;
  // everyone else gets a line of index (the role's tag, where they are now, the attitude in the head) with no aim and no
  // temperament, which come back the turn the action reaches their place. The race is said once, in the name. Minor figures are
  // listed when the scene could use them (their place, class or person is in the scene text) and left out otherwise. Two people of
  // one kind and sex in the scene share the kind's ways, said once. Fails on 10ae2ee.
  async castByDistance() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', gender: 'female', name: 'Ana Reyes' });
    let seeded; try { seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data;
    const gen = doc.cast.generated, byKey = (k) => gen.characters.find((c) => c.key === k), minor = (k) => gen.minors.find((m) => m.key === k);
    const physician = byKey('physician'), creamery = byKey('creamery'), ferry = minor('ferryman'), porter = minor('porter'), far = minor('far_human');
    assert(physician && creamery && ferry && porter && far, 'the generated cast has the people the check reads');
    assert.match(far.post || '', /^a fourth-year, born human, mostly \w+ now$/, 'the born-human fourth-year is generated with a post: ' + far.post);
    Object.assign(far, { name: 'Ottoline Brack', first: 'Ottoline', last: 'Brack' });
    // A drawn name can be a word of the opening ("Bell" by the bell tower, "Drew"), which would name the physician or the ferryman
    // into the scene; both get names no text uses.
    Object.assign(physician, { name: 'Dr Ione Vashti', first: 'Ione', last: 'Vashti', aliases: ['Ione', 'Vashti', 'Dr Vashti'] });
    Object.assign(ferry, { name: 'Ysolt Penhallow', first: 'Ysolt', last: 'Penhallow' });
    // The Creamery's bovine is a woman like Daisy, so the two share the kind's ways when both are in the room.
    Object.assign(creamery, { gender: 'female', pronouns: { they: 'she', them: 'her', their: 'her', theirs: 'hers' } });
    doc.state.present = ['Daisy Holm (roommate)'];
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      const block = () => { const p = promptOf(lastTurn(h)); return (/<characters[^>]*>([\s\S]*?)<\/characters>/.exec(p) || [])[1] || ''; };
      const line = (key) => block().split('\n').find((l) => l.includes('[' + key + ']')) || '';
      const minors = () => { const b = block(), i = b.indexOf('Minor figures'); return i < 0 ? '' : b.slice(i); };
      const listedMinors = () => minors().split(' Others, by name: ')[0];   // the ones with a line; the rest are a name and a post
      const re = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      patchTurns(h, (r) => { r.state_updates = []; r.time_advance_minutes = 5; });   // the room and its people stay as they are
      assert(await h.turn('I look around the room at Daisy.'));
      let daisy = line('roommate'), who = line('physician');
      assert.match(daisy, /^- Daisy Holm \(Bovine mythkin\) \[roommate\] \(Woman, she\/her; attitude \d+\/10\)\. Roommate in 4B\. Second-year, /, 'the roommate present: the race once, in the name; gender, pronouns and attitude in the head: ' + daisy.slice(0, 160));
      assert.match(daisy, /Looks: About .* Not on this body: .* Dress: .* Close up: .* Ways \(show, never explain\): .* Now: .* Aim now: .*\.$/, 'and the full sheet: ' + daisy.slice(-200));
      assert.doesNotMatch(block(), /\bfor to\b/, 'a hope that is an infinitive takes no "for"');
      assert.match(who, new RegExp('^- ' + re(physician.name) + ' \\(' + re(physician.race) + '\\) \\[physician\\] \\((?:Woman|Man|Non-binary), \\w+/\\w+; attitude \\d+/10\\)\\. Staff; runs the medical centre and the Restoration Spa\\. Now: the medical centre\\.$'), 'the physician, elsewhere, is a line of index: ' + who);
      assert.doesNotMatch(who, /Aim now|asks after a change once|Temperament/, 'with no aim; the role\'s detail and the temperament wait for the turn the story reaches her');
      assert.match(block(), /\n\nMinor figures, a mention or a line at most, never a speech: /, 'the minors\' line');
      assert(listedMinors().includes(porter.name + ' ('), 'the Kettle Hall porter is listed in Kettle Hall: ' + minors());
      assert(!listedMinors().includes(ferry.name + ' ('), 'the ferryman has no line: nothing in the scene reaches the ferry: ' + minors());
      // Out of the scene she is a name and her post; a word of her line in the scene text (the Aerie, Wednesdays) lists her as her race and her line instead. Either form keeps the change.
      assert(minors().includes('Ottoline Brack (' + far.post + ')') || /Ottoline Brack \(human, [^,]+, a fourth-year, mostly \w+ now/.test(minors()), 'out of the scene, the born-human fourth-year\'s post keeps the change: ' + minors());
      assert(await h.turn('I walk over to the medical centre.'));
      who = line('physician');
      assert.match(who, /\)\. Staff; runs the medical centre and the Restoration Spa; brisk, kind; asks after a change once, as a doctor would, and never about Spa use\. Temperament text for physician\. Now: the medical centre\. Aim now: restore anyone who asks and send them on their way\.$/, 'the action names her place: the brief and the aim come: ' + who);
      assert.doesNotMatch(who, /Looks:|Wants /, 'but not the full sheet');
      assert(await h.turn('I ask ' + physician.first + ' about the Spa.'));
      who = line('physician');
      assert.match(who, /Does not say: .* Knows [^.]*\. Speech: [^.]*\. Looks: About /, 'named by the action: the full sheet, with the way of speaking and looks: ' + who.slice(0, 300));
      assert.doesNotMatch(who, /nobody else outside class, club or dorm/, 'who they know is listed; the rule that nobody knows anyone outside class, club or dorm is in <rules>');
      assert(await h.turn('I take the cloud ferry down.'));
      assert(listedMinors().includes(ferry.name + ' ('), 'the ferryman is listed when the action reaches the ferry: ' + minors());
      patchTurns(h, (r) => { r.state_updates = [{ key: 'present', op: 'set', value: ['Daisy Holm (roommate)', creamery.name] }]; r.time_advance_minutes = 5; });
      assert(await h.turn('I sit down with Daisy and ' + creamery.first + '.'));
      daisy = line('roommate'); const cow = line('creamery');
      // The kind's ways go out one fragment a turn (the whole line every turn is what the narrator recites); the first fragment is this one.
      const frags = loadWorld().transformation.tracks.species.cow.filter((x) => x.endsAs && (!x.sex || x.sex === 'women')).map((x) => String(x.endsAs).replace(/\.$/, '').toLowerCase());
      const way = (/Ways \(show, never explain\): ([^.]*)\./.exec(daisy) || [])[1] || '';
      assert(way && frags.includes(way.toLowerCase()), 'the roommate carries one fragment of the kind\'s ways: ' + daisy);
      assert.match(cow, /Ways \(show, never explain\): those of Daisy above, the same kind\./, 'the second bovine woman in the room points to them: ' + cow.slice(-220));
      clean(h);
    } finally { h.close(); }
  },

  // The cast by distance keeps a person the player reaches for by role ("the doctor", "the Spa", "the captain of the running
  // club") at the brief and the aim, not the index, and still drops them back the turn after. A save from before the index
  // existed is sent the role's tag as the index, not the whole brief; a brief edited in the Cast editor is sent as written, with
  // its full stop before "Now:". Minor figures left out of the scene are still a name and a post, so a teacher the roommate
  // mentions has the name the story gives later. Fails on 10ae2ee and on the cast-by-distance commit before this.
  async castByRole() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', gender: 'female', name: 'Ana Reyes' });
    let seeded; try { seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data;
    const gen = doc.cast.generated, byKey = (k) => gen.characters.find((c) => c.key === k);
    const physician = byKey('physician'), captain = byKey('moonrunners'), ferry = gen.minors.find((m) => m.key === 'ferryman'), far = gen.minors.find((m) => m.key === 'far_human');
    assert(physician && captain && byKey('gardener') && ferry && far, 'the generated cast has the people the check reads');
    const farKind = (/mostly (\w+) now/.exec(far.text) || [])[1];
    assert(farKind, 'the born-human fourth-year\'s line names the kind: ' + far.text);
    Object.assign(far, { name: 'Ottoline Brack', first: 'Ottoline', last: 'Brack' });
    delete far.post;   // a save from before the post existed
    // Names no text uses, so a drawn name cannot reach the scene by itself.
    Object.assign(physician, { name: 'Dr Ione Vashti', first: 'Ione', last: 'Vashti', aliases: ['Ione', 'Vashti', 'Dr Vashti'] });
    Object.assign(captain, { name: 'Rhea Quillon', first: 'Rhea', last: 'Quillon', aliases: ['Rhea', 'Quillon'] });
    Object.assign(ferry, { name: 'Ysolt Penhallow', first: 'Ysolt', last: 'Penhallow' });
    for (const c of gen.characters) delete c.index;   // a save from before the index existed
    // The swimmer's sheet is edited and the brief left as generated: the brief is sent, not the generated index the edit may contradict.
    const swim = byKey('swim'); assert(swim, 'the generated cast has the swimmer');
    doc.cast.overrides = { gardener: { brief: 'Keeps the tree and pours the tea' }, swim: { brief: swim.brief, sheet: 'First-year now; rows for the lake crew.' } };
    doc.state.present = ['Daisy Holm (roommate)'];
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      const block = () => { const p = promptOf(lastTurn(h)); return (/<characters[^>]*>([\s\S]*?)<\/characters>/.exec(p) || [])[1] || ''; };
      const line = (key) => block().split('\n').find((l) => l.includes('[' + key + ']')) || '';
      patchTurns(h, (r) => { r.state_updates = []; r.time_advance_minutes = 5; });
      assert(await h.turn('I look around the room.'));
      let who = line('physician');
      assert.match(who, /\) \[physician\] \(.*\)\. Staff; runs the medical centre and the Restoration Spa\. Now: the medical centre\.$/, 'a save with no index sends the role\'s tag, not the brief: ' + who);
      assert.match(line('gardener'), /\) \[gardener\] \(.*\)\. Keeps the tree and pours the tea\. Now: /, 'an edited brief is sent as written, with a full stop before Now: ' + line('gardener'));
      assert.match(line('swim'), /\) \[swim\] \(.*\)\. Second-year, biology; swim team; never far from water\. Temperament text for swim\. Now: /, 'an edited sheet sends the brief, not the generated index: ' + line('swim'));
      assert.match(block(), /Others, by name: .*Ysolt Penhallow \(runs the cloud ferry\)/, 'a minor figure out of the scene is a name and a post: ' + block().slice(-400));
      assert.doesNotMatch(block(), /\{npc_/, 'no placeholder reaches the prompt');
      // Out of the scene she is a name and a post. A word of her line in the scene text (the Aerie, Wednesdays) lists her instead,
      // as her race and her line, and with her looks when she is named; each form carries the same fact.
      const post = 'Ottoline Brack \\((a fourth-year, born human, mostly ' + farKind + ' now\\)|human, [^,]+, a fourth-year, mostly ' + farKind + ' now)', looks = 'Ottoline Brack[^\\n]*born human and mostly ' + farKind + ' now';
      assert(new RegExp(post).test(block()) || new RegExp(looks).test(block()), 'an older save\'s born-human fourth-year keeps the change in the post: ' + block().slice(-400));
      for (const [action, key, brief] of [['I want to see the doctor.', 'physician', /Staff; runs the medical centre and the Restoration Spa; brisk, kind/], ['I go to the Spa.', 'physician', /Staff; runs the medical centre/], ['I find the captain of the running club.', 'moonrunners', /Third-year, .*captain of the Moonrunners/]]) {
        assert(await h.turn(action));
        who = line(key);
        assert.match(who, brief, action + ' reaches ' + key + ' by role: the brief: ' + who);
        assert.match(who, /Aim now: /, action + ': and the aim: ' + who);
        assert.doesNotMatch(who, /Looks:/, action + ': not the full sheet');
        assert(await h.turn('I look around the room.'));
        assert.doesNotMatch(line(key), /Aim now: /, 'back at the index the turn after: ' + line(key));
      }
      clean(h);
    } finally { h.close(); }
  },

  // A role is reached by the words people use for it, written in the world as the role's cues ("the nurse", "the infirmary"),
  // by the place the story sets ("the infirmary") and by a person present by role ("the Dean"); ordinary words that happened to be
  // in the role's tag ("about", "honey", "kinds") reach nobody. Fails on 18834a0.
  async castByCue() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', gender: 'female', name: 'Ana Reyes' });
    let seeded; try { seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data;
    const gen = doc.cast.generated, byKey = (k) => gen.characters.find((c) => c.key === k);
    const keys = ['physician', 'dean', 'gamer', 'warren', 'historian', 'library'];
    assert(keys.every(byKey), 'the generated cast has the people the check reads');
    // Names no text uses, so a drawn name cannot reach the scene by itself.
    const names = { physician: ['Dr', 'Ione', 'Vashti'], dean: ['Dean', 'Odile', 'Marchetti'], gamer: ['', 'Tamsin', 'Okonkwo'], warren: ['', 'Brisa', 'Lindqvist'], historian: ['Professor', 'Hollis', 'Pemberton'], library: ['', 'Wren', 'Abernathy'] };
    for (const k of keys) { const [t, f, l] = names[k]; Object.assign(byKey(k), { name: (t ? t + ' ' : '') + f + ' ' + l, first: f, last: l, aliases: [f, l].concat(t ? [t + ' ' + l] : []) }); }
    // Free hours from 15:35, so the turns end before dinner puts the dining hall (the gamer's table) in the scene.
    Object.assign(doc.state, { present: ['Daisy Holm (roommate)'], time: '15:35' });
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      const block = () => { const p = promptOf(lastTurn(h)); return (/<characters[^>]*>([\s\S]*?)<\/characters>/.exec(p) || [])[1] || ''; };
      const line = (key) => block().split('\n').find((l) => l.includes('[' + key + ']')) || '';
      const stay = (r) => { r.state_updates = []; r.time_advance_minutes = 5; };
      patchTurns(h, stay);
      assert(await h.turn('I look around the room.'));
      for (const k of keys) assert.doesNotMatch(line(k), /Aim now: /, 'at the start ' + k + ' is a line of index: ' + line(k));
      // Ordinary words that were in the tags reach nobody.
      for (const [action, quiet] of [['I ask Daisy about her day.', ['gamer']], ['I call Daisy honey and kiss her.', ['warren']], ['I ask Daisy what kinds of mythkin live here.', ['dean', 'historian']], ['I tell Daisy what she wants to hear.', ['gamer']]]) {
        assert(await h.turn(action));
        for (const k of quiet) assert.doesNotMatch(line(k), /Aim now: /, action + ' must leave ' + k + ' at the index: ' + line(k));
      }
      // The words people use for a role reach that person: the brief and the aim.
      for (const [action, key] of [['I go to the infirmary to get my hands looked at.', 'physician'], ['I go see the nurse.', 'physician'], ['I ask the librarian for a book on wings.', 'library'], ['I ask Daisy what the history lecture covers.', 'historian']]) {
        assert(await h.turn(action));
        assert.match(line(key), /Aim now: /, action + ' reaches ' + key + ' by role: ' + line(key));
        assert.doesNotMatch(line(key), /Looks:/, action + ': not the full sheet');
        assert(await h.turn('I look around the room.'));
        assert.doesNotMatch(line(key), /Aim now: /, 'back at the index the turn after: ' + line(key));
      }
      // The place the story sets reaches the person whose role it names.
      patchTurns(h, (r) => { r.state_updates = [{ key: 'location', op: 'set', value: 'the infirmary' }]; r.time_advance_minutes = 5; });
      assert(await h.turn('I follow Daisy.'));
      patchTurns(h, stay);
      assert(await h.turn('I sit on the bed.'));
      assert.match(line('physician'), /brisk, kind; asks after a change once.* Aim now: /, 'the infirmary, set as the place, reaches the physician: ' + line('physician'));
      // A person present by role is near: the brief and the aim, with what she never says in public.
      patchTurns(h, (r) => { r.state_updates = [{ key: 'location', op: 'set', value: 'the quad' }, { key: 'present', op: 'set', value: ['Daisy Holm (roommate)', 'the Dean'] }]; r.time_advance_minutes = 5; });
      assert(await h.turn('I walk out onto the quad.'));
      patchTurns(h, stay);
      assert(await h.turn('I listen to what she says.'));
      assert.match(line('dean'), /never names transformation or the Spa in public.* Aim now: /, 'the Dean, present by role, gets the brief and the aim: ' + line('dean'));
      clean(h);
    } finally { h.close(); }
  },

  // Romance is detected by what the player asks for, not by stray words. Consent and anatomy guidance stay in the romance prompt.
  async romanceDetection() {
    // A human roommate: with a mythkin one, "I make love with Rin" is a contact with her kind (intensity 4) and starts a change,
    // whose scene would widen the band and add the Body detail line on its own. This scenario is about the wording alone.
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      await setWriter(h, 'auto');
      const W = h.window.WINDLASS_WORLDS[onlyAdv(h.mock.store).data.worldId];
      const rich = W.wordBands.rich;
      for (const a of ['I make love with Rin.', 'I take Rin to bed.', 'I go to bed with Rin.', 'I take Rin Kitsuragi to bed.', 'i take rin to bed', 'I undress rin slowly.', 'I take her gently up to bed.', 'I go to bed with Rin tonight.',
        'I undress Rin very slowly.', 'I undress her very slowly.', 'I undress Rin languidly.', 'I undress her piece by piece.', 'I take her all the way up to bed.',
        'I take Rin by the hand to bed.', 'I take her home and to bed.', 'I take Rin and Ana up to bed.', 'I take Rin, slowly, to bed.',
        'I take Rin by the hand, gently, to bed.', 'I take her back to my room and to bed.', 'I take her - slowly - to bed.', 'I take her, then Ana, to bed.', 'I take her upstairs with me to bed.']) {
        assert(await h.turn(a), a + ' did not finish');
        const c = lastTurn(h), p = promptOf(c);
        assert.equal(c.opts.modelTier, 'complex', a + ' is romance: the complex tier on auto');
        assert.match(p, /Romance scene pacing \(binding\)/, a + ' gets the romance pacing');
        assert.match(p, /Body detail \(binding\)/, a + ' gets the Body detail line');
        assert.match(p, new RegExp('Narrative length: ' + rich[0] + ' to ' + rich[1] + ' words, and up to ' + W.wordRoom.rich + ' words when the scene needs it'), a + ' uses the rich band and its room');
        assert.match(p, /Do not presume consent or decide the player's desire, feelings or next action/, 'consent and agency stay');
        assert.match(p, /Use only anatomy and functions established in the world data; do not invent them/, 'established anatomy only');
        assert.doesNotMatch(p, /fade to black|sex is not depicted|sex remains off-page/i, 'no off-page rule');
      }
      for (const a of ['I confess to the porter that I lost my key.', 'I check the date on the timetable.', 'I look at the sextant.', 'I take a book to bed.', 'I take tea to bed.', 'I go to bed with a book.', 'I undress in my room.',
        'I take her book to bed.', "I take Rin's notebook to bed.", 'I go to bed with her book.', "I go to bed with Rin's letters.", 'I take her dolly to bed.', 'I take her butterfly to bed.', 'I take her jelly to bed.',
        'I take her downstairs and go to bed.', 'I take Rin home, then go to bed.', 'I take Rin downstairs and I go to bed.', 'I take her up; I go to bed.',
        'I take her home and then I go to bed.', 'I take her to the door and go to bed.', 'I take her home and in the morning go to bed.', 'I take her home and by morning go to bed.', 'I take her back and after that we go to bed.', 'I take Rin home so I can go to bed.', 'I take her home, and go to bed.']) {
        assert(await h.turn(a), a + ' did not finish');
        const c = lastTurn(h), p = promptOf(c);
        assert.doesNotMatch(p, /Body detail \(binding\)/, a + ' is not romance');
        assert.doesNotMatch(p, /Romance scene pacing/, a + ' is not romance');
        assert.equal(c.opts.modelTier, 'default', a + ' runs on the default tier on auto');
      }
      assert(await h.turn('I go to bed.'));
      const c = lastTurn(h), p = promptOf(c);
      assert.doesNotMatch(p, /Romance scene pacing|Body detail \(binding\)/, '"I go to bed." is not romance');
      const band = lengthTop(p);
      assert(band < W.wordBands.standard[1], '"I go to bed." stays a short transition: ' + band);
      clean(h);
    } finally { h.close(); }
  },

  // A change merely pending (a track whose next step is not due, no arc opening) does not make a quiet turn top-tier.
  async pendingChangeQuietTurn() {
    const h0 = await begin({ rmSpecies: 'fox', rmName: 'Rin Kitsuragi' });
    const store = h0.mock.store; let id;
    try { await setWriter(h0, 'auto'); assert(await h0.turn('I sit at the desk.')); id = onlyAdv(store).id; } finally { h0.close(); }
    const doc = store.get('adventures/' + id).data;
    doc.state.tf = doc.state.tf || {};
    Object.assign(doc.state.tf, {
      arcs: [],
      tracks: [{ species: 'fox', rung: 1, kind: 'body', trait: 'ears that turn toward a sound', steps: ['a warmth at the tops of the ears', 'the ears sit a little higher'], anatomy: '', habits: [], noticed: '', i: 0, nextAt: 1e9 }],
    });
    doc.pendingNotes = [];
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 6000));
      assert(await h.turn('I read my notes at the desk.'));
      const c = lastTurn(h), p = promptOf(c);
      assert.doesNotMatch(p, /Note from the engine: The change/, 'no change note is due this turn');
      assert.equal(c.opts.modelTier, 'default', 'a quiet turn with a change only pending runs on the default tier');
      assert.doesNotMatch(p, /Body detail \(binding\)/, 'and is not treated as a change scene');
      clean(h);
    } finally { h.close(); }
  },

  // A waypoint of the way over is a change on the page as much as a kind's part: the turn that tells it takes the rich band and the
  // body-detail line, runs on the complex tier under auto, and a spoken line with someone here is not cut down to a talk turn.
  async sexTrackNoteIsAChangeScene() {
    const Wd = loadWorld(), TR = Wd.transformation.tracks, W4 = TR.woman, n4 = (key) => W4.find((t) => t.key === key).stages.length, rich = Wd.wordBands.rich[1];
    const g0 = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    g0.doc.state.tf = Object.assign(baseTf('cow', 60, { lean: 0, face: 15, tracks: heldParts(TR.species.cow, { ears: { told: 1 } }) }),
      { sexprog: { species: 'cow', to: 'female', tracks: heldParts(W4, { chest: { told: 1, p: stageAt(2, n4('chest')), open: true } }) } });
    g0.doc.state.tf.paths.cow.sex = 'female'; g0.doc.state.present = ['Daisy Holm (roommate)'];
    // The first turn tells Chest's second waypoint, the engine's own note; each case then takes the next turn with it pending.
    let told;
    const h = await bootOn(g0.store);
    try {
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; });
      assert(await h.turn('I look around the room.'));
      const pend = onlyAdv(h.mock.store).data.pendingNotes || [];
      assert(pend.some((n) => /^Alongside the .+ change, the body is going toward a woman's .*Chest \(waypoint 2 of /.test(n)), 'the first turn tells Chest\'s second waypoint: ' + JSON.stringify(pend).slice(0, 300));
      told = copyStore(h.mock.store); clean(h);
    } finally { h.close(); }
    for (const [action, settings, what] of [['I look around the room.', { narrTier: 'auto' }, 'an ordinary act'], ['I sit at the desk.', {}, 'a short transition'], ['"Good morning, Daisy," I say.', {}, 'a spoken line with Daisy here']]) {
      const store = copyStore(told); Object.assign(store.get(g0.key).data.settings, settings);
      const g = await bootOn(store);
      try {
        patchTurns(g, (r) => { r.time_advance_minutes = 30; r.exposures = []; });
        assert(await g.turn(action), what);
        const c = lastTurn(g), act = blockOf(promptOf(c), 'action');
        assert.match(act, /Note from the engine: Alongside the [^\n]*Chest \(waypoint 2 of /, what + ': the way over\'s note is in the action');
        assert.match(act, /Body detail \(binding\)/, what + ': the way over gets the body-detail line');
        assert.equal(lengthTop(act), rich, what + ': the way over takes the rich band: ' + ((/Narrative length:[^\n]*/.exec(act) || [])[0] || ''));
        assert.doesNotMatch(act, /Talk note \(binding\)/, what + ': the change has the room, not a talk turn');
        if (settings.narrTier) assert.equal(c.opts.modelTier, 'complex', what + ': the complex tier on auto');
        clean(g);
      } finally { g.close(); }
    }
  },

  // Stop pressed while the finished reply is being fitted to length keeps the turn as written.
  async stopDuringLengthFit() {
    const h = await begin();
    try {
      await h.settle(150, 6000);
      const { id } = onlyAdv(h.mock.store); const n0 = onlyAdv(h.mock.store).data.turnCount;
      let fitStarted = false;
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'length fit') { fitStarted = true; return new Promise((r) => setTimeout(() => r(Array(400).fill('word').join(' ')), 800)); }
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        const r = JSON.parse(h.mock.defaultHandler(input, o, call)); r.narrative = Array(700).fill('story').join(' '); return JSON.stringify(r);
      };
      h.$('#action').value = 'I look around the room.'; h.click('#send');
      const t0 = Date.now(); while (!fitStarted && Date.now() - t0 < 8000) await h.sleep(10);
      assert(fitStarted, 'the length fit must start (autoFit on, overlong reply)');
      await h.sleep(50); h.click('#stop'); assert(await h.idle(10000)); await h.settle(100, 4000);
      const after = onlyAdv(h.mock.store).data;
      assert.equal(after.turnCount, n0 + 1, 'the finished turn is kept and saved');
      const t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(t.action, 'I look around the room.');
      assert.match(JSON.stringify(t), /story story story/, 'the narrative is saved as written');
      assert.match(JSON.stringify(t.notes || t), /skipped/, 'a note says the fit was skipped');
      assert.match(statusText(h), /^Stopped during the length fit; the finished scene is kept as written\./, 'the status says what was stopped: ' + statusText(h));
      clean(h);
    } finally { h.close(); }
  },

  // Stop pressed while the memory fold runs keeps the finished turn, saved, with its memory unfolded and a note.
  async stopDuringMemoryFold() {
    const h = await begin();
    try {
      await h.settle(150, 6000);
      const { id } = onlyAdv(h.mock.store);
      let foldStarted = false, k = 0;
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'memory fold') { foldStarted = true; return new Promise((r) => setTimeout(() => r(JSON.stringify({ summary: 'folded' })), 800)); }
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        const r = JSON.parse(h.mock.defaultHandler(input, o, call));
        r.beats = Array.from({ length: 6 }, () => 'beat ' + (++k) + ' of the evening'); return JSON.stringify(r);
      };
      let turns = 0, n0 = 0;
      while (!foldStarted && turns < 12) {
        n0 = onlyAdv(h.mock.store).data.turnCount;
        h.$('#action').value = 'I look around the room ' + turns + '.'; h.click('#send'); turns++;
        // Poll rather than wait for idle: the fold must still be pending when Stop is pressed.
        const t0 = Date.now(); while (!foldStarted && Date.now() - t0 < 15000 && !(Date.now() - t0 > 300 && h.$('#stop').hidden)) await h.sleep(5);
        if (!foldStarted) await h.settle(50, 3000);
      }
      assert(foldStarted, 'a memory fold must start once enough beats build up');
      h.click('#stop'); assert(await h.idle(10000)); await h.settle(100, 4000);
      const after = onlyAdv(h.mock.store).data;
      assert.equal(after.turnCount, n0 + 1, 'the finished turn is kept and saved (' + n0 + ' → ' + after.turnCount + '; status: ' + h.$('#status').textContent + ')');
      assert.notEqual(after.memory.summary, 'folded', 'the stopped fold changed nothing');
      assert(after.memory.beats.length > 36, 'the beats stay unfolded for the next turn to fold');
      const t = storedTurns(h.mock.store, id).at(-1);
      assert.match(JSON.stringify(t.notes || t), /summary fold skipped/, 'a note says the fold was skipped: ' + JSON.stringify(t.notes));
      assert.match(statusText(h), /^Stopped during the summary fold; it runs again next turn\./, 'the status says what was stopped: ' + statusText(h));
      clean(h);
    } finally { h.close(); }
  },

  // A tap on Take turn or Undo that arrives while the background sync (focus, back to the tab) is still reading the store waits
  // for it and goes ahead; it used to be told to stop, with no message and the action left in the box. Fails on 10ae2ee.
  async syncDuringTurn() {
    const h = await begin();
    try {
      await h.settle(150, 6000);
      const n0 = onlyAdv(h.mock.store).data.turnCount;
      h.mock.dbLatency = 300;
      h.window.dispatchEvent(new h.window.Event('focus')); await h.sleep(20);
      h.$('#action').value = 'I look around the room.'; h.click('#send');
      assert(await h.idle(20000), 'the turn did not finish');
      assert.equal(turnCalls(h).length, 1, 'one tap on Take turn during a sync must give one turn (status: ' + statusText(h) + ')');
      assert.equal(h.$('#action').value, '', 'the action box is cleared once the turn is taken');
      assert.equal(onlyAdv(h.mock.store).data.turnCount, n0 + 1, 'the turn is saved');
      h.window.dispatchEvent(new h.window.Event('focus')); await h.sleep(20);
      h.click('#undo'); assert(await h.idle(20000), 'the undo did not finish'); await h.settle(100, 4000);
      assert.equal(onlyAdv(h.mock.store).data.turnCount, n0, 'one tap on Undo during a sync undoes the turn (status: ' + statusText(h) + ')');
      clean(h);
    } finally { h.close(); }
  },

  // A quote the narrator forgot to escape inside the narrative: the repair no longer reads it as the end of the string, so the
  // turn is neither lost to a second call nor committed cut short (the narrative ending at the quote, its fields under a key of
  // stray punctuation). Fails on 10ae2ee.
  async quoteInNarrative() {
    const src = fs.readFileSync(HTML, 'utf8');
    const a = src.indexOf('  function repairJson'), b = src.indexOf('  // A reply that could not be used is kept for diagnosis');
    assert(a > 0 && b > a, 'the JSON repair functions were not found in the page');
    const TURN_KEYS = new Function('return ' + /const TURN_KEYS = (\[[^\]]*\]);/.exec(src)[1])();
    const tolerantJson = new Function('TURN_KEYS', src.slice(a, b) + '\nreturn tolerantJson;')(TURN_KEYS);
    const mk = (narr) => '{"evaluation":{"stat":"none","outcome":"none"},"narrative":' + narr + ',"suggested_actions":["a","b","c"],"secret_info":"x","state_updates":[],"time_advance_minutes":10,"events":["Day 1 18:00 e"],"beats":["b"],"facts":[],"exposures":[]}';
    const cases = [
      ['plain dialogue', mk('"She says "Come here," then waits."'), 'She says "Come here," then waits.'],
      ['quoted words in a row', mk('"He answers "yes", "no", and "maybe" in turn."'), 'He answers "yes", "no", and "maybe" in turn.'],
      ['quote then colon', mk('"The sign reads "Kettle Hall": a plain brass plate."'), 'The sign reads "Kettle Hall": a plain brass plate.'],
      ['quote then bracket', mk('"You see ["a"] list."'), 'You see ["a"] list.'],
      ['quote, comma, digit', mk('"She counts "one", 2 times."'), 'She counts "one", 2 times.'],
      ['quote, comma, minus', mk('"She says "no", -1 for you."'), 'She says "no", -1 for you.'],
      ['quote then brace', mk('"Her sign says "}" which you read."'), 'Her sign says "}" which you read.'],
      ['quote at the end then comma', mk('"You whisper "stay","'), 'You whisper "stay",'],
      ['prose with a brace before the object', 'Sure {as asked}: ' + mk('"ok"'), 'ok'],
      ['fence', '```json\n' + mk('"ok"') + '\n```', 'ok'],
      ['cut off mid narrative', '{"evaluation":{},"narrative":"The room is quiet and you', 'The room is quiet and you'],
      ['unicode escapes', mk('"He answers "yes", and \\u201cmaybe\\u201d \\u2014 it\\u2019s late."'), 'He answers "yes", and \u201cmaybe\u201d \u2014 it\u2019s late.'],
      // Quoted words in a row send it past the repair to the rescue, which decodes \uXXXX and reads "\\n" as a backslash and an n.
      ['unicode escapes in the rescue', mk('"He answers "yes", "no" \\u2014 it\\u2019s on the sign, C:\\\\new."'), 'He answers "yes", "no" \u2014 it\u2019s on the sign, C:\\new.'],
    ];
    const bad = [];
    for (const [name, text, want] of cases) {
      let d = null; try { d = tolerantJson(text); } catch (e) { d = null; }
      if (!(d && d.narrative === want)) bad.push(name + ' -> ' + JSON.stringify(d && d.narrative));
      else if (name !== 'cut off mid narrative' && name !== 'fence' && Object.keys(d).some((k) => !/^[a-z_]+$/.test(k))) bad.push(name + ': a field was stored under a key of stray punctuation');
    }
    assert.deepEqual(bad, [], 'the repair got these wrong: ' + bad.join(' | '));
    // Through the page: the turn is committed whole, from one call.
    const h = await begin();
    try {
      await h.settle(150, 6000);
      const { id } = onlyAdv(h.mock.store);
      for (const [text, want] of [[cases[6][1], cases[6][2]], [cases[1][1], cases[1][2]]]) {
        const before = turnCalls(h).length;
        h.mock.sampleHandler = (input, o, call) => (/^turn/.test(call.label) ? text : h.mock.defaultHandler(input, o, call));
        assert(await h.turn('I look around the room.'), 'the turn did not finish');
        assert.equal(turnCalls(h).length - before, 1, 'one call, no second ask (status: ' + statusText(h) + ')');
        assert.equal(storedTurns(h.mock.store, id).at(-1).narrative, want, 'the narrative is committed whole');
      }
      clean(h);
    } finally { h.close(); }
  },

  // The roommate introduction is asked for a first meeting's band, the rich one whatever the density chosen at creation, with its
  // room outright (the opening is one of the room's cases) and room for the body material it must render whole (Looks, Close up,
  // Ways and Dress), in as many paragraphs as it needs; Debug says what was asked and notes an introduction that came in under it.
  async roommateIntroAskFollowsTheBody() {
    const bodyWords = (p) => { const rm = blockOf(p, 'roommate'); return ['Looks', 'Close up', 'Ways of the kind, shown and never explained', 'Dress'].reduce((n, k) => n + ((new RegExp(k + ': ([\\s\\S]*?)(?= (?:Not on this body|Dress|Close up|Ways of the kind|Greeting custom|Wants from a roommate|Manner in this first meeting|Knows the mixer|Must not mention):|$)')).exec(rm) || [, ''])[1].split(/\s+/).filter(Boolean).length, 0); };
    const askOf = (h) => { const c = h.mock.sampleCalls.find((x) => x.label === 'roommate introduction'); assert(c, 'the roommate introduction was asked for'); const p = promptOf(c), m = /(\d+) to (\d+) words/.exec(blockOf(p, 'task')); assert(m, 'the task names a range: ' + blockOf(p, 'task').slice(0, 200)); return { p, lo: +m[1], hi: +m[2] }; };
    for (const density of ['rich', 'terse']) {
      const h = await boot({});
      try {
        assert(await h.settle(150, 6000), 'boot did not settle');
        h.type('#cRmSpecies', 'wolf'); h.type('#cRmName', 'Daisy Holm'); h.$('#cRmGender').value = 'female'; h.$('#cRmGender').dispatchEvent(new h.window.Event('change'));
        h.$('#cDensity').value = density; h.$('#cDensity').dispatchEvent(new h.window.Event('change'));
        h.click('#cBegin'); assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
        const W = h.window.WINDLASS_WORLDS[onlyAdv(h.mock.store).data.worldId], rich = W.wordBands.rich;
        assert.equal(onlyAdv(h.mock.store).data.settings.density, density, 'the density chosen at creation is saved');
        const { p, lo, hi } = askOf(h), body = bodyWords(p);
        assert(lo >= rich[0], density + ': the introduction is a first meeting, so its floor is the rich band\'s (' + lo + ' against ' + rich[0] + ')');
        assert(hi >= rich[1], density + ': and its ceiling at least the rich band\'s (' + hi + ' against ' + rich[1] + ')');
        assert(W.wordRoom && hi >= W.wordRoom.rich, density + ': the opening has the rich room outright (' + hi + ' against ' + JSON.stringify(W.wordRoom) + ')');
        assert(body > 150 && hi >= body + 150, density + ': the ceiling leaves room beyond the body material it must render (' + hi + ' for ' + body + ' words of body)');
        assert.match(blockOf(p, 'task'), /in several paragraphs/, 'the paragraph count is open');
        h.click('#btnDebug');
        assert.match(h.$('#dbgMeta').textContent, new RegExp('roommate introduction · \\d+ words \\(asked ' + lo + '–' + hi + '\\)'), 'Debug says what was asked: ' + h.$('#dbgMeta').textContent);
        assert.match(h.$('#dbgNotes').textContent, /roommate introduction \d+ words, under the asked/, 'the mock\'s short introduction is noted: ' + h.$('#dbgNotes').textContent.slice(0, 300));
        h.click('[data-close="dlgDebug"]');
        clean(h);
      } finally { h.close(); }
    }
  },

  // The first turn after creation keeps the setting's band: the opening's own suggestions are talk ("Say yes...", "Ask ...") or a
  // move that asks something ("Unpack first and ask ..."), and none is stepped down to the talk band or cut as a transition. From the
  // second turn a short talk steps down as before, and a plain move ("I go to bed.") is still a transition.
  async firstTurnKeepsItsBand() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
    try {
      const W = h.window.WINDLASS_WORLDS[onlyAdv(h.mock.store).data.worldId], wb = W.wordBands;
      const chips = [...h.document.querySelectorAll('#suggestions button')].map((b) => b.textContent.trim());
      assert.equal(chips.length, 3, 'the opening offers three suggestions: ' + JSON.stringify(chips));
      assert.match(chips[0], /^Say yes/); assert.match(chips[1], /^Ask Daisy/); assert.match(chips[2], /^Unpack first and ask/);
      const top = lengthTop;
      assert(await h.turn(chips[0]), 'the first suggestion did not finish');
      let p = promptOf(lastTurn(h));
      assert.match(p, /Talk note \(binding\)/, 'the first suggestion is a talk turn');
      assert.equal(top(p), wb.standard[1], 'and on the first turn it keeps the standard band: ' + top(p));
      assert(await h.turn(chips[1]), 'the second suggestion did not finish');
      p = promptOf(lastTurn(h));
      assert.match(p, /Talk note \(binding\)/);
      assert.equal(top(p), wb.terse[1], 'from the second turn a short talk steps down a band as before: ' + top(p));
      assert(await h.turn(chips[2]), 'the third suggestion did not finish');
      p = promptOf(lastTurn(h));
      assert.equal(top(p), wb.standard[1], 'a move that also asks someone something is no transition: ' + top(p));
      assert.match(p, new RegExp('Narrative length: ' + wb.standard[0] + ' to ' + wb.standard[1] + ' words, and up to ' + W.wordRoom.standard + ' words when the scene needs it'));
      assert(await h.turn('I go to bed.'));
      p = promptOf(lastTurn(h));
      assert(top(p) < wb.standard[1], 'a plain move is still a transition: ' + top(p));
      clean(h);
    } finally { h.close(); }
  },

  // A first meeting typed as a move ("I go over and introduce myself to Rook") and a move to a place the world names ("I head down
  // to the mixer on the quad") are not cut to the transition band under a fixed density; the first meeting takes the rich band as it
  // does on auto, so a full first-sight reply is not trimmed by the fit. Walking up to someone and greeting them is no transition
  // either. A plain move still is.
  async firstMeetingKeepsItsBand() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
    try {
      const { data } = onlyAdv(h.mock.store), W = h.window.WINDLASS_WORLDS[data.worldId], wb = W.wordBands;
      assert.equal(data.settings.density, 'standard', 'the default density is the fixed standard setting');
      const present = new Set((data.state.present || []).map((x) => String(x).replace(/\s*\([^)]*\)\s*$/, '').toLowerCase()));
      const met = data.state.met || [];
      const minor = (data.cast.generated.minors || []).find((m) => m.first && m.first.length >= 3 && m.species && m.species !== 'human' && !met.includes(m.species) && !present.has(String(m.name).toLowerCase()) && !present.has(m.first.toLowerCase()));
      assert(minor, 'the test needs a generated minor figure of a kind not yet met');
      const top = lengthTop;
      const fits = () => h.mock.sampleCalls.filter((c) => c.label === 'length fit').length;
      patchTurns(h, (r) => { r.narrative = Array(600).fill('word').join(' '); });
      assert(await h.turn('I head down to the mixer on the quad.'));
      assert.equal(top(promptOf(lastTurn(h))), wb.standard[1], 'a move to a place the world names is a journey, not a transition');
      assert.equal(fits(), 0, 'and its reply is not trimmed');
      assert(await h.turn('I go over and introduce myself to ' + minor.first + '.'));
      let p = promptOf(lastTurn(h));
      assert.equal(top(p), wb.rich[1], 'a first meeting typed as a move takes the rich band: ' + top(p));
      assert.equal(fits(), 0, 'a full first-sight reply is kept');
      assert(await h.turn('I walk up to ' + minor.first + ' and say hello.'));
      p = promptOf(lastTurn(h));
      assert(top(p) >= wb.standard[1], 'walking up to someone and greeting them is no transition: ' + top(p));
      assert(await h.turn('I go to bed.'));
      p = promptOf(lastTurn(h));
      assert(top(p) < wb.standard[1], 'a plain move is still a transition: ' + top(p));
      assert.equal(fits(), 1, 'and a long reply to it is trimmed as before');
      clean(h);
    } finally { h.close(); }
  },

  // A look the action asks for, by name or by a pronoun that fits one person here, gets the whole description again: the <action>
  // block says so, the First sight, Fresh detail and Length rules allow it, the band runs from its floor to the room's top, and a
  // long reply is trimmed only past the room, with the fit told to keep every detail the action looked at. Words a character is
  // asked to say are no look, and an ordinary turn is fitted as before.
  async describeAskedGetsTheLook() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    try {
      const { id, data } = onlyAdv(h.mock.store), W = h.window.WINDLASS_WORLDS[data.worldId], wb = W.wordBands;
      let long = 0, fitPrompt = '';
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'length fit') { fitPrompt = promptOf({ input }); return h.mock.defaultHandler(input, o, call); }
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        const r = JSON.parse(h.mock.defaultHandler(input, o, call));
        if (long) r.narrative = Array(long).fill('word').join(' ');
        r.state_updates = [{ key: 'present', op: 'append', value: ['May Tanaka'] }];
        return JSON.stringify(r);
      };
      const fits = () => h.mock.sampleCalls.filter((c) => c.label === 'length fit').length;
      const lengthLine = (p) => (/Narrative length: [^\n]*/.exec(p) || [''])[0];
      assert(await h.turn('I sit down and talk with May.'));
      long = wb.standard[1] + 100;
      assert(await h.turn('Describe May to me in detail: how she looks, what she is wearing.'));
      let p = promptOf(lastTurn(h)), rules = blockOf(p, 'rules'), act = blockOf(p, 'action');
      assert.match(rules, /a person met before is not described again unless something has changed, or \S+ looks at them or asks for them described: then the whole of their Looks may be given again, as one flowing paragraph/, 'the First sight rule allows an asked description');
      assert.match(rules, /the room past the band for when the scene needs it \(a look \S+ asks for/, 'the Length rule counts an asked look');
      assert.doesNotMatch(rules, /the lower half for transitions/, 'the rule no longer asks for the lower half on top of the engine\'s transition band');
      assert.match(rules, /with only what is new added, except where the action looks at it/, 'the Fresh detail rule gives way to a look');
      assert.match(act, /The action looks at May: her whole Looks and Dress may be given again, as one flowing paragraph through \S+'s senses, with the whole room the length line gives; the first-sight and fresh-detail limits do not hold for what the action looks at\./, 'the action block names the look: ' + act.slice(0, 600));
      const upper = 'Narrative length: ' + wb.standard[0] + ' to ' + W.wordRoom.standard + ' words, the room included, for the look the action asks for. Stop at the first moment ' + data.player.first + ' would speak or choose.';
      assert.equal(lengthLine(p), upper, 'the band runs from its floor to the room\'s top, without the shorter-is-fine clause');
      assert.equal(fits(), 0, 'a long description the action asked for is not trimmed');
      assert.equal(storedTurns(h.mock.store, id).at(-1).words, wb.standard[1] + 100, 'the long reply is kept whole');
      assert(await h.turn('Describe her.'));
      assert.match(blockOf(promptOf(lastTurn(h)), 'action'), /The action looks at May: her whole Looks and Dress/, 'a pronoun that fits one person here names her');
      assert(await h.turn('I look at her closely.'));
      assert.match(blockOf(promptOf(lastTurn(h)), 'action'), /The action looks at May/, 'a look is a look');
      assert.equal(fits(), 0);
      long = 0;
      assert(await h.turn('Ask May to describe her home town.'));
      assert.doesNotMatch(blockOf(promptOf(lastTurn(h)), 'action'), /The action looks at/, 'words a character is asked to say are not a look');
      assert(await h.turn('Ask May what she studies.'));
      assert.doesNotMatch(blockOf(promptOf(lastTurn(h)), 'action'), /The action looks at/, 'nor is a question about her studies');
      // "Tell me" addresses the narrator: a look, not a talk turn, so it is neither stepped down nor given the talk note.
      assert(await h.turn('Tell me what May looks like.'));
      p = promptOf(lastTurn(h));
      assert.match(blockOf(p, 'action'), /The action looks at May: her whole Looks and Dress/, 'telling the narrator to describe her is a look: ' + blockOf(p, 'action').slice(0, 400));
      assert.doesNotMatch(p, /Talk note \(binding\)/, 'and no talk turn');
      assert.equal(lengthLine(p), upper, 'so it takes the setting\'s band with its room');
      assert(await h.turn('Tell me everything about how May looks, head to hoof.'));
      assert.match(blockOf(promptOf(lastTurn(h)), 'action'), /The action looks at May/, 'however the ask is worded');
      assert(await h.turn('I sit down and look May over.'));
      p = promptOf(lastTurn(h));
      assert.match(blockOf(p, 'action'), /The action looks at May/, 'a look that opens with a sit-down is a look');
      assert.equal(lengthLine(p), upper, 'and is not cut as a transition');
      assert(await h.turn('I look at the clock.'));
      assert.doesNotMatch(blockOf(promptOf(lastTurn(h)), 'action'), /The action looks at/, 'a glance at a thing is not a look');
      assert(await h.turn('I watch May unpack.'));
      assert.doesNotMatch(blockOf(promptOf(lastTurn(h)), 'action'), /The action looks at/, 'nor is watching what she does');
      assert(await h.turn('I look at the menu with May.'));
      assert.doesNotMatch(blockOf(promptOf(lastTurn(h)), 'action'), /The action looks at/, 'nor a look at a thing with her beside it');
      assert(await h.turn('I look over at May.'));
      assert.doesNotMatch(blockOf(promptOf(lastTurn(h)), 'action'), /The action looks at/, 'nor a glance her way');
      assert(await h.turn('I tell May what I think she looks like.'));
      p = promptOf(lastTurn(h));
      assert.doesNotMatch(blockOf(p, 'action'), /The action looks at/, 'words said to her about her looks are no look');
      assert.match(p, /Talk note \(binding\)/, 'they are a talk turn');
      long = 1000;
      assert(await h.turn('Describe May.'));
      assert.equal(fits(), 1, 'a description that runs past the room is fitted');
      assert.match(fitPrompt, /cut only what repeats itself; keep every detail of the person or place the action looks at\./, 'and the fit is told to keep what was looked at');
      long = 700;
      assert(await h.turn('I sit at the desk and read.'));
      assert.equal(fits(), 2, 'an ordinary turn over the room is fitted as before');
      assert.match(fitPrompt, /cut what repeats or is filler\./);
      // A turn that names someone carries the Focus line and never the NPC initiative window beside it, on the window's own turn included.
      long = 0;
      for (let i = 0; i < 3; i++) {
        assert(await h.turn('I sit on the bed next to May.'));
        const act2 = blockOf(promptOf(lastTurn(h)), 'action');
        assert.match(act2, /Focus: the action names May/, 'the turn belongs to May');
        assert.doesNotMatch(act2, /NPC initiative window/, 'and the initiative window stays out of a focused turn');
      }
      clean(h);
    } finally { h.close(); }
  },

  // A length the player asks for is binding wherever it is said: a director note in the describe forms ("Describe her in about so
  // many words", "in at least so many words", "a so-many-word description"), the action itself, or a regeneration note, which also
  // pulls the lore and the people it names. The prompt's band and the fit follow it, and a reply that honours an asked floor is never
  // trimmed.
  async askedLengthAnywhere() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
    try {
      const { id } = onlyAdv(h.mock.store);
      let long = 620;
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'length fit') return Array(300).fill('fit').join(' ');
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        const r = JSON.parse(h.mock.defaultHandler(input, o, call)); r.narrative = Array(long).fill('word').join(' ');
        r.state_updates = [{ key: 'present', op: 'append', value: ['Daisy Holm'] }];
        return JSON.stringify(r);
      };
      const fits = () => h.mock.sampleCalls.filter((c) => c.label === 'length fit').length;
      const last = () => storedTurns(h.mock.store, id).at(-1);
      const lengthLine = (p) => (/Narrative length: [^\n]*/.exec(p) || [''])[0];
      const check = async (action, director, want, label) => {
        assert(await h.turn(action, { director }), label + ' did not finish');
        const p = promptOf(lastTurn(h));
        assert.match(lengthLine(p), want, label + ': ' + lengthLine(p));
        assert.match(blockOf(p, 'output_format'), new RegExp('"narrative": string, at most ' + /at most (\d+)/.exec(lengthLine(p))[1] + ' words'), label + ': the output format agrees');
      };
      await check('I look at Daisy.', 'Describe her in about 600 words.', /^Narrative length: at most 660 words; 510 to 660 when the scene earns it/, 'describe her in about N words');
      assert.deepEqual(Array.from(last().band), [510, 660]); assert.equal(last().words, 620, 'the reply inside the asked band is kept'); assert.equal(fits(), 0);
      await check('I look at Daisy.', 'Describe her in at least 600 words.', /^Narrative length: at most 750 words; at least 600, as the director note requires/, 'describe her in at least N words');
      assert.equal(fits(), 0, 'a reply that honours the asked floor is not trimmed'); assert.equal(last().words, 620);
      await check('I look at Daisy.', 'Give me a 600-word description of her.', /^Narrative length: at most 660 words; 510 to 660/, 'a N-word description');
      await check('Describe Daisy in about 600 words.', '', /^Narrative length: at most 660 words; 510 to 660/, 'a length in the action');
      assert.equal(fits(), 0);
      await check('Describe Daisy in 600 words, slowly.', '', /^Narrative length: at most 660 words; 510 to 660/, 'a comma after the ask still binds');
      // Words said to someone in the story, and a count that is the character's own business, set no length.
      long = 300;
      for (const said of ['Tell Daisy I wrote it in 600 words.', 'Explain the rules to her in 300 words or less.', 'Write my essay, 500 words.', 'Write a letter to my mother in 200 words.', 'Write my essay in 500 words.', 'Give Daisy a speech in 50 words.', 'Describe the plan to Daisy in 100 words.']) {
        assert(await h.turn(said), said + ' did not finish');
        const line = lengthLine(promptOf(lastTurn(h)));
        assert.doesNotMatch(line, /at most (?:660|330|550|220|60|110) words|as the action requires/, said + ' set a length: ' + line);
      }
      assert.equal(fits(), 0, 'and nothing was fitted to one');
      long = 620;
      // A regeneration note: a plain turn first, fitted to its own band as before, then rewritten longer.
      assert(await h.turn('I sit with Daisy.', { director: '' }));
      assert.equal(fits(), 1, 'a plain reply over its band is fitted'); assert.equal(last().words, 300);
      const regen = async (note) => { h.click('#regenWith'); h.$('#rewrite').value = note; h.click('#rewriteGo'); assert(await h.idle(20000), 'the rewrite did not finish'); return promptOf(lastTurn(h)); };
      let p = await regen('Longer, please: at least 600 words.');
      assert.match(lengthLine(p), /^Narrative length: at most 750 words; at least 600, as the regeneration note requires/, 'a regeneration note sets the band: ' + lengthLine(p));
      assert.match(p, /Regeneration note \(binding[^\n]*Longer, please: at least 600 words\./);
      assert.equal(fits(), 1, 'the reply that honours it is not trimmed');
      assert.equal(last().words, 620); assert.deepEqual(Array.from(last().band), [600, 750]); assert.equal(last().rewrite, 'Longer, please: at least 600 words.');
      long = 780;
      p = await regen('Write about 800 words.');
      assert.match(lengthLine(p), /^Narrative length: at most 880 words; 680 to 880/, lengthLine(p));
      assert.match(blockOf(p, 'output_format'), /"narrative": string, at most 880 words/);
      assert.equal(fits(), 1); assert.equal(last().words, 780);
      long = 180;
      p = await regen('Have Daisy explain what the Sundering does.');
      assert.match(p, /the Sundering, as people know it/, 'a regeneration note pulls the lore it names');
      assert.match(blockOf(p, 'action'), /Focus: the action or regeneration note names Daisy/, 'and its people reach the focus line');
      clean(h);
    } finally { h.close(); }
  },

  // The length fit's reply is the passage alone: a label line ("Here is the passage, trimmed to length:"), a code fence or a trailing
  // word count comes off before it is stored, counted and shown, and never reaches the next prompt; a reply still carrying a fence is
  // refused and the original kept.
  async lengthFitStripsPreambleAndFence() {
    const h = await begin();
    try {
      const { id } = onlyAdv(h.mock.store);
      const passage = Array.from({ length: 430 }, (_, i) => 'trimmed' + (i % 7)).join(' ');
      let wrap = (t) => t;
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'length fit') return wrap(passage);
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        const r = JSON.parse(h.mock.defaultHandler(input, o, call)); r.narrative = Array(900).fill('story').join(' '); return JSON.stringify(r);
      };
      wrap = (t) => 'Here is the passage, trimmed to length:\n\n```\n' + t + '\n```';
      assert(await h.turn('I look around the room.'));
      let t = storedTurns(h.mock.store, id).at(-1);
      assert(t.narrative.startsWith('trimmed0 trimmed1'), 'the stored narrative starts with the passage: ' + t.narrative.slice(0, 80));
      assert(!/```|Here is/.test(t.narrative), 'no fence or label is stored');
      assert.equal(t.words, 430, 'the words counted are the passage\'s');
      assert(t.notes.some((n) => /length fitted 900 → 430 words/.test(n)), JSON.stringify(t.notes));
      assert(!/```|Here is the passage/.test(h.$('#feed').textContent), 'none of it is shown');
      wrap = (t) => 'Here is the rewritten passage:\n\n' + t + '\n\n(Word count: 430)';
      assert(await h.turn('I look around again.'));
      const next = promptOf(lastTurn(h));
      assert(!/```/.test(blockOf(next, 'recent_turns')) && !/Here is the passage/.test(next), 'the next prompt carries the clean passage');
      t = storedTurns(h.mock.store, id).at(-1);
      assert(t.narrative.startsWith('trimmed0') && t.narrative.endsWith('trimmed2') && !/Word count/.test(t.narrative), 'a label and a trailing count come off: ' + t.narrative.slice(-60));
      assert.equal(t.words, 430);
      wrap = (t) => 'Trimmed version:\n```\n' + t + '\n```\nHope this helps!';
      assert(await h.turn('I look around once more.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(t.words, 900, 'a fit still carrying a fence is refused and the original kept');
      assert(t.notes.some((n) => /length fit returned unusable text; kept the original/.test(n)), JSON.stringify(t.notes));
      clean(h);
    } finally { h.close(); }
  },

  // A reply cut off by the runtime is asked for again shorter, but never under a floor the player asked for: with an "at least" note
  // the second ask is never for fewer words than that floor, so a reply that obeys it needs no expansion.
  async retryKeepsTheFloor() {
    const h = await begin();
    try {
      const { id } = onlyAdv(h.mock.store); let calls = 0, asked = 0;
      h.mock.sampleHandler = (input, o, call) => {
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        calls++;
        if (calls === 1) return { text: '{"evaluation":{},"narrative":"The room is quiet and you', truncated: true };
        asked = +(/Reply again with the narrative at most (\d+) words/.exec(promptOf({ input })) || [])[1];
        const r = JSON.parse(h.mock.defaultHandler(input, o, call)); r.narrative = Array(asked).fill('word').join(' '); return JSON.stringify(r);
      };
      assert(await h.turn('I look around the room.', { director: 'Write at least 600 words.' }));
      assert.equal(calls, 2, 'the cut-off reply is asked for once more');
      assert(asked >= 600, 'the shorter ask never goes under the asked floor: at most ' + asked);
      assert.equal(h.mock.sampleCalls.filter((c) => c.label === 'length fit').length, 0, 'a reply that obeys it needs no expansion');
      const t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(t.words, asked); assert.deepEqual(Array.from(t.band), [600, 750]);
      assert(!t.notes.some((n) => /length expanded/.test(n)), JSON.stringify(t.notes));
      clean(h);
    } finally { h.close(); }
  },

  // The band is the everyday range and the room above it is the writer's when the scene needs it: an ordinary turn's length line
  // names the band's floor and ceiling (the everyday numbers) and then the room in one clause, as room and never as a quota, with its
  // cases; the output format's ceiling is the room's top; the world's Length rule says the room is a ceiling like the band; a reply of
  // room-top length is kept whole and one past the room is trimmed to the room, not to the band; Debug and the Settings note name the
  // room beside the band; a transition has no room past its cut ceiling.
  async lengthLineCarriesTheRoom() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
    try {
      const { id, data } = onlyAdv(h.mock.store), W = h.window.WINDLASS_WORLDS[data.worldId], wb = W.wordBands, wr = W.wordRoom, first = data.player.first;
      assert.deepEqual(JSON.parse(JSON.stringify(wb)), { terse: [180, 320], standard: [240, 460], rich: [360, 640] }, 'the everyday bands are the old numbers: ' + JSON.stringify(wb));
      assert.deepEqual(JSON.parse(JSON.stringify(wr)), { terse: 420, standard: 610, rich: 850 }, 'and the room tops are the raised ones: ' + JSON.stringify(wr));
      let long = 0, fitPrompt = '';
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'length fit') { fitPrompt = promptOf({ input }); return Array(500).fill('fit').join(' '); }
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        const r = JSON.parse(h.mock.defaultHandler(input, o, call));
        if (long) r.narrative = Array(long).fill('word').join(' ');
        r.state_updates = [{ key: 'present', op: 'append', value: ['Daisy Holm'] }];
        return JSON.stringify(r);
      };
      const fits = () => h.mock.sampleCalls.filter((c) => c.label === 'length fit').length, last = () => storedTurns(h.mock.store, id).at(-1);
      const lengthLine = (p) => (/Narrative length: [^\n]*/.exec(p) || [''])[0];
      const room = ', and up to ' + wr.standard + ' words when the scene needs it: a look ' + first + ' asks for, a first meeting, the opening, a change in the body, closeness';
      long = wr.standard;
      assert(await h.turn('I open my notebook and sketch the lake.'));
      let p = promptOf(lastTurn(h));
      assert.equal(lengthLine(p), 'Narrative length: ' + wb.standard[0] + ' to ' + wb.standard[1] + ' words' + room + '; shorter whenever ' + first + ' reaches a choice sooner. Stop at the first moment ' + first + ' would speak or choose.', 'the line names the band and then the room: ' + lengthLine(p));
      assert.match(blockOf(p, 'output_format'), new RegExp('"narrative": string, at most ' + wr.standard + ' words'), 'the output format\'s ceiling is the room\'s top');
      assert.match(blockOf(p, 'rules'), /the band in <action> is a ceiling, not a quota, and so is the room above it/, 'the Length rule says the room is a ceiling too');
      assert.match(blockOf(p, 'rules'), /the room past the band for when the scene needs it \(a look \S+ asks for, a first meeting, the opening, a change in the body, closeness\)/, 'and gives its cases');
      assert.equal(fits(), 0, 'a reply of room-top length is kept whole'); assert.equal(last().words, wr.standard);
      assert.deepEqual(Array.from(last().band), Array.from(wb.standard), 'the turn keeps the everyday band');
      long = wr.standard + 90;
      assert(await h.turn('I read on.'));
      assert.equal(fits(), 1, 'a reply past the room is trimmed');
      assert.match(fitPrompt, new RegExp('Rewrite it to between ' + wb.standard[1] + ' and ' + wr.standard + ' words'), 'to the room, not the band: ' + (/Rewrite it to between \d+ and \d+ words/.exec(fitPrompt) || [''])[0]);
      assert.equal(last().words, 500, 'and the trimmed reply, inside the room, is kept');
      assert(last().notes.some((n) => /length fitted \d+ → 500 words/.test(n)), JSON.stringify(last().notes));
      h.click('#btnDebug');
      assert.match(h.$('#dbgMeta').textContent, new RegExp('\\(band ' + wb.standard[0] + '–' + wb.standard[1] + ', room to ' + wr.standard + '\\)'), 'Debug names the room beside the band: ' + h.$('#dbgMeta').textContent);
      h.click('[data-close="dlgDebug"]');
      long = 0;
      assert(await h.turn('I go to bed.'));
      p = promptOf(lastTurn(h));
      const cut = /^Narrative length: (\d+) to (\d+) words; shorter whenever/.exec(lengthLine(p));
      assert(cut && +cut[2] < wb.standard[1] && !/up to \d+ words/.test(lengthLine(p)), 'a transition names its cut band and no room: ' + lengthLine(p));
      h.click('#btnSettings');
      const dn = h.$('#setDensityNote').textContent;
      for (const k of ['terse', 'standard', 'rich']) assert(dn.includes(k + ' ' + wb[k][0] + '–' + wb[k][1] + ' (room to ' + wr[k] + ')'), 'the Settings note gives ' + k + ' with its room: ' + dn);
      assert.match(dn, /the room past a band is the writer's when the scene needs it/, dn);
      h.click('[data-close="dlgSettings"]');
      clean(h);
    } finally { h.close(); }
  },

  // A look the action asks for has the room outright: its length line runs from the band's floor to the room's top, the look line says
  // the room is its, a reply up to the room's top is kept whole, and one past it is trimmed to the room, never into the band; and a
  // reply cut off by the runtime is asked for again never under the band's floor, an asked band's included.
  async describeTurnTakesTheRoom() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    try {
      const { id, data } = onlyAdv(h.mock.store), W = h.window.WINDLASS_WORLDS[data.worldId], wb = W.wordBands, wr = W.wordRoom, first = data.player.first;
      let long = 0, fitPrompt = '', cut = false, asked = 0;
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'length fit') { fitPrompt = promptOf({ input }); return Array(560).fill('fit').join(' '); }
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        if (cut) { cut = false; return { text: '{"evaluation":{},"narrative":"You look at her and', truncated: true }; }
        const m = /Reply again with the narrative at most (\d+) words/.exec(promptOf({ input })); if (m) asked = +m[1];
        const r = JSON.parse(h.mock.defaultHandler(input, o, call));
        if (long) r.narrative = Array(long).fill('word').join(' ');
        r.state_updates = [{ key: 'present', op: 'append', value: ['May Tanaka'] }];
        return JSON.stringify(r);
      };
      const fits = () => h.mock.sampleCalls.filter((c) => c.label === 'length fit').length, last = () => storedTurns(h.mock.store, id).at(-1);
      const lengthLine = (p) => (/Narrative length: [^\n]*/.exec(p) || [''])[0];
      assert(await h.turn('I sit down and talk with May.'));
      long = wr.standard;
      assert(await h.turn('Describe May.'));
      let p = promptOf(lastTurn(h)), act = blockOf(p, 'action');
      assert.equal(lengthLine(p), 'Narrative length: ' + wb.standard[0] + ' to ' + wr.standard + ' words, the room included, for the look the action asks for. Stop at the first moment ' + first + ' would speak or choose.', 'the line runs from the band\'s floor to the room\'s top: ' + lengthLine(p));
      assert.match(act, /The action looks at May: her whole Looks and Dress may be given again, as one flowing paragraph through \S+'s senses, with the whole room the length line gives;/, 'the look line gives the room: ' + act.slice(0, 500));
      assert.match(blockOf(p, 'output_format'), new RegExp('"narrative": string, at most ' + wr.standard + ' words'), 'the output format\'s ceiling is the room\'s top');
      assert.equal(fits(), 0, 'a look of room-top length is kept whole'); assert.equal(last().words, wr.standard);
      assert.deepEqual(Array.from(last().band), [wb.standard[0], wr.standard], 'the saved band runs from the floor to the room\'s top');
      long = wr.standard + 90;
      assert(await h.turn('Describe her.'));
      assert.equal(fits(), 1, 'a look past the room is trimmed');
      assert.match(fitPrompt, new RegExp('Rewrite it to between ' + wb.standard[0] + ' and ' + wr.standard + ' words'), 'to the room\'s top and never under the band\'s floor: ' + (/Rewrite it to between \d+ and \d+ words/.exec(fitPrompt) || [''])[0]);
      assert.match(fitPrompt, /cut only what repeats itself; keep every detail of the person or place the action looks at\./, 'and the fit keeps what was looked at');
      assert.equal(last().words, 560, 'the trimmed look, inside the room, is kept');
      long = 0; cut = true;
      assert(await h.turn('I look at May.', { director: 'Describe her in about 600 words.' }));
      assert(asked >= 510, 'the shorter ask after a cut-off reply never goes under the asked band\'s floor: at most ' + asked);
      assert.deepEqual(Array.from(last().band), [510, 660]);
      clean(h);
    } finally { h.close(); }
  },

  // A contact the player gives in the binding director note or in a regeneration note is confirmed by the engine like one in the
  // action, whatever the narrator reports; a guarded note ("Do not have sex with Daisy yet") confirms none.
  // A note that names the act only to take it out of the turn ("instead of having sex with her", "rather than", "cut the part where")
  // confirms nothing: the player turned it down, and the body is never dosed for an act the narrative does not show.
  async noteContactConfirmed() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
    try {
      const { id } = onlyAdv(h.mock.store), tf = () => onlyAdv(h.mock.store).data.state.tf, last = () => storedTurns(h.mock.store, id).at(-1);
      patchTurns(h, (r) => { r.exposures = []; r.state_updates = [{ key: 'present', op: 'append', value: ['Daisy Holm'] }]; });
      const cow = () => (last().exposures || []).filter((e) => e.species === 'cow').map((e) => e.intensity);
      assert(await h.turn('I wait.', { director: 'I have sex with Daisy.' }));
      assert.deepEqual(cow(), [4], 'a contact given in the director note is confirmed: ' + JSON.stringify(last().exposures));
      assert.equal(tf().influence.cow, 16, 'and counts');
      assert(await h.turn('I wait.', { director: 'Do not have sex with Daisy yet.' }));
      assert.deepEqual(cow(), [], 'a guarded note confirms nothing');
      assert(await h.turn('I wait.', { director: 'Rather than having sex with Daisy, I read.' }));
      assert.deepEqual(cow(), [], 'nor does an act named to be set aside: ' + JSON.stringify(last().exposures));
      assert.equal(tf().influence.cow, 16, 'and the body is not dosed for it');
      assert(await h.turn('I sit with Daisy on the bed.', { director: '' }));
      assert.deepEqual(cow(), [], 'sitting together is no contact');
      const regen = async (note) => { h.click('#regenWith'); h.$('#rewrite').value = note; h.click('#rewriteGo'); assert(await h.idle(20000), 'the rewrite did not finish'); };
      await regen('Instead, I make love to Daisy.');
      assert.deepEqual(cow(), [4], 'a contact given in a regeneration note is confirmed: ' + JSON.stringify(last().exposures));
      const dosed = tf().influence.cow;
      assert(await h.turn('I sit with Daisy.', { director: '' }));
      await regen('Instead of having sex with Daisy, we just talk until we fall asleep.');
      assert.deepEqual(cow(), [], 'a rewrite that takes the act out confirms nothing: ' + JSON.stringify(last().exposures));
      assert(await h.turn('I sit with Daisy.', { director: '' }));
      await regen('Cut the part where I have sex with Daisy.');
      assert.deepEqual(cow(), [], 'nor one that cuts it: ' + JSON.stringify(last().exposures));
      assert.equal(tf().influence.cow, dosed, 'and the body is unchanged by either');
      clean(h);
    } finally { h.close(); }
  },

  // The length fit cannot gut a scene: a rewrite far below the band is refused and the original kept, and the fit's own prompt
  // says to keep the wording of every physical act. Fails on 10ae2ee (an 800-word reply became 55 words).
  async fitCannotGut() {
    const h = await begin();
    try {
      await h.settle(150, 6000);
      const { id } = onlyAdv(h.mock.store); let fitPrompt = '';
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'length fit') { fitPrompt = typeof input === 'string' ? input : input.map((m) => m.content).join('\n'); return Array(55).fill('crumb').join(' '); }
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        const r = JSON.parse(h.mock.defaultHandler(input, o, call)); r.narrative = Array(900).fill('story').join(' '); return JSON.stringify(r);
      };
      assert(await h.turn('I look around the room.'), 'the turn did not finish');
      assert(fitPrompt, 'an 900-word reply must be sent to the length fit');
      const t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(t.words, 900, 'the 55-word rewrite is refused and the original kept (words: ' + t.words + ')');
      assert(t.notes.some((n) => /length fit returned unusable text; kept the original/.test(n)), 'a note says so: ' + JSON.stringify(t.notes));
      assert.match(fitPrompt, /wording of every physical act, exactly as written; do not soften, summarise or skip any act/, 'the fit is told to keep every act as written');
      assert.match(fitPrompt, /cut what repeats or is filler\./, 'a shortening is told to cut');
      assert.doesNotMatch(fitPrompt, /add sensory detail/, 'and not to add, which is the expansion\'s job (and there only what the passage already has)');
      clean(h);
    } finally { h.close(); }
  },

  // 17d. State updates from the reply: a missing or junk value never reaches the lists ("undefined" in present), an empty remove
  // or a junk set never empties the inventory, "False" reads false, an append to a text item adds to it, an inherited name such as "constructor"
  // is no attitude, and a runaway fact is cut at a word. Fails on 10ae2ee.
  async junkUpdates() {
    const h = await begin();
    try {
      await h.settle(150, 6000);
      const { id } = onlyAdv(h.mock.store); const state = () => onlyAdv(h.mock.store).data.state;
      patchTurns(h, (r) => { r.state_updates = [{ key: 'items.inventory', op: 'append', value: 'brass key' }, { key: 'items.condition', op: 'set', value: 'tired' }, { key: 'flags.met_dean', op: 'set', value: true }]; });
      assert(await h.turn('I pick up the key.'));
      const present = state().present.slice(), inventory = state().items.inventory.slice();
      assert(inventory.includes('brass key')); assert.equal(state().flags.met_dean, true);
      patchTurns(h, (r) => {
        r.state_updates = [{ key: 'present', op: 'append' }, { key: 'present', op: 'append', value: null }, { key: 'present', op: 'append', value: { who: 'x' } }, { key: 'present', op: 'set', value: '' },
          { key: 'items.inventory', op: 'remove', value: '' }, { key: 'items.inventory', op: 'append', value: [null, '', 'undefined'] },
          { key: 'items.inventory', op: 'set', value: null }, { key: 'items.inventory', op: 'set', value: ['undefined'] }, { key: 'items.clubs', value: '' },
          { key: 'flags.met_dean', op: 'set', value: 'False' }, { key: 'items.condition', op: 'append', value: 'sore' }, { key: 'constructor', op: 'set', value: 3 }];
        r.facts = ['A ' + 'very long durable fact '.repeat(100)];
      });
      assert(await h.turn('I look around.'));
      const s = state(), t = storedTurns(h.mock.store, id).at(-1);
      assert.deepEqual(s.present, present, 'present is untouched by values that are not names: ' + JSON.stringify(s.present));
      assert.deepEqual(s.items.inventory, inventory, 'an empty remove and junk appends leave the inventory alone: ' + JSON.stringify(s.items.inventory));
      assert.equal(s.flags.met_dean, false, '"False" turns the flag off');
      assert.equal(s.items.condition, 'tired; sore', 'an append adds to a text item');
      assert(!Object.keys(s.attitudes).includes('constructor'), 'an inherited name is not an attitude');
      assert(t.facts[0].length <= 241 && /…$/.test(t.facts[0]), 'a runaway fact is cut at a word: ' + t.facts[0].length);
      clean(h);
    } finally { h.close(); }
  },

  // The clock: a time_advance of null is no number (the default 15 minutes and a note, not 0), and the event stamps the
  // narrator writes are held inside the minutes the turn covered. Fails on 10ae2ee.
  async clockAndStamps() {
    const h = await begin();
    try {
      await h.settle(150, 6000);
      const { id } = onlyAdv(h.mock.store); const st = () => onlyAdv(h.mock.store).data.state;
      const at = (d, hhmm) => (d - 1) * 1440 + (+hhmm.slice(0, 2)) * 60 + (+hhmm.slice(3, 5));
      const b = st(), lo = at(b.day, b.time);
      patchTurns(h, (r) => { r.time_advance_minutes = null; r.events = ['Day 1 00:05 far too early', 'Day 9 23:59 far too late', 'no stamp at all']; });
      assert(await h.turn('I look around the room.'));
      const a = st(), hi = at(a.day, a.time), t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(hi - lo, 15, 'a null time_advance advances the default 15 minutes, not 0');
      assert(t.notes.some((n) => /time_advance missing; used 15/.test(n)), 'and says so');
      const ev = onlyAdv(h.mock.store).data.memory.events.slice(-3);
      for (const e of ev.slice(0, 2)) { const m = /^Day (\d+) (\d\d:\d\d) /.exec(e); assert(m, 'a stamped event keeps its stamp: ' + e); const x = at(+m[1], m[2]); assert(x >= lo && x <= hi, 'the stamp lies inside the minutes the turn covered (' + lo + ' to ' + hi + '): ' + e); }
      assert.equal(ev[2], 'no stamp at all', 'an event with no stamp is left as written');
      assert(t.notes.some((n) => /event times? moved/.test(n)), 'a note says the stamps were moved: ' + JSON.stringify(t.notes));
      clean(h);
    } finally { h.close(); }
  },

  // A bond shift moves a facet only in a direction the narrator states: "decrease" or none is ignored with a note, not read as
  // "up". Fails on 10ae2ee.
  async bondDirection() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      const { id } = onlyAdv(h.mock.store); const trust = () => onlyAdv(h.mock.store).data.state.bonds.roommate.trust.p;
      patchTurns(h, (r) => { r.exposures = []; r.bond_shifts = []; });
      assert(await h.turn('I unpack.')); const t0 = trust();
      patchTurns(h, (r) => { r.exposures = []; r.bond_shifts = [{ who: 'roommate', facet: 'trust', dir: 'decrease', why: 'a promise broken' }, { who: 'roommate', facet: 'trust', why: 'no direction' }]; });
      assert(await h.turn('I break my promise.'));
      assert.equal(trust(), t0, 'trust did not move on a "decrease" or on no direction');
      assert(storedTurns(h.mock.store, id).at(-1).notes.some((n) => /ignored bond shift/.test(n)), 'and the note says why');
      patchTurns(h, (r) => { r.exposures = []; r.bond_shifts = [{ who: ' roommate ', facet: ' Trust', dir: ' up ', why: 'kept a promise' }]; });
      assert(await h.turn('I keep a promise.'));
      assert(trust() > t0, 'a stated "up" still raises it, whatever the spacing and case');
      clean(h);
    } finally { h.close(); }
  },

  // An engine step that throws on a damaged save does not cost the narrator's finished turn: the turn is kept without that
  // step, the state as it was, with a note and a status. Fails on 10ae2ee (a page error, no turn).
  async engineStepGuard() {
    const h0 = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    let store;
    try { await h0.settle(150, 6000); assert(await h0.turn('I look around.')); store = new Map([...h0.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { h0.close(); }
    const { id, data } = onlyAdv(store); data.state.tf.last = 5;
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000);
      const n0 = onlyAdv(h.mock.store).data.turnCount;
      patchTurns(h, (r) => { r.exposures = [{ species: 'cow', method: 'hug', intensity: 3 }]; });
      assert(await h.turn('I hug Daisy.'));
      assert.equal(onlyAdv(h.mock.store).data.turnCount, n0 + 1, 'the turn is kept (status: ' + statusText(h) + ')');
      const t = storedTurns(h.mock.store, id).at(-1);
      assert(t.notes.some((n) => /engine step "transformation" failed/.test(n)), 'a note names the step: ' + JSON.stringify(t.notes));
      assert.match(statusText(h), /could not update its transformation/, 'the status says so');
      assert.equal(t.narrative.length > 0, true);
      assert(!h.errors.length, 'no page error: ' + JSON.stringify(h.errors).slice(0, 300));
    } finally { h.close(); }
  },

  // Text typed while a turn is being written stays in its box when the turn finishes; a box still holding what was sent is
  // cleared as before. Fails on 10ae2ee.
  async typedWhileWriting() {
    const h = await begin();
    try {
      await h.settle(150, 6000);
      h.mock.sampleHandler = async (input, o, call) => { if (/^turn/.test(call.label)) await h.sleep(500); return h.mock.defaultHandler(input, o, call); };
      h.$('#action').value = 'First action'; h.$('#director').value = 'keep the scene slow'; h.click('#send'); await h.sleep(150);
      h.$('#action').value = 'My next idea, typed while waiting'; h.$('#director').value = 'a note typed while waiting';
      assert(await h.idle(20000));
      assert.equal(h.$('#action').value, 'My next idea, typed while waiting', 'the next action is kept');
      assert.equal(h.$('#director').value, 'a note typed while waiting', 'the next director note is kept');
      h.mock.sampleHandler = null;
      h.$('#action').value = 'Second action'; h.$('#director').value = ''; h.click('#send'); assert(await h.idle(20000));
      assert.equal(h.$('#action').value, '', 'a box that still holds what was sent is cleared');
      clean(h);
    } finally { h.close(); }
  },

  // A reply cut off is asked for again with a shorter one requested (the same prompt would be cut at the same place); a
  // service failure is asked again once after a short wait; Stop during the length fit or the memory fold says so in the status.
  // Fails on 10ae2ee.
  async retriesAndStop() {
    const h = await begin();
    try {
      await h.settle(150, 6000);
      const { id } = onlyAdv(h.mock.store); const n0 = onlyAdv(h.mock.store).data.turnCount; const prompts = []; let calls = 0;
      h.mock.sampleHandler = (input, o, call) => {
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        prompts.push(typeof input === 'string' ? input : input.map((m) => m.content).join('\n')); calls++;
        if (calls === 1) return { text: '{"evaluation":{},"narrative":"The room is quiet and you', truncated: true };
        return h.mock.defaultHandler(input, o, call);
      };
      assert(await h.turn('I look around the room.'));
      assert.equal(prompts.length, 2, 'a cut-off reply is asked for once more');
      assert(prompts[1].startsWith(prompts[0]) && /Your previous reply was cut off\. Reply again with the narrative at most \d+ words/.test(prompts[1].slice(prompts[0].length)), 'the second ask says the first was cut off and wants it shorter');
      assert.equal(onlyAdv(h.mock.store).data.turnCount, n0 + 1, 'the turn is kept');
      calls = 0; prompts.length = 0;
      h.mock.sampleHandler = (input, o, call) => {
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        calls++; if (calls === 1) throw { code: 'upstream_error', message: 'the service failed' };
        return h.mock.defaultHandler(input, o, call);
      };
      assert(await h.turn('I look around again.', { max: 30000 }));
      assert.equal(calls, 2, 'a service failure is asked again once');
      assert.equal(onlyAdv(h.mock.store).data.turnCount, n0 + 2, 'and the turn is kept');
      assert(storedTurns(h.mock.store, id).at(-1).notes.some((n) => /the service failed; asked again/.test(n)));
      clean(h);
    } finally { h.close(); }
  },

  // With Claude unavailable, the status keeps saying so after Begin, with a way to retry.
  async claudeUnavailable() {
    const h = await boot({ setup(w, m) { m.disable = { sample: true }; } });
    try {
      assert(await h.settle(150, 6000));
      h.click('#cBegin'); await h.idle(15000); await h.sleep(200);
      assert(!h.$('#status').hidden, 'the status must stay visible');
      assert.match(h.$('#status').textContent, /Not connected to Claude/);
      assert(statusButtons(h).some((b) => b.textContent === 'Retry connection'), 'a Retry connection button');
      clean(h);
    } finally { h.close(); }
  },

  // Accessibility basics.
  async accessibility() {
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000));
      assert.equal(h.$('#status').getAttribute('role'), 'status');
      assert(h.$('#status').getAttribute('aria-live'), '#status has aria-live');
      assert(h.$('#summary').getAttribute('aria-label'), '#summary has an aria-label');
      assert(h.document.documentElement.getAttribute('lang'), '<html lang>');
      clean(h);
    } finally { h.close(); }
  },

  // A reply cut off twice points at the setting that actually exists.
  async truncatedTwice() {
    const h = await begin();
    try {
      h.mock.sampleHandler = (input, o, call) => (/^turn/.test(call.label) ? { text: '{"narrative": "You look ar', truncated: true } : h.mock.defaultHandler(input, o, call));
      await h.turn('I look around.');
      assert.match(statusText(h), /cut off after two attempts/, statusText(h));
      assert.match(statusText(h), /Narrative density/, 'the message must name the Narrative density setting');
    } finally { h.close(); }
  },

  // A roommate's "not where their kind are expected" club is never the kind's own: with the Creamery as the only haunt on
  // offer and every roll landing low, a bovine roommate keeps her own day and her sheet does not call the Creamery unexpected.
  async hauntNotOwnClub() {
    const setup = (w) => {
      w.Math.random = () => 0.1;
      const store = {};
      w.WINDLASS_WORLDS = new w.Proxy(store, { set(t, k, v) { if (v && v.genPools) v.genPools.haunts = v.genPools.haunts.filter((h) => /Creamery/.test(h.club)); t[k] = v; return true; } });
    };
    const h = await begin({ setup, rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female' });
    try {
      const rm = onlyAdv(h.mock.store).data.roommate; const text = JSON.stringify(rm);
      assert.doesNotMatch(text, /Creamery regulars, which is not where/, 'a bovine roommate\'s own club is not an unexpected one: ' + text.slice(0, 300));
      assert.doesNotMatch(text, /not where (?:her|his|their) kind are expected/, 'with only her own club on offer she keeps her kind\'s day');
      clean(h);
    } finally { h.close(); }
  },
  // A part under way is followed before the next begins: the part told last goes on (three waypoints in a row) and a new part
  // waits while four of the kind are begun and unfinished. One waypoint a turn is kept, so the uncapped total is not slowed.
  async followedParts() {
    const g = await tfGame(22);
    try {
      const told = g.told; assert(told.length >= 18, 'one waypoint a turn is kept: ' + told.length + ' told in 22 turns');
      const begun = new Set(told.slice(0, 14).map((t) => t.part));
      assert(begun.size <= 7, 'at most seven parts begun in the first fourteen waypoints told: ' + begun.size + ' (' + [...begun].join(', ') + ')');
      assert(told.some((t, i) => i && told[i - 1].part === t.part && t.j === told[i - 1].j + 1), 'a part goes on in the very next turn');
      const open = new Map(); let most = 0;
      for (const t of told) { if (t.kind === 'complete') open.delete(t.part); else open.set(t.part, t.j); most = Math.max(most, open.size); }
      assert(most <= 5, 'no more than four parts (and one unlocked by a need) are begun and unfinished at once: ' + most);
      assert(told.some((t) => t.kind === 'complete'), 'a part has finished within twenty-two turns');
      clean(g.h);
    } finally { g.h.close(); }
  },

  // The way over shares the cap: while four parts of the kind and its way over are begun and unfinished, the parts under way go on
  // and no part of the way over begins ahead of them, as no part of the kind does.
  async wayOverUnderTheOpenCap() {
    const TR = loadWorld().transformation.tracks, W4 = TR.woman;
    const plain = TR.species.cow.filter((t) => !t.sex && !(t.needs && t.needs.length) && t.stages.length >= 4).slice(0, 4).map((t) => t.key);
    assert.equal(plain.length, 4, 'four plain bovine parts to have under way');
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    // The four parts under way are due again; the kind's other parts are not, and every part of the way over is due to begin.
    const cow = Object.fromEntries(TR.species.cow.map((t) => [t.key, plain.includes(t.key) ? { told: 1, p: 100, open: true, nextAt: 1, at: 1 } : { s: 70, e: 95 }]));
    g.doc.state.tf = Object.assign(baseTf('cow', 60, { lean: 0, face: 15, tracks: heldParts(TR.species.cow, cow) }),
      { sexprog: { species: 'cow', to: 'female', tracks: heldParts(W4, Object.fromEntries(W4.map((t) => [t.key, { p: 100, open: true }]))) } });
    g.doc.state.tf.paths.cow.sex = 'female'; g.doc.settings.pace = 'unbounded'; g.doc.state.present = [];
    const h = await bootOn(g.store);
    try {
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; });
      const tf = () => onlyAdv(h.mock.store).data.state.tf;
      const parts = () => [].concat(TR.species.cow.map((t) => ({ t, r: tf().prog.cow.tracks[t.key], id: 'cow ' + t.name })), W4.map((t) => ({ t, r: tf().sexprog.tracks[t.key], id: 'way over ' + t.name })));
      for (let i = 0; i < 8; i++) {
        const before = parts(), open = before.filter(({ t, r }) => r.told > 0 && r.told < t.stages.length).length, was = Object.fromEntries(before.map((x) => [x.id, x.r.told]));
        assert(await h.turn('I get on with the day.'), 'turn ' + (i + 1));
        const begun = parts().filter(({ t, r, id }) => was[id] === 0 && r.told > 0 && !(t.needs && t.needs.length)).map((x) => x.id);
        if (open >= 4) assert.deepEqual(begun, [], 'with ' + open + ' parts under way, none begins (turn ' + (i + 1) + '): ' + JSON.stringify(storedTurns(h.mock.store, g.id).at(-1).notes));
      }
      clean(h);
    } finally { h.close(); }
  },

  // A waypoint's note says how it is lived: one new thing, met mid-action and never foretold, told in the order it happens with
  // what the body does (from the world's sensation vocabulary), felt in pain or pleasure or both, and nothing else on the body new.
  // The licences to invent between waypoints ("keeps changing by degrees", "found in passing (a shoe, a sock...)") are gone.
  async noteIsLived() {
    const g = await tfGame(14);
    try {
      const notes = g.prompts.flatMap((p) => p.match(/Note from the engine: (?:A new part begins|The change continues|The change completes a part|A change is beginning) \(bovine[^\n]*/g) || []);
      assert(notes.length >= 10, 'notes reached the narrator: ' + notes.length);
      const felt = loadWorld().transformation.felt || {}, clauses = Object.values(felt).filter((e) => typeof e === 'object').flatMap((e) => [].concat(e.on || [], e.mid || [], e.end || []));
      for (const n of notes) {
        assert.doesNotMatch(n, /keeps changing by degrees|found in passing|a shoe, a sock|in a sentence or two/, 'no licence to change a part between waypoints or to make it a footnote: ' + n.slice(0, 200));
        assert.match(n, /mid-action/, 'it is met in the middle of an action: ' + n.slice(0, 200));
        assert.match(n, /in pain or pleasure or both|Only the first sensation/, 'the sensation is asked for: ' + n.slice(0, 200));
        assert.match(n, /Nothing else on the body is new|nobody else notices/, 'one new thing only: ' + n.slice(0, 200));
        assert(clauses.some((c) => n.includes(c)), 'the note carries what the body does, from the world\'s vocabulary: ' + n.slice(0, 300));
      }
      assert(notes.some((n) => /^Note from the engine: A new part begins \(bovine mythkin\): [^\n]*never foretold or pointed out by anyone first/.test(n)), 'a part\'s first waypoint is a new part, not "the change continues"');
      const block = g.prompts.at(-1); assert.match(block, /One part is new a turn; every other part stays as it stands, felt \(an ache, an itch, a pull\) and, where it shows, seen as it is, until a note from the engine moves it/, 'the block says earlier parts stay as they stand, felt and seen as they are');
      assert.doesNotMatch(block, /only felt/, 'and does not keep the narrator from showing a part already told');
      assert.match(block, /found by \S+ mid-action in a way of your own each time\./, 'and each find is made a new way, not the same one again');
      const firstNote = notes.find((n) => /^Note from the engine: A change is beginning/.test(n)); assert(firstNote, 'the first-ever note reached the narrator');
      assert.doesNotMatch(firstNote, /\bsight\b/, 'the first-ever note, where nothing shows yet, asks for no find by sight: ' + firstNote);
      assert.doesNotMatch(block, /between waypoints the part keeps changing by degrees/, 'and no longer says they keep changing');
      clean(g.h);
    } finally { g.h.close(); }
  },

  // The turn that completes a part gets the room the length line promises ("give it room", the wider band); a small step does not,
  // and the length line's sentences are stopped before the next one starts.
  async completionGetsRoom() {
    const g = await tfGame(22);
    try {
      const done = g.prompts.find((p) => /Note from the engine: The change completes a part \(/.test(p)), step = g.prompts.find((p) => /Note from the engine: The change continues \(/.test(p) && !/The change completes a part \(/.test(p));
      assert(done && step, 'a completion and a plain step reached the narrator');
      const len = (p) => { const a = p.slice(p.lastIndexOf('<action>')); return [(/Narrative length: [^\n]*/.exec(a) || [''])[0], lengthTop(a)]; };
      assert.match(len(done)[0], /a change is under way; give it room/, 'the completion turn is told to give it room: ' + len(done)[0].slice(0, 200));
      assert(+len(done)[1] > +len(step)[1], 'and gets a wider band than a small step: ' + len(done)[1] + ' vs ' + len(step)[1]);
      assert.doesNotMatch(len(step)[0], /give it room/, 'a small step gets no extra room');
      assert.doesNotMatch(len(step)[0], /[a-z\)] If romance/, 'the length line stops one sentence before the next: ' + len(step)[0].slice(0, 300));
    } finally { g.h.close(); }
  },

  // A part the engine note gives is not said twice: Body now points at the note, so the waypoint's line is in the prompt once.
  async bodyNowNotRepeated() {
    const g = await tfGame(9);
    try {
      const p = g.prompts.at(-1), tb = p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>')), note = (p.match(/Note from the engine: [^\n]*/g) || []).find((n) => /waypoint \d+ of \d+/.test(n));
      const m = /([A-Z][^():]*?) \((?:[^()]*, )?waypoint (\d+) of (\d+)\): (.{30})/.exec(note || ''); assert(m, 'the note carries its fact: ' + note);
      assert.match(tb, new RegExp(m[1] + ' \\(' + (m[2] === m[3] ? 'finished' : m[2] + ' of ' + m[3]) + '\\): in the note from the engine'), 'Body now points the announced part at the note');
      assert(!tb.includes(m[4]), 'its line is not also in Body now: ' + m[4]);
    } finally { g.h.close(); }
  },

  // A waypoint of the way over the engine note gives is not said twice either: its line under the way over points at the note.
  async sexWaypointNotRepeated() {
    const TR = loadWorld().transformation.tracks, W4 = TR.woman, n = W4.find((t) => t.key === 'chest').stages.length;
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    g.doc.state.tf = Object.assign(baseTf('cow', 60, { lean: 0, face: 15, tracks: heldParts(TR.species.cow, { ears: { told: 1 } }) }),
      { sexprog: { species: 'cow', to: 'female', tracks: heldParts(W4, { chest: { told: 1, p: stageAt(2, n), open: true }, voice: { told: 1 } }) } });
    g.doc.state.tf.paths.cow.sex = 'female';
    const h = await bootOn(g.store);
    try {
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; });
      assert(await h.turn('I look around the room.'));
      assert(await h.turn('I sit at the desk.'));
      const p = promptOf(lastTurn(h)), tb = blockOf(p, 'transformation');
      const m = new RegExp('Chest \\(waypoint 2 of ' + n + '\\): (.{30})').exec((p.match(/Note from the engine: Alongside [^\n]*/) || [''])[0]);
      assert(m, 'the note carries Chest\'s second waypoint: ' + (p.match(/Note from the engine: Alongside [^\n]{0,300}/) || ['none'])[0]);
      const line = (tb.match(/Toward a woman's body so far[^\n]*/) || [''])[0];
      assert(line.includes('Chest (2 of ' + n + '): in the note from the engine'), 'the way over points the announced part at the note: ' + line);
      assert(!tb.includes(m[1]), 'its line is not also under the way over: ' + m[1]);
      assert.match(line, /Voice \(1 of \d\): (?!in the note)/, 'a part the note does not carry keeps its line: ' + line);
      clean(h);
    } finally { h.close(); }
  },

  // Fur is told as it grows: a covering's first waypoint is felt (itch, prickle) with the hairs coming through, its last says where
  // it stops and how it feels to touch with and against the lie; the bovine coat vocabulary covers every bovine track, and every clause
  // is a bodily event, never how the person feels about it.
  async coatsAreFelt() {
    const W = loadWorld(), M = W.transformation.tracks.species, F = W.transformation.felt;
    for (const key of ['forearm_coat', 'leg_and_hip_coat']) {
      const t = M.cow.find((x) => x.key === key);
      assert.match(t.stages[0], /\b(itch|prickle)\b/i, key + ' begins with a felt onset: ' + t.stages[0]);
      assert.match(t.stages[0], /hair/i, key + ' says the hairs coming in');
      assert.match(t.stages.at(-1), /uneven line/, key + ' says where it stops');
      assert.match(t.stages.at(-1), /with the lie[^.]*warm[^.]*against it/i, key + ' says how it feels stroked with and against the lie: ' + t.stages.at(-1));
    }
    assert(F && F._, 'the world carries transformation.felt with its fallback');
    const look = (k, key) => { let e = F[k + '.' + key] || F[key]; if (typeof e === 'string') e = F[e]; return e; };
    for (const t of M.cow) { const e = look('cow', t.key); assert(e && e.on && e.mid && e.end, 'a bovine track has its own sensations: ' + t.key); }
    for (const side of ['woman', 'man']) for (const t of W.transformation.tracks[side]) assert(F[side + '.' + t.key], side + '.' + t.key + ' has its sensations');
    const judgement = /\b(afraid|scared|frighten\w*|enjoy\w*|love[sd]?|hate[sd]?|proud|ashamed|embarrass\w*|happy|delight\w*|thrill\w*|disgust\w*|panic\w*|worr\w*|glad|sad|pleasant|unpleasant|welcome|want(?:s|ed|ing)?|desire\w*|crave\w*|temper)\b/i;
    for (const [key, e] of Object.entries(F)) {
      if (typeof e === 'string') { assert(F[e], key + ' aliases a real entry'); continue; }
      if (!/\./.test(key)) for (const c of [].concat(...Object.values(e))) assert.doesNotMatch(c, /\b(enlarg\w*|lengthen\w*|forward|broaden\w*|widen\w*)\b/i, 'a shared entry names no shape: ' + key + ': ' + c);
      for (const c of [].concat(...Object.values(e))) { assert(!/[{}]/.test(c) && c.length <= 125, key + ' clause is short and plain: ' + c); assert.doesNotMatch(c, judgement, key + ' says what the body does, never how the person feels: ' + c); }
    }
  },

  // 21b. A middle waypoint's sensation is taken by waypoint, in the order the body goes, not at random from the whole list: the
  // first milk is felt at the waypoint that brings it and at no other, and a part's clauses are told in order and spread to both
  // ends. The generic clauses, which most kinds' parts use, are still drawn. No clause has the body do something the player did
  // not ask for (a run of the stairs, a hand brought to the face, a sleeve lifted, a door opened).
  async feltByWaypoint() {
    const src = fs.readFileSync(HTML, 'utf8'), a = src.indexOf('  function feltOf'), b = src.indexOf('  function trackNote');
    assert(a > 0 && b > a, 'feltOf not found in the page');
    const W = loadWorld(), F = W.transformation.felt, M = W.transformation.tracks.species;
    let draw = 0; const pick = (arr) => arr[(draw++) % arr.length];   // a pick that moves on each call, as a random one may
    const feltOf = new Function('W', 'looksKind', 'fill', 'pick', src.slice(a, b) + '\nreturn feltOf;')(W, () => null, (x) => x, pick);
    const milk = M.cow.find((t) => t.key === 'milk'), n = milk.stages.length, first = milk.stages.findIndex((x) => /first milk/i.test(x)) + 1;
    assert(first > 1 && first < n, 'the milk track brings its first milk at a middle waypoint');
    for (let j = 2; j < n; j++) for (let k = 0; k < 3; k++) {
      const c = feltOf('cow', 'milk', j, n).felt;
      assert.equal(/first drops/.test(c), j === first, 'milk waypoint ' + j + ' of ' + n + ' felt: ' + c);
    }
    // Every part with clauses of its own, of every kind and of the way over: a middle waypoint's clauses all come after the one
    // before's, the first and last clauses are told at the first and last middle waypoints, and every clause is told at one of them.
    const ownFelt = (k, key) => { let e = F[k + '.' + key] || F[key]; if (typeof e === 'string') e = F[e]; return e; };
    const parts = Object.entries(M).flatMap(([k, m]) => m.map((t) => [k, t])).concat(['woman', 'man'].flatMap((side) => W.transformation.tracks[side].map((t) => [side, t])));
    const unreached = []; let checked = 0;
    for (const [k, t] of parts) {
      const e = ownFelt(k, t.key), m = t.stages.length, id = k + '.' + t.key; if (!e || typeof e !== 'object' || !(e.mid || []).length || m < 3) continue;
      checked += 1;
      const got = []; for (let j = 2; j < m; j++) { const at = new Set(); for (let r = 0; r < e.mid.length * 2; r++) at.add(e.mid.indexOf(feltOf(k, t.key, j, m).felt)); got.push([...at].sort((x, y) => x - y)); }
      assert(got.every((x) => x.every((i) => i >= 0)), id + ' tells only its own clauses at a middle waypoint: ' + JSON.stringify(got));
      assert(got.every((x, i) => i === 0 || x[0] >= got[i - 1].at(-1)), id + ' mid clauses in order by waypoint: ' + JSON.stringify(got));
      assert(got[0][0] === 0 && got.at(-1).at(-1) === e.mid.length - 1, id + ' spreads its clauses to both ends: ' + JSON.stringify(got));
      if (e.mid.length >= m - 2) {
        assert(got.every((x, i) => i === 0 || x[0] > got[i - 1].at(-1)), id + ' has clauses of its own at each middle waypoint and repeats none: ' + JSON.stringify(got));
        const told = new Set(got.flat()); if (told.size < e.mid.length) unreached.push(id + ' (' + e.mid.filter((c, i) => !told.has(i)).join(' / ') + ')');
      }
    }
    assert(checked > 100, 'the parts of every kind and of the way over are checked: ' + checked);
    assert.deepEqual(unreached, [], 'mid clauses no waypoint ever tells');
    // The udder's swelling is felt at the waypoint where the mound shows, not the nipples' clause told twice.
    const udder = M.cow.find((t) => t.key === 'teats_and_udder'), mound = udder.stages.findIndex((x) => /firm mound/.test(x)) + 1;
    assert(mound > 2 && mound < udder.stages.length, 'the udder track shows its mound at a later middle waypoint');
    assert.match(feltOf('cow', 'teats_and_udder', mound, udder.stages.length).felt, /low on the belly/, 'the udder waypoint ' + mound + ' is felt as the swelling');
    // A part with no clauses of its own takes the generic ones by draw, so parts at the same step do not all read the same.
    const plain = M.wolf.find((t) => !F['wolf.' + t.key] && !F[t.key] && t.stages.length > 2);
    assert(plain && F._.mid.length > 1, 'a wolf part uses the generic clauses');
    const drawn = new Set(); for (let k = 0; k < F._.mid.length * 2; k++) drawn.add(feltOf('wolf', plain.key, 2, plain.stages.length).felt);
    assert(drawn.size > 1, 'the generic mid clause is drawn, not fixed by waypoint: ' + [...drawn]);
    const acts = /\b(run of the stairs|on the stairs|brought to the face|is lifted|pillow turned|comes open|opens? the door)\b/i;
    for (const [key, e] of Object.entries(F)) if (typeof e === 'object') for (const c of [].concat(...Object.values(e))) assert.doesNotMatch(c, acts, key + ' has the body do what nobody asked: ' + c);
  },

  // 21b. Every part of the body is felt from the moment it starts to change, and felt once: each body track of every kind (all but
  // its ways, which _ways covers) has a felt entry of its own, not the shared "_", whose first-waypoint sensation reaches the note
  // trackNote builds, and each kind's mid options hold a pleasant one as well as the aches. The stage line, sent every turn while the
  // part is under way, stays the fact: the sensations are told once, by the note, not again in every Body block.
  async bodyChangesFelt() {
    const Wd = loadWorld(), TR = Wd.transformation.tracks, F = Wd.transformation.felt, src = fs.readFileSync(HTML, 'utf8');
    const a = src.indexOf('  // What the body does as a waypoint arrives'), b = src.indexOf('  function sexTrackNote');
    assert(a > 0 && b > a, 'feltOf and trackNote not found in the page');
    const looksKind = (W, k) => W.genPools.looks.kinds[k] || null;
    const { trackNote } = new Function('W', 'looksKind', 'trackModel', 'firstName', 'pathFill', 'pathDrawn', 'extentHeld', 'extentText', 'fill', 'pick',
      src.slice(a, b) + '\nreturn { feltOf, trackNote };')(Wd, looksKind, (k) => TR.species[k], () => 'Tom', (tf, k, s) => s, () => '', () => true, () => '', (s) => s, (x) => x[0]);
    const own = (k, key) => { let e = F[k + '.' + key] || F[key]; if (typeof e === 'string') e = F[e]; return e; };
    // The mid clauses a part can actually be told: every draw at each of its middle waypoints.
    let draw = 0; const feltAll = new Function('W', 'looksKind', 'fill', 'pick', src.slice(src.indexOf('  function feltOf'), src.indexOf('  function trackNote')) + '\nreturn feltOf;')(Wd, looksKind, (x) => x, (x) => x[(draw++) % x.length]);
    const reach = (k, t) => { const out = new Set(), n = t.stages.length, e = own(k, t.key); for (let j = 2; j < n; j++) for (let r = 0; r < 2 * (e.mid || []).length; r++) out.add(feltAll(k, t.key, j, n).felt); return [...out].filter(Boolean); };
    const pleasant = /\bgood\b|pleasure|comfort|relief|\bease|soothing|warm and steadying|cool and easy/i;
    const flat = [], unfelt = [], sour = []; let parts = 0;
    for (const [k, m] of Object.entries(TR.species)) {
      const ways = (looksKind(Wd, k) || {}).ways || []; let mids = [];
      for (const t of m) {
        if (ways.includes(t.key)) continue; parts += 1;
        const e = own(k, t.key);
        if (!e || !(e.on || []).length || !(e.mid || []).length || !(e.end || []).length) { flat.push(k + '.' + t.key); continue; }
        mids = mids.concat(reach(k, t));
        const note = trackNote({ influence: {} }, k, t, 1, { tracks: {} }, false);
        if (!note.includes(e.on[0])) unfelt.push(k + '.' + t.key);
      }
      if (m.some((t) => !ways.includes(t.key)) && !mids.some((s) => pleasant.test(s))) sour.push(k);
    }
    assert(parts >= 120, 'the body tracks are all checked: ' + parts);
    assert.deepEqual(flat, [], 'body tracks with no felt entry of their own (on, mid and end)');
    assert.deepEqual(unfelt, [], 'body tracks whose first-waypoint note does not carry their sensation');
    assert.deepEqual(sour, [], 'kinds whose changes under way are all discomfort');
    const eyes = Object.keys(TR.species).map((k) => F[k + '.eyes']).filter(Boolean).flatMap((e) => [].concat(e.on, e.mid));
    assert(eyes.filter((s) => /\bstings?\b/.test(s)).length <= 1, 'the eye lines vary, not a sting for every kind: ' + eyes.filter((s) => /sting/.test(s)).join(' / '));
    // The note carries the stage line and the felt phrase together, so no felt option restates the line it is paired with (on with the
    // first stage, mid with those between, end and touch with the last): no run of four words and no three content words in common,
    // compared by stem so an inflection ("the fingers feeling long" / "The fingers feel long") does not hide a repeat.
    const stop = new Set('a an the and or but of to in on at by for with from as is are was be it its this that these those each every one two any all no not nor more most less than then so if when while into onto out up down over under off through after before about there here what which who whom whose how where again only own same very just too still also new now first last like until some such their them they his her him he she you your our has have had do does did can will would should may might must being been were itself'.split(' '));
    const words = (s) => String(s).toLowerCase().replace(/\{[^}]*\}/g, ' ').match(/[a-z']+/g) || [];
    const stem = (w) => (/..ies$/.test(w) ? w.slice(0, -3) + 'y' : w.replace(/^(.{3,}?)(?:ingly|edly|ing|ed|ly|es|s)$/, '$1')).replace(/^(.{3,})e$/, '$1').replace(/([b-df-hj-np-tv-z])\1$/, '$1');
    const runs = (s) => { const w = words(s).map(stem); return new Set(w.slice(3).map((x, i) => w.slice(i, i + 4).join(' '))); };
    const twice = [];
    const pairUp = (id, e, st) => {
      const n = st.length, opt = (ph) => (e[ph] && e[ph].length ? e[ph] : e.mid) || [], pairs = [];
      for (const o of opt('on')) pairs.push(['on', o, st[0]]);
      for (let j = 2; j < n; j++) for (const o of e.mid || []) pairs.push(['mid', o, st[j - 1]]);
      for (const o of opt('end').concat(e.touch || [])) pairs.push(['end', o, st[n - 1]]);
      for (const [ph, o, s] of pairs) {
        const content = (x) => new Set(words(x).filter((w) => !stop.has(w) && w.length > 2).map(stem)), cs = content(s), shared = [...content(o)].filter((w) => cs.has(w));
        const rs = runs(s), run = [...runs(o)].find((g) => rs.has(g));
        if (shared.length >= 3 || run) twice.push(id + ' ' + ph + ': "' + o + '" / "' + s + '"');
      }
    };
    for (const [k, m] of Object.entries(TR.species)) for (const t of m) { const ways = (looksKind(Wd, k) || {}).ways || []; pairUp(k + '.' + t.key, own(k, t.key) || (ways.includes(t.key) && F._ways) || F._, t.stages); }
    for (const side of ['woman', 'man']) for (const t of TR[side]) pairUp(side + '.' + t.key, own(side, t.key) || F._, t.stages);
    assert.deepEqual(twice, [], 'felt options that restate the stage line they share a note with');
  },

  // 21c. The world data agrees with itself. Every hand row keeps the hand the lore pins (a bovine hand is two hooved fingers and a
  // hooved thumb, a harpy's a thumb and two clawed fingers), the lore leaves room for what the ranges draw (a wolf's muzzle, a cat's
  // two to four further pairs), the hand the kitsune shares with the werewolf names no build, and no backstory gives a kind what it
  // lacks. The lore says what the milk track implies; a fox's magic is fire, not glamour, and brewing is water and earth work; the
  // ferry, the mer tail, the choir lead, the course count and the shoes agree with the rest of the file; every hope reads after
  // "hopes, in time, for"; no close-up line hands over a phrase the narration repeated; a kind's lore entry stays short enough to
  // share the shed budget with one other kind's, and its keys are its own (a chimera's horns never pull in the bovine lore).
  async worldDataAgrees() {
    const Wd = loadWorld(), TR = Wd.transformation.tracks, byKey = (k, key) => TR.species[k].find((t) => t.key === key);
    const lore = (k) => Wd.lore.find((l) => l.species === k);
    for (const row of Object.values(byKey('cow', 'hands').range)) assert.match(row, /^Two (?:\w+ )*fingers and a (?:\w+ )*thumb/, 'every bovine hand row is two fingers and a thumb: ' + row);
    for (const row of Object.values(byKey('harpy', 'hands').range)) assert.match(row, /^A thumb and two (?:\w+ )*clawed fingers/, 'every harpy hand row is a thumb and two clawed fingers: ' + row);
    assert.match(lore('cow').text, /hands of two hooved fingers and a hooved thumb/); assert.match(lore('harpy').text, /a thumb and two clawed fingers/);
    if (/muzzle/.test(JSON.stringify(byKey('wolf', 'nose_and_face').range))) assert.doesNotMatch(lore('wolf').text, /human-faced/, 'the wolf lore leaves room for the muzzle the face range draws');
    const pairs = byKey('cat', 'further_pairs').range; if (pairs.least !== pairs.most) assert.doesNotMatch(lore('cat').text, /has three more pairs/, 'the cat lore leaves room for the pairs the range draws');
    const shared = byKey('fox', 'hands').stages.at(-1); assert.doesNotMatch(shared, /strong|blunt/, 'the hand the kitsune shares with the werewolf names no build: ' + shared);
    const bgs = Wd.creation.backgrounds.map((b) => b.text).join(' '); assert.doesNotMatch(bgs, /second row of teeth|gills[^.;]*throat/, 'no backstory gives a kind what it lacks');
    assert.match(lore('cow').text, /Bovine men have no udder and no milk/);
    assert.match(lore('cow').text, /none of it is expected, and each offers and welcomes what they choose/, 'the bovine lore says touch and milk are offered, not expected');
    // The world rule that a bovine woman in milk lets it down when aroused is in the stage line that brings the milk, the last stage,
    // the lore and the felt line, so the narration has it without being asked; none of them decides that she is aroused.
    const milkT = byKey('cow', 'milk'), F2 = Wd.transformation.felt['cow.milk'];
    assert.match(milkT.stages.find((x) => /first milk/i.test(x)), /\barousal\b/, 'the first-milk stage names arousal among what lets the milk down');
    assert.match(milkT.stages[milkT.stages.length - 1], /\barousal\b/, 'the in-milk stage names arousal as a let-down');
    assert.match(lore('cow').text, /in milk, which arousal lets down/, 'the bovine lore says arousal lets the milk down');
    assert(F2 && F2.end.some((x) => /\baroused\b/.test(x)), 'the milk track\'s end is felt at arousal too');
    assert(!/\b(she|the player|{first}) (is|gets|grows) aroused\b/.test(JSON.stringify(milkT.stages) + lore('cow').text), 'nothing decides that she is aroused');
    assert.doesNotMatch(JSON.stringify(byKey('fox', 'guile')), /glamour/i, 'a fox\'s guile is not glamour (fire is its element)');
    assert.doesNotMatch(Wd.skills.alchemy.text, /Dryads/, 'brewing is water and earth work'); assert.match(Wd.skills.alchemy.text, /bovine and rabbit/);
    const ev = Wd.memorySeed.events, at = (re) => { const m = ev.find((e) => re.test(e)).match(/Day 1 (\d\d):(\d\d)/); return Number(m[1]) * 60 + Number(m[2]); };
    assert.equal(at(/lands/) - at(/boards/), 60, 'the crossing takes an hour'); assert.equal(at(/lands/), 17 * 60, 'and comes in at seventeen bells');
    assert.doesNotMatch(ev.find((e) => /boards/.test(e)), /Sallow Pier/, 'the ferry is boarded on the coast; Sallow Pier is where it comes in');
    assert.doesNotMatch(lore('mer').text, /in the lake, and only there/, 'the mer tail comes in any deep water, as the tail track says');
    assert.doesNotMatch(Wd.minorRoles.find((r) => r.key === 'choir_lead').text, /roost-sister/, 'the choir person may be no harpy');
    assert.doesNotMatch(JSON.stringify(Wd.lore), /one ordinary course/, 'the lore counts two ordinary courses everywhere');
    for (const k of ['rabbit', 'goblin', 'dryad']) assert.match(Wd.genPools.looks.kinds[k].dress.all.join(' '), /shoes|feet go bare/, k + ' feet rule out ordinary shoes in the dress lines');
    for (const k of Object.keys(TR.species).filter((x) => TR.species[x].some((t) => /^leg_and_hip_(?:coat|pelt)$/.test(t.key)))) assert(Wd.genPools.looks.kinds[k].dress.all.includes('a coated kind runs warm and dresses lightly'), k + ' is a coated kind and dresses lightly');
    const hopes = Object.entries(Wd.genPools.species).map(([k, s]) => [k, s.hope]).concat(Wd.castRoles.map((r) => [r.key, r.hope])).filter(([, h]) => h);
    for (const [k, h] of hopes) assert.doesNotMatch(h, /^to |^\{first\} |\{first\}.*\{first\}/, k + ' hope reads after "hopes, in time, for" and names the player once: ' + h);
    for (const r of Wd.castRoles) for (const v of r.variants || []) if (v.stopped) assert.doesNotMatch(v.stopped, /^down\b/, 'reads after "stopped at": ' + v.stopped);
    const tics = /\bunhurried|\bthe low notes? |sweet[- ]grass|does not shift|let go of last|felt in the breastbone|hum in the breastbone/i;
    for (const [k, s] of Object.entries(Wd.genPools.species)) for (const line of s.senses || []) assert.doesNotMatch(line, tics, k + ' close-up line hands over a phrase the narration repeated: ' + line);
    assert.doesNotMatch(byKey('cow', 'voice').endsAs, /hum/, 'nor the bovine voice line');
    const told = Object.entries(TR.species).flatMap(([k, m]) => m.map((t) => [k + '.' + t.key, t])).concat(TR.woman.map((t) => ['woman.' + t.key, t]), TR.man.map((t) => ['man.' + t.key, t]));
    for (const [id, t] of told) for (const s of t.stages.concat(t.endsAs || [])) assert.doesNotMatch(s, tics, id + ' hands over a phrase the narration repeated: ' + s);
    for (const [id, e] of Object.entries(Wd.transformation.felt)) assert.doesNotMatch(JSON.stringify(e), tics, 'felt ' + id + ' hands over a phrase the narration repeated');
    assert.doesNotMatch(JSON.stringify(byKey('mer', 'voice')), /quiets a room/, 'the mer voice\'s consent line names the power it describes');
    const kinds = Wd.lore.filter((l) => l.species);
    for (const l of kinds) assert(l.text.length <= 800, l.species + ' lore is ' + l.text.length + ' characters: with the kind changing the player it must fit the shed budget');
    // As the page reads a lore key: a trailing * takes any ending, and a plain key its plural too (hoof and hooves).
    const word = (k, s) => (k.endsWith('*') ? new RegExp('\\b' + k.slice(0, -1) + '\\w*', 'i') : new RegExp('\\b' + k.replace(/y$/, '(?:y|ie)').replace(/f$/, '(?:f|ve)') + '(?:e?s)?\\b', 'i')).test(s);
    // A key that names a part of the body pulls the kind's lore into any scene that names that part, so no other kind may have it.
    const parts = /^(?:udder|teat|hoof|hooves|horns?|talon|fluke|bark|whisker)\*?$/i;
    for (const l of kinds) for (const key of l.keys.filter((x) => parts.test(x))) for (const [k2, s] of Object.entries(Wd.genPools.species)) if (k2 !== l.species) assert(!word(key, JSON.stringify([s.body || [], Wd.genPools.looks.kinds[k2] || {}])), l.species + ' lore key "' + key + '" names a part of the ' + k2 + ' body, so a ' + k2 + ' scene would pull in the ' + l.species + ' lore');
  },

  // 21d. The world's lines leave the player's side to the player. A season, a flowering or a rhythm says what the body does, not
  // what it wants; no stage line names "the player" or a stand-in for it; a mer's voice does not soften people; third-person pool
  // and lore lines say no "you"; and no bond line decides what the player does.
  async worldLeavesPlayerSide() {
    const Wd = loadWorld(), TR = Wd.transformation.tracks;
    const lists = Object.entries(TR.species).flatMap(([k, m]) => m.map((t) => [k, t])).concat(TR.woman.map((t) => ['woman', t]), TR.man.map((t) => ['man', t]));
    for (const [k, t] of lists) {
      const text = t.stages.concat([t.endsAs || '']).join(' ');
      assert.doesNotMatch(text, /the player|bearer|one who carries/, k + ' ' + t.key + ' names no engine word for the player');
      assert.doesNotMatch(text, /\bwanting\b(?! warm and sweet)|wants? contact|most of thought|no wish for it|softens them|draws people nearer|hard to stop listening|Curiosity pulls/, k + ' ' + t.key + ' leaves the wanting to the player: ' + text.slice(0, 160));
    }
    const P = Wd.genPools, third = [P.species.cat.where.night].concat(P.greetings, ...Object.values(P.species).map((s) => s.hello || []));
    for (const s of third) assert.doesNotMatch(s, /\byou(?:r)?\b/i, 'a third-person pool line says no "you": ' + s);
    for (const k of ['harpy', 'goblin']) assert.doesNotMatch(Wd.lore.find((l) => l.species === k).text, /\byou\b/i, k + ' lore says no "you"');
    assert.doesNotMatch(JSON.stringify(TR.bond), /You can do the same|a thing you do/, 'no bond line decides what the player does');
  },

  // 21e. A stage line is plain words the narrator can reuse: none says how the engine draws the body ("as far as the draw sets",
  // "at the drawn length", "At the standard"), since the engine adds how far a part goes on this body at its last waypoint.
  async stageLinesPlain() {
    const TR = loadWorld().transformation.tracks, engine = /draw sets|the drawn \w+|the draw allows|wherever the draw|at the standard\b/i;
    const hits = [];
    for (const [k, m] of Object.entries(TR.species)) for (const t of m) for (const s of t.stages.concat(t.endsAs || [])) if (engine.test(s)) hits.push(k + '.' + t.key + ': ' + s.match(engine)[0]);
    for (const side of ['woman', 'man']) for (const t of TR[side]) for (const s of t.stages) if (engine.test(s)) hits.push(side + '.' + t.key);
    assert.deepEqual(hits, [], 'stage lines that speak the engine\'s words');
  },

  // 21f. A saved game keeps the close-up lines its people were drawn with, so a line the world has since rewritten reaches an old
  // save only by its migration: a bovine roommate saved with the two lines whose phrases the narration repeated every turn ("a low
  // unhurried voice ... sweet grass", "does not shift ... let go of last") loads with them as the world has them now, and the turn
  // prompt carries neither. So do the hand rows the lore has since pinned: the roommate saved with a bovine hand of four hoof-tipped
  // fingers (or two heavy hooved digits) and a harpy edited in the Cast with four clawed fingers (or one strong one) load with two
  // fingers and a thumb, case and all, in the looks, the generated record and the Cast edit alike.
  async oldSensesMigrated() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' }); let store;
    try { assert(await first.turn('I unpack.')); store = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = store.get(key).data;
    const old = 'a steady warm weight that does not shift when leaned on; a hug from her comes slowly, holds, and is let go of last; a low unhurried voice that carries across a room without rising; when she leans in, the breath smells of sweet grass';
    doc.roommate.senses = old; if (doc.roommate.gen) doc.roommate.gen.senses = old;
    doc.roommate.looks = String(doc.roommate.looks || '') + ' Hands: four fingers, each tipped with a small hoof.';
    doc.roommate.gen = Object.assign(doc.roommate.gen || {}, { looks: 'Hands: Two heavy digits hooved to the first joint; still hands that grip and hold.' });
    doc.cast = doc.cast || {}; doc.cast.overrides = Object.assign(doc.cast.overrides || {}, { choir_lead: { looks: 'Hands: Four clawed fingers at each wrist. When she lands: a thumb and one strong clawed finger take the rail.' } });
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 8000), 'the older save did not load'); await h.idle(10000); await h.settle(100, 4000);
      assert(await h.turn('I sit beside Daisy.'), 'a turn on the older save');
      const rm = onlyAdv(h.mock.store).data.roommate, tics = /unhurried|sweet grass|does not shift|let go of last/;
      assert.doesNotMatch(rm.senses, tics, 'the stored close-up line reads as the world has it now: ' + rm.senses);
      assert.match(rm.senses, /a low voice that carries across a room without rising/, 'and keeps what it still says');
      if (rm.gen) assert.doesNotMatch(String(rm.gen.senses || ''), tics, 'the generated record follows it');
      assert.doesNotMatch(promptOf(lastTurn(h)), tics, 'the turn prompt carries neither phrase');
      const oldHands = /four fingers, each tipped|two heavy digits|four clawed fingers|one strong clawed finger/i, cast = onlyAdv(h.mock.store).data.cast.overrides.choir_lead;
      assert.match(rm.looks, /Hands: two fingers and a thumb, each ending in a small thin hoof\./, 'the stored bovine hand reads as the lore has it: ' + rm.looks);
      assert.match(rm.gen.looks, /^Hands: Two heavy fingers and a thumb, all hooved to the first joint; still hands/, 'the generated record follows it, its capital kept');
      assert.equal(cast.looks, 'Hands: A thumb and two short clawed fingers at each wrist. When she lands: a thumb and two strong clawed fingers, the claws long and curved take the rail.', 'and so does the Cast edit');
      assert.doesNotMatch(promptOf(lastTurn(h)), oldHands, 'the turn prompt carries no old hand row');
    } finally { h.close(); }
  },

  // 22. The narrator keeps no Discoveries list (it capped at twelve, dropped the oldest finds first, and held changes the engine never
  // announced): the engine knows every waypoint told. Condition is how the body feels now, short and replaced each turn, and a
  // discovery the narrator still sends is ignored with a note, not stored.
  async noDiscoveriesList() {
    const W = loadWorld(); assert(!W.trackedItems.some((d) => d.key === 'discoveries'), 'no Discoveries item');
    const cond = W.trackedItems.find((d) => d.key === 'condition'); assert(cond && cond.maxChars <= 140, 'Condition is short: ' + (cond && cond.maxChars));
    const g = await tfGame(4, (r) => { r.state_updates = (r.state_updates || []).concat([{ key: 'items.discoveries', op: 'append', value: 'a coarse prickle of new hair on each wrist' }]); });
    try {
      const p = g.prompts.at(-1), at = p.indexOf('<state note='), state = at < 0 ? '' : p.slice(at, p.indexOf('</state>', at));
      assert(state.length > 200, 'the state block was found');
      assert.doesNotMatch(state, /discoveries/i, 'the state sent to the narrator has no Discoveries');
      assert.match(p, /items\.condition: how the body feels now, replaced each turn; body changes are the engine's/, 'the reply contract says what Condition is');
      assert(!('discoveries' in onlyAdv(g.store).data.state.items) || !onlyAdv(g.store).data.state.items.discoveries.length, 'nothing is stored as a discovery');
      assert(storedTurns(g.store, g.id).at(-1).notes.some((n) => /^ignored unknown item "discoveries"/.test(n)), 'and the engine notes it ignored one');
    } finally { g.h.close(); }
  },

  // A scene that runs over several turns is one contact: at the unbounded pace (no day cap) eight five-minute turns of the same
  // intimate contact add what one forty-minute contact would, not eight whole contacts; a contact three hours later counts whole
  // again, and a single touch (intensity 1) is never shortened.
  async continuingContact() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      const store = h.mock.store;
      h.click('#btnSettings'); h.$('#setPace').value = 'unbounded'; h.$('#setPace').dispatchEvent(new h.window.Event('change')); assert(await h.idle(8000)); h.click('[data-close="dlgSettings"]');
      const inf = () => onlyAdv(store).data.state.tf.influence.cow || 0;
      let advance = 5, level = 3;
      patchTurns(h, (r) => { r.time_advance_minutes = advance; r.exposures = [{ species: 'cow', method: 'kissing Daisy', intensity: level }]; });
      for (let i = 0; i < 8; i++) assert(await h.turn('I keep kissing Daisy.'));
      const scene = inf(); assert(scene >= 12 && scene <= 30, 'eight five-minute turns of one scene count about as one contact: ' + scene);
      advance = 180; patchTurns(h, (r) => { r.time_advance_minutes = advance; r.exposures = []; }); assert(await h.turn('I go for a long walk.'));
      advance = 5; patchTurns(h, (r) => { r.time_advance_minutes = advance; r.exposures = [{ species: 'cow', method: 'kissing Daisy', intensity: level }]; });
      const before = inf(); assert(await h.turn('I kiss Daisy again.'));
      assert(inf() - before >= 12, 'a contact hours later counts whole: +' + (inf() - before));
      level = 1; const b2 = inf(); assert(await h.turn('I hug Daisy.'));
      assert(inf() - b2 >= 4, 'a single touch counts whole even straight after: +' + (inf() - b2));
      clean(h);
    } finally { h.close(); }
  },

  // A man whose bovine path does not go over to a woman's body never opens the women's parts (the udder, the milk); the block says
  // so once a change has begun, so the narrator does not supply breast tissue or milk the engine never gave this body.
  async closedPartsSaid() {
    const g = await tfGame(6);
    try {
      assert.equal(g.tf().paths.cow.sex == null, true, 'the path does not go over');
      const p = g.prompts.at(-1), tb = p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>'));
      assert.match(tb, /Not on \S+'s body, whatever others have \(\S+'s path does not go there; never give \S+ them\): teats and udder, milk\./, 'the closed parts are named, to the player: ' + (tb.match(/Not on this body[^\n]*/) || ['none'])[0]);
      assert.doesNotMatch(g.prompts[0].slice(g.prompts[0].indexOf('<transformation>'), g.prompts[0].indexOf('</transformation>')), /whatever others have/, 'and not before any change has begun');
    } finally { g.h.close(); }
  },

  // A part this body does not have never holds back what stands on it: a rabbit woman whose draw gives no belly fur still grows
  // the further pairs that wait on the belly fur, and the belly fur is never told.
  async nonePartDoesNotBlock() {
    const T = loadWorld().transformation.tracks.species.rabbit;
    const { h, id } = await seededTf({ rmSpecies: 'rabbit', rmName: 'Clover Dell', gender: 'female', name: 'Ana Reyes' }, () => baseTf('rabbit', 100, { lean: -1, face: 15, tracks: heldParts(T, { leg_and_hip_coat: { told: 'done', ext: 0 }, further_pairs: { open: true } }) }), { pace: 'unbounded' });
    try {
      patchTurns(h, (r) => { r.time_advance_minutes = 15; r.exposures = []; });
      for (let i = 0; i < 4; i++) assert(await h.turn('I get on with the day.'));
      const tr = onlyAdv(h.mock.store).data.state.tf.prog.rabbit.tracks;
      assert(tr.further_pairs.told >= 1, 'the further pairs begin though there is no belly fur: ' + JSON.stringify(tr.further_pairs));
      assert.equal(tr.belly_fur.told, 0, 'and the belly fur, none on this body, is never told');
      assert.equal(onlyAdv(h.mock.store).id, id);
      clean(h);
    } finally { h.close(); }
  },

  // The body easing back after a quiet day never takes a part out from under one that stands on it: the stance stands on the toes
  // at their second waypoint, so the stance eases first and the toes stay.
  async easeKeepsWhatIsStoodOn() {
    const T = loadWorld().transformation.tracks.species.cow;
    const { h, id } = await seededTf({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' }, () => baseTf('cow', 40, { lean: 0, face: 15, tracks: heldParts(T, { toes_and_hooves: { told: 2, open: true, nextAt: 500, s: 45, e: 60 }, feet_and_stance: { told: 1, open: true, nextAt: 100, s: 45, e: 60 } }) }), { pace: 'standard' });
    try {
      patchTurns(h, (r) => { r.time_advance_minutes = 1500; r.exposures = []; });
      assert(await h.turn('A quiet day passes.'));
      const tr = onlyAdv(h.mock.store).data.state.tf.prog.cow.tracks;
      assert(tr.toes_and_hooves.told >= 2 || tr.feet_and_stance.told === 0, 'the stance stands on the toes: ' + JSON.stringify([tr.toes_and_hooves.told, tr.feet_and_stance.told]));
      assert(storedTurns(h.mock.store, id).at(-1).notes.some((n) => /change easing/.test(n)), 'and something did ease: the stance went first');
      clean(h);
    } finally { h.close(); }
  },

  // What the player and narrator are told about influence is true of the track model: parts begin anywhere from 12 to 50, not
  // "at about 12 to 15"; an intimate contact doubles the standard day (so not "ten days at the least"); uncapped still tells one a turn.
  async influenceNotesTrue() {
    const W = loadWorld(); assert.doesNotMatch(W.transformation.thresholdsNote, /12 to 15/, 'the note does not promise the first changes at 12 to 15: ' + W.transformation.thresholdsNote);
    assert.match(W.transformation.thresholdsNote, /own track/, 'it still says each part runs on its own track');
    const html = fs.readFileSync(HTML, 'utf8'), sel = html.slice(html.indexOf('<select id="setPace">'), html.indexOf('</select>', html.indexOf('<select id="setPace">'))), pace = (v) => (new RegExp('<option value="' + v + '"[^>]*>([^<]*)<').exec(sel) || [])[1] || '';
    assert.doesNotMatch(pace('standard'), /ten days at the least/, 'the standard label does not promise ten days: ' + pace('standard'));
    // The options stay short; the note under the box (built from the engine's own tables) says what each pace does.
    const note = html.slice(html.indexOf("$('#setPaceNote').textContent"), html.indexOf("$('#setDensityNote')"));
    assert.match(note, /influence a story day \(' \+ day \* 2 \+ ' on the most intimate contact\)/, 'the note says an intimate contact doubles the day');
    assert.match(note, /No daily limit .*A new step can be told every turn/, 'the uncapped note says what it does');
  },

  // Sundered Isle is the only world. The creation screen offers no world picker and creates in Sundered. A newer save from a
  // world no longer in the game (Mythaven) is passed over quietly at boot, also when this device's pointer names it: the
  // older Sundered save opens with a plain welcome, and Adventures lists the Mythaven save as no longer in this game, with
  // Continue disabled.
  async sunderedOnly() {
    // (a) No picker; the new adventure is a Sundered one.
    const a = await boot({});
    let store;
    try {
      assert(await a.settle(150, 6000), 'boot did not settle');
      assert(a.$('#dlgCreate').open, 'creation opens on an empty store');
      assert(a.$('#newWorld').hidden, 'the world picker must be hidden when there is only one world');
      assert.deepEqual([...a.$('#newWorld').options].map((o) => o.value), ['sundered'], 'Sundered Isle is the only world on offer');
      a.click('#cBegin'); assert(await a.idle(30000), 'creating the adventure did not finish'); await a.settle(150, 6000);
      assert.equal(onlyAdv(a.mock.store).data.worldId, 'sundered', 'the new adventure must be a Sundered one');
      assert(await a.turn('I look around.'));
      clean(a);
      store = new Map([...a.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    } finally { a.close(); }
    const sunId = onlyAdv(store).id;
    // A newer save from Mythaven: the Sundered save's records under another id and world.
    const oldId = 'advmythaven01';
    for (const [k, v] of [...store]) {
      if (!k.startsWith('adventures/' + sunId)) continue;
      const c = JSON.parse(JSON.stringify(v)); const nk = k.replace('adventures/' + sunId, 'adventures/' + oldId);
      if (nk === 'adventures/' + oldId) { c.data.id = oldId; c.data.worldId = 'mythaven'; c.data.title = 'The Mythaven game'; c.data.updatedAt = new Date(Date.parse(c.data.updatedAt) + 60000).toISOString(); }
      store.set(nk, c);
    }
    assert(store.get('adventures/' + oldId).data.updatedAt > store.get('adventures/' + sunId).data.updatedAt, 'the Mythaven save must be the newer one');
    const copyStore = () => new Map([...store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    // (b) by recency alone, (c) with this device's pointer naming the Mythaven save.
    for (const pointer of [null, oldId]) {
      const label = pointer ? '(pointer names the Mythaven save) ' : '';
      const h = await boot({ setup(w, m) { m.store = copyStore(); if (pointer) w.localStorage.setItem('windlass.last', pointer); } });
      try {
        assert(await h.settle(150, 8000), label + 'boot did not settle'); await h.idle(10000); await h.settle(100, 4000);
        assert(!h.$('#dlgCreate').open, label + 'the Sundered save must open, not the creation screen');
        assert.equal(h.window.localStorage.getItem('windlass.last'), sunId, label + 'the Sundered save must be the one opened');
        assert.match(statusText(h), /^Welcome back\./, label + 'a normal welcome: ' + statusText(h));
        assert.doesNotMatch(statusText(h), /could not be opened|could not be loaded/, label + 'the retired save is not a failure: ' + statusText(h));
        assert(!h.$('#status').classList.contains('bad'), label + 'no error status');
        assert.doesNotMatch(h.$('#summaryNote').textContent, /could not/, label + 'the save note reports no failure: ' + h.$('#summaryNote').textContent);
        h.click('#btnAdventures'); await h.settle(100, 4000);
        const rows = [...h.document.querySelectorAll('#advlist .advrow')];
        const row = rows.find((r) => /The Mythaven game/.test(r.textContent));
        assert(row, label + 'the Mythaven save stays listed in Adventures: ' + rows.map((r) => r.textContent).join(' | '));
        assert.match(row.textContent, /no longer in this game/, label + 'the Mythaven save is marked as from a world no longer in this game: ' + row.textContent);
        assert(row.querySelector('[data-act="open"]').disabled, label + 'Continue is disabled for the Mythaven save');
        const sunRow = rows.find((r) => r !== row);
        assert(sunRow && !/no longer in this game/.test(sunRow.textContent), label + 'the Sundered save is listed normally');
        clean(h);
      } finally { h.close(); }
    }
    // (d) Fifty newer saves from a removed world fill the first page of the save list: the older Sundered save still opens.
    const big = copyStore(); const base = Date.parse(store.get('adventures/' + sunId).data.updatedAt);
    for (let i = 0; i < 50; i++) { const id = 'advretired' + String(i).padStart(2, '0'); const c = JSON.parse(JSON.stringify(store.get('adventures/' + oldId))); c.data.id = id; c.data.updatedAt = new Date(base + 120000 + i * 1000).toISOString(); big.set('adventures/' + id, c); }
    const hd = await boot({ setup(w, m) { m.store = big; } });
    try {
      assert(await hd.settle(150, 8000), '(fifty retired) boot did not settle'); await hd.idle(10000); await hd.settle(100, 4000);
      assert(!hd.$('#dlgCreate').open, '(fifty retired) the Sundered save must open, not the creation screen');
      assert.equal(hd.window.localStorage.getItem('windlass.last'), sunId, '(fifty retired) the Sundered save must be the one opened');
      clean(hd);
    } finally { hd.close(); }
  },

  // The memory fold gets each beat with the day and time of its turn (the beats carry none), the opening's beat included, in
  // the order the memory holds them; it is asked for days by number and a limit it cannot creep past. After the fold the prompt's
  // <earlier_turns> holds exactly the beats the summary does not, each read as its own sentence, and none the summary already has.
  async memoryFoldStamps() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      let n = 0; const folds = [];
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'memory fold') folds.push(promptOf({ input }));
        const out = h.mock.defaultHandler(input, o, call);
        if (!/^turn/.test(call.label)) return out;
        const r = JSON.parse(out); n += 1; r.beats = [1, 2, 3].map((k) => 'Marker B' + n + 'x' + k + ' Daisy kept the kettle on' + (k === 2 ? '' : '.')); r.time_advance_minutes = 50; return JSON.stringify(r);
      };
      const { data } = onlyAdv(h.mock.store); const opening = data.memory.beats.slice();
      assert.equal(opening.length, 1, 'the memory opens with the opening\'s beat');
      assert(!data.memory.events.some((e) => /\b(ago|today|tonight|yesterday)\b/i.test(e)), 'the seed timeline gives days, never "ago" or "today": ' + data.memory.events[0]);
      while (!folds.length && n < 14) assert(await h.turn('I sit with Daisy, turn ' + (n + 1) + '.'), 'turn did not finish');
      assert.equal(folds.length, 1, 'the memory fold ran once the beats passed 36');
      const turns = storedTurns(h.mock.store, onlyAdv(h.mock.store).id);
      const at = (t) => '[Day ' + t.stateBefore.day + ' ' + t.stateBefore.time + '] ';
      const want = opening.map((b) => '[Day 1 17:40] ' + b).concat(turns.flatMap((t) => t.beats.map((b) => at(t) + b))).slice(0, 18);
      assert.deepEqual((/<beats>\n([\s\S]*?)\n<\/beats>/.exec(folds[0]) || [])[1].split('\n'), want, 'the eighteen oldest beats, the opening\'s first, each with its turn\'s day and time');
      assert.match(folds[0], /at most 250 words/, 'the fold asks for 250 words');
      assert.match(folds[0], /Give times as "Day N", never "today"/, 'and for days by number');
      assert(await h.turn('I sit with Daisy a while longer.'));
      const earlier = (/<earlier_turns[^>]*>\n([\s\S]*?)\n<\/earlier_turns>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
      const marks = [...earlier.matchAll(/Marker B(\d+)x(\d)/g)].map((m) => Number(m[1]) * 10 + Number(m[2]));
      const held = onlyAdv(h.mock.store).data.memory.beats.join('\n');
      const pending = [...held.matchAll(/Marker B(\d+)x(\d)/g)].map((m) => Number(m[1]) * 10 + Number(m[2]));
      const window = Number(onlyAdv(h.mock.store).data.settings.window) || 3;
      // The last turn's prompt had turns 1 to n - 1; the newest `window` of them (the opening counted) are verbatim and carry their own beats.
      assert.deepEqual(marks, pending.filter((m) => Math.floor(m / 10) <= n - 1 - window), '<earlier_turns> holds exactly the beats the summary does not, outside the verbatim turns: ' + earlier.slice(0, 300));
      assert.doesNotMatch(earlier, /Daisy kept the kettle on Marker/, 'each beat ends in a stop before the next');
      clean(h);
    } finally { h.close(); }
  },

  // What the prompt says twice is said once: <state> is compact, leaves out the closed places' flags that are not yet true
  // (<gm_only> names them all) and, with bonds standing in for them, the attitudes; <timeline> is the newest twelve lines; and a
  // lore entry costs what it sends, its generated list of parts included, so the lore stays inside the player's lore budget.
  async promptRepeats() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    let seeded; try { seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)); seeded.get(advKey).data.settings.loreBudget = 2500;
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      for (let i = 0; i < 12; i++) assert(await h.turn('I ask Daisy about the cow kin and the Creamery, part ' + (i + 1) + '.'), 'turn did not finish');
      const p = promptOf(lastTurn(h));
      const state = (/<state note="[^"]*">\n([^\n]*)\n/.exec(p) || [])[1] || '';
      assert(state.startsWith('{') && state.endsWith('}'), 'the state is one line of JSON: ' + state.slice(0, 80));
      assert.doesNotMatch(state, /dungeon_\w+_(found|cleared)/, 'closed-place flags not yet true are left out');
      assert.match(p, /<gm_only[^>]*>[\s\S]*flags\.dungeon_<key>_found/, 'the narrator-only block still says how to set them');
      assert.doesNotMatch(state, /"attitudes"/, 'with bonds, the attitudes are not repeated in the state');
      const timeline = ((/<timeline[^>]*>\n([\s\S]*?)\n<\/timeline>/.exec(p) || [])[1] || '').split('\n');
      assert(onlyAdv(h.mock.store).data.memory.events.length > 12 && timeline.length === 12, 'the timeline is the newest twelve of ' + onlyAdv(h.mock.store).data.memory.events.length + ' events: ' + timeline.length);
      const entries = [...p.matchAll(/<entry name="([^"]*)">([\s\S]*?)<\/entry>/g)];
      assert(entries.some((m) => m[1] === 'species: cow'), 'the cow entry is in: ' + entries.map((m) => m[1]));
      const sent = entries.reduce((a, m) => a + m[2].length, 0);
      assert(sent <= 2500, 'the lore sent (' + sent + ' characters) stays inside the 2,500 budget: ' + entries.map((m) => m[1] + ' ' + m[2].length));
      clean(h);
    } finally { h.close(); }
  },

  // A fold that keeps failing does not let <earlier_turns> grow without end: it holds at most the 36 beats a fold leaves. And a
  // strict retry of up to 600 words is kept, so a long summary that will not come down to 400 words does not stop every fold.
  async foldFailures() {
    for (const mode of ['refuse', 'long']) {
      const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
      try {
        let n = 0, folds = 0; const long = Array.from({ length: 500 }, (_, i) => ['Daisy', 'kept', 'the', 'kettle', 'on', 'Day', '1.'][i % 7]).join(' ');
        h.mock.sampleHandler = (input, o, call) => {
          if (call.label === 'memory fold') { folds += 1; return mode === 'refuse' ? "I can't help with that." : long; }
          const out = h.mock.defaultHandler(input, o, call);
          if (!/^turn/.test(call.label)) return out;
          const r = JSON.parse(out); n += 1; r.beats = [1, 2, 3].map((k) => 'Marker B' + n + 'x' + k + ' Daisy kept the kettle on.'); r.time_advance_minutes = 20; return JSON.stringify(r);
        };
        const turns = mode === 'refuse' ? 20 : 14;
        for (let i = 0; i < turns; i++) assert(await h.turn('I sit with Daisy, turn ' + (i + 1) + '.'), 'turn did not finish');
        const mem = onlyAdv(h.mock.store).data.memory;
        if (mode === 'refuse') {
          assert(folds > 0 && mem.beats.length > 40, 'the folds failed and the beats piled up: ' + mem.beats.length);
          const earlier = (/<earlier_turns[^>]*>\n([\s\S]*?)\n<\/earlier_turns>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
          const sent = (earlier.match(/Marker B/g) || []).length;
          assert(sent > 0 && sent <= 36, '<earlier_turns> holds at most 36 beats, the newest: ' + sent);
          assert.match(earlier, new RegExp('Marker B' + (n - 1 - (Number(onlyAdv(h.mock.store).data.settings.window) || 3)) + 'x3'), 'the newest beats outside the verbatim turns stay');
        } else {
          assert(folds > 0, 'a fold ran'); assert.equal(mem.summary, long, 'the strict retry\'s 500-word summary was kept');
        }
        clean(h);
      } finally { h.close(); }
    }
  },

  // The style examples are the same for the same turn of the same game, however many times the prompt is built (the shedding
  // loop rebuilds it and must measure what it sends), and move on from one turn to the next.
  async stableExemplars() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    let seeded; try { seeded = [...first.mock.store].map(([k, v]) => [k, JSON.stringify(v)]); } finally { first.close(); }
    const play = async () => {
      const h = await boot({ setup(w, m) { m.store = new Map(seeded.map(([k, v]) => [k, JSON.parse(v)])); } });
      try {
        assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
        const out = [];
        for (let i = 0; i < 2; i++) { assert(await h.turn('I ask Daisy about her classes, part ' + (i + 1) + '.'), 'turn did not finish'); out.push((/<style_examples[^>]*>\n([\s\S]*?)\n<\/style_examples>/.exec(promptOf(lastTurn(h))) || [])[1]); }
        clean(h); return out;
      } finally { h.close(); }
    };
    const a = await play(), b = await play();
    assert(a[0] && a[1], 'each turn has style examples');
    assert.deepEqual(b, a, 'the same turns of the same game get the same style examples');
    // The examples turn with the turn count; with only one ordinary example in the world there is nothing to turn to.
    const ordinary = loadWorld().exemplars.filter((e) => typeof e === 'string' || !e.scene || e.scene === 'ordinary').length;
    if (ordinary > 2) assert.notEqual(a[1], a[0], 'the next turn gets others');
  },

  // 28. Memory records an act still under way: the engine adds one beat saying so on the turn it begins (no turn count or stage,
  // which state.scene and the scene note carry), none while it goes on, and one saying the act ended on the turn it does; a turn
  // with no act gets neither. Fails on efff600 (no act beat) and on 609317d (a beat on every turn of the act).
  async memoryHoldsActOpen() {
    const h = await begin({ rmSpecies: 'human', rmName: 'Rin Kitsuragi' });
    try {
      const { id } = onlyAdv(h.mock.store); let stage = 'enter';
      patchTurns(h, (r) => { if (stage) r.stage = stage; });
      assert(await h.turn('Make love to her.'));
      let t = storedTurns(h.mock.store, id).at(-1);
      assert(t.beats.includes('An act began and is still under way.'), 'a beat says the act goes on: ' + JSON.stringify(t.beats));
      assert(onlyAdv(h.mock.store).data.memory.beats.includes(t.beats.at(-1)), 'and the memory holds it');
      stage = 'build';
      assert(await h.turn('Hold her hips and take the rhythm from her.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert(!t.beats.some((b) => /^(?:An|The) act /.test(b)), 'the next turn of the act adds no act beat: ' + JSON.stringify(t.beats));
      stage = 'after';
      assert(await h.turn('Keep going until I finish inside her, then hold her.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert(t.beats.includes('The act ended, with its aftermath.'), 'the turn that ends the act says so: ' + JSON.stringify(t.beats));
      stage = '';
      assert(await h.turn('I get up and open the window.'));
      t = storedTurns(h.mock.store, id).at(-1);
      assert(!t.beats.some((b) => /^(?:An|The) act /.test(b)), 'an ordinary turn gets no act beat: ' + JSON.stringify(t.beats));
      clean(h);
    } finally { h.close(); }
  },

  // 29. A fact never makes a body change the engine did not announce: the reply contract keeps the player's body and mind out of the
  // facts (the engine keeps the body) and asks for who learned what and the where and how of a told past; a fact that names the
  // player and a part, and nobody else, is dropped with a note. Fails on efff600.
  async factsLeaveTheBody() {
    const h = await begin({ name: 'Owen', gender: 'male', rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      const { id } = onlyAdv(h.mock.store);
      patchTurns(h, (r) => { r.facts = ['Owen\'s ears are hot and tingling at the tips', 'Daisy told Owen her change began in a lecture, four days in (Day 1)', 'Owen promised Daisy to show her his ears once they change']; });
      assert(await h.turn('I ask Daisy how her change began.'));
      const p = promptOf(lastTurn(h));
      assert.match(p, /never Owen's body or mind \(the engine keeps the body\)/, 'the contract keeps the body and mind out of the facts');
      assert.match(p, /who learned what, the where and how of a told past/, 'and asks for who learned what and a told past as told');
      const t = storedTurns(h.mock.store, id).at(-1), facts = onlyAdv(h.mock.store).data.memory.facts;
      assert(!facts.some((f) => /ears are hot/.test(f)), 'the fact about the player\'s own body is not stored: ' + JSON.stringify(facts));
      assert(facts.some((f) => /lecture/.test(f)) && facts.some((f) => /promised Daisy/.test(f)), 'the told past and the promise are: ' + JSON.stringify(facts));
      assert(t.notes.some((n) => /^fact about Owen's body left to the engine: Owen's ears are hot/.test(n)), 'and a note says so: ' + JSON.stringify(t.notes));
      // A word that also names a thing or an idiom keeps a plot fact (the first is from the author's save, a clue to the seven places);
      // a part after the player's own possessive opening a clause is still the body.
      const plot = ['A small 7 is carved into the leg of Owen\'s bed frame.', 'Owen left his coat in the Aerie (Day 2).', 'Owen shook hands with Professor Ferris on Day 2.', 'Owen held his tongue when the Dean asked about the letter (Day 1).'];
      for (const batch of [plot.slice(0, 3), plot.slice(3).concat(['Fur has come in along Owen\'s forearms, red and white.', 'Owen is sore, and his nipples have darkened.'])]) {
        patchTurns(h, (r) => { r.facts = batch.slice(); });
        assert(await h.turn('I look around the room.'));
      }
      const all = onlyAdv(h.mock.store).data.memory.facts;
      for (const f of plot) assert(all.includes(f), 'a plot fact is stored: ' + f + ' in ' + JSON.stringify(all));
      assert(!all.some((f) => /forearms|nipples/.test(f)), 'the player\'s own body is not: ' + JSON.stringify(all));
      clean(h);
    } finally { h.close(); }
  },

  // 30. The timeline stays in order: an event stamped earlier than the one before it in the same reply is moved up to it, inside the
  // minutes the turn covered, and the note says so. Fails on efff600.
  async timelineInOrder() {
    const h = await begin();
    try {
      const { id } = onlyAdv(h.mock.store);
      patchTurns(h, (r) => { r.events = ['Day 1 17:50 the kettle boiled', 'Day 1 17:42 the tea was poured']; });
      assert(await h.turn('I make tea.'));
      const ev = onlyAdv(h.mock.store).data.memory.events.slice(-2), t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(ev[0], 'Day 1 17:50 the kettle boiled', 'a stamp in its place is left as written');
      assert.equal(ev[1], 'Day 1 17:50 the tea was poured', 'the one before it in time is moved up to it');
      assert(t.notes.some((n) => /1 event time moved into the minutes this turn covered, in order/.test(n)), JSON.stringify(t.notes));
      clean(h);
    } finally { h.close(); }
  },

  // 31. The Consistency rule names every memory block the prompt carries (the summary and the older beats included), and tells the
  // narrator to recall no moment they do not hold. Fails on efff600.
  async consistencyNamesMemory() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      patchTurns(h, (r) => { r.beats = ['Daisy kept the kettle on.']; });
      for (let i = 0; i < 5; i++) assert(await h.turn('I sit with Daisy, turn ' + (i + 1) + '.'), 'turn did not finish');
      const p = promptOf(lastTurn(h)), rule = (/- Consistency: ([^\n]*)/.exec(p) || [])[1] || '';
      assert(rule, 'the rules block has the Consistency rule');
      for (const tag of ['summary', 'facts', 'timeline', 'earlier_turns', 'recent_turns']) if (new RegExp('<' + tag + '\\b').test(p)) assert(rule.includes('<' + tag + '>'), 'the rule names <' + tag + '>: ' + rule);
      assert.match(rule, /recall no moment they do not hold/, 'and forbids recalling what they do not hold');
      clean(h);
    } finally { h.close(); }
  },

  // 32. The fold keeps its word limit: a first reply more than a little over it is asked again with the tighter limit and that reply
  // kept; the fold is told to keep how each scene ended or that it had not, to change nobody's part in what happened, to keep a
  // told past as told, to leave the player's body to the engine, and to end with what is still open. Fails on efff600.
  async foldKeepsItsLimit() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      let n = 0; const folds = []; const text = (k) => Array.from({ length: k }, (_, i) => ['Daisy', 'kept', 'the', 'kettle', 'on', 'Day', '1.'][i % 7]).join(' ');
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'memory fold') { folds.push(promptOf({ input })); return text(folds.length === 1 ? 300 : 190); }
        const out = h.mock.defaultHandler(input, o, call);
        if (!/^turn/.test(call.label)) return out;
        const r = JSON.parse(out); n += 1; r.beats = [1, 2, 3].map((k) => 'Marker B' + n + 'x' + k + ' Daisy kept the kettle on.'); return JSON.stringify(r);
      };
      while (!folds.length && n < 14) assert(await h.turn('I sit with Daisy, turn ' + (n + 1) + '.'), 'turn did not finish');
      assert.equal(folds.length, 2, 'a 300-word reply to a 250-word limit is asked again');
      assert.match(folds[0], /at most 250 words/); assert.match(folds[1], /at most 200 words/, 'the second ask is the strict one');
      for (const want of ['how each scene ended, or that it had not ended', 'never change who did what to whom', 'A past a person told keeps its where and how', 'Leave out how', 'the engine keeps that', 'one line beginning "Standing:"']) assert(folds[0].includes(want), 'the fold is told: ' + want);
      assert.equal(onlyAdv(h.mock.store).data.memory.summary, text(190), 'the strict reply is the summary');
      clean(h);
    } finally { h.close(); }
    // A strict reply longer than the first never replaces it: the shorter of the two is kept.
    const h2 = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      let n = 0, folds = 0; const text = (k) => Array.from({ length: k }, (_, i) => ['Daisy', 'kept', 'the', 'kettle', 'on', 'Day', '2.'][i % 7]).join(' ');
      h2.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'memory fold') { folds += 1; return text(folds === 1 ? 300 : 500); }
        const out = h2.mock.defaultHandler(input, o, call);
        if (!/^turn/.test(call.label)) return out;
        const r = JSON.parse(out); n += 1; r.beats = [1, 2, 3].map((k) => 'Marker B' + n + 'x' + k + ' Daisy kept the kettle on.'); return JSON.stringify(r);
      };
      while (!folds && n < 14) assert(await h2.turn('I sit with Daisy, turn ' + (n + 1) + '.'), 'turn did not finish');
      assert.equal(folds, 2, 'the 300-word reply is asked again');
      const summary = onlyAdv(h2.mock.store).data.memory.summary;
      assert.notEqual(summary, text(500), 'the 500-word strict reply is not stored');
      assert.equal(summary, text(300), 'the shorter first reply is');
      clean(h2);
    } finally { h2.close(); }
  },

  // 33. Standing facts fold into facts, never into the story summary: past sixty, the oldest thirty go out in a call of their own and
  // come back as at most ten lines, the beats fold carries no facts, and the fold record on the turn holds the new list. Fails on
  // efff600 (the oldest twenty facts went into the summary).
  async factsFoldIntoFacts() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    let seeded; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), mem = seeded.get(advKey).data.memory;
    mem.facts = Array.from({ length: 61 }, (_, i) => 'Fact ' + (i + 1) + ': Daisy keeps the kettle on (Day 1).');
    mem.beats = Array.from({ length: 36 }, (_, i) => 'Seeded beat ' + (i + 1) + '.').concat(mem.beats);
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      const folds = [];
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'facts fold') { folds.push(promptOf({ input })); return Array.from({ length: 8 }, (_, i) => '- Kept fact ' + (i + 1) + ': Daisy keeps the kettle on (Day 1).').join('\n'); }
        if (call.label === 'memory fold') folds.push(promptOf({ input }));
        return h.mock.defaultHandler(input, o, call);
      };
      assert(await h.turn('I sit with Daisy.'), 'turn did not finish');
      const { id, data } = onlyAdv(h.mock.store), t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(folds.length, 2, 'the facts fold and the beats fold are two calls: ' + JSON.stringify(folds.map((q) => q.slice(0, 60))));
      assert.match(folds[0], /<facts>\nFact 1: /, 'the facts fold gets the oldest facts'); assert.doesNotMatch(folds[0], /You maintain the long-term memory/, 'in a call of its own');
      assert.match(folds[1], /You maintain the long-term memory/); assert.doesNotMatch(folds[1], /<facts>/, 'the beats fold carries no facts');
      assert.equal(data.memory.facts.length, 61 - 30 + 8, 'thirty facts became eight: ' + data.memory.facts.length);
      assert.equal(data.memory.facts[0], 'Kept fact 1: Daisy keeps the kettle on (Day 1).', 'the kept lines lead, without their bullets');
      assert.equal(data.memory.facts[8], 'Fact 31: Daisy keeps the kettle on (Day 1).', 'the newer facts follow');
      assert(t.notes.some((n) => /folded 18 beats into the summary; folded 30 facts into 8/.test(n)), JSON.stringify(t.notes));
      assert.deepEqual(t.memAfter.facts, data.memory.facts, 'the fold record on the turn holds the new facts');
      clean(h);
    } finally { h.close(); }
  },

  // 34. A summary the player edited survives Undo and Regenerate of the turn before the edit; the fold record rebuilt on the turn
  // that is newest again holds the edit too. Fails on efff600.
  async undoKeepsSummaryEdit() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      const { id } = onlyAdv(h.mock.store);
      assert(await h.turn('One.')); assert(await h.turn('Two.'));
      const edit = 'PLAYER EDIT: Daisy is my roommate and her letter is unexplained.';
      h.type('#summary', edit); h.click('#saveSummary'); assert(await h.idle(8000));
      h.click('#undo'); assert(await h.idle(10000));
      assert.equal(h.$('#summary').value, edit, 'Undo keeps the edit on the page');
      assert.equal(onlyAdv(h.mock.store).data.memory.summary, edit, 'and in the saved adventure');
      assert.equal(storedTurns(h.mock.store, id).at(-1).memAfter.summary, edit, 'and in the fold record rebuilt on the newest turn');
      const edit2 = edit + ' She came up on the ferry.';
      h.type('#summary', edit2); h.click('#saveSummary'); assert(await h.idle(8000));
      h.click('#regen'); assert(await h.idle(20000));
      assert.equal(onlyAdv(h.mock.store).data.memory.summary, edit2, 'Regenerate keeps the edit');
      assert.match(promptOf(lastTurn(h)), /<summary[^>]*>\nPLAYER EDIT: Daisy is my roommate/, 'and the regenerated turn read it');
      clean(h);
    } finally { h.close(); }
  },

  // 35. A fold that keeps failing is not tried every turn: after a failure the next try waits for 6 more beats, then 12, 24 and 48,
  // and the note says so; a fold that works clears the wait. Fails on efff600 (two failing calls every turn).
  async foldBackoff() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      const { id } = onlyAdv(h.mock.store); let n = 0, folds = 0, good = false;
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'memory fold') { folds += 1; return good ? h.mock.defaultHandler(input, o, call) : "I can't help with that."; }
        const out = h.mock.defaultHandler(input, o, call);
        if (!/^turn/.test(call.label)) return out;
        const r = JSON.parse(out); n += 1; r.beats = [1, 2, 3].map((k) => 'Marker B' + n + 'x' + k + ' Daisy kept the kettle on.'); return JSON.stringify(r);
      };
      while (!folds && n < 14) assert(await h.turn('I sit with Daisy, turn ' + (n + 1) + '.'), 'turn did not finish');
      assert.equal(folds, 2, 'the first fold failed on its ask and its strict retry');
      let t = storedTurns(h.mock.store, id).at(-1);
      assert(t.notes.some((x) => /summary fold failed: invalid_summary; next try after 6 more beats/.test(x)), JSON.stringify(t.notes));
      assert(await h.turn('I sit with Daisy a while longer.')); assert.equal(folds, 2, 'the next turn makes no fold call');
      assert(await h.turn('I sit with Daisy longer still.')); assert.equal(folds, 4, 'the one after, with 6 more beats, tries again');
      t = storedTurns(h.mock.store, id).at(-1);
      assert(t.notes.some((x) => /next try after 12 more beats/.test(x)), 'the wait doubles: ' + JSON.stringify(t.notes));
      good = true;
      for (let i = 0; i < 3; i++) assert(await h.turn('I sit with Daisy, turn ' + (n + 1) + '.')); assert.equal(folds, 4, 'the wait is kept while it lasts');
      assert(await h.turn('I sit with Daisy once more.')); assert.equal(folds, 5, 'then the fold runs again, and works');
      const mem = onlyAdv(h.mock.store).data.memory;
      assert(mem.foldNextAt == null && mem.foldFailures == null, 'a fold that works clears the wait: ' + JSON.stringify([mem.foldNextAt, mem.foldFailures]));
      assert.equal(mem.beats.length, 3 * n + 1 - 18, 'and took its eighteen beats');
      clean(h);
    } finally { h.close(); }
  },

  // 36. A facts fold that fails never stops the beats fold, and waits before it is tried again: a facts fold that throws rate_limited
  // leaves the facts as they were with a note, the beats fold still runs that turn, and the facts fold is not called again until six
  // more facts have come in. A facts fold that works followed by a beats fold that throws still records the new facts on the turn.
  async factsFoldFailureBacksOff() {
    const seededBoot = async () => {
      const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
      let seeded; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
      const mem = seeded.get([...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k))).data.memory;
      mem.facts = Array.from({ length: 61 }, (_, i) => 'Fact ' + (i + 1) + ': Daisy keeps the kettle on (Day 1).');
      mem.beats = Array.from({ length: 36 }, (_, i) => 'Seeded beat ' + (i + 1) + '.').concat(mem.beats);
      const h = await boot({ setup(w, m) { m.store = seeded; } });
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      return h;
    };
    let h = await seededBoot();
    try {
      const calls = [];
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'facts fold') { calls.push('facts'); throw { code: 'rate_limited', message: 'slow down' }; }
        if (call.label === 'memory fold') calls.push('beats');
        const out = h.mock.defaultHandler(input, o, call);
        if (!/^turn/.test(call.label)) return out;
        const r = JSON.parse(out); r.facts = []; return JSON.stringify(r);
      };
      assert(await h.turn('I sit with Daisy.'), 'turn did not finish');
      const { id, data } = onlyAdv(h.mock.store), t = storedTurns(h.mock.store, id).at(-1);
      assert.deepEqual(calls, ['facts', 'beats'], 'the beats fold runs after the facts fold failed');
      assert.equal(data.memory.facts.length, 61, 'the facts stand');
      assert(t.notes.includes('folded 18 beats into the summary; facts fold failed: rate_limited; the facts stand, next try after 6 more facts'), 'the beats fold folded, and the note gives the facts fold\'s wait: ' + JSON.stringify(t.notes));
      assert(await h.turn('I sit with Daisy a while longer.'), 'turn did not finish');
      assert.deepEqual(calls, ['facts', 'beats'], 'the next turn, with no new facts, makes no facts fold call');
      clean(h);
    } finally { h.close(); }
    h = await seededBoot();
    try {
      h.mock.sampleHandler = (input, o, call) => {
        if (call.label === 'facts fold') return Array.from({ length: 5 }, (_, i) => 'Kept fact ' + (i + 1) + ' (Day 1).').join('\n');
        if (call.label === 'memory fold') throw { code: 'rate_limited', message: 'slow down' };
        return h.mock.defaultHandler(input, o, call);
      };
      assert(await h.turn('I sit with Daisy.'), 'turn did not finish');
      const { id, data } = onlyAdv(h.mock.store), t = storedTurns(h.mock.store, id).at(-1);
      assert.equal(data.memory.facts[0], 'Kept fact 1 (Day 1).', 'the facts folded');
      assert(t.memAfter && t.memAfter.facts[0] === 'Kept fact 1 (Day 1).', 'and the turn records them though the beats fold failed: ' + JSON.stringify(t.memAfter && t.memAfter.facts.slice(0, 2)));
      assert(t.notes.includes('folded 30 facts into 5') && t.notes.some((n) => /^summary fold failed: rate_limited/.test(n)), 'both notes are kept: ' + JSON.stringify(t.notes));
      clean(h);
    } finally { h.close(); }
  },

  // 37. A summary edit also survives Previous version, and Regenerate of a turn that folded memory: the edit was made on the folded
  // summary, so it is kept with the beats that fold had taken left out (the memory is the fold's own, with the edit as its summary).
  // Fails on 609317d (Previous version restored the old summary; a folded turn set the edit aside).
  async summaryEditPrevVersionAndFold() {
    let h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      assert(await h.turn('One.')); assert(await h.turn('Two.'));
      h.click('#regen'); assert(await h.idle(20000));
      const edit = 'PLAYER EDIT: Daisy is my roommate.';
      h.type('#summary', edit);   // not saved: Previous version saves it first
      const pv = h.document.querySelector('[data-prevver]'); assert(pv, 'the turn has a previous version');
      pv.click(); assert(await h.idle(10000));
      assert.equal(onlyAdv(h.mock.store).data.memory.summary, edit, 'Previous version keeps the edit');
      assert.equal(h.$('#summary').value, edit, 'and the page shows it');
      clean(h);
    } finally { h.close(); }
    h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      let n = 0;
      patchTurns(h, (r) => { n += 1; r.beats = [1, 2, 3].map((k) => 'Marker B' + n + 'x' + k + ' Daisy kept the kettle on.'); });
      const { id } = onlyAdv(h.mock.store); let rec = null;
      while (!rec && n < 16) { assert(await h.turn('Sit ' + n + '.')); const t = storedTurns(h.mock.store, id).at(-1); if (t.notes.some((x) => /folded 18 beats/.test(x))) rec = t.memAfter; }
      assert(rec, 'a turn folded');
      const edit = 'PLAYER EDIT after the fold.';
      h.type('#summary', edit); h.click('#saveSummary'); assert(await h.idle(8000));
      h.click('#regen'); assert(await h.idle(20000));
      const mem = onlyAdv(h.mock.store).data.memory;
      assert.equal(mem.summary, edit, 'Regenerate of a folded turn keeps the edit');
      assert.equal(mem.beats[0], rec.beats[0], 'without the beats the fold took: ' + JSON.stringify(mem.beats.slice(0, 2)));
      assert.equal(mem.beats.length, rec.beats.length, 'the regenerated turn adds its own in place of the old ones');
      assert.match(promptOf(lastTurn(h)), /<summary[^>]*>\nPLAYER EDIT after the fold\./, 'and the regenerated turn read it');
      clean(h);
    } finally { h.close(); }
  },

  // 29. Near the size cap (the narrator-only block lean) one passing oddity still goes out each turn, a different one the next
  // turn, and the physician in the scene keeps the partial knowledge that points at the truth (the Spa water called the font).
  async leanOddities() {
    const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cow-roommate-25.json'), 'utf8'));
    const doc = SAVE.adventure.cast.generated.characters.find((c) => c.key === 'physician');
    assert(doc && doc.first, 'the fixture has a physician');
    const h = await boot({ setup: (w, mock) => {
      mock.store.set('adventures/' + SAVE.id, { data: SAVE.adventure, version: 1 });
      for (const [c, d] of Object.entries(SAVE.turns)) mock.store.set('adventures/' + SAVE.id + '/turns/' + c, { data: d, version: 1 });
    } });
    try {
      assert(await h.settle(150, 8000)); assert(await h.idle(20000), 'the save did not load');
      patchTurns(h, (r) => { r.state_updates = [{ key: 'present', op: 'set', value: [doc.first] }]; });
      const odd = [];
      // A long director note keeps both turns far enough down the shedding chain that the narrator-only block is lean.
      for (const a of ['I walk to the medical centre.', 'I ask ' + doc.first + ' about the water.']) {
        assert(await h.turn(a, { max: 30000, director: 'Keep the scene in the room. '.repeat(110).slice(0, 3000) }), 'the turn did not finish');
        assert(storedTurns(h.mock.store, SAVE.id).at(-1).notes.some((n) => /narrator-only secrets trimmed/.test(n)), 'the turn ran lean');
        const gm = (/<gm_only[^>]*>([\s\S]*?)<\/gm_only>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
        const m = /An oddity that may surface[^\n]*\n((?:- [^\n]*\n?)+)/.exec(gm);
        assert(m, 'a lean narrator-only block keeps one oddity: ' + gm.slice(0, 300));
        assert.equal(m[1].trim().split('\n').length, 1, 'one oddity when lean');
        odd.push(m[1].trim());
        // ...as something only the physician can let slip, overheard when nobody seems to be listening (not only when pressed).
        if (odd.length === 2) assert(/Partial knowledge, which only they can let slip:\n(?:- [^\n]*\n)*- [^\n]*the font when nobody seems to be listening/.test(gm), 'the physician in the scene keeps the partial knowledge: ' + gm.slice(0, 400));
      }
      assert.notEqual(odd[0], odd[1], 'the oddity changes from turn to turn');
      clean(h);
    } finally { h.close(); }
  },

  // 30. Below the humanity line the closed places do not shut in silence: the narrator is told the player can feel a place refuse.
  // 31 (below) and 31b: the engine holds the closed places' flags to the rules the narrator is given.
  async closedPlaceRefusesBelowLine() {
    const T = loadWorld().transformation.tracks.species.cow;
    const all = Object.fromEntries(T.map((t) => [t.key, { told: 'done' }]));
    const { h, id } = await seededTf({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' }, () => baseTf('cow', 100, { lean: 0, face: 15, tracks: heldParts(T, all) }), { pace: 'unbounded' });
    try {
      assert(await h.turn('I walk along the old wall.'));
      const gm = (/<gm_only[^>]*>([\s\S]*?)<\/gm_only>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
      const line = gm.split('\n').find((l) => /humanity: \d+ of 100/.test(l)) || '';
      assert.match(line, /Below the line of 15/, 'the player is below the line: ' + line);
      assert.match(line, /At a closed place Tom can feel it refuse/, 'a closed place refuses in a way the player can feel: ' + line);
      // 31. Nor can the narrator mark a place found below the line.
      patchTurns(h, (r) => { r.state_updates = [{ key: 'flags.dungeon_wrath_found', op: 'set', value: true }]; });
      assert(await h.turn('I climb the bell tower.'));
      assert.equal(onlyAdv(h.mock.store).data.state.flags.dungeon_wrath_found, false, 'a place is not found below the line');
      assert(storedTurns(h.mock.store, id).at(-1).notes.some((n) => /ignored dungeon_wrath_found \(humanity \d+, below the line of 15\)/.test(n)), 'and the turn says why');
      clean(h);
    } finally { h.close(); }
  },

  // 31b. A place passed is a place found, and a place found or passed stays so: the narrator cannot un-find it.
  async closedPlaceFlagsHold() {
    const h = await begin();
    try {
      const { id } = onlyAdv(h.mock.store), flags = () => onlyAdv(h.mock.store).data.state.flags;
      patchTurns(h, (r) => { r.state_updates = [{ key: 'flags.dungeon_wrath_cleared', op: 'set', value: true }]; });
      assert(await h.turn('I ring the bell by hand.'));
      assert(flags().dungeon_wrath_cleared && flags().dungeon_wrath_found, 'a place passed is found too: ' + JSON.stringify([flags().dungeon_wrath_found, flags().dungeon_wrath_cleared]));
      patchTurns(h, (r) => { r.state_updates = [{ key: 'flags.dungeon_wrath_found', op: 'set', value: false }, { key: 'flags.dungeon_wrath_cleared', op: 'set', value: false }]; });
      assert(await h.turn('I walk away from the tower.'));
      assert(flags().dungeon_wrath_cleared && flags().dungeon_wrath_found, 'a place found and passed stays so');
      assert(storedTurns(h.mock.store, id).at(-1).notes.some((n) => /ignored unsetting dungeon_wrath_found/.test(n)), 'and the turn says why');
      clean(h);
    } finally { h.close(); }
  },

  // 32. The turn no longer asks for secret_info (nothing reads it back, and it invited the narrator to settle what the secrets
  // leave open); a reply without it is whole, and its turn shows no empty Secret panel. On a track world the transformation
  // block does not point to ladders that <lore> does not print.
  async noSecretInfo() {
    const h = await begin({ rmSpecies: 'cow' });
    try {
      const { id } = onlyAdv(h.mock.store);
      patchTurns(h, (r) => { delete r.secret_info; });
      assert(await h.turn('I look around.'));
      assert(await h.turn('I look around again.'));
      const p = promptOf(lastTurn(h));
      assert.doesNotMatch(p, /"secret_info"/, 'the reply contract does not ask for secret_info');
      assert.doesNotMatch(p, /Ladders of change for active kinds are in <lore>/, 'no pointer to ladders <lore> does not hold');
      assert(!storedTurns(h.mock.store, id).at(-1).notes.some((n) => /missing field secret_info/.test(n)), 'a reply without it is not missing anything');
      const last = [...h.document.querySelectorAll('#feed article.turn[data-id]')].at(-1);
      assert(last && !last.querySelector('[data-reveal="secret"]'), 'no empty Secret panel');
      clean(h);
    } finally { h.close(); }
  },

  // 28. The keeper's past is not on the Dean's public sheet, and the invention call is not asked to guess her private matter:
  // her role fixes it. An older save with the clause and an invented private matter is mended on load. The rules keep the
  // narrator from inventing a human past or a letter for a mythkin (a roommate who 'got a letter too').
  async deanKeepsSecret() {
    const role = loadWorld().castRoles.find((r) => r.key === 'dean');
    assert(role && role.private, 'the Dean\'s role fixes her private matter');
    const first = await begin();
    let seeded;
    try {
      const inv = first.mock.sampleCalls.filter((c) => c.label === 'cast invention').map(promptOf);
      assert(inv.length, 'the cast was invented');
      for (const p of inv) assert.doesNotMatch(p, /human once/, 'the invention call is not told the keeper\'s past');
      const line = inv.join('\n').split('\n').find((l) => /^- dean: /.test(l)) || '';
      assert(line && !/Fields: [^.]*\bprivate\b/.test(line), 'the invention call is not asked for the Dean\'s private matter: ' + line.slice(-120));
      const dean = onlyAdv(first.mock.store).data.cast.generated.characters.find((c) => c.key === 'dean');
      for (const f of ['brief', 'sheet']) assert.doesNotMatch(dean[f], /human once/, 'the Dean\'s ' + f + ' keeps the keeper\'s past out');
      assert.equal(dean.gen.privateMatter, role.private, 'the role\'s private matter is the Dean\'s');
      patchTurns(first, (r) => { r.state_updates = [{ key: 'present', op: 'set', value: [dean.first] }]; });
      assert(await first.turn('I go to the Dean\'s office.'));
      assert(await first.turn('I ask ' + dean.first + ' about the letter.'));
      const p = promptOf(lastTurn(first)), chars = (/<characters[^>]*>([\s\S]*?)<\/characters>/.exec(p) || [])[1] || '';
      assert(chars.includes('[dean]'), 'the Dean is in <characters>');
      assert.doesNotMatch(chars, /human once/, '<characters> carries no secret');
      assert.match((/<gm_only[^>]*>([\s\S]*?)<\/gm_only>/.exec(p) || [])[1] || '', /human once/, 'the keeper\'s past stays in <gm_only>');
      assert.match((/<rules[^>]*>([\s\S]*?)<\/rules>/.exec(p) || [])[1] || '', /Never invent a human past or a letter of their own for a mythkin; who was born human is only what <characters> or <gm_only> says\./, 'the rules keep the narrator from giving a mythkin a past of a seeing human');
      clean(first);
      seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    } finally { first.close(); }
    // An older save: the clause in the brief and the sheet, and an invented private matter that contradicts the keeper.
    const key = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(key).data;
    const d = doc.cast.generated.characters.find((c) => c.key === 'dean'), guess = 'remembers what she was before the Spa';
    d.brief = d.brief.replace('worn as easily as a coat;', 'worn as easily as a coat, and human once, long ago, though nobody knows it;');
    d.sheet = d.sheet.replace('worn as easily as a coat;', 'worn as easily as a coat, and human once, long ago, though nobody knows it;').replace('Does not say: ' + role.private + '.', 'Does not say: ' + guess + '.');
    d.gen.privateMatter = guess;
    assert.match(d.sheet, /human once[^]*Does not say: remembers/, 'the old sheet was made');
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      assert(await h.turn('I look around.'));
      const m = onlyAdv(h.mock.store).data.cast.generated.characters.find((c) => c.key === 'dean');
      for (const f of ['brief', 'sheet']) assert.doesNotMatch(m[f], /human once/, 'the old ' + f + ' is mended');
      assert.match(m.sheet, new RegExp('Does not say: ' + role.private + '\\.'), 'the old sheet says the role\'s private matter');
      assert.equal(m.gen.privateMatter, role.private, 'the invented private matter is replaced');
      clean(h);
    } finally { h.close(); }
  },

  // 28. Begin never replaces an adventure whose last save failed without saying so: a save still under way when New adventure
  // was pressed, which then fails, is asked about at Begin once; a second Begin goes ahead.
  async beginAsksUnsaved() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      assert(await h.turn('I unpack.'));
      const first = onlyAdv(h.mock.store).id;
      const write = (op) => op === 'set' || op === 'update'; h.mock.dbDelay = (op) => (write(op) ? 400 : 0); h.mock.dbFail = (op) => (write(op) ? { code: 'internal', message: 'refused' } : null);
      h.click('#btnSettings'); h.$('#setDensity').value = 'rich'; h.$('#setDensity').dispatchEvent(new h.window.Event('change')); h.click('[data-close="dlgSettings"]');
      h.click('#btnAdventures'); h.click('#newAdv');
      assert(h.$('#dlgCreate').open, 'the save had not failed yet, so the creation screen opens');
      assert(await h.idle(15000)); h.mock.dbFail = null; h.mock.dbDelay = null;
      assert.match(statusText(h) + h.$('#summaryNote').textContent, /[Ss]ave failed/, 'setup: the settings save failed: ' + statusText(h) + ' / ' + h.$('#summaryNote').textContent);
      h.click('#cBegin'); await h.settle(150, 4000);
      assert.match(h.$('#cNote').textContent, /not in the save/, 'Begin says the open adventure has unsaved changes: ' + h.$('#cNote').textContent);
      assert.equal(advDocs(h.mock.store).length, 1, 'no new adventure was made'); assert.equal(onlyAdv(h.mock.store).id, first);
      h.click('#cBegin'); assert(await h.idle(30000)); await h.settle(150, 4000);
      assert.equal(advDocs(h.mock.store).length, 2, 'the second Begin goes ahead');
      clean(h);
    } finally { h.close(); }
  },

  // 29. A new adventure takes its settings from the game on screen, not from whatever this device last changed: the creation screen
  // shows the pace, density and invention tier it will use, and what is picked there is what is saved and what invents the cast.
  async creationSettings() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      h.click('#btnSettings');
      assert(!h.$('#setInventTier'), 'the invention tier is not a setting of a game already begun; it is picked on the creation screen');
      for (const [sel, v] of [['#setPace', 'slow'], ['#setDensity', 'terse']]) { h.$(sel).value = v; h.$(sel).dispatchEvent(new h.window.Event('change')); assert(await h.idle(8000)); }
      h.click('[data-close="dlgSettings"]');
      h.window.localStorage.setItem('windlass.settings', JSON.stringify({ pace: 'unbounded', density: 'rich', inventTier: 'quick' }));
      const first = onlyAdv(h.mock.store).id;
      h.click('#btnAdventures'); h.click('#newAdv'); await h.settle(150, 4000);
      assert(h.$('#cPace') && h.$('#cDensity'), 'the creation screen shows the pace and the density');
      assert.equal(h.$('#cPace').value, 'slow', 'the pace shown is the open game\'s'); assert.equal(h.$('#cDensity').value, 'terse');
      assert(h.$('#cInventTier'), 'the creation screen shows the tier that invents the people'); assert.equal(h.$('#cInventTier').value, 'quick', 'the tier shown is the open game\'s');
      h.$('#cInventTier').value = 'complex'; h.$('#cInventTier').dispatchEvent(new h.window.Event('change'));
      h.$('#cPace').value = 'unbounded'; h.$('#cPace').dispatchEvent(new h.window.Event('change'));
      assert.match(h.$('#cPaceNote').textContent, /testing/i, 'unbounded says it is for testing');
      h.$('#cPace').value = 'fast'; h.$('#cPace').dispatchEvent(new h.window.Event('change'));
      const before = h.mock.sampleCalls.length;
      h.click('#cBegin'); assert(await h.idle(30000)); await h.settle(150, 4000);
      const doc = advDocs(h.mock.store).map(([, v]) => v.data).find((d) => d.id !== first);
      assert(doc, 'the new adventure was saved');
      assert.equal(doc.settings.pace, 'fast', 'the pace picked on the form is saved'); assert.equal(doc.settings.density, 'terse', 'the density shown is the one saved');
      assert.equal(doc.settings.inventTier, 'complex', 'the new game keeps the tier picked on the creation screen');
      const invent = h.mock.sampleCalls.slice(before).filter((c) => c.label === 'cast invention');
      assert(invent.length && invent.every((c) => c.opts.modelTier === 'complex'), 'the cast is invented on the tier picked on the creation screen: ' + invent.map((c) => c.opts.modelTier).join(','));
      clean(h);
    } finally { h.close(); }
  },

  // 30. The body a player was born with is chosen on the form, not read off the gender. A non-binary player cannot begin without it;
  // with a woman's body the narrator is told so (a woman with a woman's body is not, the gender says it), and the bovine women's parts stay open to that body.
  async bornBody() {
    const h0 = await boot({});
    try {
      assert(await h0.settle(150, 6000));
      h0.$('#cGender').value = 'nonbinary'; h0.$('#cGender').dispatchEvent(new h0.window.Event('change'));
      assert.equal(h0.$('#cBody').value, '', 'a non-binary player picks the body');
      h0.click('#cBegin'); await h0.settle(150, 3000);
      assert.match(h0.$('#cNote').textContent, /body you were born with/, 'Begin asks for the body: ' + h0.$('#cNote').textContent);
      assert.equal(advDocs(h0.mock.store).length, 0, 'nothing was made');
      h0.$('#cGender').value = 'male'; h0.$('#cGender').dispatchEvent(new h0.window.Event('change'));
      assert.equal(h0.$('#cBody').value, 'male', 'a man\'s body follows a man');
    } finally { h0.close(); }
    const g = await tfGame(6, null, { gender: 'nonbinary', body: 'female', name: 'Sam Ashby' });
    try {
      assert.equal(onlyAdv(g.store).data.player.body, 'female', 'the body is stored with the player');
      const p = g.prompts.at(-1), pb = p.slice(p.indexOf('<player'), p.indexOf('</player>')), tb = p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>'));
      assert.match(pb, /\(they\/them\)[\s\S]*Born with a woman's body\./, 'the narrator is told the body: ' + pb.slice(0, 300));
      assert.doesNotMatch(tb, /Not on [^\n]*teats and udder/, 'the udder is not closed to a woman\'s body: ' + (tb.match(/Not on [^\n]*/) || ['none'])[0]);
    } finally { g.h.close(); }
    // A woman born with a woman's body: the gender already says it, so the line is not sent.
    const w = await tfGame(1, null, { gender: 'female', body: 'female', name: 'Sam Ashby' });
    try {
      const p = w.prompts.at(-1), pb = p.slice(p.indexOf('<player'), p.indexOf('</player>'));
      assert.match(pb, /\(she\/her\)/, 'setup: a woman'); assert.doesNotMatch(pb, /Born with/, 'no born-with line when the body is the gender\'s: ' + pb.slice(0, 300));
    } finally { w.h.close(); }
  },

  // 31. A roommate introduction that fails can be written again from the status line; the written one replaces the plain one in
  // Turn 0 and is saved.
  async introRetry() {
    let failOnce = true;
    const setup = (w, m) => { m.sampleHandler = (input, o, call) => { if (call.label === 'roommate introduction' && failOnce) { failOnce = false; throw { code: 'overloaded', message: 'busy' }; } return m.defaultHandler(input, o, call); }; };
    const h = await begin({ setup, rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      assert.match(statusText(h), /could not write your roommate/, 'setup: the first intro failed: ' + statusText(h));
      assert.equal(onlyAdv(h.mock.store).data.opening.introWritten, undefined);
      const again = statusButtons(h).find((b) => /Write the introduction again/.test(b.textContent));
      assert(again, 'the failed introduction can be written again: ' + statusButtons(h).map((b) => b.textContent).join(','));
      h.click(again); assert(await h.idle(20000)); await h.settle(150, 4000);
      const doc = onlyAdv(h.mock.store).data;
      assert.equal(doc.opening.introWritten, true, 'the written introduction is saved');
      assert.match(doc.opening.narrative, /Daisy Clover/, 'Turn 0 carries the written introduction');
      assert.match(h.$('#feed').textContent, /half-unpacked box/, 'and the page shows it');
      clean(h);
    } finally { h.close(); }
  },

  // The introduction failed, the roommate was redrawn and edited in the Cast screen, and it is written again: for the roommate as
  // the screen left them (name, pronouns, Looks, speech, the redrawn traits), not as first drawn; and the plain Turn 0 already stood
  // for the edited roommate before the retry.
  async introRetryUsesCastEdits() {
    let failOnce = true;
    const setup = (w, m) => { m.sampleHandler = (input, o, call) => { if (call.label === 'roommate introduction' && failOnce) { failOnce = false; throw { code: 'overloaded', message: 'busy' }; } return m.defaultHandler(input, o, call); }; };
    const h = await begin({ setup, rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female' });
    try {
      assert.match(statusText(h), /could not write your roommate/, 'setup: the first intro failed: ' + statusText(h));
      const base = onlyAdv(h.mock.store).data.roommate, oldEyes = (/(?:\. |; )([^.;]*\beyes\b[^.;]*)\./.exec(base.looks || base.gen.looks) || [])[1];
      assert(oldEyes && !/emerald/.test(oldEyes), 'setup: the drawn eyes are not emerald: ' + oldEyes);
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'Daisy Clover', 'the Cast screen opens on the roommate');
      h.click('#cfRedraw'); assert(await h.idle(8000)); await h.sleep(20);
      assert.match(h.$('#cfNote').textContent, /Redrawn and saved/, h.$('#cfNote').textContent);
      const redrawn = onlyAdv(h.mock.store).data.cast.overrides.roommate.gen;
      assert(redrawn && redrawn.temperament && redrawn.temperament !== base.gen.temperament, 'setup: Redraw drew a new temperament: ' + JSON.stringify(redrawn));
      h.$('#cfName').value = 'Rosalind Vane'; h.$('#cfGender').value = 'male'; h.$('#cfGender').dispatchEvent(new h.window.Event('change'));
      const el = h.$('#cfLooks'); el.value = el.value.replace(/(\. |; )[^.;]*\beyes\b[^.;]*\./, '$1emerald green eyes.'); el.dispatchEvent(new h.window.Event('input', { bubbles: true }));
      h.$('#cfSpeech').value = 'speaks in short flat sentences';
      h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20);
      assert.match(h.$('#cfNote').textContent, /^Saved\./, h.$('#cfNote').textContent);
      h.click('[data-close="dlgCast"]');
      let doc = onlyAdv(h.mock.store).data;
      assert.match(doc.opening.narrative, /Rosalind Vane/, 'the plain Turn 0 is composed again for the edited roommate: ' + doc.opening.narrative.slice(0, 300));
      assert.doesNotMatch(doc.opening.narrative, /Daisy|Clover/, 'and no longer names the roommate as first drawn');
      assert(!doc.opening.narrative.includes(oldEyes), 'nor describes the old eyes');
      assert.match(h.$('#feed').textContent, /Rosalind Vane/, 'the page shows it');
      const again = statusButtons(h).find((b) => /Write the introduction again/.test(b.textContent));
      assert(again, 'the introduction can still be written again: ' + statusButtons(h).map((b) => b.textContent).join(','));
      h.click(again); assert(await h.idle(20000)); await h.settle(150, 4000);
      const calls = h.mock.sampleCalls.filter((c) => c.label === 'roommate introduction'); assert.equal(calls.length, 2, 'the introduction was asked for twice');
      const rm = (/<roommate>\n([\s\S]*?)\n<\/roommate>/.exec(promptOf(calls[1])) || [])[1] || '';
      assert.match(rm, /^Full name: Rosalind Vane \(Bovine mythkin, he\/him\)/, 'the retried prompt has the edited name and pronouns: ' + rm.slice(0, 200));
      assert(rm.includes('Temperament: ' + redrawn.temperament + '.') && rm.includes('Habit: ' + redrawn.quirk + '.'), 'and the redrawn traits: ' + rm.slice(0, 400));
      assert.match(rm, /Speech: speaks in short flat sentences\./, 'and the edited speech');
      assert.match(rm, /; emerald green eyes\./, 'and the edited Looks: ' + rm);
      assert(!rm.includes(oldEyes) && !/Daisy|Clover|she\/her/.test(rm), 'nothing of the roommate as first drawn: ' + rm);
      doc = onlyAdv(h.mock.store).data;
      assert.equal(doc.opening.introWritten, true, 'the written introduction is saved: ' + statusText(h));
      assert.match(doc.opening.narrative, /Rosalind Vane/, 'Turn 0 names the edited roommate'); assert.doesNotMatch(doc.opening.narrative, /Daisy/);
      assert(await h.turn('I unpack my bag.'));
      const p = promptOf(lastTurn(h));
      assert.doesNotMatch(p, /Daisy Clover/, 'the first turn\'s prompt has no trace of the roommate as first drawn');
      assert.match(blockOf(p, 'recent_turns'), /Rosalind Vane/, 'Turn 0 as sent names the edited roommate');
      clean(h);
    } finally { h.close(); }
  },

  // 32. An introduction cut off by a reload is offered again when the adventure opens, and a second Begin while one is being
  // written says so rather than speaking of a turn.
  async introAfterReload() {
    let release = null;
    const h = await boot({ setup(w, m) { m.sampleHandler = (input, o, call) => (call.label === 'roommate introduction' ? new Promise((r) => { release = r; }) : m.defaultHandler(input, o, call)); } });
    let store;
    try {
      assert(await h.settle(150, 6000));
      h.type('#cRmSpecies', 'cow'); h.type('#cRmName', 'Daisy Clover'); h.click('#cBegin');
      const t0 = Date.now(); while (Date.now() - t0 < 30000 && !(release && advDocs(h.mock.store).length && h.mock.pending === 0)) await h.sleep(50);
      assert(release, 'setup: the introduction is being written');
      await h.sleep(200);
      h.$('#dlgCreate').setAttribute('open', ''); h.$('#cBegin').disabled = false; h.click('#cBegin');
      assert.match(h.$('#cNote').textContent, /introduction is still being written/, 'a second Begin names what is running: ' + h.$('#cNote').textContent);
      store = new Map([...h.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    } finally { h.close(); }
    const R = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await R.settle(150, 8000)); await R.idle(10000); await R.settle(100, 4000);
      const offer = statusButtons(R).find((b) => /Write it now/.test(b.textContent));
      assert(offer, 'the unwritten introduction is offered: ' + statusText(R));
      R.click(offer); assert(await R.idle(20000)); await R.settle(150, 4000);
      assert.equal(onlyAdv(R.mock.store).data.opening.introWritten, true, 'written and saved');
      clean(R);
    } finally { R.close(); }
  },

  // 33. A roommate kind this world has no anatomy for is refused at the form with the kinds it has, so the narrator is never left to
  // make a body up; nothing is invented or saved. A kind it has, typed as "a cow" or "Werewolves", is that kind.
  async unknownKindRefused() {
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000));
      // A kind the world has, typed with an article or as a plural, is that kind, not a refusal that says the world has none.
      for (const typed of ['Cows', 'a cow', 'Werewolves', 'harpies', 'foxes']) { h.type('#cRmSpecies', typed); assert.match(h.$('#cRmNote').textContent, /^Known species/, typed + ' is a kind of this world: ' + h.$('#cRmNote').textContent); }
      h.type('#cRmSpecies', 'dragon');
      assert.match(h.$('#cRmNote').textContent, /Not a kind this world knows/, 'the note says so as it is typed: ' + h.$('#cRmNote').textContent);
      const before = h.mock.sampleCalls.length;
      h.click('#cBegin'); await h.settle(150, 3000);
      assert.match(h.$('#cNote').textContent, /no kind called "dragon"[\s\S]*Bovine[\s\S]*human/i, 'Begin lists the kinds: ' + h.$('#cNote').textContent);
      assert.equal(advDocs(h.mock.store).length, 0, 'nothing was saved');
      assert.equal(h.mock.sampleCalls.length, before, 'nothing was invented');
      clean(h);
    } finally { h.close(); }
  },

  // 34. The roommate introduction must name the roommate as a name: "clover" in a rabbit's room is not Clover. One that brings in
  // someone else of the cast by full name is not used either; both leave the plain one, which can be written again. The status
  // says only that the reply could not be used, in plain words.
  async introNamesOnlyTheRoommate() {
    let mode = 'lower', other = '';
    const setup = (w, m) => { m.sampleHandler = (input, o, call) => {
      if (call.label !== 'roommate introduction') return m.defaultHandler(input, o, call);
      const pad = Array.from({ length: 70 }, () => 'the room smells of clover and hay').join(' ');
      return mode === 'lower' ? pad + '.' : mode === 'other' ? pad + '. "Clover Ashby," she says. ' + other + ' waves from the corridor.' : m.defaultHandler(input, o, call);
    }; };
    const h = await begin({ setup, rmSpecies: 'rabbit', rmName: 'Clover Ashby', rmGender: 'female' });
    try {
      assert.match(statusText(h), /could not be used/, 'a lower-case "clover" does not name Clover: ' + statusText(h));
      assert.notEqual(onlyAdv(h.mock.store).data.opening.introWritten, true);
      other = onlyAdv(h.mock.store).data.cast.generated.characters.find((c) => !/^(Dean|Professor|Dr|Mr|Mrs|Mx|Master|Warden)\b/.test(c.name)).name; mode = 'other';
      h.click(statusButtons(h).find((b) => /Write the introduction again/.test(b.textContent))); assert(await h.idle(20000)); await h.settle(100, 3000);
      assert.match(statusText(h), /could not be used/, 'an intro that brings in ' + other + ' is not used: ' + statusText(h));
      mode = 'default';
      h.click(statusButtons(h).find((b) => /Write the introduction again/.test(b.textContent))); assert(await h.idle(20000)); await h.settle(100, 3000);
      assert.equal(onlyAdv(h.mock.store).data.opening.introWritten, true, 'one that names her is used');
      clean(h);
    } finally { h.close(); }
  },

  // 35. The cast does not repeat itself: across the roommate and the fifteen people of the cast no temperament or habit is drawn
  // twice, no drawn student (the roommate included) takes a course a cast role holds, and no two students draw the same course.
  async castDoesNotRepeat() {
    const W0 = loadWorld(), fixed = new Set(W0.castRoles.map((r) => String(r.course || '').toLowerCase()).filter(Boolean));
    const dupes = (arr) => arr.filter((x, i) => x && arr.indexOf(x) !== i);
    for (let run = 0; run < 3; run++) {
      const setup = (w, m) => { m.sampleHandler = (input, o, call) => { if (call.label === 'cast invention') throw { code: 'overloaded', message: 'pools only' }; return m.defaultHandler(input, o, call); }; };
      const h = await begin({ setup, rmSpecies: 'cow' });
      try {
        const d = onlyAdv(h.mock.store).data, cs = d.cast.generated.characters, rg = d.roommate.gen;
        const people = [rg].concat(cs.map((c) => c.gen));
        assert.deepEqual(dupes(people.map((g) => g.temperament)), [], 'run ' + run + ': a temperament is repeated');
        assert.deepEqual(dupes(people.map((g) => g.quirk)), [], 'run ' + run + ': a habit is repeated');
        assert(!fixed.has(String(rg.course).toLowerCase()), 'run ' + run + ': the roommate shares a cast role\'s course: ' + rg.course);
        const drawn = [rg.course].concat(W0.castRoles.map((r, i) => (!r.course && !/staff/.test(String(r.year || '')) ? cs[i].gen.course : '')));
        assert.deepEqual(dupes(drawn.map((x) => String(x || '').toLowerCase())), [], 'run ' + run + ': two students draw the same course');
        assert.deepEqual(drawn.filter((x) => fixed.has(String(x || '').toLowerCase())), [], 'run ' + run + ': a drawn student takes a course a cast role holds');
        clean(h);
      } finally { h.close(); }
    }
  },

  // 35b. The cast's kinds are dealt for balance, not drawn role by role: over forty seeded creations every kind a role's list allows
  // is someone (the roommate and the fixed roles counted), no kind is drawn more than twice among the list roles, the werewolves
  // come out at least one a game on average, and bovines no more than the Creamery's, the roommate's and two more.
  async castKindsBalanced() {
    const W0 = loadWorld(), roles = W0.castRoles.concat(W0.minorRoles || []), listed = new Set(roles.filter((r) => Array.isArray(r.species)).map((r) => r.key));
    const drawable = [...new Set(roles.filter((r) => Array.isArray(r.species)).flatMap((r) => r.species))];
    const fixedCow = roles.filter((r) => r.species === 'cow').length;
    const setup = (w, m) => { m.sampleHandler = (input, o, call) => { if (call.label === 'cast invention') throw { code: 'overloaded', message: 'pools only' }; return m.defaultHandler(input, o, call); }; };
    const RUNS = 40, base = (global.__WL_SEED || 1) >>> 0; let wolves = 0, cows = 0, cowCap = 0;
    for (let run = 0; run < RUNS; run++) {
      // Most games take the default roommate (a bovine); every fourth names a fox, so the roommate's kind is seen to count.
      const h = await begin(Object.assign({ setup, seed: (base + run * 7919) >>> 0 }, run % 4 === 3 ? { rmSpecies: 'fox' } : {}));
      try {
        const d = onlyAdv(h.mock.store).data, gen = d.cast.generated, people = gen.characters.concat(gen.minors), rm = d.roommate.species;
        const kinds = people.map((p) => p.species).concat([rm]), count = (k, xs) => xs.filter((x) => x === k).length;
        const missing = drawable.filter((k) => !kinds.includes(k));
        assert.deepEqual(missing, [], 'run ' + run + ': a kind the lists allow is nobody: ' + missing + ' (' + kinds.join(', ') + ')');
        const drawn = people.filter((p) => listed.has(p.key)).map((p) => p.species);
        const over = [...new Set(drawn)].filter((k) => count(k, drawn) > 2);
        assert.deepEqual(over, [], 'run ' + run + ': drawn more than twice among the list roles: ' + over.map((k) => k + ' x' + count(k, drawn)).join(', '));
        wolves += count('wolf', people.map((p) => p.species)); cows += count('cow', kinds); cowCap += fixedCow + (rm === 'cow' ? 1 : 0) + 2;
        clean(h);
      } finally { h.close(); }
    }
    assert(wolves / RUNS >= 1, 'werewolves average at least one a game in the cast: ' + (wolves / RUNS).toFixed(2));
    assert(cows / RUNS <= cowCap / RUNS, 'bovines average at most the Creamery, the roommate and two: ' + (cows / RUNS).toFixed(2) + ' > ' + (cowCap / RUNS).toFixed(2));
  },

  // 36. The plain stand-in for the roommate's introduction agrees with its room (no card on a bed the room has already slept on or
  // put a towel on), shows the kind's own body (ears, tail, hands) in phrases, not "label: value" lines and never "the person's own" face,
  // and gives the full name once, with no fixed barbed line.
  async fallbackIntroFits() {
    for (const kind of ['fox', 'mer', 'cow', 'fairy', 'goblin']) {
      const setup = (w, m) => { w.Math.random = () => 0.1; m.sampleHandler = (input, o, call) => { if (call.label === 'roommate introduction') throw { code: 'overloaded', message: 'busy' }; return m.defaultHandler(input, o, call); }; };
      const h = await begin({ setup, rmSpecies: kind });
      try {
        const d = onlyAdv(h.mock.store).data, n = d.opening.narrative, name = d.roommate.name;
        assert.notEqual(d.opening.introWritten, true, 'setup: the plain introduction stands');
        if (kind === 'fox' || kind === 'mer') { assert.match(n, /\byour (own )?bed\b/i, 'setup: the ' + kind + ' room speaks of the bed'); assert.doesNotMatch(n, /card on the pillow/, kind + ': a second thing on the same bed'); }
        if (kind === 'cow') assert.match(n, /cow ears|the tail to|hooved fingers/, 'the cow\'s own body is shown: ' + n.slice(0, 600));
        assert.doesNotMatch(n, /\b(ears|horns|tail|wings|hands|face|bark|nipples|in season): /i, kind + ': the body in phrases, not labels: ' + n.slice(0, 600));
        assert.doesNotMatch(n, /person's own/, kind + ': no engine phrase for a human face: ' + n.slice(0, 600));
        assert.equal(n.split(name).length - 1, 1, kind + ': the full name once: ' + n.slice(0, 600));
        assert.doesNotMatch(n, /hold it against you/, kind + ': no fixed barbed line');
        clean(h);
      } finally { h.close(); }
    }
  },

  // 37. The form's names: a random player name follows the gender picked (no man's name for a woman, only shared names for a
  // non-binary player), typed names are tidied, and the roommate name's button says it leaves the name to Begin.
  async creationNames() {
    const by = loadWorld().namePools.byGender || { male: ['Toby', 'Felix', 'Theo', 'Jonas', 'Owen', 'Ivo'], female: ['Nika', 'Iris', 'Mara', 'Leah', 'Petra'] };
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000));
      const draws = (g) => { h.$('#cGender').value = g; h.$('#cGender').dispatchEvent(new h.window.Event('change')); const out = []; for (let i = 0; i < 25; i++) { h.click('#dlgCreate [data-rand="name"]'); out.push(h.$('#cName').value.split(' ')[0]); } return out; };
      const women = draws('female'), nb = draws('nonbinary');
      assert.deepEqual(women.filter((n) => by.male.includes(n)), [], 'a woman gets no man\'s name');
      assert.deepEqual(nb.filter((n) => by.male.includes(n) || by.female.includes(n)), [], 'a non-binary player gets the shared names');
      assert.equal(h.$('#dlgCreate [data-rand="rmName"]').textContent, 'Invent at Begin', 'the button that empties the roommate name says why');
      h.$('#cGender').value = 'male'; h.$('#cGender').dispatchEvent(new h.window.Event('change'));
      h.type('#cName', '  Owen   Pryce '); h.type('#cRmSpecies', 'cow'); h.type('#cRmName', ' Daisy  Clover ');
      h.click('#cBegin'); assert(await h.idle(30000)); await h.settle(150, 4000);
      const d = onlyAdv(h.mock.store).data;
      assert.equal(d.player.first, 'Owen'); assert.equal(d.player.last, 'Pryce'); assert.equal(d.player.name, 'Owen Pryce');
      assert.equal(d.creation.rmName, 'Daisy Clover', 'the roommate name is stored tidy');
      clean(h);
    } finally { h.close(); }
  },

  // 38. A roommate introduction that gives the body a line of another column than this person's (four hooved fingers where Looks gives
  // two and a thumb) is asked for again, naming the phrase; the second draft, true to Looks, is the one used.
  async introKeepsToLooks() {
    // The three columns of the cow's hand row, as the world gives them now; the mock picks one the roommate's Looks does not have.
    const hands = Object.values(loadWorld().transformation.tracks.species.cow.find((t) => t.key === 'hands').range);
    let wrong = '';
    const setup = (w, m) => { m.sampleHandler = (input, o, call) => {
      if (call.label !== 'roommate introduction' || /Your draft said/.test(input)) return m.defaultHandler(input, o, call);
      const looks = ((/Looks: ([\s\S]*?)\. (?:Not on this body|Dress):/.exec(input) || [])[1] || '').toLowerCase();
      wrong = hands.find((x) => !looks.includes(x.toLowerCase().split(' ').slice(0, 4).join(' ')));
      return m.defaultHandler(input, o, call) + ' Her hands are ' + wrong.toLowerCase() + '.';
    }; };
    const h = await begin({ setup, rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female' });
    try {
      const calls = h.mock.sampleCalls.filter((c) => c.label === 'roommate introduction');
      assert.equal(calls.length, 2, 'the draft with another column\'s hands is asked for again');
      assert(promptOf(calls[1]).includes('Your draft said "' + wrong.toLowerCase().split(' ').slice(0, 4).join(' ') + '"'), 'the second ask names the phrase');
      const d = onlyAdv(h.mock.store).data;
      assert.equal(d.opening.introWritten, true, 'the second draft is used'); assert.doesNotMatch(d.opening.narrative, new RegExp(wrong, 'i'));
      clean(h);
    } finally { h.close(); }
  },
  // 39. A name typed in lower case is a name: "daisy clover" is stored as Daisy Clover, and an introduction that writes a typed name
  // with a capital ("rory McKay" as Rory McKay) names the roommate, while a lower-case "clover" still does not (34).
  async introTypedLowerCase() {
    let typed = '';
    const setup = (w, m) => { m.sampleHandler = (input, o, call) => (call.label === 'roommate introduction' && typed ? m.defaultHandler(input, o, call).split(typed).join('Rory McKay').split('rory').join('Rory') : m.defaultHandler(input, o, call)); };
    let h = await begin({ setup, name: 'owen pryce', rmSpecies: 'cow', rmName: 'daisy clover' });
    try {
      const d = onlyAdv(h.mock.store).data;
      assert.equal(d.player.name, 'Owen Pryce', 'a lower-case player name is capitalised'); assert.equal(d.roommate.name, 'Daisy Clover', 'and the roommate\'s');
      assert.equal(d.opening.introWritten, true, 'the introduction naming Daisy Clover is used: ' + statusText(h));
      clean(h);
    } finally { h.close(); }
    typed = 'rory McKay';
    h = await begin({ setup, rmSpecies: 'cow', rmName: typed });
    try {
      const d = onlyAdv(h.mock.store).data;
      assert.equal(d.roommate.name, typed, 'a name with a capital is left as typed');
      assert.equal(d.opening.introWritten, true, 'an introduction writing it as Rory McKay names the roommate: ' + statusText(h));
      assert.match(d.opening.narrative, /Rory McKay/);
      clean(h);
    } finally { h.close(); }
  },
  // A roommate typed as human is drawn from the human pool as the human cast is: looks of her own, an aim with no "kind" in it,
  // and an introduction that is not a first meeting with a non-human. "a human" is the same person, and no kind is met.
  async humanRoommate() {
    for (const typed of ['human', 'a human']) {
      const h = await begin({ rmSpecies: typed, rmName: 'Ada Morrow', rmGender: 'female' });
      try {
        const d = onlyAdv(h.mock.store).data, r = d.roommate, looks = r.looks || (r.gen && r.gen.looks) || '';
        assert.equal(r.species, 'human', typed + ': the roommate is of the human pool');
        assert.equal(r.race, 'Human', typed + ': and is called human');
        assert(looks.length > 40, typed + ': the roommate has looks: ' + JSON.stringify(looks));
        const ip = promptOf(h.mock.sampleCalls.find((c) => c.label === 'roommate introduction'));
        assert(ip.includes(' Looks: ' + looks.slice(0, 20)), typed + ': the introduction carries her looks');
        assert.doesNotMatch(ip, /arm's reach of an? (?:a )?human|body that is not|non-human parts/, typed + ': the introduction meets a non-human: ' + ip.slice(0, 200));
        assert.doesNotMatch(JSON.stringify(r), /toward \w+ kind|wherever \w+ kind gather/, typed + ': her aim and her places speak of a kind');
        assert(!(d.state.met || []).some((k) => /human/.test(k)), typed + ': a human is no kind met: ' + JSON.stringify(d.state.met));
        assert(await h.turn('I sit with Ada.'), typed + ': a turn with her did not finish');
        assert(!('human' in onlyAdv(h.mock.store).data.state.tf.influence), typed + ': time with a human roommate is no influence toward a kind');
        clean(h);
      } finally { h.close(); }
    }
  },

  // The introduction's check for a line of the body Looks does not give reads Looks' commas and the world's colons alike: a draft
  // that writes the roommate's own face in the world's wording ("a faint cast: a broad soft nose") is kept on the first ask, and one
  // that gives her another column's face in Looks' wording ("a faint cast, a broad soft nose") is asked for again.
  async introStrayPunctuation() {
    const seen = { own: false, other: false };
    for (let s = 1; s <= 16 && !(seen.own && seen.other); s++) {
      let own = null;
      const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female', seed: 9300 + s, setup(w, m) {
        m.sampleHandler = (input, o, call) => {
          const out = m.defaultHandler(input, o, call); if (call.label !== 'roommate introduction') return out;
          const p = promptOf(call), looks = (/ Looks: ([\s\S]*?)\. (?:Not on this body|Dress):/.exec(p) || [])[1] || '';
          if (own === null) { own = /a faint cast/.test(looks); return out + ' Her face has a faint cast' + (own ? ':' : ',') + ' a broad soft nose, the jaw slightly forward.'; }
          return out;
        };
      } });
      try {
        if ((own && seen.own) || (!own && seen.other)) continue;
        const calls = h.mock.sampleCalls.filter((c) => c.label === 'roommate introduction'), d = onlyAdv(h.mock.store).data;
        if (own) {
          seen.own = true;
          assert.equal(calls.length, 1, 'her own face in the world\'s wording is asked for again: ' + (calls[1] ? (/Your draft said "[^"]*"/.exec(promptOf(calls[1])) || [''])[0] : ''));
          assert.equal(d.opening.introWritten, true, 'and the draft is kept');
        } else {
          seen.other = true;
          assert.equal(calls.length, 2, 'another column\'s face in Looks\' wording is not caught');
          assert.match(promptOf(calls[1]), /Your draft said "a faint cast a"/, 'the second ask names the phrase');
          assert.equal(d.opening.introWritten, true, 'and the second draft, without it, is kept');
        }
        clean(h);
      } finally { h.close(); }
    }
    assert(seen.own && seen.other, 'the test needs a roommate with the faint-cast face and one without: ' + JSON.stringify(seen));
  },

  // 40. A change of gender redraws only a drawn name: an invention under way starts again for the new gender (it is not silently
  // stopped), and the name it gives stays when the gender changes again.
  async genderKeepsInvention() {
    const held = [];
    const h = await boot({ setup(w, m) { m.sampleHandler = (input, o, call) => (call.label === 'cast invention' && /^- player: /m.test(promptOf(call)) ? new Promise((r) => held.push(() => r(m.defaultHandler(input, o, call)))) : m.defaultHandler(input, o, call)); } });
    try {
      assert(await h.settle(150, 6000));
      const gender = (g) => { h.$('#cGender').value = g; h.$('#cGender').dispatchEvent(new h.window.Event('change')); };
      const until = async (n) => { for (let i = 0; i < 100 && held.length < n; i++) await h.sleep(50); };
      gender('male'); h.click('#cInventPlayer'); await until(1);
      assert.equal(held.length, 1, 'setup: the invention is under way: ' + h.$('#cNote').textContent + ' | calls: ' + h.mock.sampleCalls.map((c) => c.label).join(','));
      gender('female'); await until(2);
      assert.equal(held.length, 2, 'the change of gender starts the invention again rather than stopping it');
      const asked = h.mock.sampleCalls.filter((c) => /^- player: /m.test(promptOf(c))).map((c) => (/^- player: human, (a man|a woman)/m.exec(promptOf(c)) || [])[1]);
      assert.deepEqual(asked, ['a man', 'a woman'], 'the second invention is for the new gender');
      held.forEach((f) => f()); await h.settle(150, 4000);
      const invented = h.$('#cName').value;
      assert.match(h.$('#cNote').textContent, /Invented fresh/, 'setup: the invention filled the form: ' + h.$('#cNote').textContent);
      gender('nonbinary'); gender('male');
      assert.equal(h.$('#cName').value, invented, 'the invented name stays when the gender changes');
      clean(h);
    } finally { h.close(); }
  },

  // 28a. A person's looks go whole the turn they come onto the page, when the action names them and through a romance scene; after
  // a turn whose narration already showed them, the cast line keeps a short line (the height and build, the hair, the eyes) and
  // what is not on the body, so the narration is held to a detail, not a survey. What no body on the Isle has is in <rules> and
  // not beside every person; the rule that a feature comes back only when it acts, is touched or the action looks at it is in the prompt.
  async looksShortLine() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', name: 'Tom Ashby' });
    try {
      patchTurns(h, (r) => { r.narrative = 'Daisy looks up from the bed and smiles. ' + r.narrative; r.state_updates = []; r.time_advance_minutes = 5; });
      const line = () => (promptOf(lastTurn(h)).match(/^- Daisy Holm[^\n]*/m) || [''])[0];
      const looksOf = () => { const rm = onlyAdv(h.mock.store).data.roommate; return rm.looks || (rm.gen && rm.gen.looks) || ''; };
      assert(await h.turn('I look at Daisy.'));
      assert.match(line(), /Looks: About [^.;]*; \w+, with /, 'named by the action: the looks go whole: ' + line().slice(0, 200));
      assert.match(promptOf(lastTurn(h)), /Once someone is on the page, a feature comes back only when it acts, is touched or the action looks at it\./, 'the appearance rule says once is enough, and a feature the player looks at comes back');
      assert.doesNotMatch(line(), /Not on this body: [^.]*paws in place of hands/, 'what no body here has is not beside her: ' + (line().match(/Not on this body: [^.]*/) || [''])[0]);
      const notOnWhole = (line().match(/ Not on this body: [^.]*\./) || [''])[0];
      assert.match(promptOf(lastTurn(h)), /Every kind keeps working hands; nobody takes an animal's whole shape or changes with the moon/, 'it is in the rules');
      assert(await h.turn('I unpack my bag.'));
      assert.match(line(), /Looks \(shown last turn\): About [^.;]+; \w+, with [^.]*\. [^.]*\beyes\b[^.]*\. /, 'shown by the last turn and not named: the paragraph, marked as shown: ' + line().slice(0, 300));
      assert.doesNotMatch(line(), /Looks: About/, 'and not as new');
      // Shown is not less: the paragraph goes whole, every part and every absence of the body in it, and no label.
      const whole = looksOf();
      assert(/\budder\b/.test(whole) && /\bhooves\b/.test(whole), 'the cow\'s whole look has her udder and hooves: ' + whole);
      assert(line().includes('Looks (shown last turn): ' + whole), 'the paragraph is kept whole in the shown line: ' + line());
      assert.doesNotMatch(whole, /(?:^|\. )(?:Height|Build|Hair|Eyes|Hide|Hands|Legs|Feet|Tail|Bust|Teats and udder): /, 'and carries no label: ' + whole);
      const no = (/(?:^|\. )(No [a-z][^.]*\.)\s*$/.exec(whole) || [])[1] || '';
      assert(no || notOnWhole, 'the whole look closes with what is not on the body: ' + whole);
      assert(line().includes(no + notOnWhole + ' Dress: '), 'the closing must-nots (' + no + ') and the absences (' + notOnWhole + ') as with the whole look, then the dress: ' + line().slice(-500));
      assert.match(promptOf(lastTurn(h)), /and nobody remarks on the fit; no two in one scene/, 'the dress rule says what nobody remarks on');
      assert(await h.turn('I kiss her on the mouth.'));
      assert.match(line(), /Looks: About [^.;]*; \w+, with /, 'a romance scene gets the whole look, named or not: ' + line().slice(0, 200));
      // Named in a narration she was not on the page for (a text from her), she comes in: the whole look, not the short line.
      patchTurns(h, (r) => { r.narrative = 'Your phone buzzes: Daisy says she is on her way up. ' + r.narrative; r.state_updates = [{ key: 'present', op: 'set', value: [] }]; r.time_advance_minutes = 5; });
      assert(await h.turn('I sit down at the desk.'));
      patchTurns(h, (r) => { r.narrative = 'Daisy comes in and drops her bag. ' + r.narrative; r.state_updates = [{ key: 'present', op: 'set', value: ['Daisy Holm'] }]; r.time_advance_minutes = 5; });
      assert(await h.turn('I wait.'));
      assert(await h.turn('I open a book.'));
      assert.match(line(), /Looks: About [^.;]*; \w+, with /, 'on the page this turn but not from the start of the last: the whole look: ' + line().slice(0, 200));
      clean(h);
    } finally { h.close(); }
  },

  // The action looking at someone without their name, "describe her", "I look her over", "what does she look like", "a good look
  // at my roommate", is the action looking at them: the look goes whole, as it does when the action names them.
  async looksAskedByPronoun() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', name: 'Tom Ashby' });
    try {
      patchTurns(h, (r) => { r.narrative = 'Daisy looks up from the bed and smiles. ' + r.narrative; r.state_updates = []; r.time_advance_minutes = 5; });
      const line = () => (promptOf(lastTurn(h)).match(/^- Daisy Holm[^\n]*/m) || [''])[0];
      assert(await h.turn('I look at Daisy.'));
      assert(await h.turn('I unpack my bag.'));
      assert.match(line(), /Looks \(shown last turn\): /, 'setup: shown by the last turn and not named: ' + line().slice(0, 200));
      for (const action of ['I look her over.', 'Describe her.', 'What does she look like?', 'I take a good look at my roommate.', 'I look at her closely, head to toe.']) {
        assert(await h.turn(action));
        assert.match(line(), /Looks: About [^.]*\. [A-Z]/, 'the action looks at her by a pronoun or the role, so the look goes whole on "' + action + '": ' + line().slice(0, 200));
      }
      // Her bag, or a pronoun nobody here answers to, is not a look at her.
      for (const action of ['I look at her bag.', 'I look at him.', 'I put the kettle on.']) {
        assert(await h.turn(action));
        assert.match(line(), /Looks \(shown last turn\): /, '"' + action + '" does not look at her: ' + line().slice(0, 200));
      }
      clean(h);
    } finally { h.close(); }
  },

  // A line written by hand after the look's closing "No ..." sentence survives the short form the turn after she is shown.
  async looksShortKeepsTrailingLine() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    const sheetOf = () => (blockOf(promptOf(lastTurn(h)), 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '');
    const looksOf = (line) => (/ Looks(?: \(shown last turn\))?: (.*?) (?:Not on this body:|Dress:)/.exec(line) || [])[1] || '';
    try {
      patchTurns(h, (r) => { r.narrative = 'May Tanaka sits on her bed across the room. ' + r.narrative; });
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'May Tanaka', 'the Cast screen opens on the roommate');
      const el = h.$('#cfLooks'); assert.match(el.value, /\. No [a-z][^.]*\.$/, 'setup: the drawn look closes with its must-nots: ' + el.value.slice(-120));
      el.value = el.value + ' A long pale scar runs down her left cheek.'; el.dispatchEvent(new h.window.Event('input', { bubbles: true }));
      h.click('#cfSave'); assert(await h.idle(10000)); h.click('[data-close="dlgCast"]');
      assert(await h.turn('I look at May.'));
      assert(looksOf(sheetOf()).endsWith('A long pale scar runs down her left cheek.'), 'named by the action: the whole look, the line at its end: ' + looksOf(sheetOf()).slice(-200));
      assert(await h.turn('I unpack my bag.'));
      assert.match(sheetOf(), / Looks \(shown last turn\): /, 'shown by the last turn and not named: the short form: ' + sheetOf().slice(0, 200));
      assert.match(looksOf(sheetOf()), /\. No [a-z][^.]*\. A long pale scar runs down her left cheek\.$/, 'which keeps the must-nots and the hand-written line: ' + looksOf(sheetOf()).slice(-200));
      clean(h);
    } finally { h.close(); }
  },

  // 28b. The body line names in full only the parts moving now (the three told most recently, and any the action names; every part
  // when the action looks the body over); the rest of the parts under way are a name and a waypoint, so a long game's body never
  // becomes a list of seventeen lines to recite.
  async bodyNowMoving() {
    const T = loadWorld().transformation.tracks.species.cow;
    // An older save's parts carry only the time of their next waypoint (a step's gap, 90 minutes here, after they were told); Hands was
    // told last, under this version, and carries when.
    const T0 = 1e6, set = {}; for (const [i, key] of ['hands', 'forearm_coat', 'leg_and_hip_coat', 'toes_and_hooves', 'spine_strip', 'tail', 'ears', 'nose_and_face', 'eyes', 'voice'].entries()) set[key] = { told: 1, nextAt: T0 + i * 5 };
    set.hands = { told: 1, at: T0 + 1, nextAt: T0 + 1000 };
    const { h } = await seededTf({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' }, () => baseTf('cow', 60, { lean: 0, face: 15, tracks: heldParts(T, set) }), { pace: 'standard' });
    try {
      const body = () => { const p = promptOf(lastTurn(h)); return (p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>')).split('\n').find((l) => /^Body now \(/.test(l)) || ''); };
      const whole = (b) => (b.match(/\(\d+ of \d+\): /g) || []).length, brief = (b) => (b.match(/\b[A-Z][a-z ]+ \d+\/\d+[;.]/g) || []).length;
      assert(await h.turn('I unpack.'));
      assert(whole(body()) <= 3 && brief(body()) >= 7, 'three parts in full, the rest by name and waypoint: ' + body());
      assert.match(body(), /Voice \(1 of \d+\): /, 'the part told last is one of the three: ' + body());
      assert.match(body(), /Hands \(1 of \d+\): /, 'a part told with its time beats the older save\'s parts told before it: ' + body());
      assert(await h.turn('I feel my ears.'));
      assert.match(body(), /Ears \(1 of \d+\): /, 'a part the action names is given in full: ' + body());
      assert(await h.turn('I look at myself in the mirror.'));
      assert(whole(body()) === 10 && brief(body()) === 0, 'looking the body over gives every part in full: ' + body());
      // The short form of the block (a shed prompt) still keeps the changes present in ordinary life, not only when a part is used.
      assert(await h.turn('I walk the long way round. ' + 'The path winds past the Creamery and on along the old wall by the river, and I take it slowly. '.repeat(200)));
      assert(storedTurns(h.mock.store, onlyAdv(h.mock.store).id).at(-1).notes.some((n) => /transformation block in its short form/.test(n)), 'the prompt was compacted');
      assert.match(promptOf(lastTurn(h)), /Story thread: established changes and reflexes stay present in ordinary life, one or two a turn where the scene uses that part, never as a list\./, 'the short story thread keeps the changes present');
      clean(h);
    } finally { h.close(); }
  },

  // 28c. The kind's close-range notes are dealt round the cast: no two people of a kind (the roommate among them) share a note
  // while the pool allows, so one person's "low unhurried voice" is not three people's.
  async closeUpDealt() {
    const W = loadWorld();
    for (let i = 0; i < 2; i++) {
      const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
      try {
        const d = onlyAdv(h.mock.store).data, people = [d.roommate].concat(d.cast.generated.characters, d.cast.generated.minors).filter((c) => c && c.species && c.senses);
        const byKind = {}; for (const c of people) (byKind[c.species] = byKind[c.species] || []).push(...String(c.senses).split('; '));
        for (const [k, notes] of Object.entries(byKind)) {
          const pool = (W.genPools.species[k] || {}).senses || []; if (!pool.length) continue;
          assert(new Set(notes).size >= Math.min(notes.length, pool.length), k + ': ' + notes.length + ' notes dealt from a pool of ' + pool.length + ' and only ' + new Set(notes).size + ' distinct: ' + JSON.stringify(notes));
        }
        clean(h);
      } finally { h.close(); }
    }
  },

  // 28. What the player knows: the player arrived knowing only that they once saw something they could not explain and were then
  // invited, so the first turn's prompt carries the rule that the narration uses no word of the Isle's (glamour, mythkin, a
  // kind's name) before someone tells the player it, <player> says nothing has been told yet, and nothing the player reads before
  // the first turn uses one. A reply's "Told: …" fact is the record: it goes to state.told, not the facts, and reaches the next
  // prompt's told line. The narrator using "glamour" outside speech before it was told gets a note on the turn, never a refusal;
  // a person saying the word is how the player is told, so speech gets none.
  async playerKnowledge() {
    const h = await begin({ name: 'Alex Rowan', rmSpecies: 'cow', rmName: 'Bess Alder' });
    try {
      const isle = /\b(glamours?|mythkin|harp(?:y|ies)|goblins?|werewol(?:f|ves)|fair(?:y|ies)|dryads?|merfolk)\b/i;
      const adv0 = onlyAdv(h.mock.store).data;
      assert(!isle.test(loadWorld().opening.narrative), 'the authored opening names a kind the player has no word for');
      assert(!/\b(glamour|mythkin)\b/i.test(adv0.opening.narrative), 'what the player reads before the first turn uses a word of the Isle\'s: ' + adv0.opening.narrative.slice(0, 200));
      for (const t of [adv0.player.description, adv0.memory.summary].concat(adv0.memory.events)) assert(!/\bglamour/i.test(t), 'the player\'s own record says they saw through a glamour: ' + t);
      let n = 0;
      patchTurns(h, (r) => {
        n += 1;
        if (n === 1) { r.narrative = 'Bess looks up from the kettle. "Below we wear a glamour," she says, "so nobody sees the horns." You look at the horns.'; r.facts = ['Told: a glamour is a worn seeming that hides a mythkin from human eyes below, as Bess put it', 'Bess keeps the kettle on the sill']; }
        if (n === 2) { r.narrative = 'Not a glamour, then: the horns are real. The porter was a goblin, you think, and the woman on the ledge has wings.'; r.facts = []; }
      });
      assert(await h.turn('I ask Bess about the horns.'), 'turn 1 did not finish');
      const p1 = promptOf(lastTurn(h));
      const rules = (/<rules>\n([\s\S]*?)\n<\/rules>/.exec(p1) || [])[1] || '';
      assert(/New here: Alex arrived knowing only this/.test(rules), 'the first turn\'s rules do not say what the player arrived knowing');
      const player1 = (/<player[^>]*>\n([\s\S]*?)\n<\/player>/.exec(p1) || [])[1] || '';
      assert(/What Alex has been told so far: nothing yet\./.test(player1), '<player> does not say nothing has been told yet: ' + player1.slice(0, 300));
      assert(!/\bglamour/i.test(player1), '<player> tells the narrator the player saw through a glamour');
      assert(/a "Told: …" line for each word or working of this place explained to Alex this turn/.test(p1), 'the output format does not ask for the Told: lines');
      const id = onlyAdv(h.mock.store).id, t1 = storedTurns(h.mock.store, id)[0];
      assert.deepEqual(t1.stateAfter.told, ['a glamour is a worn seeming that hides a mythkin from human eyes below, as Bess put it'], 'the Told: fact is not the record in state: ' + JSON.stringify(t1.stateAfter.told));
      assert.deepEqual(t1.facts, ['Bess keeps the kettle on the sill'], 'the Told: line is kept among the facts too: ' + JSON.stringify(t1.facts));
      assert(t1.notes.some((x) => /^told: a glamour is a worn seeming/.test(x)), 'the turn does not note what was told: ' + JSON.stringify(t1.notes));
      assert(!t1.notes.some((x) => /the narrator used/.test(x)), 'a person saying the word was noted as the narrator\'s slip: ' + JSON.stringify(t1.notes));
      assert(await h.turn('I look at the horns.'), 'turn 2 did not finish');
      const player2 = (/<player[^>]*>\n([\s\S]*?)\n<\/player>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
      assert(/What Alex has been told so far: a glamour is a worn seeming that hides a mythkin from human eyes below, as Bess put it\./.test(player2), 'the told line does not carry the stored fact: ' + player2.slice(0, 400));
      const t2 = storedTurns(h.mock.store, id)[1];
      assert(t2.notes.includes('the narrator used "goblin" before anyone told Alex the word'), 'a kind named before it was told is not noted: ' + JSON.stringify(t2.notes));
      assert(!t2.notes.some((x) => /used "(glamour|mythkin|harpy)"/.test(x)), 'a word told (glamour, mythkin) or not used (harpy) was noted: ' + JSON.stringify(t2.notes));
      assert(h.$('#learned').textContent.includes('a glamour is a worn seeming'), 'the Character sheet does not show what has been told');
      clean(h);
    } finally { h.close(); }
  },

  // 28b. The words the player has never drop: glamour, explained on the first turn, stays among the words <player> carries and
  // stays unflagged after twenty-one more explanations push its line out of the told list (which keeps the newest twenty).
  // Undo puts the told record back as it was before the undone turn.
  async toldKeepsWords() {
    const h = await begin({ name: 'Alex Rowan', rmSpecies: 'cow', rmName: 'Bess Alder' });
    try {
      let n = 0;
      patchTurns(h, (r) => {
        n += 1;
        if (n === 1) r.facts = ['Told: a glamour is a worn seeming that hides someone from human eyes below, as Bess put it'];
        else if (n <= 8) r.facts = [1, 2, 3].map((k) => 'Told: house rule ' + n + '.' + k + ' of Kettle Hall, as the warden put it');
        else r.narrative = 'The glamour on the porter flickers as he turns.';
      });
      for (let i = 1; i <= 9; i++) assert(await h.turn('I listen.'), 'turn ' + i + ' did not finish');
      const id = onlyAdv(h.mock.store).id, turns = storedTurns(h.mock.store, id), t9 = turns.at(-1);
      assert(!t9.stateBefore.told.some((l) => /glamour/.test(l)), 'the test needs the glamour line pushed out of the told list');
      const player9 = (/<player[^>]*>\n([\s\S]*?)\n<\/player>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
      assert(/\bglamour\b/.test(player9), 'the first word explained is gone from <player> once newer explanations fill the list: ' + player9.slice(-600));
      assert(/house rule 8\.3/.test(player9) && !/house rule 3\.1/.test(player9), 'the told line carries more than the newest explanations: ' + player9.slice(-600));
      assert(!t9.notes.some((x) => /the narrator used "glamour"/.test(x)), 'a word told on the first turn is flagged on the ninth: ' + JSON.stringify(t9.notes));
      const before = JSON.stringify(t9.stateBefore.told);
      h.click('#undo'); assert(await h.idle(20000), 'the undo did not finish'); await h.settle(100, 4000);
      assert.equal(JSON.stringify(onlyAdv(h.mock.store).data.state.told), before, 'undo does not put the told record back');
      clean(h);
    } finally { h.close(); }
  },

  // 28c. A word the player hears said aloud or uses himself is his from then on: the roommate saying "mythkin" in the written
  // introduction, and the player typing "the Spa" in an action, let the narration use those words, on that turn and later ones,
  // with no note; a word nobody has said (goblin) is still noted.
  async toldFromSpeechAndAction() {
    const intro = 'Bess Alder looks up from a half-unpacked box. "Bess," she says. "Mythkin, before you ask, and yes, the ears are real." ' + 'She sets the box down by the window and goes back to sorting the books inside it, one by one, spine out, while the kettle on the sill begins to tick. '.repeat(3);
    const h = await begin({ name: 'Alex Rowan', rmSpecies: 'cow', rmName: 'Bess Alder', setup(w, m) { m.sampleHandler = (input, o, call) => (call.label === 'roommate introduction' ? intro : m.defaultHandler(input, o, call)); } });
    try {
      let n = 0;
      patchTurns(h, (r) => {
        n += 1; r.facts = [];
        r.narrative = n === 1 ? 'Bess shrugs. The Spa keeps its own hours, and every mythkin on the floor knows them.' : 'The Spa is lit at the far end of the lake, and the mythkin by the door is a goblin.';
      });
      assert(await h.turn('I ask Bess whether the Spa is open late.'), 'turn 1 did not finish');
      assert(await h.turn('I look out of the window.'), 'turn 2 did not finish');
      const id = onlyAdv(h.mock.store).id, [t1, t2] = storedTurns(h.mock.store, id);
      for (const [t, k] of [[t1, 1], [t2, 2]]) assert(!t.notes.some((x) => /the narrator used "(the Spa|mythkin)"/.test(x)), 'turn ' + k + ' flags a word the player heard or used: ' + JSON.stringify(t.notes));
      assert(t2.notes.includes('the narrator used "goblin" before anyone told Alex the word'), 'a word nobody said is no longer noted: ' + JSON.stringify(t2.notes));
      const player2 = (/<player[^>]*>\n([\s\S]*?)\n<\/player>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
      assert(/Words of this place Alex has: [^\n]*\bmythkin\b/.test(player2) && /Words of this place Alex has: [^\n]*\bthe Spa\b/.test(player2), '<player> does not carry the words heard or used: ' + player2.slice(-400));
      clean(h);
    } finally { h.close(); }
  },

  // Words of the Isle the player typed at creation are the player's own from the start: a goblin in the glimpse, mythkin in the
  // background and the Spa in the personality are among the words <player> carries, the narration may use them with no note, the
  // Learned panel lists them, and the roommate's introduction names them rather than saying the player has no word for any of it.
  async toldFromCreationWords() {
    const h = await begin({ name: 'Owen Pryce', rmSpecies: 'cow', rmName: 'Daisy Clover', glimpse: 'A goblin behind a shop counter', background: 'A river town where people called the odd ones mythkin', personality: 'Talks about the Spa as if it were a rumour.' });
    try {
      const d = onlyAdv(h.mock.store).data;
      for (const w of ['goblin', 'mythkin', 'the Spa']) assert((d.state.toldWords || []).includes(w), 'the word "' + w + '" typed at creation is the player\'s: ' + JSON.stringify(d.state.toldWords));
      const ip = blockOf(promptOf(h.mock.sampleCalls.find((c) => c.label === 'roommate introduction')), 'player');
      assert.doesNotMatch(ip, /has no word for any of it/, 'the introduction says the player has no word for what the player typed: ' + ip.slice(-400));
      assert.match(ip, /own: [^\n]*\bgoblin\b/, 'and names the player\'s own words: ' + ip.slice(-400));
      patchTurns(h, (r) => { r.facts = []; r.narrative = 'The goblin from the counter is not here; the Spa is lit across the lake, and the mythkin in the hall keep their voices low. ' + r.narrative; });
      assert(await h.turn('I look around.'));
      const t = storedTurns(h.mock.store, onlyAdv(h.mock.store).id).at(-1);
      assert(!t.notes.some((x) => /the narrator used "(?:goblin|mythkin|the Spa)"/.test(x)), 'a word the player typed is flagged as untold: ' + JSON.stringify(t.notes));
      assert.match(blockOf(promptOf(lastTurn(h)), 'player'), /Words of this place Owen has: [^\n]*\bgoblin\b/, '<player> carries the words typed at creation');
      const li = [...h.document.querySelectorAll('#learned li')].find((x) => (x.querySelector('span') || {}).textContent === 'Words');
      const words = li ? li.textContent.slice('Words'.length) : '';
      assert(/\bgoblin\b/.test(words) && /\bmythkin\b/.test(words), 'the Learned panel lists them: ' + h.$('#learned').textContent.slice(0, 300));
      clean(h);
    } finally { h.close(); }
  },

  // A save made before the words typed at creation were recorded has them on loading: the goblin of the glimpse is among the
  // words <player> carries, and the narration may use it with no note.
  async toldCreationWordsOldSave() {
    const first = await begin({ name: 'Owen Pryce', rmSpecies: 'cow', rmName: 'Daisy Clover', glimpse: 'A goblin behind a shop counter' }); let store;
    try { store = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = store.get(key).data;
    doc.state.told = []; doc.state.toldWords = [];
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      patchTurns(h, (r) => { r.facts = []; r.narrative = 'The goblin from the counter is not here. ' + r.narrative; });
      assert(await h.turn('I look around.'), 'the turn after loading did not finish');
      assert.match(blockOf(promptOf(lastTurn(h)), 'player'), /Words of this place Owen has: [^\n]*\bgoblin\b/, '<player> carries the word typed at creation');
      const t = storedTurns(h.mock.store, key.split('/')[1]).at(-1);
      assert(!t.notes.some((x) => /the narrator used "goblin"/.test(x)), 'a word typed at creation is flagged as untold: ' + JSON.stringify(t.notes));
      clean(h);
    } finally { h.close(); }
  },

  // 28d. A save from before the told record (the author's own game among them) has turns in which people explained things: it is told
  // whatever people said so far, never "nothing yet", and has the words said aloud in those turns (goblin, said by Bess).
  async toldOldSave() {
    const first = await begin({ name: 'Alex Rowan', rmSpecies: 'cow', rmName: 'Bess Alder' }); let store;
    try {
      patchTurns(first, (r) => { r.facts = []; r.narrative = '"The porter\'s a goblin," Bess says. "He talks to anybody."'; });
      assert(await first.turn('I ask Bess about the porter.'), 'turn 1 did not finish');
      store = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    } finally { first.close(); }
    const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = store.get(key).data;
    delete doc.state.told; delete doc.state.toldWords;
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      patchTurns(h, (r) => { r.facts = []; r.narrative = 'The goblin at the desk waves you through.'; });
      assert(await h.turn('I go down to the desk.'), 'the turn after loading did not finish');
      const player = (/<player[^>]*>\n([\s\S]*?)\n<\/player>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
      assert(!/has been told so far: nothing yet/.test(player), 'an old save with turns is told "nothing yet": ' + player.slice(-400));
      assert(/has been told so far: whatever people have said to Alex in the story so far/.test(player), 'an old save is not told whatever people said so far: ' + player.slice(-400));
      const t2 = storedTurns(h.mock.store, key.split('/')[1]).at(-1);
      assert(!t2.notes.some((x) => /the narrator used "goblin"/.test(x)), 'a word said aloud in an old save\'s turns is flagged: ' + JSON.stringify(t2.notes));
      clean(h);
    } finally { h.close(); }
  },

  // 28e. The Invent button writes the player's background in the player's own plain words: the role and the background's shape
  // carry no word of the Isle's (an invented background becomes the player's record on every turn), and the background rule says
  // so to the inventor.
  async inventPlayerPlain() {
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000), 'boot did not settle');
      h.click('#cInventPlayer'); assert(await h.idle(20000), 'the invention did not finish'); await h.settle(100, 4000);
      const call = h.mock.sampleCalls.find((c) => c.label === 'cast invention' && /\n- player:/.test(promptOf(c)));
      assert(call, 'no player invention call');
      const pr = promptOf(call), role = (/\n- player:[^\n]*/.exec(pr) || [''])[0], bg = (/\n- background:[^\n]*/.exec(pr) || [''])[0];
      assert(bg, 'no background rule');
      for (const [what, t] of [['the player\'s role', role], ['the background rule', bg]]) assert(!/\b(glamours?|mythkin|disguise)\b/i.test(t), what + ' asks for a word or idea of the Isle\'s: ' + t);
      assert(/own plain words/.test(bg), 'the background rule does not ask for the player\'s own plain words: ' + bg);
      clean(h);
    } finally { h.close(); }
  },

  // 28. What the player thinks they saw is a creation choice: a short list, at most one glimpse per kind, with "not sure any more",
  // and typed words kept. The person seen is drawn to fit the kind (the roommate among them when the roommate is of it); the narrator
  // is told who in <gm_only> while that person is in play, only the kind otherwise, and <player> carries only the line the player
  // remembers, never the name.
  async glimpseSeeded() {
    const W0 = loadWorld(), gs = W0.creation.glimpses || [];
    assert(gs.some((g) => g.key === 'unsure' && !g.kind && /not sure any more/i.test(g.label)), 'the list has "not sure any more"');
    const kinds = gs.filter((g) => g.kind).map((g) => g.kind);
    assert(kinds.length >= 5 && new Set(kinds).size === kinds.length, 'one glimpse per kind at most: ' + kinds);
    for (const g of gs.filter((x) => x.kind)) assert(W0.genPools.species[g.kind], 'each glimpse is of a kind the world has: ' + g.kind);
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000), 'boot did not settle');
      assert(h.$('#cGlimpse') && !h.$('#cGlimpseRow').hidden, 'the creation screen asks what you think you saw');
      assert.match(h.$('label[for="cGlimpse"]').textContent, /What you think you saw/);
      h.click('[data-combo="cGlimpse"]'); await h.sleep(20);
      const opts = [...h.document.querySelectorAll('#comboMenu button')].map((b) => b.textContent);
      assert.equal(JSON.stringify(opts), JSON.stringify(gs.map((g) => g.label)), 'the menu lists the glimpses');
      h.$('#comboMenu button:nth-child(1)').click();
      assert.equal(h.$('#cGlimpse').value, gs[0].label, 'picking one fills the field');
      h.type('#cName', 'Owen Pryce'); h.type('#cRmSpecies', 'fox'); h.type('#cGlimpse', 'Ears that moved on their own');
      h.click('#cBegin'); assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
      const d = onlyAdv(h.mock.store).data, g = d.player.glimpse;
      assert.equal(g && g.key, 'ears', 'the choice is kept with the player');
      const gen = d.cast.generated, who = gen.characters.concat(gen.minors, d.roommate ? [d.roommate] : []).find((c) => c.key === g.who);
      assert(who, 'someone in the cast is the one seen: ' + JSON.stringify(g));
      assert.equal(who.species, 'fox', 'the one seen fits the glimpse\'s kind (the roommate, a fox too, may be the one)');
      assert(!d.roommate || g.who !== d.roommate.replaces, 'never the one the roommate stands in for');
      assert.equal(d.state.flags.glimpse_told, false, 'the secret is not out');
      // In play is what the engine reads: the place, who is present, the action and the recent story.
      const named = (s) => new RegExp('\\b' + who.first + '\\b', 'i').test(String(s || '')), here = [d.state.location].concat(d.state.present || []);
      assert(await h.turn('I unpack.'), 'turn did not finish');
      const p0 = promptOf(lastTurn(h)), sec0 = (t) => (new RegExp('\\n<' + t + '(?: [^>]*)?>\\n([\\s\\S]*?)\\n</' + t + '>').exec(p0) || [])[1];
      if (!here.some(named) && !['action', 'recent_turns', 'earlier_turns'].map(sec0).some(named)) assert(!/Who Owen saw/.test(gmOf(p0)) && !named(gmOf(p0)) && gmOf(p0).includes('What Owen saw (<player>): a kitsune, a secret, and nobody in this scene.'), 'a scene without ' + who.first + ' pays only for the kind, never the name');
      assert(await h.turn('I go and find ' + who.first + '.'), 'turn did not finish');
      const p = promptOf(lastTurn(h));
      const gm = (/<gm_only[^>]*>\n([\s\S]*?)\n<\/gm_only>/.exec(p) || [])[1] || '', pl = (/<player[^>]*>\n([\s\S]*?)\n<\/player>/.exec(p) || [])[1] || '';
      assert(gm.includes('Who Owen saw (<player>): ' + who.name + ' (kitsune), a secret. ' + who.first + ' may recognise ' + d.player.pronouns.them), 'the narrator is told who, in plain words: ' + gm.slice(0, 300));
      assert.match(gm, new RegExp('once ' + who.first + ' admits it or Owen sees it again'), 'how it comes out, in plain words');
      assert.match(gm, /never forced/, 'recognising, avoiding or seeking out is the person\'s aim, not a forced event');
      assert.match(gm, /set flags\.glimpse_told/, 'the narrator is told how the secret comes out');
      assert.match(pl, /\nOwen remembers seeing: Someone in a queue whose ears turned/, 'the player block has the line he remembers: ' + pl.slice(-300));
      assert(!pl.includes(who.first) && !pl.includes(who.last), 'the player block never names who it was');
      clean(h);
    } finally { h.close(); }
    // Typed words are kept as they are, matched to a kind by what they name.
    const h2 = await boot({});
    try {
      assert(await h2.settle(150, 6000)); h2.type('#cGlimpse', 'A woman under the bridge with gills along her ribs.');
      h2.click('#cBegin'); assert(await h2.idle(30000)); await h2.settle(150, 6000);
      const d = onlyAdv(h2.mock.store).data, g = d.player.glimpse, gen = d.cast.generated;
      assert.equal(g.text, 'A woman under the bridge with gills along her ribs.', 'typed words are the line');
      assert.equal(g.kind, 'mer', 'matched to the kind by its cues');
      assert.equal((gen.characters.concat(gen.minors, d.roommate ? [d.roommate] : []).find((c) => c.key === g.who) || {}).species, 'mer', 'and someone of that kind is the one seen (the roommate, if a mer, may be the one)');
      clean(h2);
    } finally { h2.close(); }
    // A kind named in the words wins over a part another glimpse lists (race words and plurals count); a part several kinds share
    // is no cue, and words that name or cue two kinds seed nobody rather than guess.
    const typed = { 'A goblin with big ears': 'goblin', 'Long green ears under her headscarf': 'goblin', 'A mermaid with a tail in the lake': 'mer', 'A werewolf with a tail': 'wolf', 'Two harpies with wings on a roof': 'harpy', 'A woman whose ears twitched like a rabbit\'s': 'rabbit', 'Someone with a tail': '', 'A cat and a fox': '' };
    const h3 = await boot({});
    try {
      assert(await h3.settle(150, 6000));
      for (const [t, kind] of Object.entries(typed)) {
        if (!h3.$('#dlgCreate').open) { h3.click('#btnAdventures'); h3.$('#newWorld').value = 'sundered'; h3.click('#newAdv'); await h3.settle(150, 6000); }
        h3.type('#cGlimpse', t); h3.click('#cBegin'); assert(await h3.idle(30000), 'creating did not finish: ' + t); await h3.settle(150, 6000);
        const d = advDocs(h3.mock.store).map(([, v]) => v.data).find((x) => x.player.glimpse && x.player.glimpse.text === t), g = d && d.player.glimpse;
        assert.equal(g && g.kind, kind, JSON.stringify(t) + ' is ' + (kind || 'nobody') + ': ' + JSON.stringify(g));
        const who = g.who && d.cast.generated.characters.concat(d.cast.generated.minors, d.roommate ? [d.roommate] : []).find((c) => c.key === g.who);
        assert(kind ? who && who.species === kind : !g.who, 'the one seen fits: ' + JSON.stringify(g));
      }
      clean(h3);
    } finally { h3.close(); }
  },

  // 29. The secret comes out when the story says so (the narrator sets flags.glimpse_told): the engine records who it was as a fact
  // the player now knows (with no date that the clock could make wrong), and <gm_only> stops holding it back. Regenerate records it
  // once, Undo takes the fact and the flag back with the turn.
  async glimpseTold() {
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000)); h.type('#cName', 'Owen Pryce'); h.$('#cGender').value = 'male'; h.type('#cGlimpse', 'Bark at a stranger\'s wrists');
      h.click('#cBegin'); assert(await h.idle(30000)); await h.settle(150, 6000);
      const g = onlyAdv(h.mock.store).data.player.glimpse, gen = onlyAdv(h.mock.store).data.cast.generated;
      const who = gen.characters.concat(gen.minors).find((c) => c.key === g.who); assert(who && who.species === 'dryad', 'a dryad is the one seen');
      assert(await h.turn('I unpack.'));
      assert(!onlyAdv(h.mock.store).data.memory.facts.some((f) => /now knows/.test(f)), 'nothing is told before the story tells it');
      patchTurns(h, (r) => { r.state_updates = (r.state_updates || []).concat([{ key: 'flags.glimpse_told', op: 'set', value: true }]); });
      assert(await h.turn('I ask ' + who.first + ' whether we have met before.'));
      const told = 'Owen now knows ' + who.name + ' is the one he saw before the letter came: ' + g.text, data = () => onlyAdv(h.mock.store).data;
      const facts = data().memory.facts, toldN = () => data().memory.facts.filter((f) => f === told).length;
      assert(facts.includes(told), 'the engine records it as a told fact: ' + JSON.stringify(facts));
      assert(!facts.some((f) => /weeks ago/.test(f)), 'with no date in it');
      assert(gmOf(promptOf(lastTurn(h))).includes('Who Owen saw (<player>): ' + who.name), 'the turn that names ' + who.first + ' carried the secret');
      h.click('#regen'); assert(await h.idle(20000), 'regenerate did not finish'); await h.settle(100, 4000);
      assert.equal(toldN(), 1, 'a regenerated reveal records it once: ' + JSON.stringify(data().memory.facts));
      assert.equal(data().state.flags.glimpse_told, true);
      h.click('#undo'); assert(await h.idle(20000), 'undo did not finish'); await h.settle(100, 4000);
      assert.equal(toldN(), 0, 'Undo takes the fact back: ' + JSON.stringify(data().memory.facts));
      assert.equal(data().state.flags.glimpse_told, false, 'and the secret is kept again');
      assert(await h.turn('I ask ' + who.first + ' whether we have met before.'));
      assert.equal(toldN(), 1, 'told again, once');
      patchTurns(h, () => {});
      assert(await h.turn('I sit down next to ' + who.first + '.'));
      const p = promptOf(lastTurn(h)), gm = gmOf(p);
      assert(!gm.includes('Who Owen saw'), 'once it is out the narrator is not told to keep it, though ' + who.first + ' is in play');
      assert.match(p, /<facts[^>]*>[\s\S]*Owen now knows [^\n]* is the one he saw/, 'the fact is in the prompt');
      assert.equal(onlyAdv(h.mock.store).data.memory.facts.filter((f) => /now knows .* is the one he saw/.test(f)).length, 1, 'recorded once');
      clean(h);
    } finally { h.close(); }
  },

  // 30. A save from before the choice keeps its old background, which already tells what was seen: nothing new is added to it
  // (no "not sure any more" next to the old account), and nobody in the cast is the one seen.
  async glimpseOldSave() {
    const first = await begin({ name: 'Owen Pryce' }); let store;
    try { assert(await first.turn('I unpack.')); store = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = store.get(key).data;
    delete doc.player.glimpse; delete doc.state.flags.glimpse_told;
    doc.player.background = 'shop';
    doc.player.description = 'From the city. Three weeks ago {first} saw the corner shopkeeper\'s ears, long and green and folded under her headscarf, and a second row of teeth in her smile, and said nothing. Four days later the letter came.';
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      assert(await h.turn('I look around.'), 'turn did not finish');
      const p = promptOf(lastTurn(h)), pl = (/<player[^>]*>\n([\s\S]*?)\n<\/player>/.exec(p) || [])[1] || '';
      assert.match(pl, /Three weeks ago Owen saw the corner shopkeeper's ears/, 'the old background is the account: ' + pl.slice(0, 200));
      assert.doesNotMatch(pl, /remembers seeing/, 'nothing is added to the old account: ' + pl.slice(-200));
      assert.doesNotMatch(p, /Not sure any more/, 'and never "not sure any more" next to it');
      assert.doesNotMatch(p, /What Owen saw \(<player>\)|Who Owen saw/, 'nobody is seeded');
      const d = onlyAdv(h.mock.store).data;
      assert(!d.player.glimpse && !('glimpse_told' in d.state.flags), 'no glimpse, no person, no flag');
      clean(h);
    } finally { h.close(); }
  },

  // 31. The kind decides who was seen. Typed words naming a werewolf, with a bovine roommate: the one seen is a wolf-kind person of
  // the cast, so never the bovine roommate; the roommate's introduction is told nothing of what was seen; the narrator holds the
  // person and the kind in <gm_only> (in a scene without them, the kind and that nobody present is it), and <player> keeps the words.
  async glimpseKindNotRoommate() {
    const t = 'I saw a werewolf on the night bus';
    const h = await begin({ name: 'Owen Pryce', gender: 'male', rmSpecies: 'bovine', rmName: 'Daisy Clover', rmGender: 'female', glimpse: t });
    try {
      const d = onlyAdv(h.mock.store).data, g = d.player.glimpse, gen = d.cast.generated, people = gen.characters.concat(gen.minors);
      assert.equal(d.roommate.species, 'cow', 'the roommate is bovine');
      assert.equal(g && g.kind, 'wolf', 'a werewolf is the wolf kind: ' + JSON.stringify(g));
      assert(people.some((c) => c.species === 'wolf'), 'the cast holds a wolf-kind person');
      const who = people.find((c) => c.key === g.who);
      assert(who && who.species === 'wolf', 'the one seen is wolf-kind: ' + JSON.stringify(g) + ' ' + (who && who.species));
      assert(g.who !== 'roommate' && who.name !== d.roommate.name, 'so not the bovine roommate');
      const intro = h.mock.sampleCalls.find((c) => c.label === 'roommate introduction'), ip = intro ? promptOf(intro) : '';
      assert(ip, 'the roommate introduction was asked for');
      const ipl = blockOf(ip, 'player');
      // (a porter who happens to be a werewolf is met across a desk, openly: only the sighting itself must stay out of the prompt)
      assert(!ip.includes(t) && !/saw a werewolf|night bus/i.test(ipl) && !/three weeks|made no sense/i.test(ipl), 'the roommate introduction is not told what was seen: ' + ipl);
      assert(await h.turn('I unpack.'), 'turn did not finish');
      const p0 = promptOf(lastTurn(h)), gm0 = gmOf(p0), pl0 = blockOf(p0, 'player');
      assert(pl0.includes('Owen remembers seeing: ' + t), 'the player block keeps the words: ' + pl0.slice(-200));
      if (!gm0.includes('Who Owen saw')) {
        assert(gm0.includes('What Owen saw (<player>): a werewolf, a secret, and nobody in this scene.'), 'a scene without the one seen still holds the kind: ' + gm0.slice(0, 400));
        assert(!gm0.includes(who.first), 'and never the name');
      }
      assert(!/Who Owen saw[^\n]*(Bovine|bovine|Daisy)/.test(gm0), 'the secret never names the bovine roommate');
      assert(await h.turn('I go and find ' + who.first + '.'), 'turn did not finish');
      const gm = gmOf(promptOf(lastTurn(h)));
      assert(gm.includes('Who Owen saw (<player>): ' + who.name + ' (werewolf), a secret.'), 'the secret names the person and the kind: ' + gm.slice(0, 400));
      assert.match(gm, /Nobody else is the one Owen saw\./, 'and that nobody else is');
      assert(!/never the roommate/i.test(gm), 'no rule against the roommate as such');
      clean(h);
    } finally { h.close(); }
    // A world where no role can be a werewolf: a minor figure of the kind is drawn to be the one seen, never someone of another kind.
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'wl-nowolf-'));
    try {
      for (const f of fs.readdirSync(WORLDS)) fs.copyFileSync(path.join(WORLDS, f), path.join(dir, f));
      const src = fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), a = src.indexOf('  castRoles: ['), b = src.indexOf('  genPools: {');
      fs.writeFileSync(path.join(dir, 'sundered.js'), src.slice(0, a) + src.slice(a, b).replace(/species: \[[^\]]*\]/g, (m) => m.replace(/'wolf', |, 'wolf'/g, '')) + src.slice(b));
      const h2 = await boot({ worldsDir: dir });
      try {
        assert(await h2.settle(150, 6000)); h2.type('#cName', 'Owen Pryce'); h2.type('#cRmSpecies', 'bovine'); h2.type('#cGlimpse', t);
        h2.click('#cBegin'); assert(await h2.idle(30000)); await h2.settle(150, 6000);
        const d = onlyAdv(h2.mock.store).data, g = d.player.glimpse, gen = d.cast.generated;
        assert.equal(g.kind, 'wolf');
        const who = gen.characters.concat(gen.minors).find((c) => c.key === g.who);
        assert(who && who.species === 'wolf' && gen.minors.includes(who), 'a minor figure of the wolf kind is drawn to be the one seen: ' + JSON.stringify(g) + ' ' + (who && who.species));
        assert.equal(d.state.flags.glimpse_told, false, 'and the secret is kept');
        clean(h2);
      } finally { h2.close(); }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  },

  // 32. Every kind of the world has a listed glimpse (wolf, cow and rabbit included), each resolving to its kind by label, by key and
  // in plain typed words (a wolfman, a minotaur, a bunny), and seeding a person of that kind.
  async glimpseEveryKindListed() {
    const W0 = loadWorld(), gs = W0.creation.glimpses || [], kinds = W0.creation.roommate.species;
    for (const k of kinds) assert(gs.some((g) => g.kind === k), 'a listed glimpse for every kind: none for ' + k);
    for (const [key, kind] of [['howl', 'wolf'], ['hooves', 'cow'], ['nose', 'rabbit']]) {
      const g = gs.find((x) => x.key === key); assert(g && g.kind === kind && g.label && g.text, 'the ' + kind + ' glimpse is listed: ' + key);
      for (const c of g.cues || []) assert(!gs.some((x) => x !== g && (x.cues || []).includes(c)), 'a cue only one glimpse has: ' + c);
    }
    const typed = { 'Someone who howled at the edge of the car park lights': 'wolf', 'Hooves under a long skirt on a station platform': 'cow', 'A nose that never stopped moving': 'rabbit', 'howl': 'wolf', 'A wolfman by the bins': 'wolf', 'Something howling at the full moon': 'wolf', 'A minotaur in the queue': 'cow', 'Hooves under her coat': 'cow', 'A bunny girl at the bus stop': 'rabbit', 'A man with a wolf\'s ears': 'wolf' };
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000));
      for (const [t, kind] of Object.entries(typed)) {
        if (!h.$('#dlgCreate').open) { h.click('#btnAdventures'); h.$('#newWorld').value = 'sundered'; h.click('#newAdv'); await h.settle(150, 6000); }
        const had = new Set(advDocs(h.mock.store).map(([k]) => k));
        h.type('#cGlimpse', t); h.click('#cBegin'); assert(await h.idle(30000), 'creating did not finish: ' + t); await h.settle(150, 6000);
        const fresh = advDocs(h.mock.store).filter(([k]) => !had.has(k)); assert.equal(fresh.length, 1, 'one new adventure for ' + t);
        const d = fresh[0][1].data, g = d.player.glimpse;
        assert.equal(g && g.kind, kind, JSON.stringify(t) + ' is ' + kind + ': ' + JSON.stringify(g));
        const who = [].concat(d.cast.generated.characters, d.cast.generated.minors, [Object.assign({}, d.roommate, { key: 'roommate' })]).find((c) => c.key === g.who);
        assert(who && who.species === kind, JSON.stringify(t) + ' seeds a person of the kind: ' + JSON.stringify(g));
      }
      clean(h);
    } finally { h.close(); }
  },

  // 33. Words naming two kinds seed nobody (a werewolf and a bunny is not a werewolf), and nothing of a secret reaches the narrator.
  async glimpseTwoKindsNobody() {
    for (const t of ['A werewolf and a bunny on the night bus', 'A werewolf and a cow at the station']) {
      const h = await begin({ name: 'Owen Pryce', rmSpecies: 'cow', glimpse: t });
      try {
        const d = onlyAdv(h.mock.store).data, g = d.player.glimpse;
        assert.equal(g && g.kind, '', JSON.stringify(t) + ' is nobody: ' + JSON.stringify(g));
        assert(!g.who && !('glimpse_told' in d.state.flags), 'nobody seeded, no flag');
        assert(await h.turn('I unpack.'));
        const p = promptOf(lastTurn(h));
        assert.doesNotMatch(gmOf(p), /(Who|What) Owen saw/, 'no secret line');
        assert(blockOf(p, 'player').includes('Owen remembers seeing: ' + t), 'the words are kept');
        clean(h);
      } finally { h.close(); }
    }
  },

  // 34. When the roommate is of the glimpse's kind, the roommate is one of the people the one seen is drawn from, at ordinary odds:
  // typed words naming a bovine, with a bovine roommate, seed someone bovine every time, and over a few games the roommate at least once. Then
  // the roommate's introduction holds the secret, with the player's words.
  async glimpseRoommateSameKind() {
    let rmSeen = 0, introOk = false; const kinds = [];
    for (let i = 0; i < 10 && rmSeen < 1; i++) {
      const h = await begin({ name: 'Owen Pryce', rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female', glimpse: 'A bovine woman on a station platform', seed: 9100 + i });
      try {
        const d = onlyAdv(h.mock.store).data, g = d.player.glimpse;
        assert.equal(g && g.kind, 'cow');
        const who = g.who === 'roommate' ? d.roommate : d.cast.generated.characters.concat(d.cast.generated.minors).find((c) => c.key === g.who);
        assert(who && who.species === 'cow', 'the one seen is bovine: ' + JSON.stringify(g)); kinds.push(g.who);
        if (g.who === 'roommate') {
          rmSeen += 1;
          const ip = promptOf(h.mock.sampleCalls.find((c) => c.label === 'roommate introduction'));
          introOk = blockOf(ip, 'gm_only').includes('A secret, kept in this scene: Daisy is the one Owen saw') && ip.includes(g.text);
          assert(await h.turn('I say hello to Daisy.'));
          assert(gmOf(promptOf(lastTurn(h))).includes('Who Owen saw (<player>): Daisy Clover (bovine mythkin), a secret.'), 'the secret names the roommate and the kind');
        }
        clean(h);
      } finally { h.close(); }
    }
    assert(rmSeen >= 1, 'the bovine roommate is drawn as the one seen at least once in ten games: ' + kinds.join(','));
    assert(introOk, 'the introduction of a roommate who is the one seen holds the secret and the player\'s words');
  },

  // 28. People sound different: every generated person has a way of speaking from the world's pool, written as a tendency, no two
  // alike in a cast (compared as the pool writes it, so "says less than he means" and "says less than they mean" are one habit), and
  // no temperament, habit or drawn course is shared either (a course by its stem: "music (voice)" is music), even when the invention
  // call writes the same one for everyone (the roommate keeps its own; the rest draw again; the roommate's course is none a role is
  // fixed to). The way of speaking is in the person's line, filled with the pronouns of the moment, in the roommate's introduction and
  // in the Cast editor, which can change it. The pools carry no real-world accent or dialect, and the Narration rule forbids one. A
  // save from before ways of speaking gets one for each person the story has not yet put on the page, the same on every load.
  async distinctVoices() {
    const Wd = loadWorld(), pool = Wd.genPools.speech || [];
    assert(pool.length >= 1 + Wd.castRoles.length, 'a way of speaking for everyone in a cast: ' + pool.length + ' for ' + (1 + Wd.castRoles.length));
    const DIALECT = /\b(accents?|dialects?|brogue|drawl\w*|lilt\w*|twang\w*|burr|patois|slang|scottish|scots|irish|english|welsh|cockney|british|american|southern|northern|texan|french|german|italian|spanish|russian|australian|aye|lass|lad|wee|innit|y'all|ain't|ye|yer|'em|summat|nowt|reckon)\b/i;
    for (const k of ['speech', 'quirks', 'temperaments', 'greetings']) for (const t of Wd.genPools[k] || []) assert.doesNotMatch(t, DIALECT, 'the ' + k + ' pool carries a real-world accent or dialect: ' + t);
    for (const t of pool) assert.match(t, /^(?:often|tends to|sometimes|seldom)\b/, 'a way of speaking is a tendency, not a rule the narrator recites every line: ' + t);
    assert(!pool.some((t) => /\bnever swears\b/.test(t)), 'no way of speaking keeps a partner from plain words');
    assert.match(Wd.rules.find((r) => /^Narration:/.test(r)), /never a real-world accent, dialect or phonetic spelling/, 'the Narration rule forbids real-world accents');
    // The page's own key and draw, outside the page: every pool line is one habit however it is filled, and a 'they' person is not
    // given the habit a 'he' already has while the pool has another.
    const src = fs.readFileSync(HTML, 'utf8'), ga = src.indexOf('  // ---------- generated people (worlds with genPools) ----------'), gb = src.indexOf('  // A roommate drawn from the pools');
    assert(ga > 0 && gb > ga, 'the person generator is in the page');
    const pre = "const escRe = (s) => s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'); const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s; const NB = { they: 'they', them: 'them', their: 'their', theirs: 'theirs' };"
      + " function speciesRace(Wc, k) { const sp = Wc.transformation && Wc.transformation.species[k]; return sp ? (sp.race || sp.short) : cap(String(k || '')); }";
    const G = new Function('W', pre + src.slice(ga, gb) + '\nreturn { genPerson, personFill, habitKey };')(Wd);
    const PR = { he: { they: 'he', them: 'him', their: 'his', theirs: 'his' }, she: { they: 'she', them: 'her', their: 'her', theirs: 'hers' }, they: { they: 'they', them: 'them', their: 'their', theirs: 'theirs' } };
    for (const t of pool.concat(Wd.genPools.quirks)) for (const pr of Object.values(PR)) assert.equal(G.habitKey(G.personFill(t, { pronouns: pr })), G.habitKey(t), 'one habit however it is filled: ' + G.personFill(t, { pronouns: pr }));
    assert.equal(G.habitKey('music (voice)'), G.habitKey('music'), 'a course is compared by its stem');
    const mean = pool.find((t) => /\{rm_s\}/.test(t)), other = pool.find((t) => !/\{rm_/.test(t));
    const Wt = Object.assign({}, Wd, { genPools: Object.assign({}, Wd.genPools, { speech: [mean, other] }) });
    for (let i = 0; i < 40; i++) {
      const p = G.genPerson(Wt, { gender: 'nonbinary', avoid: { speech: new Set([G.habitKey(G.personFill(mean, { pronouns: PR.he }))]) } });
      assert.equal(p.speechT, other, 'a they is not given the way of speaking a he already has: ' + p.speech);
    }
    const h = await begin({
      rmSpecies: 'cow', rmGender: 'female', rmName: 'Daisy Holm',
      setup(w, m) {
        m.sampleHandler = (input, o, call) => {
          const r = m.defaultHandler(input, o, call); if (call.label !== 'cast invention') return r;
          const d = JSON.parse(r); for (const p of d.people) { if ('temperament' in p) p.temperament = 'calm and kind'; if ('quirk' in p) p.quirk = 'hums while reading'; if ('course' in p) p.course = 'dairy science'; }
          return JSON.stringify(d);
        };
      },
    });
    let seeded;
    try {
      const { data } = onlyAdv(h.mock.store), people = [data.roommate].concat(data.cast.generated.characters);
      for (const f of ['temperament', 'quirk', 'speechT']) {
        const vals = people.map((c) => G.habitKey(c.gen[f]));
        assert(vals.every(Boolean), 'everyone has a ' + f + ': ' + people.filter((c) => !c.gen[f]).map((c) => c.key).join(', '));
        assert.equal(new Set(vals).size, vals.length, 'no two people share a ' + f + ': ' + vals.join(' | '));
      }
      for (const c of people) assert.equal(c.gen.speech, G.personFill(c.gen.speechT, c), 'the way of speaking is the pool\'s line, filled: ' + c.gen.speech);
      assert.equal(data.roommate.gen.temperament, 'calm and kind', 'the first person keeps the invented temperament');
      const fixed = Wd.castRoles.map((r) => r.course).filter(Boolean).map(G.habitKey);
      assert(!fixed.includes(G.habitKey(data.roommate.gen.course)), 'the roommate studies a course no role is fixed to: ' + data.roommate.gen.course);
      const drawn = data.cast.generated.characters.filter((c) => { const r = Wd.castRoles.find((x) => x.key === c.key); return !r.course && !/staff/.test(r.year); }).map((c) => G.habitKey(c.gen.course)).concat(G.habitKey(data.roommate.gen.course));
      assert.equal(new Set(drawn).size, drawn.length, 'no drawn course is shared: ' + drawn.join(', '));
      const intro = h.mock.sampleCalls.find((c) => c.label === 'roommate introduction');
      assert(intro && promptOf(intro).includes('Speech: ' + data.roommate.gen.speech + '.'), 'the roommate\'s way of speaking reaches the introduction');
      assert(await h.turn('I say hello to Daisy.'));
      const line = promptOf(lastTurn(h)).split('\n').find((l) => /^- Daisy Holm/.test(l)) || '';
      assert(line.includes(' Speech: ' + data.roommate.gen.speech + '.'), 'the way of speaking is in the roommate\'s line: ' + line.slice(0, 400));
      seeded = [...h.mock.store].map(([k, v]) => [k, JSON.stringify(v)]);
      clean(h);
    } finally { h.close(); }
    // The older save: no one has a way of speaking but the roommate, whose is kept as the pool writes it. The story has put one of the
    // cast on the page; one other the story has not reached is a 'they'.
    const key = seeded.find(([k]) => /^adventures\/[^/]+$/.test(k))[0], doc0 = JSON.parse(seeded.find(([k]) => k === key)[1]).data;
    const story = seeded.filter(([k]) => k.startsWith(key + '/turns/')).map(([, v]) => v).join(' ').toLowerCase() + JSON.stringify(doc0.memory).toLowerCase();
    const named = (c) => [c.first, c.last, c.name].concat(c.aliases || []).filter((n) => n && n.length > 2).some((n) => new RegExp('(^|[^a-z])' + n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(story));
    const unmet = doc0.cast.generated.characters.filter((c) => !named(c)), shown = unmet[0], they = unmet[1];
    assert(shown && they, 'two of the cast the story has not reached: ' + unmet.length);
    const old = seeded.map(([k, v]) => {
      if (k.startsWith(key + '/turns/')) { const d = JSON.parse(v); d.data.turns[0].narrative += ' ' + shown.first + ' waves from the doorway.'; return [k, JSON.stringify(d)]; }
      if (k !== key) return [k, v];
      const d = JSON.parse(v); [d.data.roommate].concat(d.data.cast.generated.characters).forEach((c) => { delete c.gen.speech; delete c.gen.speechT; });
      Object.assign(d.data.roommate.gen, { speechT: 'often talks with {rm_their} hands', speech: 'often talks with her hands' });
      Object.assign(d.data.cast.generated.characters.find((c) => c.key === they.key), { gender: 'nonbinary', pronouns: PR.they });
      return [k, JSON.stringify(d)];
    });
    const load = async (edit) => {
      const store = new Map(old.map(([k, v]) => [k, JSON.parse(v)]));
      const g = await boot({ setup(w, m) { m.store = store; } });
      try {
        assert(await g.settle(150, 8000)); await g.idle(10000); await g.settle(100, 4000);
        assert(await g.turn('I ask Daisy about her day.'));
        const d = onlyAdv(g.mock.store).data, people = [d.roommate].concat(d.cast.generated.characters), line = promptOf(lastTurn(g)).split('\n').find((l) => /^- Daisy Holm/.test(l)) || '';
        assert(line.includes(' Speech: often talks with her hands.'), 'the roommate keeps the way of speaking the save has: ' + line.slice(0, 300));
        assert.equal(people.find((c) => c.key === shown.key).gen.speech, '', 'nor one of the cast the story has named');
        const given = people.filter((c) => c.gen.speechT);
        assert(given.some((c) => c.key === they.key) && given.length >= 2, 'the people the story has not reached get one: ' + given.map((c) => c.key).join(', '));
        assert.equal(new Set(given.map((c) => G.habitKey(c.gen.speechT))).size, given.length, 'no two alike: ' + given.map((c) => c.gen.speech).join(' | '));
        const said = people.map((c) => c.gen.speech);
        if (edit) {
          // A way of speaking drawn from the pool follows a change of gender; one typed in the Cast editor is sent as typed.
          g.click('#btnCast'); await g.sleep(20);
          assert.equal(g.$('#cfName').value, 'Daisy Holm', 'the roommate is selected in the Cast editor');
          assert.equal(g.$('#cfSpeech').value, 'often talks with her hands', 'the Cast editor shows the way of speaking');
          g.$('#cfGender').value = 'male'; g.click('#cfSave'); assert(await g.idle(10000));
          g.click('[data-close="dlgCast"]');
          assert(await g.turn('I ask Daisy about the radiator.'));
          let l2 = promptOf(lastTurn(g)).split('\n').find((l) => /^- Daisy Holm/.test(l)) || '';
          assert(l2.includes(' Speech: often talks with his hands.'), 'the pronouns of the way of speaking follow the new gender: ' + l2.slice(0, 300));
          g.click('#btnCast'); await g.sleep(20);
          g.$('#cfSpeech').value = 'tends to hum between sentences'; g.click('#cfSave'); assert(await g.idle(10000));
          g.click('[data-close="dlgCast"]');
          assert(await g.turn('I ask Daisy about the window.'));
          l2 = promptOf(lastTurn(g)).split('\n').find((l) => /^- Daisy Holm/.test(l)) || '';
          assert(l2.includes(' Speech: tends to hum between sentences.'), 'a way of speaking typed in the Cast editor is sent: ' + l2.slice(0, 300));
        }
        clean(g); return said;
      } finally { g.close(); }
    };
    const a = await load(false), b = await load(true);
    assert.deepEqual(b, a, 'and the same on a second load');
  },
  // 28. A bond rises with story time together, as influence does, not a notch a turn: twelve five-minute turns that each report
  // openness up move it about two notches and never reach the private matter; rises an hour and more apart count whole and do.
  async bondStoryTime() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      const store = h.mock.store, id = onlyAdv(store).id, open = () => onlyAdv(store).data.state.bonds.roommate.openness.p;
      const n = loadWorld().transformation.tracks.bond.find((t) => t.key === 'openness').stages.length, stage = (p) => Math.floor(p * n / 100 + 1e-9);
      let advance = 5;
      patchTurns(h, (r) => { r.time_advance_minutes = advance; r.exposures = []; r.bond_shifts = [{ who: 'roommate', facet: 'openness', dir: 'up', why: 'talking late' }]; r.state_updates = (r.state_updates || []).concat([{ key: 'present', op: 'append', value: ['Daisy Holm'] }]); });
      for (let i = 0; i < 12; i++) assert(await h.turn('I keep talking with Daisy.'), 'turn ' + (i + 1));
      assert(stage(open()) <= 2, 'an hour of short turns is a notch or two, not twelve: openness ' + open());
      const told = storedTurns(store, id).flatMap((t) => t.pendingAfter || []).concat(onlyAdv(store).data.pendingNotes || []);
      assert(!told.some((x) => /private matter/.test(x)), 'and the private matter is not called for: ' + JSON.stringify(told.filter((x) => /^Bond/.test(x))));
      assert(storedTurns(store, id).some((t) => t.notes.some((x) => /^bond roommate openness rise gathering/.test(x))), 'the engine notes a rise still gathering');
      advance = 70; for (let i = 0; i < 4; i++) assert(await h.turn('I talk with Daisy again.'));
      assert.equal(stage(open()), n, 'rises over hours of story time reach the last stage: openness ' + open());
      clean(h);
    } finally { h.close(); }
  },
  // A bond falls with story time as it rises: a scene of short turns that is half warm and half cool leaves a facet where it was,
  // not at nothing; falls an hour and more apart each land whole.
  async bondFallStoryTime() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      const store = h.mock.store, id = onlyAdv(store).id, b = () => onlyAdv(store).data.state.bonds.roommate;
      const B = loadWorld().transformation.tracks.bond, def = (k) => B.find((t) => t.key === k), notch = (k) => Math.round(100 / (2 * def(k).stages.length));
      const floor = def('trust').base ? stageAt(1, def('trust').stages.length) : 0;
      let advance = 5, facet = 'liking', dir = 'up';
      patchTurns(h, (r) => { r.time_advance_minutes = advance; r.exposures = []; r.bond_shifts = [{ who: 'roommate', facet, dir, why: 'warm, then cool' }]; r.state_updates = (r.state_updates || []).concat([{ key: 'present', op: 'append', value: ['Daisy Holm'] }]); });
      const liking0 = b().liking.p;
      for (let i = 0; i < 12; i++) { dir = i % 2 ? 'down' : 'up'; assert(await h.turn('I talk with Daisy, warmly and then not.'), 'turn ' + (i + 1)); }
      assert(Math.abs(b().liking.p - liking0) <= notch('liking'), 'an hour of warm and cool short turns leaves liking within a notch of where it was: ' + liking0 + ' -> ' + b().liking.p);
      assert(storedTurns(store, id).some((t) => t.notes.some((x) => /^bond roommate liking fall gathering/.test(x))), 'the engine notes a fall still gathering');
      // An older reply's attitude update down gathers the same way: three short turns of it are not three notches of trust.
      patchTurns(h, (r) => { r.time_advance_minutes = 5; r.exposures = []; r.bond_shifts = []; r.state_updates = (r.state_updates || []).filter((u) => !/^attitudes\./.test(u.key)).concat([{ key: 'attitudes.roommate', op: 'inc', value: -1 }]); });
      const trust0 = b().trust.p; assert(trust0 - notch('trust') * 2 >= floor, 'trust has room to fall: ' + trust0);
      for (let i = 0; i < 3; i++) assert(await h.turn('I snap at Daisy.'));
      assert(trust0 - b().trust.p <= notch('trust'), 'short turns of attitude down cost a notch at most: ' + trust0 + ' -> ' + b().trust.p);
      patchTurns(h, (r) => { r.time_advance_minutes = advance; r.exposures = []; r.bond_shifts = [{ who: 'roommate', facet, dir, why: 'a promise broken' }]; r.state_updates = (r.state_updates || []).filter((u) => !/^attitudes\./.test(u.key)); });
      advance = 70; facet = 'trust'; dir = 'down';
      for (let i = 0; i < 3; i++) {
        const was = b().trust.p;
        assert(await h.turn('I let Daisy down again.'));
        assert.equal(b().trust.p, Math.max(floor, was - notch('trust')), 'falls over an hour apart land whole: ' + was + ' -> ' + b().trust.p);
      }
      clean(h);
    } finally { h.close(); }
  },


  // 29. A bond starts at its starting lines (no touch beyond accident, no thought of intimacy) and reaching them is never news; a
  // mark the narrator reports lifts a facet to the stage the page showed: lovers after the sex the player asked for is Lovers.
  async bondBaseAndMarks() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      const store = h.mock.store, id = onlyAdv(store).id, B = loadWorld().transformation.tracks.bond, b = () => onlyAdv(store).data.state.bonds.roommate;
      patchTurns(h, (r) => { r.time_advance_minutes = 5; r.exposures = []; r.bond_shifts = [{ who: 'roommate', facet: 'touch', dir: 'up', why: 'a hand on the arm' }, { who: 'roommate', facet: 'intimacy', dir: 'up', why: 'a held look' }]; r.state_updates = (r.state_updates || []).concat([{ key: 'present', op: 'append', value: ['Daisy Holm'] }]); });
      assert(await h.turn('I talk with Daisy.'));
      for (const k of ['touch', 'intimacy', 'openness', 'standing']) { const t = B.find((x) => x.key === k); assert(Math.floor(b()[k].p * t.stages.length / 100 + 1e-9) >= 1, k + ' starts at its first line: ' + b()[k].p); }
      const notes = () => storedTurns(store, id).flatMap((t) => t.pendingAfter || []).concat(onlyAdv(store).data.pendingNotes || []);
      for (const t of B.filter((x) => x.key !== 'attraction')) assert(!notes().some((x) => x.includes('reaches "' + t.stages[0])), 'reaching ' + t.key + '\'s starting line is not announced: ' + JSON.stringify(notes().filter((x) => /^Bond/.test(x))));
      patchTurns(h, (r) => { r.time_advance_minutes = 5; r.exposures = []; r.bond_shifts = [{ who: 'roommate', facet: 'intimacy', dir: 'up', why: 'they made love', mark: 'lovers' }]; r.state_updates = (r.state_updates || []).concat([{ key: 'present', op: 'append', value: ['Daisy Holm'] }]); });
      assert(await h.turn('I make love with Daisy.'));
      assert.equal(b().intimacy.p, 100, 'the lovers mark lifts intimacy to Lovers at once');
      assert(!notes().some((x) => /Nothing, and the thought may not have occurred/.test(x)), 'and nothing says the thought may not have occurred');
      const bonds = (promptOf(lastTurn(h)).match(/<bonds[^>]*>([\s\S]*?)<\/bonds>/) || [])[1] || '';
      assert.match(bonds, /\[roommate\]/, 'the scene prompt has her bonds line');
      assert.doesNotMatch(bonds, /Nothing, and the thought|None beyond accident|Surface talk|An acquaintance, unmentioned/, 'nor does her bonds line list a starting line: ' + bonds.trim().split('\n')[0]);
      assert.doesNotMatch(h.$('#attitudes').textContent, /\b(?:touch|openness|standing) 1\//, 'nor the Character panel: ' + h.$('#attitudes').textContent);
      assert((onlyAdv(store).data.pendingNotes || []).some((x) => /intimacy reaches "Lovers/.test(x)), 'the narrator is told the bond is Lovers now');
      assert.match(promptOf(lastTurn(h)), /"mark": held on touch, kiss\|bed\|lovers on intimacy, when first shown/, 'the reply contract offers each facet its marks');
      patchTurns(h, (r) => { r.time_advance_minutes = 5; r.exposures = []; r.bond_shifts = [{ who: 'roommate', facet: 'touch', dir: 'up', why: 'they made love', mark: 'lovers' }]; r.state_updates = []; });
      assert(await h.turn('I hold Daisy.'));
      assert(storedTurns(store, id).at(-1).notes.includes('bond roommate mark lovers ignored: not a mark of touch'), 'a mark on the wrong facet is noted: ' + JSON.stringify(storedTurns(store, id).at(-1).notes.filter((x) => /^bond/.test(x))));
      clean(h);
    } finally { h.close(); }
  },

  // 30. A bond rises only for someone in the scene: a rise reported for a person away, or never met, is ignored with a note, and a
  // fall for someone away (a promise broken behind her back) still lands.
  async bondAbsent() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      const store = h.mock.store, id = onlyAdv(store).id, st = () => onlyAdv(store).data.state;
      const other = Object.keys(st().attitudes).find((k) => k !== 'roommate'); assert(other, 'a cast member besides the roommate');
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; r.bond_shifts = []; r.state_updates = (r.state_updates || []).filter((u) => u.key !== 'present').concat([{ key: 'present', op: 'set', value: ['Tom Ashby'] }]); });
      assert(await h.turn('I go out alone.'));
      const b0 = JSON.parse(JSON.stringify(st().bonds));
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; r.bond_shifts = [{ who: 'roommate', facet: 'liking', dir: 'up', why: 'misses her' }, { who: other, facet: 'attraction', dir: 'up', why: 'a stranger' }, { who: 'roommate', facet: 'trust', dir: 'down', why: 'a promise broken while she is away' }]; r.state_updates = (r.state_updates || []).filter((u) => u.key !== 'present'); });
      assert(await h.turn('I sit alone and think about Daisy.'));
      assert.equal(st().bonds.roommate.liking.p, b0.roommate.liking.p, 'no rise for the roommate while she is away');
      assert.equal(st().bonds[other].attraction.p, b0[other].attraction.p, 'no rise for someone never met');
      assert(st().bonds.roommate.trust.p < b0.roommate.trust.p, 'a fall for someone away still lands');
      assert(storedTurns(store, id).at(-1).notes.some((x) => /rise ignored: not in the scene/.test(x)), 'and the note says why');
      clean(h);
    } finally { h.close(); }
  },
  // A save from before bonds is given them when it opens, and the attitude a person earned is kept in them: a roommate two points
  // above where she started has a notch more liking and a notch more trust than a fresh roommate, and the Character panel shows
  // the bond at once.
  async preBondSaveKeepsItsBond() {
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    const B = loadWorld().transformation.tracks.bond, notch = (k) => Math.round(100 / (2 * B.find((t) => t.key === k).stages.length));
    const fresh = JSON.parse(JSON.stringify(g.doc.state.bonds.roommate)), a0 = g.doc.state.attitudes.roommate;
    assert(a0 <= 8, 'a roommate who starts with room to have earned more: ' + a0);
    g.doc.state.attitudes.roommate = a0 + 2; delete g.doc.state.bonds;
    const h = await bootOn(g.store);
    try {
      const rail = h.$('#attitudes').textContent;
      assert.doesNotMatch(rail, /no bond yet/, 'the bond is there before any turn: ' + rail);
      patchTurns(h, (r) => { r.time_advance_minutes = 30; r.exposures = []; r.bond_shifts = []; });
      assert(await h.turn('I sit quietly.'));
      const st = onlyAdv(h.mock.store).data.state, b = st.bonds.roommate;
      assert.deepEqual([b.liking.p, b.trust.p], [Math.min(100, fresh.liking.p + notch('liking')), Math.min(100, fresh.trust.p + notch('trust'))], 'what she earned is kept: liking ' + b.liking.p + ' and trust ' + b.trust.p + ', against ' + fresh.liking.p + ' and ' + fresh.trust.p + ' for a fresh roommate');
      assert.equal(st.attitudes.roommate, a0 + 2, 'and the attitude stays as it was');
      clean(h);
    } finally { h.close(); }
  },
  // 31. A Cast edit to the story state stands through Regenerate and Undo: a roommate renamed in the scene is still present under
  // her new name after Regenerate, so her full sheet (looks and all) is still sent, and a character added and then Undo keeps a
  // place in the attitudes.
  async castEditSurvivesRegen() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      const st = () => onlyAdv(h.mock.store).data.state;
      patchTurns(h, (r) => { r.exposures = []; r.state_updates = [{ key: 'present', op: 'append', value: ['Daisy Clover'] }]; });
      assert(await h.turn('I sit with Daisy.'));
      patchTurns(h, (r) => { r.exposures = []; r.state_updates = []; });
      assert(await h.turn('I keep talking with Daisy.'));
      h.click('#btnCast'); await h.sleep(20);
      assert.equal(h.$('#cfName').value, 'Daisy Clover', 'the roommate is selected in the Cast editor');
      h.$('#cfName').value = 'Mei Tanaka'; h.click('#cfSave'); assert(await h.idle(10000));
      h.click('#castAdd'); assert(await h.idle(10000)); const added = Object.keys(st().attitudes).find((k) => /^npc\d/.test(k)); assert(added, 'a character is added');
      h.click('[data-close="dlgCast"]');
      assert(st().present.includes('Mei Tanaka'), 'the rename reaches the present list');
      h.click('#regen'); assert(await h.idle(15000));
      assert(st().present.includes('Mei Tanaka') && !st().present.some((x) => /Daisy/.test(x)), 'after Regenerate she is still present under her new name: ' + JSON.stringify(st().present));
      const p = promptOf(lastTurn(h)), line = (p.match(/\n- Mei Tanaka[^\n]*/) || [''])[0];
      assert.match(line, /Looks: /, 'and her line still carries her looks: ' + line.slice(0, 160));
      assert(added in st().attitudes, 'the added character keeps an attitude after Regenerate');
      h.click('#undo'); assert(await h.idle(15000));
      assert(st().present.includes('Mei Tanaka'), 'and after Undo: ' + JSON.stringify(st().present));
      assert(added in st().attitudes, 'the added character keeps an attitude after Undo');
      clean(h);
    } finally { h.close(); }
  },
  // An Override edit stands however the last turn is replayed, as a Cast edit does: a skill point, an influence, the clock, a fact
  // and a queued engine note set after a turn are still there after Regenerate (the note reaching the regenerated turn) and after
  // Undo (the note queued again).
  async overrideEditSurvivesRegen() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover', setup(w) { w.localStorage.setItem('windlass.spoilers', '1'); } });
    try {
      const doc = () => onlyAdv(h.mock.store).data;
      patchTurns(h, (r) => { r.exposures = []; r.time_advance_minutes = 10; });
      assert(await h.turn('I sit with Daisy.'));
      assert(await h.turn('I keep talking with Daisy.'));
      h.click('#btnOverride'); await h.sleep(20);
      const set = async (sel, v) => { const el = h.$(sel); assert(el, 'no ' + sel); el.value = String(v); el.dispatchEvent(new h.window.Event('change', { bubbles: true })); assert(await h.idle(8000)); };
      await set('#ovrAttitudes [data-skill="glamour"]', 9);
      await set('#ovrInfluence [data-sp="wolf"]', 12);
      h.$('#ovrDay').value = '3'; h.$('#ovrTime').value = '14:00'; h.click('#ovrClockSet'); assert(await h.idle(8000));
      h.$('#ovrFact').value = 'Daisy keeps a spare key under the mat'; h.click('#ovrFactAdd'); assert(await h.idle(8000));
      h.$('#ovrNote').value = 'The corridor lights flicker tonight'; h.click('#ovrNoteAdd'); assert(await h.idle(8000));
      h.click('[data-close="dlgOverride"]');
      const kept = (when) => {
        const d = doc();
        assert.equal((d.state.skills || {}).glamour, 9, when + ': the skill point set in Override is lost');
        assert.equal(d.state.tf.influence.wolf, 12, when + ': the influence set in Override is lost');
        assert.equal(d.state.day, 3, when + ': the day set in Override is lost');
        assert((d.memory.facts || []).includes('Daisy keeps a spare key under the mat'), when + ': the fact added in Override is lost');
      };
      h.click('#regen'); assert(await h.idle(15000));
      kept('after Regenerate');
      const t = storedTurns(h.mock.store, onlyAdv(h.mock.store).id).at(-1);
      assert.equal(t.stateBefore.time, '14:00', 'the regenerated turn starts from the clock set in Override: ' + t.stateBefore.time);
      assert(promptOf(lastTurn(h)).includes('The corridor lights flicker tonight'), 'the queued note reaches the regenerated turn');
      h.click('#undo'); assert(await h.idle(15000));
      kept('after Undo');
      assert.equal(doc().state.time, '14:00', 'after Undo the clock is the one set in Override');
      assert((doc().pendingNotes || []).includes('The corridor lights flicker tonight'), 'after Undo the note is queued again: ' + JSON.stringify(doc().pendingNotes));
      clean(h);
    } finally { h.close(); }
  },
  // 32. Someone in the scene is here, not where the timetable puts them: the roommate in 4B with the player on the mixer evening is
  // "Now: here." with no mixer aim; away at night, her timetable place being the room the player is in, she is "not here now".
  async castWhereabouts() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover', gender: 'male', name: 'Tom Ashby' });
    try {
      const line = () => (promptOf(lastTurn(h)).match(/\n- Daisy Clover[^\n]*/) || [''])[0];
      patchTurns(h, (r) => { r.exposures = []; r.time_advance_minutes = 120; r.state_updates = [{ key: 'present', op: 'set', value: ['Tom Ashby', 'Daisy Clover'] }]; });
      assert(await h.turn('I stay in with Daisy.'));
      patchTurns(h, (r) => { r.exposures = []; r.time_advance_minutes = 240; r.state_updates = [{ key: 'present', op: 'set', value: ['Tom Ashby'] }]; });
      assert(await h.turn('I talk with Daisy in our room.'));
      assert.match(line(), /Now: here\./, 'in the scene she is here: ' + line().slice(-300));
      assert.doesNotMatch(line(), /mixer/, 'and is not sent to stay close at the mixer');
      assert(await h.turn('I sit alone in the room.'));
      assert.match(line(), /Now: room 4B, asleep by eleven \(but not here now\)\./, 'away, her timetable place is not the scene: ' + line().slice(-300));
      clean(h);
    } finally { h.close(); }
  },
  // 33. The every-third-turn initiative window opens only with someone else here to take it: alone, the player gets none; with the
  // roommate here, the third turn has it. And a Cast edit of where someone usually is leaves the times of day with their own entry.
  async initiativeAndCastWhere() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover', gender: 'male', name: 'Tom Ashby' });
    try {
      let who = ['Tom Ashby'];
      patchTurns(h, (r) => { r.exposures = []; r.time_advance_minutes = 10; r.state_updates = [{ key: 'present', op: 'set', value: who }]; });
      const prompts = [];
      for (let i = 0; i < 3; i++) { assert(await h.turn('I read a book.')); prompts.push(promptOf(lastTurn(h))); }
      assert(!prompts.some((q) => /NPC initiative window/.test(q)), 'alone, no initiative window');
      who = ['Tom Ashby', 'Daisy Clover'];
      for (let i = 0; i < 3; i++) { assert(await h.turn('I read a book.')); prompts.push(promptOf(lastTurn(h))); }
      assert.match(prompts[5], /NPC initiative window: already present: Tom Ashby, Daisy Clover/, 'with the roommate here, the third turn has it');
      const { data } = onlyAdv(h.mock.store), night = data.roommate.where.night; assert(night && night !== data.roommate.where.default, 'the roommate has a night place of her own');
      h.click('#btnCast'); await h.sleep(20);
      assert.doesNotMatch(h.$('label[for="cfAim"]').textContent, /any time of day/, 'the Aim field does not claim every time of day');
      assert(!h.$('#cfOwnTimes').hidden && h.$('#cfOwnTimes').textContent.includes('night: ' + night) && /Aim, evening: stay close to Tom/.test(h.$('#cfOwnTimes').textContent), 'the form names the times that keep their own: ' + h.$('#cfOwnTimes').textContent);
      h.$('#cfWhere').value = 'the Creamery'; h.click('#cfSave'); assert(await h.idle(10000)); h.click('[data-close="dlgCast"]');
      const after = onlyAdv(h.mock.store).data, ov = after.cast.overrides[after.roommate.key];
      assert.equal(ov.where.default, 'the Creamery', 'the edit sets where she usually is');
      assert.equal(ov.where.night, night, 'and her night place stays her own');
      clean(h);
    } finally { h.close(); }
  },
  // 34. At a public scene the timetable still holds: the roommate at the Day 1 mixer on the quad keeps her mixer aim, and on a library
  // errand the person whose evening is the library is not said to be away, so the initiative window can find them there.
  async castWhereaboutsPublic() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover', gender: 'male', name: 'Tom Ashby' });
    try {
      const p = () => promptOf(lastTurn(h)), line = () => (p().match(/\n- Daisy Clover[^\n]*/) || [''])[0];
      patchTurns(h, (r) => { r.exposures = []; r.bond_shifts = []; r.time_advance_minutes = 85; r.state_updates = [{ key: 'location', op: 'set', value: 'The central quad, by the cocoa stand' }, { key: 'present', op: 'set', value: ['Tom Ashby', 'Daisy Clover'] }]; });
      assert(await h.turn('I walk to the mixer with Daisy.'));
      patchTurns(h, (r) => { r.exposures = []; r.bond_shifts = []; r.time_advance_minutes = 5; r.state_updates = [{ key: 'location', op: 'set', value: 'The library, reading room' }, { key: 'present', op: 'set', value: ['Tom Ashby'] }]; });
      assert(await h.turn('I look around the mixer with Daisy.'));
      assert.match(p(), /Day 1[^\n]*19:05/, 'the turn is on the mixer evening');
      assert.match(line(), /Now: here\. Aim now: stay close to Tom at the mixer/, 'at the mixer she keeps her mixer aim: ' + line().slice(-300));
      assert(await h.turn('I go to the library to study.'));
      assert.match(p(), /NPC initiative window/, 'the library errand opens the window');
      assert.match(p(), /Now: the library until it closes, then a windowsill\./, 'the library regular is there by the timetable');
      assert.doesNotMatch(p(), /\(but not here now\)/, 'and no one is said to be away from it');
      clean(h);
    } finally { h.close(); }
  },

  // The Thursday dawn race has its own people and its own clothes. At 06:40 on a Thursday the race is the hour's fixture: the warren
  // keeper who holds it is at the Moon Field with the race as her aim, not in the warren with her default; a rabbit roommate there with
  // the player is dressed for sport, not for sleep, though the hour sits in the night slot; and on an ordinary afternoon at the Moon
  // Field someone here is dressed for sport, not for class: the clothes follow the scene's place, not the person's timetable.
  async dawnRaceHostAndSportDress() {
    const h = await begin({ rmSpecies: 'rabbit', rmName: 'Hazel Burrow', gender: 'male', name: 'Tom Ashby' });
    try {
      const line = (k) => (promptOf(lastTurn(h)).match(new RegExp('\\n- [^\\n]*\\[' + k + '\\][^\\n]*')) || [''])[0];
      patchTurns(h, (r) => { r.exposures = []; r.bond_shifts = []; r.time_advance_minutes = 5; r.state_updates = [{ key: 'present', op: 'set', value: ['Tom Ashby', 'Hazel Burrow'] }]; });
      await setClock(h, 4, '06:40', 'the Moon Field');
      assert(await h.turn('I stretch beside Hazel at the start line.'));
      assert.match(promptOf(lastTurn(h)), /Day 4, Thursday, 06:4\d\. Now: Dawn race, Moon Field/, 'the race is the hour: ' + blockOf(promptOf(lastTurn(h)), 'clock').split('\n')[0]);
      assert.match(line('warren'), /Now: the Moon Field/, 'the warren keeper is at her race: ' + line('warren').slice(-300));
      assert.match(line('warren'), /Aim now: run the dawn race; wave Tom in if he comes\./, 'with the race as her aim: ' + line('warren').slice(-300));
      assert.match(line('roommate'), /Now: here\./, 'the roommate is in the scene: ' + line('roommate').slice(-300));
      assert.match(line('roommate'), /Dress: [^.]*dressed for sport/, 'the roommate at the field is dressed for sport: ' + line('roommate').slice(-300));
      await setClock(h, 2, '16:00', 'the Moon Field');
      assert(await h.turn('I jog a lap with Hazel.'));
      assert.match(line('roommate'), /Dress: [^.]*dressed for sport/, 'on an afternoon at the field she is dressed for sport, not for class: ' + line('roommate').slice(-300));
      clean(h);
    } finally { h.close(); }
  },
  // Night-slot hours out of doors keep the clothes on. On the full-moon run after eleven the Moonrunners' captain at the Moon Field
  // is dressed for sport, not for sleep; at the Thursday dawn race the warren keeper likewise; and the player at the fairy ring at ten
  // past eleven, dressed all evening, shows nothing new to the roommate, who is dressed for the evening there, not for sleep or for
  // class: nobody is undressed at a public place because the clock says night. Nor because a place's name holds a bed word in
  // daytime: the dorm kitchen before lunch is dressed, and nothing under the player's clothes is newly shown there.
  async nightOutKeepsClothes() {
    const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cow-roommate-25.json'), 'utf8'));
    const h = await boot({ setup: (w, mock) => { mock.store.set('adventures/' + SAVE.id, { data: SAVE.adventure, version: 1 }); for (const [c, doc] of Object.entries(SAVE.turns)) mock.store.set('adventures/' + SAVE.id + '/turns/' + c, { data: doc, version: 1 }); } });
    try {
      assert(await h.settle(150, 8000), 'the page did not settle'); assert(await h.idle(20000), 'the save did not load');
      const p = () => promptOf(lastTurn(h)), line = (k) => (p().match(new RegExp('\\n- [^\\n]*\\[' + k + '\\][^\\n]*')) || [''])[0];
      const nameOf = (k) => (line(k).match(/^\n- ([^(\n]+?) \(/) || [])[1];
      let who = ['Owen Pryce', 'Ada Fairbank'];
      patchTurns(h, (r) => { r.exposures = []; r.bond_shifts = []; r.time_advance_minutes = 5; r.state_updates = [{ key: 'present', op: 'set', value: who }]; });
      await setClock(h, 9, '22:20', 'the Moon Field, on the full-moon run');
      assert(await h.turn('I keep up with the runners.'));
      const captain = nameOf('moonrunners'), keeper = nameOf('warren'); assert(captain && keeper, 'the captain and the warren keeper are in the cast: ' + captain + ', ' + keeper);
      // Ada is in the scene from here on (the reply put her there). In daytime a bed word in a place's name is no bed.
      await setClock(h, 3, '11:10', 'the dorm kitchen');
      assert(await h.turn('I make tea with Ada.'));
      assert.match(p(), /Day 3, Wednesday, 11:1\d\./, 'the turn is before lunch');
      assert.doesNotMatch(p(), /Showing now: [^\n]*\(new to /, 'in the dorm kitchen before lunch nothing of Owen\'s is newly shown: ' + (p().match(/Showing now: [^\n]*/) || [''])[0]);
      assert.match(line('roommate'), /Now: here\./, 'Ada is here: ' + line('roommate').slice(-300));
      assert.match(line('roommate'), /Dress: [^.]*dressed for class/, 'Ada in the dorm kitchen before lunch is dressed for class, not for sleep: ' + line('roommate').slice(-300));
      who = ['Owen Pryce', 'Ada Fairbank', captain];
      assert(await h.turn('I fall in beside ' + captain.split(' ')[0] + '.'));   // the reply puts the captain in the scene
      await setClock(h, 9, '23:30', 'the Moon Field, on the full-moon run');
      assert(await h.turn('I keep up with ' + captain.split(' ')[0] + '.'));
      assert.match(p(), /Day 9, Tuesday, 23:3\d\./, 'the turn is after eleven on the run\'s night');
      assert.match(line('moonrunners'), /Now: here\./, 'the captain is in the scene: ' + line('moonrunners').slice(-300));
      assert.match(line('moonrunners'), /Dress: [^.]*dressed for sport/, 'after eleven on the run the captain is dressed for sport: ' + line('moonrunners').slice(-300));
      who = ['Owen Pryce', 'Ada Fairbank'];
      await setClock(h, 4, '06:40', 'the Moon Field');
      assert(await h.turn('I watch ' + keeper + ' start the race.'));
      assert.match(line('warren'), /Now: the Moon Field/, 'the warren keeper holds the dawn race: ' + line('warren').slice(-300));
      assert.match(line('warren'), /Dress: [^.]*dressed for sport/, 'and is dressed for it, not for sleep: ' + line('warren').slice(-300));
      await setClock(h, 5, '19:50', 'the fairy ring, Greenhouse Quarter');
      assert(await h.turn('I watch the dance with Ada.'));
      assert.doesNotMatch(p(), /Showing now: [^\n]*\(new to /, 'dressed for the evening at the ring, nothing of Owen\'s is new to Ada: ' + (p().match(/Showing now: [^\n]*/) || [''])[0]);
      await setClock(h, 5, '23:10', 'the fairy ring, Greenhouse Quarter');
      assert(await h.turn('I watch the dance with Ada.'));
      assert.doesNotMatch(p(), /Showing now: [^\n]*\(new to /, 'after eleven at the ring nothing of Owen\'s is newly shown: ' + (p().match(/Showing now: [^\n]*/) || [''])[0]);
      assert.doesNotMatch(line('roommate'), /dressed for sleep/, 'Ada at the ring is not dressed for sleep: ' + line('roommate').slice(-300));
      assert.match(line('roommate'), /dressed for the evening/, 'and is dressed for the evening there, not for class: ' + line('roommate').slice(-300));
      // And someone in bed stays in bed: the captain, named at half past eleven while she is in her hall by the Moon Field, is dressed
      // for sleep there, not for sport because her hall's name says where it stands.
      await setClock(h, 2, '23:30', 'Room 4B, Kettle Hall (view of the lake)');
      assert(await h.turn('I think about ' + captain + ' and what ' + captain.split(' ')[0] + ' said.'));
      assert.match(line('moonrunners'), /Now: Fenwood/, 'the captain is in her hall: ' + line('moonrunners').slice(-300));
      assert.match(line('moonrunners'), /Dress: [^.]*dressed for sleep/, 'and dressed for sleep there: ' + line('moonrunners').slice(-300));
      clean(h);
    } finally { h.close(); }
  },
  // A person taken out of the cast keeps the name the timetable, the lore and the keeper line give them: with the professor of Anatomy
  // and the Dean removed, the Friday class is still hers by name in the prompt's clock and in the header, no {npc_...} is left raw
  // anywhere in the prompt, neither is in the cast block, the keeper line still names the Dean, and the mixer's lore names her on Day 1.
  async removedCastStillNamesFixtures() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      h.click('#btnCast');
      for (const k of ['historian', 'dean']) { h.click(h.$('#castList [data-key="' + k + '"]')); await h.sleep(20); h.click('#cfRemove'); assert(await h.idle(8000), 'removing ' + k); await h.sleep(20); }
      h.click('[data-close="dlgCast"]');
      assert.deepEqual(onlyAdv(h.mock.store).data.cast.hidden.slice().sort(), ['dean', 'historian'], 'both are out of the story');
      patchTurns(h, (r) => { r.exposures = []; r.bond_shifts = []; r.time_advance_minutes = 5; r.state_updates = []; });
      await setClock(h, 5, '13:20');
      assert(await h.turn('I take a seat in the theatre.'));
      const p = promptOf(lastTurn(h)), raw = (p.match(/[^\n]*\{npc_[^\n]*/) || [''])[0];
      assert.doesNotMatch(p, /\{npc_/, 'no placeholder is left raw: ' + raw.slice(0, 200));
      assert.match(blockOf(p, 'clock'), /Now: Comparative Mythkin Anatomy, Anatomy theatre \(Prof\. [A-Z][^)]+\)/, 'the class keeps its professor\'s name: ' + blockOf(p, 'clock').split('\n')[0]);
      assert.doesNotMatch(blockOf(p, 'characters'), /\[(?:historian|dean)\]/, 'neither is in the cast block');
      assert.match(gmOf(p), /The keeper: [A-Z][a-z]+ [A-Z]/, 'the keeper line names the Dean: ' + (gmOf(p).match(/The keeper: [^\n]{0,40}/) || [''])[0]);
      assert.doesNotMatch(h.$('#clock .slot span').title, /\{npc_/, 'the header names the professor: ' + h.$('#clock .slot span').title);
      await setClock(h, 1, '19:10');
      assert(await h.turn('I ask about the Dean and the mixer.'));
      assert.match(promptOf(lastTurn(h)), /<entry name="the mixer">/, 'the mixer\'s lore is in the prompt');
      assert.doesNotMatch(promptOf(lastTurn(h)), /\{npc_dean\}/, 'the lore names the Dean, not her key');
      clean(h);
    } finally { h.close(); }
  },
  // The shed ladder names only limits that exist: no stage trims a 'discoveries' item (the world has no such item, and the engine
  // ignores one), so the note a turn keeps cannot promise 'the latest N discoveries' of a list that is not sent.
  async shedNoteNamesOnlyTrackedItems() {
    const page = fs.readFileSync(HTML, 'utf8'), W = loadWorld();
    const at = page.indexOf('const chain = ['), chain = page.slice(at, page.indexOf('if (fits()) break;', at));
    assert(at > 0 && chain.length > 500 && chain.length < 8000, 'the shed chain was found: ' + chain.length);
    const keys = [...new Set([...chain.matchAll(/\b([a-zA-Z]+): /g)].map((m) => m[1]))], items = W.trackedItems.map((d) => d.key);
    assert(!keys.includes('discoveries'), 'no stage trims a discoveries item the world does not have: ' + keys.join(', '));
    assert.deepEqual(keys.filter((k) => items.includes(k)), [], 'no stage names a tracked item by key');
    assert.doesNotMatch(page, /guard\.discoveries/, 'the shed note does not promise discoveries');
  },

  // A look written by hand keeps what it names: a Cast Looks edit that gives a cow roommate two small horns reaches the prompt with
  // "Not on this body" naming the crest and the heavy neck she still lacks, never the horns the look gives her, and the rule that a
  // by-sex feature belongs to one sex yields where that person's Looks give it.
  async handWrittenLookKeepsItsFeatures() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    try {
      const line = () => (blockOf(promptOf(lastTurn(h)), 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '');
      const notOn = () => (/ Not on this body: ([^.]*)\./.exec(line()) || [])[1] || '';
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'May Tanaka', 'the Cast screen opens on the roommate');
      const el = h.$('#cfLooks'); el.value = 'Petite and slim, black and white like a holstein, with cow ears out to the sides and two small curved horns just above them, a broad soft nose and dark eyes.'; el.dispatchEvent(new h.window.Event('input', { bubbles: true }));
      h.click('#cfSave'); assert(await h.idle(10000)); h.click('[data-close="dlgCast"]');
      assert(await h.turn('I look at May.'));
      assert.match(line(), /Looks: Petite and slim[^\n]*two small curved horns/, 'the hand-written look is sent: ' + line().slice(0, 400));
      assert.match(notOn(), /\bcrest\b/, 'what she still lacks is named: ' + notOn());
      assert.doesNotMatch(notOn(), /\bhorns?\b/, 'the horns the look gives her are not denied: ' + notOn());
      assert.match(promptOf(lastTurn(h)), /belongs to that sex alone unless that person's Looks give it/, 'the rule yields where the Looks give the feature');
      clean(h);
    } finally { h.close(); }
    // A word that only colours another feature names nothing: a dryad man whose hair is tied back in a tail and whose mouth is
    // fruit-dark still has no tail and no flowers or fruit, and the must-nots say so.
    const h2 = await begin({ rmSpecies: 'dryad', rmName: 'Owen Pryce', rmGender: 'male' });
    try {
      const line2 = () => (blockOf(promptOf(lastTurn(h2)), 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '');
      const notOn2 = () => (/ Not on this body: ([^.]*)\./.exec(line2()) || [])[1] || '';
      h2.click('#btnCast'); await h2.sleep(20); assert.equal(h2.$('#cfName').value, 'Owen Pryce', 'the Cast screen opens on the roommate');
      const el2 = h2.$('#cfLooks'); el2.value = 'Tall and lean, with bark-brown skin, hair tied back in a tail, a fruit-dark mouth and green eyes.'; el2.dispatchEvent(new h2.window.Event('input', { bubbles: true }));
      h2.click('#cfSave'); assert(await h2.idle(10000)); h2.click('[data-close="dlgCast"]');
      assert(await h2.turn('I look at Owen.'));
      assert.match(line2(), /Looks: Tall and lean[^\n]*hair tied back in a tail/, 'the hand-written look is sent: ' + line2().slice(0, 400));
      assert.match(notOn2(), /\ba tail\b/, 'hair in a tail is no tail: ' + notOn2());
      assert.match(notOn2(), /flowers or fruit/, 'a fruit-dark mouth is no fruit: ' + notOn2());
      clean(h2);
    } finally { h2.close(); }
  },

  // 28. Regenerate re-draws the narration, not the body. The draws a first contact makes (whether the way over starts, the windows,
  // the lean, the face, the gaps between waypoints) are fixed by the adventure and the turn, so pressing Regenerate gives the same
  // body every time and a second device agrees; Undo then gives back the whole state from before the turn.
  async regenerateKeepsTheBody() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      patchTurns(h, (r) => { r.time_advance_minutes = 180; r.exposures = [{ species: 'cow', method: 'the evening with Daisy', intensity: 3 }]; });
      const data = () => onlyAdv(h.mock.store).data, id = onlyAdv(h.mock.store).id;
      const before = JSON.parse(JSON.stringify(data().state)), pendingBefore = JSON.parse(JSON.stringify(data().pendingNotes || []));
      const body = () => { const t = data().state.tf, pr = (t.prog && t.prog.cow) || { tracks: {} }; return JSON.stringify({ pathSex: t.paths && t.paths.cow && t.paths.cow.sex, over: t.sexprog ? t.sexprog.to : null, lean: pr.lean, face: pr.face, windows: Object.entries(pr.tracks).map(([k, r]) => [k, r.s, r.e, r.ext]) }); };
      const told = () => JSON.stringify(Object.entries(data().state.tf.prog.cow.tracks).map(([k, r]) => [k, r.told]));
      assert(await h.turn('I spend the evening with Daisy.'));
      assert(data().state.tf.prog && data().state.tf.prog.cow, 'the first contact drew the bovine tracks');
      const differs = (x, y, at) => (JSON.stringify(x) === JSON.stringify(y) ? [] : (x && y && typeof x === 'object' && typeof y === 'object' ? [...new Set(Object.keys(x).concat(Object.keys(y)))].flatMap((k) => differs(x[k], y[k], at + '.' + k)) : [at + ': ' + JSON.stringify(x) + ' vs ' + JSON.stringify(y)]));
      const first = body(), firstTold = told();
      const started = storedTurns(h.mock.store, id)[0].stateBefore;
      assert.deepEqual(started, before, 'the turn starts from the saved state: ' + differs(started, before, 'state').slice(0, 4).join('; ').slice(0, 400));
      for (let i = 1; i <= 6; i++) {
        h.click('#regen'); assert(await h.idle(20000), 'regenerate ' + i);
        assert.equal(body(), first, 'Regenerate ' + i + ' re-rolled the body');
        assert.equal(told(), firstTold, 'Regenerate ' + i + ' told different waypoints');
        assert.equal(data().turnCount, 1, 'Regenerate replaces the turn, it does not add one');
      }
      h.click('#undo'); assert(await h.idle(20000));
      assert.equal(data().turnCount, 0, 'Undo takes the turn away');
      // A new adventure is saved with its body record whole, so the page's normaliser adds nothing when Undo restores it.
      assert.deepEqual(data().state, before, 'Undo gives back the whole state, draws included: ' + differs(data().state, before, 'state').slice(0, 4).join('; ').slice(0, 400));
      assert.deepEqual(data().pendingNotes || [], pendingBefore, 'and the notes the narrator was to be given');
      assert.equal(storedTurns(h.mock.store, id).length, 0, 'and the stored turn is gone');
      clean(h);
    } finally { h.close(); }
  },
  // 28. What shows of the player's changes reaches the narrator, and the people in the scene take a stance to it. The showing line
  // follows the clothes and the parts told (a part under clothes does not show, one the player hides stays hidden until shown
  // again, bare in the shower everything shows, a part whose first waypoint is still to be found is not showing yet) and is sent
  // only on a turn when something is new to someone there or the action hid or showed a part; a present person new to a part gets
  // a stance that is a motive, not an event, by role for staff, seen, heard or smelt by what it is; a first showing is one beat
  // the memory keeps and the person then takes the part as seen. Only the player's own parts are hidden ("my", a garment put on
  // or taken off), never by an action on someone else; an old save takes what is told as already seen; someone the reply brings
  // in reacts the turn after; nothing is sent when nothing is told.
  async reactionsToChanges() {
    const TR = loadWorld().transformation.tracks.species.cow, ears = TR.find((t) => t.key === 'ears');
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', gender: 'male', name: 'Tom Ashby' });
    let seeded; try { assert(await first.turn('I unpack.')); seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data, id = advKey.split('/')[1];
    Object.assign(doc.cast.generated.characters.find((c) => c.key === 'physician'), { name: 'Dr Ione Vashti', first: 'Ione', last: 'Vashti', aliases: ['Ione', 'Vashti', 'Dr Vashti'] });
    const tracks = (told) => Object.fromEntries(TR.map((t) => [t.key, { s: 50, e: 100, p: told[t.key] ? stageAt(told[t.key], t.stages.length) : 0, told: told[t.key] || 0, ext: 0, nextAt: 0 }]));
    // A save made on this build keeps who has seen what (tf.seen, empty at first); an older save has none (oldSave).
    const seed = (told, oldSave) => { doc.state.tf = Object.assign(doc.state.tf || {}, baseTf('cow', 40, { lean: 0, face: 15, tracks: tracks(told) })); delete doc.state.tf.hidden; if (oldSave) delete doc.state.tf.seen; else doc.state.tf.seen = {}; };
    // The start room's name carries a view of the lake; it is a room, not the lakeside, so the player is dressed in it.
    assert.match(doc.state.location, /^Room [^(,]*,[^(]*\(.*\blake\b/, 'the start room mentions the lake after its name: ' + doc.state.location);
    const TOLD = { hands: 2, ears: 1, eyes: 1, horns_and_crest: 1, voice: 1, forearm_coat: 1, tail: 1, own_scent: 1, appetite_and_cud: 1 };
    seed(TOLD);
    doc.state.present = ['Daisy Holm', 'Dr Ione Vashti']; doc.pendingNotes = [];
    const STANCES = '(?:remarks on it|notices and says nothing|pretends not to see|flirts over it|teases|worries|stares|makes room for it, as one of the kind)';
    const open = async (store, patch) => { const h = await boot({ setup(w, m) { m.store = new Map([...store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } }); assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000); patchTurns(h, (r) => { r.state_updates = []; r.time_advance_minutes = 5; r.beats = []; if (patch) patch(r); }); return h; };
    const tblock = (h) => (/<transformation>([\s\S]*?)<\/transformation>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
    const line = (h, key) => ((/<characters[^>]*>([\s\S]*?)<\/characters>/.exec(promptOf(lastTurn(h))) || [])[1] || '').split('\n').find((l) => l.includes('[' + key + ']')) || '';
    const beats = (h) => storedTurns(h.mock.store, id).at(-1).beats;
    const tf = (h) => onlyAdv(h.mock.store).data.state.tf;
    const sh = (t) => ((/(?:Showing now|Hidden by|Stances in)[^\n]*/.exec(t) || [])[0] || 'no showing line');
    const h = await open(seeded);
    try {
      assert(await h.turn('I look around the room.'));
      let t = tblock(h), daisy = line(h, 'roommate'), ione = line(h, 'physician');
      assert.match(t, /Showing now: hands \(new to Daisy, Ione\); ears \(new to Daisy, Ione\); eyes \(new to Daisy, Ione\); voice \(new to Daisy, Ione\); own scent, to a keen nose \(new to Daisy(?:, Ione)?\); horns and crest \(new to Daisy, Ione\)\./, 'the parts told that clothes leave bare show, each new to who has not seen it: ' + sh(t));
      assert.doesNotMatch(t, /Showing now:[^\n]*(?:forearm coat|tail|appetite)/, 'in the room (a lake view, not the lakeside) the coat and the tail are under clothes, and an appetite never shows: ' + sh(t));
      assert.doesNotMatch(t, /Under clothes|Has seen/, 'what is under clothes is not listed');
      assert.match(t, /Story thread: [^\n]*let the changed body show in small things \(a sleeve, a step, a mirror\), without deciding what Tom feels about it or what it means\./, 'the story thread shows the changed body without deciding what Tom finds or feels: ' + t.slice(0, 300));
      assert.doesNotMatch(t, /let Tom find/, 'and never has Tom find the body unfamiliar');
      assert.match(t, /Stances in <characters> are motives, not events owed; nobody predicts what comes next; what Tom makes of them is the player's\. A reaction shown may move a bond \(bond_shifts\)\./, 'the stances are motives, the player\'s side stays the player\'s, and a shown reaction may move a bond');
      assert.match(daisy, new RegExp('Aim now: .* Sees Tom\'s hands, ears, eyes, horns and crest; hears Tom\'s voice; catches Tom\'s scent for the first time: ' + STANCES + '\\.$'), 'the roommate\'s line ends with a stance to the new parts, a voice heard and a scent caught: ' + daisy.slice(-250));
      assert.match(ione, /Sees Tom's hands, ears, eyes, horns and crest; hears Tom's voice(?:; catches Tom's scent)? for the first time: asks after it once, as a doctor would; nothing more\.$/, 'the doctor asks, by role, and does not name the Spa: ' + ione.slice(-250));
      assert.deepEqual(beats(h).filter((b) => /first time/.test(b)), ['Tom\'s hands, ears, eyes, voice, scent and horns and crest showed for the first time, with Daisy and Ione there.'], 'a first showing is one beat the memory keeps: ' + JSON.stringify(beats(h)));
      assert(onlyAdv(h.mock.store).data.memory.beats.some((b) => /^Tom's hands, ears, .* showed for the first time/.test(b)), 'and it is in the memory');
      const seen = tf(h).seen; assert(seen && seen.roommate && seen.roommate['cow:ears'] && seen.physician && seen.physician['cow:hands'], 'each person given a stance is marked as having seen the parts: ' + JSON.stringify(seen));
      assert(await h.turn('I sit on the bed.'));
      t = tblock(h); daisy = line(h, 'roommate');
      assert.doesNotMatch(t, /Showing now|Hidden by|Stances in/, 'the next turn nothing is new to anyone there, so nothing is sent: ' + sh(t));
      assert.doesNotMatch(daisy, /Sees Tom|Has seen|for the first time/, 'and the roommate has no stance to restate: ' + daisy.slice(-200));
      assert(!beats(h).some((b) => /first time/.test(b)), 'no second first-showing beat: ' + JSON.stringify(beats(h)));
      // An action on someone else, a garment someone else puts on, or a part put somewhere that hides nothing, hides nothing of the
      // player's.
      for (const a of ['I wrap my arms around Daisy and kiss her.', 'I tuck her hair behind her ear.', 'I cover her in kisses, my hands on her shoulders.', 'I put my hand in the air.', 'I put my hands in my lap.', 'I put my hand into the bag for my keys.', 'I fold my arms under my chest.', 'Daisy puts on a hat.', 'I pull the hood up over her head.', 'I put my fingers in.', 'I put two of my fingers in.', 'I put my hand in.', 'I put my hand under the sheet and find her thigh.', 'I put my hands under the sheets and pull her close.']) {
        assert(await h.turn(a));
        assert.equal(tf(h).hidden, undefined, '"' + a + '" hides nothing of Tom\'s: ' + JSON.stringify(tf(h).hidden));
        assert.doesNotMatch(tblock(h), /Hidden by/, '"' + a + '" sends no hiding');
      }
      assert(await h.turn('I pull a hat on over my ears and keep my hands in my pockets.'));
      t = tblock(h);
      assert.match(t, /Showing now: eyes; voice; own scent, to a keen nose\. Hidden by Tom: hands \(in pockets\), ears \(under a hat\), horns and crest \(under a hat\)\./, 'what the action hides is hidden, the hat only over what it fits (not the eyes): ' + sh(t));
      assert.deepEqual(tf(h).hidden, { 'cow:hands': 'in pockets', 'cow:ears': 'under a hat', 'cow:horns_and_crest': 'under a hat' }, 'and kept by part');
      assert(await h.turn('I sit down.'));
      assert.doesNotMatch(tblock(h), /Showing now|Hidden by/, 'a turn on, nothing new and nothing changed, nothing sent: ' + sh(tblock(h)));
      assert.equal(tf(h).hidden['cow:ears'], 'under a hat', 'the hat is still on');
      // A hat someone else takes off, or one the player takes off her head, is not the player's.
      for (const a of ['Ione takes off a hat.', 'I take the hat off her head.']) {
        assert(await h.turn(a));
        assert.equal(tf(h).hidden['cow:ears'], 'under a hat', '"' + a + '" leaves Tom\'s hat on: ' + JSON.stringify(tf(h).hidden));
        assert.doesNotMatch(tblock(h), /Showing now|Hidden by/, '"' + a + '" changes nothing, so nothing is sent: ' + sh(tblock(h)));
      }
      assert(await h.turn('I take the hat off.'));
      t = tblock(h); assert.match(t, /Showing now: ears; eyes; voice; own scent, to a keen nose; horns and crest\. Hidden by Tom: hands \(in pockets\)\./, 'the hat off shows the ears again: ' + sh(t));
      // A filler word before the subject still leaves the player its subject.
      assert(await h.turn('So I put my hat on.'));
      assert.equal(tf(h).hidden['cow:ears'], 'under a hat', '"So I put my hat on." puts the hat on: ' + JSON.stringify(tf(h).hidden));
      assert(await h.turn('Well I take my hat off.'));
      t = tblock(h); assert.match(t, /Showing now: ears; eyes; voice; own scent, to a keen nose; horns and crest\. Hidden by Tom: hands \(in pockets\)\./, '"Well I take my hat off." takes it off: ' + sh(t));
      assert(await h.turn('I take a shower.'));
      t = tblock(h); assert.match(t, /Showing now: hands; forearm coat \(new to Daisy, Ione\); tail \(new to Daisy, Ione\); ears; eyes; voice; own scent, to a keen nose; horns and crest\./, 'bare, everything told shows: ' + sh(t)); assert.doesNotMatch(t, /Hidden by/, 'and nothing is under anything');
      assert(beats(h).some((b) => b === 'Tom\'s forearm coat and tail showed for the first time, with Daisy and Ione there.'), 'the coat\'s first showing is a beat: ' + JSON.stringify(beats(h)));
      // Undo takes the first showing back (who has seen it, its beat); the same turn again gives the same stance.
      const stance = line(h, 'roommate').split(' for the first time: ')[1];
      h.click('#undo'); await h.idle(10000);
      assert(!tf(h).seen.roommate['cow:forearm_coat'] && !onlyAdv(h.mock.store).data.memory.beats.some((b) => /forearm coat and tail showed/.test(b)), 'undo takes back the coat seen and its beat: ' + JSON.stringify(tf(h).seen.roommate));
      assert(await h.turn('I take a shower.'));
      assert.match(tblock(h), /forearm coat \(new to Daisy, Ione\); tail \(new to Daisy, Ione\)/, 'the coat is new to them again');
      assert.equal(line(h, 'roommate').split(' for the first time: ')[1], stance, 'with the same stance');
      clean(h);
    } finally { h.close(); }
    // An old save, from before who has seen what was kept: the people already known have seen what is told, so nobody is told it
    // is new and no beat is written for it.
    seed(TOLD, true);
    const hOld = await open(seeded);
    try {
      assert(await hOld.turn('I look around the room.'));
      assert.doesNotMatch(tblock(hOld), /new to|Stances in/, 'nothing told is new on an old save: ' + sh(tblock(hOld)));
      assert.doesNotMatch(line(hOld, 'roommate'), /for the first time/, 'and the roommate has no stance to it');
      assert(!beats(hOld).some((b) => /first time/.test(b)), 'and no first-time beat: ' + JSON.stringify(beats(hOld)));
      assert(tf(hOld).seen.roommate['cow:ears'] && tf(hOld).seen.physician['cow:hands'], 'the seen parts are filled in: ' + JSON.stringify(tf(hOld).seen));
      // Feet in the pool are bare in the water, not hidden.
      assert(await hOld.turn('I put my feet in the pool.'));
      assert.equal(tf(hOld).hidden, undefined, 'feet in the pool hide nothing: ' + JSON.stringify(tf(hOld).hidden));
      clean(hOld);
    } finally { hOld.close(); }
    // Someone the reply brings in was given no stance this turn, so has seen nothing yet, and reacts the turn after.
    seed(TOLD); doc.state.present = ['Dr Ione Vashti'];
    let n = 0; const hIn = await open(seeded, (r) => { if (n++ === 0) r.state_updates = [{ key: 'present', op: 'append', value: ['Daisy Holm'] }]; });
    try {
      assert(await hIn.turn('I look around the room.'));
      assert.doesNotMatch(line(hIn, 'roommate'), /for the first time/, 'the roommate is not there yet');
      assert(!tf(hIn).seen.roommate && tf(hIn).seen.physician, 'only the doctor, given a stance, has seen anything: ' + JSON.stringify(tf(hIn).seen));
      assert(await hIn.turn('I say hello.'));
      assert.match(line(hIn, 'roommate'), /Sees Tom's hands, ears, eyes, horns and crest; hears Tom's voice; catches Tom's scent for the first time: /, 'the roommate, there now, reacts: ' + line(hIn, 'roommate').slice(-250));
      assert.match(tblock(hIn), /Showing now: hands \(new to Daisy\);/, 'new to her alone: ' + sh(tblock(hIn)));
      clean(hIn);
    } finally { hIn.close(); }
    doc.state.present = ['Daisy Holm', 'Dr Ione Vashti'];
    // With the sheets clipped to a line (a very long action near the size cap) nobody is given a stance, so nobody is marked as
    // having seen anything and no beat is written: what shows stays new to them for a later turn (as for someone brought in).
    seed(TOLD);
    const hBrief = await open(seeded);
    try {
      assert(await hBrief.turn('I look around the room. ' + 'The light is grey and the radiator ticks, and nothing in the room has moved since the morning. '.repeat(250)));
      const t = storedTurns(hBrief.mock.store, id).at(-1);
      assert(t.notes.some((x) => /character sheets clipped to a line/.test(x)), 'the long action clips the sheets to a line: ' + JSON.stringify(t.notes.filter((x) => /size cap/.test(x))));
      assert.doesNotMatch(line(hBrief, 'roommate'), /for the first time/, 'a one-line sheet carries no stance');
      assert.doesNotMatch(tblock(hBrief), /new to|Stances in/, 'and nothing is new to anyone: ' + sh(tblock(hBrief)));
      assert(!tf(hBrief).seen.roommate && !tf(hBrief).seen.physician, 'nobody given no stance is marked as having seen anything: ' + JSON.stringify(tf(hBrief).seen));
      assert(!beats(hBrief).some((b) => /first time/.test(b)), 'and no first-time beat: ' + JSON.stringify(beats(hBrief)));
      clean(hBrief);
    } finally { hBrief.close(); }
    // A part whose first waypoint is still to be found this turn is not showing; with nothing bare, nothing is new to anyone.
    seed({ ears: 1, leg_and_hip_coat: 1 }); doc.pendingNotes = ['A new part begins (bovine mythkin): Ears (bovine mythkin, waypoint 1 of ' + ears.stages.length + '): the tops of the ears.'];
    const h2 = await open(seeded);
    try {
      assert(await h2.turn('I look around the room.'));
      const t = tblock(h2); assert.doesNotMatch(t, /Showing now|Hidden by/, 'the ears being found this turn are not showing yet, and the leg coat is under clothes: ' + sh(t));
      assert.doesNotMatch(line(h2, 'roommate'), /for the first time/, 'and nobody has a stance to nothing: ' + line(h2, 'roommate').slice(-200));
      clean(h2);
    } finally { h2.close(); }
    // A part of the same name found this turn on another kind, or on the way over, is its own part: the voice already told here
    // still shows and is new to who has not heard it.
    const Wt = loadWorld().transformation, voice = TR.find((t) => t.key === 'voice'), W4 = Wt.tracks.woman, wv = W4.find((t) => t.key === 'voice');
    for (const [label, other, sexVoice] of [
      ['a fox voice found', 'A new part begins (' + Wt.species.fox.name + '): Voice (' + Wt.species.fox.name + ', waypoint 1 of ' + voice.stages.length + '): the voice drops.', false],
      ['a merfolk voice found beside the way over\'s', 'A new part begins (' + Wt.species.mer.name + '): Voice (' + Wt.species.mer.name + ', waypoint 1 of ' + wv.stages.length + '): the voice carries.', true]]) {
      seed(sexVoice ? {} : { voice: 1 }); doc.pendingNotes = [other];
      if (sexVoice) { doc.state.tf.sexprog = { species: 'cow', to: 'female', tracks: heldParts(W4, { voice: { told: 1 } }) }; doc.state.tf.paths.cow.sex = 'female'; }
      const hv = await open(seeded);
      try {
        assert(await hv.turn('I look around the room.'));
        assert.match(tblock(hv), sexVoice ? /Showing now:[^\n]*voice \(the body's sex\) \(new to Daisy/ : /Showing now:[^\n]*voice \(new to Daisy/, label + ': the voice told already shows: ' + sh(tblock(hv)));
        assert.match(line(hv, 'roommate'), /[Hh]ears Tom's voice for the first time/, label + ': and Daisy hears it new: ' + line(hv, 'roommate').slice(-200));
        clean(hv);
      } finally { hv.close(); }
      delete doc.state.tf.sexprog; doc.state.tf.paths.cow.sex = null;
    }
    // Nothing told, nothing sent.
    seed({}); doc.pendingNotes = [];
    const h3 = await open(seeded);
    try {
      assert(await h3.turn('I look around the room.'));
      assert.doesNotMatch(tblock(h3), /Showing now|Hidden by/, 'no showing line before a change: ' + sh(tblock(h3)));
      assert.doesNotMatch(line(h3, 'roommate'), /for the first time/, 'and no stance');
      clean(h3);
    } finally { h3.close(); }
  },

  // The further pairs of nipples down a woman's belly are under her clothes like the rest of the chest, finished or not: dressed,
  // nobody is told they show, nobody takes a stance to them and no first showing is kept; bare, they show and are new. Tucking the
  // tail in hides the tail alone.
  async furtherPairsUnderClothes() {
    const TR = loadWorld().transformation.tracks.species.wolf;
    const g = await savedGame({ rmSpecies: 'wolf', rmName: 'Rin Kitsuragi', rmGender: 'female', gender: 'female', name: 'Ana Reyes' });
    const tracks = (told) => Object.fromEntries(TR.map((t) => { const j = told[t.key] === 'done' ? t.stages.length : told[t.key] || 0; return [t.key, { s: 50, e: 100, p: stageAt(j, t.stages.length), told: j, ext: 0, nextAt: 0 }]; }));
    const seed = (told) => { const store = copyStore(g.store), d = store.get(g.key).data; d.state.tf = Object.assign(baseTf('wolf', 40, { lean: 0, face: 15, tracks: tracks(told) }), { seen: {} }); d.state.present = ['Rin Kitsuragi']; d.pendingNotes = []; return store; };
    const tblock = (h) => blockOf(promptOf(lastTurn(h)), 'transformation'), chars = (h) => (/<characters[^>]*>([\s\S]*?)<\/characters>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
    const sh = (t) => ((/(?:Showing now|Hidden by)[^\n]*/.exec(t) || [])[0] || 'no showing line'), beats = (h) => storedTurns(h.mock.store, g.id).at(-1).beats || [];
    const h = await bootOn(seed({ further_pairs: 'done' }));
    try {
      patchTurns(h, (r) => { r.state_updates = []; r.time_advance_minutes = 5; r.beats = []; r.exposures = []; });
      assert(await h.turn('I sit at my desk and read.'));
      assert.doesNotMatch(tblock(h), /Showing now:[^\n]*further pairs/, 'dressed, the finished further pairs do not show: ' + sh(tblock(h)));
      assert.doesNotMatch(chars(h), /Sees [^\n]*further pairs/, 'and nobody takes a stance to them');
      assert(!beats(h).some((b) => /further pairs showed/.test(b)), 'and no first showing is kept: ' + JSON.stringify(beats(h)));
      assert(await h.turn('I undress.'));
      assert.match(tblock(h), /Showing now:[^\n]*further pairs \(new to Rin\)/, 'bare, they show and are new to Rin: ' + sh(tblock(h)));
      assert(beats(h).some((b) => /further pairs showed for the first time/.test(b)), 'and their first showing is kept: ' + JSON.stringify(beats(h)));
      clean(h);
    } finally { h.close(); }
    const h2 = await bootOn(seed({ further_pairs: 2, tail: 2 }));
    try {
      patchTurns(h2, (r) => { r.state_updates = []; r.time_advance_minutes = 5; r.beats = []; r.exposures = []; });
      assert(await h2.turn('I tuck my tail in.'));
      const hid = (/Hidden by [^\n]*/.exec(tblock(h2)) || [''])[0];
      assert(/tail \(tucked away\)/.test(hid) && !/further pairs/.test(hid), 'tucking the tail in hides the tail alone: ' + hid);
      clean(h2);
    } finally { h2.close(); }
  },

  // In an act the parts an act bares for the first time (the coat under a sleeve, the tail) get a bed partner's stance, not a
  // stranger's: the roommate who has seen what shows dressed takes the rest in, asks once and goes on, or makes room for it in
  // the act, never pretends not to see or stares, while the same prompt carries the scene note and the romance lines. The
  // stance is the same when the turn is regenerated. The bedside stance is the partner's alone: a third person in the room (the
  // creamery keeper who came by) takes an ordinary stance to what shows, never one that puts them in the act; with nobody named,
  // the one other person here is the partner.
  async actStanceIsBedside() {
    const TR = loadWorld().transformation.tracks.species.cow;
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', gender: 'male', name: 'Tom Ashby' });
    let seeded, other; try {
      assert(await first.turn('I unpack.'));
      const chars = '\n' + blockOf(promptOf(lastTurn(first)), 'characters');
      other = (/\n- ([A-Z][^(\n]+?) \([^\n]*\[creamery\]/.exec(chars) || /\n- ([A-Z][^(\n]+?) \([^\n]*\[library\]/.exec(chars) || [])[1];
      seeded = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    } finally { first.close(); }
    assert(other, 'a third person to bring into the room');
    const advKey = [...seeded.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = seeded.get(advKey).data;
    const TOLD = { hands: 2, ears: 1, eyes: 1, horns_and_crest: 1, voice: 1, forearm_coat: 1, tail: 1, own_scent: 1 };
    const tracks = Object.fromEntries(TR.map((t) => [t.key, { s: 50, e: 100, p: TOLD[t.key] ? stageAt(TOLD[t.key], t.stages.length) : 0, told: TOLD[t.key] || 0, ext: 0, nextAt: 0 }]));
    doc.state.tf = Object.assign(doc.state.tf || {}, baseTf('cow', 40, { lean: 0, face: 15, tracks })); delete doc.state.tf.hidden;
    doc.state.tf.seen = { roommate: Object.fromEntries(['hands', 'ears', 'eyes', 'voice', 'own_scent', 'horns_and_crest'].map((k) => ['cow:' + k, 1])) };
    doc.state.present = ['Tom Ashby', 'Daisy Holm', other]; doc.pendingNotes = [];
    const alone = new Map([...seeded].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); alone.get(advKey).data.state.present = ['Tom Ashby', 'Daisy Holm'];
    const ordinary = /^(?:pretends not to see|notices and says nothing|worries|stares|remarks on it|teases|flirts over it|makes room for it, as one of the kind)$/;
    const bedside = /^(?:takes it in, hands and mouth, as part of Tom|asks once, lightly, and goes on|makes room for it in the act(?:, as one of the kind)?)$/;
    const stanceOf = (l) => (l.match(/ for the first time: ([^\n]*)\.$/) || [])[1];
    const h = await boot({ setup(w, m) { m.store = seeded; } });
    try {
      assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
      patchTurns(h, (r) => { r.state_updates = []; r.time_advance_minutes = 10; r.beats = []; r.exposures = []; r.stage = 'begin'; });
      const tblock = () => (/<transformation>([\s\S]*?)<\/transformation>/.exec(promptOf(lastTurn(h))) || [])[1] || '';
      const line = () => (blockOf(promptOf(lastTurn(h)), 'characters').split('\n').find((l) => l.includes('[roommate]')) || '');
      const third = () => (blockOf(promptOf(lastTurn(h)), 'characters').split('\n').find((l) => l.startsWith('- ' + other + ' ')) || '');
      assert(await h.turn('Make love to Daisy.'));
      const p = promptOf(lastTurn(h));
      assert.match(p, /Scene note \(binding\)/, 'the turn is the act');
      assert.match(p, /Romance scene pacing \(binding\)/); assert.match(p, /Body detail \(binding\)/);
      assert.match(tblock(), /Showing now: [^\n]*forearm coat \(new to Daisy(?:, [^)]+)?\); tail \(new to Daisy(?:, [^)]+)?\)/, 'the act bares the coat and the tail, new to her: ' + (tblock().match(/Showing now[^\n]*/) || [''])[0]);
      const stance = (line().match(/ for the first time: ([^\n]*)\.$/) || [])[1];
      assert(stance, 'the roommate has a stance to what the act bares: ' + line().slice(-300));
      assert.doesNotMatch(stance, /^(?:pretends not to see|notices and says nothing|worries|stares|remarks on it|teases|flirts over it)$/, 'in bed she is no stranger across a room: ' + stance);
      assert.match(stance, bedside, 'a bed partner\'s stance: ' + stance);
      const other3 = stanceOf(third());
      assert(other3, 'the third person has a stance to what shows: ' + third().slice(-300));
      assert.doesNotMatch(other3, /hands and mouth|in the act|asks once, lightly/, 'a bystander is not put in the act: ' + other3);
      assert.match(other3, ordinary, 'the bystander takes an ordinary stance: ' + other3);
      h.click('#regen'); assert(await h.idle(15000));
      assert.equal(stanceOf(line()), stance, 'a regenerated turn keeps the stance');
      assert.equal(stanceOf(third()), other3, 'the bystander\'s too');
      clean(h);
    } finally { h.close(); }
    // Nobody named, Daisy the only other person here: she is the partner.
    const h2 = await boot({ setup(w, m) { m.store = alone; } });
    try {
      assert(await h2.settle(150, 8000)); await h2.idle(10000); await h2.settle(100, 4000);
      patchTurns(h2, (r) => { r.state_updates = []; r.time_advance_minutes = 10; r.beats = []; r.exposures = []; r.stage = 'begin'; });
      assert(await h2.turn('Make love to her.'));
      assert.match(promptOf(lastTurn(h2)), /Scene note \(binding\)/, 'the turn is the act');
      const s2 = stanceOf(blockOf(promptOf(lastTurn(h2)), 'characters').split('\n').find((l) => l.includes('[roommate]')) || '');
      assert.match(s2 || '', bedside, 'with nobody named, the one other person here is the partner: ' + s2);
      clean(h2);
    } finally { h2.close(); }
  },

  // Undo and Regenerate give back what they promise. Regenerate re-runs the last turn from the state before it (the clock
  // advances once, the narrator is given the notes it was given the first time, the player's roll is kept) and keeps the earlier
  // version; Undo puts the state, the memory and the narrator's notes back as they were before the turn and drops the stored turn.
  async undoAndRegenerateGiveBack() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      const doc = () => onlyAdv(h.mock.store).data, id = onlyAdv(h.mock.store).id, snap = () => JSON.parse(JSON.stringify({ state: doc().state, memory: doc().memory, pending: doc().pendingNotes || [] }));
      let k = 0;
      patchTurns(h, (r) => { k += 1; r.narrative = 'Version ' + k + '. ' + r.narrative; r.time_advance_minutes = 90; r.exposures = [{ species: 'cow', method: 'Daisy\'s hand on your arm', intensity: 3 }]; r.state_updates = [{ key: 'items.inventory', op: 'append', value: ['a smooth pebble ' + k] }]; });
      await setSettings(h, { pace: 'unbounded' });   // so the contact turns open a change and leave the narrator notes to carry
      for (let i = 0; i < 3; i++) assert(await h.turn('I sit with Daisy on the window seat.'), 'turn ' + (i + 1));
      const before = snap();
      assert(await h.turn('I hand Daisy a pebble from the lake.'), 'the turn to step back from');
      const first = storedTurns(h.mock.store, id).at(-1), after = snap();
      assert.notDeepEqual(after.state, before.state, 'the turn changed the state');
      assert.notDeepEqual(after.pending, before.pending, 'and the notes the narrator is to be given: ' + JSON.stringify(after.pending).slice(0, 300));
      assert.deepEqual(JSON.parse(JSON.stringify(first.stateBefore)), before.state, 'the turn kept the state before it');
      // Regenerate: the same turn again from the same point.
      const calls = turnCalls(h).length; h.click('#regen');
      const t0 = Date.now(); while (turnCalls(h).length === calls && Date.now() - t0 < 5000) await h.sleep(10);
      assert(turnCalls(h).length > calls && await h.idle(20000), 'Regenerate ran the turn again');
      const turns = storedTurns(h.mock.store, id), again = turns.at(-1);
      assert.equal(turns.length, 4, 'Regenerate replaces the last turn, it does not add one');
      assert.equal(again.n, first.n, 'under the same number');
      assert.equal(again.action, first.action, 'with the same action');
      assert.deepEqual(again.roll, first.roll, 'and the same roll of the die');
      assert.match(again.narrative, /^Version 5\. /, 'the new version is shown');
      assert(again.alts && again.alts.some((a) => a.narrative === first.narrative), 'and the earlier version is kept');
      assert.deepEqual(JSON.parse(JSON.stringify(again.stateBefore)), before.state, 'it ran from the state before the turn');
      assert.deepEqual(JSON.parse(JSON.stringify(again.pendingBefore || [])), before.pending, 'with the notes the narrator was given the first time');
      assert.deepEqual([doc().state.day, doc().state.time], [after.state.day, after.state.time], 'the clock advanced once, not twice');
      assert(!doc().state.items.inventory.includes('a smooth pebble 4') && doc().state.items.inventory.includes('a smooth pebble 5'), 'what the first version wrote is gone: ' + doc().state.items.inventory);
      // Undo: back to before the turn.
      h.click('#undo'); assert(await h.idle(20000), 'Undo finished');
      const undone = snap();
      assert.equal(storedTurns(h.mock.store, id).length, 3, 'the stored turn is gone');
      assert.deepEqual(undone.state, before.state, 'the state is as it was before the turn');
      assert.deepEqual(undone.pending, before.pending, 'and the notes the narrator is to be given');
      assert.deepEqual([undone.memory.summary, undone.memory.beats, undone.memory.facts], [before.memory.summary, before.memory.beats, before.memory.facts], 'and the memory');
      clean(h);
    } finally { h.close(); }
  },

  // The harness itself: a scenario that edits the mock store's copy of the adventure after the page has it (the changeTracks bug of
  // the last review: the page wrote its own copy back and the edit never reached it) is caught at the page's next write, unless it says
  // it means to. Editing before boot, or through the Settings screen, is the way.
  async storeEditBehindPageIsCaught() {
    for (const allow of [false, true]) {
      const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
      try {
        h.mock.allowStoreEdits = allow;
        onlyAdv(h.mock.store).data.settings.pace = 'unbounded';
        await h.turn('I look around.');
        const caught = h.mock.violations.filter((v) => v.kind === 'store-edited');
        if (allow) { assert.equal(caught.length, 0, 'mock.allowStoreEdits lets the edit stand'); clean(h); }
        else assert(caught.length && /adventures\/[^/]+ was changed in mock\.store/.test(caught[0].detail), 'an edit behind the page\'s back is recorded: ' + JSON.stringify(h.mock.violations).slice(0, 300));
      } finally { h.close(); }
    }
  },

  // A long game on the uncapped pace keeps its story. The author's save was shed on all 25 turns, down to one verbatim turn and no lore, and
  // the narrator then repeats itself because it cannot see what it wrote. Twenty-five rich turns of 560 words with a body changing on
  // many parts, the settings put in through the Settings screen: the prompt stays under the cap on every turn, the narrator keeps at
  // least three of the four verbatim turns set, and the lore is never dropped. Structure only, never wording. Known red
  // (lib/known-red.js) until the prompt shrink lands: today the window falls to 2 from turn 4 and to 1 by turn 15 to 18 (seeds 1, 7, 31 and the name seed), so it fails on the window.
  async longUncappedGameKeepsItsWindow() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
    try {
      await setSettings(h, { pace: 'unbounded', density: 'rich', window: 4 });
      const set = onlyAdv(h.mock.store).data.settings;
      assert.deepEqual([set.pace, set.density, Number(set.window)], ['unbounded', 'rich', 4], 'the settings reached the page');
      const words = (n, k) => Array.from({ length: n }, (_, i) => ['lantern', 'corridor', 'whispers', 'copper', 'stairwell', 'dust', 'laughter', 'threshold', 'somewhere', 'below'][(i * 7 + k) % 10]).join(' ');
      let n = 0;
      patchTurns(h, (r) => { n++; r.narrative = words(560, n) + ' *Turn ' + n + '.*'; r.time_advance_minutes = 180; r.exposures = [{ species: 'cow', method: 'the evening with Daisy', intensity: 3 }]; r.beats = ['Beat ' + n + ' ' + words(10, n)]; r.events = ['Day 1 10:' + String(10 + (n % 50)) + ' ' + words(12, n)]; });
      const id = onlyAdv(h.mock.store).id, shed = [];
      for (let i = 1; i <= 25; i++) {
        assert(await h.turn('I spend the evening with Daisy, step ' + i + '.', { max: 40000 }), 'turn ' + i);
        const c = lastTurn(h), note = storedTurns(h.mock.store, id).at(-1).notes.find((x) => /size cap/.test(x)) || '';
        assert(c.bytes <= PROMPT_CAP, 'turn ' + i + ': ' + c.bytes + ' bytes is over the cap');
        const win = (/verbatim window reduced to (\d+)/.exec(note) || [])[1];
        shed.push({ i, window: win ? +win : 4, loreDropped: /lore dropped/.test(note) });
      }
      const tfNow = onlyAdv(h.mock.store).data.state.tf, told = [tfNow.prog.cow.tracks, (tfNow.sexprog || { tracks: {} }).tracks].flatMap((m) => Object.values(m)).filter((r) => r.told > 0).length;
      assert(told >= 6, 'the body must be changing on many parts (told ' + told + ', 6 at least: twenty-five turns at one waypoint a turn tell 7 on most draws), or this proves nothing about the shed');
      const worst = Math.min(...shed.map((x) => x.window));
      assert(worst >= 3, 'the narrator kept only ' + worst + ' of the 4 verbatim turns set, first at turn ' + shed.find((x) => x.window === worst).i + ': ' + shed.map((x) => x.i + ':' + x.window).join(' '));
      assert(!shed.some((x) => x.loreDropped), 'the lore was dropped on turns ' + shed.filter((x) => x.loreDropped).map((x) => x.i).join(', '));
      clean(h);
    } finally { h.close(); }
  },

  // The shed ladder, as a table. One saved game, its memory summary padded by 0, 1, 4, 8, 16 and 30 KB, one turn each with an action, a
  // director note and an engine note waiting. At every size the prompt is under the cap and still carries the action, the director
  // note, the engine note and the reply contract; and a bigger pad never sheds less: the verbatim turns, the lore entries, the facts
  // and the style examples never grow back, and a turn that shed at one size sheds at every bigger one. Structure only, never wording.
  async shedLadderPadsTheSummary() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' }); let saved;
    try {
      await setSettings(first, { pace: 'unbounded', density: 'rich', window: 4 });
      let n = 0; const words = (k, m) => Array.from({ length: k }, (_, i) => ['kettle', 'harbour', 'rope', 'lamplight', 'gull', 'tide', 'salt', 'stone', 'wool', 'bread'][(i * 3 + m) % 10]).join(' ');
      patchTurns(first, (r) => { n++; r.narrative = words(560, n) + ' *Turn ' + n + '.*'; r.time_advance_minutes = 120; r.exposures = [{ species: 'cow', method: 'the evening with Daisy', intensity: 3 }]; r.facts = ['Fact ' + n + ': ' + words(12, n)]; });
      for (let i = 1; i <= 5; i++) assert(await first.turn('I spend the evening with Daisy, step ' + i + '.', { max: 30000 }), 'turn ' + i);
      saved = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    } finally { first.close(); }
    const key = [...saved.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), id = key.split('/')[1];
    const NOTE = 'The ladder check: the kettle in the kitchen starts to whistle.', ACTION = 'I pour the tea for Daisy and sit by the stove.', DIRECTOR = 'keep the scene quiet and slow';
    const pad = (kb) => Array.from({ length: Math.ceil(kb * 1024 / 72) }, (_, i) => 'Day ' + (i % 9 + 1) + ': the tide came over the causeway again and the lanterns were lit. ').join('').slice(0, kb * 1024);
    const rows = [];
    for (const kb of [0, 1, 4, 8, 16, 30]) {
      const store = new Map([...saved].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])), doc = store.get(key).data;
      doc.memory.summary = (doc.memory.summary || '') + (kb ? ' ' + pad(kb) : ''); doc.pendingNotes = (doc.pendingNotes || []).concat([NOTE]);
      const h = await boot({ setup(w, m) { m.store = store; } });
      try {
        assert(await h.settle(150, 8000)); await h.idle(10000); await h.settle(100, 4000);
        patchTurns(h, (r) => { r.exposures = []; });
        assert(await h.turn(ACTION, { director: DIRECTOR, max: 30000 }), kb + ' KB: the turn');
        const p = promptOf(lastTurn(h)), bytes = utf8Bytes(p), note = storedTurns(store, id).at(-1).notes.find((x) => /^prompt near the size cap/.test(x)) || '';
        const row = { kb, bytes, shed: !!note, verbatim: (blockOf(p, 'recent_turns').match(/^Turn \d+ \(Day/gm) || []).length, lore: (blockOf(p, 'lore').match(/<entry name=/g) || []).length,
          facts: blockOf(p, 'facts').split('\n').filter((l) => l.trim()).length, examples: utf8Bytes(blockOf(p, 'style_examples')) };
        rows.push(row);
        const at = kb + ' KB (' + JSON.stringify(row) + ')';
        assert(bytes <= PROMPT_CAP, at + ': the prompt is over the cap');
        assert(p.includes(ACTION), at + ': the player\'s action is sent');
        assert(p.includes(DIRECTOR), at + ': the director note is sent');
        assert(p.includes('Note from the engine: ' + NOTE), at + ': the engine note waiting for this turn is sent');
        assert(/<output_format>/.test(p), at + ': the reply contract is sent');
        clean(h);
      } finally { h.close(); }
    }
    const table = rows.map((r) => r.kb + 'KB:' + r.bytes + 'B/' + (r.shed ? 'shed' : 'whole') + '/v' + r.verbatim + '/l' + r.lore + '/f' + r.facts + '/x' + r.examples).join(' ');
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      assert(!a.shed || b.shed, 'a bigger pad sheds whenever a smaller one did: ' + table);
      for (const f of ['verbatim', 'lore', 'facts', 'examples']) assert(b[f] <= a[f], 'a bigger pad never sends more ' + f + ': ' + table);
    }
    assert(rows.at(-1).shed, 'the biggest pad must shed, or the table proves nothing about the ladder: ' + table);
  },

  // What the narrator writes into the state, beyond the junk values of junkUpdates: a list stops at its cap and keeps the newest, an
  // entry differing only in case is not added twice, remove takes an entry out, text is held to its length, an attitude moves one
  // a turn, and a code-owned item, an unknown item or flag and the clock are refused, each with a note. The caps are read from the
  // world's own item definitions.
  async narratorStateUpdates() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      const Wd = loadWorld(), def = (k) => Wd.trackedItems.find((x) => x.key === k);
      const list = def('inventory'), text = def('condition');
      let updates = [];
      patchTurns(h, (r) => { r.state_updates = updates; r.exposures = []; });
      const st = () => onlyAdv(h.mock.store).data.state, items = () => st().items, last = () => storedTurns(h.mock.store, onlyAdv(h.mock.store).id).at(-1);
      const many = Array.from({ length: list.maxItems + 3 }, (_, i) => 'pebble number ' + (i + 1));
      updates = [{ key: 'items.inventory', op: 'append', value: many }, { key: 'items.inventory', op: 'append', value: ['PEBBLE NUMBER ' + many.length] }];
      assert(await h.turn('I empty my pockets onto the desk.'));
      assert.equal(items().inventory.length, list.maxItems, 'a list stops at its cap');
      assert.equal(items().inventory.at(-1), many.at(-1), 'the newest entry stays');
      assert(!items().inventory.includes(many[0]), 'the oldest entries go');
      assert(last().notes.some((x) => x === 'inventory list capped at ' + list.maxItems + '; oldest entries dropped'), 'and a note says so: ' + JSON.stringify(last().notes));
      assert.equal(new Set(items().inventory.map((x) => x.toLowerCase())).size, items().inventory.length, 'the same entry in another case is not added twice');
      const a0 = st().attitudes.roommate; assert(typeof a0 === 'number' && a0 < 9, 'the roommate has an attitude with room to rise: ' + a0);
      updates = [{ key: 'items.inventory', op: 'remove', value: [many.at(-1)] }, { key: 'attitudes.roommate', op: 'inc', value: 5 }];
      assert(await h.turn('I put one back.'));
      assert(!items().inventory.includes(many.at(-1)), 'remove takes an entry out');
      assert.equal(st().attitudes.roommate, a0 + 1, 'an attitude moves at most one a turn');
      assert(last().notes.some((x) => /^attitude roommate \d+ clamped to \d+ \(±1 per turn\)$/.test(x)), 'and the clamp is noted: ' + JSON.stringify(last().notes));
      const spa = items().spa_visits, clock = st().time;
      updates = [{ key: 'items.condition', op: 'set', value: 'sore '.repeat(text.maxChars) }, { key: 'items.spa_visits', op: 'set', value: 50 }, { key: 'items.nonsense', op: 'set', value: 1 }, { key: 'flags.nonsense', op: 'set', value: true }, { key: 'time', op: 'set', value: '03:00' }];
      assert(await h.turn('I stand still.'));
      assert(items().condition.length <= text.maxChars + 1 && items().condition.endsWith('…'), 'text is held to its length, with an ellipsis: ' + items().condition.length);
      assert.equal(items().spa_visits, spa, 'a code-owned item cannot be written by the narrator');
      assert.notEqual(st().time, '03:00', 'nor the clock: ' + clock + ' -> ' + st().time);
      for (const re of [/^ignored spa_visits \(code-owned\)$/, /^ignored unknown item "nonsense"$/, /^ignored unknown flag "nonsense"$/, /^ignored time \(clock is code-owned\)$/]) assert(last().notes.some((x) => re.test(x)), 'each refusal is noted (' + re + '): ' + JSON.stringify(last().notes));
      clean(h);
    } finally { h.close(); }
  },
  // A preset or draft saved before the glimpse had its own field carries the town and the thing seen in one background label. On
  // load it is read as both: the town goes in Where you come from and the thing seen in What you think you saw, so the player's
  // block names each once. A glimpse already given is kept.
  async oldPresetSplitsTheGlimpse() {
    const old = { v: 1, worldId: 'sundered', choices: { name: 'Owen Pryce', gender: 'male', background: 'The corner shop: the shopkeeper\'s ears', strengths: ['nerve', 'wits'], rmSpecies: 'cow' }, at: Date.now() };
    const h = await boot({ setup(w) { w.localStorage.setItem('windlass.createDraft', JSON.stringify(old)); } });
    try {
      assert(await h.settle(150, 6000), 'boot did not settle');
      assert(h.$('#dlgCreate').open, 'the draft restores the creation screen');
      assert.equal(h.$('#cBackground').value, 'The city, over a corner shop', 'the old label is read as the town it named');
      assert.equal(h.$('#cGlimpse').value, 'Green ears under a headscarf', 'and the glimpse it told');
      h.click('#cBegin'); assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
      assert(!h.$('#dlgCreate').open, 'Begin went ahead: ' + h.$('#cNote').textContent);
      assert(await h.turn('I look around the room.'));
      const p = promptOf(lastTurn(h));
      assert(/two floors over a corner shop/.test(p) && !/shopkeeper's ears/.test(p), 'the player block carries the town, not the old combined line');
      clean(h);
    } finally { h.close(); }
    const kept = { v: 1, worldId: 'sundered', choices: { name: 'Owen Pryce', gender: 'male', background: 'The river: a girl with gills', glimpse: 'Bark at a stranger\'s wrists', rmSpecies: 'cow' }, at: Date.now() };
    const h2 = await boot({ setup(w) { w.localStorage.setItem('windlass.createDraft', JSON.stringify(kept)); } });
    try {
      assert(await h2.settle(150, 6000), 'boot did not settle');
      assert.equal(h2.$('#cBackground').value, 'A river town'); assert.equal(h2.$('#cGlimpse').value, 'Bark at a stranger\'s wrists', 'a glimpse already given is kept');
      h2.click('#dlgCreate [data-close]'); clean(h2);
    } finally { h2.close(); }
  },

  // A hand-written Looks in the Cast editor is what the narrator reads, every turn. Changing only the eyes (the eyes clause of the
  // paragraph's second sentence made "green eyes") must keep green on the eyes in each turn's sheet, the turn after one that showed
  // her included; before the paragraph, the short form ran Height, Build, Hair and Eyes together without labels, so a hand-written
  // "Eyes: green" reached the narrator as a bare "; green" after the hair
  // (black hair "with a green tint") and the eyes fell back on the old narration. A longer hand-written look with a line of its own
  // goes whole while she is in the scene, survives a reload on the same store, and the Cast screen shows it again. Fails on f4aa689.
  async castLooksEditReachesPrompt() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    const sheetOf = (hh) => (blockOf(promptOf(lastTurn(hh)), 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '');
    const looksOf = (line) => (/ Looks(?: \(shown last turn\))?: (.*?) (?:Not on this body:|Dress:)/.exec(line) || [])[1] || '';
    const edit = async (hh, text) => {
      hh.click('#btnCast'); await hh.sleep(20); assert.equal(hh.$('#cfName').value, 'May Tanaka', 'the Cast screen opens on the roommate');
      const el = hh.$('#cfLooks'), before = el.value; el.value = text(before); el.dispatchEvent(new hh.window.Event('input', { bubbles: true }));
      hh.click('#cfSave'); assert(await hh.idle(10000)); hh.click('[data-close="dlgCast"]'); return { before, after: el.value };
    };
    let store, edited;
    try {
      // She is on the page and named by every narration, so the second and third turns send the look as already shown.
      patchTurns(h, (r) => { r.narrative = 'May Tanaka sits on her bed across the room. ' + r.narrative; });
      assert(await h.turn('I say hello to May.'));
      let oldEyes;
      const e1 = await edit(h, (before) => { oldEyes = (before.split(/\. (?=[A-Z])/)[1] || '').split('; ').pop(); return before.replace('; ' + oldEyes + '.', '; green eyes.'); });
      assert(oldEyes && /\beyes\b/.test(oldEyes) && !/green/.test(oldEyes) && e1.after !== e1.before, 'the generated look has eyes of another colour, at the end of its second sentence: ' + e1.before.slice(0, 400));
      assert.equal(onlyAdv(h.mock.store).data.cast.overrides.roommate.looks, e1.after, 'the edit is stored as typed');
      for (const action of ['I look at May.', 'I unpack my bag.', 'I put the kettle on.']) {
        assert(await h.turn(action));
        const line = sheetOf(h), looks = looksOf(line);
        if (process.env.DUMP) console.log('  [' + action + '] ' + (/ Looks \(shown last turn\): /.test(line) ? 'Looks (shown last turn): ' : 'Looks: ') + looks);
        assert(looks, 'the roommate is sent a look on "' + action + '": ' + line.slice(0, 600));
        assert(!looks.includes(oldEyes), 'not the old eyes (' + oldEyes + ') on "' + action + '": ' + looks);
        assert.match(looks, /\beyes?\b[^.;]{0,12}\bgreen\b|\bgreen eyes\b/i, 'green stays on the eyes on "' + action + '": ' + looks);
        assert.doesNotMatch(looks, /;\s*green(?=[.;,]|$)/, 'and is never a bare word after the hair on "' + action + '": ' + looks);
      }
      // A long hand-written look with a line of its own goes whole the turn she is named.
      edited = 'Height: about five foot eight. Build: slim, with a soft waist, hips and thighs. Bust: round full breasts, a D cup, high and close-set. ' +
        'Hair: a single ponytail, black hair and fur trailing from her hair down the middle of the back to her tail. Eyes: pale violet with gold rims. ' +
        'Hide: black and white like a holstein. Hands: two hooved fingers and a hooved thumb. Legs: hooves to hips, fading out at the navel. ' +
        'Feet: two toes in a split hoof with dewclaws behind; heel raised, weight on the hooves. Tail: to the knee, tufted. Ears: cow ears out to the sides. ' +
        'Face: a faint bovine shape, with a broad soft nose. Freckles: a scatter of copper freckles across both shoulders. No horns, no crest, no heavy neck.';
      await edit(h, () => edited);
      assert(await h.turn('I look at May again.'));
      assert.equal(looksOf(sheetOf(h)), edited, 'the hand-written look goes whole while she is in the scene: ' + sheetOf(h).slice(0, 900));
      // The turn after, shown last turn: every line still there, the eyes still the eyes.
      assert(await h.turn('I sit down at the desk.'));
      const short = looksOf(sheetOf(h));
      assert(short.includes('copper freckles across both shoulders') && /eyes?:? pale violet with gold rims/i.test(short), 'the short form keeps the extra line and the eyes: ' + short);
      store = new Map([...h.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
      clean(h);
    } finally { h.close(); }
    const g = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await g.settle(150, 8000)); await g.idle(10000); await g.settle(100, 4000);
      g.click('#btnCast'); await g.sleep(20);
      assert.equal(g.$('#cfLooks').value, edited, 'after a reload the Cast screen shows the edit');
      g.click('[data-close="dlgCast"]');
      assert(await g.turn('I ask May about her day.'));
      assert.equal(looksOf(sheetOf(g)), edited, 'after a reload the turn prompt carries the edit: ' + sheetOf(g).slice(0, 900));
      g.click('#btnCast'); await g.sleep(20); assert.equal(g.$('#cfLooks').value, edited, 'and the Cast screen still shows it after the turn re-renders');
      g.click('[data-close="dlgCast"]');
      clean(g);
    } finally { g.close(); }
  },

  // A Cast edit of the roommate before the first turn reaches Turn 0: the narrator's introduction, which described her as Looks
  // first gave her, gives way to the plain one composed for the edited roommate (offered to be written again), the opening chips
  // and the memory seed follow the rename, and the first turn's prompt has neither the old eyes nor the old name anywhere.
  async castEditReachesTurnZero() {
    const escRe = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let oldEyes = '';
    const setup = (w, m) => { m.sampleHandler = (input, o, call) => {
      const out = m.defaultHandler(input, o, call); if (call.label !== 'roommate introduction') return out;
      // A real introduction describes her from Looks, as its prompt asks.
      const looks = (/Looks: ([\s\S]*?)\. (?:Not on this body|Dress):/.exec(input) || [])[1] || '', eyes = (/(?:\. |; )([^.;]*\beyes\b[^.;]*)\./.exec(looks) || [])[1] || '';
      oldEyes = oldEyes || eyes; const first = (/Full name: (\S+)/.exec(input) || [, 'She'])[1]; return out + ' ' + first + ' has ' + eyes + '.';
    }; };
    const h = await begin({ setup, rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female' });
    try {
      let doc = onlyAdv(h.mock.store).data;
      assert(oldEyes && !/green/.test(oldEyes) && doc.opening.introWritten === true && doc.opening.narrative.includes(oldEyes), 'setup: the written introduction describes her eyes as Looks gave them: ' + oldEyes);
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'Daisy Clover', 'the Cast screen opens on the roommate');
      h.$('#cfName').value = 'Bess Morrow';
      const el = h.$('#cfLooks'); el.value = el.value.replace(/(\. |; )[^.;]*\beyes\b[^.;]*\./, '$1green eyes.'); el.dispatchEvent(new h.window.Event('input', { bubbles: true }));
      h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20);
      assert.match(h.$('#cfNote').textContent, /^Saved\. Turn 0 composed again for Bess Morrow\./, h.$('#cfNote').textContent);
      h.click('[data-close="dlgCast"]');
      doc = onlyAdv(h.mock.store).data;
      assert(!doc.opening.narrative.includes(oldEyes), 'Turn 0 no longer describes the old eyes: ' + doc.opening.narrative.slice(0, 300));
      assert.match(doc.opening.narrative, /Bess Morrow/, 'and names the edited roommate'); assert.doesNotMatch(doc.opening.narrative, /Daisy|Clover/);
      assert.notEqual(doc.opening.introWritten, true, 'the written introduction gave way');
      assert.match(statusText(h), /introduction was written for Daisy Clover as first drawn/, 'the page says so: ' + statusText(h));
      assert(statusButtons(h).some((b) => /Write the introduction again/.test(b.textContent)), 'and offers to write it again');
      assert(doc.opening.suggestions.some((s) => /Bess/.test(s)) && !doc.opening.suggestions.some((s) => /Daisy/.test(s)), 'the opening chips follow the rename: ' + JSON.stringify(doc.opening.suggestions));
      assert.match(doc.memory.summary, /roommate Bess Morrow/, 'the summary follows the rename');
      assert.doesNotMatch(JSON.stringify([doc.memory.summary, doc.memory.facts, doc.memory.events, doc.memory.beats]), /Daisy|Clover/, 'and nothing in the memory seed keeps the old name');
      // Written again, the introduction is of the edited roommate.
      h.click(statusButtons(h).find((b) => /Write the introduction again/.test(b.textContent))); assert(await h.idle(20000)); await h.settle(150, 4000);
      const rm = (/<roommate>\n([\s\S]*?)\n<\/roommate>/.exec(promptOf(h.mock.sampleCalls.filter((c) => c.label === 'roommate introduction').at(-1))) || [])[1] || '';
      assert.match(rm, /^Full name: Bess Morrow \(Bovine mythkin, she\/her\)/, 'the retried prompt names the edited roommate: ' + rm.slice(0, 200)); assert.match(rm, /; green eyes\./, 'with the edited eyes: ' + rm);
      doc = onlyAdv(h.mock.store).data;
      assert.equal(doc.opening.introWritten, true, 'and is used: ' + statusText(h)); assert.match(doc.opening.narrative, /Bess has green eyes\./, 'describing her as the Cast screen left her: ' + doc.opening.narrative.slice(-200));
      patchTurns(h, (r) => { r.narrative = 'Bess looks up from the bed. ' + r.narrative; });
      assert(await h.turn('I unpack my bag.'));
      const p = promptOf(lastTurn(h)), recent = blockOf(p, 'recent_turns');
      assert(recent.includes('Turn 0'), 'Turn 0 is sent');
      assert(!recent.includes(oldEyes) && !/Daisy|Clover/.test(recent), 'and carries neither the old eyes nor the old name: ' + recent.slice(0, 300));
      assert.doesNotMatch(recent, /Cast screen/, 'with nothing before the edit to bridge, no bridging line');
      for (const tag of ['summary', 'facts', 'timeline']) assert.doesNotMatch(blockOf(p, tag), /Daisy|Clover/, tag + ' names her by the new name only: ' + blockOf(p, tag).slice(0, 200));
      const line = blockOf(p, 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '';
      assert.match(line, /^- Bess Morrow \(Bovine mythkin\) \[roommate\]/, line.slice(0, 120)); assert.match(line, / Looks: About /, 'the whole look on the first turn: ' + line.slice(0, 300));
      assert(!line.includes(oldEyes) && /\beyes?\b[^.;]{0,12}\bgreen\b|\bgreen eyes\b/i.test(line), 'with the edited eyes');
      assert.doesNotMatch(p, new RegExp('Daisy Clover|' + escRe(oldEyes)), 'nowhere in the prompt is the roommate as first drawn');
      clean(h);
    } finally { h.close(); }
  },

  // A save whose looks carry the older wording of a row (the bovine hand before the lore pinned it, a leg coat under its track's
  // name and without the legs in it, a crest in place of hair) is mended word for word before the looks are composed again, so the
  // column each row was told in survives: the heavier hand and legs stay at the fullest with the rest of the body at the standard, the
  // crest stays a full crest and the wings great wings, a rabbit's shorter feet stay short and her leg coat full, and a build drawn
  // before figures that names a thick or heavy part is drawn again, whatever its first word. Fails on b6a6209, which composed first
  // and mended a text that no longer held the old words, so the rows snapped back to the standard.
  async looksMendBeforeRelook() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', name: 'Tom Ashby' }); let store;
    try { store = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = store.get(key).data;
    const cowOld = 'Height: about five foot four. Build: soft, with a soft waist, generous hips and full thighs. Bust: round full breasts, a D cup, high and close-set, veined faintly blue toward wide areolae. Hair: hair cut blunt at the jaw, chestnut, that falls forward when the head bends over a book and is pushed back with the back of the wrist. Eyes: dark eyes with a faint blue cast. Hide: chestnut. Hands: two heavy digits hooved to the first joint; still hands that grip and hold. Forearm coat: from the hands to the elbows. Leg and hip coat: over belly, ribs and back, short and fine on the chest; all but the face. Feet: two toes in a split hoof with dewclaws behind; heel raised, weight on the hooves. Spine: a strip of coat from the tail to the nape. Tail: to the knee, tufted. Ears: cow ears out to the sides. Face: a faint cast, a broad soft nose, the jaw slightly forward. Teats and udder: long thick nipples like teats; a small rounded four-teated udder.';
    doc.roommate.looks = cowOld; doc.roommate.gen.looks = cowOld; delete doc.roommate.looksV;
    const she = { they: 'she', them: 'her', their: 'her', theirs: 'hers' }, chars = doc.cast.generated.characters;
    const harpy = chars.find((c) => c.species === 'harpy' && c.gender === 'female') || Object.assign(chars.find((c) => c.species && c.key !== 'roommate'), { species: 'harpy', gender: 'female', pronouns: she, race: 'Harpy' });
    const harpyOld = 'Height: about five foot. Build: slim, with a narrow waist, slim hips and slim thighs. Bust: shallow breasts, an A cup, with nipples long for the size of them and areolae small and dark. Eyes: amber eyes like a hawk\'s. Plumage: cream and tawny. Arms: feathered from shoulder to wrist. Wings: great wings and strong sustained flight. Hands: four clawed fingers. Legs: knee to hips, fading out at the navel, and down the spine. Feet: scaled shanks, three toes forward and one back. Tail: a fan. Crest and ears: feathers in place of hair. Face: a faint cast, a fine sharp nose, large eyes. Frame: a light frame, a deep breastbone and small high breasts.';
    harpy.looks = harpyOld; if (harpy.gen) harpy.gen.looks = harpyOld; delete harpy.looksV;
    const rabbit = Object.assign(chars.find((c) => c !== harpy && c.species && c.key !== 'roommate'), { species: 'rabbit', gender: 'female', pronouns: she, race: 'Rabbit-kind' });
    const rabbitOld = 'Height: about four foot nine. Build: a thick waist, broad hips and heavy thighs. Bust: heavy round breasts, an E, the whole weight of them shifting when the arms lift, with pale puffy areolae the width of a palm and short broad nipples. Hair: hair the same broken white and brown as the fur, long and gathered into one plait down the back, the ears clear of it. Eyes: hazel eyes; large eyes that see nearly all round. Coat: broken white and brown. Hands: human hands with blunt claws. Forearm coat: from the hands to the elbows. Leg and hip coat: over ribs and back; all but the face. Belly fur: pale belly fur to just under the breasts. Toes: four long furred toes with blunt claws. Hind feet: a little long, heel down. Spine strip: a strip of coat from tail to nape. Bob tail: a small tuft. Ears: long and upright. Face: a faint cast, a cleft nose, a faintly split lip. Front teeth: front teeth a little long, kept down by gnawing. Further pairs of nipples: three more pairs.';
    rabbit.looks = rabbitOld; if (rabbit.gen) rabbit.gen.looks = rabbitOld; delete rabbit.looksV;
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 8000), 'the older save did not load'); await h.idle(10000); await h.settle(100, 4000);
      assert(await h.turn('I look at Daisy.'), 'a turn on the older save');
      const rm = onlyAdv(h.mock.store).data.roommate, low = String(rm.looks).toLowerCase();
      assert.match(rm.looks, /^About five foot four; /, 'the roommate\'s look is composed again as the paragraph: ' + rm.looks);
      assert(low.includes('two heavy fingers and a thumb, all hooved to the first joint; still hands that grip and hold'), 'the hand keeps the fullest column, in the lore\'s words: ' + rm.looks);
      assert(low.includes('hooves to hips, and over belly, ribs and back, short and fine on the chest; all but the face'), 'the leg coat keeps the fullest column, with the legs in it: ' + rm.looks);
      assert(low.includes('heel raised, weight on the hooves') && low.includes('the tail to the knee, tufted') && low.includes('cow ears out to the sides'), 'the rest of the body stays at the standard: ' + rm.looks);
      assert(low.includes('dark eyes with a faint blue cast') && /(?:^|\. )Chestnut hide from the hands to the elbows/.test(rm.looks) && low.includes('hair cut blunt at the jaw, chestnut'), 'her eyes, hide and hair are kept: ' + rm.looks);
      assert.equal(rm.gen.looks, rm.looks, 'the generated record follows');
      const w = onlyAdv(h.mock.store).data.cast.generated.characters.find((c) => c.key === harpy.key), wl = String(w.looks).toLowerCase();
      assert.match(w.looks, /^About five foot; /, 'the harpy\'s look is the paragraph: ' + w.looks);
      assert(wl.includes('a full crest, feathers all through the hair, and tufts where the ears were'), 'the crest stays a full crest: ' + w.looks);
      assert(wl.includes('a thumb and two short clawed fingers'), 'the hand is mended to the lore\'s: ' + w.looks);
      assert(/\bhair\b/i.test(w.looks) && wl.includes('amber eyes like a hawk\'s') && /(?:^|\. )Cream and tawny plumage/.test(w.looks), 'she is given hair and keeps her eyes and plumage: ' + w.looks);
      assert(wl.includes('arms as great wings, strong sustained flight'), 'the wings stay great wings, in the lore\'s words: ' + w.looks);
      const r = onlyAdv(h.mock.store).data.cast.generated.characters.find((c) => c.key === rabbit.key), rl = String(r.looks).toLowerCase(), Wl = loadWorld();
      const rb = /^About four foot nine; (\w+), with ([^.]*)\. /.exec(r.looks);
      assert(rb && (Wl.genPools.looks.figures.female || []).some((f) => f.word === rb[1]) && !/\b(?:heavy|thick)\b/.test(rb[0]), 'the rabbit\'s build, drawn before figures with a thick waist and heavy thighs, is drawn again on a figure: ' + r.looks.slice(0, 160));
      assert(rl.includes('longer than a human\'s, heel down') && !rl.includes('furred to the sole'), 'her shorter feet stay short, in the lore\'s words: ' + r.looks);
      assert(rl.includes('feet to hips, and over ribs and back; all but the face') && rl.includes('a small tuft') && rl.includes('human hands with blunt claws'), 'her full leg coat, small tuft and human hands keep their columns: ' + r.looks);
      assert(rl.includes('broken white and brown') && rl.includes('; hazel eyes.') && rl.includes('full round breasts, an e, the whole weight of them shifting when the arms lift'), 'her coat, eyes and mended chest line are kept: ' + r.looks);
      assert.doesNotMatch(blockOf(promptOf(lastTurn(h)), 'characters'), /two heavy digits|Leg and hip coat: |feathers in place of hair|four clawed fingers|great wings and strong|a little long, heel down/i, 'the cast block carries no old wording');
      clean(h);
    } finally { h.close(); }
  },

  // A new kind typed in the Cast panel and kept with the plain Save is the person's kind everywhere the engine reads one, not only
  // the label. A cow roommate retyped as a harpy gets a harpy body drawn for her (her look was drawn, not typed), the harpy's
  // close-up notes and greeting, the harpy lore entry and the kinds met, and contact with her counts toward the harpy; the memory
  // lines that named her kind name the new one, and the narrator is told before the next turn that her body was drawn again.
  async castKindSaveRedrawsTheBody() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    try {
      const { id } = onlyAdv(h.mock.store);
      assert(await h.turn('I unpack.'));
      const oldLooks = onlyAdv(h.mock.store).data.roommate.looks;
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'May Tanaka', 'the Cast screen opens on the roommate');
      h.type('#cfSpecies', 'Harpy'); h.click('#cfSave'); assert(await h.idle(10000), 'the save did not finish'); await h.sleep(20);
      const d = onlyAdv(h.mock.store).data, o = d.cast.overrides.roommate;
      assert.equal(o.species, 'harpy', 'the kind is stored as her kind, not only as a label: ' + JSON.stringify({ species: o.species, race: o.race }));
      assert.equal(o.speciesName, 'harpies', 'and named as the world names the kind');
      assert(o.looks && o.looks !== oldLooks && /\bwings?\b/i.test(o.looks) && !/\bhoo(?:f|ves)\b|\budder\b/i.test(o.looks), 'a harpy body is drawn for her: ' + o.looks);
      assert.equal(h.$('#cfLooks').value, o.looks, 'the form shows the new body');
      assert.match(h.$('#cfNote').textContent, /looks were drawn again for the Harpy/, h.$('#cfNote').textContent);
      assert(o.senses && !/\bhoo(?:f|ves)\b|\budders?\b|\bhay\b/.test(o.senses), 'the close-up notes are the harpy\'s: ' + o.senses);
      assert.doesNotMatch(o.sheet, /bovine|the herd/i, 'the sheet tells a harpy greeting, not the cow one: ' + o.sheet);
      const mem = JSON.stringify(d.memory), named = (mem.match(/May Tanaka[^"]{0,40}/g) || []).join(' | ');
      assert(!/May Tanaka,? \(?bovine mythkin/.test(mem) && /May Tanaka \(harpy, second-year\)/.test(mem), 'the memory names her new kind: ' + named);
      assert((d.pendingNotes || []).some((n) => /^Cast edit: May Tanaka was drawn again/.test(n)), 'a note for the narrator is queued: ' + JSON.stringify(d.pendingNotes));
      h.click('[data-close="dlgCast"]');
      assert(await h.turn('I preen May.'));
      const p = promptOf(lastTurn(h)), line = blockOf(p, 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '';
      assert(p.includes('Cast edit: May Tanaka was drawn again'), 'the narrator is told her body was drawn again');
      assert(line.includes('Looks: ' + o.looks.replace(/\.$/, '')), 'the roommate line carries the new look: ' + line.slice(0, 600));
      assert.doesNotMatch(line, /hooves rule out closed shoes|an udder needs room|Close up: [^.]*\b(?:hoo(?:f|ves)|udders?|hay)\b|a heavy, warm body|greens and grain/, 'and no cow dress fact, close-up note or way: ' + line);
      const lore = [...blockOf(p, 'lore').matchAll(/<entry name="([^"]+)">/g)].map((m) => m[1]);
      assert(lore.includes('species: harpy') && !lore.includes('species: cow'), 'the lore is the harpy\'s: ' + lore.join(' | '));
      const t = storedTurns(h.mock.store, id).at(-1), after = onlyAdv(h.mock.store).data;
      assert((t.exposures || []).some((x) => x.species === 'harpy') && !(t.exposures || []).some((x) => x.species === 'cow'), 'contact with her counts toward the harpy: ' + JSON.stringify(t.exposures));
      assert(!((after.state.tf || {}).influence || {}).cow && after.state.met.includes('harpy'), 'no cow influence, and the harpy is met: ' + JSON.stringify({ influence: (after.state.tf || {}).influence, met: after.state.met }));
      clean(h);
    } finally { h.close(); }
  },

  // A Looks edit of someone the last turn described: the look goes whole on the next turn, never as shown last turn, the recent
  // turns say which of them predate the edit so the old body there gives way to <characters>, and a fact the narrator kept of her
  // old look is dropped (from the memory Undo would put back too). Once a turn after the edit has shown her, the short form is back.
  async castLooksEditOutranksOldNarration() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    const sheetOf = () => (blockOf(promptOf(lastTurn(h)), 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '');
    try {
      const base = onlyAdv(h.mock.store).data.roommate, oldEyes = (/(?:\. |; )([^.;]*\beyes\b[^.;]*)\./.exec(base.looks) || [])[1];
      assert(oldEyes && !/green/.test(oldEyes), 'setup: the drawn eyes are not green: ' + oldEyes);
      // The narrator describes her as Looks gave her and keeps a fact of it.
      patchTurns(h, (r) => { r.narrative = 'May Tanaka sits on her bed, ' + oldEyes + ' on you. ' + r.narrative; r.facts = ['Day 1: May Tanaka has ' + oldEyes + '.']; });
      assert(await h.turn('I say hello to May.'));
      patchTurns(h, (r) => { r.narrative = 'May Tanaka sits on her bed, ' + oldEyes + ' on you. ' + r.narrative; });
      assert(await h.turn('I sit on my own bed.'));
      let doc = onlyAdv(h.mock.store).data;
      assert(doc.memory.facts.some((f) => f.includes(oldEyes)), 'setup: the fact of her eyes is kept: ' + JSON.stringify(doc.memory.facts));
      assert(storedTurns(h.mock.store, doc.id)[1].memBefore.facts.some((f) => f.includes(oldEyes)), 'setup: and turn 2 would put it back on Undo');
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'May Tanaka', 'the Cast screen opens on the roommate');
      const el = h.$('#cfLooks'); el.value = el.value.replace(/(\. |; )[^.;]*\beyes\b[^.;]*\./, '$1green eyes.'); el.dispatchEvent(new h.window.Event('input', { bubbles: true }));
      h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20);
      assert.match(h.$('#cfNote').textContent, /^Saved\. 1 fact about how she looked dropped\./, h.$('#cfNote').textContent);
      h.click('[data-close="dlgCast"]');
      doc = onlyAdv(h.mock.store).data;
      assert(!doc.memory.facts.some((f) => f.includes(oldEyes)), 'the fact of the old eyes is dropped: ' + JSON.stringify(doc.memory.facts));
      assert(!storedTurns(h.mock.store, doc.id)[1].memBefore.facts.some((f) => f.includes(oldEyes)), 'and from what Undo would put back');
      patchTurns(h, (r) => { r.narrative = 'May Tanaka sits on her bed. ' + r.narrative; });
      assert(await h.turn('I unpack my bag.'));   // does not name her
      let p = promptOf(lastTurn(h)), line = sheetOf();
      assert.match(line, / Looks: About /, 'the edited look goes whole, never as shown last turn: ' + line.slice(0, 300));
      assert(!line.includes(oldEyes) && /\beyes?\b[^.;]{0,12}\bgreen\b|\bgreen eyes\b/i.test(line), 'with the edited eyes: ' + line.slice(0, 300));
      const recent = blockOf(p, 'recent_turns');
      assert(recent.includes(oldEyes), 'setup: the turn before the edit still describes the old eyes');
      assert.match(recent, /^May Tanaka's Looks were changed in the Cast screen since Turn 2: the turns up to Turn 2 describe her body as it was, and <characters> has it as it is now\./m, 'and the block says so: ' + recent.slice(0, 300));
      assert(!blockOf(p, 'facts').includes(oldEyes), 'the facts do not hold the old eyes');
      assert(await h.turn('I sit at the desk.'));
      line = sheetOf(); assert.match(line, / Looks \(shown last turn\): /, 'a turn after the edit showed her: the short form again: ' + line.slice(0, 200));
      assert.match(blockOf(promptOf(lastTurn(h)), 'recent_turns'), /Looks were changed/, 'the line stays while a turn before the edit is sent');
      assert(await h.turn('I open the window.')); assert(await h.turn('I close it again.'));
      assert.doesNotMatch(blockOf(promptOf(lastTurn(h)), 'recent_turns'), /Cast screen/, 'and goes once every turn sent is after the edit');
      clean(h);
    } finally { h.close(); }
  },

  // A kind typed over a person's own, with Looks blanked and Fill in the blanks drawing the body for it, becomes that person's kind:
  // the roommate and a cow classmate both retyped Fox keep the fox as their kind, with the fox's close-up notes, and the next turn
  // sends no cow dress fact, close-up note or way beside the fox body.
  async castKindFillKeepsTheKind() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    try {
      const d0 = onlyAdv(h.mock.store).data, me = d0.player.first;
      const mate = d0.cast.generated.characters.find((c) => c.species === 'cow');
      assert(mate, 'the test needs a cow classmate');
      patchTurns(h, (r) => { r.state_updates = (r.state_updates || []).filter((u) => u.key !== 'present').concat([{ key: 'present', op: 'set', value: [me, 'May Tanaka', mate.name] }]); });
      assert(await h.turn('I unpack.'));
      const fillAs = async (key, kind) => {
        h.click(h.$('#castList [data-key="' + key + '"]')); await h.sleep(20);
        h.type('#cfSpecies', kind); h.type('#cfLooks', '');
        h.click('#cfFill'); await h.until(() => /Filled in/.test(h.$('#cfNote').textContent), 'the fill');
        assert(/^Height: |\S/.test(h.$('#cfLooks').value), 'the fill drew a body');
        h.click('#cfSave'); assert(await h.idle(10000), 'the save did not finish'); await h.sleep(20);
      };
      h.click('#btnCast'); await h.sleep(20);
      await fillAs('roommate', 'Fox'); await fillAs(mate.key, 'Fox');
      const d = onlyAdv(h.mock.store).data;
      for (const [key, was] of [['roommate', d0.roommate], [mate.key, mate]]) {
        const o = d.cast.overrides[key];
        assert.equal(o.species, 'fox', key + ': the kind filled in is theirs: ' + JSON.stringify({ species: o.species, race: o.race }));
        assert(o.senses && o.senses !== was.senses && !/\bhoo(?:f|ves)\b|\budders?\b|\bhay\b/.test(o.senses), key + ': with the fox\'s close-up notes: ' + o.senses);
      }
      h.click('[data-close="dlgCast"]');
      assert(await h.turn('I say hello to May and ' + mate.first + '.'));
      const chars = blockOf(promptOf(lastTurn(h)), 'characters');
      for (const [key, name] of [['roommate', 'May Tanaka'], [mate.key, mate.name]]) {
        const line = chars.split('\n').find((l) => l.startsWith('- ' + name + ' ')) || '';
        assert(/ Dress: /.test(line), name + ' is in the scene with a dress line: ' + line.slice(0, 300));
        assert.doesNotMatch(line, /hooves rule out closed shoes|an udder needs room|smells of hay|\bhooves click\b|greens and grain|a heavy, warm body/, name + ': no cow line beside the fox body: ' + line);
        const close = (/ Close up: ([^.]*)\./.exec(line) || [])[1];
        if (close) assert(d.cast.overrides[key].senses.split(/;\s+/).some((f) => f.startsWith(close.slice(0, 30))), name + ': the close-up note is the fox\'s: ' + close);
      }
      clean(h);
    } finally { h.close(); }
  },

  // A Cast rename after a turn reaches the memory: the summary, the facts, the timeline, the beats and the opening chips name
  // her by the new name, as does the memory each turn would put back on Undo. A narrator who keeps the old name is still speaking
  // of her (she keeps her sheet and stays here), and the recent turns say which of them call her by the old name.
  async castRenameReachesMemory() {
    const h = await begin({ name: 'Avery Lund', rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
    const sheetOf = () => (blockOf(promptOf(lastTurn(h)), 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '');
    try {
      patchTurns(h, (r) => { r.narrative = 'Daisy Holm smiles at you. ' + r.narrative; });
      assert(await h.turn('I say hello to Daisy.'));
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'Daisy Holm', 'the Cast screen opens on the roommate');
      h.$('#cfName').value = 'Hazel Brook'; h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20); h.click('[data-close="dlgCast"]');
      const doc = onlyAdv(h.mock.store).data, M = doc.memory;
      const all = JSON.stringify([M.summary, M.facts, M.events, M.beats, doc.opening.suggestions, doc.opening.events, doc.opening.beats]);
      assert.doesNotMatch(all, /Daisy|Holm/, 'the memory and the opening chips no longer name Daisy Holm: ' + all.slice(0, 400));
      assert.match(M.summary, /roommate Hazel Brook/, M.summary.slice(0, 300));
      assert(M.facts.some((f) => /Avery rooms with Hazel Brook \(bovine mythkin, second-year\)/.test(f)), JSON.stringify(M.facts));
      assert(M.events.some((e) => /meets roommate Hazel Brook/.test(e)), JSON.stringify(M.events));
      const t1 = storedTurns(h.mock.store, doc.id)[0];
      assert(t1 && t1.memBefore && /roommate Hazel Brook/.test(t1.memBefore.summary) && !/Daisy/.test(JSON.stringify(t1.memBefore)), 'the memory turn 1 would put back on Undo is rewritten too');
      // The narrator keeps the old name.
      patchTurns(h, (r) => { r.narrative = 'Daisy Holm puts the kettle on. ' + r.narrative; r.state_updates = [{ key: 'present', op: 'set', value: ['Avery', 'Daisy Holm'] }]; });
      assert(await h.turn('I unpack my bag.'));
      const p = promptOf(lastTurn(h));
      for (const tag of ['summary', 'facts', 'timeline']) assert.doesNotMatch(blockOf(p, tag), /Daisy|Holm/, tag + ' names her by the new name only: ' + blockOf(p, tag).slice(0, 300));
      assert.match(blockOf(p, 'recent_turns'), /^Daisy Holm was renamed Hazel Brook in the Cast screen since Turn 1: the turns up to Turn 1 call her by the old name\./m, 'the recent turns bridge the two names: ' + blockOf(p, 'recent_turns').slice(0, 300));
      assert.deepEqual(Array.from(onlyAdv(h.mock.store).data.state.present), ['Avery', 'Daisy Holm'], 'setup: the narrator listed her present by the old name');
      assert(await h.turn('I sit at the desk.'));
      const line = sheetOf();
      assert.match(line, /^- Hazel Brook \(Bovine mythkin\) \[roommate\]/, line.slice(0, 120));
      assert.match(line, / Looks(?: \(shown last turn\))?: /, 'listed present by her old name, she keeps her sheet: ' + line.slice(0, 300));
      assert.match(line, / Now: here\./, 'and is here: ' + line.slice(-200));
      h.click('#undo'); assert(await h.idle(20000), 'the undo did not finish'); await h.settle(100, 4000);
      assert.doesNotMatch(onlyAdv(h.mock.store).data.memory.summary, /Daisy/, 'after Undo the summary still names Hazel Brook');
      clean(h);
    } finally { h.close(); }
  },
  // A Cast Save that leaves the kind as it was shown changes nothing of the kind's name: a Looks edit of a wolf roommate leaves the
  // werewolves of the memory alone and the kind named by the world's plural (the field holds the race label, which is not a new
  // kind). A kind typed into the field is a change of kind, and the memory follows it under the world's name for that kind.
  async castLooksSaveKeepsTheKind() {
    const h = await begin({ name: 'Owen Pryce', rmSpecies: 'wolf', rmName: 'Daisy Holm', rmGender: 'female' });
    try {
      let doc = onlyAdv(h.mock.store).data;
      assert.equal(doc.roommate.speciesName, 'werewolves', 'setup: the kind is named by its plural');
      const kindName = () => (doc.cast.overrides.roommate && doc.cast.overrides.roommate.speciesName) || doc.roommate.speciesName;
      patchTurns(h, (r) => { r.facts = ['Day 1: the werewolves of Kettle Hall run on the Moon Field at dusk.']; r.beats = ['Owen hears that the werewolves keep to the east wing.']; });
      assert(await h.turn('I unpack my bag.'));
      patchTurns(h, () => {});
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfSpecies').value, 'Werewolf', 'setup: the field shows the race label');
      const el = h.$('#cfLooks'), was = el.value; el.value = el.value.replace(/(\. |; )[^.;]*\beyes\b[^.;]*\./, '$1green eyes.'); assert.notEqual(el.value, was, 'setup: the eyes were edited'); el.dispatchEvent(new h.window.Event('input', { bubbles: true }));
      h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20);
      assert.equal(h.$('#cfNote').textContent, 'Saved.');
      doc = onlyAdv(h.mock.store).data;
      assert.equal(kindName(), 'werewolves', 'the kind keeps its name: ' + JSON.stringify(doc.cast.overrides.roommate));
      assert(doc.memory.facts.includes('Day 1: the werewolves of Kettle Hall run on the Moon Field at dusk.') && doc.memory.beats.includes('Owen hears that the werewolves keep to the east wing.'), 'and the memory its werewolves: ' + JSON.stringify([doc.memory.facts, doc.memory.beats]));
      assert(doc.memory.facts.some((f) => /rooms with Daisy Holm \(werewolf, second-year\)/.test(f)), JSON.stringify(doc.memory.facts));
      h.type('#cfSpecies', 'Harpy'); h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20); h.click('[data-close="dlgCast"]');
      doc = onlyAdv(h.mock.store).data;
      assert.equal(kindName(), 'harpies', 'a kind typed in is named by the world\'s plural for it');
      assert(doc.memory.facts.includes('Day 1: the harpies of Kettle Hall run on the Moon Field at dusk.') && doc.memory.beats.includes('Owen hears that the harpies keep to the east wing.'), 'and the memory follows: ' + JSON.stringify([doc.memory.facts, doc.memory.beats]));
      assert(!/werewolves/i.test(JSON.stringify([doc.memory.summary, doc.memory.facts, doc.memory.events, doc.memory.beats])), 'no werewolves are left in the memory');
      clean(h);
    } finally { h.close(); }
  },

  // A person added in the Cast panel with a kind typed and the plain Save brings that kind's lore entry when they are in the scene,
  // as the kind already counts among the kinds met.
  async castAddedKindGetsLore() {
    const h = await begin({ rmSpecies: 'harpy', rmName: 'Ines Varga', rmGender: 'female' });
    try {
      const me = onlyAdv(h.mock.store).data.player.first;
      h.click('#btnCast'); h.click('#castAdd'); assert(await h.idle(8000)); await h.sleep(20);
      h.type('#cfName', 'Mira Stone'); h.type('#cfSpecies', 'Werewolf'); h.click('#cfSave'); assert(await h.idle(8000)); await h.sleep(20);
      h.click('[data-close="dlgCast"]');
      patchTurns(h, (r) => { r.state_updates = (r.state_updates || []).filter((u) => u.key !== 'present').concat([{ key: 'present', op: 'set', value: [me, 'Mira Stone'] }]); });
      assert(await h.turn('I wave to Mira Stone.')); assert(await h.turn('I talk with Mira.'));
      const lore = [...blockOf(promptOf(lastTurn(h)), 'lore').matchAll(/<entry name="([^"]+)">/g)].map((m) => m[1]);
      assert(lore.includes('species: wolf'), 'the werewolf lore comes with her: ' + lore.join(' | '));
      assert(onlyAdv(h.mock.store).data.state.met.includes('wolf'), 'and she counts among the kinds met');
      const added = onlyAdv(h.mock.store).data.cast.added.find((c) => c.name === 'Mira Stone');
      assert(added && added.species === 'wolf', 'the typed kind is stored as her kind: ' + JSON.stringify(added && { species: added.species, race: added.race }));
      clean(h);
    } finally { h.close(); }
  },

  // A look typed by hand in the Cast panel is the body. A cow roommate written with human hands and feet, no tail and no udder gets
  // no dress fact, close-up note or way naming hooves, an udder or a tail, turn after turn (the close-up note turns with the turn).
  async castHandLooksDropOtherParts() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    try {
      assert(await h.turn('I unpack.'));
      const typed = 'She is petite and slim, about five foot two, with a heart-shaped face, long silver hair and green eyes; small rounded ears; a pale grey coat over the forearms and shins; human hands; human feet; no tail; no udder.';
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'May Tanaka');
      h.type('#cfLooks', typed); h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20); h.click('[data-close="dlgCast"]');
      const o = onlyAdv(h.mock.store).data.cast.overrides.roommate;
      assert.equal(o.looks, typed, 'the look is kept as typed');
      for (const action of ['I look at May.', 'I sit with May.', 'I ask May about her day.']) {
        assert(await h.turn(action));
        const line = blockOf(promptOf(lastTurn(h)), 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '';
        assert(line.includes(typed.replace(/\.$/, '')) || /Looks \(shown last turn\): /.test(line), 'the typed look goes out on "' + action + '": ' + line.slice(0, 400));
        const rest = line.slice(line.indexOf(' Dress: '));
        assert(line.includes(' Dress: '), 'she has a dress line on "' + action + '"');
        assert.doesNotMatch(rest, /\b(?:hoo(?:f|fs|ves)|udders?|tails?)\b/i, 'no dress fact, close-up note or way names a part she was written without, on "' + action + '": ' + rest);
      }
      const kept = onlyAdv(h.mock.store).data.cast.overrides.roommate;
      assert(kept.looksByHand === true && !('looksV' in kept), 'the look is marked as typed by hand, never to be composed again: ' + JSON.stringify({ looksByHand: kept.looksByHand, looksV: kept.looksV }));
      clean(h);
    } finally { h.close(); }
  },

  // A Looks edit drops only the facts that gave the person a body: a fact of what she promised or saw, with a body word in it,
  // stays, and so does the engine's own line of who the player glimpsed (true from the reveal on), in the memory, in what Undo
  // would put back and in the next prompt's facts.
  async castLooksEditKeepsOtherFacts() {
    const h = await begin({ name: 'Avery Lund', gender: 'female', rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
    try {
      const base = onlyAdv(h.mock.store).data.roommate, oldEyes = (/(?:\. |; )([^.;]*\beyes\b[^.;]*)\./.exec(base.looks) || [])[1];
      assert(oldEyes && !/green/.test(oldEyes), 'setup: the drawn eyes are not green: ' + oldEyes);
      const kept = ['Day 1: Daisy Holm promised to braid Avery\'s hair before the mixer.', 'Day 1: Daisy Holm saw the tail of something under the stairs.', 'Avery now knows Daisy Holm is the one she saw before the letter came: Hooves under a long skirt, and hair down to the waist.'];
      // Three facts a turn at most, so the four come over two turns.
      patchTurns(h, (r) => { r.facts = ['Day 1: Daisy Holm has ' + oldEyes + '.', kept[0]]; });
      assert(await h.turn('I say hello to Daisy.'));
      patchTurns(h, (r) => { r.facts = kept.slice(1); });
      assert(await h.turn('I sit on my own bed.'));
      patchTurns(h, () => {});
      let doc = onlyAdv(h.mock.store).data;
      assert(doc.memory.facts.some((f) => f.includes(oldEyes)) && kept.every((f) => doc.memory.facts.includes(f)), 'setup: all four facts are kept: ' + JSON.stringify(doc.memory.facts));
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'Daisy Holm', 'the Cast screen opens on the roommate');
      const el = h.$('#cfLooks'); el.value = el.value.replace(/(\. |; )[^.;]*\beyes\b[^.;]*\./, '$1green eyes.'); el.dispatchEvent(new h.window.Event('input', { bubbles: true }));
      h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20);
      assert.equal(h.$('#cfNote').textContent, 'Saved. 1 fact about how she looked dropped.');
      h.click('[data-close="dlgCast"]');
      doc = onlyAdv(h.mock.store).data;
      assert(!doc.memory.facts.some((f) => f.includes(oldEyes)), 'the fact of her eyes is dropped: ' + JSON.stringify(doc.memory.facts));
      assert(kept.every((f) => doc.memory.facts.includes(f)), 'the promise, what she saw and the glimpse line stay: ' + JSON.stringify(doc.memory.facts));
      const t2 = storedTurns(h.mock.store, doc.id)[1];
      assert(t2.memBefore.facts.includes(kept[0]) && !t2.memBefore.facts.some((f) => f.includes(oldEyes)) && kept.slice(1).every((f) => t2.facts.includes(f)), 'and in what Undo would put back: ' + JSON.stringify([t2.memBefore.facts, t2.facts]));
      assert(await h.turn('I unpack my bag.'));
      const facts = blockOf(promptOf(lastTurn(h)), 'facts');
      assert(kept.every((f) => facts.includes(f)) && !facts.includes(oldEyes), 'the next prompt carries them and not the old eyes: ' + facts.slice(0, 600));
      clean(h);
    } finally { h.close(); }
  },

  // Remove from the story takes the person out of who is present however the scene listed them: with a race label, by surname, or
  // under a name given in the Cast panel. The store, the newest turn's state and the next turn's <state> no longer hold them, and
  // Restore brings them back to the Cast list.
  async castRemoveTakesThemOut() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    try {
      const { id } = onlyAdv(h.mock.store), me = onlyAdv(h.mock.store).data.player.first;
      let listed = null;
      patchTurns(h, (r) => { if (listed) r.state_updates = (r.state_updates || []).filter((u) => u.key !== 'present').concat([{ key: 'present', op: 'set', value: [me].concat(listed) }]); });
      const pick = async () => { h.click('#btnCast'); await h.sleep(20); h.click(h.$('#castList [data-key="roommate"]')); await h.sleep(20); };
      for (const [entry, rename] of [['Daisy Holm (Bovine mythkin)', ''], ['Holm', ''], ['Clara Holm', 'Clara Holm']]) {
        if (rename) { await pick(); h.type('#cfName', rename); h.click('#cfSave'); assert(await h.idle(8000)); await h.sleep(20); h.click('[data-close="dlgCast"]'); }
        listed = [entry]; assert(await h.turn('I say hello to ' + entry.split(' ')[0] + '.')); listed = null;
        assert(onlyAdv(h.mock.store).data.state.present.includes(entry), 'the scene lists "' + entry + '"');
        await pick(); assert.match(h.$('#cfRemove').textContent, /Remove from the story/);
        h.click('#cfRemove'); assert(await h.idle(8000)); await h.sleep(20);
        const d = onlyAdv(h.mock.store).data, t = storedTurns(h.mock.store, id).at(-1);
        assert(d.cast.hidden.includes('roommate'), 'she is out of the story');
        assert(!d.state.present.some((x) => /Holm/.test(x)), '"' + entry + '" is no longer present: ' + JSON.stringify(d.state.present));
        assert(!t.stateAfter.present.some((x) => /Holm/.test(x)), 'nor in the newest turn\'s state: ' + JSON.stringify(t.stateAfter.present));
        assert(d.state.present.includes(me), 'the player is still present');
        h.click('[data-close="dlgCast"]');
        assert(await h.turn('I unpack my bag.'));
        const st = blockOf(promptOf(lastTurn(h)), 'state');
        assert.doesNotMatch(st, /Holm/, 'the next turn\'s <state> does not list her: ' + st.slice(0, 300));
        await pick(); h.click('#cfRemove'); assert(await h.idle(8000)); await h.sleep(20); h.click('[data-close="dlgCast"]');
        assert(!onlyAdv(h.mock.store).data.cast.hidden.includes('roommate'), 'Restore brings her back');
      }
      clean(h);
    } finally { h.close(); }
  },

  // A rename reaches each turn's own record too: the beats <earlier_turns> is built from once a turn leaves the verbatim window, and
  // the facts, events and beats a turn's previous version puts back into the memory.
  async castRenameReachesEarlierTurns() {
    const h = await begin({ name: 'Avery Lund', rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
    try {
      patchTurns(h, (r) => { r.beats = ['Daisy Holm shows Avery the kettle and the spare key.']; r.events = ['Day 1: Daisy Holm lends Avery a key']; r.facts = ['Day 1: Daisy Holm keeps the spare key.']; });
      assert(await h.turn('I say hello to Daisy.'));
      h.click('#regen'); assert(await h.idle(20000), 'regenerate did not finish'); await h.settle(100, 4000);
      patchTurns(h, (r) => { r.beats = ['Avery unpacks.']; });
      h.click('#btnCast'); await h.sleep(20); assert.equal(h.$('#cfName').value, 'Daisy Holm', 'the Cast screen opens on the roommate');
      h.$('#cfName').value = 'Hazel Brook'; h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20); h.click('[data-close="dlgCast"]');
      let doc = onlyAdv(h.mock.store).data; const t1 = storedTurns(h.mock.store, doc.id)[0];
      assert.deepEqual(t1.beats, ['Hazel Brook shows Avery the kettle and the spare key.'], 'the turn\'s own beats are rewritten: ' + JSON.stringify(t1.beats));
      assert(t1.alts && t1.alts.length === 1 && !/Daisy/.test(JSON.stringify([t1.alts[0].beats, t1.alts[0].events, t1.alts[0].facts])), 'and its previous version\'s: ' + JSON.stringify(t1.alts).slice(0, 400));
      const pv = h.document.querySelector('[data-prevver]'); assert(pv, 'the previous version is offered');
      pv.click(); assert(await h.idle(20000), 'switching to the previous version did not finish'); await h.settle(100, 4000);
      doc = onlyAdv(h.mock.store).data;
      const all = JSON.stringify([doc.memory.summary, doc.memory.facts, doc.memory.events, doc.memory.beats]);
      assert.doesNotMatch(all, /Daisy|Holm/, 'the previous version puts the new name back into the memory: ' + all.slice(0, 400));
      assert(doc.memory.facts.includes('Day 1: Hazel Brook keeps the spare key.') && doc.memory.events.includes('Day 1: Hazel Brook lends Avery a key') && doc.memory.beats.includes('Hazel Brook shows Avery the kettle and the spare key.'), all.slice(0, 400));
      for (const a of ['I unpack my bag.', 'I sit at the desk.', 'I open the window.', 'I close it again.']) assert(await h.turn(a));
      const p = promptOf(lastTurn(h)), earlier = blockOf(p, 'earlier_turns');
      assert.match(earlier, /^Turn 1 \(Day 1 [0-9:]+\): Hazel Brook shows Avery the kettle and the spare key\./m, 'out of the verbatim window, the turn is told by its beats under the new name: ' + earlier.slice(0, 400));
      assert.doesNotMatch(p, /Daisy|Holm/, 'and nothing in the prompt calls her by the old name');
      clean(h);
    } finally { h.close(); }
  },

  // A rename in the Cast panel reaches every saved turn's list of who is present, the trimmed turns as well, so the story still
  // knows the person was on the page under the new name: Redraw says the narrator will be told, and queues the note for it.
  async castRenameReachesTrimmedTurns() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    try {
      const { id } = onlyAdv(h.mock.store), me = onlyAdv(h.mock.store).data.player.first;
      let listed = [me, 'Daisy Clover'];
      patchTurns(h, (r) => { r.state_updates = (r.state_updates || []).filter((u) => u.key !== 'present').concat([{ key: 'present', op: 'set', value: listed }]); });
      for (const action of ['I talk with Daisy.', 'I walk to class with Daisy.', 'I read alone.', 'I go for a run.', 'I write a letter home.']) { assert(await h.turn(action)); if (/class/.test(action)) listed = [me]; }
      const before = storedTurns(h.mock.store, id);
      assert(before.some((t) => t._trimmed && t.stateAfter.present.includes('Daisy Clover')), 'a trimmed turn lists her: ' + JSON.stringify(before.map((t) => [t.n, !!t._trimmed, t.stateAfter.present])));
      h.click('#btnCast'); await h.sleep(20); h.click(h.$('#castList [data-key="roommate"]')); await h.sleep(20);
      h.type('#cfName', 'Bess Morrow'); h.click('#cfSave'); assert(await h.idle(8000)); await h.sleep(20);
      const turns = storedTurns(h.mock.store, id);
      for (const t of turns) for (const s of [t.stateBefore, t.stateAfter]) assert(!JSON.stringify(s.present).includes('Daisy Clover'), 'turn ' + t.n + (t._trimmed ? ' (trimmed)' : '') + ' still lists the old name: ' + JSON.stringify(s.present));
      assert(turns.some((t) => t._trimmed && t.stateAfter.present.includes('Bess Morrow')), 'the trimmed turns hold the new name');
      assert.match(h.$('#cfRedrawSays').textContent, /the narrator is told the body was drawn again/, h.$('#cfRedrawSays').textContent);
      h.click('#cfRedraw'); assert(await h.idle(8000)); await h.sleep(20);
      const d = onlyAdv(h.mock.store).data;
      assert.equal(d.cast.overrides.roommate.name, 'Bess Morrow', 'the name is kept through the redraw');
      assert((d.pendingNotes || []).some((n) => n.startsWith('Cast edit: Bess Morrow was drawn again')), 'the narrator is told: ' + JSON.stringify(d.pendingNotes));
      clean(h);
    } finally { h.close(); }
  },

  // The marker of a Looks edit comes down with an Undo past it: edited after the third turn, with that turn undone and played again,
  // the look goes whole on the turn played in its place and the short form is back on the next, and the recent turns' line names
  // the turns left, not the one played after the edit.
  async castEditMarkerFollowsUndo() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'May Tanaka', rmGender: 'female' });
    const sheetOf = () => (blockOf(promptOf(lastTurn(h)), 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '');
    try {
      patchTurns(h, (r) => { r.narrative = 'May Tanaka sits on her bed. ' + r.narrative; });
      for (const a of ['I say hello to May.', 'I sit on my own bed.', 'I unpack my bag.']) assert(await h.turn(a));
      h.click('#btnCast'); await h.sleep(20);
      const el = h.$('#cfLooks'), was = el.value; el.value = el.value.replace(/(\. |; )[^.;]*\beyes\b[^.;]*\./, '$1green eyes.'); assert.notEqual(el.value, was, 'setup: the eyes were edited'); el.dispatchEvent(new h.window.Event('input', { bubbles: true }));
      h.click('#cfSave'); assert(await h.idle(10000)); await h.sleep(20); h.click('[data-close="dlgCast"]');
      assert.equal(onlyAdv(h.mock.store).data.cast.edits.roommate.turn, 3, 'setup: the edit is marked after the third turn');
      h.click('#undo'); assert(await h.idle(20000), 'undo did not finish'); await h.settle(100, 4000);
      assert.equal(onlyAdv(h.mock.store).data.cast.edits.roommate.turn, 2, 'the marker comes down with the undone turn');
      assert(await h.turn('I unpack my bag.'));
      assert.match(sheetOf(), / Looks: About /, 'the look goes whole on the turn played in the undone one\'s place: ' + sheetOf().slice(0, 200));
      assert.match(blockOf(promptOf(lastTurn(h)), 'recent_turns'), /since Turn 2: the turns up to Turn 2 describe/, 'the line names the turns left: ' + blockOf(promptOf(lastTurn(h)), 'recent_turns').slice(0, 300));
      assert(await h.turn('I sit at the desk.'));
      assert.match(sheetOf(), / Looks \(shown last turn\): /, 'and the short form is back the turn after: ' + sheetOf().slice(0, 200));
      assert.match(blockOf(promptOf(lastTurn(h)), 'recent_turns'), /since Turn 2: the turns up to Turn 2 describe/);
      clean(h);
    } finally { h.close(); }
  },

  // A Cast form left open while the page picks up a save from another device follows that save: it shows the other device's edit,
  // keeps the edits typed here and not yet saved, says what happened, and a Save then keeps the other device's edit instead of
  // writing the old values back over it.
  async castFormFollowsSync() {
    const A = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    let B = null;
    try {
      assert(await A.turn('I look around.'));
      const store = A.mock.store;
      B = await boot({ setup(w, m) { m.store = store; } }); assert(await B.settle(300, 15000)); await B.idle(15000);
      B.click('#btnCast'); await B.sleep(20); assert.equal(B.$('#cfName').value, 'Daisy Clover', 'the other device opens the Cast screen on the roommate');
      B.type('#cfAim', 'find a quiet corner to read');
      const edited = 'About four foot eleven and petite. A short copper crop and green eyes. A knee-length tufted tail. No horns.';
      A.click('#btnCast'); await A.sleep(20); A.type('#cfLooks', edited); A.click('#cfSave'); assert(await A.idle(10000)); A.click('[data-close="dlgCast"]');
      assert.equal(onlyAdv(store).data.cast.overrides.roommate.looks, edited, 'the first device saved its edit');
      B.window.dispatchEvent(new B.window.Event('focus')); await B.settle(300, 8000); await B.idle(15000);
      assert(B.$('#dlgCast').open, 'the Cast screen is still open on the other device');
      assert.equal(B.$('#cfLooks').value, edited, 'and its form shows the save it picked up');
      assert.equal(B.$('#cfAim').value, 'find a quiet corner to read', 'with the edit typed there and not yet saved');
      assert.match(B.$('#cfNote').textContent, /another device/, B.$('#cfNote').textContent);
      B.click('#cfSave'); assert(await B.idle(10000)); await B.sleep(20);
      const o = onlyAdv(store).data.cast.overrides.roommate;
      assert.equal(o.looks, edited, 'the Save there keeps the first device\'s look');
      assert.equal(o.aims.default, 'find a quiet corner to read', 'and saves its own edit');
      clean(A); clean(B);
    } finally { A.close(); if (B) B.close(); }
  },

  // Redraw and Fill in the blanks keep the look they compose, with its own looksV, in the Cast edit or the added person, and a later
  // version that composes looks again reaches those as it reaches everyone else: an older save whose redrawn and filled people have
  // a look in the old wording has them composed again on load, and its next turn sends no old wording, while a look typed by hand
  // over a redrawn one stays as typed.
  async castEditLooksFollowTheMigration() {
    const LOOKS_V = Number((/const LOOKS_V = (\d+);/.exec(fs.readFileSync(HTML, 'utf8')) || [])[1]);
    const typed = 'A tall woman with a scar across one eyebrow.';
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    let store, redrawn, byHand, addedKey;
    try {
      assert(await h.turn('I unpack.'));
      const d0 = onlyAdv(h.mock.store).data, told = JSON.stringify(d0.state.present) + JSON.stringify(d0.memory);
      const pools = loadWorld().genPools.species, drawn = d0.cast.generated.characters.filter((c) => pools[c.species] && !told.includes(c.first));
      assert(drawn.length >= 2, 'the test needs two classmates of a drawn kind the story has not named');
      [redrawn, byHand] = [drawn[0], drawn[1]];
      h.click('#btnCast'); await h.sleep(20);
      for (const c of [redrawn, byHand]) { h.click(h.$('#castList [data-key="' + c.key + '"]')); await h.sleep(20); h.click('#cfRedraw'); assert(await h.idle(8000)); await h.sleep(20); }
      h.type('#cfLooks', typed); h.click('#cfSave'); assert(await h.idle(8000)); await h.sleep(20);
      h.click('#castAdd'); assert(await h.idle(8000)); await h.sleep(20);
      addedKey = onlyAdv(h.mock.store).data.cast.added.at(-1).key;
      h.type('#cfSpecies', 'cow'); h.$('#cfGender').value = 'female'; h.$('#cfGender').dispatchEvent(new h.window.Event('change', { bubbles: true }));
      h.click('#cfFill'); await h.until(() => /Filled in/.test(h.$('#cfNote').textContent), 'the fill');
      h.click('#cfSave'); assert(await h.idle(8000)); await h.sleep(20);
      store = new Map([...h.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
      clean(h);
    } finally { h.close(); }
    // The save as an older version wrote it: the composed looks under an older looksV,
    // no mark on any of them, and the hand-typed look beside the looksV its redraw left.
    const doc = onlyAdv(store).data, o = doc.cast.overrides[redrawn.key], a = doc.cast.added.find((c) => c.key === addedKey), hand = doc.cast.overrides[byHand.key];
    for (const r of [o, a]) {
      assert(r && r.looks && typeof r.looksV === 'number', 'Redraw and Fill keep a composed look with its looksV: ' + JSON.stringify(r && { looksV: r.looksV, looks: String(r.looks).slice(0, 80) }));
      r.looksV = LOOKS_V - 1; delete r.looksByHand;
    }
    assert.equal(hand.looks, typed, 'the look typed over the redrawn one is stored as typed');
    hand.looksV = LOOKS_V - 1; delete hand.looksByHand;
    doc.state.present = [doc.player.first, o.name, a.name];
    const g = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await g.settle(150, 8000)); await g.idle(10000); await g.settle(100, 4000);
      assert(await g.turn('I look around the room.'), 'a turn on the older save');
      const after = onlyAdv(g.mock.store).data;
      for (const [who, r] of [['the redrawn classmate', after.cast.overrides[redrawn.key]], ['the person added and filled in', after.cast.added.find((c) => c.key === addedKey)]]) {
        assert(r.looksV === LOOKS_V && !/Forearm coat: /.test(r.looks), who + ' is composed again on load: ' + JSON.stringify({ looksV: r.looksV, looks: r.looks.slice(0, 300) }));
      }
      const h2 = after.cast.overrides[byHand.key];
      assert(h2.looks === typed && h2.looksByHand === true && !('looksV' in h2), 'the look typed by hand stays as typed, and is marked so: ' + JSON.stringify(h2));
      const p = promptOf(lastTurn(g));
      assert(p.includes(o.name) && p.includes(a.name), 'both are in the turn prompt');
      assert.doesNotMatch(p, /Forearm coat: /, 'the turn prompt sends no look in the old wording');
      clean(g);
    } finally { g.close(); }
  },

  // Every kind's looks, for each sex it has, are one paragraph with no label: it opens with the height and the figure with its parts,
  // the hair and the eyes follow, the kind's must-nots close it; no build is heavy or thick, petite and willowy are drawn, the fuller
  // cups are still drawn, and the pools themselves hold no heavy figure, part or breast line. Fails on b6a6209, where the looks were
  // labelled rows and heavy was a figure.
  async looksProseEveryKind() {
    const G = loadGenerator(HTML, WORLDS, { random: mulberry32(global.__WL_SEED) }), Wg = G.W, LK = Wg.genPools.looks, TRS = Wg.transformation.tracks.species;
    const labels = new Set(['Height', 'Build', 'Hair', 'Eyes', 'Face', 'Ears', 'Bust', 'Body'].concat(Object.values(LK.labels || {}), ...Object.values(LK.kinds).map((K) => Object.values(K.labels || {})), ...Object.values(TRS).map((M) => M.map((t) => t.name))));
    const labelRe = new RegExp('(?:^|[.;] )(?:' + [...labels].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + '): ');
    const figures = new Set(), cups = new Set(), heavy = /\b(?:heavy|thick)\b/;
    for (const [k, sp] of Object.entries(Wg.genPools.species)) for (const g of sp.genders) for (let i = 0; i < 40; i++) {
      const L = String(G.genPerson(Wg, { species: k, gender: g }).looks || ''), tag = k + ' ' + g + ': ', s = L.replace(/\.$/, '').split(/\. (?=[A-Z])/);
      assert.doesNotMatch(L, labelRe, tag + 'a label in the paragraph: ' + L);
      const figure = /^About (?:\w+ foot(?: \w+)?|[\w ]+ feet, adult in proportion); (\w+), with (.*)$/.exec(s[0]);
      assert(figure, tag + 'the opening is the height, then the figure and its parts: ' + s[0]);
      assert((LK.figures[g] || []).some((f) => f.word === figure[1]), tag + figure[1] + ' is a figure of the world\'s');
      assert.doesNotMatch(figure[0], heavy, tag + 'a heavy or thick build: ' + s[0]);
      figures.add(g + ' ' + figure[1]);
      assert.match(s[1] || '', /\bhair\b[^]*; [^;]*\beyes\b[^;]*$/i, tag + 'the second sentence is the hair, then the eyes: ' + s[1]);
      if (TRS[k]) for (const [re, what] of [[/\bhands?\b|\bfingers\b/i, 'hands'], [/\bfeet\b|\bfoot\b|\bpaws?\b|\bhooves\b|\btalons?\b|\btoes\b|\bshanks\b/i, 'feet'], [/\bears?\b|\bcrest\b/i, 'ears'], [/\bface\b|\bmuzzle\b/i, 'face']]) assert.match(L, re, tag + 'the ' + what + ' are named: ' + L);
      if (g === 'female') { const m = /\b(?:an?|neat|small|full|soft|generous|big) (AA|A|B|C|D|DD|E|F|G)\b|\b(AA|A|B|C|D|DD|E|F|G) cup\b/.exec(L); assert(m, tag + 'a cup size: ' + L); cups.add(m[1] || m[2]); }
      const A = (LK.kinds[k] || {}).absent || {}, nots = [].concat(A[g] || [], A.all || []).map((x) => 'no ' + String(x).replace(/^(?:an?|the) /i, ''));
      if (nots.length) assert(L.endsWith(' N' + nots.join(', ').slice(1) + '.'), tag + 'the must-nots close the paragraph: ' + L.slice(-120));
    }
    for (const f of ['female petite', 'female willowy', 'female slim', 'female full', 'male lean', 'male solid']) assert(figures.has(f), f + ' is drawn: ' + [...figures].join(', '));
    for (const c of ['A', 'B', 'C', 'D', 'DD', 'E']) assert(cups.has(c), 'a ' + c + ' cup is drawn: ' + [...cups].join(' '));
    for (const figs of Object.values(LK.figures)) for (const f of figs) assert(!heavy.test(f.word) && !Object.values(f.fits).flat().some((w) => heavy.test(w)), 'no figure is heavy or fits a heavy part: ' + f.word);
    const pools = [].concat(...Object.values(LK.build || {}).map((B) => Object.values(B).flat()), ...Object.values(LK.kinds).map((K) => Object.values(K.build || {}).flatMap((B) => Object.values(B).flat())), ...Object.values(LK.kinds).map((K) => Object.values(K.sexDraws || {}).flatMap((D) => Object.values(D).flat())), Object.values(LK.sexDraws || {}).flatMap((D) => Object.values(D).flat()));
    for (const ph of pools) assert(!heavy.test(ph), 'no build phrase is heavy or thick: ' + ph);
    for (const line of Wg.genPools.breasts.concat(...Object.values(Wg.genPools.species).map((x) => x.breasts || []))) assert(!/\bheavy\b/.test(line), 'no breast line says heavy: ' + line);
    assert(Wg.genPools.species.cow.breasts.includes('medium perky breasts, a C cup, faintly veined toward small areolae; the nipples long and thick like teats'), 'the bovine pool has the medium perky C cup line');
  },

  // A save from the labelled version (looksV 2) is composed again as the paragraph on load, once: the colour, hair, eyes, chest and
  // every part's column and words are kept, a breast line the world has since reworded is mended first, a build naming a figure the
  // world no longer draws (heavy, a thick waist) is drawn again from the figures it has, a Cast edit that only carried the look
  // follows, a look typed by hand stays, and the turn prompt carries the paragraph. Fails on b6a6209, where looksV 2 was current.
  async looksProseMigration() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', name: 'Tom Ashby' }); let store;
    try { store = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = store.get(key).data, Wl = loadWorld();
    const cowV2 = 'Height: about five foot four. Build: heavy, with a thick waist, generous hips and heavy thighs. Bust: full heavy breasts, a D cup and more, that sit high for their weight and are veined blue under the thin skin, with wide dark areolae. Hair: hair cut blunt at the jaw, chestnut, that falls forward when the head bends over a book and is pushed back with the back of the wrist. Eyes: dark eyes with a faint blue cast. Hide: chestnut. Hands: two hooved fingers and a hooved thumb. Arms: from the hands to the shoulders. Legs: hooves to hips, and over belly, ribs and back, short and fine on the chest; all but the face. Feet: two toes in a split hoof with dewclaws behind; a full hock, long foot, heel high. Spine: a strip of coat from the tail to the nape. Tail: to the ankle, a heavy tuft. Ears: large, wide ears. Face: a faint cast, a broad soft nose, the jaw slightly forward. Teats and udder: full teats; a fuller udder that shows under clothes. No horns, no crest, no heavy neck.';
    doc.roommate.looks = cowV2; doc.roommate.gen.looks = cowV2; doc.roommate.looksV = 2;
    const he = { they: 'he', them: 'him', their: 'his', theirs: 'his' }, she = { they: 'she', them: 'her', their: 'her', theirs: 'hers' }, chars = doc.cast.generated.characters;
    const wolf = chars.find((c) => c.species && c.key !== 'roommate'), typed = chars.find((c) => c !== wolf && c.species && c.key !== 'roommate');
    const third = chars.find((c) => c !== wolf && c !== typed && c.key !== 'roommate');
    Object.assign(wolf, { species: 'wolf', gender: 'male', pronouns: he, race: 'Werewolf', looksV: 2 });
    const wolfV2 = 'Height: about six foot one. Build: athletic, with square shoulders, a deep chest and a lean waist. Hair: hair cropped to a fingertip\'s length, so the ears stand clear of it. Eyes: yellow eyes. Pelt: grey; fur dense and soft; pads and claws black. Hands: five strong fingers, pads on tips and palm, blunt claws. Arms: from the hands to the elbows. Legs: paws to hips, fading out at the navel. Feet: four clawed, padded toes and a dewclaw; heel raised a hand\'s width, weight on the toes. Spine: a hand-wide ruff from tail to nape. Tail: a full brush to the calf. Ears: tall wolf ears set high. Face: a faint cast, a broad nose with a wolf\'s tip, the jaw slightly forward. Teeth: long canines, shearing back teeth. Mantle: a thick neck and fur at the nape. No further pairs of nipples.';
    wolf.looks = wolfV2; if (wolf.gen) wolf.gen.looks = wolfV2;
    // A save from before figures, composed again on b6a6209, kept its build as written: parts with no figure word before them.
    Object.assign(third, { species: 'wolf', gender: 'female', pronouns: she, race: 'Werewolf', looksV: 2 });
    const herV2 = wolfV2.replace('about six foot one', 'about five foot seven').replace('athletic, with square shoulders, a deep chest and a lean waist', 'a thick waist, wide hips and heavy thighs');
    third.looks = herV2; if (third.gen) third.gen.looks = herV2;
    doc.cast.overrides = Object.assign(doc.cast.overrides || {}, { roommate: { looks: cowV2 }, [typed.key]: { looks: 'A tall woman with a scar across one eyebrow.' } });
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 8000), 'the older save did not load'); await h.idle(10000); await h.settle(100, 4000);
      assert(await h.turn('I look at Daisy.'), 'a turn on the older save');
      const adv = onlyAdv(h.mock.store).data, rm = adv.roommate, low = String(rm.looks).toLowerCase();
      assert.equal(rm.looksV, 3, 'the look is marked as composed the paragraph way');
      const build = /^About five foot four; (\w+), with ([^.]*)\. /.exec(rm.looks);
      assert(build && (Wl.genPools.looks.figures.female || []).some((f) => f.word === build[1]) && !/\b(?:heavy|thick)\b/.test(build[0]), 'the height is kept and the heavy build is drawn again from the world\'s figures: ' + rm.looks.slice(0, 160));
      assert(low.includes('full round breasts, a d cup and more, that sit high for their weight and are veined blue under the thin skin, with wide dark areolae'), 'the chest line is mended to the world\'s wording and kept: ' + rm.looks);
      assert(low.includes('dark eyes with a faint blue cast') && low.includes('hair cut blunt at the jaw, chestnut'), 'the eyes and hair are kept: ' + rm.looks);
      assert.match(rm.looks, /(?:^|\. )Chestnut hide from the hands to the shoulders; hooves to hips, and over belly, ribs and back, short and fine on the chest; all but the face; a strip of coat from the tail to the nape\. /, 'the hide colour opens the colour sentence with the arms, legs and spine at their columns: ' + rm.looks);
      for (const kept of ['two hooved fingers and a hooved thumb', 'two toes in a split hoof with dewclaws behind; a full hock, long foot, heel high', 'the tail to the ankle, a heavy tuft', 'large, wide ears', 'a faint cast, a broad soft nose, the jaw slightly forward', 'full teats; a fuller udder that shows under clothes']) assert(low.includes(kept), 'the part "' + kept + '" is kept: ' + rm.looks);
      assert(rm.looks.endsWith(' No horns, no crest, no heavy neck.'), 'the must-nots close it: ' + rm.looks.slice(-80));
      assert.doesNotMatch(rm.looks, /(?:^|[.;] )(?:Height|Build|Bust|Hair|Eyes|Hide|Hands|Arms|Legs|Feet|Spine|Tail|Ears|Face|Teats and udder): /, 'and no label is left: ' + rm.looks);
      assert.equal(rm.gen.looks, rm.looks, 'the generated record follows');
      assert.equal(adv.cast.overrides.roommate.looks, rm.looks, 'the Cast edit that only carried the look follows it');
      assert.equal(adv.cast.overrides[typed.key].looks, 'A tall woman with a scar across one eyebrow.', 'a look typed by hand stays');
      const w = adv.cast.generated.characters.find((c) => c.key === wolf.key);
      assert.equal(w.looksV, 3); assert.match(w.looks, /^About six foot one; athletic, with square shoulders, a deep chest and a lean waist\. Hair cropped to a fingertip's length, so the ears stand clear of it; yellow eyes\. /, 'the wolf keeps his height, build, hair and eyes: ' + w.looks);
      assert.match(w.looks, /\. Grey pelt from the hands to the elbows; paws to hips, fading out at the navel; a hand-wide ruff from tail to nape; the fur dense and soft; the pads and claws black\. /, 'and his pelt with its draws: ' + w.looks);
      assert(w.looks.includes('A thick neck and fur at the nape.') && w.looks.endsWith(' No further pairs of nipples.'), 'and his mantle and must-nots: ' + w.looks);
      const t = adv.cast.generated.characters.find((c) => c.key === third.key), tb = /^About five foot seven; (\w+), with ([^.]*)\. /.exec(t.looks);
      assert(t.looksV === 3 && tb && (Wl.genPools.looks.figures.female || []).some((f) => f.word === tb[1]) && !/\b(?:heavy|thick)\b/.test(tb[0]), 'a build with no figure word that names a thick waist and heavy thighs is drawn again on a figure: ' + t.looks.slice(0, 160));
      assert.match(t.looks, /\. Grey pelt from the hands to the elbows; paws to hips, fading out at the navel; /, 'and she keeps her pelt: ' + t.looks);
      const p = promptOf(lastTurn(h));
      assert.match(p, /Looks: About five foot four; /, 'the turn prompt carries the paragraph'); assert.doesNotMatch(p, /Looks: Height: /, 'and no labelled look');
      clean(h);
    } finally { h.close(); }
  },

  // A Cast edit whose look the release build's Redraw or Fill in the blanks drew as labelled rows (looksV set on the edit), and a person
  // added here with such a look, are composed again as the paragraph on load, read as the person the edit leaves (the kind of the edit
  // over the record's): the roommate's edit, a generated person redrawn as a bovine man and an added wolf woman keep their height,
  // hair, eyes, colour and parts, lose the heavy build and the labels, and the roommate's chest line is mended first; the record under
  // an edit keeps its own look, and a look typed by hand, which carries no looksV, stays as typed. Fails on b6a6209, where the edits
  // kept their labelled looks and the turn prompt carried them.
  async looksCastEditsRecomposed() {
    const first = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female', name: 'Tom Ashby' }); let store;
    try { store = new Map([...first.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])); } finally { first.close(); }
    const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k)), doc = store.get(key).data, figures = loadWorld().genPools.looks.figures;
    const he = { they: 'he', them: 'him', their: 'his', theirs: 'his' }, she = { they: 'she', them: 'her', their: 'her', theirs: 'hers' }, chars = doc.cast.generated.characters;
    const drawn = chars.find((c) => c.key !== 'roommate'), typed = chars.find((c) => c !== drawn && c.key !== 'roommate');
    const rmV2 = 'Height: about five foot eight. Build: heavy, with a soft waist, wide hips and full thighs. Bust: big soft breasts, an E cup, warm and veined and heavy enough to rest on the forearms when the arms fold, with broad areolae. Hair: hair cropped as close as the hide and smoke-grey to match it, so that from behind the one runs straight into the other. Eyes: soft hazel eyes, slow to blink. Hide: smoke-grey. Hands: two hooved fingers and a hooved thumb. Arms: from the hands to the elbows. Legs: hooves to hips, fading out at the navel. Feet: two toes in a split hoof with dewclaws behind; heel raised, weight on the hooves. Spine: a strip of coat from the tail to the nape. Tail: to the knee, tufted. Ears: cow ears out to the sides. Face: a faint cast, a broad soft nose, the jaw slightly forward. Teats and udder: long thick nipples like teats; a small rounded four-teated udder. No horns, no crest, no heavy neck.';
    const manV2 = 'Height: about five foot eleven. Build: heavy, with heavy shoulders, a deep chest and a thick waist. Hair: hair cropped as close as the hide and cream to match it, so that from behind the one runs straight into the other. Eyes: dark eyes, wide. Hide: cream. Hands: two hooved fingers and a hooved thumb. Arms: from the hands to the elbows. Legs: hooves to hips, fading out at the navel. Feet: two toes in a split hoof with dewclaws behind; heel raised, weight on the hooves. Spine: a strip of coat from the tail to the nape. Tail: to the knee, tufted. Ears: cow ears out to the sides. Face: the person\'s own human face; the cow shows in ears and eyes only. Horns: two short thick horns, a heavy neck and a crest. No teat-like nipples, no udder, no milk.';
    const wolfV2 = 'Height: about five foot eight. Build: slight, with a long waist, narrow hips and long thighs. Bust: nipples that stand at all hours, on small brown areolae, set low on teardrop breasts, a soft B, that carry their weight below them and run shallow at the upper slope. Hair: hair cropped to a fingertip\'s length, so the ears stand clear of it. Eyes: yellow eyes. Pelt: silver; fur coarse and thick; pads and claws dark grey. Hands: five strong fingers, pads on tips and palm, blunt claws. Arms: from the hands to the elbows. Legs: paws to hips, fading out at the navel. Feet: four clawed, padded toes and a dewclaw; heel raised a hand\'s width, weight on the toes. Spine: a hand-wide ruff from tail to nape. Tail: a full brush to the calf. Ears: tall wolf ears set high. Face: the person\'s own human face; the wolf shows in ears, eyes and teeth only. Teeth: long canines, shearing back teeth. Nipples: two more pairs. No mantle, no line of fur from chest to navel.';
    const byHand = 'Height: five foot even. Build: heavy, with a thick waist and heavy thighs. Hair: a black crop. Eyes: grey eyes.';
    doc.cast.overrides = Object.assign(doc.cast.overrides || {}, { roommate: { looks: rmV2, looksV: 2, species: 'cow' }, [drawn.key]: { looks: manV2, looksV: 2, species: 'cow', gender: 'male', pronouns: he, race: 'Bovine mythkin' }, [typed.key]: { looks: byHand } });
    doc.cast.added = (doc.cast.added || []).concat([{ key: 'npc1', name: 'Wren Skye', first: 'Wren', last: 'Skye', gender: 'female', pronouns: she, aliases: ['Wren'], race: 'Werewolf', species: 'wolf', looks: wolfV2, looksV: 2, brief: 'A new face on campus.', sheet: '', aims: { default: 'go about their own business' }, where: { default: 'around campus' }, attitude: 5 }]);
    const h = await boot({ setup(w, m) { m.store = store; } });
    try {
      assert(await h.settle(150, 8000), 'the older save did not load'); await h.idle(10000); await h.settle(100, 4000);
      assert(await h.turn('I look at Daisy.'), 'a turn on the older save');
      const adv = onlyAdv(h.mock.store).data, O = adv.cast.overrides, heavy = /\b(?:heavy|thick)\b/;
      const noLabel = (L, who) => assert.doesNotMatch(L, /(?:^|[.;] )(?:Height|Build|Bust|Hair|Eyes|Hide|Pelt|Hands|Arms|Legs|Feet|Spine|Tail|Ears|Face|Horns|Teeth|Nipples|Teats and udder): /, who + ': no label is left: ' + L);
      const opens = (L, height, sex, who) => { const m = new RegExp('^About ' + height + '; (\\w+), with ([^.]*)\\. ').exec(L); assert(m && (figures[sex] || []).some((f) => f.word === m[1]) && !heavy.test(m[0]), who + ': the height is kept and the heavy build is drawn again from the figures: ' + L.slice(0, 160)); };
      const rm = O.roommate, low = String(rm.looks).toLowerCase();
      assert.equal(rm.looksV, 3, 'the roommate\'s edit is marked as composed the paragraph way'); opens(rm.looks, 'five foot eight', 'female', 'roommate'); noLabel(rm.looks, 'roommate');
      assert(low.includes('hair cropped as close as the hide and smoke-grey') && low.includes('soft hazel eyes, slow to blink'), 'her hair and eyes are kept: ' + rm.looks);
      assert(low.includes('big soft breasts, an e cup, warm and veined and full enough to rest on the forearms when the arms fold, with broad areolae'), 'her chest line is mended to the world\'s wording and kept: ' + rm.looks);
      assert.match(rm.looks, /\. Smoke-grey hide from the hands to the elbows; hooves to hips, fading out at the navel; a strip of coat from the tail to the nape\. /, 'her hide opens the colour sentence with the arms, legs and spine at the standard: ' + rm.looks);
      assert(low.includes('long thick nipples like teats; a small rounded four-teated udder') && rm.looks.endsWith(' No horns, no crest, no heavy neck.'), 'her teats, udder and must-nots are kept: ' + rm.looks);
      assert.equal(adv.roommate.looksV, 3); assert.notEqual(adv.roommate.looks, rm.looks, 'the record under the edit keeps its own look');
      const man = O[drawn.key], ml = String(man.looks).toLowerCase();
      assert.equal(man.looksV, 3, 'the redrawn man\'s edit is marked as composed'); opens(man.looks, 'five foot eleven', 'male', 'redrawn man'); noLabel(man.looks, 'redrawn man');
      assert(ml.includes('dark eyes, wide') && ml.includes('two short thick horns, a heavy neck and a crest') && man.looks.includes('Cream hide from the hands to the elbows;') && man.looks.endsWith(' No teat-like nipples, no udder, no milk.'), 'his eyes, horns, hide and must-nots are kept: ' + man.looks);
      assert.equal(man.species, 'cow', 'and the edit keeps its kind');
      const added = adv.cast.added.find((a) => a.key === 'npc1'), al = String(added.looks).toLowerCase();
      assert.equal(added.looksV, 3, 'the added woman\'s look is marked as composed'); opens(added.looks, 'five foot eight', 'female', 'added woman'); noLabel(added.looks, 'added woman');
      assert(al.includes('hair cropped to a fingertip\'s length') && al.includes('yellow eyes') && al.includes('teardrop breasts, a soft b'), 'her hair, eyes and chest are kept: ' + added.looks);
      assert.match(added.looks, /\. Silver pelt from the hands to the elbows; paws to hips, fading out at the navel; a hand-wide ruff from tail to nape; the fur coarse and thick; the pads and claws dark grey\. /, 'and her pelt with its draws: ' + added.looks);
      assert(added.looks.endsWith(' No mantle, no line of fur from chest to navel.'), 'and her must-nots: ' + added.looks);
      assert.equal(O[typed.key].looks, byHand, 'a labelled look typed by hand stays as typed'); assert(!('looksV' in O[typed.key]), 'and gains no looksV');
      const p = promptOf(lastTurn(h));
      assert.match(p, /Looks: About five foot eight; /, 'the turn prompt carries the roommate\'s edited paragraph'); assert.doesNotMatch(p, /Looks: Height: about /, 'and no labelled look an edit drew');
      clean(h);
    } finally { h.close(); }
  },

  // The readers of the paragraph: the brief (the introduction's appearance, the Cast list) is its first two sentences, the phrase inside
  // another line is the brief, the short form for a person the last turn showed is the paragraph itself; a look written by hand is
  // read as it stands, and a labelled look typed by hand is still read as labelled. Fails on b6a6209, which had no paragraph to read.
  async looksProseReaders() {
    const G = loadGenerator(HTML, WORLDS, { random: mulberry32(global.__WL_SEED) }), Wg = G.W, lower = (x) => x.charAt(0).toLowerCase() + x.slice(1);
    assert(G.looksProse && G.looksBrief && G.looksShort && G.looksPhrase, 'the page reads a paragraph');
    for (const [k, g] of [['cow', 'female'], ['harpy', 'female'], ['human', 'male'], ['chimera', 'female']]) {
      const L = String(G.genPerson(Wg, { species: k, gender: g }).looks || ''), s = L.replace(/\.$/, '').split(/\. (?=[A-Z])/);
      assert(G.looksProse(L) && !G.looksLabelled(L), k + ': a composed look is read as the paragraph: ' + L.slice(0, 80));
      const brief = G.looksBrief(L);
      assert.equal(brief, lower(s[0]) + '; ' + lower(s[1]), k + ': the brief is the height and build, the hair and the eyes');
      assert.doesNotMatch(brief, /\bbreasts\b|\bhooves\b|\bNo /, k + ': the brief carries no body: ' + brief);
      assert.equal(G.looksPhrase(L), brief, k + ': the phrase is the brief');
      assert.equal(G.looksShort(L), L, k + ': the short form is the paragraph');
    }
    const hand = 'A tall woman with a kind face, grey eyes and a long plait.';
    assert(!G.looksProse(hand) && G.looksBrief(hand) === hand && G.looksShort(hand) === hand && G.looksPhrase(hand) === hand, 'a look written by hand is read as it stands');
    const labelled = 'Height: about five foot eight. Build: slim, with a soft waist, slim hips and slim thighs. Eyes: pale violet with gold rims. Hair: a single ponytail. Freckles: a scatter of copper freckles across both shoulders. No horns.';
    assert(G.looksLabelled(labelled) && !G.looksProse(labelled), 'a labelled look typed by hand is still read as labelled');
    assert.equal(G.looksBrief(labelled), 'about five foot eight, slim, with a soft waist, slim hips and slim thighs; hair a single ponytail; eyes pale violet with gold rims', 'and its brief still names the hair and the eyes');
    assert.equal(G.looksShort(labelled), 'about five foot eight, slim, with a soft waist, slim hips and slim thighs; hair a single ponytail; eyes pale violet with gold rims. Freckles: a scatter of copper freckles across both shoulders. No horns.', 'and its short form keeps the extra line');
  },
  // ---------- P7: the critic's gaps ----------
  // A summary edit typed but not yet saved rides over a sync that picks up the other device's newer save, and saves when the box is left.
  async summaryEditSurvivesSync() {
    const A = await begin({ rmSpecies: 'cow', rmName: 'Daisy Clover' });
    let B;
    try {
      assert(await A.turn('I look around.'));
      const store = A.mock.store, doc = () => onlyAdv(store).data;
      B = await boot({ setup(w, m) { m.store = store; } }); assert(await B.settle(300, 15000)); assert(await B.idle(15000), 'B did not load');
      const box = A.$('#summary'); box.focus();
      const typed = 'MY EDIT: Daisy promised to show me the Creamery on Day 2.';
      box.value = typed; box.dispatchEvent(new A.window.Event('input', { bubbles: true }));
      assert(await B.turn('I unpack my bag.'), 'B\'s turn');
      A.window.dispatchEvent(new A.window.Event('focus')); await A.settle(300, 8000); assert(await A.idle(15000));
      assert.match(statusText(A), /Picked up the newer save/, 'A picked up B\'s save: ' + statusText(A));
      assert.match(statusText(A), /summary edit is kept/, 'and says the edit is kept: ' + statusText(A));
      assert.equal(A.$('#summary').value, typed, 'the box still shows the edit');
      box.blur(); box.dispatchEvent(new A.window.Event('blur')); await A.settle(300, 6000); assert(await A.idle(10000));
      assert(String(doc().memory.summary || '').includes('MY EDIT'), 'leaving the box saves the edit: ' + String(doc().memory.summary || '').slice(0, 120));
      assert.equal(doc().turnCount, 2, 'on B\'s save, not over it');
      clean(A); clean(B);
    } finally { A.close(); if (B) B.close(); }
  },

  // The Override panel left open across a cross-device sync is filled again from the newer state, so Apply cannot write the old one back.
  async overridePanelFollowsSync() {
    const A = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    let B;
    try {
      const id = onlyAdv(A.mock.store).id;
      assert(await A.turn('Look around.'));
      A.click('#toggleHidden'); await A.sleep(50); A.click('#btnOverride'); await A.sleep(50);
      assert(A.$('#dlgOverride').open, 'the Override panel is open');
      const stale = JSON.parse(A.$('#ovrState').value).time;
      B = await boot({ setup(w, m) { m.store = A.mock.store; } }); assert(await B.settle(150, 8000)); assert(await B.idle(20000), 'B did not load');
      assert(await B.turn('I go to the quad.'), 'B\'s first turn'); assert(await B.turn('I walk on.'), 'B\'s second turn');
      const fresh = onlyAdv(B.mock.store).data.state.time;
      assert.notEqual(fresh, stale, 'B moved the clock');
      A.window.dispatchEvent(new A.window.Event('focus')); assert(await A.idle(20000)); await A.sleep(200);
      assert.match(statusText(A), /Override panel now shows the newer state/, statusText(A));
      assert(A.$('#dlgOverride').open, 'the panel stays open');
      assert.equal(JSON.parse(A.$('#ovrState').value).time, fresh, 'filled again from the newer state');
      A.click('#ovrStateApply'); assert(await A.idle(8000)); await A.sleep(100);
      const after = onlyAdv(A.mock.store).data;
      assert.equal(after.turnCount, 3, 'B\'s turns stand'); assert.equal(after.state.time, fresh, 'Apply writes the newer state, not the old');
      assert.equal(storedTurns(A.mock.store, id).at(-1).stateAfter.time, fresh);
      clean(A); clean(B);
    } finally { A.close(); if (B) B.close(); }
  },

  // Begin pressed while Claude and the store are still answering (a slow handshake) waits for them: the cast is invented, the
  // introduction written and the game saved, and a store that is only late is never reported as unavailable.
  async beginWaitsForTheHandshake() {
    const h = await boot({ setup(w, m) { m.useLatency = 2500; } });
    const until = async (fn, max) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (fn()) return true; await h.sleep(50); } return false; };
    try {
      await h.sleep(300);
      h.click('#btnAdventures'); await h.sleep(50);
      assert.match(h.$('#dbNotice').hidden ? '' : h.$('#dbNotice').textContent, /still loading/, 'a store that is late is not "unavailable": ' + h.$('#dbNotice').textContent);
      h.click('#newAdv'); await h.sleep(100);
      h.type('#cName', 'Tom Ashby'); h.type('#cRmSpecies', 'cow'); h.type('#cRmName', 'Daisy Holm');
      h.click('#cBegin'); await h.sleep(200);
      assert.match(h.$('#cNote').textContent, /Begin is available in a moment/, 'Begin waits: ' + h.$('#cNote').textContent);
      assert(h.$('#cBegin').disabled, 'and is held meanwhile');
      assert(await until(() => !h.$('#dlgCreate').open, 40000), 'the adventure did not start');
      assert(await h.idle(30000)); await h.settle(150, 8000);
      const { data } = onlyAdv(h.mock.store);
      assert.equal(data.turnCount, 0); assert(data.opening && data.opening.introWritten, 'the roommate introduction was written');
      assert(h.mock.sampleCalls.some((c) => c.label === 'cast invention'), 'the cast was invented');
      assert(h.mock.sampleCalls.some((c) => c.label === 'roommate introduction'), 'the introduction was asked for');
      assert.doesNotMatch(statusText(h), /unavailable/, statusText(h));
      assert(await h.turn('Look around.'), 'a turn runs');
      assert.equal(onlyAdv(h.mock.store).data.turnCount, 1, 'and is saved');
      clean(h);
    } finally { h.close(); }
  },

  // An intimate style example is filled for the bed partner (name and pronouns), never for the roommate as the lover when the act is
  // with someone else; a solo act names nobody; a kind-tagged example follows the partner, not a bystander of that kind.
  async sceneExamplesFollowThePartner() {
    const g = await savedGame({ rmSpecies: 'cow', rmName: 'Daisy Clover', rmGender: 'female' });
    const gen = g.doc.cast.generated.characters;
    const other = gen.find((c) => c.key !== 'roommate' && c.first && c.gender === 'male' && c.species !== 'cow') || gen.find((c) => c.key !== 'roommate' && c.first && c.gender === 'male');
    assert(other, 'a man in the generated cast');
    const examples = (hh) => blockOf(promptOf(lastTurn(hh)), 'style_examples');
    for (const [label, act, present] of [['partner', 'Make love to ' + other.first + '.', [other.name]], ['partner, roommate across the room', 'Make love to ' + other.first + '.', [other.name, 'Daisy Clover']], ['solo', 'I masturbate.', []]]) {
      const h = await bootOn(copyStore(g.store));
      try {
        let stage = null;
        patchTurns(h, (r) => { r.state_updates = [{ key: 'present', value: present }]; if (stage) r.stage = stage; });
        assert(await h.turn('I wait in my room.'), label + ': the wait turn');
        const seen = [];
        for (const s of ['begin', 'enter', 'build']) { stage = s; assert(await h.turn(act), label + ': the ' + s + ' turn'); seen.push(examples(h)); }
        const all = seen.join('\n');
        assert(seen.every(Boolean), label + ': every act turn carries style examples');
        assert.doesNotMatch(all, /\bDaisy\b/, label + ': the examples never name the roommate as the lover: ' + all.slice(0, 300));
        if (label === 'solo') assert.match(all, /\byour partner\b/i, 'solo: the example names nobody: ' + all.slice(0, 300));
        else { assert(all.includes(other.first), label + ': the example is filled for ' + other.first + ': ' + all.slice(0, 300)); assert.doesNotMatch(all, /\budder\b/, label + ': the bovine woman\'s example is not shown for a man'); }
        clean(h);
      } finally { h.close(); }
    }
  },

  // A cursed piece from the Unpriced Table does not come off by hand: a list without it or a remove keeps it on, with a note, and
  // the narrator is told next turn; at the third level of wardcraft the unbinding is the player's and it comes off.
  async cursedPieceStaysOn() {
    const h = await begin({ rmSpecies: 'cat', rmName: 'Mira Sato' });
    try {
      const id = onlyAdv(h.mock.store).id, st = () => onlyAdv(h.mock.store).data.state, last = () => storedTurns(h.mock.store, id).at(-1);
      let updates = [];
      patchTurns(h, (r) => { r.state_updates = updates; r.time_advance_minutes = 60; });
      updates = [{ key: 'items.wearing', op: 'set', value: ['a tarnished silver collar'] }];
      assert(await h.turn('I put on the silver collar from the Unpriced Table.'));
      assert.deepEqual(st().items.wearing, ['a tarnished silver collar']); assert(st().tf.worn.silver_collar, 'the engine counts the cursed piece');
      updates = [{ key: 'items.wearing', op: 'set', value: [] }];
      assert(await h.turn('I take the collar off and throw it in the drawer.'));
      assert.deepEqual(st().items.wearing, ['a tarnished silver collar'], 'a list without it keeps it on');
      assert(last().notes.some((n) => /^kept on: a tarnished silver collar \(cursed/.test(n)), 'with a note: ' + last().notes.join(' | '));
      assert(st().tf.worn.silver_collar, 'still counted');
      updates = [];
      assert(await h.turn('I go to bed.'));
      const p = promptOf(lastTurn(h));
      assert.match(p, /Note from the engine: The piece did not come off: a tarnished silver collar is cursed/, 'the narrator is told next turn');
      assert.match(p, /Worn now: a tarnished silver collar/, 'and the Worn line stays');
      updates = [{ key: 'items.wearing', op: 'remove', value: ['collar'] }];
      assert(await h.turn('I wrench the collar off.'));
      assert.deepEqual(st().items.wearing, ['a tarnished silver collar'], 'a remove by key word keeps it on too');
      h.click('#toggleHidden'); await h.sleep(30); h.click('#btnOverride'); await h.sleep(30);
      const inp = h.$('#ovrAttitudes [data-skill="wardcraft"]'); assert(inp, 'the wardcraft skill field'); inp.value = '9'; inp.dispatchEvent(new h.window.Event('change', { bubbles: true })); assert(await h.idle(8000)); h.click('[data-close="dlgOverride"]');
      assert(await h.turn('I draw the unbinding sigil round the collar and lift it off.'));
      assert.deepEqual(st().items.wearing, [], 'unbound at wardcraft level 3');
      assert(last().notes.some((n) => /^unbound by wardcraft \(level 3\): a tarnished silver collar/.test(n)), last().notes.join(' | '));
      clean(h);
    } finally { h.close(); }
  },

  // Every invented line (temperament, want, private matter), not the habit alone, is screened against the kind's anatomy.
  async inventedLinesScreened() {
    const h = await begin({
      name: 'Mira Holt', rmSpecies: 'cow', rmGender: 'female',
      setup(w, m) {
        m.sampleHandler = (input, o, call) => {
          const r = m.defaultHandler(input, o, call);
          if (call.label !== 'cast invention') return r;
          const d = JSON.parse(r);
          for (const p of d.people) {
            if (p.key === 'roommate') { p.temperament = 'calm, with a third arm folded behind her back'; p.want = 'to grow her wings out and show them off on the quad'; p.private = 'keeps a second tail hidden under her coat and files her fangs at night'; p.greeting = 'spreads her wings and folds them again'; }
            if (p.key === 'runner_human') { p.temperament = 'quietly stubborn'; p.want = 'to pass Alchemy without cheating'; p.private = 'sends money home every month'; }
          }
          return JSON.stringify(d);
        };
      },
    });
    try {
      const { data } = onlyAdv(h.mock.store);
      const rm = JSON.stringify(data.roommate);
      assert.doesNotMatch(rm, /third arm|wings|second tail|fangs/, 'invented anatomy never reaches the roommate\'s temperament, want, private matter or greeting: ' + rm.slice(0, 600));
      const runner = data.cast.generated.characters.find((c) => c.key === 'runner_human');
      assert(runner, 'the generated cast includes runner_human');
      assert.match(JSON.stringify(runner), /pass Alchemy without cheating|sends money home every month|quietly stubborn/, 'harmless invented lines are kept');
      clean(h);
    } finally { h.close(); }
  },

  // The ladder-era story flags for a charm or a contact (the engine counts those itself) are gone: the narrator is never told a
  // charm is worn that the engine does not count, and setting one is ignored as an unknown flag.
  async deadFlagsAreGone() {
    const flags = loadWorld().initialState.flags;
    for (const k of ['accepted_a_feather', 'wearing_goblin_charm', 'ran_with_pack', 'swam_in_lake']) assert(!(k in flags), k + ' is no longer a story flag');
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    try {
      const id = onlyAdv(h.mock.store).id;
      patchTurns(h, (r) => { r.state_updates = [{ key: 'flags.wearing_goblin_charm', value: true }]; });
      assert(await h.turn('I put on the goblin bracelet.'));
      const t = storedTurns(h.mock.store, id).at(-1);
      assert(t.notes.some((n) => /ignored unknown flag "wearing_goblin_charm"/.test(n)), t.notes.join(' | '));
      assert(await h.turn('I look at my wrist.'));
      assert.doesNotMatch(blockOf(promptOf(lastTurn(h)), 'state'), /wearing_goblin_charm|accepted_a_feather/, 'the narrator is never told a charm the engine does not count');
      clean(h);
    } finally { h.close(); }
  },

  // A Cast gender edit is a change of body: a look left as it was shown is drawn again for the new sex, and the sheet agrees.
  async castGenderEditRedrawsTheBody() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', rmGender: 'female' });
    try {
      h.click('#btnCast'); await h.sleep(30);
      assert.equal(h.$('#cfGender').value, 'female');
      const before = h.$('#cfLooks').value; assert.match(before, /\bbreasts\b/, 'a bovine woman\'s look has a chest: ' + before);
      h.$('#cfGender').value = 'male'; h.$('#cfGender').dispatchEvent(new h.window.Event('change', { bubbles: true }));
      h.click('#cfSave'); assert(await h.idle(8000)); await h.sleep(100);
      assert.match(h.$('#cfNote').textContent, /drawn again for a man/, h.$('#cfNote').textContent);
      // The kind's must-nots close a look as negatives ("Not on this body: an udder"), so the body is read without them.
      const body = (t) => String(t).replace(/(?:^|(?<=\. ))(?:No |Not on this body:)[^.]*\./g, '');
      const after = h.$('#cfLooks').value;
      assert(after !== before && !/\bbreasts\b|\bcup\b|\budder\b|\bteats?\b/.test(body(after)), 'the look is a man\'s now: ' + after);
      h.click('[data-close="dlgCast"]'); await h.sleep(20);
      assert(await h.turn('I look at Daisy.'));
      const line = blockOf(promptOf(lastTurn(h)), 'characters').split('\n').find((l) => /\[roommate\]/.test(l)) || '';
      assert.match(line, /\(Man, he\/him/, line.slice(0, 200)); assert.doesNotMatch(body(line), /\bbreasts\b|\budder\b|\bteats?\b/, line);
      clean(h);
    } finally { h.close(); }
  },

  // Override > Replace state refuses a trimmed JSON with a plain message naming what is missing, never a raw type error; the
  // records the engine can make again (bonds, skills) need not be in it.
  async overrideStateNamesWhatIsMissing() {
    const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm' });
    try {
      h.click('#toggleHidden'); await h.sleep(30); h.click('#btnOverride'); await h.sleep(30);
      const S0 = JSON.parse(h.$('#ovrState').value);
      h.$('#ovrState').value = JSON.stringify({ items: S0.items, attitudes: S0.attitudes, day: S0.day, time: S0.time, location: S0.location, present: S0.present });
      h.click('#ovrStateApply'); assert(await h.idle(8000)); await h.sleep(100);
      assert.equal(h.$('#ovrStateNote').textContent, 'Not applied.');
      assert.match(statusText(h), /Override failed: the state needs flags as well \(Reset to current shows the shape\)/, statusText(h));
      const S2 = JSON.parse(JSON.stringify(S0)); delete S2.bonds; delete S2.skills;
      h.$('#ovrState').value = JSON.stringify(S2); h.click('#ovrStateApply'); assert(await h.idle(8000)); await h.sleep(100);
      assert.equal(h.$('#ovrStateNote').textContent, 'Applied.', statusText(h));
      h.click('[data-close="dlgOverride"]'); await h.sleep(30);
      assert(await h.turn('Look around.'));
      clean(h);
    } finally { h.close(); }
  },

  // Pool text written for "{rm_they}" agrees with a they/them person: no "they is", "they has" or "they does" in the world file.
  async poolTextAgreesWithThey() {
    const src = fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8');
    const slips = src.match(/\{rm_they\} (?:is|has|does|was)\b/g) || [];
    assert.equal(slips.length, 0, 'pool text agrees with a they/them person: ' + slips.join(', '));
    assert.match(src, /\{rm_they\} \{rm_are\} carrying/, 'the human body line uses the agreeing verb token');
  },

};

(async () => {
  if (process.argv[2] === '--list') { console.log(Object.keys(S).join('\n')); process.exit(0); }   // run.js reads the scenario names here
  const named = process.argv.slice(2).length > 0, names = named ? process.argv.slice(2) : Object.keys(S);
  let failed = 0, red = 0;
  for (const n of names) {
    const before = unhandled;
    // Each scenario plays on its own seed (a hash of its name, or WL_SEED), so a failure replays exactly.
    global.__WL_SEED = seedFor(n); boot.count = 0;
    try {
      if (!S[n]) throw new Error('no such scenario');
      await S[n](); await new Promise((r) => setTimeout(r, 50));
      assert.equal(unhandled - before, 0, 'unhandled promise rejections during the scenario');
      console.log('PASS', n);
    } catch (e) { const kr = !named && KNOWN_RED.expected(n, (e && e.message) || e); if (kr) { red += 1; console.log('KNOWN RED', n, '-', kr.label); continue; } failed += 1; console.log('FAIL', n, '(seed ' + global.__WL_SEED + ') -', String((e && e.message) || e).split('\n')[0].slice(0, 260)); console.log('  replay: WL_SEED=' + global.__WL_SEED + ' node audit-fixes.js ' + n); if (process.env.AUDIT_STACK) console.log(e && e.stack); }
  }
  if (failed) { console.error('AUDIT FIXES FAILED: ' + failed + ' of ' + names.length + ' scenarios'); process.exit(1); }
  console.log('audit fixes passed: ' + (names.length - red) + ' scenarios' + (red ? ', ' + red + ' known red (lib/known-red.js)' : ''));
  process.exit(0);
})();
