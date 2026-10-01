'use strict';
// prompt-guard-challenge: routes the tester's prompt-guard.js did not cover, same inputs on the published (src) and fixed (main) build.
//  D: a player-written recap in the Summary box (no Override facts, no forced cast, no forced changes): ladder of summary sizes.
//  A: memory-fold bypass: a huge summary + 61 facts, then Override 'Apply as turn' (no turn prompt is built, so the turn guard never runs);
//     the fold call is sent straight to sample(). Then a normal turn with the same state.
//  B: transformation-heavy long game: every turn forces the next change on every species ladder and the model reports 180 min and one
//     ~150 B fact per turn (folding keeps facts <= 60). Default cast, no Override facts. At the first refusal: Regenerate with changes.
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const B = (s) => Buffer.byteLength(s, 'utf8');
const BUILDS = {
  src: { htmlPath: (process.env.WL_ROOT || (__dirname + '/..')) + '/src/index.html', worldsDir: (process.env.WL_ROOT || (__dirname + '/..')) + '/src/worlds' },
  main: { htmlPath: (process.env.WL_ROOT || (__dirname + '/..')) + '/main/index.html', worldsDir: (process.env.WL_ROOT || (__dirname + '/..')) + '/main/worlds' },
};
const CAP = 65536;
const DIRECTOR = 'Keep the roommate in the scene. MARKER-DIRECTOR-7731';
const ACTION = 'Walk to the Creamery with the roommate and ask about the Restoration Spa MARKER-ACTION-5512';
const WORDS = ['the', 'porter', 'kept', 'a', 'ledger', 'of', 'every', 'key', 'and', 'Moss', 'returned', 'it', 'on', 'Day', 'three', 'after', 'the', 'pack', 'ran', 'past', 'Kettle', 'Hall', 'while', 'the', 'harpies', 'sang'];
const words = (n, seed) => Array.from({ length: n }, (_, i) => WORDS[(i * 7 + seed) % WORDS.length]).join(' ');
const textOfBytes = (n, seed) => { let s = 'Recap. '; let i = 0; while (B(s) < n) s += WORDS[(i++ * 7 + seed) % WORDS.length] + (i % 17 === 0 ? '. ' : ' '); return s.slice(0, n); };
const isTurnPrompt = (c) => typeof c.input === 'string' && c.input.includes('<output_format>');
const isFold = (c) => typeof c.input === 'string' && /You maintain the long-term memory/.test(c.input);
function sections(p) { const out = {}; const re = /^<(\w+)(?: [^>]*)?>\n([\s\S]*?)\n<\/\1>/gm; let m; while ((m = re.exec(p))) out[m[1]] = (out[m[1]] || 0) + B(m[0]); return out; }
function advDoc(h) { for (const [k, v] of h.mock.store) if (/^adventures\/[^/]+$/.test(k)) return v.data; return null; }

