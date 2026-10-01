# Windlass test harness

Runs the real page in jsdom against `mock-claude.js`, a strict mock of the artifact runtime (contract 0.2.60). By default it loads `../windlass/index.html` and `../windlass/worlds/*.js`. Set `WL_HTML` and `WL_WORLDS` to run the same scripts against another build, such as the reviewed snapshot in `../review/published/`.

The mock enforces the documented limits: 256 KiB per db document, 5,000 documents, the db path grammar, the 64 KiB sample input cap, sample option validation and the downloads extension allow-list. Breaches are recorded in `mock.violations`.

```bash
npm install
npm run smoke          # create an adventure, take one turn, save
npm run turns          # twelve turns
npm run long-game      # realistic long game; on the snapshot it shows the chunk-size save failure (review/REVIEW.md H1)
npm run import-export  # export then import a 19-turn save; on the snapshot it shows the import truncation (H2)
npm run serve          # the real page with the mock injected, at http://127.0.0.1:4173/
```

Against the snapshot (bash):

```bash
WL_HTML=../review/published/index.html WL_WORLDS=../review/published/worlds node probe3.js
```

In a script: `const { boot } = require('./boot'); const h = await boot({ htmlPath, worldsDir, setup(window, mock) { /* mock.sampleHandler = ... */ } });`, then `h.click('#cBegin'); await h.idle(); await h.turn('Look around');`. Other `boot()` options: `mobile`, `dark`. Mock knobs: `mock.sampleHandler(input, opts, call)` returns a string, `{text, truncated}`, or throws `{code, message}`; `mock.dbFail(op, path)` returns an error or null; `mock.disable = {db, sample, downloads}`; `mock.store` is a `Map` (share one Map between two boots to simulate two devices).

The page's own sample wrapper strips `opts.label`, so the mock recognises calls by their prompt text.
