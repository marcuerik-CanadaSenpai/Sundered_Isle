'use strict';
// chunk-overflow: does saving fail once a 10-turn chunk document passes 256 KiB?
// Runs the same scenarios against the PUBLISHED (src) and FIXED (main) builds and prints a side-by-side result.
//   plain : realistic Sundered turns (~380-word narrative, 3 events, 2 beats, 1 fact), up to 120 turns
//   heavy : Override forces the next change for 6 species and pushes their influence to 95, then 40 turns
// Published runs stop at the first save failure; fixed runs go the full length.
// After each run a second page sharing the store must show every turn with correct numbering.
// Extra (fixed plain only): regenerate the last turn 4 times at turn 120 (alts carry full memBefore copies).
// Usage: node difftests/chunk-overflow.js [plain|heavy|all]
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || 'C:/Users/marcu/AppData/Local/Temp/wl-harness';
const BUILDS = {
  published: { htmlPath: ROOT + '/src/index.html', worldsDir: ROOT + '/src/worlds' },
  fixed: { htmlPath: ROOT + '/main/index.html', worldsDir: ROOT + '/main/worlds' },
};
const WHICH = process.argv[2] || 'all';
const FOLD_FAILS = process.argv[3] === 'foldfail'; // worst case: every memory fold is rejected, memory never shrinks
const W = (n, seed) => Array.from({ length: n }, (_, i) => ['lantern', 'corridor', 'whispers', 'copper', 'stairwell', 'dust', 'laughter', 'threshold', 'somewhere', 'below'][(i * 7 + seed) % 10]).join(' ');
const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);

function makeHandler(stats, timeAdvance) {
  return (mock) => (input, opts, call) => {
    const p = typeof input === 'string' ? input : input.map((m) => m.content).join('\n');
    let kind = 'other';
    if (/Rewrite it to between/.test(p)) kind = 'fit';
    else if (/long-term memory/.test(p)) kind = 'fold';
    else if (/first appearance/.test(p)) kind = 'rmIntro';
    else if (/Invent the people/.test(p)) kind = 'invent';
    else if (/"suggested_actions": exactly three strings/.test(p)) kind = 'turn';
    stats.kinds[kind] = (stats.kinds[kind] || 0) + 1;
    stats.maxPrompt = Math.max(stats.maxPrompt, Buffer.byteLength(p));
    if (kind !== 'turn') {
      if (kind === 'other') stats.otherHeads.add(p.slice(0, 60).replace(/\s+/g, ' '));
      if (kind === 'other' && /Return|JSON/.test(p)) return JSON.stringify({ given: {} });
      // a usable fold reply (the stock mock summary is under 20 words, which the page rejects, so memory would never fold)
      if (kind === 'fold' && !FOLD_FAILS) return 'On Day ' + (1 + Math.floor(stats.n / 6)) + ' ' + W(250, stats.n) + '.';
      return mock.defaultHandler(input, opts, call);
    }
    const n = ++stats.n;
    return JSON.stringify({
      evaluation: { stat: 'none', outcome: 'none' }, narrative: W(380, n) + ' *A thought, turn ' + n + '.*',
      suggested_actions: ['Look around the quad again', 'Ask the porter about the lanterns', 'Go back to the room and unpack'],
      secret_info: '', state_updates: [], time_advance_minutes: timeAdvance,
      events: [1, 2, 3].map((k) => 'Day ' + (1 + Math.floor(n / 6)) + ' 1' + k + ':' + (10 + n % 40) + ' ' + W(14, n + k)),
      beats: [W(16, n), W(16, n + 3)], facts: [W(12, n + 5)], exposures: [],
    });
  };
}

