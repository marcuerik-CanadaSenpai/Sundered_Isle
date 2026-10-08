'use strict';
// Checks that are red on purpose: each defines "done" for engine work not yet landed, with the failure it is expected to show. run.js
// lists such a failure as KNOWN RED with the label and does not fail the run; `node audit-fixes.js` with no names does the same. A unit
// on this list that fails any other way (a setup check, a crash, a timeout) is a plain FAIL. Named on its own (node audit-fixes.js
// <name>) it fails as usual. When one passes, run.js says so: take it off this list in the change that makes it green.
const LIST = {
  longUncappedGameKeepsItsWindow: { label: 'known red: a long uncapped game sheds the verbatim window to 1 and drops the lore; green once the prompt shrink lands',
    expect: /^(?:the narrator kept only [0-2] of the 4 verbatim turns set|the lore was dropped on turns )/ },
};
// The entry when this unit's failure message is the one expected of it, else null.
const expected = (id, message) => { const e = Object.prototype.hasOwnProperty.call(LIST, id) ? LIST[id] : null; return e && e.expect.test(String(message || '')) ? e : null; };
// The failure message in a unit's output: the scenario's own line from audit-fixes.js ("FAIL <name> (seed n) - <message>").
const failureIn = (id, out) => { const m = String(out || '').split('\n').map((l) => /^FAIL (\S+) \(seed [^)]*\) - (.*)$/.exec(l)).find((x) => x && x[1] === id); return m ? m[2] : ''; };
module.exports = { LIST, expected, failureIn };
