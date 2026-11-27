// St. Michael's Choir School Recess Roster Pool & Team Uniforms
// Home Team: Maroon School Uniform + Slightly Darker Maroon Tie
// Away Team: Same Uniform worn UNDER a random set of colorful 80s/90s recess jackets!

export const UNIFORM_COLORS = {
  // Default everyday uniform: maroon shirt, slightly darker maroon tie, blue pants
  maroonShirt: '#872035',
  maroonShirtShade: '#6b1627',
  tie: '#4a0b17',           // Slightly darker maroon tie
  bluePants: '#234a85',     // Classic school uniform blue pants!

  // Optional Dress Uniform (Mass / concert days): maroon blazer, white shirt, maroon tie, grey pants
  // (CPU wears dress uniform without blazer — white shirt, maroon tie, grey pants — when USER wears default!)
  maroon: '#75182a',
  maroonShade: '#59101f',
  whiteShirt: '#f4f7fc',
  whiteShirtShade: '#cdd6e6',
  dressTie: '#7d1a2e',      // Crisp maroon tie popping cleanly against the white shirt
  crest: '#e0b84c',
  dressPants: '#828b9c',    // Classic St. Mike's school-uniform grey trousers
};

// Resolve which St. Mike's uniform kit a player wears based on team & user uniformMode:
// - REGULAR ('default'): USER wears maroon/blue; CPU wears white-shirt dress (no blazer); corner hoops wear maroon/blue
// - DRESS ('dress'):     USER wears maroon blazer/grey; CPU wears maroon/blue; corner hoops wear white-shirt dress (no blazer)
export function resolveUniformKit(team, uniformMode = 'default') {
  const isDress = uniformMode === 'dress';
  if (team === 'hoops') {
    return isDress ? 'dress_no_blazer' : 'default';
  }
  if (team === 'away') {
    return isDress ? 'default' : 'dress_no_blazer';
  }
  return isDress ? 'dress_blazer' : 'default';
}

// Vibrant non-maroon 80s/90s schoolyard jackets (guaranteed distinct from maroon uniforms!)
export const JACKET_PALETTE = [
  { color: '#1f78d1', trim: '#124b8a' }, // Royal blue bomber
  { color: '#22a05b', trim: '#146638' }, // Forest green parka
  { color: '#e0961b', trim: '#9c620a' }, // Mustard gold varsity
  { color: '#1b9aaa', trim: '#0f626e' }, // 80s/90s teal windbreaker
  { color: '#7b4bd6', trim: '#4f2c96' }, // Purple puffer
  { color: '#e86826', trim: '#a34112' }, // Bright orange anorak
  { color: '#3b9ae1', trim: '#236499' }, // Sky blue ski jacket
  { color: '#47b847', trim: '#2a782a' }, // Kelly green windbreaker
];

