// stored-xss: crafted saves with HTML payloads in numeric-looking and string fields, delivered by Import and by a
// document already in the store before boot (zero-click). Published (src) vs fixed (main), side by side.
// Detection (any one = injected):
//   sink : raw payload markup (<img|svg ... data-f=TAG>) handed to innerHTML / outerHTML / insertAdjacentHTML (detached nodes count: a real browser fires their handlers)
//   dom  : payload elements ([data-f]) or on* attributes carrying __pwned in the live document
//   pwned: after firing error/load on every injected img/svg (jsdom has no image loading), window.__pwned is set
const { boot } = require((process.env.WL_ROOT || (__dirname + '/..')) + '/boot');
const H = (process.env.WL_ROOT ? process.env.WL_ROOT + '/' : 'C:/Users/marcu/AppData/Local/Temp/wl-harness/');
const BUILDS = { src: { htmlPath: H + 'src/index.html', worldsDir: H + 'src/worlds' }, main: { htmlPath: H + 'main/index.html', worldsDir: H + 'main/worlds' } };
const clone = (x) => JSON.parse(JSON.stringify(x));
const P = (tag) => '"><img src=x onerror=window.__pwned=1 data-f=' + tag + '><svg data-f=' + tag + ' onload=window.__pwned=2>';

function instrument(win) {
  win.__sink = []; win.__injEls = []; win.__mo = new Set();
  const re = /<(?:img|svg)\b[^>]*\bdata-f=([\w-]+)/gi;
  const rec = (html, el, sink) => {
    const s = String(html); let m; const tags = new Set(); re.lastIndex = 0;
    while ((m = re.exec(s))) tags.add(m[1]);
    if (tags.size) win.__sink.push({ sink, at: (el && (el.id || el.className || el.tagName)) || '?', tags: [...tags] });
    return tags.size;
  };
  const findDesc = (name) => { let p = win.Element.prototype; while (p) { const d = Object.getOwnPropertyDescriptor(p, name); if (d) return [p, d]; p = Object.getPrototypeOf(p); } return [null, null]; };
  for (const name of ['innerHTML', 'outerHTML']) {
    const [p, d] = findDesc(name); if (!d || !d.set) continue;
    Object.defineProperty(win.Element.prototype, name, { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { const hit = rec(v, this, name); const parent = name === 'outerHTML' ? this.parentNode : null; d.set.call(this, v); if (hit) { const root = name === 'outerHTML' ? parent : this; if (root && root.querySelectorAll) win.__injEls.push(...root.querySelectorAll('[data-f]')); } } });
  }
  const iah = win.Element.prototype.insertAdjacentHTML;
  win.Element.prototype.insertAdjacentHTML = function (pos, html) { const hit = rec(html, this, 'insertAdjacentHTML'); const r = iah.call(this, pos, html); if (hit) win.__injEls.push(...(this.parentNode || this).querySelectorAll('[data-f]')); return r; };
  const mo = new win.MutationObserver((list) => { for (const r of list) for (const n of r.addedNodes) { if (n.nodeType !== 1) continue; if (n.matches('[data-f]')) win.__mo.add(n.getAttribute('data-f')); n.querySelectorAll('[data-f]').forEach((e) => win.__mo.add(e.getAttribute('data-f'))); } });
  mo.observe(win.document, { childList: true, subtree: true });
}

function scan(h) {
  const w = h.window, d = h.document;
  const domEls = [...d.querySelectorAll('[data-f]')];
  let onAttrs = 0; for (const el of d.querySelectorAll('*')) for (const a of el.attributes) if (/^on/i.test(a.name) && /__pwned/.test(a.value)) onAttrs++;
  const all = new Set([...domEls, ...w.__injEls]);
  for (const el of all) { try { el.dispatchEvent(new w.Event(el.tagName.toLowerCase() === 'img' ? 'error' : 'load')); } catch (e) {} }
  const textHits = (d.body.textContent.match(/data-f=/g) || []).length;   // payload shown as harmless text
  return { domTags: [...new Set(domEls.map((e) => e.getAttribute('data-f')))], onAttrs, pwned: w.__pwned, textHits };
}

