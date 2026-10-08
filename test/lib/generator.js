'use strict';
// The page's person generator (genPerson and the helpers around it) and the look migration (recomposeLooks), loaded against the
// world file outside the page, for the suites that read many draws without booting a game.
// loadGenerator(html, worldsDir, { random }) returns the functions by name, and W, the world they read; random, when given, is the
// source of their draws in place of Math.random, so a suite that seeds its scenarios can replay a failing draw.
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');

const NAMES = ['genPerson', 'absentText', 'recomposeLooks', 'looksBrief', 'looksShort', 'looksPhrase', 'looksProse', 'looksLabelled', 'looksProseParts'];

function loadGenerator(HTML, WORLDS, o) {
  const html = fs.readFileSync(HTML, 'utf8');
  const a = html.indexOf('  // ---------- generated people (worlds with genPools) ----------'), b = html.indexOf('  // A roommate drawn from the pools');
  assert(a > 0 && b > a, 'the person generator was not found in the page');
  const r0 = html.indexOf('  // A look written'), r1 = html.indexOf('  // Saves from before v9 kept');
  assert(r0 > 0 && r1 > r0, 'the look migration was not found in the page');
  const win = {}; new Function('window', fs.readFileSync(path.join(WORLDS, 'sundered.js'), 'utf8'))(win);
  const W = Object.values(win.WINDLASS_WORLDS)[0];
  const pre = "const Math = random ? Object.assign(Object.create(globalThis.Math), { random }) : globalThis.Math;"
    + " const escRe = (s) => s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'); const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;"
    + " const NB = { they: 'they', them: 'them', their: 'their', theirs: 'theirs' };"
    + " function speciesRace(Wc, k) { const sp = Wc.transformation && Wc.transformation.species[k]; return sp ? (sp.race || sp.short) : cap(String(k || '')); }";
  const api = new Function('W', 'random', pre + html.slice(a, b) + html.slice(r0, r1) + '\nreturn {' + NAMES.map((n) => n + ': typeof ' + n + " !== 'undefined' ? " + n + ' : null').join(', ') + '};')(W, (o && o.random) || null);
  return Object.assign(api, { W });
}

module.exports = { loadGenerator };