// Master pool of St. Michael's classmates — authentic 66 Bond recess scouting report!
// preferredRole: 'G' slots Lowell & Masangkay in net (one per team!) whenever recess teams are drafted.
export const CLASSMATES = [
  {
    name: 'PAES',
    thin: true,
    skin: '#9c6644',       // Brown
    hair: '#161416',
    hairStyle: 'part',
    glasses: true,
    sneakers: '#1d222e',
    gloveColor: '#a65d2a',
    // Excellent ball control, not much else
    stats: { speed: 1.72, kick: 4.75, control: 0.97, hands: 0.78, reflex: 0.76, checking: 0.68 },
  },
  {
    name: 'KWONG',
    thin: true,
    skin: '#f0cb9e',       // Chinese
    hair: '#141316',
    hairStyle: 'spiky',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    stats: { speed: 1.85, kick: 5.05, control: 0.85, hands: 0.84, reflex: 0.80, checking: 0.76 },
  },
  {
    name: 'MASANGKAY',
    preferredRole: 'G',    // One of the two best goaltenders — starts in net!
    short: true,
    thin: true,
    skin: '#b97e54',       // Filipino
    hair: '#161416',
    hairStyle: 'messy',
    sneakers: '#e8ecf4',
    gloveColor: '#a65d2a',
    stats: { speed: 1.82, kick: 5.15, control: 0.84, hands: 0.95, reflex: 0.95, checking: 0.82 },
  },
  {
    name: 'STEVE',
    skin: '#f4c8a6',       // White
    hair: '#6e4120',
    hairStyle: 'part',
    sneakers: '#232836',
    gloveColor: '#7a3f1a',
    stats: { speed: 1.81, kick: 5.20, control: 0.82, hands: 0.82, reflex: 0.80, checking: 0.82 },
  },
  {
    name: 'BLAIR',
    skin: '#f6cfb4',       // White
    hair: '#b87a2e',
    hairStyle: 'messy',
    sneakers: '#ffffff',
    gloveColor: '#9c5425',
    // Good all-around athlete
    stats: { speed: 1.92, kick: 5.50, control: 0.89, hands: 0.90, reflex: 0.86, checking: 0.88 },
  },
  {
    name: 'SEAN',
    skin: '#9a623f',       // Brown
    hair: '#1a1514',
    hairStyle: 'spiky',
    glasses: true,
    sneakers: '#1e2430',
    gloveColor: '#8c4b22',
    stats: { speed: 1.84, kick: 5.10, control: 0.83, hands: 0.84, reflex: 0.80, checking: 0.78 },
  },
  {
    name: 'DANIEL',
    skin: '#a16945',       // Brown
    hair: '#191514',
    hairStyle: 'part',
    sneakers: '#222633',
    gloveColor: '#a65d2a',
    ballHog: true,         // Hidden Easter egg: refuses to pass as AI!
    staysDown: true,       // Hidden Easter egg: stays dramatically sprawled when body-checked!
    // Good forward, though not especially fast
    stats: { speed: 1.73, kick: 5.55, control: 0.91, hands: 0.91, reflex: 0.82, checking: 0.84 },
  },
  {
    name: 'ADAM',
    skin: '#f3c8a8',       // White
    hair: '#c9933a',
    hairStyle: 'buzz',
    sneakers: '#ffffff',
    gloveColor: '#7a3f1a',
    noDefense: true,       // Hidden Easter egg: refuses to hustle back on defense — cherry-picks upfield!
    stats: { speed: 1.82, kick: 5.15, control: 0.82, hands: 0.83, reflex: 0.81, checking: 0.80 },
  },
  {
    name: 'FIZZ',
    short: true,
    skin: '#f2c4a2',       // White
    hair: '#4a2f1d',
    hairStyle: 'spiky',
    glasses: true,
    sneakers: '#e8ecf4',
    gloveColor: '#9c5425',
    // Below average, though much better than Istvan
    stats: { speed: 1.62, kick: 4.50, control: 0.68, hands: 0.66, reflex: 0.66, checking: 0.62 },
  },
  {
    name: 'LOWELL',
    preferredRole: 'G',    // One of the two best goaltenders — starts in net!
    short: true,
    skin: '#bd8258',       // Filipino
    hair: '#151316',
    hairStyle: 'part',
    glasses: true,
    sneakers: '#ffffff',
    gloveColor: '#a65d2a',
    stats: { speed: 1.84, kick: 5.10, control: 0.85, hands: 0.96, reflex: 0.96, checking: 0.80 },
  },
  {
    name: 'JIMMY',
    short: true,
    skin: '#f3c7a6',       // White
    hair: '#5e3820',
    hairStyle: 'spiky',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    stats: { speed: 1.85, kick: 5.15, control: 0.84, hands: 0.83, reflex: 0.80, checking: 0.78 },
  },
  {
    name: 'AVERY',
    skin: '#6b4028',       // Black
    hair: '#121114',
    hairStyle: 'buzz',
    sneakers: '#232836',
    gloveColor: '#a65d2a',
    cageKicker: true,      // Hidden Easter egg: kicks the right-wall wire cage during scrambles to try to steal a goal!
    // Fastest on 66 Bond with legit soccer skills — best pure foot hockey player!
    stats: { speed: 2.04, kick: 5.75, control: 0.96, hands: 0.90, reflex: 0.85, checking: 0.82 },
  },
  {
    name: 'RICH',
    preferredRole: 'HOOPS', // Permanent corner basketball regular alongside Ernie & Sanford!
    skin: '#f2c6a4',       // White
    hair: '#5c381c',
    hairStyle: 'buzz',
    sneakers: '#1d222e',
    gloveColor: '#7a3f1a',
    stats: { speed: 1.80, kick: 5.25, control: 0.82, hands: 0.83, reflex: 0.80, checking: 0.83 },
  },
  {
    name: 'JOHNNY ZORRO',
    skin: '#b87c52',       // Filipino
    hair: '#151316',
    hairStyle: 'messy',
    sneakers: '#ffffff',
    gloveColor: '#9c5425',
    // Good all-around athlete
    stats: { speed: 1.94, kick: 5.45, control: 0.90, hands: 0.91, reflex: 0.86, checking: 0.86 },
  },
  {
    name: 'ISTVAN',
    beefy: true,
    skin: '#f5ccb0',       // White
    hair: '#785028',
    hairStyle: 'messy',
    sneakers: '#2a2e38',
    gloveColor: '#6e3d1e',
    scaredOfBall: true,    // Hidden Easter egg: literally scared of the tennis ball!
    // Undisputed worst player in the game by a fair margin!
    stats: { speed: 1.28, kick: 3.40, control: 0.42, hands: 0.38, reflex: 0.36, checking: 0.35 },
  },
  {
    name: 'ERNIE',
    preferredRole: 'HOOPS', // Permanent corner basketball regular on 66 Bond!
    skin: '#ba7f55',       // Filipino
    hair: '#151316',
    hairStyle: 'part',
    sneakers: '#ffffff',
    gloveColor: '#9c5425',
    stats: { speed: 1.84, kick: 5.05, control: 0.85, hands: 0.88, reflex: 0.82, checking: 0.78 },
  },
  {
    name: 'PONESSE',
    tall: true,            // Tall, athletic powerhouse — even with Blair, but stronger!
    skin: '#f5ccb0',       // White
    hair: '#694022',
    hairStyle: 'part',
    sneakers: '#1d222e',
    gloveColor: '#8c4b22',
    stats: { speed: 1.91, kick: 5.65, control: 0.88, hands: 0.90, reflex: 0.86, checking: 0.96 },
  },
  {
    name: 'DEREK',
    skin: '#f0ca9e',       // Asian
    hair: '#141316',
    hairStyle: 'part',
    glasses: true,
    sneakers: '#e8ecf4',
    gloveColor: '#8c4b22',
    stats: { speed: 1.83, kick: 5.15, control: 0.83, hands: 0.83, reflex: 0.80, checking: 0.79 },
  },
  {
    name: 'CHUNG',
    skin: '#eec89c',       // Asian
    hair: '#131215',
    hairStyle: 'buzz',
    glasses: true,
    sneakers: '#ffffff',
    gloveColor: '#7a3f1a',
    criesWhenHit: true,    // Hidden Easter egg: might sit down and cry when body-checked!
    stats: { speed: 1.84, kick: 5.10, control: 0.84, hands: 0.84, reflex: 0.81, checking: 0.77 },
  },
  {
    name: 'KEVIN',
    thin: true,
    skin: '#683e26',       // Black
    hair: '#121114',
    hairStyle: 'buzz',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    // Fastest kid on 66 Bond, pure wheels, otherwise raw/unskilled
    stats: { speed: 2.12, kick: 4.35, control: 0.65, hands: 0.65, reflex: 0.65, checking: 0.62 },
  },
  {
    name: 'BRENDAN',
    tall: true,
    beefy: true,           // Towering beast on the boards — strongest kid in the yard, slow & raw
    skin: '#f6cfb6',       // White
    hair: '#c2411a',       // Red hair
    hairStyle: 'messy',
    sneakers: '#232836',
    gloveColor: '#7a3f1a',
    stats: { speed: 1.56, kick: 4.45, control: 0.64, hands: 0.62, reflex: 0.62, checking: 1.00 },
  },
  {
    name: 'BAKER',
    preferredRole: 'G',    // Big, husky goalie regular — similar build to Brendan, average skill, not as strong
    beefy: true,
    skin: '#f5ccb0',       // White
    hair: '#784e28',
    hairStyle: 'part',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    stats: { speed: 1.58, kick: 5.05, control: 0.80, hands: 0.90, reflex: 0.89, checking: 0.86 },
  },
  {
    name: 'LEN',
    skin: '#efca9e',       // Asian
    hair: '#141316',
    hairStyle: 'part',
    glasses: true,
    sneakers: '#1d222e',
    gloveColor: '#7a3f1a',
    // Generally unskilled, though still well ahead of Istvan
    stats: { speed: 1.66, kick: 4.35, control: 0.65, hands: 0.64, reflex: 0.64, checking: 0.62 },
  },
  {
    name: 'SANFORD',
    preferredRole: 'HOOPS', // Permanent corner basketball regular on 66 Bond alongside Ernie!
    skin: '#efca9e',       // Asian
    hair: '#141316',
    hairStyle: 'part',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    stats: { speed: 1.83, kick: 5.10, control: 0.84, hands: 0.88, reflex: 0.81, checking: 0.78 },
  },
  {
    name: 'TAYLOR',
    tall: true,
    skin: '#f2cba2',       // White / Asian
    hair: '#241b16',
    hairStyle: 'part',
    glasses: true,
    sneakers: '#e8ecf4',
    gloveColor: '#7a3f1a',
    // Tall, glasses, generally unskilled (still well ahead of Istvan)
    stats: { speed: 1.65, kick: 4.40, control: 0.65, hands: 0.64, reflex: 0.64, checking: 0.66 },
  },
  {
    name: 'ARPAD',
    skin: '#f3c9a8',       // White
    hair: '#4f321c',
    hairStyle: 'part',
    sneakers: '#232836',
    gloveColor: '#8c4b22',
    longBomber: true,      // Hidden Easter egg: loves ripping booming, laser-accurate shots from deep!
    // Faster & harder shot than average, otherwise unskilled
    stats: { speed: 1.94, kick: 5.55, control: 0.66, hands: 0.65, reflex: 0.65, checking: 0.66 },
  },
  {
    name: 'BRINGAS',
    skin: '#ba7e53',       // Filipino
    hair: '#ba7e53',
    hairStyle: 'bald',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    // Average build/height, bald, mediocre stats across the board
    stats: { speed: 1.70, kick: 4.65, control: 0.72, hands: 0.71, reflex: 0.70, checking: 0.70 },
  },
  {
    name: 'JAMIE',
    skin: '#f4c9a8',       // White
    hair: '#5e3c20',
    hairStyle: 'part',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    // Solid average player across the board
    stats: { speed: 1.82, kick: 5.15, control: 0.82, hands: 0.82, reflex: 0.80, checking: 0.80 },
  },
  {
    name: 'LOUIE',
    short: true,
    skin: '#efca9e',       // Asian
    hair: '#141316',
    hairStyle: 'part',
    glasses: true,
    sneakers: '#1d222e',
    gloveColor: '#7a3f1a',
    // Short, glasses, right around Fizz level (still well ahead of Istvan)
    stats: { speed: 1.63, kick: 4.48, control: 0.67, hands: 0.66, reflex: 0.65, checking: 0.62 },
  },
];

