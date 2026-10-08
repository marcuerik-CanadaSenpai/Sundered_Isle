'use strict';
// Looks drift: a person's looks are composed from their kind's finished lines for their sex, never invented, and written as one
// paragraph of short sentences with no labels. For every kind with change tracks, and each sex it has, 20 people are drawn at the
// standard extent and checked for: a by-sex feature of the other sex, a watch-list feature (horns on a bovine woman, a tail on a
// goblin, fairy or dryad, back wings or a beak on a harpy, paws for hands, an animal's whole shape or the moon, a mer tail out of
// water), a missing finished feature (each part says what it is), missing boundary words, "you" or "your", and a lone shape word
// for the build. Then 60 are drawn freely and checked for the v84 root causes: one column for the whole body (no feature outside the
// person's column, at most two kept at the standard), no label of any kind (a part's name before a colon, never a track's name
// either), the figure drawn first with its parts and the bust agreeing, the eyes as one drawn phrase, a young animal's word, a run of
// three words twice, and the kind's must-nots closing the looks as plain negatives. Then every feature is forced to the least and to
// the most column and its wording checked against that column of the range, and the face's and the body's draws are checked at their
// odds. The prompt side (Not on this body, Dress, the rule that keeps the narrator to the looks) is checked on a real adventure, and
// an older save's labelled looks are composed again on load as the paragraph, keeping everything they settled.
// Fails on f73fe18, where the looks were pool prose, on 656d4f9, where each feature drew its own column under track names, and on
// b6a6209, where the looks were labelled rows and heavy was a figure.
// Against another build: WL_HTML=<index.html> WL_WORLDS=<worlds dir> node looks-drift.js
const assert = require('node:assert/strict');
const path = require('path');
const { boot } = require('./boot');
const { loadGenerator } = require('./lib/generator');

const HTML = process.env.WL_HTML || path.join(__dirname, '..', 'windlass', 'index.html');
const WORLDS = process.env.WL_WORLDS || path.join(__dirname, '..', 'windlass', 'worlds');

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
  [/\bpaws? (?:for|in place of|instead of) hands\b|\bhands?\b[^.;]*\bpaws?\b/i, 'paws for hands']
];
const KIND_WATCH = {
  goblin: [[/\btail\b/i, 'a tail']], fairy: [[/\btail\b/i, 'a tail']], dryad: [[/\btail\b/i, 'a tail']],
  harpy: [[/\bbeak\b(?<!never a beak)/i, 'a beak'], [/\bwings? (?:on|from|at) (?:the|her) back\b|\bback wings\b|\bshoulder blades?\b/i, 'wings on the back']],
  mer: [[/\btail\b(?![^.]*\bin water\b)(?![^.]*\blegs on land\b)/i, 'a tail out of water']]
};
// Every finished feature once, each saying what it is: hands, feet, ears, the face, the hair and eyes, the tail where the kind has
// one, arm and leg covering, spine, and the by-sex features, by the world's own names for the parts (genPools.looks.names).
const FEATURES = {
  all: [[/\bhands?\b|\bfingers\b/i, 'hands'], [/\bfeet\b|\bfoot\b|\bpaws?\b|\bhooves\b|\bhoof\b|\btalons?\b|\btoes\b|\bshanks\b/i, 'feet'], [/\bears?\b|\bcrest\b/i, 'ears'], [/\bface\b|\bmuzzle\b/i, 'face'], [/\beyes\b/i, 'eyes'], [/\bhair\b/i, 'hair']],
  tail: { wolf: 'Tail', cow: 'Tail', fox: 'Tail', cat: 'Tail', rabbit: 'Tail', harpy: 'Tail', mer: 'In water' },
  arms: { wolf: 'Arms', cow: 'Arms', fox: 'Arms', cat: 'Arms', rabbit: 'Arms', harpy: 'Arms', mer: 'Arms', dryad: 'Arms', fairy: 'Sheen', goblin: 'Skin' },
  legs: { wolf: 'Legs', cow: 'Legs', fox: 'Legs', cat: 'Legs', rabbit: 'Legs', harpy: 'Legs', mer: 'Legs', dryad: 'Legs', fairy: 'Sheen', goblin: 'Skin' },
  spine: { wolf: 'Spine', cow: 'Spine', fox: 'Spine', cat: 'Spine', rabbit: 'Spine', harpy: 'Legs', mer: 'Spine', dryad: 'Spine', fairy: 'Sheen' },
  female: { wolf: ['Nipples'], cow: ['Teats and udder'], fox: ['Nipples'], cat: ['Nipples'], rabbit: ['Nipples'], mer: [], dryad: ['In season'], goblin: [], fairy: [], harpy: [] },
  male: { wolf: ['Mantle'], cow: ['Horns'], fox: ['Bib'], cat: ['Neck'], mer: ['Colours'], dryad: ['Shoulders', 'In season'], goblin: ['Frame'], fairy: ['Frame'] }
};
// A young animal's word has no place in an adult's looks ("like a calf's"); "to the calf" is the leg.
const YOUNG = /\b(?:kitten|pup|cub|foal|kid|chick|fawn|calf|calve)s?'s?(?=[\s.,;:]|$)|(?<!\b(?:to|at|below|above|mid-)\s?)\b(?:an?|the|like|like an?|like the|as|as an?|as the) (?:kitten|pup|cub|foal|kid|chick|fawn|calf)s?\b/i;
const CUP = /\b(?:an?|neat|small|full|soft|generous|big) (AA|A|B|C|D|DD|E|F|G)\b|\b(AA|A|B|C|D|DD|E|F|G) cup\b/;
const HEIGHT = /^About (?:\w+ foot(?: \w+)?|[\w ]+ feet, adult in proportion)(?:;|$)/;
// At the standard extent the coverings stop where the doc draws them: the hands to the elbows, the feet to the hips fading at the navel.
const BOUNDS = { wolf: ['elbow', 'navel'], cow: ['elbow', 'navel'], fox: ['elbow', 'navel'], cat: ['elbow', 'navel'], mer: ['elbow', 'navel'], dryad: ['elbow', 'navel'], rabbit: ['elbow'], harpy: ['navel'] };
// No figure is heavy and no part of a build is thick or heavy: the figures run from petite and slight to full and solid.
const HEAVY = /\b(?:heavy|thick)\b/i;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\']/g, '\\$&');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
// The paragraph as sentences, and as clauses (the parts a sentence joins with "; ").
const sentences = (looks) => String(looks || '').replace(/\.\s*$/, '').split(/\. (?=[A-Z])/);
const clauses = (looks) => sentences(looks).flatMap((s) => s.split('; '));
const sentenceWith = (looks, re, from) => sentences(looks).slice(from || 0).find((s) => re.test(s)) || '';
const openingOf = (looks) => sentences(looks)[0] || '';
const heightOf = (looks) => lowerFirst(openingOf(looks).split('; ')[0]);
const buildOf = (looks) => openingOf(looks).split('; ').slice(1).join('; ');
const hairEyesOf = (looks) => { const s = sentences(looks)[1] || ''; return /\bhair\b|\beyes\b/i.test(s) ? s : ''; };
const eyesOf = (looks) => hairEyesOf(looks).split('; ').pop() || '';
const hairOf = (looks) => { const h = hairEyesOf(looks).split('; '); return h.length > 1 ? h.slice(0, -1).join('; ') : ''; };
const bustOf = (looks) => sentences(looks).find((s) => CUP.test(s)) || '';
// A labelled look's field (the older form, read for the looks an older save holds).
const fieldOf = (looks, label) => { const m = new RegExp('(?:^|\\. )' + esc(label) + ': ([^]*?)\\.(?= [A-Z][A-Za-z\' ]{1,30}: | No [a-z]|$)').exec(looks); return m ? m[1] : ''; };
const N = 20, FREE = 60;
// A garment of another age has no place in what a kind's body asks of clothes: Mythaven dresses in modern clothes.
const PERIOD = /\b(?:robes?|tunics?|cloaks?|gowns?|bodices?|shawls?|aprons?|waistcoats?|loincloths?|togas?|smocks?|breeches|doublets?|corsets?|kirtles?|wraps?)\b/i;