// ---------- the crafted saves ----------
function poison(base, variant) {
  const p = clone(base); const a = p.adventure; const S = a.state; const turns = p.turns;
  if (variant === 'CLEAN') return p;
  // isolated vectors: one poisoned field in an otherwise clean, valid save
  if (variant === 'TRKI') { S.tf.tracks[0].i = '<img src=x onerror=window.__pwned=1 data-f=trki>'; return p; }
  if (variant === 'ALTS') { turns[turns.length - 1].alts = { length: '<img src=x onerror=window.__pwned=1 data-f=alts>' }; return p; }
  a.title = P('title');
  a.player.name = P('pname'); a.player.first = P('pfirst'); a.player.last = P('plast');
  for (const k of Object.keys(a.player.stats)) a.player.stats[k] = P('stat');
  if (a.roommate) { a.roommate.name = P('rmname'); a.roommate.first = P('rmfirst'); a.roommate.race = P('rmrace'); a.roommate.speciesName = P('rmspecies'); a.roommate.brief = P('rmbrief'); }
  const gen = a.cast && a.cast.generated && a.cast.generated.characters;
  if (gen) gen.slice(0, 3).forEach((c, i) => { c.name = P('cname'); c.first = P('cfirst'); c.last = P('clast'); c.race = P('crace'); c.looks = P('clooks'); c.brief = P('cbrief'); c.sheet = P('csheet'); c.aliases = [P('calias')]; });
  a.cast.added = [{ key: 'xssadded', name: P('addname'), first: P('addfirst'), last: 'X', race: P('addrace'), looks: P('addlooks'), brief: P('addbrief'), sheet: P('addsheet'), aliases: [], pronouns: { they: 'they', them: 'them', their: 'their', theirs: 'theirs' }, attitude: 5 }];
  S.attitudes.xssadded = P('attadded');
  for (const k of Object.keys(S.attitudes)) S.attitudes[k] = P('att');
  for (const k of Object.keys(S.tf.influence)) S.tf.influence[k] = P('infl');
  if (S.skills) for (const k of Object.keys(S.skills)) S.skills[k] = P('skill');
  S.tf.traits.forEach((t) => { t.day = P('trday'); });
  S.tf.sex = { day: P('sexday'), species: 'cow', to: 'female' };
  (S.tf.tracks || []).forEach((t) => { t.i = P('trki'); t.steps = { length: P('trksteps'), 0: 'a' }; });
  S.location = P('loc'); S.weekday = P('wday'); S.present = [P('present')];
  S.items.condition = P('cond'); S.items.inventory = [P('inv')]; S.flags[P('flagkey')] = true;
  a.memory.facts = [P('fact')]; a.memory.events.push(P('event'), 'Day 1 10:00 ' + P('eventfmt')); a.memory.beats.push(P('beat')); a.memory.summary = P('summary');
  a.pendingNotes = [P('pnote')]; a.settings.testNote = P('testnote');
  if (a.opening) { a.opening.narrative = P('opnarr'); a.opening.suggestions = [P('opsug')]; }
  turns.forEach((t, i) => {
    t.action = P('action'); t.director = P('director'); t.rewrite = P('rewrite'); t.narrative = P('narr'); t.suggestions = [P('sug')]; t.secret = P('secret');
    t.events = [P('tevent')]; t.facts = [P('tfact')]; t.notes = ['clamped ' + P('note')]; t.diff = [{ path: P('diffpath'), from: P('difffrom'), to: P('diffto') }];
    t.words = P('words'); t.timing = { first: P('timfirst'), total: P('timing') }; t.tierApplied = P('tier'); t.id = P('tid');
    t.evaluation = { stat: 'nerve', outcome: P('evout'), difficulty: P('evdiff') }; t.roll = { d6: P('rolld6'), stat: 'nerve', statValue: P('rollsv'), total: P('rolltot'), outcome: P('evout') };
    t.exposures = [{ species: 'cow', method: P('expmethod'), intensity: P('intens') }];
    t.stateBefore.location = P('sbloc'); t.stateBefore.time = P('sbtime'); t.stateAfter.time = P('satime');
    if (i === turns.length - 1) t.alts = { length: P('alts') };
  });
  if (variant === 'FULL') {
    S.day = P('day'); S.time = P('time');
    turns.forEach((t, i) => { t.n = P('n' + i); t.stateBefore.day = P('sbday'); t.stateAfter.day = P('saday'); });
  }
  a.turnCount = turns.length;
  return p;
}

