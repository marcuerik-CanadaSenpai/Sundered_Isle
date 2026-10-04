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
  if (o.rmSpecies) h.type('#cRmSpecies', o.rmSpecies);
  if (o.rmName) h.type('#cRmName', o.rmName);
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
    const fits = new Function('escRe', src.slice(a, b) + '\nreturn anatomyFits;')(escRe);
    const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx);
    const cow = ctx.window.WINDLASS_WORLDS.sundered.genPools.species.cow;
    for (const t of ['flicks her two tails when amused', 'has eleven arms', 'scratches her second head when thinking', 'rubs three long muscular arms', 'a third arm folded away',
      'a second smaller head', 'a second, smaller head that sleeps', 'grows a second pair of arms', 'grows an extra pair of arms', 'talks out of her other mouth', 'has two heads', 'keeps a spare tail',
      'folds her three pairs of arms', 'scratches her fourth pair of arms', 'stretches two pairs of legs', 'grows a third pair of arms', 'flicks her two pairs of tails',
      'folds her seven pairs of arms', 'stretches twelve sets of legs', 'scratches her seventh pair of arms', 'shakes her seven heads', 'has twenty heads', 'flicks her 13th tail']) assert.equal(fits(t, cow), false, 'refused: ' + t);
    // Time, idiom and a pronoun or preposition between the number and the part are not anatomy.
    for (const t of ['swishes her tail when amused', 'hums while counting change', 'taps two fingers on the table',
      'takes a second to scratch her head before answering', 'gives another shake of her head', 'touches the other side of her face when thinking',
      'for the third time rubs her eyes', 'counts to three and closes her eyes', 'takes a second glance, head tilted', 'pauses a split second, head tilted',
      'waits a second, mouth open', 'holds her mug in her spare hand', 'never wants another mouth to feed', 'could use an extra pair of hands',
      'spends two hours brushing her tail', 'counts to two while swishing her tail', 'hums three notes while her tail sways',
      'could use a second pair of eyes', 'wishes for two pairs of hands', 'scans two rows of faces in the choir', 'buys three pairs of socks for her legs',
      'counts to seventeen while her tail sways', 'for the seventh time rubs her eyes']) assert.equal(fits(t, cow), true, 'kept: ' + t);
    // A figure is the same count as the word: the fox's own two tails pass either way, and no kind has two heads.
    const fox = ctx.window.WINDLASS_WORLDS.sundered.genPools.species.fox;
    for (const t of ['flicks her two tails when amused', 'flicks her 2 tails when amused']) { assert.equal(fits(t, fox), true, 'the fox kept: ' + t); assert.equal(fits(t, cow), false, 'the cow refused: ' + t); }
    for (const t of ['has 2 heads', 'flicks her 3 tails', 'flicks her three tails', 'flicks her two pairs of tails', 'flicks her thirteen tails', 'flicks her twenty tails']) assert.equal(fits(t, fox), false, 'the fox refused: ' + t);
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

  // 10. Romance is detected by what the player asks for, not by stray words. Consent and anatomy guidance stay in the romance prompt.
  async romanceDetection() {
    const h = await begin({ rmName: 'Rin Kitsuragi' });
    try {
      await setWriter(h, 'auto');
      const W = h.window.WINDLASS_WORLDS[onlyAdv(h.mock.store).data.worldId];
      const rich = W.wordBands.rich;
      for (const a of ['I make love with Rin.', 'I take Rin to bed.', 'I go to bed with Rin.', 'I take Rin Kitsuragi to bed.', 'i take rin to bed', 'I undress rin slowly.', 'I take her gently up to bed.', 'I go to bed with Rin tonight.',
        'I undress Rin very slowly.', 'I undress her very slowly.', 'I undress Rin languidly.', 'I undress her piece by piece.', 'I take her all the way up to bed.']) {
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
        'I take her book to bed.', "I take Rin's notebook to bed.", 'I go to bed with her book.', "I go to bed with Rin's letters.", 'I take her dolly to bed.', 'I take her butterfly to bed.', 'I take her jelly to bed.']) {
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
    } catch (e) { failed += 1; console.log('FAIL', n, '-', String((e && e.message) || e).split('\n')[0].slice(0, 260)); }
  }
  if (failed) { console.error('AUDIT FIXES FAILED: ' + failed + ' of ' + names.length + ' scenarios'); process.exit(1); }
  console.log('audit fixes passed: ' + names.length + ' scenarios');
  process.exit(0);
})();
