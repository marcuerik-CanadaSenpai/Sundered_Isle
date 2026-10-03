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

    // A director note that brings in someone never present is a first meeting, as is asking to meet them.
    h.click('#btnCast'); h.click('#castAdd');
    assert(await h.settle(80, 4000), 'adding a character did not finish');
    h.type('#cfName', 'Mira Holt'); h.type('#cfSpecies', 'Fox');
    h.click('#cfSave');
    assert(await h.settle(80, 4000), 'saving the test character did not finish');
    assert(await h.turn('Stay at the table', { director: 'Mira remains offstage; remember what Mira said.' }), 'director mention turn did not finish');
    assert.equal(tierOf(h, 'turn').slice(-1)[0], 'default', 'a director note that only mentions someone new must not count as a first meeting');
    assert(await h.turn('Do not introduce me to Mira'), 'negated meeting turn did not finish');
    h.$('#director').value = '';
    assert.equal(tierOf(h, 'turn').slice(-1)[0], 'default', 'an action that declines a meeting must not count as a first meeting');
    assert(await h.turn('Stay at the table', { director: 'Mira does not arrive; keep her offstage.' }), 'negated arrival turn did not finish');
    assert.equal(tierOf(h, 'turn').slice(-1)[0], 'default', 'a director note that says someone new does not arrive must not count as a first meeting');
    assert(await h.turn('Stay at the table', { director: 'Mira arrives and sits down.' }), 'director first-meeting turn did not finish');
    h.$('#director').value = '';
    assert.equal(tierOf(h, 'turn').slice(-1)[0], 'complex', 'auto must take the complex tier when the director note brings in someone new');
    // A negation elsewhere in the clause does not take the arrival back.
    for (const note of ['Mira arrives without her coat.', 'Mira arrives and doesn\'t speak.']) {
      assert(await h.turn('Stay at the table', { director: note }), 'arrival turn did not finish: ' + note);
      h.$('#director').value = '';
      assert.equal(tierOf(h, 'turn').slice(-1)[0], 'complex', 'a negation that does not govern the arrival must not cancel it: ' + note);
    }
    assert(await h.turn('Stay at the table', { director: 'Tess is away, and Mira will not be joining us.' }), 'negated joining turn did not finish');
    h.$('#director').value = '';
    assert.equal(tierOf(h, 'turn').slice(-1)[0], 'default', 'a negation just before the cue still brings nobody in');

    // A human already present is not new again: humans are never a kind to be met in a world that tracks kinds.
    h.click('#btnCast'); h.click('#castAdd');
    assert(await h.settle(80, 4000), 'adding a human did not finish');
    h.type('#cfName', 'Tess Ward'); h.type('#cfSpecies', 'Human');
    h.click('#cfSave');
    assert(await h.settle(80, 4000), 'saving the human did not finish');
    h.mock.sampleHandler = (input) => (/<output_format>/.test(String(input))
      ? { text: JSON.stringify(Object.assign(JSON.parse(turnReply()), { state_updates: [{ key: 'present', op: 'append', value: ['Tess Ward'] }] })) } : 'A short answer.');
    assert(await h.turn('Wave at Tess Ward across the room'), 'human arrival turn did not finish');
    h.mock.sampleHandler = (input) => (/<output_format>/.test(String(input)) ? { text: turnReply() } : 'A short answer.');
    assert(await h.turn('Introduce myself to Tess'), 'human re-introduction turn did not finish');
    assert.equal(tierOf(h, 'turn').slice(-1)[0], 'default', 'a human already present must not count as a first meeting');
    // A cue belongs to whoever it is said of: Tess arriving does not bring Mira in, but Mira and Tess arriving together does.
    assert(await h.turn('Stay at the table', { director: 'Mira remains offstage while Tess arrives.' }), 'cue attribution turn did not finish');
    h.$('#director').value = '';
    assert.equal(tierOf(h, 'turn').slice(-1)[0], 'default', 'an arrival said of someone already present must not count for someone new in the same clause');
    assert(await h.turn('Stay at the table', { director: 'Mira and Tess arrive together.' }), 'joint arrival turn did not finish');
    h.$('#director').value = '';
    assert.equal(tierOf(h, 'turn').slice(-1)[0], 'complex', 'someone new arriving alongside someone known is a first meeting');

    // The generated minor figures are named to the narrator, so meeting one is a first meeting too.
    const advDoc = [...h.mock.store.entries()].find(([path]) => /^adventures\/[^/]+$/.test(path))[1].data;
    const present = new Set((advDoc.state.present || []).map((x) => String(x).replace(/\s*\([^)]*\)\s*$/, '').toLowerCase()));
    const minor = (advDoc.cast.generated.minors || []).find((m) => m.first && m.first.length >= 3 && !present.has(String(m.name).toLowerCase()) && !present.has(m.first.toLowerCase()));
    assert(minor, 'the test needs a generated minor figure not yet present');
    assert(await h.turn('Introduce myself to ' + minor.first), 'minor first-meeting turn did not finish');
    assert.equal(tierOf(h, 'turn').slice(-1)[0], 'complex', 'meeting a generated minor figure is a first meeting: ' + minor.name);

    // A reply that fails records the tier the runtime was asked for, not the setting.
    const before = tierOf(h, 'turn').length;
    h.mock.sampleHandler = (input) => (/<output_format>/.test(String(input)) ? 'not json' : 'A short answer.');
    await h.turn('Look out of the window');
    assert.deepEqual(tierOf(h, 'turn').slice(before), ['default', 'default'], 'an ordinary failed turn must be asked on the default tier both times');
    const failure = JSON.parse(h.window.localStorage.getItem('windlass.lastFailure'));
    assert.equal(failure.tier, 'default', 'a failed turn must record the tier asked for, got ' + failure.tier);
    h.mock.sampleHandler = (input) => (/<output_format>/.test(String(input)) ? { text: turnReply() } : 'A short answer.');

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
    h2.click('[data-close="dlgSettings"]');

    // A first meeting in a world that does not track kinds: Halloway has no transformation, and Ines is not there at the start.
    h2.mock.sampleHandler = (input) => (/<output_format>/.test(String(input)) ? turnReply() : 'A short answer.');
    h2.$('#newWorld').value = 'halloway'; h2.click('#newAdv');
    assert(await h2.settle(150, 6000), 'opening Halloway creation did not settle');
    h2.click('#cBegin');
    assert(await h2.idle(15000), 'creating the Halloway adventure did not finish');
    await setWriter(h2, 'auto');
    assert(await h2.turn('Walk along the cloister'), 'Halloway ordinary turn did not finish');
    assert(await h2.turn('Introduce myself to Ines'), 'Halloway first-meeting turn did not finish');
    assert.deepEqual(tierOf(h2, 'turn').slice(-2), ['default', 'complex'], 'auto must take the complex tier for a first meeting in a world without kinds');
    assert(await h2.turn('introduce myself to ines'), 'lower-case first-meeting turn did not finish');
    assert.equal(tierOf(h2, 'turn').slice(-1)[0], 'complex', 'a name typed in lower case must still count');
    assert(await h2.turn('Introduce myself to Tobias'), 'Halloway already-present turn did not finish');
    assert.equal(tierOf(h2, 'turn').slice(-1)[0], 'default', 'someone already present is not a first meeting');
    assert(!h2.errors.length && !h2.mock.violations.length, 'page errors or contract violations: ' + JSON.stringify(h2.errors.concat(h2.mock.violations)));
    h2.close();
    console.log('writer toggle passed: most capable every turn; auto by scene, director first meetings and Halloway first meetings included; failures record the tier asked; the intro on the most capable tier; an old lesser tier opens as auto');
  } catch (e) {
    console.error('WRITER TOGGLE FAILED\n' + ((e && e.stack) || e));
    process.exit(1);
  }
}
main();
