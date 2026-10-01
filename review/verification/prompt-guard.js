'use strict';
// prompt-guard: grow a Sundered adventure step by step until its turn prompt passes 64 KiB, on the published (src) and the
// fixed (main) build, with the same inputs. Each step takes a real turn with a lore-heavy action and a binding director note.
// Ladder (one adventure, monotonic growth): 4 transformations forced + 380-word summary -> +30 facts -> +30 facts (60, ~200 B each)
// -> 6 / 10 / 16 cast present. At the fixed build's first refusal we read Debug (the shed prompt it refused) and try the advice it
// shows (lower the verbatim window), a short action, and letting most characters leave. Part C: 60 long facts (~420 B).
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const B = (s) => Buffer.byteLength(s, 'utf8');
const BUILDS = {
  src: { htmlPath: (process.env.WL_ROOT || (__dirname + '/..')) + '/src/index.html', worldsDir: (process.env.WL_ROOT || (__dirname + '/..')) + '/src/worlds' },
  main: { htmlPath: (process.env.WL_ROOT || (__dirname + '/..')) + '/main/index.html', worldsDir: (process.env.WL_ROOT || (__dirname + '/..')) + '/main/worlds' },
};
const CAP = 65536;
const DIRECTOR = 'Keep the roommate in the scene and end at the Spa door. MARKER-DIRECTOR-7731';
const LORE_ACTION = 'Walk past the Creamery for a cocoa, cross the Moon Field toward the Aerie, the goblin market in the arcade, the fairy ring, the library ledge, the lake pools and the Greenhouse, asking about the Restoration Spa, the Dean and the Edge MARKER-ACTION-5512';
const WORDS = ['the', 'porter', 'kept', 'a', 'ledger', 'of', 'every', 'key', 'and', 'Moss', 'returned', 'it', 'on', 'Day', 'three', 'after', 'the', 'pack', 'ran', 'past', 'Kettle', 'Hall', 'while', 'the', 'harpies', 'sang'];
const words = (n, seed) => Array.from({ length: n }, (_, i) => WORDS[(i * 7 + seed) % WORDS.length]).join(' ');
const factText = (i, len) => { let s = 'Fact ' + i + ': ' + words(Math.ceil(len / 4), i); while (B(s) < len) s += ' ' + WORDS[s.length % WORDS.length]; return s.slice(0, len).trim() + '.'; };
const summaryOfWords = (n) => 'Summary. ' + words(n, 3) + '.';
function sections(p) { const out = {}; const re = /^<(\w+)(?: [^>]*)?>\n([\s\S]*?)\n<\/\1>/gm; let m; while ((m = re.exec(p))) out[m[1]] = (out[m[1]] || 0) + B(m[0]); return out; }
const isTurnPrompt = (c) => typeof c.input === 'string' && c.input.includes('<output_format>');

