import test from 'node:test';
import assert from 'node:assert/strict';
import { COURT, GOAL, RECESS_PERIODS } from '../src/constants.js';
import {
  catchBall,
  createBall,
  dropHeldBall,
  launchBall,
  launchThrow,
  stepBallPhysics,
} from '../src/physics.js';
import { FootHockeyGame } from '../src/game.js';
import { CLASSMATES, UNIFORM_COLORS, draftRecessTeams } from '../src/roster.js';
import { SICUT_CERVUS_SCORE } from '../src/music/sicut-cervus.js';
import { ChiptuneChoirPlayer } from '../src/music-player.js';

test('tennis ball bounces realistically on asphalt under gravity', () => {
  const ball = createBall(COURT.centerX, COURT.centerY, 16);
  let bounces = 0;
  for (let i = 0; i < 60; i++) {
    stepBallPhysics(ball, { onBounce: () => bounces++ });
  }
  assert.ok(bounces >= 1, 'Expected tennis ball to bounce at least once');
  assert.ok(ball.z >= 0, 'Ball height should never fall below ground');
});

test('catch-and-drop lets player hold ball in hands then drop to feet cleanly', () => {
  const ball = createBall(160, 220, 12);
  const player = {
    id: 'h_c',
    team: 'home',
    x: 160,
    y: 220,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: -1,
    holdingBall: false,
    holdFrames: 0,
    holdDist: 0,
    catchAnim: 0,
    kickTimer: 0,
    stealCooldown: 0,
  };

  catchBall(ball, player);
  assert.equal(player.holdingBall, true);
  assert.equal(ball.owner, player);
  assert.equal(ball.z, 8);

  const dropped = dropHeldBall(ball, player);
  assert.equal(dropped, true);
  assert.equal(player.holdingBall, false);
  assert.equal(ball.owner, player, 'Player keeps dribbling possession after dropping to feet');
});

test('kicking tennis ball across top goal line between backpacks scores for home', () => {
  const ball = createBall(COURT.centerX, GOAL.topLineY + 6, 4);
  const kicker = {
    id: 'h_c',
    team: 'home',
    x: COURT.centerX,
    y: GOAL.topLineY + 14,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: -1,
    holdingBall: false,
    holdFrames: 0,
    holdDist: 0,
    kickTimer: 0,
    stealCooldown: 0,
  };

  launchBall(ball, kicker, 0, -1, 5.5, 0.5);
  let goalEvent = null;
  for (let i = 0; i < 15 && !goalEvent; i++) {
    goalEvent = stepBallPhysics(ball, {});
  }
  assert.ok(goalEvent, 'Expected goal to be detected');
  assert.equal(goalEvent.scoredBy, 'home');
  assert.equal(goalEvent.goalSide, 'top');
});

test('game simulation runs cleanly for 5 seconds without errors', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  for (let i = 0; i < 300; i++) {
    game.update();
  }
  assert.ok(
    ['PLAYING', 'GOAL_CELEBRATION', 'FACEOFF'].includes(game.state),
    `Expected active match state, got ${game.state}`
  );
  assert.ok(Number.isFinite(game.ball.x) && Number.isFinite(game.ball.y));
});

test('auto-drop enforces recess catch-and-drop rule when holding ball too long', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';
  const ctrl = game.getControlledPlayer();
  catchBall(game.ball, ctrl);
  assert.equal(ctrl.holdingBall, true);

  for (let i = 0; i < 105; i++) {
    game.update();
  }
  assert.equal(ctrl.holdingBall, false, 'Player should auto-drop ball after hold timer expires');
});

test('two-tier shooting: tap produces quick shot, hold produces faster hard slap-kick', () => {
  const setupOpenShooter = () => {
    const g = new FootHockeyGame();
    g.startNewMatch();
    g.state = 'PLAYING';
    const shooter = g.getControlledPlayer();
    shooter.x = 160;
    shooter.y = 260;
    // Move defenders away so shooter has open space to wind up cleanly
    for (const p of g.players) {
      if (p.team === 'away' && p.role !== 'G') {
        p.x = 40;
        p.y = 80;
      }
    }
    g.ball.owner = shooter;
    return { g, shooter };
  };

  // Quick shot (tap for 3 frames)
  const { g: gQuick } = setupOpenShooter();
  gQuick.onKeyDown('KeyZ');
  for (let i = 0; i < 3; i++) gQuick.update();
  gQuick.onKeyUp('KeyZ');
  gQuick.update();
  const quickSpeed = Math.hypot(gQuick.ball.vx, gQuick.ball.vy);

  // Hard shot (hold for 24 frames wind-up)
  const { g: gHard, shooter: pH } = setupOpenShooter();
  gHard.onKeyDown('KeyZ');
  for (let i = 0; i < 24; i++) gHard.update();
  assert.ok(pH.windupFrames >= 10, 'Skater should be in slap-kick wind-up stance');
  gHard.onKeyUp('KeyZ');
  gHard.update();
  const hardSpeed = Math.hypot(gHard.ball.vx, gHard.ball.vy);

  assert.ok(hardSpeed > quickSpeed * 1.3, `Hard shot (${hardSpeed.toFixed(2)}) should be much faster than quick shot (${quickSpeed.toFixed(2)})`);
});

