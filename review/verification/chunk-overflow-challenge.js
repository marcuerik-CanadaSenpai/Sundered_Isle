'use strict';
// chunk-overflow-challenge: routes the tester did not cover, run on PUBLISHED (src) and FIXED (main).
//   undo2  : 12 turns, Undo, Undo, one more turn, then a 2nd page loads the shared store (trimmed turns lose memBefore/state)
//   undoRegen : 12 turns, Undo, Regenerate, one more turn, 2nd page
//   rewrite : Sundered heavy (6 species forced), 21 turns, then 'Regenerate with changes' (#regenWith -> #rewriteGo) up to 8 times
// Usage: node difftests/chunk-overflow-challenge.js [undo2|undoRegen|rewrite|all]
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
// an async click handler that throws becomes an unhandled rejection in node (a console error in a browser): record it, keep going
const UNHANDLED = []; process.on('unhandledRejection', (e) => { UNHANDLED.push(String(e && e.message || e).slice(0, 140)); });
const ROOT = process.env.WL_ROOT || 'C:/Users/marcu/AppData/Local/Temp/wl-harness';
const BUILDS = {
  published: { htmlPath: ROOT + '/src/index.html', worldsDir: ROOT + '/src/worlds' },
  fixed: { htmlPath: ROOT + '/main/index.html', worldsDir: ROOT + '/main/worlds' },
};
const WHICH = process.argv[2] || 'all';
const W = (n, seed) => Array.from({ length: n }, (_, i) => ['lantern', 'corridor', 'whispers', 'copper', 'stairwell', 'dust', 'laughter', 'threshold', 'somewhere', 'below'][(i * 7 + seed) % 10]).join(' ');

function makeHandler(stats) {
  return (mock) => (input, opts, call) => {
    const p = typeof input === 'string' ? input : input.map((m) => m.content).join('\n');
    if (/Rewrite it to between|first appearance|Invent the people/.test(p)) return mock.defaultHandler(input, opts, call);
    if (/long-term memory/.test(p)) return 'On Day ' + (1 + Math.floor(stats.n / 6)) + ' ' + W(250, stats.n) + '.';
    if (!/"suggested_actions": exactly three strings/.test(p)) return /Return|JSON/.test(p) ? JSON.stringify({ given: {} }) : mock.defaultHandler(input, opts, call);
    const n = ++stats.n;
    return JSON.stringify({
      evaluation: { stat: 'none', outcome: 'none' }, narrative: W(380, n) + ' *A thought, turn ' + n + '.*',
      suggested_actions: ['Look around the quad again', 'Ask the porter about the lanterns', 'Go back to the room and unpack'],
      secret_info: '', state_updates: [], time_advance_minutes: stats.adv || 20,
      events: [1, 2, 3].map((k) => 'Day ' + (1 + Math.floor(n / 6)) + ' 1' + k + ':' + (10 + n % 40) + ' ' + W(14, n + k)),
      beats: [W(16, n), W(16, n + 3)], facts: [W(12, n + 5)], exposures: [],
    });
  };
}
const feedNums = (h) => [...h.document.querySelectorAll('#feed article.turn:not(.draft) .turn-meta .n')].map((e) => e.textContent.trim());
const feedMarkers = (h) => [...h.document.querySelectorAll('#feed article.turn:not(.draft) .narr')].slice(1).map((e) => { const m = /A thought, turn (\d+)/.exec(e.textContent); return m ? Number(m[1]) : null; });
const advDoc = (store) => { const e = [...store.entries()].find(([k]) => /^adventures\/[^/]+$/.test(k)); return e ? e[1].data : null; };
const note = (h) => h.$('#summaryNote').textContent;
const status = (h) => h.$('#status').textContent.replace(/\s+/g, ' ').slice(0, 140);
const failed = (h) => /failed/i.test(note(h));
function docShape(store) {
  const d = advDoc(store); if (!d) return 'no doc';
  const m = d.memory; const s = d.state || {};
  return 'turnCount=' + d.turnCount + ' memory=' + (m === null ? 'NULL' : (m ? 'events:' + (m.events || []).length : typeof m)) + ' stateKeys=' + Object.keys(s).length + ' items=' + (s.items ? 'ok' : 'MISSING') + ' tf=' + (s.tf ? 'ok' : 'none');
}
const errHeads = (h, from) => h.errors.slice(from || 0, (from || 0) + 2).map((e) => e.message.split('\n')[0].slice(0, 140));

