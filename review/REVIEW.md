# Windlass review

Review of the published Windlass artifact (index.html plus worlds/halloway.js, mythaven.js, sundered.js), version 1790836578-6d6c, run on 2026-10-01.

## How it was checked

- 23 reviewers read the code in slices, drove the real page in a test harness (jsdom plus a strict mock of the `db`, `sample` and `downloads` runtime that enforces the documented limits), checked the world data, and checked layout in a real browser.
- 223 raw findings were merged into 122. Each was then given to one to three skeptics who tried to refute it (code trace, reproduction, impact).
- Result: **61 confirmed**, 1 refuted, **60 not verified** (the usage limit stopped verification part-way; they are listed at the end and are mostly low severity).
- Gaps: four reviewers produced unusable output (code lines 475-912 and 1360-1700, and the Sundered transformation data), and the completeness pass did not run. Other reviewers covered parts of those areas.

Severity below is the verifiers' corrected severity where they changed it. Line numbers refer to the reviewed snapshot in `review/published/index.html` (the artifact as published before the fixes on `main`).

| Severity | Confirmed |
|---|---|
| high | 6 |
| medium | 30 |
| low | 21 |
| nit | 4 |

## Confirmed findings

### High

#### H1. Saving silently stops working after roughly 40 turns: a 10-turn chunk document outgrows the 256 KiB db limit