const failures = [];
const fail = (what) => { failures.push(what); };

const G = loadGenerator(HTML, WORLDS);
const W = G.W, TR = W.transformation.tracks.species, LK = W.genPools.looks;
const kinds = Object.keys(TR);
assert.deepEqual(kinds.slice().sort(), Object.keys(LEAKS).sort(), 'every kind with tracks is checked');
const norm = (s) => String(s || '').toLowerCase().replace(/: /g, ', ').replace(/\.\s*$/, '').replace(/,? in the drawn colou?r/g, '').trim();
// A "To ..." column is written with where it starts (genPools.looks.to: "from the hands to the shoulders"), so a bust that sways when
// the shoulders turn never reads as the arms' column.
const rendered = (k, key, w) => { const to = ((LK.kinds[k].to || {})[key] || (LK.to || {})[key]); return /^to /.test(w) && to ? String(to).toLowerCase() + ' ' + w : w; };
const labelOf = (k, t) => ((LK.kinds[k].labels || {})[t.key] || LK.labels[t.key] || (t.face ? 'Face' : t.name));
const sexOf = (g) => (g === 'female' ? 'women' : 'men');
// The world's names for a part, and whether the looks say it: "the tail to the knee" names the tail, "two hooved fingers and a hooved
// thumb" does not name the hands and is led in by "hands of".
const namesOf = (k, label) => Object.assign({}, LK.names, LK.kinds[k].names || {})[label] || [label.toLowerCase()];
const has = (k, looks, label) => namesOf(k, label).some((n) => new RegExp('\\b' + esc(n) + '\\b', 'i').test(looks));
// Every label a look ever carried: the fixed rows, the kinds' part labels and colours, and every track's name. None may open a
// sentence or a clause before a colon.
const LABELS = new Set(['Height', 'Build', 'Hair', 'Eyes', 'Face', 'Ears', 'Bust', 'Breasts', 'Body', 'Figure'].concat(Object.values(LK.labels || {})));
for (const K of Object.values(LK.kinds)) { for (const l of Object.values(K.labels || {})) LABELS.add(l); if (K.colour) (typeof K.colour === 'object' ? Object.values(K.colour) : [K.colour]).forEach((l) => LABELS.add(l)); }
for (const k of kinds) for (const t of TR[k]) LABELS.add(t.name);
const LABEL_RE = new RegExp('(?:^|[.;] )(?:' + [...LABELS].map(esc).join('|') + '): ');
// The leads the paragraph puts before a part that does not name itself, dropped before the run check: "the tail" before "to the
// knee" and "a strip of coat from the tail to the nape" are not the tail said twice.
const LEADS = [...new Set([].concat(Object.values(LK.leads || {}), ...Object.values(LK.kinds).map((K) => Object.values(K.leads || {}))).filter(Boolean))].sort((a, b) => b.length - a.length);
const unled = (clause) => { const l = LEADS.find((x) => clause.toLowerCase().startsWith(x.toLowerCase() + ' ')); return l ? clause.slice(l.length + 1) : clause; };
// The column each ranged feature is told at, read from the paragraph (a kind's swap for the sex applied: a fairy man's tinted wings).
function columnsOf(k, g, looks) {
  const K = LK.kinds[k], cols = {}, L = String(looks || '').toLowerCase();
  for (const t of TR[k]) {
    if (!t.range || !(K.parts || []).includes(t.key) || (t.sex && t.sex !== sexOf(g))) continue;
    for (const c of ['least', 'standard', 'most']) {
      let w = norm(((K.born || {})[t.key] || {})[c] || t.range[c]); if (!w || w === 'none') continue;
      for (const [from, to] of (((K.swap || {})[g] || {})[t.key] || [])) w = w.replace(new RegExp('\\b' + from + '\\b', 'g'), to);
      if (L.includes(rendered(k, t.key, w))) cols[t.key] = c;
    }
  }
  return cols;
}
// The body's features (not the face, not a feature that follows another's column), as [key, column].
const bodyCols = (k, cols) => Object.entries(cols).filter(([key]) => { const t = TR[k].find((x) => x.key === key); return !t.face && !t.extentWith; });
// The clause of a paragraph that carries a column's words, its lead dropped.
const clauseWith = (looks, want) => unled(clauses(looks).find((c) => c.toLowerCase().includes(want)) || '');

