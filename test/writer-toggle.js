'use strict';
// The story writer is a toggle. "Most capable" asks for the complex tier on every turn. "Auto" asks for it only where the
// writing matters most (romance, a first meeting, a change under way) and takes the default tier for an ordinary turn.
// A save from the old three-tier menu that asked for a lesser tier opens as auto.
const assert = require('node:assert/strict');
const { boot } = require('./boot');

const turnReply = () => JSON.stringify({
  evaluation: { stat: 'none', outcome: 'none' },
  narrative: Array(300).fill('moment').join(' '),
  suggested_actions: ['Stay close', 'Speak', 'Step away'],
  secret_info: '', state_updates: [], time_advance_minutes: 15,
  events: [], beats: [], facts: [], exposures: []
});
const tierOf = (h, label) => h.mock.sampleCalls.filter((c) => c.label === label).map((c) => c.opts && c.opts.modelTier);
const setWriter = async (h, value) => {
  h.click('#btnSettings'); h.$('#setNarrTier').value = value; h.$('#setNarrTier').dispatchEvent(new h.window.Event('change'));
  assert(await h.idle(8000), 'saving the writer setting did not finish');
  h.click('[data-close="dlgSettings"]');
};

async function main() {
  const h = await boot({});
  assert(await h.settle(150, 6000), 'the page did not settle after boot');
  h.click('#cBegin');
  assert(await h.idle(15000), 'creating the adventure did not finish');
  try {
    let applied = null;   // when set, the mock answers on this tier instead of the one asked for
    h.mock.sampleHandler = (input) => (/<output_format>/.test(String(input)) ? { text: turnReply(), modelTierApplied: applied } : 'A short answer.');
    const options = [...h.$('#setNarrTier').options].map((o) => o.value);
    assert.deepEqual(options, ['complex', 'auto'], 'the writer menu must offer exactly the two toggle positions');
    assert.deepEqual(tierOf(h, 'roommate introduction'), ['complex'], 'the roommate introduction must be written on the most capable tier');

    assert(await h.turn('Walk to the quad'), 'first turn did not finish');
    assert(await h.turn('Kiss Luna slowly and hold her close'), 'romance turn did not finish');
    assert.deepEqual(tierOf(h, 'turn'), ['complex', 'complex'], 'most capable must ask for the complex tier on every turn');

    await setWriter(h, 'auto');
    assert(await h.turn('Walk back to the dorm'), 'auto ordinary turn did not finish');
    assert(await h.turn('Kiss Luna slowly and hold her close'), 'auto romance turn did not finish');
    assert.deepEqual(tierOf(h, 'turn').slice(2), ['default', 'complex'],
      'auto must take the default tier for an ordinary turn and the complex tier for romance');
    const feed = h.document.querySelectorAll('#feed .turn .pill');
    assert([...feed].some((p) => p.textContent === 'default'), 'the turn card must show the tier that was asked for');
    applied = 'default';
    assert(await h.turn('Kiss Luna again and hold her'), 'fallback-tier turn did not finish');
    const pills = [...h.document.querySelectorAll('#feed .turn .pill')].map((p) => p.textContent);
    assert(pills.includes('complex → default'), 'a turn answered on another tier must show both the tier asked for and the one applied, got ' + JSON.stringify(pills));
    applied = null;

    const [adventurePath, adventure] = [...h.mock.store.entries()].find(([path]) => /^adventures\/[^/]+$/.test(path));
    assert.equal(adventure.data.settings.narrTier, 'auto', 'the toggle must be saved with the adventure');
    const store = new Map([...h.mock.store].map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    store.get(adventurePath).data.settings.narrTier = 'quick';
    h.close();

    const h2 = await boot({ setup(w, m) { m.store = store; } });
    assert(await h2.settle(150, 8000), 'the page did not settle after reopening');
    assert(await h2.idle(10000), 'reopening the save did not finish');
    h2.click('#btnSettings');
    assert.equal(h2.$('#setNarrTier').value, 'auto', 'an old save that asked for a lesser tier must open as auto');
    assert(!h2.errors.length && !h2.mock.violations.length, 'page errors or contract violations: ' + JSON.stringify(h2.errors.concat(h2.mock.violations)));
    h2.close();
    console.log('writer toggle passed: most capable every turn; auto by scene; the intro on the most capable tier; an old lesser tier opens as auto');
  } catch (e) {
    console.error('WRITER TOGGLE FAILED\n' + ((e && e.stack) || e));
    process.exit(1);
  }
}
main();
