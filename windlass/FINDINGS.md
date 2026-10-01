# Windlass Review Findings

Full results of the 218-agent multi-agent review of the Windlass artifact (`windlass/index.html` plus `windlass/worlds/*.js`): 122 merged findings, 61 confirmed, 1 refuted, 0 disputed.

The 1 critical and 7 high-severity confirmed findings have all been fixed in this repository (marked **Fixed** below). Medium/low/nit findings are recorded here for later triage but have not been addressed yet.

## CRITICAL (1)

### Saving silently stops working after roughly 40 turns: a 10-turn chunk document outgrows the 256 KiB db limit

- **File/lines:** index.html : 1538-1546 (turn record), 1753-1768 (persist), 1702-1704 (advDoc); 1016-1017 (tf tracks cloned into snapshots)
- **Category:** data-loss
- **Confidence:** high

Every stored turn embeds stateBefore, stateAfter, memBefore (a full copy of the memory incl. up to 600 events), pendingBefore and all regenerated alts; persist() writes 10 turns per document, so a chunk grows past 262,144 bytes and set() rejects invalid_argument. Transformation tracks keep their full drawn step texts in state.tf.tracks and every turn clones the whole state twice, which brings the failure forward to turn ~20 (or ~10 with six tracks).

**Suggested fix:** Store only what is needed per turn (drop memBefore/stateBefore or store diffs/hashes), keep track step texts out of per-turn snapshots (store indexes and look text up from world data), size chunks by bytes not by count of 10, and surface a persistent save-failed banner.

## HIGH (7)

### Import writes only the last chunk of turns to the store, so an imported adventure loses its earlier turns on reload — **Fixed**

- **File/lines:** index.html : 1857-1869 (importFile), 1753-1768 (persist), 1769-1775 (persistAll)
- **Category:** data-loss
- **Confidence:** high

importFile() builds a new adventure with all imported turns, then calls persist(), which writes the adventure doc and only the final 10-turn chunk. persistAll() (which writes every chunk) is not used.

**Suggested fix:** Call persistAll(adv.id) after import (and verify with a read-back).

### An in-flight turn (or roommate intro) is committed into whichever adventure is loaded when the reply arrives — **Fixed**

- **File/lines:** index.html : 1552-1614 (takeTurn/commitReply, rollback at 1608); 1641-1667 (writeRoommateIntro); 1776-1790; 1822 (Continue); 1830-1833 (delete-current); 1857-1869 (Import); 2266 (setBusyUI); 2481, 2519-2539, 2535 (New adventure/Begin); 2557-2569 (boot)
- **Category:** state-engine
- **Confidence:** high

