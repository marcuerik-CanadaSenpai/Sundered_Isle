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
    for (const rule of ['Perspective: everything is seen from inside', 'Player knowledge: ', 'Stopping: a turn ends at the first moment', 'Variety: aims are directions, not scripts', 'Attitudes: an attitude value moves at most one point', 'Fresh detail: show people and places']) {
      assert.equal((prompts[0].match(new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1, 'shared rule should appear exactly once: ' + rule);
    }
    assert.match(prompts[0], /World-authored transformation traits, steps and habits are sensory references/);
    assert.doesNotMatch(prompts[0], /suggested actions that include fear, curiosity and enjoyment/);
    assert.doesNotMatch(prompts[0], /Write the evaluation first, then the narrative/);
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

async function checkStaleChunkRecovery() {
  const h = await startAdventure();
  try {
    useTurnHandler(h);
    for (let i = 1; i <= 21; i++) assert(await h.turn('Stored turn ' + i), 'turn did not finish: ' + i);
    const [mainPath, mainEntry] = adventureEntry(h);
    const id = mainPath.split('/')[1];
    mainEntry.data.turnCount = 10;
    mainEntry.data.rev++;

    h.click('#btnAdventures');
    assert(await h.settle(80, 4000), 'adventure list did not settle');
    h.click('#reloadAdv');
    assert(await h.settle(100, 8000), 'reloading the stale-chunk save did not finish');
    assert.deepEqual(visibleActions(h), Array.from({ length: 10 }, (_, i) => 'Stored turn ' + (i + 1)));
    assert.match(h.$('#status').textContent, /Ignored 11 stale turns beyond the save record/);

    assert(await h.turn('After stale repair'), 'the adventure did not continue after stale history was removed');
    assert.deepEqual(turnsIn(h, id).map((turn) => turn.action), Array.from({ length: 10 }, (_, i) => 'Stored turn ' + (i + 1)).concat(['After stale repair']));
    const repairedChunk = h.mock.store.get('adventures/' + id + '/turns/0001');
    assert.deepEqual(repairedChunk.data.turns.map((turn) => turn.action), ['After stale repair'], 'the stale chunk should be rewritten with the new valid turn');
    assert(!h.mock.store.has('adventures/' + id + '/turns/0002'), 'later stale chunks should be removed in the same save');

    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h.close();
  }
}

async function checkStaleImportRecovery() {
  const h = await startAdventure();
  try {
    useTurnHandler(h);
    for (let i = 1; i <= 21; i++) assert(await h.turn('Imported turn ' + i), 'turn did not finish: ' + i);
    const [, mainEntry] = adventureEntry(h);
    const adventure = JSON.parse(JSON.stringify(mainEntry.data));
    adventure.turnCount = 10;
    const payload = JSON.stringify({ format: 'windlass-save-1', world: { id: adventure.worldId }, adventure, turns: turnsIn(h, adventure.id) });

    h.click('#btnAdventures');
    assert(await h.settle(80, 4000), 'adventure list did not settle before import');
    const input = h.$('#importFile');
    Object.defineProperty(input, 'files', {
      value: [new h.window.File([payload], 'stale-history.json', { type: 'application/json' })],
      configurable: true
    });
    input.dispatchEvent(new h.window.Event('change', { bubbles: true }));
    assert(await h.settle(100, 8000), 'importing the stale-history save did not finish');
    assert.deepEqual(visibleActions(h), Array.from({ length: 10 }, (_, i) => 'Imported turn ' + (i + 1)));
    assert.match(h.$('#status').textContent, /Ignored 11 stale turns beyond the save record/);

    const [importedPath, importedEntry] = [...h.mock.store.entries()].find(([path, entry]) => /^adventures\/[^/]+$/.test(path) && entry.data.title.endsWith('(imported)'));
    assert(importedEntry, 'the imported adventure was not persisted');
    const importedId = importedPath.split('/')[1];
    assert.equal(importedEntry.data.turnCount, 10);
    assert.deepEqual(turnsIn(h, importedId).map((turn) => turn.action), Array.from({ length: 10 }, (_, i) => 'Imported turn ' + (i + 1)));

    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h.close();
  }
}

async function checkGeneratedRoommateReplacement() {
  const h = await startAdventure();
  try {
    h.mock.disable.sample = true;
    h.click('#btnAdventures');
    assert(await h.settle(80, 4000), 'adventure list did not settle');
    h.$('#newWorld').value = 'mythaven';
    h.click('#newAdv');
    assert(await h.settle(80, 4000), 'Mythaven creation dialog did not open');
    h.$('#cRmSpecies').value = 'cow';
    h.$('#cRmSpecies').dispatchEvent(new h.window.Event('input', { bubbles: true }));
    h.$('#cRmSpecies').dispatchEvent(new h.window.Event('change', { bubbles: true }));
    h.$('#cRmGender').value = 'female';
    h.$('#cRmName').value = 'Marisol Vega';
    h.$('#cRmName').dispatchEvent(new h.window.Event('input', { bubbles: true }));
    h.click('#cBegin');
    assert(await h.idle(30000), 'creating the Mythaven adventure did not finish');

    const [, entry] = [...h.mock.store.entries()].find(([path, value]) => /^adventures\/[^/]+$/.test(path) && value.data.worldId === 'mythaven');
    assert(entry, 'the Mythaven adventure was not persisted');
    assert.equal(entry.data.roommate.replaces, 'marisol', 'an explicitly chosen authored name should replace that same cast member');
    h.click('#btnCast');
    assert.equal(h.$('#castList [data-key="marisol"]'), null, 'the authored Marisol should not appear twice in the cast');

    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h.close();
  }
}

async function checkChunkRecoveryRevision() {
  const h = await startAdventure();
  try {
    useTurnHandler(h);
    assert(await h.turn('Save a recoverable turn'), 'turn did not finish');
    const [path, entry] = adventureEntry(h);
    const id = path.split('/')[1];
    const doc = () => h.mock.store.get('adventures/' + id).data;
    const chunk = h.mock.store.get('adventures/' + id + '/turns/0000');
    chunk.data.turns[0].memAfter = { summary: 'folded checkpoint', events: ['checkpoint event'], beats: [], facts: [] };
    doc().turnCount = 0;
    doc().rev = chunk.data.rev - 1;

    h.click('#btnAdventures');
    assert(await h.settle(80, 4000), 'adventure list did not settle');
    h.click('#reloadAdv');
    assert(await h.settle(100, 8000), 'recovering the interrupted save did not finish');
    assert.deepEqual(visibleActions(h), ['Save a recoverable turn']);
    assert.match(h.$('#status').textContent, /Recovered 1 complete saved turn/);
    assert.equal(doc().memory.summary, 'folded checkpoint', 'recovery should restore the post-fold memory checkpoint');

    doc().turnCount = 0;
    h.click('#btnAdventures');
    assert(await h.settle(80, 4000), 'adventure list did not settle before stale-chunk check');
    h.click('#reloadAdv');
    assert(await h.settle(100, 8000), 'loading the shorter save did not finish');
    assert.deepEqual(visibleActions(h), [], 'a chunk from an already committed revision must not resurrect removed turns');
    assert.equal(entry.data.turnCount, 0);
    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h.close();
  }
}

async function checkCreationFallbackPreservesChoices() {
  const h = await boot({});
  try {
    assert(await h.settle(150, 6000), 'the page did not settle after boot');
    h.mock.sampleHandler = (input, options, call) => {
      if (call.label === 'cast invention') throw { code: 'upstream_error', message: 'simulated generation failure' };
      return h.mock.defaultHandler(input, options, call);
    };
    h.type('#cName', 'Morgan Vale');
    h.click('#cBegin');
    assert(await h.idle(15000), 'adventure creation did not finish after cast invention failed');

    const [, entry] = adventureEntry(h);
    assert.equal(entry.data.player.name, 'Morgan Vale', 'fallback generation must preserve the player name selected in the creation dialog');
    assert(entry.data.cast.generated.characters.length > 0, 'the world pools should still generate cast members when invention fails');
    assert(entry.data.roommate, 'the roommate should still be generated when invention fails');

    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
    assert.equal(diagnostics.violations.length, 0, 'runtime violations: ' + JSON.stringify(diagnostics.violations));
  } finally {
    h.close();
  }
}

(async () => {
  await checkInferenceAndCompaction();
  await checkDuplicateChronology();
  await checkStaleChunkRecovery();
  await checkStaleImportRecovery();
  await checkGeneratedRoommateReplacement();
  await checkChunkRecoveryRevision();
  await checkCreationFallbackPreservesChoices();
  console.log('review regressions passed');
})().catch((error) => {
  console.error('REVIEW REGRESSIONS FAILED\n' + (error && error.stack || error));
  process.exit(1);
});
