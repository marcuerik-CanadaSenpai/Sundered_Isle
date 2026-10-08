#!/usr/bin/env node
'use strict';
// The whole suite, sharded: every check runs in its own node process, several at a time, longest first.
//   node run.js                  everything (default jobs: the CPU count, or WL_JOBS)
//   node run.js --quick          the pre-push set (units marked quick below): no page, or one short game each
//   node run.js -j 2             two at a time        node run.js --only harpyWingArms,smoke   named units
//   node run.js --shard 1/3      the first third of the work by recorded cost (for three machines or three terminals)
//   node run.js --seed random    a fresh seed per unit, printed with a failure so it can be replayed       node run.js --list
// A unit is one audit-fixes scenario or one standalone script. Nothing is dropped: `node run.js` runs what `npm run audit-fixes`
// and the other scripts run, only not one after another. Recorded costs are kept in .timings.json (git-ignored).
// A unit listed in lib/known-red.js that fails with the message expected of it prints KNOWN RED with its label and does not fail the
// run; one that fails any other way (a setup check, a crash, a timeout) is a FAIL. A unit that exits 3 ran
// nothing it could check (migrate-history in a clone without the pinned builds) and prints SKIP.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const KNOWN_RED = require('./lib/known-red');   // { LIST, expected, failureIn }
const SKIPPED = 3;   // the exit code of a unit that had nothing to run
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i < 0 ? dflt : (args[i + 1] != null && !String(args[i + 1]).startsWith('--') ? args[i + 1] : true); };
const has = (name) => args.includes(name);

// Standalone scripts. quick: run before every push. Each exits 0 when it passes.
const SCRIPTS = [
  { file: 'name-matcher.js', quick: true },
  { file: 'schedule-precedence.js', quick: true },
  { file: 'smoke.js', quick: true },
  { file: 'romance-anatomy.js', quick: true },   // CLAUDE.md: after any change to the scene prompt or the romance and anatomy rules
  { file: 'boot-pointer.js' },
  { file: 'exposure-fallback.js' },
  { file: 'review-regressions.js' },
  { file: 'undo-recovery.js' },
  { file: 'writer-toggle.js' },
  { file: 'looks-drift.js' },
  { file: 'turnsmoke.js' },
  { file: 'create-interrupt.js' },
  { file: 'prompt-budget.js' },
  { file: 'ui-panels.js' },
  { file: 'pacing-scenes.js' },
  { file: 'voice-tics.js' },
  { file: 'save-sync.js' },
  { file: 'gm-prompt.js' },
  { file: 'migrate-history.js' },
];
// Files in test/ that are not checks: the harness itself, the dev server, this runner, the two report-only probes and the
// narration report (it reads a game played on the real model).
const NOT_CHECKS = /^(boot|mock-claude|server|run|audit-fixes|probe\d|narration-lint)\.js$/;
// audit-fixes scenarios that read the world file or one slice of the page's code and boot no page: a second or two each.
const QUICK_SCENARIOS = new Set(['hallowayAttunement', 'anatomyCounts', 'chestToldOnce', 'docTracksFold', 'coatsAreFelt', 'influenceNotesTrue']);

const here = __dirname, timingsFile = path.join(here, '.timings.json');
let timings = {}; try { timings = JSON.parse(fs.readFileSync(timingsFile, 'utf8')); } catch (e) {}

function listUnits() {
  const r = spawnSync(process.execPath, ['audit-fixes.js', '--list'], { cwd: here, encoding: 'utf8' });
  if (r.status !== 0) { console.error('could not list the audit-fixes scenarios:\n' + r.stderr); process.exit(2); }
  const scen = r.stdout.split('\n').filter(Boolean).map((n) => ({ id: n, argv: ['audit-fixes.js', n], quick: QUICK_SCENARIOS.has(n) }));
  const scr = SCRIPTS.map((s) => ({ id: s.file.replace(/\.js$/, ''), argv: [s.file], quick: !!s.quick }));
  const known = new Set(SCRIPTS.map((s) => s.file));
  const stray = fs.readdirSync(here).filter((f) => /\.js$/.test(f) && !known.has(f) && !NOT_CHECKS.test(f));
  if (stray.length) console.error('note: not in run.js (add to SCRIPTS or NOT_CHECKS): ' + stray.join(', '));
  return scen.concat(scr);
}

