'use strict';
// The boot load. This device's pointer can name an adventure that was never saved (a game opened and left before its
// first save). That pointer is forgotten quietly, not reported as a failed save. And once the player starts a new
// adventure while the boot load is still running, the boot load stands aside: no red error, no reopened creation, and
// no older save loaded over the new adventure.
const assert = require('node:assert/strict');
const { boot } = require('./boot');

const ghost = (w) => { w.localStorage.setItem('windlass.last', 'advghost00000'); };
const advDocs = (m) => [...m.store.entries()].filter(([p]) => /^adventures\/[^/]+$/.test(p));

async function main() {
  try {
    // A pointer to a save that does not exist, and no saves at all: the creation screen, with no error.
    const a = await boot({ setup(w) { ghost(w); } });
    assert(await a.settle(150, 6000), 'the page did not settle after boot');
    assert(!a.$('#status').classList.contains('bad'), 'a pointer to an unsaved adventure must not show an error: ' + a.$('#status').textContent);
    assert.equal(a.$('#summaryNote').textContent, 'no saves yet');
    assert(a.$('#dlgCreate').open, 'the creation screen must open');
    assert.notEqual(a.window.localStorage.getItem('windlass.last'), 'advghost00000', 'the stale pointer must be forgotten');
    a.close();

    // The player's case: the boot load is slow, and Begin is pressed before it finishes. The boot load ends while the
    // cast is still being invented, and must leave the creation alone (its world, its progress note, its status).
    const b = await boot({ setup(w, m) { ghost(w); m.dbLatency = 1500; m.sampleLatency = 700; } });
    await b.sleep(200);
    b.$('#newWorld').value = 'mythaven'; b.click('#newAdv');
    b.click('#cBegin');
    b.mock.dbLatency = 2;
    await b.sleep(1900);
    assert.match(b.$('#cNote').textContent, /Inventing/, 'the boot load must not reset the creation screen while the cast is invented');
    assert.doesNotMatch(b.$('#status').textContent, /saved adventures|could not be opened|could not read/, 'the boot load must not put an error over a new adventure');
    b.mock.sampleLatency = 3;
    assert(await b.idle(30000), 'creating the adventure did not finish');
    assert(await b.settle(150, 6000), 'the page did not settle');
    assert(!b.$('#dlgCreate').open, 'the boot load must not reopen the creation screen over a new adventure');
    assert.equal(advDocs(b.mock).length, 1, 'the new adventure must be saved');
    assert.equal(advDocs(b.mock)[0][1].data.worldId, 'mythaven', 'the new adventure must keep the world the player chose');
    const store = new Map([...b.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    const savedId = advDocs(b.mock)[0][0].split('/')[1];
    assert(!b.errors.length && !b.mock.violations.length, 'page errors or contract violations: ' + JSON.stringify(b.errors.concat(b.mock.violations)));
    b.close();

    // With a real save, a new adventure begun during a slow boot load is not replaced by the older save.
    const c = await boot({ setup(w, m) { m.store = store; m.dbLatency = 1500; } });
    await c.sleep(200);
    c.click('#newAdv');
    c.click('#cBegin');
    c.mock.dbLatency = 2;
    assert(await c.idle(20000), 'creating the second adventure did not finish');
    await c.sleep(3200);
    assert(await c.settle(150, 6000), 'the page did not settle');
    const docs = advDocs(c.mock);
    assert.equal(docs.length, 2, 'the second adventure must be saved beside the first');
    assert.notEqual(c.window.localStorage.getItem('windlass.last'), savedId, 'the older save must not be loaded over the new adventure');
    assert(!c.$('#dlgCreate').open, 'the boot load must not reopen the creation screen');
    assert.doesNotMatch(c.$('#status').textContent, /Welcome back|saved adventures|could not be opened/, 'the boot load must not report over a new adventure');
    assert(!c.errors.length && !c.mock.violations.length, 'page errors or contract violations: ' + JSON.stringify(c.errors.concat(c.mock.violations)));
    c.close();
    console.log('boot pointer passed: an unsaved pointer is forgotten quietly; a slow boot load never overrides a new adventure');
  } catch (e) {
    console.error('BOOT POINTER FAILED\n' + ((e && e.stack) || e));
    process.exit(1);
  }
}
main();