async function page2(build, shared, stats) {
  const h2 = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { m.store = shared; m.sampleHandler = makeHandler(stats)(m); } }));
  await h2.settle(200, 15000); await h2.idle(20000);
  const r = { shown: feedNums(h2).length - 1, tail: feedMarkers(h2).slice(-3).join(','), status: status(h2), note: note(h2), errors: h2.errors.length, createOpen: !!h2.$('#dlgCreate[open]') || !!h2.$('dialog[open] #cBegin') };
  // can page 2 take a turn on what it loaded?
  const before = feedNums(h2).length; await h2.turn('Page two turn', { max: 30000 });
  r.turnOk = feedNums(h2).length > before; r.afterTurn = status(h2) + ' | ' + note(h2); r.errorsAfter = h2.errors.length; r.errHeads = errHeads(h2);
  h2.close();
  return r;
}

async function start(build, stats) {
  const shared = new Map();
  const h = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { m.store = shared; m.sampleHandler = makeHandler(stats)(m); } }));
  await h.settle(150, 6000); h.click('#cBegin'); await h.idle(30000);
  return { h, shared };
}

async function undoScenario(build, second) {
  const stats = { n: 0 }; const { h, shared } = await start(build, stats);
  for (let i = 1; i <= 12; i++) await h.turn('Action ' + i, { max: 30000 });
  const r = { build, scenario: second === 'undo' ? 'undo2' : 'undoRegen', steps: [] };
  const snap = (label) => r.steps.push(label + ': feed=' + (feedNums(h).length - 1) + ' tail=' + feedMarkers(h).slice(-2).join(',') + ' note=' + note(h) + ' status=' + status(h) + ' errors=' + h.errors.length + ' | ' + docShape(shared));
  snap('after 12 turns');
  let e0 = h.errors.length;
  h.click('#undo'); await h.idle(20000); snap('undo 1');
  e0 = h.errors.length;
  if (second === 'undo') { h.click('#undo'); await h.idle(20000); snap('undo 2'); }
  else { const b = h.mock.sampleCalls.length; h.click('#regen'); const t = Date.now(); while (Date.now() - t < 800 && h.mock.sampleCalls.length === b) await h.sleep(10); await h.idle(30000); snap('regen after undo'); }
  r.newErrors = errHeads(h, e0).concat(UNHANDLED.splice(0).map((x) => 'unhandled: ' + x));
  const e1 = h.errors.length;
  await h.turn('Action after', { max: 30000 }); snap('next turn');
  if (second === 'undo') { await h.turn('Action after again', { max: 30000 }); snap('2nd next turn'); h.click('#regen'); await h.sleep(300); await h.idle(30000); snap('regen'); }
  r.newErrors2 = r.newErrors.concat(errHeads(h, e1), UNHANDLED.splice(0).map((x) => 'unhandled: ' + x));
  r.violations = h.mock.violations.reduce((o, v) => { o[v.kind] = (o[v.kind] || 0) + 1; return o; }, {});
  r.page2 = await page2(build, shared, stats);
  h.close();
  return r;
}