let units = listUnits();
if (has('--list')) { for (const u of units) console.log((u.quick ? '* ' : '  ') + u.id + (timings[u.id] ? '  ' + timings[u.id].toFixed(1) + 's' : '')); process.exit(0); }
if (has('--quick')) units = units.filter((u) => u.quick);
const only = opt('--only', null);
if (only) { const want = new Set(String(only).split(',')); units = units.filter((u) => want.has(u.id)); const missing = [...want].filter((w) => !units.some((u) => u.id === w)); if (missing.length) { console.error('no such unit: ' + missing.join(', ')); process.exit(2); } }
// Longest first, so the slowest unit never starts last; a unit with no recorded cost counts as 20 s.
const cost = (u) => (timings[u.id] != null ? timings[u.id] : 20);
units.sort((a, b) => cost(b) - cost(a));
const shard = String(opt('--shard', '')).match(/^(\d+)\/(\d+)$/);
if (shard) { const k = +shard[1], n = +shard[2]; const bins = Array.from({ length: n }, () => ({ load: 0, us: [] })); for (const u of units) { const b = bins.reduce((m, x) => (x.load < m.load ? x : m)); b.load += cost(u); b.us.push(u); } units = bins[k - 1].us; }

const jobs = Math.max(1, Number(opt('-j', process.env.WL_JOBS || os.cpus().length)) || 1);
const seedArg = opt('--seed', null);
const timeout = Number(opt('--timeout', 900)) * 1000;
const results = []; let next = 0, running = 0; const t0 = Date.now();
console.log(units.length + ' units, ' + jobs + ' at a time' + (shard ? ' (shard ' + shard[1] + '/' + shard[2] + ')' : '') + (has('--quick') ? ' (quick set)' : ''));

function startOne(u) {
  running++; const s = Date.now(); let out = '';
  const env = Object.assign({}, process.env);
  // A random seed is drawn here for every unit, so a standalone script (which reads WL_SEED but draws none itself) can be replayed too.
  if (seedArg === 'random') env.WL_SEED = String(Math.floor(Math.random() * 2 ** 31)); else if (seedArg) env.WL_SEED = String(seedArg);
  const c = spawn(process.execPath, u.argv, { cwd: here, env });
  const killer = setTimeout(() => { out += '\nTIMED OUT after ' + timeout / 1000 + 's\n'; c.kill('SIGKILL'); }, timeout);
  c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
  c.on('close', (code) => {
    clearTimeout(killer); running--; const sec = (Date.now() - s) / 1000;
    const ok = code === 0, skip = code === SKIPPED, listed = KNOWN_RED.LIST[u.id], red = !ok && !skip && !!KNOWN_RED.expected(u.id, KNOWN_RED.failureIn(u.id, out));
    results.push({ u, ok, skip, red, sec, out, seed: env.WL_SEED });
    if (ok) timings[u.id] = Math.round(sec * 10) / 10;
    const why = ok ? (listed ? '  (green now: take it off lib/known-red.js)' : '') : skip ? '  ' + (out.trim().split('\n').at(-1) || '').slice(0, 200) : red ? '  ' + listed.label : (listed ? '  (on lib/known-red.js, but not red the expected way)' : '') + '  ' + (out.split('\n').find((l) => /^FAIL|FAILED|Error|assert|TIMED OUT/i.test(l)) || '').slice(0, 200);
    console.log((ok ? 'PASS' : skip ? 'SKIP' : red ? 'KNOWN RED' : 'FAIL').padEnd(10) + u.id.padEnd(30) + sec.toFixed(1).padStart(6) + 's' + why);
    pump();
  });
}
function pump() {
  while (running < jobs && next < units.length) startOne(units[next++]);
  if (running === 0 && next >= units.length) finish();
}
function finish() {
  const wall = (Date.now() - t0) / 1000, sum = results.reduce((a, r) => a + r.sec, 0), bad = results.filter((r) => !r.ok && !r.skip && !r.red);
  const count = (f, word) => { const n = results.filter(f).length; return n ? ', ' + n + ' ' + word : ''; };
  try { let old = {}; try { old = JSON.parse(fs.readFileSync(timingsFile, 'utf8')); } catch (e) {} fs.writeFileSync(timingsFile, JSON.stringify(Object.assign(old, timings), null, 1)); } catch (e) {}
  console.log('\n' + results.filter((r) => r.ok).length + ' passed, ' + bad.length + ' failed' + count((r) => r.red, 'known red') + count((r) => r.skip, 'skipped') + ' in ' + wall.toFixed(0) + 's wall (' + sum.toFixed(0) + 's of work)');
  for (const r of bad) console.log('\n--- ' + r.u.id + (r.seed ? ' (WL_SEED=' + r.seed + ')' : '') + ' ---\n' + r.out.trim().split('\n').slice(-14).join('\n') + '\nreplay: ' + (r.seed ? 'WL_SEED=' + r.seed + ' ' : '') + 'node ' + r.u.argv.join(' '));
  process.exit(bad.length ? 1 : 0);
}
pump();