// 1. Twenty at the standard extent, per kind and sex.
for (const k of kinds) {
  const sp = W.genPools.species[k];
  assert.deepEqual(sp.genders.slice().sort(), Object.keys(LEAKS[k]).sort(), k + ': rabbit and harpy are women only; the rest have both');
  for (const g of sp.genders) {
    for (let i = 0; i < N; i++) {
      const p = G.genPerson(W, { species: k, gender: g, extent: 0 }), L = String(p.looks || ''), tag = k + ' ' + g + ' #' + i;
      const open = L.replace(/\. No [^.]*\.$/, '.');
      for (const re of LEAKS[k][g]) if (re.test(open)) fail(tag + ': the other sex\'s feature ' + re + ' in "' + L.slice(0, 160) + '…"');
      for (const [re, what] of WATCH.concat(KIND_WATCH[k] || [])) if (re.test(open) || (what === 'paws for hands' && clauses(open).some((c) => re.test(c)))) fail(tag + ': ' + what);
      for (const [re, what] of FEATURES.all) if (!re.test(L)) fail(tag + ': no ' + what);
      if (!HEIGHT.test(openingOf(L))) fail(tag + ': no absolute height at the opening: ' + openingOf(L));
      if (!buildOf(L)) fail(tag + ': no build after the height: ' + openingOf(L));
      for (const part of ['tail', 'arms', 'legs', 'spine']) { const label = FEATURES[part][k]; if (label && !has(k, L, label)) fail(tag + ': no ' + part + ' (' + label + ')'); }
      for (const label of FEATURES[g][k] || []) if (!has(k, L, label)) fail(tag + ': no by-sex feature ' + label);
      if (g === 'female' && !bustOf(L)) fail(tag + ': no bust');
      for (const w of BOUNDS[k] || []) if (!new RegExp('\\b' + w).test(L)) fail(tag + ': no boundary word "' + w + '"');
      if (/\byou(?:r|rs|rself)?\b/i.test(L)) fail(tag + ': "you" in the looks');
      const build = buildOf(L);
      if (/\b(?:round|low|squat|stocky)\b/i.test(build) || /\b(?:squat|stocky)\b|\blow and round\b|\bround and low\b/i.test(L)) fail(tag + ': a lone shape word in the build');
      if (HEAVY.test(build)) fail(tag + ': a heavy or thick build: ' + build);
      if ((k === 'goblin' || k === 'fairy') && !/adult in proportion/.test(L)) fail(tag + ': adult proportions not stated');
      if (/\bmuzzle\b/i.test(L)) fail(tag + ': a muzzle at the standard face');
      if (g === 'female' && !/\bwaist\b[^.]*\bhips\b[^.]*\bthighs\b/.test(build)) fail(tag + ': the build is not waist, hips and thighs: ' + build);
      if (g === 'male' && !/\bshoulders\b[^.]*\bchest\b[^.]*\bwaist\b/.test(build)) fail(tag + ': the build is not shoulders, chest and waist: ' + build);
      if (/\b(?:wrap|waistcoat|bodice|apron|shawl|jeans|jumper|cardigan|shirt|skirt|trousers|sweater|jacket|blouse|robe|tunic|boots?|shoes?|sandals?|hat|cap|scarf)\b/i.test(L)) fail(tag + ': a garment in the looks');
      if (LABEL_RE.test(L)) fail(tag + ': a label in the paragraph: ' + (LABEL_RE.exec(L) || [])[0]);
      // What no body here has is said beside the looks, for the narrator; what this sex of the kind lacks is in the looks themselves, not twice.
      const absent = G.absentText ? G.absentText(W, k, p) : '';
      if (!/\bpaws in place of hands\b/.test(absent) || !/\bmoon\b/.test(absent)) fail(tag + ': "Not on this body" does not name paws for hands and the moon');
      if (k === 'cow' && g === 'female' && /\bhorns\b/.test(absent)) fail(tag + ': "Not on this body" says horns again, which the looks already close with');
    }
  }
}
// A look written by hand (no closing negatives) still gets the kind's must-nots beside it, less what the look itself names: a cow
// woman written with horns keeps them (the crest and the heavy neck stay denied), and a snout written in is the face's muzzle.
{
  const hand = G.absentText ? G.absentText(W, 'cow', { gender: 'female', looks: 'A tall woman with a kind face.' }) : '';
  if (!/\bhorns\b/.test(hand) || !/\bmuzzle\b/.test(hand)) fail('a look written by hand: "Not on this body" does not name horns and a muzzle: ' + hand);
  const horned = G.absentText ? G.absentText(W, 'cow', { gender: 'female', looks: 'Petite and slim, with cow ears out to the sides and two small curved horns just above them, and a broad soft nose.' }) : '';
  if (/\bhorns?\b/.test(horned)) fail('a look written by hand that gives horns: "Not on this body" denies them: ' + horned);
  if (!/\bcrest\b/.test(horned) || !/\bheavy neck\b/.test(horned) || !/\bmuzzle\b/.test(horned)) fail('a look written by hand that gives horns: the rest of the must-nots are not kept: ' + horned);
  const snouted = G.absentText ? G.absentText(W, 'wolf', { gender: 'female', looks: 'Tall and rangy, grey in the pelt, with a short dark snout and amber eyes.' }) : '';
  if (/\bmuzzle\b/.test(snouted)) fail('a look written by hand with a snout: "Not on this body" denies a muzzle: ' + snouted);
}
// The kind's must-nots, split as the engine splits them (each side of an "or"), never match a fixed line of the kind's own tracks at
// any column: a must-not that trips a line the world itself writes (a cat woman's forearms) is a must-not written wrong.
for (const k of kinds) {
  const K = LK.kinds[k], A = K.absent || {};
  for (const g of W.genPools.species[k].genders) {
    const res = [].concat(...[].concat(A[g] || [], A.all || []).map((x) => String(x).replace(/^(?:an?|the) /i, '').split(/ or /))).map((x) => x.replace(/^(?:an?|the) /i, '').replace(/ (?:apart from|more than) .*$/, '').trim()).filter(Boolean).map((x) => new RegExp('\\b' + esc(x.replace(/s$/, '')) + 's?\\b', 'i'));
    for (const extent of [-1, 0, 1]) {
      const L = String(G.genPerson(W, { species: k, gender: g, extent }).looks || '');
      const fields = L.replace(/\. No [a-z][^.]*\.$/, '.').split(/\. (?=[A-Z][A-Za-z' ]{1,30}: )/).map((x) => x.replace(/^[A-Z][A-Za-z' ]{1,30}: /, '').replace(/\.$/, '').replace(/;?\s*never an? [^;]*/gi, ''));
      for (const re of res) for (const x of fields) if (re.test(x)) fail(k + ' ' + g + ' at extent ' + extent + ': the must-not ' + re + ' matches the kind\'s own line "' + x + '"');
    }
  }
}

