const { boot } = require('./boot');
const W = (n, seed) => Array.from({ length: n }, (_, i) => ['lantern','corridor','whispers','copper','stairwell','dust','laughter','threshold','somewhere','below'][(i*7+seed)%10]).join(' ');
(async () => {
  let n = 0;
  const h = await boot({ setup(win, mock) { mock.sampleHandler = (input, opts, call) => {
    const p = typeof input === 'string' ? input : '';
    if (!/Return|JSON|narrative/i.test(p) || /Rewrite it to between|long-term memory|first appearance|Invent the people/.test(p)) return mock.defaultHandler(input, opts, call);
    n++;
    return JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: W(380, n) + ' *A thought, turn ' + n + '.*', suggested_actions: ['Look around the quad again', 'Ask the porter about the lanterns', 'Go back to the room and unpack'], secret_info: '', state_updates: [], time_advance_minutes: 20,
      events: [1,2,3].map((k) => 'Day ' + (1 + Math.floor(n/6)) + ' 1' + (k) + ':' + (10+n%40) + ' ' + W(14, n+k)), beats: [W(16, n), W(16, n+3)], facts: [W(12, n+5)], exposures: [] });
  }; } });
  await h.settle(150, 6000);
  h.click('#cBegin'); await h.settle(200, 15000);
  let fail = null;
  for (let i = 1; i <= 120; i++) {
    h.type('#action', 'Action ' + i); h.click('#send'); await h.settle(40, 20000);
    const note = h.$('#summaryNote').textContent;
    if (i % 10 === 0) { const sizes = [...h.mock.store.entries()].filter(([k]) => /\/turns\//.test(k)).map(([k, v]) => Math.round(Buffer.byteLength(JSON.stringify(v.data))/1024)+'K'); console.log('turn', i, '|', note, '| chunks KiB:', sizes.join(' ')); }
    if (/failed/.test(note)) { fail = { turn: i, note, status: h.$('#status').textContent }; break; }
  }
  console.log('FIRST FAILURE:', fail);
  console.log('violations:', JSON.stringify(h.mock.violations.slice(0,4)));
  h.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