test('deliberate directional pass selects the teammate in the aimed direction', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';
  const center = game.players.find((p) => p.id === 'h_c');
  const lw = game.players.find((p) => p.id === 'h_lw');
  const rw = game.players.find((p) => p.id === 'h_rw');
  center.x = 160;
  center.y = 220;
  lw.x = 80;
  lw.y = 210;
  rw.x = 240;
  rw.y = 210;

  const targetLeft = game.findPassTarget(center, { mx: -1, my: 0 });
  const targetRight = game.findPassTarget(center, { mx: 1, my: 0 });
  assert.equal(targetLeft.id, 'h_lw', 'Aiming left should target Left Wing');
  assert.equal(targetRight.id, 'h_rw', 'Aiming right should target Right Wing');
});

test('goalie full-field overhand throw sends tennis ball across the entire schoolyard', () => {
  const ball = createBall(160, GOAL.bottomLineY - 12, 10);
  const goalie = {
    id: 'h_g',
    team: 'home',
    role: 'G',
    x: 160,
    y: GOAL.bottomLineY - 12,
    vx: 0,
    vy: 0,
    holdingBall: true,
    holdFrames: 10,
    holdDist: 0,
    throwTimer: 0,
    gloveTimer: 10,
  };

  const targetX = 88;
  const targetY = COURT.top + 56; // ~270px away across the whole schoolyard!
  const info = launchThrow(ball, goalie, targetX, targetY, { passTargetId: 'h_lw', isBomb: true });

  assert.equal(goalie.holdingBall, false);
  assert.ok(ball.isThrow);
  assert.ok(info.dist > 240, `Expected full-field throw distance > 240, got ${info.dist}`);

  // Simulate flight until arrival time
  let peakZ = 0;
  for (let i = 0; i < info.flightFrames; i++) {
    stepBallPhysics(ball, {});
    if (ball.z > peakZ) peakZ = ball.z;
  }

  const landingError = Math.hypot(ball.x - targetX, ball.y - targetY);
  assert.ok(peakZ > 20, `Expected high parabolic throw arc over midfield, peakZ=${peakZ.toFixed(1)}`);
  assert.ok(landingError < 20, `Expected full-field throw to land near receiver, error=${landingError.toFixed(1)}`);
});

test('gamepad polling detects controller in any slot and maps NHL 94 buttons', () => {
  const game = new FootHockeyGame();
  const makeBtns = (pressedIdx) =>
    Array.from({ length: 16 }, (_, i) => ({ pressed: pressedIdx.includes(i) }));

  // Controller connected in slot 1 (slot 0 null, common on Linux/Bluetooth)
  const fakePads = [
    null,
    {
      id: '8BitDo SN30 Pro (STANDARD GAMEPAD)',
      connected: true,
      mapping: 'standard',
      axes: [0.85, -0.5],
      buttons: makeBtns([1, 5]), // B/Circle (Shoot) + RB/R1 (Catch)
    },
  ];

  const state = game.pollGamepad(fakePads);
  assert.ok(state, 'Should detect controller even when not in slot 0');
  assert.equal(game.gamepadName, '8BitDo SN30 Pro (STANDARD GAMEPAD)');
  assert.equal(state.kickDown, true, 'Right face button (B/Circle) maps to Shoot');
  assert.equal(state.catchDown, true, 'RB/R1 maps to Catch');
  assert.equal(state.passDown, false);
  assert.ok(state.ax > 0.8 && state.ay < -0.4);
});

