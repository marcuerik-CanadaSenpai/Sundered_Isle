const { boot } = require('./boot');
(async () => {
  const h = await boot({});
  await h.settle(150, 6000);
  console.log('conn:', h.$('#connText').textContent, '| save note:', h.$('#summaryNote').textContent, '| world title:', h.$('#worldTitle').textContent);
  console.log('create dialog open:', h.$('#dlgCreate').hasAttribute('open'));
  console.log('errors so far:', h.errors.length, h.errors.slice(0,3));
  console.log('sample calls so far:', h.mock.sampleCalls.map(c=>c.bytes+'B '+c.outcome));
  // begin the adventure
  h.click('#cBegin'); await h.settle(200, 15000);
  console.log('after Begin -> create open:', h.$('#dlgCreate').hasAttribute('open'), '| feed turns:', h.document.querySelectorAll('#feed .turn').length, '| status:', h.$('#status').textContent);
  console.log('store docs:', [...h.mock.store.keys()].slice(0,10));
  h.type('#action', 'I look around the room.'); h.click('#send'); await h.settle(200, 15000);
  console.log('after turn -> feed turns:', h.document.querySelectorAll('#feed .turn').length, '| status:', h.$('#status').textContent, '| save:', h.$('#summaryNote').textContent);
  console.log('violations:', h.mock.violations);
  console.log('errors:', h.errors.length, h.errors.slice(0,5));
  console.log('sample calls:', h.mock.sampleCalls.map(c=>c.bytes+'B '+c.outcome).join(', '));
  h.close(); process.exit(0);
})().catch(e => { console.error('SMOKE FAILED', e); process.exit(1); });
