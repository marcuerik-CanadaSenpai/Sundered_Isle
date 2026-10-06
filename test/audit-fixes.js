'use strict';
// Regressions for the audit fixes: one scenario per fix. Each passes on the fixed page and fails on the page before the fixes
// (2512da3); sunderedOnly fails on the last three-world page (d985886). Run one scenario by name: node audit-fixes.js romanceDetection
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node audit-fixes.js
// Halloway and Mythaven have left the game; hallowayAttunement reads the last Halloway world file from test/fixtures/halloway.js
// to exercise runProgression, the engine code only a world with a progression reaches.
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { boot } = require('./boot');

const HTML = process.env.WL_HTML || path.join(__dirname, '..', 'windlass', 'index.html');
const WORLDS = process.env.WL_WORLDS || path.join(__dirname, '..', 'windlass', 'worlds');
let unhandled = 0; process.on('unhandledRejection', () => { unhandled += 1; });

const advDocs = (store) => [...store.entries()].filter(([p]) => /^adventures\/[^/]+$/.test(p));
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
  const h = await boot({ setup: o.setup });
  assert(await h.settle(150, 6000), 'boot did not settle');
  if (o.world) { h.click('#btnAdventures'); h.$('#newWorld').value = o.world; h.click('#newAdv'); await h.settle(150, 6000); }
  if (o.name) h.type('#cName', o.name);
  if (o.gender) { h.$('#cGender').value = o.gender; h.$('#cGender').dispatchEvent(new h.window.Event('change')); }
  if (o.rmSpecies) h.type('#cRmSpecies', o.rmSpecies);
  if (o.rmName) h.type('#cRmName', o.rmName);
  if (o.rmGender) { h.$('#cRmGender').value = o.rmGender; h.$('#cRmGender').dispatchEvent(new h.window.Event('change')); }
  h.click('#cBegin');
  assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
  return h;
}
async function setWriter(h, value) {
  h.click('#btnSettings'); h.$('#setNarrTier').value = value; h.$('#setNarrTier').dispatchEvent(new h.window.Event('change'));
  await h.idle(8000); h.click('[data-close="dlgSettings"]');
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
const heldParts = (M, set) => Object.fromEntries(M.map((t) => { const o = set[t.key] || {}, n = t.stages.length, told = o.told === 'done' ? n : o.told || 0; return [t.key, Object.assign({ s: o.s || 8, e: o.e || 30, p: o.p != null ? o.p : stageAt(told, n), told, ext: o.ext || 0, nextAt: o.nextAt || 0 }, o.open || o.told === 'done' ? {} : { eased: 0 })]; }));

// A man with a bovine roommate at the unbounded pace, an hour of intimate contact every turn, the path kept a man's (no way over): the
// waypoints told, one entry per turn that told one, and every turn prompt.
async function tfGame(turnsToRun, patch) {
  const h = await begin({ rmSpecies: 'cow', rmName: 'Daisy Holm', gender: 'male', name: 'Tom Ashby' });
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
  // 1. Halloway Attunement: salt taken during a stage-crossing fever keeps that crossing's marks owed; no second crossing while
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

  // 2. The open adventure deleted on another device can be restored from this page with one button.
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

  // 3. A background sync reload (focus) of the open adventure gives way when the player opens another adventure meanwhile.
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
      // B's reload of X is slow; while it runs, the player opens Y.
      b.mock.dbDelay = (op, p) => (p === 'adventures/' + X + '/turns' ? 1200 : 0);
      b.click('#btnAdventures'); await b.settle(100, 3000);
      b.window.dispatchEvent(new b.window.Event('focus'));
      await b.sleep(20);
      const yRow = [...b.document.querySelectorAll('#advlist .advrow')].find((r) => /Copy Y/.test(r.textContent));
      b.click(yRow.querySelector('[data-act="open"]'));
      assert(await b.idle(10000)); await b.sleep(800); await b.idle(5000);
      assert.equal(b.window.localStorage.getItem('windlass.last'), Y, 'the adventure the player opened must stay open');
      assert(!b.$('#feed').textContent.includes('A: a newer turn'), 'the sync must not put X back on screen');
      assert.doesNotMatch(statusText(b), /Picked up the newer save/, 'no sync message for an adventure no longer open');
      clean(b);
    } finally { pages.forEach((x) => x.close()); }
  },

  // 4. A turn taken on the placeholder while the saves still load is refused and saves nothing.
  async turnDuringSlowBoot() {
    const store = new Map(); const pages = [];
    try {
      const a = await boot({ setup(w, m) { m.store = store; } }); pages.push(a);
      assert(await a.settle(150, 6000)); a.click('#cBegin'); assert(await a.idle(15000));
      assert(await a.turn('I look around.'));
      const { id } = onlyAdv(store); a.close(); pages.length = 0;
      const b = await boot({ setup(w, m) { m.store = store; m.dbDelay = (op, p) => (op === 'query' && p === 'adventures' ? 2500 : 0); } }); pages.push(b);
      await b.sleep(400);
      const callsBefore = turnCalls(b).length;
      b.$('#action').value = 'I unpack my bag.'; b.click('#send');
      await b.sleep(600);
      assert.match(statusText(b), /still loading/, 'the turn must be refused with a plain reason: ' + statusText(b));
      assert.equal(turnCalls(b).length, callsBefore, 'no turn call on the placeholder');
      assert(await b.idle(15000)); await b.sleep(300); await b.idle(5000);
      assert.equal(advDocs(store).length, 1, 'no adventure document may be created for the placeholder');
      assert.equal(onlyAdv(store).id, id);
      assert(!b.$('#feed').textContent.includes('unpack'), 'the refused turn is not shown');
      clean(b);
    } finally { pages.forEach((x) => x.close()); }
  },

  // 5. resource_exhausted is a passing refusal: Retry save; quota_exceeded says the store is full.
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

  // 6. Free-form invention cannot add anatomy that is absent from the kind's world data.
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

  // 6b. The page's own anatomy check against the Sundered cow: impossible counts and ordinals are refused, the kind's own
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

  // 7. The generated cast never takes the player's first name, and an invented first name with a space is refused.
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

  // 8. Renaming the roommate in the Cast editor reaches every {rm_*} in the next turn prompt; the aliases follow the name.
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

  // 8b. Presence entries in any case, by the surname's last word, or with a "(Race)" label follow a rename, and the reset to how
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

  // 8c. A tight lore budget sheds what the recent story only brushed past before what the player's own action names: the
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

  // 9a. Fade deadlines are absolute: a long quiet turn that passes two of them eases one step now and the other next turn.
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

  // 10a. Elements on the die: a settled change carries its kind's element. A magical working through a carried element is one
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

  // 10b. The most intimate contact counts for the most: sex with someone of the kind is intensity 4 (16 at the kind's rate), it is
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

  // 10c. Charms, curses and the Spa: a worn charm is one contact a story day with its kind, a cursed piece bites deeper each day,
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

  // 8f. Every woman in the cast has her own chest (cup, nipple, areola) and her hair from the kind's pools; a bovine woman's
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
        assert.match(c.looks, /\bHair: |\bfeathers in place of hair|\bLeaves: /i, c.name + ' (' + c.species + ') has hair (or what stands for it) in the look: ' + c.looks);
        if (c.gender === 'female') assert.match(c.looks, /\bcup\b|\bbreasts?\b/i, c.name + ' (' + c.species + ') has her chest in the look: ' + c.looks);
      }
      assert(await h.turn('I look around the room.'));
      const p = promptOf(lastTurn(h));
      assert.match(p, /Hair, its style and colour, is part of every look/, 'the appearance rule names hair');
      assert.match(p, /Breasts differ from woman to woman/, 'the anatomy rule names the variety');
      clean(h);
    } finally { h.close(); }
    const g = await begin({ rmSpecies: 'harpy', rmName: 'Wren Skye' });
    try {
      const rm = onlyAdv(g.mock.store).data.roommate; const looks = rm.looks || (rm.gen && rm.gen.looks) || '';
      assert.match(looks, /Plumage: /, 'the harpy has her plumage: ' + looks);
      assert.match(looks, /Hair: [^.]*hair|Feathers in place of hair/i, 'and her hair, or feathers where her crest has taken it: ' + looks);
      assert.match(looks, /Crest: /, 'and her crest: ' + looks);
      assert.match(looks, /\b(A|B) cup\b/, 'and has her own light chest: ' + looks);
      assert.doesNotMatch(looks, /\{/, 'no placeholder: ' + looks);
      clean(g);
    } finally { g.close(); }
  },

  // 8f2. A harpy's arms are her wings, feathered from the shoulder, and each ends in a hand whose fingers are talons, for gripping;
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
      assert.match(looks, /Wings: arms as wings/, 'and her arms are wings: ' + looks);
      assert.match(looks, /Hands: [^.]*clawed finger/, 'with a gripping hand at the end of each: ' + looks);
      assert.doesNotMatch(looks, old, 'with no bare wrist or forearm-only wing: ' + looks);
      clean(h);
    } finally { h.close(); }
  },

  // 8i. The PR #49 review: no step is told twice (a rung's sex steps never repeat its women steps), a lead line never fixes a hair
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

  // 8l. Form steps are never assumed told. A save from before they were kept, on a path still going over with no form track, shows
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

  // 8n. Every kind's ladder carries the change-tracks document's lines, folded into the steps, women steps and habits of the kinds that
  // exist (the kitsune is the fox): one of each kind's distinctive lines is here, and the fold kept the ladder's pinned facts and shape.
  async docTracksFold() {
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const T = ctx.window.WINDLASS_WORLDS.sundered.transformation;
    const textOf = (sp) => sp.ladder.flatMap((r) => [].concat(r.steps, r.women || [], r.sex || [])).concat(sp.habits || []).join('\n');
    const lines = {
      wolf: [/dusk is the best light there is/, /the jaw muscle standing at the hinge/], cow: [/let down by warmth, touch or strong feeling/, /heel wants to lift and resists coming down/],
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
  // 8o. The change-tracks model: each kind changes on weighted tracks of evenly spaced waypoints, driven by influence through windows
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
      store.get('adventures/' + id).data.settings.pace = 'unbounded';
      h.window.WINDLASS_WORLDS.sundered.transformation.sexChange.cow.chance = 1;
      const data = () => onlyAdv(store).data, tf = () => data().state.tf, last = () => storedTurns(store, id).at(-1);
      let shifts = [], updates = [], spa = null;
      patchTurns(h, (r) => { r.time_advance_minutes = 180; r.exposures = spa ? [] : [{ species: 'cow', method: 'the evening with Daisy', intensity: 3 }]; r.bond_shifts = shifts; if (updates.length) r.state_updates = updates; if (spa) r.spa_reset = spa; r.state_updates = (r.state_updates || []).concat([{ key: 'present', op: 'append', value: ['Daisy Holm'] }]); });
      const stepNotes = (t) => t.notes.filter((n) => /^change (?:begins|continues|complete):|^cow path: .* waypoint/.test(n));
      const M = TR.species.cow, SM = TR.woman; let firstSeen = false, waypoints = 0, teatsOpened = false;
      const a0 = data().state.attitudes.roommate; assert(typeof a0 === 'number');
      // Before any change: the waypoint and story-thread rules are not sent, and only the kinds in the scene have their contacts listed.
      let b0 = null, preTotal = null; const prompts = [];
      for (let i = 0; i < 26; i++) {
        shifts = i === 3 ? [{ who: 'roommate', facet: 'trust', dir: 'up', why: 'a secret kept' }] : i === 4 ? [{ who: 'roommate', facet: 'trust', dir: 'down', why: 'a promise broken' }] : [];
        updates = i === 5 ? [{ key: 'attitudes.roommate', op: 'inc', value: 1 }] : [];
        assert(await h.turn('I spend the evening with Daisy.'), 'turn ' + (i + 1));
        const t = last(), st = tf(), pr = st.prog.cow, sx = st.sexprog, notes = stepNotes(t); waypoints += notes.length; prompts.push(promptOf(lastTurn(h)));
        if (i === 24) preTotal = Math.round(M.reduce((a, t2) => a + t2.weight * pr.tracks[t2.key].p / 100, 0));
        if (i === 0) { const p0 = promptOf(lastTurn(h)); assert.doesNotMatch(p0, /Each part changes on its own track/, 'the waypoint rule waits for a change'); assert.doesNotMatch(p0, /Story thread:/, 'the story thread waits for a change'); assert.match(p0, /- cow \(bovine mythkin\): /, 'the roommate\'s kind has its contacts listed'); assert.doesNotMatch(p0, /- dryad \(/, 'a kind not in the scene is not'); assert.doesNotMatch(p0, /Charms and curses: a charm/, 'nor the charm rules with no charm in play'); }
        if (!b0) { b0 = JSON.parse(JSON.stringify(data().state.bonds.roommate)); for (const f of ['attraction', 'touch', 'intimacy', 'openness', 'standing']) assert.equal(b0[f].p, 0, 'a new bond starts with no ' + f); assert.equal(b0.ease.p, Math.min(a0 * 10, 45), 'ease is seeded from the attitude'); }
        assert(notes.length <= 1, 'one waypoint a turn: ' + JSON.stringify(notes));
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
        if (sx.tracks.rhythms.told >= 3) assert(sx.tracks.chest.told >= 4, 'the first bleed waits for Chest at stage 4');
        if (pr.tracks.feet_and_stance.told > 0) assert(pr.tracks.toes_and_hooves.told >= 2, 'the stance waits for the toes at stage 2');
        if (i === 3) { assert.equal(data().state.bonds.roommate.trust.p, b0.trust.p + 10, 'a trust shift up moves one notch'); }
        if (i === 4) { assert.equal(data().state.bonds.roommate.trust.p, b0.trust.p, 'a trust shift down takes it back'); assert.equal(data().state.attitudes.roommate, a0, 'a shift and its undoing leave the attitude where it was'); }
        if (i === 5) { assert.equal(data().state.bonds.roommate.liking.p, b0.liking.p + 13, 'an older attitude update moves liking one notch'); assert.equal(data().state.attitudes.roommate, Math.min(10, a0 + 1), 'and sets the attitude it asked for'); }
        if (i < 3) assert.equal(data().state.attitudes.roommate, a0, 'seeding the bond never moves the attitude');
      }
      assert(waypoints >= 6, 'twenty-six turns tell many waypoints: ' + waypoints + ' over ' + storedTurns(store, id).length + ' stored turns');
      assert(Object.values(tf().sexprog.tracks).some((r) => r.told > 0), 'the way over has told a waypoint');
      assert(teatsOpened || tf().sexprog.tracks.chest.told < 3, 'the udder opens once Chest reaches stage 3 on the way over');
      const p = promptOf(lastTurn(h)); const block = p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>'));
      // The last prompt was built before the last turn's progress, so its total is the one after turn twenty-five.
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

  // 8p. The body fights off a small change: after a quiet story day with nothing of its kind, a part at half or less eases back a
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
  // 8q. Healing: the body never changes back by itself, but the Spa heals on purpose, one waypoint a visit, the earlier stage line
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
  // 8r. The doc's fields and behaviours folded into the game. Every kind's ways (its senses, appetites and instincts, and the by-sex
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
      assert.match(daisy, /Ways, shown in what she does, never explained: (weather, water and grass read by nose[^;.]*|greens and grain, eaten slowly and chewed twice|a heavy, warm body[^;.]*|placid[^;.]*|a low hum and a carrying low|warm hide, hay and milk)\./, 'the roommate in the scene carries one of her kind\'s ways a turn: ' + daisy.slice(0, 200));
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
  // 8s. The doc's engine rules for the tracks: one waypoint a turn; the way over, on whichever path carries it, opens the tracks
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
  // 8p. The PR #52 review fixes. The world data keeps to each kind's body: the bovine coat runs from hooves, the kitsune's stance waits
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
    doc.state.present = [minor.name];
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
  // 8m. The looks show rather than explain. No pool line or ladder step lectures on a kind's biology or custom ("in the way of
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

  // 8n. The State panel's Transformation row lists a change from its first told waypoint. The track model keeps no trait for a
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

  // 9c. Playtest findings: a present-tense dairy action ("I drink the cocoa") is a bovine contact like the past-tense one; the
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

  // 9b. A woman's looks open with her height and build, part by part; the kind's anatomy follows as plain labelled fact.
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

  // 9d. The cast by distance from the scene. People present or named get the full sheet; people whose place now, or whose role's
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
      assert(await h.turn('I look around the room.'));
      let daisy = line('roommate'), who = line('physician');
      assert.match(daisy, /^- Daisy Holm \(Bovine mythkin\) \[roommate\] \(Woman, she\/her; attitude \d+\/10\)\. Roommate in 4B\. Second-year, /, 'the roommate present: the race once, in the name; gender, pronouns and attitude in the head: ' + daisy.slice(0, 160));
      assert.match(daisy, /Looks: Height: .* Not on this body: .* Dress: .* Close up: .* Ways, shown in what she does, never explained: .* Now: .* Aim now: .*\.$/, 'and the full sheet: ' + daisy.slice(-200));
      assert.doesNotMatch(block(), /\bfor to\b/, 'a hope that is an infinitive takes no "for"');
      assert.match(who, new RegExp('^- ' + re(physician.name) + ' \\(' + re(physician.race) + '\\) \\[physician\\] \\((?:Woman|Man|Non-binary), \\w+/\\w+; attitude \\d+/10\\)\\. Staff; runs the medical centre and the Restoration Spa\\. Now: the medical centre\\.$'), 'the physician, elsewhere, is a line of index: ' + who);
      assert.doesNotMatch(who, /Aim now|asks no questions|Temperament/, 'with no aim; the role\'s detail and the temperament wait for the turn the story reaches her');
      assert.match(block(), /\n\nMinor figures, a mention or a line at most, never a speech: /, 'the minors\' line');
      assert(listedMinors().includes(porter.name + ' ('), 'the Kettle Hall porter is listed in Kettle Hall: ' + minors());
      assert(!listedMinors().includes(ferry.name + ' ('), 'the ferryman has no line: nothing in the scene reaches the ferry: ' + minors());
      // Out of the scene she is a name and her post; a word of her line in the scene text (the Aerie, Wednesdays) lists her as her race and her line instead. Either form keeps the change.
      assert(minors().includes('Ottoline Brack (' + far.post + ')') || /Ottoline Brack \(human, [^,]+, a fourth-year, mostly \w+ now/.test(minors()), 'out of the scene, the born-human fourth-year\'s post keeps the change: ' + minors());
      assert(await h.turn('I walk over to the medical centre.'));
      who = line('physician');
      assert.match(who, /\)\. Staff; runs the medical centre and the Restoration Spa; brisk, kind, asks no questions\. Temperament text for physician\. Now: the medical centre\. Aim now: restore anyone who asks and send them on their way\.$/, 'the action names her place: the brief and the aim come: ' + who);
      assert.doesNotMatch(who, /Looks:|Wants /, 'but not the full sheet');
      assert(await h.turn('I ask ' + physician.first + ' about the Spa.'));
      who = line('physician');
      assert.match(who, /Does not say: .* Knows [^.]*\. Looks: Height: /, 'named by the action: the full sheet, with looks: ' + who.slice(0, 300));
      assert.doesNotMatch(who, /nobody else outside class, club or dorm/, 'who they know is listed; the rule that nobody knows anyone outside class, club or dorm is in <rules>');
      assert(await h.turn('I take the cloud ferry down.'));
      assert(listedMinors().includes(ferry.name + ' ('), 'the ferryman is listed when the action reaches the ferry: ' + minors());
      patchTurns(h, (r) => { r.state_updates = [{ key: 'present', op: 'set', value: ['Daisy Holm (roommate)', creamery.name] }]; r.time_advance_minutes = 5; });
      assert(await h.turn('I sit down with Daisy and ' + creamery.first + '.'));
      daisy = line('roommate'); const cow = line('creamery');
      // The kind's ways go out one fragment a turn (the whole line every turn is what the narrator recites); the first fragment is this one.
      const frags = loadWorld().transformation.tracks.species.cow.filter((x) => x.endsAs && (!x.sex || x.sex === 'women')).map((x) => String(x.endsAs).replace(/\.$/, '').toLowerCase());
      const way = (/Ways, shown in what she does, never explained: ([^.]*)\./.exec(daisy) || [])[1] || '';
      assert(way && frags.includes(way.toLowerCase()), 'the roommate carries one fragment of the kind\'s ways: ' + daisy);
      assert.match(cow, /Ways, shown in what she does, never explained: those of Daisy above, the same kind\./, 'the second bovine woman in the room points to them: ' + cow.slice(-220));
      clean(h);
    } finally { h.close(); }
  },

  // 9e. The cast by distance keeps a person the player reaches for by role ("the doctor", "the Spa", "the captain of the running
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

  // 9f. A role is reached by the words people use for it, written in the world as the role's cues ("the nurse", "the infirmary"),
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
      assert.match(line('physician'), /brisk, kind, asks no questions.* Aim now: /, 'the infirmary, set as the place, reaches the physician: ' + line('physician'));
      // A person present by role is near: the brief and the aim, with what she never says in public.
      patchTurns(h, (r) => { r.state_updates = [{ key: 'location', op: 'set', value: 'the quad' }, { key: 'present', op: 'set', value: ['Daisy Holm (roommate)', 'the Dean'] }]; r.time_advance_minutes = 5; });
      assert(await h.turn('I walk out onto the quad.'));
      patchTurns(h, stay);
      assert(await h.turn('I listen to what she says.'));
      assert.match(line('dean'), /never names transformation or the Spa in public.* Aim now: /, 'the Dean, present by role, gets the brief and the aim: ' + line('dean'));
      clean(h);
    } finally { h.close(); }
  },

  // 10. Romance is detected by what the player asks for, not by stray words. Consent and anatomy guidance stay in the romance prompt.
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

  // 11. A change merely pending (a track whose next step is not due, no arc opening) does not make a quiet turn top-tier.
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

  // 12. Stop pressed while the finished reply is being fitted to length keeps the turn as written.
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

  // 12b. Stop pressed while the memory fold runs keeps the finished turn, saved, with its memory unfolded and a note.
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

  // 17a. A tap on Take turn or Undo that arrives while the background sync (focus, back to the tab) is still reading the store waits
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

  // 17b. A quote the narrator forgot to escape inside the narrative: the repair no longer reads it as the end of the string, so the
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

  // 17c. The length fit cannot gut a scene: a rewrite far below the band is refused and the original kept, and the fit's own prompt
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
      clean(h);
    } finally { h.close(); }
  },

  // 17d. State updates from the reply: a missing or junk value never reaches the lists ("undefined" in present), an empty remove
  // never empties the inventory, "False" reads false, an append to a text item adds to it, an inherited name such as "constructor"
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

  // 17e. The clock: a time_advance of null is no number (the default 15 minutes and a note, not 0), and the event stamps the
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

  // 17f. A bond shift moves a facet only in a direction the narrator states: "decrease" or none is ignored with a note, not read as
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

  // 17g. An engine step that throws on a damaged save does not cost the narrator's finished turn: the turn is kept without that
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

  // 17h. Text typed while a turn is being written stays in its box when the turn finishes; a box still holding what was sent is
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

  // 17i. A reply cut off is asked for again with a shorter one requested (the same prompt would be cut at the same place); a
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

  // 13. With Claude unavailable, the status keeps saying so after Begin, with a way to retry.
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

  // 14. Accessibility basics.
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

  // 15. A reply cut off twice points at the setting that actually exists.
  async truncatedTwice() {
    const h = await begin();
    try {
      h.mock.sampleHandler = (input, o, call) => (/^turn/.test(call.label) ? { text: '{"narrative": "You look ar', truncated: true } : h.mock.defaultHandler(input, o, call));
      await h.turn('I look around.');
      assert.match(statusText(h), /cut off after two attempts/, statusText(h));
      assert.match(statusText(h), /Narrative density/, 'the message must name the Narrative density setting');
    } finally { h.close(); }
  },

  // 16. Sundered Isle is the only world. The creation screen offers no world picker and creates in Sundered. A newer save from a
  // world no longer in the game (Mythaven) is passed over quietly at boot, also when this device's pointer names it: the
  // older Sundered save opens with a plain welcome, and Adventures lists the Mythaven save as no longer in this game, with
  // Continue disabled.
  // 9q. A roommate's "not where their kind are expected" club is never the kind's own: with the Creamery as the only haunt on
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
  // 17. A part under way is followed before the next begins: the part told last goes on (three waypoints in a row) and a new part
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

  // 18. A waypoint's note says how it is lived: one new thing, met mid-action and never foretold, told in the order it happens with
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
      const block = g.prompts.at(-1); assert.match(block, /One part is new a turn; every other part stays as it stands and is only felt/, 'the block says earlier parts are only felt');
      assert.doesNotMatch(block, /between waypoints the part keeps changing by degrees/, 'and no longer says they keep changing');
      clean(g.h);
    } finally { g.h.close(); }
  },

  // 19. The turn that completes a part gets the room the length line promises ("give it room", the wider band); a small step does not,
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

  // 20. A part the engine note gives is not said twice: Body now points at the note, so the waypoint's line is in the prompt once.
  async bodyNowNotRepeated() {
    const g = await tfGame(9);
    try {
      const p = g.prompts.at(-1), tb = p.slice(p.indexOf('<transformation>'), p.indexOf('</transformation>')), note = (p.match(/Note from the engine: [^\n]*/g) || []).find((n) => /waypoint \d+ of \d+/.test(n));
      const m = /([A-Z][^():]*?) \((?:[^()]*, )?waypoint (\d+) of (\d+)\): (.{30})/.exec(note || ''); assert(m, 'the note carries its fact: ' + note);
      assert.match(tb, new RegExp(m[1] + ' \\(' + (m[2] === m[3] ? 'finished' : m[2] + ' of ' + m[3]) + '\\): in the note from the engine'), 'Body now points the announced part at the note');
      assert(!tb.includes(m[4]), 'its line is not also in Body now: ' + m[4]);
    } finally { g.h.close(); }
  },

  // 21. Fur is told as it grows: a covering's first waypoint is felt (itch, prickle) with the hairs coming through, its last says where
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

  // 23. A scene that runs over several turns is one contact: at the unbounded pace (no day cap) eight five-minute turns of the same
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

  // 24. A man whose bovine path does not go over to a woman's body never opens the women's parts (the udder, the milk); the block says
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

  // 25. A part this body does not have never holds back what stands on it: a rabbit woman whose draw gives no belly fur still grows
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

  // 26. The body easing back after a quiet day never takes a part out from under one that stands on it: the stance stands on the toes
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

  // 27. What the player and narrator are told about influence is true of the track model: parts begin anywhere from 12 to 50, not
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

  // 17. The memory fold gets each beat with the day and time of its turn (the beats carry none), the opening's beat included, in
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

  // 17b. What the prompt says twice is said once: <state> is compact, leaves out the closed places' flags that are not yet true
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

  // 17d. A fold that keeps failing does not let <earlier_turns> grow without end: it holds at most the 36 beats a fold leaves. And a
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

  // 17c. The style examples are the same for the same turn of the same game, however many times the prompt is built (the shedding
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
    } catch (e) { failed += 1; console.log('FAIL', n, '-', String((e && e.message) || e).split('\n')[0].slice(0, 260)); if (process.env.AUDIT_STACK) console.log(e && e.stack); }
  }
  if (failed) { console.error('AUDIT FIXES FAILED: ' + failed + ' of ' + names.length + ' scenarios'); process.exit(1); }
  console.log('audit fixes passed: ' + names.length + ' scenarios');
  process.exit(0);
})();