test('pause freezes match clock/simulation and tracks stats to date cleanly', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';
  const ctrl = game.getControlledPlayer();
  ctrl.x = 160;
  ctrl.y = 260;
  for (const p of game.players) {
    if (p.team === 'away' && p.role !== 'G') {
      p.x = 40;
      p.y = 80;
    }
  }
  game.ball.owner = ctrl;

  // Play 30 frames with home possession, then make a pass
  for (let i = 0; i < 30; i++) game.update();
  assert.ok(game.stats.home.possessionFrames >= 25, 'Home possession frames should accumulate');

  game.onKeyDown('KeyX');
  game.update();
  game.onKeyUp('KeyX');
  assert.ok(game.stats.home.passes >= 1, 'Pass stat should increment on deliberate pass');

  // Pause with P key
  const clockBeforePause = game.clockFrames;
  game.onKeyDown('KeyP');
  game.update();
  game.onKeyUp('KeyP');
  assert.equal(game.state, 'PAUSED');

  // Advance 60 frames while paused — clock and stats must remain frozen!
  for (let i = 0; i < 60; i++) game.update();
  assert.equal(game.clockFrames, clockBeforePause, 'Clock must not tick while paused');

  // Resume with Escape
  game.onKeyDown('Escape');
  game.update();
  game.onKeyUp('Escape');
  assert.equal(game.state, 'PLAYING');
});

test('Sicut Cervus 4-voice SATB score has valid register ordering and choir player toggles cleanly', () => {
  assert.equal(SICUT_CERVUS_SCORE.tracks.length, 4, 'Expected 4 SATB vocal tracks');
  assert.ok(SICUT_CERVUS_SCORE.duration > 100, 'Expected full motet duration > 100s');

  const medians = {};
  for (const tr of SICUT_CERVUS_SCORE.tracks) {
    assert.ok(tr.notes.length > 50, `Expected >50 notes in ${tr.role}`);
    const sorted = tr.notes.map((n) => n[2]).sort((a, b) => a - b);
    medians[tr.role] = sorted[Math.floor(sorted.length / 2)];
  }
  // Verify true Palestrina vocal pitch hierarchy: Soprano > Alto > Tenor > Bass
  assert.ok(medians.soprano > medians.alto, 'Soprano should sit above Alto');
  assert.ok(medians.alto > medians.tenor, 'Alto should sit above Tenor');
  assert.ok(medians.tenor > medians.bass, 'Tenor should sit above Bass');

  const player = new ChiptuneChoirPlayer(SICUT_CERVUS_SCORE);
  assert.equal(player.enabled, true);
  assert.equal(player.toggleEnabled(), false);
  assert.equal(player.toggleEnabled(), true);
});

test('three recess periods: Morning, double-length Lunch, and Afternoon', () => {
  assert.equal(RECESS_PERIODS.length, 3);
  assert.equal(RECESS_PERIODS[0].name, 'MORNING RECESS');
  assert.equal(RECESS_PERIODS[1].name, 'LUNCH RECESS');
  assert.equal(RECESS_PERIODS[2].name, 'AFTERNOON RECESS');
  assert.equal(
    RECESS_PERIODS[1].seconds,
    RECESS_PERIODS[0].seconds * 2,
    'Lunch recess must be twice as long as Morning recess'
  );
  assert.equal(
    RECESS_PERIODS[1].seconds,
    RECESS_PERIODS[2].seconds * 2,
    'Lunch recess must be twice as long as Afternoon recess'
  );

  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';
  assert.equal(game.period, 1);
  assert.equal(game.clockFrames, RECESS_PERIODS[0].seconds * 60);

  // End Period 1 -> transitions to Period 2 (Lunch Recess, 2x duration)
  game.clockFrames = 1;
  game.update();
  assert.equal(game.state, 'PERIOD_END');
  game.stateTimer = 0;
  game.onKeyDown('Enter');
  game.update();
  game.onKeyUp('Enter');
  assert.equal(game.period, 2);
  assert.equal(game.clockFrames, RECESS_PERIODS[1].seconds * 60);

  // End Period 2 -> transitions to Period 3 (Afternoon Recess)
  game.state = 'PLAYING';
  game.clockFrames = 1;
  game.update();
  assert.equal(game.state, 'PERIOD_END');
  game.stateTimer = 0;
  game.onKeyDown('Enter');
  game.update();
  game.onKeyUp('Enter');
  assert.equal(game.period, 3);
  assert.equal(game.clockFrames, RECESS_PERIODS[2].seconds * 60);

  // End Period 3 -> GAME_OVER
  game.state = 'PLAYING';
  game.clockFrames = 1;
  game.update();
  assert.equal(game.state, 'GAME_OVER');
});

