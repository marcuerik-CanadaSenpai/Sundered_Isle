'use strict';
// Saves from real older builds open and play on. For each pinned build: take it out of git, create a game on it (a man with a
// bovine roommate, contact every turn) and play ten turns, then open that save on the current page and play three more. The
// save must open with its ten turns and no error status, play on with no page error or contract violation, and come out on the
// track model (no ladder tracks left). The other migration checks build the old shape by hand; this uses what the builds wrote.
// When the save format is about to change, add the last build before the change to BUILDS.
// Run: node migrate-history.js [sha ...]       (a clone without these commits skips them with a note; with none of them it ran
// nothing and exits 3, which run.js shows as SKIP, not PASS)
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const { boot } = require('./boot');

const BUILDS = ['501a5c7', 'b0c6a7f', '3ab47bb', '00a6f76', '9c35fd8', 'f73fe18', '133d19a', '10ae2ee', 'b6a6209'];
const ROOT = path.join(__dirname, '..');
const git = (...a) => spawnSync('git', ['-C', ROOT].concat(a), { encoding: 'buffer', maxBuffer: 64 << 20 });
const J = (x) => JSON.parse(JSON.stringify(x));
const contact = (h) => { h.mock.sampleHandler = (input, o, call) => { const out = h.mock.defaultHandler(input, o, call); if (!/^turn/.test(call.label)) return out; const r = JSON.parse(out); r.time_advance_minutes = 240; r.exposures = [{ species: 'cow', method: 'the evening with Daisy', intensity: 3 }]; return JSON.stringify(r); }; };

// The build's page and world files, written to a temporary directory; null when this clone does not have the commit.
function checkout(sha, dir) {
  if (git('cat-file', '-e', sha + '^{commit}').status !== 0) return null;
  const out = path.join(dir, sha), worlds = path.join(out, 'worlds'); fs.mkdirSync(worlds, { recursive: true });
  const page = git('show', sha + ':windlass/index.html'); assert.equal(page.status, 0, sha + ': no windlass/index.html'); fs.writeFileSync(path.join(out, 'index.html'), page.stdout);
  for (const f of git('ls-tree', '--name-only', sha, 'windlass/worlds/').stdout.toString().split('\n').filter((x) => /\.js$/.test(x))) fs.writeFileSync(path.join(worlds, path.basename(f)), git('show', sha + ':' + f).stdout);
  return { html: path.join(out, 'index.html'), worlds };
}

async function one(sha, b) {
  const a = await boot({ htmlPath: b.html, worldsDir: b.worlds, seed: 3 }); let store;
  try {
    assert(await a.settle(150, 8000), sha + ': the old page did not settle');
    a.type('#cName', 'Tom Ashby'); a.$('#cGender').value = 'male'; a.$('#cGender').dispatchEvent(new a.window.Event('change')); a.type('#cRmSpecies', 'cow'); a.type('#cRmName', 'Daisy Holm');
    a.click('#cBegin'); assert(await a.idle(30000), sha + ': creating the game on the old page did not finish'); await a.settle(150, 6000); contact(a);
    for (let i = 0; i < 10; i++) assert(await a.turn('I spend the evening with Daisy, step ' + i + '.', { max: 30000 }), sha + ': old turn ' + (i + 1));
    assert.deepEqual([a.errors.length, a.mock.violations.length], [0, 0], sha + ': the old page itself erred: ' + JSON.stringify(a.errors.concat(a.mock.violations)).slice(0, 300));
    store = new Map([...a.mock.store].map(([k, v]) => [k, J(v)]));
  } finally { a.close(); }
  const key = [...store.keys()].find((k) => /^adventures\/[^/]+$/.test(k));
  const h = await boot({ seed: 4, setup(w, m) { m.store = store; } });
  try {
    assert(await h.settle(150, 8000)); assert(await h.idle(15000), sha + ': the save did not load'); await h.settle(100, 4000);
    assert.equal(h.document.querySelectorAll('#feed article.turn[data-id]').length, 10, sha + ': the save opens with its ten turns');
    assert(!h.$('#status').classList.contains('bad'), sha + ': the save opens without an error: ' + h.$('#status').textContent.slice(0, 200));
    contact(h);
    for (let i = 0; i < 3; i++) assert(await h.turn('I spend another evening with Daisy, ' + i + '.', { max: 30000 }), sha + ': turn ' + (11 + i) + ' on the current page');
    const doc = store.get(key).data, tf = doc.state.tf || {};
    assert.equal(doc.turnCount, 13, sha + ': thirteen turns counted');
    assert(tf.prog && tf.prog.cow, sha + ': the body is on the track model');
    assert.equal((tf.tracks || []).length, 0, sha + ': no ladder tracks are left');
    assert.deepEqual([h.errors.length, h.mock.violations.length], [0, 0], sha + ': page errors or contract violations: ' + JSON.stringify(h.errors.concat(h.mock.violations)).slice(0, 300));
    console.log(sha + ': opened with 10 turns, played 3 more; ' + Object.values(tf.prog.cow.tracks).filter((r) => r.told > 0).length + ' bovine parts told');
  } finally { h.close(); }
}

(async () => {
  const shas = process.argv.slice(2).length ? process.argv.slice(2) : BUILDS;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'windlass-history-'));
  let ran = 0;
  try {
    for (const sha of shas) { const b = checkout(sha, dir); if (!b) { console.log(sha + ': not in this clone, skipped'); continue; } await one(sha, b); ran++; }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  if (!ran) { console.log('migrate-history skipped: none of the ' + shas.length + ' builds is in this clone, so no old save was opened'); process.exit(3); }
  console.log('migrate-history passed: ' + ran + ' of ' + shas.length + ' builds' + (ran < shas.length ? ' (the rest are not in this clone)' : ''));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