async function makeBase() {
  const h = await boot(BUILDS.src);
  await h.settle(150, 6000); h.click('#cBegin'); await h.idle();
  await h.turn('Look around');
  h.click('#btnOverride'); await h.idle();
  const mb = h.document.querySelector('#ovrInfluence [data-manifest]'); if (mb) { h.click(mb); await h.idle(); }
  await h.turn('Walk on');
  h.click('#btnAdventures'); await h.idle(); h.click('#exportAdv'); await h.idle();
  const p = JSON.parse(h.mock.downloadsLog[0].data);
  h.close();
  return p;
}

async function steps(h, out) {
  const snap = (name) => { const s = scan(h); out.steps.push(Object.assign({ step: name, sinkTags: [...new Set(h.window.__sink.flatMap((x) => x.tags))].length }, s)); };
  snap('load');
  h.click('#btnRail'); await h.idle(); snap('rail');
  if (/show/.test(h.$('#toggleHidden').textContent)) { h.click('#toggleHidden'); await h.idle(); }
  out.spoilers = !h.$('#attPanel').hidden; snap('spoilers');
  h.click('#btnCast'); await h.idle();
  const cb = [...h.document.querySelectorAll('#castList button')].slice(0, 4); for (const b of cb) { h.click(b); await h.idle(); }
  snap('cast');
  h.click('#btnOverride'); await h.idle(); snap('override');
  h.click('#btnAdventures'); await h.idle(); snap('adventures');
  h.click('#btnDebug'); await h.idle(); snap('debug');
  const tags = new Set(h.window.__sink.flatMap((x) => x.tags)); out.steps.forEach((s) => s.domTags.forEach((t) => tags.add(t))); h.window.__mo.forEach((t) => tags.add(t));
  out.tags = [...tags].sort(); out.sinks = [...new Set(h.window.__sink.map((x) => x.at))].slice(0, 12);
  out.pwned = h.window.__pwned; out.onAttrs = Math.max(...out.steps.map((s) => s.onAttrs)); out.textHits = Math.max(...out.steps.map((s) => s.textHits));
  out.feedTurns = h.document.querySelectorAll('#feed .turn').length; out.status = (h.$('#status').textContent || '').slice(0, 90); out.note = h.$('#summaryNote').textContent;
  out.clock = (h.$('#clock').textContent || '').slice(0, 40);
}

async function runImport(build, save, variant) {
  const out = { build, route: 'import', variant, steps: [] };
  const h = await boot(Object.assign({}, BUILDS[build], { setup(w) { instrument(w); } }));
  await h.settle(150, 6000); h.click('#cBegin'); await h.idle();
  h.click('#toggleHidden'); await h.idle();
  const before = { feed: h.document.querySelectorAll('#feed .turn').length };
  h.click('#btnAdventures'); await h.idle();
  const file = new h.window.File([JSON.stringify(save)], 'save.json', { type: 'application/json' });
  const inp = h.$('#importFile'); Object.defineProperty(inp, 'files', { value: [file], configurable: true });
  inp.dispatchEvent(new h.window.Event('change', { bubbles: true })); await h.idle(); await h.settle(100, 6000);
  out.importStatus = (h.$('#status').textContent || '').slice(0, 90);
  out.loaded = /Imported/.test(out.importStatus);
  await steps(h, out);
  if (variant === 'CLEAN') { const n0 = h.document.querySelectorAll('#feed .turn').length; await h.turn('Carry on after import'); out.turnAfter = h.document.querySelectorAll('#feed .turn').length - n0; out.noteAfter = h.$('#summaryNote').textContent; }
  out.errors = h.errors.map((e) => e.message.split('\n')[0].slice(0, 160)); out.viol = h.mock.violations.map((v) => v.kind);
  h.close(); return out;
}