test('post-goal possession gives the ball to the team that conceded the goal', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';

  // Home scores -> Away gave up the goal -> Away should restart with possession!
  game.handleGoalScored('home', 'top');
  game.stateTimer = 1;
  game.update();
  assert.equal(game.state, 'RESTART');
  assert.equal(game.restartTeam, 'away');
  assert.equal(game.ball.owner?.team, 'away');

  // Away scores -> Home gave up the goal -> Home should restart with possession!
  game.state = 'PLAYING';
  game.handleGoalScored('away', 'bottom');
  game.stateTimer = 1;
  game.update();
  assert.equal(game.state, 'RESTART');
  assert.equal(game.restartTeam, 'home');
  assert.equal(game.ball.owner?.team, 'home');
});

test('goalie clear throw is protected from immediate point-blank opponent interception', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';

  const goalie = game.players.find((p) => p.id === 'h_g');
  const receiver = game.players.find((p) => p.id === 'h_lw');
  const opponent = game.players.find((p) => p.id === 'a_c');

  // Place opponent directly in front of the home goalie trying to smother the clear
  opponent.x = goalie.x;
  opponent.y = goalie.y - 12;
  receiver.x = 80;
  receiver.y = 140;

  catchBall(game.ball, goalie);
  game.executeGoalieThrow(goalie, receiver, false);
  assert.ok(game.ball.z >= 14, 'Goalie overhand clear should release above head height');
  assert.ok(game.ball.throwGrace >= 12, 'Goalie clear should have launch grace protection');

  // Step 6 frames — opponent right in front of crease must NOT steal/intercept the clear!
  for (let i = 0; i < 6; i++) {
    game.update();
    assert.notEqual(
      game.ball.owner?.team,
      'away',
      'Opposing skater should not instantly intercept goalie clear right out of the crease'
    );
  }
});

test('roster drafts 8 unique St. Michaels classmates into Maroon Uniforms vs Colorful Jackets', () => {
  const expectedNames = ['PAES', 'KWONG', 'MASANGKAY', 'STEVE', 'BLAIR', 'SEAN', 'DANIEL', 'ADAM', 'FIZZ', 'LOWELL'];
  assert.deepEqual(
    CLASSMATES.map((c) => c.name),
    expectedNames,
    'Master classmate roster should contain all 10 classmates'
  );

  const { homePlayers, awayPlayers } = draftRecessTeams();
  assert.equal(homePlayers.length, 4);
  assert.equal(awayPlayers.length, 4);

  const allNames = [...homePlayers, ...awayPlayers].map((p) => p.name);
  assert.equal(new Set(allNames).size, 8, 'All 8 drafted players in a match must be unique');

  for (const p of homePlayers) {
    assert.equal(p.wearsJacket, false, 'Home team wears maroon school uniform without jacket');
  }
  for (const p of awayPlayers) {
    assert.equal(p.wearsJacket, true, 'Away team wears colorful jacket over the maroon uniform');
    assert.ok(p.coatColor && p.coatColor !== UNIFORM_COLORS.maroonShirt, 'Away jacket color must be distinct from maroon');
  }

  // Default uniform mode should be everyday uniform ('default'), with optional 'dress' toggle
  const game = new FootHockeyGame();
  assert.equal(game.uniformMode, 'default');
  assert.equal(game.toggleUniformMode(), 'dress');
  assert.equal(game.toggleUniformMode(), 'default');
});

test('boot intro spins SMCS crest then automatically transitions to TITLE (or skips on input)', () => {
  const game = new FootHockeyGame();
  assert.equal(game.state, 'BOOT');
  assert.equal(game.bootFrames, 0);

  // Advance full boot animation -> should land on TITLE
  for (let i = 0; i < 285; i++) game.update();
  assert.equal(game.state, 'TITLE');

  // Pressing I on TITLE replays the boot intro
  game.onKeyDown('KeyI');
  game.update();
  game.onKeyUp('KeyI');
  assert.equal(game.state, 'BOOT');

  // Verify skipping on keypress after brief intro
  const gameSkip = new FootHockeyGame();
  for (let i = 0; i < 20; i++) gameSkip.update();
  assert.equal(gameSkip.state, 'BOOT');
  gameSkip.onKeyDown('Enter');
  gameSkip.update();
  gameSkip.onKeyUp('Enter');
  assert.equal(gameSkip.state, 'TITLE');
});
