// mythaven-roommate-name: does the Mythaven Turn 0 (template roommate intro), the cast and the turn prompt always name the
// actual roommate (adv.roommate), for every species template and gender, with the default (dialog-drawn) name and a typed one?
// Runs the same scenario on the published build (src) and the fixed build (main) and prints a side-by-side summary.
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const B = (process.env.WL_ROOT ? process.env.WL_ROOT + '/' : 'C:/Users/marcu/AppData/Local/Temp/wl-harness/');
const BUILDS = { pub: { html: B + 'src/index.html', worlds: B + 'src/worlds' }, fix: { html: B + 'main/index.html', worlds: B + 'main/worlds' } };
const SPECIES = ['cow', 'wolf', 'harpy', 'goblin', 'fairy', 'fox', 'cat', 'mer', 'dryad'];
// Names the nine authored templates use for their own character (first names and surnames); a wrong one in the roommate's
// text means the intro names someone other than the roommate.
const TEMPLATE_NAMES = { cow: { female: 'Marisol Vega', male: 'Mateo Vega' }, wolf: { female: 'Sasha Greyle', male: 'Kit Greyle' }, harpy: { female: 'Juniper Ashwing' }, goblin: { female: 'Nettle Brasswick', male: 'Fennick Brasswick' }, fairy: { female: 'Bramble Ashfeather', male: 'Wisp Ashfeather' }, fox: { female: 'Hana Kitsuragi', male: 'Ren Kitsuragi' }, cat: { female: 'Mina Sorrel', male: 'Jasper Sorrel' }, mer: { female: 'Delphine Tarn', male: 'Caspian Tarn' }, dryad: { female: 'Willa Greenhollow', male: 'Ash Greenhollow' } };
const TOKENS = [...new Set(Object.values(TEMPLATE_NAMES).flatMap((g) => Object.values(g)).flatMap((n) => n.split(' ')))];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text, w) => !!w && new RegExp('(^|[^A-Za-z])' + escRe(w) + '([^A-Za-z]|$)').test(text);
const ctx = (text, w) => { const m = new RegExp('(^|[^A-Za-z])' + escRe(w) + '([^A-Za-z]|$)').exec(text); return m ? text.slice(Math.max(0, m.index - 40), m.index + w.length + 30).replace(/\s+/g, ' ').replace(/"/g, "'") : ''; };
const toks = (name) => String(name || '').split(/\s+/).filter(Boolean);
function findRoommate(o, depth = 0) { if (!o || typeof o !== 'object' || depth > 6) return null; if (o.roommate && o.roommate.key === 'roommate' && o.roommate.name) return o.roommate; for (const v of Object.values(o)) { const r = findRoommate(v, depth + 1); if (r) return r; } return null; }
function findPlayer(o) { return (o && o.player) || null; }
const advKeys = (h) => [...h.mock.store.keys()].filter((k) => /^adventures\/[^/]+$/.test(k));

async function openMythaven(h) {
  h.click('#btnAdventures'); await h.idle();
  h.$('#newWorld').value = 'mythaven';
  h.click('#newAdv'); await h.idle();
  if (!h.$('#dlgCreate').hasAttribute('open')) throw new Error('create dialog did not open');
}
function castNames(h) {
  h.click('#btnCast');
  const out = [...h.document.querySelectorAll('#castList button')].map((b) => { const k = b.querySelector('.k'); const key = k ? k.textContent : ''; let t = b.textContent; if (key && t.endsWith(key)) t = t.slice(0, -key.length); const name = t.replace(/\s*·\s*removed$/, '').replace(/\s*\*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim(); return { key, name }; });
  const d = h.$('#dlgCast'); if (d && d.hasAttribute('open')) d.close();
  return out;
}
// One creation: species/gender typed into the dialog (or left as the dialog drew them), name default or typed.
async function create(h, o) {
  await openMythaven(h);
  if (o.species !== undefined) h.type('#cRmSpecies', o.species);
  if (o.gender) { const opts = [...h.$('#cRmGender').options].map((x) => x.value); if (!opts.includes(o.gender)) return { skip: true }; h.type('#cRmGender', o.gender); }
  if (o.name !== undefined) h.type('#cRmName', o.name);
  const shown = { species: h.$('#cRmSpecies').value, gender: h.$('#cRmGender').value, name: h.$('#cRmName').value };
  const before = new Set(advKeys(h));
  h.click('#cBegin'); await h.idle();
  const nk = advKeys(h).filter((k) => !before.has(k));
  if (nk.length !== 1) return { shown, err: 'new adventure docs: ' + nk.length };
  const doc = h.mock.store.get(nk[0]).data; const r = findRoommate(doc); const p = findPlayer(doc);
  const t0el = h.document.querySelector('#feed .turn'); const t0 = t0el ? t0el.textContent : '';
  return { shown, r, p, t0, key: nk[0] };
}
function judge(res, cast, prompt) {
  const r = res.r; const own = new Set(toks(r.name)); const playerT = new Set(toks(res.p && res.p.name));
  const wrong = TOKENS.filter((t) => !own.has(t) && !playerT.has(t));
  const first = r.first || toks(r.name)[0]; const last = r.last || toks(r.name).slice(1).join(' ');
  const out = { t0Wrong: wrong.filter((t) => hasWord(res.t0, t)).map((t) => t + ' in ' + ctx(res.t0, t)), t0Missing: [first, last].filter((x) => x && !hasWord(res.t0, x)) };
  if (cast) {
    const names = cast.map((c) => c.name); const dup = names.filter((n, i) => names.indexOf(n) !== i);
    const rmEntry = cast.find((c) => c.key === 'roommate');
    out.castDup = [...new Set(dup)]; out.castRm = rmEntry ? (rmEntry.name === r.name ? 'ok' : 'cast says ' + rmEntry.name) : 'no roommate entry';
    out.castOther = cast.filter((c) => c.key !== 'roommate' && (c.name === r.name)).map((c) => c.key);
  }
  if (prompt) {
    // the real block opens at the start of a line (rules text also mentions '<characters>' inline)
    const blk = (tag) => { const m = new RegExp('^<' + tag + '(?: [^>]*)?>([\\s\\S]*?)</' + tag + '>', 'm').exec(prompt); return m ? m[1] : ''; };
    const chars = blk('characters'); const rec = blk('recent_turns');
    const rmLine = (chars.split('\n').find((l) => /\[key: roommate\]/.test(l)) || '');
    const otherCastTok = new Set(cast ? cast.filter((c) => c.key !== 'roommate').flatMap((c) => toks(c.name)) : []);
    out.pRmLine = rmLine.startsWith('- ' + r.name + ' (') ? 'ok' : 'roommate line: ' + rmLine.slice(0, 60);
    out.pRecentWrong = wrong.filter((t) => hasWord(rec, t)).map((t) => t + ' in ' + ctx(rec, t));
    out.pRmLineWrong = wrong.filter((t) => hasWord(rmLine, t));
    // the per-adventure blocks (state, clock, summary, facts, timeline): world-authored blocks (characters, lore, rules) legitimately name
    // other people who share a template token (Master Quillon Brasswick, Rook and Ash, the standalone Marisol Vega)
    const dyn = ['state', 'clock', 'summary', 'facts', 'timeline'].map(blk).join(' \n ');
    out.pAllWrong = wrong.filter((t) => hasWord(dyn, t)).map((t) => t + ' in ' + ctx(dyn, t));
    const cn = chars.split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2).replace(/\s*\(.*$/, '').replace(/\s*\[.*$/, '').trim());
    out.pCharDup = [...new Set(cn.filter((n, i) => cn.indexOf(n) !== i))];
  }
  return out;
}

async function runBuild(id, mode) {
  const bd = BUILDS[id];
  const h = await boot({ htmlPath: bd.html, worldsDir: bd.worlds, setup(w, m) { if (mode === 'nosample') m.disable.sample = true; } });
  await h.settle(150, 6000); h.click('#cBegin'); await h.idle();
  const rows = []; const S = { n: 0, t0Wrong: 0, t0Missing: 0, castDup: 0, castRm: 0, pRecentWrong: 0, pRmLineWrong: 0, pAllWrong: 0, pCharDup: 0, pRmLine: 0, defaultTemplate: 0, defaultN: 0, ex: [] };
  const record = (label, res, cast, prompt, isDefault, tmpl) => {
    if (res.skip) return; if (res.err || !res.r) { S.ex.push(label + ' ERR ' + (res.err || 'no roommate')); return; }
    const j = judge(res, cast, prompt); S.n++;
    if (isDefault) { S.defaultN++; if (tmpl && res.r.name === tmpl) S.defaultTemplate++; }
    const bad = [];
    if (j.t0Wrong.length) { S.t0Wrong++; bad.push('T0 wrong ' + j.t0Wrong.join(' / ')); }
    if (j.t0Missing.length) { S.t0Missing++; bad.push('T0 lacks ' + j.t0Missing.join(',')); }
    if (j.castDup && j.castDup.length) { S.castDup++; bad.push('cast dup ' + j.castDup.join(',')); }
    if (j.castRm && j.castRm !== 'ok') { S.castRm++; bad.push(j.castRm); }
    if (prompt) {
      if (j.pRecentWrong.length) { S.pRecentWrong++; bad.push('prompt recent_turns wrong ' + j.pRecentWrong.join(' / ')); }
      if (j.pRmLineWrong.length) { S.pRmLineWrong++; bad.push('prompt rm line wrong ' + j.pRmLineWrong.join(',')); }
      if (j.pAllWrong.length) { S.pAllWrong++; bad.push('prompt state/summary/timeline wrong ' + j.pAllWrong.join(' / ')); }
      if (j.pCharDup.length) { S.pCharDup++; bad.push('prompt characters dup ' + j.pCharDup.join(',')); }
      if (j.pRmLine !== 'ok') { S.pRmLine++; bad.push(j.pRmLine); }
    }
    const line = label + ' | rm ' + res.r.name + ' (' + res.r.species + '/' + res.r.gender + ', replaces ' + (res.r.replaces || '-') + ') | ' + (bad.length ? 'BAD: ' + bad.join(' ; ') : 'ok');
    rows.push(line); if (bad.length && S.ex.length < 40) S.ex.push(line);
  };
  const withPrompt = mode === 'sample';
  const turnPrompt = async () => { const n1 = h.mock.sampleCalls.length; await h.turn('Look around the room'); const c = h.mock.sampleCalls.slice(n1).find((x) => { const p = typeof x.input === 'string' ? x.input : x.input.map((m) => m.content).join('\n'); return /<characters/.test(p) && /<recent_turns/.test(p); }); return c ? (typeof c.input === 'string' ? c.input : c.input.map((m) => m.content).join('\n')) : ''; };
  for (const sp of SPECIES) {
    for (const g of Object.keys(TEMPLATE_NAMES[sp])) {
      const tmpl = TEMPLATE_NAMES[sp][g];
      const reps = withPrompt ? 1 : 3;
      for (let i = 0; i < reps; i++) {
        const res = await create(h, { species: sp, gender: g }); const cast = res.r ? castNames(h) : null; const prompt = withPrompt && res.r ? await turnPrompt() : null;
        record(id + ' ' + mode + ' ' + sp + '/' + g + ' default#' + (i + 1) + ' shown=' + (res.shown && res.shown.name), res, cast, prompt, true, tmpl);
      }
      const res = await create(h, { species: sp, gender: g, name: 'Quill Hartley' }); const cast = res.r ? castNames(h) : null; const prompt = withPrompt && res.r ? await turnPrompt() : null;
      record(id + ' ' + mode + ' ' + sp + '/' + g + ' typed', res, cast, prompt, false);
    }
  }
  // extra routes: blank species (template cow, generic name), custom species, single-word name, untouched random dialog,
  // and cow/female with the name field cleared (does the replace/duplicate behaviour depend on the dialog-filled name?)
  const extras = [['blank-species', { species: '' }], ['custom basilisk/nonbinary', { species: 'basilisk', gender: 'nonbinary' }], ['cow/female one-word', { species: 'cow', gender: 'female', name: 'Quill' }], ['cow/female name cleared', { species: 'cow', gender: 'female', name: '' }], ['harpy typed', { species: 'harpy', gender: 'female', name: 'Selene Marsh' }]];
  for (let i = 0; i < (withPrompt ? 2 : 8); i++) extras.push(['untouched#' + (i + 1), {}]);
  for (const [lab, o] of extras) { const res = await create(h, o); const cast = res.r ? castNames(h) : null; const prompt = withPrompt && res.r ? await turnPrompt() : null; record(id + ' ' + mode + ' ' + lab + ' shown=' + (res.shown && (res.shown.species + '/' + res.shown.gender + '/' + res.shown.name)), res, cast, prompt, false); }
  S.errors = h.errors.length; S.errorMsgs = h.errors.slice(0, 2).map((e) => e.message.slice(0, 160)); S.violations = h.mock.violations.length; S.violKinds = [...new Set(h.mock.violations.map((v) => v.kind))];
  h.close();
  return { S, rows };
}

(async () => {
  const t0 = Date.now(); const all = {};
  for (const mode of ['nosample', 'sample']) for (const id of ['pub', 'fix']) { all[id + '/' + mode] = await runBuild(id, mode); }
  const verbose = process.argv.includes('-v');
  for (const [k, v] of Object.entries(all)) {
    console.log('=== ' + k + ' rows (bad only' + (verbose ? ', -v all' : '') + ')');
    (verbose ? v.rows : v.S.ex).forEach((l) => console.log('  ' + l));
  }
  console.log('=== SUMMARY (side by side)');
  const f = (S) => 'n=' + S.n + ' T0wrongName=' + S.t0Wrong + ' T0missingRmName=' + S.t0Missing + ' castDup=' + S.castDup + ' castRmMismatch=' + S.castRm + ' promptRecentWrong=' + S.pRecentWrong + ' promptRmLineWrong=' + S.pRmLineWrong + ' promptStateTimelineWrong=' + S.pAllWrong + ' promptCharDup=' + S.pCharDup + ' promptRmLineBad=' + S.pRmLine + ' defaultIsTemplateName=' + S.defaultTemplate + '/' + S.defaultN + ' errors=' + S.errors + ' violations=' + S.violations + (S.violKinds.length ? ' ' + S.violKinds.join(',') : '') + (S.errorMsgs.length ? ' err1=' + S.errorMsgs[0] : '');

  for (const [k, v] of Object.entries(all)) console.log(k.padEnd(14) + ' ' + f(v.S));
  console.log('elapsed ' + Math.round((Date.now() - t0) / 1000) + ' s');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
