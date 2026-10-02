'use strict';
// Validates day-specific schedule precedence and that the Day 1 mixer uses the
// shared 'evening' slot (not a bespoke slot that would bypass evening character data).
const assert = require('node:assert/strict');
const { boot } = require('./boot');

// Mirrors the engine's daySchedule() in index.html: day-specific entries replace
// recurring entries that share the same time.
function daySchedule(schedule, weekday, day) {
  const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const entries = schedule.filter((e) => (!e.days || e.days.includes(weekday)) && (e.day == null || e.day === day));
  const overrides = new Set(entries.filter((e) => e.day != null).map((e) => e.time));
  return entries.filter((e) => e.day != null || !overrides.has(e.time)).slice()
    .sort((a, b) => timeToMin(a.time) - timeToMin(b.time));
}

function at(schedule, weekday, day, time) {
  return daySchedule(schedule, weekday, day).filter((e) => e.time === time);
}

function checkWorld(worlds, id) {
  const world = worlds[id];
  assert(world && Array.isArray(world.schedule), id + ' must expose a schedule');

  // The Day 1 mixer must use the established 'evening' slot so it shares the
  // evening where/aims character data rather than a bespoke slot.
  const mixer = world.schedule.find((e) => /mixer/i.test(e.name));
  assert(mixer, id + ' must define the mixer entry');
  assert.equal(mixer.slot, 'evening', id + ' mixer must use the evening slot');
  assert.equal(mixer.day, 1, id + ' mixer must be day-specific to Day 1');

  // Day 1 (a Monday) at 19:00: the day-specific mixer replaces the recurring market.
  const day1 = at(world.schedule, 'Monday', 1, '19:00');
  assert.equal(day1.length, 1, id + ' Day 1 19:00 should yield exactly one event');
  assert.match(day1[0].name, /mixer/i, id + ' Day 1 19:00 should be the mixer');

  // A later Monday (Day 8) at 19:00: only the recurring market remains.
  const day8 = at(world.schedule, 'Monday', 8, '19:00');
  assert.equal(day8.length, 1, id + ' Day 8 19:00 should yield exactly one event');
  assert.doesNotMatch(day8[0].name, /mixer/i, id + ' Day 8 19:00 must not be the mixer');
  assert.match(day8[0].name, /market/i, id + ' Day 8 19:00 should be the recurring market');
}

async function run() {
  const h = await boot({});
  try {
    assert(await h.settle(150, 6000), 'the page did not settle after boot');
    const worlds = h.window.WINDLASS_WORLDS;
    assert(worlds, 'WINDLASS_WORLDS must be exposed');
    checkWorld(worlds, 'mythaven');
    checkWorld(worlds, 'sundered');
    const diagnostics = h.diagnostics();
    assert.equal(diagnostics.errors.length, 0, 'page errors: ' + JSON.stringify(diagnostics.errors));
  } finally {
    h.close();
  }
}

run().then(() => {
  console.log('schedule precedence passed');
}).catch((error) => {
  console.error('SCHEDULE PRECEDENCE FAILED\n' + (error && error.stack || error));
  process.exit(1);
});