// 1b. Sixty drawn freely, per kind and sex: the v84 root causes, and the paragraph's own.
const figuresSeen = {}, cupsSeen = new Set();
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
      for (const t of TR[k]) {
        if (!t.range || !(K.parts || []).includes(t.key) || (t.sex && t.sex !== sexOf(g)) || t.extentWith) continue;
        if (!cols[t.key]) { if (!(K.unless && K.unless[t.key])) fail(tag + ': ' + t.key + ' is not told in any column: ' + L); continue; }
        // Each part told says what it is, by the world's names for it or the lead before it.
        if (!has(k, L, labelOf(k, t))) fail(tag + ': ' + t.key + ' is told without naming the ' + labelOf(k, t).toLowerCase() + ': ' + L);
      }
      // A coat over all but the face cannot end at the elbows: with the leg covering at the most column, a ranged arm covering is there too.
      const keyUnder = (label) => (K.parts || []).map((key) => TR[k].find((t) => t.key === key)).filter((t) => t && t.range && (!t.sex || t.sex === sexOf(g))).find((t) => labelOf(k, t) === label);
      const arms = keyUnder('Arms'), legs = keyUnder('Legs');
      if (arms && legs && cols[legs.key] === 'most' && cols[arms.key] !== 'most') fail(tag + ': the legs at the most column with the arms at "' + (cols[arms.key] || 'none') + '": ' + L);
      // A mer man's fin is one feature: the look never claims a tall back fin beside small fins or a low ridge.
      if (k === 'mer' && g === 'male' && /\b(?:small fins|a low ridge)\b/i.test(L) && /\btall back fin\b/i.test(L)) fail(tag + ': a tall back fin beside small fins or a low ridge: ' + L);
      // The figure first, its parts and the bust agreeing with it; no figure heavy, no part thick or heavy.
      const bm = /^(\w+), with (.*)$/.exec(buildOf(L));
      if (!bm) fail(tag + ': the build does not open with a figure word: ' + (buildOf(L) || '(none)'));
      else {
        const f = (LK.figures[g] || []).find((x) => x.word === bm[1]);
        if (!f) fail(tag + ': "' + bm[1] + '" is not a figure of the world\'s');
        else {
          figuresSeen[g + ' ' + f.word] = (figuresSeen[g + ' ' + f.word] || 0) + 1;
          for (const ph of bm[2].split(/, | and /)) { const part = (/\b(waist|hips|thighs|shoulders|chest)\b/.exec(ph) || [])[1]; if (!part || !(f.fits[part] || []).some((w) => new RegExp('\\b' + w + '\\b').test(ph))) fail(tag + ': "' + ph + '" does not fit a ' + f.word + ' figure'); }
          if (g === 'female') { const m = CUP.exec(bustOf(L)), cup = m && (m[1] || m[2]); if (cup && !f.cups.includes(cup)) fail(tag + ': a ' + cup + ' cup on a ' + f.word + ' figure'); if (cup) cupsSeen.add(cup); }
        }
        if (HEAVY.test(bm[0])) fail(tag + ': a heavy or thick build: ' + bm[0]);
      }
      // The hair, then the eyes once, as one drawn phrase, in the second sentence; the chest once.
      const eyes = eyesOf(L);
      if (!hairEyesOf(L) || !/\bhair\b/i.test(hairOf(L))) fail(tag + ': the second sentence is not the hair and the eyes: ' + (sentences(L)[1] || ''));
      if (!(sp.eyes || []).includes(eyes)) fail(tag + ': the eyes are not one drawn phrase: "' + eyes + '"');
      else if (L.split(eyes).length !== 2) fail(tag + ': the eyes are not said once: ' + L);
      if (sentences(L).filter((s) => CUP.test(s)).length > 1) fail(tag + ': the chest is said twice');
      if (LABEL_RE.test(L)) fail(tag + ': a label in the paragraph: ' + (LABEL_RE.exec(L) || [])[0]);
      if (/: /.test(L) && !/\bhuman: /.test(L)) fail(tag + ': a colon inside the paragraph: ' + L);
      if (YOUNG.test(L)) fail(tag + ': a young animal\'s word: ' + (YOUNG.exec(L) || [])[0]);
      // The kind's must-nots for this sex close the looks as plain negatives, and the parts never carry them.
      if (nots.length && !L.endsWith(' ' + cap(nots.join(', ')) + '.')) fail(tag + ': the looks do not close with "' + cap(nots.join(', ')) + '.": ' + L.slice(-160));
      const parts = clauses(L.replace(/\. No [a-z][^.]*\.$/, '.'));
      for (const re of LEAKS[k][g]) if (parts.some((x) => re.test(x.replace(/;?\s*never an? [^;]*/gi, '')))) fail(tag + ': the other sex\'s feature ' + re + ' in a part');
      // No run of three words twice (a hyphenated word is one; the colour is said by the hair too, by design; a lead is not a part).
      const colourLabel = K.colour && (typeof K.colour === 'object' ? K.colour[g] : K.colour), colourRe = colourLabel ? new RegExp('^(?:(.+?) ' + esc(colourLabel.toLowerCase()) + '\\b|' + esc(colourLabel.toLowerCase()) + ' (.+))', 'i') : null;
      const colour = colourRe ? (sentences(L).map((s) => colourRe.exec(s.split('; ')[0])).filter(Boolean).map((m) => m[1] || m[2]).find((c) => (sp.colours || []).some((x) => x.toLowerCase() === c.toLowerCase())) || '') : '';
      if (colourLabel && !colour) fail(tag + ': the colour sentence does not open with a colour of the kind\'s and the ' + colourLabel.toLowerCase() + ': ' + L);
      const seen = new Set(); let twice = '';
      for (const x of parts.map(unled)) { const w = (colour ? x.replace(new RegExp(esc(colour), 'gi'), ' ') : x).toLowerCase().match(/[a-z'-]+/g) || []; for (let j = 0; j + 2 < w.length; j++) { const run = w.slice(j, j + 3).join(' '); if (seen.has(run)) twice = run; seen.add(run); } }
      if (twice) fail(tag + ': the run "' + twice + '" twice in ' + L);
    }
  }
}
// Across the free draws the new figures are reached and the fuller cups still drawn; a non-binary person (a human, who has no tracks)
// reaches petite and willowy too.
for (let i = 0; i < FREE; i++) { const f = (/^(\w+), with /.exec(buildOf(G.genPerson(W, { species: 'human', gender: 'nonbinary' }).looks)) || [])[1]; if (f) figuresSeen['nonbinary ' + f] = (figuresSeen['nonbinary ' + f] || 0) + 1; }
for (const want of ['female petite', 'female willowy', 'female slim', 'female full', 'nonbinary petite', 'nonbinary willowy', 'male solid', 'male lean']) if (!figuresSeen[want]) fail('the ' + want + ' figure was never drawn in ' + FREE + ' draws per kind: ' + JSON.stringify(figuresSeen));
for (const cup of ['AA', 'A', 'B', 'C', 'D', 'DD', 'E']) if (!cupsSeen.has(cup)) fail('a ' + cup + ' cup was never drawn: ' + [...cupsSeen].join(' '));
// The pools themselves: no figure is heavy, no fit or pool phrase thick or heavy, no breast line heavy.
for (const [sx, figs] of Object.entries(LK.figures || {})) for (const f of figs) if (HEAVY.test(f.word) || Object.values(f.fits).some((ws) => ws.some((w) => HEAVY.test(w)))) fail('figures ' + sx + ': ' + f.word + ' is heavy or fits a heavy part');
for (const [sx, B] of Object.entries(LK.build || {})) for (const [part, pool] of Object.entries(B)) for (const ph of pool) if (HEAVY.test(ph)) fail('build ' + sx + ' ' + part + ': "' + ph + '" is heavy or thick');
for (const [k, K] of Object.entries(LK.kinds)) for (const [sx, B] of Object.entries(K.build || {})) for (const [part, pool] of Object.entries(B)) for (const ph of pool) if (HEAVY.test(ph)) fail(k + ' build ' + sx + ' ' + part + ': "' + ph + '" is heavy or thick');
for (const [k, K] of Object.entries(LK.kinds)) for (const [sx, D] of Object.entries(K.sexDraws || {})) for (const [part, pool] of Object.entries(D)) for (const ph of pool) if (HEAVY.test(ph)) fail(k + ' sexDraws ' + sx + ' ' + part + ': "' + ph + '" is heavy or thick');
for (const [sx, D] of Object.entries(LK.sexDraws || {})) for (const [part, pool] of Object.entries(D)) for (const ph of pool) if (HEAVY.test(ph)) fail('sexDraws ' + sx + ' ' + part + ': "' + ph + '" is heavy or thick');
for (const line of (W.genPools.breasts || []).concat(...Object.values(W.genPools.species).map((s) => s.breasts || []))) if (/\bheavy\b/.test(line)) fail('a breast line says heavy: ' + line);
if (!(W.genPools.species.cow.breasts || []).some((b) => /^medium perky breasts, a C cup, faintly veined toward small areolae; the nipples long and thick like teats$/.test(b))) fail('the bovine pool lacks the medium perky C cup line');

