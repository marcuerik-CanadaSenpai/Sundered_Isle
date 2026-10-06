# Windlass test harness

Runs the real page in jsdom against `mock-claude.js`, a strict mock of the artifact runtime (contract 0.2.60). By default it loads `../windlass/index.html` and `../windlass/worlds/*.js`. Set `WL_HTML` and `WL_WORLDS` to run the same scripts against another build, such as the reviewed snapshot in `../review/published/`.

The game now has one world, the Sundered Isle (`worlds/sundered.js`); Halloway and Mythaven were removed, and the suites create and check Sundered adventures only. The reviewed snapshot in `../review/published/` still carries all three worlds. `audit-fixes.js hallowayAttunement` still checks the page's `runProgression` (the engine code only a world with a progression reaches) against the last Halloway world file, kept as the test fixture `fixtures/halloway.js` unless `WL_WORLDS` has one; `audit-fixes.js sunderedOnly` checks that saves from a removed world are passed over quietly at boot and shown as no longer in this game.

The mock enforces the documented limits: 256 KiB per db document, 5,000 documents, the db path grammar, the 64 KiB sample input cap, sample option validation and the downloads extension allow-list. Every breach is recorded in `mock.violations` before the call is rejected. `mock.pending` counts db operations that have started and not yet settled; `h.idle()` and `h.settle()` wait for it to reach zero.

Every script except `probe2.js` (`long-game`), `probe3.js` (`import-export`) and `server.js` is a pass/fail check: it exits 1 on a failed assertion, a turn that does not finish, a page error or a contract violation. The two probes print what they observe.

## Running everything

```bash
npm test               # every check: each audit-fixes scenario and each script in its own process, CPU-count at a time, longest first
npm run test:quick     # before a push: smoke, romance-anatomy, name-matcher, schedule-precedence and the audit-fixes scenarios that boot no page
node run.js --only harpyWingArms,smoke   # named units      node run.js --list   # every unit, * for the quick set, with its last time
node run.js --shard 2/3                  # a third of the work by recorded cost (three machines or three terminals)
node run.js -j 2                         # two at a time on a shared machine (or WL_JOBS=2)
node run.js --seed random                # a fresh seed for every unit, printed with any failure
npm run test:seeds     # before a release: the whole suite on two fixed seeds that are not the scenarios' own (7 and 31)
```

