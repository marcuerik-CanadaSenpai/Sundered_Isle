// mythaven-roommate-name-challenge: routes the first test did not cover, run on the published build (src) and the fixed build (main):
//  A  species typed by alias (Bovine, Kitsune, Werewolf, Merfolk, Harpy) with the dialog-drawn name
//  B  the name chosen from the suggestions menu (combo) and typed exactly as the template name (cow/female 'Marisol Vega')
//  C  'Randomise everything' pressed until the dialog lands on cow/female (the untouched default flow)
//  D  a creation preset (harpy + 'Perpetua Ross', cow/female default) saved and re-applied
//  E  messy typed names (extra spaces, lowercase, one word)
//  F  continuity: an adventure created on the published build, then opened by the fixed build (shared store) and played one turn
//  G  Sundered (generated roommate) with the model disabled: does the plain intro name the roommate?
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const B = (process.env.WL_ROOT ? process.env.WL_ROOT + '/' : 'C:/Users/marcu/AppData/Local/Temp/wl-harness/');
const BUILDS = { pub: { html: B + 'src/index.html', worlds: B + 'src/worlds' }, fix: { html: B + 'main/index.html', worlds: B + 'main/worlds' } };
const TEMPLATE_NAMES = { cow: { female: 'Marisol Vega', male: 'Mateo Vega' }, wolf: { female: 'Sasha Greyle', male: 'Kit Greyle' }, harpy: { female: 'Juniper Ashwing' }, goblin: { female: 'Nettle Brasswick', male: 'Fennick Brasswick' }, fairy: { female: 'Bramble Ashfeather', male: 'Wisp Ashfeather' }, fox: { female: 'Hana Kitsuragi', male: 'Ren Kitsuragi' }, cat: { female: 'Mina Sorrel', male: 'Jasper Sorrel' }, mer: { female: 'Delphine Tarn', male: 'Caspian Tarn' }, dryad: { female: 'Willa Greenhollow', male: 'Ash Greenhollow' } };
const TOKENS = [...new Set(Object.values(TEMPLATE_NAMES).flatMap((g) => Object.values(g)).flatMap((n) => n.split(' ')))];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text, w) => !!w && new RegExp('(^|[^A-Za-z])' + escRe(w) + '([^A-Za-z]|$)').test(text);
const ctx = (text, w) => { const m = new RegExp('(^|[^A-Za-z])' + escRe(w) + '([^A-Za-z]|$)').exec(text); return m ? text.slice(Math.max(0, m.index - 30), m.index + w.length + 25).replace(/\s+/g, ' ').replace(/"/g, "'") : ''; };
const toks = (name) => String(name || '').split(/\s+/).filter(Boolean);
const advKeys = (h) => [...h.mock.store.keys()].filter((k) => /^adventures\/[^/]+$/.test(k));
function findRoommate(o, d = 0) { if (!o || typeof o !== 'object' || d > 6) return null; if (o.roommate && o.roommate.key === 'roommate' && o.roommate.name) return o.roommate; for (const v of Object.values(o)) { const r = findRoommate(v, d + 1); if (r) return r; } return null; }
const t0Text = (h) => { const el = h.document.querySelector('#feed .turn'); return el ? el.textContent : ''; };
function castNames(h) {
  h.click('#btnCast');
  const out = [...h.document.querySelectorAll('#castList button')].map((b) => { const k = b.querySelector('.k'); const key = k ? k.textContent : ''; let t = b.textContent; if (key && t.endsWith(key)) t = t.slice(0, -key.length); return { key, name: t.replace(/\s*·\s*removed$/, '').replace(/\s*\*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim() }; });
  const d = h.$('#dlgCast'); if (d && d.hasAttribute('open')) d.close();
  return out;
}
async function openWorld(h, world) { h.click('#btnAdventures'); await h.idle(); h.$('#newWorld').value = world; h.click('#newAdv'); await h.idle(); if (!h.$('#dlgCreate').hasAttribute('open')) throw new Error('create dialog did not open'); }
async function begin(h) { const before = new Set(advKeys(h)); h.click('#cBegin'); await h.idle(); const nk = advKeys(h).filter((k) => !before.has(k)); if (nk.length !== 1) return { err: 'new docs ' + nk.length }; const r = findRoommate(h.mock.store.get(nk[0]).data); return { r, t0: t0Text(h), key: nk[0] }; }
function judge(res, h) {
  if (res.err || !res.r) return 'ERR ' + (res.err || 'no roommate');
  const r = res.r; const own = new Set(toks(r.name)); const wrong = TOKENS.filter((t) => !own.has(t) && hasWord(res.t0, t));
  const cast = castNames(h); const names = cast.map((c) => c.name); const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
  const firstShown = hasWord(res.t0, toks(r.name)[0]);
  // the line of Turn 0 that holds the roommate's spoken introduction (the quoted name pair)
  const m = /['"\u2018\u201c]([^'"\u2019\u201d]{1,40})[,.]['"\u2019\u201d] (?:s?he|they) say/.exec(res.t0);
  const said = m ? res.t0.slice(m.index, m.index + 70).replace(/\s+/g, ' ').replace(/"/g, "'") : '';
  return 'rm=' + r.name + ' (' + r.species + '/' + r.gender + ' replaces ' + (r.replaces || '-') + ') T0wrong=' + (wrong.length ? wrong.map((t) => ctx(res.t0, t)).join(' / ') : 'none') + ' firstInT0=' + firstShown + ' castDup=' + (dup.join(',') || 'none') + (said ? ' said=[' + said + ']' : '');
}

async function routesOnBuild(id) {
  const bd = BUILDS[id]; const out = [];
  const h = await boot({ htmlPath: bd.html, worldsDir: bd.worlds, setup(w, m) { m.disable.sample = true; } });
  await h.settle(150, 6000); h.click('#cBegin'); await h.idle();
  // A: alias species
  for (const [sp, g] of [['Bovine', 'female'], ['Kitsune', 'male'], ['Werewolf', 'female'], ['Merfolk', 'male'], ['Harpy', 'female']]) {
    await openWorld(h, 'mythaven'); h.type('#cRmSpecies', sp); h.type('#cRmGender', g); const shown = h.$('#cRmName').value;
    out.push('A alias ' + sp + '/' + g + ' shown=' + shown + ' | ' + judge(await begin(h), h));
  }
  // B1: suggestions menu for cow/female, pick the first suggestion
  await openWorld(h, 'mythaven'); h.type('#cRmSpecies', 'cow'); h.type('#cRmGender', 'female');
  h.document.querySelector('[data-combo="cRmName"]').dispatchEvent(new h.window.MouseEvent('click', { bubbles: true }));
  const opts = [...h.document.querySelectorAll('#comboMenu button')].map((b) => b.textContent);
  const firstOpt = h.document.querySelector('#comboMenu button'); if (firstOpt) firstOpt.dispatchEvent(new h.window.MouseEvent('click', { bubbles: true }));
  out.push('B1 combo cow/female options=[' + opts.join(';') + '] picked=' + h.$('#cRmName').value + ' | ' + judge(await begin(h), h));
  // B2: typed exactly the template name
  await openWorld(h, 'mythaven'); h.type('#cRmSpecies', 'cow'); h.type('#cRmGender', 'female'); h.type('#cRmName', 'Marisol Vega');
  out.push('B2 typed Marisol Vega cow/female | ' + judge(await begin(h), h));
  // B3: typed a different name for cow/female (does a second Creamery cow now exist next to Marisol?)
  await openWorld(h, 'mythaven'); h.type('#cRmSpecies', 'cow'); h.type('#cRmGender', 'female'); h.type('#cRmName', 'Quill Hartley');
  { const res = await begin(h); const line = judge(res, h); const cast = castNames(h); const bov = cast.filter((c) => c.key === 'marisol' || c.key === 'roommate').map((c) => c.name + '[' + c.key + ']'); out.push('B3 typed Quill Hartley cow/female | ' + line + ' bovineCast=' + bov.join(',')); }
  // C: Randomise everything until cow/female
  { let tries = 0, hit = null; await openWorld(h, 'mythaven');
    while (tries < 200) { tries++; h.click('#cRandomAll'); const sp = h.$('#cRmSpecies').value; if (/bovine|cow/i.test(sp) && h.$('#cRmGender').value === 'female') { hit = sp + '/' + h.$('#cRmName').value; break; } }
    out.push('C randomise-all tries=' + tries + ' landed=' + hit + ' | ' + judge(await begin(h), h)); }
  // D: presets
  if (h.mock.store) {
    await openWorld(h, 'mythaven'); h.type('#cRmSpecies', 'harpy'); h.type('#cRmGender', 'female'); h.type('#cRmName', 'Perpetua Ross');
    h.click('#cPresetSave'); h.$('#cPresetName').value = 'harpy-perpetua'; h.click('#cPresetConfirm'); await h.idle();
    h.$('#dlgCreate').close();
    await openWorld(h, 'mythaven'); await h.idle();
    const pk = [...h.mock.store.keys()].filter((k) => /^presets\//.test(k)); const pid = pk.length ? h.mock.store.get(pk[pk.length - 1]).data.id : null;
    h.$('#cPreset').value = pid || ''; h.$('#cPreset').dispatchEvent(new h.window.Event('change', { bubbles: true }));
    out.push('D preset harpy+Perpetua Ross applied shown=' + h.$('#cRmSpecies').value + '/' + h.$('#cRmGender').value + '/' + h.$('#cRmName').value + ' | ' + judge(await begin(h), h));
  }
  // E: messy names
  for (const [sp, g, nm] of [['wolf', 'female', '  quill   hartley  '], ['goblin', 'male', 'Quill'], ['fox', 'female', 'Mary Ann Smith']]) {
    await openWorld(h, 'mythaven'); h.type('#cRmSpecies', sp); h.type('#cRmGender', g); h.type('#cRmName', nm);
    out.push('E ' + sp + '/' + g + ' typed [' + nm + '] | ' + judge(await begin(h), h));
  }
  // G: Sundered generated roommate, model disabled
  for (let i = 0; i < 3; i++) { await openWorld(h, 'sundered'); out.push('G sundered#' + (i + 1) + ' | ' + judge(await begin(h), h)); }
  out.push('ERRORS=' + h.errors.length + (h.errors[0] ? ' ' + h.errors[0].message.slice(0, 120) : '') + ' VIOLATIONS=' + h.mock.violations.length);
  h.close();
  return out;
}

async function continuity() {
  // F: published build creates harpy 'Perpetua Ross' and fox 'Imre Kalda'; fixed build then opens the shared store and plays a turn
  const shared = new Map(); const out = [];
  const p = await boot({ htmlPath: BUILDS.pub.html, worldsDir: BUILDS.pub.worlds, setup(w, m) { m.store = shared; m.disable.sample = true; } });
  await p.settle(150, 6000); p.click('#cBegin'); await p.idle();
  await openWorld(p, 'mythaven'); p.type('#cRmSpecies', 'harpy'); p.type('#cRmGender', 'female'); p.type('#cRmName', 'Perpetua Ross');
  const made = await begin(p); out.push('F pub created | ' + judge(made, p)); p.close();
  const f = await boot({ htmlPath: BUILDS.fix.html, worldsDir: BUILDS.fix.worlds, setup(w, m) { m.store = shared; } });
  await f.settle(150, 6000); await f.idle();
  const r = findRoommate(shared.get(made.key).data); const t0 = t0Text(f);
  const wrongT0 = TOKENS.filter((t) => !toks(r.name).includes(t) && hasWord(t0, t));
  const n1 = f.mock.sampleCalls.length; await f.turn('Say hello to my roommate');
  const call = f.mock.sampleCalls.slice(n1).find((x) => { const s = typeof x.input === 'string' ? x.input : x.input.map((m) => m.content).join('\n'); return /<recent_turns/.test(s); });
  const ps = call ? (typeof call.input === 'string' ? call.input : call.input.map((m) => m.content).join('\n')) : '';
  const rec = (/^<recent_turns(?: [^>]*)?>([\s\S]*?)<\/recent_turns>/m.exec(ps) || [, ''])[1];
  const wrongP = TOKENS.filter((t) => !toks(r.name).includes(t) && hasWord(rec, t));
  out.push('F fix opened pub save: loadedT0len=' + t0.length + ' rm=' + r.name + ' T0wrong=' + (wrongT0.map((t) => ctx(t0, t)).join(' / ') || 'none') + ' | next prompt recent_turns wrong=' + (wrongP.join(',') || 'none') + ' promptFound=' + !!ps + ' errors=' + f.errors.length + ' violations=' + f.mock.violations.length);
  f.close();
  return out;
}

(async () => {
  const t0 = Date.now();
  const res = { pub: await routesOnBuild('pub'), fix: await routesOnBuild('fix') };
  for (let i = 0; i < Math.max(res.pub.length, res.fix.length); i++) { console.log('PUB ' + (res.pub[i] || '')); console.log('FIX ' + (res.fix[i] || '')); console.log(''); }
  (await continuity()).forEach((l) => console.log(l));
  console.log('elapsed ' + Math.round((Date.now() - t0) / 1000) + ' s');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