// The kinds without tracks that have women (the ogre, humans, a chimera) keep the world's rule that a woman's figure allows her
// cup: no A cup on a heavy figure.
for (const k of Object.keys(LK.kinds).filter((x) => !TR[x] && W.genPools.species[x] && W.genPools.species[x].genders.includes('female'))) {
  for (let i = 0; i < FREE; i++) {
    const L = String(G.genPerson(W, { species: k, gender: 'female' }).looks || ''), tag = k + ' female free #' + i;
    const bm = /(?:^|\. )Build: (\w+), with ([^.]*)\./.exec(L); if (!bm) continue;   // a kind whose pools fit no figure is told part by part
    const f = (LK.figures.female || []).find((x) => x.word === bm[1]);
    if (!f) { fail(tag + ': "' + bm[1] + '" is not a figure of the world\'s'); continue; }
    const m = CUP.exec(fieldOf(L, 'Bust')), cup = m && (m[1] || m[2]);
    if (cup && f.cups && !f.cups.includes(cup)) fail(tag + ': a ' + cup + ' cup on a ' + f.word + ' figure: ' + fieldOf(L, 'Build') + ' / ' + fieldOf(L, 'Bust'));
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
      const born = ((((W.genPools.looks.kinds || {})[k] || {}).born || {})[t.key] || {})[col], want = rendered(k, t.key, norm(born || t.range[col]));
      if (!want || want === 'none') continue;
      // A covering drawn over the belly leaves the separate belly line out; a feature named only by a kind's own data is still told.
      if (!L.includes(want)) fail(tag + ': ' + t.key + ' is not told as "' + (born || t.range[col]) + '"');
      // A whole-body coat is still told from the legs, never as a coat with no legs in it.
      if (labelOf(k, t) === 'Legs') { const legs = clauseWith(p.looks, want.split('; ')[0]); if (!/^(?:(?:feathers|scales|bark) from )?(?:paws|hooves|feet|knee|stockings) to /i.test(legs)) fail(tag + ': the legs do not start from the legs: ' + legs); }
    }
    if (/\byou(?:r|rs|rself)?\b/i.test(L)) fail(tag + ': "you" in the looks');
    for (const re of LEAKS[k][g]) if (re.test(L.replace(/\. no [^.]*\.$/, '.'))) fail(tag + ': the other sex\'s feature ' + re);
    if (LABEL_RE.test(p.looks)) fail(tag + ': a label in the paragraph: ' + (LABEL_RE.exec(p.looks) || [])[0]);
    // The closing negatives deny nothing the look asserts: a mer woman at the most column has a high back fin, and the closing
    // sentence does not then say she has no back fin.
    if (k === 'mer' && g === 'female' && col === 'most') { const closing = (/\. (no [a-z][^.]*)\.$/.exec(L) || [])[1] || ''; if (/\bback fin\b/.test(closing) && /\bback fin\b/.test(L.slice(0, L.length - closing.length - 2))) fail(tag + ': the closing "' + closing + '" denies the back fin the look gives: ' + L); }
    // 2a. As far as the kind goes, the person stays themselves: the face is human first (a muzzle short and the eyes human, never
    // an animal's head or a face too fine to be human), and the hair stays hair with whatever grows through it. Fails on efff600
    // (a fairy's face, a harpy's and a dryad's hair).
    if (col === 'most') {
      const face = sentenceWith(p.looks, /\bface\b|\bmuzzle\b/i, 2);
      if (!face || /\b(?:head|snout|long muzzle|inhuman|to be human|animal'?s? face)\b/i.test(face)) fail(tag + ': the face is not human first: "' + face + '"');
      if (/\bmuzzle\b/i.test(face) && !(/\bshort\b[^;]*\bmuzzle\b/i.test(face) && /\bhuman eyes\b/i.test(face))) fail(tag + ': a muzzle that is not short, with the person\'s eyes: "' + face + '"');
      if (!/\bhair\b/i.test(hairOf(p.looks)) || /\bin place of hair\b/.test(L)) fail(tag + ': the hair does not stay hair: ' + p.looks);
      // The fullest crest names the crest and the tufts where the ears were, in its own sentence after the hair's (which may say the
      // crest stands up through the hair); a coat over the body says what it is and that it covers the legs. Fails on b46a295.
      if (k === 'harpy' && !/\bcrest\b[^.]*\btufts\b[^.]*\bears\b/.test(sentenceWith(p.looks, /\bcrest\b/i, 2))) fail(tag + ': the crest does not name the crest and the ear tufts: "' + sentenceWith(p.looks, /\bcrest\b/i, 2) + '"');
      const coat = { harpy: 'feathers', mer: 'scales', dryad: 'bark' }[k];
      if (coat && !clauses(p.looks).map(unled).some((c) => new RegExp('^' + coat + ' from (?:knee|feet) to hips\\b', 'i').test(c))) fail(tag + ': no clause names the ' + coat + ' over the legs: "' + p.looks + '"');
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

// 2d. A dryad's hair is hair alone, at every column: the leaves sentence alone says how many leaves grow through it, so the two
// never give different amounts (a leaf or two in the hair beside a crown of leaves). Fails on b46a295.
for (const g of W.genPools.species.dryad.genders) for (const extent of [-1, 0, 1]) for (let i = 0; i < N; i++) {
  const L = String(G.genPerson(W, { species: 'dryad', gender: g, extent }).looks || ''), hair = hairOf(L);
  if (!hair || /\bleaf|\bleaves\b/i.test(hair)) { fail('dryad ' + g + ' extent ' + extent + ': the hair is not hair alone: "' + hair + '"'); break; }
}

// 2e. The readers of a paragraph: the brief is its height, build, hair and eyes; the phrase inside another line is the brief; the
// short form (for a person the last turn showed) is the paragraph itself; a labelled look of the older form is still read.
if (G.looksBrief && G.looksPhrase && G.looksShort) {
  const L = String(G.genPerson(W, { species: 'cow', gender: 'female', extent: 0 }).looks || '');
  const brief = G.looksBrief(L);
  if (brief !== lowerFirst(openingOf(L)) + '; ' + lowerFirst(hairEyesOf(L))) fail('the brief of a paragraph is not its opening and its hair and eyes: ' + brief);
  if (/\bbreasts\b|\bhooves\b|\bNo horns\b/.test(brief)) fail('the brief carries the body: ' + brief);
  if (G.looksPhrase(L) !== brief) fail('the phrase of a paragraph is not its brief: ' + G.looksPhrase(L));
  if (G.looksShort(L) !== L) fail('the short form of a paragraph is not the paragraph: ' + G.looksShort(L));
  if (!G.looksProse(L) || G.looksLabelled(L)) fail('a composed paragraph is not read as one: ' + L.slice(0, 80));
  const hand = 'A tall woman with a kind face, grey eyes and a long plait.';
  if (G.looksProse(hand) || G.looksBrief(hand) !== hand || G.looksShort(hand) !== hand) fail('a look written by hand is read as composed, or changed by a reader');
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
    if (!/Looks: About (?:\w+ foot(?: \w+)?); \w+, with /.test(P)) fail('intro: the looks are not the composed paragraph');
    if (!/Looks: About [^\n]*\. No horns, no crest, no heavy neck\./.test(P)) fail('intro: the looks do not close with what a bovine woman never has');
    if (/Looks: [^\n]*\b(?:Height|Build|Hair|Eyes|Hide|Hands|Legs|Feet|Tail|Bust): /.test(P)) fail('intro: a label in the looks');
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
  for (const c of people) if (c.species && W.genPools.species[c.species] && !HEIGHT.test(openingOf(c.looks))) fail(c.key + ': stored looks are not composed (' + String(c.looks).slice(0, 80) + ')');
  for (const c of people) if (c.species && W.genPools.species[c.species] && c.looksV !== 3) fail(c.key + ': stored looks are not marked as composed the paragraph way (looksV ' + c.looksV + ')');
  h.close && h.close();

  // 4. The same adventure saved by an earlier version: the roommate's look is labelled rows, names a track for a label, says the
  // eyes twice and has no closing negatives, and a Cast edit carries it unchanged; another cast member's look was edited by hand. On
  // load the roommate's is composed again as the paragraph (keeping her colour, hair, eyes, chest and every part's words), the edit
  // that only carried it follows, the edit by hand stays.
  {
    const seeded = new Map([...h.mock.store].map(([p, d]) => [p, JSON.parse(JSON.stringify(d))]));
    const stored = advOf(seeded)[1].data, rm = stored.roommate;
    const fresh = 'Height: about five foot four. Build: full, with a soft waist, generous hips and full thighs. Bust: round full breasts, a D cup, high and close-set, veined faintly blue toward wide areolae. Hair: hair cut blunt at the jaw, chestnut, that falls forward when the head bends over a book and is pushed back with the back of the wrist. Eyes: dark eyes with a faint blue cast. Hide: chestnut. Hands: two hooved fingers and a hooved thumb. Arms: from the hands to the elbows. Legs: hooves to hips, fading out at the navel. Feet: two toes in a split hoof with dewclaws behind; heel raised, weight on the hooves. Spine: a strip of coat from the tail to the nape. Tail: to the knee, tufted. Ears: cow ears out to the sides. Face: a faint cast, a broad soft nose, the jaw slightly forward. Teats and udder: long thick nipples like teats; a small rounded four-teated udder. No horns, no crest, no heavy neck.';
    const old = fresh.replace(/ Arms: /, ' Forearm coat: ').replace(/ Eyes: ([^.]*)\./, ' Eyes: $1; large, dark-lashed, wide-seeing eyes.').replace(/\. No [^.]*\.$/, '.');
    assert(old !== fresh && /Forearm coat: /.test(old) && !/\. No /.test(old), 'the older look is made from the labelled one: ' + old);
    rm.looks = old; rm.gen.looks = old; delete rm.looksV;
    const edited = stored.cast.generated.characters.find((c) => c.species && W.genPools.species[c.species]);
    // A harpy's look of this version as efff600 composed it at the fullest: her crest took the place of her hair, so there is no
    // Hair field, and the crest and the leg feathers are in words the world has since changed; it carries a word the Cast editor
    // showed filled ({first}), and a Cast edit holds that filled form. On load the words are mended in place, a Hair field from the
    // kind's pool goes in, nothing else is drawn again, the look is composed as the paragraph and the edit follows. Fails on b46a295.
    const worded = stored.cast.generated.characters.find((c) => c !== edited && c.looksV);
    Object.assign(worded, { species: 'harpy', gender: 'female', pronouns: { they: 'she', them: 'her', their: 'her', theirs: 'hers' }, looksV: 2 });
    const wordedOld = 'Height: about five foot two. Build: slim, with a slim waist, narrow hips and slim thighs. Bust: shallow breasts, an A cup, with nipples long for the size of them and areolae small and dark. Eyes: bright black eyes. Plumage: black with a green sheen. Arms: arms feathered from shoulder to wrist. Wings: great wings and strong sustained flight. Hands: a thumb and one strong clawed finger. Legs: over belly, ribs and back; all but the face and chest. Feet: heavy talons, scaled to above the knee. Tail: a long sweeping fan that {first} once called a duster. Crest: feathers in place of hair. Face: a fine hard-edged nose, feathered brows and cheeks; never a beak. Frame: a light frame, a deep breastbone and small high breasts. No wings on the back apart from the arms, no beak.';
    worded.looks = wordedOld; if (worded.gen) worded.gen.looks = wordedOld;
    stored.cast.overrides = Object.assign({}, stored.cast.overrides, { roommate: { looks: old }, [edited.key]: { looks: 'A tall woman with a scar across one eyebrow.' }, [worded.key]: { looks: wordedOld.replace('{first}', 'Ada') } });
    const h2 = await boot({ setup(w, m) { m.store = seeded; } });
    assert(await h2.settle(150, 8000), 'the older save did not load'); await h2.idle(10000); await h2.settle(100, 4000);
    assert(await h2.turn('I look around the room.'), 'a turn on the older save');
    const after = advOf(h2.mock.store)[1].data, r2 = after.roommate, low = String(r2.looks).toLowerCase();
    if (r2.looks === old || !HEIGHT.test(openingOf(r2.looks)) || /Forearm coat: /.test(r2.looks) || LABEL_RE.test(r2.looks)) fail('older save: the roommate\'s look was not composed again as the paragraph: ' + r2.looks);
    if (r2.looksV !== 3) fail('older save: the recomposed look is not marked (looksV ' + r2.looksV + ')');
    if (!r2.looks.endsWith(' No horns, no crest, no heavy neck.')) fail('older save: the recomposed look does not close with the must-nots: ' + r2.looks.slice(-120));
    for (const label of ['Eyes', 'Hair', 'Bust', 'Height', 'Build', 'Face', 'Hands', 'Legs', 'Feet', 'Tail', 'Ears', 'Arms', 'Spine', 'Teats and udder']) if (!low.includes(fieldOf(fresh, label).toLowerCase())) fail('older save: the ' + label + ' "' + fieldOf(fresh, label) + '" is not kept in ' + r2.looks);
    if (!/(?:^|\. )Chestnut hide from the hands to the elbows; hooves to hips/.test(r2.looks)) fail('older save: the hide colour does not open the colour sentence: ' + r2.looks);
    if (eyesOf(r2.looks) !== 'dark eyes with a faint blue cast' || /wide-seeing/.test(r2.looks)) fail('older save: the eyes are not the one phrase once: ' + hairEyesOf(r2.looks));
    if (r2.gen.looks !== r2.looks) fail('older save: the generated record kept the old look');
    if (!after.cast.overrides || after.cast.overrides.roommate.looks !== r2.looks) fail('older save: the Cast edit that only carried the old look did not follow it: ' + JSON.stringify(after.cast.overrides && after.cast.overrides.roommate));
    if (after.cast.overrides[edited.key].looks !== 'A tall woman with a scar across one eyebrow.') fail('older save: a look edited by hand was changed');
    const w2 = after.cast.generated.characters.find((c) => c.key === worded.key), w2low = String(w2.looks).toLowerCase();
    if (!W.genPools.species.harpy.hair.some((x) => w2low.includes(x.toLowerCase()))) fail('older save: a harpy whose crest had taken the place of her hair was given no hair from her pool: ' + w2.looks);
    if (!HEIGHT.test(openingOf(w2.looks)) || w2.looksV !== 3 || LABEL_RE.test(w2.looks)) fail('older save: the harpy\'s look was not composed again as the paragraph (looksV ' + w2.looksV + '): ' + w2.looks);
    for (const kept of ['about five foot two; slim, with a slim waist, narrow hips and slim thighs.', 'shallow breasts, an a cup, with nipples long for the size of them and areolae small and dark', 'bright black eyes', 'plumage black with a green sheen', 'a full crest, feathers all through the hair, and tufts where the ears were', 'feathers from knee to hips and over belly, ribs and back; all but the face and chest', 'a thumb and two strong clawed fingers, the claws long and curved', 'heavy talons, scaled to above the knee', 'the tail a long sweeping fan', 'a fine hard-edged nose, feathered brows and cheeks; never a beak', 'no wings on the back apart from the arms, no beak.']) if (!w2low.includes(kept)) fail('older save: the harpy\'s look lost "' + kept + '": ' + w2.looks);
    if (/feathers in place of hair|one strong clawed finger|legs: over belly/i.test(w2.looks)) fail('older save: the reworded lines were not mended: ' + w2.looks);
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
    // The sentences of a paragraph that do not vary between two loads of one old look: all but the height and build, the hair and eyes,
    // the chest and the kind's own draws (the wolf's fur and pads, in the colour sentence).
    const settled = (k, L) => sentences(L).slice(1).filter((s) => !/\bhair\b|\beyes\b/i.test(s) && !CUP.test(s) && !(LK.kinds[k].draws || []).some((d) => s.includes(d.label))).join(' | ');
    const wolf = { key: 'roommate', species: 'wolf', gender: 'female', pronouns: she, looks: 'lean and quick, red-brown at the ears and the tail and the pelt that runs from the small of the back down the legs to padded feet. Pale grey eyes with a shine in low light, canines a little long, hands with rough pads and dark claws. Wears a vest and running shorts and is barefoot, because shoes do not fit paws. Breasts, and below them two more pairs of small nipples down the belly, small and dark in the pelt. a silver wolf pendant on a leather cord, always worn' };
    const w1 = G.recomposeLooks(W, wolf), w2 = G.recomposeLooks(W, wolf);
    if (!/(?:^|\. )Red-brown pelt\b/.test(w1)) fail('recompose: the red-brown wolf did not keep her colour (an eye\'s grey taken for the coat): ' + w1.slice(0, 200));
    if (eyesOf(w1) !== 'pale grey eyes') fail('recompose: the wolf\'s pale grey eyes changed: ' + eyesOf(w1));
    if (settled('wolf', w1) !== settled('wolf', w2)) fail('recompose: the wolf\'s parts differ between two loads: "' + settled('wolf', w1) + '" and "' + settled('wolf', w2) + '"');
    if (/\bmuzzle\b/i.test(w1)) fail('recompose: a muzzle given to a face the old look left human: ' + sentenceWith(w1, /\bface\b|\bmuzzle\b/i, 2));
    if (!/\bnipples in two more pairs\b/i.test(w1)) fail('recompose: the wolf\'s two more pairs were not kept: ' + w1);
    const cow = { key: 'creamery', species: 'cow', gender: 'female', pronouns: she, looks: 'a head taller than you and broad as a good wall. Short polished horns, smoke-grey hide showing at the temples, shoulders and forearms, long soft ears set low. Soft hazel eyes, slow to blink. a cream wool cardigan worn over everything, summer and winter' };
    const c1 = G.recomposeLooks(W, cow);
    if (!/(?:^|\. )Smoke-grey hide\b/.test(c1)) fail('recompose: the smoke-grey cow did not keep her hide (a cardigan\'s cream taken for it): ' + c1.slice(0, 200));
    const dean = { key: 'dean', species: 'chimera', gender: 'female', pronouns: she, looks: 'a chimera of several kinds worn as easily as a coat: antlers, a lion\'s forepaw for a left hand, copper scales down the right arm, feathers at the nape, a tail that has not decided what it is, and a warm amused face that has heard everything; eyes of two colours. a silver charm bracelet worn under her left sleeve, never visible' };
    const d1 = G.recomposeLooks(W, dean);
    if (!/(?:^|\. )A chimera of several kinds[^.]*\bantlers\b[^.]*lion's forepaw/.test(d1)) fail('recompose: the Dean lost her antlers and forepaw to a drawn body: ' + d1.slice(0, 300));
    if (/\bbracelet\b/.test(d1)) fail('recompose: the keepsake sentence stayed in the Dean\'s body line: ' + d1);
    const gardener = { key: 'gardener', species: 'dryad', gender: 'female', pronouns: she, looks: 'tall and still, dark oak grain showing at the collarbones and down the spine, a scatter of leaves in the hair. Moss at the knuckles; moss-green eyes. Small breasts where the bark gives way to skin below the collarbones, green-veined' };
    const g1 = G.recomposeLooks(W, gardener), cup = /\b(AA|A|B|C|D|DD|E|F|G)\b(?= cup|,)/.exec(bustOf(g1));
    if (!cup || !/^(?:AA|A|B)$/.test(cup[1])) fail('recompose: the gardener\'s small breasts came back as a ' + (cup ? cup[1] : '?') + ': ' + bustOf(g1));
    // A kind with no lines keeps its prose as the body, hair and all: no second hair beside it, and never one coloured from the eyes or
    // from inside another word ("red" in "tired"); and a second load of the paragraph keeps the body.
    const he = { they: 'he', them: 'him', their: 'his', theirs: 'his' }, they = { they: 'they', them: 'them', their: 'their', theirs: 'theirs' };
    for (const [key, gender, pr, looks, mine] of [['human_society', 'male', he, 'human, red hair cut short, a face that has decided things; brown eyes. nails cut short and filed smooth, almost obsessively neat', 'red hair'],
      ['wardcraft_prof', 'nonbinary', they, 'entirely human, brown hair, the ordinary kind of tired, which on the Isle is the strangest look in the room; blue eyes', 'brown hair']]) {
      for (let i = 0; i < 6; i++) {
        const x = G.recomposeLooks(W, { key, species: 'human', gender, pronouns: pr, looks });
        if ((x.match(/\bhair\b/gi) || []).length !== 1 || !x.includes(mine)) fail('recompose: ' + key + ' has a second hair beside the body\'s ' + mine + ': ' + x);
        const y = G.recomposeLooks(W, { key, species: 'human', gender, pronouns: pr, looks: x });
        if (!y.includes(mine) || (y.match(/\bhair\b/gi) || []).length !== 1) fail('recompose: a second load of ' + key + ' lost the body or doubled the hair: ' + y);
      }
    }
    // A height and a build the prose gives in words are kept: a head taller or tall at the top of the kind's range, the opening build as
    // written ("lean and quick" is never drawn again as full).
    const top = (k, sx) => { const r = W.genPools.looks.kinds[k].height[sx]; return (h) => { const m = /^about (\w+) foot(?: (\w+))?$/.exec(h) || [], w = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven']; const n = w.indexOf(m[1]) * 12 + (m[2] ? w.indexOf(m[2]) : 0); return n >= r[1] - Math.floor((r[1] - r[0]) / 3); }; };
    const choir = { key: 'choir_lead', species: 'harpy', gender: 'female', pronouns: she, looks: 'tall, hooked in the stance, slate-grey in the wing and grey at the throat, amber eyes like a hawk\'s, set a little too wide. She perches on the backs of chairs rather than sitting on them' };
    for (let i = 0; i < 6; i++) {
      const c2 = G.recomposeLooks(W, cow), h2 = G.recomposeLooks(W, choir), w3 = G.recomposeLooks(W, wolf);
      if (!top('cow', 'female')(heightOf(c2)) || buildOf(c2) !== 'broad as a good wall') fail('recompose: the cow a head taller and broad as a good wall came back as "' + heightOf(c2) + '", "' + buildOf(c2) + '"');
      if (!top('harpy', 'female')(heightOf(h2))) fail('recompose: the tall choir lead came back as ' + heightOf(h2));
      if (buildOf(w3) !== 'lean and quick') fail('recompose: the lean and quick wolf came back as ' + buildOf(w3));
    }
    // A labelled look of the older form whose build names a figure the world no longer draws (heavy, a thick waist) is given a build
    // drawn again from the figures it has; its other parts stay as they were.
    const heavy = { key: 'roommate', species: 'cow', gender: 'female', pronouns: she, looks: 'Height: about five foot four. Build: heavy, with a thick waist, generous hips and heavy thighs. Bust: round full breasts, a D cup, high and close-set, veined faintly blue toward wide areolae. Hair: hair cut blunt at the jaw, chestnut, that falls forward when the head bends over a book and is pushed back with the back of the wrist. Eyes: dark eyes with a faint blue cast. Hide: chestnut. Hands: two hooved fingers and a hooved thumb. Arms: from the hands to the elbows. Legs: hooves to hips, fading out at the navel. Feet: two toes in a split hoof with dewclaws behind; heel raised, weight on the hooves. Spine: a strip of coat from the tail to the nape. Tail: to the knee, tufted. Ears: cow ears out to the sides. Face: a faint cast, a broad soft nose, the jaw slightly forward. Teats and udder: long thick nipples like teats; a small rounded four-teated udder. No horns, no crest, no heavy neck.' };
    for (let i = 0; i < 6; i++) {
      const x = G.recomposeLooks(W, heavy), bm = /^(\w+), with (.*)$/.exec(buildOf(x));
      if (!bm || HEAVY.test(bm[0]) || !(LK.figures.female || []).some((f) => f.word === bm[1])) fail('recompose: the heavy build was not drawn again from the figures: ' + buildOf(x));
      if (heightOf(x) !== 'about five foot four' || eyesOf(x) !== 'dark eyes with a faint blue cast' || !/(?:^|\. )Chestnut hide from the hands to the elbows/.test(x) || !x.includes('two hooved fingers and a hooved thumb')) fail('recompose: the heavy build\'s look lost its other parts: ' + x);
    }
  }

  if (failures.length) {
    console.error('looks-drift: ' + failures.length + ' failures');
    for (const f of (process.env.LD_ALL ? failures : failures.slice(0, 60))) console.error('  - ' + f);
    if (failures.length > 60) console.error('  … and ' + (failures.length - 60) + ' more');
    process.exit(1);
  }
  console.log('looks-drift: all checks passed (' + kinds.length + ' kinds, ' + N + ' per sex at the standard, ' + FREE + ' free, least and most forced, odds, readers, prompts and an older save checked)');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