function sizes(h) {
  const r = { chunkOk: 0, advOk: 0, attempted: 0 };
  for (const e of h.mock.dbLog) if (e.op === 'set' && e.bytes) {
    if (/\/turns\//.test(e.path)) r.chunkOk = Math.max(r.chunkOk, e.bytes); else if (/^adventures\/[^/]+$/.test(e.path)) r.advOk = Math.max(r.advOk, e.bytes);
  }
  for (const v of h.mock.violations) if (v.kind === 'doc-too-large') { const m = / is (\d+) bytes/.exec(v.detail); if (m) r.attempted = Math.max(r.attempted, Number(m[1])); }
  return r;
}
function breakdown(store) {
  const kb = (o) => (Buffer.byteLength(JSON.stringify(o === undefined ? null : o)) / 1024).toFixed(1) + 'K';
  const a = advFromStore(store); if (!a) return '';
  const top = Object.keys(a).map((k) => [k, Buffer.byteLength(JSON.stringify(a[k] === undefined ? null : a[k]))]).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, b]) => k + '=' + (b / 1024).toFixed(1) + 'K').join(' ');
  const mem = a.memory ? 'events=' + (a.memory.events || []).length + '/' + kb(a.memory.events) + ' beats=' + (a.memory.beats || []).length + ' facts=' + (a.memory.facts || []).length + ' summary=' + kb(a.memory.summary) : '';
  const ch = [...store.entries()].filter(([k]) => /\/turns\//.test(k)).sort((x, y) => (x[0] < y[0] ? -1 : 1)).pop();
  const lt = ch && ch[1].data.turns[ch[1].data.turns.length - 1];
  const turnTop = lt ? Object.keys(lt).map((k) => [k, Buffer.byteLength(JSON.stringify(lt[k] === undefined ? null : lt[k]))]).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, b]) => k + '=' + (b / 1024).toFixed(1) + 'K').join(' ') : '';
  return 'advDoc[' + top + '] memory[' + mem + '] lastTurn[' + turnTop + ' alts=' + (lt && lt.alts ? lt.alts.length : 0) + ']';
}
function storeChunkKiB(store) { return [...store.entries()].filter(([k]) => /\/turns\//.test(k)).sort().map(([, v]) => Math.round(Buffer.byteLength(JSON.stringify(v.data)) / 1024) + 'K').join(' '); }
function advFromStore(store) { const e = [...store.entries()].find(([k]) => /^adventures\/[^/]+$/.test(k)); return e ? e[1].data : null; }
function tfInfo(store) { const a = advFromStore(store); const tf = a && a.state && a.state.tf; if (!tf) return 'no tf'; return 'tracks=' + (tf.tracks || []).length + ' arcs=' + (tf.arcs || []).length + ' traits=' + (tf.traits || []).length + ' rungs=' + JSON.stringify(tf.rungs || {}); }
const feedNums = (h) => [...h.document.querySelectorAll('#feed article.turn:not(.draft) .turn-meta .n')].map((e) => e.textContent.trim());
const feedMarkers = (h) => [...h.document.querySelectorAll('#feed article.turn:not(.draft) .narr')].slice(1).map((e) => { const m = /A thought, turn (\d+)/.exec(e.textContent); return m ? Number(m[1]) : null; });
const saveFailed = (h) => /failed/i.test(h.$('#summaryNote').textContent) || /save failed/i.test(h.$('#status').textContent);

async function secondPage(build, shared, expectN, stats, page1) {
  const h2 = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { m.store = shared; m.sampleHandler = makeHandler(stats, 20)(m); } }));
  await h2.settle(200, 15000); await h2.idle(20000);
  const nums = feedNums(h2);
  const want = Array.from({ length: expectN + 1 }, (_, i) => 'Turn ' + i);
  const ok = nums.length === want.length && nums.every((x, i) => x === want[i]);
  let firstBad = -1; for (let i = 0; i < Math.max(nums.length, want.length); i++) if (nums[i] !== want[i]) { firstBad = i; break; }
  const m1 = page1 ? feedMarkers(page1) : [], m2 = feedMarkers(h2); let diffAt = -1; if (page1) for (let i = 0; i < Math.min(m1.length, m2.length); i++) if (m1[i] !== m2[i]) { diffAt = i; break; }
  const r = { ok, tail1: m1.slice(-3).join(','), tail2: m2.slice(-3).join(','), contentSame: page1 ? diffAt < 0 : null, contentDiff: diffAt < 0 ? null : 'turn ' + (diffAt + 1) + ' page1 reply#' + m1[diffAt] + ' vs page2 reply#' + m2[diffAt], shown: nums.length - 1, expect: expectN, firstMismatch: firstBad < 0 ? null : (want[firstBad] || 'none') + ' vs ' + (nums[firstBad] || 'none'), note: h2.$('#summaryNote').textContent, status: h2.$('#status').textContent.slice(0, 160), errors: h2.errors.length };
  h2.close();
  return r;
}

