# Windlass test harness

Runs the real page in jsdom against `mock-claude.js`, a strict mock of the artifact runtime (contract 0.2.60). By default it loads `../windlass/index.html` and `../windlass/worlds/*.js`. Set `WL_HTML` and `WL_WORLDS` to run the same scripts against another build, such as the reviewed snapshot in `../review/published/`.

The mock enforces the documented limits: 256 KiB per db document, 5,000 documents, the db path grammar, the 64 KiB sample input cap, sample option validation and the downloads extension allow-list. Every breach is recorded in `mock.violations` before the call is rejected. `mock.pending` counts db operations that have started and not yet settled; `h.idle()` and `h.settle()` wait for it to reach zero.

`smoke` and `turns` are pass/fail checks: they exit 1 if a turn does not finish, the feed or the store is missing a turn, or the page logged an error or a contract violation. The other scripts are probes that print what they observe.

```bash
npm install
npm run smoke          # create an adventure, take one turn, check it was shown and saved
npm run turns          # twelve turns, each shown and stored
npm run long-game      # realistic long game; on the snapshot it shows the chunk-size save failure (review/REVIEW.md H1)
npm run import-export  # export then import a 25-turn save (chunks 0000-0002); on the snapshot the imported copy keeps only 0002 (H2)
npm run serve          # the real page with the mock injected, at http://127.0.0.1:4173/
```

Against the snapshot (bash):

```bash
WL_HTML=../review/published/index.html WL_WORLDS=../review/published/worlds node probe3.js
```

In a script: `const { boot } = require('./boot'); const h = await boot({ htmlPath, worldsDir, setup(window, mock) { /* mock.sampleHandler = ... */ } });`, then `h.click('#cBegin'); await h.idle(); await h.turn('Look around');` (`idle()` and `turn()` return false if the page does not go quiet in time), and `h.diagnostics()` returns `{errors, violations}`. Other `boot()` options: `mobile`, `dark`. Mock knobs: `mock.sampleHandler(input, opts, call)` returns a string, `{text, truncated}`, or throws `{code, message}`; `mock.dbFail(op, path)` returns an error or null; `mock.disable = {db, sample, downloads}`; `mock.store` is a `Map` (share one Map between two boots to simulate two devices).

The page's own sample wrapper strips `opts.label`, so the mock recognises calls by their prompt text.
