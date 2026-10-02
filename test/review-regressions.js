'use strict';
const assert = require('node:assert/strict');
const { boot } = require('./boot');

async function startAdventure() {
  const h = await boot({});
  assert(await h.settle(150, 6000), 'the page did not settle after boot');
  h.click('#cBegin');
  assert(await h.idle(15000), 'creating the adventure did not finish');
  return h;
}

function useTurnHandler(h) {
  const prompts = [];
  let n = 0;
  h.mock.sampleHandler = (input) => {
    const prompt = Array.isArray(input) ? input.map((m) => m.content).join('\n') : String(input);
    if (prompt.includes('You are the storyteller for an interactive text adventure')) {
      prompts.push(prompt);
      n++;
      return JSON.stringify({
        evaluation: { stat: 'none', outcome: 'none' },
        narrative: 'Narrative ' + n,
        suggested_actions: ['Look around', 'Wait', 'Leave'],
        secret_info: '', state_updates: [], time_advance_minutes: 15,
        events: [], beats: [], facts: [], exposures: []
      });
    }
    return 'No further lasting events.';
  };
  return prompts;
}

function adventureEntry(h) {
  return [...h.mock.store.entries()].find(([path]) => /^adventures\/[^/]+$/.test(path));
}

function turnsIn(h, id) {
  return [...h.mock.store.entries()]
    .filter(([path]) => path.startsWith('adventures/' + id + '/turns/'))
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, entry]) => entry.data.turns);
}

function visibleActions(h) {
  return [...h.document.querySelectorAll('#feed .turn .turn-action')].map((el) => el.textContent);
}

async function checkInferenceAndCompaction() {
  const h = await startAdventure();
  try {
    const prompts = useTurnHandler(h);
    h.click('#btnCast');
    h.click('#castAdd');
    assert(await h.settle(80, 4000), 'adding a character did not finish');
    h.type('#cfName', 'Kit');
    h.type('#cfSpecies', 'Werewolf');
    h.click('#cfSave');
    assert(await h.settle(80, 4000), 'saving the test character did not finish');

    const actions = [
      'I tell Kit good night and go to sleep',
      'I ask Kit to hug Rin',
      "I didn't hug Kit",
      'Kit hugs Rin',
      'I meet the kit',
      'I slept beside Kit'
    ];
    for (const action of actions) assert(await h.turn(action), 'turn did not finish: ' + action);

    const id = adventureEntry(h)[0].split('/')[1];
    let turns = turnsIn(h, id);
    assert.deepEqual(turns[0].exposures, [], 'sleeping separately from Kit must not infer exposure');
    assert.deepEqual(turns[1].exposures, [], 'a request to hug must not infer exposure');
    assert.deepEqual(turns[2].exposures, [], 'negated contact must not infer exposure');
    assert.deepEqual(turns[3].exposures, [], 'contact between characters must not infer player exposure');
    assert.deepEqual(turns[4].exposures, [], 'lowercase "kit" must not be treated as the proper name Kit');
    assert(!prompts[4].includes('Focus: the action names Kit'), 'lowercase "kit" must not focus the character Kit');
    assert.deepEqual(Array.from(turns[4].band), Array.from(h.window.WINDLASS_WORLDS.sundered.wordBands.standard), 'lowercase "kit" must not imply a first meeting');
    assert.equal(turns[5].exposures[0] && turns[5].exposures[0].species, 'wolf', 'explicit first-person sleep with Kit should infer wolf exposure');
    assert.equal(turns[5].exposures[0] && turns[5].exposures[0].intensity, 3);

    for (let i = 7; i <= 11; i++) assert(await h.turn('Action ' + i), 'turn ' + i + ' did not finish');
    turns = turnsIn(h, id);
    const compacted = turns.find((turn) => turn.n === 9);
    assert(compacted && compacted._trimmed && compacted.memBefore === null, 'turn 9 should be compacted in its completed chunk');
    assert(!Object.hasOwn(compacted.stateBefore, 'items'), 'the compacted snapshot should not retain full state');
    const worlds = h.window.WINDLASS_WORLDS;
    const udderTrait = worlds.mythaven.transformation.species.cow.ladder.find((step) => step.at === 85).trait;
    assert(!/feminine body path/.test(udderTrait) && /udder develops/.test(udderTrait), 'the udder trait should apply unconditionally');
    const wolfBody = worlds.sundered.genPools.species.wolf.bodyByGender.female[0];
    assert.equal(wolfBody, 'Two rows of small nipples run down the abdomen, dark against the pelt');
    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h.close();
  }
}

