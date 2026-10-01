const { boot } = require('./boot');
(async () => {
  const h = await boot({});
  await h.settle(150, 6000);
  h.click('#cBegin'); await h.settle(200, 15000);
  for (let i = 1; i <= 25; i++) { h.type('#action', 'Action ' + i); h.click('#send'); await h.settle(30, 15000); }
  const origId = [...h.mock.store.keys()].find(k => /^adventures\/[^/]+$/.test(k)).split('/')[1];
  console.log('turns on page:', h.document.querySelectorAll('#feed .turn').length, 'store chunks for original:', [...h.mock.store.keys()].filter(k => k.startsWith('adventures/' + origId + '/turns/')).length);
  // export
  h.click('#btnAdventures'); await h.settle(50, 3000);
  h.click('#exportAdv'); await h.settle(50, 3000);
  console.log('downloads:', h.mock.downloadsLog.map(d => d.filename + ' ' + d.bytes + 'B'));
  const exported = h.mock.downloadsLog[0] && h.mock.downloadsLog[0].data;
  // import it
  const win = h.window; const file = new win.File([exported], 'save.json', { type: 'application/json' });
  const inp = h.$('#importFile'); Object.defineProperty(inp, 'files', { value: [file], configurable: true });
  inp.dispatchEvent(new win.Event('change', { bubbles: true })); await h.settle(150, 8000);
  console.log('status after import:', h.$('#status').textContent);
  const ids = [...new Set([...h.mock.store.keys()].filter(k => k.startsWith('adventures/')).map(k => k.split('/')[1]))];
  for (const id of ids) console.log(id, id === origId ? '(original)' : '(imported)', 'turns doc turnCount =', (h.mock.store.get('adventures/' + id) || {}).data && h.mock.store.get('adventures/' + id).data.turnCount, '| chunk docs in store:', [...h.mock.store.keys()].filter(k => k.startsWith('adventures/' + id + '/turns/')).map(k => k.split('/').pop()).join(','));
  console.log('turns shown on page now:', h.document.querySelectorAll('#feed .turn').length, '(opening + turns)');
  console.log('errors:', h.errors.length, h.errors.slice(0, 2).map(e => e.message.slice(0, 200)));
  h.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