Known red: `lib/known-red.js` lists checks that are red on purpose, each the definition of "done" for engine work not yet landed (`longUncappedGameKeepsItsWindow`: a long uncapped game must keep three of its four verbatim turns and its lore). Each entry carries the failure it is expected to show (a regex on the scenario's failure message): `run.js` prints such a failure as KNOWN RED with its label and does not fail the run; `node audit-fixes.js` with no names does the same, and named alone it fails as usual. A listed unit that fails any other way (a setup check, a crash, a timeout) is a plain FAIL. When one passes, `run.js` says so: take it off the list in the change that makes it green. A unit that had nothing to check exits 3 and shows as SKIP (`migrate-history.js` in a clone without the pinned builds), counted apart from the passes.

The mock store: a scenario that edits an adventure in `mock.store` after the page has read or written it is caught at the page's next write (a `store-edited` violation): the page holds its own copy and writes it back over the edit, so the edit would never reach it. Edit a copied store before `boot()`, change settings through the Settings screen (`setSettings` in `audit-fixes.js`), or set `mock.allowStoreEdits` when the edit is the point.

`run.js` lists the audit-fixes scenarios from `audit-fixes.js --list`, so a new scenario is picked up on its own; a new script must be added to `SCRIPTS` in `run.js` (it says so when one is missing). A failed unit prints its last lines and the command that replays it. Times are kept in `test/.timings.json` (git-ignored) to order the next run.

Scenario comments carry no numbers: the scenario's name is its id.

Old saves: `migrate-history.js` takes eight earlier builds out of git (the list is at its top), plays ten turns on each, opens the save on the current page and plays three more. Before changing what the game saves, add the last build before the change to that list. A clone without those commits skips them with a note; with none of them it exits 3 and shows as SKIP.

Voice: the mock writes filler, so the suite checks what the narrator is shown (`voice-tics`, `pacing-scenes`, `prompt-budget`) but never what a real model writes. `node narration-lint.js <a save's turns directory or an exported .json>` reports that from a game played on the real model: the tics `voice-tics.js` lists, four-word phrases recurring in more than a fifth of the turns, sentences a paragraph, speech per turn and turns ending on an open line; `--gate` exits 1 when one misses its target (the targets are at the top of the file). It is not part of `npm test`.

Seeds: every random draw in the page comes from a seeded generator when a seed is set. `audit-fixes.js` seeds each scenario from a hash of its name, so a scenario draws the same people and the same rolls on every run, and a failure prints `replay: WL_SEED=<n> node audit-fixes.js <name>`. `WL_SEED=<n>` sets the seed for any script; `boot({ seed })` sets it for one page. With no seed (the other scripts by default) the page uses `Math.random`. To check that a scenario holds for any draw, not just its own, run it on several seeds: `for s in 1 2 3 4 5 6 7 8; do WL_SEED=$s node audit-fixes.js harpyWingArms; done`.

```bash
npm install
npm run smoke          # create an adventure, take one turn, check it was shown and saved
npm run turns          # twelve turns, each shown and stored
npm run schedule-precedence # day-specific events take precedence over generic slots
npm run romance-anatomy # romance pacing, anatomical guidance and world-boundary regressions
npm run ui-panels      # panels, labels and editors: spoiler toggle, State and header, Settings notes, Cast, Override, Debug, phone sheet
npm run model-errors    # the model call's failures: plain words for every error code, a failed turn keeps its text and offers Try again, declined access, the slow-start warning, the invention clock, Debug's Ping
npm run gm-prompt       # the game-master blocks of the prompt (closed places, skills, world) stay small and grow when the scene needs them
npm run calendar        # the term's set events reach <clock> as chances, lean the day's aims, stay out of an intimate scene, run to their own end, cost nothing to skip (the exams excepted); the closed places keep a timetable
npm run long-game      # realistic long game; on the snapshot it shows the chunk-size save failure (review/REVIEW.md H1)
npm run import-export  # export then import a 25-turn save (chunks 0000-0002); on the snapshot the imported copy keeps only 0002 (H2)
npm run serve          # the real page with the mock injected, at http://127.0.0.1:4173/
```

Against the snapshot (bash):

```bash
WL_HTML=../review/published/index.html WL_WORLDS=../review/published/worlds node probe3.js
```

In a script: `const { boot } = require('./boot'); const h = await boot({ htmlPath, worldsDir, setup(window, mock) { /* mock.sampleHandler = ... */ } });`, then `h.click('#cBegin'); await h.idle(); await h.turn('Look around');` (`idle()` and `turn()` return false if the page does not go quiet in time), and `h.diagnostics()` returns `{errors, violations}`. Other `boot()` options: `mobile`, `dark`, `seed` (a number: the page's `Math.random` draws from it). Mock knobs: `mock.sampleHandler(input, opts, call)` returns a string, `{text, truncated}`, or throws `{code, message}`; `mock.dbFail(op, path)` returns an error or null; `mock.disable = {db, sample, downloads}`; `mock.store` is a `Map` (share one Map between two boots to simulate two devices).

The page's own sample wrapper strips `opts.label`, so the mock recognises calls by their prompt text.

## The harness review: what is done, declined or handed off

- H7, assertions that pin authored wording: handed off. The prompt shrink and the polish branches are rewriting that wording now; a golden file of the world's lines (`fixtures/world-lines.json` with `--update-golden`) and prompt checks that read their expected sentence from the data are worth doing once those land, so the rewrite is one reviewed diff. The policy assertions CLAUDE.md requires (on-page consensual adult sex, no fade or cutaway, established anatomy only, consent never presumed) stay as they are.
- H8, ladder-era engine code and the Halloway fixture: handed off. Deleting `runProgression`, the ladder step code and the progression prompt block, or keeping them, is a change to the page, and this harness work leaves the page alone. Until then `hallowayAttunement` keeps that code covered.
- H10, one shared helpers module and a cached seeded save: declined for now. Moving a dozen helpers out of twelve files while most polish branches edit those same files would only make conflicts; do it after they merge. `lib/rng.js` and `lib/known-red.js` are the start.
- H12, brittle seams: `h.turn()` is strict and says when no turn ran (`{refused: true}` is used by `turnDuringSlowBoot`): done. The test hook (`window.__WL_HOOK`, two lines in the page) and the property test built on it: handed off, since they need the page changed; the slicing loaders and the `daySchedule` copy stay until then. `probe2.js` and `probe3.js` with assertions in the runner: not done, they stay report-only.
- H14, housekeeping: `npm test` and `test:quick`, this README's list, scenario numbers dropped, the `16.` comment moved onto `sunderedOnly`: done. The `unhandledRejection` counter in `boot.js` (failing from `h.diagnostics()`) and asserting `h.mock.pending === 0` before each script's exit: not done; it changes every script's verdict and wants its own full-suite run.
- H1 and H2 checks this list asks for: `longUncappedGameKeepsItsWindow` (known red), `regenerateKeepsTheBody` and `shedLadderPadsTheSummary` (green): done.