function shuffled(arr, rng = Math.random) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ROLES = ['C', 'LW', 'RW', 'G'];
const ROLE_SUFFIX = ['c', 'lw', 'rw', 'g'];

function assembleTeams(homeRoster, awayRoster, undraftedPlayers, rng = Math.random) {
  const jacketChoices = shuffled(JACKET_PALETTE, rng);

  const homePlayers = homeRoster.map((mate, i) => {
    const shield = jacketChoices[(i + 4) % jacketChoices.length];
    return {
      ...mate,
      id: `h_${ROLE_SUFFIX[i]}`,
      role: ROLES[i],
      wearsJacket: false, // Maroon school uniform + darker maroon tie!
      coatColor: null,
      coatTrim: null,
      // Goalie holds a recess jacket as a blocker shield + baseball glove!
      jacketColor: shield.color,
      jacketTrim: shield.trim,
      stats: { ...mate.stats },
    };
  });

  const awayPlayers = awayRoster.map((mate, i) => {
    const shield = jacketChoices[(i + 2) % jacketChoices.length];
    return {
      ...mate,
      id: `a_${ROLE_SUFFIX[i]}`,
      role: ROLES[i],
      wearsJacket: false, // Contrasting St. Mike's uniform (dress without blazer vs default)!
      coatColor: null,
      coatTrim: null,
      jacketColor: shield.color,
      jacketTrim: shield.trim,
      stats: { ...mate.stats },
    };
  });

  return { homePlayers, awayPlayers, undraftedPlayers };
}

