// Authentic 16-bit Genesis/SNES virtual resolution
export const SCREEN_W = 320;
export const SCREEN_H = 240;
export const HUD_H = 24;
export const VIEW_H = SCREEN_H - HUD_H;

// Vertical schoolyard court dimensions (NHL '94 3/4 vertical camera)
export const WORLD_W = 320;
export const WORLD_H = 440;

// Playable asphalt boundaries inside the schoolyard fence/curb
export const COURT = {
  left: 26,
  right: 294,
  top: 44,
  bottom: 396,
  centerX: 160,
  centerY: 220,
  cornerRadius: 24,
};

// Makeshift recess goals (backpacks/cones marking posts against fence/chalk line)
export const GOAL = {
  width: 68,
  depth: 16,
  height: 22, // Max ball Z height that counts under crossbar / head-high rule
  leftX: COURT.centerX - 34,
  rightX: COURT.centerX + 34,
  topLineY: COURT.top + 14,      // Away (CPU) goal line (Player shoots UP toward this!)
  bottomLineY: COURT.bottom - 14, // Home (Player) goal line (CPU shoots DOWN toward this!)
};

// Physics constants (60Hz fixed timestep)
export const PHYSICS = {
  gravity: 0.24,
  ballRadius: 3.5,
  groundFriction: 0.976,
  airDrag: 0.994,
  bounceRestitution: 0.70,   // Lively tennis ball bounce!
  fenceRestitution: 0.78,
  minBounceVz: 0.45,
  playerAccel: 0.26,
  playerFriction: 0.85,
  maxHoldFrames: 95,         // ~1.58s max catch-and-hold before forced drop
  maxHoldSteps: 26,          // Distance limit while holding ball so you must drop to play
  goalieMaxHoldFrames: 180,  // 3.0s for goalie to scan the whole yard and throw!
  catchReach: 16,
  catchMaxZ: 24,
  dribbleDist: 8.5,
  oneTimerWindow: 28,        // Frames to trigger an NHL '94 one-timer kick
};

// Two-tier NHL '94 shooting: Tap = Quick Shot, Hold = Slap-Kick Hard Shot
export const SHOT = {
  hardMinFrames: 10,         // Hold >= 10 frames (~165ms) to enter Hard Shot wind-up
  hardFullFrames: 26,        // Full-power charge peak
  hardAutoFireFrames: 46,    // Auto-release if held cocked too long
  quickSpeedMult: 0.92,
  quickLoft: 0.95,
  hardMinSpeedMult: 1.24,
  hardMaxSpeedMult: 1.46,
  hardLoft: 2.25,
};

// Match rules: Three schoolyard recess periods (Lunch Recess is 2x length!)
export const RECESS_PERIODS = [
  { num: 1, name: 'MORNING RECESS', short: 'AM', seconds: 60 },
  { num: 2, name: 'LUNCH RECESS', short: 'LUNCH', seconds: 120 },
  { num: 3, name: 'AFTERNOON RECESS', short: 'PM', seconds: 60 },
];

export const MATCH = {
  periods: RECESS_PERIODS.length,
  periodSeconds: RECESS_PERIODS[0].seconds,
  gameOverLockFrames: 15 * 60, // 15s lockout on final screen so button mashing at the buzzer never skips stats!
};

// Classic 16-bit Genesis/SNES schoolyard palette
export const PALETTE = {
  asphaltDark: '#474c57',
  asphaltMid: '#555b68',
  asphaltLight: '#636a78',
  asphaltCrack: '#383c46',
  chalk: '#e9eef4',
  chalkFade: '#b9c4d0',
  grassDark: '#2d6b38',
  grassLight: '#3c8545',
  brickDark: '#7b352a',
  brickLight: '#9c4839',
  fenceWire: '#8f9aa8',
  fencePost: '#5e6673',
  tennisYellow: '#d9ff2e',
  tennisShade: '#97bd18',
  tennisSeam: '#f8fff0',
  shadow: 'rgba(12, 16, 26, 0.42)',
  hudBg: '#12182b',
  hudBorder: '#43537d',
  hudGold: '#ffd84d',
  hudWhite: '#f4f7ff',
  hudRed: '#ff4f5e',
  hudBlue: '#4fa8ff',
};