let factSeq = 0;
function handlerFor(mock, o) {
  return (input, opts, call) => {
    const p = typeof input === 'string' ? input : input.map((m) => m.content).join('\n');
    if (/You maintain the long-term memory/.test(p)) return 'Fold summary. ' + words(280, 5) + '.';
    const r = mock.defaultHandler(input, opts, call);
    if (!o || !isTurnPrompt({ input: p })) return r;
    const d = JSON.parse(r);
    if (o.tfGame) { d.time_advance_minutes = 180; factSeq++; d.facts = ['Fact ' + factSeq + ': ' + words(26, factSeq) + ' and that stays true.']; }
    return JSON.stringify(d);
  };
}
async function newSundered(name, o) {
  const h = await boot(Object.assign({ setup(w, m) { m.sampleHandler = handlerFor(m, o); } }, BUILDS[name]));
  await h.settle(150, 6000);
  h.click('#cBegin'); await h.idle(30000);
  return h;
}
async function setSummary(h, text) { h.$('#summary').value = text; h.$('#summary').dispatchEvent(new h.window.Event('input', { bubbles: true })); h.click('#saveSummary'); await h.idle(); }
async function addFacts(h, n, len) { h.click('#btnOverride'); for (let i = 0; i < n; i++) { h.type('#ovrFact', ('Short fact ' + i + ' ' + words(20, i)).slice(0, len)); h.click('#ovrFactAdd'); await h.idle(); } }
function debugView(h) { h.click('#btnDebug'); const p = h.$('#dbgPrompt').textContent, n = h.$('#dbgNotes').textContent; h.window.document.querySelector('#dlgDebug').removeAttribute('open'); return { bytes: B(p), notes: n.replace(/\s+/g, ' ').slice(0, 200), secs: sections(p) }; }
async function attempt(h, action, director) {
  const before = h.mock.sampleCalls.length, vBefore = h.mock.violations.length, tc0 = (advDoc(h) || {}).turnCount || 0;
  await h.turn(action, { director, max: 30000 });
  const calls = h.mock.sampleCalls.slice(before); const tcalls = calls.filter(isTurnPrompt); const t = tcalls[tcalls.length - 1];
  const st = h.$('#status'); const d = debugView(h);
  return {
    sent: tcalls.map((c) => c.bytes + '/' + c.outcome).join(',') || 'none', over: calls.filter((c) => c.bytes > CAP).length,
    viol: h.mock.violations.slice(vBefore).map((v) => v.kind).join(',') || '-', committed: ((advDoc(h) || {}).turnCount || 0) - tc0,
    status: st.hidden ? '' : st.textContent.slice(0, 120), dbgB: d.bytes, notes: d.notes, secs: d.secs,
    tfB: t ? (sections(t.input).transformation || 0) : (d.secs.transformation || 0),
  };
}
const brief = (r) => r ? ((r.sent === 'none' ? 'not sent (' + r.dbgB + 'B)' : 'sent ' + r.sent) + (r.over ? ' OVERCAP' : '') + ', committed ' + r.committed + (r.status ? ', "' + r.status.slice(0, 50) + '"' : '')) : 'n/a';