async function runZero(build, save, variant) {
  const out = { build, route: 'store', variant, steps: [] };
  const id = 'advxss' + variant.toLowerCase();
  const doc = clone(save.adventure); doc.id = id; doc.updatedAt = new Date().toISOString(); doc.turnCount = save.turns.length;
  const h = await boot(Object.assign({}, BUILDS[build], { setup(w, m) { instrument(w); if (variant === 'TRKI') { try { w.localStorage.setItem('windlass.spoilers', '1'); } catch (e) {} } m.store.set('adventures/' + id, { data: doc, version: 1 }); m.store.set('adventures/' + id + '/turns/0000', { data: { c: 0, turns: clone(save.turns) }, version: 1 }); } }));
  await h.settle(200, 8000); await h.idle();
  out.bootStatus = (h.$('#status').textContent || '').slice(0, 90); out.bootNote = h.$('#summaryNote').textContent;
  out.createOpen = h.$('#dlgCreate').hasAttribute('open');
  out.loaded = h.document.querySelectorAll('#feed .turn').length === save.turns.length + 1 && !out.createOpen;
  out.spoilersAtBoot = !h.$('#attPanel').hidden;
  await steps(h, out);
  if (variant === 'CLEAN') { const n0 = h.document.querySelectorAll('#feed .turn').length; await h.turn('Carry on after reload'); out.turnAfter = h.document.querySelectorAll('#feed .turn').length - n0; out.noteAfter = h.$('#summaryNote').textContent; }
  out.errors = h.errors.map((e) => e.message.split('\n')[0].slice(0, 160)); out.viol = h.mock.violations.map((v) => v.kind);
  h.close(); return out;
}

(async () => {
  const t0 = Date.now();
  const base = await makeBase();
  console.log('base save: world', base.adventure.worldId, 'turns', base.turns.length, 'traits', base.adventure.state.tf.traits.length, 'tracks', (base.adventure.state.tf.tracks || []).length);
  const results = [];
  for (const variant of (process.argv[2] ? process.argv[2].split(',') : ['CLEAN', 'SHAPE', 'FULL', 'TRKI', 'ALTS'])) {
    const save = poison(base, variant);
    for (const route of ['import', 'store']) for (const build of ['src', 'main']) {
      const r = route === 'import' ? await runImport(build, save, variant) : await runZero(build, save, variant);
      results.push(r);
    }
  }
  console.log('\n=== SIDE BY SIDE (variant / route : src | main) ===');
  const line = (r) => 'pwned=' + r.pwned + ' injected=' + r.tags.length + ' onAttrs=' + r.onAttrs + ' loaded=' + r.loaded + ' errors=' + r.errors.length + ' viol=' + r.viol.length;
  for (const r of results) {
    console.log('\n[' + r.variant + ' / ' + r.route + ' / ' + r.build + '] ' + line(r));
    console.log('  injected fields: ' + (r.tags.join(',') || 'none'));
    console.log('  per step (domTags/sinkTags/pwned): ' + r.steps.map((s) => s.step + '=' + s.domTags.length + '/' + s.sinkTags + '/' + (s.pwned === undefined ? 'u' : s.pwned)).join(' '));
    console.log('  sinks: ' + (r.sinks.join(' ') || 'none') + ' | escaped-text hits=' + r.textHits + ' | spoilers=' + r.spoilers + ' | feedTurns=' + r.feedTurns + ' clock=' + JSON.stringify(r.clock));
    console.log('  status: ' + JSON.stringify(r.importStatus || r.bootStatus) + ' | after steps: ' + JSON.stringify(r.status) + ' | note: ' + JSON.stringify(r.bootNote || r.note) + (r.createOpen != null ? ' | createOpen=' + r.createOpen + ' spoilersAtBoot=' + r.spoilersAtBoot : ''));
    if (r.turnAfter != null) console.log('  normal flow: +' + r.turnAfter + ' turn, note=' + JSON.stringify(r.noteAfter));
    if (r.errors.length) console.log('  errors: ' + r.errors.slice(0, 3).join(' || '));
    if (r.viol.length) console.log('  violations: ' + r.viol.slice(0, 5).join(','));
  }
  console.log('\nelapsed', Math.round((Date.now() - t0) / 1000), 's');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
