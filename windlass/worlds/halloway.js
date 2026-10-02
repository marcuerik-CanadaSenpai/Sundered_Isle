// Halloway College of Binding — test world for Windlass (Stage 1).
// This file is DATA. The engine reads it; nothing here is executed except the assignment below.
// Edit text freely. Keys referenced by the engine: id, title, version, premise, rules, world,
// progression, calendar, schedule, player, stats, difficulty, characters, minorCharacters, lore,
// exemplars, trackedItems, initialState, memorySeed, opening, wordBands.

window.WINDLASS_WORLDS = window.WINDLASS_WORLDS || {};
window.WINDLASS_WORLDS.halloway = {
  id: 'halloway',
  title: 'Halloway College of Binding',
  version: '0.7',

  premise: 'Halloway College of Binding stands on the headland above Sallow Reach, where students bond with an animal kin and, over months, take on its aspects. The college calls it the Attunement. You are {name}, nineteen, a first-year. It is why everyone came, and it is the thing everyone is afraid of.',

  // Sent every turn as <rules>. Keep it short. One rule, one place. Positive phrasing.
  rules: [
    'Narration: second person, present tense, addressed to {first}. Grounded and observational. End on an open moment; never end with a question to the player or a line asking what they do next.',
    'Agency: narrate only the action the player stated and its direct consequences. Stop at the next point where {first} would choose. Do not decide, speak or act for {first} beyond the stated action, and do not skip past a moment where {first} would choose.',
    'Perspective: everything is seen from inside {first}. What is new to {first} is called out as new, through the senses beyond sight (smell, sound, touch, warmth, weight) and an inward reaction: a thought, a noticing, a reflex, a thing not said. Not everything is dialogue; a turn can carry a paragraph of looking and thinking. {first}\'s reflexes and sensations are yours; {first}\'s decisions, words and settled feelings are the player\'s.',
    'Player knowledge: {first} knows only what the player has read (the "earlier" notes, the opening, the turns) plus <player>. Never have {first} recognise, name or recall a person, place or fact beyond that; when someone mentions one {first} has not met on the page, make clear who or what it is, or leave it for {first} to ask. Invent no surname, family, past, belongings or opinions for {first}: <player> is the whole of it, and any words given to {first} come from the stated action or what the player knows.',
    'Stopping: a turn ends at the first moment {first} would speak or choose: someone addresses {first}, an offer or a question, arriving somewhere new, a person worth meeting. Never carry {first} through several such moments in one turn (a walk, then a queue, then being served, then sitting down); stop at the first, however short the turn. Ending short is always right; padding never is.',
    'Length: the word band given in <action> is a ceiling, not a quota; use the lower half for transitions and small practical actions, the upper half only when the scene earns it (a new place or person, a confrontation, closeness, a change in the body), and stop short whenever {first} reaches a choice. Open with the direct consequence of the action, then the scene, then one small change or pressure that carries forward. Describe a place in full only the first time {first} sees it; afterwards a line.',
    'Variety: aims are directions, not scripts: a character pursues one by different means each scene and lets it rest for a few turns after {first} answers or ignores a bid. A signature habit (a hum, a gesture, a running joke) appears at most once a scene and not in consecutive turns unless {first} engages with it; each turn shows a different side of the people present (a new topic, a want, a mood, a piece of their day). Do not end consecutive turns on the same image.',
    'Other people: every named character present has an aim this scene (<characters>) and pursues it. Interest is not deference: nobody praises, defers to or confides in {first} without cause shown on the page. Nobody knows anyone they share no class, club, dorm or event with. Clubs, stalls and places are run by the people in <characters>; invented extras are walk-ons, never leaders or rule-makers.',
    'Outcomes: when <action> gives a roll, the evaluation states the difficulty and decides success, partial or failure from the total. A failure has a visible cost this turn; do not soften it. When there is no roll, narrate the natural consequence.',
    'Attunement: stage and progress change only by the triggers in <progression>, through state_updates. When {first} swallows reach-salt, set flags.salt_taken_this_turn true; the engine applies the progress and fever, so do not add progress yourself. Physical change is described only in a turn where <progression> says the stage has advanced. Nothing reverses. Never mention stages, progress, numbers or engine terms in the narrative.',
    'What people know: every character knows only what they could plausibly have seen or been told. Nobody notices a change in {first} before {first} has; afterwards they notice only what is plainly visible, and they do not name or predict what is happening to {first}. If {first} chooses to ignore a change, nobody presses the subject.',
    'Time: the clock in <clock> is authoritative. Report the minutes that pass in time_advance_minutes (10 to 120 in a normal scene; more only for sleep or travel). Respect the bell schedule; if a bell would ring during the scene, it rings.',
    'Consistency: contradict nothing in <state>, <clock>, <timeline> or <recent_turns>. If the action assumes something false, the narrative corrects it in-world.',
    'Attitudes: an attitude value moves at most one point per turn and only for a cause shown in the narrative.',
    'Fresh detail: show people and places through details and images not already used in <recent_turns> or <style_examples>.',
    'Suggested actions are things {first} would plausibly do next, in keeping with the personality in <player>: ordinary, specific, sensible options with different aims, never stunts or whimsy. When {first} speaks in the narrative because the action implies it, the words fit that personality.',
    'Content: no sexual content. Violence at the level of a school story. secret_info holds only facts the player does not yet know, 60 words at most, no backstory padding.'
  ],

  // Sent every turn as <world>.
  world: [
    'Halloway College of Binding sits on a headland above the harbour town of Sallow Reach. Students spend three years learning binding: forming a bond with an animal familiar, called a kin, and over months taking on aspects of it. First-years are matched with a kin at their first Working, on the third day of term, from the animals Dr Hale keeps in the menagerie; the match is made by the kin as much as by the student.',
    'What advances Attunement: a formal Working in the Long Hall (progress plus 5 to 10); strong emotion while in physical contact with the kin (plus 2 to 5); sleeping with the kin in the room (plus 1 per night); reach-salt (plus 30 to 40 over three days, with fever). What slows it: a full day separated from the kin, which also causes distress in both. Nothing reverses it.',
    'Factions. The Wardens are faculty, all deep-turned, who regulate the pace of student Attunement and punish acceleration. The Quiet Table is a student society that argues for slowing Attunement and choosing a stopping stage; it meets in the old laundry on Fridays after study hall. The Tidal Club is an informal group that wants to reach Stage 3 or 4 fast, trades reach-salt, and meets on the sea stairs after curfew. Sallow Reach townsfolk are civil to unbound and lightly marked students and cold to anyone visibly turned; the constable, Aldous Pike, takes an interest in students seen at the tidal caves.',
    'Places. The front court, with the bursar\'s table on arrival days. The dormitory wing, with east and west stairs; first-years room on the third floor, two to a room. The Long Hall, a bare vaulted room with a stone circle set into the floor. The menagerie, a walled yard behind the kitchen garden with open pens and a warm brick shed for the smaller kin. The refectory. The library, which holds the bond registers. The north lecture room. The old laundry. The sea stairs, which run from the kitchen garden down to the shingle and the tidal caves.'
  ],

  // Sent every turn as <progression>, with the current stage marked by the engine.
  progression: {
    name: 'Attunement',
    stateKey: 'attunement_stage',
    progressKey: 'attunement_progress',
    maxProgressPerTurn: 12,
    stages: [
      { n: 0, name: 'unbound', text: 'No kin. Ordinary senses.' },
      { n: 1, name: 'bound', text: 'Student and kin share senses in dreams; a tug behind the eyes when the kin is near.' },
      { n: 2, name: 'first marks', text: 'Eye colour shifts toward the kin; teeth or nails change slightly; hearing or smell sharpens. Passes unnoticed in a crowd.' },
      { n: 3, name: 'half-turned', text: 'Visible features: ears, a tail, fur patches or scales, altered gait. Passes in a coat and hat.' },
      { n: 4, name: 'deep-turned', text: 'Predominantly animal-featured; speech and reason intact. Most Wardens are Stage 4.' },
      { n: 5, name: 'fully turned', text: 'Rare. The student leaves the college and is not spoken of.' }
    ],
    advanceText: 'Within a stage, progress runs from 0 to 100. At 100 the next stage begins: two to three days of fever and sleeplessness, then the new marks. Between advances, nothing visible changes.'
  },



  namePools: {
    first: ['Wren', 'Ada', 'Tam', 'Isolde', 'Bram', 'Cass', 'Edwin', 'Merry', 'Piers', 'Sable', 'Jory', 'Hester', 'Anwen', 'Simeon', 'Rook', 'Lys', 'Petra', 'Colm', 'Tamar', 'Ola'],
    last: ['Calloway', 'Fenwick', 'Marlow', 'Ashby', 'Penrose', 'Kell', 'Harrow', 'Vane', 'Lund', 'Ostler', 'Pryce', 'Duffy', 'Kell', 'Ferrier', 'Brandt', 'Weiss']
  },
  personalityPool: [
    'Quick to read people and slow to trust them.',
    'Steady, plain-spoken, uneasy with anything that cannot be worked out by hand.',
    'Frightened of the higher stages and drawn to them anyway.',
    'Cheerful on the surface, homesick underneath, determined not to say so.',
    'Sharp-tongued, loyal, keeps a list of people who have been fair to them.'
  ],

  // Character creation (no roommate choice in this world: Tobias is fixed).
  creation: {
    nameDefault: 'Wren Calloway',
    genders: [
      { key: 'nonbinary', label: 'Unstated (they)', noun: 'first-year', pronouns: { they: 'they', them: 'them', their: 'their', theirs: 'theirs' } },
      { key: 'female', label: 'Woman', noun: 'woman', pronouns: { they: 'she', them: 'her', their: 'her', theirs: 'hers' } },
      { key: 'male', label: 'Man', noun: 'man', pronouns: { they: 'he', them: 'him', their: 'his', theirs: 'his' } }
    ],
    backgrounds: [
      { key: 'market', label: 'A mainland market town', text: 'From a mainland market town, one bag, a mended coat. Came to Halloway because the alternative was the counting-house.' },
      { key: 'fishing', label: 'A fishing village down the coast', text: 'From a fishing village down the coast that has sent one student to Halloway before and does not talk about her.' }
    ],
    traits: { composure: 'composed under pressure', wit: 'quick-witted', vigour: 'strong and tireless', empathy: 'reads people well', craft: 'good with hands and tools' }
  },

  calendar: {
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },

  // Bells. "days" limits an entry to certain weekdays; "slot" names the period that begins at that bell.
  schedule: [
    { time: '06:30', name: 'rise bell', slot: 'rise' },
    { time: '07:00', name: 'breakfast, refectory', slot: 'breakfast' },
    { time: '08:00', name: 'Working, Long Hall (first-years)', slot: 'working', days: ['Monday', 'Wednesday', 'Friday'], notable: true },
    { time: '08:00', name: 'morning free', slot: 'morning', days: ['Tuesday', 'Thursday', 'Saturday', 'Sunday'] },
    { time: '09:00', name: 'arrival registration, front court', slot: 'arrival', day: 1, notable: true },
    { time: '10:00', name: 'lecture, Theory of Bonds, north lecture room', slot: 'lecture', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], notable: true },
    { time: '10:00', name: 'late morning free', slot: 'morning', days: ['Saturday', 'Sunday'] },
    { time: '12:00', name: 'midday meal, refectory', slot: 'midday' },
    { time: '13:30', name: 'kin-care at the menagerie, all years', slot: 'kincare' },
    { time: '15:30', name: 'free hours', slot: 'free' },
    { time: '18:00', name: 'evening meal, refectory', slot: 'supper' },
    { time: '19:30', name: 'study hall, library', slot: 'study' },
    { time: '22:00', name: 'lights and curfew; prefects walk the wings until 23:00', slot: 'night' }
  ],

  player: {
    name: 'Wren Calloway',
    description: 'Nineteen, from a mainland market town, one bag, a mended coat. Quick to read people and slow to trust them. Came to Halloway because the alternative was the counting-house.',
    stats: { composure: 3, wit: 4, vigour: 2, empathy: 4, craft: 2 }
  },
  stats: { composure: 'Composure', wit: 'Wit', vigour: 'Vigour', empathy: 'Empathy', craft: 'Craft' },
  difficulty: { Trivial: 4, Easy: 6, Medium: 7, Hard: 9, Legendary: 11 },

  // Major characters. "brief" goes in every prompt; "sheet" only when the character is present or was in the last turns.
  // "aims" and "where" are looked up by schedule slot, falling back to "default".
  characters: [
    {
      key: 'marsh', name: 'Professor Adaline Marsh', race: 'Heron kin',
      brief: 'Warden of first-years. Stage 4, heron: long neck, grey plumage at the temples, unblinking.',
      sheet: 'Warden of first-years, Stage 4 (heron). Regulates first-year Attunement to twenty minutes of Working three times a week and punishes acceleration. Lost two students of her own year to Stage 5 and does not discuss it. Speaks precisely, waits out silences, remembers everything said in her lecture room.',
      where: { default: 'her rooms in the Wardens\' house', arrival: 'the front court, at the bursar\'s table', working: 'the Long Hall', lecture: 'the north lecture room', breakfast: 'the Wardens\' end of the refectory', midday: 'the Wardens\' end of the refectory', kincare: 'the menagerie, briefly', night: 'her rooms' },
      aims: { default: 'keep first-year Attunement slow and find out who is bringing reach-salt up the sea stairs', working: 'hold every first-year to twenty minutes and watch for anyone pushing past it', lecture: 'teach; notice who asks about the higher stages' }
    },
    {
      key: 'tobias', name: 'Tobias Fen', race: 'Human',
      brief: 'Eighteen, first-year, {first}\'s roommate. Stage 0 on arrival. Talks fast, wants a friend and a shortcut.',
      sheet: 'Eighteen, first-year, from Sallow Reach itself, which he does not advertise. Wants to be deep-turned before his second year so that the town cannot claim him back. Will be drawn to the Tidal Club within days. Generous, evasive when cornered, bad at pretending he is not waiting for something.',
      where: { default: 'wherever {first} is, or the sea wall', night: 'Room 11, third floor, west stair, or out after curfew', study: 'the library, not studying' },
      aims: { default: 'make {first} an ally and find a faster way up the stages', kincare: 'be near the corvid pens', night: 'get out to the sea stairs without being seen' }
    },
    {
      key: 'ines', name: 'Ines Varga', race: 'Pine marten kin',
      brief: 'Twenty, second-year, pine marten kin. Stage 3: dark ears, a tail she binds under her coat. Quiet Table.',
      sheet: 'Second-year, Stage 3 in fourteen months, which she regrets and does not say. Leads the Quiet Table in practice if not in name. Recruits first-years who look frightened rather than eager. Direct to the point of rudeness. Knows who is in the Tidal Club and has not told the Wardens.',
      where: { default: 'the west stair half-landing or the old laundry', lecture: 'the second-year rooms', kincare: 'the menagerie, marten pen', study: 'the library, back table' },
      aims: { default: 'find out whether {first} is frightened or stupid, and if frightened, recruit', kincare: 'keep her marten away from the corvid pens' }
    },
    {
      key: 'hale', name: 'Dr Corwin Hale', race: 'Human',
      brief: 'Menagerie keeper, unbound by choice. Keeps a ledger of every kin.',
      sheet: 'Menagerie keeper, fifties, unbound by choice and unbothered by the fact. Weighs every kin weekly and writes it down. Has noticed the corvid kin going lethargic and suspects something they are eating on the shingle. Likes students who ask about the animals and not about themselves.',
      where: { default: 'the menagerie shed', night: 'his cottage by the kitchen garden' },
      aims: { default: 'work out what is wrong with the corvid kin and keep students\' kin off the sea stairs', kincare: 'get every kin weighed and every student to do the care properly' }
    },
    {
      key: 'quill', name: 'Marta Quill', race: 'Human',
      brief: 'Bursar\'s clerk, from Sallow Reach, unbound. Suspicious of students in general.',
      sheet: 'Bursar\'s clerk, from the town, unbound and intending to stay so. Handles the register slips, fees and the post. Has a cousin who was turned and does not come home. Treats every student as a bill about to go unpaid.',
      where: { default: 'the bursar\'s office off the front court', night: 'home in Sallow Reach' },
      aims: { default: 'get the paperwork signed and the students out of her office' }
    },
    {
      key: 'thorne', name: 'Elias Thorne', race: 'Red stag kin',
      brief: 'Twenty-one, third-year prefect of the west wing, red stag kin. Stage 4: antler buds under a cap, heavy shoulders, horizontal pupils.',
      sheet: 'Third-year prefect, Stage 4 (stag). Exact and not cruel. Keeps a small notebook and writes in it in front of people. Marsh has asked him to find out who uses the sea stairs after curfew. Wants a name, not a confrontation. Can smell reach-salt on a coat.',
      where: { default: 'the third-year rooms or the west stair', night: 'walking the west wing until 23:00', study: 'the library, front table' },
      aims: { default: 'learn who has been on the sea stairs; note anything worth noting', night: 'catch nobody, but see everyone' }
    }
  ],

  minorCharacters: 'Minor characters who may be mentioned and may speak a line, but should not be given speeches: Petra Lund (first-year, will bond an owl, Quiet Table), Simeon Ash (first-year, hare), Bram Ostler (second-year, badger, Stage 3, Tidal Club, said to be a salt runner), Cook Adair (refectory), Nan Petherick (laundress, unbound, hears everything), Father Lowe (town chaplain, disapproves of the college), Aldous Pike (constable), Dov Merrin (ferryman, seven and seventeen bells), Lys Gorran (third-year, seal, Stage 4, rarely on land), Hester Vane (librarian, cat, Stage 3), Rook Tamsin (second-year, jackdaw, Stage 2, Tidal Club), Anwen Pryce (first-year, hedgehog), Colm Duffy (groundsman, unbound), Sela Marchetti (second-year, lynx, Stage 3, Quiet Table), Edric Hollis (third-year, boar, Stage 4, prefect of the east wing), Tamar Weiss (first-year, heron, Marsh\'s favourite), Ola Brandt (physician, up from town on Thursdays), Jory Kell (second-year, otter, Stage 3), Maud Ferrier (bursar), Piet Vos (first-year, goat, homesick), Ruth Callender (second-year, hound, Stage 3, Tidal Club), Silas Orme (Warden of second-years, wolf, Stage 4), Greta Solvang (Warden of third-years, bear, Stage 4), Iver Nansen (kitchen boy, unbound, runs errands to town).',

  // Keyword blocks. "keys" are matched case-insensitively against the action, the director note and the recent turns.
  // A key ending in * matches any word starting with it. "constant" entries are always sent. Higher priority wins when the budget is tight.
  lore: [
    {
      name: 'the menagerie and the unmatched kin', keys: ['menagerie', 'Hale', 'pen', 'kin-care', 'shed', 'fox', 'raven', 'match*'], priority: 6,
      text: 'The menagerie is a walled yard behind the kitchen garden with open pens for the larger kin and a warm brick shed for the small ones. Dr Hale keeps a ledger of every kin\'s weight, appetite and temper. Unmatched animals this term include a marsh fox called Sable (small, dark-pointed, watchful, avoids the corvid pens), a raven called Coil (bold, loud, already off his food), an owl, a hare, a hedgehog, a goat and a young heron. Students are matched at their first Working; the animal chooses as much as the student does, and Hale will say so to anyone who asks for a particular one.'
    },
    {
      name: 'Long Hall Working', keys: ['Working', 'Long Hall', 'circle', 'cadence'], priority: 6,
      text: 'A Working is held in the Long Hall: students stand in the stone circle with their kin in contact, a Warden reads the binding cadence, and the pull begins as warmth along the spine and a doubling of the senses. First-years are held to twenty minutes. At a first Working the unmatched animals are brought in and released inside the circle; the match is made when one comes to a student and stays. Students at Stage 2 typically feel their kin\'s attention as a second gaze in the room. Leaving the circle mid-cadence causes a headache that lasts until evening.'
    },
    {
      name: 'reach-salt', keys: ['salt', 'twist of paper', 'grey powder', 'caves', 'faster way'], priority: 8,
      text: 'Reach-salt is a coarse grey salt scraped from the walls of the tidal caves below the sea stairs, where the bond-currents pool at low water. A pinch dissolved on the tongue drives Attunement forward by 30 to 40 progress points over three days, with fever, vivid shared dreams and, in about one case in ten, a stage jump that the student does not stop at. Possession is grounds for expulsion. The Tidal Club trades it in twists of grey paper; the going price is a favour, not money. Bram Ostler is said to bring it up. Wardens and deep-turned prefects can smell it on the breath or a coat for a day.'
    },
    {
      name: 'curfew and prefects', keys: ['curfew', 'prefect', 'Thorne', 'knock', 'lights', 'after hours'], priority: 7,
      text: 'Curfew is 22:00. Prefects walk the wings until 23:00 and may enter any room with a knock and a count of three. A first curfew strike is a warning recorded in the bond register; a second is a day of kin-separation, which stalls Attunement and leaves both student and kin sick and frantic; a third goes to the Wardens. Prefects also report reach-salt and sea-stairs traffic.'
    },
    {
      name: 'Sallow Reach', keys: ['town', 'ferry', 'harbour', 'Pike', 'Sallow Reach', 'inn', 'Ferryman'], priority: 5,
      text: 'Sallow Reach is a grey harbour town of fish sheds and chandlers. The ferry to the mainland leaves at seven and seventeen bells. The Ferryman\'s Rest serves students in the back room only. Constable Pike walks the shingle at low water and notes students coming off the sea stairs. Townsfolk call the deep-turned "the tenants" and do not say it to their faces.'
    },
    {
      name: 'the bond registers', keys: ['register', 'library', 'Vane', 'record', 'slip'], priority: 4,
      text: 'The library keeps a bond register for every student: kin, stage, dates of each advance, curfew strikes and Warden notes. Students may read their own register with the librarian, Hester Vane, present. The registers of students who reached Stage 5 are kept in a locked case and are not lent.'
    },
    {
      name: 'the sea stairs and the caves', keys: ['sea stairs', 'shingle', 'tide', 'low water', 'cave*'], priority: 6,
      text: 'The sea stairs run from the kitchen garden gate down the cliff to the shingle. At low water the tidal caves open at the foot of them; the walls inside are crusted grey with reach-salt and the air tastes of iron. The stairs are unlit, steep and slick, and a fall on them has killed a student before now. Hale believes the corvid kin have been eating something on the shingle that is doing them harm.'
    },
    {
      name: 'a stage advance', keys: ['fever', 'sleepless', 'advance*', 'new marks'], priority: 9,
      text: 'When Attunement crosses into a new stage the student runs a fever for two to three days, sleeps badly, dreams as the kin, and wakes with the new marks: at Stage 1 nothing visible, only the tug; at Stage 2 the eyes, the teeth, a sharpened sense; at Stage 3 ears, a tail, fur or scales, a changed gait; at Stage 4 the face and frame. The kin is restless and clingy throughout. Wardens expect to be told; most students tell them late.'
    }
  ],

  // Two are sampled each turn to anchor density and register. Add more; vary them.
  exemplars: [
    'The refectory has emptied to its last dozen and the long tables carry only crumbs and the cold-fat smell of the morning. Tamar Weiss is still at the Warden\'s end, writing, her sleeve dragging through spilled tea, and she does not look up when you pass. Outside the tall windows the headland grass lies flat under the wind and the gulls hang without moving.',
    'You feel the fox before you see her: a tug behind the eyes, then the animal herself at the turn of the stair, one paw lifted, listening to something in the wall. When you crouch she comes to your knee and puts her nose against your wrist, and the corridor doubles for a moment, your own dull hearing under hers, mice somewhere in the plaster, a door two floors down.',
    'Hale does not stop writing when you come in. "Shut that," he says, meaning the shed door, and you shut it, and the warmth closes around you with the smell of straw and the sharper smell of the birds. He finishes the line and underlines something and only then looks up, and his eyes go to your hands before your face, as if that is where students keep their reasons.',
    'The west stair takes the wind from the sea side and it is always colder than the east, which is why nobody uses it and why Ines Varga does. She is on the half-landing with her boots on the step below and her coat buttoned to the throat. She does not stand. "Calloway," she says, as if reading it off a list.',
    'Night in the wing is not quiet. The building ticks as it cools, somebody two rooms down is talking in their sleep in a voice that is not entirely a voice, and under it all, faint and regular, are Thorne\'s boots on the boards, going the length of the corridor and coming back.'
  ],

  // Tracked items. visibility: player (shown and sent), ai (sent, hidden from the player unless revealed), player-only (shown, not sent).
  // mode: auto (the model may update it), code (only the engine changes it), manual (only the player edits it).
  trackedItems: [
    { key: 'attunement_stage', label: 'Attunement stage', type: 'number', min: 0, max: 5, visibility: 'player', mode: 'code', spoiler: true },
    { key: 'attunement_progress', label: 'Progress in stage', type: 'number', min: 0, max: 100, visibility: 'player', mode: 'auto', spoiler: true },
    { key: 'kin', label: 'Kin', type: 'text', visibility: 'player', mode: 'auto', maxChars: 80 },
    { key: 'kin_mood', label: 'Kin mood', type: 'text', visibility: 'player', mode: 'auto', maxChars: 40, spoiler: true },
    { key: 'fever', label: 'Fever', type: 'bool', visibility: 'player', mode: 'code', spoiler: true },
    { key: 'reach_salt_possessed', label: 'Reach-salt (pinches)', type: 'number', min: 0, max: 9, visibility: 'ai', mode: 'auto' },
    { key: 'curfew_strikes', label: 'Curfew strikes', type: 'number', min: 0, max: 3, visibility: 'player', mode: 'auto' },
    { key: 'inventory', label: 'Carrying', type: 'list', visibility: 'player', mode: 'auto', maxItems: 20 },
    { key: 'fever_days_remaining', label: 'Fever days left', type: 'number', min: 0, max: 5, visibility: 'ai', mode: 'code' }
  ],

  initialState: {
    day: 1, weekday: 'Saturday', time: '09:10',
    location: 'Front court, Halloway College',
    present: ['{first}', 'Professor Adaline Marsh', 'Marta Quill', 'Tobias Fen'],
    items: {
      attunement_stage: 0, attunement_progress: 0,
      kin: 'none yet; first-years are matched at the first Working on Day 3',
      kin_mood: 'n/a', fever: false, reach_salt_possessed: 0, curfew_strikes: 0,
      inventory: ['one canvas bag', 'a mended grey coat', 'the letter of admission', 'four shillings', 'a pencil stub'],
      fever_days_remaining: 0
    },
    attitudes: { marsh: 5, tobias: 5, ines: 5, hale: 5, quill: 3, thorne: 5 },
    flags: {
      asked_about_stage_five: false, warned_by_ines: false, seen_on_sea_stairs: false,
      knows_bram_supplies_salt: false, offered_salt: false, met_hale: false, register_signed: false,
      salt_taken_this_turn: false
    }
  },

  // Flags the engine acts on. salt_taken_this_turn: set true by the model when the player swallows reach-salt;
  // the engine applies the progress jump and the fever, then clears it.
  codeFlags: { saltTaken: 'salt_taken_this_turn', saltProgress: 35, feverDays: 3 },

  memorySeed: {
    summary: '{name}, nineteen, has just arrived at Halloway College of Binding as a first-year on the first Saturday of term. Nothing else has happened yet.',
    events: [
      'Day 1 07:00 {first} crosses on the seven-bell ferry from the mainland with one bag.',
      'Day 1 09:05 {first} reaches the college gate; the bursar\'s table is set up in the front court for arrivals.'
    ],
    beats: [],
    facts: ['{first} rooms with Tobias Fen in room eleven, third floor, west stair.']
  },

  // Turn 0. Shown when a new adventure starts.
  opening: {
    narrative: 'The ferry left you at the bottom of the town with the fish sheds and the smell, and the road up to the college is longer than it looked from the water. By the time you come through the gate your bag has worn a groove in your shoulder and the wind off the headland has found every thin place in your coat.\n\nThe front court is gravel and puddles. A trestle table stands under the arch out of the worst of it, with a woman behind it in a town coat and a town hat, a ledger open in front of her and a tin cash box with its lid down. She watches you cross the court the way you would watch a dog you did not know. The card propped against the box says BURSAR.\n\n"Name," she says, before you have reached the table.\n\n"{name_last}. {first}."\n\nShe finds it without hurry, turns the ledger toward you and lays a pen across the line. "Sign the register slip. Fees are receipted. Room eleven, third floor, west stair." She does not say welcome, and the pen is cold.\n\nBehind you somebody laughs, high and quick, and a boy your own age comes across the gravel with a bag in each hand and no coat at all, as if the wind were something that happened to other people. He has a townsman\'s face and a student\'s haircut and he is already talking. "Eleven? That is me. Tobias. Fen." He sets the bags down to shake your hand and does not seem to notice that the woman at the table has gone very still at the name. "They give the first-years the rooms over the west stair because nobody else will have them. You will hear the sea all night."\n\nAcross the court, on the steps that lead up into the main building, a tall grey figure has stopped to watch the arrivals. She stands the way a heron stands in shallow water, weight on one leg, neck a fraction too long, perfectly still. The wind moves her sleeves and nothing else. When your eyes meet hers she does not look away and does not nod, and after a moment it is you who looks down, at the pen, at the line with your name beside it.\n\nThe woman at the table taps the ledger once.',
    suggestions: [
      'Sign the slip and ask the clerk where the menagerie is.',
      'Ask Tobias why the clerk went still at his name.',
      'Sign, pick up your bag and go straight to the room.'
    ],
    events: ['Day 1 09:10 {first} meets Marta Quill at the bursar\'s table and Tobias Fen, the assigned roommate for room eleven (third floor, west stair); Professor Marsh watches from the steps.'],
    beats: ['{first} arrived; Quill demanded the register slip; Tobias Fen introduced himself as roommate; Marsh watched from the steps.']
  },

  wordBands: { terse: [180, 320], standard: [240, 460], rich: [360, 640] }
};
