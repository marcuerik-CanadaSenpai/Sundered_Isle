# Windlass verification results

The differential probes in this folder compare the published snapshot in `review/published/` with the current `windlass/` build after integrating PR #22 and PR #23.

## Results

| Area | Result |
|---|---|
| Chunk size | PASS: the 120-turn plain run and 40-turn transformation-heavy run saved without failures; four regenerations at turn 120 remained below the 256 KiB document limit (largest observed chunk: 213,856 bytes). |
| Chunk repair | PASS: transient chunk/document failures were retried, Undo/Regenerate rewrites repaired their chunks, and incomplete saves showed a retry/export action. |
| Imports and history | PASS: 11- and 25-turn saves round-tripped; repeated or non-sequential turn numbers were repaired in saved order; malformed imports preserved the active adventure. |
| In-flight writes | PASS: Continue, begin, import, delete, roommate-intro, boot/load, and length-fit races could not move a reply into the wrong adventure; failure variants also preserved the correct adventure. |
| Prompt guard | PASS: oversized facts, summaries, cast, and state were shed until prompts fit; no request exceeded the 64 KiB runtime cap. |
| Stored XSS | PASS: hostile imported and stored fields rendered as text; no injected elements, event handlers, or script execution were observed. |
| Roommate identity | PASS: in the differential set, the published build had 71/81 wrong-name Turn 0 cases without sample responses and 35/41 with them; the current build had 0 in both sets. The current build also had no missing names, duplicate/mismatched cast entries, wrong prompt names, page errors, or contract violations. |
| Legacy saves | PASS: published saves continued to load and play in all three worlds, including saves without `worldId`. Undo, Regenerate, and previous-version flows remained usable. |

The full-name guard rejects an intro that omits any part of the roommate's name and uses the existing plain introduction fallback. The original published build reproduces the documented failures, confirming the probes exercise the regressions rather than merely passing on both builds. Prompt regressions are covered by the jsdom mock harness; this does not claim to test a live model response.

## Test commands

From `test/`, run `npm ci`, then `npm run smoke`, `npm run turns`, `npm run review-regressions`, `npm run exposure-fallback`, `npm run name-matcher`, and `npm run schedule-precedence`. The differential scenarios are `review/verification/<finding>.js`; each compares `src` (published) with `main` (current build). The `*-challenge.js` scripts cover additional routes.
