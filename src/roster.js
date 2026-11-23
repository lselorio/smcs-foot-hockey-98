// St. Michael's Choir School Recess Roster Pool & Team Uniforms
// Home Team: Maroon School Uniform + Slightly Darker Maroon Tie
// Away Team: Same Uniform worn UNDER a random set of colorful 80s/90s recess jackets!

export const UNIFORM_COLORS = {
  maroon: '#7c1c2e',      // Classic school uniform maroon blazer/sweater
  maroonShade: '#611322', // Subtle lapel shading
  tie: '#460a16',         // Slightly darker maroon school tie!
  shirt: '#f4f7fc',       // Crisp white dress shirt collar
  crest: '#e0b84c',       // Gold school crest dot
  pants: '#3a3f4b',       // Charcoal uniform trousers
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
    number: 7,
    skin: '#d99e73',
    hair: '#1e1815',
    hairStyle: 'part',
    sneakers: '#1d222e',
    gloveColor: '#a65d2a',
    stats: { speed: 1.88, kick: 5.3, control: 0.91, hands: 0.90, reflex: 0.87 },
  },
  {
    name: 'KWONG',
    number: 11,
    skin: '#f0c6a2',
    hair: '#151416',
    hairStyle: 'spiky',
    sneakers: '#ffffff',
    gloveColor: '#8c4b22',
    stats: { speed: 1.94, kick: 5.0, control: 0.94, hands: 0.93, reflex: 0.88 },
  },
  {
    name: 'MASANGKAY',
    number: 24,
    skin: '#cfa07a',
    hair: '#181414',
    hairStyle: 'messy',
    sneakers: '#e8ecf4',
    gloveColor: '#a65d2a',
    stats: { speed: 1.84, kick: 5.5, control: 0.90, hands: 0.92, reflex: 0.86 },
  },
  {
    name: 'STEVE',
    number: 19,
    skin: '#f2c49e',
    hair: '#6e4120',
    hairStyle: 'part',
    sneakers: '#232836',
    gloveColor: '#7a3f1a',
    stats: { speed: 1.80, kick: 5.6, control: 0.88, hands: 0.86, reflex: 0.85 },
  },
  {
    name: 'BLAIR',
    number: 8,
    skin: '#f4cbb0',
    hair: '#b87a2e',
    hairStyle: 'messy',
    sneakers: '#ffffff',
    gloveColor: '#9c5425',
    stats: { speed: 1.86, kick: 5.2, control: 0.89, hands: 0.89, reflex: 0.87 },
  },
  {
    name: 'SEAN',
    number: 22,
    skin: '#ecc09d',
    hair: '#8f4722',
    hairStyle: 'spiky',
    sneakers: '#1e2430',
    gloveColor: '#8c4b22',
    stats: { speed: 1.90, kick: 5.1, control: 0.87, hands: 0.91, reflex: 0.86 },
  },
  {
    name: 'DANIEL',
    number: 1,
    skin: '#e8b690',
    hair: '#3b2618',
    hairStyle: 'part',
    sneakers: '#222633',
    gloveColor: '#a65d2a',
    stats: { speed: 1.78, kick: 5.1, control: 0.92, hands: 0.95, reflex: 0.91 },
  },
  {
    name: 'ADAM',
    number: 30,
    skin: '#f1c5a4',
    hair: '#c9933a',
    hairStyle: 'buzz',
    sneakers: '#ffffff',
    gloveColor: '#7a3f1a',
    stats: { speed: 1.82, kick: 5.4, control: 0.88, hands: 0.90, reflex: 0.89 },
  },
  {
    name: 'FIZZ',
    number: 14,
    skin: '#dba57c',
    hair: '#241a15',
    hairStyle: 'spiky',
    sneakers: '#e8ecf4',
    gloveColor: '#9c5425',
    stats: { speed: 1.96, kick: 5.2, control: 0.91, hands: 0.88, reflex: 0.85 },
  },
  {
    name: 'LOWELL',
    number: 98,
    skin: '#d9a178',
    hair: '#1a1514',
    hairStyle: 'part',
    sneakers: '#ffffff',
    gloveColor: '#a65d2a',
    stats: { speed: 1.89, kick: 5.5, control: 0.94, hands: 0.94, reflex: 0.90 },
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

// Pick any collection of 8 classmates (4 Maroon Uniforms vs 4 Colorful Jackets)
export function draftRecessTeams(rng = Math.random) {
  const picked = shuffled(CLASSMATES, rng).slice(0, 8);
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

  return { homePlayers, awayPlayers };
}

const initialDraft = draftRecessTeams();

export const TEAMS = {
  home: {
    id: 'home',
    name: 'MAROONS',
    short: 'MARN',
    primary: UNIFORM_COLORS.maroon,      // Maroon school uniform!
    tieColor: UNIFORM_COLORS.tie,        // Slightly darker maroon tie
    secondary: UNIFORM_COLORS.shirt,
    trim: UNIFORM_COLORS.crest,
    ringColor: '#ff7090',
    wearsJacket: false,
    players: initialDraft.homePlayers,
  },
  away: {
    id: 'away',
    name: 'JACKETS',
    short: 'JCKT',
    primary: '#1f78d1',                  // HUD accent color (on-court kids wear random jacket colors!)
    tieColor: UNIFORM_COLORS.tie,        // Uniform & darker maroon tie peeking out underneath!
    secondary: UNIFORM_COLORS.shirt,
    trim: '#ffd84d',
    ringColor: '#48c6ff',
    wearsJacket: true,
    players: initialDraft.awayPlayers,
  },
};
