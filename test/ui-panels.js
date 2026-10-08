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
// The page's style rules as a phone of `width` px sees them: top-level rules and those under a (max-width) or (min-width) media
// query the width meets (colour-scheme and motion queries are skipped), each with its selector's specificity, in source order.
// jsdom has no layout and does not apply media queries in getComputedStyle, so the phone checks resolve the cascade from these.
function phoneRules(h, width) {
  const out = [];
  const meets = (m) => { const t = String(m.mediaText || (m.media && m.media.mediaText) || ''); if (/prefers-/.test(t)) return false; const mx = /max-width:\s*(\d+)px/.exec(t), mn = /min-width:\s*(\d+)px/.exec(t); return (!mx || width <= +mx[1]) && (!mn || width >= +mn[1]); };
  const walk = (list) => { for (const r of list) { if (r.selectorText) out.push(r); else if (r.cssRules && r.media && meets(r)) walk(r.cssRules); } };
  for (const sh of h.document.styleSheets) walk(sh.cssRules);
  return out;
}
const specificity = (sel) => { const s2 = sel.replace(/:not\(([^)]*)\)/g, ' $1'); return [(s2.match(/#[\w-]+/g) || []).length, (s2.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length, (s2.replace(/[#.:[][^\s>+~]*/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length]; };
const cmpSpec = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
// The value of `prop` on `el` from those rules: inline style first, then the most specific matching selector, the later on a tie.
function phoneStyle(h, el, prop, width) {
  if (el.style && el.style.getPropertyValue(prop)) return el.style.getPropertyValue(prop);
  let best = null;
  phoneRules(h, width || 412).forEach((r, i) => {
    const v = r.style.getPropertyValue(prop); if (!v) return;
    for (const sel of r.selectorText.split(',').map((x) => x.trim())) {
      let ok = false; try { ok = el.matches(sel); } catch (e) { ok = false; }
      if (!ok) continue; const sp = specificity(sel);
      if (!best || cmpSpec(sp, best.sp) > 0 || (cmpSpec(sp, best.sp) === 0 && i >= best.i)) best = { v, sp, i };
    }
  });
  return best ? best.v : '';
}
const shown = (h, el, width) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { if (e.hidden || phoneStyle(h, e, 'display', width) === 'none') return false; } return true; };
// Tucked, the bar keeps only its tab and the suggestion row; everything else in it is inert.
const tuckedInert = (h) => [...h.$('#actionbar .inner').children].every((c) => (c.id === 'suggestions' ? !c.closest('[inert]') : c.hasAttribute('inert')));
const noneInert = (h) => !h.$('#actionbar .inner').closest('[inert]') && [...h.$('#actionbar .inner').children].every((c) => !c.hasAttribute('inert'));

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
  const h = await boot({ mobile: !!o.mobile, setup(w, m) { m.store = store; if (o.spoilers) w.localStorage.setItem('windlass.spoilers', '1'); if (o.touch) { const mm = w.matchMedia; w.matchMedia = (q) => (/pointer:\s*coarse/.test(q) ? Object.assign({}, mm(q), { matches: true }) : mm(q)); } } });
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

  // Debug before the first turn shows the roommate's introduction prompt. When the roommate is the one the player saw, that secret
  // is masked there with spoilers off, as it is in a turn's prompt, and shown with spoilers on.
  async debugHidesIntroSecret() {
    let h = null;
    for (let s = 1; s <= 12 && !h; s++) {
      const x = await boot({ seed: 9200 + s });
      try {
        assert(await x.settle(150, 6000), 'boot did not settle');
        x.type('#cRmSpecies', 'cow'); x.type('#cRmName', 'Daisy Holm'); x.type('#cGlimpse', 'Hooves under a long skirt on a station platform');
        x.click('#cBegin'); assert(await x.idle(30000), 'creating the adventure did not finish'); await x.settle(150, 6000);
      } catch (e) { x.close(); throw e; }
      if (docOf(x.mock.store).player.glimpse.who === 'roommate') h = x; else x.close();
    }
    assert(h, 'the roommate was never the one seen in twelve games');
    try {
      h.click('#btnDebug'); await h.sleep(20);
      const off = h.$('#dbgPrompt').textContent;
      assert.match(off, /roommate's first appearance/, 'Debug shows the introduction prompt: ' + off.slice(0, 120));
      assert(!off.includes('saw three weeks before'), 'spoilers off, Debug shows who the player saw');
      assert(off.includes('narrator-only secrets, hidden while spoilers are off'), 'and masks it as a turn\'s secrets are masked');
      h.click('[data-close="dlgDebug"]'); h.click('#toggleHidden'); h.click('#btnDebug'); await h.sleep(20);
      assert(h.$('#dbgPrompt').textContent.includes('saw three weeks before'), 'spoilers on, the secret shows');
      clean(h);
    } finally { h.close(); }
  },

  // A pace changed in Settings reaches the rail's Humanity row at once, not on the next turn.
  async settingsPaceRedrawsRail() {
    const h = await reopen(copyStore(await game()), { spoilers: true });
    try {
      for (const [pace, at] of [['slow', 60], ['unbounded', 15]]) {
        h.click('#btnSettings'); h.$('#setPace').value = pace; fire(h, h.$('#setPace'), 'change'); assert(await h.idle(8000)); h.click('[data-close="dlgSettings"]');
        const row = dd(h, 'Humanity');
        assert(row, 'spoilers on, the rail has a Humanity row');
        assert.match(row.textContent, new RegExp('doors answer at ' + at + '\\+'), pace + ' pace: ' + row.textContent);
      }
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
      h.click('#btnCast'); h.click('#castAdd'); assert(await h.idle(8000)); await h.sleep(20);
      assert(!fieldOf(h, '#cfAttitude').hidden, 'a person with no bond yet keeps the attitude box: it sets the first bond');
      assert.match(text(h, 'label[for=cfAttitude]'), /Starting attitude \(0–10, sets the first bond\)/);
      h.click('[data-close="dlgCast"]');
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
      const other = [...h.document.querySelectorAll('#castList button')].find((b) => b.dataset.key !== 'roommate'); h.click(other); await h.sleep(20);
      h.click('#cfRemove'); assert(await h.idle(8000)); await h.sleep(20);
      const row = h.$('#castList [data-key="' + other.dataset.key + '"]');
      assert.match(row.textContent, / · not in this story/, 'a person out of the story says so: ' + row.textContent); assert.doesNotMatch(h.$('#castList').textContent, /· removed/, 'nobody reads "removed" who was never in play');
      h.click('[data-close="dlgCast"]');
      h.click('#btnOverride');
      const kinds = Object.keys(W.transformation.species);
      assert.equal(h.document.querySelectorAll('[data-manifest]').length, kinds.length);
      for (const b of h.document.querySelectorAll('[data-manifest]')) assert.equal(b.textContent, 'tell next step', 'the button says what it does');
      assert.equal(h.document.querySelectorAll('[data-unmake]').length, 0, 'undo last change can only fail for a kind on tracks ("on the tracks a Bovine change is undone only by the Spa")');
      clean(h);
    } finally { h.close(); }
  },

  // 6b. A test instruction left on says how to clear it, since Override, where it is edited, is behind the spoiler toggle.
  async testBannerSaysHow() {
    const store = copyStore(await game()); docOf(store).settings.testNote = 'Daisy hums.';
    const h = await reopen(store);
    try {
      assert(!h.$('#testBanner').hidden, 'the banner shows'); assert(h.$('#btnOverride').hidden, 'Override is behind the spoilers');
      assert.match(text(h, '#testBanner'), /Daisy hums\. \(to clear it, show spoilers and open Override\)/, text(h, '#testBanner'));
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
      assert.match([...g.document.querySelectorAll('.turn')][n - 1].querySelector('.pill.warn').title, /the narrator was sent only the last turn in full/);
      assert.doesNotMatch([...g.document.querySelectorAll('.turn')][n - 1].querySelector('.pill.warn').title, /storyteller/, 'one word for the writer: the narrator');
      clean(g);
    } finally { g.close(); }
    // The note names the setting the turn ran with, so a later change of the setting does not rewrite what an older turn says.
    const set2 = copyStore(base); docOf(set2).settings.window = 2; const lt = turnDocs(set2).at(-1).turns.at(-1);
    lt.notes = (lt.notes || []).concat('prompt near the size cap: verbatim window reduced to 3 of 4, timeline 10 events');
    const k = await reopen(set2);
    try {
      const foot = [...k.document.querySelectorAll('.turn')].at(-1).querySelector('.turn-foot').textContent;
      assert.match(foot, /sent 3 of 4 turns/, 'the pill reads the setting from the note: ' + foot);
      clean(k);
    } finally { k.close(); }
  },

  // 7b. An older turn's change list and evaluation detail are dropped from the save on purpose; Debug says so rather than showing
  // "Changes (0)" and "No state changes." for a turn that changed things.
  async trimmedTurnsSayTrimmed() {
    const store = copyStore(await game()); const t = turnDocs(store)[0].turns[0];
    t._trimmed = true; delete t.diff; t.evaluation = { stat: 'none', outcome: 'success', difficulty: 'easy' };
    const h = await reopen(store, { spoilers: true });
    try {
      const first = h.$('.turn[data-id="' + t.id + '"]'), btn = first.querySelector('[data-reveal="changes"]');
      assert.equal(btn.textContent, 'Changes', 'no count for a list that was not kept: ' + btn.textContent);
      assert.match(first.querySelector('[data-panel="changes"]').textContent, /Not kept for older turns\./); assert.doesNotMatch(first.querySelector('[data-panel="changes"]').textContent, /No state changes/);
      assert.match(first.querySelector('[data-panel="eval"]').textContent, /Older turns keep only the stat, the outcome and the difficulty\./);
      const last = [...h.document.querySelectorAll('.turn')].at(-1); assert.match(last.querySelector('[data-reveal="changes"]').textContent, /^Changes \(\d+\)$/, 'the newest turn keeps its count');
      clean(h);
    } finally { h.close(); }
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
      assert(h.$('#actionbar.tucked'), 'the bar is tucked'); assert(tuckedInert(h), 'the hidden parts of a tucked bar must not take focus');
      assert(!h.$('#actionHandle').closest('.inner'), 'the tab that brings it back stays reachable');
      h.click('#actionHandle'); await h.sleep(10); assert(noneInert(h), 'the bar is reachable again');
      // A turn that fails while the bar is tucked brings the bar back, so its status is heard and its Retry reachable; behind the
      // sheet the status is announced.
      h.mock.sampleHandler = (input, o, call) => (/^turn/.test(call.label) ? 'no reply here' : h.mock.defaultHandler(input, o, call));
      h.click('#actionHandle'); await h.sleep(10); assert(tuckedInert(h));
      await h.turn('I wait.');
      assert(h.$('#status').classList.contains('bad') && !h.$('#status').hidden, 'the turn failed: ' + text(h, '#status'));
      assert(!h.$('#status').closest('[inert]'), 'a bad status is not left inside the tucked, inert bar');
      h.click('#btnRail'); await h.sleep(20); assert(h.$('.story').hasAttribute('inert'));
      await h.turn('I wait again.');
      assert(text(h, '#announce').length > 10 && text(h, '#status').includes(text(h, '#announce').slice(0, 20)), 'behind the sheet the failure is announced: ' + text(h, '#announce'));
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
      const tg = h.$('#toggleHidden'), nm = (tg.getAttribute('aria-label') || tg.textContent).toLowerCase(); assert(tg.textContent.toLowerCase().includes(nm), 'the toggle\'s name is its visible text: "' + nm + '" / "' + tg.textContent + '"');
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

  // 12. What the player has learned has a panel of its own in the Character sheet, beside State: each explanation the engine
  // recorded, newest first, with the day it was told and who told it (never the player: a named person who was there or whom the
  // line marks as the speaker, else whoever else was there, else no one), and a short line before anything is explained. Spoilers
  // off it lists only what was told; spoilers on, the keeper's secrets follow that line, marked hidden as secrets the keeper knows.
  // It is in the phone sheet too, an exported save brings it back whole, an old save says its explanations are not listed, and
  // undo takes an explanation back off the list.
  async learnedPanel() {
    const base = await game(), W = world(), truth0 = W.secrets.truth[0].slice(0, 60), d0 = docOf(base), me = d0.player.first;
    const dean = d0.cast.generated.characters.find((c) => c.key === W.secrets.keeper.key), deanFirst = dean.first || dean.name.split(' ')[1];
    const properWord = (hay, w) => new RegExp('(^|[^A-Za-z])' + w + '([^A-Za-z]|$)').test(hay);
    const lines = (h) => [...h.document.querySelectorAll('#learned li')].map((li) => ({ label: (li.querySelector('span') || {}).textContent || '', text: li.textContent.replace((li.querySelector('span') || {}).textContent || '', ''), hidden: li.classList.contains('hidden-item') }));
    const secretLabel = (l) => l.label === 'Secret · ' + deanFirst + ' knows it' || (l.label === 'Not yet learned' && /^Who /.test(l.text));
    const h = await reopen(copyStore(base));
    let exported, want;
    try {
      const panel = h.$('#learnedPanel'); assert(panel && panel.closest('#rail') && !panel.hidden, 'the Character sheet has no panel of what the player has learned');
      assert.deepEqual(lines(h).map((l) => l.text), ['Nothing explained yet.'], 'before anything is explained the panel says so: ' + JSON.stringify(lines(h)));
      h.click('#toggleHidden');
      const empty = lines(h);
      assert(empty[0].text === 'Nothing explained yet.' && empty.length > 1 && empty.slice(1).every((l) => l.hidden), 'spoilers on, the empty line comes before the secrets, not under them: ' + JSON.stringify(empty.map((l) => l.text.slice(0, 30))));
      h.click('#toggleHidden');
      let n = 0;
      h.mock.sampleHandler = (input, o, call) => {
        const out = h.mock.defaultHandler(input, o, call); if (!/^turn/.test(call.label)) return out;
        const r = JSON.parse(out); n += 1;
        if (n === 1) r.facts = ['Told: a glamour is a worn seeming that hides someone from human eyes below, as Daisy put it'];
        if (n === 2) r.time_advance_minutes = 720;
        if (n === 3) r.facts = ['Told: the Spa takes a change back a step at a time', 'Told: ' + dean.name + ' sets the curfew at ten and nobody argues with her', 'The warden keeps the keys on a hook'];
        if (n === 4) r.state_updates = [{ key: 'present', op: 'set', value: [me] }];
        if (n === 5) r.facts = ['Told: the lodge bell rings at dusk', 'Told: the north stair is shut after dark, as ' + dean.name + ' put it'];
        return JSON.stringify(r);
      };
      for (const a of ['I ask Daisy about the horns.', 'I go down to the lodge.', 'I ask Daisy about the Spa.', 'I walk on alone.', 'I read the notices.']) assert(await h.turn(a), 'the turn "' + a + '" did not finish');
      const t = turnDocs(h.mock.store).flatMap((d) => d.turns || [d]).filter((x) => x && x.n >= 3).sort((a, b) => a.n - b.n), d1 = t[0].stateBefore.day, d3 = t[2].stateBefore.day, d5 = t[4].stateBefore.day;
      assert(d3 > d1, 'the test needs the second explanation on a later day: ' + d1 + ', ' + d3);
      assert.deepEqual(t[2].stateBefore.present, [me, 'Daisy Holm'], 'the test needs the player and Daisy there for the third turn: ' + JSON.stringify(t[2].stateBefore.present));
      assert.deepEqual(t[4].stateBefore.present, [me], 'the test needs the player alone for the fifth turn: ' + JSON.stringify(t[4].stateBefore.present));
      want = [{ label: 'Day ' + d5 + ' · ' + deanFirst, text: 'the north stair is shut after dark, as ' + dean.name + ' put it', hidden: false },
        { label: 'Day ' + d5, text: 'the lodge bell rings at dusk', hidden: false },
        { label: 'Day ' + d3 + ' · Daisy Holm', text: dean.name + ' sets the curfew at ten and nobody argues with her', hidden: false },
        { label: 'Day ' + d3 + ' · Daisy Holm', text: 'the Spa takes a change back a step at a time', hidden: false },
        { label: 'Day ' + d1 + ' · Daisy', text: 'a glamour is a worn seeming that hides someone from human eyes below, as Daisy put it', hidden: false }];
      assert.deepEqual(lines(h).filter((l) => l.label !== 'Words'), want, 'newest first, each with its day and who told it (a person named only when there or speaking, never the player): ' + JSON.stringify(lines(h)));
      assert(!lines(h).some((l) => l.label !== 'Words' && properWord(l.label, me)), 'the player is never credited with telling: ' + JSON.stringify(lines(h).map((l) => l.label)));
      assert.match(text(h, '#learnedCount'), /^5 learned$/);
      assert(!text(h, '#learned').includes(truth0) && !lines(h).some((l) => l.hidden), 'spoilers off: only what was told is listed');
      assert.equal(dd(h, 'Told so far'), null, 'the list lives in its own panel, not again in State');
      h.click('#toggleHidden');
      const on = lines(h), hid = on.filter((l) => l.hidden);
      assert.deepEqual(on.filter((l) => !l.hidden && l.label !== 'Words'), want, 'spoilers on: what was told still leads');
      assert(on.findIndex((l) => l.hidden) === on.length - hid.length, 'spoilers on: the secrets come after everything learned: ' + JSON.stringify(on.map((l) => l.hidden)));
      assert(hid.length >= W.secrets.truth.length && hid.some((l) => l.text.startsWith(truth0)), 'spoilers on: the keeper\'s secrets not yet learned follow: ' + JSON.stringify(hid.map((l) => l.text.slice(0, 40))));
      assert(hid.every(secretLabel), 'and each is marked as a secret the keeper knows, not as unlearned: ' + JSON.stringify(hid.map((l) => l.label)));
      assert.match(text(h, '#learnedCount'), /^5 learned$/, 'a secret not learned is not counted as learned');
      h.click('#toggleHidden'); assert(!text(h, '#learned').includes(truth0), 'hiding spoilers again takes them away');
      h.click('#exportAdv'); await h.settle(50, 3000);
      exported = h.mock.downloadsLog.at(-1); assert(exported, 'the export did not download');
      clean(h);
    } finally { h.close(); }
    const save = JSON.parse(exported.data); assert.equal(save.adventure.state.told.length, 5, 'the export carries the told record');
    const phone = await reopen(copyStore(base), { mobile: true });
    try {
      phone.click('#btnAdventures'); await phone.settle(80, 4000);
      const input = phone.$('#importFile'); Object.defineProperty(input, 'files', { value: [new phone.window.File([exported.data], 'save.json', { type: 'application/json' })], configurable: true });
      input.dispatchEvent(new phone.window.Event('change', { bubbles: true })); await phone.idle(30000); await phone.settle(150, 8000);
      phone.click('[data-close="dlgAdventures"]'); phone.click('#menuBtn'); phone.click('#btnRail'); await phone.sleep(20);
      assert(phone.$('#rail').classList.contains('open') && phone.$('#learnedPanel').closest('#rail.open'), 'on a phone the panel is in the Character sheet');
      assert.deepEqual(lines(phone).filter((l) => l.label !== 'Words'), want, 'an imported save shows what was learned with its days and tellers: ' + JSON.stringify(lines(phone)));
      clean(phone);
    } finally { phone.close(); }
    // A save from before the told record: it says its explanations are not listed (never "nothing yet"), counts none, and with
    // spoilers on that line still comes before the secrets.
    const old = copyStore(base); delete docOf(old).state.told; delete docOf(old).state.toldWords;
    const o = await reopen(old);
    try {
      const legacy = 'Explanations from before this save kept a record are not listed.', ol = lines(o).filter((l) => l.label !== 'Words');
      assert.deepEqual(ol.map((l) => l.text), [legacy], 'an old save says what it lacks, and not "nothing yet": ' + JSON.stringify(ol));
      assert.equal(text(o, '#learnedCount'), '', 'an old save counts nothing as learned');
      o.click('#toggleHidden');
      const oh = lines(o).filter((l) => l.label !== 'Words');
      assert(oh[0].text === legacy && oh.length > 1 && oh.slice(1).every((l) => l.hidden), 'spoilers on, the old-save line comes before the secrets: ' + JSON.stringify(oh.map((l) => l.text.slice(0, 30))));
      clean(o);
    } finally { o.close(); }
    // Undo takes back the turn that explained something, and the explanation with it.
    const u = await reopen(copyStore(base));
    try {
      u.mock.sampleHandler = (input, op, call) => { const out = u.mock.defaultHandler(input, op, call); if (!/^turn/.test(call.label)) return out; const r = JSON.parse(out); r.facts = ['Told: the Spa takes a change back a step at a time']; return JSON.stringify(r); };
      assert(await u.turn('I ask Daisy about the Spa.'), 'the turn did not finish');
      assert.deepEqual(lines(u).filter((l) => l.label !== 'Words').map((l) => l.text), ['the Spa takes a change back a step at a time'], 'the explanation is listed: ' + JSON.stringify(lines(u)));
      u.click('#undo'); assert(await u.idle(20000), 'the undo did not finish'); await u.settle(100, 4000);
      assert.deepEqual(lines(u).filter((l) => l.label !== 'Words').map((l) => l.text), ['Nothing explained yet.'], 'undo leaves the explanation listed: ' + JSON.stringify(lines(u)));
      assert.equal(text(u, '#learnedCount'), '', 'undo leaves it counted');
      clean(u);
    } finally { u.close(); }
  },

  // Every explanation stays in the Learned panel, not only the newest twenty: twenty-four told over eight turns are all listed and
  // counted, after a reload too, and one told again later is not recorded a second time.
  async learnedPanelKeepsAll() {
    const h = await reopen(copyStore(await game()));
    let store;
    const listed = (x) => [...x.document.querySelectorAll('#learned li')].map((li) => li.textContent);
    const all = (x, when) => { for (let k = 1; k <= 24; k++) assert(listed(x).some((t) => t.includes('house rule ' + k + ' of Kettle Hall')), when + ': explanation ' + k + ' is not listed'); assert.match(text(x, '#learnedCount'), /^24 learned$/, when); };
    try {
      let n = 0;
      h.mock.sampleHandler = (input, o, call) => {
        const out = h.mock.defaultHandler(input, o, call); if (!/^turn/.test(call.label)) return out;
        const r = JSON.parse(out); n += 1;
        r.facts = n <= 8 ? [1, 2, 3].map((k) => 'Told: house rule ' + ((n - 1) * 3 + k) + ' of Kettle Hall') : ['Told: house rule 1 of Kettle Hall'];
        return JSON.stringify(r);
      };
      for (let i = 1; i <= 8; i++) assert(await h.turn('I listen.'), 'turn ' + i + ' did not finish');
      all(h, 'after eight turns');
      assert(await h.turn('I listen again.'), 'the ninth turn did not finish');
      const last = turnDocs(h.mock.store).flatMap((d) => d.turns || [d]).filter(Boolean).sort((a, b) => a.n - b.n).at(-1);
      assert(!last.notes.some((x) => /^told: /.test(x)), 'an explanation already recorded is recorded again: ' + JSON.stringify(last.notes));
      all(h, 'after it is told again');
      store = copyStore(h.mock.store);
      clean(h);
    } finally { h.close(); }
    const r = await reopen(store);
    try { all(r, 'after a reload'); clean(r); } finally { r.close(); }
  },

  // 13. Phone action bar (from a report on a ~412 px phone: open it took most of the screen; tucked, the suggestions could not be
  // touched or swiped). Tucked, the bar keeps its tab and one sideways-scrolling row of suggestion chips, nothing else, and a
  // chip tap opens the bar with that text in the action box. Open, the bar is capped at 45% of the screen and scrolls inside
  // itself, the action box is two rows with its own scroll, the director note stays folded, Take turn and More share a row.
  // jsdom has no layout (scrollWidth, clientWidth and heights read 0), so geometry is checked as the page's resolved phone rules
  // and the structure: three chips each at least half the row wide in a row that cannot wrap and scrolls on x is wider than it
  // shows; a bar with a max-height of 45vh is at most 45% of the screen.
  async phoneActionBar() {
    const base = await game(); const W = 412;
    const long = ['I ask Daisy quietly whether she has seen the lighthouse keeper since the storm', 'I fold the letter into my coat pocket and step out toward the harbour wall', 'I pour two cups of the dark tea and set one down beside her hands'];
    const h = await reopen(copyStore(base), { mobile: true, touch: true });
    try {
      h.mock.sampleHandler = (input, o, call) => { const out = h.mock.defaultHandler(input, o, call); if (!/^turn/.test(call.label)) return out; const r = JSON.parse(out); r.suggested_actions = long.slice(); return JSON.stringify(r); };
      assert(await h.turn('I sit by the stove.'), 'the turn did not finish'); await h.settle(100, 4000);
      const row = h.$('#suggestions'), chips = () => [...row.querySelectorAll('button')], st = (el, p) => phoneStyle(h, el, p, W);
      assert.deepEqual(chips().map((b) => b.textContent), long, 'the chips are the turn\'s suggestions');
      // The chip row: one line that scrolls sideways by touch and never grows taller.
      assert.match(st(row, 'overflow-x'), /^(auto|scroll)$/, 'the chip row scrolls on x: ' + st(row, 'overflow-x'));
      assert.equal(st(row, 'flex-wrap'), 'nowrap', 'the chips stay on one row');
      assert.match(st(row, 'overflow-y'), /^(hidden|clip)$/, 'the chip row never scrolls or grows on y: ' + st(row, 'overflow-y'));
      assert.equal(st(row, '-webkit-overflow-scrolling'), 'touch', 'momentum scrolling on iOS');
      assert.doesNotMatch(st(row, 'touch-action'), /^(none|pan-y|pinch-zoom)$/, 'a sideways swipe on the row is not taken from it: ' + st(row, 'touch-action'));
      assert.equal(st(row, 'overscroll-behavior-x'), 'contain', 'a swipe at the row\'s end does not chain into the page');
      for (const b of chips()) {
        const basis = (/^0 0 (\d+)%$/.exec(st(b, 'flex')) || [])[1] || (/^(\d+)%$/.exec(st(b, 'flex-basis')) || [])[1];
        assert(+basis >= 50 && /^0\b/.test(st(b, 'flex')), 'each chip keeps at least half the row and does not shrink, so three overflow it (scrollWidth > clientWidth): ' + st(b, 'flex'));
        assert(parseFloat(st(b, 'min-height')) >= 40, 'a chip is a touch target at least 40px tall: ' + st(b, 'min-height'));
      }
      // Tucked: the tab and the chip row stay, nothing else of the bar shows or takes focus; the bar is not moved off screen.
      h.click('#actionHandle'); await h.sleep(10);
      assert(h.$('#actionbar.tucked'), 'the tab tucks the bar');
      assert(shown(h, row, W) && !row.closest('[inert]'), 'tucked, the chip row is visible and can be touched');
      assert(chips().every((b) => !b.closest('[inert]') && shown(h, b, W)), 'tucked, every chip can be tapped');
      for (const c of h.$('#actionbar .inner').children) if (c !== row) { assert(!shown(h, c, W), 'tucked, ' + (c.id || c.className || c.tagName) + ' is hidden'); assert(c.hasAttribute('inert'), 'tucked, ' + (c.id || c.className) + ' is inert'); }
      assert(shown(h, h.$('#actionHandle'), W) && h.$('#actionHandle').textContent.includes('Actions'), 'the Actions tab shows');
      assert.match(st(h.$('#actionbar'), 'transform') || 'none', /^none$/, 'the tucked bar is not translated off screen: ' + st(h.$('#actionbar'), 'transform'));
      assert.equal(st(h.$('#actionbar'), 'position'), 'sticky'); assert.match(st(h.$('#actionbar'), 'bottom'), /^0(px)?$/);
      assert.match(st(h.$('#actionHandle'), 'top'), /^-\d+px$/, 'the tab sits above the bar, which is pinned to the bottom, so the one-row chips cannot push it off screen');
      // A chip tap on the tucked bar puts its text in the action box and opens the bar; nothing is sent.
      const sent = h.mock.sampleCalls.length;
      h.click(chips()[1]); await h.sleep(10);
      assert.equal(h.$('#action').value, long[1], 'the chip\'s text is in the action box');
      assert(!h.$('#actionbar.tucked') && noneInert(h), 'the chip opened the bar'); assert.notEqual(h.document.activeElement, h.$('#action'), 'on a touch screen the keyboard stays down, as before'); assert.equal(h.mock.sampleCalls.length, sent, 'a chip tap does not take the turn');
      // Open: capped at 45% of the screen with its own scroll; the action box two rows with its own scroll; director folded.
      const bar = h.$('#actionbar'), inner = h.$('#actionbar .inner'), mh = st(bar, 'max-height');
      const cap = /^(\d+(?:\.\d+)?)d?vh$/.exec(mh); assert(cap && +cap[1] <= 45, 'the open bar is at most 45% of the screen tall: ' + mh);
      assert.match(st(inner, 'overflow-y'), /^(auto|scroll)$/, 'what does not fit scrolls inside the bar, not off the page');
      assert.equal(h.$('#action').rows, 2); assert.match(st(h.$('#action'), 'max-height'), /em|px/, 'the action box stops at two rows'); assert.match(st(h.$('#action'), 'overflow-y'), /^(auto|scroll)$/, 'and scrolls inside');
      assert.equal(h.$('#action').style.height, '', 'typing does not grow the box');
      h.type('#action', 'a long action\n'.repeat(30)); assert.equal(h.$('#action').style.height, '', 'typing a long action does not grow the box');
      assert(!h.$('details.director').open && h.$('details.director summary'), 'the director note is folded behind its own toggle');
      assert.equal(h.$('#send').parentElement, h.$('#moreBtn').parentElement, 'Take turn and More are in one row');
      assert(shown(h, h.$('#moreBtn'), W) && !shown(h, h.$('#turnMore'), W), 'More holds the other turn buttons until tapped');
      h.click('#moreBtn'); assert(shown(h, h.$('#turnMore'), W) && h.$('#turnMore').closest('.inner'), 'More opens its buttons inside the bar\'s scroll');
      h.click('#moreBtn');
      clean(h);
    } finally { h.close(); }
    // The desktop layout is as it was: never tucked, and a chip click fills and focuses the action box.
    const d = await reopen(copyStore(base));
    try {
      const b = d.$('#suggestions button'); assert(b, 'a chip on desktop'); d.click(b);
      assert.equal(d.$('#action').value, b.textContent); assert.equal(d.document.activeElement, d.$('#action'), 'desktop: the chip focuses the box');
      assert(!d.$('#actionbar.tucked') && noneInert(d)); assert.equal(d.$('#action').rows, 2);
      clean(d);
    } finally { d.close(); }
  },

  // 14. Redraw on a person in the Cast panel draws them again from their kind's pools and their role, as creation does: someone the
  // story has not shown gets new looks, clothes and (unless typed by hand) a new name, saved at once; a hand-edited name stays; the
  // panel says what Redraw will and will not change. The draw is seeded by the adventure, the person and a redraw count, so the
  // same redraw on a fresh load of the same save draws the same person, and a reload keeps what was saved.
  async castRedraw() {
    const base = await game(), d0 = docOf(base);
    const told = [d0.opening && d0.opening.narrative].concat(turnDocs(base).flatMap((d) => d.turns || [d]).map((t) => (t.action || '') + ' ' + (t.narrative || '') + ' ' + JSON.stringify(((t.stateAfter || {}).present) || []))).join(' ') + JSON.stringify(d0.state.present) + JSON.stringify(d0.memory || {});
    const unseen = d0.cast.generated.characters.filter((c) => ![c.first, c.last].some((n) => n && told.includes(n)));
    assert(unseen.length >= 2, 'the test needs two people the story has not shown');
    const [a, b] = unseen;
    const merged = (doc, key) => Object.assign({}, doc.cast.generated.characters.find((c) => c.key === key), (doc.cast.overrides || {})[key] || {});
    const redraw = async (h, key) => { h.click(h.$('#castList [data-key="' + key + '"]')); await h.sleep(20); h.click('#cfRedraw'); assert(await h.idle(8000), 'the redraw did not finish'); await h.sleep(20); };
    const h = await reopen(copyStore(base));
    let first;
    try {
      h.click('#btnCast'); h.click(h.$('#castList [data-key="' + a.key + '"]')); await h.sleep(20);
      assert(h.$('#cfRedraw') && !h.$('#cfRedraw').hidden, 'the Cast panel has a Redraw button');
      assert.match(text(h, '#cfRedrawSays'), /^Redraw draws .+ again from the pools: the name, looks, clothes, way of speaking, .+\. It keeps the role, the kind, the gender/, 'the panel says what Redraw changes: ' + text(h, '#cfRedrawSays'));
      await redraw(h, a.key);
      first = merged(docOf(h.mock.store), a.key);
      assert.notEqual(first.looks, a.looks, 'Redraw draws new looks for someone not yet on the page');
      assert.notEqual(first.dress.taste, a.dress.taste, 'and new clothes');
      assert.notEqual(first.name, a.name, 'and a new name, which nobody typed');
      assert.equal(first.species, a.species, 'the kind is kept'); assert.equal(first.gender, a.gender, 'and the gender');
      assert.equal(h.$('#cfLooks').value, first.looks, 'the form shows the redrawn looks');
      assert.equal(docOf(h.mock.store).cast.redraws[a.key], 1, 'the redraw count is saved with the adventure');
      assert.match(text(h, '#cfNote'), /Redrawn and saved/);
      // A name typed by hand stays through a redraw; the rest is drawn again.
      h.click(h.$('#castList [data-key="' + b.key + '"]')); await h.sleep(20);
      h.type('#cfName', 'Tamsin Oakridge'); h.click('#cfSave'); assert(await h.idle(8000)); await h.sleep(20);
      assert.match(text(h, '#cfRedrawSays'), /keeps .*the name \(edited by hand\)/, text(h, '#cfRedrawSays'));
      await redraw(h, b.key);
      const nb = merged(docOf(h.mock.store), b.key);
      assert.equal(nb.name, 'Tamsin Oakridge', 'a hand-edited name is kept'); assert.equal(h.$('#cfName').value, 'Tamsin Oakridge');
      assert.notEqual(nb.looks, b.looks, 'and the looks are drawn again'); assert.notEqual(nb.dress.taste, b.dress.taste, 'and the clothes');
      clean(h);
    } finally { h.close(); }
    // Saved: a reload shows the redrawn person.
    const r = await reopen(copyStore(h.mock.store));
    try {
      r.click('#btnCast'); r.click(r.$('#castList [data-key="' + a.key + '"]')); await r.sleep(20);
      assert.equal(r.$('#cfName').value, first.name, 'a reload keeps the redrawn name'); assert.equal(r.$('#cfLooks').value, first.looks, 'and the looks');
      clean(r);
    } finally { r.close(); }
    // Seeded: the same redraw of the same save, on another load, draws the same person.
    const s = await reopen(copyStore(base));
    try {
      s.click('#btnCast'); await redraw(s, a.key);
      const again = merged(docOf(s.mock.store), a.key);
      assert.deepEqual([again.name, again.looks, again.dress, again.gen.temperament, again.gen.speechT], [first.name, first.looks, first.dress, first.gen.temperament, first.gen.speechT], 'the redraw is seeded: the same on every load');
      clean(s);
    } finally { s.close(); }
  },

  // 14. Redraw of someone the story has already put on the page keeps the name (already in the story) and draws the rest again, as
  // for anyone: the looks, the clothes, the way of speaking and the traits the story has not told. The panel says so, keeps nothing
  // for having been seen, and the narrator is told before the next turn that the earlier descriptions no longer hold.
  async castRedrawShown() {
    const base = await game(), store = copyStore(base), doc = docOf(store);
    const p = doc.cast.generated.characters.find((c) => c.key === 'gamer'); doc.state.present = doc.state.present.concat([p.name]);
    // A way of speaking no pool holds, so a new draw cannot land on it by chance.
    const odd = 'answers every question with another question'; p.gen.speech = odd; p.gen.speechT = odd;
    const h = await reopen(store);
    try {
      h.click('#btnCast'); h.click(h.$('#castList [data-key="gamer"]')); await h.sleep(20);
      assert(h.$('#cfRedraw') && h.$('#cfRedrawSays'), 'the Cast panel has a Redraw button and says what it changes');
      const says = text(h, '#cfRedrawSays');
      assert.match(says, /pools: looks, clothes, way of speaking, .*It keeps .*the name \(already in the story\)/, says);
      assert.doesNotMatch(says, /pools: the name/, 'nor does it promise a new name');
      assert.doesNotMatch(says, /already seen in a scene/, 'nothing is kept for having been seen');
      assert.match(says, /the narrator is told the body was drawn again/, says);
      assert.equal(h.$('#cfSpeech').value, odd, 'the form shows the way of speaking before the redraw');
      h.click('#cfRedraw'); assert(await h.idle(8000)); await h.sleep(20);
      const saved = docOf(h.mock.store), o = Object.assign({}, p, saved.cast.overrides.gamer);
      assert.equal(o.name, p.name, 'a person already on the page keeps the name'); assert.equal(h.$('#cfName').value, p.name);
      assert.notEqual(o.looks, p.looks, 'the looks are drawn again'); assert.equal(h.$('#cfLooks').value, o.looks, 'and the form shows them');
      assert.notEqual(o.dress.taste, p.dress.taste, 'and the clothes');
      assert.notEqual(o.gen.speechT, odd, 'and the way of speaking'); assert.notEqual(h.$('#cfSpeech').value, odd);
      assert.notEqual(o.gen.temperament, p.gen.temperament, 'the traits the story has not told are drawn again');
      assert(o.sheet.includes(o.gen.temperament.slice(1)) && !o.sheet.includes(p.gen.temperament.slice(1)), 'and the full sheet tells the new temperament: ' + o.sheet);
      assert((saved.pendingNotes || []).some((n) => n.startsWith('Cast edit: ' + p.name + ' was drawn again')), 'the narrator is told before the next turn: ' + JSON.stringify(saved.pendingNotes));
      assert.match(text(h, '#cfNote'), /^Redrawn and saved: looks, clothes, way of speaking, .*The narrator is told/, text(h, '#cfNote'));
      clean(h);
    } finally { h.close(); }
  },

  // Redraw on the roommate before the first turn draws her body again (looks, clothes, way of speaking) although the opening has
  // named her: the name stays, the note says what was drawn, and the first turn's prompt carries the new look, not the old one,
  // with a note telling the narrator that the earlier description no longer holds.
  async castRedrawRoommateTurnZero() {
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000), 'boot did not settle');
      h.type('#cRmSpecies', 'cow'); h.type('#cRmName', 'Daisy Holm');
      h.click('#cBegin'); assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
      const rm = docOf(h.mock.store).roommate;
      h.click('#btnCast'); await h.sleep(20); h.click(h.$('#castList [data-key="roommate"]')); await h.sleep(20);
      assert.match(text(h, '#cfRedrawSays'), /pools: looks, clothes, way of speaking/, text(h, '#cfRedrawSays'));
      h.click('#cfRedraw'); assert(await h.idle(8000)); await h.sleep(20);
      const o = Object.assign({}, rm, docOf(h.mock.store).cast.overrides.roommate);
      assert.equal(o.name, 'Daisy Holm', 'the name the opening used is kept'); assert.equal(h.$('#cfName').value, 'Daisy Holm');
      assert.notEqual(o.looks, rm.looks, 'the looks are drawn again'); assert.equal(h.$('#cfLooks').value, o.looks, 'and the form shows them');
      assert.notEqual(o.dress.taste, rm.dress.taste, 'and the clothes');
      assert.equal(o.species, rm.species, 'the kind is kept');
      assert.match(text(h, '#cfNote'), /^Redrawn and saved: looks, clothes, way of speaking, .*The narrator is told/, text(h, '#cfNote'));
      h.click('[data-close="dlgCast"]');
      assert(await h.turn('I say hello to Daisy.'));
      const p = promptOf(h.mock.sampleCalls.filter((c) => /^turn/.test(c.label)).at(-1));
      assert(p.includes(o.looks.replace(/\.$/, '')), 'the first turn carries the new look');
      assert(!p.includes(rm.looks.replace(/\.$/, '')), 'and not the old one');
      assert(p.includes('Cast edit: Daisy Holm was drawn again'), 'and tells the narrator the earlier description no longer holds');
      clean(h);
    } finally { h.close(); }
  },

  // 15. Fill in the blanks on a person added in the Cast panel: with Claude, one invention call on the invention tier fills every blank
  // field and keeps what was typed word for word; the look is composed by the engine from the kind's lines, never the model's (the
  // model's anatomy is not what lands), and Save keeps the result. Without Claude the pools fill the blanks. On a phone both buttons
  // are in a wrapping row with a tap-sized height.
  async castFillBlanks() {
    const base = await game();
    const h = await reopen(copyStore(base));
    try {
      let release = null;
      h.mock.sampleHandler = (input, op, call) => {
        const out = h.mock.defaultHandler(input, op, call); if (call.label !== 'cast invention') return out;
        const r = JSON.parse(out); r.people.forEach((x) => { x.first = 'Odessaly'; x.last = 'Brackwater'; x.looks = 'three breasts and a second tail'; x.detail = 'a second pair of arms folded at the waist'; x.quirk = 'flicks the second tail when amused'; });
        return new Promise((res) => { release = () => res(JSON.stringify(r)); });
      };
      h.click('#btnCast'); h.click('#castAdd'); assert(await h.idle(8000)); await h.sleep(20);
      assert(h.$('#cfFill') && !h.$('#cfFill').hidden, 'an added person has a Fill in the blanks button');
      h.type('#cfSpecies', 'Human');
      h.click('#cfFill'); await h.until(() => release, 'the invention call');
      assert.equal(h.$('#cfFill').textContent, 'Filling in…', 'the button shows it is running'); assert(h.$('#cfFill').disabled);
      assert.match(text(h, '#cfNote'), /Filling in the blanks: asking Claude/, text(h, '#cfNote'));
      release(); await h.until(() => /Filled in/.test(text(h, '#cfNote')), 'the fill');
      const call = h.mock.sampleCalls.filter((c) => c.label === 'cast invention').pop(), prompt = promptOf(call);
      assert.equal(call.opts.modelTier, 'quick', 'the call is on the invention tier');
      assert.match(prompt, /Fields: first, last, course, temperament, quirk, want, private\./, 'the model is asked for the name and the traits');
      const looks = h.$('#cfLooks').value;
      assert(looks && /^About /.test(looks), 'the look is composed by the engine: ' + looks);
      assert(prompt.includes('Looks (the world\'s own, fixed): "' + looks.replace(/\.$/, '') + '"'), 'and the model is told the engine\'s look, to keep');
      assert.doesNotMatch(looks + h.$('#cfSheet').value + h.$('#cfBrief').value, /three breasts|second tail|second pair of arms/, 'the model\'s anatomy never lands');
      assert.equal(h.$('#cfSpecies').value, 'Human', 'the kind typed is kept word for word');
      assert.equal(h.$('#cfName').value, 'Odessaly Brackwater', 'the name is the invented one');
      assert.match(h.$('#cfSheet').value, /temperament text for npc1/i, 'the traits are the invented ones');
      assert.doesNotMatch(h.$('#cfSheet').value, /second tail/, 'a habit naming a part the kind lacks is not kept');
      for (const id of ['#cfAliases', '#cfBrief', '#cfSpeech', '#cfAim', '#cfWhere']) assert(h.$(id).value.trim(), id + ' is filled');
      assert.notEqual(h.$('#cfBrief').value, 'A new face on campus.'); assert.notEqual(h.$('#cfWhere').value, 'around campus');
      const shown = { name: h.$('#cfName').value, looks, speech: h.$('#cfSpeech').value };
      h.click('#cfSave'); assert(await h.idle(8000)); await h.sleep(20);
      const added = docOf(h.mock.store).cast.added.find((c) => c.key === 'npc1');
      assert.equal(added.name, shown.name); assert.equal(added.looks, shown.looks); assert.equal(added.race, 'Human'); assert.equal(added.species, 'human');
      assert(added.dress && added.dress.taste && added.gen && added.gen.temperament === 'temperament text for npc1', 'Save keeps the clothes and the traits: ' + JSON.stringify(added.gen));
      clean(h);
    } finally { h.close(); }
    // Claude unavailable: the pools fill the blanks, and a typed field is kept word for word.
    const n = await boot({ setup(w, m) { m.store = copyStore(base); m.disable.sample = true; } });
    try {
      assert(await n.settle(150, 8000)); await n.idle(10000);
      n.click('#btnCast'); n.click('#castAdd'); assert(await n.idle(8000)); await n.sleep(20);
      n.type('#cfSpecies', 'Human'); n.type('#cfWhere', 'the boathouse, mending oars');
      n.click('#cfFill'); await n.until(() => /Filled in/.test(text(n, '#cfNote')), 'the fill');
      assert.match(text(n, '#cfNote'), /from the pools/, text(n, '#cfNote'));
      assert.equal(n.mock.sampleCalls.length, 0, 'no model call without Claude');
      assert.equal(n.$('#cfWhere').value, 'the boathouse, mending oars', 'a typed field is never overwritten');
      assert(n.$('#cfName').value && n.$('#cfName').value !== 'New character' && /^About /.test(n.$('#cfLooks').value) && n.$('#cfSheet').value && n.$('#cfSpeech').value, 'the pools filled the rest');
      clean(n);
    } finally { n.close(); }
    // A phone: both buttons are there, in a wrapping row, with a tap-sized height.
    const ph = await reopen(copyStore(base), { mobile: true });
    try {
      ph.click('#btnCast'); await ph.sleep(20); ph.click(ph.$('#castList [data-key="gamer"]')); await ph.sleep(20);
      const row = ph.$('#cfRedraw').closest('.row'); assert(row && row.contains(ph.$('#cfFill')), 'the two buttons share a row');
      assert.equal(ph.window.getComputedStyle(row).flexWrap, 'wrap', 'which wraps on a narrow screen');
      const media = []; for (const sh of ph.document.styleSheets) for (const r of sh.cssRules) if (r.media && /max-width: 700px/.test(r.media.mediaText)) media.push(r.cssText);
      assert(media.some((t) => /\.castdraw button\s*\{[^}]*min-height: 40px/.test(t)), 'the phone rules give them a tap-sized height');
      ph.click('#castAdd'); assert(await ph.idle(8000)); await ph.sleep(20); assert(!ph.$('#cfFill').hidden && !ph.$('#cfRedraw').hidden, 'both show for an added person');
      clean(ph);
    } finally { ph.close(); }
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