async function rewriteScenario(build) {
  const stats = { n: 0, adv: 45 }; const { h, shared } = await start(build, stats);
  h.click('#btnOverride'); await h.idle();
  for (const sp of ['cow', 'wolf', 'harpy', 'goblin', 'fairy', 'fox']) {
    const b = h.$('#ovrInfluence button[data-manifest="' + sp + '"]'); if (b) { h.click(b); await h.idle(); }
    if (h.$('#ovrInfluence input[data-sp="' + sp + '"]')) { h.type('#ovrInfluence input[data-sp="' + sp + '"]', '95'); await h.idle(); }
  }
  h.document.querySelectorAll('dialog[open]').forEach((d) => d.close()); await h.idle();
  const r = { build, scenario: 'rewrite', turnFails: [], rewrites: [] };
  for (let i = 1; i <= 21; i++) { await h.turn('Action ' + i, { max: 30000 }); if (failed(h)) r.turnFails.push(i); }
  const tooLarge0 = h.mock.violations.filter((v) => v.kind === 'doc-too-large').length;
  for (let k = 1; k <= 8; k++) {
    const b = h.mock.sampleCalls.length;
    h.click('#regenWith'); h.$('#rewrite').value = 'Make it quieter, version ' + k; h.click('#rewriteGo');
    const t = Date.now(); while (Date.now() - t < 800 && h.mock.sampleCalls.length === b) await h.sleep(10);
    await h.idle(30000);
    const v = h.mock.violations.filter((x) => x.kind === 'doc-too-large').slice(tooLarge0);
    const last = v.length ? / is (\d+) bytes/.exec(v[v.length - 1].detail)[1] : '';
    const chunk = [...shared.entries()].filter(([p]) => /\/turns\/0002$/.test(p)).map(([, e]) => Buffer.byteLength(JSON.stringify(e.data)))[0] || 0;
    r.rewrites.push('rw' + k + ':' + (failed(h) ? 'FAIL rejected=' + last : 'ok') + ' chunk2=' + chunk + ' tail=' + feedMarkers(h).slice(-1));
    if (failed(h) && k > 1 && /FAIL/.test(r.rewrites[k - 2] || '')) break;
  }
  r.seen = feedMarkers(h).slice(-1)[0];
  await h.turn('Action after rewrites', { max: 30000 });
  r.nextTurn = note(h);
  r.errors = h.errors.length; r.violations = h.mock.violations.reduce((o, v) => { o[v.kind] = (o[v.kind] || 0) + 1; return o; }, {});
  r.page2 = await page2(build, shared, { n: 1000 });
  h.close();
  return r;
}

(async () => {
  const out = [];
  const t0 = Date.now();
  const run = async (name, fn) => { if (WHICH === 'all' || WHICH === name) for (const b of ['published', 'fixed']) { const r = await fn(b); out.push(r); console.log('\n=== ' + b.toUpperCase() + ' / ' + name + ' ==='); console.log(JSON.stringify(r, null, 1)); } };
  await run('undo2', (b) => undoScenario(b, 'undo'));
  await run('undoRegen', (b) => undoScenario(b, 'regen'));
  await run('rewrite', rewriteScenario);
  console.log('\n=== SIDE BY SIDE (' + Math.round((Date.now() - t0) / 1000) + ' s) ===');
  for (const r of out) {
    if (r.scenario === 'rewrite') console.log(r.build + '/rewrite | turn save fails at ' + JSON.stringify(r.turnFails.slice(0, 3)) + ' | ' + r.rewrites.join(' ') + ' | next turn note=' + r.nextTurn + ' | page2 shown=' + r.page2.shown + ' tail=' + r.page2.tail + ' (page1 saw ' + r.seen + ') | errors=' + r.errors + ' viol=' + JSON.stringify(r.violations));
    else console.log(r.build + '/' + r.scenario + ' | ' + r.steps.slice(-2).join(' || ') + ' | newErrors=' + JSON.stringify(r.newErrors2) + ' | page2: shown=' + r.page2.shown + ' status=' + r.page2.status + ' turnOk=' + r.page2.turnOk + ' after=' + r.page2.afterTurn + ' errors=' + r.page2.errorsAfter);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