function handlerFor(mock) {
  return (input, opts, call) => {
    const p = typeof input === 'string' ? input : input.map((m) => m.content).join('\n');
    if (/You maintain the long-term memory/.test(p)) return 'Fold summary. ' + words(300, 5) + '.';   // realistic ~300-word fold
    return mock.defaultHandler(input, opts, call);
  };
}
async function newSundered(name) {
  const h = await boot(Object.assign({ setup(w, m) { m.sampleHandler = handlerFor(m); } }, BUILDS[name]));
  await h.settle(150, 6000);
  h.click('#cBegin'); await h.idle(30000);
  return h;
}
function advDocTurnCount(h) { for (const [k, v] of h.mock.store) if (/^adventures\/[^/]+$/.test(k)) return v.data && v.data.turnCount; return null; }
function castNames(h) {
  const last = h.mock.sampleCalls.filter(isTurnPrompt).pop();
  const ch = /<characters[^>]*>\n([\s\S]*?)\n<\/characters>/.exec(last.input)[1];
  return [...ch.matchAll(/^- (.+?) \[key: [^\]]+\]/gm)].map((m) => m[1].replace(/\s*\([^)]*\)\s*$/, '').trim());
}
async function forceChanges(h, species) {
  for (const sp of species) { h.click('#btnOverride'); await h.sleep(5); const b = h.$('#ovrInfluence [data-manifest="' + sp + '"]'); if (b) { h.click(b); await h.idle(); } }
}
let factNo = 1;
async function addFacts(h, n, len) { h.click('#btnOverride'); for (let i = 0; i < n; i++) { h.type('#ovrFact', factText(factNo++, len)); h.click('#ovrFactAdd'); await h.idle(); } }
async function setSummary(h, text) { h.$('#summary').value = text; h.$('#summary').dispatchEvent(new h.window.Event('input', { bubbles: true })); h.click('#saveSummary'); await h.idle(); }
async function setPresent(h, names) {
  h.click('#btnOverride'); await h.sleep(5);
  const st = JSON.parse(h.$('#ovrState').value); st.present = names; h.$('#ovrState').value = JSON.stringify(st);
  h.click('#ovrStateApply'); await h.idle();
  return h.$('#ovrStateNote').textContent;
}
function debugView(h) { h.click('#btnDebug'); const p = h.$('#dbgPrompt').textContent, n = h.$('#dbgNotes').textContent; h.window.document.querySelector('#dlgDebug').removeAttribute('open'); return { bytes: B(p), notes: n.replace(/\s+/g, ' ').slice(0, 260), secs: sections(p), hasDirector: p.includes(DIRECTOR) }; }
async function attempt(h, action, director) {
  const before = h.mock.sampleCalls.length, vBefore = h.mock.violations.length, tcBefore = advDocTurnCount(h);
  await h.turn(action, { director, max: 30000 });
  const calls = h.mock.sampleCalls.slice(before);
  const turnCalls = calls.filter(isTurnPrompt);
  const t = turnCalls[turnCalls.length - 1];
  const st = h.$('#status');
  const r = {
    sent: turnCalls.map((c) => c.bytes + '/' + c.outcome).join(',') || 'none',
    maxSent: calls.reduce((a, c) => Math.max(a, c.bytes), 0),
    over: calls.filter((c) => c.bytes > CAP).length,
    viol: h.mock.violations.slice(vBefore).map((v) => v.kind).join(',') || '-',
    committed: (advDocTurnCount(h) || 0) - (tcBefore || 0),
    status: st.hidden ? '' : st.textContent.slice(0, 160),
    boxesKept: (h.$('#action').value === action) + '/' + (h.$('#director').value === director),
    inPrompt: t ? (t.input.includes(action) + '/' + (director ? t.input.includes('Director note (binding): ' + director) : 'n/a')) : '-',
    lore: t ? ((t.input.match(/<entry name=/g) || []).length + ' entries') : '-', tailCut: t ? /tail end of each turn only/.test(t.input) : '-',
  };
  const d = debugView(h); r.dbgBytes = d.bytes; r.dbgNotes = d.notes; r.dbgSecs = d.secs;
  return r;
}
const show = (tag, r) => console.log(' ', tag.padEnd(22), (r.committed && /size cap/.test(r.dbgNotes) ? '[guard: ' + (/(prompt near the size cap[^]*?)(?: failed|$)/.exec(r.dbgNotes) || [, ''])[1].slice(0, 150) + '] ' : ''), 'sent=' + r.sent, '| >cap=' + r.over, '| viol=' + r.viol, '| committed=' + r.committed, '| action/director in prompt=' + r.inPrompt, '| boxes kept=' + r.boxesKept, '| lore=' + r.lore, '| tailCut=' + r.tailCut, '| debugPromptB=' + r.dbgBytes, '| status="' + r.status + '"');