// Pick 8 classmates (4 HOME maroon uniforms vs 4 AWAY colorful jackets),
// automatically slotting dedicated goaltenders (Lowell & Masangkay) into the two Goalie creases!
// Permanent basketball regulars (Ernie) + random undrafted classmates populate the two corner basketball games!
export function draftRecessTeams(rng = Math.random) {
  const hoopsRegulars = CLASSMATES.filter((c) => c.preferredRole === 'HOOPS');
  const goalies = shuffled(
    CLASSMATES.filter((c) => c.preferredRole === 'G'),
    rng
  );
  const skaters = shuffled(
    CLASSMATES.filter((c) => c.preferredRole !== 'G' && c.preferredRole !== 'HOOPS'),
    rng
  );

  // Assign two of the natural goalies (Lowell, Masangkay, Baker) randomly to Home G and Away G!
  const homeGoalie = goalies[0] || skaters.pop();
  const awayGoalie = goalies[1] || skaters.pop();
  const skaterPool = shuffled([...skaters, ...goalies.slice(2)], rng);
  const pickedSkaters = skaterPool.slice(0, 6);
  const randomUndrafted = skaterPool.slice(6);
  const undraftedPlayers = [...hoopsRegulars, ...randomUndrafted].map((mate) => ({
    ...mate,
    stats: { ...mate.stats },
  }));

  const homeRoster = [...pickedSkaters.slice(0, 3), homeGoalie];
  const awayRoster = [...pickedSkaters.slice(3, 6), awayGoalie];
  return assembleTeams(homeRoster, awayRoster, undraftedPlayers, rng);
}