async function scenario(build, variant) {
  const shared = new Map();
  const stats = { n: 0, kinds: {}, maxPrompt: 0, otherHeads: new Set() };
  const timeAdvance = variant === 'heavy' ? 45 : 20;
  const N = variant === 'heavy' ? 40 : variant === 'long' ? 210 : 120;
  const t0 = Date.now();
  const h = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { m.store = shared; m.sampleHandler = makeHandler(stats, timeAdvance)(m); } }));
  await h.settle(150, 6000); h.click('#cBegin'); await h.idle(30000);
  const res = { build, variant, firstFail: null, failures: 0, turnsShown: 0, log: [], tfStart: '', tfEnd: '', maxTracks: 0, turnFailMsgs: [] };
  if (variant === 'heavy') {
    h.click('#btnOverride'); await h.idle();
    for (const sp of ['cow', 'wolf', 'harpy', 'goblin', 'fairy', 'fox']) {
      const b = h.$('#ovrInfluence button[data-manifest="' + sp + '"]'); if (b) { h.click(b); await h.idle(); }
      const inp = h.$('#ovrInfluence input[data-sp="' + sp + '"]'); if (inp) { h.type('#ovrInfluence input[data-sp="' + sp + '"]', '95'); await h.idle(); }
    }
    h.document.querySelectorAll('dialog[open]').forEach((d) => d.close()); await h.idle();
    res.tfStart = tfInfo(shared);
  }
  for (let i = 1; i <= N; i++) {
    const before = feedNums(h).length;
    await h.turn('Action ' + i, { max: 40000 });
    const after = feedNums(h).length;
    if (after <= before) res.turnFailMsgs.push('t' + i + ': ' + h.$('#status').textContent.slice(0, 100));
    if (variant === 'heavy') { const a = advFromStore(shared); const tr = a && a.state && a.state.tf && a.state.tf.tracks; if (tr) res.maxTracks = Math.max(res.maxTracks, tr.length); }
    if (saveFailed(h)) { res.failures++; if (!res.firstFail) res.firstFail = { turn: i, note: h.$('#summaryNote').textContent, status: h.$('#status').textContent.slice(0, 120) }; }
    if (i % 10 === 0 || (saveFailed(h) && res.failures === 1)) res.log.push('t' + i + ' note=' + h.$('#summaryNote').textContent + ' chunks=' + storeChunkKiB(shared) + (variant === 'heavy' ? ' ' + tfInfo(shared) : ''));
    if (build === 'published' && res.firstFail) break;
  }
  res.turnsShown = feedNums(h).length - 1;
  res.lastNarrHasMarker = /A thought, turn \d+/.test((h.document.querySelector('#feed article.turn:not(.draft):last-of-type .narr') || { textContent: '' }).textContent);
  if (variant === 'heavy') res.tfEnd = tfInfo(shared);
  res.sizes = sizes(h); res.breakdown = breakdown(shared);
  res.violations = h.mock.violations.reduce((o, v) => { o[v.kind] = (o[v.kind] || 0) + 1; return o; }, {});
  res.errors = h.errors.length; res.errorHeads = h.errors.slice(0, 2).map((e) => e.message.slice(0, 160));
  res.page2 = await secondPage(build, shared, res.turnsShown, { n: 0, kinds: {}, maxPrompt: 0, otherHeads: new Set() }, h);
  // extra: regenerate the last turn 4 times (fixed plain only; published already failed)
  if (variant === 'plain' && !res.firstFail) {
    const r = { fails: 0, notes: [] };
    for (let k = 1; k <= 4; k++) {
      const before = h.mock.sampleCalls.length; h.click('#regen');
      const ts = Date.now(); while (Date.now() - ts < 800 && h.mock.sampleCalls.length === before) await h.sleep(10);
      await h.idle(40000);
      if (saveFailed(h)) { r.fails++; }
      r.notes.push(h.$('#summaryNote').textContent);
    }
    r.sizes = sizes(h); r.chunks = storeChunkKiB(shared);
    r.violations = h.mock.violations.filter((v) => v.kind === 'doc-too-large').length;
    r.page2 = await secondPage(build, shared, feedNums(h).length - 1, { n: 0, kinds: {}, maxPrompt: 0, otherHeads: new Set() }, h);
    r.breakdown = breakdown(shared);
    await h.turn('Action after regens', { max: 40000 });
    r.nextTurnNote = h.$('#summaryNote').textContent; r.nextChunks = storeChunkKiB(shared);
    r.nextPage2 = await secondPage(build, shared, feedNums(h).length - 1, { n: 0, kinds: {}, maxPrompt: 0, otherHeads: new Set() }, h);
    res.regen = r;
  }
  res.kinds = stats.kinds; res.maxPrompt = stats.maxPrompt; res.otherHeads = [...stats.otherHeads].slice(0, 3);
  res.secs = Math.round((Date.now() - t0) / 1000);
  h.close();
  return res;
}

