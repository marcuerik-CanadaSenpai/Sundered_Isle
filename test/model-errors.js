'use strict';
// The model call and its failures. Every error the runtime documents (and one it does not) reaches the player as a plain sentence that says
// the story did not change, never as a code; a failed turn keeps what had streamed and offers Try again with the same roll; a page sent to
// the background mid-turn is told so; declined access is not "ready" and is not retried by reconnecting; the slow-start warning belongs to a
// call that has not begun; the cast invention's limit counts from its first words; Debug's Ping stops its call.
// Run one scenario by name: node model-errors.js interruptedTurn
const assert = require('node:assert/strict');
const { boot } = require('./boot');

let unhandled = 0; process.on('unhandledRejection', () => { unhandled += 1; });
const statusSpan = (h) => (h.$('#status').hidden || !h.$('#status').querySelector('span') ? '' : h.$('#status').querySelector('span').textContent);
const statusButtons = (h) => [...h.document.querySelectorAll('#status button')].map((b) => b.textContent);
const pressStatus = (h, label) => h.click([...h.document.querySelectorAll('#status button')].find((b) => b.textContent === label));
const turnCalls = (h) => h.mock.sampleCalls.filter((c) => /^turn/.test(c.label));
const promptOf = (c) => (Array.isArray(c.input) ? c.input.map((m) => m.content).join('\n') : String(c.input));
const d6Of = (c) => Number(/d6 rolled (\d)/.exec(promptOf(c))[1]);
const stored = (h) => [...h.mock.store.entries()].filter(([p]) => /^adventures\/[^/]+$/.test(p)).map(([, v]) => v.data)[0];
const clean = (h) => assert(!h.errors.length && !h.mock.violations.length, 'page errors or contract violations: ' + JSON.stringify(h.errors.concat(h.mock.violations)).slice(0, 400));
const fixedRoll = (h, n) => { h.window.Math.random = () => (n - 1) / 6 + 0.01; };   // the d6 the next turn rolls

async function begin(o) {
  const h = await boot(o || {});
  assert(await h.settle(150, 6000), 'boot did not settle');
  h.click('#cBegin'); assert(await h.idle(20000), 'creating the adventure did not finish'); await h.settle(150, 6000);
  return h;
}
const snap = (h) => JSON.stringify({ clock: h.$('#clock').textContent, turns: h.document.querySelectorAll('#feed .turn:not(.draft)').length, count: stored(h).turnCount, writes: h.mock.dbLog.filter((d) => d.op === 'set' && !/failures/.test(d.path)).length });
const PARTIAL = '{"evaluation":{"stat":"none"},"narrative":"Her breath catches as you';

