'use strict';
// A new adventure begun with Begin is never dropped without a word. While the cast is invented, a close request (the Android
// back gesture, Esc) is refused, and if the browser closes the creation screen anyway it comes straight back; only Cancel
// throws the creation away, and it says so. A reload partway through brings the creation screen back with the same choices.
// Run one scenario by name: node create-interrupt.js backGesture
const assert = require('node:assert/strict');
const { boot } = require('./boot');

const advDocs = (m) => [...m.store.entries()].filter(([p]) => /^adventures\/[^/]+$/.test(p));
const lsDump = (w) => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
let unhandled = 0; process.on('unhandledRejection', () => { unhandled += 1; });

// Cast invention held until release() (or `ms`), everything else answered by the default mock model.
function slowInvention(w, m, ms) {
  let release = null; const gate = new Promise((r) => { release = r; });
  m.sampleHandler = (input, o, call) => {
    if (call.label === 'cast invention') return Promise.race([gate, new Promise((r) => w.setTimeout(r, ms || 600000))]).then(() => m.defaultHandler(input, o, call));
    return m.defaultHandler(input, o, call);
  };
  return () => release();
}
async function startCow(h, opts) {
  opts = opts || {};
  assert(await h.settle(150, 6000), 'boot did not settle');
  if (opts.world) { h.click('#btnAdventures'); h.$('#newWorld').value = opts.world; h.click('#newAdv'); await h.sleep(50); }
  assert(h.$('#dlgCreate').open, 'creation must be open');
  h.type('#cRmSpecies', 'cow'); h.type('#cRmName', 'Daisy Clover'); h.type('#cName', 'Erik Marcu');
  h.click('#cBegin');
  await h.sleep(opts.at || 1500);
  assert.match(h.$('#cNote').textContent, /Inventing/, 'the cast must be being invented');
}
// What a user agent does on Android back / Esc: a 'cancel' event, then the close unless the page refused it.
function closeRequest(h, cancelable) {
  const d = h.$('#dlgCreate'); const ev = new h.window.Event('cancel', { cancelable });
  d.dispatchEvent(ev); if (!ev.defaultPrevented) d.close();
  return ev.defaultPrevented;
}
const debugCreate = (h) => { h.click('#btnDebug'); const el = h.$('#dbgCreate'); const t = el ? el.textContent : '(no #dbgCreate)'; h.click('[data-close="dlgDebug"]'); return t; };
const clean = (h) => assert(!h.errors.length && !h.mock.violations.length, 'page errors or contract violations: ' + JSON.stringify(h.errors.concat(h.mock.violations)));

async function reloadRestoresIn(world) {
  const h1 = await boot({ setup(w, m) { slowInvention(w, m); } });
  await startCow(h1, { at: 2500, world: world === 'sundered' ? null : world });
  const title = h1.$('#createTitle').textContent; const ls = lsDump(h1.window); const store = h1.mock.store; h1.close();
  const h = await boot({ setup(w, m) { for (const [k, v] of Object.entries(ls)) w.localStorage.setItem(k, v); m.store = store; } });
  try {
    assert(h.$('#dlgCreate').open, 'the creation screen must be back at once, not the placeholder');
    assert(await h.settle(150, 6000), 'boot did not settle');
    assert(h.$('#dlgCreate').open, 'the boot load must not close or reset the restored creation');
    assert.equal(h.$('#createTitle').textContent, title, 'same world');
    assert.equal(h.$('#cName').value, 'Erik Marcu'); assert.equal(h.$('#cRmSpecies').value, 'cow'); assert.equal(h.$('#cRmName').value, 'Daisy Clover');
    assert(!h.$('#cRestoreNote').hidden && /reloaded/.test(h.$('#cRestoreNote').textContent), 'a plain explanation must be shown');
    assert(!h.$('#status').classList.contains('bad'), 'no error: ' + h.$('#status').textContent);
    assert.equal(h.$('#summaryNote').textContent, 'no saves yet');
    h.click('#cBegin'); assert(await h.idle(30000), 'creation did not finish'); await h.settle(150, 6000);
    assert.equal(advDocs(h.mock).length, 1, 'the restored creation is saved');
    assert.equal(advDocs(h.mock)[0][1].data.worldId, world);
    assert.equal(h.window.localStorage.getItem('windlass.createDraft'), null);
    assert.match(debugCreate(h), /page loaded with a creation left unfinished/, 'Debug must record the reload');
    clean(h);
  } finally { h.close(); }
}