(async () => {
  const T0 = Date.now(); const res = {};
  for (const name of ['src', 'main']) {
    console.log('==== ' + name + ' ====');
    const R = res[name] = { steps: [], recover: {} };
    factNo = 1;
    let h = await newSundered(name);
    for (let i = 1; i <= 2; i++) await h.turn('Look around the room ' + i);
    const names = castNames(h);
    await forceChanges(h, ['cow', 'harpy', 'fox', 'mer']);
    await h.turn('Unpack and talk with the roommate');
    await setSummary(h, summaryOfWords(380));
    const defaultPresent = JSON.parse((h.click('#btnOverride'), h.$('#ovrState').value)).present;
    const ladder = [
      ['L0 4tf+summary', async () => {}],
      ['L1 +30 facts', async () => addFacts(h, 30, 200)],
      ['L2 +30 facts (60)', async () => addFacts(h, 30, 200)],
      ['L3 present 6', async () => setPresent(h, names.slice(0, 6))],
      ['L4 present 10', async () => setPresent(h, names.slice(0, 10))],
      ['L5 present 16', async () => setPresent(h, names.slice(0, 16))],
    ];
    let firstFail = null;
    for (const [tag, grow] of ladder) {
      await grow();
      const r = await attempt(h, LORE_ACTION, DIRECTOR); r.tag = tag; R.steps.push(r); show(tag, r);
      if (!r.committed && !firstFail) { firstFail = tag; console.log('    refused-prompt sections:', JSON.stringify(r.dbgSecs)); console.log('    debug notes:', r.dbgNotes); }
      if (r.committed && tag === 'L2 +30 facts (60)') console.log('    sent sections:', JSON.stringify(h.mock.sampleCalls.filter(isTurnPrompt).pop() ? sections(h.mock.sampleCalls.filter(isTurnPrompt).pop().input) : {}));
    }
    R.firstFail = firstFail;
    if (firstFail) {
      h.$('#setWindow').value = '2'; h.$('#setWindow').dispatchEvent(new h.window.Event('change', { bubbles: true })); await h.idle();
      R.recover.window2 = await attempt(h, LORE_ACTION, DIRECTOR); show('retry window=2 (advice)', R.recover.window2);
      R.recover.short = await attempt(h, 'Wait.', ''); show('retry short action', R.recover.short);
      await setPresent(h, defaultPresent);
      R.recover.leave = await attempt(h, LORE_ACTION, DIRECTOR); show('retry cast left scene', R.recover.leave);
    }
    R.errors = h.errors.length; R.viol = h.mock.violations.map((v) => v.kind + ':' + v.detail.slice(0, 40));
    console.log('  errors:', R.errors, JSON.stringify(h.errors.slice(0, 2).map((e) => e.message.slice(0, 160))), '| violations:', JSON.stringify(R.viol));
    h.close();
    // Part C: fresh adventure, 60 long facts (~420 B each, one-line model facts), default cast present, same tf/summary/action.
    factNo = 1;
    h = await newSundered(name);
    for (let i = 1; i <= 2; i++) await h.turn('Look around the room ' + i);
    await forceChanges(h, ['cow', 'harpy', 'fox', 'mer']);
    await h.turn('Unpack and talk with the roommate');
    await setSummary(h, summaryOfWords(380));
    await addFacts(h, 60, 420);
    R.C = await attempt(h, LORE_ACTION, DIRECTOR); show('C 60x420B facts', R.C);
    if (!R.C.committed) { console.log('    refused-prompt sections:', JSON.stringify(R.C.dbgSecs)); R.C2 = await attempt(h, 'Wait.', ''); show('C retry short action', R.C2); }
    R.errorsC = h.errors.length; R.violC = h.mock.violations.map((v) => v.kind + ':' + v.detail.slice(0, 40));
    console.log('  C errors:', R.errorsC, '| violations:', JSON.stringify(R.violC));
    h.close();
  }
  console.log('\n=== SIDE BY SIDE (published src | fixed main) ===');
  const brief = (r) => r ? ((r.sent === 'none' ? 'not sent' : 'sent ' + r.sent) + (r.over ? ' OVERCAP' : '') + ', committed ' + r.committed + (r.committed ? ', lore ' + r.lore : ', dbg ' + r.dbgBytes + 'B') + (r.status ? ', "' + r.status.slice(0, 48) + '"' : '')) : 'n/a';
  const row = (label, f) => console.log(label.padEnd(22), String(f(res.src)).padEnd(84), '|', String(f(res.main)));
  for (let i = 0; i < res.src.steps.length; i++) row(res.src.steps[i].tag, (R) => brief(R.steps[i]));
  row('retry window=2', (R) => brief(R.recover.window2));
  row('retry short action', (R) => brief(R.recover.short));
  row('retry cast left', (R) => brief(R.recover.leave));
  row('C 60x420B facts', (R) => brief(R.C));
  row('C retry short', (R) => brief(R.C2));
  row('any input > 65536 B', (R) => [...R.steps, R.recover.window2, R.recover.short, R.recover.leave, R.C, R.C2].filter(Boolean).some((r) => r.over > 0));
  row('page errors', (R) => R.errors + '/' + R.errorsC);
  console.log('elapsed s', Math.round((Date.now() - T0) / 1000));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
