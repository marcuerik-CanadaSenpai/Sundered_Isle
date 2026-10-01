'use strict';
// import-truncation: export saves with 0, 9, 10, 11, 25 turns, import each into a fresh store, then open a second page
// on the same store and load the imported adventure: every turn must be present and in order. Then malformed /
// incomplete imports must leave the open adventure usable. Runs the same scenario on the published (src) and fixed (main) builds.
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const ROOT = process.env.WL_ROOT || 'C:/Users/marcu/AppData/Local/Temp/wl-harness';
const BUILDS = {
  src: { htmlPath: ROOT + '/src/index.html', worldsDir: ROOT + '/src/worlds' },
  main: { htmlPath: ROOT + '/main/index.html', worldsDir: ROOT + '/main/worlds' },
};
const CHECKPOINTS = [0, 9, 10, 11, 25];
const unhandled = [];
let phase = 'init';
process.on('unhandledRejection', (e) => { unhandled.push(phase + ': ' + String((e && e.stack) || e).split(/\r?\n/).slice(0, 3).join(' <- ').slice(0, 220)); });

const pages = [];
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';

async function page(build, store) {
  const h = await boot({ htmlPath: BUILDS[build].htmlPath, worldsDir: BUILDS[build].worldsDir, setup(w, m) { m.store = store; } });
  pages.push({ build, h });
  await h.settle(150, 6000); await h.idle(8000);
  return h;
}
async function begin(h) { h.click('#cBegin'); await h.settle(100, 8000); await h.idle(15000); }
function feed(h) {
  return [...h.document.querySelectorAll('#feed article.turn')].filter((e) => !e.classList.contains('draft')).map((e) => {
    const n = ((e.querySelector('.turn-meta .n') || {}).textContent || '').trim();
    const a = e.querySelector('.turn-action');
    const narr = (e.querySelector('.narr') || {}).textContent || '';
    const m = /Turn (\d+)\./.exec(narr);
    return { n, action: a && a.firstChild ? String(a.firstChild.textContent).trim() : '', marker: m ? m[1] : null };
  });
}
function closeAdv(h) { const d = h.$('#dlgAdventures'); if (d && d.hasAttribute('open')) d.close(); }
async function listRows(h) {
  h.click('#btnAdventures'); await h.sleep(20); await h.settle(80, 4000);
  return [...h.document.querySelectorAll('#advlist .advrow')].map((r) => ({ title: r.querySelector('.t').textContent, meta: r.querySelector('.m').textContent, open: r.querySelector('[data-act="open"]') }));
}
async function current(h) { const rows = await listRows(h); const c = rows.find((r) => r.open && r.open.textContent === 'Current'); closeAdv(h); return c ? c.title : null; }
const statusOf = (h) => ((h.$('#status') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140);
async function exportNow(h) {
  const before = h.mock.downloadsLog.length;
  h.click('#btnAdventures'); await h.settle(80, 4000);
  h.click('#exportAdv'); await h.sleep(20); await h.settle(80, 4000);
  closeAdv(h);
  const d = h.mock.downloadsLog[before];
  if (d) return String(d.data);
  const fb = h.$('#exportText') ? h.$('#exportText').value : (h.$('#exportFallback') || {}).textContent;
  return fb || null;
}
async function importText(h, text, name) {
  const win = h.window; const file = new win.File([text], name || 'save.json', { type: 'application/json' });
  const inp = h.$('#importFile'); Object.defineProperty(inp, 'files', { value: [file], configurable: true });
  inp.dispatchEvent(new win.Event('change', { bubbles: true }));
  await h.sleep(60); await h.settle(200, 15000); await h.idle(15000);
  return statusOf(h);
}
const advDocs = (store) => [...store.keys()].filter((k) => /^adventures\/[^/]+$/.test(k));
const range = (arr) => { if (!arr.length) return 'none'; const out = []; let s = arr[0], p = arr[0]; for (let i = 1; i <= arr.length; i++) { const x = arr[i]; if (x === p + 1) { p = x; continue; } out.push(s === p ? String(s) : s + '-' + p); s = p = x; } return out.join(','); };
function expected(text) { const p = JSON.parse(text); return (p.turns || []).map((t) => ({ n: t.n, action: t.action, marker: (/Turn (\d+)\./.exec(t.narrative || '') || [])[1] || null })); }
function judge(rendered, exp) {
  const got = rendered.filter((r) => r.n !== 'Turn 0');
  const nums = got.map((g) => Number(g.n.replace('Turn ', '')));
  const ok = got.length === exp.length && got.every((g, i) => g.n === 'Turn ' + exp[i].n && g.action === exp[i].action && (exp[i].marker == null || g.marker === exp[i].marker));
  return { ok, count: got.length, want: exp.length, turns: range(nums) };
}

async function runBuild(b) {
  const R = { round: {}, extra: {}, bad: {}, errors: 0, errorSamples: [], violations: [] };
  // 1. play one adventure, exporting at 0, 9, 10, 11, 25 turns
  const S0 = new Map();
  const A = await page(b, S0); await begin(A);
  const exportsByN = {}; let played = 0;
  for (const cp of CHECKPOINTS) { while (played < cp) { played++; await A.turn('Action ' + played); } exportsByN[cp] = await exportNow(A); }
  R.playedOnA = feed(A).length - 1; R.exports = exportsByN;
  R.exportTurns = CHECKPOINTS.map((cp) => cp + ':' + (exportsByN[cp] ? (JSON.parse(exportsByN[cp]).turns || []).length : 'NO-FILE')).join(' ');
  console.log('[' + b + '] played ' + R.playedOnA + ' turns, exports ' + R.exportTurns + ' (' + el() + ')');
  phase = b + ' baseline-undo';
  { // baseline: undo twice on the normally played 25-turn game, reload on a second page
    const e0 = A.errors.length;
    A.click('#undo'); await A.sleep(30); await A.idle(8000); const u1 = feed(A).length - 1;
    A.click('#undo'); await A.sleep(30); await A.idle(8000); const u2 = feed(A).length - 1;
    const uErr = A.errors.slice(e0).map((e) => e.message.split('\n')[0].slice(0, 100));
    A.close(); const A3 = await page(b, S0); const f3 = feed(A3); A3.close();
    R.baselineUndo = 'after undo1=' + u1 + ' undo2=' + u2 + ' errs=' + uErr.length + (uErr.length ? ' ' + uErr[0] : '') + ' | reload=' + (f3.length - 1);
  }

  // 2. import each into a fresh store (page A2 has its own open adventure), then load it on a second page B
  for (const cp of CHECKPOINTS) {
    phase = b + ' import N=' + cp;
    const exp = expected(exportsByN[cp]);
    const S = new Map();
    const A2 = await page(b, S); await begin(A2); await A2.turn('Base 1');
    const st = await importText(A2, exportsByN[cp], 'save-' + cp + '.json');
    const inMem = judge(feed(A2), exp);
    A2.close();
    const B = await page(b, S);
    const autoCur = await current(B);
    const auto = judge(feed(B), exp);
    // explicit open from the Adventures dialog (switch to the base adventure first if needed, then Continue on the import)
    let rows = await listRows(B); let imp = rows.find((r) => /\(imported\)/.test(r.title));
    if (imp && imp.open.textContent === 'Current') { const base = rows.find((r) => !/\(imported\)/.test(r.title)); base.open.click(); await B.idle(8000); rows = await listRows(B); imp = rows.find((r) => /\(imported\)/.test(r.title)); }
    const listedMeta = imp ? imp.meta.split('·')[1].trim() : 'no row';
    if (imp) { imp.open.click(); await B.idle(8000); } closeAdv(B);
    const explicit = judge(feed(B), exp);
    const expCur = await current(B);
    R.round[cp] = { importStatus: st, inMem, autoCur, auto, explicit, expCur, listedMeta };
    // 3. normal flow after import: take a turn on B, reload on a third page C
    if (cp === 11 || cp === 25) {
      await B.turn('After import');
      const fb = feed(B); const last = fb[fb.length - 1];
      B.close();
      const C = await page(b, S);
      const fc = feed(C); const cCur = await current(C);
      const exp2 = exp.concat([{ n: exp.length + 1, action: 'After import', marker: null }]);
      R.extra[cp] = { onB: fb.length - 1 + ' turns, last=' + (last && last.n) + ' ' + (last && last.action), reloadC: judge(fc, exp2), cCur };
      if (cp === 25) {
        phase = b + ' undo-after-import';
        // undo twice on the reloaded import, then reload on page D
        const e0 = C.errors.length;
        C.click('#undo'); await C.sleep(30); await C.idle(8000); const u1 = feed(C).length - 1;
        C.click('#undo'); await C.sleep(30); await C.idle(8000); const u2 = feed(C).length - 1;
        const uErr = C.errors.slice(e0).map((e) => e.message.split('\n')[0].slice(0, 100));
        C.close();
        const D = await page(b, S); const fd = feed(D);
        R.extra[cp].undo = 'after undo1=' + u1 + ' undo2=' + u2 + ' errs=' + uErr.length + (uErr.length ? ' ' + uErr[0] : '') + ' | reload D=' + (fd.length - 1) + ' [' + range(fd.slice(1).map((x) => Number(x.n.replace('Turn ', '')))) + ']';
        D.close();
      } else C.close();
    } else B.close();
    console.log('[' + b + '] N=' + cp + ' import="' + st.slice(0, 60) + '" B-auto=' + JSON.stringify(auto) + ' B-explicit=' + JSON.stringify(explicit) + ' list=' + listedMeta + (R.extra[cp] ? ' extra=' + JSON.stringify(R.extra[cp]) : '') + ' (' + el() + ')');
  }

  // 4. bad imports: page must stay usable on the adventure that was open
  const base9 = JSON.parse(exportsByN[9]);
  const noState = JSON.parse(JSON.stringify(base9)); delete noState.adventure.state; delete noState.adventure.memory;
  const badTurn = JSON.parse(JSON.stringify(base9)); delete badTurn.turns[3].stateBefore; delete badTurn.turns[3].stateAfter;
  const variants = { malformed: '{"format":"windlass-save-1","adventure":{"title":"Broken', missingStateMemory: JSON.stringify(noState), turnMissingState: JSON.stringify(badTurn) };
  for (const [name, text] of Object.entries(variants)) {
    phase = b + ' bad ' + name;
    const S = new Map(); const P = await page(b, S); await begin(P);
    for (let k = 1; k <= 3; k++) await P.turn('Keep ' + k);
    const errs0 = P.errors.length; const docs0 = advDocs(S).length;
    const curBefore = await current(P); const fBefore = feed(P);
    const st = await importText(P, text, name + '.json');
    const curAfter = await current(P); const fAfter = feed(P);
    const sameFeed = JSON.stringify(fAfter) === JSON.stringify(fBefore);
    await P.turn('Keep 4');
    const fTurn = feed(P); const lastT = fTurn[fTurn.length - 1];
    const turnOk = fTurn.length === 5 && lastT.n === 'Turn 4' && lastT.action === 'Keep 4';
    const newErrs = P.errors.slice(errs0).map((e) => e.message.split('\n')[0].slice(0, 120));
    const docs1 = advDocs(S).length;
    P.close();
    const Q = await page(b, S); const fq = feed(Q); const qCur = await current(Q);
    const reloadOk = fq.length === 5 && fq.slice(1).every((x, i) => x.action === 'Keep ' + (i + 1));
    Q.close();
    R.bad[name] = { status: st, curBefore, curAfter, sameFeed, turnOk, lastTurn: lastT ? lastT.n + ' ' + lastT.action : 'none', newErrs, docs: docs0 + '->' + docs1, reloadOk, reloadCur: qCur, reloadTurns: fq.length - 1 };
    console.log('[' + b + '] bad=' + name + ' ' + JSON.stringify(R.bad[name]) + ' (' + el() + ')');
  }
  { // 5. info: a chunk write fails during the import (db 'unavailable' on any turns chunk index 1 or 2)
    phase = b + ' import-db-fail';
    const S = new Map(); const P = await page(b, S); await begin(P);
    for (let k = 1; k <= 3; k++) await P.turn('Keep ' + k);
    const curBefore = await current(P);
    P.mock.dbFail = (op, p) => (op === 'set' && /\/turns\/000[12]$/.test(p) ? { code: 'unavailable', message: 'injected' } : null);
    const st = await importText(P, exportsByN[25], 'dbfail.json');
    P.mock.dbFail = null;
    const curAfter = await current(P); const fA = feed(P);
    const docs = advDocs(S).length; const orphanChunks = [...S.keys()].filter((k) => /\/turns\//.test(k) && !advDocs(S).some((d) => k.startsWith(d + '/'))).length;
    P.close();
    const Q = await page(b, S); const fq = feed(Q); const qCur = await current(Q); Q.close();
    R.dbFailImport = 'status="' + st.slice(0, 80) + '" current ' + (curAfter === curBefore ? 'kept' : 'switched to ' + curAfter) + ' (' + (fA.length - 1) + ' turns shown) | store adv docs=' + docs + ' orphan chunks=' + orphanChunks + ' | reload: ' + qCur + ' ' + (fq.length - 1) + ' turns';
  }
  for (const p of pages.filter((x) => x.build === b)) { R.errors += p.h.errors.length; R.errorSamples.push(...p.h.errors.map((e) => e.message.split('\n')[0].slice(0, 140))); R.violations.push(...p.h.mock.violations.map((v) => v.kind + ': ' + String(v.detail).slice(0, 100))); }
  return R;
}

(async () => {
  const out = {};
  for (const b of ['src', 'main']) out[b] = await runBuild(b);
  { // cross-build: a 25-turn save exported from the PUBLISHED build, imported into the FIXED build, reloaded on a second page
    phase = 'cross';
    const S = new Map(); const P = await page('main', S); await begin(P); await P.turn('Base 1');
    const st = await importText(P, out.src.exports[25], 'old.json'); P.close();
    const Q = await page('main', S); const j = judge(feed(Q), expected(out.src.exports[25])); const cur = await current(Q);
    await Q.turn('After import'); const n2 = feed(Q).length - 1; Q.close();
    const Z = await page('main', S); const n3 = feed(Z).length - 1; Z.close();
    out.cross = (j.ok ? 'PASS' : 'FAIL') + ' status="' + st.slice(0, 60) + '" reload ' + j.count + '/' + j.want + ' [' + j.turns + '] current=' + cur + ' | next turn -> ' + n2 + ', reload -> ' + n3 + ' | violations=' + (Q.mock.violations.length + P.mock.violations.length + Z.mock.violations.length) + ' page errors=' + (Q.errors.length + P.errors.length + Z.errors.length);
  }
  console.log('\n===== SIDE BY SIDE (src = published, main = fixed) =====');
  for (const cp of CHECKPOINTS) {
    const f = (r) => { const x = r.round[cp]; return (x.explicit.ok && x.auto.ok ? 'PASS' : 'FAIL') + ' reload ' + x.auto.count + '/' + x.auto.want + ' [' + x.auto.turns + '] open ' + x.explicit.count + '/' + x.explicit.want + ' [' + x.explicit.turns + '] list says ' + x.listedMeta; };
    console.log('N=' + String(cp).padEnd(2) + ' | src: ' + f(out.src) + '\n      | main: ' + f(out.main));
  }
  for (const cp of [11, 25]) {
    const f = (r) => { const x = r.extra[cp]; return (x.reloadC.ok ? 'PASS' : 'FAIL') + ' B ' + x.onB + ' | reload C ' + x.reloadC.count + '/' + x.reloadC.want + ' [' + x.reloadC.turns + ']'; };
    console.log('turn after import N=' + cp + ' | src: ' + f(out.src) + '\n                     | main: ' + f(out.main));
  }
  console.log('undo x2 on reloaded 25-turn import | src: ' + out.src.extra[25].undo + '\n                                  | main: ' + out.main.extra[25].undo);
  console.log('undo x2 baseline (normal 25-turn game) | src: ' + out.src.baselineUndo + '\n                                      | main: ' + out.main.baselineUndo);
  for (const name of ['malformed', 'missingStateMemory', 'turnMissingState']) {
    const f = (r) => { const x = r.bad[name]; const pass = x.curAfter === x.curBefore && x.curAfter && x.sameFeed && x.turnOk && x.reloadOk && !x.newErrs.length; return (pass ? 'PASS' : 'FAIL') + ' status="' + x.status.slice(0, 70) + '" current=' + (x.curAfter === x.curBefore ? 'kept' : 'LOST(' + x.curAfter + ')') + ' nextTurn=' + (x.turnOk ? 'ok' : 'BROKEN(' + x.lastTurn + ')') + ' errs=' + x.newErrs.length + ' docs ' + x.docs + ' reload ' + x.reloadTurns + ' turns'; };
    console.log('bad ' + name.padEnd(18) + ' | src: ' + f(out.src) + '\n                        | main: ' + f(out.main));
  }
  console.log('cross: published 25-turn export imported into fixed build | ' + out.cross);
  console.log('info: chunk write fails during 25-turn import | src: ' + out.src.dbFailImport + '\n                                              | main: ' + out.main.dbFailImport);
  for (const b of ['src', 'main']) console.log(b + ' totals: page errors=' + out[b].errors + ' ' + JSON.stringify([...new Set(out[b].errorSamples)].slice(0, 4)) + ' | violations=' + out[b].violations.length + ' ' + JSON.stringify([...new Set(out[b].violations)].slice(0, 4)));
  console.log('unhandled rejections: ' + unhandled.length + ' ' + JSON.stringify(unhandled.slice(0, 3)));
  console.log('elapsed ' + el());
  for (const p of pages) { try { p.h.close(); } catch (e) {} }
  process.exit(0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
