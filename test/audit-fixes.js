'use strict';
// Regressions for the audit fixes: one scenario per fix. Each passes on the fixed page and fails on the page before the fixes
// (2512da3); sunderedOnly fails on the last three-world page (d985886). Run one scenario by name: node audit-fixes.js romanceDetection
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node audit-fixes.js
// Halloway and Mythaven have left the game; hallowayAttunement reads the last Halloway world file from test/fixtures/halloway.js
// to exercise runProgression, the engine code only a world with a progression reaches.
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { boot } = require('./boot');
const { seedFor } = require('./lib/rng');
const KNOWN_RED = require('./lib/known-red');
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
// The turn model's reply, with the given changes made to the default mock reply.
function patchTurns(h, patch) {
  h.mock.sampleHandler = (input, o, call) => {
    const out = h.mock.defaultHandler(input, o, call);
    if (!/^turn/.test(call.label)) return out;
    const r = JSON.parse(out); patch(r); return JSON.stringify(r);
  };
}

const loadWorld = () => { const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx); return ctx.window.WINDLASS_WORLDS.sundered; };
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
    const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cow-roommate-25.json'), 'utf8'));
    const play = async (action, director, settings) => {
      const adv = JSON.parse(JSON.stringify(SAVE.adventure)); Object.assign(adv.settings, settings || {});
      const h = await boot({ setup: (w, mock) => {
        mock.store.set('adventures/' + SAVE.id, { data: adv, version: 1 });
        for (const [c, doc] of Object.entries(SAVE.turns)) mock.store.set('adventures/' + SAVE.id + '/turns/' + c, { data: doc, version: 1 });
      } });
      try {
        assert(await h.settle(150, 8000)); assert(await h.idle(20000), 'the save did not load');
        assert(await h.turn(action, { max: 30000, director }), 'the turn did not finish');
        const t = storedTurns(h.mock.store, SAVE.id).at(-1), cut = Number((/lore budget (\d+) characters/.exec(t.notes.join('\n')) || [])[1]);
        const entries = (promptOf(lastTurn(h)).match(/<entry name="[^"]*"/g) || []).map((x) => x.slice(13, -1));
        clean(h);
        return { cut, entries, notes: t.notes };
      } finally { h.close(); }
    };
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
      assert.match(looks, /\b(?:[D-H]|DD|DDD) cup\b|\ba (?:DD|DDD)\b/, 'the bovine roommate has a cup size, a D or more: ' + looks);
      assert.match(looks, /nipple|teats/, 'and nipples, or the teats they have become: ' + looks);
      assert.match(looks, /vein/, 'and veins');
      assert.doesNotMatch(looks, /milk|lactat/, 'and no word on milk, which is not a look');
      assert.match(looks, /udder/, 'and the udder');
      assert.match(looks, /Hair: [^.]*\b(?:hair|plaits?|braid|crop|fringe)\b/i, 'and hair: ' + looks);
      assert.doesNotMatch(looks, /\{|Small breasts/, 'no placeholder or stock chest: ' + looks);
      for (const c of data.cast.generated.characters) {
        if (!c.looks || c.looks.indexOf('{') >= 0) assert(!c.looks || c.looks.indexOf('{') < 0, c.name + ' leaks a placeholder: ' + c.looks);
        if (c.gen === false || !c.species) continue;
        assert.match(c.looks, /\bHair: /, c.name + ' (' + c.species + ') has hair in the look, whatever grows through it: ' + c.looks);
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
      assert.match(looks, /Plumage: /, 'the harpy has her plumage: ' + looks);
      assert.match(looks, /Hair: [^.]*hair/i, 'and her hair, with the crest through it: ' + looks);
      assert.match(looks, /Crest: /, 'and her crest: ' + looks);
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
      assert.match(looks, /Feet: [^.]*(?:scaled|talons?|three toes forward)/, 'the roommate\'s look has talons for feet: ' + looks);
      // The wings are the arms in every column of the roommate's one draw (least, standard or most), never wings of their own.
      for (const c of Object.values(track('wings').range)) assert.match(c, /\barms\b/i, 'every wings column is the arms: ' + c);
      assert.match(looks, /Wings: [^.]*\barms\b/, 'and her arms are wings: ' + looks);
      assert.doesNotMatch(looks, /Arms: arms\b/, 'the arms row does not echo its label: ' + looks);
      assert.match(looks, /Hands: [^.]*clawed finger/, 'with a gripping hand at the end of each: ' + looks);
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

  // Form steps are never assumed told. A save from before they were kept, on a path still going over with no form track, shows
  // none of its rungs' form (the milk above all) until each is told; and a man's path that never had form tracks, on a body that
  // has since gone over on another path, has its form told then, not listed as if it always had been.
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
        const mine = key(T.species[k].ladder.find((r) => r.women).women[0]);
        const seen = new Set();
        for (let n = 0; n < 4; n++) {
          assert(await h.turn('I get on with the day.'));
          const p = promptOf(lastTurn(h));
          // A step rolled at the end of a turn is told, and kept, from the next prompt on.
          for (const m of p.matchAll(/the kind's form on a woman's body\): ([^\n]*)/g)) for (const x of keys) if (m[1].includes(x)) seen.add(x);
          const summary = (p.match(/The kind's form on a woman's body, told so far: [^\n]*/) || [''])[0];
          for (const x of keys) if (summary.includes(x)) assert(seen.has(x), label + ': a form step is listed before it was told (turn ' + (n + 1) + '): ' + x);
          assert.doesNotMatch(p, /Body now[^\n]*milk: a bead of it/, label + ': the milk is never listed as established');
        }
        assert(seen.has(mine), label + ': the earliest form step is told as a step: ' + JSON.stringify(tf().tracks.map((t) => [t.species, t.kind, t.rung, t.i, t.catchUp, t.after])));
        assert(tf().paths[k].formTold.some((x) => key(x) === mine), label + ': and then kept: ' + JSON.stringify(tf().paths[k].formTold));
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
      if (tf().sexprog.tracks.chest.told > 1) assert(prompts.some((q) => /Tanner \d/.test(q.slice(q.indexOf('<transformation>'), q.indexOf('</transformation>')))), 'the chest lines are the Tanner stages');
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
      const bust = (/Bust: ([^.]*)\./.exec(daisy) || [])[1]; assert(bust && !/nipple/.test(bust), 'her Bust is the chest\'s shape: ' + bust);
      assert.match(daisy, /Teats and udder: [^.]*(?:nipples|teats)/, 'and Teats and udder tells the rest');
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
      assert.match(looks, /^Height: about (?:four|five|six) foot[^.]*\. Build: [^.]*waist[^.]*hips[^.]*thighs\./, 'the looks open with an absolute height and a build told part by part: ' + looks.slice(0, 160));
      assert.doesNotMatch(looks, /\byou(?:r)?\b/i, 'and are never measured against the player: ' + looks);
      assert.match(looks, /\. Wings: [^.]+\. /, 'the body follows as its own labelled sentences: ' + looks.slice(0, 400));
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
      assert.match(daisy, /Looks: Height: .* Not on this body: .* Dress: .* Close up: .* Ways \(show, never explain\): .* Now: .* Aim now: .*\.$/, 'and the full sheet: ' + daisy.slice(-200));
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
      assert.match(who, /Does not say: .* Knows [^.]*\. Speech: [^.]*\. Looks: Height: /, 'named by the action: the full sheet, with the way of speaking and looks: ' + who.slice(0, 300));
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
        assert.match(p, new RegExp('Narrative length: at most ' + rich[1] + ' words'), a + ' uses the rich band');
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
      const band = +(/Narrative length: at most (\d+)/.exec(p) || [])[1];
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
      const len = (p) => /Narrative length: at most (\d+) words[^\n]*/.exec(p.slice(p.lastIndexOf('<action>')));
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
    for (const t of M.cow) {
      const e = F['cow.' + t.key], m = t.stages.length; if (!e || typeof e !== 'object' || m < 3) continue;
      const got = []; for (let j = 2; j < m; j++) got.push(e.mid.indexOf(feltOf('cow', t.key, j, m).felt));
      assert(got.every((x, i) => x >= 0 && (i === 0 ? x === 0 : x >= got[i - 1])), t.key + ' mid clauses in order by waypoint: ' + got);
      if (e.mid.length >= m - 2) assert(got.every((x, i) => i === 0 || x !== got[i - 1]), t.key + ' has a clause for each middle waypoint and repeats none: ' + got);
      else assert.equal(got.at(-1), e.mid.length - 1, t.key + ' spreads its clauses to the last middle waypoint: ' + got);
    }
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
    const pleasant = /\bgood\b|pleasure|comfort|relief|\bease|soothing|warm and steadying|cool and easy/i;
    const flat = [], unfelt = [], sour = []; let parts = 0;
    for (const [k, m] of Object.entries(TR.species)) {
      const ways = (looksKind(Wd, k) || {}).ways || []; let mids = [];
      for (const t of m) {
        if (ways.includes(t.key)) continue; parts += 1;
        const e = own(k, t.key);
        if (!e || !(e.on || []).length || !(e.mid || []).length || !(e.end || []).length) { flat.push(k + '.' + t.key); continue; }
        mids = mids.concat(e.mid);
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
    const word = (k, s) => (k.endsWith('*') ? new RegExp('\\b' + k.slice(0, -1) + '\\w*', 'i') : new RegExp('\\b' + k + '\\b', 'i')).test(s);
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
      if (process.env.DUMP) { console.log('OLD:', before); console.log('LINE:', line); const pr = promptOf(lastTurn(h)); for (const w of ['green', oldEyes]) { let i = -1; while ((i = pr.indexOf(w, i + 1)) >= 0) console.log('HIT', w, ':', pr.slice(Math.max(0, i - 200), i + 80).replace(/\n/g, ' / ')); } }
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
      const looksField = (l, label) => (new RegExp('(?:^|\\s)' + label + ': ([^]*?)\\.(?=\\s+[A-Z][A-Za-z\' ]{1,30}: |\\s+No [a-z]|\\s*$)').exec(l) || [])[1] || '';
      assert(await h.turn('I look at Daisy.'));
      assert.match(line(), /Looks: Height: about [^.]*\. Build: /, 'named by the action: the looks go whole: ' + line().slice(0, 200));
      assert.match(promptOf(lastTurn(h)), /Once someone is on the page, a feature comes back only when it acts, is touched or the action looks at it\./, 'the appearance rule says once is enough, and a feature the player looks at comes back');
      assert.doesNotMatch(line(), /Not on this body: [^.]*paws in place of hands/, 'what no body here has is not beside her: ' + (line().match(/Not on this body: [^.]*/) || [''])[0]);
      const notOnWhole = (line().match(/ Not on this body: [^.]*\./) || [''])[0];
      assert.match(promptOf(lastTurn(h)), /Every kind keeps working hands; nobody takes an animal's whole shape or changes with the moon/, 'it is in the rules');
      assert(await h.turn('I unpack my bag.'));
      assert.match(line(), /Looks \(shown last turn\): about [^.;]+; [^.;]+; [^.;]+\. Bust: [^.]*\. Hide: [^.]*\. Hands: [^.]*\. /, 'shown by the last turn and not named: the short line: ' + line().slice(0, 300));
      assert.doesNotMatch(line(), /Looks: Height:/, 'and not the whole look');
      // Short is not less: every part of the whole look and every absence is still there, the labels of the brief alone left out.
      const whole = looksOf(), parts = [...whole.matchAll(/(?:^|\. )([A-Z][A-Za-z' ]{1,30}): /g)].map((m) => m[1]).filter((l) => !['Height', 'Build', 'Hair', 'Eyes'].includes(l));
      assert(parts.includes('Teats and udder') && parts.includes('Feet'), 'the cow\'s whole look has her udder and feet: ' + whole);
      for (const l of parts) assert(line().includes(l + ': ' + looksField(whole, l) + '.'), l + ' is kept whole in the short line: ' + line());
      const no = (/(?:^|\. )(No [a-z][^.]*\.)\s*$/.exec(whole) || [])[1] || '';
      assert(no || notOnWhole, 'the whole look closes with what is not on the body: ' + whole);
      assert(line().includes(no + notOnWhole + ' Dress: '), 'the closing must-nots (' + no + ') and the absences (' + notOnWhole + ') as with the whole look, then the dress: ' + line().slice(-500));
      assert.match(promptOf(lastTurn(h)), /and nobody remarks on the fit; no two in one scene/, 'the dress rule says what nobody remarks on');
      assert(await h.turn('I kiss her on the mouth.'));
      assert.match(line(), /Looks: Height: about [^.]*\. Build: /, 'a romance scene gets the whole look, named or not: ' + line().slice(0, 200));
      // Named in a narration she was not on the page for (a text from her), she comes in: the whole look, not the short line.
      patchTurns(h, (r) => { r.narrative = 'Your phone buzzes: Daisy says she is on her way up. ' + r.narrative; r.state_updates = [{ key: 'present', op: 'set', value: [] }]; r.time_advance_minutes = 5; });
      assert(await h.turn('I sit down at the desk.'));
      patchTurns(h, (r) => { r.narrative = 'Daisy comes in and drops her bag. ' + r.narrative; r.state_updates = [{ key: 'present', op: 'set', value: ['Daisy Holm'] }]; r.time_advance_minutes = 5; });
      assert(await h.turn('I wait.'));
      assert(await h.turn('I open a book.'));
      assert.match(line(), /Looks: Height: about [^.]*\. Build: /, 'on the page this turn but not from the start of the last: the whole look: ' + line().slice(0, 200));
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
      assert.equal((gen.characters.concat(gen.minors).find((c) => c.key === g.who) || {}).species, 'mer', 'and someone of that kind is the one seen');
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
          introOk = blockOf(ip, 'player').includes('A secret, kept in this scene: Daisy is the one Owen saw') && ip.includes(g.text);
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

  // A hand-written Looks in the Cast editor is what the narrator reads, every turn. Changing only the eyes ("Eyes: green") must
  // keep green on the eyes in each turn's sheet: the turn after one that showed her goes the short form, which ran Height, Build,
  // Hair and Eyes together without labels, so a hand-written "Eyes: green" reached the narrator as a bare "; green" after the hair
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
      const e1 = await edit(h, (before) => { oldEyes = (/(?:^|\. )Eyes: ([^.]+)\./.exec(before) || [])[1]; return before.replace(/((?:^|\. )Eyes: )[^.]+\./, '$1green.'); });
      assert(oldEyes && !/green/.test(oldEyes), 'the generated look has eyes of another colour: ' + e1.before.slice(0, 400));
      assert.equal(onlyAdv(h.mock.store).data.cast.overrides.roommate.looks, e1.after, 'the edit is stored as typed');
      for (const action of ['I look at May.', 'I unpack my bag.', 'I put the kettle on.']) {
        assert(await h.turn(action));
        const line = sheetOf(h), looks = looksOf(line);
        if (process.env.DUMP) console.log('  [' + action + '] ' + (/ Looks \(shown last turn\): /.test(line) ? 'Looks (shown last turn): ' : 'Looks: ') + looks);
        assert(looks, 'the roommate is sent a look on "' + action + '": ' + line.slice(0, 600));
        assert(!looks.includes(oldEyes), 'not the old eyes (' + oldEyes + ') on "' + action + '": ' + looks);
        assert.match(looks, /\beyes?\b[^.;]{0,12}\bgreen\b|\bgreen eyes\b/i, 'green stays on the eyes on "' + action + '": ' + looks);
        assert.doesNotMatch(looks, /;\s*green\b/, 'and is never a bare word after the hair on "' + action + '": ' + looks);
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