(async () => {
  const T0 = Date.now(); const res = { src: {}, main: {} };
  for (const name of ['src', 'main']) {
    const R = res[name];
    console.log('==== ' + name + ' ====');
    // ---- D: summary ladder ----
    let h = await newSundered(name);
    const wsel = (advDoc(h) || {}).worldId; console.log('  world:', wsel);
    await h.turn('Look around the room'); await h.turn('Unpack the bag');
    R.D = [];
    for (const sz of [6000, 10000, 14000, 18000]) {
      await setSummary(h, textOfBytes(sz, sz));
      const r = await attempt(h, ACTION, DIRECTOR); r.tag = 'D summary ' + sz + 'B'; R.D.push(r);
      console.log('  ' + r.tag.padEnd(20), brief(r), '| tf=' + r.tfB, '| notes=' + r.notes.slice(0, 150));
      if (!r.committed) console.log('    refused sections:', JSON.stringify(r.secs));
    }
    // ---- A: fold bypass via Override 'Apply as turn' ----
    await setSummary(h, textOfBytes(66000, 3));
    await addFacts(h, 61, 60);
    const factsBefore = ((advDoc(h) || {}).memory || {}).facts;
    const b0 = h.mock.sampleCalls.length, v0 = h.mock.violations.length, tc0 = (advDoc(h) || {}).turnCount;
    h.click('#btnOverride'); await h.sleep(5);
    h.type('#ovrAction', 'Wait by the window');
    h.$('#ovrReply').value = JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: 'You wait by the window and the evening goes on around you. ' + words(60, 2), suggested_actions: ['Wait', 'Leave', 'Talk'], secret_info: '', state_updates: [], time_advance_minutes: 10, events: ['Day 1 19:00 Waited by the window.'], beats: ['Waited.'], facts: [], exposures: [] });
    h.click('#ovrReplyApply'); await h.idle(20000);
    const calls = h.mock.sampleCalls.slice(b0);
    const fold = calls.filter(isFold);
    const doc = advDoc(h) || {};
    R.A = { fold: fold.map((c) => c.bytes + '/' + c.outcome).join(',') || 'none', over: calls.filter((c) => c.bytes > CAP).length, viol: h.mock.violations.slice(v0).map((v) => v.kind).join(',') || '-',
      note: h.$('#ovrReplyNote').textContent, committed: (doc.turnCount || 0) - (tc0 || 0), factsAfter: (doc.memory && doc.memory.facts || []).length, factsBefore: (factsBefore || []).length,
      sumB: B((doc.memory && doc.memory.summary) || ''), dbgNotes: debugView(h).notes };
    console.log('  A fold via Override  fold call=' + R.A.fold, '| >cap=' + R.A.over, '| viol=' + R.A.viol, '| applied=' + R.A.committed, '| note="' + R.A.note + '"', '| facts ' + R.A.factsBefore + '->' + R.A.factsAfter, '| summaryB=' + R.A.sumB, '| debug notes=' + R.A.dbgNotes);
    R.A2 = await attempt(h, ACTION, DIRECTOR); console.log('  A then normal turn  ', brief(R.A2));
    R.errD = h.errors.length; R.violD = h.mock.violations.map((v) => v.kind + ':' + v.detail.slice(0, 50));
    console.log('  D/A errors:', R.errD, JSON.stringify(h.errors.slice(0, 2).map((e) => e.message.slice(0, 160))), '| violations:', JSON.stringify(R.violD));
    h.close();

    // ---- B: transformation-heavy long game ----
    factSeq = 0;
    h = await newSundered(name, { tfGame: true });
    const species = [...h.document.querySelectorAll('#ovrInfluence [data-manifest]')].map((b) => b.dataset.manifest);
    h.click('#btnOverride'); await h.sleep(5);
    const sp = [...h.document.querySelectorAll('#ovrInfluence [data-manifest]')].map((b) => b.dataset.manifest);
    console.log('  species ladders:', sp.length, sp.join(','));
    R.B = []; let firstFail = null;
    for (let i = 1; i <= 34; i++) {
      for (const k of sp) { h.click('#btnOverride'); await h.sleep(2); const b = h.$('#ovrInfluence [data-manifest="' + k + '"]'); if (b) { h.click(b); await h.idle(); } }
      const r = await attempt(h, 'Go to class, then eat with friends ' + i, ''); r.i = i; R.B.push(r);
      const doc2 = advDoc(h) || {};
      if (i % 3 === 0 || !r.committed) console.log('  B turn ' + String(i).padEnd(3), brief(r), '| tfB=' + r.tfB, '| facts=' + ((doc2.memory || {}).facts || []).length, '| traits=' + (((doc2.state || {}).tf || {}).traits || []).length, '| notes=' + r.notes.slice(0, 120));
      if (!r.committed) {
        if (!firstFail) {
          firstFail = r; console.log('    refused sections:', JSON.stringify(r.secs));
          // Regenerate with changes on the last committed turn
          const tcA = (advDoc(h) || {}).turnCount, feedA = h.document.querySelectorAll('#feed .turn').length, b1 = h.mock.sampleCalls.length;
          h.click('#regenWith'); h.$('#rewrite').value = 'Make the walk to class slower and add a short conversation with the roommate about the weather and the week ahead, keeping every event.'; h.click('#rewriteGo');
          await h.sleep(50); await h.idle(30000);
          const rc = h.mock.sampleCalls.slice(b1).filter(isTurnPrompt);
          R.regen = { sent: rc.map((c) => c.bytes + '/' + c.outcome).join(',') || 'none', tc: tcA + '->' + (advDoc(h) || {}).turnCount, feed: feedA + '->' + h.document.querySelectorAll('#feed .turn').length, status: h.$('#status').hidden ? '' : h.$('#status').textContent.slice(0, 100) };
          console.log('    regenWith:', JSON.stringify(R.regen));
          // Undo, then the same new turn again
          h.click('#undo'); await h.idle();
          R.afterUndo = await attempt(h, 'Go to class, then eat with friends again', ''); console.log('    after Undo, new turn:', brief(R.afterUndo));
          break;
        }
      }
    }
    // B2: no more forced changes; keep playing with the model's own one fact a turn until the guard refuses (or 40 turns).
    R.B2 = null;
    if (firstFail && R.afterUndo && R.afterUndo.committed) {
      for (let j = 1; j <= 40; j++) {
        const r = await attempt(h, 'Go to the library and study with friends ' + j, ''); const doc3 = advDoc(h) || {};
        if (j % 5 === 0 || !r.committed) console.log('  B2 turn +' + String(j).padEnd(3), brief(r), '| tfB=' + r.tfB, '| facts=' + ((doc3.memory || {}).facts || []).length, '| notes=' + r.notes.slice(0, 110));
        if (!r.committed) {
          console.log('    refused sections:', JSON.stringify(r.secs));
          const w = await attempt(h, 'Wait.', ''); console.log('    retry short action:', brief(w));
          R.B2 = { j, r, w, facts: ((doc3.memory || {}).facts || []).length }; break;
        }
      }
      if (!R.B2) R.B2 = { j: 'none in 40', facts: (((advDoc(h) || {}).memory || {}).facts || []).length };
    }
    R.firstFailB = firstFail ? firstFail.i : null;
    R.maxTf = Math.max(...R.B.map((r) => r.tfB));
    R.overB = R.B.reduce((a, r) => a + r.over, 0);
    R.errB = h.errors.length; R.violB = h.mock.violations.map((v) => v.kind + ':' + v.detail.slice(0, 50));
    console.log('  B first refusal at turn', R.firstFailB, '| max tf section', R.maxTf, '| over-cap sends', R.overB, '| errors', R.errB, JSON.stringify(h.errors.slice(0, 2).map((e) => e.message.slice(0, 160))), '| violations', JSON.stringify(R.violB.slice(0, 6)), R.violB.length);
    h.close();
  }
  console.log('\n=== SIDE BY SIDE (published src | fixed main) ===');
  const row = (label, f) => console.log(label.padEnd(24), String(f(res.src)).padEnd(80), '|', String(f(res.main)));
  for (let i = 0; i < res.src.D.length; i++) row(res.src.D[i].tag, (R) => brief(R.D[i]));
  row('A fold call bytes', (R) => R.A.fold + ' viol=' + R.A.viol + ' note="' + R.A.note + '"');
  row('A facts / summary B', (R) => R.A.factsBefore + '->' + R.A.factsAfter + ' / ' + R.A.sumB);
  row('A then normal turn', (R) => brief(R.A2));
  row('B first refusal turn', (R) => R.firstFailB + ' (tf section max ' + R.maxTf + ' B, over-cap sends ' + R.overB + ')');
  row('B regenWith', (R) => R.regen ? JSON.stringify(R.regen) : 'n/a');
  row('B after Undo', (R) => brief(R.afterUndo));
  row('B2 natural: refusal', (R) => R.B2 ? ('after +' + R.B2.j + ' turns, facts ' + R.B2.facts + (R.B2.r ? ', ' + brief(R.B2.r) : '')) : 'n/a');
  row('B2 retry short action', (R) => R.B2 && R.B2.w ? brief(R.B2.w) : 'n/a');
  row('page errors D+A / B',(R) => R.errD + ' / ' + R.errB);
  row('violations D+A / B', (R) => R.violD.length + ' / ' + R.violB.length);
  console.log('elapsed s', Math.round((Date.now() - T0) / 1000));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