function print(r) {
  console.log('\n=== ' + r.build.toUpperCase() + ' / ' + r.variant + ' (' + r.secs + ' s) ===');
  r.log.forEach((l) => console.log('  ' + l));
  if (r.tfStart) console.log('  tf after override: ' + r.tfStart);
  if (r.tfEnd) console.log('  tf at end: ' + r.tfEnd + ' | max tracks seen: ' + r.maxTracks);
  console.log('  first save failure: ' + JSON.stringify(r.firstFail) + ' | turns with a save failure: ' + r.failures);
  console.log('  turns shown on page 1: ' + r.turnsShown + ' | last narrative has marker: ' + r.lastNarrHasMarker + ' | turn failures: ' + r.turnFailMsgs.length + ' ' + JSON.stringify(r.turnFailMsgs.slice(0, 2)));
  console.log('  largest accepted chunk: ' + r.sizes.chunkOk + ' B | largest accepted adventure doc: ' + r.sizes.advOk + ' B | largest rejected: ' + r.sizes.attempted + ' B');
  console.log('  violations: ' + JSON.stringify(r.violations) + ' | page errors: ' + r.errors + ' ' + JSON.stringify(r.errorHeads));
  console.log('  page 2: ' + JSON.stringify(r.page2));
  console.log('  breakdown at end: ' + r.breakdown);
  if (r.regen) console.log('  regen breakdown: ' + r.regen.breakdown + ' | one more turn after regens: note=' + r.regen.nextTurnNote + ' chunks=' + r.regen.nextChunks + ' page2=' + JSON.stringify(r.regen.nextPage2));
  if (r.regen) console.log('  regen x4 at end: fails=' + r.regen.fails + ' notes=' + JSON.stringify(r.regen.notes) + ' largest chunk=' + r.regen.sizes.chunkOk + ' B rejected=' + r.regen.sizes.attempted + ' B doc-too-large=' + r.regen.violations + ' chunks=' + r.regen.chunks + ' | page 2: ' + JSON.stringify(r.regen.page2));
  console.log('  model calls: ' + JSON.stringify(r.kinds) + ' | largest prompt ' + r.maxPrompt + ' B | other prompt heads: ' + JSON.stringify(r.otherHeads));
}

(async () => {
  const variants = WHICH === 'all' ? ['plain', 'heavy'] : [WHICH];
  const all = [];
  for (const v of variants) for (const b of (v === 'long' ? ['fixed'] : ['published', 'fixed'])) { const r = await scenario(b, v); print(r); all.push(r); }
  console.log('\n=== SIDE BY SIDE ===');
  console.log(pad('build/variant', 20) + pad('firstFail', 11) + pad('fails', 7) + pad('turns', 7) + pad('maxChunkB', 11) + pad('maxAdvB', 10) + pad('rejectedB', 11) + pad('docTooLarge', 13) + pad('page2', 30) + 'errors');
  for (const r of all) console.log(pad(r.build + '/' + r.variant, 20) + pad(r.firstFail ? 't' + r.firstFail.turn : 'none', 11) + pad(r.failures, 7) + pad(r.turnsShown, 7) + pad(r.sizes.chunkOk, 11) + pad(r.sizes.advOk, 10) + pad(r.sizes.attempted, 11) + pad(r.violations['doc-too-large'] || 0, 13) + pad((r.page2.ok ? 'OK ' : 'BAD ') + r.page2.shown + '/' + r.page2.expect, 30) + r.errors);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