takeTurn, commitReply and writeRoommateIntro keep using the global adv/W after their awaits, but Continue, New adventure/Begin, Import, Delete-current and the boot load replace adv without checking busy (only #reloadAdv and #overwriteAdv check it, lines 2483-2484; setBusyUI disables only send/regen/regenWith/undo). The reply is applied to and persisted into the wrong adventure (processed under the other world's rules); a failed or stopped turn instead assigns its stateBefore to the other adventure (1608).

**Suggested fix:** Refuse (or disable the buttons for) Continue/New/Import/Delete/Begin while busy or while boot loading runs, and capture const mine = adv at the start of takeTurn/writeRoommateIntro and discard the commit and persist (and the rollback) if adv !== mine after any await.

### A failed Continue leaves the new world loaded over the old adventure; the next save stamps the wrong worldId and every turn errors — **Fixed**

- **File/lines:** index.html : 1776-1790 (setWorld at 1780, before the chunk query at 1781), 1822, 1832, 1703 (advDoc worldId: W.id)
- **Category:** data-loss
- **Confidence:** high

loadAdventure() calls setWorld(d.worldId) before the fallible chunk query and before adv is replaced, so a failure leaves W pointing at the other adventure's world while adv is still the previous one; no catch restores W. advDoc() writes worldId: W.id on the next persist.

**Suggested fix:** Fetch the doc and chunks first, then call setWorld and assign adv together in one synchronous step (or restore the previous W in a catch). Apply the same ordering in importFile and newAdventure.

### Imported saves and stored docs are injected into innerHTML unescaped (stored XSS, zero-click at boot) — **Fixed**

- **File/lines:** index.html : 2276, 2320, 2330, 2332, 2358, 2366-2371, 2368, 2370-2371, 2384, 2166-2168, 2567 (import 1857-1866)
- **Category:** security
- **Confidence:** high

Numeric-looking fields (S.day, t.n, t.words, stateBefore/After.day, e.intensity, player.stats values, influence, attitudes, tf trait/sex/track day) are concatenated into innerHTML without esc(), while importFile()/loadAdventure() and the shared store accept any JSON for them; the Override dialog value= attributes are unescaped too.

**Suggested fix:** Wrap every interpolated value in esc() or Number() (or build these nodes with textContent), escape the Override value attributes, and validate/coerce numeric fields (day, n, words, intensity, attitudes, skills, stats, tf day) on import and on load.

### A failed chunk write is never repaired: history gaps, state ahead of the log, duplicate turn numbers, and a later 'saved' note hides it — **Fixed**

- **File/lines:** index.html : 1753-1768 (persist); 1758-1763; 1773-1774; 1782-1783; 1539
- **Category:** data-loss
- **Confidence:** high

persist() writes the adventure doc (state, memory, rev, turnCount) first and then only the 10-turn chunk containing the newest turn, so a rejected chunk write (K1 size cap, quota, transient unavailable, which is not retried once as the db contract asks) is never retried or backfilled. loadAdventure never compares turnCount with the turns it loaded, and turn numbers and chunk indexes are positional, so gaps and duplicates are propagated and the note flips back to 'saved'.

**Suggested fix:** Write the turn chunks before the adventure doc, remember failed chunk indexes and rewrite them on the next persist (retry unavailable once after a short random delay), keep a visible warning while dirty, warn/repair on load when turnCount differs from loaded turns, and derive turn.n from max(n)+1 and the chunk index from turn.n instead of array position.

### Prompt-size guard cannot shrink the largest sections and never re-checks its last step; long Sundered games dead-end with prompt_too_large — **Fixed**

- **File/lines:** index.html : 1563-1567, 1564-1567, 1602 (untrimmed sections: 1321-1322)
- **Category:** robustness
- **Confidence:** high

The guard only trims timeline events, older beats and the verbatim window, then sends the last candidate without measuring it. Lore (up to ~10K), characters (~8.5K), gm_only (~5K), transformation (~7K), facts (up to 60, ~10 KB) and summary are never reduced, and the memory fold runs only after a successful turn. Sundered's base prompt is already ~52 KB.

**Suggested fix:** Loop until the measured prompt fits, adding later shedding stages (older facts, summary, lore hard cap, exemplars, minor characters, GM fragments, tf lines), re-measure after the final stage, run the memory fold before the call when over budget, and reword the error to something the player can act on.

### Mythaven roommate intro hard-codes the template's name while the default roommate name is usually a generic one — **Fixed**

- **File/lines:** worlds/mythaven.js : 287-343 (template intros); index.html:2050-2060, 2058-2059, 2122
- **Category:** content-data
- **Confidence:** high

rmNamesFor() appends the _generic name pool to every species and randomField('rmName') draws uniformly, so ~83% of default roommates get a generic name, but all nine authored intros hard-code the template surname (harpy also hard-codes 'Juniper'). Template roommates are never rewritten by writeRoommateIntro, so this text is the player-facing Turn 0.

**Suggested fix:** In rmNamesFor use only the matched template's names when a species matched; add a rm_last token to vars() and use it (and {rm_First}) in the intros, or use {rm_first}; apply replaces only when the roommate actually is that character.

## MEDIUM (40)

### Player invention fires a model call with no viewer action (including on page load), superseded calls are never aborted, and a declined or disabled sample is never latched off

- **File/lines:** index.html : 2000-2011, 2004, 2031, 2125, 2519-2539, 2570
- **Category:** runtime-contract
- **Confidence:** high

openCreate() calls randomAll(), which calls inventPlayerFields(), so every dialog open (including the automatic first-run open at boot) and every 'Randomise everything' makes a consent-triggering sample call with a random-seeded, never-stable prompt. The call has no external AbortSignal, so reroll, preset, Begin or Cancel only discards the result; after not_granted or sampling_disabled the page keeps calling and keeps showing 'Claude ready'.

**Suggested fix:** Invent the player's fields only on an explicit button press (or at Begin) with one AbortController aborted on reroll, preset, close and Begin; on not_granted/sampling_disabled set sample = null and show the bad connection state once.

### No window.claude (saved copy or other host) or a declined sample leaves the UI on 'connecting' / 'Claude ready' with no message

- **File/lines:** index.html : 2258-2264, 2260, 2559-2562, 2561, 2559, 1596-1605
- **Category:** runtime-contract
- **Confidence:** high

connectSample() and the boot IIFE call window.claude.use() unguarded; with no window.claude both reject with a TypeError (unhandled), so no status, no 'Claude unavailable' state and no creation dialog appears. 'Claude ready' is set as soon as use('sample') returns a function and no hide-class code (not_granted, sampling_disabled, not_declared, capability_*) ever changes it.

**Suggested fix:** Guard on window.claude && window.claude.use (try/catch) and take the existing 'Claude unavailable' / 'saves unavailable' path; on hide-class codes set the header to bad, disable sample-dependent controls and show a persistent banner.

### Cast editor Save corrupts name fields: first becomes the title, last goes stale, renames never reach {npc_*} references

- **File/lines:** index.html : 2208-2220 (2213); vars() 739-745; focusNames 1263-1270
- **Category:** correctness
- **Confidence:** high

saveCast always sets first: name.split(' ')[0], which is the title ('Dean', 'Professor', 'Dr') for titled cast, and never updates last. vars() resolves {npc_key} from adv.cast.generated (the base list), ignoring cast.overrides, so a rename does not propagate into other characters' sheets although the code comment claims it will.

**Suggested fix:** Only overwrite first/last when the name actually changed, deriving them without the title, and build vars() from activeCharacters() so overrides apply.

### 'Reset to the world's version' does nothing for the roommate yet reports success; Reset and Remove leave a renamed character wrongly matched in state.present

- **File/lines:** index.html : 2214, 2221, 2193, 2208-2226, 2196-2207
- **Category:** correctness
- **Confidence:** high

saveCast edits the roommate in place (Object.assign(adv.roommate, ...)) rather than via cs.overrides, but resetCast only deletes cs.overrides[castSel], so Reset is a no-op for the roommate and the list never shows the edit marker. Reset on any renamed character leaves the renamed entry in state.present, and toggleRemoveCast filters state.present by the base name, so a renamed character stays present. A blank attitude field is saved as 0.

**Suggested fix:** Keep the roommate's generated original (or route roommate edits through cs.overrides) so Reset can restore it, map state.present back on reset, filter present by displayed name and aliases, and treat a blank attitude as unchanged.

### Cast editor 'Aim' and 'Usually found' edits are silently ignored whenever the character has slot-specific text

- **File/lines:** index.html : 1303-1304 (saveCast 2213; labels 441-442)
- **Category:** correctness
- **Confidence:** high

buildPrompt prefers where[slot] / aims[slot] over .default, but the Cast editor writes only .default and labels it 'any time of day'. Almost every cast member has evening/night/class slot entries.

**Suggested fix:** When saving, also overwrite or clear the slot-specific entries, or show an editor per slot; at minimum fix the 'any time of day' label.

### Lore keys match as raw substrings, so short keys fire on ordinary words ('ring', 'bet', 'tree', 'war', 'pack', 'cow', 'spa', 'pen', 'Hale', 'salt')

- **File/lines:** index.html : 1183-1190 (1187); worlds/halloway.js:171-195; worlds/mythaven.js:482-511; worlds/sundered.js:673-690
- **Category:** correctness
- **Confidence:** high

Bare keys use hay.includes(kk) with no word boundary (only '*' keys get \b), so 3-4 letter keys in all three worlds trigger on substrings of unrelated words; the spurious entries are species/Spa/reach-salt entries of priority 6-9 and ~800-1,100 rendered chars, crowding out relevant lore.

**Suggested fix:** Match bare keys as whole words (\bkey\b, keeping '*' for prefixes), make phrase-only keys explicit ('fairy ring', 'Dr Hale', 'the pens'), and audit short keys (ring, bet, tree, war, pack, cow, nap, lap, sap, pen, inn, shed, spa, salt).

### focusNames fires on surnames/aliases that are ordinary words (Fell, Salt, Marrow, Hazel, Vane, Pike, Marsh) and shared surnames, issuing a false 'Focus' directive

- **File/lines:** index.html : 1263-1271; worlds/mythaven.js:393-476
- **Category:** correctness
- **Confidence:** high

Handles (surnames, aliases, first names) are matched case-insensitively as whole words, so common words in ordinary prose select a cast member, and surnames shared with others (Ambergill vs Ambergill-Vey, Reyes sisters) also match. The prompt then states the turn belongs to that character and that nobody else arrives and nothing interrupts.

**Suggested fix:** Match handles case-sensitively against the original action (names are capitalised), skip handles that are common words or prefixes of other names; in the world rename Fell, Salt, Vane, Pike and give Pip a surname that is not a prefix of 'Ambergill-Vey'.

### Halloway premise starts with 'You are {name}', so the creation dialog shows a raw {name} and the invention prompt carries the wrong world's text and another adventure's player name

- **File/lines:** index.html : 1228, 1229, 2018, 1886-1909 (1889, 1893), 2000-2004; worlds/halloway.js:13
- **Category:** content-data
- **Confidence:** high

premiseParts() splits only at '. You are ', which the other worlds' premises contain after a setting sentence; Halloway's premise begins 'You are {name}', so the whole unfilled premise becomes 'setting' and is written into #cPremise, and inventPrompt fills it from the ALREADY LOADED adventure's player. inventPrompt also hard-codes Mythaven's curriculum ('The university teaches Glamour, Applied Alchemy ...', empty '()' lists, 'in the manner of: .').

**Suggested fix:** Open the premise with a setting sentence (moving 'You are {name}...' after '. ' as in mythaven.js:12) or split on /^You are |\. You are /, fill the setting with the creation world's own default player, and emit the course rule only when Wc.genPools.courses exists.

### Mythaven rules still carry Sundered Isle setting text (cliff path, cloud below, cloud ferry, bricked doors, closed places)

- **File/lines:** worlds/mythaven.js : 22, 31
- **Category:** content-data
- **Confidence:** high

Rule 'Setting texture' (line 31, copied from worlds/sundered.js:36) tells the narrator 'The Isle is real ground with an edge: a rail on the cliff path, cloud instead of sea below ... a ferry out of the cloud twice a day' and cites 'the old wall with its bricked doors'; 'Length and detail' (line 22) cites 'a closed place opening'. None exists in Mythaven (wooded lake campus outside a human city, no dungeons; player arrives 'by the inland bus').

**Suggested fix:** Rewrite line 31 for the lake campus (lake weather, the road or bus to the city) and delete 'a closed place opening' from line 22; replace or define 'a lake town' in the Themes rule (line 26).

### Day-1-only schedule rows recur every Monday: 'orientation (no classes on Day 1)' in the authoritative <clock> and a recurring orientation mixer in Coming days

- **File/lines:** worlds/sundered.js : 627, 635; worlds/mythaven.js:363-380 (366, 374); index.html:800 (calendarLine)
- **Category:** content-data
- **Confidence:** high

The entry '10:00 orientation (no classes on Day 1)' is recurring (days: Monday) and Day 1 starts at 17:40, so it only ever fires on later Mondays; the 19:00 entry 'the mixer on the quad (orientation Monday); goblin night market ... (other Mondays)' has no day filter, and calendarLine cuts names at the first ' (' or ',', so every future Monday reads as the orientation mixer.

**Suggested fix:** Remove the orientation row and split the 19:00 entry into a Day-1-only mixer and a recurring Monday market (or add a day field the engine honours); do not truncate names at ' (' or ',' when alternatives follow.

### Evening aims and where.free written for the Day-1 mixer are applied to every evening of every week

- **File/lines:** worlds/mythaven.js; worlds/sundered.js : worlds/mythaven.js:281-343, 397-457 (aims.evening, wolf where.free, cow where.class2), 455-457; worlds/sundered.js:79,94,100,103,106,112-113,167,181,248,274,289 (aims.evening), 635; index.html:1303-1306
- **Category:** content-data
- **Confidence:** high

buildPrompt picks where[slot] / aims[slot] by slot name only, and the 'evening' slot recurs every night, yet the evening aims of creamery, library, gardener, warren, stall, human_society, cory, hazel, priya, ilse, pip, bexley, marisol and most roommate species describe Day 1's mixer (or a one-off rivalry goal); the wolf roommate's where.free applies at the 17:40 opening although the roommate is in room 4B, and the cow's class2 applies all five weekdays.

**Suggested fix:** Make aims.evening event-neutral and carry mixer-night aims in the opening beats or facts, give the wolf no where.free (or 'room 4B or the Moon Field'), add an 'otherwise' place to human_society's where.evening, and optionally let the engine key aims on weekday as well as slot.

### Stop is shown but inert during the roommate introduction and memory fold, and Stop during length fit still commits the turn

- **File/lines:** index.html : 2414, 2266, 1641-1668, 1644-1658, 1494-1505, 1501, 1517-1522, 1520-1521, 1549
- **Category:** ux
- **Confidence:** high

Stop only aborts the shared ctl: writeRoommateIntro() sets busy and shows Stop but has no controller and passes no signal, foldBeats() passes no signal, and a cancelled fitLength() is caught and ignored by commitReply(), which goes on to commit the turn and clear the status without 'Stopped.'.

**Suggested fix:** Give writeRoommateIntro and foldBeats an AbortController tied to Stop and rethrow 'cancelled' after a cancelled fit/fold so takeTurn rolls the turn back.

### Typed (custom) or non-binary roommate gets broken intro text: 'they says', 'they does', 'Looks: .', 'a elf'

- **File/lines:** index.html : 626-630, 677-694, 1653-1654, 583; worlds/mythaven.js:280 (_generic.intro)
- **Category:** content-data
- **Confidence:** high

A species with no pool has no looks, so the plain intro prints ', basilisk from the first glance, and plainly.' and the narrator prompt contains 'Looks: .'. The intros hard-code the verb after the pronoun ('{rm_they} says', 'does not explain') without the {rm_s}/{rm_es} tokens, giving 'they says'/'they does' for non-binary roommates, and the prompt writes 'a ' + kind ('a elf'). This player-facing text is Turn 0 because template roommates are never rewritten.

**Suggested fix:** Use agreement tokens in the intros ('{rm_they} say{rm_s}', 'do{rm_es}'), give custom species a looks fallback or drop the Looks clause, and choose a/an from the first letter.

### Clicking the 'Two things you are good at' label re-rolls the player's strengths

- **File/lines:** index.html : 345, 2028
- **Category:** ux
- **Confidence:** high

The Random button sits inside the field's <label> with no for attribute, so the label's control is that button and any click or tap on the caption (or the empty rest of its full-width row) fires Random; the checkbox group also has no group name.

**Suggested fix:** Move the Random button out of the <label> and make the checks container a fieldset/legend or role=group with aria-labelledby.

### Halloway reach-salt code flag is never explained to the model, and the fever-break note misfires for salt fevers

- **File/lines:** worlds/halloway.js : 26, 39, 246-248; index.html:898
- **Category:** state-engine
- **Confidence:** high

salt_taken_this_turn appears in the model prompt only as a key inside <state>; no rule or <progression> text says to set it, and the Attunement rule sends the model to <progression> for triggers although they are in <world>, which says reach-salt gives +30 to 40 progress. When the flag is set, the 3-day salt fever ends with 'Describe the new Stage N marks' although no stage changed.

**Suggested fix:** Add a rule telling the model to set flags.salt_taken_this_turn the turn salt is swallowed and never add the progress itself; make the fever-break note ask for marks only when the stage actually advanced.

### The Dean's secret is written into her role text and shown in the Cast dialog with spoilers off

- **File/lines:** worlds/sundered.js : 114 (also 732, 761); index.html:2203, 1306
- **Category:** content-data
- **Confidence:** medium

castRoles.dean.role states the GM-only truth ('human once, long ago, though nobody knows it' and that the letters come from her office); it is placed in <characters>, not <gm_only>, and the always-available Cast dialog prints it, along with each person's 'Does not say:' private matter.

**Suggested fix:** Remove 'human once' from the role (it already lives in secrets.keeper) and hide cast sheets behind the spoiler toggle or show only a public brief.

### Drawn cast gender and pronouns are never given to the narrator

- **File/lines:** index.html : 1306, 657, 626-630
- **Category:** correctness
- **Confidence:** high

c.gender and c.pronouns are stored for every cast member but not written into <characters> or the minor-character line, so many people carry no gender cue at all (the roommate intro also inflects wrongly for a non-binary roommate).

**Suggested fix:** Append '(she/her)' style pronouns to each character and minor line as <player> does, and use agreement tokens in composeIntro.

### The personal opening paragraph is stored and sent to the narrator but never shown to the player

- **File/lines:** index.html : 1229-1235, 2299-2304
- **Category:** content-data
- **Confidence:** high

openingNarrative() prepends the premise's personal part ('You are <name>, nineteen, human...') to adv.opening.narrative, but openingTurn() (documented as 'Turn 0 for the prompt') strips it and renderFeed displays that stripped text; the creation dialog shows only the setting half.

**Suggested fix:** Render adv.opening.narrative (plus the 'before' block) in renderFeed and keep openingTurn() for buildPrompt and the lastLine in advDoc only.

### Async handlers lack in-flight guards: double-click Undo removes two turns, double-click Take turn / Ctrl+Enter leaves a stale red banner, double OK / Begin re-enter

- **File/lines:** index.html : 1684-1690, 1722-1732, 1722-1723, 1669-1683, 2415, 1824, 1842-1850, 2519-2520
- **Category:** state-engine
- **Confidence:** high

onUndo, onRegenerate and onSend check busy before awaiting syncFromStore(), and syncFromStore() returns false (carry on) when re-entered while syncing, so a second click passes the guard while the first is awaiting the db read. Ctrl+Enter ignores the disabled Take turn button; the inline OK and Begin buttons are re-enterable too.

**Suggested fix:** Set a synchronous in-flight flag at the top of onUndo/onRegenerate/onSend/OK/Begin before any await and clear it in finally; gate Ctrl+Enter on busy and sample; make a re-entered syncFromStore make the caller bail rather than proceed; ignore a Begin re-click for ~1 s.

### 60 s page-side invention timer also counts consent and queue time, and Begin fires six simultaneous batch calls

- **File/lines:** index.html : 1936, 1942-1976, 1944-1948, 1963, 2528, 2518, 2519-2539
- **Category:** runtime-contract
- **Confidence:** medium

inventCall starts a 60 s setTimeout (INVENT_TIMEOUT_MS) before the db read and before the runtime has admitted the call; sample.d.ts says not to build a timeout because it counts the viewer's time on the consent dialog and queue wait. inventAll sends six batches (28 slots / 5) at once, plus a lingering player-invention call; whether this trips rate_limited could not be verified.

**Suggested fix:** Drop the page-side timer (keep the user-driven Begin now and Stop) or start it at the first onText, and cap invention concurrency at about two batches (or ask for the cast in fewer calls).

### A reply cut off twice is committed as a normal turn with no visible warning

- **File/lines:** index.html : 1583-1586, 1589, 1442-1467
- **Category:** correctness
- **Confidence:** high

When both attempts hit the output cap, the repaired partial JSON is committed as a full turn and the status line is cleared; nothing the player sees says the reply was cut.

**Suggested fix:** If the second reply is also truncated, fail the turn (rolling back) or require narrative plus suggestions and show a visible warning offering Regenerate.

### Adventure id is taken from the doc body, not the document path: one doc can overwrite or delete another adventure

- **File/lines:** index.html : 1784, 1817-1829, 1759, 1703
- **Category:** data-loss
- **Confidence:** high

loadAdventure sets adv.id = d.id (body field) and listAdventures drives open/rename/delete from a.id (body), so a document whose body id names a different adventure redirects every later write and delete to that other adventure; nothing checks that body id equals the path id.

**Suggested fix:** Use the snapshot/path id everywhere and verify or ignore the body id; reject docs whose body id differs from the path.

### Failed import replaces the live adventure and world before validating, so a malformed save breaks the page and can poison the next boot

- **File/lines:** index.html : 1857-1869 (setWorld 1863, adv assignment 1864, adv.memory.facts 1866), 1862
- **Category:** robustness
- **Confidence:** high

importFile calls setWorld and assigns adv from the file before checking that state, memory and turns exist; the world check WORLDS[wid] is truthy for inherited names such as constructor. The catch only shows 'Import failed', leaving a half-built unsaved adventure (and possibly another world) current.

**Suggested fix:** Build and validate the new adventure into locals (own-property world check, object-typed state and memory, array turns, tier whitelist) and call setWorld and assign adv only after validation succeeds, restoring the previous ones on failure; make boot fall back to the next-newest save and treat a doc without state as unloadable.

### Partial failures in copy, delete and undo leave truncated or corrupt records that look healthy in the list

- **File/lines:** index.html : 1764, 1769-1775, 1822-1830, 1824, 1826-1829
- **Category:** data-loss
- **Confidence:** high

persistAll writes the adventure doc (turnCount = N) before its chunks, delete removes chunk docs oldest-first before the adventure doc, and undo deletes the stale chunk last, with no rollback or cleanup; the copy handler only shows an error and never refreshes the list.

**Suggested fix:** Write chunks before the doc when copying (or delete the partial copy in a catch), delete the adventure doc first or mark it deleting, delete the stale undo chunk before rewriting, and trim loaded turns to turnCount with a warning on mismatch.

### Memory fold and length fit accept any utility-model reply (refusal, truncated text, preamble, 3,000 words)

- **File/lines:** index.html : 1488-1505, 1520-1521
- **Category:** data-loss
- **Confidence:** high

foldBeats replaces the summary with whatever text comes back, then permanently discards the 18 beats and 20 facts it was meant to merge. fitLength results are checked only for more than 50 words, and res.truncated is never read.

**Suggested fix:** Reject fold or fit results that are truncated, outside a sane length window (summary roughly 40-400 words, fit within the band) or refusal-shaped, and keep the old summary and narrative.

### Revision-based stale detection can be defeated: a failed save pre-bumps rev, and the doc is written before its chunk

- **File/lines:** index.html : 1703, 1711-1719, 1753-1768
- **Category:** state-engine
- **Confidence:** high

persist() sets adv.rev to rev+1 before the write, so a failed save leaves this page claiming a revision the store never got. It also writes the adventure doc (new rev, turnCount) before the chunk, so a device that syncs in between adopts the new rev with the old chunk.

**Suggested fix:** Assign adv.rev only after the write succeeds, write the chunk before the doc (or store the chunk revision in the doc), and reload when turnCount differs from the loaded turns.

### Other-device deletes and renames are invisible to an open page; its next save resurrects a truncated adventure or reverts the rename

- **File/lines:** index.html : 1714, 1711-1719, 1753-1764, 1823, 1825-1829
- **Category:** data-loss
- **Confidence:** high

newerInStore treats a missing adventure doc as 'nothing newer', so a page holding a deleted adventure silently re-creates it on its next persist, writing only the last 10-turn chunk. Renaming a non-current adventure does a bare set() with no rev/updatedAt bump, so a page holding it never notices and overwrites the new title.

**Suggested fix:** Bump rev and updatedAt on rename via the same write path as persist; treat a missing doc for an adventure with adv.rev > 0 as deleted (stop saving and offer to restore via persistAll or discard).

### 'Save a copy' makes the copy the most recent save and mutates the live adv.title across awaits, so a racing save renames the original

- **File/lines:** index.html : 1824, 2567-2568, 1773-1774, 1842-1850
- **Category:** correctness
- **Confidence:** high

The copy's updatedAt is newer than the adventure being played, and boot opens the most recently saved adventure; the copy handler also swaps the live adv.title across the awaits of persistAll(newId), so a double-click on OK or any persist() (a turn finishing, a settings change) serialises the temporary title and renames the original.

**Suggested fix:** Pass the title into persistAll instead of mutating adv.title, give the copy an updatedAt at or below the source's so the source stays the latest save, and disable OK while the copy is being written.

### persist() returns nothing, so callers announce success after a failed or refused save, and conflict banners are overwritten

- **File/lines:** index.html : 1753-1768, 1867, 2175, 2219, 2548-2551
- **Category:** ux
- **Confidence:** high

persist() swallows errors and conflicts and returns undefined. Cast Save, Override edits, Add fact and Import then show 'Saved.', 'Fact added.' or 'Imported ...' regardless, and a status line set afterwards replaces the conflict banner.

**Suggested fix:** Make persist() return true/false (or throw) and announce success only on true; keep the conflict banner from being replaced by routine status text.

### Saves, presets and recents live in shared top-level collections; boot opens the newest save written by any viewer

- **File/lines:** index.html : 2567-2569, 1759, 1814, 2130, 1928
- **Category:** runtime-contract
- **Confidence:** medium

All data is written under root collections (adventures, presets, meta) shared by every viewer; only data/users/<id>/ is private. Boot loads orderBy(updatedAt desc).limit(1) of the shared collection and ignores the per-viewer windlass.last key; no use('user') or data/users path exists.

**Suggested fix:** Key a viewer's data under data/users/<id>/ (declare user, await user.id()) or declare db rules making adventures owner-only and gate controls with user.can; load the last-used save by id before falling back to the newest.

### A failing save, db-unavailable and export fallback are signalled only in the Summary panel's small note, which phones keep closed

- **File/lines:** index.html : 2265, 1767, 295-299, 168-175, 298, 2563, 1855, 1812, 315
- **Category:** ux
- **Confidence:** high

setSaveNote() writes 'saved', 'save failed', 'no saves yet' and 'saves unavailable in this view' into #summaryNote inside the Character rail, which is display:none at <=900px; there is no banner, header indicator or retry. When db is unavailable the Adventures dialog still says 'Every turn is saved automatically', and a downloads fallback dumps raw JSON with no heading, instructions or Copy button.

**Suggested fix:** On persist failure or missing db show a persistent bad status banner (or header pill) with Retry until a save succeeds; give the export fallback a heading, instructions and a Copy/select-all button inside the dialog; reword line 315 when db is null.

### The transformation block grows without bound and the size guard cannot shrink it: turns fail with prompt_too_large once all ten kinds are complete

- **File/lines:** index.html : 1129-1156 (guard at 1566)
- **Category:** runtime-contract
- **Confidence:** high

bodyNowLines emits each completed kind's finished shape plus, for every path other than tf.sex.species, all its 'Toward a woman's body so far' lines on every prompt. takeTurn's guard only trims events, older beats and the verbatim window.

**Suggested fix:** Emit only the finished-shape line for completed kinds and drop sex lines once tf.sex is set; let the guard remove the tf lines as a last resort.

### 'Previous version' restores an already advanced state but clears the engine notes, so a started change, arc phase or progression note is never narrated

- **File/lines:** index.html : 1691-1699, 1695-1697, 1694, 1538-1546, 1534, 1544
- **Category:** state-engine
- **Confidence:** high

usePreviousVersion restores prev.stateAfter, whose track indexes, arc phases and spa/progression flags are already advanced, but sets adv.pendingNotes = [] because turn records keep only pendingBefore. The alts list is also rewritten so only the two newest versions can be reached.

**Suggested fix:** Store pendingAfter on each turn record and restore it here; keep alts as an ordered list with a current index instead of popping and re-pushing.

### A second sex path is rolled, announced and finished on a body that is already a woman's; spa reset of one kind erases the other's result

- **File/lines:** index.html : 1008, 1081, 1102, 1137-1142
- **Category:** state-engine
- **Confidence:** high

manifestDue rolls the sex change from the player's declared gender only, never from tf.sex or other active paths; advanceTracks overwrites tf.sex with whichever path finishes last (tf.sex records a single species), and the spa reset deletes tf.sex by species.

**Suggested fix:** Skip the roll and sex tracks when tf.sex is already set (or another path carries sex), set tf.sex only if absent (keep sex as a body-level fact with contributing species), and recompute it from remaining finished paths on spa reset.

### 'Body now' drops the sex lines already told for a rung when its sex track ends, until the body track settles

- **File/lines:** index.html : 1137 (tracks removed at 1084)
- **Category:** state-engine
- **Confidence:** high

Told sex lines are rebuilt from ladder[i].sex only for i below the settled body-trait count plus the live sex track. The 1-2 step sex track ends and is removed several turns before the 5-9 step body track settles, so neither source lists them in between.

**Suggested fix:** Record told sex lines on tf.paths[k] (or per-rung finished flags) and list them independently of body settling.

### List items silently drop the newest entries once maxItems is reached (Discoveries caps at 12, inventory at 20)

- **File/lines:** index.html : 860-863 (863: slice(0, def.maxItems || 30)); worlds/sundered.js:794-797 (discoveries maxItems 12 at 797); worlds/mythaven.js:524-526
- **Category:** state-engine
- **Confidence:** high

applyUpdates concatenates an append and then slices from the front, so once a list is full every new entry is discarded with no engine note and no diff entry. Sundered caps discoveries at 12, romances/clubs/wearing at 8 and inventory at 20.

**Suggested fix:** Keep the newest entries (slice(-max)) or raise discoveries to ~30, and push an engine note whenever anything is trimmed.

### Any state_updates op other than set/inc/append/remove silently becomes 'set', wiping lists

- **File/lines:** index.html : 832, 841, 851, 862
- **Category:** state-engine
- **Confidence:** high

The op is read with String(u.op || 'set').toLowerCase() and every unrecognised value falls into the set branch with no note, so for lists and 'present' the whole value is replaced by the new entry.

**Suggested fix:** Trim and validate op against the four allowed values (optionally map add/push to append, delete/drop to remove, dec to negative inc); for anything else add an 'ignored unknown op' note and skip.

### Override and Cast edits made during a running turn are silently reverted when that turn fails or is stopped

- **File/lines:** index.html : 2173-2177, 2208-2220 (rollback at 1608)
- **Category:** data-loss
- **Confidence:** high

overrideApply() and saveCast() mutate adv.state without checking busy; takeTurn's catch then restores its pre-turn snapshot (adv.state = stateBefore), wiping those edits while the UI and the store had already reported them as saved.

**Suggested fix:** Disable the Override and Cast controls (or make them wait) while busy, or apply the rollback by diffing rather than replacing adv.state wholesale.

### A save during Regenerate writes the popped turn list; a failed or stopped regenerate leaves the store one turn short while the page says 'saved'

- **File/lines:** index.html : 1678-1682, 1753-1768, 2475-2479, 2417
- **Category:** data-loss
- **Confidence:** high

onRegenerate pops the last turn and rewinds state and memory before the model call, and persist() (called by any settings change, summary save, cast edit or Override) serialises that intermediate state. A failed or stopped regenerate restores memory in the page but never re-saves.

**Suggested fix:** Keep the old turn in adv.turns until the replacement commits (or block persist and edits while busy) so the intermediate state is never serialised.

### Export filename .slice(0, 80) cuts off '.json', so long titles always fail with rejected_extension and fall into a JSON dump

- **File/lines:** index.html : 1851-1856, 1853-1855
- **Category:** runtime-contract
- **Confidence:** high

(W.id + '-' + slug + '.json').slice(0, 80) removes the extension whenever the slug exceeds about 65 characters, which downloads.save rejects with rejected_extension; the catch then dumps the whole JSON into #exportFallback for any non-'declined' error (including rate_limited from a double click) with the generic 'download unavailable' note, and the pre is never hidden again. Non-Latin titles collapse to 'sundered--.json'.

**Suggested fix:** Slice the slug (to about 60 chars) before appending '.json'; fall back to the text dump only for unavailable/not_granted, tell the player to retry on rate_limited, show the failure inside the dialog, and hide #exportFallback on success.

## LOW (12)

### Dungeon fragments assume a fixed clearing order, and the 'seventh door' contradicts the Keel entrance

- **File/lines:** worlds/sundered.js : 742-772, 772, 776
- **Category:** content-data
- **Confidence:** medium

The closed places can be passed in any order, but the fragments read as a numbered sequence ('There were seven', then 'the sages', then 'the sages' font'); the Sloth fragment says 'The seventh door opens the Keel' while choice.text says the Keel is entered by a stair from the Bell Cellar after all seven are passed.

**Suggested fix:** Reword each fragment to stand alone, and change the Sloth line to say that when all seven are passed the Bell Cellar stair leads to the Keel.

### secrets.rule refers to a 'partial' section that does not exist

- **File/lines:** worlds/sundered.js : 710
- **Category:** content-data
- **Confidence:** high

The narrator is told 'No character knows any of it except as noted under partial', but the world defines no secrets.partial, so no such block is ever emitted (index.html:1250 only emits it when sec.partial exists).

**Suggested fix:** Remove the clause, or say 'except the keeper named below'.

### Small Halloway continuity contradictions: Ines's months, 'all' vs 'most' Wardens, separation rule, 'first Working' label, Marsh absent at arrival

- **File/lines:** worlds/halloway.js : 39, 40, 55, 98, 125, 138, 184, 230
- **Category:** content-data
- **Confidence:** medium

A second-year (Ines) reached Stage 3 'in fourteen months' though a second-year has had a kin for at most 12 months; Wardens are 'all deep-turned' but Stage 4 says 'Most Wardens are Stage 4'; kin separation 'for more than a day' slows Attunement but a second curfew strike is 'a day of kin-separation' that stalls it; every Mon/Wed/Fri 08:00 bell is named 'first Working' though the match happens at 'their first Working, on the third day'; at 09:10 on arrival Marsh watches from the steps in the opening but initialState.present omits her and her where.default prints 'Now: her rooms in the Wardens' house'.

**Suggested fix:** Fix each line (months, all/most, separation wording), rename the bell 'Working', and add Marsh to present with a front-court where for the arrival slot.

### Override 'Apply as turn' leaves the 'folding memory…' status banner up indefinitely

- **File/lines:** index.html : 1549, 1616-1631
- **Category:** correctness
- **Confidence:** high

commitReply sets the status to 'folding memory…' when sample is connected, but applyManualReply never clears it as takeTurn does.

**Suggested fix:** Call setStatus('') at the end of applyManualReply (in its finally) or after commitReply.

### Typed roommate species is matched by substring, so unrelated words get a species template ('Chimera'/'Merlin' -> Merfolk, 'Coward' -> Bovine, 'a' -> Harpy)

- **File/lines:** index.html : 536-541, 539
- **Category:** correctness
- **Confidence:** high

matchRoommateSpecies accepts nm.includes(t) or t.includes(key/short) at any length, so short keys such as mer, cat, cow, fox and wolf match inside unrelated words and a single letter matches a species.

**Suggested fix:** Match only exact key/name/short (case-insensitive) or whole words and drop the nm.includes(t) branch.

### Failure of a Regenerate/turn flow: success clears the action and director boxes the player was drafting

- **File/lines:** index.html : 1588, 1681
- **Category:** ux
- **Confidence:** high

takeTurn clears #action and #director on success without checking whether the turn is a regeneration.

**Suggested fix:** Clear the boxes only when opts.regen is not set.

### Unsaved edits in the Summary box are silently overwritten by the next render

- **File/lines:** index.html : 2385, 2417
- **Category:** data-loss
- **Confidence:** high

renderRail() resets #summary from adv.memory.summary whenever the box is not focused, and nothing marks an edit as unsaved.

**Suggested fix:** Track a dirty flag on input and skip the reset while dirty, or save the summary on blur and before Take turn.

### Boot: a failed adventures query reads as 'no saves yet', and the windlass.last fallback is dead

- **File/lines:** index.html : 1804, 2557, 2564-2570, 2567
- **Category:** robustness
- **Confidence:** high

The boot-time newAdventure() writes its throwaway id into localStorage 'windlass.last' before line 2564 reads it, so the fallback can never find a real save; the swallowed catch on the ordered query then routes any query error to 'no saves yet' and opens the create dialog. Boot also tries only the single most recent save and does not fall back to the next one when it fails to load.

**Suggested fix:** Read windlass.last before the first newAdventure() (or skip writing it for an unsaved adventure), retry the query once, show 'could not load saves: <code>' on failure, and fall back to the next save when the newest cannot load.

### logFailure keys documents by Date.now() base36: same-millisecond failures collide, and records are filed under a never-saved or previous adventure

- **File/lines:** index.html : 1421-1425, 1424, 1960, 1963-1964, 1969-1976
- **Category:** runtime-contract
- **Confidence:** high

logFailure writes adventures/<id>/failures/<Date.now() base36> fire-and-forget, so six parallel invention failures in one millisecond write one document concurrently (overlapping-writes, last writer wins). Because Begin invents before newAdventure(), adv.id is the placeholder or previous adventure, leaving orphan docs; it also ignores input.tier/bytes from the timeout path, logs for every declined call, and nothing reads the docs back.

**Suggested fix:** Add a counter or random suffix to the failure doc id, skip db logging when no adventure is persisted or the code is not_granted/rate_limited, cap the log, and pass tier/bytes through extra.

### Creation dialog: stale roommate fields leak into other worlds' presets, and loadPresets has no stale-result guard

- **File/lines:** index.html : 2128-2132
- **Category:** ux
- **Confidence:** high

openCreate resets roommate fields only when the world has a roommate, so Halloway presets and their default name carry the previous world's species; loadPresets has no stale-result guard, so a late result for world A fills world B's dropdown.

**Suggested fix:** Clear roommate fields on every world change and guard loadPresets with a sequence token.

### Sundered opening event is time-stamped 17:45, five minutes after the clock the game starts on

- **File/lines:** worlds/sundered.js : 836
- **Category:** content-data
- **Confidence:** high

opening.events seeds 'Day 1 17:45 ... offers to walk {first} to the mixer' into the timeline, but initialState.time is 17:40 and the first prompt's <clock> still reads 17:40.

**Suggested fix:** Stamp the offer 17:40, or start the clock at 17:45.

### Valid JSON without a narrative is never retried and the error says 'twice'; non-object JSON surfaces as a page error

- **File/lines:** index.html : 1575-1585, 1513, 1599, 1467
- **Category:** correctness
- **Confidence:** high

The one automatic retry fires only when the reply cannot be parsed, so {}, {"error":...} or {"narrative":""} fail after one call while the message claims two; a top-level number, string or true reaches normaliseReply and crashes on the 'in' operator.

**Suggested fix:** Treat a parsed value that is not an object with a non-empty string narrative as unusable and retry once; word the message from the real attempt count.

## NIT (1)

### Exemplar 4 has a dangling 'either'; exemplar 1 and the bus background use antlers for a kind that does not exist

- **File/lines:** worlds/sundered.js : 781, 784, 64
- **Category:** content-data
- **Confidence:** medium

Exemplar 4 ends 'which is not a question either' after no earlier non-question; exemplar 1 ('a set of antlers sharing the window table') and the 'bus' background (line 64) show antlers, but no listed kind has them except the chimera Dean.

**Suggested fix:** Drop 'either' and replace the antlers with a kind that exists (a dryad's crown of twigs).

