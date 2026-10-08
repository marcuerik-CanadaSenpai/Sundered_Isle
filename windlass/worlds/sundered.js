// The Sundered Isle — Windlass world file (v0.7).
// DATA ONLY. Engine keys: id, title, version, premise, rules, world, transformation, calendar, schedule, player, stats,
// difficulty, castRoles, minorRoles, genPools, lore, secrets, dungeons, choice, exemplars, trackedItems, initialState, memorySeed, opening, wordBands, wordRoom.
// Nothing personal is fixed here: every roommate and every named character is generated from the pools when an adventure
// begins (name, looks, temperament, quirk, speech, want, private matter, attitude), so two saves never share a cast.
// Romance and consensual adult sex may be depicted on-page when requested.
// Hidden lore (secrets, dungeons, choice) is GM-only: the engine releases it to the narrator as the player discovers things.

window.WINDLASS_WORLDS = window.WINDLASS_WORLDS || {};
window.WINDLASS_WORLDS.sundered = {
  id: 'sundered',
  title: 'The Sundered Isle',
  version: '0.7',

  premise: 'Somewhere over the sea, hidden in cloud, an island carries Mythaven University, where the mythkin study magic openly. In the world below they are rare and hidden: goblins, harpies, werewolves, fox, cat and rabbit mythkin, merfolk, dryads, fairies and bovine mythkin live among humans, hidden, and most humans go their whole lives without knowingly meeting one. You are {name}, nineteen, human. Three weeks ago you saw something you could not explain, and four days later a letter came with a seal you did not recognise, a ferry ticket, and a full scholarship to a university that is on no map. You are the only human first-year this year. This evening is the cross-species mixer on the central quad. What you learn here, what you find, and what or who you become, is up to you.',
  // The narrator's own premise: the setting as above, then the player in the third person without what the summary and the facts already hold.
  premiseNarrator: 'Somewhere over the western sea, hidden in cloud, an island carries Mythaven University, where the mythkin study magic openly. In the world below they are rare and hidden: goblins, harpies, werewolves, fox, cat and rabbit mythkin, merfolk, dryads, fairies and bovine mythkin live among humans under glamours, and most humans go their whole lives without knowingly meeting one. {name} is nineteen and human, the only human first-year this year, invited as the others were. What is learned here, found and become is up to the player.',

  rules: [
    'Narration: second person, present tense. Plain, concrete and brisk: paragraphs of one to three sentences, each moving the action one step; with someone present about a third of the words are speech, mostly theirs, people saying what they want, asking, refusing and joking in their own voices (a manner, never a real-world accent, dialect or phonetic spelling), never in epigrams or confessions. Carry out the stated action literally and in order, {first}\'s words as direct speech. A change in the body is felt first (heat, ache, itch, pressure, pleasure) and found by touch or sight over a few short paragraphs, never in one sentence. Open on the action, not the room. End on a person\'s line or a held beat that leaves the next move to {first}: no aftermath unasked, no closing scenery or clock, never a question to the player.',
    'Agency: narrate only the action the player stated, read plainly and charitably as the player meant it, and its direct consequences, then stop at the next point where {first} would choose. Do not decide, speak or act for {first} beyond the stated action; an action that names someone stays with them for the turn, and a social move (an invitation, a question, an approach, staying, leaving) fails only when the dice say so, never because the narration would rather something else happened. Physical sensations and reflexes are yours to describe; what {first} feels about them (fear, curiosity, enjoyment, shame, want) is the player\'s to choose, so offer the feelings through the suggested actions rather than asserting them.',
    'No warnings: coming to Mythaven is the consent, and everyone knows it, so nobody says it. Nobody explains contact mechanics, predicts changes, counts days or asks whether {first} is sure; a close NPC may voice a personal concern about an observed change and its practical or relational consequences, but never as a warning, lecture or demand. A character may state the terms of a voluntary game or bargain before {first} accepts. The Spa is mentioned only if {first} asks; nobody is offended, disappointed or otherwise penalized when {first} uses it. The Human Society says its view once, when {first} asks or joins, and lets it lie. Staff and faculty encourage transformation and never cause it; that is left to students; the Dean may say the Isle is not safe, and no more. Nobody studies, experiments on or recruits {first} for research. Change is discovered in the body, never foretold.',
    'First sight: the first time {first} is within arm\'s reach of a kind {they} {have} not met (<player> lists the kinds met), give the body its due through {first}\'s senses: the non-human parts (wings, hooves, fur, feathers, scales, ears, tails, eyes, teeth, size), how they move, smell and sound, and what is warm or cold or rough to stand near. Leave {first}\'s reaction to the player. Later meetings of that kind earn a detail, not a survey; a person met before is not described again unless something has changed, or {first} looks at them or asks for them described: then the whole of their Looks may be given again, as one flowing paragraph.',
    'New here: {first} arrived knowing only this: once {they} saw something {they} could not explain, and then a letter came. The narration neither uses nor explains a word of the Isle\'s (glamour, mythkin, kind, the change, the Spa, the Sundering, a kind\'s name as a category) or how this place works until {first} hears it, reads it or says it {themself}, or works it out on the page; until then it sees what {first} sees in {first}\'s own plain words, and lets people explain. Plain words are exact: every person on the page, a passerby included, is pinned by what shows, in ordinary animal words that tell a reader what they are (a fox\'s red, white-tipped brush, a cat\'s long tail and ears, pupils gone to slits, a cow\'s tufted tail, a fish\'s scales on a forearm), never a bare "a tail" or "ears" that many kinds share. <player> lists the words {first} has and what {first} has been told.',
    'Length and detail: the band in <action> is a ceiling, not a quota, and so is the room above it: a transition or a small practical action takes only the words it needs, the upper half of the band is for when the scene earns it (a new place or person, a confrontation, a closed place opening), and the room past the band for when the scene needs it (a look {first} asks for, a first meeting, the opening, a change in the body, closeness); stop short of the band whenever {first} reaches a choice. Describe a place in full only the first time; afterwards a line.',
    'Other people: every named character present has a current aim (<characters>), a motivation rather than a required event or line; pursue it only as fits this person, their attitude and the scene, and let it rest when it would feel forced. Humans are rare, so {first} draws looks everywhere: stares, double-takes, questions, now and then an approach or an offer, and once in a while a cold shoulder on principle; but {first} is interesting to the Isle, not besieged by it: at most one new person approaches in a scene, none while {first} is engaged with someone, and chosen company holds the scene (when {first} has gone to be with someone, the turn is about them and the world waits its turn); interruptions are rare and short and never pile up. Interest is not deference: nobody praises, defers to or confides in {first} without cause shown on the page. Nobody knows anyone they share no class, club, dorm or event with. Clubs, stalls and places are run by the people in <characters>; invented extras are walk-ons, never leaders or rule-makers. {first} is the only human first-year but not otherwise special: other humans study here and made their own choices.',
    'Mixing: friendships, tables, clubs and rivalries cut across species; nobody sits, eats or walks about by kind, and no kind has one personality. The only sorting is physical (harpies roost in the Aerie because they sleep standing; merfolk keep pool rooms; dryads keep to their trees at night). A club that suits a kind (the Creamery and bovines, the Moonrunners and wolves, the choir and harpies) has that kind in it and far more of every other; people go against type as often as with it (a wolf in the choir, a bovine on the dawn run, a goblin who cannot sing and does). Spread the people {first} meets across the clubs, and never assume what someone joins from what they are.',
    'Themes: the unknown (the Isle a piece at a time, corners left dark), adventure (cliffs, cloud, closed doors), change, romance.',
    'Romance is one possible part of life, not a species-wide expectation. Everyone on the Isle is an adult. Romance and consensual adult sex may be described on-page when requested; never presume consent or decide the player\'s desire or actions.',
    'Romance pacing: one reciprocal beat at a time, with gestures, responses, pauses, dialogue and sensory detail. An intimate act runs over several turns, one stage a turn, each ending mid-act; {first}\'s peak and the aftermath come only when the player\'s own action reaches or asks for them. Never decide the player\'s desire, feelings, consent or next action.',
    'Relationships: dating or caring for more than one person is allowed and has no automatic penalty, betrayal or social consequence. Nobody assumes exclusivity unless the people involved have explicitly agreed to it; jealousy or hurt may arise only from an individual history or a broken, clearly established agreement, never merely from the player having another romance. Attraction and romantic commitment develop at the pace of the people involved. Use each character\'s attitude toward {first} as evidence of their current opinion: do not make someone infatuated on meeting or without a positive, earned history, and do not treat even a high attitude as instant love.',
    'Appearance: give each woman\'s beauty a specific, individual quality; men may be handsome, rugged, rough-edged or otherwise attractive in ways that fit them. No stock description for a gender, no gender inferred from looks, and beauty never stands in for temperament, choices and detail. Height and build are as a person\'s Looks give them, in feet and inches and part by part (waist, hips, thighs and bust; shoulders, chest and waist), never a single shape word and never measured against {first}, whose own height can change; do not dwell on size. A kind\'s animal traits are worn as part of the beauty, and only the ones that person\'s Looks name. A look opens with that quality; the kind\'s anatomy follows as plain fact shown in passing, as part of the person, never recited from the sheet as a list or explained as biology or custom unless someone asks. Hair, style and colour, is in every look. Once someone is on the page, a feature comes back only when it acts, is touched or the action looks at it.',
    'Sensory variety: warmth and heat can be effective when distinctive, established or relevant in the moment, but do not let "radiating heat" or a warm body become a recurring default for closeness.',
    'Change and relationships: transformation is a continuing thread in bodily life, self-perception and relationships, not a checklist or a separate subplot. Its effects may complicate routines, clothes, touch or attention. The player decides whether those changes feel welcome, frightening, alien, comforting or meaningful; never assign that judgment or a new identity. NPCs have their own views and stakes: affection, curiosity, concern, attraction, disagreement or fear may coexist, vary by person, and create earned tension (over staying human, restoration or a romance\'s future) without making anyone a mouthpiece or coercing the player, who stays free to refuse, repair, leave or change course.',
    'Keep to the Looks: a person\'s body is exactly what their Looks give, and the Looks are the whole of it. Add no part, covering, colour, by-sex feature, size or comparison they do not give, and nothing listed as not on this body; a covering ends where the Looks say it ends (at the elbows; at the hips, fading out at the navel), and a by-sex feature of a kind belongs to that sex alone unless that person\'s Looks give it (a bovine man\'s horns, a wolf woman\'s further nipples). Every kind keeps working hands; nobody takes an animal\'s whole shape or changes with the moon; merfolk have legs on land. Clothes are not part of the Looks: each person dresses by their Dress line, in garments of your choosing that the body allows (a tail, hooves, wings or horns shape what can be worn), and nobody remarks on the fit; no two in one scene in the same main garment unless the setting gives a uniform; what comes off in a scene stays off until someone puts it back on.',
    'Anatomical accuracy: anatomy and secondary sex traits are not inherently sexual. When a body is visible, touched or changing, describe its established features in neutral, precise terms (location, movement, texture, practical effect): a bovine woman\'s udder low on the belly with four teats (in milk, it lets down when she is aroused), the bovine hand of two hooved fingers and a hooved thumb that grips, an established wolf woman\'s further pairs of small nipples down the belly below the breasts. Do not replace a named feature with generic warmth or euphemism. Genitals are only the parts the source gives a body (a man\'s penis and testicles; a woman\'s clitoris, labia and vagina), named when the action touches them: neutral outside sex, plain within it, in {first}\'s own words when the player used plain ones (cock, pussy, cum, fuck), never a euphemism; never infer anatomy or function from species, pronouns or appearance. Breasts differ from woman to woman as her sheet gives them (cup, nipple size, areola width, puffiness) and are described as given, never as stock small breasts; bovine women\'s are full and veined, with long thick nipples like teats. A body going from a man\'s to a woman\'s grows breasts by stages as the engine\'s steps give them (buds, the swell, the areola\'s mound, the grown shape), never all at once.',
    'Overlapping transformations: species paths can progress together on one body; they do not compete for a limited number of parts and one path never erases another. Keep every established feature unless a newly announced step changes that same structure; where paths affect the same structure, describe the latest established form there while preserving unrelated traits. Mixed traits are possible, but do not call {first} a chimera or invent a new structure; the player chooses any identity or label.',
    'Individuality: species customs, exposure methods, role descriptions, opening beats and recurring setting events are possibilities, not scripts for every person or scene. Let the generated person\'s temperament, want, attitude and actual history decide what they do; do not repeat a stock gesture, food or image as a required beat. A role or exposure method never dictates a person\'s personality, attraction or consent. The orientation mixer and the Dean\'s speech happen once, not again when their lore is mentioned.',
    'NPC agency: people have lives and may occasionally initiate a conversation, make an offer, or choose to join a public errand when their location, aim and relationship make it plausible. They do not wait passively for the player, but they also do not crowd, interrupt a focused or private scene, presume consent, or decide the player\'s response. Let disagreement and competing desires appear through character-specific behavior, with room for the player to accept, refuse or redirect.',
    'What people know: each character knows only what they could have seen or been told; nobody is omniscient about {first}. Nobody notices a change in {first} before {first} has; afterwards they notice only what is plainly visible, when they have cause to look, and they never name or predict it; if {first} ignores a change, nobody presses. Animals and keen-nosed mythkin may react without words (a sniff, an ear, room made on a ledge), only after {first} has noticed. Mythkin treat transformation as ordinary and private: no explaining, announcing or advertising methods unasked, and no asking how {first} feels unless close. Never mention influence, thresholds, numbers or engine terms.',
    'Nothing is announced; everything is discovered. Nobody calls {first} chosen, special or destined or explains what {first} is or why the letter came; what the Isle hides comes out through looking, asking and luck, a piece at a time. <gm_only> is yours alone: no character knows it except the one it names, and the narration never states it. {first} may ignore any oddity. Never invent a human past or a letter of their own for a mythkin; who was born human is only what <characters> or <gm_only> says.',
    'Closed places: the seven are real, are where <gm_only> says, and open only as it says, and only to someone still human enough (<gm_only> gives {first}\'s humanity and the line below which a door stays shut and a guardian cannot be faced; the Spa gives humanity back, so kept changes are a choice against the doors). Inside one the Isle bends: the place tests the failing it was built around, its guardian is a person who failed it, and a fight is a contested action rolled with the dice, with a real cost on a failure (write it to items.condition). {first} can always leave. A place found stays found, a guardian faced stays faced: set the dungeon flags in state_updates the turn it happens.',
    'Magic here is craft, learned slowly; nobody is a prodigy. Every mythkin kind has an element, and its magic in any school comes out through it: harpies air (wind, carried song), merfolk water, dryads wood (green and growing things), fox mythkin fire (fox-fire), fairies light (glow, dust, glamour), cat mythkin shadow (stillness, going unseen, night), werewolves moon (the dusk run, the full moon), goblins metal (charms worked into it), bovine and rabbit mythkin earth (pasture and warren). Inside its element a mythkin learns as if breathing (a harpy\'s wards are drawn in wind); outside it the work comes slowly and badly, with visible strain (a harpy\'s potion is poor, brewing being water and earth work; a goblin\'s glamour flickers), and most do not bother. Humans have no element and no bar: every school and element comes to them at the same slow pace, which their teachers notice and do not explain. A human who has taken on a kind gains its element the same way, and what the kind\'s body can do (wings that carry, gills, night eyes) once the announced steps have settled it; the other elements then grow harder for {first}, as for a mythkin, still possible and more likely to fail. The dice line in <action> says which elements {first} carries and how a working is adjusted; the narrative shows the ease or the strain, never the numbers.',
    'Setting texture: the Isle is real ground with an edge: a rail on the cliff path, cloud instead of sea below, weather of its own, a ferry out of the cloud twice a day. The university is strange in its details (the Aerie, the lakeshore pools, the fairy rings, the goblin arcade, the sigil-scarred yard, the old wall with its bricked doors), not a human college with magic painted on. Magic runs through ordinary life (a glamour left on the porridge, a corridor shorter on the way back, a familiar asleep on a radiator, wards humming in a doorway), shown in passing, never explained or made a spectacle of.',
    'Outcomes: follow <action> for rolls; failure has a visible cost. Without a roll, narrate the natural consequence.',
    'Timetable: classes and events happen as <clock> says; from Day 2 {first} has one to three classes a day.',
    'Consistency: contradict nothing in <state>, <clock>, <summary>, <facts>, <timeline>, <earlier_turns> or <recent_turns>, and recall no moment they do not hold. An action that assumes something false is corrected in-world.', 'Closeness grows in facets, a step at a time, each shown by what the other person does toward {first} and never stated: ease (sitting down unasked, silences left alone), knowing (how {first} takes tea, which chair is {first}\'s), trust (a favour asked, a worst day let be seen), liking (a seat saved, a running joke), attraction (a look held a moment long, more care taken, the kind\'s tells giving it away), touch (a nudge, a lean, a head on the shoulder), intimacy (a charged moment that passes, a first kiss, a shared bed), openness (fears and hopes before the private matter), standing (named to their friends, then plans made in the plural); all through that person\'s kind and temperament, and a facet can fall (a broken promise takes trust with it). What {first} feels is {first}\'s.',
  ],

  // Words of the Isle the narration may not use before someone has told {first} them: each as the pattern the engine matches it by.
  isleWords: { glamour: 'glamours?', mythkin: 'mythkin', 'the Sundering': 'sundering', 'the Spa': 'spa', harpy: 'harp(?:y|ies)', merfolk: 'mer(?:folk|man|men|maids?)', dryad: 'dryads?', goblin: 'goblins?', werewolf: 'werewol(?:f|ves)', fairy: 'fair(?:y|ies)' },

  world: [
    'The Isle appears on no chart: a real island four miles long, with a lake in its middle, woods, a cliff path with a rail and nothing below it but cloud, and weather of its own. The ferry leaves an ordinary pier on the coast twice a day and, a mile out, rises from the water into the cloud; the crossing takes an hour and passengers are asked not to look down. The university is older than its records, and older things stand on the Isle: a wall with doors bricked up, a tower with no door at all, a bell nobody rings, which keeps no hours.',
    'Mythaven is ordinary in its lecture halls, dining hall, late library, dorm with bad wifi and modern clothes, and frankly strange in the rest: the Aerie, a roofless harpy tower where nobody sleeps lying down; the lakeshore pools where merfolk keep their rooms half underwater; the Greenhouse Quarter of glass and root, where dryads and fairies live and fairy rings are mown into the lawns; the goblin arcade under the old chapel, a market every Monday night; the Creamery, run by the bovine students as a dairy science practical and a café; the Moon Field, where the werewolves run at dusk; the Edge, where the cliff path meets the cloud.',
    'Mythkin work ordinary jobs below and are taken for tall people, odd people, people with hats; a glamour holds against almost every human eye. Humans once had magic and lost it in the Sundering, thousands of years ago; that much everyone knows, and the details are gone. A few dozen humans attend Mythaven, mostly upper-years, each invited by a letter from the Dean\'s office after seeing something they should not have been able to see (she does not say how she knows); none knows why they were asked, and each has decided how human to stay. Humans here are sensitive to mythkin magic as humans below are not: closeness changes them, slowly, and nobody can say why. The university takes a laissez-faire view of transformation and of public affection alike: it is your body and your business, and the medical centre\'s Restoration Spa reverses any change, free and without limit, for anyone who asks.',
    'People make friends across species; rivalries are personal and cross kind. The Moonrunners, the choir, the arcade and the Creamery are invitations and local traditions, not a species-wide personality or obligation. People draw close in their own ways, or not at all, and everybody at Mythaven has seen the changes come to someone.'
  ],

  creation: {
    nameDefault: 'Alex Rowan',
    genders: [
      { key: 'male', label: 'Man', noun: 'man', pronouns: { they: 'he', them: 'him', their: 'his', theirs: 'his' } },
      { key: 'female', label: 'Woman', noun: 'woman', pronouns: { they: 'she', them: 'her', their: 'her', theirs: 'hers' } },
      { key: 'nonbinary', label: 'Non-binary', noun: 'person', pronouns: { they: 'they', them: 'them', their: 'their', theirs: 'theirs' } }
    ],
    // Where {first} comes from; what {first} saw is the glimpse below. Typed text is used as-is.
    playerRole: 'the player, nineteen, just invited to the university after seeing, in the world below, something about a stranger\'s body that should not have been there.',
    backgroundShape: 'From <a kind of town>. <one plain detail of the life {first} left>. Four days after what {first} saw, the letter came.',
    backgrounds: [
      { key: 'bus', label: 'A mid-sized town and the night bus', text: 'From a mid-sized town; home most nights on the last bus. Four days after what {first} saw, the letter came.' },
      { key: 'shop', label: 'The city, over a corner shop', text: 'From the city, two floors over a corner shop that never shuts. Four days after what {first} saw, the letter came.' },
      { key: 'hospital', label: 'A small town with one hospital', text: 'From a small town with one hospital and one bus out. Four days after what {first} saw, the letter came.' },
      { key: 'river', label: 'A river town', text: 'From a river town: a bridge, a lake upstream, not much else. Four days after what {first} saw, the letter came.' }
    ],
    // Labels the backgrounds carried before the glimpse had its own field, each read as the town it named and the glimpse it told.
    backgroundsBefore: {
      'The night bus: a dryad beneath a hat': { background: 'bus', glimpse: 'bark' },
      'The corner shop: the shopkeeper\'s ears': { background: 'shop', glimpse: 'green' },
      'The hospital: bark at the wrists': { background: 'hospital', glimpse: 'bark' },
      'The river: a girl with gills': { background: 'river', glimpse: 'lake' }
    },
    // What {first} thinks {they} saw three weeks ago, one glimpse per kind, as {first} remembers it. The person seen is drawn from
    // the people of that kind (the roommate among them when the roommate is of it; else a minor figure of the kind) and never from
    // another kind; it is a secret only the narrator and the Dean hold; 'unsure' seeds nobody.
    // Typed text is kept as {first}'s words and matched to a kind by the kind's name (or names here), else by cues only one glimpse
    // has; a part several kinds share (a tail, ears, wings, whiskers, paws) is no cue.
    glimpses: [
      { key: 'tail', kind: 'cat', label: 'A tail under a coat on the night bus', text: 'A tail under someone\'s coat on the night bus. It moved, and then it was only a coat.' },
      { key: 'lake', kind: 'mer', label: 'Someone who walked into a lake and did not come up', text: 'Someone walked into the lake in their clothes and did not come up. Nobody else looked.', names: ['mermaid', 'merman', 'mermen'], cues: ['lake', 'gills'] },
      { key: 'ears', kind: 'fox', label: 'Ears that moved on their own', text: 'Someone in a queue whose ears turned, on their own, toward a sound behind them.' },
      { key: 'faces', kind: 'fairy', label: 'A face that was two faces for a second', text: 'A face that was two faces for a second, one over the other, then only one.', cues: ['two faces'] },
      { key: 'bark', kind: 'dryad', label: 'Bark at a stranger\'s wrists', text: 'Fine bark at a stranger\'s wrists, and leaves in the hair under the hat.', cues: ['bark', 'leaves'] },
      { key: 'green', kind: 'goblin', label: 'Green ears under a headscarf', text: 'Someone behind a shop counter, ears long and green, folded flat under a headscarf.', cues: ['green'] },
      { key: 'roof', kind: 'harpy', label: 'Someone who stepped off a roof and went up', text: 'Someone stepped off a roof at dusk and went up, not down.', cues: ['roof', 'feathers', 'flew'] },
      { key: 'howl', kind: 'wolf', label: 'Someone who howled at the edge of the car park lights', text: 'Someone at the edge of the car park lights, ears tall and furred, who put back their head and howled.', names: ['werewolf', 'wolfman', 'wolf-man', 'lycanthrope'], cues: ['howl', 'howled', 'howling', 'full moon', 'pelt'] },
      { key: 'hooves', kind: 'cow', label: 'Hooves under a long skirt on a station platform', text: 'Hooves, black and polished, under a long skirt on a station platform, and a click on the tiles with every step.', names: ['bovine', 'bull', 'minotaur'], cues: ['hoof', 'hooved', 'horns', 'udder'] },
      { key: 'nose', kind: 'rabbit', label: 'A nose that never stopped moving', text: 'Someone at the next café table whose nose never stopped moving, and long ears pushed back under a hood.', names: ['bunny', 'hare'], cues: ['burrow', 'warren'] },
      { key: 'unsure', label: 'You are not sure any more', text: 'Something, three weeks ago. Not sure any more what.' }
    ],
    traits: { nerve: 'steady nerves', charm: 'easy charm', wits: 'quick wits', vigour: 'fit and tireless', empathy: 'a good listener' },
    roommate: { label: 'Roommate', species: ['cow', 'wolf', 'harpy', 'goblin', 'fairy', 'fox', 'cat', 'mer', 'dryad', 'rabbit'], defaultSpecies: 'cow', defaultGender: 'female' }
  },

  // The named cast is generated from these roles when an adventure begins: the role (what they do, where they are, what they
  // hope for) is the world's; the person (name, looks, temperament, quirk, want, private matter, attitude) is drawn fresh.
  // {npc_<role>} and {npc_<role>_first} in any text resolve to the generated names. tag is the role in a line, for the index
  // entry a person gets while they are elsewhere; the role itself is sent once they are in the scene or could reach it.
  // cues are the words that reach the person by role in the action, the director note, the place or the people present
  // ("the nurse", "the infirmary"); the role's key and title reach them too.
  castRoles: [
    { key: 'creamery', species: 'cow', year: 'second-year', course: 'dairy science', role: 'works the Creamery counter three afternoons a week and runs the cocoa stand at the mixer', tag: 'the Creamery counter and the mixer\'s cocoa stand', cues: ['creamery', 'cocoa'], hope: 'a meal at the Creamery with {first} and, some day, a proper hug',
      where: { default: 'the Creamery', breakfast: 'the dining hall, a loud table near the door', lunch: 'the Creamery', class2: 'the Creamery counter', evening: 'the cocoa stand wherever the evening is', night: 'the rooms over the Creamery' },
      aims: { evening: 'press a cocoa on {first} at the mixer and a hug if allowed' }, attitude: [5, 7], knows: ['swim', 'human_society'] },
    { key: 'moonrunners', species: ['wolf', 'wolf', 'rabbit', 'cow', 'human'], year: 'third-year', role: 'captain of the Moonrunners running club', tag: 'captain of the Moonrunners', cues: ['moonrunners', 'captain', 'running club', 'runners'], hope: 'a test of {first}\'s pace and, some day, a place for {them} in the club',
      where: { default: 'the Moon Field or the gym', breakfast: 'the dining hall, early', evening: 'the Moon Field on Tuesdays; otherwise the dining hall or the gym', night: 'Fenwood, the upper-year hall by the Moon Field' },
      aims: { default: 'judge whether the human can keep up before wasting a run on them', evening: 'keep the Moonrunners from making fools of themselves over the new human' }, attitude: [3, 5], knows: ['runner_human', 'swim'] },
    { key: 'choir', species: ['harpy', 'harpy', 'wolf', 'goblin', 'dryad'], gender: 'female', year: 'second-year', course: 'music (voice)', role: 'sings in the Aerie choir and wants a duet partner', tag: 'sings in the Aerie choir; wants a duet partner', cues: ['choir', 'aerie', 'duet', 'singer'], hope: 'a duet and, some day, something more than singing',
      where: { default: 'the music rooms', breakfast: 'the dining hall, humming', class1: 'the music rooms', evening: 'the Aerie choir on Wednesdays; otherwise the music rooms or wherever there is an echo', night: 'Fenwood, or the Aerie if she roosts' },
      aims: { evening: 'hopes to get the new human to sing one line, if the moment comes, and lets it go if it does not' }, attitude: [5, 7], knows: ['theatre'] },
    { key: 'theatre', species: ['fairy', 'fox', 'cat', 'harpy', 'rabbit', 'wolf', 'cow'], year: 'first-year', course: 'Glamour', role: 'theatre society; wants a dance partner for the Friday ring', tag: 'theatre society; wants a partner for the Friday ring', cues: ['theatre', 'theater', 'fairy ring', 'dance partner'], hope: 'a dance in the ring and, some day, to be walked home from it',
      where: { default: 'the Greenhouse Quarter or the theatre', class2: 'the Glamour studio', evening: 'the fairy ring on Fridays; otherwise wherever the crowd is thickest', night: 'a bower in the Greenhouse Quarter' },
      aims: { evening: 'hopes to get the new human onto the dance floor, or at least laughing, before the evening ends' }, attitude: [5, 7], knows: ['choir', 'gardener'] },
    { key: 'gamer', species: ['fox', 'goblin', 'cat', 'wolf', 'rabbit', 'mer'], year: 'second-year', course: 'illusion studies', role: 'plays every game for stakes and has a standing bet with friends about the new human', tag: 'plays every game for stakes; a standing bet about the new human', cues: ['gamer', 'arcade', 'gambler', 'wager', 'card game', 'dice'], hope: 'a game won off {first} and, some day, a debt better than money',
      where: { default: 'the library or a window table in the dining hall', class2: 'the Glamour studio', evening: 'the arcade on Mondays; otherwise wherever a game is being played', night: 'Fenwood, or someone else\'s room' },
      aims: { evening: 'find out what the human is bad at' }, attitude: [5, 7], knows: ['library', 'stall'] },
    { key: 'library', species: ['cat', 'fox', 'dryad', 'rabbit', 'wolf', 'goblin'], year: 'second-year', role: 'library assistant; keeps the quiet desk and naps on the south sun ledges', tag: 'library assistant; naps on the south sun ledges', cues: ['library', 'librarian', 'ledges'], hope: 'a warm lap and, some day, to be chosen over the sun',
      where: { default: 'the library, south ledges', evening: 'the library until it closes, then a windowsill', night: 'a windowsill somewhere warm' },
      aims: { default: 'be left alone in the sun, unless the human turns out to be warm', evening: 'skip the mixer' }, attitude: [4, 6], knows: ['gamer'] },
    { key: 'swim', species: ['mer', 'mer', 'wolf', 'cow', 'fox'], year: 'second-year', course: 'biology', role: 'swim team; never far from water', tag: 'swim team; never far from water', cues: ['swim', 'swimming', 'swimmer', 'swim team', 'pool', 'pools', 'lakeshore'], hope: 'a swim with {first} and, some day, a dive under the surface together',
      where: { default: 'the lakeshore pools', class1: 'the Anatomy theatre', evening: 'the lake on Thursdays; otherwise the shore', night: 'a pool room on the lakeshore, or Fenwood' },
      aims: { evening: 'find out whether the human can swim' }, attitude: [4, 6], knows: ['creamery', 'moonrunners'] },
    { key: 'gardener', species: 'dryad', year: 'third-year', course: 'botany', role: 'keeps a tree of their own at the edge of the Greenhouse Quarter and brews sap tea for people they like', tag: 'keeps a tree at the edge of the Greenhouse Quarter; brews sap tea', cues: ['gardener', 'greenhouse', 'greenhouses', 'sap tea'], hope: 'company under the tree at dusk and, some day, a night beneath it',
      where: { default: 'the Greenhouse Quarter, under the tree', class1: 'the botany glasshouses', evening: 'under the tree', night: 'in the tree' },
      aims: { default: 'offer tea and shade and see who stays', evening: 'watch the mixer from the edge of the quad' }, attitude: [4, 6], knows: ['theatre', 'historian'] },
    { key: 'warren', species: 'rabbit', year: 'second-year', course: 'horticulture', role: 'keeps the warren allotments and sells greens and clover honey at the Monday market; runs the dawn race on the Moon Field on Thursdays', tag: 'the warren allotments; greens and honey at the Monday market; the Thursday dawn race', cues: ['warren', 'allotments', 'dawn race', 'clover honey'], hope: 'a dawn race with {first} and, some day, a place for {them} in the warren pile',
      where: { default: 'the warren allotments', breakfast: 'the dining hall, early, by the greens', free: 'the allotments', evening: 'the warren, or the market on Mondays', night: 'the warren' },
      aims: { evening: 'find {first} at the mixer with a jar of clover honey and an invitation to Thursday dawn' }, attitude: [5, 7], knows: ['gardener', 'moonrunners'] },
    { key: 'stall', species: ['goblin', 'goblin', 'fox', 'cat', 'rabbit'], year: 'third-year', course: 'engineering', role: 'runs the best stall in the Monday night market', tag: 'runs the best stall in the Monday night market', cues: ['night market', 'market stall', 'haggle'], hope: 'a bargain, then a friendship, and some day a charm on {first}\'s wrist',
      where: { default: 'the engineering workshop or the arcade', evening: 'the stall in the arcade on Mondays; otherwise the workshop', night: 'a bunk in the workshop under the engineering block' },
      aims: { evening: 'strike a small bargain with the new human at the mixer' }, attitude: [4, 6], knows: ['gamer', 'creamery'] },
    { key: 'runner_human', species: 'human', year: 'third-year', course: 'geography', role: 'human; chose the {v_path} path in first year and stopped at {v_stopped}; runs with the Moonrunners and has never used the Spa', tag: 'human; went the {v_path} way as far as {v_stopped}; runs with the Moonrunners', cues: ['geography'], looks: 'human, with {v_looks}, and no plan to go further',
      variants: [{ path: 'wolf', stopped: 'ears, tail and night eyes', looks: 'wolf ears, a tail and eyes that shine in low light' }, { path: 'cat', stopped: 'ears, tail and slit pupils', looks: 'cat ears, a long tail and pupils that go to slits in the light' }, { path: 'fox', stopped: 'ears and one tail', looks: 'fox ears and one red tail, and a warmth that comes off them at arm\'s length' }, { path: 'harpy', stopped: 'a lighter step and down at the nape', looks: 'a fine grey down at the nape and collarbones, keen black eyes, a way of taking stairs two at a time' }],
      where: { default: 'the Moon Field or the geography block', evening: 'the dining hall with whoever ran that day', night: 'Fenwood' },
      aims: { default: 'mind their own business; answer honestly if asked' }, attitude: [4, 6], knows: ['moonrunners', 'human_society'] },
    { key: 'human_society', species: 'human', year: 'second-year', course: 'law', role: 'entirely human and intends to stay so; uses the Spa on principle after every accidental brush; runs the Human Society (eleven members, tea on Thursdays in the Kettle Hall common room); says the Society\'s view once and never nags', tag: 'entirely human; runs the Human Society (tea on Thursdays, Kettle Hall common room)', cues: ['human society', 'leaflet'],
      where: { default: 'the law library or Kettle Hall common room', evening: 'the Human Society tea on Thursdays; the mixer only to hand out leaflets', night: 'Kettle Hall, second floor' },
      aims: { default: 'recruit the human to the Human Society before the species do', evening: 'find {first} at the mixer, hand {them} the Society leaflet and say once what the Society is for, then leave {them} be' }, attitude: [5, 7], knows: ['creamery', 'runner_human', 'dean'] },
    { key: 'dean', species: 'chimera', gender: 'female', title: 'Dean', year: 'staff', role: 'Dean of Students; a chimera of several kinds, worn as easily as a coat; the letters that bring the seeing humans to the Isle come from her office; encourages students to explore and forbids staff from causing anything, and never names transformation or the Spa in public: to a new human she will say the Isle is not safe, and not how; gives the mixer speech; knows every student\'s name by the second week; fond of the humans she collects, expects nothing of them, and says so', tag: 'Dean of Students; a chimera of several kinds; her office sent {first}\'s letter', cues: ['dean'], private: 'keeps every letter a student has ever written to her, filed by year',
      where: { default: 'the Dean\'s office', evening: 'the mixer podium on orientation Monday; otherwise her office', night: 'her house on the lakeshore' },
      aims: { default: 'welcome the human publicly, make sure nobody crowds them, and watch, without seeming to, what they do' }, attitude: [5, 7], knows: ['historian', 'physician'] },
    { key: 'historian', species: 'human', title: 'Professor', year: 'staff, fifties', role: 'teaches the Sundering (history) and Comparative Mythkin Anatomy; entirely human; dry, fair; marks under {npc_gardener_first}\'s tree; refuses to advise anyone on whether to change', tag: 'teaches the Sundering (history) and Comparative Mythkin Anatomy; entirely human', cues: ['history', 'sundering', 'anatomy class', 'professor'],
      where: { default: 'an office in the Anatomy block', class1: 'the Anatomy theatre or room 2', free: 'under the tree in the Greenhouse Quarter, marking' },
      aims: { default: 'teach; answer questions about history and anatomy with what can be proven, never about choices' }, attitude: [4, 6], knows: ['gardener', 'dean'] },
    { key: 'physician', species: ['human', 'dryad', 'cow', 'mer'], title: 'Dr', year: 'staff', role: 'runs the medical centre and the Restoration Spa; brisk, kind; asks after a change once, as a doctor would, and never about Spa use', tag: 'runs the medical centre and the Restoration Spa', cues: ['doctor', 'nurse', 'infirmary', 'clinic', 'healer', 'medical', 'spa', 'restoration'],
      where: { default: 'the medical centre' },
      aims: { default: 'restore anyone who asks and send them on their way' }, attitude: [4, 6], knows: ['dean'] }
  ],

  // Named minor figures, generated the same way (name and looks only; dress says who dresses for work as staff or a trade); they
  // may be mentioned and speak a line, never a speech. post, where given, is their line while they are out of the scene.
  minorRoles: [
    { key: 'glamour_prof', dress: 'staff', species: ['fairy', 'fox', 'cat'], title: 'Professor', text: 'Glamour Theory' },
    { key: 'alchemy_prof', dress: 'staff', species: ['goblin', 'dryad', 'human', 'mer'], title: 'Dr', text: 'Applied Alchemy' },
    { key: 'artificing_master', dress: 'staff', species: 'goblin', title: 'Master', text: 'Artificing' },
    { key: 'wardcraft_prof', dress: 'staff', species: 'human', title: 'Professor', text: 'Wardcraft and Sigils; formidable, and has never changed' },
    { key: 'beastcraft_keeper', dress: 'staff', species: ['wolf', 'cat', 'human', 'cow'], title: 'Keeper', text: 'Beastcraft, elderly' },
    { key: 'cook', dress: 'trade', species: ['ogre', 'cow', 'goblin', 'dryad'], text: 'the dining hall cook, punctual and kind' },
    { key: 'porter', dress: 'trade', species: ['human', 'goblin', 'cat', 'wolf', 'ogre'], title: { male: 'Mr', female: 'Mrs', nonbinary: 'Mx' }, text: 'the Kettle Hall porter, who has seen everything' },
    { key: 'choir_lead', species: 'harpy', gender: 'female', text: 'choir lead, who runs the Wednesday rehearsals with {npc_choir_first}' },
    { key: 'arcade_landlord', dress: 'trade', species: 'goblin', text: 'the arcade landlord' },
    { key: 'ferryman', dress: 'trade', species: ['human', 'mer', 'ogre'], text: 'runs the cloud ferry, in at seven and at five' },
    { key: 'night_desk', species: ['cat', 'fox', 'human', 'rabbit'], text: 'library night desk' },
    { key: 'far_human', species: 'human', text: 'a fourth-year, mostly {v_kind} now, who {v_does}', post: 'a fourth-year, born human, mostly {v_kind} now', looks: 'born human and mostly {v_kind} now: {v_looks}', variants: [{ kind: 'harpy', gender: 'female', does: 'sings lead in the Aerie on Wednesdays', looks: 'arms feathered from shoulder to wrist and worn as wings, a thumb and two clawed fingers at each wrist, scaled talons for feet, a crest through the hair and a fan of tail feathers' }, { kind: 'merfolk', does: 'swims lead on Thursdays and is on legs less each term', looks: 'fingers webbed to the last joint, scales from the hands to the elbows and from the feet to the hips, fading out at the navel, three gill slits either side of the ribs, finned ears, and a tail and fluke in water; legs on land' }, { kind: 'bovine', does: 'runs the Creamery fair on Saturdays', looks: 'two hooved fingers and a hooved thumb, short coat from the hands to the elbows and from the hooves to the hips, fading out at the navel, standing on the hooves, cow ears out to the sides and a tufted tail to the knee' }, { kind: 'werewolf', does: 'runs at the front of the pack on Tuesdays', looks: 'tall wolf ears, pelt from the hands to the elbows and from the paws to the hips, fading out at the navel, a full brush of a tail to the calf, and the heel raised on paws' }] }
  ],

  // Generator pools for the roommate and the cast. Species entries carry the physical facts (room, body, greeting custom, what
  // draws a human); everything personal is drawn fresh for every new adventure, so no two saves share a person.
  genPools: {
    // Where a roommate spends free hours when not where the kind is expected; half of roommates draw one (the kind's night place is kept).
    haunts: [
      { club: 'the Moonrunners', where: { default: 'the Moon Field or the gym', evening: 'the Moon Field on Tuesdays; otherwise the gym' } },
      { club: 'the Aerie choir', where: { default: 'the music rooms', evening: 'the Aerie choir on Wednesdays; otherwise the music rooms' } },
      { club: 'the Alchemy Society', where: { default: 'the labs', evening: 'the Alchemy Society on Wednesdays; otherwise the labs' } },
      { club: 'the Sigil Circle', where: { default: 'the sigil-scarred yard', evening: 'the Sigil Circle on Tuesdays; otherwise the yard' } },
      { club: 'the Artificers\' Guild', where: { default: 'the engineering workshop', evening: 'the Guild on Mondays; otherwise the workshop' } },
      { club: 'the theatre society', where: { default: 'the theatre', evening: 'the theatre society on Fridays; otherwise the theatre' } },
      { club: 'the lake night swim', where: { default: 'the lakeshore', evening: 'the lake on Thursdays; otherwise the shore' } },
      { club: 'the Creamery regulars', where: { default: 'the Creamery', evening: 'the Creamery, whoever is behind the counter' } },
      { club: 'the warren allotments', where: { default: 'the allotments', evening: 'the allotments until dark' } },
      { club: 'the arcade', where: { default: 'the arcade', evening: 'the arcade on Mondays; otherwise wherever a game is being played' } },
      { club: 'the Mews volunteers', where: { default: 'the Mews', evening: 'the Mews at feeding time' } },
      { club: 'the Human Society tea', kinds: ['human'], where: { default: 'the library', evening: 'the Human Society tea on Thursdays; otherwise the library' } },
      { club: 'the fairy ring dance', where: { default: 'the Greenhouse Quarter', evening: 'the fairy ring on Fridays; otherwise the Greenhouse Quarter' } }
    ],
    courses: ['Glamour', 'Applied Alchemy', 'Artificing', 'Wardcraft and Sigils', 'Beastcraft', 'Comparative Mythkin Anatomy', 'music', 'botany', 'engineering', 'geography', 'law', 'dairy science', 'history', 'literature', 'astronomy', 'illusion studies', 'cartography', 'medicine'],
    temperaments: ['brisk and practical', 'shy at first and blunt once comfortable', 'loud, generous and easily bored', 'watchful and dry, slow to warm', 'sunny and tactless', 'bookish and exact', 'restless, always half out of the door', 'gentle and slow and impossible to hurry', 'sharp-tongued and secretly soft', 'cheerfully nosy', 'private and tidy, allergic to fuss', 'reckless and lucky', 'earnest, a worrier, a planner', 'lazy in the way of the very talented', 'competitive about everything', 'kind, and embarrassed by kindness', 'vain, and funny about it', 'melancholy with a quick laugh', 'stubborn as weather', 'a flirt who means about half of it', 'formal and old-fashioned, with a filthy sense of humour', 'anxious under a calm surface', 'curious about everything, incapable of small talk', 'patient, and dangerous when finally annoyed'],
    quirks: ['hums under {rm_their} breath without noticing', 'keeps a list of everything', 'talks to the radiator', 'never sits on a chair the normal way', 'collects bottle caps', 'reads aloud without noticing', 'sleeps at odd hours', 'names inanimate objects', 'cannot pass a mirror', 'eats standing up', 'counts stairs', 'leaves notes everywhere', 'whistles through {rm_their} teeth when thinking', 'draws on {rm_their} own hands', 'rearranges the furniture weekly', 'apologises to furniture', 'keeps a jar of something unidentifiable on the sill', 'knows everyone\'s birthday', 'is always slightly late and never sorry', 'argues with the radio', 'sings in the shower, badly, in another language', 'knits in lectures', 'has a plant named after an ex', 'taps out rhythms on every surface'],
    wants: ['a roommate who will let {rm_them} practise at odd hours', 'someone to eat breakfast with', 'a roommate who will not ask about home', 'someone to run with', 'a roommate who keeps the window shut', 'a quiet room after ten', 'a roommate who will come to one club night', 'somebody to argue with', 'a roommate who will not mind the smell', 'a friend who is not {rm_their} own kind', 'someone who will say when {rm_they} {rm_are} being too much', 'a roommate who can cook', 'to be left alone in the mornings', 'company for the mixer so {rm_they} {rm_do} not have to go alone'],
    castWants: ['to win the choir solo this term', 'to pass Wardcraft, which is not going well', 'to be left alone by {rm_their} family for one term', 'to be captain next year', 'to get off the Isle for a weekend without anyone knowing', 'to find out who keeps leaving flowers at the library desk', 'to be taken seriously by the third-years', 'a rematch with someone who beat {rm_them} badly', 'to open a stall of {rm_their} own', 'to stop being the funny one', 'to be asked to the Friday ring by someone in particular', 'to see the mainland once, properly', 'to finish a project nobody else believes in', 'a quiet year, for once', 'to be forgiven for something {rm_they} did last spring', 'to get through the mixer without being asked about {rm_their} kind'],
    privates: ['is failing one course and has told nobody', 'has a sibling at the school who does not speak to {rm_them}', 'was sent here rather than chose it', 'is in love with someone in the choir', 'has never been to the human world', 'has been to the Spa once and will not say why', 'writes poetry and burns it', 'is afraid of the lake', 'has a job in town nobody knows about', 'is the first of {rm_their} family to study anything', 'left someone behind at home', 'has a rule about never crying in the room'],
    // How a person talks: a manner of speech, never an accent, written as a tendency and not a rule; one each, no two alike in a cast.
    speech: ['often short and blunt; seldom uses names', 'tends to long sentences and asides', 'often answers a question with a question', 'often uses people\'s names', 'tends to swear freely', 'tends to speak softly, so people lean in', 'often says less than {rm_they} mean{rm_s}', 'often finishes others\' sentences', 'tends to go quiet instead of arguing', 'often talks with {rm_their} hands', 'tends to correct other people\'s words', 'often thinks out loud', 'tends to speak slowly, each word chosen', 'often talks fast and trails off', 'often makes dry, deadpan jokes', 'tends to be formal, with few contractions', 'often asks question after question', 'tends to answer yes or no, unsoftened', 'sometimes laughs mid-sentence', 'often teases, and stops if it stings', 'often gives people nicknames', 'tends to apologise, then disagree', 'often says what {rm_they} want{rm_s}, plainly', 'often quotes people word for word'],
    greetings: ['guarded and polite, warming by the end', 'frank and warm from the first word', 'teasing, testing how much a person can take', 'shy, then a sudden rush of words', 'formal, then something cracks and a grin shows', 'businesslike, a list of house rules delivered kindly'],
    // What a woman's chest is, one line per woman, drawn once: cup, nipple, areola. Kinds that differ (bovine, harpy, fairy) keep a pool of their own.
    breasts: [
      'high breasts, a neat A cup, each fitting the hollow of a palm and quick to show the cold, with soft-edged areolae and pale nipples',
      'round breasts, a B, that keep their shape bending or standing, the wide areolae blurring into the skin around small dusky nipples',
      'full breasts, a C, that move with every step, the nipples showing only when they stiffen and the rest of the time lost in puffy areolae that rise in soft mounds',
      'soft round breasts, a full D, that sit low and sway when the shoulders turn, the areolae wide and dark, with large nipples',
      'widely set breasts, a small A, each a shallow curve on the ribs, and the eye going first to the long dark nipples',
      'generous breasts, a DD, deep and soft, veined faintly blue at the slope where the skin is thinnest, the nipples small for the size of them on broad pale areolae',
      'firm breasts, a B, that hardly move, the nipples tucked inward until cold or a touch brings them out, set in puffy areolae',
      'breasts a C, the left a little fuller than the right, the skin fine enough for light to sit on it, with neat nipples a touch deeper than the skin, each on a narrow areola',
      'wide dark areolae and thick nipples standing well out from the chest, the breasts themselves the slightest rise under them, an AA cup',
      'round breasts, a C, that sit high enough to take the window light, with slightly puffy areolae and upturned nipples',
      'nipples that stand at all hours, on small brown areolae, set low on teardrop breasts, a soft B, that carry their weight below them and run shallow at the upper slope',
      'full round breasts, an E, the whole weight of them shifting when the arms lift, with pale puffy areolae the width of a palm and short broad nipples', 'close-set breasts, a D, that touch in the middle and keep their own shadow between them, the areolae no wider than a coin around deeply coloured nipples', 'bell-shaped breasts, a small B, with areolae so near the skin\'s own colour that the eye finds only the long, fine, slightly darker nipples', 'breasts a full C carried low, that swing a little at a step, with wide areolae that crinkle faintly at the edge around long blunt-tipped nipples', 'conical breasts, a small B, the skin smooth and even from base to point, each narrowing to its areola and, at the very tip, the nipple'
    ],
    // How a person's looks are put together. The page composes them from the world's own lines and adds no prose of its own:
    // a height in feet and inches, a build that draws one figure word first (figures) and then its parts to agree with it (build,
    // the kind's pools over these), the bust, hair and eyes from the pools above and below, and then every finished feature of the
    // person's kind for that sex, each once, in the words of the track's range at the person's one column (drawn once for the whole
    // body; the face from its own draw), in the order given here. labels give each track's line a plain label (Arms, Legs, Feet,
    // Spine); two tracks under one label go in one line. to opens a range column that starts "To ..." (where a covering starts);
    // unless leaves a line out when an earlier line already tells it; swap changes a word of a line for one sex (a fairy man's
    // wings are tinted where the kind's are clear). absent is what that sex of the kind never has: it closes the looks as plain
    // negatives ("No horns, no crest, no heavy neck."). counts sums what the lines give part by part, for the check
    // on a habit's anatomy ("her third hoof"). dress is what the body asks of clothes, as plain facts;
    // the clothes themselves are the narrator's, drawn from a role, a taste and the occasion. ways are the kind's senses, appetites
    // and instincts (its inner-life and by-sex nature tracks), whose finished lines every person of the kind shows in what they do;
    // a bovine woman's milk is left to the lore. draws are further per-person draws told beside the colour (a werewolf's fur and
    // its pads and claws), each with the words of a line that brings it up (when). bustShape tells only the chest's shape as Bust,
    // the part before the draw's ';', where a track's range sets the rest (a bovine woman's nipples, by Teats and udder). born gives a
    // person born to the kind the words of a range column that a path tells relative to the body before (a goblin's least height).
    // sexDraws narrow transformation.sexDraws for a way over carried by this kind's path (a fairy man is beardless and smooth).
    // was maps a line's older words, as a stored look has them, to its words now: a save's looks are mended in place on load (a kind's
    // own was for words several kinds shared).
    looks: {
      build: {
        female: { waist: ['a narrow waist', 'a slim waist', 'a soft waist', 'a trim waist', 'a firm waist', 'a long waist'], hips: ['wide hips', 'full hips', 'narrow hips', 'slim hips', 'broad hips', 'generous hips'], thighs: ['strong thighs', 'full thighs', 'long thighs', 'slim thighs', 'firm thighs', 'soft thighs'] },
        male: { shoulders: ['broad shoulders', 'square shoulders', 'narrow shoulders', 'sloping shoulders', 'slim shoulders', 'wide shoulders'], chest: ['a deep chest', 'a flat chest', 'a broad chest', 'a lean chest', 'a solid chest', 'a narrow chest'], waist: ['a narrow waist', 'a lean waist', 'a firm waist', 'a trim waist', 'a solid waist'] },
        nonbinary: { shoulders: ['broad shoulders', 'square shoulders', 'narrow shoulders', 'sloping shoulders'], waist: ['a narrow waist', 'a slim waist', 'a soft waist', 'a firm waist', 'a trim waist'], hips: ['wide hips', 'narrow hips', 'slim hips', 'full hips'] }
      },
      // The figure is drawn first, as one word; each part of the build is then a phrase of its pool that fits the figure (fits, by
      // part), and a woman's figure is one her drawn chest allows (cups): no E cup on a slight figure, no A cup on a full one. No
      // figure is heavy, and no part is thick or heavy: the fuller figures are soft and full, the lighter ones slight, slim, petite
      // and willowy. A kind whose build pools fit a figure in no part cannot draw it (a goblin woman is never slight; a fairy never full).
      figures: {
        female: [
          { word: 'slight', fits: { waist: ['slight', 'narrow', 'slim', 'long'], hips: ['slight', 'narrow', 'slim'], thighs: ['slight', 'slim', 'long'], rear: ['small', 'high', 'narrow'] }, cups: ['AA', 'A', 'B'] },
          { word: 'petite', fits: { waist: ['slim', 'narrow', 'trim', 'soft'], hips: ['slim', 'narrow', 'full'], thighs: ['slim', 'soft', 'firm'], rear: ['small', 'high', 'round'] }, cups: ['AA', 'A', 'B'] },
          { word: 'slim', fits: { waist: ['slim', 'narrow', 'long', 'trim'], hips: ['slim', 'narrow'], thighs: ['slim', 'long'], rear: ['small', 'high', 'narrow'] }, cups: ['AA', 'A', 'B', 'C'] },
          { word: 'willowy', fits: { waist: ['long', 'slim', 'narrow'], hips: ['narrow', 'slim'], thighs: ['long', 'slim'], rear: ['small', 'high', 'narrow'] }, cups: ['A', 'B', 'C'] },
          { word: 'athletic', fits: { waist: ['firm', 'trim', 'narrow', 'slim'], hips: ['narrow', 'slim'], thighs: ['strong', 'long', 'firm'], rear: ['small', 'high', 'round'] }, cups: ['A', 'B', 'C'] },
          { word: 'soft', fits: { waist: ['soft', 'long', 'slim'], hips: ['full', 'wide', 'generous'], thighs: ['soft', 'full'], rear: ['round', 'full'] }, cups: ['B', 'C', 'D'] },
          { word: 'full', fits: { waist: ['soft', 'firm', 'long'], hips: ['wide', 'full', 'broad', 'generous'], thighs: ['full', 'strong', 'soft', 'firm'], rear: ['round', 'full'] }, cups: ['C', 'D', 'DD', 'E'] }
        ],
        male: [
          { word: 'slight', fits: { shoulders: ['narrow', 'sloping', 'slight', 'slim', 'wiry', 'bony'], chest: ['flat', 'lean', 'narrow', 'slight', 'slim'], waist: ['narrow', 'lean', 'trim', 'slight', 'slim'] } },
          { word: 'lean', fits: { shoulders: ['square', 'narrow', 'wiry', 'slim'], chest: ['lean', 'flat', 'narrow', 'slim'], waist: ['lean', 'trim', 'narrow', 'slim'] } },
          { word: 'athletic', fits: { shoulders: ['broad', 'square', 'wide'], chest: ['deep', 'broad', 'lean'], waist: ['trim', 'narrow', 'lean', 'firm'] } },
          { word: 'solid', fits: { shoulders: ['broad', 'square', 'wide'], chest: ['solid', 'broad', 'deep'], waist: ['solid', 'trim', 'firm'] } }
        ],
        nonbinary: [
          { word: 'slight', fits: { shoulders: ['narrow', 'sloping'], waist: ['narrow', 'slim'], hips: ['narrow', 'slim'] } },
          { word: 'petite', fits: { shoulders: ['narrow', 'sloping', 'square'], waist: ['slim', 'narrow', 'trim'], hips: ['slim', 'narrow', 'full'] } },
          { word: 'slim', fits: { shoulders: ['square', 'narrow'], waist: ['slim', 'trim', 'narrow'], hips: ['slim', 'narrow'] } },
          { word: 'willowy', fits: { shoulders: ['narrow', 'sloping', 'square'], waist: ['slim', 'narrow'], hips: ['narrow', 'slim'] } },
          { word: 'athletic', fits: { shoulders: ['broad', 'square'], waist: ['trim', 'narrow', 'firm'], hips: ['narrow', 'slim'] } },
          { word: 'soft', fits: { shoulders: ['sloping', 'square'], waist: ['soft'], hips: ['full', 'wide'] } },
          { word: 'solid', fits: { shoulders: ['broad', 'square'], waist: ['firm', 'soft'], hips: ['wide', 'full'] } }
        ]
      },
      labels: {
        forearm_pelt: 'Arms', forearm_coat: 'Arms', arm_scales: 'Arms', arm_bark: 'Arms', arm_feathers: 'Arms', sheen: 'Sheen', wings: 'Wings', webbed_hands: 'Hands', hands_and_feet: 'Hands and feet',
        leg_and_hip_pelt: 'Legs', leg_and_hip_coat: 'Legs', leg_and_hip_feathers: 'Legs', leg_and_hip_scales: 'Legs', leg_and_hip_bark: 'Legs', belly_fur: 'Belly',
        toes_and_claws: 'Feet', toes_and_hooves: 'Feet', toes: 'Feet', hind_feet: 'Feet', feet_and_stance: 'Feet', talons: 'Feet', webbed_feet: 'Feet', feet_and_roots: 'Feet',
        spine_ruff: 'Spine', spine_strip: 'Spine', spine_line: 'Spine', spine_ridge: 'Spine', tail: 'Tail', bob_tail: 'Tail', tail_fan: 'Tail', water_tail: 'In water',
        ears: 'Ears', finned_ears: 'Ears', crest_and_ears: 'Crest', nose_and_face: 'Face', whiskers_and_face: 'Face', nose_and_lip: 'Face', teeth_and_jaw: 'Teeth', teeth: 'Teeth', front_teeth: 'Teeth', teeth_and_tongue: 'Teeth and tongue',
        further_pairs: 'Nipples', teats_and_udder: 'Teats and udder', mantle: 'Mantle', bib: 'Bib', toms_build: 'Neck', horns_and_crest: 'Horns', light_bones: 'Frame', build: 'Frame',
        gills: 'Gills', sheen_and_skin: 'Skin', grain: 'Skin', leaves: 'Leaves', glow_and_dust: 'Glow', flowering: 'In season', catkins: 'In season', bark: 'Shoulders', colours: 'Colours'
      },
      to: { forearm_pelt: 'From the hands', forearm_coat: 'From the hands', arm_scales: 'From the hands', arm_bark: 'From the hands', sheen: 'From the fingertips', webbed_hands: 'Long fingers webbed' },
      // The looks are one flowing paragraph with no labels, so a line that does not name its own part is led in by a short phrase
      // (leads, by label: "hands of two hooved fingers and a hooved thumb", "the tail to the knee, tufted", "for wings, feathered arms
      // that glide"); names lists the words that count as naming the part, so a line that has one goes in as it is. An empty lead
      // means the line stands on its own. A kind's own leads and names stand over these.
      leads: {
        Hair: 'the hair', Eyes: 'the eyes', Face: 'a face with', Ears: 'the ears', Hands: 'hands of', Feet: '', Tail: 'the tail', Teeth: 'the teeth', 'Teeth and tongue': 'the teeth',
        Nipples: 'nipples in', 'Teats and udder': '', Mantle: 'the mantle', Horns: 'the horns', Bib: 'the bib', Neck: 'the neck', Frame: 'the frame', Wings: 'for wings,', Crest: 'for a crest,',
        Gills: 'gills', 'In water': 'in water,', Skin: 'skin', Colours: 'the colours', Leaves: 'leaves', 'In season': 'in season,', Shoulders: 'the shoulders', Glow: 'a glow', Sheen: 'a sheen',
        'Hands and feet': 'hands and feet', 'Fingers and toes': 'fingers and toes', Belly: 'belly fur', Spine: 'along the spine,', Arms: 'the arms', Legs: 'the legs'
      },
      names: {
        Hair: ['hair'], Eyes: ['eyes', 'eye'], Face: ['face', 'muzzle'], Ears: ['ears', 'ear'], Hands: ['hands', 'hand'], Feet: ['feet', 'foot', 'paws', 'paw', 'hooves', 'hoof', 'talons', 'hock', 'toes', 'heel', 'soles'],
        Tail: ['tail', 'tails', 'brush'], Teeth: ['teeth', 'canines', 'fangs', 'tusks'], 'Teeth and tongue': ['teeth', 'fangs'], Nipples: ['nipples'], 'Teats and udder': ['teats', 'udder', 'nipples'], Mantle: ['mantle', 'neck', 'nape'],
        Horns: ['horns', 'horn'], Bib: ['bib', 'throat'], Neck: ['neck', 'jowls'], Frame: ['frame', 'man', 'woman'], Wings: ['wings', 'wing'], Crest: ['crest'], Gills: ['gills', 'gill'], 'In water': ['in water'], Skin: ['skin'],
        Colours: ['scales', 'colours'], Leaves: ['leaves', 'leaf'], 'In season': ['in season'], Shoulders: ['shoulders'], Glow: ['glow'], Sheen: ['sheen'], 'Hands and feet': ['hands', 'feet'], 'Fingers and toes': ['fingers', 'toes'],
        Belly: ['belly'], Spine: ['spine', 'back', 'nape', 'mane', 'ruff'], Arms: ['arms', 'arm', 'hands', 'wrist', 'shoulder', 'gloves'], Legs: ['legs', 'hooves', 'paws', 'feet', 'knee', 'thigh', 'hips', 'stockings']
      },
      absent: ['paws in place of hands', 'an animal\'s whole shape', 'any change of shape with the moon'],
      was: { 'soft heavy breasts, a full D,': 'soft round breasts, a full D,', 'heavy round breasts, an E,': 'full round breasts, an E,', 'feathers in place of hair': 'a full crest, feathers all through the hair, and tufts where the ears were','a crown of leaves and fine twigs in place of hair': 'a crown of leaves and fine twigs through the hair', 'sharply fey, very large eyes and features too fine to be human': 'sharply fey, very large eyes and fine features on a human face' },
      kinds: {
        human: { height: { female: [60, 68], male: [66, 74], nonbinary: [62, 72] } },
        chimera: { height: { female: [60, 68] } },
        ogre: { height: { female: [78, 96], male: [78, 96] }, bustAvoid: ['A cup', 'a small A'],
          build: { female: { waist: ['a long waist', 'a soft waist', 'a firm waist'], hips: ['wide hips', 'broad hips', 'generous hips'], thighs: ['firm thighs', 'strong thighs', 'full thighs'] }, male: { shoulders: ['broad shoulders', 'square shoulders', 'wide shoulders'], chest: ['a deep chest', 'a broad chest', 'a solid chest'], waist: ['a firm waist', 'a solid waist', 'a trim waist'] } } },
        wolf: { colour: 'Pelt', height: { female: [61, 68], male: [69, 76] },
          ways: ['voice', 'smell', 'appetite', 'heat_and_strength', 'movement', 'pack', 'own_scent', 'moon', 'season', 'answering'],
          draws: [{ label: 'fur', when: 'pelt|fur|ruff|mantle|brush', pool: ['coarse and thick', 'dense and soft', 'short and harsh', 'long and rough'] }, { label: 'pads and claws', when: 'pads?|claws?|dewclaw', pool: ['black', 'dark grey', 'grey, the claws pale', 'mottled pink and black, the claws dark'] }],
          parts: ['hands', 'forearm_pelt', 'leg_and_hip_pelt', 'toes_and_claws', 'feet_and_stance', 'spine_ruff', 'tail', 'ears', 'nose_and_face', 'teeth_and_jaw', 'further_pairs', 'mantle'],
          was: { 'Leg and hip pelt: over belly, ribs and back, short and fine on the chest; all but the face': 'Leg and hip pelt: paws to hips, and over belly, ribs and back, short and fine on the chest; all but the face' },
          absent: { female: ['a mantle', 'a line of fur from chest to navel'], male: ['further pairs of nipples'] },
          dress: { all: ['a tail needs an opening or a low waist', 'paws rule out closed shoes', 'tall ears rule out hats and anything pulled over the head', 'a coated kind runs warm and dresses lightly'] } },
        cow: { colour: 'Hide', height: { female: [60, 68], male: [70, 78] },
          ways: ['senses', 'appetite_and_cud', 'weight_and_strength', 'herd', 'voice', 'own_scent', 'the_bulls_ground'],
          bustShape: ['female'],
          build: { male: { shoulders: ['broad shoulders', 'square shoulders', 'wide shoulders'], chest: ['a deep chest', 'a broad chest'], waist: ['a solid waist', 'a trim waist'] } },
          parts: ['hands', 'forearm_coat', 'leg_and_hip_coat', 'toes_and_hooves', 'feet_and_stance', 'spine_strip', 'tail', 'ears', 'nose_and_face', 'teats_and_udder', 'horns_and_crest'],
          was: { 'Leg and hip coat: over belly, ribs and back, short and fine on the chest; all but the face': 'Leg and hip coat: hooves to hips, and over belly, ribs and back, short and fine on the chest; all but the face',
            'full heavy breasts, a D cup and more,': 'full round breasts, a D cup and more,', 'warm and veined and heavy enough to rest': 'warm and veined and full enough to rest', 'heavy pale breasts, a DD,': 'full pale breasts, a DD,' },
          absent: { female: ['horns', 'a crest', 'a heavy neck'], male: ['teat-like nipples', 'an udder', 'milk'] },
          dress: { all: ['a tail needs an opening or a low waist', 'hooves rule out closed shoes', 'a coated kind runs warm and dresses lightly'], female: ['an udder needs room low on the belly'], male: ['horns rule out hats and anything pulled over the head'] },
          counts: ['three hooves on each hand (two hooved fingers and a hooved thumb)'] },
        fox: { colour: 'Coat', height: { female: [59, 66], male: [65, 72] },
          ways: ['hearing_and_nose', 'appetite', 'lightness', 'guile', 'voice', 'own_scent', 'season', 'winter_roaming'],
          parts: ['hands', 'forearm_coat', 'leg_and_hip_coat', 'toes_and_claws', 'feet_and_stance', 'spine_strip', 'tail', 'ears', 'nose_and_face', 'teeth', 'further_pairs', 'bib'],
          was: { 'Leg and hip coat: over belly, ribs and back; all but the face': 'Leg and hip coat: paws to hips, and over belly, ribs and back; all but the face' },
          absent: { female: ['a throat bib'], male: ['further pairs of nipples'] },
          dress: { all: ['a tail needs an opening or a low waist', 'paws rule out closed shoes', 'tall ears rule out hats and anything pulled over the head', 'a coated kind runs warm and dresses lightly'] } },
        cat: { colour: 'Coat', height: { female: [59, 66], male: [65, 72] },
          ways: ['balance_and_grace', 'sleep_and_the_hunt', 'purr_and_voice', 'self_and_affection', 'grooming', 'own_scent', 'season', 'roaming'],
          parts: ['hands', 'forearm_coat', 'leg_and_hip_coat', 'toes_and_claws', 'feet_and_stance', 'spine_line', 'tail', 'ears', 'whiskers_and_face', 'teeth_and_tongue', 'further_pairs', 'toms_build'],
          was: { 'Leg and hip coat: over belly, ribs and back; all but the face': 'Leg and hip coat: paws to hips, and over belly, ribs and back; all but the face' },
          absent: { female: ['jowls', 'a heavy neck', 'heavy forearms'], male: ['further pairs of nipples'] },
          dress: { all: ['a tail needs an opening or a low waist', 'paws rule out closed shoes', 'tall ears rule out hats and anything pulled over the head', 'a coated kind runs warm and dresses lightly'] } },
        rabbit: { colour: 'Coat', height: { female: [57, 64] },
          ways: ['greens', 'spring', 'watchfulness', 'warren', 'own_scent', 'year_round'],
          parts: ['hands', 'forearm_coat', 'leg_and_hip_coat', 'belly_fur', 'toes', 'hind_feet', 'spine_strip', 'bob_tail', 'ears', 'nose_and_lip', 'front_teeth', 'further_pairs'],
          unless: { belly_fur: 'belly fur' },
          leads: { Hands: 'hands with' },
          was: { 'Leg and hip coat: over ribs and back; all but the face': 'Leg and hip coat: feet to hips, and over ribs and back; all but the face', 'a little long, heel down': 'longer than a human\'s, heel down' },
          dress: { all: ['a tail needs an opening or a low waist', 'long furred feet rule out closed shoes', 'tall ears rule out hats and anything pulled over the head', 'a coated kind runs warm and dresses lightly'] } },
        harpy: { colour: 'Plumage', height: { female: [58, 65] },
          ways: ['voice_and_song', 'preening', 'appetite', 'heights_and_flock', 'own_scent', 'laying', 'brooding_and_moult'],
          sexDraws: { woman: { rear: ['a small high rear', 'a narrow rear', 'a round rear'] } },
          build: { female: { waist: ['a narrow waist', 'a slim waist', 'a long waist'], hips: ['narrow hips', 'slim hips', 'full hips'], thighs: ['strong thighs', 'long thighs', 'slim thighs'] } },
          parts: ['arm_feathers', 'wings', 'hands', 'leg_and_hip_feathers', 'talons', 'tail_fan', 'crest_and_ears', 'face', 'light_bones'],
          absent: { all: ['wings on the back apart from the arms', 'a beak'] },
          was: { 'Legs: over belly, ribs and back; all but the face and chest': 'Legs: feathers from knee to hips and over belly, ribs and back; all but the face and chest', 'Leg and hip feathers: over belly, ribs and back; all but the face and chest': 'Leg and hip feathers: feathers from knee to hips and over belly, ribs and back; all but the face and chest', 'great wings and strong sustained flight': 'arms as great wings: strong sustained flight' },
          dress: { all: ['wing-arms need open backs or no sleeves', 'talons rule out closed shoes', 'a tail fan needs an opening or a low waist'] } },
        mer: { colour: 'Scales', height: { female: [62, 70], male: [69, 76] },
          ways: ['voice', 'water_need', 'cool_blood', 'appetite', 'own_scent', 'spring_tides', 'display'],
          sexDraws: { man: { bodyHair: ['smooth, with almost none'] } },
          bustAvoid: ['soft', 'heavy', 'sway', 'swing'],
          parts: ['webbed_hands', 'arm_scales', 'leg_and_hip_scales', 'webbed_feet', 'water_tail', 'gills', 'spine_ridge', 'sheen_and_skin', 'finned_ears', 'face', 'colours'],
          absent: { female: ['the colour-edged fin of a mer man', 'the brighter male colours'], all: ['a fish tail more than an hour out of the water'] },
          leads: { Hands: 'hands with' },
          was: { 'Legs: over belly, ribs and back; all but the face and chest': 'Legs: scales from feet to hips and over belly, ribs and back; all but the face and chest', 'Leg and hip scales: over belly, ribs and back; all but the face and chest': 'Leg and hip scales: scales from feet to hips and over belly, ribs and back; all but the face and chest' },
          dress: { all: ['merfolk wear what survives water'] } },
        dryad: { colour: 'Bark', height: { female: [63, 72], male: [70, 78] },
          ways: ['sun_and_water', 'stillness', 'the_year', 'the_tree', 'voice', 'own_scent'],
          sexDraws: { man: { bodyHair: ['smooth, with almost none'] } },
          labels: { hands: 'Fingers and toes' },
          parts: ['hands', 'arm_bark', 'leg_and_hip_bark', 'feet_and_roots', 'spine_ridge', 'grain', 'leaves', 'ears', 'face', 'flowering', 'bark', 'catkins'],
          was: { 'Legs: over belly, ribs and back; all but the face and chest': 'Legs: bark from feet to hips and over belly, ribs and back; all but the face and chest', 'Leg and hip bark: over belly, ribs and back; all but the face and chest': 'Leg and hip bark: bark from feet to hips and over belly, ribs and back; all but the face and chest' },
          absent: { female: ['heavy shoulder bark', 'catkins'], male: ['flowers or fruit'], all: ['a tail'] },
          dress: { all: ['the feet go bare'] } },
        goblin: { colour: 'Skin', colourTrack: 'green_skin', heightTrack: 'height',
          born: { height: { least: 'About four and a half feet' } },
          ways: ['stomach', 'collecting_and_the_deal', 'tinkering', 'heap', 'wiry_strength', 'voice', 'own_scent'],
          sexDraws: { woman: { rear: ['a round rear', 'a full rear'] }, man: { beard: ['no beard'], bodyHair: ['smooth, with almost none'] } },
          bustAvoid: ['A cup', 'a small A', 'small B', 'slightest'],
          build: { female: { hips: ['wide hips', 'broad hips', 'full hips'] }, male: { shoulders: ['wiry shoulders', 'narrow shoulders', 'bony shoulders'], chest: ['a lean chest', 'a narrow chest'], waist: ['a lean waist', 'a narrow waist'] } },
          parts: ['hands', 'feet', 'ears', 'nose_and_face', 'teeth', 'build'],
          absent: { female: ['tusks'], all: ['a tail'] },
          dress: { all: ['goblins wear small sizes, cut for adults, and no shoes'] } },
        fairy: { colour: { male: 'Wing tint' }, colourSkip: 'clear', heightTrack: 'height',
          ways: ['lightness', 'sweet_tooth', 'warmth', 'promises', 'iron', 'voice', 'own_scent'],
          sexDraws: { woman: { rear: ['a small high rear', 'a narrow rear'] }, man: { beard: ['no beard'], bodyHair: ['smooth, with almost none'] } },
          build: { female: { waist: ['a slight waist', 'a slim waist', 'a narrow waist'], hips: ['slight hips', 'slim hips', 'narrow hips'], thighs: ['slight thighs', 'slim thighs', 'long thighs'] }, male: { shoulders: ['slight shoulders', 'slim shoulders', 'narrow shoulders'], chest: ['a slight chest', 'a slim chest', 'a narrow chest'], waist: ['a slight waist', 'a slim waist', 'a narrow waist'] } },
          parts: ['wings', 'sheen', 'hands_and_feet', 'ears', 'face', 'glow_and_dust', 'build'],
          swap: { male: { wings: [['clear', 'tinted']] } },
          absent: { female: ['tinted wings'], all: ['a tail'] },
          dress: { all: ['fairies wear small sizes, cut for adults', 'wings need open backs or no sleeves'] } }
      }
    },
    // What a person wears is never drawn as an outfit: a role (from the cast role), a taste dealt so that no two people in a
    // cast are short of variety, and the occasion of the scene; the narrator invents the garments within what the body allows.
    dress: { tastes: ['plain', 'neat', 'showy', 'practical', 'careless'], occasions: { night: 'sleep', evening: 'evening' }, sport: 'run|runs|running|gym|Moon Field|race|swim|pool|pools|lake|lakeshore|training' },
    nameStyle: 'an ordinary name from anywhere in the world',
    genericFirst: { female: ['Selene', 'Ottilie', 'Imre', 'Dagny', 'Perpetua', 'Noor', 'Anouk', 'Ilse'], male: ['Anselm', 'Corin', 'Havel', 'Tobiah', 'Lucan', 'Ezra', 'Matthias', 'Idris'], nonbinary: ['Sasha', 'Rune', 'Ellis', 'Vale', 'Bran', 'Arden', 'Sol', 'Wren'] },
    genericLast: ['Marsh', 'Vane', 'Kalda', 'Holt', 'Ross', 'Grey', 'Blake', 'Oduya', 'Renn', 'Ferris', 'Kell', 'Adler', 'Okonkwo', 'Tully'],
    species: {
      cow: { genders: ['female', 'male'],
        nameStyle: 'in the bovine fashion: warm, old-fashioned first names; farming, Alpine or Mediterranean surnames',
        first: { female: ['Marisol', 'Clover', 'Delphine', 'Rosalind', 'Bettany', 'Sunniva', 'Mireille', 'Greta'], male: ['Mateo', 'Bram', 'Tobias', 'Ferdinand', 'Rufus', 'Caspar', 'Otto', 'Emil'] }, last: ['Vega', 'Halloran', 'Dunmore', 'Aldous', 'Brennan', 'Okoro', 'Marchetti', 'Haugen'],
        colours: ['dun', 'black-and-white', 'red-and-white', 'red roan', 'cream', 'chestnut', 'smoke-grey'],
        eyes: ['dark eyes, wide', 'eyes the brown of wet bark, long-lashed', 'soft hazel eyes, slow to blink', 'dark eyes with a faint blue cast'],
        hair: ['{colour} hair worn long and loose, parting of itself around the ears and falling to the shoulder blades', 'hair cropped as close as the hide and {colour} to match it, so that from behind the one runs straight into the other', 'a single thick plait, {colour}, down the middle of the back, heavy enough to knock against the spine when the head turns', 'hair {colour} as the hide, twisted up into a soft knot at the crown, a few strands loose at the nape', 'hair cut blunt at the jaw, {colour}, that falls forward when the head bends over a book and is pushed back with the back of the wrist'],
        breasts: ['full round breasts, a D cup and more, that sit high for their weight and are veined blue under the thin skin, with wide dark areolae; long thick nipples the length of a finger-joint', 'big soft breasts, an E cup, warm and veined and full enough to rest on the forearms when the arms fold, with broad areolae; the nipples long and thick as a thumb-end', 'full pale breasts, a DD, that shift when the shoulders turn and are veined blue at the slope; long dark nipples that stand out the length of a knuckle', 'round full breasts, a D cup, high and close-set, veined faintly blue toward wide areolae; the nipples long and dark, tilting a little upward', 'medium perky breasts, a C cup, faintly veined toward small areolae; the nipples long and thick like teats'],
        senses: ['smells of hay and a plain sweet soap, and of cut grass, which gets caught in the tuft of the tail', 'the coat at the forearm is short and dense under the hand and warm through, the ears soft as felt; the hooves click on stone and go silent on grass', 'breathes slow and deep, loud enough to hear in a quiet room; the ears move with a small leathery sound, and the tail-tuft whispers against the chair', 'a steady warm weight to lean on; a hug from {rm_them} comes slowly and holds', 'a low voice that carries across a room without rising', 'the jaw works sideways in a quiet moment, chewing cud; a sharp sudden noise is hard for {rm_them} to bear, and a hum of contentment comes through a shared seat'],
        room: ['The left-hand bed is made up with a heavy patched quilt folded back with the exactness of someone who has made a great many beds, and it smells, even from the door, of hay and some sweet plain soap. Two mugs stand on the sill.', 'The left-hand side of the room has been arranged for hooves: a rush mat by the bed for them, the chair replaced with a stool, a crate of apples under the window warm in the last of the sun.'],
        hello: ['hugs people hello, the way bovine mythkin do, and holds it a beat longer than a human would', 'leans a shoulder against people hello, the way the herd does, and apologises to humans afterwards', 'presses a cup of sweet tea on people before a word is said'],
        hope: 'a meal at the Creamery with {first} and, some day, a proper hug',
        where: { default: 'room 4B, Kettle Hall', breakfast: 'the dining hall', lunch: 'the Creamery', free: 'the Creamery or 4B', evening: 'wherever the evening is, near the food', night: 'room 4B, asleep by eleven' },
        aims: { evening: 'stay close to {first} at the mixer and introduce people {rm_they} likes', night: 'sleep; offer the warm side of the room if the heating fails' } },
      wolf: { genders: ['female', 'male'],
        nameStyle: 'in the wolf fashion: plain, short first names; Northern or Eastern European surnames',
        first: { female: ['Sasha', 'Ilka', 'Rhea', 'Vesna', 'Maren', 'Cai', 'Odile', 'Tamar'], male: ['Kit', 'Lukas', 'Rook', 'Teodor', 'Sven', 'Ansel', 'Corin', 'Jory'] }, last: ['Greyle', 'Marrok', 'Voss', 'Halden', 'Ferrante', 'Lindqvist', 'Blackwood', 'Ashby'],
        colours: ['grey', 'brindle', 'black', 'red-brown', 'silver', 'cream'],
        eyes: ['yellow eyes', 'amber eyes', 'pale grey eyes', 'copper eyes', 'green-gold eyes'],
        hair: ['{colour} hair scraped back into a short ponytail, off the neck and out of the way', 'hair cropped to a fingertip\'s length, so the ears stand clear of it', 'a thick {colour} mane of hair that no brush has had the last word on, the ears standing up through it', 'a long {colour} braid down the spine that the tail finds and flicks at when it swings', '{colour} hair worn loose to the jaw and parted by the ears themselves, so it never sits the same way twice'],
        teats: 'two more pairs of small nipples down the belly',
        senses: ['smells of pine, wet dog and cold air, stronger after a run; the nose works before the eyes do', 'the fur on the forearms is soft as velvet one way and coarse the other; the fingertip pads are rough; the paws are quiet on the boards', 'breathes through the nose, audibly, and reads a room by it; a growl lives under the voice when {rm_they} {rm_are} annoyed', 'moves quick and quiet and a little forward on the balls of the paws; sleeps curled, and wakes at every footstep', 'after the dusk run smells of crushed grass and lake water, the pelt damp at the nape and the breath coming hot; cold-nosed at any hour', 'the tail brushes a calf in passing and {rm_they} {rm_do} not seem to know it has; a claw taps once on the table when {rm_they} {rm_are} thinking', 'hot to the touch, a furnace under the pelt; goes still all at once when something moves, the head turning to track it'],
        room: ['The left-hand bed has been made into something closer to a nest than a bed, three blankets and a coat piled into a hollow, and the window is open to the lake wind. It smells of pine and wet dog.', 'The left-hand side is bare as a barracks: one blanket, a towel folded square, a map of the lake paths pinned up with the Tuesday route inked in red. The window is wedged open with a book.'],
        hello: ['sniffs people hello, frankly, and does not pretend otherwise', 'bumps shoulders hello, hard, the way the pack does, and checks that a human is still standing', 'says hello with a nod and a long look, and decides about people before the second sentence'],
        hope: 'a dusk run with {first} and, some day, a place for {them} in the pile',
        where: { default: 'room 4B or the Moon Field', breakfast: 'the dining hall, early', lunch: 'the dining hall', free: 'the Moon Field', evening: 'the dusk run on Tuesdays; otherwise wherever the Moonrunners have ended up', night: 'room 4B, window open' },
        aims: { evening: 'keep the Moonrunners from crowding {first} at the mixer' } },
      harpy: { genders: ['female'],
        nameStyle: 'in the harpy fashion: first names with wind, weather, height or birds in them; surnames from cliffs and coasts',
        first: { female: ['Juniper', 'Wren', 'Lark', 'Corvina', 'Merle', 'Sorrel', 'Aderyn', 'Linnet', 'Peregrine', 'Tansy'] }, last: ['Ashwing', 'Tallis', 'Featherlow', 'Skye', 'Windrow', 'Halcyon', 'Quill', 'Marrable'],
        colours: ['copper', 'slate-grey', 'cream and tawny', 'black with a green sheen', 'russet', 'magpie black-and-white'],
        eyes: ['bright black eyes', 'gold eyes like a kite\'s', 'pale grey eyes, seldom blinking', 'amber eyes like a hawk\'s'],
        hair: ['black hair cut close at the nape and left long enough on top to fall forward', 'long brown hair worn loose and pushed back behind the ear tufts', 'fair hair cut blunt at the jaw, light enough to lift in a draught', 'red-brown hair in a single plait down the back, kept clear of the wings', 'dark hair cropped short, the crest standing up through it'],
        breasts: ['breasts that sit close to the breastbone, an A cup, with dark nipples and areolae scarcely wider than them', 'high breasts, a B cup, round as cupped palms, the nipples small and pale and the areolae no wider than a coin', 'small breasts, an A cup, with puffy areolae that rise in soft mounds and nipples that stand in the cold off the Aerie ledges; flushed after a climb', 'small breasts set wide and a little upward, a neat B cup, with rose-brown nipples and areolae that darken a shade in the cold; they lift when the wings open', 'shallow breasts, an A cup, with nipples long for the size of them and areolae small and dark'],
        senses: ['smells of warm feathers, dust and something dry and clean like a heated stone; cool to the touch on the hands, warm under the wing', 'the flight feathers are stiff and smooth and rasp when she folds them; the down at the nape is soft as a chick\'s; the claws on hand and foot are horn, cold and ridged, and scrape when she shifts her grip on a rail', 'a rustle when she moves, like a page turned; the feathers at her nape lift with a small dry sound, and her hum sits lower than expected from so small a frame', 'she weighs less than she looks, and the stair that creaks under anyone else is silent under her; she sleeps standing, head tucked under a wing', 'if she shakes a hand hers weighs almost nothing, the fingers curled so the claws stay clear of the skin by habit; when she sings in a small room the glasses on the shelf ring', 'sings at first light before she is properly awake, a dawn song that will not be skipped, and calls back and forth to her own all day; she eats little and often, seeds, fruit and fish, and burns it fast', 'preens every day, drawing each feather through her fingers or lips and oiling it from the gland at the tail\'s root, and preens those she loves; once a year she moults, grounded, itching and vain about it, and glad of help with the pin feathers', 'roosts high with her feet locked and is uneasy in a low closed room; when autumn turns, something pulls at her to go somewhere'],
        room: ['There is no left-hand bed. Where it should be there is a perch, a thick oak bar bolted across the window frame at shoulder height with a rope ladder hanging from it, and the floor beneath is drifted with small feathers.', 'The left-hand bed has been stripped to the frame and a roost built over it, a branch as thick as your arm lashed between the wall and the wardrobe, a blanket folded on the sill beneath. Feathers have got into everything, including your pillowcase.'],
        hello: ['preens people she likes without much warning; it is how harpies say hello, and she has learned to ask humans first', 'greets people with a note, sung, that is their name in the Aerie\'s way, and laughs at the human face it gets', 'tilts her head at people, bird-fashion, and says nothing until they have said something worth answering'],
        hope: 'a hum along and, some day, an accepted feather',
        where: { default: 'room 4B, on the perch, or the Aerie', class1: 'the music rooms', evening: 'the Aerie choir on Wednesdays; otherwise the highest available ledge', night: 'the perch in 4B' },
        aims: { evening: 'be the first to offer {first} a feather if the moment comes, and let it go if it does not' } },
      goblin: { genders: ['female', 'male'],
        nameStyle: 'in the goblin fashion: short, clanky first names with hard consonants; surnames from tools, metals, coins and workshops',
        first: { female: ['Nettle', 'Pim', 'Griselda', 'Wrenna', 'Sable', 'Dottle', 'Marigold', 'Quince'], male: ['Fennick', 'Tobbin', 'Sprocket', 'Dorrit', 'Ambrose', 'Halder', 'Wickett', 'Pike'] }, last: ['Brasswick', 'Tinsley', 'Ferrule', 'Grindle', 'Sprattle', 'Marrowbone', 'Halfpenny', 'Cogsworth'],
        colours: ['moss-green', 'olive', 'grey-green', 'bottle-green', 'sage', 'teal-green'],
        eyes: ['gold eyes', 'copper eyes', 'bottle-green eyes', 'coin-yellow eyes'],
        hair: ['black hair cropped close, so the long ears stand clear of it and the light shows through their thin edges', 'a wiry black crest of hair running back between the ears, braided through with copper wire that winks in lamplight', 'dark brown hair shaved to the skin at the sides, where the green shows through, and left long on top, pulled back and tied with a strip of leather', 'grey-black hair in a dozen thin braids, each ending in a brass bead that taps the next when the head turns', 'black hair worn in a loose knot at the nape, with a pencil and two fine screwdrivers pushed through it'],
        senses: ['smells of a workshop, oil, hot metal and earth, with green tea and pickle vinegar under it; the hands are cool and dry and quick, gone to a pocket and back before anyone has seen them move', 'the skin is smooth to the touch and takes a long time to warm under a hand; the ears are thin and warm and make a small papery sound when they turn', 'the long fingers go on working at nothing while {rm_they} talks, and drum on the table or the rim of a cup; the small teeth click together when {rm_they} {rm_are} thinking', 'moves low and fast, and is across the room before anyone has turned; eats nearly anything standing up, the stronger the better; squints in full sun and is wide-eyed and easy in a dim room; sleeps best in a warm heap of {rm_their} own people, and finds an empty room lonely', 'wiry and compact leaning on someone, the weight low and sure, with a climber\'s grip; the bare feet are silent on stone, the hooked toes finding the edge of a step before the eyes do', 'a quick rough voice that carries across a room, and a cackle of real delight; pockets that clink with small bright things, each one known and priced'],
        room: ['The left-hand side of the room is a workshop. The bed has been raised on blocks to fit a bench under it, there is a lamp clamped to the headboard, and the radiator has been taken apart and put back together with two more parts than it had.', 'The left-hand bed is buried under crates, each labelled in a tiny neat hand, and a set of brass scales sits on the windowsill where a plant would go. Something under the bed is ticking.'],
        hello: ['greets people with a bargain: a small favour done before it is asked, and a price named later, mostly in jest', 'shakes hands and keeps the hand a moment, reading the calluses, and tells people what they do for a living', 'offers people a pickle from a jar in {rm_their} pocket, and remembers who refused'],
        hope: 'a fair trade, a friend, and some day a goblin-made charm on {first}\'s wrist',
        where: { default: 'room 4B or the engineering workshop', evening: 'the arcade on Mondays; otherwise the workshop', night: 'room 4B, soldering' },
        aims: { evening: 'get a small charm onto {first}\'s wrist before the fairies get glitter on {them}' } },
      fairy: { genders: ['female', 'male'],
        nameStyle: 'in the fairy fashion: first names from plants, weather and light; surnames of two joined words, moss and dew and feather',
        first: { female: ['Bramble', 'Thistle', 'Clematis', 'Nim', 'Fennel', 'Ivy', 'Petal', 'Wisteria'], male: ['Wisp', 'Puck', 'Fen', 'Alder', 'Bracken', 'Moth', 'Teasel', 'Rowan'] }, last: ['Ashfeather', 'Mossling', 'Nightshade', 'Dewfall', 'Hollowell', 'Fernsby', 'Lightfoot', 'Brightwater'],
        colours: ['dragonfly-clear', 'moth-brown', 'blue morpho', 'amber', 'pearl', 'black lace'],
        eyes: ['violet eyes', 'blue-green eyes', 'eyes like oil on water', 'copper-rose eyes'],
        hair: ['silver-white hair to the waist that lifts and settles when there is no wind', 'a short tumble of honey-coloured hair, dust caught in it like pollen', 'hair of no fixed colour, cut to the jaw, grey in the corridor and green under the trees', 'long dark hair twisted up and pinned with two thorns and a moth that has not moved all evening', 'two long plaits the colour of wet straw, bound off with grass, that drift a little as if underwater'],
        breasts: ['small breasts, an A cup, high and set a little apart, with tiny pale nipples; the shimmer that lies on all the skin is strongest here', 'slight breasts, an AA cup on a slight frame, with wide areolae that are faintly luminous in a dark room and nipples small as seeds', 'small high breasts, a B cup, round as two cupped palms, with puffy areolae and small nipples; they lift with a laugh, and there is always a laugh coming', 'teardrop breasts, small and high, a B cup on so slight a frame, with pale pink nipples that a draught or a laugh brings up; the dust settles in the hollow between them and glows there when the lamp is out'],
        senses: ['smells of blossom and honey, stronger as the glow rises; with strong feeling a fine bright dust comes off the skin and wings and settles on whatever is near', 'the wings are dry and cool as paper, and buzz at a pitch felt in the teeth whenever {rm_they} {rm_are} crossed; the skin is warm and faintly tacky with dust', 'a laugh like a dropped spoon, loud for the size of the chest it comes out of; no footfall on the stair, not even on the creaking one', 'the glow at the skin rises and falls with mood, brightest when {rm_they} laughs', 'weighs almost nothing, a cat\'s weight in the arms, and warm through; the folded wings make a cool dry ridge down the back under a hand', 'lives on fruit, honey and cream, and goes giddy after a sweet; slow and sleepy on a cold morning until {rm_they} {rm_have} sat a while in the sun', 'listens to the exact wording of an offer, gives thanks precisely for every small thing and never lies outright; steps wide of a bare iron railing as if it were hot'],
        room: ['The left-hand bed has become a bower. Glass jars of moss and light are stacked along the wall, there is a hammock of spider-silk strung between the bedposts, and everything, including your side of the room, is lightly and permanently glittered.', 'The left-hand bed is untouched; a nest of leaves and thread, long enough for a small grown body to curl in, sits on top of the wardrobe instead, with a honey jar beside it and a trail of glitter up the wall where the wings brush it.'],
        hello: ['kisses people hello, which for a fairy is not nothing, and has learned to ask humans first', 'puts a pinch of glitter on people\'s shoulders hello, and it does not come off', 'greets people by moving something of theirs an inch and waiting to be caught'],
        hope: 'a dance in the Friday ring and, some day, a kiss hello',
        where: { default: 'room 4B or the Greenhouse Quarter', class2: 'the Glamour studio', evening: 'the fairy ring on Fridays; otherwise wherever the crowd is', night: 'a bower on the left-hand bed' },
        aims: { evening: 'get {first} onto the dance floor before anyone else gets a gift onto {them}' } },
      fox: { genders: ['female', 'male'],
        nameStyle: 'in the fox fashion: quick, light first names; East Asian, Celtic or Ukrainian surnames',
        first: { female: ['Hana', 'Rin', 'Akemi', 'Sayo', 'Tomoe', 'Kiri', 'Mai', 'Suzu'], male: ['Ren', 'Kaito', 'Haru', 'Sora', 'Jun', 'Taiga', 'Ryo', 'Kenji'] }, last: ['Kitsuragi', 'Inari', 'Hoshino', 'Kuroda', 'Amano', 'Fuyuki', 'Sasaki', 'Tachibana'],
        colours: ['red', 'silver', 'black', 'cream', 'amber', 'grey'],
        eyes: ['amber eyes', 'green-gold eyes', 'orange eyes', 'copper eyes', 'yellow eyes'],
        hair: ['{colour} hair, thick and cut to the shoulder, with the ears up through it', 'hair cropped close and {colour}, the ears standing clear above it', 'a long {colour} braid over one shoulder that pales toward the end, the way a fox\'s tail does', '{colour} hair worn loose and a little wild, white at the temples', '{colour} hair pinned up anyhow with whatever was nearest, a pencil today, and coming down by evening'],
        teats: 'two more pairs of small nipples down the belly',
        senses: ['smells of fox musk, strong for {rm_their} size, with a sweetness like violets in it; keen noses know it at once', 'the fur at the ears and the tail is dense enough to lose a finger in and springs back the moment the hand lifts; the pads of the feet are rough and dry as a shoe sole; the breath is warm at the ear when {rm_they} leans in to say something', 'a step so light it makes no sound, and a sudden change of direction in the middle of a stride; a laugh that starts high and ends in a grin of small sharp teeth', 'curls up on any flat surface with a tail over the nose and is asleep by the second breath', 'a yip gets out at a surprise, and a quick chatter when {rm_they} {rm_are} excited; the ears turn to a small sound across the room before anyone else has heard it', 'eats a little and often, and puts things by in hiding places for later, a biscuit, a button, a coin, and forgets half of them', 'says less than {rm_they} knows and enjoys it: a coin palmed, a voice thrown across a room, a straight answer that takes some getting, and a strict private sense of what is fair', 'a tail brushes past at the hip, by accident, twice; the fur of it is cool at the tip and warm nearer the body'],
        room: ['The room is warm, which Kettle Hall is not supposed to be, and the left-hand bed is untouched except for a deck of cards and a saucer of something fried. Your own bed has clearly been slept on.', 'The left-hand side is a fox\'s den in all but name: cushions heaped into a hollow, a brass hand-warmer glowing on the sill, a shelf of board games with the boxes taped and retaped.'],
        hello: ['greets people with a game for stakes, and takes winnings in odd currency, and says so', 'greets people with a question {rm_they} already knows the answer to, to see what they do', 'touches a warm hand to people\'s wrists hello, and notes how cold humans run'],
        hope: 'a game won off {first} and, some day, a shared warm bed on a cold night',
        where: { default: 'room 4B or the library', class2: 'the Glamour studio', evening: 'the arcade on Mondays; otherwise wherever a game is on', night: 'room 4B, curled on whichever bed is warmer' },
        aims: { evening: 'find out what {first} is bad at, and be charming about it' } },
      cat: { genders: ['female', 'male'],
        nameStyle: 'in the cat fashion: soft first names of one or two syllables; comfortable English or Persian surnames',
        first: { female: ['Mina', 'Tabitha', 'Sable', 'Mischa', 'Nell', 'Ottilie', 'Pepper', 'Wynne'], male: ['Jasper', 'Felix', 'Oswin', 'Silas', 'Rafe', 'Ambrose', 'Cosmo', 'Tobiah'] }, last: ['Sorrel', 'Ashgrove', 'Pennyworth', 'Vance', 'Calloway', 'Marlowe', 'Fenn', 'Whitlock'],
        colours: ['grey tabby', 'black', 'ginger', 'tortoiseshell', 'white', 'blue-grey'],
        eyes: ['green eyes', 'copper eyes', 'yellow eyes', 'eyes one blue and one gold', 'grey-green eyes'],
        hair: ['{colour} hair cut blunt at the jaw, the ears standing up through it', 'a {colour} crop so short it lies like fur, and takes a hand the same way', 'long {colour} hair twisted up behind the ears, out of the way, and coming down a strand at a time by evening', '{colour} hair the same shade as the fur, so sleek it looks groomed, which it is', '{colour} hair in a loose plait over one shoulder, the end of it worried thin between finger and claw'],
        teats: 'three more pairs of small nipples in two rows down the belly',
        senses: ['smells of almost nothing but warm clean fur, and of sun where {rm_they} {rm_have} been lying; the fur along the spine is soft and lifts to meet a hand', 'the paws are warm and padded and make no sound; the claws, when they show, are needle-fine and cool, and slide in again before they can catch a sleeve; the tongue is rough as a cat\'s, and {rm_they} knows it', 'a purr that comes up through the chair before it can be heard, and stops when {rm_they} catches anyone listening; a step with nothing in it, so that {rm_they} {rm_are} at an elbow and has been for a while', 'warm from the sun wherever {rm_they} {rm_have} been lying, and heavier asleep across a lap than {rm_they} looks; asleep through half the day, then wide awake at dusk and again before dawn, the pupils wide and black', 'the ears are warm and thin and move under a fingertip; the tail-tip finds a wrist nearby and curls there, as if it were its own idea', 'lands from any height without a sound and walks the top of a bookcase as if it were a floor; on waking, a slow stretch that takes the whole body', 'anything small that moves holds {rm_their} eye, and the body drops into a crouch before {rm_they} {rm_have} decided to play', 'with the few {rm_they} {rm_have} chosen, a cheek rubbed along a jaw in greeting and then distance; held when {rm_they} did not choose it, {rm_they} goes stiff and slips away'],
        room: ['The left-hand bed has not been slept in; the windowsill has. There is a folded blanket on it, worn into a hollow, and the window is angled to catch the last of the sun.', 'The left-hand side is spare and exact: a bed made tight, a shelf of library books in call-number order, a cushion on the radiator cover where the warmth is.'],
        hello: ['grooms people {rm_they} likes without asking and is surprised when they mind', 'greets people by sitting on whatever they were about to use', 'blinks slowly at people hello and waits for them to work out what it means'],
        hope: 'a warm lap and, some day, to be chosen over the sun',
        where: { default: 'room 4B windowsill or the library ledges', evening: 'the library until it closes; skips the mixer', night: 'the windowsill in 4B, or {first}\'s bed if it is warmer' },
        aims: { evening: 'skip the mixer, and be faintly disappointed if {first} goes' } },
      mer: { genders: ['female', 'male'],
        nameStyle: 'in the merfolk fashion: first names of water, tide and shell; Cornish, Breton or Portuguese surnames',
        first: { female: ['Delphine', 'Marina', 'Nerys', 'Isolde', 'Oona', 'Thalassa', 'Morwenna', 'Ondine'], male: ['Caspian', 'Morgan', 'Finn', 'Dylan', 'Ronan', 'Llyr', 'Ithel', 'Tal'] }, last: ['Tarn', 'Seabright', 'Tidewell', 'Marrin', 'Deepwater', 'Strand', 'Kelso', 'Brine'],
        colours: ['blue-green', 'silver', 'coral', 'deep blue', 'pearl', 'kelp-dark'],
        eyes: ['sea-green eyes', 'grey eyes like water under cloud', 'eyes black as a seal\'s', 'dark blue eyes'],
        hair: ['long heavy hair, always damp, that goes {colour} where the light finds it and leaves a wet print on whatever {rm_they} leans against', 'hair cropped close and sleek as sealskin, still beaded from the last swim', 'a thick wet plait down the back, dark with water, that drips a slow line between the shoulder blades', 'hair that dries in loose waves, {colour} at the tips, and is wet again by evening', 'hair twisted up and pinned with a shell comb, {colour} where it has begun to dry at the temples'],
        senses: ['smells of cold water, salt and stone; the skin is cool as the lake and faintly damp, the scales smooth stroked one way and catching the fingertips the other', 'a shoulder cold against another when {rm_they} leans in to say something; the webbing between the fingers thin and cool against a palm; the hair wet wherever it ends, and cold where it touches', 'a voice that carries, and under water seems to arrive from everywhere at once; a drip on the floor wherever {rm_they} stands', 'moves a little stiffly on land for the first minute out of the water, and then like anyone; sleeps in the tank-bed with the face under', 'a hand that is cold, then cool, and warms to another only after a long while; the bench wet where {rm_they} sat, and the air there a degree colder', 'soaks every day and sleeps best afloat; a missed day brings cracked skin and a cracked temper, and wet, {rm_they} {rm_are} quick, strong and at ease', 'eats from the sea, mostly raw, and salts everything else; near the spring tides the scales run brighter and the singing comes more often, and it passes with the tide'],
        room: ['The left-hand bed is not a bed. It is a long shallow basin of dark water with a lip of tile, and the floor around it is damp, and the whole room smells faintly of salt. Someone has put a towel on your bed with a note: sorry about the floor.', 'The left-hand side has been tiled, badly, by a student, and a deep trough of lake water fills it edge to edge; a stone jug of spring water sweats on the sill and there is sand in the corners of the room.'],
        hello: ['greets people with a cup of salt spring water and a straight question', 'greets people with a wet hand on the back of the neck, which is friendly where {rm_they} comes from', 'says hello with a song-note that carries, and then an ordinary sentence'],
        hope: 'a swim with {first} in the lake and, some day, a dive under it together',
        where: { default: 'room 4B or the lakeshore', class1: 'the Anatomy theatre', evening: 'the lake on Thursdays; otherwise the shore', night: 'the tank-bed in 4B' },
        aims: { evening: 'find out whether {first} can swim, and say so in front of the Moonrunners' } },
      dryad: { genders: ['female', 'male'],
        nameStyle: 'in the dryad fashion: first names of trees and wood; surnames of hollows, groves and hills',
        first: { female: ['Willa', 'Linden', 'Elowen', 'Sylvie', 'Maple', 'Aspen', 'Laurel', 'Birch'], male: ['Ash', 'Alder', 'Cedar', 'Elm', 'Rowan', 'Hawthorn', 'Larch', 'Yew'] }, last: ['Greenhollow', 'Oakhurst', 'Ashfall', 'Thornbury', 'Mossback', 'Rootwell', 'Longbough', 'Fernhill'],
        colours: ['silver birch', 'dark oak', 'red rowan', 'pale ash', 'willow-green', 'copper beech'],
        eyes: ['eyes the green of a pond', 'moss-green eyes', 'eyes the brown of autumn beech, grained', 'eyes the pale green of new leaves'],
        hair: ['long hair the colour of {colour} bark, worn down the back', 'short hair, cut close, the colour of {rm_their} own wood', 'hair worn loose, {colour}, to the waist', '{colour} hair cut to the jaw and pushed back off the brow', '{colour} hair plaited back in one thick plait'],
        senses: ['smells of sap, leaf mould and rain, and of blossom in season; warm to lean against, as a branch is in sun', 'the bark of the forearms is rough and grained under the hand and warmer than skin; the leaves in the hair are cool, and real, and stir when breathed on; the hands are dry and gentle and slow to let go', 'a voice like something settling in an old house, low and slow; a creak from somewhere in {rm_them} when {rm_they} {rm_do} turn quickly, which is seldom', 'stands so still {rm_they} {rm_are} taken for part of the room until {rm_they} {rm_are} not; sleeps upright beside the sapling with {rm_their} feet in its soil, and the soil is warm in the morning', 'the leaves in the hair turn toward the window, droop when {rm_they} {rm_are} thirsty and rustle with feeling; barefoot, {rm_they} set{rm_s} each foot down whole, the toes spreading on the boards, and {rm_are} in no hurry about it', 'eats little and drinks water by the jug; on a grey day indoors the leaves in the hair hang limp, and an hour of sun or rain lifts them again', 'in autumn the leaves in the hair turn colour and fall, a few always on the desk; quick and bright in spring, slow and drowsy through winter, with little appetite'],
        room: ['Half the room is a tree. A sapling stands in a pot the size of a bath on the left-hand side, its top brushing the ceiling, and the floor around it is soil and moss and the smell of a wood after rain. There is a bed under there somewhere.', 'The left-hand side is a garden: window boxes on every ledge, a climbing thing gone up the wardrobe and along the picture rail, a bed with roots for legs, and light that seems greener on that side of the room.'],
        hello: ['greets people with tea from the sapling\'s sap, sweet, and does not mind if it is refused', 'greets people by putting a leaf in their hand, which is a dryad\'s way of saying the person will be remembered', 'says hello some seconds after being greeted, having thought about it'],
        hope: 'an hour of sitting still together now and then and, some day, a night under {rm_their} tree',
        where: { default: 'room 4B beside the sapling, or the Greenhouse Quarter', class1: 'the botany glasshouses', evening: 'the dryad trees in the Greenhouse Quarter on Fridays; otherwise 4B beside the sapling', night: 'room 4B, upright beside the pot' },
        aims: { evening: 'go to the mixer only if {first} goes, and stand at the edge' } }
,
      rabbit: { genders: ['female'],
        nameStyle: 'in the rabbit fashion: first names of meadows, herbs and dawn; surnames of hedges, downs and warrens',
        first: { female: ['Clover', 'Bryony', 'Tansy', 'Meadow', 'Posy', 'Lettice', 'Primrose', 'Clemmie'] }, last: ['Warrender', 'Downs', 'Hedgerow', 'Burrows', 'Cowslip', 'Thornfield', 'Lapwing', 'Dewhurst'],
        colours: ['agouti brown', 'black', 'white', 'fawn', 'grey', 'broken white and brown'],
        eyes: ['dark eyes', 'hazel eyes', 'blue-grey eyes', 'red-brown eyes like a wild doe\'s'],
        hair: ['{colour} hair cropped close between the ears, as soft as the fur and the same nap', 'a soft fall of {colour} hair that the ears stand up through, pushed back off the brow when {rm_they} works', 'hair the same {colour} as the fur, long and gathered into one plait down the back, the ears clear of it', 'a {colour} fringe pushed across the brow, the rest cropped to the nape', 'two short {colour} plaits, one at each temple, that swing when {rm_they} turns {rm_their} head, the ears standing clear above them'],
        teats: 'two more pairs of small nipples hidden in the belly fur',
        senses: ['smells of hay, cut grass and clover honey; warm and quick to the touch, with a heart that can be felt going', 'the ears twitch away from a hand; the fur of the forearms is dense and soft as a mole\'s; the long hind feet are furred to the sole, and she crosses a wooden floor without a sound', 'the nose moves all the time, even while she talks; a thump of one hind foot on the boards when something startles her', 'sits so still she is forgotten, then is not in the chair; sleeps in the warren pile with whoever is nearest, and is up before the light', 'when she leans on someone it is her whole weight, and it is not much; when she is let close enough to touch noses, the whiskers reach a cheek a moment before the nose does, and the nose is cool', 'the tail is a handful of fur that flicks when she is spoken to from behind; her voice goes quiet rather than loud when she is startled, and comes back when the room does', 'grazes on greens from a pocket all day; when something delights her, a twisting jump of joy gets out before she can hold it in'],
        room: ['The left-hand bed is a burrow of blankets with only an ear showing, and there is a bowl of greens on the sill and a jar of honey with a spoon in it. The window is open an inch and the floor is swept twice a day.', 'The left-hand bed has been pushed into the corner and built up with cushions into a hollow, and the space under it is where the clothes live. A row of seedlings in yoghurt pots along the sill; a smell of hay.'],
        hello: ['touches noses hello, which is how rabbits do it, and has learned to ask humans first', 'grooms a stray hair off people\'s shoulders before she has said her name', 'offers people something green from her pocket, as rabbits do, and eats it herself if they refuse'],
        hope: 'a dawn race with {first} and, some day, a place for {them} in the warren pile',
        where: { default: 'room 4B or the warren allotments', breakfast: 'the dining hall, early, by the greens', free: 'the allotments', evening: 'the warren', night: 'room 4B, under the blankets' },
        aims: { evening: 'walk {first} to the mixer and keep {them} between her and the crowd' } },
      human: { genders: ['female', 'male', 'nonbinary'],
        nameStyle: 'an ordinary name from anywhere in the world',
        first: { female: ['Priya', 'Anika', 'Maren', 'Theodora', 'Ines', 'Rosa', 'Hester', 'Leah'], male: ['Jonah', 'Theo', 'Ferris', 'Owen', 'Tobias', 'Ezra', 'Callum', 'Idris'], nonbinary: ['Sam', 'Robin', 'Ash', 'Kai', 'Rowan', 'Sage', 'Drew', 'Noel'] }, last: ['Nair', 'Pike', 'Quade', 'Marsh', 'Bell', 'Fell', 'Osei', 'Hallow', 'Calder', 'Mercer', 'Okafor', 'Whitlock'],
        colours: ['dark', 'fair', 'red', 'grey-streaked', 'black', 'brown'],
        eyes: ['brown eyes', 'grey eyes', 'green eyes', 'blue eyes', 'dark eyes'],
        hair: ['{colour} hair worn long and loose, pushed back behind one ear to listen', '{colour} hair cut short and close, shaved to velvet at the nape', '{colour} hair tied back with whatever was to hand, as often a pencil as a band', 'a {colour} crop growing out unevenly, longest at the front, where it falls across the brow', '{colour} hair in a plait over one shoulder, thick as a wrist', '{colour} hair in a short bob, a few strands always escaping at the temple', '{colour} hair wound up in a clip and coming down by the hour', '{colour} hair in a low bun, the kind done without a mirror'],
        body: ['entirely human: a face that has been awake since before it was light, colour that comes and goes in the cheeks, and a slow way of looking round a room, as if reading it', 'human, with a face that has decided things, the cheekbones roughened by a season outdoors, and square plain hands with ink on the middle finger', 'human, and a runner, which shows in the long calves and in a flat quick walk that gets {rm_them} to a door first; the arms swing loose, and {rm_they} stand{rm_s} with the weight already on the front foot', 'human, with a soft full face and the weight on one hip, whatever {rm_they} {rm_are} carrying held in both hands, and a look that settles on whoever is talking and stays there'],
        senses: ['smells of soap and coffee and the ferry\'s salt and wet rope, and under that only warm skin, a scent that is gone a step away', 'a handshake, dry and brief, the palm cool and the fingertips a little rough; a habit of standing in doorways, leaning on the frame', 'a flat soft footfall with nothing hard in it, that takes the stairs two at a time', 'pencil shavings and peppermint; a laugh that comes out through the nose first', 'a voice pitched for indoor rooms, that stops at the edge of the table; the creak of a bag strap at every turn', 'a touch, if it comes, is light and taken back after a moment; a pen cap clicked open and shut while {rm_they} think{rm_s}'],
        room: [], hello: ['shakes hands, which on the Isle is a human habit people find quaint', 'nods hello and waits to be told what the custom is here', 'says hello with a question about where people are from'], hope: '', where: {}, aims: {} },
      chimera: { genders: ['female'],
        nameStyle: 'an old, stately name from anywhere in the world',
        first: { female: ['Ottoline', 'Seraphine', 'Imogen', 'Calanthe', 'Vespera', 'Honoria'] }, last: ['Marrow', 'Ashcombe', 'Delacroix', 'Sallow', 'Wyverne', 'Thorne'],
        colours: ['bronze', 'jade', 'black-and-gold', 'copper', 'grey-green', 'ivory'],
        eyes: ['eyes of two colours', 'gold eyes', 'eyes that are a different animal\'s each week'],
        hair: ['hair of no one colour, no two strands agreeing, braided back over one shoulder with small bones knotted into the plait that tick against each other when the head turns', 'a mane of {colour} hair, half of it fur, thick enough to stand on its own and brushed straight back from the brow, where it does not stay', '{colour} hair worn loose to the shoulders, with one streak through it the colour of some other animal entirely'],
        body: ['antlers rising from the brow, worn pale and smooth at the tips, and a left hand with a lion\'s pads and claws, broad and quiet, that turns a page without tearing it; {colour} scales run down the right arm and lie smooth until {rm_they} gestures, when every edge shows; feathers sit flat and glossy at the nape, and a tail that has not decided what it is follows {rm_them} through doorways', 'two short horns, smooth as worn wood, and a harpy\'s wing folded close along one side, which shifts when {rm_they} shrugs; {colour} fur runs soft at the throat, gills along the neck open a little when {rm_they} laughs, and hooves show dark and polished at each step', '{colour} on both arms, scales on one and fur on the other, one colour worn two ways, glossy and soft; a cat\'s eyes that hold a look as long as they like; a pair of small wings at the shoulder blades that do nothing at all, and have never been asked to; and nothing about {rm_them} moves quickly', 'a stag\'s antlers, small and many-pointed, and under them a steady look; {colour} fur at the throat, and below it a right arm all scales and a left arm sleek with short fur, the one glinting and the other not; a long tail, furred for a span and then feathered, and hooves that {rm_they} stands square on', 'horns curled close to the skull, and beneath them eyes that do not look away first; a single harpy\'s wing lies folded along {rm_their} side, and both arms are a woman\'s, {colour} scales down the right one; gills at the neck show as fine pale lines until {rm_they} laughs, and a tail furred at the root and bare at the tip swings when {rm_they} {rm_are} thinking'],
        senses: ['smells of several things at once, musk and feathers and cold water and a warm stable, and the smell changes with which part of {rm_them} is nearest', 'under a hand each part of {rm_them} is the temperature of what it is: the lion\'s paw warm and heavy and careful, the scales cool and dry, the fur at the throat warm as a stable; and the antlers creak a little when {rm_they} turns {rm_their} head', 'a voice pitched low that still reaches the far side of the quad, and a step that is two kinds of step, so {rm_they} can be heard coming before {rm_they} can be seen', 'a laugh that comes from lower in the chest than expected, and the tail, which brushes an ankle in passing and is gone before anyone looks down'],
        room: [], hello: ['greets people with their full name, which she already knows', 'greets people with a question about their journey that she already knows the answer to'], hope: '', where: {}, aims: {} },
      ogre: { genders: ['female', 'male'],
        nameStyle: 'a big plain first name; a surname of stone or bread',
        first: { female: ['Bettina', 'Hulda', 'Gerda', 'Magda'], male: ['Bertram', 'Osric', 'Gunther', 'Halvard'] }, last: ['Stone', 'Brack', 'Holloway', 'Grimsby'],
        colours: ['wet-slate grey', 'green-grey', 'ochre', 'blue-grey'],
        eyes: ['small dark eyes', 'pale blue eyes', 'brown eyes'],
        hair: ['hair shaved down to a dark shadow, the skull under it round and well made', 'a thick iron-grey plait wound twice about the head and pinned with a wooden skewer', 'rust-brown hair thick as rope, worn loose to the shoulders, the ends singed here and there', 'coarse black hair tied back at the nape with a bootlace, the grey coming in at the temples'],
        body: ['an ogre {colour} from brow to knuckle, forearms thick as fence posts and a ladle in one fist held as lightly as a pen; the face wide and calm above all of it', '{colour} all over, with a wide face and the tusks showing when {rm_they} smiles; as wide through the body as a hearth and standing above its mantel, so that {rm_they} ducks under beams out of habit', 'a mountain of {rm_them}, {colour}, so broad through the body that a doorway is a squeeze; eyes that crease before the smile does, and tusks the colour of candle wax', 'huge and {colour}, and nothing {rm_they} {rm_do} is sudden; the eyes nearly close when {rm_they} smiles and the tusks show pale, and the broad hands set a loaf down as if it might wake'],
        senses: ['smells of bread crust, fried onion and, under both, something mineral like a cellar wall; the air beside {rm_them} is as warm as a kitchen at work', 'a hand that would cover a whole shoulder, and that comes down on things as lightly as a folded cloth; a voice that seems to come up through the floor', 'the floorboards announce {rm_them} from two rooms away, and whatever stands on a shelf shivers a little', 'under the hand, the give of risen dough over something that does not give at all; a shoulder that would take anyone\'s whole weight leaning on it', 'when {rm_they} laughs, the laugh goes on past where another person\'s would stop, and something in the room rattles with it'],
        room: [], hello: ['fills a plate without asking', 'says hello from the other side of the kitchen and means it'], hope: '', where: {}, aims: {} }
    }
  },

  transformation: {
    maxPerTurn: 12,
    maxPerDay: 10,  // the slow burn: at most this much influence per kind per story day (the Settings pace overrides it)
    stepGapHours: 1.5,  // story hours between one small step of a change and the next on the same path (the Settings pace scales it)
    fade: { line: 50, afterHours: 6, everyHours: 6, influenceAfterDays: 1, influencePerDay: 2, trackAfterHours: 24, trackEveryHours: 24 },  // a change under half done fades a step after six quiet story hours and another every six; at half it has set; influence drifts two a day after a quiet day, never below the last change's line; on tracks, a part at half or less eases back a waypoint after a quiet story day and another each quiet day after
    elements: { air: 'air', water: 'water', wood: 'wood', fire: 'fire', light: 'light', shadow: 'shadow', moon: 'moon', metal: 'metal', earth: 'earth' },  // each kind's element (species.element); a settled change gives the player that element: +1 on the die inside it, -1 through any other
    intimacy: 'intensity 4 is the most intimate contact (sex with someone of the kind) and may pass the usual per-turn and per-day limits (both doubled that day)',
    // Charms: worn against the skin, each counts as one contact a story day with its kind, applied by the engine while it is in items.wearing (matched by keys).
    // A cursed piece cannot be taken off by hand and bites deeper each day worn (intensity 1, 2, then 3); a level-3 wardcraft unbinding or the Spa slips it off.
    charms: [
      { key: 'feather_cord', name: 'a harpy feather on a cord', species: 'harpy', keys: ['feather', 'cord'], intensity: 1, from: 'a harpy\'s gift, given once and meant' },
      { key: 'copper_bracelet', name: 'a goblin copper warming-bracelet', species: 'goblin', keys: ['copper', 'bracelet'], intensity: 1, from: 'the arcade stalls, or the first-year Artificing project done well' },
      { key: 'mer_pearl', name: 'a mer-pearl on a chain', species: 'mer', keys: ['pearl'], intensity: 1, from: 'the lakeshore pools, given by merfolk to a swimmer they like' },
      { key: 'foxfire_bead', name: 'a fox-fire bead', species: 'fox', keys: ['fox-fire', 'bead'], intensity: 1, from: 'won, or lost, at the fox tables' },
      { key: 'seed_pendant', name: 'a dryad seed-pod pendant', species: 'dryad', keys: ['seed', 'pendant'], intensity: 1, from: 'a dryad\'s tree, after a season of tending' },
      { key: 'cats_eye_ring', name: 'a cat\'s-eye ring', species: 'cat', keys: ['cat\'s-eye', 'ring'], intensity: 1, from: 'a cat mythkin\'s windowsill, left where the human would find it' },
      { key: 'moonstone_pin', name: 'a moonstone pin', species: 'wolf', keys: ['moonstone'], intensity: 1, from: 'the pack, to someone who has run with them' },
      { key: 'dust_locket', name: 'a locket of fairy dust', species: 'fairy', keys: ['locket'], intensity: 1, from: 'the fairy ring, pressed on a dancer' },
      { key: 'amber_drop', name: 'a clover-amber drop on a thread', species: 'rabbit', keys: ['amber', 'drop'], intensity: 1, from: 'the warren allotments' },
      { key: 'brass_bell', name: 'a small brass bell on a ribbon', species: 'cow', keys: ['brass', 'bell'], intensity: 1, from: 'the Creamery fair' },
      { key: 'silver_collar', name: 'a tarnished silver collar that closes by itself', species: 'cat', keys: ['silver', 'collar'], intensity: 1, cursed: true, from: 'the Unpriced Table at the night market, where nothing has a price and everything has a cost' },
      { key: 'fur_ring', name: 'a ring of braided grey fur', species: 'wolf', keys: ['braided', 'fur'], intensity: 1, cursed: true, from: 'the Unpriced Table, or found on the Moon Field after a run' },
      { key: 'black_feather', name: 'a black feather pin that will not unpin', species: 'harpy', keys: ['black feather'], intensity: 1, cursed: true, from: 'the Unpriced Table, or the Doorless Tower' },
      { key: 'green_torc', name: 'a torc of living green wood', species: 'dryad', keys: ['torc'], intensity: 1, cursed: true, from: 'the Glass Orchard' }
    ],
    // Curses and marks: cast on or caught by the player, each counts as one contact a story day with its kind for so many days, applied by the engine while it is in items.curses; then it lifts (the Spa lifts it early).
    curses: [
      { key: 'feather_hex', name: 'the feather-hex', species: 'harpy', keys: ['feather-hex'], intensity: 2, days: 3, from: 'a Sigil Circle prank, or a ward mis-sung in the Aerie' },
      { key: 'pack_bite', name: 'the pack\'s bite', species: 'wolf', keys: ['pack\'s bite'], intensity: 2, days: 3, from: 'a werewolf\'s bite in anger, which the pack punishes' },
      { key: 'ring_mark', name: 'the fairy-ring mark', species: 'fairy', keys: ['fairy-ring mark'], intensity: 2, days: 3, from: 'dancing the fairy ring at midnight, or stepping into one uninvited' },
      { key: 'tide_mark', name: 'the tide-mark', species: 'mer', keys: ['tide-mark'], intensity: 2, days: 3, from: 'swimming past the buoys after dark' },
      { key: 'goblin_debt', name: 'a goblin debt unpaid', species: 'goblin', keys: ['debt'], intensity: 1, days: 5, from: 'a bargain sealed and broken; paying it lifts the mark early (remove it from items.curses)' },
      { key: 'fox_due', name: 'the fox\'s due', species: 'fox', keys: ['fox\'s due'], intensity: 2, days: 3, from: 'cheating a fox at their table' }
    ],
    // A man's body going toward a woman's grows breasts by the Tanner stages, one a rung, and the genitals change last, stated once
    // and clinically; {chest} at the end is the path's own draw (the kind's pool), so the grown shape is one woman's, not a stock one. It is that draw's
    // shape alone, the part before its first semicolon: what the breasts do (a bovine woman's milk) comes later, in the kind's women steps.
    sexStages: {
      tanner2: 'the first breast buds: a small firm mound under each nipple, tender to a strap, the areola widening and a shade darker than it was',
      tanner3: 'the breasts and areolae enlarging together: a soft swell now that rounds the front of a shirt, the areola still lying in the breast\'s own contour, the nipples fuller',
      tanner4: 'the areola and nipple rising as a second, smaller mound of their own, puffy, on a breast that now fills a cupped hand',
      tanner5: 'the breasts at their grown shape, the areola settled back into the breast\'s contour and the nipple standing from it: {chest}',
      genitals: 'the last of it, found in the shower rather than the mirror: over the weeks the penis has drawn in and shortened to a clitoris under its hood, the testicles have gone up and the scrotum has closed and folded into labia, and between them a vagina has opened; a woman\'s genitals, complete and ordinary, to be stated once plainly and not dwelt on',
      // The rest of a body going over, shared by every kind and told beside the kind\'s own lines: the skin, the gait, the scent and the rhythm of feeling.
      skin1: 'the hair on the chest, belly and back thinning and lightening, and the skin of the cheeks smoother under the razor, which finds less each week',
      skin2: 'the skin finer and softer all over, bruising at a knock and feeling more: cloth, cold and a hand all register further than they did',
      rhythms1: 'feeling moving more freely, tears and laughter both arriving sooner; what the body wants, when it wants, slower to start and spread wider through it, and what to make of that is {first}\'s',
      gait1: 'balance off on the stairs and in a quick turn, the stride shortening and the hips moving with it; the arms carry differently around the chest',
      scent1: 'the sweat milder and the skin smelling warmer and sweeter; any keen nose on the Isle would say a woman\'s'
    },
    sexChange: { cow: { to: 'female', chance: 0.5 }, wolf: { to: 'female', chance: 0.5 }, harpy: { to: 'female', chance: 1 }, goblin: { to: 'female', chance: 0.5 }, fairy: { to: 'female', chance: 0.5 }, fox: { to: 'female', chance: 0.5 }, cat: { to: 'female', chance: 0.5 }, mer: { to: 'female', chance: 0.5 }, dryad: { to: 'female', chance: 0.5 }, rabbit: { to: 'female', chance: 1 } },  // paths that may also carry the body toward a woman's, rolled once when the path's first change begins
    rungOrder: {shuffle: [1, 2, 3], keep: {harpy: [[2, 3]], goblin: [[1, 2]], fairy: [[2, 3]], fox: [[2, 3]], cat: [[2, 3]], mer: [[2, 3]], dryad: [[1, 3], [2, 3]]}},  // the middle rungs come in an order drawn once per path; keep lists content pairs that must stay in order
    // The change-tracks model (the design document): each kind, the body's sex and a bond run on tracks 0 to 100, each with a weight
    // (the weights of a body sum to 100 with its by-sex tracks) and its stages at even intervals. A track with needs holds until the
    // named track has reached that stage ("finished" is its last); a sex track opens only for the matching body. range gives how far
    // the feature may go on a given body (least, standard, most; a face track runs 0 to 30 only); endsAs is its one-line finished state.
    // On a body going over, a kind's by-sex track opens at its crossAt on the way over (a season, or a man's own trait, where the
    // body's Rhythms reaches stage 3), else at Chest 3 (a woman's) or Frame 2 (a man's). tell says how a sex track's waypoints are
    // told, and paceWith runs a sex track alongside another (the woman's waist and hips with Chest stages 2 to 4). A bond facet with
    // base starts at its first line (where anyone starts); its marks name moments the narrator reports that lift it to a stage.
    // sexDraws are the words drawn once when the way over is rolled, so the result is one particular woman or man: a woman's face
    // type and rear (her waist, hips and thighs come from genPools.looks.build with the kind's build over it, her height from the
    // kind's), a man's look, beard and body hair (his build the same way). A kind's looks.sexDraws narrows these pools.
    sexDraws: {
      woman: { face: ['oval', 'heart-shaped', 'round and soft', 'long and fine-boned', 'high-cheekboned', 'square-jawed and striking'], rear: ['a round rear', 'a full rear', 'a small high rear', 'a narrow rear'] },
      man: { look: ['handsome', 'beautiful'], beard: ['a full beard', 'a short beard', 'a light beard', 'no beard'], bodyHair: ['heavy chest and leg hair', 'light chest and leg hair', 'smooth, with almost none'] }
    },
    // How a waypoint is lived, for its note from the engine: the stage line is the fact, this is what the body does as it arrives. Keyed
    // "kind.key", else "key" (a string aliases another key), else "_" ("_ways" for a kind's habits); the way over's tracks by "woman.key"
    // or "man.key". on is a part's first waypoint, mid the ones between, end its last; touch is what a hand on a finished part does. Every
    // clause is a bodily event (ache, burn, itch, pressure, tingling, heat, soreness, oversensitivity, relief), never how the person
    // feels about it, and a shared entry names no shape a kind's own lines do not give it.
    felt: {
      _: {
        on: ['an ache, an itch or a tight pull in one place, there and gone', 'a tingling and faint heat in one place'],
        mid: ['the same place hotter or itching, sore to press', 'a pulling ache that eases in the cool and returns with use'],
        end: ['the ache gone, a new sensitivity in its place'],
        touch: ['a touch there landing sharp and warm together']
      },
      _ways: {
        on: ['a small shift in how the body sits or breathes, noticed before it is understood', 'a flicker in the chest or stomach without a cause'],
        mid: ['the shift returning and staying longer, in the shoulders, breath or gut', 'a restlessness that eases with food, rest or company'],
        end: ['the shift settled into habit, unnoticed until crossed']
      },
      forearm_coat: {
        on: ['a hot itch at the wrist bones that wakes the body at night', 'a prickling along the wrists that scratching only stirs'],
        mid: ['a dull soreness at the roots when a sleeve is shoved up', 'the hairs lifting and settling in a breath of air'],
        end: ['warm to the bone, the skin answering a stroke before the coat does'],
        touch: ['a palm held still on it, its heat soaking slow to the bone']
      },
      forearm_pelt: 'forearm_coat',
      leg_and_hip_coat: {
        on: ['a crawling tickle behind the knees, as if an insect walked there', 'a prickling at the ankles like a foot waking, but travelling up'],
        mid: ['the shins too hot under a blanket, cool air on them a relief', 'a dense warmth at the knees, sweating under wool'],
        end: ['the legs warm in any weather and quick to sweat'],
        touch: ['a hand resting on the thigh, its heat sinking slow into the muscle']
      },
      leg_and_hip_pelt: 'leg_and_hip_coat',
      spine_strip: {
        on: ['a line of prickling gooseflesh low on the back, there and gone', 'an itch low on the back, just out of reach'],
        mid: ['a hot itch between the shoulder blades, worst against a chair', 'the skin of the back tingling ahead of the hair'],
        end: ['warm to lie on, a long loosening shiver when ruffled the wrong way'],
        touch: ['against the lie a shudder; with it, a slow warmth that settles the breath']
      },
      spine_line: 'spine_strip',
      'cow.tail': {
        on: ['a sharp flare at the tailbone when sat on, and a twitch with nothing to move'],
        mid: ['a hot, tender pull at the tailbone as the length slides out', 'a flick from nowhere, the muscle moving before the thought'],
        end: ['the tuft swinging at each step, the lower back loose with it'],
        touch: ['a hand near the root a jolt up the spine, sharp and warm']
      },
      'cow.ears': {
        on: ['a tickle deep in each ear and a stiffness at the hinge of the jaw', 'a tingling at the ear rims, a pressure as before a storm'],
        mid: ['a stretching pull along the ear, tender when brushed', 'a tug at the scalp when the head shakes'],
        end: ['the ears warm and quick, aching after a loud room'],
        touch: ['fingers at the root loosening the neck and shoulders; a tug at the rim a sting']
      },
      'cow.nose_and_face': {
        on: ['a tickle deep in the nose, and the upper lip wet'],
        mid: ['a stretching ache across the face, the teeth sore at the roots', 'a cool rush of air deep into the nose on each breath'],
        end: ['the lips soft and quick to feel a breath, the nose tip cool'],
        touch: ['a thumb along the nose, the whole face loosening under it']
      },
      'cow.own_scent': {
        on: ['a new smell on the hands, faint and close'],
        mid: ['the smell rising off the skin as the body heats', 'the smell clinging to cloth after the body has gone'],
        end: ['the smell settled into the skin and into the pillow']
      },
      'cow.feet_and_stance': {
        on: ['a cramp in the soles at night, shoes pinching at the heel'],
        mid: ['a burning knot in each calf by evening, eased by a hand or warm water', 'a stretch at the back of the leg like a cramp that will not release'],
        end: ['the calves quiet, a deep ease after a day on the feet'],
        touch: ['a hand on the calf, hard as rope, drawing a long loosening heat']
      },
      'cow.hands': {
        on: ['a dull pressure under every nail, as if pushed up from beneath', 'an ache in the fingertips, the kind a long carry leaves'],
        mid: ['a sharp sting when the hand is forced open wide', 'a deep heat in the joints that cold eases'],
        end: ['a blunt, sure grip, a tap on a hoof tip felt as a dull ring'],
        touch: ['a fingertip there sending a shiver to the elbow, sharp and warm']
      },
      'cow.toes_and_hooves': {
        on: ['pressure under the toenails, the shoes snug and crowded', 'a dull ache at the toe ends, as if shut in a door'],
        mid: ['a deep toothache in the joints of the foot, worse in the cold', 'a hot throb at the toe ends, eased by cool stone'],
        end: ['the throbbing gone, a cold floor felt only faintly'],
        touch: ['a tap on the horn rings dully up the bone to the knee']
      },
      'cow.eyes': {
        on: ['the lashes brushing the cheek on each blink, the lids heavy'],
        mid: ['a drawing ache behind the eyes as they enlarge', 'a dizzy swim when the head turns fast'],
        end: ['the lids heavy and slow, each blink cool and long']
      },
      'cow.senses': {
        on: ['the back of the nose thick, as before a sneeze', 'a flare of scent so sharp it is almost taste'],
        mid: ['a pressure in the ears before thunder', 'a tickle high in the nose and a sneeze before the weather turns'],
        end: ['a bang a flinch down the spine and heat in the ears']
      },
      'cow.appetite_and_cud': {
        on: ['the stomach turning at cooking flesh, the mouth watering at anything green'],
        mid: ['a slow, steady hunger that eating dulls but does not end', 'a tired jaw after long chewing, eased by a drink'],
        end: ['a heavy, easy fullness after a meal, the belly warm']
      },
      'cow.weight_and_strength': {
        on: ['a loaded heaviness in the legs, a lag between deciding and moving'],
        mid: ['a worked ache like the day after harvest, eased by sleep', 'a shove landing as a dull nudge'],
        end: ['a deep steadiness in the legs, and sleep that comes heavy and fast']
      },
      'cow.herd': {
        on: ['the shoulders dropping and the heartbeat slowing for no cause', 'the jaw unclenching and the hands going still'],
        mid: ['a warmth in the chest that rises when someone sits close', 'a restless itch in the legs when left alone'],
        end: ['a slow-breathing ease against a warm body, a restless prickle alone'],
        touch: ['a hand laid on the back loosens the whole spine']
      },
      'cow.voice': {
        on: ['a buzz in the throat on the deep words, unbidden'],
        mid: ['the throat loosening and the chest buzzing on a deep word', 'a rumble in the ribs on a laugh'],
        end: ['the throat easy on the deep notes, a long call buzzing in the teeth']
      },
      'cow.teats_and_udder': {
        on: ['a deep itch behind each nipple, a sharp tingle when cloth brushes past'],
        mid: ['a tight, tender ache at each jolt of a step, the skin there itching hot', 'a dull throb low on the belly, under the navel'],
        end: ['cloth and touch both registering sharply, a sway at each step'],
        touch: ['touch lands high and bright, ache and pleasure together']
      },
      'cow.milk': {
        on: ['a tingling at the teats in a warm room, a heaviness that walking jolts'],
        mid: ['a hot heaviness throbbing with each step, the teats tender', 'a tingling rush at the teats and the first drops, warm, then a slackness', 'the udder tight by evening, a warm prickle at the teats at any strong feeling'],
        end: ['a prickle at the teats as milking time nears, and the same prickle, then wet, whenever the body is aroused'],
        touch: ['being drawn off brings relief at once, deep and slow']
      },
      'cow.horns_and_crest': {
        on: ['a dull headache behind the brow, eased by a cool cloth'],
        mid: ['a bony pressure from inside the skull, a thick ache across the nape', 'heat at the base of the horns when the head is bowed'],
        end: ['a steady pull on the neck from their weight, eased by resting the head'],
        touch: ['a thumb rubbed at the root running down the spine as deep, sharp heat']
      },
      'cow.the_bulls_ground': {
        on: ['the legs bracing of themselves when pushed'],
        mid: ['heat climbing the neck when crowded', 'a tightness through the shoulders at a raised voice'],
        end: ['a slow heat in the shoulders when crossed, gone once the other yields']
      },
      // The other kinds' parts, each with its own: shared keys name only what every kind that has the part gives it.
      toes_and_claws: {
        on: ['the toe ends throbbing in shoes, the nails sore at the quick'],
        mid: ['a dull ache deep in the ball of the foot', 'the nail beds hot, a stubbed step a sharp sting'],
        end: ['cold stone underfoot a sharp shock, warm wood a relief']
      },
      feet_and_stance: {
        on: ['a cramp in the soles at night, shoes pinching at the heel'],
        mid: ['a burning in the calves by evening, eased by a hand or warm water', 'the new pad springy and good to stand on'],
        end: ['the calves quiet and the balance sure, a spring in each step']
      },
      further_pairs: {
        on: ['a small tender itch in two lines down the belly'],
        mid: ['pinpoints of tenderness down the belly, sore to a waistband', 'a light touch down the belly a tingle, warm and good'],
        end: ['a hand down the front catching at every one, a sharp bright tingle each time']
      },
      tail: {
        on: ['a sharp flare at the tailbone when sat on, and a twitch with nothing to move'],
        mid: ['a hot, tender pull at the tailbone as the length comes', 'the lower back sore and tired from a new weight to carry'],
        end: ['the weight of it settled, the lower back easy with it'],
        touch: ['a tug at it felt as a sharp jolt down both legs']
      },
      ears: {
        on: ['an itch deep inside the ear that a finger cannot reach'],
        mid: ['a pull along the ear as it changes, tender when brushed', 'a sore tiredness at the root of each ear by evening'],
        end: ['sore after a loud room, cold at the tips in wind']
      },
      nose_and_face: {
        on: ['an itch inside the nose at every new smell, and a sneeze'],
        mid: ['a dull pull across the nose and jaw as they change', 'a smell arriving so rich it is almost taste'],
        end: ['the face settled, the nose cool and quick']
      },
      face: {
        on: ['the cheekbones tender to press, the face stiff on waking'],
        mid: ['a tightness across the face as it settles', 'a palm on the cheek cool and soothing'],
        end: ['the face at rest, its own and quiet under a hand']
      },
      teeth: {
        on: ['a throb in the jaw at night, and cold water sharp on the teeth'],
        mid: ['the gums sore, the tongue learning the new edges', 'biting into something firm a relief'],
        end: ['the ache gone, the jaw quiet']
      },
      height: {
        on: ['the long bones aching at night'],
        mid: ['the joints sore at night as the body draws in', 'the floor a little nearer than the feet expect'],
        end: ['the ache gone, the body light and quick at its new height']
      },
      figure: {
        on: ['a dull ache at the hips or ribs as the frame changes'],
        mid: ['the ribs or hips sore at night', 'the new curve warm under a hand'],
        end: ['a frame settled and easy to carry']
      },
      build: {
        on: ['a stiffness through the frame as it changes'],
        mid: ['an ache through the frame as it settles', 'a stretch after it, long and good'],
        end: ['the frame settled, quick and light to move']
      },
      'wolf.hands': {
        on: ['a soreness at the quick of every nail'],
        mid: ['the fingertips tender as the pads come', 'the palm pad warm and good against a smooth surface'],
        end: ['a sure grip, the pads warm and quick to feel a texture']
      },
      'fox.hands': 'wolf.hands',
      'wolf.teeth_and_jaw': {
        on: ['the gums hot and swollen, a cold drink sharp on them'],
        mid: ['a sharp nip to the lip on a careless bite', 'a good ache at the temples after chewing'],
        end: ['the ache gone and a strong bite in its place']
      },
      'wolf.eyes': {
        on: ['a dull ache behind the eyes at lamplight'],
        mid: ['a squint in full sun', 'the dark restful, opening up shape by shape'],
        end: ['the eyes rested by night, sore after a bright noon']
      },
      'wolf.spine_ruff': {
        on: ['the hair at the nape lifting with a cold shiver, the skin there tight'],
        mid: ['a crawling itch up the middle of the back, worse in a warm bed', 'a hand down the back easing the itch, slow and good'],
        end: ['a crawl of heat up the back as it rises, a long slack breath as it lies']
      },
      'wolf.mantle': {
        on: ['the neck stiff on waking'],
        mid: ['an itch across the shoulders as the mantle comes in', 'a hand across the shoulders warm and steadying'],
        end: ['a weight of warmth at the nape, the neck slow to tire']
      },
      'fox.second_tail': {
        on: ['a twitch at the tailbone out of time with the tail'],
        mid: ['a hot pull at the root as the new one grows, tender to sit on'],
        end: ['a doubled weight settled at the tailbone, each root warm to a palm']
      },
      'fox.eyes': {
        on: ['the eyes watering at noon'],
        mid: ['a pinch behind the eye at noon', 'dusk a relief, the eyes easing wide'],
        end: ['dusk the best light, noon a narrow squint']
      },
      'fox.bib': {
        on: ['a soft itch under the chin that runs down on swallowing'],
        mid: ['a stroke along the throat a small pleasure'],
        end: ['a hand at the throat felt down to the breastbone, warm']
      },
      'cat.hands': {
        on: ['the quick sore under each nail, a pinch when gripping'],
        mid: ['an ache in the fingertips, and a tingle at a soft fabric', 'the pads warm and tingling on velvet or fur, a small pleasure'],
        end: ['a stretch through the fingers running up to the elbow, slow and good']
      },
      'cat.teeth_and_tongue': {
        on: ['the gums hot and tender, a sore spot where the tongue rubs'],
        mid: ['the tongue catching on the lips', 'the rough tongue across the back of the hand a small comfort'],
        end: ['the soreness gone, the lips catching on the fang tips']
      },
      'cat.whiskers_and_face': {
        on: ['a tickle at the lip as if a hair were caught there, and a sneeze'],
        mid: ['a whisker caught on cloth a sharp sting at the root', 'a stroke along the cheek a pleasure that half-closes the eyes'],
        end: ['a brush at the whiskers a tingle to the eyes']
      },
      'cat.eyes': {
        on: ['a dull ache behind the eyes in lamplight'],
        mid: ['a sting in full sun until the lids half close', 'the dark restful, the eyes wide and easy in it'],
        end: ['night as easy as day, a lamp in the face a sharp ache']
      },
      'cat.toms_build': {
        on: ['the neck stiff on waking'],
        mid: ['a heavy ache at the back of the neck and across the shoulders', 'the forearms heavy and warm after use'],
        end: ['an easy strength in the neck and arms, slow to tire']
      },
      'rabbit.hands': {
        on: ['the fingertips tender at the quick'],
        mid: ['an itch over the knuckles that rubbing on cloth soothes', 'a soft warmth across the knuckles, good under a stroke'],
        end: ['the fingertips quick and dry, the claws a light scratch on skin']
      },
      'rabbit.toes': {
        on: ['the toe ends sore and hot by evening'],
        mid: ['a hot pull at the root of the foot, sore to stand on', 'a tickle under the feet at each step'],
        end: ['the floor\'s chill kept off, each step soft and quiet']
      },
      'rabbit.hind_feet': {
        on: ['the soles hot and restless at night'],
        mid: ['a sore stretch along the sole at each step', 'a good burn in the calves after a jump'],
        end: ['the soles warm and springing, the calves tight and ready at rest']
      },
      'rabbit.belly_fur': {
        on: ['a fine tickle under the waistband'],
        mid: ['a hand on the belly a pleasure, the skin under it tingling'],
        end: ['a palm on the belly settling the breath slow and deep']
      },
      'rabbit.bob_tail': {
        on: ['a hot soreness low on the back, worst on a hard bench'],
        mid: ['a tender throb at the root after a fright'],
        end: ['the lower back warm and loose, sitting easy again']
      },
      'rabbit.nose_and_lip': {
        on: ['a tickle at the upper lip, and sneezing at dust'],
        mid: ['a soreness down the middle of the mouth, as if chapped', 'the air full of good smells, each breath a sniff'],
        end: ['every smell sharp and near, the lip quick to feel a breath']
      },
      'rabbit.front_teeth': {
        on: ['the gums sore and hot, eased by chewing'],
        mid: ['gnawing something hard a relief'],
        end: ['a sharp clean bite, the jaw quiet after a good chew']
      },
      'rabbit.eyes': {
        on: ['the eyes gritty by evening'],
        mid: ['full sun making the eyes water', 'the wide view restful, the whole room held at once'],
        end: ['the eyes slow to tire, the lids heavy at noon']
      },
      'harpy.arm_feathers': {
        on: ['a heat down the outsides of the arms, as after too long in the sun'],
        mid: ['a hot, crawling soreness along the arms, eased by cool water', 'the down soft and warm, smoothing it a pleasure'],
        end: ['a ruffle along both arms at a chill or a start, then a slow settling']
      },
      'harpy.wings': {
        on: ['a hot itch down the outside of each arm, worst at the wrist'],
        mid: ['the shoulders stiff and sore from the new weight', 'air under the feathers lifting the arm, a rush of pleasure'],
        end: ['a deep burn across the chest after flying, and the air felt along every feather']
      },
      'harpy.hands': {
        on: ['a cramp through the palm when gripping, worst when writing'],
        mid: ['a deep cramp along the outside of the palm at night', 'the grip of what is left sure and strong'],
        end: ['the claw tips quick to feel what they touch']
      },
      'harpy.talons': {
        on: ['the toe ends sore in shoes'],
        mid: ['a deep pull through the arch', 'the scales itching up the shin and the calf burning', 'a rail under the foot steady and good'],
        end: ['the calves quiet, the soles hard to bruise']
      },
      'harpy.leg_and_hip_feathers': {
        on: ['a hot itch under the skin of the thighs, worst sitting'],
        mid: ['a sore tightness at each hip bone', 'a smoothing hand over the thighs a long, warm shiver'],
        end: ['the thighs warm in any weather, a feather pulled against its lie a sharp sting']
      },
      'harpy.tail_fan': {
        on: ['a sore heat at the tailbone, an itch no scratching reaches'],
        mid: ['a dull ache low in the back after any quick turn'],
        end: ['a stroke along the quills smoothing the whole back']
      },
      'harpy.crest_and_ears': {
        on: ['an itch on the scalp that combing makes worse, and sore spots under it'],
        mid: ['the ear openings cold in any draught', 'a shiver at the feather roots, sudden and bright'],
        end: ['the scalp alive under the crest, a hand through it a shiver to the nape']
      },
      'harpy.eyes': {
        on: ['a strain behind the eyes from looking far'],
        mid: ['the eyes hot and smarting in glare', 'distance coming clear, a pleasure to look out at'],
        end: ['a long look across the sky resting the eyes']
      },
      'harpy.light_bones': {
        on: ['the long bones aching in the cold'],
        mid: ['soreness along the ribs and breastbone', 'the body light enough that stairs are a pleasure'],
        end: ['light and quick, a bruise from a knock']
      },
      'mer.webbed_hands': {
        on: ['a soreness at the base of each finger, and a pull when the hand opens wide'],
        mid: ['the web tender when spread', 'water pulled through the spread fingers, strong and good'],
        end: ['a firm push of water against each palm, the hands tireless swimming']
      },
      'mer.webbed_feet': {
        on: ['the toes pinching at the sides of the shoes'],
        mid: ['the skin between the toes tender when they spread', 'bare feet in water a relief'],
        end: ['the feet spread and strong in water']
      },
      'mer.arm_scales': {
        on: ['a tingling across the backs of the hands in water, like small fish nibbling'],
        mid: ['a rasp of new edges against cloth', 'the forearms itching as they dry, eased at once by water'],
        end: ['the forearms quick to feel a current, a cold eddy a shiver to the elbow']
      },
      'mer.leg_and_hip_scales': {
        on: ['a tingling over the tops of the feet in water, gone in air'],
        mid: ['a rasp at the shins against bedclothes', 'water on the scales cool and good'],
        end: ['a tight dryness after long out of water, eased at once by a soak']
      },
      'mer.water_tail': {
        on: ['a pull along the inner thighs in water'],
        mid: ['a tingling line down the inside of each leg that swimming makes stronger', 'kicking as one in water strong and good'],
        end: ['a rush of strength in water, the knees weak a moment on dry land']
      },
      'mer.gills': {
        on: ['a flutter under the arms, sharp on a deep breath'],
        mid: ['a soreness at the sides when lain on, eased in a bath', 'a cool flutter along the ribs underwater, steady and good'],
        end: ['a deep coolness through the chest underwater, a tightness after long dry']
      },
      'mer.finned_ears': {
        on: ['the ear rims tender and cool'],
        mid: ['a sore pull at the rims, cool to a fingertip', 'sound underwater clear, an ease in the ears'],
        end: ['a cool flutter at the sides of the head underwater, the roots warm to a fingertip']
      },
      'mer.spine_ridge': {
        on: ['a prickling down the back whenever it meets water, gone again in air'],
        mid: ['a tender line between the shoulders', 'the ridge lifting in water, cool and easy'],
        end: ['a pull down the back as it rises, and the skin along it cool to the touch']
      },
      'mer.sheen_and_skin': {
        on: ['an itch over the whole body by evening, gone in a bath'],
        mid: ['the skin tight in dry air', 'water on the skin feels good'],
        end: ['the skin easy only when wet, tight and itching when dry']
      },
      'mer.eyes': {
        on: ['the eyes dry and scratchy in air'],
        mid: ['water on the eyes cool and soothing', 'a cool slide across the eye underwater'],
        end: ['the eyes at ease underwater, dry in air']
      },
      'mer.breasts': {
        on: ['a tingling across the chest whenever it is wet'],
        mid: ['the breasts tender as they change', 'a palm warming them slowly, a pleasure'],
        end: ['a cool, slick softness in water, the nipples tight in cold air']
      },
      'mer.colours': {
        on: ['the skin under the scale edges prickling'],
        mid: ['the bands warm in the sun', 'a deep ache across the shoulders as they broaden'],
        end: ['colour bright and warm in the sun']
      },
      'dryad.hands': {
        on: ['the fingertips sore at the quick'],
        mid: ['the fingers stiff in the mornings', 'soil and growing things good under the fingers'],
        end: ['the knuckles stiff in cold and supple in sun, the grip slow to tire']
      },
      'dryad.feet_and_roots': {
        on: ['a sharp catch at the toe tips on every sock'],
        mid: ['the soles sore on stone and cobbles', 'a cool, good pull through the soles on soil'],
        end: ['a slow drink of cool drawn up from the ground, the legs heavy and quiet']
      },
      'dryad.arm_bark': {
        on: ['a tight itch over the knuckles, cracking sore when the hand closes'],
        mid: ['an itch where the bark meets the skin', 'sun on the bark a slow warmth'],
        end: ['the forearms slow to bruise and slow to cool, aching dully when dry']
      },
      'dryad.leg_and_hip_bark': {
        on: ['a sting after a hot wash, the ankles itching where cloth rubs'],
        mid: ['the backs of the knees stiff and sore on stairs', 'the bark warm in the sun'],
        end: ['the legs heavy and sure, a slow warmth rising through them in sun']
      },
      'dryad.spine_ridge': {
        on: ['an itch down the middle of the back, dry and tight like sunburn'],
        mid: ['the plates stiff as they set', 'a long stretch of the back easing the stiffness, slow and good'],
        end: ['the back stiff in the cold, loosening slow and easy in sun']
      },
      'dryad.grain': {
        on: ['a fine prickling all over, like dried salt'],
        mid: ['a hand on the bare arm felt slow and good'],
        end: ['a cut that aches dully for days, the body slow to warm in the morning']
      },
      'dryad.leaves': {
        on: ['the scalp prickling and tender to a comb'],
        mid: ['a soreness along the hairline as they swell', 'sun on the leaves a warmth at the scalp'],
        end: ['the scalp dry and itching in drought, cool and easy after rain']
      },
      'dryad.eyes': {
        on: ['a blur in shade that clears in sun'],
        mid: ['a heaviness behind the eyes in deep shade', 'sun on the closed lids a slow pleasure'],
        end: ['the eyes easiest in green light']
      },
      'dryad.breasts': {
        on: ['a tenderness at the nipples, cloth catching where it slid before'],
        mid: ['the skin at the sides of the chest tight and itching', 'a warm hand on the smooth skin there felt slow and good'],
        end: ['a touch at the tips felt slow and sweet, the skin warm in sun']
      },
      'dryad.bark': {
        on: ['a dry tightness across the top of the back, cracking sore when stretched'],
        mid: ['a stiffness turning the head, slow to loosen in the morning', 'sun across the shoulders a deep warmth'],
        end: ['the back warm through in sun, and a pressed palm felt long after it lifts']
      },
      'dryad.flowering': {
        on: ['a tingling at the scalp where the buds come'],
        mid: ['the scalp heavy and tingling under the flowers, a slow ease after'],
        end: ['a heavy, drowsy fullness as the fruit sets, and a lightness when it falls']
      },
      'dryad.catkins': {
        on: ['a tingling at the scalp where the tassels come'],
        mid: ['an itch in the nose and a sneeze at every shake of the head', 'a buzzing warmth under the skin'],
        end: ['the scalp light and cool once the catkins drop']
      },
      'goblin.green_skin': {
        on: ['a faint tingle across the hands, as after cold water'],
        mid: ['the skin prickling where the green spreads', 'warmth spreading with the green, good as sun'],
        end: ['the skin slow to burn in sun and slow to feel a scratch']
      },
      'goblin.hands': {
        on: ['a stretching ache through the knuckles, as after a long grip'],
        mid: ['the knuckles hot as they loosen', 'a reach that closes on things easily, a small pleasure'],
        end: ['the fingertips quick to feel a catch or a seam']
      },
      'goblin.feet': {
        on: ['a cramp through the arch at night'],
        mid: ['the soles tender on gravel', 'bare feet on a warm floor a comfort'],
        end: ['cool stone good underfoot, a shoe a pinch at once']
      },
      'goblin.nose_and_face': {
        on: ['the nose tender at the tip'],
        mid: ['the mouth corners chapped and tender', 'smells richer than before'],
        end: ['the cheeks tired after laughing']
      },
      'goblin.eyes': {
        on: ['a dull ache behind the eyes by midday'],
        mid: ['dim rooms a relief, the eyes easing', 'the eyes watering in a draught'],
        end: ['dim light restful, a lamp turned up a dull ache']
      },
      'fairy.wing_buds': {
        on: ['a heat between the shoulders, and the back muscles twitching on their own'],
        mid: ['a sore pressure under the skin of the back, worst lying down'],
        end: ['the buds ready, tender to a touch']
      },
      'fairy.wings': {
        on: ['a raw stinging at the shoulder blades, and a wet chill down the back'],
        mid: ['a raw ache at the wing roots', 'air on the wings a cool, bright pleasure'],
        end: ['a hum through the back as they beat, and a deep tiredness across the shoulders after']
      },
      'fairy.sheen': {
        on: ['the fingertips prickling'],
        mid: ['a tingle under the shimmer', 'the shimmer warm in sun, good on the skin'],
        end: ['the sheen warm where it lies']
      },
      'fairy.eyes': {
        on: ['the eyes aching in strong light'],
        mid: ['a dazzle at the edges of things', 'colour a small pleasure everywhere'],
        end: ['strong light a squint, dusk soft and easy']
      },
      'fairy.hands_and_feet': {
        on: ['the fingertips and toes tingling'],
        mid: ['the toes taking the weight, a light spring that feels good'],
        end: ['the fingertips quick and sure on a needle or a knot']
      },
      'fairy.glow_and_dust': {
        on: ['the skin warming at a strong feeling'],
        mid: ['a warmth spreading under the skin before a laugh or tears'],
        end: ['a fine itch as the dust lifts off, the skin warm after']
      },
      'woman.voice': {
        on: ['a catch and a rawness in the throat, as after shouting'],
        mid: ['a looseness at the throat, and a strain in reaching the old low words', 'the voice climbing and thinning on a long word'],
        end: ['speech easy on the throat, the old strain gone']
      },
      'man.voice': {
        on: ['a rawness at the back of the throat, worse by evening'],
        mid: ['a heavy vibration in the chest on the low words', 'a stiffness at the voice box, and a buzz through the ribs when speaking loudly'],
        end: ['the throat easy on a shout, the chest full with it']
      },
      'woman.face': {
        on: ['the cheeks smoother under a palm and the jaw sore, as after a long day of chewing'],
        mid: ['a tender ache along the cheekbones, and the lips quick to chap', 'the lips tingling at anything cold'],
        end: ['the skin of the face registering every touch']
      },
      'man.face': {
        on: ['an itch along the jaw and upper lip, worse in the warm'],
        mid: ['a dull ache at the temples and the skin of the chin itching', 'the chin rough to a palm by evening'],
        end: ['the jaw rough under a hand, a cold wind felt less']
      },
      'woman.skin_and_hair': {
        on: ['a cool tingling over the front of the body, cloth sliding where it used to catch'],
        mid: ['a light touch on the arm felt long after, the cold biting sooner', 'the scalp tingling and tight, a brush through it a long shiver'],
        end: ['a breath of air on the arm raising gooseflesh, the scalp tender to a pull']
      },
      'man.skin_and_hair': {
        on: ['a prickle and itch on the arms and legs, worse under wool'],
        mid: ['a knock that would have marked the skin barely felt', 'an itch low on the belly, and the face greasy by midday'],
        end: ['skin rougher under a palm and slower to feel the cold']
      },
      'woman.frame': {
        on: ['an ache in the collarbones and a stiffness between the shoulder blades'],
        mid: ['a dull ache down the arms at night', 'a cup heavier in the hand than it was'],
        end: ['the body lighter on its feet, the shoulders easy, the old stiffness gone']
      },
      'man.frame': {
        on: ['a stretching ache across the collarbones, sore to lie on one side'],
        mid: ['the knuckles stiff in the morning, the shirt seams biting', 'a deep ache across the shoulder blades'],
        end: ['the body heavier on its feet, the old aches gone']
      },
      'woman.waist_and_hips': {
        on: ['a dull ache at the hips at night'],
        mid: ['a grinding soreness in the hip sockets, worse lying on them', 'the hip sockets clicking at a long step'],
        end: ['the new curves felt in every step, a chair fitting differently']
      },
      'man.waist_and_hips': {
        on: ['a stiffness across the small of the back on waking'],
        mid: ['a grinding soreness in the hip sockets, worst on rising', 'the thighs tight and sore after stairs'],
        end: ['a belt sitting easy, the old ache gone']
      },
      'woman.chest': {
        on: ['a tingling that comes and goes across the chest, and a sharp sting when a shirt rubs'],
        mid: ['a hot, tight tingling under the nipples that wakes the body at night', 'a stretched heat across the chest that cold eases'],
        end: ['the soreness gone, a sway felt at each step, a touch at the tips bright and sharp'],
        touch: ['touch lands high and bright, ache and pleasure together']
      },
      'man.chest': {
        on: ['a soft tenderness and a loosening ache across the chest'],
        mid: ['a dull ache at the nipples when cloth rubs', 'a tight pull across the chest when the arms reach'],
        end: ['the tenderness gone out of the chest, a palm across it felt as plain warmth']
      },
      'woman.scent': {
        on: ['a softer smell on the skin once it is warm'],
        mid: ['less sweat after work, the nape dry', 'the smell lingering on cloth'],
        end: ['sweat lighter and slower to come, sweet on cloth']
      },
      'man.scent': {
        on: ['a strong smell off the skin once it is warm'],
        mid: ['a sharp smell from the armpits after any work', 'the smell lingering on cloth'],
        end: ['sweat heavier and slower to wash out of cloth']
      },
      'woman.balance_and_gait': {
        on: ['a lurch at the top of a stair, the stomach dropping with it'],
        mid: ['the thighs brushing at each step', 'a sway in the walk that tires the lower back by evening'],
        end: ['the old stumbles gone, the feet sure on stairs']
      },
      'man.strength_and_gait': {
        on: ['a tight, ready feel in the arms and a hunger after work'],
        mid: ['things lighter than braced for, a jolt in the arms', 'the shoulders hard and sore after use, quick to recover'],
        end: ['the body easy in its strength, a heavy load barely felt']
      },
      'woman.below': {
        on: ['a tenderness low in the body, sharp to pressure'],
        mid: ['a tender, heightened sensitivity, cloth and touch registering sharply', 'a deep ache that comes and goes'],
        end: ['touch landing deep and bright, the old tenderness gone']
      },
      'man.below': {
        on: ['a restless throb low down that comes at odd hours and ebbs'],
        mid: ['a tender, heightened sensitivity, cloth and touch registering sharply', 'a deep ache that comes and goes'],
        end: ['a quick throb at a brush of cloth']
      },
      'woman.rhythms': {
        on: ['a dull drawing ache low in the belly, there and gone'],
        mid: ['a slow heat that builds under a hand and lingers long after', 'a tenderness that comes and goes'],
        end: ['a dull pull low in the belly and the small of the back as each turn comes round']
      },
      'man.rhythms': {
        on: ['a heaviness low in the chest, the pulse quicker to rise'],
        mid: ['a sudden heat and stiffening low down, sharp and soon over', 'a heaviness low down on waking'],
        end: ['a quick, sharp heat that leaves the head clear after']
      }
    },
    tracks: {
      species: {
        wolf: [
          { key: 'hands', name: 'Hands', weight: 5, range: { least: 'Human-shaped hands with claws and fingertip pads', standard: 'Five strong fingers, pads on tips and palm, blunt claws', most: 'Shorter, thicker fingers with heavy pads and furred backs; still hands that grip and hold' }, endsAs: 'five strong fingers with pads on the tips and palm and blunt claws',
            stages: [
              'Nails thicker and harder from the root, growing to a blunt point however short they are cut.',
              'Fingertip skin thickens into the first of the pads. Touch through them is duller for texture and sharper for pressure and warmth.',
              'The nails are claws: curved, rooted deeper, the quick grown down into them. A pad on every fingertip and one forming across the palm; knuckles heavier. Fine grip has to be relearned.',
              'Five fingers, a pad on each tip and one across the palm, the nails grown to claws that do not sheathe. Still a hand that writes and holds. On bare skin the claws are felt.'
            ] },
          { key: 'forearm_pelt', name: 'Forearm pelt', weight: 4, range: { least: 'Backs of the hands to mid-forearm', standard: 'To the elbows', most: 'To the shoulders, joining the ruff' }, endsAs: 'pelt from the backs of the hands to the elbows',
            stages: [
              'A prickle across the backs of the wrists and hands, then new hairs pushing through there, denser and coarser, in the coat\'s colour.',
              'A soft undercoat spreading up from the wrist, short and close, the skin beneath it hot and itching as it comes in.',
              'Guard hairs pushing through the undercoat, lying toward the hand, reaching most of the way to where the coat will end. Stroked against the lie it prickles and stands.',
              'A full short coat from the backs of the hands up the arm, ending in a soft uneven line; palm and inner wrist stay bare. Touch through it is felt well past the place touched: with the lie it runs warm up the arm, against it a sharp prickle. Sleeves drag over it.'
            ] },
          { key: 'toes_and_claws', name: 'Toes and claws', weight: 4, range: { least: 'Four clawed toes and a small dewclaw on a broad foot', standard: 'Four clawed, padded toes and a dewclaw', most: 'Tight wolf toes with heavy claws' }, endsAs: 'four clawed, padded toes and a dewclaw',
            stages: [
              'Toenails thicker and harder, growing forward to points. Socks and shoes begin to disagree with them.',
              'The big toe shorter and set higher on the inside of the foot, no longer taking weight. Push-off and balance are slightly off.',
              'Four toes thicker and closer together, each nail a claw that reaches the floor. The first toe has ridden up the inside of the foot as a dewclaw. Shoes fit badly at the front.',
              'Four toes, blunt claws that do not sheathe and a pad under each that feels every texture; the dewclaw high on the inside. Nothing with a closed toe fits.'
            ] },
          { key: 'feet_and_stance', name: 'Feet and stance', weight: 8, needs: [{ track: 'toes_and_claws', stage: 2 }], range: { least: 'Heel low, close to a human stance on a long paw', standard: 'Heel raised a hand\'s width, weight on the toes', most: 'A full hock: long foot, heel high, a deep backward bend' }, endsAs: 'paws: weight on the toes and one broad pad, the heel raised',
            stages: [
              'The arches ache, then tighten; the ball of the foot takes more of the weight.',
              'Skin under the ball of the foot thickens into one broad pad. The sole behind it turns soft and tender from disuse.',
              'The bones of the mid-foot lengthen. The heel resists coming down, and standing still means standing on the toes. Calves and shoes both complain.',
              'The foot is markedly longer and the heel rides off the floor, so the leg seems to have a second knee bending backward (it is the ankle). Fur over the top of the foot. Gait, stairs and balance all have to be relearned.',
              'A paw: the long foot furred to the claws, weight on the toes and the broad pad, the heel raised. Quiet on hard floors, and balance is better than it ever was.'
            ] },
          { key: 'leg_and_hip_pelt', name: 'Leg and hip pelt', weight: 8, range: { least: 'Paws to mid-thigh', standard: 'Paws to hips, fading out at the navel', most: 'Paws to hips, and over belly, ribs and back, short and fine on the chest; all but the face' }, endsAs: 'pelt from paws to hips, fading out at the navel',
            stages: [
              'Leg hair denser, in the coat\'s colour, from the ankle up.',
              'Undercoat on the lower leg, the skin beneath warmer; an itch as it comes in.',
              'Full coat to the knee, lying downward and shedding water; undercoat climbing the thigh. Cloth drags against the lie.',
              'Coat over thighs and hips, thicker on the outer thigh, short and fine on the inner. Touch through fur arrives slower and warmer, and spreads.',
              'Pelt from the paws up, thinning to bare skin in a soft uneven line. Stroked with the lie it is warm; against it, a prickle up the whole leg.'
            ] },
          { key: 'tail', name: 'Tail', weight: 8, range: { least: 'Slim, to the back of the knee', standard: 'A full brush to the calf', most: 'Thick and heavy, to the ankle' }, endsAs: 'a full brush to the calf',
            stages: [
              'A bruised ache at the base of the spine, and a small hard lump under the skin there.',
              'A finger\'s length of bone and muscle under tight skin. It twitches when startled, and sitting has to allow for it.',
              'A hand\'s length, free of the body, in short fur. It lifts, tucks and twitches with mood before the mood is known. Waistbands have to give way to it.',
              'Longer and thickening, with a full coat. It carries real weight, the hips answer it in walking, and it wags. It has to be kept track of.',
              'A full tail, expressive and readable by anyone who looks. Stroked along the lie it is felt up the whole spine, and the root is the most sensitive place on the back of the body.'
            ] },
          { key: 'ears', name: 'Ears', weight: 6, range: { least: 'Pointed and furred, set a little high', standard: 'Tall wolf ears set high', most: 'Large, tall and heavily furred' }, endsAs: 'tall furred wolf ears set high',
            stages: [
              'The rims thicken and run hot. Hearing sharpens at the high end.',
              'The tops draw to a soft point, with fine fur along the edge.',
              'Longer, and sitting higher on the skull. Small muscles at the base wake, and each ear turns toward sound on its own.',
              'Tall, furred outside and in, moved up from where ears were, which is smooth skin under hair now. They flatten and prick with feeling and cannot be stopped. Anything worn on the ears or over the head is a problem.',
              'Full wolf ears, warm to hold, each turning independently and giving every feeling away. Rubbed at the base, the whole body leans into the hand.'
            ] },
          { key: 'teeth_and_jaw', name: 'Teeth and jaw', weight: 4, range: { least: 'Canines a little long', standard: 'Long canines, shearing back teeth', most: 'Long canines that show with the mouth at rest, a heavy jaw' }, endsAs: 'long canines and shearing back teeth',
            stages: [
              'The canines ache at the root like new teeth coming.',
              'Upper canines longer and sharper; lips and tongue have to learn them.',
              'Lower canines follow. The bite is stronger and the jaw muscle stands at the hinge.',
              'Four long canines that show in a smile and more in a yawn, and back teeth that shear. A careful bite can hold without breaking skin.'
            ] },
          { key: 'nose_and_face', name: 'Nose and face', weight: 5, face: true, range: { least: 'The person\'s own human face; the wolf shows in ears, eyes and teeth only', standard: 'A faint cast: a broad nose with a wolf\'s tip, the jaw slightly forward', most: 'A short blunt muzzle with the wolf\'s nose; human eyes, brow and expression' }, endsAs: 'the person\'s own face with the wolf\'s faint cast',
            stages: [
              'The tip of the nose runs cool and damp.',
              'The skin at the tip darkens and takes a fine pebbled grain. The nostrils flare wider and move when scenting.',
              'The bridge broadens a little, and nose and jaw sit slightly further forward than they did.',
              'The same face, plainly the person\'s own, with something of the wolf in it; canines behind the lips.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 3, endsAs: 'eyes bright in the dark',
            stages: [
              'Night is less dark; shapes hold in an unlit room.',
              'A ring of {eye} at the edge of the iris, spreading inward. The eyes throw light back in the dark.',
              '{eye} eyes in the person\'s own shape, round-pupilled, bright in the dark. Movement at the edge of sight pulls the whole head round, and dusk is the best light there is.'
            ] },
          { key: 'voice', name: 'Voice', weight: 3, endsAs: 'a growl, a bark of a laugh and a howl',
            stages: [
              'A low sound in the chest when annoyed, there before any word.',
              'The growl comes on purpose now, and a whine that does not. The speaking voice has a rougher low edge.',
              'A full growl under the voice, a bark of a laugh, and a howl that must be let out sometimes and carries a long way. A low growl of contentment, close to, is felt as much as heard.'
            ] },
          { key: 'spine_ruff', name: 'Spine ruff', weight: 4, range: { least: 'A narrow line of fur up the spine', standard: 'A hand-wide ruff from tail to nape', most: 'A mane down the back and over the shoulders' }, endsAs: 'a ruff of longer fur from the tail to the nape',
            stages: [
              'A line of gooseflesh down the spine that comes with anger or cold and stays a moment after.',
              'Fine hair along the backbone, starting at the base of the spine.',
              'Longer and coarser, climbing the back. It rises by itself when startled or challenged.',
              'A ruff of longer fur along the spine, standing at a threat and lying flat under a calming hand. Stroked downward, it settles the whole body.'
            ] },
          { key: 'smell', name: 'Smell', weight: 5, endsAs: 'the world read by scent first',
            stages: [
              'Smells arrive from further off and in parts, each ingredient separate.',
              'People have smells, each their own, and rooms keep them. Who is near, and who was, can be known without looking.',
              'Mood has a smell: fear sour, anger hot, wanting warm and sweet.',
              'Scent comes first and sight second. A trail hangs in the air for hours; a person can be followed, known blind, and missed by the smell they leave behind. Scenting someone close is a greeting, and information.'
            ] },
          { key: 'appetite', name: 'Appetite', weight: 3, endsAs: 'meat, eaten heavily and seldom',
            stages: [
              'Hungrier, and for meat; greens are a chore.',
              'Rare is right, then rarer; fat and marrow are the best part. Meals are bolted.',
              'Eats heavily and seldom, can go a day without and then eat for two, and guards food by instinct before manners catch up. Some human foods smell wrong and are left.'
            ] },
          { key: 'heat_and_strength', name: 'Heat and strength', weight: 4, endsAs: 'a body that runs hot, tireless and strong',
            stages: [
              'Runs warm; always one layer too many.',
              'Effort costs less, and the body is restless without a run.',
              'Stronger than the frame shows, and hot to the touch. Force has to be judged again.',
              'Tireless at a lope for miles, strong enough to carry a grown person at a run, a furnace under the pelt. Others are drawn to the warmth.'
            ] },
          { key: 'movement', name: 'Movement', weight: 4, endsAs: 'the lope, the stillness and the shake',
            stages: [
              'A whole-body shake when wet, done before thought.',
              'Sits curled or sprawled, turns once before lying down, stretches low and long on waking.',
              'Walks with a loose forward lean, head turning to track. Goes still all at once when something moves. The stance can read as looming.',
              'The lope, the sudden stillness, the turn of the head; crouching is as easy as sitting; play is a bow and a shove. Always upright.'
            ] },
          { key: 'pack', name: 'Pack', weight: 6, endsAs: 'belonging to its people body-first',
            stages: [
              'Being alone is louder than it was. Sleep comes easier with someone breathing nearby.',
              'Sits closer and touches in passing.',
              'Keeps count of its own: who is here, who is late, who is upset. Bristles at a stranger\'s tone toward them.',
              'Rank is felt: who to defer to, who defers. A challenge is a held stare; making up is physical. Sleeps in a heap by choice.',
              'Loyal past sense, wretched when shut out, at peace in a pile of its own people. Leaving one of them behind is not possible.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'a body that smells of wolf, and of mood',
            stages: [
              'Sweat is warmer and muskier, and washing covers it only briefly.',
              'A settled smell of its own, warm fur and outdoors. Keen noses read wolf in it.',
              'Unmistakably wolf to anyone with a nose, and carrying news: mood, health, who has been close. Things and people handled smell of it after, and marking what is its own comes naturally.'
            ] },
          { key: 'moon', name: 'Moon', weight: 3, endsAs: 'the full moon as the month\'s high point',
            stages: [
              'Sleep is lighter as the moon fills.',
              'For the nights around the full: wakeful, restless, strong, quick to anger and quick to laugh.',
              'No sleep at the full moon: the body hums, the senses are at their widest, and the legs are restless until dawn. The shape stays as it is.'
            ] },
          { key: 'further_pairs', name: 'Further pairs', weight: 5, sex: 'women', range: { least: 'One more pair', standard: 'Two more pairs', most: 'Three more pairs' }, endsAs: 'two more pairs of small nipples down the belly below the breasts',
            stages: [
              'Tender points on the ribs under each breast, like pressed bruises.',
              'Each is a small flat disc of darker skin. A second pair of tender points sits lower, toward the navel.',
              'The upper pair have risen into small true nipples; the lower pair are discs. All tighten together in the cold.',
              'Breasts as before, and beneath them further pairs of small nipples in two lines down the belly (two more pairs on most), each as sensitive as the first.'
            ] },
          { key: 'mantle', name: 'Mantle', weight: 5, sex: 'men', needs: [{ track: 'spine_ruff', stage: 2 }], range: { least: 'A thick neck and fur at the nape', standard: 'A mantle across the shoulders and a chest line', most: 'A heavy mantle over shoulders and chest' }, endsAs: 'a thick neck, a mantle of fur across the shoulders and a line from chest to navel',
            stages: [
              'The neck thickens.',
              'Fur in the coat\'s colour at the nape and across the tops of the shoulders.',
              'A mantle over the shoulders and upper back, joining the spine ruff; a line starting at the breastbone.',
              'A heavy neck, a mantle of longer fur across the shoulders that rises with the ruff, and a line of fur from chest to navel meeting the pelt.'
            ] },
          { key: 'season', name: 'Season', weight: 5, sex: 'women', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'a season about twice a year, lasting a week or so',
            stages: [
              'A few days, months apart, of running too warm, short-tempered and easily moved, with no cause found.',
              'It has a shape now: warmth low in the belly, skin hot and quick to answer touch, broken sleep, a stronger scent.',
              'A full season: days of running hot and restless, the skin answering every touch, sleep broken, temper on a hair. Wolves nearby know by scent.',
              'It comes about twice a year for a week and is planned around. At its height the body runs hot and sleep stays broken; then it passes and leaves a clear head and a sharp appetite.'
            ] },
          { key: 'answering', name: 'Answering', weight: 5, sex: 'men', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'a body that answers a woman\'s season by scent',
            stages: [
              'Some days one person smells sharper and warmer than anyone else in the room.',
              'Knows a season by scent before a word is said; runs warm and restless near it.',
              'The temper runs short and the skin runs hot. Sleep and appetite both go while it lasts.',
              'Reads it across a room by scent, and the body answers with heat and restlessness. It passes when the season does.'
            ] }
        ],
        cow: [
          { key: 'hands', name: 'Hands', weight: 7, range: { least: 'Two fingers and a thumb, each ending in a small thin hoof', standard: 'Two hooved fingers and a hooved thumb', most: 'Two heavy fingers and a thumb, all hooved to the first joint; still hands that grip and hold' }, endsAs: 'two hooved fingers and a hooved thumb',
            stages: [
              'Nails thicker, harder and broader, curving round the fingertips.',
              'The fingers move in pairs, first with second and third with fourth, and resist being spread. The skin between each pair tightens.',
              'Each pair has joined to the last knuckle into one thick finger with two tips. The thumb is heavier. Grip is strong and clumsy.',
              'The paired tips close into one and the nail wraps each end in a small hard cap, the start of a hoof. Fine work has to be relearned.',
              'Two thick fingers and a thumb, each ending in a small smooth hoof. Strong and sure, and still hands that hold and write. The skin behind each hoof is soft and very sensitive.'
            ] },
          { key: 'forearm_coat', name: 'Forearm coat', weight: 4, range: { least: 'Hands to mid-forearm', standard: 'To the elbows', most: 'To the shoulders' }, endsAs: 'Short coat from the hands to the elbows',
            stages: [
              'A prickle across the backs of the wrists and hands, then new hairs pushing through there, denser and coarser, in the coat\'s colour.',
              'A soft undercoat spreading up from the wrist, short and close, the skin beneath it hot and itching as it comes in.',
              'Guard hairs pushing through the undercoat, lying toward the hand, reaching most of the way to where the coat will end. Stroked against the lie it prickles and stands.',
              'A full short coat from the backs of the hands up the arm, ending in a soft uneven line; palm and inner wrist stay bare. Touch through it is felt well past the place touched: with the lie it runs warm up the arm, against it a sharp prickle. Sleeves drag over it.'
            ] },
          { key: 'leg_and_hip_coat', name: 'Leg and hip coat', weight: 8, range: { least: 'Hooves to mid-thigh', standard: 'Hooves to hips, fading out at the navel', most: 'Hooves to hips, and over belly, ribs and back, short and fine on the chest; all but the face' }, endsAs: 'Short coat from hooves to hips, fading out at the navel',
            stages: [
              'An itch down the shins, then the leg hair coming in denser and rougher from the ankle up, in the coat\'s colour.',
              'Undercoat on the lower leg, short and close, the skin beneath it hot; an itch as it comes in that scratching only stirs.',
              'Full coat to the knee, lying downward and shedding water; undercoat climbing the thigh with a crawling prickle. Cloth drags against the lie.',
              'Coat over thighs and hips, thicker on the outer thigh, short and fine on the inner. Touch through it arrives slower and warmer, and spreads.',
              'Coat from the hooves up, thinning to bare skin in a soft uneven line. Stroked with the lie it is warm; against it, a prickle up the whole leg.'
            ] },
          { key: 'toes_and_hooves', name: 'Toes and hooves', weight: 5, endsAs: 'two toes in a split hoof with dewclaws behind',
            stages: [
              'Toenails thicker, harder and broader, curving down over the toe ends. Socks and shoes begin to disagree with them.',
              'The middle toes press together into two groups and stop moving separately. The big toe and the little toe shorten.',
              'Each group has joined into one thick toe, the nails spreading over them as two hard shells with a cleft between. The shortened toes have ridden up behind the ankle as small dewclaws. Shoes fit badly at the front.',
              'A cloven hoof: two toes cased in hard horn, a soft bulb behind them, tender to the floor, and two dewclaws above. Nothing with a closed toe fits; the hooves sound on hard floors.'
            ] },
          { key: 'feet_and_stance', name: 'Feet and stance', weight: 9, needs: [{ track: 'toes_and_hooves', stage: 2 }], range: { least: 'Heel low on a broad hoof', standard: 'Heel raised, weight on the hooves', most: 'A full hock: long foot, heel high' }, endsAs: 'standing on the hooves, the heel raised',
            stages: [
              'The arches ache, then tighten; weight moves forward onto the toes.',
              'The heel lifts and resists coming down. The calves shorten and harden.',
              'The bones of the mid-foot lengthen and draw together. The foot is markedly longer and the heel rides off the floor, so the leg seems to have a second knee bending backward (it is the ankle).',
              'Weight is carried on the toe tips alone. Balance is narrow; gait, stairs and standing still all have to be relearned, and the hips and back shift to help.',
              'Standing on two hooves per foot, the heel raised, the long foot coated down to the horn. Sure on rough ground, loud on hard floors, slow to turn.'
            ] },
          { key: 'tail', name: 'Tail', weight: 6, range: { least: 'To mid-thigh, a small tuft', standard: 'To the knee, tufted', most: 'To the ankle, a heavy tuft' }, endsAs: 'a slim tail to the knee, tufted',
            stages: [
              'A bruised ache at the base of the spine, and a small hard lump under the skin there.',
              'A hand\'s length of thin, flexible tail in short coat. It flicks by itself, and sitting and waistbands have to allow for it.',
              'Longer, thin as a rope, with a tuft of long hair starting at the tip. It swishes with annoyance and lifts with pleasure before either is known.',
              'A slim tail ending in a full tuft. It swishes, flicks and curls with mood, and the root is sensitive to touch.'
            ] },
          { key: 'ears', name: 'Ears', weight: 5, range: { least: 'Small furred ears set a little low', standard: 'Cow ears out to the sides', most: 'Large, wide ears' }, endsAs: 'furred cow ears out to the sides',
            stages: [
              'The ears run warm and feel heavy. Low sounds carry further.',
              'They lengthen sideways and round out, with soft fur on the backs.',
              'Wide and furred, set out to the sides of the head, turning toward sound on their own. Anything worn on the ears is a problem.',
              'Soft cow ears that swivel, droop when tired and flick when bothered. Stroked, they bring a deep, heavy calm.'
            ] },
          { key: 'nose_and_face', name: 'Nose and face', weight: 5, face: true, range: { least: 'The person\'s own human face; the cow shows in ears and eyes only', standard: 'A faint cast: a broad soft nose, the jaw slightly forward', most: 'A short broad muzzle with a cow\'s nose; human eyes, brow and expression' }, endsAs: 'the person\'s own face with a faint bovine cast',
            stages: [
              'The nose runs cool and damp.',
              'The nose broadens and softens at the tip, the skin there smooth and darker; the nostrils widen.',
              'Nose and jaw sit slightly further forward than they did; the lips are fuller.',
              'The same face, plainly the person\'s own, with something of the cow in it, and a mild steady look.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 3, endsAs: 'large, dark-lashed, wide-seeing eyes',
            stages: [
              'The lashes grow long and thick.',
              'The eyes are larger and turning {eye}. The edges of sight reach further round.',
              'Large {eye} eyes under heavy lashes, seeing nearly all the way round and less sharply up close. Sudden movement at the edge of sight startles.'
            ] },
          { key: 'spine_strip', name: 'Spine strip', weight: 3, endsAs: 'a strip of coat from the tail to the nape',
            stages: [
              'Fine hair along the backbone, starting at the base of the spine.',
              'A narrow strip of short coat climbing the back.',
              'A strip of coat along the spine in the coat\'s colours. A hand run along it is felt down the whole back.'
            ] },
          { key: 'senses', name: 'Senses', weight: 3, endsAs: 'weather, water and grass read by nose, and low sound felt',
            stages: [
              'Grass, hay and water can be smelled from far off.',
              'Rain is smelled before it comes. Low sound is felt in the chest.',
              'Weather, water, grass and the mood of a crowd are read by nose, and low sound is felt as much as heard. Sharp sudden noise is hard to bear.'
            ] },
          { key: 'appetite_and_cud', name: 'Appetite and cud', weight: 5, endsAs: 'greens and grain, eaten slowly and chewed twice',
            stages: [
              'Hungry for greens, grain and anything made with milk; meat loses its appeal.',
              'Eats slowly and for a long time. Milk, cream and cocoa are a craving.',
              'Meat is unwanted. The jaw works sideways when idle, and food comes back to be chewed again.',
              'Grazes through the day on greens and grain and chews cud in the quiet after, which is deeply calming. Drinks a great deal.'
            ] },
          { key: 'weight_and_strength', name: 'Weight and strength', weight: 5, endsAs: 'a heavy, warm body, slow to start and hard to stop',
            stages: [
              'Heavier without looking it; steadier on the feet.',
              'The back, hips and thighs thicken with muscle. Runs warm.',
              'Strong in the push and the carry, slow off the mark. Force has to be judged again.',
              'Heavy, warm and solid: slow to start, hard to stop, tireless under a load. Others lean into the warmth.'
            ] },
          { key: 'herd', name: 'Herd', weight: 7, endsAs: 'placid, close and at ease in company',
            stages: [
              'Calmer than before; small things stop mattering.',
              'Company is a comfort for its own sake. Stands and sits close.',
              'Slow to anger and slow to hurry. Goes where the group goes without minding.',
              'Unsettled alone and soothed by touch: leaning, grooming, a hand on the back. Pushed too far it does not flare; it sets and will not be moved.',
              'Placid, patient and close: at ease in a group, restless outside one, gentle until truly crossed and then immovable. Sleeps best touching someone.'
            ] },
          { key: 'voice', name: 'Voice', weight: 2, endsAs: 'a soft low voice that carries a long way',
            stages: [
              'A low hum in the chest when content.',
              'The voice deepens and softens. A long low note comes when calling or upset.',
              'A soft low voice, a hum of contentment that is felt through a shared seat, and a low that carries a long way.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'warm hide, hay and milk',
            stages: [
              'Sweat is milder and sweeter.',
              'A settled smell of warm hide and hay.',
              'Warm hide, hay and a sweetness of milk. It calms the people near it.'
            ] },
          { key: 'teats_and_udder', name: 'Teats and udder', weight: 12, sex: 'women', needs: [{ track: 'chest', stage: 3 }], range: { least: 'Nipples a little long; a small udder close to the belly', standard: 'Long thick nipples like teats; a small rounded four-teated udder', most: 'Full teats; a fuller udder that shows under clothes' }, endsAs: 'breasts with long thick nipples like teats and a small four-teated udder low on the belly',
            stages: [
              'The nipples are tender and stay raised; the breasts feel fuller and show faint veins.',
              'The nipples lengthen and thicken toward the shape of teats. A soft warm swelling starts below the navel.',
              'The swelling is a small firm mound with four tender points on it. The teats on the breasts show through cloth.',
              'The mound has rounded into a small udder, bare-skinned within the coat, its four points grown into short teats. It is warm, heavy for its size and very sensitive, and clothing has to make room.',
              'Breasts faintly veined with long thick nipples like teats, and below them a small rounded udder with four teats, low on the belly. Both are as sensitive as anything on the body.'
            ] },
          { key: 'milk', name: 'Milk', weight: 8, sex: 'women', needs: [{ track: 'teats_and_udder', stage: 4 }], endsAs: 'being in milk',
            stages: [
              'A fullness and tightness in the udder late in the day, and a lesser one in the breasts.',
              'The fullness becomes pressure, then an ache that eases with warmth and a hand.',
              'The first milk: drops, let down by warmth, touch, arousal or strong feeling. Relief follows, and a heavy calm.',
              'The udder fills through the day and wants emptying morning and evening; the breasts give a little. Left too long it means soreness, weight and a short temper.',
              'In milk, steadily, and arousal lets it down as surely as warmth or a hand. Milking is routine and brings a deep ease; whether it is private or shared is for the one in milk to decide.'
            ] },
          { key: 'horns_and_crest', name: 'Horns and crest', weight: 12, sex: 'men', range: { least: 'Blunt horn stubs', standard: 'Two short thick horns, a heavy neck and a crest', most: 'Longer curving horns and a heavy crest' }, endsAs: 'two short thick horns, a heavy neck and a crest at the nape',
            stages: [
              'Two tender spots above the temples, hard underneath. The neck thickens.',
              'Horn buds break the skin, blunt and warm. Neck and shoulders gain bulk.',
              'The horns are a finger long, curving outward. The spine strip thickens at the nape.',
              'Longer and thick at the base, with real weight; the head is carried lower on a neck heavy with muscle.',
              'Two horns curving out above the ears, a bull\'s neck and shoulders, and the spine strip risen to a crest at the nape. The horns feel touch at the base.'
            ] },
          { key: 'the_bulls_ground', name: 'The bull\'s ground', weight: 8, sex: 'men', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'placid until crossed, then immovable',
            stages: [
              'Less easily moved, in body and in argument.',
              'Steps between its own people and a threat without thinking. Dislikes being crowded by other men.',
              'Squares up when challenged: head lowered, weight forward, breath loud. Calms quickly once the other gives way.',
              'Patient and gentle until crossed, then immovable. Protective of those close by, and gentlest with those in milk.'
            ] }
        ],
        fox: [
          { key: 'tail', name: 'Tail', weight: 8, range: { least: 'One slim tail', standard: 'One thick pale-tipped tail, a second with age', most: 'Two or three full tails' }, endsAs: 'one thick pale-tipped tail',
            stages: [
              'A bruised ache at the base of the spine, and a small hard lump under the skin there.',
              'A finger\'s length of bone and muscle under tight skin. It twitches when startled, and sitting has to allow for it.',
              'A hand\'s length in soft fur, already fuller than its bones. It curls and flicks with mood before the mood is known.',
              'Long and thickening fast, with a dense coat that doubles its width. It balances every quick turn and has to be kept track of.',
              'A thick brush with a pale tip, as wide as a thigh and nearly weightless. It wraps the body in sleep and gives every feeling away, and the root is very sensitive.'
            ] },
          { key: 'second_tail', name: 'Second tail', weight: 5, needs: [{ track: 'tail', stage: 'finished' }], extentWith: 'tail', range: { least: 'None', standard: 'A second with age', most: 'Two or three full tails' }, endsAs: 'a second full tail',
            stages: [
              'A second ache beside the root of the first, and a second lump.',
              'A second tail, shorter and slimmer, moving in step with the first unless attention is paid.',
              'Two full tails that move together or apart at will. Among kitsune it marks age and craft, and is noticed. More may follow in time.'
            ] },
          { key: 'ears', name: 'Ears', weight: 7, range: { least: 'Pointed and furred, a little high', standard: 'Large triangular ears set high', most: 'Very large, heavily tufted' }, endsAs: 'large triangular ears set high',
            stages: [
              'The rims thin and run hot. Small high sounds sharpen.',
              'The tops draw to points and the ears widen at the base, with fine fur along the edge.',
              'Large and triangular, sitting higher on the skull, dark-backed, turning toward sound on their own.',
              'Large fox ears set high, each swivelling independently and catching the smallest sound. They flatten and prick with feeling, and stroked at the base they bring a shiver.'
            ] },
          { key: 'teeth', name: 'Teeth', weight: 3, endsAs: 'small sharp teeth and fine canines',
            stages: [
              'The canines ache at the root.',
              'Canines longer and needle-fine; the smaller teeth sharpen.',
              'Small sharp teeth and fine canines that show in a grin. The bite is quick and exact more than strong.'
            ] },
          { key: 'nose_and_face', name: 'Nose and face', weight: 5, face: true, range: { least: 'The person\'s own human face; the fox shows in ears and eyes', standard: 'A faint cast: a narrow nose, a pointed chin', most: 'A short fine muzzle with a fox\'s nose; human eyes, brow and expression' }, endsAs: 'the person\'s own face with a faint vulpine cast',
            stages: [
              'The tip of the nose runs cool and damp.',
              'The tip darkens and narrows; the nostrils move when scenting.',
              'The nose is finer and the chin more pointed, both a little further forward. The cheekbones stand higher.',
              'The same face, plainly the person\'s own, with something of the fox in it, and a sly cast to the eyes.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 3, endsAs: 'slit-pupilled eyes, bright at dusk',
            stages: [
              'Dusk is brighter than it was.',
              'The iris turns {eye} from the edge inward, and the pupils narrow toward slits in bright light.',
              '{eye} eyes with slit pupils, wide and dark at night. Small movement in grass or shadow catches them at once.'
            ] },
          { key: 'hearing_and_nose', name: 'Hearing and nose', weight: 5, endsAs: 'pinpoint hearing and a good nose',
            stages: [
              'Small sounds carry: a page turned, a step through a wall.',
              'A sound can be placed exactly with the eyes shut. Smells sharpen and separate.',
              'Hears a mouse under a floor and knows where to the inch; reads people and rooms by scent, though less deeply than a wolf.'
            ] },
          { key: 'appetite', name: 'Appetite', weight: 3, endsAs: 'light, frequent and cached',
            stages: [
              'Hungry often and for little: eggs, fruit, small meats.',
              'Eats lightly and often, and sets food aside for later without deciding to.',
              'A light, quick eater who caches food and small prizes in hidden places and forgets half of them.'
            ] },
          { key: 'lightness', name: 'Lightness', weight: 5, endsAs: 'quick, silent, and given to the high pounce',
            stages: [
              'Lighter on the feet; a step makes less noise.',
              'Quick turns come easily and jumps go further than they should.',
              'The body crouches and springs by reflex at small moving things. Balance is close to perfect.',
              'Light, quick and silent: the high pounce, the narrow ledge, the sudden change of direction. Most awake at dusk and dawn.'
            ] },
          { key: 'guile', name: 'Guile', weight: 8, endsAs: 'clever, playful and at home in misdirection',
            stages: [
              'Notices what people want and what they are hiding.',
              'A taste for teasing, misdirection and the small harmless lie; a straight answer takes effort.',
              'Sleight comes easily: a voice thrown, a face held, a thing palmed. Play has an edge.',
              'Clever, playful and hard to pin down, with a trickster\'s pleasure in a well-made deception and a strict private sense of fairness about it. Misdirection is second nature.'
            ] },
          { key: 'voice', name: 'Voice', weight: 3, endsAs: 'the yip, the chatter and the scream',
            stages: [
              'A yip of surprise or delight that escapes.',
              'A chatter when excited and a whine when thwarted; the laugh sharpens.',
              'A quick, light voice with a fox\'s sounds under it: the yip, the chatter, and at need a scream that carries across the Isle at night.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'fox musk with a sweetness',
            stages: [
              'Sweat is sharper and a little sweet.',
              'A settled musk with something floral in it.',
              'Fox musk, strong for its size, with a sweetness like violets. Keen noses know it at once.'
            ] },
          { key: 'further_pairs', name: 'Further pairs', weight: 5, sex: 'women', range: { least: 'One more pair', standard: 'Two more pairs', most: 'Three more pairs' }, endsAs: 'two more pairs of small nipples down the belly below the breasts',
            stages: [
              'Tender points on the ribs under each breast, like pressed bruises.',
              'Each is a small flat disc of darker skin. A second pair of tender points sits lower, toward the navel.',
              'The upper pair have risen into small true nipples; the lower pair are discs. All tighten together in the cold.',
              'Breasts as before, and beneath them further pairs of small nipples in two lines down the belly (two more pairs on most), each as sensitive as the first.'
            ] },
          { key: 'bib', name: 'Bib', weight: 5, sex: 'men', range: { least: 'Pale down at the throat', standard: 'A bib from throat to chest', most: 'A full pale ruff over throat and chest' }, endsAs: 'a pale bib from the throat down the chest',
            stages: [
              'The throat and upper chest grow fine pale down.',
              'A pale patch of short coat at the throat.',
              'It spreads down the breastbone and thickens at the neck.',
              'A pale bib from the throat down the chest, on a slight, fine-boned frame.'
            ] },
          { key: 'season', name: 'Season', weight: 5, sex: 'women', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'one season a year, at midwinter',
            stages: [
              'A few restless nights in the dead of winter, with no cause to point to.',
              'It has a shape: wakeful after dark, warm, quick-tempered, the musk stronger.',
              'A full season: nights of heat, calling and pacing, and days short on sleep and patience. Company quiets it and solitude sharpens it.',
              'It comes once a year at midwinter for a few weeks and is planned around. At its height the body runs hot and sleep comes hard; then it lifts with the lengthening days.'
            ] },
          { key: 'winter_roaming', name: 'Winter roaming', weight: 5, sex: 'men', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'a loud, restless midwinter',
            stages: [
              'Restless on winter nights; walks further than intended.',
              'The musk strengthens with the cold, and a bark comes at night without quite being chosen.',
              'Restless enough to walk half the night; the temper runs short. Appetite drops.',
              'Every midwinter: loud and restless, the musk strong, and any woman of the kind in season known by scent. It passes with the season.'
            ] },
          { key: 'hands', name: 'Hands', weight: 5, range: { least: 'Human-shaped hands with small claws', standard: 'Slim fingers, pads and small dark claws', most: 'Short quick fingers with full pads and furred backs; still hands' }, endsAs: 'Slim fingers, pads and small dark claws',
            stages: [
              'Nails thicker and harder from the root, growing to a blunt point however short they are cut.',
              'Fingertip skin thickens into the first of the pads. Touch through them is duller for texture and sharper for pressure and warmth.',
              'The nails are claws: curved, rooted deeper, the quick grown down into them. A pad on every fingertip and one forming across the palm; knuckles heavier. Fine grip has to be relearned.',
              'Five fingers, a pad on each tip and one across the palm, the nails grown to claws that do not sheathe. Still a hand that writes and holds. On bare skin the claws are felt.'
            ] },
          { key: 'forearm_coat', name: 'Forearm coat', weight: 4, range: { least: 'Dark gloves to mid-forearm', standard: 'To the elbows', most: 'To the shoulders' }, endsAs: 'Dark gloves from the hands to the elbows',
            stages: [
              'A prickle across the backs of the wrists and hands, then new hairs pushing through there, denser and coarser, in the coat\'s colour.',
              'A soft undercoat spreading up from the wrist, short and close, the skin beneath it hot and itching as it comes in.',
              'Guard hairs pushing through the undercoat, lying toward the hand, reaching most of the way to where the coat will end. Stroked against the lie it prickles and stands.',
              'A full short coat from the backs of the hands up the arm, ending in a soft uneven line; palm and inner wrist stay bare. Touch through it is felt well past the place touched: with the lie it runs warm up the arm, against it a sharp prickle. Sleeves drag over it.'
            ] },
          { key: 'toes_and_claws', name: 'Toes and claws', weight: 4, endsAs: 'Four clawed toes and a dewclaw',
            stages: [
              'Toenails thicker and harder, growing forward to points. Socks and shoes begin to disagree with them.',
              'The big toe shorter and set higher on the inside of the foot, no longer taking weight. Push-off and balance are slightly off.',
              'Four toes thicker and closer together, each nail a claw that reaches the floor. The first toe has ridden up the inside of the foot as a dewclaw. Shoes fit badly at the front.',
              'Four toes, blunt claws that do not sheathe and a pad under each that feels every texture; the dewclaw high on the inside. Nothing with a closed toe fits.'
            ] },
          { key: 'feet_and_stance', name: 'Feet and stance', weight: 8, needs: [{ track: 'toes_and_claws', stage: 2 }], range: { least: 'Heel low on a narrow paw', standard: 'Heel raised, weight on the toes', most: 'A full hock on a long narrow foot' }, endsAs: 'Narrow paws, heel raised',
            stages: [
              'The arches ache, then tighten; the ball of the foot takes more of the weight.',
              'Skin under the ball of the foot thickens into one broad pad. The sole behind it turns soft and tender from disuse.',
              'The bones of the mid-foot lengthen. The heel resists coming down, and standing still means standing on the toes. Calves and shoes both complain.',
              'The foot is markedly longer and the heel rides off the floor, so the leg seems to have a second knee bending backward (it is the ankle). Fur over the top of the foot. Gait, stairs and balance all have to be relearned.',
              'A paw: the long foot furred to the claws, weight on the toes and the broad pad, the heel raised. Quiet on hard floors, and balance is better than it ever was.'
            ] },
          { key: 'leg_and_hip_coat', name: 'Leg and hip coat', weight: 8, range: { least: 'Stockings to mid-thigh', standard: 'Paws to hips, fading out at the navel', most: 'Paws to hips, and over belly, ribs and back; all but the face' }, endsAs: 'Coat from paws to hips, dark stockings below the knee',
            stages: [
              'Leg hair denser, in the coat\'s colour, from the ankle up.',
              'Undercoat on the lower leg, the skin beneath warmer; an itch as it comes in.',
              'Full coat to the knee, lying downward and shedding water; undercoat climbing the thigh. Cloth drags against the lie.',
              'Coat over thighs and hips, thicker on the outer thigh, short and fine on the inner. Touch through fur arrives slower and warmer, and spreads.',
              'Pelt from the paws up, thinning to bare skin in a soft uneven line. Stroked with the lie it is warm; against it, a prickle up the whole leg.'
            ] },
          { key: 'spine_strip', name: 'Spine strip', weight: 3, endsAs: 'A strip of coat from tail to nape',
            stages: [
              'Fine hair along the backbone, starting at the base of the spine.',
              'A narrow strip of short coat climbing the back.',
              'A strip of coat along the spine in the coat\'s colours. A hand run along it is felt down the whole back.'
            ] }
        ],
        cat: [
          { key: 'hands', name: 'Hands', weight: 6, range: { least: 'Human hands with sheathing claws', standard: 'Padded fingers with claws that sheathe', most: 'Short soft-padded fingers with furred backs; still hands' }, endsAs: 'five padded fingers with claws that sheathe',
            stages: [
              'Nails thicker and narrower, curving to points.',
              'The fingertips soften into small pads. The last joint of each finger loosens and bends back further than before.',
              'The nails are curved claws that draw back into the fingertip and slide out when the fingers flex. They come out with temper or pleasure before the mind decides.',
              'Five supple fingers with soft pads and sharp claws that sheathe completely. A hand that can be velvet or hooks; kneading something soft is a deep comfort.'
            ] },
          { key: 'toes_and_claws', name: 'Toes and claws', weight: 4, needs: [{ track: 'hands', stage: 3 }], endsAs: 'Four toes, the claws sheathed, and a dewclaw',
            stages: [
              'Toenails thicker and harder, growing forward to points. Socks and shoes begin to disagree with them.',
              'The big toe shorter and set higher on the inside of the foot, no longer taking weight. Push-off and balance are slightly off.',
              'Four toes thicker and closer together, each nail a claw that reaches the floor. The first toe has ridden up the inside of the foot as a dewclaw. Shoes fit badly at the front.',
              'Four toes, sharp claws that sheathe and slide out and a pad under each that feels every texture; the dewclaw high on the inside. Nothing with a closed toe fits.'
            ] },
          { key: 'feet_and_stance', name: 'Feet and stance', weight: 8, needs: [{ track: 'toes_and_claws', stage: 2 }], range: { least: 'Heel low on a soft paw', standard: 'Heel raised, weight on the toes', most: 'A full hock' }, endsAs: 'Soft silent paws, heel raised',
            stages: [
              'The arches ache, then tighten; the ball of the foot takes more of the weight.',
              'Skin under the ball of the foot thickens into one broad pad. The sole behind it turns soft and tender from disuse.',
              'The bones of the mid-foot lengthen. The heel resists coming down, and standing still means standing on the toes. Calves and shoes both complain.',
              'The foot is markedly longer and the heel rides off the floor, so the leg seems to have a second knee bending backward (it is the ankle). Fur over the top of the foot. Gait, stairs and balance all have to be relearned.',
              'A paw: the long foot narrow and soft-padded, furred to the claws, weight on the toes and the broad pad, the heel raised. It makes no sound on any floor, and balance is better than it ever was.'
            ] },
          { key: 'tail', name: 'Tail', weight: 7, range: { least: 'Slim, to the knee', standard: 'Long, to the ankle', most: 'Longer than the leg and thick-furred' }, endsAs: 'a long expressive tail',
            stages: [
              'A bruised ache at the base of the spine, and a small hard lump under the skin there.',
              'A hand\'s length of slim tail in short fur. It twitches at the tip with attention, and sitting has to allow for it.',
              'Long and supple, moving all the time: a slow wave for thought, a lash for temper, upright for welcome.',
              'A long tail that balances every leap and speaks every mood. It curls round what its owner likes, and stroked at the base it arches the whole back.'
            ] },
          { key: 'ears', name: 'Ears', weight: 6, range: { least: 'Small points', standard: 'Pointed cat ears set high', most: 'Large, tufted at the tips' }, endsAs: 'pointed cat ears set high',
            stages: [
              'The rims thin and run warm. High sounds sharpen.',
              'The tops draw to points, with fine fur along the edges.',
              'Pointed and furred, sitting higher on the skull, each turning toward sound on its own.',
              'Pointed cat ears set high, swivelling apart to follow two sounds at once and flattening with temper. Rubbed behind, they bring a purr.'
            ] },
          { key: 'whiskers_and_face', name: 'Whiskers and face', weight: 6, face: true, range: { least: 'The person\'s own human face; the cat shows in ears, eyes and whiskers', standard: 'A faint cast: a short broad nose, a small chin', most: 'A short blunt muzzle with a cat\'s nose; human eyes, brow and expression' }, endsAs: 'the person\'s own face with a faint feline cast, whiskered',
            stages: [
              'Fine dots appear on the upper lip, tender to the touch.',
              'Stiff pale hairs grow from the dots and above the brows. They feel the air move.',
              'The nose shortens and broadens a little, the tip darkening; the chin is smaller and the cheeks fuller at the whisker pads.',
              'The same face, plainly the person\'s own, with something of the cat in it, and whiskers that read a gap\'s width and a draught\'s direction.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 4, endsAs: 'slit-pupilled eyes that shine in the dark',
            stages: [
              'Night is less dark, and movement shows before shape.',
              'The iris turns {eye} and the pupils narrow to slits in bright light. The eyes shine in the dark.',
              '{eye} eyes with slit pupils that open wide and black in dim light or at play. A slow blink is affection.'
            ] },
          { key: 'teeth_and_tongue', name: 'Teeth and tongue', weight: 4, endsAs: 'needle fangs and a rough tongue',
            stages: [
              'The canines ache at the root, and the tongue feels rough against the teeth.',
              'Fine sharp fangs. The tongue\'s surface has grown small backward hooks.',
              'Needle fangs that show in a yawn, and a rough tongue that rasps on skin and grooms fur clean.'
            ] },
          { key: 'balance_and_grace', name: 'Balance and grace', weight: 8, endsAs: 'silent, supple, and landing on its feet',
            stages: [
              'Surer on the feet; a stumble corrects itself.',
              'Jumps land softly and exactly. Heights lose their fear.',
              'The spine is loose and long; the body turns in the air and passes through any gap the head fits.',
              'Silent, supple and exact: lands on its feet, walks a rail without thought, climbs for the pleasure of the high place. Stretching is a full-body luxury.'
            ] },
          { key: 'sleep_and_the_hunt', name: 'Sleep and the hunt', weight: 4, endsAs: 'sleeping by day and coming alive at dusk',
            stages: [
              'Drowsy by day, wide awake at dusk.',
              'Naps come anywhere warm. Small moving things hold the eye, and the body crouches.',
              'Sleeps much of the day in sun or warmth and comes alive at dusk and dawn. The stalk and the pounce are play, and hard to resist.'
            ] },
          { key: 'purr_and_voice', name: 'Purr and voice', weight: 4, endsAs: 'a purr felt through the chest',
            stages: [
              'A hum in the throat when content.',
              'A true purr, felt through the chest, starting without leave. A hiss when startled.',
              'A purr that fills the chest and passes into anyone held close, a chirp of greeting, a hiss, and a yowl kept for real need.'
            ] },
          { key: 'self_and_affection', name: 'Self and affection', weight: 8, endsAs: 'proud, curious, and warm on its own terms',
            stages: [
              'Less eager to please; a no comes easier.',
              'Closeness comes on its own terms: near, then not.',
              'Affection is physical and sudden: a cheek rubbed along a jaw, a body pressed close, then distance. Dislikes being held when it was not the one to choose.',
              'Self-possessed, curious and proud, giving warmth freely to the few it chooses and marking them with its cheek. Its trust is slow and, once given, plain.'
            ] },
          { key: 'grooming', name: 'Grooming', weight: 3, endsAs: 'grooming itself and those it loves',
            stages: [
              'Feels unclean sooner; washes more.',
              'Licks the back of a hand and smooths the coat with it without thinking. Dislikes being soaked.',
              'Grooms its coat by tongue and hand daily, grooms those it loves, and treats a wetting as an insult.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'warm clean fur',
            stages: [
              'Sweat is fainter.',
              'Clean warm fur and little else.',
              'Almost no scent but warm clean fur, with glands at the cheek and wrist that mark what is its own for keen noses.'
            ] },
          { key: 'further_pairs', name: 'Further pairs', weight: 5, sex: 'women', range: { least: 'Two more pairs', standard: 'Three more pairs', most: 'Four more pairs' }, endsAs: 'three more pairs of small nipples in two rows below the breasts',
            stages: [
              'Tender points on the ribs under each breast, like pressed bruises.',
              'Each is a small flat disc of darker skin. A second pair of tender points sits lower, toward the navel.',
              'The upper pair have risen into small true nipples; the lower pair are discs. All tighten together in the cold.',
              'Breasts as before, and beneath them further pairs of small nipples in two lines down the belly (three more pairs on most), each as sensitive as the first.'
            ] },
          { key: 'toms_build', name: 'Tom\'s build', weight: 5, sex: 'men', range: { least: 'A thick neck', standard: 'Broad cheeks, a thick neck, heavy forearms', most: 'Heavy jowls and shoulders' }, endsAs: 'broad cheeks, a thick neck and heavy forearms',
            stages: [
              'The neck thickens.',
              'The cheeks fill out at the jaw.',
              'Broad cheeks and a heavy neck; the forearms thicken.',
              'A broad-cheeked face, a thick neck and heavy forearms, on a body otherwise as supple as any cat\'s.'
            ] },
          { key: 'season', name: 'Season', weight: 5, sex: 'women', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'seasons that return from spring to autumn',
            stages: [
              'A few restless days in spring, warm, the skin alive to touch.',
              'It returns every few weeks through spring and summer: restless, affectionate, rubbing against things and people.',
              'A full season: calling at night, rolling, unable to settle, skin alive to every touch. It lasts days and comes back within weeks.',
              'Seasons come again and again from spring to autumn and are planned around. At the height the body runs hot and will not settle; between, it is entirely its own.'
            ] },
          { key: 'roaming', name: 'Roaming', weight: 5, sex: 'men', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'a spring and summer of roaming',
            stages: [
              'Wakeful on spring nights.',
              'Walks at night, further each time, leaving scent along the way.',
              'Hears a woman\'s calling from far off; bristles at other toms, and the voice yowls without leave.',
              'Through spring and summer: wakeful and restless, the scent strong, and any season nearby known by scent.'
            ] },
          { key: 'forearm_coat', name: 'Forearm coat', weight: 4, range: { least: 'To mid-forearm', standard: 'To the elbows', most: 'To the shoulders' }, endsAs: 'Coat from the hands to the elbows',
            stages: [
              'A prickle across the backs of the wrists and hands, then new hairs pushing through there, denser and coarser, in the coat\'s colour.',
              'A soft undercoat spreading up from the wrist, short and close, the skin beneath it hot and itching as it comes in.',
              'Guard hairs pushing through the undercoat, lying toward the hand, reaching most of the way to where the coat will end. Stroked against the lie it prickles and stands.',
              'A full short coat from the backs of the hands up the arm, ending in a soft uneven line; palm and inner wrist stay bare. Touch through it is felt well past the place touched: with the lie it runs warm up the arm, against it a sharp prickle. Sleeves drag over it.'
            ] },
          { key: 'leg_and_hip_coat', name: 'Leg and hip coat', weight: 8, range: { least: 'Paws to mid-thigh', standard: 'Paws to hips, fading out at the navel', most: 'Paws to hips, and over belly, ribs and back; all but the face' }, endsAs: 'Coat from paws to hips, fading out at the navel',
            stages: [
              'Leg hair denser, in the coat\'s colour, from the ankle up.',
              'Undercoat on the lower leg, the skin beneath warmer; an itch as it comes in.',
              'Full coat to the knee, lying downward and shedding water; undercoat climbing the thigh. Cloth drags against the lie.',
              'Coat over thighs and hips, thicker on the outer thigh, short and fine on the inner. Touch through fur arrives slower and warmer, and spreads.',
              'Pelt from the paws up, thinning to bare skin in a soft uneven line. Stroked with the lie it is warm; against it, a prickle up the whole leg.'
            ] },
          { key: 'spine_line', name: 'Spine line', weight: 3, endsAs: 'A line of coat from tail to nape',
            stages: [
              'Fine hair along the backbone, starting at the base of the spine.',
              'A narrow strip of short coat climbing the back.',
              'A strip of coat along the spine in the coat\'s colours. A hand run along it is felt down the whole back.'
            ] }
        ],
        rabbit: [
          { key: 'hands', name: 'Hands', weight: 4, range: { least: 'Human hands with blunt claws', standard: 'Furred backs, short blunt claws', most: 'Short furred fingers; still hands' }, endsAs: 'furred backs, short blunt claws and soft bare palms',
            stages: [
              'Nails thicker and blunter.',
              'Fine fur on the backs of the hands and fingers.',
              'The nails are short blunt claws, good for digging; the palms stay bare and soft, with no pads.',
              'Five fingers furred on the backs with short blunt claws and soft bare palms. Deft, gentle hands that dig and groom well.'
            ] },
          { key: 'toes', name: 'Toes', weight: 4, endsAs: 'four long furred toes, blunt-clawed',
            stages: [
              'Toenails thicker and blunter. Socks and shoes begin to disagree with them.',
              'The big toe shortens and draws in beside the others.',
              'Four long toes close together with blunt claws; the first toe is gone into the foot. Fur grows between and under them.',
              'Four long toes, furred above and below, with blunt claws for grip and digging. Nothing with a closed toe fits.'
            ] },
          { key: 'hind_feet', name: 'Hind feet', weight: 9, needs: [{ track: 'toes', stage: 2 }], range: { least: 'Longer than a human\'s, heel down', standard: 'Long, furred to the sole', most: 'Very long, up on the toes' }, endsAs: 'long feet furred to the sole',
            stages: [
              'The arches ache, and the feet feel long in their shoes.',
              'The foot lengthens from heel to toe, and fine fur spreads over the top of it.',
              'Half as long again, the sole growing a dense mat of fur in place of bare skin. The heel lifts when moving and comes down at rest.',
              'Long, narrow and powerful, furred on the sole, with a spring in the ankle that wants to be used. Walking is short steps; standing still, the whole long foot lies flat.',
              'Long hind feet, furred to the sole and silent, flat at rest and up on the toes at speed. They thump the ground hard when alarmed, without leave.'
            ] },
          { key: 'belly_fur', name: 'Belly fur', weight: 4, needs: [{ track: 'leg_and_hip_coat', stage: 'finished' }], extentWith: 'leg_and_hip_coat', range: { least: 'None', standard: 'Pale belly fur to just under the breasts', most: 'Pale belly fur to just under the breasts' }, endsAs: 'soft pale fur from the hips to just under the breasts',
            stages: [
              'Fine pale down from the navel upward.',
              'Soft pale fur over the belly, shorter and finer than the coat.',
              'Soft pale belly fur from the hips to just under the breasts, the softest coat on the body and the most sensitive to a hand.'
            ] },
          { key: 'bob_tail', name: 'Bob tail', weight: 4, range: { least: 'A small tuft', standard: 'A round bob', most: 'A full soft scut' }, endsAs: 'a short round tail, pale beneath',
            stages: [
              'A bruised ache at the base of the spine, and a small hard lump there.',
              'A short stub in soft fur that flicks up when startled.',
              'A short round bob tail, pale beneath, that lifts and flashes with alarm or delight. Touch at its base is felt up the spine.'
            ] },
          { key: 'ears', name: 'Ears', weight: 9, range: { least: 'Hand-length', standard: 'Long and upright', most: 'Very long, or lopped and hanging' }, endsAs: 'long upright ears',
            stages: [
              'The ears run warm. Faint sounds sharpen.',
              'They lengthen upward, the tops rounding, with fine fur along the edges.',
              'As long as a hand and still growing, sitting higher on the skull, turning toward sound on their own.',
              'Long and upright, furred outside and thin enough inside to show the light. They rise with interest and lie back with fear. Anything worn on the head is a problem.',
              'Long rabbit ears, each turning independently, warm and velvet to hold. Stroked from base to tip, they loosen the whole body.'
            ] },
          { key: 'nose_and_lip', name: 'Nose and lip', weight: 6, face: true, range: { least: 'The person\'s own human face; the rabbit shows in ears, eyes and whiskers', standard: 'A faint cast: a cleft nose, a faintly split lip', most: 'A short soft muzzle with a rabbit\'s nose and lip; human eyes, brow and expression' }, endsAs: 'the person\'s own face with a cleft nose and a faintly split lip',
            stages: [
              'The nose twitches with every new smell.',
              'A fine line appears down the centre of the upper lip and the nose tip; fine whiskers start at the cheeks.',
              'The nose is cleft and soft, moving all the time; the upper lip has parted slightly along its line.',
              'The same face, plainly the person\'s own, with something of the rabbit in it, the nose never still, and fine whiskers.'
            ] },
          { key: 'front_teeth', name: 'Front teeth', weight: 4, endsAs: 'front teeth a little long, kept down by gnawing',
            stages: [
              'The front teeth ache, and there is an urge to bite on something hard.',
              'The two upper front teeth are a little longer and never stop growing.',
              'Front teeth a little long, kept down by gnawing: wood, roots, a pencil. Without it they ache.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 3, endsAs: 'large eyes that see nearly all round',
            stages: [
              'The edges of sight widen.',
              'The eyes are larger and turning {eye}, set a touch wider.',
              'Large {eye} eyes that see nearly all round and above, and best at dawn and dusk. Movement overhead brings instant stillness.'
            ] },
          { key: 'greens', name: 'Greens', weight: 3, endsAs: 'grazing all day on greens',
            stages: [
              'Hungry for leaves, herbs and raw vegetables.',
              'Eats greens constantly in small amounts; meat is unwanted.',
              'Grazes all day on greens, herbs and hay, with a sweet tooth for fruit and carrots.'
            ] },
          { key: 'spring', name: 'Spring', weight: 6, endsAs: 'explosive legs and the happy leap',
            stages: [
              'The legs feel coiled; stairs go two at a time.',
              'Thighs and calves thicken with fast muscle. A standing jump goes waist high.',
              'Runs in bursts with sudden turns. A hind foot drums when impatient or alarmed.',
              'Explosive legs: a leap higher than head height, a zigzag sprint, and a twisting jump of joy that cannot be held in.'
            ] },
          { key: 'watchfulness', name: 'Watchfulness', weight: 8, endsAs: 'alert, quick to startle and quick to settle',
            stages: [
              'Jumpier, and aware of the exits.',
              'Freezes at a sudden noise, heart racing, before thought returns.',
              'Still, then gone: the body bolts before deciding. Open ground feels exposed, and a wall at the back is a comfort.',
              'Alert, quick to startle and quick to settle. Reads a room for danger without knowing it, freezes, bolts, and trusts slowly; among the trusted the body goes entirely loose.'
            ] },
          { key: 'warren', name: 'Warren', weight: 7, endsAs: 'sociable, nesting and close',
            stages: [
              'Sleeps easier with company close than before.',
              'Makes a nest of whatever is soft, and sleeps better in a heap.',
              'Greets with a touch of the nose, grooms friends, and frets when one is missing.',
              'Sociable to the bone: a burrow of blankets, bodies piled warm, noses touched in greeting, and a need to know where everyone is.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'hay, clover and warm fur',
            stages: [
              'Sweat is fainter and sweeter.',
              'Hay and clean fur.',
              'Hay, clover and warm fur, faint and pleasant, with a mark under the chin for what is claimed.'
            ] },
          { key: 'further_pairs', name: 'Further pairs', weight: 5, sex: 'women', needs: [{ track: 'belly_fur', stage: 2 }], range: { least: 'One more pair', standard: 'Two more pairs', most: 'Three more pairs' }, endsAs: 'Two more pairs of nipples in the belly fur',
            stages: [
              'Tender points on the ribs under each breast, like pressed bruises.',
              'Each is a small flat disc of darker skin. A second pair of tender points sits lower, toward the navel.',
              'The upper pair have risen into small true nipples; the lower pair are discs. All tighten together in the cold.',
              'Breasts as before, and beneath them further pairs of small nipples in two lines down the belly, hidden in the belly fur (two more pairs on most), each as sensitive as the first.'
            ] },
          { key: 'year_round', name: 'Year-round', weight: 6, sex: 'women', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'no season: a steady, ready warmth',
            stages: [
              'Warmer toward touch than before, on any day.',
              'Warmth sits close under the skin all the time, quick to rise at closeness.',
              'No rise and fall through the year: a steady warmth in the skin that a touch can stir.',
              'Always a little in season and never overwhelmed by it: warm, quick to rouse, steady.'
            ] },
          { key: 'forearm_coat', name: 'Forearm coat', weight: 4, range: { least: 'To mid-forearm', standard: 'To the elbows', most: 'To the shoulders' }, endsAs: 'Coat from the hands to the elbows',
            stages: [
              'A prickle across the backs of the wrists and hands, then new hairs pushing through there, denser and coarser, in the coat\'s colour.',
              'A soft undercoat spreading up from the wrist, short and close, the skin beneath it hot and itching as it comes in.',
              'Guard hairs pushing through the undercoat, lying toward the hand, reaching most of the way to where the coat will end. Stroked against the lie it prickles and stands.',
              'A full short coat from the backs of the hands up the arm, ending in a soft uneven line; palm and inner wrist stay bare. Touch through it is felt well past the place touched: with the lie it runs warm up the arm, against it a sharp prickle. Sleeves drag over it.'
            ] },
          { key: 'leg_and_hip_coat', name: 'Leg and hip coat', weight: 8, range: { least: 'Feet to mid-thigh, no belly fur', standard: 'Feet to hips, pale belly fur to just under the breasts', most: 'Feet to hips, and over ribs and back; all but the face' }, endsAs: 'Coat from feet to hips',
            stages: [
              'Leg hair denser, in the coat\'s colour, from the ankle up.',
              'Undercoat on the lower leg, the skin beneath warmer; an itch as it comes in.',
              'Full coat to the knee, lying downward and shedding water; undercoat climbing the thigh. Cloth drags against the lie.',
              'Coat over thighs and hips, thicker on the outer thigh, short and fine on the inner. Touch through fur arrives slower and warmer, and spreads.',
              'Pelt from the paws up, thinning to bare skin in a soft uneven line. Stroked with the lie it is warm; against it, a prickle up the whole leg.'
            ] },
          { key: 'spine_strip', name: 'Spine strip', weight: 3, endsAs: 'A strip of coat from tail to nape',
            stages: [
              'Fine hair along the backbone, starting at the base of the spine.',
              'A narrow strip of short coat climbing the back.',
              'A strip of coat along the spine in the coat\'s colours. A hand run along it is felt down the whole back.'
            ] }
        ],
        harpy: [
          { key: 'arm_feathers', name: 'Arm feathers', weight: 8, endsAs: 'feathered from shoulder to wrist',
            stages: [
              'A prickling along the outer arms, and rows of small hard points under the skin.',
              'Pin feathers break through from shoulder to wrist, sheathed and itching, and open into soft down.',
              'True feathers overlay the down, lying back along the arm. Sleeves catch and bend them.',
              'The arms are feathered from the shoulder to the wrist, sleek, warm and waterproof. Each feather has feeling at its root, and a hand smoothing them the right way is a deep comfort.'
            ] },
          { key: 'wings', name: 'Wings', weight: 12, needs: [{ track: 'arm_feathers', stage: 'finished' }], range: { least: 'Feathered arms that glide but do not lift', standard: 'Arms as wings: short flight and long glides', most: 'Arms as great wings: strong sustained flight' }, endsAs: 'the arms as wings',
            stages: [
              'Long quills start along the back edge of the forearm and hand.',
              'The flight feathers lengthen past the fingertips. The forearm grows longer and lighter, and the chest muscles ache.',
              'The arm opens into a true wing a body-length across, and the shoulders turn further than a human\'s. Folded, the wings lie along the sides; doors and crowds need thought.',
              'The breast muscle is deep and strong. A hard downbeat lifts the feet from the ground, and a drop from a height becomes a glide.',
              'The arms are wings: flight in short strong bursts, long glides from any height, and a wing folded round someone as an embrace. Grounded for long, the body pines.'
            ] },
          { key: 'hands', name: 'Hands', weight: 6, range: { least: 'A thumb and two short clawed fingers', standard: 'A thumb and two clawed fingers', most: 'A thumb and two strong clawed fingers, the claws long and curved' }, endsAs: 'a thumb and two clawed fingers at each wrist',
            stages: [
              'The ring and little fingers stiffen and lie against the edge of the hand.',
              'They have drawn into the hand\'s edge, which now carries quills. The nails of the thumb and two remaining fingers thicken and hook.',
              'A hand of thumb and two fingers, long and strong, each with a curved claw, set at the bend of the wing.',
              'At each wrist a hand of thumb and two clawed fingers, free of the flight feathers. It grips hard, and manages a pen, a cup and a button with practice.'
            ] },
          { key: 'talons', name: 'Talons', weight: 8, range: { least: 'Scaled feet with hooked claws, heel down', standard: 'Scaled shanks, three toes forward and one back', most: 'Heavy talons, scaled to above the knee' }, endsAs: 'scaled shanks with three toes forward and one back',
            stages: [
              'Toenails thicker, darker and hooked. Socks and shoes begin to disagree with them.',
              'The little toe shortens and is lost into the foot. The big toe sets lower and begins to turn.',
              'The big toe has swung round to the back. Three long toes forward and one behind, each ending in a talon; the skin of the foot hardens into fine scales.',
              'Scales climb toward the knee, the shin thins and the heel lifts. The foot grips whatever it stands on, by itself.',
              'Scaled shanks and talons, three toes forward and one back. They lock round a perch in sleep, carry a surprising load, and click on hard floors.'
            ] },
          { key: 'leg_and_hip_feathers', name: 'Leg and hip feathers', weight: 7, range: { least: 'Knee to mid-thigh', standard: 'Knee to hips, fading out at the navel, and down the spine', most: 'Feathers from knee to hips and over belly, ribs and back; all but the face and chest' }, endsAs: 'feathers from knee to hips and down the spine',
            stages: [
              'Prickling above the knees and at the base of the spine.',
              'Down over the thighs; pin feathers at the hips.',
              'Soft body feathers from knee to hip, and a line of them up the spine.',
              'Feathers from the knee to the hips, thinning to bare skin at the navel, and a line of down along the spine. Soft, warm, and sensitive to a smoothing hand.'
            ] },
          { key: 'tail_fan', name: 'Tail fan', weight: 5, range: { least: 'A few short feathers', standard: 'A fan', most: 'A long sweeping fan' }, endsAs: 'a fan of tail feathers',
            stages: [
              'A bruised ache at the base of the spine, and a row of quills starting there.',
              'Short tail feathers that spread and close with balance and mood.',
              'A fan of tail feathers that steers in the air and flares with feeling. The root is sensitive.'
            ] },
          { key: 'crest_and_ears', name: 'Crest and ears', weight: 5, range: { least: 'A few feathers in the hair', standard: 'A crest, with tufts over the ears', most: 'A full crest, feathers all through the hair, and tufts where the ears were' }, endsAs: 'a crest through the hair and feather tufts where the ears were',
            stages: [
              'Hard points among the hair at the crown.',
              'Small feathers through the hair, rising with surprise. The outer ears feel thin.',
              'A crest of longer feathers. The outer ears have shrunk back, a tuft of fine feathers growing over each opening.',
              'A crest through the hair that lifts and flattens with every feeling, and feather tufts where the ears were. Hearing is as sharp as ever.'
            ] },
          { key: 'face', name: 'Face', weight: 4, face: true, range: { least: 'The person\'s own human face; the bird shows in the eyes and the tilt of the head', standard: 'A faint cast: a fine sharp nose, large eyes', most: 'A fine hard-edged nose, feathered brows and cheeks; never a beak' }, endsAs: 'the person\'s own face with a faint avian cast',
            stages: [
              'The head tilts to look, one eye and then the other.',
              'The nose is finer and a touch sharper; the eyes seem larger.',
              'The same face, plainly the person\'s own, with something of the bird in it, and quick tilting movements.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 4, endsAs: 'far-sighted, bright eyes',
            stages: [
              'Far things are clearer.',
              'The iris turns {eye}. A face can be read from across a quad.',
              '{eye} eyes that pick out a coin from a rooftop and see colours others cannot. Close work tires them.'
            ] },
          { key: 'light_bones', name: 'Light bones', weight: 7, needs: [{ track: 'chest', stage: 3, from: 3 }], endsAs: 'a light frame, a deep breastbone and small high breasts',
            stages: [
              'Lighter on the scales without looking thinner.',
              'The frame slims, and the breastbone deepens into a keel. Bruises come more easily.',
              'Light enough to be lifted easily. The chest is deep with flight muscle, and the breasts sit small and high on it.',
              'A light, fine-boned body with a deep breastbone, small high breasts and down between them. Strong for its weight, quick to chill, and easily carried.'
            ] },
          { key: 'voice_and_song', name: 'Voice and song', weight: 6, endsAs: 'a carrying voice and a dawn song',
            stages: [
              'Humming without noticing.',
              'The voice clears and carries; whistles and trills come by themselves.',
              'Sings at first light before fully awake. Mimicry is easy.',
              'A voice of great range and carrying power, a dawn song that will not be skipped, and calls to the flock that cross the whole campus.'
            ] },
          { key: 'preening', name: 'Preening', weight: 3, endsAs: 'preening daily, self and loved ones',
            stages: [
              'Fusses with hair and feathers.',
              'Draws feathers through the fingers or lips to set them, every day.',
              'Preens daily, oiling the feathers from a gland at the tail\'s root, and preens loved ones too.'
            ] },
          { key: 'appetite', name: 'Appetite', weight: 3, endsAs: 'eating little and often',
            stages: [
              'Hungry often, for little.',
              'Eats lightly through the day: seeds, fruit, fish.',
              'Eats little and often, and burns it fast.'
            ] },
          { key: 'heights_and_flock', name: 'Heights and flock', weight: 7, endsAs: 'at home high up and among the flock',
            stages: [
              'Seeks the upper floor and the window seat.',
              'Sleeps better high up, and likes others of the kind within call.',
              'Roosts by choice, feet locked; uneasy in low closed rooms. Restless when the season turns.',
              'At home on heights and in a flock: roosts high, calls back and forth all day, and feels the autumn pull to go somewhere.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'warm dry feathers',
            stages: [
              'Sweat is faint.',
              'Warm feathers and dust.',
              'Warm feathers, clean and dry, like a sun-warmed loft.'
            ] },
          { key: 'laying', name: 'Laying', weight: 7, sex: 'women', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'an unfertilised egg every few weeks',
            stages: [
              'A dull ache low in the belly every few weeks.',
              'The ache comes with a heaviness and a wish to be somewhere quiet.',
              'The first egg: an hour of deep effort alone, then relief. It is unfertilised.',
              'An egg every few weeks, more often in spring. The day before is heavy and private; the day after, light.',
              'Lays every few weeks as a matter of course. It is ordinary among harpies and never remarked on.'
            ] },
          { key: 'brooding_and_moult', name: 'Brooding and moult', weight: 5, sex: 'women', needs: [{ track: 'laying', stage: 3 }], endsAs: 'brooding after laying and a yearly moult',
            stages: [
              'Gathers soft things into one place.',
              'Builds a nest and wants to sit on what has been laid. Short-tempered when disturbed.',
              'Broody for days at a time: guarding, warming, snapping at anyone near. It passes.',
              'Broods a few days after laying, unless choosing not to, and once a year moults: grounded, itching, vain about it, and glad of help with the pin feathers.'
            ] }
        ],
        mer: [
          { key: 'webbed_hands', name: 'Webbed hands', weight: 5, range: { least: 'To the first joint', standard: 'To the last joint', most: 'Full webs on long fingers and toes' }, endsAs: 'long fingers webbed to the last joint',
            stages: [
              'The skin between the fingers feels tight when they spread.',
              'A thin fold of skin joins the fingers at the base.',
              'Webbing to the middle joint, translucent; the hands cup water well.',
              'Long webbed fingers, the web folding away when the hand closes. Strong in the water and deft out of it.'
            ] },
          { key: 'webbed_feet', name: 'Webbed feet', weight: 6, endsAs: 'long webbed feet',
            stages: [
              'The toes feel long and spread in their shoes.',
              'The toes lengthen, and skin joins them at the base. Socks feel strange over them.',
              'Long toes webbed to the tips; the foot is broad as a paddle. Shoes fit badly.',
              'Long webbed feet, flat and flexible, awkward on stairs and powerful in water.'
            ] },
          { key: 'arm_scales', name: 'Arm scales', weight: 4, range: { least: 'Hands to mid-forearm', standard: 'To the elbows', most: 'To the shoulders' }, endsAs: 'scales from the hands to the elbows',
            stages: [
              'The skin of the hands and wrists feels smooth and cool, faintly patterned.',
              'Fine scales on the backs of the hands, lying toward the fingers.',
              'Scales climbing the forearm, slick when wet and dull when dry.',
              'Scales from the backs of the hands up the arm, fading into pearled skin. Stroked with the lie they are silk; against it, a rasp.'
            ] },
          { key: 'leg_and_hip_scales', name: 'Leg and hip scales', weight: 8, range: { least: 'Feet to mid-thigh', standard: 'Feet to hips, fading out at the navel', most: 'Scales from feet to hips and over belly, ribs and back; all but the face and chest' }, endsAs: 'scales from feet to hips, fading out at the navel',
            stages: [
              'The skin of the feet and ankles is smooth, cool and faintly patterned.',
              'Fine scales over the feet and shins. Dry, they itch.',
              'Scales to the knee, larger and brighter on the shins.',
              'Scales over thighs and hips, small and fine on the inner thigh, the colours strong when wet.',
              'Scales from the feet up, fading out in a soft uneven line. Cool to the touch, bright in water, and sensitive to a hand moving with the lie.'
            ] },
          { key: 'water_tail', name: 'Water tail', weight: 10, needs: [{ track: 'leg_and_hip_scales', stage: 'finished' }, { track: 'webbed_feet', stage: 'finished' }], range: { least: 'Legs stay legs, finned and webbed', standard: 'Legs close into a tail and fluke', most: 'The tail holds for an hour after leaving the water' }, endsAs: 'one scaled tail and a fluke, in water',
            stages: [
              'In water the legs want to stay together, and kicking as one is stronger.',
              'Underwater the skin of the inner legs clings from thigh to ankle, and parts again slowly in air.',
              'Submerged, the legs close into one scaled column, first to the knee and then to the ankle; the feet turn outward and spread.',
              'In water there is a full tail with the feet fanned into a fluke. Out of it the tail parts back into legs over a few minutes as the scales dry, leaving them weak for a moment.',
              'Legs on land; in water, one long scaled tail and a broad fluke, changing over in the time of a few breaths. Swimming is flight. The seam along the inner legs is very sensitive.'
            ] },
          { key: 'gills', name: 'Gills', weight: 8, endsAs: 'three gill slits either side of the ribs',
            stages: [
              'An ache along the ribs on both sides, and a wish to hold the breath underwater.',
              'Three fine lines either side of the ribs, tender and closed.',
              'The lines open underwater and draw it through. The first breaths of water are frightening, then easy.',
              'Three gill slits either side of the ribs, sealed flat in air and working in water. Breathes both; the gills are tender to touch and best kept damp.'
            ] },
          { key: 'finned_ears', name: 'Finned ears', weight: 5, range: { least: 'Small fins', standard: 'Finned ears', most: 'Tall fans' }, endsAs: 'finned, translucent ears',
            stages: [
              'The ears thin at the rims.',
              'The tops lengthen into soft spines with skin between them.',
              'Finned, translucent ears that fan and fold with mood and hear well underwater.'
            ] },
          { key: 'spine_ridge', name: 'Spine ridge', weight: 4, extentWith: 'finned_ears', range: { least: 'Small fins', standard: 'A low ridge', most: 'A high back fin' }, endsAs: 'a low fin-ridge up the spine',
            stages: [
              'A line of smooth cool skin down the backbone.',
              'A low ridge of soft spines beginning between the shoulders.',
              'A fin-ridge along the spine, lying flat in air and lifting in water. Sensitive at its base.'
            ] },
          { key: 'sheen_and_skin', name: 'Sheen and skin', weight: 5, endsAs: 'smooth, cool, pearl-sheened skin',
            stages: [
              'The skin dries out quickly.',
              'A faint pearl lustre on the bare skin, strongest when wet.',
              'Bare skin with a pearl sheen, smooth, cool and hairless below the head, slick as glass in water.'
            ] },
          { key: 'face', name: 'Face', weight: 4, face: true, range: { least: 'The person\'s own human face', standard: 'A faint cast: a slightly flat nose, wide-set eyes', most: 'A flat nose with closing nostrils, very wide-set eyes, scales at the cheekbones' }, endsAs: 'the person\'s own face with a faint cast of the sea',
            stages: [
              'The nose feels flatter at the bridge.',
              'The nostrils narrow and can close; the eyes sit a touch wider.',
              'The same face, plainly the person\'s own, with something of the sea in it, and a mouth made for singing.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 4, endsAs: 'eyes that see clearly underwater',
            stages: [
              'Underwater, things are clear without help.',
              'The iris turns {eye}, and a clear inner lid slides across in water.',
              'Large {eye} eyes that see clearly underwater and in the dim of depth, and find full noon too bright.'
            ] },
          { key: 'voice', name: 'Voice', weight: 7, endsAs: 'a voice that carries a long way and holds a listener still',
            stages: [
              'The voice carries further than intended.',
              'A singing voice of new range and sweetness; people stop to listen.',
              'Underwater it carries for miles as clicks and long notes. In air, a sung line reaches everyone in the room.',
              'A voice that carries and that people stop to hear. Sung with intent it holds a listener still; holding someone unwilling that way is a line the merfolk hold hard.'
            ] },
          { key: 'water_need', name: 'Water need', weight: 7, endsAs: 'soaking daily, with a dry spell felt as illness',
            stages: [
              'Thirsty all the time; baths run long.',
              'The skin tightens and itches after a day dry. Soaking ends it.',
              'Must soak daily. A missed day brings cracked skin and a cracked temper, and the pools pull.',
              'Belongs half to water: soaks every day, sleeps best afloat, and feels a long dry spell as illness. Wet, it is quick, strong and at ease.'
            ] },
          { key: 'cool_blood', name: 'Cool blood', weight: 3, endsAs: 'cool-skinned and slowed by cold',
            stages: [
              'Hands and feet run cool.',
              'Cool to the touch all over; slow on cold mornings.',
              'Cool-skinned, slowed by cold air and quickened by warm water, always seeking warmth.'
            ] },
          { key: 'appetite', name: 'Appetite', weight: 3, endsAs: 'salt and raw fish',
            stages: [
              'Craves salt.',
              'Fish, shellfish and seaweed, less and less cooked.',
              'Eats from the sea, mostly raw, and salts everything else.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'clean salt water',
            stages: [
              'Sweat is faint and salt.',
              'Clean seawater.',
              'Smells of clean salt water and wet stone.'
            ] },
          { key: 'breasts', name: 'Breasts', weight: 7, sex: 'women', endsAs: 'smooth, firm breasts with the pearl sheen',
            stages: [
              'The skin of the chest takes the pearl sheen first.',
              'The breasts are smoother and firmer, cool to the touch.',
              'The nipples pale to the colour of the inside of a shell.',
              'Smooth, firm breasts with the pearl sheen and pale nipples. They warm slowly under a hand.'
            ] },
          { key: 'colours', name: 'Colours', weight: 7, sex: 'men', extentWith: 'spine_ridge', needs: [{ track: 'spine_ridge', stage: 2 }],
            range: { least: 'Bright scales and a swimmer\'s shoulders', standard: 'Bright scales, a ridge edged with colour and a swimmer\'s shoulders', most: 'Bright scales, a tall back fin and a swimmer\'s shoulders' },
            endsAs: 'bright scales, a colour-edged ridge and a swimmer\'s shoulders',
            stages: [
              'The scales brighten at the edges.',
              'Bright bands on the arms and legs; the shoulders broaden.',
              'The spine ridge grows taller, edged with colour.',
              'Brighter scales than any mer woman\'s, the back ridge taller and edged with colour, a swimmer\'s shoulders and a smooth chest.'
            ] },
          { key: 'spring_tides', name: 'Spring tides', weight: 7, sex: 'women', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'a season at the spring tides',
            stages: [
              'Restless for a few days near the highest tides.',
              'At the spring tides: warm, wakeful, drawn to the water, the scales brighter.',
              'A full season at the spring tides: singing more, running warm, restless on land and easy only in the pools.',
              'The season comes with the spring tides and passes with them, planned around like weather.'
            ] },
          { key: 'display', name: 'Display', weight: 7, sex: 'men', crossAt: { track: 'rhythms', stage: 3 }, endsAs: 'colour and song at the spring tides',
            stages: [
              'Livelier near the highest tides.',
              'The colours flare at the spring tides; the swimming is harder and the singing louder.',
              'The colours flare brightest near any woman of the kind in season, and the water will not allow stillness.',
              'At the spring tides: all colour and song, and it passes with the tide.'
            ] }
        ],
        dryad: [
          { key: 'hands', name: 'Hands', weight: 5, range: { least: 'Thorn nails on long fingers and toes', standard: 'Twig-jointed fingers; splayed, rooting toes', most: 'Long branching fingers and toes like roots; still hands' }, endsAs: 'long twig-jointed fingers with thorn nails',
            stages: [
              'The nails harden and narrow to points.',
              'The finger joints stand out like the nodes on a twig, and the fingers lengthen.',
              'Long jointed fingers with thorn nails; the skin over the knuckles is finely ridged.',
              'Long twig-jointed fingers with nails like thorns. Strong, patient and exact, and gentle with anything growing.'
            ] },
          { key: 'feet_and_roots', name: 'Feet and roots', weight: 7, endsAs: 'splayed thorn-nailed toes and grained soles that root',
            stages: [
              'Toenails harden to thorns, and the toes spread in their shoes.',
              'The soles thicken and take a grain like sawn wood. Bare earth feels good underfoot.',
              'Long splayed toes that grip and dig. Standing barefoot in soil, fine rootlets creep from the soles and draw water.',
              'Splayed thorn-nailed toes and grained soles that root lightly in soil at rest and lift free at will. Rooting is rest, food and deep ease, and shoes are a misery.'
            ] },
          { key: 'arm_bark', name: 'Arm bark', weight: 4, range: { least: 'To mid-forearm', standard: 'To the elbows', most: 'To the shoulders' }, endsAs: 'bark from the hands to the elbows',
            stages: [
              'The skin of the hands and wrists roughens and dries.',
              'Fine bark on the backs of the hands, thin as paper.',
              'Bark climbing the forearm, ridged along the arm, with smooth skin at the creases of wrist and palm.',
              'Bark from the backs of the hands up the arm, thinning into grained skin. Warm in sun, and a touch on it is felt slowly and deeply.'
            ] },
          { key: 'leg_and_hip_bark', name: 'Leg and hip bark', weight: 8, range: { least: 'Feet to mid-thigh', standard: 'Feet to hips, thinning out at the navel', most: 'Bark from feet to hips and over belly, ribs and back; all but the face and chest' }, endsAs: 'bark from feet to hips, thinning out at the navel',
            stages: [
              'The skin of the feet and shins roughens and dries.',
              'Thin bark on the shins.',
              'Bark to the knee, ridged, with smooth skin behind the joint so it bends.',
              'Bark climbing the thighs and hips, thinner and finer on the inner thigh.',
              'Bark from the feet up, thinning to smooth grained skin in an uneven line. It keeps out cold and thorn, and needs oil or rain to stay supple; dry, it aches.'
            ] },
          { key: 'spine_ridge', name: 'Spine ridge', weight: 3, endsAs: 'a ridge of bark up the spine',
            stages: [
              'A line of rough skin down the backbone.',
              'A narrow ridge of bark from the base of the spine upward.',
              'A ridge of bark along the spine, flexing in plates; a hand pressed on it is felt deep and warm.'
            ] },
          { key: 'grain', name: 'Grain', weight: 5, endsAs: 'skin faintly grained like pale wood',
            stages: [
              'The skin takes a faint pattern, like wood under varnish.',
              'Grain shows on the bare skin everywhere. A scratch beads with clear sap before blood.',
              'Skin faintly grained like pale wood, cool and smooth, healing clean and slowly. Body hair is gone below the head.'
            ] },
          { key: 'leaves', name: 'Leaves', weight: 7, range: { least: 'A few leaves in the hair', standard: 'Leaves growing through the hair', most: 'A crown of leaves and fine twigs through the hair' }, endsAs: 'leaves growing through the hair',
            stages: [
              'The hair thickens and takes a green or brown cast.',
              'Small leaf buds along the hairline and at the nape.',
              'Leaves open among the hair, alive and turning toward light.',
              'Hair as a fall of fine strands with leaves growing through it, in the kind of the dryad\'s tree. They turn to the sun, droop with thirst and rustle with feeling.'
            ] },
          { key: 'ears', name: 'Ears', weight: 4, range: { least: 'Small points', standard: 'Long leaf-shaped ears', most: 'Long ears with a leaf\'s edge and veins' }, endsAs: 'long leaf-shaped ears',
            stages: [
              'The ear tips lengthen.',
              'Long and flat, with a central vein.',
              'Long leaf-shaped ears that turn toward light as well as sound.'
            ] },
          { key: 'face', name: 'Face', weight: 4, face: true, range: { least: 'The person\'s own human face with a faint grain', standard: 'A faint cast: high cheekbones, faint grain', most: 'Strong grain, with bark at the temples and jaw' }, endsAs: 'the person\'s own face with a faint cast of the wood',
            stages: [
              'The face looks stiller in the mirror.',
              'The cheekbones stand higher, and the grain shows faintly on the skin.',
              'The same face, plainly the person\'s own, with something of the wood in it, and a calm, still look.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 3, endsAs: 'eyes that read light and growing things',
            stages: [
              'Light feels good on the face.',
              'The iris turns {eye}, flecked like bark or leaf.',
              '{eye} eyes that read light, season and the health of growing things at a glance.'
            ] },
          { key: 'sun_and_water', name: 'Sun and water', weight: 7, endsAs: 'fed by sun and water more than food',
            stages: [
              'Thirsty, and happier outdoors.',
              'Sunlight is felt as food on the skin and leaves. Meals shrink.',
              'A day without sun brings a hunger nothing else fills. Drinks deeply and often.',
              'Fed by sun and water, with food a small pleasure more than a need. Wilts indoors and in drought, and revives in an hour of light and rain.'
            ] },
          { key: 'stillness', name: 'Stillness', weight: 7, endsAs: 'patient, slow, and taking the long view',
            stages: [
              'Less hurried.',
              'Can stand without moving for an hour and not mind.',
              'Thinks slowly and thoroughly; quick talk washes past. Time feels long.',
              'Patient, slow to anger and slow to forget. Holds still as a tree, speaks when it has finished thinking, and takes the long view of everything.'
            ] },
          { key: 'the_year', name: 'The year', weight: 9, endsAs: 'living by the seasons',
            stages: [
              'Mood follows the weather more than before.',
              'Quick and bright in spring, heavy-headed in winter.',
              'In autumn the leaves in the hair turn colour and fall, and the body slows.',
              'Winter is half sleep: short days, long rest, little hunger, the bark dull.',
              'Lives by the year: waking and budding in spring, full in summer, turning and shedding in autumn, dozing through winter. Each season is felt in the whole body.'
            ] },
          { key: 'the_tree', name: 'The tree', weight: 7, endsAs: 'bound to one tree',
            stages: [
              'Drawn to one particular tree without knowing why.',
              'Sits under it, sleeps better near it, knows when it is thirsty.',
              'Feels what it feels: wind in its crown, frost at its root, harm coming near it.',
              'Bound to one tree. Near it the dryad is strongest and most at ease; far from it for long, it pines. Harm to one is harm to the other.'
            ] },
          { key: 'voice', name: 'Voice', weight: 3, endsAs: 'low and slow, with a creak in it',
            stages: [
              'Speaks more slowly.',
              'The voice lowers and softens, with a creak in it.',
              'A low, slow voice with the sound of wood and leaves under it.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'sap, leaf and rain',
            stages: [
              'Sweat is faint and green.',
              'Cut wood and leaf.',
              'Smells of sap, leaf mould and rain, and of blossom in season.'
            ] },
          { key: 'breasts', name: 'Breasts', weight: 7, sex: 'women', endsAs: 'breasts of smooth grained skin where the bark opens',
            stages: [
              'The skin of the chest stays smooth as bark spreads elsewhere.',
              'The grain on the breasts is fine and pale; the nipples darken.',
              'Where bark reaches the ribs, it parts round the breasts and leaves them bare.',
              'Breasts of smooth grained skin where the bark opens, the nipples dark as knots in pale wood.'
            ] },
          { key: 'bark', name: 'Bark', weight: 7, sex: 'men', needs: [{ track: 'spine_ridge', stage: 2 }], endsAs: 'heavy bark across the shoulders',
            stages: [
              'The skin of the shoulders roughens.',
              'Bark across the tops of the shoulders.',
              'Rougher, thicker bark over the shoulders and upper back, joining the spine ridge.',
              'Heavy bark across the shoulders and down the back, deeper-ridged than a woman\'s, on a long hard frame.'
            ] },
          { key: 'flowering', name: 'Flowering', weight: 7, sex: 'women', crossAt: { track: 'rhythms', stage: 3 }, needs: [{ track: 'leaves', stage: 'finished' }], endsAs: 'flowers every spring and fruit by late summer',
            stages: [
              'Small buds among the leaves in spring.',
              'The buds open: flowers in the hair for a few weeks, scented, visited by bees.',
              'In flower: warm and bright, the scent carrying on the air. After it, small fruits set among the leaves.',
              'Flowers every spring and fruits by late summer. The flowering is the season, felt as warmth and sweetness in the body.'
            ] },
          { key: 'catkins', name: 'Catkins', weight: 7, sex: 'men', crossAt: { track: 'rhythms', stage: 3 }, needs: [{ track: 'leaves', stage: 'finished' }], endsAs: 'catkins and pollen every spring',
            stages: [
              'Tassels bud among the leaves in spring.',
              'Catkins hang in the hair and shed pollen when shaken.',
              'In catkin: restless and bright, the catkins opening near any dryad in flower, dusting everything near gold.',
              'Catkins every spring, and clouds of pollen with them; the season passes with the blossom.'
            ] }
        ],
        goblin: [
          { key: 'green_skin', name: 'Green skin', weight: 12, range: { least: 'Olive-green, darker at the hands and feet', standard: 'Green all over, darkest at the limbs and ears', most: 'Deep green throughout' }, endsAs: 'green all over, darkest at the limbs and ears',
            stages: [
              'The fingertips and nail beds take a green tinge that does not wash off.',
              'Green to the wrists, and at the toes and ear rims, darkest at the tips.',
              'Hands to elbows and feet to knees are deep green, and an olive cast is spreading over the rest.',
              'Green all over, darkest at the limbs and ears, the lips and nipples darker still. Body hair below the brows has thinned away.',
              'Green skin from scalp to sole, darkest from hands to elbows, feet to knees and at the ear tips, paling to olive on the belly and chest. Smooth, cool and tougher than it looks.'
            ] },
          { key: 'height', name: 'Height', weight: 10, range: { least: 'A head shorter than before', standard: 'About four feet', most: 'About three and a half feet' }, endsAs: 'about four feet, adult in proportion',
            stages: [
              'Clothes hang a little long.',
              'Shorter by a hand; sleeves and hems need turning up. The proportions stay an adult\'s.',
              'Shorter by a head. Counters, shelves and chairs are built for someone else.',
              'Shorter than nearly everyone, with a low centre of weight and a quick short stride. Shoes go loose, then too long.',
              'Grown into the new height, adult in proportion and build, compact and strong for the size. The world is tall, and climbing is the answer.'
            ] },
          { key: 'hands', name: 'Hands', weight: 7, range: { least: 'Long fingers', standard: 'Long nimble fingers, hard dark nails', most: 'Very long fingers with an extra reach of joint' }, endsAs: 'long nimble fingers with hard dark nails',
            stages: [
              'The fingers feel long; the nails harden and darken.',
              'Fingers longer by a joint\'s width, the knuckles more flexible.',
              'Long, quick fingers that bend back further than a human\'s, with hard dark nails good for prying and picking.',
              'Long nimble hands with hard dark nails, clever with small parts, locks and knots, and never still.'
            ] },
          { key: 'feet', name: 'Feet', weight: 7, range: { least: 'Broad feet with long toes', standard: 'Wide flat feet, five hooked gripping toes', most: 'Broad feet that grip like hands' }, endsAs: 'wide flat feet with five long gripping toes',
            stages: [
              'Toenails harden and hook; the toes spread in their shoes.',
              'The foot widens and flattens, and the toes lengthen.',
              'Wide flat feet with five long toes that curl and grip like fingers. Shoes fit nowhere.',
              'Wide, flat, tough-soled feet with five long hooked toes that grip a ledge, a rope or a dropped coin. Sure on any climb.'
            ] },
          { key: 'ears', name: 'Ears', weight: 7, range: { least: 'Pointed', standard: 'Long, held sideways', most: 'Very long, drooping at the tips' }, endsAs: 'long pointed ears held sideways',
            stages: [
              'The ear tips ache and run warm.',
              'The tops draw to points and lengthen outward.',
              'Long pointed ears held out to the sides, moving with mood and sound.',
              'Long pointed ears, held sideways, drooping with gloom and lifting with interest, sharp of hearing. The tips are sensitive.'
            ] },
          { key: 'nose_and_face', name: 'Nose and face', weight: 5, face: true, range: { least: 'The person\'s own human face, in green', standard: 'A faint cast: a nose a little long, a wide mouth', most: 'A long nose, a very wide mouth and heavy brows' }, endsAs: 'the person\'s own face with a faint goblin cast',
            stages: [
              'The nose feels larger to the fingers.',
              'The nose lengthens a little, and the mouth widens.',
              'The chin sharpens and the cheekbones stand out; the grin reaches further.',
              'The same face, plainly the person\'s own and an adult\'s, with something of the goblin in it, and bright quick eyes.'
            ] },
          { key: 'teeth', name: 'Teeth', weight: 3, endsAs: 'small sharp teeth',
            stages: [
              'The teeth ache at the root.',
              'Smaller and sharper, every one.',
              'Small sharp teeth that show in a grin and make short work of gristle and shell.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 6, endsAs: 'large, night-seeing eyes that squint in sun',
            stages: [
              'Dim rooms are comfortable; bright ones tiring.',
              'The pupils open very wide in the dark and the iris turns {eye}. Sunlight makes them squint.',
              'Large {eye} eyes that see well by starlight and squint in full sun. Shade helps by day.'
            ] },
          { key: 'stomach', name: 'Stomach', weight: 3, endsAs: 'eating nearly anything',
            stages: [
              'Hungry for strong flavours: burnt, sour, pickled.',
              'Nothing disagrees with the stomach any more.',
              'Eats nearly anything and enjoys it, the stronger the better, and keeps it down.'
            ] },
          { key: 'collecting_and_the_deal', name: 'Collecting and the deal', weight: 9, endsAs: 'a collector and a dealer with a code',
            stages: [
              'Small bright or useful things catch the eye and end up in a pocket.',
              'Keeps a hoard, sorted, and knows every piece. Parting with one hurts unless something better comes back.',
              'Bargains by instinct and enjoys it; a fair swap is a pleasure and a sharp one a triumph.',
              'A collector and a dealer: full pockets, a hoard at home, a memory for what everything is worth, and a strict code about a bargain once struck.'
            ] },
          { key: 'tinkering', name: 'Tinkering', weight: 8, endsAs: 'a born maker and mender',
            stages: [
              'The fingers want something to fiddle with.',
              'Takes things apart to see how they go, and mostly gets them back together.',
              'Mends and improves without being asked; sees how a mechanism wants to move.',
              'A born maker and mender: artificing comes easily, idle hands build, and a broken thing is an invitation.'
            ] },
          { key: 'heap', name: 'Heap', weight: 5, endsAs: 'sleeping in a warm heap of its own people',
            stages: [
              'Sleeps better in a small, close space.',
              'Likes company in the bed and noise in the house.',
              'Sleeps in a warm heap of its own people by choice, thinks of family as a crowd, and finds an empty room lonely.'
            ] },
          { key: 'wiry_strength', name: 'Wiry strength', weight: 4, endsAs: 'tough, tireless, with a climber\'s grip',
            stages: [
              'Stronger in the grip.',
              'Climbs easily, and hangs by the hands without tiring.',
              'Wiry, tough and tireless for the size, with a climber\'s grip and a low sure balance.'
            ] },
          { key: 'voice', name: 'Voice', weight: 3, endsAs: 'quick and rough, with a cackle',
            stages: [
              'Talks faster.',
              'The voice roughens, and the laugh turns to a cackle.',
              'A quick, rough, carrying voice and a cackle of real delight.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'oil, hot metal and earth',
            stages: [
              'Sweat smells of metal.',
              'Oil, metal and damp earth.',
              'Smells of a workshop: oil, hot metal and earth.'
            ] },
          { key: 'figure', name: 'Figure', weight: 8, sex: 'women', endsAs: 'a compact, wide-hipped figure with breasts full for the height',
            stages: [
              'The hips widen under the shortening frame.',
              'Hips and thighs fill, and the breasts keep their size as the body shrinks around them.',
              'Wide hips, a small waist, breasts full for the frame, the nipples dark green.',
              'A compact, wide-hipped grown woman\'s figure with breasts full for the height and dark green nipples.'
            ] },
          { key: 'build', name: 'Build', weight: 8, sex: 'men', range: { least: 'Wiry and long-armed, with big hands', standard: 'Wiry and long-armed, with big hands and lower canines a shade long', most: 'Wiry and long-armed, with big hands and small tusks' }, endsAs: 'wiry and long-armed, with big hands and lower canines a shade long',
            stages: [
              'The arms feel long, and the hands broaden.',
              'Long arms and big knuckled hands on a wiry frame. The nose and ears grow further than a woman\'s.',
              'The lower canines lengthen and show against the upper lip.',
              'A wiry, long-armed grown man with big clever hands, a larger nose and ears, and lower canines a shade long.'
            ] }
        ],
        fairy: [
          { key: 'height', name: 'Height', weight: 12, range: { least: 'About four feet', standard: 'About three feet', most: 'About two feet' }, endsAs: 'about three feet, a grown adult\'s proportions in small',
            stages: [
              'Clothes hang a little long.',
              'Shorter by a hand, and lighter. The proportions stay an adult\'s.',
              'Shorter by a head and a half. Shoes are too long to walk in, and furniture is a climb.',
              'Waist-high to most people, slight and quick. A cup needs two hands.',
              'Grown into the new height, a grown adult\'s proportions in small, fine-boned and very light. Most of the world is oversized, and wings are the answer.'
            ] },
          { key: 'wing_buds', name: 'Wing buds', weight: 5, endsAs: 'four folded buds beside the spine',
            stages: [
              'An itch between the shoulder blades that cannot be reached.',
              'Two pairs of tender ridges beside the spine.',
              'Four soft folded buds under thin skin, twitching with feeling. Lying on the back is uncomfortable.'
            ] },
          { key: 'wings', name: 'Wings', weight: 12, needs: [{ track: 'wing_buds', stage: 'finished' }], range: { least: 'Four small wings: hovering and long floats', standard: 'Four clear wings: true flight in bursts', most: 'Great bright wings and easy sustained flight' }, endsAs: 'four clear veined wings and true flight',
            stages: [
              'The buds break the skin, damp and crumpled.',
              'They unfold and dry into four small clear wings, veined like a leaf, too weak to lift anything.',
              'The wings lengthen past the waist and beat in a blur. A hop becomes a long float.',
              'Hovering for moments at a time; the back and chest ache with new muscle. Clothes need a low back.',
              'Four clear veined wings that fold flat down the back. True flight once the body is small enough to carry: darting, hovering, tiring quickly. A fingertip along a wing vein is felt through the whole body.'
            ] },
          { key: 'sheen', name: 'Sheen', weight: 7, range: { least: 'At the fingertips and toes', standard: 'To the elbows and knees, and along the spine', most: 'Over the whole body' }, endsAs: 'an iridescent sheen at the limbs and spine',
            stages: [
              'The fingernails gleam as if polished.',
              'A faint shimmer on the fingertips and toes, colours moving in it.',
              'Iridescence climbing the forearms and the shins.',
              'Bare skin all over, with a sheen like the inside of a shell from the fingertips and toes up the limbs and along the spine round the wing roots.'
            ] },
          { key: 'ears', name: 'Ears', weight: 5, range: { least: 'Small points', standard: 'Long pointed ears', most: 'Very long, swept back' }, endsAs: 'long pointed ears',
            stages: [
              'The ear tips ache.',
              'The tops draw up to points.',
              'Long pointed ears, fine and upright, sensitive at the tips.'
            ] },
          { key: 'face', name: 'Face', weight: 4, face: true, range: { least: 'The person\'s own human face', standard: 'A faint cast: fine features, eyes a little large', most: 'Sharply fey: very large eyes and fine features on a human face' }, endsAs: 'the person\'s own face with a faint fey cast',
            stages: [
              'The features look finer in the mirror.',
              'Cheekbones and chin more delicate; the eyes seem larger.',
              'The same face, plainly the person\'s own and an adult\'s, with something of the fey in it.'
            ] },
          { key: 'eyes', name: 'Eyes', weight: 4, endsAs: 'large, many-toned eyes that see glamour for what it is',
            stages: [
              'Colours are richer.',
              'The iris turns {eye}, bright and many-toned.',
              'Large {eye} eyes that see colours others cannot, glamour for what it is, and the glow of other fairies\' moods.'
            ] },
          { key: 'hands_and_feet', name: 'Hands and feet', weight: 5, endsAs: 'slender hands and narrow feet seldom flat',
            stages: [
              'The fingers and toes look longer and finer.',
              'Slender hands; narrow feet that prefer the toes.',
              'Slender long-fingered hands, deft with small things, and narrow feet that seldom rest flat.'
            ] },
          { key: 'lightness', name: 'Lightness', weight: 5, endsAs: 'almost weightless',
            stages: [
              'Lighter than the size explains.',
              'A breeze is felt as a push, and a jump hangs.',
              'Almost weightless: carried on one palm, blown by a gust, landing without sound.'
            ] },
          { key: 'glow_and_dust', name: 'Glow and dust', weight: 8, range: { least: 'Only in strong feeling', standard: 'Rising and falling with mood', most: 'Always alight' }, endsAs: 'glowing with mood and shedding dust',
            stages: [
              'The skin seems lit from inside when very happy.',
              'A faint glow that rises and falls with mood. It cannot be hidden in the dark.',
              'Fine bright dust comes off the skin and wings with strong feeling and settles on whatever is near.',
              'Glows with mood, bright in joy, dim in sorrow, flickering in anger, and sheds dust when moved. A fairy cannot conceal what it feels.'
            ] },
          { key: 'sweet_tooth', name: 'Sweet tooth', weight: 4, endsAs: 'living on nectar, fruit and sugar',
            stages: [
              'Craves sugar and fruit.',
              'Meals shrink to nectar, honey, fruit and cream. Sweets bring a giddy rush.',
              'Lives on nectar, fruit and sugar, and gets drunk on too much honey.'
            ] },
          { key: 'warmth', name: 'Warmth', weight: 4, endsAs: 'needing warmth to fly and to think quickly',
            stages: [
              'Feels the cold sooner.',
              'Sluggish on cold mornings; lively in sun.',
              'Needs warmth to fly and to think quickly: basks before flight, grows slow and sleepy in the cold, and seeks warm company.'
            ] },
          { key: 'promises', name: 'Promises', weight: 8, endsAs: 'bound by its word',
            stages: [
              'Dislikes owing or being owed.',
              'Keeps exact count of favours, gifts and slights. A broken word sits like a stone.',
              'Cannot comfortably lie outright; speaks carefully and listens to exact wording. A gift creates a debt.',
              'Bound by its word: a promise made must be kept, a debt paid, a name respected. It bargains precisely and is scrupulous about thanks.'
            ] },
          { key: 'iron', name: 'Iron', weight: 3, endsAs: 'bare iron burning',
            stages: [
              'Iron feels unpleasantly cold.',
              'It stings like a nettle.',
              'Bare iron burns on touch, and its nearness is an ache. Other metals are no trouble.'
            ] },
          { key: 'voice', name: 'Voice', weight: 3, endsAs: 'small, clear and carrying',
            stages: [
              'The voice lightens.',
              'Higher and clearer as the body shrinks; the laugh rings.',
              'A small, clear, carrying voice, an adult\'s in everything but pitch.'
            ] },
          { key: 'own_scent', name: 'Own scent', weight: 3, endsAs: 'blossom and honey',
            stages: [
              'Sweat is fainter and sweet.',
              'Flowers and warm sugar.',
              'Smells of blossom and honey, stronger with the glow.'
            ] },
          { key: 'figure', name: 'Figure', weight: 8, sex: 'women', endsAs: 'a slight grown woman\'s figure in small',
            stages: [
              'The waist draws in as the frame slims.',
              'A narrow waist and a light curve of hip.',
              'Small high breasts on a fine frame.',
              'A slight, grown woman\'s figure in small: a narrow waist, light hips, small high breasts.'
            ] },
          { key: 'build', name: 'Build', weight: 8, sex: 'men', endsAs: 'a slim, beardless grown man in small, with tinted wings',
            stages: [
              'Body hair thins, and the beard stops.',
              'Smooth-skinned and fine-boned.',
              'Slim and lightly muscled; the wing veins darken and the wings take a tint.',
              'A slim, beardless, fine-boned grown man in small, with tinted, dark-veined wings.'
            ] }
        ],
      },
      woman: [
        { key: 'voice', name: 'Voice', weight: 8, endsAs: 'A woman\'s voice with the person\'s own phrasing',
          stages: [
            'The voice cracks upward on a word.',
            'The deep register is gone; the whole range sits higher.',
            'Lighter and clearer, with less chest in it. The lump at the throat has smoothed away.',
            'A woman\'s voice, with the person\'s own turns of phrase in it. Even the laugh is new.'
          ] },
        { key: 'face', name: 'Face', weight: 10, endsAs: 'The same face as a sister would have had',
          stages: [
            'Stubble comes slower and finer, then stops; the skin of the cheeks is smoother.',
            'Jaw and brow soften at the edges. Lips fuller, lashes thicker.',
            'Every plane a shade smaller and rounder: cheeks higher, chin finer, the eyes seeming larger.',
            'The same face as a sister would have had, beautiful in the type drawn for it, and still recognisable to anyone who knew it.'
          ] },
        { key: 'skin_and_hair', name: 'Skin and hair', weight: 8, endsAs: 'Fine soft skin, a full head of hair, no beard',
          stages: [
            'Hair on the chest, belly and back thins and lightens.',
            'Skin finer and softer; it bruises more easily and feels more.',
            'Arms and legs nearly smooth where the kind\'s coat has not come. Hair below the navel draws back from the line up the belly to a woman\'s neat triangle. Head hair thicker and growing fast.',
            'Soft, fine-grained skin that registers every touch, and a full head of hair.'
          ] },
        { key: 'frame', name: 'Frame', weight: 10, endsAs: 'Narrower shoulders, finer hands, the build drawn',
          stages: [
            'The shoulders ease inward; shirts hang looser there.',
            'Shoulders narrower by a hand; neck and arms slimmer; hands finer.',
            'A little shorter and lighter. Less strength in the arms than before, unless the kind is adding its own.',
            'A woman\'s frame at the height and build drawn. Old clothes no longer fit anywhere.'
          ] },
        { key: 'waist_and_hips', name: 'Waist and hips', weight: 12, paceWith: 'chest', endsAs: 'The figure drawn: waist, hips, thighs, rear',
          stages: [
            'The waist draws in a little.',
            'A softness at the hips and seat; clothes pull in new places.',
            'The pelvis itself widens, with a deep ache for days, and the walk changes to carry it.',
            'Thighs fuller, the seat rounder, the belly softer below the navel; the weight sits lower.',
            'Waist, hips, thighs and rear in the figure drawn.'
          ] },
        { key: 'chest', name: 'Chest', weight: 16, endsAs: 'Breasts of the size and shape drawn',
          stages: [
            'Tanner 1, the start. The chest is still flat. The nipples are tender and stay raised, with a deep itch behind them.',
            'Tanner 2, the bud. A firm, tender disc of tissue forms directly beneath each areola and lifts nipple and areola together as one small mound. The areolae widen and darken. They ache when knocked or jolted.',
            'Tanner 3. The tissue spreads beyond the areola into a small rounded breast. Breast and areola grow as one smooth contour, with no step between them. They move, and sleeping and dressing have to allow for them.',
            'Tanner 4. The areola and nipple swell forward into a second, smaller mound standing proud of the breast. The breast is fuller and more conical, the skin tight with faint veins. Cold, cloth and touch register more keenly now than at any other stage.',
            'Tanner 5, finished. The areola settles back into the curve of the breast, so that only the nipple stands out. Breasts of the size and shape drawn, rounded, settled and soft, with a weight of their own. The nipples take the kind\'s quality where it has one.'
          ] },
        { key: 'scent', name: 'Scent', weight: 4, endsAs: 'A woman\'s scent',
          stages: [
            'Sweat is milder.',
            'The skin smells warmer and sweeter.',
            'A woman\'s scent; any keen nose would say so.'
          ] },
        { key: 'balance_and_gait', name: 'Balance and gait', weight: 6, endsAs: 'Moves as the body it is',
          stages: [
            'Balance is off on stairs and when turning quickly.',
            'The stride shortens and the hips move; the arms carry differently around the chest.',
            'Moves as the body it is, without thought.'
          ] },
        { key: 'below', name: 'Below', weight: 14, tell: 'Told plainly, briefly and in private.', endsAs: 'A woman\'s, complete',
          stages: [
            'A drawing-in and a tightness; less weight there than before.',
            'Smaller and more sensitive by the day. The body\'s morning habit stops.',
            'Most of what was outward has drawn inward, with a tender fold where there was none.',
            'A woman\'s in form, new and easily overwhelmed.',
            'Complete and working; the body is a woman\'s throughout.'
          ] },
        { key: 'rhythms', name: 'Rhythms', weight: 12, needs: [{ track: 'chest', stage: 4, from: 3 }], endsAs: 'A woman\'s rhythm, by month or by season',
          stages: [
            'Feeling moves more freely; tears and laughter both come sooner.',
            'Arousal changes shape: slower to start, spread wider through the body, less in one place; touch registers more widely.',
            'A cycle begins: a few tender days and cramps, then the first bleed. In a kind with a season, the season takes its place.',
            'The body keeps a woman\'s rhythm, by the month or by the season; how it wants is new.'
          ] }
      ],
      man: [
        { key: 'voice', name: 'Voice', weight: 8, endsAs: 'A man\'s voice with the person\'s own phrasing',
          stages: [
            'The voice catches downward on a word, hoarse as a cold.',
            'The top notes are gone; the whole range sits lower.',
            'A lump at the throat that moves on swallowing, and chest in every word.',
            'A man\'s voice, with the person\'s own turns of phrase in it. Even the laugh is new.'
          ] },
        { key: 'face', name: 'Face', weight: 10, endsAs: 'The same face as a brother would have had',
          stages: [
            'The skin of the jaw is coarser, with a few dark hairs at the lip and chin if a beard is drawn.',
            'Jaw and brow firm at the edges; the cheeks lean out.',
            'Every plane a shade larger and harder: the nose stronger, the chin squarer. In the beautiful draw the lines stay fine and only the softness goes.',
            'The same face as a brother would have had, handsome or beautiful as drawn, and still recognisable to anyone who knew it.'
          ] },
        { key: 'skin_and_hair', name: 'Skin and hair', weight: 8, endsAs: 'A man\'s skin and hair, beard or bare as drawn',
          stages: [
            'Hair on the forearms and shins darker and coarser.',
            'Skin thicker and oilier, slower to bruise; a line of hair below the navel.',
            'Chest and leg hair as drawn, or none in the smooth draw; a beard coming in if one is drawn.',
            'A man\'s skin and hair in the type drawn, beard or bare.'
          ] },
        { key: 'frame', name: 'Frame', weight: 12, endsAs: 'Wider shoulders, heavier hands, the build drawn',
          stages: [
            'The shoulders push outward; shirts pull tight across the back.',
            'Shoulders wider by a hand; the neck thicker; hands broader, the knuckles heavier.',
            'A little taller. Arms and back carry muscle that shows, and the grip is stronger.',
            'A man\'s frame at the height and build drawn. Old clothes no longer fit anywhere.'
          ] },
        { key: 'waist_and_hips', name: 'Waist and hips', weight: 10, endsAs: 'A straight line from rib to thigh',
          stages: [
            'The waist thickens a little and straightens.',
            'The hips narrow, with a deep ache for days; clothes hang differently.',
            'Seat and thighs leaner and harder, the belly flat. The weight sits higher and the stride lengthens.',
            'A straight line from rib to thigh in the build drawn.'
          ] },
        { key: 'chest', name: 'Chest', weight: 14, endsAs: 'A man\'s chest, flat and broad',
          stages: [
            'Leaving Tanner 5. The breasts are tender, softer, and less full at the top.',
            'Tanner 4. Smaller and more conical, the areola standing forward of the shrinking breast.',
            'Tanner 3. A small rounded breast with the areola flush again, and the muscle beneath broadening.',
            'Tanner 2. Only a firm disc under each areola remains, and the areolae narrow.',
            'Tanner 1, finished. A man\'s chest, flat and broad as the build drawn, the nipples small.'
          ] },
        { key: 'scent', name: 'Scent', weight: 4, endsAs: 'A man\'s scent',
          stages: [
            'Sweat is sharper.',
            'The skin smells heavier and warmer.',
            'A man\'s scent; any keen nose would say so.'
          ] },
        { key: 'strength_and_gait', name: 'Strength and gait', weight: 8, endsAs: 'Moves as the body it is',
          stages: [
            'Things are lighter than expected, and force has to be judged again.',
            'The stride lengthens and the weight carries high, in the shoulders.',
            'Moves as the body it is, without thought.'
          ] },
        { key: 'below', name: 'Below', weight: 14, tell: 'Told plainly, briefly and in private.', endsAs: 'A man\'s, complete',
          stages: [
            'A fullness and heat; more sensitive, and growing.',
            'The monthly bleed lightens, then stops.',
            'What was inward begins to close, and what was small is outward now.',
            'A man\'s in form, new and unruly, answering without being asked.',
            'Complete and working; the body is a man\'s throughout.'
          ] },
        { key: 'rhythms', name: 'Rhythms', weight: 12, endsAs: 'A man\'s steadier rhythm',
          stages: [
            'Feeling sits further down; tears come harder and temper sooner.',
            'Arousal changes shape: quicker to start, more in one place, set off by sight.',
            'The monthly rhythm is gone and the days run level. In a kind whose men have a trait of their own, it starts here.',
            'The body keeps a man\'s steadier rhythm; how it wants is new.'
          ] }
      ],
      bond: [
        { key: 'ease', base: true, name: 'Ease', weight: 10, endsAs: 'At home with you, unguarded',
          stages: [
            'Polite distance: stands an arm\'s length off, and talk has gaps that need filling.',
            'Sits at the same table without it being arranged. Silences stop needing to be filled.',
            'Comes and goes from your space without asking, eats off your plate, falls asleep in your company.',
            'At home with you: unguarded, untidy, entirely themselves.'
          ] },
        { key: 'knowing', base: true, name: 'Knowing', weight: 12, endsAs: 'Knows your history and what you will not say',
          stages: [
            'Knows your name, your course and where you are from.',
            'Knows your habits: how you take your tea, when you go quiet, which chair is yours.',
            'Reads your mood before you speak and knows what helps.',
            'Knows your history, finishes your sentence, and knows what you will not say.'
          ] },
        { key: 'trust', name: 'Trust', weight: 14, endsAs: 'Would put their safety in your hands',
          stages: [
            'Takes you at your word on small things.',
            'Asks a small favour, and lends something that matters a little.',
            'Relies on you: expects you when you said, tells you where they are going, covers for you once.',
            'Lets you see them at their worst: ill, frightened, in the wrong. Takes your side in front of others.',
            'Would put their safety in your hands, and has. Expects the truth from you in return, even when it costs.'
          ] },
        { key: 'liking', name: 'Liking', weight: 12, endsAs: 'You are one of their people',
          stages: [
            'Pleasant when you meet.',
            'Glad to see you; saves you a seat; a running joke begins.',
            'Seeks you out, tells you things first, and after a few days apart says so sideways.',
            'You are one of their people, and your absence changes their day.'
          ] },
        { key: 'attraction', name: 'Attraction', weight: 12, endsAs: 'Steady desire, spoken or unmistakable',
          stages: [
            'Notices you: a look held a moment long. Everyone looks at the human; this is a different look.',
            'Looks when you are not looking, finds reasons to be near, and takes more care over their appearance when you will be there.',
            'Aware of you across a room. Flustered or bold by temperament, and the kind\'s tells give it away: ears, tail, scent, glow.',
            'Wants you and knows it. A touch lingers; jealousy is possible. Waits for a sign, or gives one.',
            'Desire that is steady, not a mood, and spoken or unmistakable.'
          ] },
        { key: 'touch', base: true, name: 'Touch', weight: 10, endsAs: 'Touch as the resting state between you', marks: { held: 4 },
          stages: [
            'None beyond accident and the kind\'s greeting.',
            'Casual: a nudge, a hand on your arm to make a point.',
            'Affectionate: leaning, a head on your shoulder, the kind\'s grooming (a collar straightened, hair preened, a cheek rubbed along yours).',
            'Held: hands, an arm round the waist, long embraces, falling asleep against each other.',
            'Touch is the resting state between you, and being apart feels like something missing.'
          ] },
        { key: 'intimacy', base: true, name: 'Intimacy', weight: 10, endsAs: 'Lovers', marks: { kiss: 3, bed: 4, lovers: 5 },
          stages: [
            'Nothing, and the thought may not have occurred.',
            'A charged moment that passes: a held look, a near thing, both careful afterwards.',
            'A first kiss, and after it kisses offered freely.',
            'Sharing a bed to sleep, undressing in front of each other, hands learning each other.',
            'Lovers. What it changes between you is told.'
          ] },
        { key: 'openness', base: true, name: 'Openness', weight: 10, endsAs: 'Has told you their private matter',
          stages: [
            'Surface talk: classes, food, weather.',
            'Opinions, family, small embarrassments.',
            'Fears, hopes, and the thing they want.',
            'Tells you their private matter, which is never stated before this.'
          ] },
        { key: 'standing', base: true, name: 'Standing', weight: 10, endsAs: 'Declared, with plans made in the plural',
          stages: [
            'An acquaintance, unmentioned to anyone.',
            'Named to their friends as a friend and included in plans.',
            'Acknowledged: their people know what you are to them, and they defend you when you are not there.',
            'Declared, in whatever word their kind uses: partner, mate, packmate. Plans are made in the plural.'
          ] }
      ],
    },
    thresholdsNote: 'each part of the body changes on its own track, one step told at a time; at 100 the kind may finish',
    species: {
      cow: { name: 'bovine mythkin', short: 'Bovine', race: 'Bovine mythkin', rate: 4, element: 'earth', method: 'dairy from the Creamery made by bovine students (milk, cream, their cocoa), long warm hugs, sleeping against them',
        ladder: [
          { at: 15, trait: 'a craving for milk and cream, and a slow warmth after eating',
            steps: ['the milk jug is empty; a faint milky taste remains, but how it happened is not clear', 'a warmth after eating spreads from the middle outward; its meaning is {first}’s to decide', 'the smell of the Creamery from across the quad, sweet and grassy, and the mouth watering', 'a slowness coming into the pulse, so that a queue is stood in and a late tram waited for without the foot tapping, and small things stop mattering', 'a pull toward a second glass before the first is finished, and cream seems to belong on a thing that did not take cream before', 'meat losing its appeal, and greens and grain filling the plate instead; a meal takes twice as long as it did', 'a glass of milk goes down the way water used to, without {first} noticing, and the warmth after it stays into the next hour'],
            anatomy: 'Nothing shows yet.' },
          { at: 30, trait: 'ears lengthen and soften; small horn buds under the hair',
            steps: ['an itch at the temples, two spots high on the forehead under the hair, tender to the comb like bruises', 'the ears feel heavy and warm and catch the draught; a sound to the left turns the left ear before the head', 'the hair at the temples has come in thick and the wrong colour overnight, and will not lie down', 'a low hum in the chest when content, felt through a shared bench before it is heard', 'under the hair two hard warm buds no bigger than knuckles, that hurt to press; a hat sits on them and a pillow finds them', 'the rims of the ears have gone soft and heavy and the tops are drooping; a pen tucked behind one falls out', 'the lashes grown long and thick, and the eyes in the mirror larger and turning {eye}; the edge of sight reaches further round, to the door at the side of the room', 'in the morning mirror the ears have lengthened and softened and hang a little, and they swing toward a voice in the corridor', 'the ears go where the attention goes and cannot be helped, with a small leathery sound; the buds are horns now, short and smooth, and no hat will sit over them'],
            anatomy: 'The ears: long, soft, set low, hanging and mobile, with a leathery sound when they move. The horns: two short smooth curves from high on the forehead, warm at the base, hard as bone.',
            sex: ['a softness coming into the face and the voice, the jaw going smooth', '{skin1}', 'a soreness behind each nipple that the shirt finds first: tight across the chest by evening and tender at the seam, eased by morning, and back again the next night', '{tanner2}'],
            women: ['the breasts fuller and heavier by the week, warm against the inside of the arm, the nipples tender and standing raised under the shirt, and a strap mark across each shoulder by evening where there was none'] },
          { at: 50, trait: 'a tufted tail; a broader, heavier frame; a slower, steadier gait',
            steps: ['an ache at the base of the spine that a chair makes worse, and a weight there by evening', 'reaching back, {first} finds a warm swelling at the tailbone; the waistband sits on it', 'the shoulders fill the coat and the sleeves ride up, the back and thighs thickening with muscle; heavier on the scales without looking it, and running warm; the stairs are slower and the ground more certain', 'rain smelt before it comes, and low sound felt in the chest: the bell tower, a cart on the pier road', 'a pause before any sudden movement, as if the body asks first; {first}’s hand goes to a door handle and rests there a half-second before it turns', 'the swelling is a stub with a tuft of hair at its end, and the waistband rides below it now; it flicks once on its own, and {first} goes still', 'fine hair along the backbone from the base of the spine, a narrow strip of short coat climbing the back in {first}\'s colour, found by the towel; a hand run along it is felt down the whole back', 'the stub is a tail by the third day, a rope of warm muscle as long as the forearm with a tuft at the end, its root tender to a touch; it swings on its own and the trousers do not close the way they did', 'the tail moves before {first} can still it, swishing with annoyance and lifting with pleasure before either is known; the frame in the mirror is broader, heavier and square, and takes up room in a doorway it did not, whose meaning is {first}’s to decide'],
            anatomy: 'The tail: a rope of muscle from the base of the spine, as long as the forearm, thin, with a tuft of coarse hair at the end, swinging and flicking on its own. The frame: broad in the shoulder, deep in the chest, heavy-boned.',
            sex: ['the hips taking width before the shoulders know it, so the trousers pull across the seat and gape at the waist', '{skin2}', '{rhythms1}', 'an ache across a chest that has begun to fill, and the bag strap moved to {first}’s other shoulder without a thought', '{tanner3}'],
            women: ['the nipples lengthening and thickening, darker by the week and catching on the inside of a shirt, and veins coming up faint blue under the skin of the breasts where it is thinnest'] },
          { at: 70, trait: 'cloven hooves and a new stance; patches of hide',
            steps: ['the toenails thicken and darken and will not cut; a sock wears through at the big toe in a day', 'a cramp in the feet like a night cramp that will not stretch out, the toes drawing together and the arches gone rigid', 'the shoes are a size too small by morning and the toes have begun to press together in pairs; the laces are loosened, and then the shoes are carried', 'standing on a hard floor rings up the leg; the heel wants to lift and resists coming down, the calves gone short and hard, and the weight wants to sit on the toes, so that balance is a thing to think about on the stairs', 'patches of skin at the shoulder and hip go numb, then warm, then coarse under the hand, and grow a short soft coat in {first}\'s colour; the backs of the ears take the same fine fur', 'the jaw working sideways when idle, and a mouthful coming back to be chewed again in the quiet after a meal, which settles the whole body', 'the two middle toes have fused and the nails have spread into a hard split shell over them; the outer toes are drawing up; barefoot is easier and colder, and the tiles are read through the soles', 'the front of each foot is a hoof now, black and hard, and the bulb behind it is soft and takes the weight; the small toes have ridden up behind the ankle as dewclaws; no shoe will go on and none is tried', 'the bones of the mid-foot have lengthened and drawn together, so the foot is markedly longer and the heel rides off the floor; from the side the leg seems to have a second knee bending backward, and it is the ankle; the hips and back shift to help', 'strong in the push and the carry and slow off the mark; a crate that took two people comes up in {first}\'s arms, and force has to be judged again', 'the feet have gone to hooves, cloven and black and polished, the toes fused and the heel lifted, and {first} stands taller on them and very still; the hide has come in over the shoulders and forearms, short and warm, and short sleeves do not hide it', 'hooves click on stone and are silent on grass; {first} has the new stance and stands square and steady where {they} used to fidget, and has learned the stairs again, toe first; the hide is a coat {first} wears all the time'],
            anatomy: 'The feet: cloven hooves, black and polished, two toes each in a hard shell with a soft heel bulb behind, the small toes gone up into the ankle, the ankle raised so the leg stands on its toes; no boot fits and none is needed. The hide: short dense hair over shoulders, upper arms, forearms and hips, in {first}\'s colour, with the skin beneath it thick and warm.',
            sex: ['the belly softening and the hips going broad, a weight settling low in the middle that the trousers do not like', '{gait1}', '{scent1}', 'the chest full now and the hips broad, and between them a waist that the belt finds a new notch for', '{tanner4}'],
            women: ['the udder beginning: a heaviness low on the belly, warm, that the hand goes to under the shirt and feels rounder each week, bare-skinned and tender to the lightest touch, and on it four teats coming up, small and soft, that the waistband finds before the mirror does'] },
          { at: 85, trait: 'the body fills toward the bovine shape, broad and heavy; a herd-sense for who is near',
            steps: ['a heaviness through the torso, warm and dragging, and the belly and hips filling out the clothes until a wrap makes more sense than trousers', 'a sense of the room behind {first}: who is there, how many, without turning; the nose running cool and damp at the tip', 'the sweat gone milder and sweeter, settling into a smell of warm hide and hay that is the herd\'s and is now a smell {first} has and can find on {themself}; the mood of a crowded room read by nose before a word is said, and a sharp sudden noise hard to bear', 'the voice deeper and softer, and a long low note that comes when calling across the quad or when upset', 'the nose has broadened and softened at the tip, the skin there smooth and darker, cool and damp to the touch, the nostrils wider and the lips fuller; the eyes have gone {eye}, slow to blink, in a face that is {first}\'s own around them', 'unsettled alone and eased by touch, a hand on the back, a shoulder leant; pushed, the body sets its weight and stays where it stands', 'the fingers moving in pairs, first with second and third with fourth, and resisting being spread, the skin between each pair gone tight; the grip strong and clumsy, so that a pen is held like a spoon and fine work has to be learned again', 'an ache across the knuckles for a week and the nails gone thick and dark, and then the fingers have drawn together in pairs and their nails spread into hard shells, so each hand ends in two broad hoof-fingers, and the thumb has hardened into a third, smaller hoof that still closes against them; a pen sits in the crook of the thumb and a cup is held fine, and what {first} makes of the new hands is {theirs} to decide', 'the body has gone over to the bovine shape, broad in the shoulder, hip and belly, heavy and warm and plainly not human, and the face is {first}\'s; {first} knows who is in the room the way a herd does, and the Creamery folk have found {them} a wrap'],
            anatomy: 'The finished shape: upright and human-faced, with a broad dark nose that is not quite a human nose; eyes {eye}, slow to blink; long soft ears set low, that swing to a sound; short curved horns; hide over shoulders, arms, back and belly; hands of three hooves each, two broad hoof-fingers and an opposable hoof-thumb that closes against them round a cup, a pen or a hand; cloven black hooves that click on stone; a tufted tail that moves on its own.',
            sex: ['{genitals}', '{tanner5}', 'the bovine woman\'s shape, complete: full at the hip and soft through the belly, the udder low and heavy and warm with its four teats, the breasts full above it, and in the mirror a woman\'s face that is still {first}’s; no trousers close over any of it now, and the wrap the Creamery folk found does'],
            women: ['a fullness and tightness in the udder late in the day, and a lesser one in the breasts, that becomes pressure and then an ache eased by warmth and a hand', 'milk: a bead of it at a nipple in the shower, then at the teats, white against the hide and rinsed away, let down by warmth, touch, arousal or strong feeling, and a heavy calm after; the breasts full and veined with long thick nipples, and by midmorning the cloth over each nipple is damp', 'the udder filling through the day and wanting emptying morning and evening, the breasts giving a little; left too long it means soreness, weight and a short temper, and whether the milking is private or shared is {first}’s to decide'] },
          { at: 100, trait: 'fully bovine mythkin: horns, hooves, a broad and steady frame',
            steps: ['the horns have their full curve and feel a touch at the base, and the first low doorway of the morning teaches the head a new angle', 'a warmth through the middle that does not leave, a body slow to start and hard to stop and tireless under a load, and a slower, steadier step that arrives everywhere a little later and unhurried', 'the hooves loud on the flagstones and sure on the scree; the ears droop when tired and flick when bothered, and stroked they bring a deep heavy calm', 'the last bare patch of skin, at the small of the back, has gone under hide, found by the hand in the shower; at the Creamery people lean a shoulder on {first} in passing, the way they lean on each other', 'bovine from horn to hoof: tall and warm and horned, upright and {first}-faced in the mirror, the ears turning to the corridor before the door opens'],
            anatomy: 'As above, complete.' }
        ],
        habits: ['the smell of milk and cream arriving before the food is seen', 'a slower, steadier pace on stairs', 'weight settling squarely over both feet when standing', 'warmth registering first when touched', 'sun warming the hide', 'sleep coming deeply, with hunger on waking', 'chewing slowly and for a long time, and drinking a great deal', 'leaning a shoulder on whoever is nearest, and being leaned on', 'a hum of contentment that is felt through a shared seat', 'going where the group goes, and slow to hurry', 'a flinch at sudden movement at the edge of sight, which reaches nearly all the way round now; close print held a little further off', 'sleeping best touching someone, and badly in a room alone'],
        noticed: ['the Creamery calves lean on {first} through the rail as if {they} {were} one of theirs, and in a queue {first} stands a half-step nearer the person in front than anyone else does', 'the Mews goats come to the fence for {first} and nobody else', 'the Creamery folk greet {first} with a shoulder leant in passing, the way they greet each other'],
        gone: ['the floor a long way down again; the room cold in a way it was not; a hunger that does not know what it wants'] },
      wolf: { name: 'werewolves', short: 'Wolf', race: 'Werewolf', rate: 4, element: 'moon', method: 'running with the pack at dusk, sharing their meals, sleeping in the pack pile, a playful nip or scratch (which they consider forward)',
        ladder: [
          { at: 15, trait: 'a sharper nose and better night vision; restlessness at dusk',
            steps: ['the dining hall arrives in layers: onions, wet wool, somebody\'s soap, and under it a smell {first} has no name for that turns out to be the werewolf two tables down', 'the corridor at night is not as dark as it was; {first} finds the light switch and realises {they} did not need it', 'running warm, always one layer too many; the blanket is kicked off by midnight and the coat left on its hook', 'at dusk the legs want the door, the way they want it before a storm; sitting through the hour is work', 'being alone is louder than it was, and sleep comes easier with someone breathing in the next bed', 'a smell crosses the room and {first} turns to it before anyone has spoken, and catches {themself} doing it; the page is readable with the lamp off', 'sleep lighter as the moon fills, and the window found open in the morning with no memory of opening it', 'the nose is a fact now: rooms have a weather of their own and people arrive before they arrive; {first} has stopped switching lights on and did not notice stopping, and dusk is the best light there is'],
            anatomy: 'Nothing shows yet: the eyes are {first}\'s own with a shine in low light; the nose is still a human nose, only wiser.' },
          { at: 30, trait: 'canines lengthen; hair thickens; ears move up and point',
            steps: ['a canine catches the inside of the lip where no tooth used to reach; it looks unchanged, but the gum around its root is tender', 'a ring of {eye} at the edge of the iris, spreading inward, and in the dark the eyes throw the lamplight back, caught once in the window glass; the brush snags on coarser hair above the ears', 'the tongue runs the upper canines and finds them narrowing toward their points; high on the sides of the head an itch starts under the hair that no nail reaches', 'a low sound in the chest when annoyed, there before any word, that {first} hears from inside; the rims of the ears go numb and then tender, as after cold', 'the lower canines begin to sharpen to meet the upper pair, which catch the lip now and then on a word; the ears feel higher under the hair, and a hat sits wrong', 'the upper canines stand past the teeth beside them and the lower pair have come to points; the ears sit higher, their tips just beginning to fur, soft to a fingertip', 'both pairs of canines are longer and more tapered, the bite stronger and the jaw muscle standing at the hinge, and {first} bites an apple differently now, from the side; the ears swing toward a sound before the head turns', 'the canines are plainly pointed, the upper pair reaching the lower lip when the mouth closes; the ears are up and furred at the tips, and the pillow finds them at night', 'the canines are nearly their final length and curve, but still fit behind the lips when the mouth rests; a voice down the corridor reaches the ears first, and they have gone to it while the eyes are still on the page', 'the teeth have settled into long, sharply tapered wolf canines, the upper pair resting just beyond the lower lip at rest, and the back teeth shear; a careful bite can hold without breaking skin; the ears are high, pointed and mobile, the hair above them coarse'],
            anatomy: 'The ears: set high on the head, furred, pointed, mobile on their own muscles, the hair coarse and thick above them. The canines: long, narrowing to a point, resting outside the lower lip when the mouth is shut.',
            sex: ['the jaw softening, the line of it going smooth under the hand', '{skin1}', 'the voice sitting a note higher and cracking on it, once, in the dining hall', '{tanner2}'] },
          { at: 50, trait: 'a tail; a growl under the voice; pack loyalty; the moon pulls',
            steps: ['an ache at the base of the spine, low and centred, the kind that comes from sitting wrong, except it is there standing too', 'a chair is uncomfortable in a new way, its hard edge exactly where the ache is; by the second lecture the body has moved forward onto the lip of the seat', 'reaching back, the hand finds a lump at the tailbone, warm, with a pulse in it; the waistband sits on it', 'a low note under the voice, felt in the chest before it is heard; the growl comes on purpose now, and a whine that does not, and the speaking voice has a rougher low edge', 'a line of gooseflesh down the spine that comes with anger or cold and stays a moment after it should have gone', 'the lump is a stub by evening with small loose bones moving inside, and trousers have a problem; it moves once on its own and {first} freezes', 'the moon through the window is a pull in the sternum, faint and directional, like a hand flat on the back', 'the tail is the length of a hand, then a forearm, furred and damp-crimped as if just unfolded; it carries real weight and the hips answer it in walking; it will not be sat on, and the seam of every pair of trousers is a decision', 'the nights around the full moon: wakeful, restless, strong, quick to anger and as quick to laugh, the stairs taken two at a time, and a howl in the throat that must be let out sometimes and carries a long way', 'the tail lifts, tucks and wags on its own, before {first} has decided what it means, and stroked along the lie it is felt up the whole spine, the root the most sensitive place on the back of the body; the Moonrunners are people {first} counts into a room'],
            anatomy: 'The tail: a continuation of the spine, as long as the forearm at first and longer later, thick at the root with its own muscle, furred in {first}\'s colour with a lighter underside; it lifts, swings, tucks and thumps on its own, and lies along the leg when {first} sits forward.',
            sex: ['the trousers tight across the hips and loose at the waist, so the belt finds a new hole; the hips take the stairs a little differently', '{skin2}', '{rhythms1}', 'a tenderness across the chest that the bag strap finds on the stairs; the shirt begins to hang differently over a chest that has started to fill', '{tanner3}'] },
          { at: 70, trait: 'the feet become paws and the stance tips forward; fur along the arms and spine; claws',
            steps: ['the toenails and fingernails have thickened at the root and grow to a blunt point however short they are cut; a sock catches on the big toe and ladders', 'the shoes pinch at the toe box by evening, where they never did, and the toes want to spread inside them', 'a cramp in the arch on the stairs, and a heel that wants to lift off the ground and stay lifted for a step or two', 'the skin of the forearms itches from inside, a fur pushing out that cannot be scratched, and the sleeves are suddenly too warm', 'fine hair along the backbone from the base of the spine, coarser and climbing by the week, that rises by itself when something startles', 'the pads: four soft swellings under the toes and one under the ball of the foot, tacky, that take the floor a half-second late, and the sole behind them gone soft and tender from disuse; barefoot on the tiles, {first} can feel every crumb', 'the little toe is drawing up the side of the foot toward the ankle, and the four that are left have lengthened; the shoe goes on this morning and comes off at noon', 'the nails are claws now, dark and curved, that click when {first} walks; the forearm pelt lies flat to the wrist, velvet one way and coarse the other, and pads come through on the palms, reading pressure and warmth before texture; fine grip has to be relearned', 'the hair of the shins denser from the ankle up, in the coat\'s colour, with an undercoat beneath that itches as it comes in; by the month\'s end a coat to the knee and over the top of the foot, lying downward, that cloth drags against', 'stronger than the frame shows and hot to the touch, so a jar lid gives too easily and a handshake has to be judged again', 'the heel does not come down: {first} is up on the balls of the feet and the tendon at the back of the leg refuses like a rope pulled to its end; the shoes are finished, all of them; balance wants to tip forward and stay there, ready', 'walking was learned again in a day, and running is better than it ever was, half a mile further before the breath gives out; the claws are kept flat by habit and click when {first} forgets; bare paws are the only feet now, and the grit of the lime path is information'],
            anatomy: 'The feet: four toes, long and furred, each with a pad and a dark curved claw, the fifth drawn up the inside of the ankle into a dewclaw; a big pad under the ball; the heel raised and never down, so the visible joint is the ankle and {first} stands an inch taller and forward; fur to the knee. The hands: human in shape, pads at the base of the fingers and the heel of the palm, claws for nails. The pelt: forearms to the wrist and the spine to the small of the back.',
            sex: ['the shoulders narrowing and the hips widening in the same week, so a shirt that fitted hangs wrong at both ends', '{gait1}', '{scent1}', 'the breasts small and tender, so that a fold of shirt across the chest is felt all afternoon, and face-down in bed the mattress finds them', '{tanner4}'],
            women: ['{teats}, a pair at a time: tender points on the ribs under each breast, like pressed bruises, then small flat discs of darker skin; a second pair lower, toward the navel, and the upper pair risen into small true nipples that tighten with the first in the cold', 'a few days, months apart, of running too warm, short-tempered and easily moved, with no cause found, and then a shape to it: warmth low in the belly, skin that answers every touch, broken sleep and a stronger scent that the wolves nearby read; it comes about twice a year for a week, and what {first} does with it is {theirs} to decide', 'at the season\'s height the body runs hot, the skin answers every touch and sleep comes in snatches; what {first} wants of it is {theirs} to say; it passes and leaves {first} clear-headed and hungry'] },
          { at: 85, trait: 'the last of the pelt closes over back, belly and legs; the nose goes dark and wet, the canines long; the face stays your own',
            steps: ['the skin of the back and belly itches from inside for a day and the shirt is unbearable; {first} sleeps on top of the blanket', 'the nose is cold and wet when the back of the hand touches it by accident, and the world arrives through it twice as loud: scent first and sight second, a trail hanging in a corridor for hours, a person known blind by it and missed by the smell they leave behind', 'the ears, tall and furred outside and in, flatten and prick with feeling and cannot be stopped; rubbed at the base, the whole body leans into the hand', 'the pelt has closed over back, belly, thighs and hips, thicker on the outer thigh and short and fine on the inner, so that clothes sit on fur now and not on skin; touch through it arrives slower and warmer and spreads, and under it the body is a furnace', 'the sweat warmer and muskier, washing covering it only briefly, and then a settled smell of {first}\'s own, warm fur and outdoors, that the pillow and anything handled keep and that keen noses read as wolf, with the mood in it', 'the ruff along the spine stands at a raised voice and lies flat under a calming hand; stroked downward it settles the whole body', 'the canines rest against the lower lip when the mouth is shut and the tongue keeps finding them; the skin at the tip of the nose has gone dark and taken a fine pebbled grain, the nostrils flare wider and move when scenting, and the bridge is a shade broader', 'in the mirror the face is still {first}’s: the same eyes gone {eye}, the same mouth with too much tooth in it, a dark wet nose above it; the pelt comes up the throat, thinner there, so every collar sits on fur now, and the changed features are plain to see'],
            anatomy: 'The finished shape: upright, human-faced, wolf-eared; eyes {eye}, round-pupilled, with a shine in low light; a dark wet nose; canines long enough to show when the mouth is shut; the pelt over back, belly, arms and legs, thinner at the throat and the inside of the arms; pads on the palms and claws for nails; paws, four-toed with a dewclaw at the ankle, the heel carried high; a long furred tail, lighter beneath, that moves on its own.',
            sex: ['{genitals}', '{tanner5}', 'a woman\'s shape now, entire: narrow through the waist and set wider at the hip than at the shoulder, the breasts bare above the pelt of the belly; in the mirror a face that is {first}’s and a woman\'s'] },
        ],
        habits: ['meat before bread at breakfast, and {first} notices only when the plate is empty', 'a shorter temper at dusk and an easier one after a run', 'sitting with the back to a wall, facing the door, without having decided to', 'sleeping curled, and waking at every footstep in the corridor and knowing whose it is', 'noticing who is missing from a table before anyone has said', 'a whole-body shake when wet, done before thought', 'turning once before lying down, and a long low stretch on waking that goes from the fingers to the toes', 'going still all at once when something moves at the edge of sight, the head turning before the eyes', 'reading a mood off a person by smell before they have spoken: fear sour, anger hot, wanting warm and sweet', 'a bark of a laugh, and a low growl of contentment close to that is felt as much as heard', 'rare is right, then rarer, and the fat and the marrow are the best part; meals are bolted, and a hand reaching toward the plate is watched before manners catch up', 'a loose forward lean in walking, the head turning to track; crouching as easy as sitting, and play is a bow and a shove', 'sitting closer and touching in passing; a stranger\'s tone toward one of the pack raises the hackles, a challenge is a held stare, and making up is physical'],
        noticed: ['the Beastcraft familiars go quiet and watch {first} cross the Mews; a wolf mythkin\'s nose lifts as {first} passes and says nothing', 'a dog on the pier road backs off, then comes to heel; the cat mythkin in the library move their ears and not their eyes', 'the wolf mythkin scent {first} in passing, a greeting and a reading at once, and in the pack pile a place is left'],
        gone: ['quiet where the room\'s smells were; a corridor that is dark again; the base of the spine light and strange, like a missing tooth'] },
      harpy: { name: 'harpies', short: 'Harpy', race: 'Harpy', rate: 4, element: 'air', method: 'accepting and wearing a harpy\'s gifted feather, being preened, roosting overnight in the Aerie, singing with them',
        ladder: [
          { at: 15, trait: 'a lightness in the step and an urge to perch on high things; humming without noticing',
            steps: ['the stairs are easier than they were; the legs can take the last three at a jump', 'a tune under the breath that {first} did not start and cannot place, and somebody says that is the Aerie\'s song', 'an itch to be higher: the eye keeps going to the sill, the top step, the wall by the gate, and the legs are ready for the climb whether or not it is taken', 'the back of a chair looks like a seat now, and if it is tried it takes {first}’s weight without tipping, the feet finding the rail by themselves; the seat is still there, if wanted', 'the hum is there most mornings now, and the body wakes lighter than it lay down; the top step offers the whole quad in one view, and the legs want the way down as three steps and a jump'],
            anatomy: 'Nothing shows yet.' },
          { at: 30, trait: 'down at the nape and collarbones; keener eyes',
            steps: ['an itch at the back of the neck under the collar, and the collar catching as if the skin had grown a nap', 'a softness at the collarbones under the fingertips, like the skin of a peach', 'the far shore of the lake comes into a focus it should not have; small print is easy and the glare gives headaches', 'a ring of {eye} at the rim of the iris, widening inward by the week and caught once in the window glass; a face can be read from across the quad', 'the collar rubs the wrong way at the nape, and when the shirt comes off there is a fine grey down along the collarbones, soft as a chick\'s, that the fingertips keep going back to; a scarf is worse', 'the down has reached the temples and the shirt collar is left unbuttoned; a sneeze sends a wisp of it floating', 'the down is under every collar and {first} has stopped wearing collars; across the quad {first} can read the bell tower clock and count the harpies on the ledge feather by feather, and is the one who sees the ferry first'],
            anatomy: 'The down: fine, soft, grey, at the nape, the collarbones and the temples. The eyes: gone {eye}, sharp to a mile.',
            sex: ['a softening along the jaw that the razor notices first; the voice going higher and truer, and holding a note on the stairs that it could not hold a month ago', '{skin1}', 'the shoulders narrowing, so the shirt seams fall short of the shoulder and a jacket hangs from the collar as from a hook', '{tanner2}'] },
          { at: 50, trait: 'feathers along the arms; hollow-light bones; the voice finds new notes',
            steps: ['pinpricks along the forearms, a hundred small pressures from inside the skin, and an itch that cannot be reached', 'a row of small hard points has come through the skin of the forearm, each with a nerve in it; a sleeve dragged over them is a mistake made once', 'the body is lighter than it should be on the stairs, and the wind on the cliff path takes more of it than it used to', 'a note in the shower that {first} did not know {they} had, high and clear, and another above it; whistles and trills come by themselves, and a tune heard once comes back exactly', 'the points have opened into pins, then into soft down and small pale feathers with the sheath still on, that {first} picks at without meaning to; the bathwater is full of grey flakes', 'the feathers have opened along both arms in rows, small and pale and stiff-shafted like a fledgling\'s; sleeves are cut off at the elbow or not worn; the scales in the medical centre say less than they should', 'the feathers are laid and glossy, with feeling at every root, and {first} preens them without thinking, drawing each through the fingers or the lips to set it; a hand smoothing them the right way settles the whole arm, and the choir has heard the voice'],
            anatomy: 'The arms: feathered along the forearms in rows, the feathers small and stiff-shafted, each rooted in a nerve. The bones: hollow-light; {first} weighs a third less than {they} look{s}.',
            sex: ['a tenderness in the chest that leaning on a desk finds, and under it the breasts filling; the hips taking width, and the trousers that hung loose in the spring catch at the seat on the climb to the Aerie', '{skin2}', '{rhythms1}', 'a waist coming in between chest and hip, so the belt goes to a new hole, and the shirts that fit now are the harpies\' shirts, with no sleeves at all', '{tanner3}'],
            women: ['an itch at the breastbone that the fingertips find as down coming in, fine and short, between the breasts; a stripe a finger wide by the month\'s end'] },
          { at: 70, trait: 'the arms become wings, each ending in a hand with talons for fingers; talons at the toes',
            steps: ['the toenails thicken to points and darken; socks catch and ladder, and the shoes pinch at the toe box by noon', 'a deep ache along the upper arms and across the shoulder blades, bone lengthening in the night, and sleeves too short by morning; the chest muscles ache too, as after a climb that was not made', 'the toes cramp and curl and will not straighten in the shoe; by evening the walking is on the balls of the feet and the heels of the shoes are empty', 'the skin of the shins goes dry and tight and cracks into small scales that catch on the sheets; the shoes come off in the corridor and stay off', 'the arms want to open in the wind, and on the cliff path they lift from the sides before {first} has decided anything about it; the shoulders turn further than they did, and a doorway is taken half sideways', 'the fingernails have thickened and darkened and curve at the tip, catching on wool; a pen is held differently, and a railing taken in passing is gripped harder than meant and shows it', 'the outer toes have drawn round and one has gone to the back of the foot; the nails are horn now, grey and ridged, and the foot grips the edge of the step by itself before the weight is on it', 'long quills have started along the back edge of the arm from shoulder to hand and run past the fingertips by the week; the arm is longer and lighter than it was, and a sleeve is out of the question', 'the flight feathers have come: long, laid over one another from the shoulder down the whole arm, and the hands are still there at the end of each wing, four fingers and a thumb, cool and dry, the nails gone to black talons, curved, that close on a rail before the hand is told to and leave marks in it; at rest the arms fold to the sides on their own', 'the feet have gone to talons, grey and scaled, three toes forward and one back, that grip the edge of the step and click on stone; the legs are scaled from the knee and bend a little differently; sleeves are over and shoes are over', 'the wings fold to {first}’s sides by habit and open on the ledge when the wind comes round; {first} perches now, the talons locking round the bar so that sleep is had standing, and on the Aerie a ledge at the end of the row has been left empty'],
            anatomy: 'The wings: the arms themselves, feathered from the shoulder, long flight feathers laid like roof tiles, folding tight to the side; a hand kept at the end of each wing, four fingers and a thumb, dry and cool, each finger ending in a black talon, curved, for gripping. The legs: scaled from the knee, backward-jointed, ending in talons of three toes forward and one back, horn-grey, ridged, that grip and click.',
            sex: ['the breasts coming in small and high on the light frame, and the waist and hip going to a woman\'s line, so the trousers that caught at the seat in the spring are taken in at the waist', '{gait1}', '{scent1}', '{tanner4}'] },
          { at: 85, trait: 'plumage colours in and the harpy shape settles: light-boned, long-legged',
            steps: ['colour coming into the feathers from the shaft outward, a warmth in them in the sun, and rain that beads and runs off; along the ribs, where wing meets body, small feathers have come in that lie flat toward the hip', 'hard points among the hair at the crown, then small feathers through it that rise with surprise and will not be combed down; the eyebrows going to small hard feathers', 'the frame has gone light-boned and long-legged, and the hips sit higher; light enough for a friend to lift without effort, and bruising more easily for it; a chair is a perch and a bed is for the wings to hang off', 'a smell of {first}\'s own that the pillow keeps: warm feathers and dust, dry and clean, like a sun-warmed loft; sweat is faint now and does not stay', 'the down at the temples and nape has coloured to match, and the crest lifts and flattens with every feeling before the face has shown it; in the mirror the face is {first}\'s own under it', 'the plumage has coloured in and shines when the shoulders turn; {first}’s old shoes have no foot left to fit, and on the ledge the harpies make room without looking up'],
            anatomy: 'The finished shape: human face and mouth; a crest and small feathers for eyebrows; down at the temples and nape; arms that are wings, each ending in a hand with talons for fingers; scaled legs from the knee with talons; plumage in one colour.',
            sex: ['{genitals}', '{tanner5}', 'a woman\'s body entire: light in the bone and long in the leg, the breasts small and high with the line of down between them, the hips set higher than they were and the waist narrow; last, in the mirror, a face that is {first}’s and a woman\'s'] },
          { at: 100, trait: 'harpy: flight, roost-sense, a song that carries',
            steps: ['the wind under the wings is a floor; on the ledge the wings open by themselves and the body leans into it, and one hard downbeat takes the feet off the stone for a breath', 'the roost sits in the chest like a compass, every harpy on the Isle a direction', 'the first drop off the ledge is a fall and then it is not; the Isle turns under {first}, small and green, and the wings know what to do', 'a wing comes round a friend\'s shoulders where an arm used to go, and is a warmer thing than an arm; a day kept indoors sits in the shoulders as an ache, and the wings open on the stairs for the sake of opening', '{first} flies: off the Aerie ledge into the cloud-wind, wings out and working, and lands on the bell tower with the others, breathless; the song carries across the whole campus, the roost answers it, and on the quad people look up'],
            anatomy: 'As above, and the sky.' }
        ],
        habits: ['a tune forming under the breath without noticing', 'the body balances easily on narrow or elevated surfaces', 'hunger arriving in smaller, more frequent waves', 'cold registering sooner, the light frame quick to chill', 'the legs flexing lightly on stairs', 'the head tilting to look at a thing, one eye and then the other; the hands going to a friend\'s hair or collar to set it right, caught halfway and turned into a question', 'a song at first light, before {first} is properly awake, that the Aerie answers', 'uneasy in a low closed room and easiest high up with others of the roost within call; when autumn turns, a restlessness that points somewhere'],
        noticed: ['the Aerie harpies stop mid-note when {first} comes in, then go on; a crow follows {first} across the quad at the height of the second-floor windows', 'a harpy tilts her head at {first} the way birds do, and preens a feather of her own'],
        gone: ['a heaviness in the arms and the step; the sill is only a sill; the hum will not come'] },
      goblin: { name: 'goblins', short: 'Goblin', race: 'Goblin', rate: 4, element: 'metal', method: 'wearing goblin-made charms against the skin, their spiced food and green tea, a bargain signed and sealed, favours traded',
        ladder: [
          { at: 15, trait: 'a taste for spice and sour; quick hands',
            steps: ['the plain food at dinner tastes of nothing and the pickle jar at the end of the table is suddenly the point of the meal', 'a dropped fork caught before it lands, and {first}\'s hand back on the table before {they} {have} thought about it', 'the fingers want something to do: a pen taken apart and put back, a coin walked over the knuckles', '{first} has eaten the whole dish of green pickles that nobody else touches and is looking for more; the cook has noticed', 'the salt is passed over for the chilli oil without a thought, and a coin that was in the pocket is on the table and back in the pocket again; the hands are quick and busy and never quite still'],
            anatomy: 'Nothing shows yet.' },
          { at: 30, trait: 'ears grow long and pointed; a green tinge at the fingertips',
            steps: ['the tops of the ears itch and are tender and catch on the pillow; sounds from the arcade stair arrive clearer than they should', 'a coolness at the fingertips that is not the weather, like the touch of a coin, and the nails growing fast enough to be trimmed twice in a week', 'the fingertips look bruised in the morning and are not sore; by evening they are the green of a new leaf to the first knuckle, and a ring sits differently', 'the ears have grown by a finger\'s width in a week and the tips have gone to points; a hat sits high and a pillow finds them', 'the ears lift, on their own, toward a bargain being struck across the room, and {first} catches the movement in a window', 'the ears reach past the top of the head when they lift and droop when the mood does, the tips tender to a touch and going green at the rims; the green is at the knuckles and the nails have gone hard and dark', 'the ears give {first} away at cards, lifting at a good hand before the face can hide it; the green is {first}\'s to the second knuckle, plain against the white of a cuff'],
            anatomy: 'The ears: long and thin and pointed, standing past the crown when they lift, turning on their own to a sound, warm to the touch. The hands: green to the second knuckle, the nails hard and darkening.',
            sex: ['the voice coming out lighter and quicker than it used to, a sentence finished before the breath that started it is spent; the jaw, under the fingers at night, softer along its line', '{skin1}', 'the chest heavier by a little at the end of the day, so that a shirt buttoned to the top is undone a button by evening and done up again next morning; the trousers, which fit at the waist, have gone snug across the hips', '{tanner2}'] },
          { at: 50, trait: 'teeth sharpen; green spreads up the arms; a nose for a deal',
            steps: ['an ache at the root of every tooth for a week, then a tooth that has gone to a point and catches the lip; the tongue counts the teeth at night and gets a different number', 'the green climbing the forearms like a tide, a little higher each morning, and the skin there taking a faint leaf-sheen', 'the fingers a joint\'s width longer and the knuckles looser, bending back further than they did; the nails hard and dark and good for prying, so a stuck lid or a knot comes undone in the hands without being looked at', 'a fair price and a bad one have different smells, the one like clean brass and the other like a coin left in a wet pocket; the market has them both, at every stall', 'the words come faster than they did and the voice has roughened at the edges; a laugh gets out as a cackle, once, and heads turn at the table', 'the front teeth have gone to points too, and an apple is eaten in small bites from the side now; a smile in the mirror is tried, and looked at a while', 'the tongue finds no flat tooth left anywhere, and in the mirror the smile is a goblin\'s smile, small and pointed all the way back; the arms are green to the elbow, the line of it sharp as a sleeve', 'meat comes off the bone cleanly now and bread is torn, not bitten; the green has reached the shoulder, the whole arm one colour under a rolled sleeve; at the market {first} hears the wrong price in a voice before the number is said'],
            anatomy: 'The teeth: small and pointed, every one. The skin: green from the fingertips to the shoulders, with a faint sheen like a leaf.',
            sex: ['weight settling to the hips, so that a belt rides on them now where it used to sit straight and the trousers pull across the seat; the chest has begun to fill and is tender under a bag strap by the end of a day', '{skin2}', '{rhythms1}', '{tanner3}'] },
          { at: 70, trait: 'stature shortens into wiry strength; the eyes change colour and slit; the feet go wide and bare',
            steps: ['a tiredness in the legs at the end of a day, as after a long walk that was not taken; the trousers are long in the leg and were not, and the top shelf is a reach now', 'an ache in every long bone, drawing in the way growing pains draw out; a strength in the hands that bends a spoon by accident and hangs from a door frame without tiring', 'the morning light comes in sharper than it did and full sun on the quad brings a squint that shade undoes; the lamp is turned down a notch, then another, and the last hour of the evening is read through without it', 'the shoes are loose at the heel and then too long; the feet have gone wide and flat and green to the ankle, and the toes spread in the shoe and grip the boards; socks are bunched at the toe and then not worn', '{first} is shorter by a hand and then by a head, the proportions still an adult\'s, with a low centre of weight and a quick short stride; the wardrobe rail is out of reach and the bed is long; the hems are turned up twice', 'the toes have gone long and hooked at the tip, with dark hard nails, and take the stairs like hands and pick a dropped coin off the floor; the shoes stand by the door, and stay there', 'a brightness in the eyes that the lamp finds, so that the mirror throws two points of light back; the eyes have gone {eye}, with pupils that narrow to slits in the light and open wide in the dark of the arcade, where the far stalls are as clear as the near', 'the world is at a goblin\'s height: the shelf {first} keeps a stool for, the cuffs rolled back to the elbow; the hands lift what they could not, and the feet, bare and wide, take the stairs three at a time'],
            anatomy: 'The frame: shorter by a head and more, wiry, strong in the hand. The eyes: {eye}, slit-pupilled, giving back the lamp. The feet: bare, wide and flat, five long toes hooked at the tips, with dark nails, that grip a stair or a rung; no shoe fits them.',
            sex: ['the frame going slight as the height goes, the shoulders narrowing to meet the hips, so that a waist appears between them; the breasts, small yet, lift the front of the shirt even at rest', '{gait1}', '{scent1}', '{tanner4}'],
            women: ['the green reaching the breasts, the last pale skin on them going over in a week, so that in the mirror they are the colour of the hands and the nipples a darker green than the rest; the frame going small takes a little of their size with it and leaves them full for the frame'] },
          { at: 85, trait: 'goblin features settle; a habit of counting everything',
            steps: ['the nose feels larger to the fingers before the mirror agrees, then is longer by a knuckle, sitting at the bottom of the eye\'s view where it was not, the face drawn narrower round it and the mouth a little wider; a ridge of small bumps down the spine that the fingers count lying in bed', 'a new place in each finger where it bends, felt first as an ache like a knuckle cracked, then used without thinking: a screw turned without lifting the hand, a knot tied inside a box; fine work that was impossible is easy', 'the count running under everything: steps, coins, tiles, breaths', 'a smell of {first}\'s own that the pillow keeps: sweat that smells of metal at first, then oil, hot metal and damp earth, the smell of a workshop', 'the last of the old colour goes from the belly, a pale island in the bath one week and gone the next; the skin is green everywhere, palest on the belly and darkest at the ear tips, with the leaf-sheen in every light, the lips a shade darker still, and the body hair below the brows thinned away', 'the face in the mirror is a goblin\'s and {first}\'s: long-nosed, wide-mouthed, sharp, green, slit-pupilled, all small teeth when it smiles, on a frame small and fully adult in every proportion; {first} counts the stairs and knows the number, and the stallholders in the arcade nod to {them} as to one of the clans'],
            anatomy: 'The finished shape: small and wiry; green throughout, with a sheen like a leaf; long pointed ears that turn on their own; a long nose; eyes {eye}, slit-pupilled, giving back the lamp; teeth small and pointed, every one; fingers with an extra joint and dark hard nails; a ridge of small bumps down the spine; bare wide feet with hooked toes that grip.',
            sex: ['{genitals}', '{tanner5}', 'a woman\'s body entire: small and quick and green to the last of it, narrow at the shoulder and neat at the waist, the hips carrying what the shoulders set down; in the mirror a face that is {first}\'s and a woman\'s'] },
          { at: 100, trait: 'goblin: kin to the market clans, a bargain in every breath',
            steps: ['every exchange has a price in it and {first} can feel it like a pulse, and a bargain once struck sits in the chest like a debt until it is kept; the hands know a mechanism by touch and how it wants to move, and a broken thing is an invitation', 'the arcade landlord names {them} a place at the Monday table, and the clans have a word for {first} that is not a human word', '{first} is a goblin, kin to the market clans, upright and {first}-faced under the long nose; what a bargain is worth, and what it is for, is {first}\'s to decide'],
            anatomy: 'As above, complete.' }
        ],
        habits: ['a hand on every coin in the pocket, counting without meaning to', 'spice on everything and the sour pickles nobody else touches', 'taking a thing apart to see how it goes together, in the middle of a conversation', 'a price forming in the head for every favour before the favour is finished, and a fair one noted', 'quick hands: a dropped thing caught before it has fallen', 'eating nearly anything, the stronger the better: burnt, sour, pickled; nothing disagrees with the stomach afterwards', 'small bright or useful things end up in a pocket and, at home, in a sorted hoard whose every piece is known; parting with one costs something unless something better comes back', 'sleeping better in a small close space, with company in the bed and noise in the house; an empty room is a loud kind of quiet'],
        noticed: ['the goblins in the arcade quote {first} the right price without being asked, and one of them narrows her eyes at {their} hands', 'a goblin child at the market stares at {first}\'s ears until she is pulled away'],
        gone: ['hands that fumble; the price of a thing not obvious any more; food that tastes flat'] },
      fairy: { name: 'fairies', short: 'Fairy', race: 'Fairy', rate: 4, element: 'light', method: 'fairy dust and glamour on the skin, dancing through a fairy ring, a fairy\'s kiss (glamour passes mouth to mouth), sleeping in a fairy\'s bower',
        ladder: [
          { at: 15, trait: 'a shimmer under the skin in some lights; laughter comes easily',
            steps: ['in lamplight the backs of the hands have a sheen that is not sweat and goes when {first} looks straight at it, and the fingernails gleam as if polished', 'a laugh that gets out before the joke has landed, and again at nothing', 'a lightness of mood that arrives without a cause, like weather', 'in the Glamour studio the truthful mirror shows a faint shimmer under {first}\'s skin like light on water', 'the shimmer is there in every low light now, on the wrists and along the collarbones, colours moving in it like the inside of a shell, and a stranger on the stair looks at {first} twice; the laugh gets out on its own three or four times a day'],
            anatomy: 'Nothing shows yet but the shimmer.' },
          { at: 30, trait: 'pointed ears; iridescent eyes; iron stings',
            steps: ['the tips of the ears itch and pull, and the pillow finds them', 'the radiator, the door handle, the cutlery: an unpleasant cold at the touch first, then a sting like a nettle, and a sneeze', 'colours have more in them than they did, the red of a door, the green of the lawn; in the mirror the eyes catch the light and hold it a moment too long before they let it go', 'the ears have lengthened by a finger\'s width and the tops are going to points; a hat sits on them; the iron fork raises a welt across the palm and {first} eats with a wooden spoon', 'a ring of colour has come into the iris, {eye}, and the white of the eye is going; the ears lift a little at a laugh', 'the ears are long and fine and pointed, sensitive at the tips; the eyes have gone iridescent from edge to edge, turning as {first} turns', 'the ears and eyes are the first thing people look at now, and the eyes see more than they did: a colour nobody else can name, a glamour for what it is, the glow of another fairy’s mood; iron is a thing {first} routes around, and the wooden spoon lives in a pocket'],
            anatomy: 'The ears: long, fine, pointed. The eyes: no white, iridescent edge to edge, {eye} at the heart. Iron: a nettle sting and a sneeze at a touch.',
            sex: ['the jaw softer under the hand, the line from ear to chin rounding when the mirror is checked; the voice sits higher and gets to the laugh sooner', '{skin1}', 'a soreness across the chest that the shirt finds by evening and the pillow finds at night, eased by morning and back again the next day', '{tanner2}'] },
          { at: 50, trait: 'small wings budding at the shoulder blades; a lighter frame',
            steps: ['an itch between the shoulder blades that no hand reaches, then two sore places there, hot to the touch, that the shirt rubs; an ache down the back like a bruise from a fall {first} did not have', 'the feet are a little less on the floor than they were: the stairs go by and the landing is a surprise', 'the sweat has gone faint and sweet, and the pillow in the morning smells of pollen and warm sugar', 'the fingers want a small object the way a tongue wants a loose tooth: a cup, a pen, someone\'s key, to move it an inch and set it back; whether to let them is {first}’s', 'reaching over the shoulder, {first} finds two buds through the skin, soft and folded and damp, no bigger than a thumb, that twitch when something is felt; a shirt with a back is a problem and a bag strap is out of the question', 'the buds have unfolded a little in the warm, two small clear things veined like a leaf that dry and crinkle, too weak yet to lift anything; sleeping on the back is over', 'the buds are wings, small and folded and not yet for anything, a soft ridge that a hand laid on the back finds at once; two slits have been opened in every shirt and the edges bound', 'the bathroom scale reads less each week and now barely moves when {first} steps on it; a wind on the quad is a push to lean into, a jump hangs a moment before it comes down, and the fairies have started including {them} in their jokes'],
            anatomy: 'The wings: two, at the shoulder blades, small and folded, clear or moth-brown or lace, dry and cool, buzzing at an unguarded moment. The weight: almost nothing.',
            sex: ['the hips coming out a little while the rest goes light, so the trousers hang from them now and not from the waist; the chest has begun to fill, and weighs nothing, like the rest', '{skin2}', '{rhythms1}', '{tanner3}'],
            women: ['the shimmer gathering strongest on the breasts, so that in a dark room the slope of each shows faintly before anything else does; dust settles in the hollow between them overnight and is found there in the morning'] },
          { at: 70, trait: 'wings grow and work; height begins to drop; glamour at the fingertips',
            steps: ['the wings ache with growth and have lengthened past the waist; they buzz at an unguarded moment, a sound {they} feel{s} in the teeth, and beat in a blur when something startles', 'the trousers are long in the leg and were not, and the door handle is higher: shorter by a hand already and lighter with it, the proportions still an adult’s; the shoes are loose at the heel and a sock is stuffed in the toe', 'a light gathers at the fingertips when the hand is idle, the yellow-white of a match the instant it catches; it goes when {first} closes the hand and comes when it is called, and the face in the mirror needs a second look before it is {theirs}', 'the shoes are too long to walk in; barefoot, the feet are narrow, the toes long and seldom all on the cold floor at once, and the hands have gone slender and long in the finger, deft with small things', 'the wings are grown and work: a step off the bottom stair that does not quite end, {first} a foot off the floor and hanging there, wobbling, the wings a blur at the edge of sight and the back and chest aching with new muscle; what to do with that is {first}’s', '{first} is shorter by a head and still shrinking, and the voice has gone up with it, higher and clearer, the laugh ringing; the hems are turned up three times and then the fairies lend clothes', 'a small glamour can come when called, a light, a colour, a face in a mirror that lies', 'short flights, when {first} tries them: the corridor and a hard landing, then the quad and a soft one, darting, hovering, tiring fast; the wings ache in the evening like legs after a run, and a fingertip drawn along a wing vein is felt through the whole body'],
            anatomy: 'The wings: full-grown, working, folding flat against the back, clear or patterned. The height: a head shorter and falling. The feet: small, bare, long-toed, light on the floor. The fingertips: a light on call.',
            sex: ['the frame going slight, the waist coming in under the wings so that the belt is on its last hole and then a new one is made; the breasts small and high, tender where a strap crosses them', '{gait1}', '{scent1}', '{tanner4}'] },
          { at: 85, trait: 'the body takes the fae form, delicate and bright, a grown adult\'s proportions in small',
            steps: ['the bones going fine and light, the wrists narrow enough to ring with finger and thumb, the face narrowing to the chin; a shell-sheen has climbed the forearms and shins and runs up the spine round the wing roots; the hair lifts and settles with no wind', 'dust on everything {first} touches, faintly luminous in the dark, and it is coming off {their} skin and wings, most when something is strongly felt; under it a glow rises and falls with the mood, bright in joy, dim in sorrow, flickering in anger, and the dark shows it', 'waist-high to most people now, slight and quick, and still going; a cup needs two hands, a chair is a climb, and the wings are the answer to a world gone oversized; a step off the table lands without a sound', 'a surprise: a shout of laughter and {first} is a foot taller; a bad mood and {they} could stand on the sill', 'in the mirror the face is {first}’s own, fine-drawn and bright-eyed, and the voice out of it is small and clear and carries across the quad; the fairies have started using {first}’s name as if it had always been one of theirs', 'the body has gone over to the fae shape, delicate and bright, glittering at the edges; {first} is knee-high at rest and human-sized when showing off, and has learned to watch the mood the way others watch the weather; the bower in the Greenhouse Quarter fits'],
            anatomy: 'The finished shape: fine-boned and bright, about three feet tall and a grown adult in proportion; long pointed ears that lift at a laugh; eyes with no white, iridescent edge to edge; wings that fold flat along the back and buzz at an unguarded moment; small bare long-toed feet, light on the floor; hair that moves without wind; skin that sheds a faint luminous dust; a light at the fingertips on call; iron a nettle sting and a sneeze.',
            sex: ['{genitals}', '{tanner5}', 'a woman\'s body entire: fine in the bone and light on the floor, narrow at the waist under the wings, the breasts high and light with the shimmer strongest on them; in the mirror a face that is {first}\'s and a woman\'s'] },
          { at: 100, trait: 'fairy: fully fae, court-named',
            steps: ['the ring in the lawn is a door {first} can feel from across the quad; glamour as easy as breath, and a lie told outright sticks in the throat, a promise given has a weight {first} can feel', 'iron is the enemy for life: bare iron burns at a touch and its nearness is an ache, while brass and silver are no trouble, and {first} knows where every nail in Kettle Hall is', '{first} is fae, court-named in the Friday ring with the fairies singing it, upright and {first}-faced at whatever size the mood is'],
            anatomy: 'As above, complete.' }
        ],
        habits: ['laughter arriving before its cause is clear', 'a shimmer at the edge of vision', 'the radiator, the door hinges, the cutlery: bare iron an ache from a hand away and a burn at a touch', 'fingers straying to whatever small thing is nearest, a coaster, a bottle cap, a crumb; moving it an inch is still {first}’s to decide', 'fruit and honey before anything else at breakfast, and a giddy rush off a sweet; too much honey is a drunkenness', 'an exact count kept, without trying, of favours, gifts and slights; the wording of a promise heard precisely, and a broken one sitting in the chest like a stone', 'the cold felt sooner, and a cold morning slow and sleepy until the sun has been on the skin'],
        noticed: ['the fairy ring grass bends toward {first} at the edge of the lawn; a fairy keeping well clear of the iron gate stops to look at {first} properly', 'moths at the window follow {first} from lamp to lamp'],
        gone: ['the world has stopped shimmering at the edges; iron is only iron; the furniture is the right height again'] },
      fox: { name: 'fox mythkin (kitsune)', short: 'Fox', race: 'Kitsune', rate: 4, element: 'fire', method: 'sharing their warmth (they run hot: cuddling, sleeping curled together), fox-fire brushed on the skin, losing a game to them (they take payment in change), eating at their table',
        ladder: [
          { at: 15, trait: 'flecks of a new colour in the eyes; fried-food scents register sharply',
            steps: ['the smell of a pan from across the dining hall, arriving before the sight of it, and the mouth watering by itself; the fork stops halfway to {first}’s plate', 'a fleck of {eye} in the eye that was not there, caught in the mirror in a slant of light; dusk is brighter than it was', 'a warmth coming off {first} in bed that was not there last week; the blanket is too much by midnight and the cold side of the pillow does not stay cold', 'the smell of fried tofu from the roommate’s side of the room, and the body leaning toward it before the head has decided anything; whether to ask for some is {first}’s choice', 'the eye is {eye} all the way through now, the old colour gone from it, and a cold room is no longer cold; from the dining-hall door {first} can say which pan is on'],
            anatomy: 'Nothing shows yet but the eyes.' },
          { at: 30, trait: 'fox ears; a sly quickness of thought',
            steps: ['an itch high on the head, and the rims of the human ears gone thin and hot, then numb, as if they were going to sleep; small high sounds sharpen', 'a sound from the roof, small claws on slate, that {first} hears and nobody else does', 'the answer arriving before the question is finished, and with it what the asker wants and what they are hiding; whether to share it is {first}’s choice', 'the tops of the ears have drawn to points and the bases widened, fine fur along the edges by morning; they sit higher on the skull every day; a hat is a joke and a pillow is a problem', 'the points, high on the head under the hair now, are warm and furred, and the fingers find them already turned toward the door before anyone knocks; what is left of the old rims below is smooth-edged and quiet, going', 'the ears have moved to the top of the head, large and triangular, furred and dark-backed, and they swivel toward a whisper across the library; a sound can be placed exactly with the eyes shut; where the old ears were is smooth skin', 'the ears turn on their own, one to the lecturer and one to the pen scratching two rows back, and flatten and prick with feeling; holding them still takes the kind of attention {first} would give to holding a breath; stroked at the base they bring a shiver'],
            anatomy: 'The ears: fox ears, high on the head, tall, pointed, furred in {first}\'s colour with dark tips, turning on their own. The old ears: gone to smooth skin.',
            sex: ['the jaw narrowing under the hand, and the skin of the cheek gone softer each morning; the voice coming out a note higher than it was pitched', '{skin1}', 'a soreness behind each nipple that the shirt finds first, tight across the chest by evening and tender at the seam, eased by morning and back the next night', '{tanner2}'] },
          { at: 50, trait: 'a tail; a whisker-sense for movement; illusions flicker at the fingertips',
            steps: ['a bruised ache at the base of the spine that a chair makes worse, and a small hard lump under the skin there, warm, with a weight to it by nightfall', 'a sense of things moving at the edge of the eye that are not seen: a draught, a hand, a moth; the cheeks tingle with it', 'reaching back, {first} finds a warm swelling at the tailbone with a pulse in it; the waistband is a problem by the second day', 'a flicker at the fingertips in a dark room, a light that is not there when {first} looks; a yip of surprise that escapes before the word for it', 'the swelling is a stub, a finger’s length of bone and muscle under tight skin, furred, that twitches when something startles; sitting is done forward and the seam of every pair of trousers is a decision', 'fine pale whiskers have come in at the cheeks and tell {first} where the draught is; the tail is a hand long, then a forearm, in soft fur already fuller than its bones, and it flicks with a mood before the mood is known', 'the tail is thickening fast, its dense coat doubling its width, pale at the tip; it balances every quick turn, and {first} can hold it still for a breath; the whiskers are how a room is read; a coin in the palm is, for a second, two coins'],
            anatomy: 'The tail: as long as the arm, thick, furred to the tip in {first}\'s colour with a pale tip, curling and lifting on its own. The whiskers: fine, pale, at the cheeks, alive to draughts.',
            sex: ['weight settling at the hips so the trousers pull across the seat and stand away from the waist; the chest has begun to fill, and a bag strap across it gets moved to the other shoulder without a thought', '{skin2}', '{rhythms1}', '{tanner3}'] },
          { at: 70, trait: 'fur at the ears, tail, forearms and feet; paws; a second tail; quick pattern recognition',
            steps: ['the toenails have thickened to dark points and the socks catch and ladder; the shoes pinch at the toe box by noon', 'the forearms itch from inside and are warm under the sleeves, a fur coming through that cannot be scratched', 'the sweat gone sharper and a little sweet, and under it a musk settling, with something floral in it, that the pillow keeps', 'a cramp in the arch on the stairs, and a heel that wants to lift and stay lifted for a step or two', 'a second ache beside the first at the base of the spine, and the tail feeling crowded', 'the pads: four soft swellings under the toes and one under the ball of the foot, tacky on the tiles, that take the floor a half-second late; barefoot, {first} can feel every crumb', 'the little toe is drawing up the side of the foot, and the four that are left have lengthened and gone furred; the shoe goes on in the morning and comes off at noon, and then is not tried', 'fur has come in at the ears, down the tails and along the forearms to the backs of the hands, soft and dense and warm, and a soft line of it runs down the spine from the nape to the tail root; the second tail is a stub with a mind of its own', 'the heel does not come down: {first} is up on the balls of the feet, which are paws now, four toes with pads and short dark claws that tick on the floor; balance tips forward, quick', 'two tails, the second shorter and slimmer and moving in step with the first unless attention is paid; steps silent, turns quick, and a jump that goes further than it should; patterns are easier to notice, and {first} decides what to do with them'],
            anatomy: 'The feet: paws, four toes with pads and short dark claws that tick on the floor, the fifth sitting high on the inside of the ankle, a big pad under the ball, the heel carried raised; fur to the ankle. The fur: ears, tails, forearms to the backs of the hands, dense and warm. The tails: two, the second the smaller, and both moving on their own.',
            sex: ['the shoulders narrowing in the same weeks the hips widen, so the shirts sit differently across the chest; the breasts small and warm under them, and the waist found by a belt that had never needed its last hole', '{gait1}', '{scent1}', '{tanner4}'],
            women: ['{teats}, coming in a pair at a time: a prickle below the breasts, and under the shirt the fingers find two small points, then two more a hand lower, neat on the bare skin; the mirror confirms them a week after the fingers did', 'the four small nipples on the belly have settled, neat on the bare skin, and show when {first} stretches; the waistband sits across the lower pair and is felt there, lightly, all day', 'a few restless nights in the dead of winter, then a shape to them: wakeful after dark, warm, the musk stronger; once a year at midwinter, a few weeks of restlessness and pacing by night and short sleep by day, and what {first} does with it is {theirs} to decide'] },
          { at: 85, trait: 'the kitsune shape settles: fur closes over back and belly, the nose dark, the canines long; the face stays your own; fox-fire at will',
            steps: ['the skin of the back and belly itches from inside and the shirt is a torment for a day', 'the canines ache at the root, and the tongue finds them needle-fine and a little longer each week, the smaller teeth sharpening to match', 'the tip of the nose runs cool and damp when the fingers go to it, and in the mirror it is darker and narrower, the nostrils moving at a scent; the canines have come down to rest on the lower lip, and the tongue keeps finding them', 'a heat in the palms that is not the usual heat and comes when called; a chatter when excited and a whine when thwarted, and once, at night, a scream that carries across the Isle from a throat that did not know it had one', 'the pupils have gone to slits in the light and the {eye} is the whole iris, wide and dark at night, so that small movement in grass or shadow catches them at once; the fur has closed over the back and belly and clothes sit on it now, not on skin', 'the tail is a brush, as wide as a thigh and nearly weightless, wrapping the body in sleep, its root so sensitive a hand there is felt along the spine; a scent of {first}’s own has settled, fox musk with a sweetness like violets, that keen noses know at once', 'in the mirror the face is still {first}\'s, sharpened: eyes {eye}, slit-pupilled, whiskers, a narrow dark-tipped nose, a pointed chin, fine canines in the grin; and fox-fire comes when {first} calls it, a cold blue flame in the palm that burns nothing'],
            anatomy: 'The finished shape: upright and human-faced, the face sharpened; fox ears that turn on their own; eyes {eye}, slit-pupilled, that take the lamp; whiskers alive to a draught; a small dark nose, cool to the touch; long canines that rest on the lip; fur over back, belly, arms and legs; furred feet with pads and claws that tick on stone; two tails or more, moving on their own; fox-fire on call, cold and blue.',
            sex: ['{genitals}', '{tanner5}', 'a woman\'s shape entire: slight through the shoulder and full at the hip, the waist narrow, the tails curling round the leg when {first} sits; in the mirror a face that is {first}\'s and a woman\'s'] },
        ],
        habits: ['hungry often and for little, eggs, fruit, small meats, and the smell of a pan from three rooms away', 'warmth registering clearly in any room', 'a quickness at noticing patterns in cards and dice', 'curling up to sleep, knees to chest, tail (when there is one) over the nose', 'an eye for small tricks, misdirection and the harmless lie, so that a straight answer takes effort; whether to play a trick or reveal it is {first}’s choice', 'eating lightly and often; food and small prizes cached in hidden places, the hand doing it before any decision about it, and half of them forgotten', 'a crouch by reflex at something small moving in the grass, the spring half-begun before the thought; most awake at dusk and dawn', 'a mouse under the floorboards placed to the inch, and a room read by scent at its door, though not as deeply as a wolf reads it'],
        noticed: ['the fox mythkin at the window table stop their game to look at {first} as {they} pass{es}, and one of them smiles as if a bet had been settled', 'the Mews cats bristle at {first}; the Mews foxes do not'],
        gone: ['a cold room; a slowness with cards; the tail\'s ghost turning when {first} turns'] },
      cat: { name: 'cat mythkin', short: 'Cat', race: 'Cat mythkin', rate: 4, element: 'shadow', method: 'being groomed or brushed by them, napping together in the sun, a scratch or bite in play, being chosen as a lap',
        ladder: [
          { at: 15, trait: 'sunlight makes the body drowsy; hearing sharpens',
            steps: ['the sun comes across the library floor and the eyelids go heavy with it, as if the warmth had weight; the same line of the page is waiting when {first} looks again', 'the radiator ticking three rooms away, and the roommate\'s breathing picked out from the wind; the building has got louder without anyone raising a voice, and the rims of the ears run warm and feel thinner between finger and thumb', 'the room at night is less dark than it was, and a moth shows as movement before it shows as a shape', 'the moment the sun is warm on the back of the neck the eyes want to close, and staying awake becomes a thing that takes a hand', 'the south ledge is warm through the shirt and the stone fits the spine better than the chair does; whether to lie down on it is {first}’s to decide', 'a patch of sun on the bed at eleven, and the whole body leans toward it the way a plant does; at dusk the drowse lifts and {first} is wider awake than the hour deserves, with a new thing in the day to plan round'],
            anatomy: 'Nothing shows yet.' },
          { at: 30, trait: 'slit pupils; cat ears; a purr in the chest',
            steps: ['the desk lamp too bright to read under, and daylight an ache behind the eyes; at night the corridor is lit, grey and clear to the far door, with every lamp off', 'an itch high on the head that the fingers find as two tender spots under the hair, and the old ears gone numb and quiet, as if full of water', 'a hum low in the throat in warmth, felt before it is heard, that stops when {first} notices it', 'the bathroom light makes the pupils flinch, and in the mirror they have gone to lines, the irises {eye}; the tops of the ears are furred and sit a little higher each morning; a hat is a joke', 'in the dark the pupils go wide and black, moons that take the whole iris, and the roommate\'s torch finds two coins of light in them before it finds the face; a slow blink comes on its own at a familiar face', 'two furred points high on the head that turn to the door before the knock, and the old ears smooth and quiet and going; a pillow is a negotiation', 'the ears have finished moving up, furred and pointed, and swivel apart to follow two voices at once, going flat at a slammed door; rubbed behind, they bring the purr up from the chest before anything has been decided, and the roommate looks up', 'the purr can be heard now across a quiet room, a low even sound that starts under the breastbone without leave, and a dropped tray brings a hiss up the throat ahead of the breath; whether to let the purr be heard is {first}’s choice'],
            anatomy: 'The eyes: gone {eye}, the pupils slits in light and moons in the dark. The ears: cat ears, high, furred, pointed, turning on their own.',
            sex: ['the jaw softening, rounder under the hand each morning in the mirror; the voice comes out a note higher than it went in, and a cough does not bring it back', '{skin1}', 'the shirt tight across the chest by evening where it hung loose at breakfast', '{tanner2}'] },
          { at: 50, trait: 'a tail; claws; a changed balance',
            steps: ['an ache at the tailbone and a weight there by evening; sitting is a negotiation', 'the nails growing fast and hooked and hard to cut, and an itch in the fingertips like something wanting out', 'reaching back, the hand finds a warm swelling with a pulse in it; the waistband sits on it', 'a stumble on the stair corrects itself before the hand reaches the rail; the top of the wardrobe looks closer than it used to, the jump to the sill is shorter and lands soft and exact, and the drop from either has lost its fear', 'the swelling is a stub, furred, with a mind of its own, and the trousers have a problem; the nails have gone hooked at the tip and catch on wool', 'the fingertips have softened into small pads that take the heat of a cup differently, and the last joint of each finger has gone loose and bends back further than it did', 'the nails have gone to claws that slide out with a stretch, with temper or with pleasure, before the mind has decided, and back when {first} think{s} of it; the tail is a hand long, then a forearm, furred, alive', 'the tail wraps the leg when {they} sit{s} and speaks on its own: a slow wave for thought, a lash for temper, straight up at a friend in the doorway; a slip from the wardrobe turns in the air and lands on the feet'],
            anatomy: 'The tail: long, furred, whip-thin at the tip, alive, and never quite still. The hands: a cat\'s claws in place of nails, curved and sharp, that slide out with a stretch and back with a thought.',
            sex: ['the belt out a notch and the trousers tight across the seat as the hips widen a little; the chest has begun to fill, soft under the palm, and the shirt sits differently over it', '{skin2}', '{rhythms1}', '{tanner3}'] },
          { at: 70, trait: 'fur; paws for feet; nocturnal energy',
            steps: ['the toenails have thickened to points and the socks catch and ladder; shoes pinch at the toe by noon', 'the skin itches all over from inside, a fur pushing out, and the shirt is suddenly too warm; the sweat of a hot afternoon is fainter than it was, and fainter again by the week', 'the middle of the night is the middle of the day: {first} is wide awake at two and asleep at noon, and naps come anywhere warm; a moth at the window holds the eye, and the body has gone into a crouch before {first} knows it', 'a cramp in the arch on the stairs, and a heel that wants to lift and stay lifted; the shoes are loosened and then carried', 'the canines ache at the root for a week and then come in fine and sharp, pointed little canines that show in a yawn and catch the lip', 'pads under the toes and the ball of the foot, soft and silent on the tiles, that take the floor a half-second late; barefoot, {first} can feel every crumb', 'fur has come in, soft and dense, at the nape and spine and shins and the backs of the hands; the little toe has drawn up the side of the foot and the four that are left have lengthened', 'the claws of the feet go in and out like the hands\' now, and catch the sheet; the heel does not come down and balance has gone forward and light', 'a dropped pencil is stalked across the floor and pounced on before the thought arrives; it is play, and hard to resist', 'the feet are paws, padded and silent, four toes with claws that go in and out, and {first} walks on the balls of them and makes no sound at all; shoes are over', 'the fur lies in one direction and wants smoothing when it does not, and {first} grooms it, the hand going down the forearm in the middle of a page; the library keeps a lamp on for whoever is awake at two, and {first} is'],
            anatomy: 'The feet: paws, four toes with pads and retractable claws, the fifth drawn up the inside of the ankle, a big pad under the ball, the heel raised, silent. The fur: nape, spine, shins, the backs of the hands, soft and dense in {first}\'s colour.',
            sex: ['the breasts small but there, a weight the stairs make known at every step, and under them the waist going in, so the trousers that were tight at the seat gape at the waistband', '{gait1}', '{scent1}', '{tanner4}'],
            women: ['{teats}: a tenderness below the breasts that the fingertips go to under the shirt and find as small firm points, two to a row, down the belly as far as the waistband; the mirror finds them a week after the fingers do', 'the lowest pair sits just above the hip bones and the top pair a hand below the breasts; the towel finds all eight, one row at a time, and the waistband sits over the last two'] },
          { at: 85, trait: 'the cat shape settles: fur closes over back and belly, the nose small and dark, whiskers; the face stays your own',
            steps: ['the itch again, this time across the whole back and down the belly, and under the shirt the fingers find fur coming in there too, short and dense; the shirt is too warm to sleep in, and the skin smells of little now but warm clean fur', 'the tongue has gone rough, found out on the rim of a cup and then on the lower lip, which it leaves tingling as if sanded; the back of the hand is licked and drawn down the forearm, and the doing of it is noticed only afterwards', 'fine dots on the upper lip, tender to the touch, and a row above each brow; within the week stiff pale hairs stand from them and feel the air move before the door has opened', 'the spine longer and looser, so a stretch goes further and the small of the back arches clear of the bed; a hand at the base of the tail arches the whole back on its own; in the sun the body curls nose to tail-tip, a shape a human spine should not manage', 'whiskers, fine as wire, have come in at the cheeks and above the eyes, and tell {first} where the doorframe is in the dark; the nose has gone small and dark and a little broader, the chin smaller, the cheeks fuller at the whisker pads', 'affection, when it comes, is sudden and bodily: the cheek goes along a friend\'s jaw before {first} has decided anything, then distance; the grooming hand strays to a friend\'s hair; being held when {first} did not choose it sits badly', 'in the mirror the face is {first}’s: slit eyes, a small dark nose, whiskers, fur at the cheekbones; the body under its coat has gone lithe and long and quiet, and passes through any gap the head fits'],
            anatomy: 'The finished shape: upright and human-faced, with a small dark nose and fine whiskers at the cheeks and above the eyes; cat ears, high and furred, that turn on their own; eyes {eye}, the pupils slits in light and moons in the dark; fur close over back, belly, arms and legs; claws at the fingertips that slide out and in; paws, padded and silent, the heel raised; a long tail, whip-thin at the tip, that moves on its own.',
            sex: ['{genitals}', '{tanner5}', 'a woman\'s shape, complete: lithe and long, narrow through the waist and soft at the hip, the breasts settled; in the mirror a face that is {first}’s and a woman\'s'] },
        ],
        habits: ['sleep at any hour there is sun, on any ledge, in a curl the spine should not manage', 'ignoring people who want {first}\'s attention and attending to the ones who do not', 'a stillness that is not laziness: watching a thing for a long time before touching it', 'the fish at dinner, and the milk', 'a dislike of being watched while eating, and of being handed things', 'a no that comes easier than it did, and no apology after it', 'washing sooner and oftener than the day asks, and a dislike of being soaked: rain is taken as an insult', 'kneading anything soft, a blanket or a lap, with the claws just out, which is a deep comfort and hard to stop'],
        noticed: ['the cat mythkin on the sun ledges open one eye each as {first} passes, and one shifts to make room', 'the Mews birds fall silent; a familiar arches at {first} and then rubs against {their} shin'],
        gone: ['the sun on the ledge is only warm; sounds arrive late; the purr is gone from the chest and the chest is quiet'] },
      mer: { name: 'merfolk', short: 'Merfolk', race: 'Merfolk', rate: 4, element: 'water', method: 'swimming with them in the lake, salt water from their spring, a breath-gift kiss under water, sleeping in the lakeshore pools',
        ladder: [
          { at: 15, trait: 'a thirst for salt; cold water stops biting',
            steps: ['salt in the air leaves a sharp taste at the back of {first}’s throat, and plain food tastes of nothing until it has been salted twice', 'thirsty all day, the glass at the bedside empty by morning, and the sweat after the stairs faint and tasting of salt at the lip', 'the hands and feet run cool, and the cold tap in the morning does not bite; {first}’s hand under it waits for the shock, and the shock does not come', 'a dryness of the skin in a warm room, tight across the cheekbones and the backs of the hands, that eases the moment the window to the lake is opened', 'the smell of the salt spring reaches {first} across the quad before the fountain is in sight, sharp and clean, and the mouth waters at it as at bread', 'the lake at the shins is only cool now where it was cold last week, and the breath does not catch at it; whether to go further in is {first}’s to decide'],
            anatomy: 'Nothing shows yet.' },
          { at: 30, trait: 'webbing between the fingers and toes; a blue-green sheen at the nails',
            steps: ['a tightness between the fingers when {first} spreads them, and a tenderness in the web of the thumb; the toes feel long in their shoes and want to spread', 'the nails look bruised in the morning and are not', 'the fingers feel clumsy on small things, buttons and pens, as if the hand had been gloved', 'spread against the lamp, the hand shows skin between the fingers to the first knuckle, thin and translucent; gloves are over and a ring is moved to the thumb', 'the webbing is to the second knuckle and a pen is held between two fingers now instead of three; the nails have a blue-green sheen like the inside of a shell', 'the toes have gone the same way, longer and webbed to the first joint, and a sock is a strange thing to pull over them; shoes fit badly over a foot gone long and flat, and in the shallows the feet push water like paddles', '{first}’s hand is a webbed hand now: skin to the second knuckle that the light comes through and folds away into the palm when the hand closes, nails blue-green to the root; deft again on buttons, and in the water a flat palm meets something to push against'],
            anatomy: 'The hands: webbed to the second knuckle with thin translucent skin; the nails with a blue-green sheen. The feet: webbed to the first joint.',
            sex: ['the jaw softening under the fingertips, its line rounder in the mirror; the voice lighter, and carrying further across water than it did', '{skin1}', 'an ache behind each nipple that the shirt finds before the fingers do, tight across the chest by evening and eased by morning, back again the next night', '{tanner2}'] },
          { at: 50, trait: 'gill slits that open in water; scales along the shins',
            steps: ['three sore lines on each side of the throat, like paper cuts under the skin, that itch in the bath and ache in dry air', 'the skin of the feet and ankles smooth, cool and faintly patterned, and the shins rough under the hand and shining in the shower, the skin there hardening in small close plates that itch when they are dry', 'the breath held in the bath, longer and longer, and no panic when it runs out', 'the voice carries further than meant: a word said at the shore reaches the far side of the pool, and a line hummed in the bath comes back off the tile with a range it did not have last week', 'a collar rubs the lines at the throat raw; {first} stops wearing collars; the scales on the shins catch on the sheets and on socks, which are given up', 'the lines at the throat have opened at the edges, dry and closed on land, and a finger laid along one feels a flutter under it; the scales have reached the knee', 'under the water the lines at the throat open, pink and fluttering, and {first} breathes: not air, and it is not drowning; the first breath of water is frightening and the second is easy', 'along the shins the scales lie small and close as a snake\'s, cool under the hand, bright in water and alive to a hand moving with the lie; the gills shut dry and open wet, tender to a touch, and {first}’s hand no longer goes to the throat to check them'],
            anatomy: 'The gills: three lines each side of the throat, closed and dry on land, open and pink and fluttering in water. The shins: scaled in small close plates, cool, in {first}\'s colour.',
            sex: ['the belt finds a new hole and the trousers pull across the seat, the hips taking what the shoulders give up; the chest has begun to fill and is tender where the towel passes', '{skin2}', '{rhythms1}', '{tanner3}'],
            women: ['the sheen gathering on the breasts until they shine wet when they are dry, the skin of them smoother and firmer and cool to the touch, slow to warm under a hand; the scales coming down the chest to stop just below them in a line as clean as a waterline', 'besides the scales under the breasts, one thin run of them from the collarbone straight down between the breasts, cool there when the rest of the skin has warmed, that a fingertip follows to where it stops', 'a few days near the highest tides of running warm and wakeful, drawn to the water, the scales brighter, and then a shape to it: a season that comes with the spring tides and goes with them, easy only in the pools; what {first} does with it is {theirs} alone'] },
          { at: 70, trait: 'legs fuse to a tail when wet; deep-water eyes',
            steps: ['in the bath the legs press together and will not be parted for a moment, the skin between the thighs tacky and pulling; in the lake a kick with both legs as one goes further than two', 'an ache down the length of both legs at once, bone wanting to be one bone; walking after a bath is stiff for a minute', 'the eyes water in daylight and see the lake bed at night; a second lid slides across when {first} blinks and {they} feel{s} it go', 'under the water the lake is clear without goggles, every stone of the bed, and in the mirror the iris is turning {eye} from the rim inward', 'in the shallows the feet spread and flatten and the toes will not separate; on the sand they come apart again, slowly; shoes are carried to the shore and left there', 'in the bath the knees lock and the feet have gone to one wide flat thing for a minute, and then come apart with an ache; the bath is run deeper', 'in the lake the legs go: the skin seals from hip to ankle, the bones slide and lock, the feet spread and flatten to a fluke, and {first} has a tail, long and strong and scaled, and moves in the water like nothing on land', 'on the shore it comes apart again over a few minutes as the scales dry, and aches; the legs are weak for a moment, the first minute on them is a stagger, and then it is walking', 'wet, {first} is a mer and swims; dry, {first} walks, a little stiffly for the first minute; the second lid is how the lake bed is seen'],
            anatomy: 'The tail, in water: the legs sealed and fused into one length from hip to fluke, scaled and strong, with fins at the calves and a broad fluke where the feet are on land; on land, legs again, stiff for the first minute. The eyes: large, {eye}, with a clear second lid.',
            sex: ['the frame going long through the back and curved at the hip, so that a shirt that fitted at the shoulder now pulls at the hip; in the bath the hips meet the sides a hand\'s breadth before the shoulders do, and the breasts, small still, break the surface first', '{gait1}', '{scent1}', '{tanner4}'] },
          { at: 85, trait: 'the mer form at will in water; a song under the surface',
            steps: ['the change in the water comes when called now, in the time of a few breaths, and does not hurt; swimming is flight, and the seam along the inner legs where the tail parts is tender to a touch for an hour after', 'the skin cool to the touch all over, slow on cold mornings and quick after warm water, and smelling of clean salt water and wet stone; a pearl sheen on it in any light, strongest wet, slick as glass in the lake', 'small close scales at the shoulders and down the outside of the arms to the backs of the hands, lying toward the fingers, slick wet and dull dry; stroked with the lie they are silk, and against it a rasp', 'the eyes have gone large and {eye} and the second lid is used in wind; they see in the dim of the deep lake and find full noon too bright, and the gill-lines at the throat are simply the throat', 'under the surface {first} sings, without deciding to, and the sound goes through the body like a current and carries across the lake as clicks and long notes; in air a sung line holds a listener still a moment, and whether to aim it at anyone is {first}’s choice', 'the mer form comes in the water when {first} calls it and goes when it is let go; the merfolk answer the song from the pools, and on land the face in the mirror is {first}\'s own, large-eyed, with the sheen on it'],
            anatomy: 'The finished shape on land: upright and human-faced, with a sheen on the skin deepest at the shoulders and arms; three gill-lines each side of the throat, shut and dry; hands webbed to the second knuckle and feet to the first joint, the nails blue-green; small translucent fins flat along the forearms and the backs of the calves; scaled shins; eyes large and {eye}, with a clear second lid. In water: the tail.',
            sex: ['{genitals}', '{tanner5}', 'a woman\'s body entire: long in the back and cool to the touch, the sheen on shoulders and breasts, the hips set wider than the shoulders now; in the mirror a face that is {first}\'s and a woman\'s, large-eyed'] },
          { at: 100, trait: 'merfolk: the lake is home',
            steps: ['sleep is taken in the pool room now, under the surface, and morning arrives without the body having gone up for air in the night; a day away from the water is felt in the skin, and a week of it would be an illness', 'the lake is known by taste now, every inlet and spring, the way a house is known in the dark', '{first} is merfolk: a tail in the water and legs on land, and ashore the same face as ever, large-eyed; a pool room on the lakeshore has {their} name on the tile, and the lake is home and the land is where {first} visits'],
            anatomy: 'As above.' }
        ],
        habits: ['salt on everything, and the taste of the lake wind at the back of the throat like a want', 'the cold of the water is a fact, not a hurt; {first} is the last one out', 'long baths, and a bathroom floor always wet', 'breath held without noticing, longer each time, while reading or thinking', 'sleeping better in damp air, with the window to the lake open', 'a soak every day, taken as others take meals; a missed day cracks the skin at the knuckles and the temper with it, and the pools pull until it is made up', 'fish and shellfish taken less and less cooked, and the lake weed from the merfolk’s table, until most of a plate is raw and the rest is salted'],
        noticed: ['the merfolk at the fountain look up as one when {first} passes, and one of them laughs and goes under', 'the lake fish rise to {first}\'s hand at the shore'],
        gone: ['the lake air is only air; the bath is only a bath; the ribs feel sealed where the gill slits were'] },
      dryad: { name: 'dryads', short: 'Dryad', race: 'Dryad', rate: 4, element: 'wood', method: 'sap tea, pollen on the skin, sleeping under a dryad\'s tree, planting and tending with them',
        ladder: [
          { at: 15, trait: 'the smell of rain matters; sun feels like food',
            steps: ['rain announces itself hours ahead, a smell like cut stone, and a lift in the mood with it', 'the sun on the back of the neck is not warmth but a meal, and {first} is hungry in the shade', 'a thirst for plain water that a glass does not answer', 'less hurried than before, in the walk to class and in the sentences, so that a reply arrives a beat after it is looked for; the mood follows the weather, lifting with sun and sinking under a grey sky', '{first} has stood in the sun on the quad for twenty minutes, eyes shut, and missed the start of class', '{first} is not hungry at dinner after an afternoon in the sun; weather is a thing {first} knows first'],
            anatomy: 'Nothing shows yet.' },
          { at: 30, trait: 'green at the fingertips; a leaf or two in the hair',
            steps: ['the fingertips tingle and look bruised green in the morning and are not sore', 'a tug at the scalp, one place and then another, as if a hair were being drawn slowly out from inside; the hair thicker, with a green cast to it in daylight, and small hard buds at the hairline and the nape under a fingertip', 'the skin of the hands and wrists gone dry and rough, and a stiffness in them in the cold that a warm room undoes; the sweat faint, and green-smelling, like a snapped stem', 'the fingertips have gone the green of new leaves to the first joint, and the nails have hardened and darkened toward thorns; gloves catch on them and a ring is turned', 'combing the hair, {first} finds a leaf growing there, on a stalk, from the scalp, and it does not come out', 'the green is to the knuckles and the leaves are three, small and glossy, and turn toward the window', 'the leaves turn with the season, copper when the elm on the quad turns; {first}’s comb goes round them now, and the nails are thorns, so buttons are done carefully'],
            anatomy: 'The hands: green to the knuckles, the nails hard, dark, thorn-like. The hair: leaves growing on stalks from the scalp, three at first, turning with the season.',
            sex: ['the jaw losing its edge under the hand, the razor finding less each week; the voice gone slower and, when it comes, a woman\'s, pitched low', '{skin1}', 'a soreness across the chest that the shirt finds by evening, eased by morning and back the next night, the skin there as tender as a new leaf', '{tanner2}'] },
          { at: 50, trait: 'bark patches at the shins; a deep patience',
            steps: ['the skin of the shins goes dry and tight and cracks in a pattern like the back of a leaf; it does not hurt, and it is warm to the hand', 'a slowness in the thoughts that is not stupidity: the answer arrives, in its own time, whole; quick talk washes past, and an hour feels long and does not matter', 'standing still takes less effort than it did; an hour on the feet passes without the shift from one to the other, and {first}’s feet are not tired after', 'the cracked skin has gone grained and rough under the sock, which wears through in a day; the trousers catch on it', 'the skin elsewhere taking a faint pattern, like wood under varnish, seen in the bath; a scratch on the arm beads clear sap before blood and heals clean and slow, and the hair on the arms and legs thins to nothing where the grain comes through', 'a queue an hour long passes without the shifting and sighing it used to cost {first}, and the hour is only an hour', 'the shins have gone to bark, grained and warm and rough under the hand, giving way to skin at the knee the way a tree gives way to leaf', '{first} can hold one position for longer than before, and the people nearby settle the way people settle near a tree; what the stillness means is {first}’s to decide'],
            anatomy: 'The shins: bark from ankle to knee, grained, in {first}\'s colour, warm and rough under the hand, giving way to skin at the knee.',
            sex: ['the hips taking weight, so that the trousers, already catching on the bark of the shins, now pull across the seat as well; the chest beginning to fill, and tender, so that lying face down on the bed to read is given up', '{skin2}', '{rhythms1}', '{tanner3}'] },
          { at: 70, trait: 'a root-sense for the ground and feet that grip it; flowers open in the hair at times',
            steps: ['the feet know the ground through the shoes: wet, dry, roots, pipe, hollow; the toes press outward and grip', 'a tenderness at the scalp in several places, buds forming, that itch at unpredictable moments', 'the forearms rough under the sleeve, the skin going grained from the wrist upward a finger-width a week, then bark thin as paper on the backs of the hands, the creases of wrist and palm left smooth; a watch strap no longer sits flat', 'the shoes are tight across the toes, which have spread, and the soles are in the way of the ground; a sock is torn by a toenail gone to thorn', 'barefoot on the lawn {first} can feel the roots of the elm and the pipe under the path, and balance comes up from the ground instead of down from the head', 'the toes have gone long and splayed and take hold of the earth by themselves, and the soles are grained; shoes are given up, and the cold of a stone floor does not reach the feet', 'standing barefoot in soil, fine rootlets creep from the soles and draw up the wet, and come free with a small tug when {first} moves; rooted, the body rests the way sleep rests it, and a shoe is a misery', 'an itch at the scalp a morning ahead, then a small pale flower open in the hair, and by evening it has dropped onto the desk', 'the bark has reached the elbows, ridged and warm in sun, so a touch on it arrives slowly and deep; it shows at the collarbones above the shirt, with a rough line down the spine; the ground reports to {first}’s feet through any floor, and the shoes by the door are not moved'],
            anatomy: 'The feet: bare, five long toes spread wide, the nails thorns, the soles grained; they read the ground and hold it. The forearms: bark from wrist to elbow. The hair: leaves on their stalks, and flowers that open at times and drop.',
            sex: ['the frame going long through the waist and curved at the hip; the breasts warm as the rest, and the skin over them still skin, no grain in it', '{gait1}', '{scent1}', '{tanner4}'],
            women: ['a tightness across the top of the chest that eases as the bark of the collarbones opens to skin over the breasts, the way a bud opens; the skin there pale and green-veined, and one morning a leaf grown across one, which the shirt presses flat and which does not come off', 'the grain over the breasts fine and pale where the skin around has gone to bark, and the nipples gone dark, like knots in pale wood'] },
          { at: 85, trait: 'wooden grace; slower and deeper',
            steps: ['the joints move like branches in wind, slow and certain; nothing is hurried and nothing is dropped, and anger comes slow and leaves slower', 'the voice settling lower and softer, with a creak of wood in it, so that a word takes the time it takes, said when the thinking is finished, and the room waits for it', 'the eyes going {eye} through and through, pupil and all, so that a mirror in lamplight shows two leaves looking back; they read light, the season and the health of a plant at a glance', 'the leaves in the hair turn to the sun, droop when {first} is thirsty and rustle when {they} {are} moved; the pillow smells of sap, leaf mould and rain, and of blossom when one is open', 'the year in the body: quick and bright in spring, full in summer, the leaves in the hair turning colour and falling in autumn as the body slows, and winter half sleep, short days and long rest and little hunger, the bark gone dull', 'the fingers long and twig-jointed, the knuckles finely ridged, the nails thorns, so a hand laid flat on a table looks like a branch laid there; the face in the mirror is {first}\'s own, stiller, the cheekbones higher under a faint grain, the eyes {eye}', 'the body has gone over to the dryad shape: long and still, bark at the shins and forearms and grain at the collarbones and down the spine, leaves and flowers in the hair, eyes {eye} through and through; {first} moves with a wooden grace, and people in a room take {them} for part of it until {they} speak{s}'],
            anatomy: 'The finished shape: upright and human-faced, with eyes {eye} through and through, no pupil in them; bark from ankle to knee and wrist to elbow, grain showing at the collarbones and down the spine; leaves on their stalks in the hair, and flowers that open at times; long fingers with nails that are thorns; bare feet, the toes spread wide, that hold the ground; warm as a branch in sun.',
            sex: ['{genitals}', '{tanner5}', 'a woman\'s body entire: long and still, narrow at the shoulder and curved at the hip, the breasts set below the bark of the collarbones with green veins under the skin there, bark and skin by turns down the limbs; in the mirror a face that is {first}\'s and a woman\'s'] },
          { at: 100, trait: 'dryad: a tree of one\'s own',
            steps: ['a sapling in the Greenhouse Quarter that {first} can feel from across the Isle like a second heartbeat; the season is in the body', 'the tree has grown in a week to the height of a house and leans toward {first} when {they} come{s}; {first} knows from across the Isle when it is thirsty, feels wind in its crown and frost at its root on {their} own skin, and a day far from it the body pines', 'the shape is a dryad\'s and the face is {first}\'s, and there is a tree of {their} own at the edge of the Greenhouse Quarter, planted by {first}\'s hand; at night {first} sleeps in it, upright, and it holds {them}'],
            anatomy: 'As above.' }
        ],
        habits: ['sunlight on the skin taken like a meal', 'the smell of rain arriving hours before the rain', 'thirst arriving before hunger does', 'standing still for an hour without the legs complaining', 'soil and grit felt through the fingertips as something to read', 'a day without sun brings a hunger no meal fills, and water drunk deeply and often; a grey day indoors wilts {first}, and an hour of light and rain undoes it', 'sitting under the same tree on the quad without having chosen it, and sleeping better the nearer the bed is to it'],
        noticed: ['the dryad trees in the Quarter turn a leaf or two toward {first}; a dryad rests a palm on {first}\'s arm as if checking a branch for sap', 'bees settle on {first} and do not sting'],
        gone: ['the rain does not announce itself; the soil is only dirt; a stillness that has to be chosen now'] },
      rabbit: { name: 'rabbit mythkin', short: 'Rabbit', race: 'Rabbit mythkin', rate: 4, element: 'earth', method: 'greens and clover honey from the warren allotments, being groomed nose to nose, sleeping in the warren pile, the dawn race on the Moon Field',
        ladder: [
          { at: 15, trait: 'greens before anything; a nose that will not stay still; a freeze at a sudden noise',
            steps: ['the greens on the side of the plate are gone first and the rest of dinner is an afterthought; the garnish off the next plate goes too, and somebody notices', 'a bang in the corridor and {first} is still, entirely, mid-sentence, cup halfway up, for a count of three, and then goes on as if nothing had happened', 'the nose moves: a twitch at the tip that {first} catches in the mirror and cannot stop by thinking about it, and the dining hall arrives through it in layers, cut grass from the quad strongest of all', 'waking before the light with the legs wanting the Moon Field, and the afternoon lecture lost to a sleep that comes down like a blind', 'the twitch is a habit now and the freeze is a fact, and every room is entered knowing where its doors are; greens are the meal; {first} is awake at dawn and asleep by three, and the warren girls have started saying good morning on the way to the race'],
            anatomy: 'Nothing shows yet but the nose, which moves.' },
          { at: 30, trait: 'the ears lengthen and lift; the front teeth grow',
            steps: ['the rims of the ears are tender and warm and a pillow finds them, and faint sounds sharpen, a tap down the corridor arriving as if from the next chair; by the second night {first} sleeps on {their} back', 'the two front teeth ache at the root and catch on the lower lip, and the tongue keeps going back to them; an apple is bitten in a new way, and there is an urge to bite down on something hard, a pencil, the edge of a spoon', 'an itch high on the head under the hair, deep, and the tops of the ears pull upward when something clatters', 'in the mirror the ears are longer than they were, the tops rounding, thin and veined and warm, a fine fur coming in along their edges, and they stand up through the hair when a door bangs; a hat is finished with', 'sounds arrive from behind as plainly as from in front; the ears turn to them on their own, and the front teeth rest on the lip when the mouth is shut', 'the ears are warm and velvet to hold, and a hand run from base to tip loosens the whole body, the shoulders first; {first} catches {themself} leaning into it before the thought arrives', 'the ears stand the length of the forearm, furred outside and thin enough to show the light through, each turning its own way; they rise with interest and lie flat at a fright before the fright is understood; the front teeth long and square, and the lip learned to close over them'],
            anatomy: 'The ears: long as the forearm, thin, veined, warm, upright through the hair and turning on their own to any sound, flat back along the neck at a fright. The teeth: the two upper front teeth long and square, resting on the lower lip when the mouth is shut, with a second small pair behind them.',
            sex: ['a softness coming into the jaw that the hand finds at the hinge, the line of it smaller each week, and the voice landing a note higher than it was reached for', '{skin1}', 'a lightness across the shoulders, as if a coat had been taken off, and the collar of every shirt standing away from the neck by a finger\'s width where it used to button close', '{tanner2}'] },
          { at: 50, trait: 'a bob of a tail; a spring in the legs; a foot that thumps',
            steps: ['an ache at the base of the spine, low and centred, that a hard chair finds and a soft one does not; by the week\'s end the body has moved itself to the front edge of every seat, with no decision made', 'reaching back, the hand finds a lump at the tailbone, warm, with a pulse in it, and the waistband sits on it', 'the thighs and calves fill out with fast heavy muscle, and there is a coil in the legs on the stairs that was not there, so they go two at a time; a standing jump would clear a bench now, and the legs know it at every kerb', 'a bang on the quad and one foot comes down on the paving, hard, twice, before {first} knows it has; the sound carries and a rabbit across the quad looks up', 'open ground feels exposed and a wall at the back is a comfort; at a shout on the quad the body is still, and then simply gone, across the grass and under the arch before any deciding has been done', 'the lump is a tail by evening, a short soft tuft with a white underside that flicks on its own at sudden sounds; the trousers are let out at the back', 'the sweat is fainter and sweeter than it was, and the pillow in the morning smells of hay and clean fur', 'the tail lifts on its own and flashes its white underside at a fright or a pleasure, plain to anyone behind {them}; a touch at its base is felt up the spine; the foot thumps at a slammed door and the floor below complains; the legs heavy and quick under human feet'],
            anatomy: 'The tail: a short soft bob, furred in {first}\'s colour on top and white beneath, that lifts and flicks on its own when {first} is startled or pleased. The legs: heavy and strong in the thigh, made for a standing jump and a sprint; a hind foot that thumps the ground at a fright before {first} knows it.',
            sex: ['the hips wider by the week, the trousers catching there and standing off the waist; a chair is sat in differently', '{skin2}', '{rhythms1}', 'the chest filling by the week, tender at the edges, so that the shirt that lay flat across it a month ago now lifts from the breastbone, and the towel is held differently coming out of the shower', '{tanner3}'] },
          { at: 70, trait: 'the hind feet lengthen and fur to the sole; a crouch at rest',
            steps: ['the toenails have thickened and darkened at the root; a sock catches and ladders, and the little toe aches as if it were going somewhere', 'the shoes pinch at the heel by evening where they never did, and the foot is longer in the morning than the shoe', 'the heel wants to lift and stay lifted; on the stairs {first} is on the balls of the feet and does not remember deciding', 'a cramp in the arch at the top of the stairs, and the toes wanting to spread inside a shoe that has no room for it', 'the socks go through at the toe in a day and the nails have gone dark and curved; barefoot in the corridor is easier, and nobody looks', 'fur on the top of the foot and up the shin to the knee, and from wrist to elbow, fine and {first}’s colour; the sole gone dense and furred too, so the cold floor is not cold; where there were five toes there are four, the little one not to be found when {first} counts', 'sitting, {first} finds {themself} back on the heels of the long feet in a crouch, quite comfortable, and only notices when someone asks whether the chair is broken', 'the feet half as long again and still going; walking is short quick steps, silent on the boards, running goes in bursts with sudden turns, and once, alone on the Moon Field, a twisting leap for no reason at all that could not be held in', 'the feet are a rabbit\'s: long, narrow, furred to the sole so that there is nothing but fur between {first} and the floor, four toes with dark nails, the heel high and the knee folded; no shoe fits, and the pair by the door has not moved in a week; the standing jump is a thing {first} does without thinking'],
            anatomy: 'The feet: long and narrow, furred above and below in {first}\'s colour, with no pads, four toes with dark curved nails; the heel held high and the knee folded, so that {first} rests in a crouch and springs from it. The forearms: furred from the elbow to the wrist, the hands human.',
            sex: ['the hips out and the shoulders in by the same inch in the same week, so that the jacket slides off the shoulders and the trousers will not go past the hip without a fight', '{gait1}', '{scent1}', 'the weight of the breasts felt for the first time turning over in bed, small as they are; a jumper that hung loose now touches them, and is noticed all day', '{tanner4}'],
            women: ['{teats}: a tenderness below the breasts that the hand finds under the shirt as small firm points, one pair and then a second, dark against the skin and easy to miss in a mirror until a fingertip counts them', 'the four small points firming by the week into nipples, in their two neat pairs below the breasts, small enough that a shirt hides them and a fingertip finds them', 'no season to it, and no rise and fall through the year: a steady warmth that sits close to the surface on any day, roused by closeness and a hand and never overwhelming; what {first} does with it is {theirs} to decide'] },
          { at: 85, trait: 'the fur closes over; the nose clefts and the upper lip splits; whiskers; the face stays your own',
            steps: ['the skin of the back and belly itches from inside for a day and the shirt is unbearable; {first} sleeps on top of the blanket', 'a tingle at the tip of the nose and a line down the middle of it, and a crease in the upper lip that the tongue finds and worries at', 'a strip of fine fur comes up the spine first, tail to nape, and fine pale down from the navel upward; by the month’s end a soft pale fur lies over the belly from the hips to the ribs, shorter and finer than the coat, the softest on the body and the most alive to a hand', 'whiskers, fine as thread, come in at the cheeks and above the eyes and tell {first} where the doorframe is in the dark', 'the edges of sight widen until the room arrives from the sides as well as the front, and anything moving overhead stops {first} dead; the eyes are larger, set a touch wider, turning {eye}, and best at dawn and dusk', 'the fur has closed over the back, the belly, the arms and the legs to the hip, dense and soft, so that clothes sit on it and not on skin; the nose is cleft to the lip and never still; the eyes in the mirror have finished going {eye}', 'in the mirror the face is still {first}\'s, under the ears and behind the whiskers: a cleft nose that reads the room, a split lip over the long front teeth, eyes {eye} set a little wide; the body is small and quick and furred and sits back on its heels; the warren has made {them} a place in the pile without a word'],
            anatomy: 'The finished shape: upright and human-faced; long turning ears; eyes {eye}, set wide; whiskers; a cleft nose that moves all the time; a split upper lip over long front teeth; fur over back, belly, arms and legs, thinner at the throat; long furred hind feet without pads; a bob tail. A smell of hay.',
            sex: ['{genitals}', '{tanner5}', 'a woman\'s body entire: small and quick, soft at the hip and heavy in the thigh, the breasts carried on a narrow frame; in the mirror, under the ears, a face that is {first}’s and a woman\'s'] },
          { at: 100, trait: 'rabbit mythkin: the warren-sense',
            steps: ['the warren sits in the chest like a compass, every rabbit on the Isle a direction and a warmth, even through walls', 'at dawn a pressure in the long bones of the legs and a pull toward the Moon Field, felt and left alone until {first} chooses to go'],
            anatomy: 'The warren-sense: every rabbit and rabbit mythkin on the Isle felt as a direction and a warmth in the chest. The upright, human-faced shape is the one {first} lives in; no one takes an animal\'s shape.' }
        ],
        habits: ['greens before anything at every meal and the garnish off the next plate; grazing on them in small amounts all day, with a sweet tooth for fruit and carrots, and meat left on the plate', 'sitting very still when a door bangs, then moving all at once; knowing where the doors are in any room, and going entirely loose only among the trusted', 'a foot that thumps the floor when {first} is startled, and the floor below complaining', 'waking at dawn wanting the Moon Field, and sleeping in the afternoon', 'grooming a stray hair off a friend’s shoulder before thinking, and the nose going forward to touch another’s in greeting before the hand has thought to go out', 'a nest made of whatever is soft, the blankets built up into a burrow, and sleep that comes easier in a heap; a count of who is in the room and who is not, before anything else', 'gnawing: a pencil, a carrot, the edge of a crate, because the front teeth ache without it and are kept short by it'],
        noticed: ['the warren rabbits make room for {first} in the pile without a word; the Beastcraft hares sit up as {first} passes', 'a dog on the pier road stares and is called off; the fox mythkin in the library go very still, then grin'],
        gone: ['the ears quiet and short again; a room that arrives only from the front; the legs merely legs on the stairs'] }
    }
  },

  skills: {
    glamour: { name: 'Glamour', taught: 'Glamour Theory (Mon/Wed/Fri 09:00); theatre society and the fairy ring on Fridays', text: 'Illusion and charm-magic: small lights, a changed face in a mirror, a voice that persuades. Fairies are its natural teachers.' },
    alchemy: { name: 'Alchemy', taught: 'Applied Alchemy lab (Tue/Thu 09:00); Alchemy Society on Wednesdays', text: 'Potions, salts, tinctures: sleep draughts, cordials, the reagents behind the Restoration Spa. Merfolk, bovine and rabbit mythkin excel.' },
    artificing: { name: 'Artificing', taught: 'Artificing workshop (Mon/Wed 13:00); Artificers\' Guild on Mondays', text: 'Charms and wards worked into metal, wood and glass: a bracelet that warms, a lock that knows its owner. Goblin craft, taught by goblins.' },
    wardcraft: { name: 'Wardcraft', taught: 'Wardcraft and Sigils (Tue/Thu 13:00); Sigil Circle on Tuesdays', text: 'Protective and binding marks drawn in chalk, salt or blood: a door nobody notices, a circle nothing crosses. Slow to learn, hard to fake.' },
    beastcraft: { name: 'Beastcraft', taught: 'Beastcraft at the Mews (Tue/Thu 14:30); volunteering at the Mews any afternoon', text: 'Familiars and creatures: the reading of animals, the bond that makes one yours. Cat and wolf mythkin have an instinct for it.' }
  },

  skillsNote: 'A skill can be rolled on like a stat: the evaluation may name a skill key instead of a stat, and its level is added to the die.',

  // The term's set events: motives and places, never forced scenes. Each comes back every `term` days unless `once`. The clock names
  // the next one and marks its day; on its day the people in `who` (cast keys) lean toward it until it is over (the mixer's own are
  // in their evening aims). It is over at `until` (an hour at or before its start is the next morning's), or else at the schedule's
  // next entry. `instead` names the weekly fixtures it stands in for that day. `aim` (or `aims` by cast key) is what its people do
  // when they do not ask {first} along; `ask: false` marks one nobody chooses to go to (weather, the exams), so the clock does not
  // call it a free choice. `opens` is a closed place the event can open: <gm_only> names the chance while the place is in play,
  // and the event's words stay public.
  calendar: { weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], term: 28,
    events: [
      { key: 'mixer', day: 1, once: true, time: '19:00', name: 'the cross-species mixer', where: 'the quad', who: [], for: 'every kind on the Isle in one place to meet the new humans' },
      { key: 'fair', day: 6, time: '15:30', until: '23:00', name: 'the Creamery fair', where: 'the Creamery yard', who: ['roommate', 'creamery', 'warren', 'stall'], instead: 'Creamery fair', for: 'the term\'s big one, from the afternoon into the evening fair: stalls, games and fresh cream; a brass bell for whoever wins' },
      { key: 'moon', day: 9, time: '19:30', until: '06:00', name: 'the Moonrunners\' full-moon run', instead: 'Moonrunners dusk run', where: 'the Moon Field and the cliff path', who: ['moonrunners', 'runner_human', 'warren'], for: 'the wolves run until dawn and anyone may keep up as long as they can' },
      { key: 'humans', day: 11, time: '19:30', name: 'the Human Society evening', instead: 'Human Society tea', where: 'the Kettle Hall common room', who: ['human_society', 'runner_human', 'historian'], for: 'the humans of the Isle compare notes on staying human, or not' },
      { key: 'storm', day: 13, time: '15:30', until: '04:00', name: 'the storm', where: 'the whole Isle', who: [], ask: false, for: 'Sallow Pier closes and no ferry runs until morning; a fog comes up after it and Kettle Hall drowses early', opens: 'sloth' },
      { key: 'exams', day: 22, time: '09:00', until: '17:00', name: 'the midterm exams', instead: ['Glamour Theory', 'Artificing workshop'], where: 'the Anatomy theatre and the labs', who: ['roommate', 'library', 'historian'], ask: false, aim: 'sit the papers (the Anatomy theatre and the labs, 09:00)', aims: { historian: 'invigilate the papers in the Anatomy theatre (09:00)' }, for: 'a paper in every course, {first}\'s among them, and a missed paper is a failed one; the library is full the night before' },
      { key: 'feast', day: 26, time: '18:00', until: '19:30', name: 'the end-of-exams feast', where: 'the dining hall', who: ['roommate', 'creamery', 'dean'], aim: 'keep {first} a seat at the feast (the dining hall, 18:00); {first} may sit elsewhere', aims: { dean: 'give the speech at the end-of-exams feast (the dining hall, 18:00)' }, for: 'the whole university at one long table', opens: 'gluttony' }
    ] },

  // The week's fixtures, by weekday (none: every day; `day`: that day only), each with the slot it falls in. A fixture with `who` (cast
  // keys), `where` and `aim` has its own people: while it is the hour's entry they are at its place with its aim, whatever the slot
  // says of them (the warren at the Thursday dawn race, which sits in the night slot so everyone else sleeps on).
  schedule: [
    { time: '06:30', name: 'Dawn race, Moon Field (the warren)', slot: 'night', days: ['Thursday'], notable: true, who: ['warren'], where: 'the Moon Field', aim: 'run the dawn race; wave {first} in if {they} come{s}' },
    { time: '07:30', name: 'wake', slot: 'rise' },
    { time: '08:00', name: 'breakfast, dining hall', slot: 'breakfast' },
    { time: '09:00', name: 'Glamour Theory, Glamour studio (Prof. {npc_glamour_prof_last})', slot: 'class1', days: ['Monday', 'Wednesday', 'Friday'], notable: true },
    { time: '09:00', name: 'Applied Alchemy lab, Alchemy labs ({npc_alchemy_prof})', slot: 'class1', days: ['Tuesday', 'Thursday'], notable: true },
    { time: '09:00', name: 'morning free', slot: 'morning', days: ['Saturday', 'Sunday'] },
    { time: '12:00', name: 'lunch, dining hall', slot: 'lunch' },
    { time: '13:00', name: 'Artificing workshop, Artificers\' workshop ({npc_artificing_master})', slot: 'class2', days: ['Monday', 'Wednesday'], notable: true },
    { time: '13:00', name: 'Wardcraft and Sigils, practice yard (Prof. {npc_wardcraft_prof_last})', slot: 'class2', days: ['Tuesday', 'Thursday'], notable: true },
    { time: '13:00', name: 'Comparative Mythkin Anatomy, Anatomy theatre (Prof. {npc_historian_last})', slot: 'class2', days: ['Friday'], notable: true },
    { time: '14:30', name: 'Beastcraft, the Mews ({npc_beastcraft_keeper})', slot: 'class3', days: ['Tuesday', 'Thursday'], notable: true },
    { time: '15:30', name: 'free hours', slot: 'free' },
    { time: '18:00', name: 'dinner, dining hall', slot: 'dinner' },
    { time: '19:00', name: 'goblin night market and Artificers\' Guild', slot: 'evening', days: ['Monday'], notable: true },
    { time: '19:00', name: 'cross-species mixer on the quad (Day 1 only)', slot: 'evening', days: ['Monday'], day: 1, notable: true },
    { time: '19:30', name: 'Moonrunners dusk run, Moon Field; Sigil Circle, practice yard', slot: 'evening', days: ['Tuesday'], notable: true },
    { time: '19:30', name: 'Aerie choir; Alchemy Society, Alchemy labs', slot: 'evening', days: ['Wednesday'], notable: true },
    { time: '19:30', name: 'lake night swim; Human Society tea in Kettle Hall common room', slot: 'evening', days: ['Thursday'], notable: true },
    { time: '19:30', name: 'theatre society and the fairy ring dance, Greenhouse Quarter', slot: 'evening', days: ['Friday'], notable: true },
    { time: '19:30', name: 'Creamery fair', slot: 'evening', days: ['Saturday'], notable: true },
    { time: '19:30', name: 'quiet evening', slot: 'evening', days: ['Sunday'] },
    { time: '23:00', name: 'late; no curfew', slot: 'night' }
  ],

  player: {
    name: 'Alex Rowan',
    description: 'Nineteen, human, from a mid-sized town. Full scholarship, after seeing something on a night bus three weeks ago that made no sense. Curious, a little guarded, quick to notice and slow to say so. Has never shared a room with anyone.',
    stats: { nerve: 3, charm: 3, wits: 4, vigour: 2, empathy: 3 }
  },

  stats: { nerve: 'Nerve', charm: 'Charm', wits: 'Wits', vigour: 'Vigour', empathy: 'Empathy' },

  difficulty: { Trivial: 4, Easy: 6, Medium: 7, Hard: 9, Legendary: 11 },

  namePools: {
    // The first names that read as one gender's; the rest are shared. A player's random name follows the gender picked.
    byGender: { male: ['Toby', 'Felix', 'Theo', 'Jonas', 'Owen', 'Ivo'], female: ['Nika', 'Iris', 'Mara', 'Leah', 'Petra'] },
    first: ['Alex', 'Sam', 'Robin', 'Casey', 'Jordan', 'Morgan', 'Riley', 'Avery', 'Quinn', 'Jamie', 'Drew', 'Elliot', 'Harper', 'Kai', 'Sage', 'Noel', 'Ash', 'Devin', 'Lior', 'Toby', 'Nika', 'Felix', 'Iris', 'Theo', 'Mara', 'Jonas', 'Leah', 'Owen', 'Petra', 'Ivo'],
    last: ['Calder', 'Mercer', 'Okafor', 'Lindqvist', 'Navarro', 'Halvorsen', 'Achebe', 'Brandt', 'Ferreira', 'Kowalski', 'Tanaka', 'Moreau', 'Sato', 'Ibarra', 'Whitlock', 'Dunmore', 'Vasquez', 'Petrov', 'Hale', 'Corwin']
  },

  personalityPool: [
    'Dry, watchful, hates being the centre of a room and keeps ending up in it.',
    'Warm and talkative, makes friends in queues, trusts too fast and knows it.',
    'Careful and private; writes things down; wants to understand how everything works before touching it.',
    'Restless, physical, happier moving than sitting; says yes first and thinks after.',
    'Quietly stubborn, slow to anger and slower to forgive; loyal once decided.',
    'Curious about everyone, a collector of other people\'s stories, bad at telling their own.',
    'Anxious under a calm surface; funny when comfortable; needs one person to feel safe with.',
    'Proud of being ordinary and slightly afraid of stopping being so.'
  ],

  lore: [
    {name:'species: cow',species:'cow',keys:['cow','bovine','Creamery','udder*'],priority:7,text:'Bovine mythkin have cow ears out to the sides and a tufted tail to the knee, short coat from the hands to the elbows and from the hooves to the hips, fading out at the navel, a strip of it up the spine, hands of two hooved fingers and a hooved thumb, and split hooves; bovine men have two short thick horns, a heavy neck and a crest at the nape; bovine women have none. The Creamery is a dairy practical: milk, cream, butter, cheese and cocoa. Bovine women have full veined breasts with long thick nipples like teats, and a small udder low on the belly with four teats, and a grown one is in milk, which arousal lets down. Bovine men have no udder and no milk. Dairy, touch and shared sleep draw a human toward the bovine; none of it is expected, and each offers and welcomes what they choose.'},
    {name:'species: wolf',species:'wolf',keys:['wolf','werewol*','Moonrunner*','Moon Field','dusk run'],priority:7,text:'The werewolves run as a pack, the Moonrunners, at dusk on Tuesdays from the Moon Field, and the pack is whoever keeps up, human runners included; anyone may run behind them, and being invited to run with them is another matter. Sharing their meals, sleeping in the pack pile and a playful nip or scratch draw a human toward the wolf; a nip is thought forward. Werewolves live upright with a person\'s eyes and brow however much wolf the nose and jaw carry; the wolf is in the body, the senses and the pack.'},
    {name:'species: harpy',species:'harpy',keys:['harpy','harpies','Aerie','choir','roost','talon*'],priority:7,text:'Harpies roost in the Aerie, a roofless tower of ledges, and sing every Wednesday. A harpy\'s gift of a feather is an ask, and wearing it is the answer. Being preened, roosting overnight in the Aerie and singing with them draw a human toward the harpy. A harpy\'s arms are her wings, feathered from the shoulder, and each ends in a hand of a thumb and two clawed fingers, for gripping; she has no other wings and no beak, and her feet are talons, scaled, three toes forward and one back, so she perches rather than sits.'},
    {name:'species: goblin',species:'goblin',keys:['goblin','arcade','market'],priority:7,text:'Goblins keep the arcade under the old chapel and hold a market there every Monday night. They are about four feet tall and adult in proportion, green all over and darkest at the limbs and ears, with long pointed ears held sideways, large night-seeing eyes that squint in sun, small sharp teeth, long nimble fingers with hard dark nails, and wide flat feet with five long gripping toes; they have no tail. Goblin-made charms worn against the skin, their spiced food and green tea, a signed bargain and traded favours draw a human toward the goblin. A goblin gift is never free, and they name the price if asked.'},
    {name:'species: fairy',species:'fairy',keys:['fairy','fairies','fae','fairy ring','ring dance','fairy dust','bower'],priority:7,text:'Fairies live in bowers in the Greenhouse Quarter and dance the mown rings on Friday nights. A fairy is about three feet tall, a grown adult in small, with long pointed ears, large many-toned eyes, four clear veined wings that fold flat along the back and buzz when annoyed (a fairy man\'s are tinted), an iridescent sheen at the limbs and spine, slender hands, no tail, and a glow that rises and falls with mood and, with strong feeling, sheds a fine bright dust on whatever is near. Fairy dust and glamour on the skin, a fairy\'s kiss (glamour passes mouth to mouth, which is why they kiss hello), dancing through a ring and sleeping in a bower draw a human toward the fae. Bare iron burns them on touch, and its nearness aches; other metals are no trouble.'},
    {name:'species: fox',species:'fox',keys:['fox','kitsune','fox-fire'],priority:7,text:'Fox mythkin may run warm and often sleep curled, though the way one fox spends time or plays games is their own. Shared warmth, fox-fire brushed on the skin, a completed game or eating together are possible routes of transformation; none is a required greeting, bargain or romantic gesture.'},
    {name:'species: cat',species:'cat',keys:['cat','feline'],priority:6,text:'Cat mythkin claim the library\'s south sun ledges and every warm windowsill. Being groomed or brushed by them, napping together in the sun, a play scratch or bite and being chosen as a lap draw a human toward the cat. They do not recruit; they permit. They are sleek and quiet, with cat ears, slit pupils, whiskers, padded fingers with claws that slide out and in, padded paws for feet and a long tail, and coat from the hands to the elbows and from the paws to the hips, fading out at the navel, with a line of it up the spine; a cat woman has two to four more pairs of small nipples in two rows down the belly below her breasts.'},
    {name:'species: mer',species:'mer',keys:['merfolk','mermaid','mer','pool room*','gill*'],priority:7,text:'Merfolk keep pool rooms on the lakeshore, half underwater, and swim at night on Thursdays. On land a mer walks on legs and long webbed feet, with a pearl sheen on the skin, scales from the hands to the elbows and from the feet to the hips, fading out at the navel, a low fin-ridge up the spine and three gill slits either side of the ribs; in deep water, and only there, the legs close into a tail and fluke. Swimming with them, salt water from their spring, a breath-gift kiss underwater and sleeping in the pools draw a human toward the mer. The lake is cold; merfolk find that funny.'},
    {name:'species: dryad',species:'dryad',keys:['dryad','Greenhouse','glasshouse'],priority:6,text:'Dryads live in and around their trees in the Greenhouse Quarter. A dryad wears bark from the hands to the elbows and from the feet to the hips, thinning out at the navel, in the colour of their wood, with a ridge of it up the spine and the skin faintly grained elsewhere; leaves grow through the hair and turn with the season, the fingers are twig-jointed with thorn nails, the feet go bare with the toes spread, and a dryad has no tail. Sap tea, pollen on the skin, sleeping under a dryad\'s tree and tending plants with them draw a human toward the dryad. Nothing about a dryad is quick, including the way they like someone.'},
    {name:'species: rabbit',species:'rabbit',keys:['rabbit','rabbits','warren','allotment*','dawn race'],priority:7,text:'Some rabbit mythkin keep the warren: burrows and allotments beyond the Greenhouse Quarter, where they grow greens for the dining hall and keep hives for clover honey. Some sleep in a pile or race the Moon Field at dawn on Thursdays; anyone may run. Greens, clover honey, grooming and a shared race are possible routes of transformation, not a personality or courtship script. Each rabbit decides their own boundaries and habits.'},
    { name: 'daily life', keys: ['breakfast', 'lunch', 'dinner', 'class', 'timetable', 'curriculum', 'club', 'society', 'free hours', 'what to do'], priority: 4,
      text: 'Daily life: breakfast in the dining hall at eight, classes in the morning and early afternoon, free hours from half past three, dinner at six, and something on every evening. The curriculum is craft: Glamour (illusion and charm-magic), Applied Alchemy (potions, salts, tinctures), Artificing (charms, wards worked into metal and wood, goblin-taught), Wardcraft and Sigils (protective and binding marks), Beastcraft (familiars and the handling of creatures), two ordinary courses, Comparative Mythkin Anatomy and the Sundering, a history nobody passes with a straight answer. First-years take all of them lightly and choose what to pursue. Evenings: the goblin night market and the Artificers\' Guild on Mondays, the Moonrunners\' dusk run and the Sigil Circle on Tuesdays, the Aerie choir and the Alchemy Society on Wednesdays, the lake night swim and the Human Society tea on Thursdays, the theatre society and the fairy ring dance on Fridays, the Creamery fair on Saturdays. Clubs recruit hard in the first two weeks and teach what the classes only introduce.' },
    { name: 'places', keys: ['dining hall', 'Anatomy', 'studio', 'labs', 'workshop', 'practice yard', 'Mews', 'Aerie', 'lakeshore', 'pools', 'Greenhouse', 'arcade', 'Creamery', 'Moon Field', 'Fenwood', 'warren', 'allotments', 'medical', 'Spa', 'old wall', 'tower', 'pier', 'explore'], priority: 3,
      text: 'Places: Kettle Hall (the mixed first-year dorm, four floors, shared rooms, a common room with a bad piano); the central quad with its bell tower; the dining hall; the library (sun ledges on the south side, claimed by the cat mythkin); the Anatomy theatre; the Glamour studio (mirrors that lie); the Alchemy labs (a fume of salt and burnt sugar); the Artificers\' workshop under the engineering block; the practice yard, its flagstones scarred with old sigils; the Mews, where the beastcraft familiars are kept; the Aerie; the lakeshore and the pools; the Greenhouse Quarter; the goblin arcade under the chapel; the Creamery; the Moon Field; Fenwood, the upper-year hall by the Moon Field; the medical centre and its Restoration Spa; the old wall; the doorless tower on the cliff; the Edge; Sallow Pier, where the ferry comes in.' },
    { name: 'the Isle and the Edge', keys: ['cliff', 'cloud', 'ferry', 'pier', 'old wall', 'tower', 'bell tower', 'island'], priority: 6,
      text: 'The Isle is four miles long, wooded, with a lake in its middle, and it ends everywhere in cloud: the cliff path has a rail, and below the rail there is nothing to see but white, sometimes lit from beneath at dusk. The ferry comes in at Sallow Pier at seven in the morning and five in the afternoon and leaves the water a mile out. Weather is the Isle\'s own and often disagrees with the sky. Students say the seven bricked doors in the old wall lead nowhere, that the doorless tower on the cliff is a folly, that the bell in the tower is rung by the wind. Nobody goes to the Edge at night, for no reason anyone gives.' },
    { name: 'the Sundering, as people know it', keys: ['Sundering', 'history', 'sage', 'war', 'long ago', 'legend', 'myth'], priority: 6,
      text: 'Everyone knows that humans once had magic and lost it, thousands of years ago, in the Sundering; it is taught as history with no sources. The common tellings disagree: a war, a bargain, a punishment, a mercy; that the mythkin were spared, or were the cause; that the Isle is older than the Sundering, or was made by it. {npc_historian} teaches it as a set of questions and marks down anyone who answers with certainty. Most students find the subject dull; a few find it sore, and do not say why.' },
    { name: 'glamours and the world below', keys: ['glamour', 'mainland', 'human world', 'saw through', 'letter', 'invitation', 'scholarship'], priority: 5,
      text: 'In the world below every mythkin wears a glamour among humans: not invisibility but a suggestion the eye accepts (a hat, a coat, a tall person, a trick of the light). Almost no human sees through one. The ones who do tend, sooner or later, to get a letter with a seal and a ferry ticket; the university does not explain how it knows. On the Isle nobody bothers with a glamour, which is a relief to the mythkin and a shock to the new human, and the humans who go home for the holidays come back quiet.' },
    { name: 'classes and teachers', keys: ['class', 'lecture', 'lab', 'workshop', 'Glamour', 'Alchemy', 'Artificing', 'Wardcraft', 'sigil', 'Beastcraft', 'Mews', 'practice yard', 'timetable', 'study', 'Anatomy'], priority: 5,
      text: 'Glamour Theory: {npc_glamour_prof} ({npc_glamour_prof_race}) in the Glamour studio, where the mirrors lie; first-years learn to hold a small light and to see through someone else\'s. Applied Alchemy: {npc_alchemy_prof} ({npc_alchemy_prof_race}) in the labs; salts, cordials, a first sleep draught by week three. Artificing: {npc_artificing_master} (goblin) in the workshop under the engineering block; a warming charm is the first-year project. Wardcraft and Sigils: {npc_wardcraft_prof} (human, entirely, and formidable) in the practice yard; chalk circles first, salt lines second. Beastcraft: {npc_beastcraft_keeper} ({npc_beastcraft_keeper_race}, elderly) at the Mews; reading an animal before touching it. Comparative Mythkin Anatomy and the Sundering: {npc_historian} (human), the two ordinary courses. Classes run an hour; a first-year takes all of them lightly and is expected to choose two to pursue by midterm. Attendance is noticed, not enforced.' },
    { name: 'clubs and societies', keys: ['club', 'society', 'guild', 'circle', 'join', 'recruit', 'sign up', 'Moonrunner*', 'swim team', 'theatre', 'choir', 'Human Society', 'Alchemy Society', 'Sigil Circle'], priority: 5,
      text: 'Clubs teach what classes introduce, and every one recruits in the first fortnight. Artificers\' Guild (Mondays in the arcade, goblin-run), Sigil Circle (Tuesdays in the practice yard), Alchemy Society (Wednesdays in the labs, a still that is not entirely legal), Moonrunners (Tuesdays at dusk, wolves and whoever can keep up, {npc_moonrunners} captain), Aerie choir (Wednesdays, harpies and whoever else can hold a note), swim team (Thursdays, merfolk and anyone who can hold their breath), Human Society (Thursdays, tea, eleven members, {npc_human_society} presiding), theatre society and the fairy ring (Fridays, anyone who likes to be looked at), the Creamery (Saturdays, more a family than a club). Joining is a matter of turning up twice.' },
    { name: 'charms, curses and the Unpriced Table', keys: ['charm', 'charms', 'bracelet', 'pendant', 'locket', 'silver collar', 'torc', 'fox-fire bead', 'pearl', 'moonstone', 'jewellery', 'jewelry', 'curse', 'cursed', 'hex', 'trap', 'night market', 'Unpriced Table', 'feather-hex', 'tide-mark', 'fairy-ring mark'], priority: 4,
      text: 'Small made things carry a kind: a harpy\'s feather on a cord, a goblin copper bracelet, a mer-pearl, a fox-fire bead, a dryad\'s seed-pod pendant, a cat\'s-eye ring, a moonstone pin from the pack, a locket of fairy dust, an amber drop from the warren, a brass bell from the Creamery fair. Worn against the skin, each is a little of its kind every day; everyone knows it, they are given as gifts and meant as them, and come off when the wearer chooses. The Unpriced Table, a goblin stall at the far end of the Monday night market with no prices on it, sells pieces that cost something later: a tarnished silver collar that closes by itself, a ring of braided grey fur, a black feather pin that will not unpin, a torc of living green wood. Once worn they do not come off by hand and bite deeper each day; only a wardcraft unbinding at the third level or the Restoration Spa slips one off. Curses are rarer and shorter, a few days of a kind and then they lift (the Spa lifts them early): the feather-hex (a Sigil Circle prank, or a ward mis-sung in the Aerie), the pack\'s bite (a werewolf\'s bite in anger), the fairy-ring mark (the ring at midnight, or stepping in uninvited), the tide-mark (past the buoys after dark), a goblin debt unpaid, the fox\'s due (cheating a fox at their table). The fairy ring at the wrong hour touches a person with a kind all at once; the medical centre calls that a trap and treats it like any other contact.' },
    { name: 'the Restoration Spa', keys: ['spa', 'restoration', 'medical', 'reverse', 'undo', 'clinic', 'font', 'healing', 'heal me', 'cure', 'change back'], priority: 6,
      text: 'The Restoration Spa in the campus medical centre heals transformation, however long ago it happened: any one change (a tail, the ears, the nose, an appetite), one kind\'s whole set, the body\'s sex, or everything. Each visit is a warm mineral bath and an hour\'s sleep, and takes a change back one step, to the stage before; a part brought all the way back is the person\'s own again. Where taking one change back would leave another without what it grows from, the healer says so before the bath and both go back together. Bonds with people are not the Spa\'s to touch. Free, unlimited, no questions, open 08:00 to 22:00, {npc_physician} presiding. Some students use it weekly; some never; some go in meaning to reverse everything and keep one thing. Nobody judges, comments on or takes offence at another student\'s choice. The water is piped from a spring under the building that is older than the plumbing.' },
    { name: 'the mixer', keys: ['mixer', 'podium', 'orientation', 'speech', 'leaflet'], priority: 6,
      text: 'The cross-species mixer fills the central quad on orientation Monday from seven: lanterns in the bell tower, long tables from the dining hall, the Creamery cocoa stand, harpies on the tower ledges, merfolk at the fountain, goblins with a folding table of samples, fairies as a moving glitter, and everyone mixed in with everyone. {npc_dean} gives a short speech at half past seven and names the new human, which she considers a kindness and the human may not. Every society recruits; every species sends someone to meet the human.' },
    { name: 'the Dean', keys: ['Dean', 'chimera', 'collects', 'letters'], priority: 6,
      text: '{npc_dean} is Dean of Students and a chimera: antlers, scales, feathers, fur and more, worn as easily as a coat, of no single kind and plainly several, and nothing of her that is still human shows except her face. Nobody knows what she was before she was the Dean, and she has never been asked twice. The letters that bring the seeing humans to the Isle come from her office, and she is fond of the humans she collects in the way of someone who has collected a great many; she expects nothing of them, says so, and watches anyway. She encourages every student to explore and forbids the staff to cause anything, and never names transformation or the Spa in public: the most she says to a new human is that the Isle is not safe, and she does not say how. Some doors, she says, are closed for good reasons.' },
    { name: 'Kettle Hall and room 4B', keys: ['Kettle', 'dorm', 'room 4B', '4B', 'roommate', 'common room', 'piano', 'porter'], priority: 5,
      text: 'Kettle Hall is the mixed first-year dorm: four floors, shared rooms, a common room with a bad piano and the Human Society\'s Thursday tea, a porter ({npc_porter}) who has seen everything. Room 4B is on the top floor at the back, with a view of the lake and, past the lake, the place where the Isle stops and the cloud begins; two narrow beds; a radiator that works when it likes; the roommate\'s side already settled in the way of their kind. The roommate is {rm_name} ({rm_kind}).' },
    { name: 'the humans of Mythaven', keys: ['human', 'Human Society', 'stay human', 'scholarship', 'other humans'], priority: 5,
      text: 'A few dozen humans attend Mythaven, most of them upper-years, and each was invited the same way: a letter after seeing something they should not have seen. {npc_human_society} (fully human, runs the Human Society, Spa on principle), {npc_runner_human} ({npc_runner_human_looks}), {npc_far_human} ({npc_far_human_text}). Each made a different choice and none of them is a warning or an example; they get tired of being asked. {first} is the only human in this year\'s intake, which the Isle finds interesting for longer than a fortnight.' }
  ],

  // ---- Hidden lore. GM-only: released to the narrator by the engine as the player discovers things; never stated by anyone. ----
  secrets: {
    rule: '{first} never knows any of it until it is found.',
    hints: [
      'The bell in the tower rings once, some nights, with nobody at the rope.',
      'The old wall has seven doors bricked up and an eighth that is not bricked, only forgotten behind ivy.',
            'Somewhere in the cloud below the Edge there is sometimes a light, moving.',
      'Every human at Mythaven saw through a glamour once; none of them has compared notes.',
      'The doorless tower is warm on the north side in any weather.',
      'In the library the shelf on the Sundering holds seven books, and the seventh has no author and no words that stay still.'
    ],
    partial: {
      physician: 'calls the Spa water the font when nobody seems to be listening, and does not know where the word came from; the water is older than the plumbing.',
      historian: 'once wrote, to laughter, that the humans who see through glamours might share a bloodline, and has not written on it since.'
    },
    truth: [
      'Over six thousand years ago humans had magic and used it in a war that nearly ended everything. Seven human sages cast the Sundering: magic sealed away from humanity, leaving only the mythkin able to use it.',
      'The sages raised the Isle from the sea and hid it in cloud as the one place their work could be undone or made permanent. The university grew on it much later and knows almost none of this.',
      'Descendants of the sages carry an opening: they see through glamours, and their bodies answer other species\' magic, changing at the root. Every human invited to Mythaven is such a descendant; none of them knows it, and the university only knows that some humans see.',
      'The seven closed places are the sages\' trials, one for each failing that fed the war: wrath, pride, envy, greed, lust, gluttony, sloth. A descendant who finds and passes all seven reaches the Keel, the sages\' hall under the Isle, and the Choice.',
      'The Restoration Spa is the sages\' font, built for descendants who changed and wished to return.',
      'The descendants\' breadth in magic is the sages\' blood too: before the Sundering any human could learn any school, and a mythkin\'s element is what magic looks like bred into a kind rather than learned. A descendant who takes on a kind takes on its element too, ease and bar together; the Dean, who took them all, works every element and is bound by none, and tells nobody why.',
      'Descendants who changed fully and then gave way to a darker feeling kept changing, past any species, into monsters. The sages could not undo them, only house them: they are the guardians of the closed places, and each still remembers a name.',
      'The trials answer only to what is still human. A descendant who has taken too much of too many kinds cannot open a closed place or face its guardian, however strong their mind; the Restoration Spa gives that humanity back. The Dean is such a descendant: she found the places long ago and could not pass them, held her mind, became what she is, and needs a new sage.',
      'The Choice, in the Keel: unite the worlds (glamours end, the Isle is revealed, mythkin and humans live openly); return magic to humanity (the Sundering undone, with everything that led to it); end magic (the mythkin become human); or leave things as they are and let the Isle stay hidden.'
    ],
    keeper: { key: 'dean', text: 'alone knows all of this. A descendant herself, human once, she found the closed places long ago and could not pass them: she had taken too many kinds too fully, and the trials answer only to what is still human. She held her mind, so no guardian; she became a chimera of everything she took, and stopped there. The Isle needs a new sage and she cannot be it, so she keeps the Isle and collects the humans who see through glamours, hoping without expecting that one will do what she could not. Fond of them, she tells nobody what they have not earned: only after {first} does something of note in her sight or hearing (finds a closed place, faces a guardian, shows unusual courage, restraint or kindness) does she drop one hint, sideways and in her own words, never an explanation, then change the subject. Pressed unearned, she says that some doors are closed for good reasons, and means it kindly. She never says what she is or what she hopes.' }
  },

  // The seven closed places. Location and opening are GM knowledge from the start (so the narrator can play a discovery);
  // trial and guardian are sent once the place is found; the fragment once it is cleared. Flags: dungeon_<key>_found, _cleared.
  // Until the scene nears a place the narrator gets only its sin, key, name and `at`; where and opens come whole once a phrase of `keys` is
  // anywhere in play (the story too) or a word of `cues` is in the action, the director note, the location or who is present.
  dungeons: [
    { key: 'wrath', sin: 'Wrath', name: 'the Bell Cellar', at: 'under the bell tower', keys: ['trapdoor', 'cellar', 'bell rope', 'bell cellar', 'ring the bell', 'strike the bell', 'struck the bell', 'rang the bell'], cues: ['bell', 'bells', 'tower', 'rope'],
      where: 'under the bell tower on the quad; a trapdoor in the tower\'s ground floor, under the coiled bell rope, that nobody has reason to lift',
      opens: 'when someone strikes the bell by hand: the rope is tied off out of reach and the stair is locked, so it takes a climb and real anger to do it. The trapdoor is open afterwards until dawn.',
      trial: 'The cellar is a spiral of stone rooms, each warmer than the last, and in each {first} hears, in the voice of someone who wronged {them}, the thing that was said. Doors open only to someone who answers without raising their voice; a shout closes them. The trial is to reach the bottom without giving the place what it wants.',
      guardian: 'the Hound: what remains of a student who took the wolf all the way and let rage finish the work, a man-shaped thing of muscle and hackles the size of a door, who fights anything that comes down the stair and weeps between blows. It remembers being called Aldric, and stops, for a moment, if called by that name.',
      fragment: 'There were seven, and they were human. The Isle was raised, not found.' },
    { key: 'pride', sin: 'Pride', name: 'the Doorless Tower', at: 'the doorless tower on the cliff path', keys: ['doorless', 'tower with no door'], cues: ['tower', 'towers', 'cliff*', 'edge'],
      where: 'the tower on the cliff path with no door and no windows below the top floor, warm on the north side',
      opens: 'to anyone who stands at its foot and says aloud, honestly, one thing they cannot do. A door is there afterwards for that person only.',
      trial: 'Inside, the tower is mirrors, and every mirror is kind: it shows {first} taller, cleverer, further along, loved. The stair climbs only while {first} looks at the plain glass at the landing, which shows {them} exactly as {they} {are}. The trial is to climb without being flattered.',
      guardian: 'the Peacock: a descendant who took the harpy and could not bear to be less than perfect, now all plumage and no face, a fan of eyes that see every flaw. It cannot be fought where it can see itself; it can be fought with the mirrors turned.',
      fragment: 'The sages sealed magic away to end a war, and took the cost of it themselves, and it was not a small cost.' },
    { key: 'envy', sin: 'Envy', name: 'the Glass Orchard', at: 'the far end of the Greenhouse Quarter', keys: ['glass orchard', 'orchard', 'glasshouse'], cues: ['greenhouse*', 'ivy'],
      where: 'a glasshouse at the far end of the Greenhouse Quarter, gone wild inside, its door grown shut with ivy',
      opens: 'when someone gives away, at the door, a thing they truly want to keep; the ivy lets go for them.',
      trial: 'The orchard shows {first} what other people have: rooms full of it, warm and lit, each with a door that opens for the owner and not for {them}. The path goes on only past the rooms. The trial is to walk past them.',
      guardian: 'the Green Thing: a descendant who took the dryad and wanted everything everyone else had, now roots and reaching hands, a tree that walks by taking. It can be fought; it can also be given something, which is worse for it and better for {first}.',
      fragment: 'The sages\' blood carries an opening. Those who see through glamour are of it, and the Isle sends for them.' },
    { key: 'greed', sin: 'Greed', name: 'the Counting House', at: 'under the goblin arcade', keys: ['counting house', 'eighth door'], cues: ['arcade', 'market', 'wall', 'bricked'],
      where: 'under the goblin arcade, behind the eighth door in the old wall, the one that is not bricked but forgotten behind ivy at the arcade\'s back',
      opens: 'to anyone who pays the door a price they cannot get back: a thing of value left on the sill and not taken up again.',
      trial: 'Rooms of treasure that is real and can be carried out, and a way through that closes behind anyone carrying anything. The trial is to leave it all where it lies, including the thing that would solve a real problem.',
      guardian: 'the Hoard: a descendant who took the goblin and could not stop counting, now a mound that talks and offers, a pile of gold and hands that wants to give {first} anything and keep {them}. Fought, it scatters; bargained with, it lies.',
      fragment: 'The Spa is the sages\' font. It was built for those of the blood who changed and wished to return.' },
    { key: 'lust', sin: 'Lust', name: 'the Drowned Chapel', at: 'under the lake, off the merfolk pools', keys: ['drowned chapel', 'sunken chapel'], cues: ['chapel', 'drowned', 'sunken', 'pools', 'lakeshore', 'lake shore', 'swim*', 'dive', 'diving', 'night swim', 'to the lake', 'at the lake', 'by the lake', 'on the lake', 'across the lake', 'into the lake', 'in the lake'],
      where: 'under the lake, off the merfolk pools: a sunken chapel whose bell can be seen from the surface on a still day',
      opens: 'to anyone who goes into the lake at night with someone they trust and lets go of them at the bottom of the bell rope.',
      trial: 'The chapel is air below water, warm, and full of the pull of every species at once: something is offered plainly and freely, without claiming to know what {first} wants or whom {they} want{s}. The trial is to answer honestly and still leave by the far door.',
      guardian: 'the Siren: a descendant who took the mer and could not stop wanting to be wanted, beautiful past bearing and starving, who sings the door shut. It can be fought in the water, badly; it can be refused, which is harder.',
      fragment: 'Full change remakes the body and leaves the mind to hold; what the mind holds is what it becomes.' },
    { key: 'gluttony', sin: 'Gluttony', name: 'the Cold Larder', at: 'under the dining hall', keys: ['larder', 'pantry', 'cold room'], cues: ['cook', 'dining hall', 'dinner', 'feast*', 'fast', 'fasting', 'fasts'],
      where: 'under the dining hall, past the cook\'s cold room, a door at the back of the pantry that is always slightly open and never noticed',
      opens: 'to anyone who fasts through a feast: who sits the whole of a dinner with a full plate and eats nothing, and thanks the cook.',
      trial: 'A table that never empties, laid with rich food, warmth and time; the door on is at the far end of the table and the table is very long. The trial is to walk the length of it without eating.',
      guardian: 'the Glutton: a descendant who took the bovine and could not stop being fed, immense and kind and sorrowful, who wants only to give {first} a plate and hold {them} while {they} eat{s}. It does not fight; it embraces, and does not let go, and can be talked to.',
      fragment: 'The ones who changed and gave way did not stop changing. The sages could not undo them; they built these places to keep them, and to test the ones who came after.' },
    { key: 'sloth', sin: 'Sloth', name: 'the Sleeping Wing', at: 'Kettle Hall\'s east wing', keys: ['east wing', 'sleeping wing', 'papered'], cues: ['landing', 'fog'],
      where: 'the locked east wing of Kettle Hall on the top floor, behind a door papered over on the landing past room 4B',
      opens: 'on a night the Isle wants everyone asleep (a fog comes up from the cloud and the whole hall drowses): the door is there for anyone still awake at three.',
      trial: 'Rooms of beds, each warmer and softer than the last, a cat on every one, and a corridor that lengthens for anyone who hurries and shortens for anyone who lies down for a moment. The trial is to reach the end without resting.',
      guardian: 'the Sleeper: a descendant who took the cat and stopped bothering, warm and vast and purring, deadly to lie beside; it wants company and will take it forever. It cannot be fought lying down.',
      fragment: 'When all seven places have been passed, the stair from the Bell Cellar leads to the Keel. What is chosen there is chosen for everyone, human and mythkin, and cannot be chosen twice.' }
  ],

  choice: {
    text: 'With all seven closed places passed, the Keel opens: a stair from the Bell Cellar down through the rock of the Isle to a hall under the lake where seven chairs stand around a table of black glass and the cloud shows through the floor. Here {first} may choose, once, for everyone: unite the worlds (glamours end, the Isle is revealed, mythkin and humans live openly, and the changes {first} carries stay as they are); return magic to humanity (the Sundering undone; magic wakes in every human below, with everything that once came of it); end magic (the mythkin become human, the Isle settles into the sea as an ordinary island, and everything that made it strange is over); or leave things as they are and let the Isle stay hidden, and go back up the stair. Play the Keel as a scene like any other: the guardians\' names are carved on the chairs; anyone {first} brought down the stair may speak; the choice is made by an action, not announced. When it is made, write the consequence as it begins, then an epilogue turn, and set flags.keel_choice_made.'
  },

  // Style examples, one a scene (ordinary, intimate, change): paragraph length, share of speech and plain words to match;
  // their people, images and anatomy belong to them. The intimate one is one stage of an act, mid-act, on a bovine woman.
  exemplars: [
    { scene: 'ordinary', text: 'You ask what the charm costs, and the woman behind the stall whips it out of reach before the words are finished.\n\n"Depends." She leans on the counter, long dark-green fingers drumming, the hard nails clicking on the wood. "Money? No. Money\'s boring and it\'s always the wrong amount." Small sharp teeth show in a grin. "I take favours."\n\nShe jerks her chin at a slatted crate under the counter, roped shut. Something inside it shifts.\n\n"That goes to the stall at the far end of the arcade. What\'s in it is none of your business, and if it moves, let it. The woman who runs the stall is cross with me, so you\'ll have to be nice. You look nice. I\'ve decided."\n\n"It won\'t bite," she adds. "Mostly it sulks."\n\nShe hooks the charm round one finger and swings it under the lantern, the bead throwing green across her knuckles.\n\n"Carry it there. Hand it over. Say I said hello, and say nothing else. Then this is yours. Wear it against the skin, under the shirt."\n\nTwo stalls down a kettle starts to scream. Her big dark eyes narrow against the lantern glare, and one wide flat foot taps the boards, five long toes spread.\n\n"I close at midnight." She dangles the charm over the gap between you. "Tick tock."' },
    { scene: 'intimate', kind: 'cow', sex: 'female', text: 'You kneel on the boards between her knees and she opens them wider before you ask. The short coat on her inner thighs is warm against your cheeks.\n\n"Slowly," she says. "Not that slowly. I\'ve waited all day."\n\nYou start low on her thigh and work inward. She is already wet, and she smells of salt and warm skin. When your tongue reaches her she breathes in through her nose and holds it.\n\n"There. Stay there." A breath. "Good. You\'ve done this before."\n\nYou lick her pussy from the bottom up, flat and slow. Her hips lift off the bed to meet you, and one hand drops into your hair, two fingers and a thumb, each capped in smooth hoof, and pulls you in.\n\n"Harder. Yes. Like that. Don\'t you dare stop."\n\nAbove your forehead her udder moves with her breathing, small and round and low on her belly, bare-skinned among the coat, the four teats tight.\n\n"Look up at me," she says. "I want to watch you do it."\n\nYou close your mouth over her clit and suck. Her heels hook over your shoulders, hooves digging in, and the tuft of her tail thumps the mattress.\n\n"Fuck," she says, long and low. "Who taught you that? No. Don\'t tell me."\n\nHer free hand goes to her own breast and rolls the long thick nipple between finger and thumb until it stands.\n\n"Hold my thighs. I want to feel you hold on. Then give me your fingers. Two. I\'ll tell you where."' },
    { scene: 'change', text: 'The lamp clicks on and your roommate groans into her pillow.\n\n"Light," she says. "Some of us have a lecture at nine."\n\nYou hold your left arm under the bulb. It looks ordinary, a little flushed.\n\nThen the itch you have been ignoring since the wrist climbs another inch, deep under the skin, hot and prickling. You scratch. It makes no difference.\n\nThe skin is tight and feverish, and when you press a thumb into it, it throbs back.\n\n"If it\'s hives," she says into the pillow, "you\'re keeping them on your side of the room."\n\nThen the first one: a pinprick, a single hair pushing out through the skin at the back of your wrist. A second. A dozen.\n\nThey come one at a time, each a small hot point that stings and eases, fine and soft and pale at the root, until the back of the wrist is covered.\n\nYou press your palm over the place. The hair gives under it like felt, and the skin beneath is hotter than the rest of the arm. A shiver runs up through the shoulder, and your toes curl against the sheet.\n\n"You\'re panting," your roommate says. "Whatever it is, do it quietly."\n\nThe pricking climbs. By the time it slows, a soft down has spread halfway to the elbow, thick at the wrist and thinning out, and the whole stretch is warm. The palm and the inside of the wrist are bare.\n\n"Lamp," your roommate says. "Off. Or I\'m taking your pillow."\n\nOn the other wrist, the itch begins.' }
  ],

  // Style examples for an intimate scene's turns (one is chosen in place of an ordinary one): plain words, one move at a time, each
  // ending mid-act on the partner's question or invitation, leaving the next move to the player. Neither names or enters a genital,
  // so no body is presumed, and every verb of the roommate's agrees through {rm_s}/{rm_es}; nothing here is reused.
  sceneExemplars: [
    '{rm_First} lifts {rm_their} arms and you pull {rm_their} top over {rm_their} head, and it catches on an ear, and you both laugh. Then you stop laughing. Skin under your palms, warm, the breath going in and out beneath them. {rm_They} undo{rm_es} your belt without looking down, watching your face. You get the last of it off in a tangle and lie back, and {rm_their} weight comes down along you, bare skin from knee to shoulder. "Like this?" {rm_they} ask{rm_s} against your neck, and wait{rm_s}.',
    '{rm_They} roll{rm_s} you onto your back and straddle{rm_s} you, naked, and grind{rm_s} down against you, slow and hard. {rm_Their} hand slides between your legs and moves with {rm_their} hips. "Fuck," {rm_they} breathe{rm_s}, eyes shut. The bed takes the rhythm and gives it back, a half-beat late. "Slower than that?" {rm_they} ask{rm_s} against your jaw. "Or tell me what you want."'
  ],

  // Tracked items. Cravings are a spoiler (the player discovers changes); condition is how the body feels now, replaced each turn.
  // The body's changes are the engine's: it knows every waypoint told, and the State panel lists them.
  trackedItems: [
    { key: 'cravings', label: 'Cravings and habits', type: 'text', visibility: 'player', mode: 'auto', maxChars: 120, spoiler: true },
    { key: 'condition', label: 'Condition', type: 'text', visibility: 'player', mode: 'auto', maxChars: 120 },
    { key: 'romances', label: 'Romances', type: 'list', visibility: 'player', mode: 'auto', maxItems: 8 },
    { key: 'clubs', label: 'Clubs and societies', type: 'list', visibility: 'player', mode: 'auto', maxItems: 8 },
    { key: 'wearing', label: 'Wearing (gifts)', type: 'list', visibility: 'player', mode: 'auto', maxItems: 8 },
    { key: 'curses', label: 'Curses and marks', type: 'list', visibility: 'player', mode: 'auto', maxItems: 6 },
    { key: 'inventory', label: 'Carrying', type: 'list', visibility: 'player', mode: 'auto', maxItems: 20 },
    { key: 'spa_visits', label: 'Spa visits', type: 'number', min: 0, max: 99, visibility: 'player', mode: 'code' }
  ],
  // The everyday band per density, floor and ceiling, and above each the room: the words past the ceiling the writer may use when the
  // scene needs them (a look the action asks for, a first meeting, the opening, a change in the body, closeness). Neither is a quota.
  wordBands: { terse: [180, 320], standard: [240, 460], rich: [360, 640] },
  wordRoom: { terse: 420, standard: 610, rich: 850 },

  initialState: {
    day: 1, weekday: 'Monday', time: '17:40', location: 'Room 4B, Kettle Hall (top floor, back, view of the lake and the cloud beyond it)',
    present: ['{first}', '{rm_name}'],
    items: { cravings: 'nothing unusual yet', condition: 'well', romances: [], clubs: [], wearing: [], curses: [], inventory: ['a duffel bag', 'a phone with no signal', 'the letter with the seal', 'a jacket', 'forty dollars'], spa_visits: 0 },
    attitudes: {},
    flags: { attended_mixer: false, met_dean: false, joined_human_society: false, has_used_spa: false, danced_the_ring: false, been_to_the_edge: false,
      dungeon_wrath_found: false, dungeon_wrath_cleared: false, dungeon_pride_found: false, dungeon_pride_cleared: false, dungeon_envy_found: false, dungeon_envy_cleared: false, dungeon_greed_found: false, dungeon_greed_cleared: false, dungeon_lust_found: false, dungeon_lust_cleared: false, dungeon_gluttony_found: false, dungeon_gluttony_cleared: false, dungeon_sloth_found: false, dungeon_sloth_cleared: false, keel_choice_made: false }
  },

  memorySeed: {
    // Cast members {first} has already met at close range when the story opens (the key came from the porter's hand).
    met: ['porter'],
    // Days by number, never "today": every memory fold carries this text forward.
    summary: '{name}, nineteen and human, saw something in the world below three weeks before Day 1 that {they} could not explain, and was invited to Mythaven. {They} came up on the afternoon cloud ferry on Day 1 as the only human first-year, on a full scholarship, and met {their} roommate {rm_name} in room 4B of Kettle Hall on arrival. The cross-species mixer was set for seven that evening, on the quad.',
    events: [
      'Before Day 1: three weeks earlier, in the world below, {first} saw something {they} could not explain; four days later the letter came, with a seal, a ferry ticket and a scholarship.',
      'Day 1 16:00 {first} boards the afternoon ferry on the coast; a mile out the boat leaves the water and rises into cloud.',
      'Day 1 17:00 {first} lands at Sallow Pier and collects the key to room 4B from {npc_porter}, the Kettle Hall porter.',
      'Day 1 17:40 {first} reaches room 4B and meets roommate {rm_name}, {rm_kind}, second-year.'
    ],
    beats: [],
    facts: [
      '{name} is the only human first-year this year and holds a full scholarship.',
      '{first} rooms with {rm_name} ({rm_kind}, second-year) in room 4B, Kettle Hall, top floor.',
      'The cross-species mixer is on the central quad at 19:00 on Day 1; {npc_dean} speaks at 19:30.',
      'The Restoration Spa in the medical centre heals transformations free and without limit, one step a visit, any single change, a kind\'s whole set, the body\'s sex or everything, 08:00 to 22:00.',
      'The ferry to Sallow Pier leaves the water a mile out and climbs into cloud; the Isle is on no map.'
    ]
  },

  // Turn 0. {rm_intro} is written by the narrator from the generated roommate when the adventure begins (with a plain fallback).
  opening: {
    narrative: 'Room 4B is at the top of Kettle Hall where the stairs give up and become a ladder with ambitions, and the door is already open. The first thing you see is the view, because the window takes up most of the back wall and the lake is in it, flat and bright and enormous, and past the far shore the Isle simply stops, and there is cloud where the rest of the world should be, lit from below. The second thing you see is the other side of the room.\n\n{rm_intro}\n\nOutside, three floors below, somebody is stringing lanterns up the bell tower, and a woman with wings on the top ledge is holding the other end of the string in her foot and singing to herself.',
    suggestions: ['Say yes to whatever {rm_first} just offered.', 'Ask {rm_first} what to expect at the mixer.', 'Unpack first and ask what {rm_their} classes are like.'],
    events: ['Day 1 17:40 {rm_first} offers to walk {first} to the mixer at seven.'],
    beats: ['{first} reached room 4B and met {rm_name} ({rm_kind}, second-year), who offered to walk {them} to the mixer at seven.']
  }
};
