'use strict';
// Looks drift: a person's looks are composed from their kind's finished lines for their sex, never invented. For every kind
// with change tracks, and each sex it has, 20 people are drawn at the standard extent and checked for: a by-sex feature of the
// other sex, a watch-list feature (horns on a bovine woman, a tail on a goblin, fairy or dryad, back wings or a beak on a harpy,
// paws for hands, an animal's whole shape or the moon, a mer tail out of water), a missing finished feature, missing boundary
// words, "you" or "your", and a lone shape word for the build. Then every feature is forced to the least and to the most
// column and its wording checked against that column of the range. The prompt side (Not on this body, Dress, the rule that
// keeps the narrator to the looks) is checked on a real adventure. Fails on f73fe18, where the looks were pool prose.
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node looks-drift.js
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { boot } = require('./boot');

const HTML = process.env.WL_HTML || path.join(__dirname, '..', 'windlass', 'index.html');
const WORLDS = process.env.WL_WORLDS || path.join(__dirname, '..', 'windlass', 'worlds');

// The page's person generator (genPerson and the helpers above it), loaded against the world file outside the page.
function loadGenerator() {
  const html = fs.readFileSync(HTML, 'utf8');
  const a = html.indexOf('  // ---------- generated people (worlds with genPools) ----------'), b = html.indexOf('  // A roommate drawn from the pools');
  assert(a > 0 && b > a, 'the person generator was not found in the page');
  const win = {}; new Function('window', fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'))(win);
  const W = Object.values(win.WINDLASS_WORLDS)[0];
  const pre = "const escRe = (s) => s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'); const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;"
    + " const NB = { they: 'they', them: 'them', their: 'their', theirs: 'theirs' };"
    + " function speciesRace(Wc, k) { const sp = Wc.transformation && Wc.transformation.species[k]; return sp ? (sp.race || sp.short) : cap(String(k || '')); }";
  const names = ['genPerson', 'absentText'];
  const api = new Function('W', pre + html.slice(a, b) + '\nreturn {' + names.map((n) => n + ': typeof ' + n + " !== 'undefined' ? " + n + ' : null').join(', ') + '};')(W);
  return Object.assign(api, { W });
}

// What each sex of a kind must never carry, and what no body of the kind has (the doc's leak table and watch list).
const LEAKS = {
  wolf: { female: [/\bmantle\b/i, /\bchest line\b/i, /line of fur from chest/i], male: [/\bfurther pairs\b/i, /\bnipples\b/i] },
  cow: { female: [/\bhorns?\b/i, /\bcrest\b/i, /\bheavy neck\b/i], male: [/\bteats?\b/i, /\budder\b/i, /\bmilk\b/i] },
  fox: { female: [/\bbib\b/i], male: [/\bfurther pairs\b/i, /\bnipples\b/i] },
  cat: { female: [/\bjowls\b/i, /\bthick neck\b/i, /\bheavy (?:neck|forearms)\b/i], male: [/\bfurther pairs\b/i, /\bnipples\b/i] },
  mer: { female: [/\btaller back fin\b/i, /\bbright scales\b/i], male: [] },
  dryad: { female: [/\bshoulder bark\b/i, /\bbark across the shoulders\b/i, /\bcatkins\b/i], male: [/\bflowers?\b/i, /\bfruit\b/i] },
  goblin: { female: [/\btusks?\b/i], male: [] },
  fairy: { female: [/\btinted\b/i], male: [] },
  rabbit: { female: [] },
  harpy: { female: [] }
};
const WATCH = [
  [/\bwhole shape\b|\bwolf'?s shape\b|\bon all fours\b/i, 'an animal\'s whole shape'],
  [/\bmoon\b/i, 'a change with the moon'],
  [/\bpaws? (?:for|in place of|instead of) hands\b|Hands: [^.]*\bpaws?\b/i, 'paws for hands']
];
const KIND_WATCH = {
  goblin: [[/\btail\b/i, 'a tail']], fairy: [[/\btail\b/i, 'a tail']], dryad: [[/\btail\b/i, 'a tail']],
  harpy: [[/\bbeak\b(?<!never a beak)/i, 'a beak'], [/\bwings? (?:on|from|at) (?:the|her) back\b|\bback wings\b|\bshoulder blades?\b/i, 'wings on the back']],
  mer: [[/\btail\b(?![^.]*\bin water\b)(?![^.]*\blegs on land\b)/i, 'a tail out of water']]
};
// Every finished feature once: hands, feet, ears, the tail where the kind has one, arm and leg covering, spine line, face, and the by-sex features.
const FEATURES = {
  all: [[/(?:^|\s)(?:Hands|Fingers and toes|Hands and feet):/, 'hands'], [/(?:^|\s)(?:Feet|Feet and stance|Hind feet|Talons|Hands and feet):/, 'feet'], [/(?:^|\s)(?:Ears|Crest and ears|Finned ears):/, 'ears'], [/(?:^|\s)Face:/, 'face'], [/(?:^|\s)Height:/, 'height'], [/(?:^|\s)Build:/, 'build'], [/(?:^|\s)Eyes:/, 'eyes']],
  tail: { wolf: 'Tail', cow: 'Tail', fox: 'Tail', cat: 'Tail', rabbit: 'Bob tail', harpy: 'Tail fan', mer: 'In water' },
  arms: { wolf: 'Forearm pelt', cow: 'Forearm coat', fox: 'Forearm coat', cat: 'Forearm coat', rabbit: 'Forearm coat', harpy: 'Arm feathers', mer: 'Arm scales', dryad: 'Arm bark', fairy: 'Sheen', goblin: 'Skin' },
  legs: { wolf: 'Leg and hip pelt', cow: 'Leg and hip coat', fox: 'Leg and hip coat', cat: 'Leg and hip coat', rabbit: 'Leg and hip coat', harpy: 'Leg and hip feathers', mer: 'Leg and hip scales', dryad: 'Leg and hip bark', fairy: 'Sheen', goblin: 'Skin' },
  spine: { wolf: 'Spine ruff', cow: 'Spine strip', fox: 'Spine strip', cat: 'Spine line', rabbit: 'Spine strip', harpy: 'Leg and hip feathers', mer: 'Spine ridge', dryad: 'Spine ridge', fairy: 'Sheen' },
  female: { wolf: ['Further pairs of nipples'], cow: ['Teats and udder'], fox: ['Further pairs of nipples'], cat: ['Further pairs of nipples'], rabbit: ['Further pairs of nipples'], mer: ['Breasts'], dryad: ['Breasts', 'In season'], goblin: ['Figure'], fairy: ['Figure'], harpy: [] },
  male: { wolf: ['Mantle'], cow: ['Horns and crest'], fox: ['Bib'], cat: ['Tom\'s build'], mer: ['Colours'], dryad: ['Shoulder bark', 'In season'], goblin: ['Frame'], fairy: ['Frame'] }
};
// At the standard extent the coverings stop where the doc draws them: the hands to the elbows, the feet to the hips fading at the navel.
const BOUNDS = { wolf: ['elbow', 'navel'], cow: ['elbow', 'navel'], fox: ['elbow', 'navel'], cat: ['elbow', 'navel'], mer: ['elbow', 'navel'], dryad: ['elbow', 'navel'], rabbit: ['elbow'], harpy: ['navel'] };
const has = (looks, label) => new RegExp('(?:^|\\s)' + label.replace(/[.*+?^${}()|[\]\\']/g, '\\$&') + ':').test(looks);
const N = 20;

const failures = [];
const fail = (what) => { failures.push(what); };

const G = loadGenerator();
const W = G.W, TR = W.transformation.tracks.species;
const kinds = Object.keys(TR);
assert.deepEqual(kinds.slice().sort(), Object.keys(LEAKS).sort(), 'every kind with tracks is checked');

// 1. Twenty at the standard extent, per kind and sex.
for (const k of kinds) {
  const sp = W.genPools.species[k];
  assert.deepEqual(sp.genders.slice().sort(), Object.keys(LEAKS[k]).sort(), k + ': rabbit and harpy are women only; the rest have both');
  for (const g of sp.genders) {
    for (let i = 0; i < N; i++) {
      const p = G.genPerson(W, { species: k, gender: g, extent: 0 }), L = String(p.looks || ''), tag = k + ' ' + g + ' #' + i;
      for (const re of LEAKS[k][g]) if (re.test(L)) fail(tag + ': the other sex\'s feature ' + re + ' in "' + L.slice(0, 160) + '…"');
      for (const [re, what] of WATCH.concat(KIND_WATCH[k] || [])) if (re.test(L)) fail(tag + ': ' + what);
      for (const [re, what] of FEATURES.all) if (!re.test(L)) fail(tag + ': no ' + what);
      for (const part of ['tail', 'arms', 'legs', 'spine']) { const label = FEATURES[part][k]; if (label && !has(L, label)) fail(tag + ': no ' + part + ' (' + label + ')'); }
      for (const label of FEATURES[g][k] || []) if (!has(L, label)) fail(tag + ': no by-sex feature ' + label);
      if (g === 'female' && !has(L, 'Bust')) fail(tag + ': no bust');
      for (const w of BOUNDS[k] || []) if (!new RegExp('\\b' + w).test(L)) fail(tag + ': no boundary word "' + w + '"');
      if (/\byou(?:r|rs|rself)?\b/i.test(L)) fail(tag + ': "you" in the looks');
      const build = (/(?:^|\s)Build: ([^.]*)\./.exec(L) || [])[1] || '';
      if (/\b(?:round|low|squat|stocky)\b/i.test(build) || /\b(?:squat|stocky)\b|\blow and round\b|\bround and low\b/i.test(L)) fail(tag + ': a lone shape word in the build');
      if (!/(?:^|\s)Height: about (?:\w+ foot(?: \w+)?|[\w ]+ feet, adult in proportion)\./.test(L)) fail(tag + ': no absolute height');
      if ((k === 'goblin' || k === 'fairy') && !/adult in proportion/.test(L)) fail(tag + ': adult proportions not stated');
      if (/\bmuzzle\b/i.test(L)) fail(tag + ': a muzzle at the standard face');
      if (g === 'female' && /(?:^|\s)Build: /.test(L) && !/\bwaist\b[^.]*\bhips\b[^.]*\bthighs\b/.test(build)) fail(tag + ': the build is not waist, hips and thighs');
      if (g === 'male' && /(?:^|\s)Build: /.test(L) && !/\bshoulders\b[^.]*\bchest\b[^.]*\bwaist\b/.test(build)) fail(tag + ': the build is not shoulders, chest and waist');
      if (/\b(?:wrap|waistcoat|bodice|apron|shawl|jeans|jumper|cardigan|shirt|skirt|trousers|sweater|jacket|blouse|robe|tunic|boots?|shoes?|sandals?|hat|cap|scarf)\b/i.test(L)) fail(tag + ': a garment in the looks');
      // What the body lacks is said beside the looks, for the narrator.
      const absent = G.absentText ? G.absentText(W, k, p) : '';
      if (k === 'cow' && g === 'female' && !/\bhorns\b/.test(absent)) fail(tag + ': "Not on this body" does not name horns');
      if (['goblin', 'fairy', 'dryad'].includes(k) && !/\ba tail\b/.test(absent)) fail(tag + ': "Not on this body" does not name a tail');
      if (k === 'harpy' && !(/\bbeak\b/.test(absent) && /\bwings on the back\b/.test(absent))) fail(tag + ': "Not on this body" does not name back wings and a beak');
      if (!/\bpaws in place of hands\b/.test(absent) || !/\bmoon\b/.test(absent)) fail(tag + ': "Not on this body" does not name paws for hands and the moon');
    }
  }
}

// 2. Every feature forced to the least and the most column: the wording is that column's.
const norm = (s) => String(s || '').toLowerCase().replace(/: /g, ', ').replace(/^to /, '').replace(/\.\s*$/, '').replace(/,? in the drawn colou?r/g, '').trim();
for (const k of kinds) {
  const sp = W.genPools.species[k];
  for (const g of sp.genders) for (const [extent, col] of [[-1, 'least'], [1, 'most']]) {
    const p = G.genPerson(W, { species: k, gender: g, extent }), L = String(p.looks || '').toLowerCase(), tag = k + ' ' + g + ' ' + col;
    for (const t of TR[k]) {
      if (!t.range || (t.sex && t.sex !== (g === 'female' ? 'women' : 'men'))) continue;
      // A column a path tells relative to the body before has a born person's own words (born).
      const born = ((((W.genPools.looks.kinds || {})[k] || {}).born || {})[t.key] || {})[col], want = norm(born || t.range[col]);
      if (!want || want === 'none') continue;
      // A covering drawn over the belly leaves the separate belly line out; a feature named only by a kind's own data is still told.
      if (!L.includes(want)) fail(tag + ': ' + t.key + ' is not told as "' + (born || t.range[col]) + '"');
    }
    if (/\byou(?:r|rs|rself)?\b/i.test(L)) fail(tag + ': "you" in the looks');
    for (const re of LEAKS[k][g]) if (re.test(L)) fail(tag + ': the other sex\'s feature ' + re);
  }
}

// 3. The prompt side, on a real adventure: the roommate's first appearance and a scene carry the looks, what is not on the
// body, the dress line and the rule that keeps the narrator to them; the cast's tastes are dealt round.
(async () => {
  const h = await boot({});
  assert(await h.settle(150, 6000), 'boot did not settle');
  h.type('#cName', 'Ada'); h.type('#cRmSpecies', 'bovine'); h.$('#cRmGender').value = 'female'; h.$('#cRmGender').dispatchEvent(new h.window.Event('change'));
  h.click('#cBegin');
  assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
  const prompt = (c) => (Array.isArray(c.input) ? c.input.map((m) => m.content).join('\n') : String(c.input));
  const intro = h.mock.sampleCalls.find((c) => /roommate introduction/.test(c.label));
  if (!intro) fail('no roommate introduction call');
  else {
    const P = prompt(intro);
    if (!/Looks: Height: about /.test(P)) fail('intro: the looks are not the composed block');
    if (!/Not on this body: [^.]*\bhorns\b/.test(P)) fail('intro: "Not on this body" does not name horns for a bovine woman');
    if (!/Dress: student, \w+ taste, dressed for /.test(P)) fail('intro: no Dress line');
    if (!/The body is exactly what Looks gives and nothing else/.test(P)) fail('intro: no rule keeping to the looks');
    if (/\b(?:wrap|bodice|waistcoat|shawl|apron)\b/i.test(P)) fail('intro: a preset garment in the prompt');
  }
  const doc = [...h.mock.store.entries()].find(([p]) => /^adventures\/[^/]+$/.test(p));
  const adv = doc && doc[1].data;
  const people = [].concat(adv.roommate ? [adv.roommate] : [], (adv.cast && adv.cast.generated && adv.cast.generated.characters) || [], (adv.cast && adv.cast.generated && adv.cast.generated.minors) || []);
  if (people.some((c) => !c.dress || !c.dress.role || !c.dress.taste)) fail('a cast member without a dress draw');
  const cast = [].concat((adv.cast.generated.characters || []), (adv.cast.generated.minors || [])).slice(0, 20);
  const counts = {}; for (const c of cast) counts[c.dress && c.dress.taste] = (counts[c.dress && c.dress.taste] || 0) + 1;
  for (const [taste, n] of Object.entries(counts)) if (n > cast.length / 4) fail('dress: ' + n + ' of ' + cast.length + ' share the taste "' + taste + '"');
  for (const c of people) if (c.species && W.genPools.species[c.species] && !/^Height: /.test(String(c.looks || ''))) fail(c.key + ': stored looks are not composed (' + String(c.looks).slice(0, 80) + ')');
  h.close && h.close();

  if (failures.length) {
    console.error('looks-drift: ' + failures.length + ' failures');
    for (const f of (process.env.LD_ALL ? failures : failures.slice(0, 60))) console.error('  - ' + f);
    if (failures.length > 60) console.error('  … and ' + (failures.length - 60) + ' more');
    process.exit(1);
  }
  console.log('looks-drift: all checks passed (' + kinds.length + ' kinds, ' + N + ' per sex at the standard, least and most forced, prompts checked)');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
