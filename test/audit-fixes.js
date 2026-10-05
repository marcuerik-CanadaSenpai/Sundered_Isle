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

  // 8b. Presence entries in any case, by the surname's last word, or with a "(Race)" label follow a rename, and "Reset to the
  // world's version" carries them back, so the roommate stays present through both.
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
      const line = chars.split('\n').find((l) => l.includes('[key: historian]')) || '';
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
      // The Spa, for the cat kind: the collar slips off and the cat influence is gone; the goblin bracelet stays where it is.
      spa = ['cat'];
      assert(await h.turn('I go to the Restoration Spa and ask for the cat to be washed out of me.'));
      assert.equal(inf().cat, 0, 'the Spa clears the cat influence');
      assert.deepEqual(data().state.items.wearing, ['a goblin copper warming-bracelet'], 'the cursed collar has slipped off; the bracelet stays');
      assert(last().notes.some((n) => /^Spa: slipped off a tarnished silver collar/.test(n)), 'and it is noted: ' + JSON.stringify(last().notes));
      spa = null; advance = 720;
      assert(await h.turn('I sleep.'));
      assert.match(promptOf(lastTurn(h)), /slipped off a tarnished silver collar that closes by itself, which lies inert on the bath's edge/, 'the narrator is told so on the next turn');
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
      assert.match(looks, /nipple/, 'and nipples');
      assert.match(looks, /vein/, 'and veins');
      assert.doesNotMatch(looks, /milk|lactat/, 'and no word on milk, which is not a look');
      assert.match(looks, /udder/, 'and the udder');
      assert.match(looks, /Hair: [^.]*\bhair\b/i, 'and hair: ' + looks);
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
      assert.match(looks, /Crest and ears: /, 'and her crest: ' + looks);
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
      assert.match(looks, /Talons: /, 'the roommate\'s look has talons: ' + looks);
      assert.match(looks, /Arms as wings: /, 'and her arms are wings: ' + looks);
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
  // drawn once per path, never past the next waypoint not yet told; at most two waypoints a turn; needs and by-sex tracks gate; the
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
        assert(notes.length <= 2, 'at most two waypoints a turn: ' + JSON.stringify(notes));
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
      assert(prompts.some((q) => /Note from the engine: The change (?:continues|completes a part|is beginning) \(bovine mythkin/.test(q)), 'a waypoint is announced to the narrator: ' + JSON.stringify(storedTurns(store, id).map((t) => stepNotes(t)).filter((x) => x.length)) + ' | ' + JSON.stringify(prompts.map((q) => (q.match(/Note from the engine: [^\n]{0,90}/g) || []).join(' / ')).filter(Boolean).slice(-6)));
      assert.match(p, /<bonds note="[^"]*">\n- Daisy \[roommate\] \(bond \d+ of 100\): /, 'the bonds block lists the roommate\'s facets');
      assert.match(p, /"bond_shifts": array of \{"who": character key, "facet": ease\|knowing\|trust\|liking\|attraction\|touch\|intimacy\|openness\|standing/, 'the reply contract asks for bond shifts');
      const turn4 = storedTurns(store, id).find((t) => t.n === 5), bondNote = (turn4 && turn4.pendingAfter || []).concat(storedTurns(store, id).flatMap((t) => t.pendingAfter || [])).find((n) => /^Bond with Daisy: trust reaches "/.test(n));
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
      for (let i = 0; i < 16 && !tf2().sex; i++) assert(await h2.turn('I get on with the day.'));
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
      assert.match(p0, /any change can be healed on purpose at the Restoration Spa[^\n]*one step a visit|The body never reverts by itself; the Spa heals on purpose, one step a visit\./, 'and the narrator knows healing is on purpose, a step a visit');
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
      // New contact lets a healed part go on again, the same as it was.
      spa = null; contact = [{ species: 'cow', method: 'a hug', intensity: 1 }];
      assert(await h.turn('I hug Daisy.'));
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
      assert.match(daisy, /Ways, shown in what she does, never explained: weather, water and grass read by nose[^.]*; greens and grain, eaten slowly and chewed twice/, 'the roommate in the scene carries her kind\'s ways: ' + daisy.slice(0, 200));
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
    const minor = (doc.cast.generated.minors || []).find((m) => T.species[m.species] && !castKinds.has(m.species)); assert(minor, 'a minor of a kind no cast member has');
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
  // hooves, shown, with no horns (a bull's) and no word on milk.
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
      for (const re of [/horn/, /milk|lactat/]) assert.doesNotMatch(looks, re, 'and nothing a bovine woman\'s look does not hold ' + re + ': ' + looks);
      assert(await h.turn('I look at Daisy.'));
      assert.match(promptOf(lastTurn(h)), /shown in passing, as part of the person, never recited from the sheet as a list or explained as biology or custom/, 'the appearance rule reaches the narrator');
      clean(h);
    } finally { h.close(); }
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
      // A few thousand characters of action are enough to push a prompt already near the cap into the short form, well short of the cap itself.
      assert(await h2.turn('I walk the long way round. ' + 'The path winds past the Creamery and on along the old wall by the river, and I take it slowly. '.repeat(60)));
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
      assert.match(looks, /\. Arms as wings: [^.]+\. /, 'the body follows as its own labelled sentences: ' + looks.slice(0, 400));
      assert.match(looks, /\b(A|B) cup\b|\bbreasts\b/, 'her chest is described, drawn from the harpy pool: ' + looks);
      assert.equal(h.$('#cfNote').getAttribute('role'), 'status'); assert.equal(h.$('#cfNote').getAttribute('aria-live'), 'polite');
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