// Build custom player-chosen HOME & AWAY lineups (4 names each: [C, LW, RW, G]),
// automatically sending permanent hoops regulars (if unpicked) + remaining classmates to corner basketball!
export function buildCustomTeams(homeNames, awayNames, rng = Math.random) {
  const byName = new Map(CLASSMATES.map((c) => [c.name, c]));
  const used = new Set();
  const resolveSlot = (name) => {
    const found = byName.get(name);
    if (found && !used.has(found.name)) {
      used.add(found.name);
      return found;
    }
    const fallback = CLASSMATES.find((c) => !used.has(c.name)) || CLASSMATES[0];
    used.add(fallback.name);
    return fallback;
  };

  const homeRoster = [0, 1, 2, 3].map((i) => resolveSlot(homeNames?.[i]));
  const awayRoster = [0, 1, 2, 3].map((i) => resolveSlot(awayNames?.[i]));
  const unpicked = CLASSMATES.filter((c) => !used.has(c.name));
  const unpickedHoops = unpicked.filter((c) => c.preferredRole === 'HOOPS');
  const unpickedOthers = shuffled(
    unpicked.filter((c) => c.preferredRole !== 'HOOPS'),
    rng
  );
  const undraftedPlayers = [...unpickedHoops, ...unpickedOthers].map((mate) => ({
    ...mate,
    stats: { ...mate.stats },
  }));

  return assembleTeams(homeRoster, awayRoster, undraftedPlayers, rng);
}

const initialDraft = draftRecessTeams();

export const TEAMS = {
  undrafted: initialDraft.undraftedPlayers,
  home: {
    id: 'home',
    name: 'USER',
    short: 'USER',
    primary: UNIFORM_COLORS.maroonShirt, // Everyday maroon uniform shirt!
    tieColor: UNIFORM_COLORS.tie,        // Slightly darker maroon tie
    secondary: UNIFORM_COLORS.whiteShirt,
    trim: UNIFORM_COLORS.crest,
    ringColor: '#ff7090',
    wearsJacket: false,
    players: initialDraft.homePlayers,
  },
  away: {
    id: 'away',
    name: 'CPU',
    short: 'CPU',
    primary: '#1f78d1',                  // HUD accent color (on-court kids wear random jacket colors!)
    tieColor: UNIFORM_COLORS.tie,        // Uniform & darker maroon tie peeking out underneath!
    secondary: UNIFORM_COLORS.whiteShirt,
    trim: '#ffd84d',
    ringColor: '#48c6ff',
    wearsJacket: false,
    players: initialDraft.awayPlayers,
  },
};
