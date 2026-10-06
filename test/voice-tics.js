'use strict';
// Voice: what the narrator is shown must not teach the tics a saved game fell into. The shared rules and every style example
// are checked for a banned list of phrases and steering wording, each example for the shape that carries the register (short
// paragraphs, speech and action alternating, plain words, no names, the player's acts and feelings left alone), and the cast
// block for one fragment of a person's Close up and Ways lines a turn instead of the whole line. These asserts read the world
// data and the prompt text; none reads the model's reply. Every failure is listed, not only the first.
const assert = require('node:assert/strict');
const { boot } = require('./boot');

// Phrases a 25-turn save repeated until they were tics, each traced to a line the narrator was shown.
const TICS = [
  ['unhurried', /\bunhurried(ly)?\b/i],
  ['the low note', /\b(the low note|a low,? carrying note|carrying low|low,? carrying)\b/i],
  ['felt not heard', /\b(more felt than heard|felt as much as heard|feel it in your (teeth|jaw|sternum|breastbone)|in your teeth)\b/i],
  ['dark and steady', /\bdark and steady\b/i],
  ['half a second', /\bhalf[- ](a[- ])?second\b/i],
  ['does not bother', /\b(does not|doesn't|did not|didn't) bother\b/i],
  ['sweet grass', /\bsweet[- ]grass\b/i],
  ['hay and warm hide', /\b(hay and (warm )?hide|warm hide and hay)\b/i],
  ['does not shift', /\b(does not|doesn't|did not|didn't) shift\b/i],
  ['last to let go', /\b(the last to let go|let go of last|last to let (go|it))\b/i],
  ['not a question', /\b(not (really |quite )?a question|isn't really a question)\b/i],
  ['notices a non-event', /\b(which you notice (her|him|yourself|and)|you notice (her|him|yourself) not)\b/i],
  ['the way a / you\'d', /\bthe way (you'd|a|an|someone|people|large)\b/i],
  ['patient as', /\b(patient as|with the patience of)\b/i],
  ['consent-check formula', /\b(tell me if it'?s too much|you can say if it'?s too much)\b/i],
  ['a sound that is not a word', /\b(a (sound|noise) (that )?(isn't|is not) a word|no word in it)\b/i],
  ['euphemism for the act', /\b(when you come together|takes? you in(?= and\b|[.,;]))/i],
];
// Rule wording that steered the narrator toward those tics; none of it may reach the prompt.
const STEERING = [
  /Playful and warm, with humour and flirtatious tension/, /the strange shown in passing/, /a thing not said/,
  /Not everything is dialogue; a turn can carry a paragraph of looking and thinking/, /clinically and non-erotically/,
  /choosing from the person's actual scent, texture, movement, sound, weight/, /a piece of their day/, /\(a hum, a gesture, a running joke\)/,
];
// An example decides nothing for the player: no realising, wanting, letting or deciding, and no reason given for what you do.
const DECIDES = /\b(you (realise|realize|decide|let (her|him|them)|cannot stop|can't stop|say nothing|want|feel (afraid|glad|ashamed|safe))|because it is the first time|without deciding to)\b/i;
const PLAIN = /\b(pussy|clit|cock|cum|fuck(ing)?|nipples?|udder|teats?|breasts?|wet)\b/i;
const FELT = /\b(hot|ache|itch\w*|prickl\w*|burn\w*|throb\w*|tight|sting\w*|shiver\w*)\b/i;
const words = (s) => (s.match(/[A-Za-z0-9'-]+/g) || []).length;
const speech = (s) => words((s.replace(/[“”]/g, '"').match(/"[^"]*"/g) || []).join(' '));
const sentences = (p) => p.replace(/[“”]/g, '"').replace(/"[^"]*"/g, 'Q').split(/(?<=[.!?Q])\s+(?=[A-Z])/).filter((x) => x && x !== 'Q').length;
const ticsIn = (text) => TICS.filter(([, re]) => re.test(text)).map(([n]) => n);
const fails = []; const check = (cond, msg) => { if (!cond) fails.push(msg); };

function checkExample(e) {
  const tag = (e.scene || 'untagged') + ' example (' + e.text.slice(0, 30) + '...): ', t = e.text, w = words(t), paras = t.split(/\n+/).filter((p) => p.trim());
  const tics = ticsIn(t); check(!tics.length, tag + 'teaches the tic ' + tics.join(', '));
  check(w >= 150 && w <= 450, tag + w + ' words; 150 to 450 carry the register without crowding the prompt');
  check(paras.length >= 6, tag + 'only ' + paras.length + ' paragraph(s); the register is short paragraphs');
  const long = paras.filter((p) => words(p) > 60 || sentences(p) > 3).length; check(!long, tag + long + ' paragraph(s) over 60 words or three sentences');
  const sp = Math.round(100 * speech(t) / w); check(sp >= (e.scene === 'change' ? 10 : 25), tag + 'speech is ' + sp + '% of the words');
  check((t.match(/\b(not|n't|never|nobody|nothing|without)\b/gi) || []).length <= 4, tag + 'leans on negation');
  check((t.match(/\b(like an?|like the|as if|as though|the way)\b/gi) || []).length <= 2, tag + 'leans on comparison');
  check(!/\b(was|were|had been)\b/.test(t), tag + 'slips out of the present tense');
  check(/\byou\b/i.test(t), tag + 'is not in the second person');
  const proper = (t.replace(/[“”]/g, '"').match(/(?<![.!?"]\s)(?<!^)(?<!\n)(?<!")\b[A-Z][a-z]+/g) || []).filter((x) => x !== 'I');
  check(!proper.length, tag + 'carries a name a later turn would copy: ' + proper.join(', '));
  check(!/\{[^}]+\}/.test(t), tag + 'uses a placeholder');
  check(!DECIDES.test(t), tag + 'decides something for the player: ' + (DECIDES.exec(t) || [''])[0]);
  check(/^"|^[^"]*$/.test(paras[paras.length - 1]), tag + 'ends on neither a line nor a held beat');
  if (e.scene === 'intimate') {
    check((t.match(new RegExp(PLAIN.source, 'gi')) || []).length >= 4, tag + 'does not use the plain words for bodies and acts');
    check(/two fingers and a thumb, each capped in smooth hoof/.test(t), tag + 'the bovine hand is not stated as the world gives it');
    check(/udder[^.]*small and round and low on her belly, bare-skinned among the coat, the four teats/.test(t), tag + 'the udder is not stated as the world gives it');
    for (const re of [/\bhorns?\b/i, /\bhind legs?\b/i, /\bfour fingers\b/i, /\bpaws?\b/i, /\bmuzzle\b/i, /\bmilk\b/i]) check(!re.test(t), tag + 'gives the bovine woman a part or function the world does not: ' + re);
    check(!/\b(orgasm|climax|she comes|you come|cum)\b/i.test(t), tag + 'must stay mid-act, the ending left to the player');
    check(/^"/.test(paras[paras.length - 1]), tag + 'does not end on her line, handing the move over');
  }
  if (e.scene === 'ordinary') check(!PLAIN.test(t), tag + 'carries explicit words into an ordinary scene');
  if (e.scene === 'change') check((t.match(new RegExp(FELT.source, 'gi')) || []).length >= 4, tag + 'does not feel the change (heat, ache, itch, pressure)');
}

async function main() {
  const h = await boot({});
  try {
    assert(await h.settle(150, 6000), 'the page did not settle after boot');
    const W = h.window.WINDLASS_WORLDS.sundered;
    const ex = (W.exemplars || []).map((e) => (typeof e === 'string' ? { text: e } : e));
    for (const e of ex) checkExample(e);
    for (const s of ['ordinary', 'intimate', 'change']) check(ex.some((e) => e.scene === s), 'no style example is tagged scene: ' + s);

    h.type('#cRmSpecies', 'cow'); h.type('#cRmName', 'Bess Alder'); h.click('#cBegin');
    assert(await h.idle(30000), 'creating the adventure did not finish'); await h.settle(150, 6000);
    const prompts = [];
    h.mock.sampleHandler = (input) => {
      const prompt = Array.isArray(input) ? input.map((m) => m.content).join('\n') : String(input);
      if (prompt.includes('You are the storyteller for an interactive text adventure')) prompts.push(prompt);
      return JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: Array(300).fill('moment').join(' '), suggested_actions: ['Stay', 'Speak', 'Leave'], secret_info: '', state_updates: [], time_advance_minutes: 10, events: [], beats: [], facts: [], exposures: [] });
    };
    assert(await h.turn('I unpack and say hello to Bess.'), 'turn 1 did not finish');
    assert(await h.turn('I ask Bess about her course.'), 'turn 2 did not finish');
    assert.equal(prompts.length, 2, 'two storyteller prompts were captured');
    const rules = (/<rules>\n([\s\S]*?)\n<\/rules>/.exec(prompts[0]) || [])[1] || '';
    assert(rules.length > 1000, 'the <rules> block could not be read from the prompt');
    const tics = ticsIn(rules); check(!tics.length, 'the shared rules teach the tic ' + tics.join(', '));
    for (const re of STEERING) check(!re.test(rules), 'the rules still carry steering wording: ' + re);
    check(/Narration: second person, present tense\. Plain, concrete and brisk/.test(rules), 'the Narration rule does not ask for the plain brisk register');
    check(/Carry out the stated action literally and in order, [A-Za-z]+'s words as direct speech/.test(rules), 'the action is not carried out literally with the player\'s words quoted');
    check(/End on a person's line or a held beat/.test(rules), 'a turn does not end on a line or a held beat');
    check(/Genitals are only the parts the source gives a body[^.]*named when the action touches them: neutral outside sex, plain within it/.test(rules), 'no single anatomy statement: plain in sex, neutral outside it, nothing invented');
    check(/never infer anatomy or function from species, pronouns or appearance/.test(rules), 'the never-invent clause is gone');
    check(/a bovine woman's udder low on the belly with four teats/.test(rules), 'the established bovine wording is gone');
    check(/<facts> are background, not props/.test(rules), 'the anti-tic rule does not reach the prompt');
    // The roommate's Close up and Ways lines come one fragment a turn, and the fragment turns with the turn.
    const castLine = (p) => p.split('\n').find((l) => /^- Bess Alder/.test(l)) || '';
    const closeUp = (p) => (/ Close up: ([^]*?)\.(?= Ways \(| Now:)/.exec(castLine(p)) || [])[1];
    const ways = (p) => (/Ways \(show, never explain\): ([^]*?)\. Now:/.exec(castLine(p)) || [])[1];
    for (const p of prompts) {
      check(closeUp(p), 'the roommate\'s Close up line is missing from the cast block: ' + castLine(p).slice(0, 200));
      check(closeUp(p) && !/;/.test(closeUp(p)), 'Close up is the whole line, not one fragment: ' + closeUp(p));
      check(ways(p) && !/;/.test(ways(p)), 'Ways is the whole list, not one fragment: ' + ways(p));
    }
    check(closeUp(prompts[0]) !== closeUp(prompts[1]), 'the Close up fragment does not change from one turn to the next');
    // An ordinary turn is never shown the intimate example, whatever picks the examples.
    for (const p of prompts) for (const e of ex.filter((x) => x.scene === 'intimate')) check(!p.includes(e.text.slice(0, 60)), 'an ordinary turn was shown the intimate example');
    const d = h.diagnostics(); check(!d.errors.length, 'page errors: ' + JSON.stringify(d.errors)); check(!d.violations.length, 'runtime violations: ' + JSON.stringify(d.violations));
    if (fails.length) { console.error('voice-tics failed (' + fails.length + '):\n- ' + fails.join('\n- ')); process.exit(1); }
    console.log('voice-tics passed: ' + TICS.length + ' tics and ' + STEERING.length + ' steering phrases kept out of the rules and ' + ex.length + ' style examples; the cast block turns one fragment a turn');
  } finally { h.close(); }
}
// narration-lint.js counts the same tics in what a real model wrote.
module.exports = { TICS, PLAIN };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
