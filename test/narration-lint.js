'use strict';
// narration-lint.js <a save's turns directory (turns/0000.json ...) or an exported adventure .json> [--gate]
// The mock model writes filler, so no check in the suite can see the voice. This reads what a real model wrote and counts what the
// style reference asks for: the tics voice-tics.js keeps out of the prompt (now counted in the narration), four-word phrases that
// recur across turns, paragraph length, dialogue, and how many turns end on an open line (a question or a spoken line) rather
// than on aftermath. It prints a report. With --gate it exits 1 when a target is missed:
//   no tic in more than 3 turns; no four-word phrase in more than a fifth of the turns; speech in at least 70 percent of the
//   turns; at least 80 percent of the turns end on an open line; at most 3 sentences a paragraph on average.
// Not part of `npm test`: it needs a game played on the real model.
const fs = require('fs'), path = require('path');
const { TICS } = require('./voice-tics');

const src = process.argv[2], gate = process.argv.includes('--gate');
if (!src) { console.error('usage: node narration-lint.js <turns dir | exported .json> [--gate]'); process.exit(2); }
const docs = fs.statSync(src).isDirectory() ? fs.readdirSync(src).filter((f) => /\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'))) : [JSON.parse(fs.readFileSync(src, 'utf8'))];
const turns = docs.flatMap((d) => d.turns ? (Array.isArray(d.turns) ? d.turns : Object.values(d.turns).flatMap((c) => c.turns || [])) : []).filter((t) => t && t.narrative).sort((a, b) => a.n - b.n);
if (!turns.length) { console.error('no turns with narration in ' + src); process.exit(2); }
const N = turns.length, misses = [];
const pct = (k) => Math.round(k * 100 / N) + '%';

console.log(N + ' turns (' + turns[0].n + ' to ' + turns[N - 1].n + ')');
console.log('\ntics, in how many turns:');
for (const [name, re] of TICS) { const k = turns.filter((t) => re.test(t.narrative)).length; if (k) console.log('  ' + String(k).padStart(3) + '  ' + name); if (k > 3) misses.push('the tic "' + name + '" is in ' + k + ' turns'); }

const words = (s) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
const df = new Map();
for (const t of turns) { const w = words(t.narrative), seen = new Set(); for (let i = 0; i + 4 <= w.length; i++) seen.add(w.slice(i, i + 4).join(' ')); for (const g of seen) df.set(g, (df.get(g) || 0) + 1); }
const recur = [...df].filter(([, k]) => k > N / 5 && k > 1).sort((a, b) => b[1] - a[1]);
console.log('\nfour-word phrases in more than a fifth of the turns:' + (recur.length ? '' : ' none'));
for (const [g, k] of recur.slice(0, 15)) console.log('  ' + String(k).padStart(3) + '  "' + g + '"');
if (recur.length) misses.push(recur.length + ' four-word phrase(s) recur in more than a fifth of the turns, the first "' + recur[0][0] + '" in ' + recur[0][1]);

const paras = turns.map((t) => t.narrative.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean));
const sentences = (p) => (p.replace(/[“”]/g, '"').match(/[.!?]+["')\]]*(?=\s|$)/g) || []).length || 1;
const all = paras.flat(), meanSent = all.reduce((a, p) => a + sentences(p), 0) / all.length;
const spoken = turns.map((t) => (t.narrative.replace(/[“”]/g, '"').match(/"[^"]{2,}"/g) || []).length);
const open = paras.filter((ps) => /[?"”]\s*$/.test(ps[ps.length - 1] || '')).length;
console.log('\nwords per turn:       ' + turns.map((t) => words(t.narrative).length).join(' '));
console.log('paragraphs per turn:  ' + paras.map((p) => p.length).join(' '));
console.log('sentences a paragraph: ' + meanSent.toFixed(1) + ' on average (the reference: one to three)');
console.log('spoken lines per turn: ' + spoken.join(' '));
console.log('turns with speech:     ' + spoken.filter(Boolean).length + ' of ' + N + ' (' + pct(spoken.filter(Boolean).length) + ')');
console.log('turns ending open:     ' + open + ' of ' + N + ' (' + pct(open) + '), on a question or a spoken line');
if (meanSent > 3) misses.push('paragraphs run ' + meanSent.toFixed(1) + ' sentences on average');
if (spoken.filter(Boolean).length < N * 0.7) misses.push('speech in only ' + pct(spoken.filter(Boolean).length) + ' of the turns');
if (open < N * 0.8) misses.push('only ' + pct(open) + ' of the turns end on an open line');

if (misses.length) console.log('\nmissed targets:\n- ' + misses.join('\n- '));
else console.log('\nevery target met');
process.exit(gate && misses.length ? 1 : 0);