const S = {
  // 1. Every code the runtime documents, and one it does not, is put in plain words that say the story is unchanged; a code the page does
  // not know is a service failure (asked once more, then Try again), and the codes that cannot be fixed by asking again (a refusal, a request
  // the runtime calls malformed) offer no Try again. A fault in the page itself never shows its developer message.
  async plainWords() {
    const h = await begin();
    try {
      const cases = [
        ['upstream_error', true, 2], ['some_new_code', true, 2], ['transform_error', false, 1], ['queue_overflow', true, 1], ['invalid_request', false, 1],
        ['page_error', true, 1], ['error', true, 1],
        ['rate_limited', true, 1], ['session_expired', true, 1], ['empty_completion', false, 1], ['refused', false, 1],
        ['not_granted', false, 1], ['sampling_disabled', false, 1], ['capability_removed', false, 1],
      ];
      for (const [code, retry, calls] of cases) {
        // The permission refusals switch Claude off for the page load, so each of them gets a fresh page.
        const g = /granted|disabled|capability/.test(code) ? await begin() : h;
        try {
          const before = snap(g); let n = 0;
          g.mock.sampleHandler = (input, o, call) => { if (/^turn/.test(call.label)) { n++; throw { code, message: 'developer text for ' + code }; } return g.mock.defaultHandler(input, o, call); };
          g.$('#action').value = 'I kiss her again.'; g.click('#send'); assert(await g.idle(15000), code + ': the turn did not end');
          const st = statusSpan(g);
          assert(st && !/^Error: |developer text|_[a-z]+/.test(st), code + ' reaches the player as "' + st + '"');
          assert(/Nothing in your story changed/.test(st), code + ': the status says the story is unchanged: ' + st);
          assert.equal(n, calls, code + ': calls made');
          assert.equal(statusButtons(g).includes('Try again'), retry, code + ': Try again offered = ' + retry + ' (' + JSON.stringify(statusButtons(g)) + ')');
          assert.equal(snap(g), before, code + ': nothing moved');
          assert.equal(g.$('#action').value, 'I kiss her again.', code + ': the action is kept');
          clean(g);
        } finally { if (g !== h) g.close(); }
      }
    } finally { h.close(); }
  },

  // 2. A turn that fails after some of it had streamed keeps that text on screen, marked as not saved, and offers Try again; Try again asks
  // the same turn again (the same d6, not a fresh roll), commits it once, and the half-turn goes.
  async interruptedTurn() {
    const h = await begin();
    try {
      fixedRoll(h, 5); const before = snap(h);
      h.mock.sampleHandler = (input, o, call) => { if (/^turn/.test(call.label)) throw { code: 'upstream_error', message: 'connection reset', text: PARTIAL }; return h.mock.defaultHandler(input, o, call); };
      h.$('#action').value = 'I kiss her again.'; h.click('#send'); assert(await h.idle(15000));
      const d = h.$('#draft'); assert(d && d.classList.contains('interrupted'), 'the half-written turn stays on screen');
      assert.match(d.textContent, /Her breath catches as you/); assert.match(d.textContent, /not saved/);
      assert(statusButtons(h).includes('Try again'), 'Try again is offered: ' + JSON.stringify(statusButtons(h)));
      assert.equal(snap(h), before, 'nothing moved');
      fixedRoll(h, 2); h.mock.sampleHandler = null;
      const calls0 = turnCalls(h).length;
      pressStatus(h, 'Try again'); await h.sleep(30); assert(await h.idle(15000));
      const sent = turnCalls(h).slice(calls0); assert.equal(sent.length, 1, 'one call');
      assert.equal(d6Of(sent[0]), 5, 'the same d6 as the first try');
      assert.equal(stored(h).turnCount, JSON.parse(before).count + 1, 'one turn committed');
      assert(!h.$('#draft'), 'the half-turn is gone'); assert.equal(statusSpan(h), '');
      clean(h);
    } finally { h.close(); }
  },

  // 3. A Regenerate that fails also offers Try again, which asks the same turn again with the old d6; the old turn stands in between.
  async regenerateRetry() {
    const h = await begin();
    try {
      fixedRoll(h, 3); assert(await h.turn('I look around the room.'));
      const oldD6 = d6Of(turnCalls(h).at(-1)); const n0 = stored(h).turnCount;
      h.mock.sampleHandler = (input, o, call) => { if (/^turn/.test(call.label)) throw { code: 'rate_limited', message: 'slow down' }; return h.mock.defaultHandler(input, o, call); };
      h.click('#regen'); await h.sleep(30); assert(await h.idle(15000));
      assert(statusButtons(h).includes('Try again'), JSON.stringify(statusButtons(h)));
      assert.equal(h.document.querySelectorAll('#feed .turn:not(.draft)').length, 2, 'the old turn is back (opening + 1)');
      h.mock.sampleHandler = null; fixedRoll(h, 6);
      const c0 = turnCalls(h).length;
      pressStatus(h, 'Try again'); await h.sleep(30); assert(await h.idle(15000));
      assert.equal(turnCalls(h).length, c0 + 1); assert.equal(d6Of(turnCalls(h).at(-1)), oldD6, 'the old turn\'s d6');
      assert.equal(stored(h).turnCount, n0, 'the turn was replaced, not added');
      clean(h);
    } finally { h.close(); }
  },

  // 4. A page sent to the background while a turn is being written says so when the connection drops, and the screen is asked to stay on.
  async backgrounded() {
    let asked = 0, released = 0;
    const h = await begin({ setup(w) { Object.defineProperty(w.navigator, 'wakeLock', { value: { request: async () => { asked++; return { release: async () => { released++; } }; } } }); } });
    try {
      h.mock.sampleLatency = 150;
      h.mock.sampleHandler = (input, o, call) => { if (/^turn/.test(call.label)) throw { code: 'upstream_error', message: 'gone', text: PARTIAL }; return h.mock.defaultHandler(input, o, call); };
      h.$('#action').value = 'I kiss her again.'; h.click('#send'); await h.sleep(40);
      Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' }); h.document.dispatchEvent(new h.window.Event('visibilitychange'));
      assert(await h.idle(15000));
      assert.match(statusSpan(h), /in the background/); assert.match(statusSpan(h), /keep this page open/); assert(statusButtons(h).includes('Try again'));
      assert.equal(asked, 1, 'the screen was asked to stay on'); assert.equal(released, 1, 'and let go when the turn ended');
      assert.match(h.$('#draft').textContent, /Her breath catches/, 'the partial text stays');
      clean(h);
    } finally { h.close(); }
  },

  // 5. Access declined: the page never reads "Claude ready", turns stay off, and the way out offered is the Permissions panel when the view
  // has one (allowing it there connects again), otherwise a reload; never a reconnect that cannot work.
  async declinedAccess() {
    let state = 'denied', opened = 0;
    const h = await boot({ setup(w, m) { m.permissions = { state: async () => state, manage: async () => { opened++; state = 'granted'; } }; } });
    try {
      assert(await h.settle(150, 6000));
      assert.notEqual(h.$('#connText').textContent, 'Claude ready', 'the indicator: ' + h.$('#connText').textContent);
      assert.match(statusSpan(h), /switched off/); assert.deepEqual(statusButtons(h), ['Open permissions']);
      assert(h.$('#send').disabled, 'turns are off');
      pressStatus(h, 'Open permissions'); await h.settle(100, 4000);
      assert.equal(opened, 1); assert.equal(h.$('#connText').textContent, 'Claude ready'); assert(!h.$('#send').disabled, 'turns are back');
      clean(h);
    } finally { h.close(); }
    // Declined mid-play in a view that offers no permissions panel (the published page may not declare it): the status names the game's
    // Permissions menu and offers Reload, never a panel button that can only fail, nor Retry connection; the turn buttons stay off.
    const g = await begin();
    try {
      g.mock.sampleHandler = () => { throw { code: 'not_granted', message: 'declined' }; };
      await g.turn('I look around.', { max: 8000 });
      assert.notEqual(g.$('#connText').textContent, 'Claude ready'); assert(g.$('#send').disabled);
      assert.deepEqual(statusButtons(g), ['Reload']); assert.match(statusSpan(g), /switched off.*Permissions menu.*reload this page/, statusSpan(g));
      assert.notEqual(g.$('#connText').textContent, 'Claude ready'); assert(g.$('#send').disabled);
      clean(g);
    } finally { g.close(); }
    // A permission state that reads denied at load but no panel to open: switched off at once, and the way back is Reload.
    const k = await boot({ setup(w, m) { m.permissions = { state: async () => 'denied' }; } });
    try {
      assert(await k.settle(150, 6000));
      assert.notEqual(k.$('#connText').textContent, 'Claude ready'); assert(k.$('#send').disabled);
      assert.deepEqual(statusButtons(k), ['Reload']); assert.match(statusSpan(k), /reload this page/, statusSpan(k));
      clean(k);
    } finally { k.close(); }
  },

  // 6. The slow-start warning is for a call that has not begun writing: a long scene still streaming at 150 s is not told it has not started,
  // and a timer that steps past 150 still warns a call with no first word.
  async slowStartWarning() {
    const h = await begin();
    try {
      const perf = h.window.performance;
      const real = perf.now.bind(perf); let off = 0;   // jump the page's clock forward once the turn has started
      Object.defineProperty(perf, 'now', { configurable: true, value: () => real() + off });
      // Still streaming: the first words arrived at once, the rest trickles; the timer's first tick lands on exactly 150 s.
      h.mock.chunkLatency = 1300;
      h.$('#action').value = 'I look around.'; h.click('#send'); await h.sleep(50); off = 149000; await h.sleep(1700);
      assert(!/has not started|Still waiting/.test(statusSpan(h)), 'streaming text is not "not started": ' + statusSpan(h));
      assert(await h.idle(15000)); off = 0;
      // No first word yet, and the timer ticks past 150 s without ever showing 150: it warns.
      h.mock.chunkLatency = 1; h.mock.sampleLatency = 2500;
      h.$('#action').value = 'I look around again.'; h.click('#send'); await h.sleep(50); off = 150000; await h.sleep(1700);
      assert.match(statusSpan(h), /has not started writing after 15\d seconds/, statusSpan(h));
      assert(await h.idle(15000));
    } finally { h.close(); }
  },

  // 7. The cast invention's limit counts from its first words: a runtime that takes a while before the first text (the consent dialog, a slow
  // start) does not lose the batch.
  async inventionClock() {
    const h = await boot({ setup(w, m) {
      const st = w.setTimeout; w.setTimeout = (f, ms, ...a) => st(f, ms === 60000 ? 300 : ms, ...a);
      m.sampleHandler = async (input, o, call) => { if (call.label === 'cast invention') await new Promise((r) => st(r, 1200)); return m.defaultHandler(input, o, call); };
    } });
    try {
      assert(await h.settle(150, 6000)); h.click('#cBegin'); await h.sleep(400);
      assert.match(h.$('#cNote').textContent, /unfinished \d+ s after its first words arrive/, 'the creation note tells the same clock: ' + h.$('#cNote').textContent);
      assert(await h.idle(30000)); await h.settle(150, 6000);
      const notes = ((stored(h).cast.generated || {}).invention || {}).notes || [];
      assert(notes.length, 'the invention left notes');
      assert(!notes.some((n) => /timed out|no complete reply|no reply in/.test(n)), 'no batch was given up: ' + JSON.stringify(notes));
      assert(notes.some((n) => /invented in/.test(n)));
      clean(h);
    } finally { h.close(); }
  },

  // 8. Debug's Ping stops its call when it gives up, so it stops using the viewer's Claude account.
  async pingStops() {
    const h = await begin({ setup(w) { const st = w.setTimeout; w.setTimeout = (f, ms, ...a) => st(f, ms === 60000 ? 150 : ms, ...a); } });
    try {
      h.mock.sampleHandler = (input, o, call) => (call.label === 'ping' ? new Promise(() => {}) : h.mock.defaultHandler(input, o, call));
      h.click('#dbgPing'); await h.sleep(600);
      const ping = h.mock.sampleCalls.find((c) => c.label === 'ping'); assert(ping, 'the ping was sent');
      assert.equal(ping.outcome, 'cancelled', 'the call was stopped, not left running: ' + ping.outcome);
      assert(!h.$('#dbgPing').disabled, 'Ping is usable again');
    } finally { h.close(); }
  },

  // 8a. The roommate introduction's failures read as what happened: a reply the page could not use is not "something broke", and a refusal
  // that is not a dropped connection is not called one.
  async introFailures() {
    const words = (n) => Array.from({ length: n }, () => 'The room smells of cedar and ink.').join(' ');
    const cases = [
      ['short', () => 'Hello there.', /Claude's reply could not be used/],
      ['unnamed', () => words(15), /Claude's reply could not be used/],
      ['upstream_error', () => { throw { code: 'upstream_error', message: 'reset' }; }, /connection to Claude dropped/],
      ['some_new_code', () => { throw { code: 'some_new_code', message: 'new' }; }, /connection to Claude dropped/],
      ['prompt_too_large', () => { throw { code: 'prompt_too_large', message: 'big' }; }, /Claude could not write it this time/],
    ];
    for (const [name, reply, want] of cases) {
      const h = await begin({ setup(w, m) { m.sampleHandler = (input, o, call) => (call.label === 'roommate introduction' ? reply() : m.defaultHandler(input, o, call)); } });
      try {
        assert(h.mock.sampleCalls.some((c) => c.label === 'roommate introduction'), name + ': the introduction was asked for');
        assert.match(statusSpan(h), /roommate's introduction/, name + ': ' + statusSpan(h));
        assert.match(statusSpan(h), want, name + ': ' + statusSpan(h));
        assert(!/something broke|too short|not named|_[a-z]+/.test(statusSpan(h)), name + ': ' + statusSpan(h));
        clean(h);
      } finally { h.close(); }
    }
  },

  // 8b. Every status line shown while the roommate and a turn are written is in plain words: no tier, no word counts, no "folding" or
  // "fitting", no "service"; the asking-once-more lines say what Claude did.
  async statusWords() {
    const seen = [];
    let n = 0, mode = null;
    const h = await begin({ setup(w, m) {
      w.document.addEventListener('DOMContentLoaded', () => { const el = w.document.querySelector('#status'); new w.MutationObserver(() => { const t = el.textContent; if (t && seen.at(-1) !== t) seen.push(t); }).observe(el, { childList: true, subtree: true, characterData: true }); });
      m.sampleHandler = (input, o, call) => {
        if (!/^turn/.test(call.label) || !mode) return m.defaultHandler(input, o, call);
        n++;
        if (mode === 'upstream' && n === 1) throw { code: 'upstream_error', message: 'reset' };
        if (mode === 'junk' && n === 1) return 'not json at all';
        if (mode === 'cut' && n === 1) return { text: '{"narrative":"You', truncated: true };
        const r = JSON.parse(m.defaultHandler(input, o, call)); if (mode === 'long') r.narrative = Array.from({ length: 1500 }, (_, i) => 'word' + (i % 7)).join(' '); return JSON.stringify(r);
      };
    } });
    try {
      for (const md of ['long', 'upstream', 'junk', 'cut']) { mode = md; n = 0; assert(await h.turn('I look around the room.', { max: 30000 }), md + ': the turn ran'); }
      const want = [/^Claude is writing your roommate…$/, /^Claude is trimming the scene to length…$/, /^Updating the story so far…$/, /^Claude did not answer; asking once more…$/,
        /^Claude's reply could not be read; asking once more…$/, /^Claude's reply was cut off; asking once more for a shorter one…$/];
      for (const re of want) assert(seen.some((t) => re.test(t)), 'shown: ' + re + ' in ' + JSON.stringify(seen));
      const bad = seen.filter((t) => /\btier\b|\d+ words|fitting|folding|service|not usable/i.test(t));
      assert.deepEqual(bad, [], 'engine words in the status line');
      clean(h);
    } finally { h.close(); }
  },

  // 9a. A cast invention reply that is the bare list of people (no {"people": …} around it) fills every slot, not just the first.
  async bareInventionList() {
    const h = await boot({ setup(w, m) {
      m.sampleHandler = (input, o, call) => { const out = m.defaultHandler(input, o, call); return call.label === 'cast invention' ? '```json\n' + JSON.stringify(JSON.parse(out).people) + '\n```' : out; };
    } });
    try {
      assert(await h.settle(150, 6000)); h.click('#cBegin'); assert(await h.idle(30000)); await h.settle(150, 6000);
      const notes = ((stored(h).cast.generated || {}).invention || {}).notes || [];
      assert(notes.length && notes.every((n) => /: (\d) of \1 invented/.test(n) || !/invented in/.test(n)), 'every slot of every batch filled: ' + JSON.stringify(notes));
      assert(notes.some((n) => /invented in/.test(n)));
      clean(h);
    } finally { h.close(); }
  },

  // 9. An overlong romance or change scene is cut to length by the writer that wrote it, not by the bookkeeping tier (quick by default);
  // an ordinary turn still uses the bookkeeping tier.
  async fitByTheWriter() {
    const h = await begin();
    try {
      const long = (n) => Array.from({ length: n }, (_, i) => 'word' + (i % 7)).join(' ');
      h.mock.sampleHandler = (input, o, call) => {
        if (!/^turn/.test(call.label)) return h.mock.defaultHandler(input, o, call);
        const r = JSON.parse(h.mock.defaultHandler(input, o, call)); r.narrative = long(1500); return JSON.stringify(r);
      };
      assert.equal(stored(h).settings.utilTier, 'quick');
      assert(await h.turn('I kiss Daisy and pull her close.', { max: 30000 }));
      let fit = h.mock.sampleCalls.filter((c) => c.label === 'length fit'); assert.equal(fit.length, 1, 'the scene was fitted');
      assert.equal(fit[0].opts.modelTier, turnCalls(h).at(-1).opts.modelTier, 'the fit is by the tier that wrote the scene');
      // The fit's own time is kept on the turn and shown in Debug, and Settings says a rich scene's fit takes longer.
      const turns = [...h.mock.store.entries()].filter(([p]) => /\/turns\//.test(p)).flatMap(([, v]) => v.data.turns || []);
      const last = turns.reduce((a, t) => (!a || t.n > a.n ? t : a), null);
      assert(last && Number.isFinite(last.timing.fit) && last.timing.fit >= 0, 'the fit is timed: ' + JSON.stringify(last && last.timing));
      h.click('#btnDebug'); assert.match(h.$('#dbgMeta').textContent, /then length fit \d+\.\d s/, h.$('#dbgMeta').textContent); h.click('[data-close="dlgDebug"]');
      assert.match(h.$('#setAutoFitNote').textContent, /Romance and body-change scenes are trimmed by the same writer, which takes longer/);
      assert(await h.turn('I go to bed.', { max: 30000 }));
      fit = h.mock.sampleCalls.filter((c) => c.label === 'length fit');
      assert.equal(fit.length, 2, 'the ordinary turn was fitted too');
      assert.equal(fit.at(-1).opts.modelTier, 'quick', 'an ordinary turn is fitted on the bookkeeping tier');
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
    } catch (e) { failed += 1; console.log('FAIL', n, '-', String((e && e.message) || e).split('\n')[0].slice(0, 300)); if (process.env.AUDIT_STACK) console.log(e && e.stack); }
  }
  if (failed) { console.error('MODEL ERRORS FAILED: ' + failed + ' of ' + names.length + ' scenarios'); process.exit(1); }
  console.log('model errors passed: ' + names.length + ' scenarios');
  process.exit(0);
})();
