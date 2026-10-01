# Do the fixes on `main` hold up?

Differential check of `windlass/` on `main` (commit 1bdca27, Copilot's fixes from PR #1 and #2) against the reviewed snapshot in `review/published/`, run on 2026-10-01. For each finding one agent ran the same scenario on both builds with the jsdom harness, and a second agent reran it and tried another route to the same bug. The scripts are in this folder (see "Rerunning" below).

## Verdicts

| Finding | Bug on the published build | Fixed on `main`? |
|---|---|---|
| Saves fail once a 10-turn chunk passes 256 KiB | yes (turn 30, or turn 10 with six transformations) | **No, and it regressed** (Undo, below). Fixed for normal play, but Regenerate can still overflow a chunk |
| Import keeps only the last 10 turns | yes | **Fixed** |
| A reply lands in whichever adventure is open | yes | **Partly**: 11 of 12 routes fixed; Regenerate can now put the old adventure's turn into the new one |
| A failed Continue stamps the wrong world | yes | **Fixed** |
| A failed chunk write is never repaired | yes | **Partly**: one-off failures are repaired and a Retry save button appears; Undo or Regenerate of a chunk-closing turn still loses turns |
| Prompt-size guard dead-ends long games | yes | **Partly**: nothing goes over 64 KiB, but large facts, summaries, engine notes and casts still get the turn refused |
| Stored XSS from saves | yes | **Partly**: still fires with no click through `alts` and transformation tracks |
| Mythaven roommate intro names the wrong person | yes | **Partly**: intros fixed; Marisol Vega can now appear twice in the cast |
| Regressions and old-save compatibility | n/a | **Regressed**: Undo twice breaks the adventure; saves with repeated turn numbers can no longer be opened |

## Regressions introduced on `main`

These work on the published build and break on `main`:

1. **Undo twice, Undo then Regenerate, or Undo after an import breaks the adventure.** `trimTurnHistory()` shrinks every turn but the last to `{day, time, location, present}` and sets `memBefore` to null. Undo then restores that trimmed state. `renderRail` throws ("reading 'condition'"), turns stop advancing until a reload, and the save note still says saved. Imported saves are trimmed on import, so they hit this on the second Undo too.
2. **Regenerate after a turn swap writes into the wrong adventure.** `onRegenerate` restores into the global `adv` after `takeTurn` discards a stale reply, so the old adventure's last turn and state land in the newly opened one.
3. **Saves with repeated turn numbers can no longer be opened.** The published import bug plus one more turn produces them with no injected failure. `main` refuses them on load and on import, and boot silently opens an older adventure with "Welcome back". There is no repair path.
4. **Duplicate Marisol Vega.** The creation dialog fills the roommate name with the template name, so `replaces` is never applied for cow/female roommates (default, menu pick, Randomise everything or Bovine alias). Marisol appears as the roommate and again in the cast.
5. **Saves with no `worldId` are refused.** The published build fell back to Halloway.

## Still open on `main`

- **Chunk size:** each Regenerate keeps a full previous version in `alts`. At turn 120 the 3rd and 4th regenerations were rejected at about 371 KB. Five "Regenerate with changes" on one turn overflowed at about 285 KB. A failed save of a completed chunk is never rewritten, because `_savedUpToChunk` is not lowered on failure.
- **Chunk repair:** Undo of a chunk-closing turn (10, 20, …) leaves the saved-chunk marker stale, and the next failed write loses that turn for good. The load-time turn-count warning is immediately overwritten by "Welcome back". The quota-exceeded message says to retry, which cannot succeed.
- **Prompt guard:** facts, summary, engine notes, present characters, `gm_only` and transformation text are never shed. The memory fold has no size check and is resent over the cap on every commit. The refusal still says to lower the verbatim window, which is already 1.
- **In-flight:** Continue then Escape leaves a load running with `busy` false. A load landing during length fit still commits the turn into the other adventure. `applyManualReply` has no stale-adventure guard.
- **Stored XSS:** `alts.length`, `alts[].n`, `tf.tracks[].i` and `tf.tracks[].steps.length` are rendered raw. They fire at boot (spoilers off, any world), on Previous version, and on live sync from another device.
- **Imports:** turns are not sorted, so a reversed save creates duplicate numbers. There is no size check before the chunk write.

## Confirmed fixed

- Import writes every chunk; 11- and 25-turn saves round-trip (11/11, 25/25), and bad files are refused without losing the open adventure.
- Failed Continue keeps the open adventure's world; rename no longer stamps the wrong world.
- A one-off chunk or document write failure is repaired on the next save, and a Retry save button shows while it is failing.
- A normal 120-turn game saves without a single failure (largest chunk about 111 KB, leveling at about 143 KB at the 600-event cap).
- Old saves from the published build open on `main` intact in all three worlds and can be played on.

## Rerunning

```bash
cd test && npm install && cd ..
bash review/verification/make-root.sh
export WL_ROOT="$PWD/review/verification/root" NODE_PATH="$PWD/test/node_modules"
node review/verification/import-truncation.js
```

On Windows Git Bash, give node Windows-style paths: `export WL_ROOT="$(cygpath -m "$PWD/review/verification/root")"` and the same for `NODE_PATH`. Each `<finding>.js` is the tester's script and `<finding>-challenge.js` the skeptic's. They print side-by-side results for `src` (the published build) and `main` (the build under test); they are probes and do not set an exit code.
