'use strict';
// Pass/fail: with a large fact store and a long action, the prompt guard descends to its deep rungs, compacting the
// transformation block to its settled traits and holding facts within a byte budget, and the prompt stays within the cap.
const { boot } = require('./boot');
const { MAX_PROMPT } = require('./mock-claude');
const words = (n, w) => Array.from({ length: n }, (_, i) => w[i % w.length]).join(' ');
(async () => {
  const h = await boot({});
  await h.settle(150, 6000);
  h.click('#cBegin'); await h.idle(15000);

  // Flood memory with many large facts so the <facts> block dominates the removable mass.
  h.mock.sampleHandler = (input) => {
    const prompt = typeof input === 'string' ? input : input.map((m) => m.content).join('');
    if (/Rewrite it to between/.test(prompt)) return words(120, ['The', 'hall', 'is', 'quiet.']);
    if (/You maintain the long-term memory/.test(prompt)) return 'Day 1: ' + words(200, ['nothing', 'of', 'note', 'occurred', 'today']);
    if (/first appearance/.test(prompt)) return words(130, ['Your', 'roommate', 'waves', 'hello.']);
    if (/Invent the people/.test(prompt)) return h.mock.defaultHandler(input);
    h.mock.turnCounter = (h.mock.turnCounter || 0) + 1; const n = h.mock.turnCounter;
    const facts = Array.from({ length: 40 }, (_, i) => 'Fact ' + n + '.' + i + ': ' + words(120, ['the', 'isle', 'keeps', 'a', 'long', 'settled', 'truth', 'about', 'the', 'harbour', 'and', 'its', 'people']));
    return JSON.stringify({ evaluation: { stat: 'none', outcome: 'none' }, narrative: words(160, ['You', 'walk', 'on', 'through', 'the', 'quiet', 'corridor.']) + ' *Turn ' + n + '.*', suggested_actions: ['Look', 'Wait', 'Leave'], secret_info: '', state_updates: [], time_advance_minutes: 15, events: ['Day 1 10:' + (10 + n % 40) + ' Event ' + n], beats: ['Beat ' + n], facts, exposures: [] });
  };

  for (let i = 1; i <= 16; i++) if (!(await h.turn('Explore ' + i))) throw new Error('turn ' + i + ' did not finish');
  const huge = words(1200, ['describe', 'the', 'harbour', 'at', 'dusk', 'in', 'rich', 'detail', 'slowly']);
  if (!(await h.turn('Think carefully. ' + huge, { director: huge }))) throw new Error('large turn did not finish');

  const last = [...h.mock.sampleCalls].reverse().find((c) => { const p = typeof c.input === 'string' ? c.input : c.input.map((m) => m.content).join(''); return /<output_format>/.test(p) && /<action>/.test(p); });
  const prompt = typeof last.input === 'string' ? last.input : last.input.map((m) => m.content).join('');
  const bytes = Buffer.byteLength(prompt, 'utf8');
  const { errors, violations } = h.diagnostics();
  const tooLarge = violations.filter((v) => /prompt-too-large/.test(JSON.stringify(v)));

  const fail = (m) => { console.error('prompt guard FAILED: ' + m + '\n  prompt bytes: ' + bytes); h.close(); process.exit(1); };
  if (bytes > 63000) fail('prompt exceeded the 63000-byte guard target');
  if (tooLarge.length) fail('runtime 64 KiB cap was breached');
  if (!/earlier facts omitted/.test(prompt)) fail('facts byte budget did not engage (no "earlier facts omitted" note)');
  if (!/intensity 1 to 3; a contact counts once/.test(prompt)) fail('compact transformation block did not engage');
  if (/1 brief \(a hug/.test(prompt)) fail('full transformation guidance was still present at a deep rung');
  if (errors.length) fail('page errors: ' + errors.map((e) => e.message.slice(0, 120)).join(' | '));

  console.log('prompt guard passed: deep rungs compacted the transformation block and held facts within budget; prompt ' + bytes + ' bytes (cap ' + MAX_PROMPT + ')');
  h.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
