'use strict';
// Looks drift: a person's looks are composed from their kind's finished lines for their sex, never invented. For every kind
// with change tracks, and each sex it has, 20 people are drawn at the standard extent and checked for: a by-sex feature of the
// other sex, a watch-list feature (horns on a bovine woman, a tail on a goblin, fairy or dryad, back wings or a beak on a harpy,
// paws for hands, an animal's whole shape or the moon, a mer tail out of water), a missing finished feature, missing boundary
// words, "you" or "your", and a lone shape word for the build. Then 60 are drawn freely and checked for the v84 root causes:
// one column for the whole body (no feature outside the person's column, at most two kept at the standard), plain labels
// (Arms, Legs, Feet, Spine; never a track's name), the figure drawn first with its parts and the bust agreeing, the eyes as
// one drawn phrase, a young animal's word, a run of three words twice, and the kind's must-nots closing the looks as plain
// negatives. Then every feature is forced to the least and to the most column and its wording checked against that column of
// the range, and the face's and the body's draws are checked at their odds. The prompt side (Not on this body, Dress, the rule
// that keeps the narrator to the looks) is checked on a real adventure, and an older save's looks are composed again on load.
// Fails on f73fe18, where the looks were pool prose, and on 656d4f9, where each feature drew its own column under track names.
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
  const r0 = html.indexOf('  // A look written'), r1 = html.indexOf('  // Saves from before v9 kept');
  assert(r0 > 0 && r1 > r0, 'the look migration was not found in the page');
  const win = {}; new Function('window', fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'))(win);
  const W = Object.values(win.WINDLASS_WORLDS)[0];
  const pre = "const escRe = (s) => s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'); const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;"
    + " const NB = { they: 'they', them: 'them', their: 'their', theirs: 'theirs' };"
    + " function speciesRace(Wc, k) { const sp = Wc.transformation && Wc.transformation.species[k]; return sp ? (sp.race || sp.short) : cap(String(k || '')); }";
  const names = ['genPerson', 'absentText', 'recomposeLooks'];
  const api = new Function('W', pre + html.slice(a, b) + html.slice(r0, r1) + '\nreturn {' + names.map((n) => n + ': typeof ' + n + " !== 'undefined' ? " + n + ' : null').join(', ') + '};')(W);
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
// Every finished feature once, under a plain label: hands, feet, ears, the tail where the kind has one, arm and leg covering, spine, face, and the by-sex features.
const FEATURES = {
  all: [[/(?:^|\s)(?:Hands|Fingers and toes|Hands and feet):/, 'hands'], [/(?:^|\s)(?:Feet|Hands and feet):/, 'feet'], [/(?:^|\s)(?:Ears|Crest):/, 'ears'], [/(?:^|\s)Face:/, 'face'], [/(?:^|\s)Height:/, 'height'], [/(?:^|\s)Build:/, 'build'], [/(?:^|\s)Eyes:/, 'eyes']],
  tail: { wolf: 'Tail', cow: 'Tail', fox: 'Tail', cat: 'Tail', rabbit: 'Tail', harpy: 'Tail', mer: 'In water' },
  arms: { wolf: 'Arms', cow: 'Arms', fox: 'Arms', cat: 'Arms', rabbit: 'Arms', harpy: 'Arms', mer: 'Arms', dryad: 'Arms', fairy: 'Sheen', goblin: 'Skin' },
  legs: { wolf: 'Legs', cow: 'Legs', fox: 'Legs', cat: 'Legs', rabbit: 'Legs', harpy: 'Legs', mer: 'Legs', dryad: 'Legs', fairy: 'Sheen', goblin: 'Skin' },
  spine: { wolf: 'Spine', cow: 'Spine', fox: 'Spine', cat: 'Spine', rabbit: 'Spine', harpy: 'Legs', mer: 'Spine', dryad: 'Spine', fairy: 'Sheen' },
  female: { wolf: ['Nipples'], cow: ['Teats and udder'], fox: ['Nipples'], cat: ['Nipples'], rabbit: ['Nipples'], mer: [], dryad: ['In season'], goblin: [], fairy: [], harpy: [] },
  male: { wolf: ['Mantle'], cow: ['Horns'], fox: ['Bib'], cat: ['Neck'], mer: ['Colours'], dryad: ['Shoulders', 'In season'], goblin: ['Frame'], fairy: ['Frame'] }
};
// A track's name is not a label: the looks say Arms, Legs, Feet and Spine, and say the eyes and the chest once each.
const TRACK_LABELS = /(?:^|\s)(?:Forearm (?:pelt|coat)|Arm (?:scales|bark|feathers)|Leg and hip \w+|Toes and (?:claws|hooves)|Toes|Feet and stance|Hind feet|Talons|Spine (?:ruff|strip|line|ridge)|Bob tail|Tail fan|Crest and ears|Finned ears|Webbed (?:hands|feet)|Feet and roots|Nose and (?:face|lip)|Whiskers and face|Teeth and jaw|Front teeth|Further pairs(?: of nipples)?|Tom's build|Horns and crest|Shoulder bark|Light bones|Glow and dust|Sheen and skin|Arms as wings|Breasts|Figure):/;
// A young animal's word has no place in an adult's looks ("like a calf's"); "to the calf" is the leg.
const YOUNG = /\b(?:kitten|pup|cub|foal|kid|chick|fawn|calf|calve)s?'s?(?=[\s.,;:]|$)|(?<!\b(?:to|at|below|above|mid-)\s?)\b(?:an?|the|like|like an?|like the|as|as an?|as the) (?:kitten|pup|cub|foal|kid|chick|fawn|calf)s?\b/i;
const CUP = /\b(?:an?|neat|small|full|soft|generous|big) (AA|A|B|C|D|DD|E|F|G)\b|\b(AA|A|B|C|D|DD|E|F|G) cup\b/;
// At the standard extent the coverings stop where the doc draws them: the hands to the elbows, the feet to the hips fading at the navel.
const BOUNDS = { wolf: ['elbow', 'navel'], cow: ['elbow', 'navel'], fox: ['elbow', 'navel'], cat: ['elbow', 'navel'], mer: ['elbow', 'navel'], dryad: ['elbow', 'navel'], rabbit: ['elbow'], harpy: ['navel'] };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\']/g, '\\$&');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const has = (looks, label) => new RegExp('(?:^|\\s)' + esc(label) + ':').test(looks);
// A labelled field's text, up to the next label or the closing negatives.
const fieldOf = (looks, label) => { const m = new RegExp('(?:^|\\. )' + esc(label) + ': ([^]*?)\\.(?= [A-Z][A-Za-z\' ]{1,30}: | No [a-z]|$)').exec(looks); return m ? m[1] : ''; };
const N = 20, FREE = 60;
// A garment of another age has no place in what a kind's body asks of clothes: Mythaven dresses in modern clothes.
const PERIOD = /\b(?:robes?|tunics?|cloaks?|gowns?|bodices?|shawls?|aprons?|waistcoats?|loincloths?|togas?|smocks?|breeches|doublets?|corsets?|kirtles?|wraps?)\b/i;

const failures = [];
const fail = (what) => { failures.push(what); };

const G = loadGenerator();
const W = G.W, TR = W.transformation.tracks.species, LK = W.genPools.looks;
const kinds = Object.keys(TR);
assert.deepEqual(kinds.slice().sort(), Object.keys(LEAKS).sort(), 'every kind with tracks is checked');
const norm = (s) => String(s || '').toLowerCase().replace(/: /g, ', ').replace(/^to /, '').replace(/\.\s*$/, '').replace(/,? in the drawn colou?r/g, '').trim();
const labelOf = (k, t) => ((LK.kinds[k].labels || {})[t.key] || LK.labels[t.key] || (t.face ? 'Face' : t.name));
const sexOf = (g) => (g === 'female' ? 'women' : 'men');
// The column each ranged feature is told at, read from its own line (a kind's swap for the sex applied: a fairy man's tinted wings).
function columnsOf(k, g, looks) {
  const K = LK.kinds[k], cols = {};
  for (const t of TR[k]) {
    if (!t.range || !(K.parts || []).includes(t.key) || (t.sex && t.sex !== sexOf(g))) continue;
    const field = fieldOf(looks, labelOf(k, t)).toLowerCase();
    for (const c of ['least', 'standard', 'most']) {
      let w = norm(((K.born || {})[t.key] || {})[c] || t.range[c]); if (!w || w === 'none') continue;
      for (const [from, to] of (((K.swap || {})[g] || {})[t.key] || [])) w = w.replace(new RegExp('\\b' + from + '\\b', 'g'), to);
      if (field.includes(w)) cols[t.key] = c;
    }
  }
  return cols;
}
// The body's features (not the face, not a feature that follows another's column), as [key, column].
const bodyCols = (k, cols) => Object.entries(cols).filter(([key]) => { const t = TR[k].find((x) => x.key === key); return !t.face && !t.extentWith; });

// 1. Twenty at the standard extent, per kind and sex.
for (const k of kinds) {
  const sp = W.genPools.species[k];
  assert.deepEqual(sp.genders.slice().sort(), Object.keys(LEAKS[k]).sort(), k + ': rabbit and harpy are women only; the rest have both');
  for (const g of sp.genders) {
    for (let i = 0; i < N; i++) {
      const p = G.genPerson(W, { species: k, gender: g, extent: 0 }), L = String(p.looks || ''), tag = k + ' ' + g + ' #' + i;
      for (const re of LEAKS[k][g]) if (re.test(L.replace(/\. No [^.]*\.$/, '.'))) fail(tag + ': the other sex\'s feature ' + re + ' in "' + L.slice(0, 160) + '…"');
      for (const [re, what] of WATCH.concat(KIND_WATCH[k] || [])) if (re.test(L.replace(/\. No [^.]*\.$/, '.'))) fail(tag + ': ' + what);
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
      if (TRACK_LABELS.test(L)) fail(tag + ': a track\'s name for a label: ' + (TRACK_LABELS.exec(L) || [])[0]);
      // What no body here has is said beside the looks, for the narrator; what this sex of the kind lacks is in the looks themselves, not twice.
      const absent = G.absentText ? G.absentText(W, k, p) : '';
      if (!/\bpaws in place of hands\b/.test(absent) || !/\bmoon\b/.test(absent)) fail(tag + ': "Not on this body" does not name paws for hands and the moon');
      if (k === 'cow' && g === 'female' && /\bhorns\b/.test(absent)) fail(tag + ': "Not on this body" says horns again, which the looks already close with');
    }
  }
}
// A look written by hand (no closing negatives) still gets the kind's must-nots beside it.
{
  const hand = G.absentText ? G.absentText(W, 'cow', { gender: 'female', looks: 'A tall woman with a kind face.' }) : '';
  if (!/\bhorns\b/.test(hand) || !/\bmuzzle\b/.test(hand)) fail('a look written by hand: "Not on this body" does not name horns and a muzzle: ' + hand);
}

// 1b. Sixty drawn freely, per kind and sex: the v84 root causes.
for (const k of kinds) {
  const sp = W.genPools.species[k], K = LK.kinds[k];
  for (const g of sp.genders) {
    const A = K.absent || {}, nots = [].concat(A[g] || [], A.all || []).map((x) => 'no ' + String(x).replace(/^(?:an?|the) /i, ''));
    for (let i = 0; i < FREE; i++) {
      const p = G.genPerson(W, { species: k, gender: g }), L = String(p.looks || ''), tag = k + ' ' + g + ' free #' + i;
      // One column for the whole body: no feature outside it, at most two kept at the standard, every ranged feature read in its column.
      const cols = columnsOf(k, g, L), body = bodyCols(k, cols), off = new Set(body.filter(([, c]) => c !== 'standard').map(([, c]) => c));
      if (off.size > 1) fail(tag + ': features in mixed columns: ' + JSON.stringify(body) + ' in ' + L);
      if (off.size === 1 && body.filter(([, c]) => c === 'standard').length > 2) fail(tag + ': more than two features at the standard on a ' + [...off][0] + ' body: ' + JSON.stringify(body));
      for (const t of TR[k]) if (t.range && (K.parts || []).includes(t.key) && (!t.sex || t.sex === sexOf(g)) && !cols[t.key] && !(K.unless && K.unless[t.key]) && !t.extentWith) fail(tag + ': ' + t.key + ' is not told in any column under "' + labelOf(k, t) + '": ' + L);
      // The figure first, its parts and the bust agreeing with it.
      const bm = /(?:^|\. )Build: (\w+), with ([^.]*)\./.exec(L);
      if (!bm) fail(tag + ': the build does not open with a figure word: ' + (fieldOf(L, 'Build') || '(none)'));
      else {
        const f = (LK.figures[g] || []).find((x) => x.word === bm[1]);
        if (!f) fail(tag + ': "' + bm[1] + '" is not a figure of the world\'s');
        else {
          for (const ph of bm[2].split(/, | and /)) { const part = (/\b(waist|hips|thighs|shoulders|chest)\b/.exec(ph) || [])[1]; if (!part || !(f.fits[part] || []).some((w) => new RegExp('\\b' + w + '\\b').test(ph))) fail(tag + ': "' + ph + '" does not fit a ' + f.word + ' figure'); }
          if (g === 'female') { const m = CUP.exec(fieldOf(L, 'Bust')), cup = m && (m[1] || m[2]); if (cup && !f.cups.includes(cup)) fail(tag + ': a ' + cup + ' cup on a ' + f.word + ' figure'); }
        }
      }
      // The eyes once, as one drawn phrase; the hair and chest once.
      if ((L.match(/(?:^|\s)Eyes: /g) || []).length !== 1) fail(tag + ': the eyes are not said once: ' + L);
      else if (!(sp.eyes || []).includes(fieldOf(L, 'Eyes'))) fail(tag + ': the eyes are not one drawn phrase: "' + fieldOf(L, 'Eyes') + '"');
      if ((L.match(/(?:^|\s)(?:Bust|Breasts): /g) || []).length > 1) fail(tag + ': the chest is said twice');
      if (TRACK_LABELS.test(L)) fail(tag + ': a track\'s name for a label: ' + (TRACK_LABELS.exec(L) || [])[0]);
      if (YOUNG.test(L)) fail(tag + ': a young animal\'s word: ' + (YOUNG.exec(L) || [])[0]);
      // The kind's must-nots for this sex close the looks as plain negatives, and the fields never carry them.
      if (nots.length && !L.endsWith(' ' + cap(nots.join(', ')) + '.')) fail(tag + ': the looks do not close with "' + cap(nots.join(', ')) + '.": ' + L.slice(-160));
      const fields = L.replace(/\. No [a-z][^.]*\.$/, '.').split(/\. (?=[A-Z][A-Za-z' ]{1,30}: )/).map((x) => x.replace(/^[A-Z][A-Za-z' ]{1,30}: /, '').replace(/\.$/, ''));
      for (const re of LEAKS[k][g]) if (fields.some((x) => re.test(x.replace(/;?\s*never an? [^;]*/gi, '')))) fail(tag + ': the other sex\'s feature ' + re + ' in a field');
      // No run of three words twice (a hyphenated word is one; the colour is said by the hair too, by design).
      const colourLabel = K.colour && (typeof K.colour === 'object' ? K.colour[g] : K.colour), colour = colourLabel ? fieldOf(L, colourLabel).split(';')[0].trim() : '';
      const seen = new Set(); let twice = '';
      for (const x of fields) { const w = (colour ? x.replace(new RegExp(esc(colour), 'gi'), ' ') : x).toLowerCase().match(/[a-z'-]+/g) || []; for (let j = 0; j + 2 < w.length; j++) { const run = w.slice(j, j + 3).join(' '); if (seen.has(run)) twice = run; seen.add(run); } }
      if (twice) fail(tag + ': the run "' + twice + '" twice in ' + L);
    }
  }
}

// 2. Every feature forced to the least and the most column: the wording is that column's.
for (const k of kinds) {
  const sp = W.genPools.species[k];
  for (const g of sp.genders) for (const [extent, col] of [[-1, 'least'], [1, 'most']]) {
    const p = G.genPerson(W, { species: k, gender: g, extent }), L = String(p.looks || '').toLowerCase(), tag = k + ' ' + g + ' ' + col;
    for (const t of TR[k]) {
      if (!t.range || (t.sex && t.sex !== sexOf(g))) continue;
      // A column a path tells relative to the body before has a born person's own words (born).
      const born = ((((W.genPools.looks.kinds || {})[k] || {}).born || {})[t.key] || {})[col], want = norm(born || t.range[col]);
      if (!want || want === 'none') continue;
      // A covering drawn over the belly leaves the separate belly line out; a feature named only by a kind's own data is still told.
      if (!L.includes(want)) fail(tag + ': ' + t.key + ' is not told as "' + (born || t.range[col]) + '"');
    }
    if (/\byou(?:r|rs|rself)?\b/i.test(L)) fail(tag + ': "you" in the looks');
    for (const re of LEAKS[k][g]) if (re.test(L.replace(/\. no [^.]*\.$/, '.'))) fail(tag + ': the other sex\'s feature ' + re);
    // A whole-body coat is still told from the legs under the Legs label, never as a coat with no legs in it.
    const legs = fieldOf(p.looks, 'Legs'); if (legs && !/^(?:(?:feathers|scales|bark) from )?(?:paws|hooves|feet|knee|stockings) to /.test(legs)) fail(tag + ': the Legs row does not start from the legs: ' + legs);
    // 2a. As far as the kind goes, the person stays themselves: the face is human first (a muzzle short and the eyes human, never
    // an animal's head or a face too fine to be human), and the hair stays hair with whatever grows through it. Fails on efff600
    // (a fairy's face, a harpy's and a dryad's hair).
    if (col === 'most') {
      const face = fieldOf(String(p.looks || ''), 'Face');
      if (!face || /\b(?:head|snout|long muzzle|inhuman|to be human|animal'?s? face)\b/i.test(face)) fail(tag + ': the face is not human first: "' + face + '"');
      if (/\bmuzzle\b/i.test(face) && !(/\bshort\b[^;]*\bmuzzle\b/i.test(face) && /\bhuman eyes\b/i.test(face))) fail(tag + ': a muzzle that is not short, with the person\'s eyes: "' + face + '"');
      if (!has(String(p.looks || ''), 'Hair') || /\bin place of hair\b/.test(L)) fail(tag + ': the hair does not stay hair: ' + p.looks);
      // The fullest crest names the crest and the tufts where the ears were; a coat over the body says what it is and that it
      // covers the legs, under Legs. Fails on b46a295.
      if (k === 'harpy' && !/\bcrest\b[^.]*\btufts\b[^.]*\bears\b/.test(fieldOf(String(p.looks || ''), 'Crest'))) fail(tag + ': the crest does not name the crest and the ear tufts: "' + fieldOf(String(p.looks || ''), 'Crest') + '"');
      const coat = { harpy: 'feathers', mer: 'scales', dryad: 'bark' }[k], legs = fieldOf(String(p.looks || ''), 'Legs');
      if (coat && !new RegExp('^' + coat + ' from (?:knee|feet) to hips\\b').test(legs)) fail(tag + ': the Legs field does not name the ' + coat + ' over the legs: "' + legs + '"');
    }
  }
}

// 2b. The face's own draw, at its odds: about 65 in 100 faces sit at the standard, 25 under it and 10 over (the muzzle is rare);
// and the body's one draw: about two in three bodies all at the standard, the rest leaning least or most, each a sixth.
{
  const t = TR.wolf.find((x) => x.face), face = { least: 0, standard: 0, most: 0 }, lean = { least: 0, standard: 0, most: 0 }, M = 600;
  for (let i = 0; i < M; i++) {
    const L = String(G.genPerson(W, { species: 'wolf', gender: 'female' }).looks || ''), cols = columnsOf('wolf', 'female', L);
    face[cols[t.key] || 'standard'] += 1;
    const off = bodyCols('wolf', cols).map(([, c]) => c).find((c) => c !== 'standard'); lean[off || 'standard'] += 1;
  }
  if (face.standard / M < 0.57 || face.standard / M > 0.73) fail('the face lands on the standard ' + face.standard + ' of ' + M + ' times, not about 65 in 100');
  if (face.most / M < 0.05 || face.most / M > 0.16) fail('the face lands on the most column ' + face.most + ' of ' + M + ' times, not about 10 in 100');
  if (face.least / M < 0.18 || face.least / M > 0.32) fail('the face lands on the least column ' + face.least + ' of ' + M + ' times, not about 25 in 100');
  if (lean.standard / M < 0.58 || lean.standard / M > 0.75) fail('the body is all at the standard ' + lean.standard + ' of ' + M + ' times, not about two in three');
  if (lean.least / M < 0.1 || lean.most / M < 0.1) fail('the body leans least ' + lean.least + ' and most ' + lean.most + ' of ' + M + ' times, not about a sixth each');
}

// 2c. What each kind's body asks of clothes (genPools.looks.kinds[k].dress, read into every Dress line) names no garment of another age.
for (const [k, K] of Object.entries(LK.kinds)) for (const fact of [].concat(...Object.values(K.dress || {}))) if (PERIOD.test(fact)) fail(k + ': a garment of another age in what the body asks of clothes: ' + fact);

// 2d. A dryad's Hair field is hair alone, at every column: the Leaves field alone says how many leaves grow through it, so the
// two never give different amounts (a leaf or two in the hair beside a crown of leaves). Fails on b46a295.
for (const g of W.genPools.species.dryad.genders) for (const extent of [-1, 0, 1]) for (let i = 0; i < N; i++) {
  const L = String(G.genPerson(W, { species: 'dryad', gender: g, extent }).looks || ''), hair = fieldOf(L, 'Hair');
  if (!hair || /\bleaf|\bleaves\b/i.test(hair)) { fail('dryad ' + g + ' extent ' + extent + ': the Hair field is not hair alone: "' + hair + '"'); break; }
}

// 3. The prompt side, on a real adventure: the roommate's first appearance and a scene carry the looks, what is not on the
// body, the dress line and the rule that keeps the narrator to them; the cast's tastes are dealt round. 4. An older save's
// looks are composed again on load.
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
    if (!/Looks: Height: about [^\n]*\. No horns, no crest, no heavy neck\./.test(P)) fail('intro: the looks do not close with what a bovine woman never has');
    if (/Not on this body: [^.]*\bhorns\b/.test(P)) fail('intro: "Not on this body" says horns a second time');
    if (!/Not on this body: [^.]*\bpaws in place of hands\b/.test(P)) fail('intro: "Not on this body" does not name paws for hands');
    if (!/Dress: student, \w+ taste, dressed for /.test(P)) fail('intro: no Dress line');
    if (!/The body is exactly what Looks gives and nothing else/.test(P)) fail('intro: no rule keeping to the looks');
    if (/\b(?:wrap|bodice|waistcoat|shawl|apron)\b/i.test(P)) fail('intro: a preset garment in the prompt');
  }
  const advOf = (store) => [...store.entries()].find(([p]) => /^adventures\/[^/]+$/.test(p));
  const doc = advOf(h.mock.store);
  const adv = doc && doc[1].data;
  const people = [].concat(adv.roommate ? [adv.roommate] : [], (adv.cast && adv.cast.generated && adv.cast.generated.characters) || [], (adv.cast && adv.cast.generated && adv.cast.generated.minors) || []);
  if (people.some((c) => !c.dress || !c.dress.role || !c.dress.taste)) fail('a cast member without a dress draw');
  const cast = [].concat((adv.cast.generated.characters || []), (adv.cast.generated.minors || [])).slice(0, 20);
  const counts = {}; for (const c of cast) counts[c.dress && c.dress.taste] = (counts[c.dress && c.dress.taste] || 0) + 1;
  for (const [taste, n] of Object.entries(counts)) if (n > cast.length / 4) fail('dress: ' + n + ' of ' + cast.length + ' share the taste "' + taste + '"');
  for (const c of people) if (c.species && W.genPools.species[c.species] && !/^Height: /.test(String(c.looks || ''))) fail(c.key + ': stored looks are not composed (' + String(c.looks).slice(0, 80) + ')');
  for (const c of people) if (c.species && W.genPools.species[c.species] && c.looksV !== 2) fail(c.key + ': stored looks are not marked as composed the v84 way (looksV ' + c.looksV + ')');
  h.close && h.close();

  // 4. The same adventure saved by an earlier version: the roommate's look names tracks for labels, says the eyes twice and
  // has no closing negatives, and a Cast edit carries it unchanged; another cast member's look was edited by hand. On load the
  // roommate's is composed again (keeping her colour, hair, eyes and chest), the edit that only carried it follows, the edit by hand stays.
  {
    const seeded = new Map([...h.mock.store].map(([p, d]) => [p, JSON.parse(JSON.stringify(d))]));
    const stored = advOf(seeded)[1].data, rm = stored.roommate, fresh = rm.looks;
    const old = fresh.replace(/ Arms: /, ' Forearm coat: ').replace(/ Eyes: ([^.]*)\./, ' Eyes: $1; large, dark-lashed, wide-seeing eyes.').replace(/\. No [^.]*\.$/, '.');
    assert(old !== fresh && /Forearm coat: /.test(old) && !/\. No /.test(old), 'the older look is made from the fresh one: ' + old);
    rm.looks = old; rm.gen.looks = old; delete rm.looksV;
    const edited = stored.cast.generated.characters.find((c) => c.species && W.genPools.species[c.species]);
    // A harpy's look of this version as efff600 composed it at the fullest: her crest took the place of her hair, so there is no
    // Hair field, and the crest and the leg feathers are in words the world has since changed; it carries a word the Cast editor
    // showed filled ({first}), and a Cast edit holds that filled form. On load the words are mended in place, a Hair field from the
    // kind's pool goes in before the eyes, nothing else is drawn again, and the edit follows. Fails on b46a295.
    const worded = stored.cast.generated.characters.find((c) => c !== edited && c.looksV === 2);
    Object.assign(worded, { species: 'harpy', gender: 'female', pronouns: { they: 'she', them: 'her', their: 'her', theirs: 'hers' } });
    const wordedOld = 'Height: about five foot two. Build: slim, with a slim waist, narrow hips and slim thighs. Bust: shallow breasts, an A cup, with nipples long for the size of them and areolae small and dark. Eyes: bright black eyes. Plumage: black with a green sheen. Arms: arms feathered from shoulder to wrist. Wings: great wings and strong sustained flight. Hands: a thumb and one strong clawed finger. Legs: over belly, ribs and back; all but the face and chest. Feet: heavy talons, scaled to above the knee. Tail: a long sweeping fan that {first} once called a duster. Crest: feathers in place of hair. Face: a fine hard-edged nose, feathered brows and cheeks; never a beak. Frame: a light frame, a deep breastbone and small high breasts. No wings on the back apart from the arms, no beak.';
    // The hand row the lore has since pinned (a thumb and two clawed fingers) is mended on load as well, in the words of the most column.
    const wordedNew = wordedOld.replace('Legs: over belly', 'Legs: feathers from knee to hips and over belly').replace('Crest: feathers in place of hair', 'Crest: a full crest, feathers all through the hair, and tufts where the ears were').replace('Hands: a thumb and one strong clawed finger', 'Hands: a thumb and two strong clawed fingers, the claws long and curved');
    worded.looks = wordedOld; if (worded.gen) worded.gen.looks = wordedOld;
    stored.cast.overrides = Object.assign({}, stored.cast.overrides, { roommate: { looks: old }, [edited.key]: { looks: 'A tall woman with a scar across one eyebrow.' }, [worded.key]: { looks: wordedOld.replace('{first}', 'Ada') } });
    const h2 = await boot({ setup(w, m) { m.store = seeded; } });
    assert(await h2.settle(150, 8000), 'the older save did not load'); await h2.idle(10000); await h2.settle(100, 4000);
    assert(await h2.turn('I look around the room.'), 'a turn on the older save');
    const after = advOf(h2.mock.store)[1].data, r2 = after.roommate;
    if (r2.looks === old || !/^Height: /.test(r2.looks) || / Arms: /.test(r2.looks) === false || /Forearm coat: /.test(r2.looks)) fail('older save: the roommate\'s look was not composed again: ' + r2.looks);
    if (r2.looksV !== 2) fail('older save: the recomposed look is not marked (looksV ' + r2.looksV + ')');
    if (!r2.looks.endsWith(' No horns, no crest, no heavy neck.')) fail('older save: the recomposed look does not close with the must-nots: ' + r2.looks.slice(-120));
    for (const label of ['Eyes', 'Hair', 'Bust', 'Hide', 'Height', 'Build', 'Face', 'Hands', 'Legs', 'Feet', 'Tail']) if (fieldOf(r2.looks, label) !== fieldOf(fresh, label)) fail('older save: the ' + label + ' changed from "' + fieldOf(fresh, label) + '" to "' + fieldOf(r2.looks, label) + '"');
    if (r2.gen.looks !== r2.looks) fail('older save: the generated record kept the old look');
    if (!after.cast.overrides || after.cast.overrides.roommate.looks !== r2.looks) fail('older save: the Cast edit that only carried the old look did not follow it: ' + JSON.stringify(after.cast.overrides && after.cast.overrides.roommate));
    if (after.cast.overrides[edited.key].looks !== 'A tall woman with a scar across one eyebrow.') fail('older save: a look edited by hand was changed');
    const w2 = after.cast.generated.characters.find((c) => c.key === worded.key);
    const hair2 = fieldOf(w2.looks, 'Hair');
    if (!W.genPools.species.harpy.hair.includes(hair2)) fail('older save: a harpy whose crest had taken the place of her hair was given no Hair field from her pool: ' + w2.looks);
    if (w2.looks !== wordedNew.replace(' Eyes: ', ' Hair: ' + hair2 + '. Eyes: ') || w2.looksV !== 2) fail('older save: the reworded lines were not mended in place, word for word, with nothing else changed (looksV ' + w2.looksV + '): ' + w2.looks);
    if (after.cast.overrides[worded.key].looks !== w2.looks) fail('older save: the Cast edit that only carried the reworded look, filled, did not follow it: ' + after.cast.overrides[worded.key].looks);
    const calls = h2.mock.sampleCalls.filter((c) => /turn/i.test(c.label || '')), P2 = calls.length ? prompt(calls[calls.length - 1]) : '';
    if (!P2 || /Forearm coat: /.test(P2) || /wide-seeing eyes; |; large, dark-lashed/.test(P2)) fail('older save: the turn prompt still carries the old look');
    if (/Not on this body: [^.]*\bpaws in place of hands\b/.test(P2)) fail('turn prompt: what no body here has is said beside a person, which <rules> already says');
    if (!/Every kind keeps working hands; nobody takes an animal's whole shape or changes with the moon/.test(P2)) fail('turn prompt: the rule that no body here has paws for hands or changes with the moon is missing');
    // The narrator dresses everyone by their Dress line in the clothes of the world it reads, which are modern. Fails on b46a295.
    if (!/<world>[^<]*\bmodern\b[^.<]*\bclothes\b[^<]*<\/world>/.test(P2) || !/Dress: \w+, \w+ taste, dressed for /.test(P2)) fail('the turn prompt does not dress the cast in modern clothes');
    h2.close && h2.close();
  }

  // 5. A look composed again keeps everything the old one settled. A fresh look of any kind comes back as itself; a look written as
  // prose by the first version keeps its coat colour (never an eye's or a garment's), a stated chest size and, for a kind with no
  // lines of its own, its body; and two loads agree on the height, build and face where the old look gave them.
  {
    const same = []; let n = 0;
    for (const k of kinds) for (const g of W.genPools.species[k].genders) for (let i = 0; i < 6; i++) {
      const p = G.genPerson(W, { species: k, gender: g }), c = { species: k, gender: g, pronouns: p.pronouns, looks: p.looks }, again = G.recomposeLooks(W, c); n++;
      if (again !== p.looks) same.push(k + ' ' + g + ': "' + p.looks.slice(0, 90) + '…" came back as "' + again.slice(0, 90) + '…"');
    }
    for (const f of same.slice(0, 6)) fail('recompose: a fresh look changed on recompose, ' + f);
    if (same.length > n / 20) fail('recompose: ' + same.length + ' of ' + n + ' fresh looks changed');
    const she = { they: 'she', them: 'her', their: 'her', theirs: 'hers' };
    const wolf = { key: 'roommate', species: 'wolf', gender: 'female', pronouns: she, looks: 'lean and quick, red-brown at the ears and the tail and the pelt that runs from the small of the back down the legs to padded feet. Pale grey eyes with a shine in low light, canines a little long, hands with rough pads and dark claws. Wears a vest and running shorts and is barefoot, because shoes do not fit paws. Breasts, and below them two more pairs of small nipples down the belly, small and dark in the pelt. a silver wolf pendant on a leather cord, always worn' };
    const w1 = G.recomposeLooks(W, wolf), w2 = G.recomposeLooks(W, wolf);
    if (!/(?:^|\s)Pelt: red-brown;/.test(w1)) fail('recompose: the red-brown wolf did not keep her colour (an eye\'s grey taken for the coat): ' + w1.slice(0, 200));
    if (fieldOf(w1, 'Eyes') !== 'pale grey eyes') fail('recompose: the wolf\'s pale grey eyes changed: ' + fieldOf(w1, 'Eyes'));
    for (const label of ['Hands', 'Arms', 'Legs', 'Feet', 'Tail', 'Face']) if (fieldOf(w1, label) !== fieldOf(w2, label)) fail('recompose: the wolf\'s ' + label + ' differs between two loads: "' + fieldOf(w1, label) + '" and "' + fieldOf(w2, label) + '"');
    if (/\bmuzzle\b/i.test(w1)) fail('recompose: a muzzle given to a face the old look left human: ' + fieldOf(w1, 'Face'));
    const cow = { key: 'creamery', species: 'cow', gender: 'female', pronouns: she, looks: 'a head taller than you and broad as a good wall. Short polished horns, smoke-grey hide showing at the temples, shoulders and forearms, long soft ears set low. Soft hazel eyes, slow to blink. a cream wool cardigan worn over everything, summer and winter' };
    const c1 = G.recomposeLooks(W, cow);
    if (!/(?:^|\s)Hide: smoke-grey/.test(c1)) fail('recompose: the smoke-grey cow did not keep her hide (a cardigan\'s cream taken for it): ' + c1.slice(0, 200));
    const dean = { key: 'dean', species: 'chimera', gender: 'female', pronouns: she, looks: 'a chimera of several kinds worn as easily as a coat: antlers, a lion\'s forepaw for a left hand, copper scales down the right arm, feathers at the nape, a tail that has not decided what it is, and a warm amused face that has heard everything; eyes of two colours. a silver charm bracelet worn under her left sleeve, never visible' };
    const d1 = G.recomposeLooks(W, dean);
    if (!/(?:^|\s)Body: a chimera of several kinds[^.]*\bantlers\b[^.]*lion's forepaw/.test(d1)) fail('recompose: the Dean lost her antlers and forepaw to a drawn body: ' + d1.slice(0, 300));
    if (/\bbracelet\b/.test(d1)) fail('recompose: the keepsake sentence stayed in the Dean\'s body line: ' + d1);
    const gardener = { key: 'gardener', species: 'dryad', gender: 'female', pronouns: she, looks: 'tall and still, dark oak grain showing at the collarbones and down the spine, a scatter of leaves in the hair. Moss at the knuckles; moss-green eyes. Small breasts where the bark gives way to skin below the collarbones, green-veined' };
    const g1 = G.recomposeLooks(W, gardener), cup = /\b(AA|A|B|C|D|DD|E|F|G)\b(?= cup|,)/.exec(fieldOf(g1, 'Bust') || '');
    if (!cup || !/^(?:AA|A|B)$/.test(cup[1])) fail('recompose: the gardener\'s small breasts came back as a ' + (cup ? cup[1] : '?') + ': ' + fieldOf(g1, 'Bust'));
    // A kind with no lines keeps its prose as the body, hair and all: no second hair beside it, and never one coloured from the eyes or
    // from inside another word ("red" in "tired").
    const he = { they: 'he', them: 'him', their: 'his', theirs: 'his' }, they = { they: 'they', them: 'them', their: 'their', theirs: 'theirs' };
    for (const [key, gender, pr, looks, mine] of [['human_society', 'male', he, 'human, red hair cut short, a face that has decided things; brown eyes. nails cut short and filed smooth, almost obsessively neat', 'red hair'],
      ['wardcraft_prof', 'nonbinary', they, 'entirely human, brown hair, the ordinary kind of tired, which on the Isle is the strangest look in the room; blue eyes', 'brown hair']]) {
      for (let i = 0; i < 6; i++) {
        const x = G.recomposeLooks(W, { key, species: 'human', gender, pronouns: pr, looks });
        if (fieldOf(x, 'Hair') || !fieldOf(x, 'Body').includes(mine)) fail('recompose: ' + key + ' has a second hair beside the body\'s ' + mine + ': ' + x);
      }
    }
    // A height and a build the prose gives in words are kept: a head taller or tall at the top of the kind's range, the opening build as
    // written ("lean and quick" is never drawn again as full).
    const top = (k, sx) => { const r = W.genPools.looks.kinds[k].height[sx]; return (h) => { const m = /^about (\w+) foot(?: (\w+))?$/.exec(h) || [], w = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven']; const n = w.indexOf(m[1]) * 12 + (m[2] ? w.indexOf(m[2]) : 0); return n >= r[1] - Math.floor((r[1] - r[0]) / 3); }; };
    const choir = { key: 'choir_lead', species: 'harpy', gender: 'female', pronouns: she, looks: 'tall, hooked in the stance, slate-grey in the wing and grey at the throat, amber eyes like a hawk\'s, set a little too wide. She perches on the backs of chairs rather than sitting on them' };
    for (let i = 0; i < 6; i++) {
      const c2 = G.recomposeLooks(W, cow), h2 = G.recomposeLooks(W, choir), w3 = G.recomposeLooks(W, wolf);
      if (!top('cow', 'female')(fieldOf(c2, 'Height')) || fieldOf(c2, 'Build') !== 'broad as a good wall') fail('recompose: the cow a head taller and broad as a good wall came back as "' + fieldOf(c2, 'Height') + '", "' + fieldOf(c2, 'Build') + '"');
      if (!top('harpy', 'female')(fieldOf(h2, 'Height'))) fail('recompose: the tall choir lead came back as ' + fieldOf(h2, 'Height'));
      if (fieldOf(w3, 'Build') !== 'lean and quick') fail('recompose: the lean and quick wolf came back as ' + fieldOf(w3, 'Build'));
    }
  }

  if (failures.length) {
    console.error('looks-drift: ' + failures.length + ' failures');
    for (const f of (process.env.LD_ALL ? failures : failures.slice(0, 60))) console.error('  - ' + f);
    if (failures.length > 60) console.error('  … and ' + (failures.length - 60) + ' more');
    process.exit(1);
  }
  console.log('looks-drift: all checks passed (' + kinds.length + ' kinds, ' + N + ' per sex at the standard, ' + FREE + ' free, least and most forced, odds, prompts and an older save checked)');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