async function checkDuplicateChronology() {
  const h = await startAdventure();
  try {
    useTurnHandler(h);
    for (const action of ['Chronology A', 'Chronology B', 'Chronology C', 'Chronology D']) {
      assert(await h.turn(action), 'turn did not finish: ' + action);
    }
    const [mainPath, mainEntry] = adventureEntry(h);
    const id = mainPath.split('/')[1];
    const chunk = h.mock.store.get('adventures/' + id + '/turns/0000');
    chunk.data.turns.forEach((turn, i) => { turn.n = [1, 2, 1, 2][i]; });

    h.click('#btnAdventures');
    assert(await h.settle(80, 4000), 'adventure list did not settle');
    h.click('#reloadAdv');
    assert(await h.settle(100, 8000), 'reloading the duplicate-number save did not finish');
    assert.deepEqual(visibleActions(h), ['Chronology A', 'Chronology B', 'Chronology C', 'Chronology D']);
    assert.match(h.$('#status').textContent, /Duplicate turn numbers were repaired in chronological order/);

    const exportedTurns = turnsIn(h, id).map((turn) => JSON.parse(JSON.stringify(turn)));
    exportedTurns.forEach((turn, i) => { turn.n = [1, 2, 1, 2][i]; });
    const payload = JSON.stringify({
      format: 'windlass-save-1',
      world: { id: mainEntry.data.worldId },
      adventure: JSON.parse(JSON.stringify(mainEntry.data)),
      turns: exportedTurns
    });
    h.click('#btnAdventures');
    const input = h.$('#importFile');
    Object.defineProperty(input, 'files', {
      value: [new h.window.File([payload], 'duplicate-turns.json', { type: 'application/json' })],
      configurable: true
    });
    input.dispatchEvent(new h.window.Event('change', { bubbles: true }));
    assert(await h.settle(100, 8000), 'importing the duplicate-number save did not finish');
    assert.deepEqual(visibleActions(h), ['Chronology A', 'Chronology B', 'Chronology C', 'Chronology D']);
    assert.match(h.$('#status').textContent, /Turn numbers were repaired in chronological order because duplicates were present/);

    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h.close();
  }
}

async function checkPromptAndStaleRecovery() {
  const h = await startAdventure();
  try {
    useTurnHandler(h);
    const [seedPath, seedEntry] = adventureEntry(h);
    const seedId = seedPath.split('/')[1];
    seedEntry.data.memory.facts = Array.from({ length: 100 }, (_, i) => 'Fact ' + i + ' ' + 'word '.repeat(120));
    h.click('#btnAdventures');
    assert(await h.settle(80, 4000), 'adventure list did not settle');
    h.click('#reloadAdv');
    assert(await h.settle(100, 8000), 'reloading seeded save did not finish');
    assert(await h.turn('Prompt guard check turn'), 'prompt guard turn did not finish');
    const seededTurns = turnsIn(h, seedId);
    const seededLast = seededTurns[seededTurns.length - 1];
    const guardNote = (seededLast.notes || []).find((n) => /prompt near the size cap:/.test(n));
    assert(guardNote, 'oversized prompt should produce a guard note');
    assert.match(guardNote, /transformation guidance compacted/, 'guard note should report compact transformation stage');
    assert.match(guardNote, /facts budgeted by bytes/, 'guard note should report byte-budget facts stage');
    h.click('#btnDebug');
    const promptText = h.$('#dbgPrompt').textContent;
    assert(!promptText.includes('Story thread:'), 'compact transformation stage should omit long story-thread guidance');
    assert(promptText.includes('(earlier facts omitted to stay under the prompt size cap)'), 'facts byte budget should mark omitted older facts');

    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h.close();
  }

  const h2 = await startAdventure();
  try {
    useTurnHandler(h2);
    for (let i = 1; i <= 12; i++) assert(await h2.turn('Recovery turn ' + i), 'turn did not finish: ' + i);
    const [mainPath, mainEntry] = adventureEntry(h2);
    const id = mainPath.split('/')[1];
    const before = turnsIn(h2, id);
    mainEntry.data.turnCount = 4;
    mainEntry.data.memory = { summary: 'stale summary', events: ['old'], beats: ['old'], facts: ['old'] };
    mainEntry.data.pendingNotes = ['old note'];

    h2.click('#btnAdventures');
    assert(await h2.settle(80, 4000), 'adventure list did not settle');
    h2.click('#reloadAdv');
    assert(await h2.settle(100, 8000), 'reloading stale save did not finish');
    assert.match(h2.$('#status').textContent, /Recovered 12 saved turns from chunks, though the save record listed 4/);

    const after = turnsIn(h2, id);
    assert.equal(after.length, 12, 'reloaded save should keep all chunk turns');
    assert.deepEqual(visibleActions(h2), Array.from({ length: 12 }, (_, i) => 'Recovery turn ' + (i + 1)));
    const clock = h2.$('#clock').textContent;
    assert(clock.includes('Day ' + before[before.length - 1].stateAfter.day), 'reloaded day should match the latest chunk turn state');
    assert(clock.includes(before[before.length - 1].stateAfter.time), 'reloaded clock time should match the latest chunk turn state');

    const diagnostics = h2.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h2.close();
  }
}

(async () => {
  await checkInferenceAndCompaction();
  await checkDuplicateChronology();
  await checkPromptAndStaleRecovery();
  console.log('review regressions passed');
})().catch((error) => {
  console.error('REVIEW REGRESSIONS FAILED\n' + (error && error.stack || error));
  process.exit(1);
});
