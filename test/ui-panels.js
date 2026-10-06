'use strict';
// Regressions for the panels, labels and editors: what the State panel, the Character header, the Settings notes, the turn footer,
// the Cast, Override and Debug screens and the phone sheet say and do. One scenario per behaviour. Each passes on the current page
// and fails on the page before them (10ae2ee). Run one by name: node ui-panels.js tools
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node ui-panels.js
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { boot } = require('./boot');

const HTML = process.env.WL_HTML || path.join(__dirname, '..', 'windlass', 'index.html');
const WORLDS = process.env.WL_WORLDS || path.join(__dirname, '..', 'windlass', 'worlds');
let unhandled = 0; process.on('unhandledRejection', () => { unhandled += 1; });

const clean = (h) => assert(!h.errors.length && !h.mock.violations.length, 'page errors or contract violations: ' + JSON.stringify(h.errors.concat(h.mock.violations)).slice(0, 400));
const world = () => { const ctx = { window: { WINDLASS_WORLDS: {} } }; vm.runInNewContext(fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'), ctx); return ctx.window.WINDLASS_WORLDS.sundered; };
const copyStore = (store) => new Map([...store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
const docOf = (store) => store.get([...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k))).data;
const turnDocs = (store) => [...store.keys()].filter((k) => /^adventures\/[^/]+\/turns\//.test(k)).sort().map((k) => store.get(k).data);
const promptOf = (c) => (Array.isArray(c.input) ? c.input.map((m) => m.content).join('\n') : String(c.input));
const text = (h, sel) => h.$(sel).textContent.replace(/\s+/g, ' ').trim();
const fire = (h, el, type) => el.dispatchEvent(new h.window.Event(type, { bubbles: true }));
const dd = (h, label) => { const dt = [...h.document.querySelectorAll('#items dt')].find((d) => d.textContent === label); return dt ? dt.nextElementSibling : null; };
const fieldOf = (h, id) => h.$(id).closest('.field');

// One finished game to start every scenario from: a bovine roommate and two turns. Each scenario gets its own copy of the store.
let gameStore = null;
async function game() {
  if (gameStore) return gameStore;
  const h = await boot({});
  try {
    assert(await h.settle(150, 6000), 'boot did not settle');
    h.type('#cRmSpecies', 'cow'); h.type('#cRmName', 'Daisy Holm');
    h.click('#cBegin'); assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
    assert(await h.turn('I unpack.')); assert(await h.turn('I look around the room.'));
    gameStore = copyStore(h.mock.store);
  } finally { h.close(); }
  return gameStore;
}
async function reopen(store, o) {
  o = o || {};
  const h = await boot({ mobile: !!o.mobile, setup(w, m) { m.store = store; if (o.spoilers) w.localStorage.setItem('windlass.spoilers', '1'); } });
  assert(await h.settle(150, 8000), 'boot did not settle'); await h.idle(10000); await h.settle(100, 4000);
  return h;
}
// Parts of the bovine kind told once (or finished, with their trait), as the track engine leaves them.
function seedTold(doc, told, finished) {
  const TR = world().transformation.tracks.species.cow; finished = finished || [];
  const tracks = Object.fromEntries(TR.map((t) => { const n = finished.includes(t.key) ? t.stages.length : (told[t.key] || 0); return [t.key, { s: 50, e: 100, p: n ? (n >= t.stages.length ? 100 : 30) : 0, told: n, nextAt: 0 }]; }));
  const traits = TR.filter((t) => finished.includes(t.key)).map((t) => ({ species: 'cow', trait: t.name + ': ' + t.stages[t.stages.length - 1], day: 1, settled: true, track: t.key }));
  doc.state.tf = Object.assign(doc.state.tf || {}, { influence: { cow: 30 }, traits, rungs: {}, arcs: [], tracks: [], paths: { cow: { sex: null, sexTold: [], formTold: [], day: 1, order: [] } }, prog: { cow: { lean: 0, face: 15, tracks } }, last: {}, drifted: {} });
}

const S = {
  // 1. The State panel's Transformation row is the engine's own list (a part counts from the moment its waypoint note is queued,
  // a turn before the story shows it), so it is a hidden item: with spoilers off the panel names no part and no kind's progress,
  // and a new game does not announce that the engine "confirmed" nothing. With spoilers on it names each kind, the count and the parts.
  async stateRowFollowsToggle() {
    const base = await game(); const store = copyStore(base); seedTold(docOf(store), { hands: 1, ears: 1 });
    const h = await reopen(copyStore(store));
    try {
      assert.equal(dd(h, 'Transformation'), null, 'spoilers off: no Transformation row, but it read: ' + (dd(h, 'Transformation') || {}).textContent);
      assert.doesNotMatch(text(h, '#items'), /under way|No engine-confirmed|hands|ears/, 'spoilers off: State names no part: ' + text(h, '#items'));
      h.click('#toggleHidden');
      const on = dd(h, 'Transformation'); assert(on, 'spoilers on: the row appears');
      assert.match(on.textContent, /^Bovine: 2 parts under way \((?:hands, ears|ears, hands)\)$/, on.textContent);
      assert(on.classList.contains('hidden-item'), 'and it is marked as a hidden item');
      h.click('#toggleHidden');
      assert.equal(dd(h, 'Transformation'), null, 'hiding spoilers again removes it');
      clean(h);
    } finally { h.close(); }
    const fresh = await reopen(copyStore(base));   // a game with nothing told, spoilers off
    try { assert.doesNotMatch(text(fresh, '#items'), /No engine-confirmed/, 'a new game must not tell the player the engine confirmed nothing'); clean(fresh); } finally { fresh.close(); }
  },

  // 2. The label beside the player's name counts parts from the tracks. It read the finished-trait list alone, so a body with
  // seventeen parts under way and none finished said "fully human" above an Influence panel at 100.
  async headerLabelCountsParts() {
    const base = await game(); const label = (h) => text(h, '#stageLabel');
    const a = copyStore(base); seedTold(docOf(a), { hands: 1, ears: 1 });
    const b = copyStore(base); seedTold(docOf(b), { ears: 1 }, ['hands']);
    for (const [store, want] of [[a, 'changes: 2 under way'], [b, 'changes: 1 finished, 1 under way'], [copyStore(base), 'fully human']]) {
      const h = await reopen(store, { spoilers: true });
      try { assert.equal(label(h), want, 'the label reads "' + label(h) + '"'); clean(h); } finally { h.close(); }
    }
    const off = await reopen(copyStore(a));
    try { assert.equal(label(off), '', 'spoilers off: no label'); } finally { off.close(); }
  },

  // 3. The tools follow the spoiler toggle. Override (the whole state, influence per kind) is offered only with spoilers on; the
  // Cast screen's brief and full sheet (where a person's secret lives) show only then, and a Save with them hidden keeps them;
  // Debug keeps the support view but not the narrator-only block, and the lore names read.
  async toolsFollowToggle() {
    const base = await game(); const orig = docOf(base).cast.generated.characters.find((c) => c.key === 'dean');
    const h = await reopen(copyStore(base));
    try {
      assert(h.$('#btnOverride').hidden, 'Override must not be offered with spoilers off');
      h.click('#btnCast'); h.click(h.$('#castList [data-key="dean"]')); await h.sleep(20);
      assert(fieldOf(h, '#cfBrief').hidden && fieldOf(h, '#cfSheet').hidden, 'the brief and the sheet carry what a person hides: not shown with spoilers off');
      assert.equal(h.document.querySelectorAll('#castList .k').length, 0, 'internal keys are not listed with spoilers off');
      h.click('#cfSave'); assert(await h.idle(8000));
      const ov = docOf(h.mock.store).cast.overrides.dean; assert(ov, 'the save went through');
      assert.equal(ov.brief, orig.brief, 'a Save with the brief hidden keeps it'); assert.equal(ov.sheet || '', orig.sheet || '', 'and the sheet');
      h.click('#dlgCast [data-close]');
      assert(await h.turn('I wait by the window.'));
      const sent = promptOf(h.mock.sampleCalls.filter((c) => /^turn/.test(c.label)).at(-1));
      const gm = /^<gm_only[^>]*>\n([\s\S]*?)\n<\/gm_only>$/m.exec(sent); assert(gm && gm[1].length > 200, 'the narrator was sent a gm_only block');
      const slice = gm[1].split('\n').find((l) => l.length > 80).slice(0, 60);
      h.click('#btnDebug'); const dbg = h.$('#dbgPrompt').textContent;
      assert(!dbg.includes(slice), 'Debug must not print the narrator-only block with spoilers off'); assert.match(dbg, /narrator-only secrets, hidden while spoilers are off/);
      assert(dbg.includes('<recent_turns') && dbg.includes('<action'), 'the rest of the prompt is still there for support');
      assert.doesNotMatch(h.$('#dbgMeta').textContent, /lore:/, 'the lore names stay hidden too'); assert.match(h.$('#dbgMeta').textContent, /words \(band/);
      h.click('[data-close="dlgDebug"]');
      h.click('#toggleHidden');
      assert(!h.$('#btnOverride').hidden, 'spoilers on: Override is offered');
      h.click('#btnCast'); h.click(h.$('#castList [data-key="dean"]')); await h.sleep(20);
      assert(!fieldOf(h, '#cfBrief').hidden && !fieldOf(h, '#cfSheet').hidden, 'spoilers on: the brief and the sheet show');
      assert(h.document.querySelectorAll('#castList .k').length > 0, 'and the keys');
      h.click('#dlgCast [data-close]');
      h.click('#btnDebug'); assert(h.$('#dbgPrompt').textContent.includes(slice), 'spoilers on: Debug prints the whole prompt'); assert.match(h.$('#dbgMeta').textContent, /lore:/);
      clean(h);
    } finally { h.close(); }
  },

  // 4. Condition is the player's own knowledge and shows as separate entries, not one comma-joined line (the narrator-kept Discoveries
  // list keeps its newest entries open and the earlier ones behind one tap; a short one needs no tap.
  async itemsShowAsEntries() {
    const base = await game(); const store = copyStore(base), items = docOf(store).state.items;
    items.condition = 'well, aching: toes, temples, neck, spine, ears hot';
    const h = await reopen(store);   // spoilers off: both are the player's own knowledge
    try {
      // The narrator-kept Discoveries list is gone: the engine's own record of the body's changes stands in for it.
      assert.equal(dd(h, 'Discoveries'), null, 'no Discoveries row');
      const entries = (el) => [...el.querySelectorAll('li')].map((li) => li.textContent);
      assert.deepEqual(entries(dd(h, 'Condition')), ['well', 'aching: toes', 'temples', 'neck', 'spine', 'ears hot'], 'a condition that is a run of clauses is read as entries');
      assert.equal(dd(h, 'Condition').querySelector('details'), null, 'and is shown whole');
      assert.equal(dd(h, 'Carrying').querySelectorAll('li').length, 5, 'the other lists are lists too');
      clean(h);
    } finally { h.close(); }
    const few = copyStore(base); const fi = docOf(few).state.items; fi.condition = 'well';
    const g = await reopen(few);
    try {
      assert.equal(dd(g, 'Condition').textContent, 'well'); assert.equal(dd(g, 'Condition').querySelector('li'), null, 'a short condition stays one line');
    } finally { g.close(); }
  },

  // 5. With bonds, the attitude is derived from them: the Cast form does not offer it (and a saved value is ignored), the Override
  // screen shows the bond instead of a number box, and the panel is headed Bonds and shows each bond's total of 100 with the people's
  // given names (a title and surname for a titled person), where it showed the 0 to 10 attitude under bare surnames.
  async attitudesFollowBonds() {
    const base = await game(); const store = copyStore(base), doc = docOf(store), W = world(), B = W.transformation.tracks.bond;
    const h = await reopen(store, { spoilers: true });
    try {
      h.click('#btnCast'); h.click(h.$('#castList [data-key="roommate"]')); await h.sleep(20);
      assert(fieldOf(h, '#cfAttitude').hidden, 'with bonds the attitude is derived: the Cast form must not offer it');
      const before = doc.state.attitudes.roommate; h.$('#cfAttitude').value = before === 1 ? '2' : '1'; fire(h, h.$('#cfAttitude'), 'input');
      h.click('#cfSave'); assert(await h.idle(8000));
      assert.equal(docOf(h.mock.store).state.attitudes.roommate, before, 'a saved Cast form must not move the attitude the bonds drive');
      h.click('#dlgCast [data-close]');
      h.click('#btnOverride');
      assert.equal(h.document.querySelectorAll('#ovrAttitudes [data-att]').length, 0, 'Override has no attitude boxes');
      assert.match(text(h, '#ovrAttitudes'), /bond \d+ of 100/); h.click('[data-close="dlgOverride"]');
      assert.match(text(h, '#attPanel h2'), /^Bonds with /);
      const total = (key) => Math.round(B.reduce((a, t) => a + t.weight * (((doc.state.bonds[key] || {})[t.key] || {}).p || 0) / 100, 0));
      const TITLE = /^(?:professor|prof\.?|dr\.?|doctor|mr\.?|mrs\.?|ms\.?|mx\.?|miss|sir|lady|lord|warden|dean|madam|master)$/i;
      const rows = [...h.document.querySelectorAll('#attitudes .bar')];
      const people = doc.cast.generated.characters.concat([doc.roommate]).filter((c) => c.key in doc.state.attitudes);
      assert(people.length > 10, 'the panel lists the cast: ' + people.length);
      for (const c of people) {
        const w = String(c.name).split(' ').filter(Boolean), want = w.length > 1 && TITLE.test(w[0]) ? w[0] + ' ' + w[w.length - 1] : (c.first || w[0]);
        const row = rows.find((r) => r.querySelector('.lbl').textContent.startsWith(want + ' ('));
        assert(row, 'the label should be what the story calls ' + c.name + ': ' + want + '; found ' + rows.map((r) => r.querySelector('.lbl').textContent).join(' | '));
        assert.equal(Number(row.querySelector('.num').textContent), total(c.key), 'the number is ' + c.name + '\'s bond of 100');
      }
      assert.match(text(h, '#attitudes'), /attitude \d+ of 10/, 'the attitude stays, small, under the bond');
      clean(h);
    } finally { h.close(); }
  },

  // 6. The Cast and Override wording is true: a reset goes back to how this adventure first wrote the person (people are drawn per
  // adventure, so there is no world's version), the influence buttons say what they do, and the undo that can only fail on a kind
  // that has tracks is not offered.
  async castAndOverrideWording() {
    const base = await game(); const W = world(); const h = await reopen(copyStore(base), { spoilers: true });
    try {
      h.click('#btnCast'); assert.doesNotMatch(h.$('#cfReset').textContent, /world's version/, h.$('#cfReset').textContent); assert.match(h.$('#cfReset').textContent, /this adventure first wrote/);
      h.click('[data-close="dlgCast"]');
      h.click('#btnOverride');
      const kinds = Object.keys(W.transformation.species);
      assert.equal(h.document.querySelectorAll('[data-manifest]').length, kinds.length);
      for (const b of h.document.querySelectorAll('[data-manifest]')) assert.equal(b.textContent, 'tell next step', 'the button says what it does');
      assert.equal(h.document.querySelectorAll('[data-unmake]').length, 0, 'undo last change can only fail for a kind on tracks ("on the tracks a Bovine change is undone only by the Spa")');
      clean(h);
    } finally { h.close(); }
  },

  // 7. Turns sent verbatim: a long story is sent fewer than the setting asks for, and the turn says so; a saved window the menu
  // does not list (2, 3 or 4) stays as it was when another setting is changed, where it was rewritten to 0.
  async turnsSentIsHonest() {
    const base = await game();
    const odd = copyStore(base); docOf(odd).settings.window = 6;
    const h = await reopen(odd);
    try {
      h.click('#btnSettings');
      h.$('#setPace').value = 'slow'; fire(h, h.$('#setPace'), 'change'); assert(await h.idle(8000));
      assert.equal(docOf(h.mock.store).settings.window, 6, 'changing the pace rewrote the window to ' + docOf(h.mock.store).settings.window);
      assert.equal(h.$('#setWindow').value, '6', 'a window the menu does not list still shows');
      assert.match(text(h, 'label[for=setWindow]'), /at most/, 'the setting says it is a maximum');
      clean(h);
    } finally { h.close(); }
    const shed = copyStore(base); const last = turnDocs(shed).at(-1).turns.at(-1);
    last.notes = (last.notes || []).concat('prompt near the size cap: verbatim window reduced to 1, timeline 10 events, 6 older beats, one style example');
    const g = await reopen(shed);
    try {
      const pills = (i) => [...g.document.querySelectorAll('.turn')][i].querySelector('.turn-foot').textContent;
      const n = g.document.querySelectorAll('.turn').length;
      assert.match(pills(n - 1), /sent 1 of 3 turns/, 'the turn whose prompt was shed says so: ' + pills(n - 1));
      assert.doesNotMatch(pills(n - 2), /sent \d+ of/, 'a turn sent in full does not');
      assert.match([...g.document.querySelectorAll('.turn')][n - 1].querySelector('.pill.warn').title, /only the last turn in full/);
      clean(g);
    } finally { g.close(); }
  },

  // 8. Settings say what they do: the density note gives the word ranges (and that romance and body-change scenes stay rich), the
  // pace note gives the daily limit, the step wait and the easing back, and what "unbounded" really lifts; the options fit the box.
  // A reply cut off twice names the director note, since Terse alone does not shorten a change scene.
  async settingsExplainThemselves() {
    const base = await game(); const W = world(), T = W.transformation, wb = W.wordBands;
    const h = await reopen(copyStore(base));
    try {
      h.click('#btnSettings');
      const dn = text(h, '#setDensityNote');
      for (const k of ['terse', 'standard', 'rich']) assert(dn.includes(k + ' ' + wb[k][0] + '–' + wb[k][1]), 'the density note gives ' + k + ': ' + dn);
      assert.match(dn, /romance and body-change scenes are always rich/i);
      const notes = {};
      for (const o of h.$('#setPace').options) {
        assert(o.textContent.length <= 24, 'the option must fit the closed box: ' + o.textContent);
        h.$('#setPace').value = o.value; fire(h, h.$('#setPace'), 'change'); assert(await h.idle(8000)); notes[o.value] = text(h, '#setPaceNote');
      }
      const gapMin = (sc) => Math.round(T.stepGapHours * 60 * sc), back = T.fade.trackAfterHours;
      assert.match(notes.slow, new RegExp('at most 5 influence a story day \\(10 on the most intimate contact\\).*about ' + gapMin(2) / 60 + ' hours of story time.*after ' + back * 2 / 24 + ' days'), notes.slow);
      assert.match(notes.standard, new RegExp('at most 10 influence a story day \\(20 on.*about ' + gapMin(1) + ' minutes of story time.*after 1 day'), notes.standard);
      assert.match(notes.fast, new RegExp('at most 20 influence a story day \\(40 on.*about ' + gapMin(0.5) + ' minutes of story time.*after ' + back / 2 + ' hours'), notes.fast);
      assert.match(notes.unbounded, new RegExp('No daily limit \\(a kind still gains at most ' + T.maxPerTurn + ' influence a turn, ' + T.maxPerTurn * 2 + ' on the most intimate contact\\)'), notes.unbounded);
      assert.match(notes.unbounded, /new step can be told every turn.*nothing eases back/, notes.unbounded);
      assert.equal(docOf(h.mock.store).settings.pace, 'unbounded', 'the last choice is the one saved');
      h.click('[data-close="dlgSettings"]');
      h.mock.sampleHandler = (input, o, call) => (/^turn/.test(call.label) ? { text: '{"narrative": "You look ar', truncated: true } : h.mock.defaultHandler(input, o, call));
      await h.turn('I look around.');
      const st = h.$('#status').hidden ? '' : h.$('#status').textContent;
      assert.match(st, /cut off after two attempts/, st); assert.match(st, /Narrative density/, st);
      assert.match(st, /director note/, 'Terse alone does not shorten a romance or change scene, so the hint names the director note: ' + st);
      clean(h);
    } finally { h.close(); }
  },

  // 9. Phone: the Character sheet takes focus and the page behind it is inert and not offered to a screen reader (the turn
  // announcement sits outside it, so a turn that finishes meanwhile is still heard); Close or Escape
  // brings focus back to Menu; a tucked action bar cannot be tabbed into.
  async phoneSheetKeyboard() {
    const base = await game(); const h = await reopen(copyStore(base), { mobile: true });
    try {
      const where = () => h.document.activeElement && (h.document.activeElement.id || h.document.activeElement.tagName);
      h.click('#menuBtn'); h.click('#btnRail'); await h.sleep(20);
      assert(h.document.activeElement && h.document.activeElement.closest('#rail'), 'focus must move into the sheet; it is on ' + where());
      assert(h.$('.story').hasAttribute('inert') && h.$('.topbar').hasAttribute('inert'), 'the page behind a full-screen sheet is inert');
      assert(!h.$('#announce').closest('[inert]'), 'a turn finishing while the sheet is open is still announced');
      assert.equal(h.$('#rail').getAttribute('role'), 'dialog'); assert.equal(h.$('#rail').getAttribute('aria-modal'), 'true'); assert(h.$('#rail').getAttribute('aria-label'));
      h.click('#railClose'); await h.sleep(10);
      assert(!h.$('.story').hasAttribute('inert') && !h.$('.topbar').hasAttribute('inert'), 'inert is lifted on close'); assert.equal(where(), 'menuBtn', 'focus returns to Menu');
      assert.equal(h.$('#rail').getAttribute('aria-modal'), null);
      h.click('#btnRail'); await h.sleep(10); h.document.dispatchEvent(new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await h.sleep(10);
      assert(!h.$('#rail').classList.contains('open') && where() === 'menuBtn', 'Escape closes the sheet and returns to Menu');
      h.click('#actionHandle'); await h.sleep(10);
      assert(h.$('#actionbar.tucked'), 'the bar is tucked'); assert(h.$('#actionbar .inner').hasAttribute('inert'), 'a bar tucked off screen must not take focus');
      assert(!h.$('#actionHandle').closest('.inner'), 'the tab that brings it back stays reachable');
      h.click('#actionHandle'); await h.sleep(10); assert(!h.$('#actionbar .inner').hasAttribute('inert'), 'the bar is reachable again');
      clean(h);
    } finally { h.close(); }
  },

  // 10. Screen-reader basics and contrast: the main boxes keep a name once text is typed, the page has a heading, the spoiler toggle
  // and the per-turn reveal buttons say their state, a finished or rewritten turn is announced, and the small grey and amber text
  // reach 4.5 to 1 on every surface in both themes.
  async namesAnnouncementsContrast() {
    const base = await game(); const h = await reopen(copyStore(base), { spoilers: true });
    try {
      for (const id of ['#action', '#director', '#rewrite']) assert(h.$(id).getAttribute('aria-label'), id + ' needs a name that stays when text is typed');
      assert(h.$('h1'), 'a page heading');
      assert.equal(h.$('#toggleHidden').getAttribute('aria-pressed'), 'true'); h.click('#toggleHidden'); assert.equal(h.$('#toggleHidden').getAttribute('aria-pressed'), 'false'); h.click('#toggleHidden');
      const reveal = h.$('[data-reveal]'); assert.equal(reveal.getAttribute('aria-expanded'), 'false'); h.click(reveal); assert.equal(reveal.getAttribute('aria-expanded'), 'true'); h.click(reveal); assert.equal(reveal.getAttribute('aria-expanded'), 'false');
      assert.equal(text(h, '#announce'), '', 'nothing announced before a turn');
      assert(await h.turn('I wait by the window.')); assert.match(text(h, '#announce'), /^Turn 3 is ready\.$/);
      h.click('#regen'); assert(await h.idle(20000)); assert.match(text(h, '#announce'), /^Turn 3 was rewritten\.$/);
      h.click('#regen'); assert(await h.idle(20000)); assert.match(text(h, '#announce'), /^Turn 3 was rewritten\.$/, 'a second rewrite is announced again');
      clean(h);
    } finally { h.close(); }
    const css = fs.readFileSync(HTML, 'utf8');
    const L = (hex) => { const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const light = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')), dark = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf('* { box-sizing'));
    for (const [name, blk] of [['light', light], ['dark', dark]]) {
      const v = (n) => new RegExp('--' + n + ':\\s*(#[0-9a-fA-F]{6})').exec(blk)[1];
      for (const fg of ['muted', 'warn']) for (const bg of ['bg', 'surface', 'surface-2']) assert(ratio(v(fg), v(bg)) >= 4.5, name + ' ' + fg + ' on ' + bg + ' is ' + ratio(v(fg), v(bg)).toFixed(2) + ' to 1');
    }
  },

  // 11. A long unbroken word (a pasted address, a run of letters) must not push the page or the Character sheet wider than the phone,
  // and the influence number must not wrap onto four lines. jsdom has no layout, so this reads the page's own rules; the same
  // checks were made in a real browser at 390 px (page 1,502 px wide and Close off screen before; both fit after).
  async longWordsAndNumbersFit() {
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000));
      const rules = []; for (const sh of h.document.styleSheets) for (const r of sh.cssRules) if (r.selectorText) rules.push(r);
      const rule = (sel, prop) => rules.filter((r) => r.selectorText.split(',').map((x) => x.trim()).includes(sel)).map((r) => r.style.getPropertyValue(prop)).filter(Boolean).pop() || '';
      assert.doesNotMatch(rule('.bar', 'grid-template-columns'), /1\.6rem/, 'the number column must fit "100 · body 48": ' + rule('.bar', 'grid-template-columns'));
      assert.match(rule('.bar', 'grid-template-columns'), /minmax\(0, 1fr\)/); assert.equal(rule('.bar .num', 'white-space'), 'nowrap');
      assert.match(rule('.kv', 'grid-template-columns'), /minmax\(0, 1fr\)/, 'the value column of the State panel can shrink');
      for (const sel of ['.kv dd', '.turn-action', '.turn-meta', '.advrow .t', '.advrow .m', '.timeline li', '.castlist button']) assert.equal(rule(sel, 'overflow-wrap'), 'anywhere', sel + ' wraps a long word');
      assert.equal(rule('.advrow .t', 'min-width'), '0');
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
    } catch (e) { failed += 1; console.log('FAIL', n, '-', String((e && e.message) || e).split('\n')[0].slice(0, 300)); if (process.env.UI_STACK) console.log(e && e.stack); }
  }
  if (failed) { console.error('UI PANELS FAILED: ' + failed + ' of ' + names.length + ' scenarios'); process.exit(1); }
  console.log('ui panels passed: ' + names.length + ' scenarios');
  process.exit(0);
})();
