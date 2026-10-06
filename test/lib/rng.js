'use strict';
// A small seeded generator (mulberry32) and a stable seed per scenario name, so a failing run can be replayed exactly.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// WL_SEED=<n> forces one seed for everything; WL_SEED=random draws a fresh one (the caller prints it, so it can be replayed);
// otherwise the seed is a hash of the name, the same on every run.
function seedFor(name) {
  const e = process.env.WL_SEED;
  if (e === 'random') return Math.floor(Math.random() * 2 ** 31);
  if (e != null && e !== '') return Number(e) >>> 0;
  return [...String(name)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
}
module.exports = { mulberry32, seedFor };