const S = {
  // The user's report: a back gesture 20 s into the invention must not drop the creation.
  async backGesture() {
    let release; const h = await boot({ setup(w, m) { release = slowInvention(w, m); } });
    try {
      await startCow(h, { at: 1500 });
      closeRequest(h, true);
      assert(h.$('#dlgCreate').open, 'a close request during the invention must leave the creation screen open');
      assert.match(h.$('#cNote').textContent, /Inventing/, 'the invention must go on');
      release(); assert(await h.idle(30000), 'creation did not finish'); await h.settle(150, 6000);
      assert.equal(advDocs(h.mock).length, 1, 'the new adventure must be saved');
      assert.equal(advDocs(h.mock)[0][1].data.player.name || advDocs(h.mock)[0][1].data.player.first + ' ' + advDocs(h.mock)[0][1].data.player.last, 'Erik Marcu');
      assert.doesNotMatch(h.$('#feed').textContent, /Alex Rowan/, 'the placeholder must not be what is left on screen');
      assert.equal(h.window.localStorage.getItem('windlass.createDraft'), null, 'a saved adventure leaves no draft');
      assert.match(debugCreate(h), /Begin pressed[\s\S]*close request|close request[\s\S]*Begin pressed/, 'Debug must record Begin and the close request');
      clean(h);
    } finally { h.close(); }
  },
  // A second back press without a new tap: the cancel event is not cancelable and the browser closes the screen anyway.
  async backGestureForced() {
    let release; const h = await boot({ setup(w, m) { release = slowInvention(w, m); } });
    try {
      await startCow(h, { at: 1500 });
      closeRequest(h, false);
      assert(h.$('#dlgCreate').open, 'the creation screen must come straight back');
      assert.match(h.$('#cNote').textContent, /Inventing/, 'the invention must go on');
      await h.sleep(1100); assert.match(h.$('#cNote').textContent, /Cancel at the top does/, 'the note must say how to stop it');
      release(); assert(await h.idle(30000), 'creation did not finish'); await h.settle(150, 6000);
      assert.equal(advDocs(h.mock).length, 1, 'the new adventure must be saved');
      assert.match(debugCreate(h), /closed by the browser .* reopened/, 'Debug must record the forced close');
      clean(h);
    } finally { h.close(); }
  },
  // Cancel still cancels, and says so.
  async cancelButton() {
    const h = await boot({ setup(w, m) { slowInvention(w, m); } });
    try {
      await startCow(h, { at: 1500 });
      h.mock.dbLatency = 700;   // the batches not yet sent still read the recent names before they stop, so the stop takes a while
      h.click('#dlgCreate [data-close]');
      await h.sleep(300);
      assert(!h.$('#dlgCreate').open, 'Cancel closes the creation screen');
      await h.sleep(2500);
      assert.equal(h.window.localStorage.getItem('windlass.createDraft'), null, 'the progress ticker must not write the draft back after Cancel');
      h.mock.dbLatency = 0;
      assert(!h.$('#status').hidden && /cancelled/i.test(h.$('#status').textContent), 'Cancel must say the new adventure was cancelled: ' + h.$('#status').textContent);
      assert.equal(advDocs(h.mock).length, 0, 'nothing is saved');
      assert.equal(h.window.localStorage.getItem('windlass.createDraft'), null, 'Cancel drops the draft');
      assert.match(debugCreate(h), /Cancel pressed/, 'Debug must record Cancel');
      clean(h);
    } finally { h.close(); }
  },
  // A new creation begun straight after Cancel, before the stopped invention has let go, runs as its own and is saved.
  async cancelThenRestart() {
    let release; const h = await boot({ setup(w, m) { release = slowInvention(w, m); } });
    try {
      await startCow(h, { at: 1500 });
      h.mock.dbLatency = 700;
      h.click('#dlgCreate [data-close]'); await h.sleep(50);
      const again = [...h.document.querySelectorAll('#status button')].find((b) => /New adventure/.test(b.textContent));
      assert(again, 'the cancelled note must offer New adventure'); h.click(again); await h.sleep(50);
      assert(h.$('#dlgCreate').open, 'New adventure reopens the creation screen');
      h.type('#cName', 'Second Try'); h.click('#cBegin'); await h.sleep(50);
      assert.equal(h.$('#cBegin').textContent, 'Begin now', 'the second Begin must start its own invention, not stop the cancelled one');
      await h.sleep(3000);
      assert(h.$('#dlgCreate').open && h.$('#cBegin').textContent === 'Begin now' && /Inventing/.test(h.$('#cNote').textContent), 'the cancelled invention must not take over the new one when its stop lands');
      h.mock.dbLatency = 0; release();
      assert(await h.idle(30000), 'creation did not finish'); await h.settle(150, 6000);
      assert.equal(advDocs(h.mock).length, 1, 'only the second creation is saved');
      assert.equal(advDocs(h.mock)[0][1].data.creation.name, 'Second Try');
      clean(h);
    } finally { h.close(); }
  },
  // Begin now still begins with whoever has arrived.
  async beginNow() {
    const h = await boot({ setup(w, m) { slowInvention(w, m); } });
    try {
      await startCow(h, { at: 1500 });
      h.click('#cBegin');
      assert(await h.idle(30000), 'creation did not finish'); await h.settle(150, 6000);
      assert(!h.$('#dlgCreate').open, 'Begin now closes the creation screen');
      assert.equal(advDocs(h.mock).length, 1, 'Begin now saves the adventure');
      assert.equal(h.window.localStorage.getItem('windlass.createDraft'), null, 'a saved adventure leaves no draft');
      clean(h);
    } finally { h.close(); }
  },
  // A reload mid-invention (the earlier attempt): the next boot restores the creation screen, same world and choices.
  async reloadRestores() { await reloadRestoresIn('sundered'); await reloadRestoresIn('mythaven'); },
  // Closing the creation screen with nothing begun leaves the boot preview behind it, and the page says it is only a preview.
  async previewNote() {
    const h = await boot({});
    try {
      assert(await h.settle(150, 6000), 'boot did not settle');
      assert(h.$('#dlgCreate').open, 'creation must be open on an empty store');
      h.click('#dlgCreate [data-close]'); await h.sleep(100);
      assert(!h.$('#dlgCreate').open, 'Cancel closes the creation screen');
      assert(!h.$('#status').hidden && /preview/.test(h.$('#status').textContent), 'the placeholder must be called a preview: ' + h.$('#status').textContent);
      const action = [...h.document.querySelectorAll('#status button')].find((b) => /New adventure/.test(b.textContent));
      assert(action, 'the preview note must offer New adventure'); h.click(action); await h.sleep(50);
      assert(h.$('#dlgCreate').open, 'New adventure reopens the creation screen');
      clean(h);
    } finally { h.close(); }
  },
  // With a save in the store, the save loads behind the restored creation, so Cancel lands on it.
  async reloadWithSave() {
    const h0 = await boot({}); await h0.settle(150, 6000); h0.click('#cBegin'); assert(await h0.idle(20000)); await h0.settle(150, 6000);
    const savedId = advDocs(h0.mock)[0][0].split('/')[1]; const store0 = h0.mock.store; h0.close();
    const h1 = await boot({ setup(w, m) { m.store = store0; slowInvention(w, m); } });
    await h1.settle(150, 6000); h1.click('#btnAdventures'); h1.click('#newAdv'); await h1.sleep(50);
    h1.type('#cRmSpecies', 'cow'); h1.click('#cBegin'); await h1.sleep(1500);
    const ls = lsDump(h1.window); const store = h1.mock.store; h1.close();
    const h = await boot({ setup(w, m) { for (const [k, v] of Object.entries(ls)) w.localStorage.setItem(k, v); m.store = store; } });
    try {
      assert(await h.settle(150, 6000), 'boot did not settle');
      assert(h.$('#dlgCreate').open && h.$('#cRmSpecies').value === 'cow', 'the creation is restored');
      assert.equal(h.window.localStorage.getItem('windlass.last'), savedId, 'the newest save loads behind the restored creation');
      h.click('#dlgCreate [data-close]'); await h.sleep(100);
      assert(!h.$('#dlgCreate').open); assert.equal(h.window.localStorage.getItem('windlass.createDraft'), null);
      assert.doesNotMatch(h.$('#status').textContent, /preview/, 'the save, not the placeholder, is behind');
      clean(h);
    } finally { h.close(); }
  },
  // Old or foreign drafts are dropped quietly (and logged); the normal randomised creation opens.
  async staleDraft() {
    for (const d of [{ v: 1, worldId: 'sundered', choices: { name: 'Old Name' }, at: Date.now() - 7 * 3600e3 }, { v: 1, worldId: 'atlantis', choices: { name: 'Old Name' }, at: Date.now() }, '{not json']) {
      const h = await boot({ setup(w) { w.localStorage.setItem('windlass.createDraft', typeof d === 'string' ? d : JSON.stringify(d)); } });
      try {
        assert(await h.settle(150, 6000)); assert(h.$('#dlgCreate').open);
        assert.notEqual(h.$('#cName').value, 'Old Name'); assert(h.$('#cRestoreNote').hidden);
        assert.equal(h.window.localStorage.getItem('windlass.createDraft'), null);
        assert.match(debugCreate(h), /dropped/);
        clean(h);
      } finally { h.close(); }
    }
  },
  async noUnhandled() {
    const h = await boot({ setup(w, m) { slowInvention(w, m); } });
    try { const before = unhandled; await startCow(h, { at: 1500 }); h.click('#dlgCreate [data-close]'); await h.sleep(1500); assert.equal(unhandled - before, 0, 'stopping the invention must not leave unhandled rejections'); }
    finally { h.close(); }
  },
};

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(S);
  let failed = 0;
  for (const n of names) {
    try { await S[n](); console.log('PASS', n); }
    catch (e) { failed += 1; console.log('FAIL', n, '-', String((e && e.message) || e).split('\n')[0].slice(0, 220)); }
  }
  if (failed) { console.error('CREATE INTERRUPT FAILED: ' + failed + ' of ' + names.length + ' scenarios'); process.exit(1); }
  console.log('create interrupt passed: back during the invention is refused or reopens; Cancel says so and lets a new creation begin at once; Begin now begins; a reload restores the creation in its own world; a save loads behind it; stale drafts are dropped; a closed creation screen calls the placeholder a preview; no unhandled rejections');
})();