- **Where:** `index.html` 1538-1546 (turn record), 1753-1768 (persist), 1702-1704 (advDoc); 1016-1017 (tf tracks cloned into snapshots) (data-loss)
- **What happens:** Each stored turn embeds stateBefore, stateAfter, memBefore, pendingBefore and alts (index.html:1544-1545), and persist() rewrites the whole 10-turn chunk as one document (1763), so a chunk eventually exceeds the 256 KiB cap and set() rejects invalid_argument. The failures are intermittent, not total: they hit only the last turns of each chunk, widen as memBefore grows, and silently leave permanent gaps in the stored turn history. The main adventure doc (state, memory, turnCount) keeps saving. Onset is about turn 40 only for a verbose model, about 70 for a moderate one, and beyond 180 for a terse one.
- **Fix:** Stop embedding stateBefore, stateAfter and memBefore in every stored turn (keep only the last turn's, or store diffs), and size chunks by serialized bytes rather than a fixed 10. Also have persist() re-write any earlier chunk whose save failed, and keep a persistent save-failed banner.
- **Verified:** trace partly, repro partly, impact partly (reported as critical)

#### H2. Import writes only the last chunk of turns to the store, so an imported adventure loses its earlier turns on reload

- **Where:** `index.html` 1857-1869 (importFile), 1753-1768 (persist), 1769-1775 (persistAll) (data-loss)
- **What happens:** Confirmed as stated. Narrow scope: it applies to imports of saves with more than 10 turns (CHUNK=10), and the original and the export file still hold the full history.
- **When:** Player exports a 25-turn save, imports it (e.g. on another device or after deleting the original); the page looks right until reload/sync, then turns 1-10 are gone while turnCount still says 19.
- **Fix:** Call persistAll(adv.id) in importFile in place of persist() (adventure doc plus every chunk), then read back the chunk count before reporting success. Account for the K1 256 KiB per-chunk cap, since long imported saves would otherwise fail in persistAll and the import should surface that error.
- **Verified:** trace confirmed, repro confirmed, impact confirmed

#### H3. An in-flight turn (or roommate intro) is committed into whichever adventure is loaded when the reply arrives

- **Where:** `index.html` 1552-1614 (takeTurn/commitReply, rollback at 1608); 1641-1667 (writeRoommateIntro); 1776-1790; 1822 (Continue); 1830-1833 (delete-current); 1857-1869 (Import); 2266 (setBusyUI); 2481, 2519-2539, 2535 (New adventure/Begin); 2557-2569 (boot) (state-engine)
- **What happens:** Confirmed as stated. Narrow the boot-race claim: it needs a turn sent in the short gap before db resolves, so it is low-likelihood. The Continue, New adventure/Begin, Import, Delete-current and roommate-intro cases are realistic during a long turn.
- **When:** Start a turn (30-120 s on the complex tier), open Adventures and press Continue on another save, or Import, or New adventure > Begin. When the reply lands it is pushed into the other adventure, its clock/state advance and it is saved there; the original never receives the turn, and a later Undo writes the foreign state into it. A roommate intro still being written after Begin goes to the new adventure with the OLD roommate's text. The same race exists at boot: a turn sent before db resolves lands in the freshly loaded save.
- **Fix:** The proposed fix is sufficient. Disable the Adventures dialog's Continue, New adventure, Import and Delete-current controls while busy or while the boot load is pending. The New adventure button is the right place to guard Begin, because a refusal at Begin would waste the invention call. Also capture const mine = adv at the start of takeTurn and writeRoommateIntro and skip the commit, persist and rollback if adv !== mine after any await.
- **Verified:** trace confirmed, repro confirmed, impact confirmed

#### H4. A failed Continue leaves the new world loaded over the old adventure; the next save stamps the wrong worldId and every turn errors

- **Where:** `index.html` 1776-1790 (setWorld at 1780, before the chunk query at 1781), 1822, 1832, 1703 (advDoc worldId: W.id) (data-loss)
- **What happens:** Confirmed. After a failed Continue, W is the target adventure's world while adv is still the old adventure. The next persist (Settings, Rename, Save summary, copy, or a turn for similar world pairs such as Mythaven→Halloway) stores the wrong worldId. The adventure is then either unloadable (Halloway stamped sundered) or loads garbled under the wrong world. The delete-current variant also resurrects the just-deleted adventure with the wrong worldId.
- **Fix:** Fetch the doc and chunks first, then call setWorld and assign adv together in one synchronous step, or snapshot W and restore it in a catch. Apply the same ordering in importFile and newAdventure.
- **Verified:** trace confirmed, repro confirmed, impact partly

#### H5. A failed chunk write is never repaired: history gaps, state ahead of the log, duplicate turn numbers, and a later 'saved' note hides it

- **Where:** `index.html` 1753-1768 (persist); 1758-1763; 1773-1774; 1782-1783; 1539 (data-loss)
- **What happens:** Core claim stands, with one precision. Permanent loss needs one of three conditions: a persistent rejection (K1), a failed write on the last turn of a chunk (turn 10, 20, 30 and so on), or a failed write on the last turn before the page closes or reloads. A transient failure on a mid-chunk turn heals itself, because the next persist rewrites the whole 10-turn slice.
- **Fix:** Write the turn chunks before the adventure doc and keep a per-session set of failed chunk indexes that the next persist rewrites. Retry unavailable once after a short random delay, and keep the warning visible while any chunk is dirty. Derive turn.n from max(n)+1 and the chunk index from turn.n rather than array position.
- **Verified:** trace confirmed, repro partly, impact partly

#### H6. Prompt-size guard cannot shrink the largest sections and never re-checks its last step; long Sundered games dead-end with prompt_too_large

- **Where:** `index.html` 1563-1567, 1564-1567, 1602 (untrimmed sections: 1321-1322) (robustness)
- **What happens:** Core confirmed: the last guard stage is never measured, and lore, characters, gm_only, transformation, summary and facts are never reduced. Sundered's base prompt is about 52 KB, so ordinary long games dead-end with prompt_too_large. The error text tells the player to lower a window setting that is already forced to 1. Exact turn numbers and byte counts depend on fact count and length (failures at turns 14-35 in my runs). Undo is not a real escape, since the next turn re-adds the facts.
- **Fix:** Keep the proposed fix, but add a terminal shedding stage (oldest facts, summary, style_examples of 1-2.7 KB, minor characters). Count the lore budget against loreText output including ladders. If the prompt still exceeds the limit after the last measured stage, fail locally with an actionable message instead of calling sample(). A pre-call fold adds a second sample() per over-budget turn, so shed locally first and fold afterwards.
- **Verified:** trace confirmed, repro partly, impact partly

### Medium

#### M1. Imported saves and stored docs are injected into innerHTML unescaped (stored XSS, zero-click at boot)

- **Where:** `index.html` 2276, 2320, 2330, 2332, 2358, 2366-2371, 2368, 2370-2371, 2384, 2166-2168, 2567 (import 1857-1866) (security)
- **What happens:** Numeric-looking fields in imported or stored adventures (state.day, turn n, words, stateBefore/After.day, exposure intensity, player.stats values, attitude values, tf trait and sex day, and the Override dialog value attributes) go into innerHTML unescaped. A crafted windlass-save-1 file, or a doc written to the shared db with a newer updatedAt, therefore runs script on render and again on every later load. Influence and skills are not injectable because ensureTf and ensureSkills coerce them to numbers. Impact is limited to the artifact's own db, sample and downloads, with no network egress.
- **Fix:** Wrap every interpolated value in esc() or Number(), or build these nodes with textContent. Coerce the numeric fields (day, n, words, intensity, attitudes, player stats, tf day) on import and load.
- **Verified:** trace partly, repro partly, impact partly (reported as high)

#### M2. Mythaven roommate intro hard-codes the template's name while the default roommate name is usually a generic one

- **Where:** `worlds/mythaven.js` 287-343 (template intros); index.html:2050-2060, 2058-2059, 2122 (content-data)
- **What happens:** All nine Mythaven template intros hard-code the template surname (harpy also 'Juniper'), and rmNamesFor adds five _generic names to every species, so about 83-85% of default Mythaven roommates get a name the opening contradicts (for example 'Tobiah Renn ... "Brasswick," he says. "Tobiah."'). Template roommates are never rewritten by writeRoommateIntro, so the mismatch stays in Turn 0. The 'removes Marisol' point is by-design behaviour, and the narrator-confusion claim is not verified.
- **Fix:** Use {rm_Name} or a new rm_last token in the nine intros instead of literal surnames. Also reword the lore line at worlds/mythaven.js:501 ("Nettle and Fennick's uncle") so it does not depend on the roommate's name.
- **Verified:** trace confirmed, repro partly, impact partly (reported as high)

#### M3. Partial failures in copy, delete and undo leave truncated or corrupt records that look healthy in the list

- **Where:** `index.html` 1764, 1769-1775, 1822-1830, 1824, 1826-1829 (data-loss)
- **What happens:** Core confirmed as stated. Narrow two points: the delete case is recoverable by retrying the delete, and the undo case only occurs when undoing the first turn of a 10-turn chunk. The records are corrupt or mislabelled rather than losing data the user wanted to keep.
- **When:** Save a copy of a ~40-turn adventure hits K1 on a later chunk: the status says 'That did not work', but a copy doc claiming 40 turns exists with 3 chunks and opens with 30. An interrupted delete leaves the adventure listed as 25-35 turns but opening with 15; a failed copy leaves a listed copy with no turns; a failed chunk delete during undo means a reload resurrects the undone turn (shows 10, expected 9).
- **Fix:** The suggested fix is sound. For undo, the simplest robust change is to make loadAdventure drop any turn beyond the doc's turnCount, which also heals stale chunks left by a failed delete. A chunk-count mismatch could also show a warning.
- **Verified:** trace confirmed, repro confirmed

#### M4. Revision-based stale detection can be defeated: a failed save pre-bumps rev, and the doc is written before its chunk

- **Where:** `index.html` 1703, 1711-1719, 1753-1768 (state-engine)
- **What happens:** Core claims verified. persist() raises adv.rev before the doc write, so a failed doc write leaves the page ahead of the store and stale detection misses another device's equal-numbered save. This only happens when the other device's saves since the divergence number no more than the failed ones. Writing the doc before the chunk lets a device that syncs in the one-round-trip gap adopt the new rev with the old chunk and later overwrite it. That second case is a rare race.
- **When:** A's save fails once (rev 5 held locally only); B then saves a genuine rev 5; A's next turn sees no newer save and silently overwrites B's turn. If B's focus/visibility/60 s sync lands between A's doc write and chunk write, B loads 'rev 5, 2 turns', never reloads, and its next turn overwrites the chunk, deleting A's turn.
- **Fix:** Set adv.rev only after the doc write succeeds (compute the next rev into a local variable and roll back on error), and stamp each chunk with the rev it belongs to. On load, reload or retry when the chunk rev or turnCount does not match the doc.
- **Verified:** trace confirmed, repro confirmed

#### M5. Other-device deletes and renames are invisible to an open page; its next save resurrects a truncated adventure or reverts the rename

- **Where:** `index.html` 1714, 1711-1719, 1753-1764, 1823, 1825-1829 (data-loss)
- **What happens:** Core claim confirmed: newerInStore returns null for a missing doc, so a stale page re-creates an adventure deleted on another device (doc says N turns, only the last chunk exists). A rename of a non-current adventure does not bump rev, so a page holding it silently reverts the title on its next save. Both need a second device or tab holding the same adventure and are minor, so low severity.
- **When:** Device A deletes adventure X while B still shows it, then B takes a turn: X reappears in A's list as '13 turns' (26 in another run) but opens with only 3 (6), since earlier chunks were deleted. Renaming X on A while B has it open is silently reverted by B's next turn, with no conflict offered and nothing shown on focus.
- **Fix:** Bump rev and updatedAt on rename via the same write path as persist; treat a missing doc for an adventure with adv.rev > 0 as deleted (stop saving and offer to restore via persistAll or discard).
- **Verified:** trace confirmed, repro confirmed

#### M6. 'Save a copy' makes the copy the most recent save and mutates the live adv.title across awaits, so a racing save renames the original

- **Where:** `index.html` 1824, 2567-2568, 1773-1774, 1842-1850 (correctness)
- **What happens:** The 'Save a copy' handler (index.html:1824) swaps the live adv.title across the awaits of persistAll(newId) and never disables OK. A double-click on OK creates two copies and leaves the original's in-memory title as '... (copy)', which the next save writes to the original doc. A turn already in flight that persists inside the copy window renames the original the same way. Separately, the copy gets the newest updatedAt, so boot (2567-2568) reopens the copy and the main view never shows which adventure is open. The 'settings change' trigger is not reachable because the Adventures dialog is modal.
- **Fix:** Pass the copy title into persistAll/advDoc as a parameter instead of mutating adv.title, and guard the OK handler against re-entry (disable it or set an in-flight flag). Give the copy an updatedAt at or below the source's, or have boot prefer the last-opened id from localStorage 'windlass.last'.
- **Verified:** trace partly, repro partly

#### M7. persist() returns nothing, so callers announce success after a failed or refused save, and conflict banners are overwritten

- **Where:** `index.html` 1753-1768, 1867, 2175, 2219, 2548-2551 (ux)
- **What happens:** Core claim holds. Caveats: the wiped conflict banner is transient (it is re-offered on the next focus, visibility change, 60 s sync tick or turn), and Cast Save on a stale page does not wipe the banner, though it still shows 'Saved.'.
- **Fix:** Make persist() return true/false (or throw) and announce success only on true; keep the conflict banner from being replaced by routine status text.
- **Verified:** trace confirmed, repro partly

#### M8. A failing save, db-unavailable and export fallback are signalled only in the Summary panel's small note, which phones keep closed

- **Where:** `index.html` 2265, 1767, 295-299, 168-175, 298, 2563, 1855, 1812, 315 (ux)
- **What happens:** Core is real: persist() failures (index.html:1767) and the missing-db and export-fallback hints (2563, 1855) go only to #summaryNote inside #rail, which is display:none at <=900px (174). The turn path clears the status banner just before persist (1589-1590), so a phone player gets no banner, header indicator or retry. The export fallback is a bare <pre> (327) with no heading, instructions or Copy button. Two claims are overstated. (1) On a db-less view the Adventures dialog also shows #dbNotice, 'Saving is not available in this view...', set at 1812; only the static line 315 contradicts it. (2) A transient failure is not permanent: the next successful persist re-saves everything, so the loss claim holds only while failures persist, as in K1. K1 already notes the Summary-panel-only signal, so the new parts are the phone-hidden rail, the db-less and export-fallback cases, and line 315.
- **Fix:** On persist failure or missing db show a persistent bad status banner (or header pill) with Retry until a save succeeds; give the export fallback a heading, instructions and a Copy/select-all button inside the dialog; reword line 315 when db is null.
- **Verified:** trace partly, repro confirmed

#### M9. Export filename .slice(0, 80) cuts off '.json', so long titles always fail with rejected_extension and fall into a JSON dump

- **Where:** `index.html` 1851-1856, 1853-1855 (runtime-contract)
- **What happens:** Real: `(W.id + '-' + slug + '.json').slice(0, 80)` (index.html:1853) drops or damages the `.json` extension once the slug reaches 67 characters (all three world ids are 8 characters, so 66 still works). downloads.save then rejects with rejected_extension, and the catch at 1854 returns only for 'declined'. Every other error reveals #exportFallback with the whole JSON and the note "download unavailable", and nothing ever hides the pane again (the only references are index.html:327 and 1855), so a later successful export leaves the stale dump showing. Overstated: the threshold is a 67-character slug, not "about 65". Neither the Japanese title nor the 'Short title' case is a failure, since both save, though the Japanese one gets the name sundered--.json. The failure needs a typed or imported title of 67 or more characters; the default title is "<first> at <W.title>" and stays short. The text dump is still copyable, so nothing is lost, which makes this low rather than medium. The rate_limited double-click branch is traced statically only.
- **Fix:** Slice the slug (to about 60 chars) before appending '.json'; fall back to the text dump only for unavailable/not_granted, tell the player to retry on rate_limited, show the failure inside the dialog, and hide #exportFallback on success.
- **Verified:** trace partly, repro confirmed

#### M10. The transformation block grows without bound and the size guard cannot shrink it: turns fail with prompt_too_large once all ten kinds are complete

- **Where:** `index.html` 1129-1156 (guard at 1566) (runtime-contract)
- **What happens:** Completed kinds' finished-shape and sex-path lines (index.html:1129-1144), together with the <lore> block, grow with each completed kind. The size guard at index.html:1566 never trims either, so at about 9-10 completed kinds in a short history (earlier in a long game with ~50 facts) every turn fails with prompt_too_large. The error advises lowering the verbatim window, but the guard is already at window 1 and Settings cannot go below 2. The growth is bounded by the ten kinds, not unbounded, and a female player rolls no sex paths, so that player only just fits at 10 kinds (63.6 KB). The turn that completes the last kind succeeds and the next turn fails. The remaining workarounds are the Override state editor or Undo.
- **Fix:** Let the guard drop or compress the transformation and lore ladder text as a last resort (for completed kinds keep only the finished-shape line, and drop the sex lines once told), and change the prompt_too_large message to say the prompt is already at its minimum and name the real remedy. Also count the loreText ladder text in the lore budget.
- **Verified:** trace partly, repro confirmed

#### M11. 'Previous version' restores an already advanced state but clears the engine notes, so a started change, arc phase or progression note is never narrated

- **Where:** `index.html` 1691-1699, 1695-1697, 1694, 1538-1546, 1534, 1544 (state-engine)
- **What happens:** usePreviousVersion restores prev.stateAfter, whose track indexes, arc phases and spa/progression flags are already advanced, but sets adv.pendingNotes = [] because turn records keep only pendingBefore. The alts list is also rewritten so only the two newest versions can be reached.
- **When:** The player regenerates the turn that began a wolf change and clicks Previous version: the next prompt has no engine note, yet the transformation block lists step 0 as told, so the step is silently skipped (the world rules say never skip one); the same loses arc phases, Spa-return and progression notes. With three versions the button reads 'Previous version (2)' but only toggles between versions 2 and 3.
- **Fix:** Store pendingAfter on each turn record and restore it here; keep alts as an ordered list with a current index instead of popping and re-pushing.
- **Verified:** trace confirmed, repro confirmed

#### M12. A second sex path is rolled, announced and finished on a body that is already a woman's; spa reset of one kind erases the other's result

- **Where:** `index.html` 1008, 1081, 1102, 1137-1142 (state-engine)
- **What happens:** Confirmed as stated: sex-path rolls ignore tf.sex and other sex paths, tf.sex holds a single species and is overwritten by the last path to finish, and a spa reset of just that species deletes tf.sex and tells the narrator the sex is "as it was" although another finished path still carries the body. The only softening is that the "told twice" point is two separate finish notes, each saying "say so once". The fix must also cover paths drawn concurrently, not only the case where tf.sex is already set.
- **When:** A male or non-binary player completes the harpy path (chance 1), tf.sex is harpy; a later wolf or cow path rolls female again, the narrator is told twice that the body 'has finished going over' (although the note says to say it once), bodyNowLines keeps 'Toward a woman's body so far' for a female body, and tf.sex flips to wolf. A Spa reset of wolf alone deletes tf.sex and queues 'the body's sex is as it was' although harpy is at 100 and finished.
- **Fix:** Skip the roll and sex tracks when tf.sex is already set (or another path carries sex), set tf.sex only if absent (keep sex as a body-level fact with contributing species), and recompute it from remaining finished paths on spa reset.
- **Verified:** trace confirmed, repro confirmed

#### M13. List items silently drop the newest entries once maxItems is reached (Discoveries caps at 12, inventory at 20)

- **Where:** `index.html` 860-863 (863: slice(0, def.maxItems || 30)); worlds/sundered.js:794-797 (discoveries maxItems 12 at 797); worlds/mythaven.js:524-526 (state-engine)
- **What happens:** applyUpdates concatenates an append and then slices from the front, so once a list is full every new entry is discarded with no engine note and no diff entry. Sundered caps discoveries at 12, romances/clubs/wearing at 8 and inventory at 20.
- **When:** A long game logs finds with append; after the 12th, later finds (the Glass Orchard, the cold larder, endgame finds) never appear in the Discoveries row or the narrator's <state>, so the narrator keeps re-adding them; a 13th discovery, ninth gift or 21st item is never stored although the model believes it recorded it.
- **Fix:** Keep the newest entries (slice(-max)) or raise discoveries to ~30, and push an engine note whenever anything is trimmed.
- **Verified:** trace confirmed, repro confirmed

#### M14. Any state_updates op other than set/inc/append/remove silently becomes 'set', wiping lists

- **Where:** `index.html` 832, 841, 851, 862 (state-engine)
- **What happens:** The op is read with String(u.op || 'set').toLowerCase() and every unrecognised value falls into the set branch with no note, so for lists and 'present' the whole value is replaced by the new entry.
- **When:** A model that writes op 'add', 'push', 'delete', 'drop' (or 'append ' with a space) on inventory or present replaces the whole list with the single value ('delete' makes the removed item the only entry); on number items 'dec' with value 1 sets the item to 1.
- **Fix:** Trim and validate op against the four allowed values (optionally map add/push to append, delete/drop to remove, dec to negative inc); for anything else add an 'ignored unknown op' note and skip.
- **Verified:** trace confirmed, repro confirmed

#### M15. Override and Cast edits made during a running turn are silently reverted when that turn fails or is stopped

- **Where:** `index.html` 2173-2177, 2208-2220 (rollback at 1608) (data-loss)
- **What happens:** overrideApply() and saveCast() mutate adv.state with no busy check. When the running turn fails or is stopped, takeTurn's catch at index.html:1608 restores the pre-turn snapshot, wiping those persisted edits (attitude, skills, state replacement, and state.present renames for non-roommate characters). Cast name overrides persist while state.present reverts, which leaves them inconsistent. A turn that succeeds keeps the edits, because commitReply clones the live state at 1524.
- **When:** While a slow turn is pending the player sets an attitude in Override (status 'Override: attitude roommate = 9.', persisted); the turn then fails (upstream_error) or is stopped and memory reverts to 7; the next persist overwrites the store with 7. A Cast Save of attitude or a rename (which rewrites state.present) is lost the same way.
- **Fix:** Skip the state restore on failure when the turn never reached commitReply, since adv.state was not mutated before that point. Alternatively, disable #btnOverride and #btnCast (and their controls) while busy.
- **Verified:** trace confirmed, repro confirmed

#### M16. A save during Regenerate writes the popped turn list; a failed or stopped regenerate leaves the store one turn short while the page says 'saved'

- **Where:** `index.html` 1678-1682, 1753-1768, 2475-2479, 2417 (data-loss)
- **What happens:** Confirmed. Any persist() fired while a Regenerate is in flight (settings change, summary save, cast edit, rename, or the Override fact/event/note/state setters; applyManualReply is guarded) writes the popped, rewound snapshot. A failed or stopped regenerate restores the turn and state in the page but never re-saves, so the store stays one turn short under a "saved" note until the next successful save. A reload, or a read from another device, in that window loses the turn. Edits made to state or memory during the wait are also reverted in the page.
- **When:** Press Regenerate, change the narration tier while it waits, and the regenerate fails or is stopped: the page shows 3 turns and 'saved', the store has turnCount 2, so a reload or other device loses the last turn until the next save; a summary edit made during the wait is also silently reverted in the page.
- **Fix:** Keep the old turn in adv.turns (and the pre-regen state) until the replacement commits, or have persist() and the edit handlers refuse or queue while busy. Alternatively, call persist() after the restore in onRegenerate when !ok.
- **Verified:** trace confirmed, repro confirmed

#### M17. A reply cut off twice is committed as a normal turn with no visible warning

- **Where:** `index.html` 1583-1586, 1589, 1442-1467 (correctness)
- **What happens:** When both attempts hit the output cap, takeTurn commits the repaired partial JSON as a normal turn (index.html:1583-1586) and setStatus('') at 1589 clears the "cut off; asking once more" message. The cut is never flagged on the turn: the warn pill needs spoilers on (2329), and the notes sit in the Debug dialog, which is reachable without spoilers but only if the player thinks to open it. The "truncated, twice" error message at 1600 is effectively unreachable, because tolerantJson only returns null when the reply is cut within the first ~21 characters. The scenario text is overstated in one place: the notes are not visible only in spoiler mode. When the cut falls mid-narrative the player can see the narrative stop, and Regenerate and Undo are always available. The silent part is a cut after the narrative, which loses suggestions, state_updates, events, beats and facts with no visible sign.
- **Fix:** When the second reply is also truncated, either throw code 'truncated' so the turn rolls back with the existing message at 1600, or commit it but store a turn.truncated flag. Show a visible, non-spoiler "Reply was cut off" pill on the turn with a Regenerate button, and keep the status line text after commit.
- **Verified:** trace confirmed, repro partly

#### M18. Memory fold and length fit accept any utility-model reply (refusal, truncated text, preamble, 3,000 words)

- **Where:** `index.html` 1488-1505, 1520-1521 (data-loss)
- **What happens:** foldBeats and fitLength validate model output only minimally. Fold accepts any non-empty text as the whole long-term summary, with no length cap, no truncated check and no preamble check. Fit accepts any reply over 50 words, including a truncated, preamble-prefixed or longer-than-input reply. The folded 18 beats and 20 facts leave live memory and the original narrative is replaced. The damage is recoverable only through Undo or Regenerate of that turn, or by hand-editing the summary. The refusal-shaped case is mostly covered by the runtime's `refused` rejection, which keeps the old summary.
- **Fix:** Treat `res.truncated` as failure in both foldBeats and fitLength. Also bound the accepted length: summary under about 400 words, fit within roughly the requested band and no longer than the input. Keep the old summary and narrative when the check fails.
- **Verified:** trace partly, repro partly

#### M19. Async handlers lack in-flight guards: double-click Undo removes two turns, double-click Take turn / Ctrl+Enter leaves a stale red banner, double OK / Begin re-enter

- **Where:** `index.html` 1684-1690, 1722-1732, 1722-1723, 1669-1683, 2415, 1824, 1842-1850, 2519-2520 (state-engine)
- **What happens:** The missing in-flight guards are real: onUndo/onRegenerate/onSend pass their busy check, and a re-entered syncFromStore returns false (index.html:1723), so a second click proceeds while the first awaits the db. Most of the claimed consequences are overstated. A double-click Undo popping two turns is just two Undos, and the stale red banner after a successful turn needs a narrow timing window. The consequences I verified that matter are an unguarded persist that evaluates the turn count after its awaits, a TypeError on the last turn, Ctrl+Enter bypassing the disabled button, Begin double-click acting as 'Begin now', and double-click OK on Save a copy.
- **Fix:** Serialize the handlers: set a synchronous in-flight flag (or reuse busy) at the top of onUndo/onRegenerate/onSend/OK before any await, and have persist() capture n and the chunk slice before its first await. Disable the OK button while onOk runs, and make Ctrl+Enter honour the disabled Take turn state.
- **Verified:** trace partly, repro partly

#### M20. Player invention fires a model call with no viewer action (including on page load), superseded calls are never aborted, and a declined or disabled sample is never latched off

- **Where:** `index.html` 2000-2011, 2004, 2031, 2125, 2519-2539, 2570 (runtime-contract)
- **What happens:** Real but narrower and low severity. At first-run boot (no saves) the auto-opened creation dialog fires one unrequested, non-cacheable, random-seeded sample call (index.html:2031, 2125, 2570), which is the only call with no viewer action; New adventure and Randomise everything are viewer clicks. Superseded player-invention calls are never aborted by the page (inventPlayerFields passes no signal; only the internal 60 s timer aborts), and nothing latches sample off or updates the "Claude ready" header after not_granted or sampling_disabled. Two claims are wrong or unproven. A decline is NOT re-asked: sample.d.ts says it rejects not_granted for the rest of the view, so later calls fail at once without a new prompt. The queueing and rate_limited harm is unverified because the mock has no concurrency limit, and the stale calls are quick-tier and short.
- **Fix:** Latch sample = null (and set the connection state to bad) on the first not_granted or sampling_disabled rejection. Keep one AbortController for the player invention and abort it on reroll, preset, Begin and dialog close; optionally invent only on an explicit press or at Begin.
- **Verified:** trace partly, repro confirmed

#### M21. Cast editor Save corrupts name fields: first becomes the title, last goes stale, renames never reach {npc_*} references

- **Where:** `index.html` 2208-2220 (2213); vars() 739-745; focusNames 1263-1270 (correctness)
- **What happens:** saveCast sets first to the title for titled cast (Dean, Professor, Dr) even on an unchanged Save, which changes the Focus label and stops a renamed person's new first name from matching. Renames never reach {npc_*} references in other characters' sheets, because vars() ignores cast.overrides, so the prompt shows both the old and new name. The claim that `last` goes stale is true but has no consumer, so it has no effect.
- **Fix:** Build the {npc_*} variables in vars() from activeCharacters() so overrides apply. In saveCast, derive first/last from the name with the leading title stripped, and only when the name actually changed.
- **Verified:** trace partly, repro confirmed

#### M22. 'Reset to the world's version' does nothing for the roommate yet reports success; Reset and Remove leave a renamed character wrongly matched in state.present

- **Where:** `index.html` 2214, 2221, 2193, 2208-2226, 2196-2207 (correctness)
- **What happens:** saveCast edits the roommate in place (Object.assign(adv.roommate, ...)) rather than via cs.overrides, but resetCast only deletes cs.overrides[castSel], so Reset is a no-op for the roommate and the list never shows the edit marker. Reset on any renamed character leaves the renamed entry in state.present, and toggleRemoveCast filters state.present by the base name, so a renamed character stays present. A blank attitude field is saved as 0.
- **When:** The player renames the roommate, clicks Reset: the form still shows the edited name while the note says 'Back to the world's version.' and the original is unrecoverable from the UI. After resetting or removing a renamed NPC (Marisol -> 'Zed Edited') the character is no longer matched or stays in Present.
- **Fix:** Keep the roommate's generated original (or route roommate edits through cs.overrides) so Reset can restore it, map state.present back on reset, filter present by displayed name and aliases, and treat a blank attitude as unchanged.
- **Verified:** trace confirmed, repro confirmed

#### M23. Cast editor 'Aim' and 'Usually found' edits are silently ignored whenever the character has slot-specific text

- **Where:** `index.html` 1303-1304 (saveCast 2213; labels 441-442) (correctness)
- **What happens:** The Cast editor edits only where.default and aims.default, but buildPrompt prefers slot-specific entries, so a saved Where is ignored in every slot that has its own entry (meals, classes, evening, night) and a saved Aim is ignored in the evening slot for most characters. The Aim label says "default, any time of day"; the Where label says only "(default)".
- **When:** The player edits a character's Aim or Where and saves; in the evening (and at night for Where) the narrator still receives the authored text, so the edit appears to do nothing for much of the day.
- **Fix:** When saving, also overwrite or clear the slot-specific entries, or show an editor per slot; at minimum fix the 'any time of day' label.
- **Verified:** trace confirmed, repro confirmed

#### M24. focusNames fires on surnames/aliases that are ordinary words (Fell, Salt, Marrow, Hazel, Vane, Pike, Marsh) and shared surnames, issuing a false 'Focus' directive

- **Where:** `index.html` 1263-1271; worlds/mythaven.js:393-476 (correctness)
- **What happens:** Core claim stands as written. Minor scope notes: the full-sheet side effect is a separate, benign path at index.html:1300-1302; Ambergill-Vey maps to Pip because the Professor is a minor character outside activeCharacters. A case-sensitive fix would also drop lowercase-typed real names.
- **When:** Mythaven 'I fell asleep on the stairs' tells the narrator the action names Professor Fell, 'I pass the salt to Marisol' adds Nerissa Salt, 'I ask Professor Ambergill-Vey about the mirror' locks onto Pip, 'I ask Yuki Reyes about the bet' onto Tamsin; narration containing 'fell' or 'salt' pulls those full sheets. Generated Sundered casts draw surnames such as Fell and Marsh from pools, so it applies there too.
- **Fix:** Do not use a blanket case-sensitive match, because players type names in lowercase. Require a capitalised match only for handles that are common English words, reject a match followed by '-' plus letters (Ambergill-Vey), and prefer first name or full name over a bare surname when the surname is shared or ambiguous.
- **Verified:** trace confirmed, repro confirmed

#### M25. The personal opening paragraph is stored and sent to the narrator but never shown to the player

- **Where:** `index.html` 1229-1235, 2299-2304 (content-data)
- **What happens:** openingNarrative() prepends the premise's personal part ("You are <name>, nineteen, ...") to adv.opening.narrative. renderFeed() then shows openingTurn(), the prompt-only variant that strips that part, and the creation dialog shows only the setting half, so in Mythaven and Sundered the player never reads it. The missing text includes "only human first-year", the Sundering line, the mixer framing and Mythaven's scholarship line. Sundered's "Earlier" block does cover the glamour, letter and scholarship, and Mythaven's roommate mentions the mixer. Halloway is unaffected.
- **Fix:** Render adv.opening.narrative, which already includes the personal part, in renderFeed, and keep the stripped openingTurn() for buildPrompt and the lastLine preview only.
- **Verified:** trace partly, repro partly

#### M26. Day-1-only schedule rows recur every Monday: 'orientation (no classes on Day 1)' in the authoritative <clock> and a recurring orientation mixer in Coming days

- **Where:** `worlds/sundered.js` 627, 635; worlds/mythaven.js:363-380 (366, 374); index.html:800 (calendarLine) (content-data)
- **What happens:** Confirmed. The Monday-recurring rows 'orientation (no classes on Day 1)' (10:00) and the 19:00 'mixer ... (orientation Monday); ... (other Mondays)' are Day-1-only content. On every Monday from Day 8, the 'Now:' clock text and the player header say 'orientation (no classes on Day 1)' between 10:00 and 12:00, and the Coming-days line lists 'the mixer on the quad 19:00' because calendarLine cuts names at ' (' or ','. The 19:00 'Now:' line still shows the full alternatives, so that part is less misleading. Impact is confusing, wrong text, not a break, so low severity.
- **When:** On Day 8 (Monday) 10:30 the clock says 'Now: orientation (no classes on Day 1). Next: 12:00 lunch'; from Day 2 on the Coming days line announces 'the mixer on the quad 19:00' every Monday instead of the goblin night market, and Tuesday shows only the Moonrunners run, never the Sigil Circle. The narrator must treat the authoritative clock as truth.
- **Fix:** Delete the 10:00 orientation row, which cannot occur on Day 1 given the 17:40 start. Make the 19:00 row a neutral recurring Monday entry such as 'goblin night market and Artificers\' Guild', and cover the Day 1 mixer through the opening text and the lore entry.
- **Verified:** trace confirmed, repro confirmed

#### M27. Evening aims and where.free written for the Day-1 mixer are applied to every evening of every week

- **Where:** `worlds/mythaven.js; worlds/sundered.js` worlds/mythaven.js:281-343, 397-457 (aims.evening, wolf where.free, cow where.class2), 455-457; worlds/sundered.js:79,94,100,103,106,112-113,167,181,248,274,289 (aims.evening), 635; index.html:1303-1306 (content-data)
- **What happens:** Core claim holds: buildPrompt picks aims/where by slot name only, so about 17 Mythaven and 14 Sundered evening aim/where entries written for the Day-1 mixer (cory, hazel, priya, bexley, marisol, the stall, warren and creamery roles, most roommate species) are sent as 'Aim now' on every later evening, contradicting the authoritative clock. The wolf where.free contradiction is limited to the Day-1 17:40 opening, and the cow class2 issue is a minor mismatch with 'three afternoons a week'.
- **When:** On Day 4/5/9 evenings the narrator is told Cory's aim is to 'skip the mixer', Hazel's to 'watch the mixer from the edge of the quad', Priya's to give the leaflet 'at the mixer', the Sundered stall goblin to strike a bargain and the warren rabbit to find the player 'at the mixer'; human_society's where reads 'the mixer only to hand out leaflets' on other nights, and Turn 1 says 'Now: the Moon Field' while state.present puts the wolf in 4B. The narrator is pushed to restage a one-night event.
- **Fix:** Make aims.evening event-neutral (move the Day-1 mixer behaviour into the opening beats, facts or the mixer lore entry), and give the wolf no where.free or 'room 4B, or the Moon Field later'. Add an 'otherwise' place to human_society's where.evening, and optionally key aims on weekday or day as well as slot.
- **Verified:** trace confirmed

#### M28. Mythaven rules still carry Sundered Isle setting text (cliff path, cloud below, cloud ferry, bricked doors, closed places)

- **Where:** `worlds/mythaven.js` 22, 31 (content-data)
- **What happens:** Confirmed. Mythaven's rules at worlds/mythaven.js:31 (and "a closed place opening" at line 22) are copied from the Sundered Isle file and describe an Isle with a cliff path, cloud below, a cloud ferry and bricked doors. They contradict Mythaven's own lakeside campus outside a human city, so every Mythaven prompt contains an undefined "Isle" and contradictory setting instructions. The 'lake town' wording at line 26 is only loosely supported by Mythaven's town references and is optional to change.
- **When:** Every Mythaven prompt carries these phrases, steering the narrator to put cliff rails, cloud below and a cloud ferry beside a lakeshore campus and to use bricked doors and closed places the world never defines; it contradicts world[0] (line 42) and the 'contradict nothing in <facts>' rule cannot resolve it.
- **Fix:** Rewrite line 31 for the lake campus (lake weather, the road or bus to the city) and delete 'a closed place opening' from line 22; replace or define 'a lake town' in the Themes rule (line 26).
- **Verified:** trace confirmed, repro confirmed

#### M29. Clicking the 'Two things you are good at' label re-rolls the player's strengths

- **Where:** `index.html` 345, 2028 (ux)
- **What happens:** Confirmed as stated. The Random button sits inside a for-less label (index.html:345), so clicking the caption or the empty part of the full-width label row re-rolls strengths and weakness via the handler at index.html:2499 and randomField at index.html:2114-2119. The cited line 2028 is wrong. The checkbox group also has no group name.
- **When:** A player carefully picks two strengths and a weakness, then taps the caption: the choices change at random without any prompt and focus jumps to Random.
- **Fix:** Move the Random button out of the label, for example into a sibling .row with a plain span or legend caption. Make #cStrengths a fieldset or role=group with aria-labelledby pointing at the caption.
- **Verified:** trace confirmed, repro confirmed

#### M30. Halloway reach-salt code flag is never explained to the model, and the fever-break note misfires for salt fevers

- **Where:** `worlds/halloway.js` 26, 39, 246-248; index.html:898 (state-engine)
- **What happens:** salt_taken_this_turn appears in the model prompt only as a key inside <state>; no rule or <progression> text says to set it, and the Attunement rule sends the model to <progression> for triggers although they are in <world>, which says reach-salt gives +30 to 40 progress. When the flag is set, the 3-day salt fever ends with 'Describe the new Stage N marks' although no stage changed.
- **When:** A model that follows <world> sets attunement_progress +35 itself: the engine caps it at +12 and no fever starts. If the flag is set at Stage 0, day 6 tells the narrator to describe 'the new Stage 0 marks (No kin. Ordinary senses.)'.
- **Fix:** Add a rule telling the model to set flags.salt_taken_this_turn the turn salt is swallowed and never add the progress itself; make the fever-break note ask for marks only when the stage actually advanced.
- **Verified:** trace confirmed, repro confirmed

### Low

#### L1. Failed import replaces the live adventure and world before validating, so a malformed save breaks the page and can poison the next boot

- **Where:** `index.html` 1857-1869 (setWorld 1863, adv assignment 1864, adv.memory.facts 1866), 1862 (robustness)
- **What happens:** importFile switches the world and replaces the in-memory adventure before validating state and memory, so a hand-edited file with the right format tag but no state or memory reports "Import failed" and leaves a broken current adventure (render errors, switched world title). Stored data is untouched, and reload or reopening Adventures and pressing Continue recovers it. Only an additional Settings change on the broken page writes a state-less doc that makes the next boot's auto-load fail, and that step is not verified against the real runtime.
- **Fix:** Build the new adventure and world into locals, validate them (own-property world check, object-typed state and memory, tier whitelist) and only then call setWorld and assign adv, restoring the previous values on any throw. Have boot fall back to the next-newest save when the newest fails to load.
- **Verified:** trace partly, repro partly (reported as medium)

#### L2. Adventure id is taken from the doc body, not the document path: one doc can overwrite or delete another adventure

- **Where:** `index.html` 1784, 1817-1829, 1759, 1703 (data-loss)
- **What happens:** The page trusts the body `id` over the document path (index.html:1784, 1819-1829, 1759), so any adventures/* doc whose body id differs from its path redirects later saves and Delete to the other adventure. The page itself never produces such a doc, and anyone who can write the doc can already write or delete the target directly, so this is a missing path/body consistency check for externally written or damaged docs, not an escalation.
- **Fix:** In loadAdventure, listAdventures and boot, use the snapshot id (d.id of the DocumentSnapshot) as the adventure id. Ignore the body id, or skip docs where it differs from the path.
- **Verified:** trace partly, repro partly (reported as medium)

#### L3. Saves, presets and recents live in shared top-level collections; boot opens the newest save written by any viewer

- **Where:** `index.html` 2567-2569, 1759, 1814, 2130, 1928 (runtime-contract)
- **What happens:** Windlass keeps every save, preset and recents document in shared root collections (no data/users or user capability). That matches the single-owner, multi-device design the code comments describe, but once the artifact is shared, a second viewer's saves mix with the owner's. Boot opens whichever save was written last by anyone, a second viewer lands in and edits the first viewer's adventure, and a view-only member's saves all fail with 'save failed: invalid_argument'. This is a latent limitation of a platform default, not a runtime-contract violation. It only bites when the owner shares the page, so low severity.
- **Fix:** If shared use is intended, store each viewer's saves under data/users/<id>/ (declare user, await user.id()). Otherwise record in the page that it is a single-viewer app.
- **Verified:** trace partly, repro partly (reported as medium)

#### L4. 'Body now' drops the sex lines already told for a rung when its sex track ends, until the body track settles

- **Where:** `index.html` 1137 (tracks removed at 1084) (state-engine)
- **What happens:** Told sex-track lines for the rung in progress are missing from the 'Body now' continuity block between the end of the 1-2 step sex track (removed at index.html:1084) and the settling of the 5-9 step body track. This affects rungs 2-4 on any sex-path run and lasts about 4-6 prompts, so only prompt-level continuity is affected. The recent-turns window and beats partly cover the first prompts of the gap, so this is low severity rather than medium.
- **Fix:** In bodyNowLines, when a body trait at position n is unsettled and no sex track remains for that species, also list sp.ladder[n].sex (all of it, since the track has finished); or mark the sex track done (t.done) instead of filtering it out at :1084 until its body sibling settles.
- **Verified:** trace partly, repro partly (reported as medium)

#### L5. Stop is shown but inert during the roommate introduction and memory fold, and Stop during length fit still commits the turn

- **Where:** `index.html` 2414, 2266, 1641-1668, 1644-1658, 1494-1505, 1501, 1517-1522, 1520-1521, 1549 (ux)
- **What happens:** Stop is visible but does nothing during the Begin roommate introduction (index.html:1641-1667 has no AbortController and passes no signal at 1658; the handler at 2414 is `if (ctl) ctl.abort()` and ctl is null there) and during the memory fold (1501 passes no signal). Stop during length fitting is treated as a failed fit (1521) and the turn is committed unfitted, with no 'Stopped.' message. This is a Stop-button UX inconsistency, not a data-loss or stuck-UI defect.
- **Fix:** In writeRoommateIntro, create a controller, set it as ctl and pass its signal, so Stop works. In commitReply, when the fit fails with code 'cancelled', either rethrow so takeTurn shows 'Stopped.' and rolls back, or say explicitly that the unfitted turn was kept. Pass ctl.signal to foldBeats, or hide Stop during the fold.
- **Verified:** trace partly, repro partly (reported as medium)

#### L6. 60 s page-side invention timer also counts consent and queue time, and Begin fires six simultaneous batch calls

- **Where:** `index.html` 1936, 1942-1976, 1944-1948, 1963, 2528, 2518, 2519-2539 (runtime-contract)
- **What happens:** inventCall starts a 60 s page-side timer (index.html:1946) before the runtime admits the call, which sample.d.ts says not to do, and Begin on the Sundered Isle sends six simultaneous 5-person batches (28 slots, 1946/1970). If the runtime runs only about two calls at once and each call takes about 20 s or more, or inventTier is set to default/complex, the queued batches are aborted at 60 s and those people are drawn from the pools. The consent-dialog scenario is largely unreachable because the first sample call fires at dialog open, the fallback is announced in the UI, and the effect is a graceful loss of invented flavour with no data loss. Only Sundered has genPools, and rate_limited is unverified.
- **Fix:** Start the 60 s timer from the first onText (or drop it and rely on Stop and Begin now), and run invention batches at most two at a time.
- **Verified:** trace partly, repro partly (reported as medium)

#### L7. No window.claude (saved copy or other host) or a declined sample leaves the UI on 'connecting' / 'Claude ready' with no message

- **Where:** `index.html` 2258-2264, 2260, 2559-2562, 2561, 2559, 1596-1605 (runtime-contract)
- **What happens:** If window.claude is undefined, connectSample() (index.html:2260) and the boot IIFE (2561-2562) call window.claude.use() unguarded. Both reject, so the header stays on 'connecting' with Send disabled, no status line, no saves-unavailable note, and two unhandled rejections. This is reachable only when a complete copy of the page, including its worlds/*.js files, runs outside the platform. A bare saved .html hits 'No world file loaded.' at 2491 first. A declined consent is a separate, milder issue: the header stays 'Claude ready' and Take turn stays enabled, but every attempt does show a message ('This page is not allowed to use Claude in this view.' at 1601, or a roommate-intro note naming not_granted), so 'no message' is wrong for that case.
- **Fix:** Wrap both use() calls in a guard (`window.claude && typeof window.claude.use === 'function'`, plus try/catch) and route failure to the existing 'Claude unavailable' / 'saves unavailable' path. On a hide-class code, flip the badge to bad, disable the sample-dependent buttons, and drop the 'Play on.' wording.
- **Verified:** trace partly, repro partly (reported as medium)

#### L8. Lore keys match as raw substrings, so short keys fire on ordinary words ('ring', 'bet', 'tree', 'war', 'pack', 'cow', 'spa', 'pen', 'Hale', 'salt')

- **Where:** `index.html` 1183-1190 (1187); worlds/halloway.js:171-195; worlds/mythaven.js:482-511; worlds/sundered.js:673-690 (correctness)
- **What happens:** Bare lore keys are matched with hay.includes(kk) (index.html:1187) and only '*' keys get a \b boundary, so short keys fire inside unrelated words in all three worlds (ring in morning/during/stringing, bet in between, tree in street, war in toward/warm, pack in unpack/backpack, cow in coward/scowl, cream in screamed, spa in space, pen in open, Hale in exhale, inn in beginning/dinner). The effect is prompt noise (a spurious 700-1,100-char entry on most turns in Sundered) and occasional displacement of the lowest-priority entry under the budget; it is not state corruption. Overstated parts: several listed examples are whole-word hits of ambiguous keys ('salt', 'ring', 'bet', 'tree', 'pen' as ordinary words) that a word boundary would not fix. The authored openings carry only one spurious entry each: fairy via 'stringing' in Sundered and Mythaven, sea stairs via 'low water' in 'shallow water' in Halloway. 'wolf from half-unpacked' came from the mock roommate intro. 'Edge from ledge' is harmless because that entry also fires on cloud/bell/wall/tower.
- **Fix:** Match bare keys with a word boundary (`\b` + escaped key + `\b`, keeping '*' for prefixes). Re-key genuinely ambiguous words ('ring', 'bet', 'tree', 'pen', 'salt', 'inn', 'shed') as phrases or add '*' where a prefix match was intended (e.g. 'cave*').
- **Verified:** trace partly (reported as medium)

#### L9. Halloway premise starts with 'You are {name}', so the creation dialog shows a raw {name} and the invention prompt carries the wrong world's text and another adventure's player name

- **Where:** `index.html` 1228, 1229, 2018, 1886-1909 (1889, 1893), 2000-2004; worlds/halloway.js:13 (content-data)
- **What happens:** Halloway's premise has no '. You are ' split point (halloway.js:13 starts with 'You are {name}'), so premiseParts() (index.html:1228) returns the whole unfilled premise as 'setting'. The creation dialog therefore shows a literal '{name}' (index.html:2018), and inventPrompt (1889) fills the premise from the loaded adventure's player, so the Halloway player-invention prompt says 'You are Alex Rowan'. inventPrompt also always emits the hard-coded Mythaven University course sentence (1893) and empty 'in the manner of: .' lists for worlds without genPools. These are real but cosmetic or prompt-quality defects. The 'bleed' into Halloway output is speculative, and the '{first}' background sub-claim is wrong for Halloway.
- **Fix:** Open Halloway's premise with a setting sentence, or split on /^You are |\. You are / and show a filled or neutral setting. Build the invention setting from the creation world's own premise (not the loaded adventure's vars), and emit the course rule only when the slot asks for 'course' and the world has genPools.courses.
- **Verified:** trace partly, repro partly (reported as medium)

#### L10. Typed (custom) or non-binary roommate gets broken intro text: 'they says', 'they does', 'Looks: .', 'a elf'

- **Where:** `index.html` 626-630, 677-694, 1653-1654, 583; worlds/mythaven.js:280 (_generic.intro) (content-data)
- **What happens:** A typed (custom-species) roommate set to non-binary gets 'they does not explain' and 'they says' in the templated Mythaven Turn 0, which is never rewritten. The same 'they says' appears in Sundered's composeIntro fallback, which shows only when the narrator intro is not written (sample unavailable, declined or failed) or while it is being written. 'Looks: .' and 'a elf' occur only in the narrator prompt (index.html:1653-1654), not in player-facing text.
- **Fix:** Use agreement tokens in both intros ('{rm_they} say{rm_s}', '{rm_they} {rm_do} not explain') and drop the Looks clause (or the a/an article) from the prompt when g.looks is empty.
- **Verified:** trace partly, repro partly (reported as medium)

#### L11. Typed roommate species is matched by substring, so unrelated words get a species template ('Chimera'/'Merlin' -> Merfolk, 'Coward' -> Bovine, 'a' -> Harpy)

- **Where:** `index.html` 536-541, 539 (correctness)
- **What happens:** Confirmed as stated. One qualification: the replacement is not entirely silent, because the #cRmNote line shows the matched template ("Full template: Merfolk." / "Known species: Merfolk."), but a user cannot keep the typed word as a custom species unless they respell it.
- **When:** Typing 'Chimera' (the Dean's own kind), 'Merlin' or 'Hammerhead' reports 'Full template: Merfolk' / 'Known species: Merfolk' and Begin builds a Merfolk roommate with gills; 'cattle' gives a cat, 'Coward' Bovine, 'Catfish' Cat, 'Cowardly lion' Bovine; the custom species is silently replaced.
- **Fix:** Match only exact key, name or short (case-insensitive), or whole words, and drop the `nm.includes(t)` and `t.includes(k)` substring branches.
- **Verified:** trace confirmed

#### L12. Creation dialog: stale roommate fields leak into other worlds' presets, and loadPresets has no stale-result guard

- **Where:** `index.html` 2128-2132 (ux)
- **What happens:** The preset name and stored preset choices in Halloway carry the previous roommate world's species, with no typing needed, because randomAll fills a species in every Sundered/Mythaven dialog and openCreate never clears it for Halloway. loadPresets also has no stale-result guard, so a slow earlier read can overwrite a later world's dropdown with the wrong world's presets. The first is cosmetic and data-pollution only (Begin ignores it); the second is rare (needs a slow db read plus a quick close and reopen).
- **When:** Halloway default preset name reads 'Bavemjj Worrowxim · Werewolf roommate'; the Halloway dialog lists 'My preset' saved in Sundered.
- **Fix:** Reset #cRmSpecies, #cRmGender and #cRmName unconditionally in openCreate (or skip rm* in creationChoices when the world has no roommate). Take a monotonically increasing token at the top of loadPresets and drop the result if it no longer matches.
- **Verified:** trace confirmed

#### L13. logFailure keys documents by Date.now() base36: same-millisecond failures collide, and records are filed under a never-saved or previous adventure

- **Where:** `index.html` 1421-1425, 1424, 1960, 1963-1964, 1969-1976 (runtime-contract)
- **What happens:** Core claims hold. logFailure (index.html:1424) keys docs by Date.now() base36 and fires them without awaiting, so parallel invention failures write one doc concurrently, which breaks the db.d.ts rule of one write at a time per document and loses records to last-writer-wins. Begin invents before newAdventure() (index.html:2530 vs 2535), so on first run the docs sit under the never-saved boot placeholder id, with no parent doc and nothing that deletes them. Otherwise they sit under whichever adventure was loaded before. Two statements are weaker than written. The 5,000-document quota is only theoretically affected, and collisions actually reduce the doc count. That nothing reads the docs back is by design: the comment at 1420 says they are kept for diagnosis.
- **When:** A rate_limited flood on Begin yields 7 failed calls but only 2-4 stored records, plus overlapping-writes; surviving records sit under adventures/<placeholder>/failures with no parent doc, which the delete flow never removes and which spend the shared 5,000-document quota; a viewer who declines consent leaves docs the same way.
- **Fix:** Add a counter or random suffix to the failure doc id, skip db logging when no adventure is persisted or the code is not_granted/rate_limited, cap the log, and pass tier/bytes through extra.
- **Verified:** trace confirmed

#### L14. Boot: a failed adventures query reads as 'no saves yet', and the windlass.last fallback is dead

- **Where:** `index.html` 1804, 2557, 2564-2570, 2567 (robustness)
- **What happens:** The windlass.last fallback at index.html:2569 can never find a real save, because the boot-time newAdventure() (2557, via 1804) overwrites that key with a throwaway id first. As a result, when only the ordered adventures query fails (for example a one-off transient 'unavailable' on the first db call, with no retry) while the later doc get succeeds, boot says 'no saves yet' and opens the create dialog, although the saves are still reachable through Adventures. A failure that also hits the doc get is reported correctly as 'could not load saves: <code>'. Boot also tries only the newest save, but it does report that load failure.
- **Fix:** Read windlass.last before the first newAdventure(), or do not write it for an unsaved boot adventure. Retry the query once on 'unavailable', as db.d.ts advises, and report the failure instead of swallowing it.
- **Verified:** trace partly

#### L15. Unsaved edits in the Summary box are silently overwritten by the next render

- **Where:** `index.html` 2385, 2417 (data-loss)
- **What happens:** renderRail() resets #summary from adv.memory.summary whenever the box is not focused, and nothing marks an edit as unsaved.
- **When:** A player edits the summary to steer the narrator, clicks into the action box and takes a turn: renderAll() puts the stored text back, so the edit vanishes and the turn used the old summary. Only an explicit Save summary click keeps it.
- **Fix:** Track a dirty flag on input and skip the reset while dirty, or save the summary on blur and before Take turn.
- **Verified:** trace confirmed

#### L16. Failure of a Regenerate/turn flow: success clears the action and director boxes the player was drafting

- **Where:** `index.html` 1588, 1681 (ux)
- **What happens:** takeTurn clears #action and #director at index.html:1588 on every successful turn, including regenerations and any normal Send during which the player typed a new draft, because the textareas are not disabled while busy. So a next-action or director draft is lost whenever a turn completes after it was typed.
- **When:** Player types the next action and a director note, then presses Regenerate on the last turn: when it finishes both boxes are empty and the draft is lost.
- **Fix:** Snapshot the two box values when the turn starts and clear them at 1588 only if they still equal that snapshot. Regenerate then keeps the drafts, and text typed while a reply streams survives.
- **Verified:** trace confirmed

#### L17. Valid JSON without a narrative is never retried and the error says 'twice'; non-object JSON surfaces as a page error

- **Where:** `index.html` 1575-1585, 1513, 1599, 1467 (correctness)
- **What happens:** The one automatic retry fires only when the reply cannot be parsed, so {}, {"error":...} or {"narrative":""} fail after one call while the message claims two; a top-level number, string or true reaches normaliseReply and crashes on the 'in' operator.
- **When:** One sample call followed by 'The reply was not usable, twice.'; for a reply of 5, 'hello there' or true: "Page error: Cannot use 'in' operator to search for 'exposures' in 5 (see Debug)." and no retry.
- **Fix:** Treat a parsed value that is not an object with a non-empty string narrative as unusable and retry once; word the message from the real attempt count.
- **Verified:** trace confirmed

#### L18. Override 'Apply as turn' leaves the 'folding memory…' status banner up indefinitely

- **Where:** `index.html` 1549, 1616-1631 (correctness)
- **What happens:** commitReply sets the status to 'folding memory…' when sample is connected, but applyManualReply never clears it as takeTurn does.
- **When:** A tester applies a crafted reply through Override: the turn is committed but the action bar keeps showing 'folding memory…' as if work were still running until some other status replaces it.
- **Fix:** Call setStatus('') in applyManualReply's finally (or right after commitReply returns), matching takeTurn. A single setStatus('') at the end of commitReply's fold step would also cover both callers.
- **Verified:** trace confirmed

#### L19. Small Halloway continuity contradictions: Ines's months, 'all' vs 'most' Wardens, separation rule, 'first Working' label, Marsh absent at arrival

- **Where:** `worlds/halloway.js` 39, 40, 55, 98, 125, 138, 184, 230 (content-data)
- **What happens:** Small Halloway content inconsistencies: Marsh's default location ("her rooms in the Wardens' house", halloway.js:125) contradicts the Turn 0 text and timeline showing her on the steps at 09:10 Day 1; the Mon/Wed/Fri bell is labelled "first Working" in the clock (line 98) though the matching "first Working" is a one-off on Day 3; "all deep-turned" (line 40) vs "Most Wardens are Stage 4" (line 55); Ines "Stage 3 in fourteen months" (line 138) for a second-year who has been bonded at most ~12 months at term start. The kin-separation wording (lines 39 vs 184) is not a real contradiction, and omitting Marsh from present is arguably intentional.
- **Fix:** Fix each line (months, all/most, separation wording), rename the bell 'Working', and add Marsh to present with a front-court where for the arrival slot.
- **Verified:** trace partly

#### L20. The Dean's secret is written into her role text and shown in the Cast dialog with spoilers off

- **Where:** `worlds/sundered.js` 114 (also 732, 761); index.html:2203, 1306 (content-data)
- **What happens:** castRoles.dean.role (sundered.js:114) duplicates the Dean's GM-only secret ("human once", the letters come from her office) into an ordinary <characters> brief, outside <gm_only>. The Cast dialog shows that text, but it is a deliberate as-the-narrator-reads-it editor, and the equally ungated Debug dialog already shows the full <gm_only> block. The defect is only that the secret is duplicated into a non-GM-only section; it is not a spoiler-toggle bypass specific to Cast.
- **Fix:** Delete the "human once, long ago, though nobody knows it; the letters ... come from her office" clause from the Dean's role, since secrets.keeper already carries it. If the spoiler toggle is meant to guard player-visible dialogs, gate Debug and Cast together rather than Cast alone.
- **Verified:** trace partly (reported as medium)

#### L21. Drawn cast gender and pronouns are never given to the narrator

- **Where:** `index.html` 1306, 657, 626-630 (correctness)
- **What happens:** For the Sundered Isle generated cast, a person's drawn gender and pronouns are not written into <characters> (index.html:1306 emits only name, race, key, sheet or brief, looks and aims) or the minor line (index.html:673). For the human cast and minors, who have no body-gender text, the narrator often gets no gendered pronoun at all, so a drawn non-binary person is rendered by guesswork. It is not "never" and not "many people" in general. Most non-human people in a full entry get a cue from pool text, and the composeIntro "they says" slip needs a custom roommate species, a non-binary roommate and the fallback intro.
- **Fix:** Append the drawn pronouns to each <characters> entry and minor line, as <player> already does, e.g. "(they/them)". Use agreement tokens ({s}/{are}) in composeIntro, and make the runner_human default aim use the person's pronouns.
- **Verified:** trace partly (reported as medium)

### Nit

#### N1. Dungeon fragments assume a fixed clearing order, and the 'seventh door' contradicts the Keel entrance

- **Where:** `worlds/sundered.js` 742-772, 772, 776 (content-data)
- **What happens:** Fragments are released in fixed W.dungeons order filtered by cleared flags (index.html:1313), with no ordering between places, yet some read as a numbered sequence ('There were seven', 'the sages', 'The seventh door opens the Keel'). That is real but cosmetic: the narrator always has the gm_only truth explaining the sages, the seven places and the Keel, and 'seventh door' reads naturally as 'the last door passed', so there is no hard contradiction with the Bell Cellar stair in worlds/sundered.js:776.
- **Fix:** Optionally reword the Sloth fragment to 'When all seven are passed, the Keel opens', and make the first fragments name the sages so each stands alone; no engine change needed.
- **Verified:** trace partly (reported as low)

#### N2. secrets.rule refers to a 'partial' section that does not exist

- **Where:** `worlds/sundered.js` 710 (content-data)
- **What happens:** sundered.js:710 points the narrator to a 'partial' section that this world never defines (the engine emits it only if secrets.partial exists, index.html:1250), but the surrounding prompt text (the gm_only note attribute, the line "no character knows it except the one it names", and the keeper block) already names the Dean as the sole exception, so the dangling clause is a harmless wording leftover.
- **Fix:** Change the clause to "except the keeper named below".
- **Verified:** trace partly (reported as low)

#### N3. Sundered opening event is time-stamped 17:45, five minutes after the clock the game starts on

- **Where:** `worlds/sundered.js` 836 (content-data)
- **What happens:** Both sundered.js:836 and mythaven.js:570 seed an opening timeline event stamped 17:45, five minutes ahead of the 17:40 start clock. Turn 1 and the player's timeline rail show a future-dated entry. The offer is already narrated in turn 0, so the effect is cosmetic (a nit), not a narrator-contradiction risk.
- **Fix:** Stamp the opening event 17:40 in both sundered.js and mythaven.js, or start both worlds' initialState.time at 17:45 (then the 17:40 seed event stays in the past).
- **Verified:** trace partly (reported as low)

#### N4. Exemplar 4 has a dangling 'either'; exemplar 1 and the bus background use antlers for a kind that does not exist

- **Where:** `worlds/sundered.js` 781, 784, 64 (content-data)
- **What happens:** The 'bus' background (sundered.js:64) and exemplar 1 (line 781) use antlers, but no listed kind has them; only the one-off chimera Dean does (lines 303-304, 701), and cows have horns. This is a minor lore inconsistency. Exemplars are labelled "do not reuse the content", so the claimed risk of invented antlered students is speculative. The "dangling either" in exemplar 4 (line 784) is a stylistic quirk, not a defect.
- **Fix:** If kept at all, change the bus background to a listed kind's feature, such as a goblin's ears or a bovine mythkin's horns under the hat. Leave the exemplar 'either' alone, or change it to 'which is not a question' for tidiness.
- **Verified:** trace partly

## Refuted

- Glutton guardian 'does not let go' conflicts with the rule that the player can always leave (nit)

## Not verified

These were reported by a reviewer but the verification step did not run. Treat them as likely but unconfirmed. Full details for each are in `merged-findings.json` next to this file.

- **medium** A long unbroken token (URL, scream, long name) widens the story column and causes horizontal page scroll on phones
- **medium** No live regions anywhere: status, errors, turn progress and new narration are silent to screen readers; several controls and all dialogs are unnamed; the tucked action bar stays focusable
- **medium** Phone Character sheet overlay has no focus management or modal semantics
- **medium** Mythaven hard-codes the default player name 'Alex' in an NPC sheet and a lore entry
- **medium** Random player names collide with authored and generated NPC names; the used-name set ignores the player
- **medium** Generic Mythaven roommate names collide with fixed cast and mislabel them in the Present list
- **medium** Opening seed text asserts details that are false for some roommates: 'offers to walk {first} to the mixer' (cat refuses) and 'by the inland bus' for every background
- **medium** Professor Fell's sheet and slot locations contradict the timetable and lore
- **medium** Priya's aim and sheet make her warn the player, which rule 17 and the humans lore forbid
- **medium** Day-3 kin match never reaches Stage 1: stage stays 0 (No kin) and the nightly +1 never fires
- **medium** Rule 'Humans are rare / only human first-year' was copied from the mythkin worlds and contradicts Halloway's own cast
- **medium** Authored Halloway characters have no aliases or first name, so first-name actions never get Focus and full sheets stay off
- **medium** A Halloway character's sheet replaces its brief, so appearance written only in the brief vanishes whenever the character is on the page
- **medium** where.class1/class2 slots contradict the timetable in Sundered
- **medium** Role-agnostic want/private pools contradict the role they are attached to
- **low** Adventure id / persist(): not serialised, so quick repeated actions overlap writes to the same document
- **low** Failure-log documents are unbounded, deleting an adventure removes only 100 of them, and the list shows only 50 adventures
- **low** At 150 s the page says it is still waiting for the first word even when text has been streaming
- **low** Null or non-string model values leak as '[object Object]', 'null' and 'undefined', and null/empty coercion corrupts numbers, flags and time
- **low** Exposure normalisation silently drops contacts: only 6 entries kept, no trimming, no species aliases
- **low** 'told so far' lists the step or finished anatomy in the same prompt that asks the narrator to tell it for the first time
- **low** Completion notes hand the narrator placeholder anatomy ('As above, complete.', 'Nothing shows yet'), while bodyNowLines drops real content after 'As above'
- **low** Mythaven arcs advance one phase per turn, ignoring story time and the Pace setting
- **low** Widened word band lands on the first-sensation turn instead of the finding turn (Mythaven arcs)
- **low** Kind keys from custom or edited races render as 'Frost_giant' and ignore a Cast-editor race change
- **low** Lore budget counts raw text length but the prompt emits the longer rendered text
- **low** Size-guard note prints 'undefined older beats'
- **low** A cast member removed in the Cast dialog still appears in <state> attitudes
- **low** Invented-name validation lets spaces into the first name (splitting first/last wrongly) and rejects typographic apostrophes
- **low** inventCall error paths: unhandled rejection on early abort, partial text discarded on upstream_error, truncation labelled 'stopped'
- **low** Invented player background keeps 'You' / 'your' when the model ignores {first}
- **low** meta/recent is trusted: a wrong-shaped doc breaks creation and its text goes verbatim into model prompts
- **low** Prototype-chain names (constructor, toString, __proto__) pass the in-checks for state keys and roll stats
- **low** Quadratic regex on unbounded present-name strings can freeze the page
- **low** Rename/Save-a-copy inline row overflows the Adventures dialog on phones and renders in error red
- **low** Inline rename/copy field has no accessible name, row buttons are ambiguous, and Enter does not confirm
- **low** Phone: tapped suggestion is clipped in the action box and the box never resets after sending (growAction only runs on input events)
- **low** Phone header truncates the clock, hiding the time of day
- **low** Colour-contrast shortfalls: light-theme muted and warn text, dark-theme placeholders, combo focus
- **low** Dialog Close button scrolls out of view; dialogs reopen at the old scroll position
- **low** Top bar wraps to three rows on common laptop sizes, leaving about half the viewport for the story
- **low** {rm_species} is a plural group noun (or raw typed text) used as a singular label in memory, beats, facts and lore
- **low** Hopes starting with 'to' produce 'hopes, in time, for to ...'; three hopes are never shown; aims run into 'Attitude to ...'
- **low** Generated Looks and role text start sentences in lower case or read badly once filled ({colour}, detail, harpy variant, flattened {npc_*})
- **low** Templated player text breaks for some creation choices: 'Not reads people well.' and 'Cass. Cass.'
- **low** Mythaven species lore hand-writes a 'Ladder:' (and a harpy sex rule) the engine already appends; roommateGen is dead data; the 'order of their own' claim is false
- **low** Mythaven continuity contradictions between entries (Kettle Hall, choir lead, 'campus's three' foxes, Marisol dropped but referenced, Nettle/Fennick)
- **low** Pip's age is left unstated while she is child-sized and cast as a romantic rival
- **low** Ladder rungs for wolf, cat and fox (85) contradict the prompt's 'human-faced, shift only at will' rules
- **low** Final-rung traits (100) are epithets, but the arc engine frames every rung as 'only a first sensation... without naming it'
- **low** Female-form rungs (cow, harpy, fox 85) are applied to every player with no sexChange data, tracking or pronoun guard
- **low** Halloway exemplars hard-code the default surname 'Calloway' and show a Stage 1 bond sensation to a Stage 0 player
- **low** Content safety: 'kitchen boy' has no stated age in a cast that is otherwise adult
- **low** Ferry facts conflict: seeded 15:00/16:30 sailing vs 'seven and seventeen bells', crossing length, and which side Sallow Pier is on
- **low** Species-wide roommate text contradicts the randomly drawn course and room (and Kettle Hall's 'first-year' label)
- **low** Age-ambiguous wording ('goblin child', 'a girl with gills') in a world whose rules say everyone is an adult
- **low** Hard-coded verb after a they-pronoun in Sundered text: 'They ... has just met' and 'they thinks'
- **low** Seeded Spa fact is shown to the player although the rules say the Spa is mentioned only if asked
- **nit** A skill at the 15-point cap still reports '+1 point', a 15 -> 15 diff and '0/3 to next level'
- **nit** Prompt text glitches: 'Fields, in this order:,', missing separator before 'Attitude to', and a false 'order of their own' claim for Mythaven
