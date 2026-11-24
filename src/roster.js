// St. Michael's Choir School Recess Roster Pool & Team Uniforms
// Home Team: Maroon School Uniform + Slightly Darker Maroon Tie
// Away Team: Same Uniform worn UNDER a random set of colorful 80s/90s recess jackets!

export const UNIFORM_COLORS = {
  // Default everyday uniform: maroon shirt, slightly darker maroon tie, blue pants
  maroonShirt: '#872035',
  maroonShirtShade: '#6b1627',
  tie: '#4a0b17',           // Slightly darker maroon tie
  bluePants: '#234a85',     // Classic school uniform blue pants!

  // Optional Dress Uniform (Mass / concert days): maroon blazer, white shirt, tie, charcoal pants
  maroon: '#75182a',
  maroonShade: '#59101f',
  whiteShirt: '#f4f7fc',
  crest: '#e0b84c',
  dressPants: '#3a3f4b',
};

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

// Master pool of St. Michael's classmates — easy to add more players anytime!
export const CLASSMATES = [
  {
    name: 'PAES',
    skin: '#9c6644',       // Brown
    hair: '#161416',
    hairStyle: 'part',
    sneakers: '#1d222e',
    gloveColor: '#a65d2a',
    stats: { speed: 1.88, kick: 5.3, control: 0.91, hands: 0.90, reflex: 0.87 },
  },
  {
    name: 'KWONG',
    skin: '#f0cb9e',       // Chinese
    hair: '#141316',
    hairStyle: 'spiky',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    stats: { speed: 1.94, kick: 5.0, control: 0.94, hands: 0.93, reflex: 0.88 },
  },
  {
    name: 'MASANGKAY',
    skin: '#b97e54',       // Filipino
    hair: '#161416',
    hairStyle: 'messy',
    sneakers: '#e8ecf4',
    gloveColor: '#a65d2a',
    stats: { speed: 1.84, kick: 5.5, control: 0.90, hands: 0.92, reflex: 0.86 },
  },
  {
    name: 'STEVE',
    skin: '#f4c8a6',       // White
    hair: '#6e4120',
    hairStyle: 'part',
    sneakers: '#232836',
    gloveColor: '#7a3f1a',
    stats: { speed: 1.80, kick: 5.6, control: 0.88, hands: 0.86, reflex: 0.85 },
  },
  {
    name: 'BLAIR',
    skin: '#f6cfb4',       // White
    hair: '#b87a2e',
    hairStyle: 'messy',
    sneakers: '#ffffff',
    gloveColor: '#9c5425',
    stats: { speed: 1.86, kick: 5.2, control: 0.89, hands: 0.89, reflex: 0.87 },
  },
  {
    name: 'SEAN',
    skin: '#9a623f',       // Brown
    hair: '#1a1514',
    hairStyle: 'spiky',
    sneakers: '#1e2430',
    gloveColor: '#8c4b22',
    stats: { speed: 1.90, kick: 5.1, control: 0.87, hands: 0.91, reflex: 0.86 },
  },
  {
    name: 'DANIEL',
    skin: '#a16945',       // Brown
    hair: '#191514',
    hairStyle: 'part',
    sneakers: '#222633',
    gloveColor: '#a65d2a',
    stats: { speed: 1.78, kick: 5.1, control: 0.92, hands: 0.95, reflex: 0.91 },
  },
  {
    name: 'ADAM',
    skin: '#f3c8a8',       // White
    hair: '#c9933a',
    hairStyle: 'buzz',
    sneakers: '#ffffff',
    gloveColor: '#7a3f1a',
    stats: { speed: 1.82, kick: 5.4, control: 0.88, hands: 0.90, reflex: 0.89 },
  },
  {
    name: 'FIZZ',
    skin: '#f2c4a2',       // White
    hair: '#4a2f1d',
    hairStyle: 'spiky',
    sneakers: '#e8ecf4',
    gloveColor: '#9c5425',
    stats: { speed: 1.96, kick: 5.2, control: 0.91, hands: 0.88, reflex: 0.85 },
  },
  {
    name: 'LOWELL',
    skin: '#bd8258',       // Filipino
    hair: '#151316',
    hairStyle: 'part',
    sneakers: '#ffffff',
    gloveColor: '#a65d2a',
    stats: { speed: 1.89, kick: 5.5, control: 0.94, hands: 0.94, reflex: 0.90 },
  },
  {
    name: 'JIMMY',
    skin: '#f3c7a6',       // White
    hair: '#5e3820',
    hairStyle: 'spiky',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    stats: { speed: 1.91, kick: 5.3, control: 0.90, hands: 0.89, reflex: 0.86 },
  },
  {
    name: 'AVERY',
    skin: '#6b4028',       // Black
    hair: '#121114',
    hairStyle: 'buzz',
    sneakers: '#232836',
    gloveColor: '#a65d2a',
    stats: { speed: 1.87, kick: 5.2, control: 0.93, hands: 0.92, reflex: 0.88 },
  },
  {
    name: 'RICH',
    skin: '#f2c6a4',       // White
    hair: '#5c381c',
    hairStyle: 'buzz',
    sneakers: '#1d222e',
    gloveColor: '#7a3f1a',
    stats: { speed: 1.83, kick: 5.7, control: 0.89, hands: 0.90, reflex: 0.87 },
  },
  {
    name: 'JOHNNY ZORRO',
    skin: '#b87c52',       // Filipino
    hair: '#151316',
    hairStyle: 'messy',
    sneakers: '#ffffff',
    gloveColor: '#9c5425',
    stats: { speed: 1.95, kick: 5.5, control: 0.93, hands: 0.91, reflex: 0.88 },
  },
  {
    name: 'ISTVAN',
    skin: '#f5ccb0',       // White
    hair: '#785028',
    hairStyle: 'messy',
    sneakers: '#2a2e38',
    gloveColor: '#6e3d1e',
    // Undisputed worst player in the game by a fair margin!
    stats: { speed: 1.28, kick: 3.4, control: 0.42, hands: 0.38, reflex: 0.36 },
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

// Pick any collection of 8 classmates (4 HOME maroon uniforms vs 4 AWAY colorful jackets),
// plus return the remaining undrafted classmates to populate the two corner basketball games!
export function draftRecessTeams(rng = Math.random) {
  const pool = shuffled(CLASSMATES, rng);
  const picked = pool.slice(0, 8);
  const undraftedPlayers = pool.slice(8).map((mate) => ({
    ...mate,
    stats: { ...mate.stats },
  }));
  const jacketChoices = shuffled(JACKET_PALETTE, rng);

  const homePlayers = picked.slice(0, 4).map((mate, i) => {
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

  const awayPlayers = picked.slice(4, 8).map((mate, i) => {
    const coat = jacketChoices[i % jacketChoices.length];
    const shield = jacketChoices[(i + 2) % jacketChoices.length];
    return {
      ...mate,
      id: `a_${ROLE_SUFFIX[i]}`,
      role: ROLES[i],
      wearsJacket: true, // Wearing the maroon uniform + tie UNDER a random colorful jacket!
      coatColor: coat.color,
      coatTrim: coat.trim,
      jacketColor: shield.color,
      jacketTrim: shield.trim,
      stats: { ...mate.stats },
    };
  });

  return { homePlayers, awayPlayers, undraftedPlayers };
}

const initialDraft = draftRecessTeams();

export const TEAMS = {
  undrafted: initialDraft.undraftedPlayers,
  home: {
    id: 'home',
    name: 'HOME',
    short: 'HOME',
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
    name: 'AWAY',
    short: 'AWAY',
    primary: '#1f78d1',                  // HUD accent color (on-court kids wear random jacket colors!)
    tieColor: UNIFORM_COLORS.tie,        // Uniform & darker maroon tie peeking out underneath!
    secondary: UNIFORM_COLORS.whiteShirt,
    trim: '#ffd84d',
    ringColor: '#48c6ff',
    wearsJacket: true,
    players: initialDraft.awayPlayers,
  },
};
