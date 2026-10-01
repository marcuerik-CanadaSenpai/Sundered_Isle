const { boot } = require('./boot');
(async () => { const h = await boot({}); await h.settle(150, 6000); h.click('#cBegin'); await h.idle();
  for (let i = 1; i <= 12; i++) await h.turn('Action ' + i);
  console.log('turn elements:', h.document.querySelectorAll('#feed .turn').length, '| store docs:', [...h.mock.store.keys()].length, '| violations:', h.mock.violations.length, '| errors:', h.errors.length);
  h.close(); process.exit(0); })();
