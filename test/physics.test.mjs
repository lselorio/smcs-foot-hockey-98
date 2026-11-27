import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { COURT, GOAL, MATCH, RECESS_PERIODS } from '../src/constants.js';
import {
  catchBall,
  createBall,
  dropHeldBall,
  launchBall,
  launchThrow,
  stepBallPhysics,
} from '../src/physics.js';
import { FootHockeyGame } from '../src/game.js';
import { CLASSMATES, UNIFORM_COLORS, draftRecessTeams, resolveUniformKit } from '../src/roster.js?v=13';
import { SICUT_CERVUS_SCORE } from '../src/music/sicut-cervus.js';
import { GLORIA_VIII_SCORE } from '../src/music/gloria-viii.js';
import { SALVE_REGINA_SCORE } from '../src/music/salve-regina.js';
import { WIDOR_TOCCATA_SCORE } from '../src/music/widor-toccata.js';
import { MARCELLI_AMEN_SCORE, MARCELLI_AMEN_TIMING } from '../src/music/marcelli-amen.js';
import { ChiptuneChoirPlayer } from '../src/music-player.js';
import { BOOT_CHANTS, getAudioCandidates, getAudioFormatOrder, sound } from '../src/audio.js?v=10';
import {
  computeStickVector,
  getUtilityButtonsForState,
  shouldEnableTouchMode,
} from '../src/touch-controls.js';

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

  // Pressing CATCH while already dribbling the ball at feet should do nothing (can only catch loose/airborne balls!)
  const g = new FootHockeyGame();
  g.startNewMatch();
  g.state = 'PLAYING';
  const ctrl = g.getControlledPlayer();
  ctrl.holdingBall = false;
  g.ball.owner = ctrl;
  g.onKeyDown('KeyC');
  g.update();
  g.onKeyUp('KeyC');
  assert.equal(ctrl.holdingBall, false, 'Pressing CATCH while dribbling at feet must not pick up the ball');

  // Airborne balls (goalie throws / high bounces z > 5.5) are AUTO-CAUGHT by the controlled player, then dropped with PASS (KeyX)!
  ctrl.stats.hands = 0.92;
  g.ball.owner = null;
  g.ball.x = ctrl.x + 4;
  g.ball.y = ctrl.y;
  g.ball.z = 12;
  g.ball.vx = 0;
  g.ball.vy = 0;
  g.ball.vz = 0;
  g.ball.pickupCooldown = 0;
  g.ball.throwGrace = 0;
  g.checkLooseBallPickup();
  assert.equal(ctrl.holdingBall, true, 'Controlled player should auto-catch an airborne bouncing/thrown ball');
  assert.equal(g.ball.owner, ctrl);
  g.onKeyDown('KeyX');
  g.update();
  g.onKeyUp('KeyX');
  assert.equal(ctrl.holdingBall, false, 'Pressing PASS (KeyX) while holding a caught ball should drop it cleanly to feet');
  assert.equal(g.ball.owner, ctrl, 'Dropping via PASS keeps dribbling possession at feet');
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
    shooter.stats.kick = 5.3; // Normalize shooter kick stat across quick vs hard instances (in case Istvan gets drafted!)
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
  // Open-court kick away from net must NOT count as a Shot on Goal!
  assert.equal(gQuick.stats.home.shots, 0, 'Shot attempt that neither scores nor is saved must not count as a Shot on Goal');
  assert.equal(gHard.stats.home.shots, 0, 'Open-court hard kick must not count as a Shot on Goal');

  // Goalie save -> +1 Shot on Goal for attacking team; Goal -> +1 Shot on Goal for scoring team!
  const awayGoalie = gHard.players.find((p) => p.id === 'a_g');
  gHard.onGoalieSave(awayGoalie, 'glove', 'home');
  assert.equal(gHard.stats.home.shots, 1, 'Goalie save of opponent shot should credit 1 Shot on Goal');
  assert.equal(gHard.stats.away.saves, 1);
  // Teammate back-pass caught by own goalie must NOT credit opponent with a Shot on Goal
  gHard.onGoalieSave(awayGoalie, 'glove', 'away');
  assert.equal(gHard.stats.home.shots, 1, 'Own teammate pass scooped by goalie must not count as opponent Shot on Goal');
  gHard.handleGoalScored('home', 'top_yellow');
  assert.equal(gHard.stats.home.shots, 2, 'Scoring a goal should credit 1 Shot on Goal (SOG = goals + saves)');
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
  assert.equal(game.statsPage, 'team');
  assert.ok(ctrl.matchStats.passes >= 1, 'Individual player pass stat should increment cleanly');

  // Pressing ArrowRight cycles TEAM -> PLAYERS -> SUMMARY -> TEAM cleanly!
  game.onKeyDown('ArrowRight');
  game.update();
  game.onKeyUp('ArrowRight');
  assert.equal(game.statsPage, 'players', 'ArrowRight on PAUSED should switch to Player Stats page');
  game.onKeyDown('ArrowRight');
  game.update();
  game.onKeyUp('ArrowRight');
  assert.equal(game.statsPage, 'summary', 'Second ArrowRight should switch to NHL Game Summary page');
  game.onKeyDown('ArrowLeft');
  game.update();
  game.onKeyUp('ArrowLeft');
  assert.equal(game.statsPage, 'players', 'ArrowLeft from Summary should return to Player Stats');
  game.onKeyDown('ArrowLeft');
  game.update();
  game.onKeyUp('ArrowLeft');
  assert.equal(game.statsPage, 'team', 'ArrowLeft from Players should return to Team Stats');

  // Advance 60 frames while paused — clock and stats must remain frozen!
  for (let i = 0; i < 60; i++) game.update();
  assert.equal(game.clockFrames, clockBeforePause, 'Clock must not tick while paused');

  // Resume with Escape
  game.onKeyDown('Escape');
  game.update();
  game.onKeyUp('Escape');
  assert.equal(game.state, 'PLAYING');

  // Pause and press Q -> ends match early into GAME_OVER final stats (with Widor Toccata)!
  game.onKeyDown('KeyP');
  game.update();
  game.onKeyUp('KeyP');
  assert.equal(game.state, 'PAUSED');
  game.onKeyDown('KeyQ');
  game.update();
  game.onKeyUp('KeyQ');
  assert.equal(game.state, 'GAME_OVER', 'Pressing Q while paused should end the match to the final stats screen');
  assert.equal(game.matchCompleted, false, 'Quitting from Pause should mark matchCompleted as false');
  assert.equal(sound.music.score, WIDOR_TOCCATA_SCORE, 'Ending match from Pause should strike up Widor Toccata');
  // Pressing Q again on a quit-early GAME_OVER screen returns directly to TITLE (skipping Amen)!
  game.onKeyDown('KeyQ');
  game.update();
  game.onKeyUp('KeyQ');
  assert.equal(game.state, 'TITLE', 'Pressing Q on quit-early GAME_OVER should return directly to Title screen');

  // Verify NHL Primary & Secondary Assist tracking: Goalie -> Center -> Left Wing scores!
  const goalie = game.players.find((p) => p.id === 'h_g');
  const passer = game.players.find((p) => p.id === 'h_c');
  const scorer = game.players.find((p) => p.id === 'h_lw');
  launchThrow(game.ball, goalie, passer.x, passer.y);
  catchBall(game.ball, passer);
  launchBall(game.ball, passer, 1, 0, 4.5, 0.5);
  catchBall(game.ball, scorer);
  game.handleGoalScored('home', 'top_yellow');
  assert.equal(scorer.matchStats.goals, 1, 'Scorer should be credited with 1 Goal');
  assert.equal(passer.matchStats.assists, 1, 'Primary passer should be credited with Primary Assist');
  assert.equal(goalie.matchStats.assists, 1, 'Goalie outlet should be credited with Secondary Assist');
  assert.equal(game.lastGoalInfo.scorerName, scorer.name);
  assert.equal(game.lastGoalInfo.goalCount, 1);
  assert.deepEqual(game.lastGoalInfo.assists, [passer.name, goalie.name]);
  const lastGoal = game.goalLog[game.goalLog.length - 1];
  assert.deepEqual(lastGoal.assists, [passer.name, goalie.name]);
  assert.match(lastGoal.time, /^\d:\d\d$/, 'Goal log entry should record NHL-style period elapsed time');
  assert.equal(game.stats.home.periodGoals[0], 1, 'Period 1 goal count should increment for Game Summary');
  assert.equal(game.stats.home.periodShots[0], 1, 'Period 1 shots-on-goal count should increment for Game Summary');

  // Second solo goal by the same scorer tracks goalCount = 2 and empty assists (UNASSISTED)!
  const opponent = game.players.find((p) => p.id === 'a_c');
  catchBall(game.ball, opponent);
  catchBall(game.ball, scorer);
  game.handleGoalScored('home', 'top_yellow');
  assert.equal(game.lastGoalInfo.scorerName, scorer.name);
  assert.equal(game.lastGoalInfo.goalCount, 2, 'Multi-goal scorer should expose updated goal count for celebration banner');
  assert.deepEqual(game.lastGoalInfo.assists, [], 'Solo takeaway goal should record no assists');

  // On GAME_OVER ("Ite, ludus finitus est"), exit inputs are locked for 15 seconds while stats browsing stays active!
  game.state = 'GAME_OVER';
  game.matchCompleted = true;
  game.stateTimer = 0;
  game.onKeyDown('ArrowRight');
  game.update();
  game.onKeyUp('ArrowRight');
  assert.equal(game.statsPage, 'players', 'ArrowRight on GAME_OVER should switch to Player Stats page immediately');
  for (const key of ['Enter', 'KeyZ', 'KeyX', 'KeyQ', 'Escape']) {
    game.onKeyDown(key);
    game.update();
    game.onKeyUp(key);
    assert.equal(game.state, 'GAME_OVER', `Pressing ${key} during 15s GAME_OVER lock must not leave final stats`);
  }
  // Once 15 seconds elapse on a COMPLETED match, Escape/Q closes through Amen -> Title!
  game.stateTimer = MATCH.gameOverLockFrames;
  game.onKeyDown('Escape');
  game.update();
  game.onKeyUp('Escape');
  assert.equal(game.state, 'POST_CREDITS', 'Pressing Escape after 15s lock on a completed match should play Amen');
  assert.equal(game.postCreditsNextState, 'TITLE', 'Completed match Q/Esc Amen exit should finish on Title (not Boot)');
  game.postCreditsFrames = MARCELLI_AMEN_TIMING.totalFrames - 1;
  game.update();
  assert.equal(game.state, 'TITLE', 'Amen after completed match Q/Esc should land cleanly on Title screen');

  // After 15s lock on a completed match, Enter starts a Rematch directly!
  game.state = 'GAME_OVER';
  game.matchCompleted = true;
  game.stateTimer = MATCH.gameOverLockFrames;
  game.onKeyDown('Enter');
  game.update();
  game.onKeyUp('Enter');
  assert.equal(game.state, 'FACEOFF', 'Pressing Enter on unlocked GAME_OVER should start a Rematch directly');
  assert.equal(game.matchCompleted, false, 'Starting a new rematch should reset matchCompleted');
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

  // Verify Gregorian Missa VIII (de Angelis) Gloria chiptune score & track switching!
  assert.equal(GLORIA_VIII_SCORE.tracks.length, 4, 'Gloria VIII should have 4 SATB voices');
  const gMedians = {};
  for (const tr of GLORIA_VIII_SCORE.tracks) {
    assert.ok(tr.notes.length > 80, `Expected >80 notes in Gloria VIII ${tr.role}`);
    const sorted = tr.notes.map((n) => n[2]).sort((a, b) => a - b);
    gMedians[tr.role] = sorted[Math.floor(sorted.length / 2)];
  }
  assert.ok(gMedians.soprano > gMedians.alto);
  assert.ok(gMedians.alto > gMedians.tenor);
  assert.ok(gMedians.tenor > gMedians.bass);
  // Opening "Glo-ri-a in ex-cel-sis De-o" pitches in Mode V (F Major): C5 C5 A4 G4 F4 G4 A4 G4 F4
  const opening = GLORIA_VIII_SCORE.tracks[0].notes.slice(0, 9).map((n) => n[2]);
  assert.deepEqual(opening, [72, 72, 69, 67, 65, 67, 69, 67, 65]);
  // Final Amen includes the signature B-flat (70) and smoothly ritards across its last 5 notes (Bb4 -> A4 -> G4 -> G4 -> F4)
  assert.ok(GLORIA_VIII_SCORE.tracks[0].notes.some((n) => n[2] === 70), 'Gloria VIII Amen should include Bb4');
  const gloriaAmenTail = GLORIA_VIII_SCORE.tracks[0].notes.slice(-5);
  assert.deepEqual(gloriaAmenTail.map((n) => n[2]), [70, 69, 67, 67, 65], 'Gloria VIII final 5 notes should be Bb4-A4-G4-G4-F4');
  for (let i = 1; i < gloriaAmenTail.length; i++) {
    assert.ok(
      gloriaAmenTail[i][1] > gloriaAmenTail[i - 1][1],
      `Gloria VIII Amen should smoothly ritard across last 5 notes (note ${i} dur=${gloriaAmenTail[i][1]} <= prev ${gloriaAmenTail[i - 1][1]})`
    );
  }

  // Verify Gregorian Salve Regina (Simple Tone, Mode V) 4-voice chiptune score!
  assert.equal(SALVE_REGINA_SCORE.tracks.length, 4, 'Salve Regina should have 4 SATB voices');
  const srMedians = {};
  for (const tr of SALVE_REGINA_SCORE.tracks) {
    assert.ok(tr.notes.length > 40, `Expected >40 notes in Salve Regina ${tr.role}`);
    const sorted = tr.notes.map((n) => n[2]).sort((a, b) => a - b);
    srMedians[tr.role] = sorted[Math.floor(sorted.length / 2)];
  }
  assert.ok(srMedians.soprano > srMedians.alto, 'Salve Regina Soprano should sit above Alto');
  assert.ok(srMedians.alto > srMedians.tenor, 'Salve Regina Alto should sit above Tenor');
  assert.ok(srMedians.tenor > srMedians.bass, 'Salve Regina Tenor should sit above Bass');
  // Iconic opening "Sal-ve, Re-gi-na" in Eb Major: Eb4 G4 Bb4 C5 Bb4
  const srOpening = SALVE_REGINA_SCORE.tracks[0].notes.slice(0, 5).map((n) => n[2]);
  assert.deepEqual(srOpening, [63, 67, 70, 72, 70]);
  // Verify Solesmes lengthening on mid-phrase episema ("eia ergo") and pre-quilisma notes ("O clemens", "O pia")!
  const srSop = SALVE_REGINA_SCORE.tracks[0].notes;
  const oClemensIdx = srSop.findIndex(
    (n, i) => i > 100 && n[2] === 67 && srSop[i + 1]?.[2] === 68 && srSop[i + 2]?.[2] === 70 && srSop[i + 3]?.[2] === 67
  );
  assert.ok(oClemensIdx > 0, 'Should locate opening of "O clemens"');
  assert.ok(srSop[oClemensIdx][1] >= 0.72, 'First note of "O clemens" before quilisma should be expressively lengthened');
  const oPiaIdx = srSop.findIndex(
    (n, i) => i > oClemensIdx && n[2] === 70 && srSop[i + 1]?.[2] === 72 && srSop[i + 2]?.[2] === 74 && srSop[i + 3]?.[2] === 75
  );
  assert.ok(oPiaIdx > 0, 'Should locate opening of "O pia"');
  assert.ok(srSop[oPiaIdx][1] >= 0.72, 'First note of "O pia" before quilisma should be expressively lengthened');
  // Verify smooth legato on "dul-cé-do" (no awkward mid-word gap) and ritardando on closing "Virgo Maria."
  const dulCe = srSop[16]; // "cé" (Ab4=68)
  const dulDo = srSop[17]; // "do" (F4=65)
  assert.equal(dulCe[2], 68);
  assert.equal(dulDo[2], 65);
  assert.ok(dulDo[0] - (dulCe[0] + dulCe[1]) < 0.04, 'Should have no awkward pause between "cé" and "do" of dulcédo');
  const virgoTail = srSop.slice(-6); // Vir-go Ma-ri(d-c)-a.
  assert.ok(virgoTail[4][1] > virgoTail[2][1] && virgoTail[2][1] > virgoTail[0][1], 'Closing "Virgo Maria." should smoothly ritard');

  // Default track should be Sicut Cervus, and cycling / auto-advancing moves Sicut Cervus -> Gloria VIII -> Salve Regina -> Sicut Cervus!
  assert.equal(sound.getMusicTrack().id, 'sicut_cervus', 'Default BGM track should be Sicut Cervus');
  assert.equal(sound.cycleMusicTrack().id, 'gloria_viii');
  assert.equal(sound.cycleMusicTrack().id, 'salve_regina');
  // Simulate track ending -> auto-advances back to Sicut Cervus!
  const autoNext = sound.music.onTrackEnded();
  assert.equal(autoNext, SICUT_CERVUS_SCORE);
  assert.equal(sound.getMusicTrack().id, 'sicut_cervus');

  // Regression test: when Sicut Cervus reaches loopEnd in tick(), Gloria VIII must start playing from note 0 (not skip all notes!)
  const scheduled = [];
  const transitionPlayer = new ChiptuneChoirPlayer(SICUT_CERVUS_SCORE, {
    onTrackEnded: () => GLORIA_VIII_SCORE,
  });
  transitionPlayer.playing = true;
  transitionPlayer.songPos = SICUT_CERVUS_SCORE.duration + 1.59;
  transitionPlayer.lastAudioTime = 10.0;
  transitionPlayer.scheduleNote = (role, startTime, dur, midi) => scheduled.push({ role, midi });
  transitionPlayer.tick({ state: 'running', currentTime: 10.05 });
  assert.equal(transitionPlayer.score, GLORIA_VIII_SCORE, 'Should auto-switch score to Gloria VIII at end of Sicut Cervus');
  assert.ok(scheduled.length > 0, 'Gloria VIII opening notes must be scheduled right after Sicut Cervus ends');
  assert.equal(scheduled[0].midi, 72, 'First scheduled note of Gloria VIII should be C5 (72)');
  assert.ok(transitionPlayer.trackCursors[0] < 5, 'Soprano cursor must stay at start of Gloria VIII, not skip to end');

  // Verify Widor Toccata cathedral organ postlude activates on GAME_OVER ("ITE, LUDUS FINITUS EST"),
  // does NOT restart when it finishes, and sends the game back to the BOOT screen!
  assert.equal(WIDOR_TOCCATA_SCORE.tracks.length, 4, 'Widor Toccata should have 4 organ tracks');
  assert.equal(WIDOR_TOCCATA_SCORE.tracks[0].notes[0][2], 77, 'Widor Toccata opens on F5 (77)');
  sound.updateMusic('GAME_OVER', false);
  assert.equal(sound.music.score, WIDOR_TOCCATA_SCORE, 'GAME_OVER should play Widor Toccata postlude');

  // Simulate Widor Toccata reaching its end -> returns null (no loop) and triggers return to BOOT!
  const widorScheduled = [];
  const origSched = sound.music.scheduleNote;
  sound.music.playing = true;
  sound.music.songPos = WIDOR_TOCCATA_SCORE.duration + 1.59;
  sound.music.lastAudioTime = 20.0;
  sound.music.scheduleNote = (...args) => widorScheduled.push(args);
  sound.music.tick({ state: 'running', currentTime: 20.05 });
  sound.music.scheduleNote = origSched;
  assert.equal(widorScheduled.length, 0, 'Widor Toccata must not restart or schedule notes after ending');
  assert.equal(sound.postludeFinished, true, 'Finishing Widor Toccata should flag postludeFinished');

  const postludeGame = new FootHockeyGame();
  postludeGame.state = 'GAME_OVER';
  postludeGame.stateTimer = 100;
  postludeGame.update();
  assert.equal(postludeGame.state, 'POST_CREDITS', 'Finishing Widor Toccata on GAME_OVER should launch the Amen post-credits scene');
  assert.equal(sound.music.score, MARCELLI_AMEN_SCORE, 'POST_CREDITS should play Palestrina Missa Papae Marcelli Gloria Amen');
  assert.equal(MARCELLI_AMEN_SCORE.tracks.length, 6, 'Missa Papae Marcelli Amen should have all 6 polyphonic voices');

  // Verify POST_CREDITS cannot be interrupted by any button press!
  for (const key of ['Enter', 'Space', 'Escape', 'KeyZ', 'KeyX', 'KeyP', 'KeyQ']) {
    postludeGame.onKeyDown(key);
    postludeGame.update();
    postludeGame.onKeyUp(key);
    assert.equal(postludeGame.state, 'POST_CREDITS', `Pressing ${key} must not interrupt the Amen post-credits scene`);
  }

  // Advance to the end of the Amen post-credits after Widor finishes -> transitions cleanly to BOOT and restores regular BGM!
  postludeGame.postCreditsFrames = MARCELLI_AMEN_TIMING.totalFrames - 1;
  postludeGame.update();
  assert.equal(postludeGame.state, 'BOOT', 'Finishing Amen after Widor completes should return cleanly to BOOT');
  assert.equal(postludeGame.bootFrames, 0, 'Returning to BOOT should start the boot sequence fresh');
  assert.equal(sound.music.score, SICUT_CERVUS_SCORE, 'Returning to BOOT should restore regular BGM track');

  // Dedicated Final Screen option: pressing I (or Shift+I) on GAME_OVER launches Amen -> TITLE!
  // Even if the user had muted audio or turned BGM off, Amen ALWAYS plays unmuted, then restores mute state on TITLE!
  sound.muted = true;
  sound.music.setMuted(true);
  sound.music.enabled = false;
  postludeGame.state = 'GAME_OVER';
  postludeGame.stateTimer = 10;
  postludeGame.onKeyDown('KeyI');
  postludeGame.update();
  postludeGame.onKeyUp('KeyI');
  assert.equal(postludeGame.state, 'POST_CREDITS', 'Pressing I on GAME_OVER should launch the Amen exit screen');
  assert.equal(postludeGame.postCreditsNextState, 'TITLE', 'I:AMEN on GAME_OVER should finish on TITLE');
  assert.equal(sound.music.muted, false, 'Palestrina Amen must NEVER be muted even if gameplay audio was muted');
  assert.equal(sound.music.enabled, true, 'Palestrina Amen must ALWAYS play even if gameplay BGM was turned off');
  // Pressing M during Amen or Boot must NOT toggle mute!
  postludeGame.onKeyDown('KeyM');
  postludeGame.onKeyUp('KeyM');
  assert.equal(sound.music.muted, false, 'Pressing M during Amen must not mute Palestrina');
  postludeGame.postCreditsFrames = MARCELLI_AMEN_TIMING.totalFrames - 1;
  postludeGame.update();
  assert.equal(postludeGame.state, 'TITLE', 'Amen triggered via I on GAME_OVER should land cleanly on TITLE');
  assert.equal(sound.music.muted, true, 'User gameplay mute preference should restore cleanly after Amen finishes');
  assert.equal(sound.music.enabled, false, 'User gameplay BGM-off preference should restore cleanly after Amen finishes');
  // Clean up test audio state back to defaults
  sound.muted = false;
  sound.music.setMuted(false);
  sound.music.enabled = true;
  sound.music.playing = false;
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

  // End Period 3 -> GAME_OVER with matchCompleted = true
  game.state = 'PLAYING';
  game.clockFrames = 1;
  game.update();
  assert.equal(game.state, 'GAME_OVER');
  assert.equal(game.matchCompleted, true, 'Completing Period 3 should mark matchCompleted as true');
});

test('post-goal possession gives the ball to the conceding team goalie in their crease', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';

  // Home scores -> Away gave up the goal -> Away GOALIE restarts with ball in their crease!
  game.handleGoalScored('home', 'top_yellow');
  game.stateTimer = 1;
  game.update();
  assert.equal(game.state, 'RESTART');
  assert.equal(game.restartTeam, 'away');
  assert.equal(game.ball.owner?.team, 'away');
  assert.equal(game.ball.owner?.role, 'G', 'Conceding goalie should have post-goal possession');
  assert.equal(game.ball.owner?.holdingBall, true);

  // Away scores -> Home gave up the goal -> Home GOALIE restarts with possession & player control!
  game.state = 'PLAYING';
  game.handleGoalScored('away', 'right_cage');
  game.stateTimer = 1;
  game.update();
  assert.equal(game.state, 'RESTART');
  assert.equal(game.restartTeam, 'home');
  assert.equal(game.ball.owner?.team, 'home');
  assert.equal(game.ball.owner?.role, 'G', 'Home goalie should have post-goal possession');
  assert.equal(game.ball.owner?.holdingBall, true);
  assert.equal(game.controlledId, 'h_g', 'Control should switch to Home goalie to throw out');
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
  const expectedNames = [
    'PAES',
    'KWONG',
    'MASANGKAY',
    'STEVE',
    'BLAIR',
    'SEAN',
    'DANIEL',
    'ADAM',
    'FIZZ',
    'LOWELL',
    'JIMMY',
    'AVERY',
    'RICH',
    'JOHNNY ZORRO',
    'ISTVAN',
    'ERNIE',
    'PONESSE',
    'DEREK',
    'CHUNG',
    'KEVIN',
    'BRENDAN',
    'BAKER',
    'LEN',
    'SANFORD',
    'TAYLOR',
    'ARPAD',
    'BRINGAS',
    'JAMIE',
    'LOUIE',
  ];
  assert.deepEqual(
    CLASSMATES.map((c) => c.name),
    expectedNames,
    'Master classmate roster should contain all 29 classmates'
  );

  // Verify ISTVAN is strictly the worst player in the game across every attribute by a clear margin!
  const istvan = CLASSMATES.find((c) => c.name === 'ISTVAN');
  const fizz = CLASSMATES.find((c) => c.name === 'FIZZ');
  const avery = CLASSMATES.find((c) => c.name === 'AVERY');
  const paes = CLASSMATES.find((c) => c.name === 'PAES');
  const others = CLASSMATES.filter((c) => c.name !== 'ISTVAN');
  for (const attr of ['speed', 'kick', 'control', 'hands', 'reflex', 'checking']) {
    const minOther = Math.min(...others.map((o) => o.stats[attr]));
    assert.ok(
      istvan.stats[attr] < minOther - 0.2,
      `ISTVAN ${attr} (${istvan.stats[attr]}) should be much worse than every other classmate (min ${minOther})`
    );
  }
  // Verify authentic scouting-report hierarchy!
  const kevin = CLASSMATES.find((c) => c.name === 'KEVIN');
  const brendan = CLASSMATES.find((c) => c.name === 'BRENDAN');
  assert.equal(
    kevin.stats.speed,
    Math.max(...CLASSMATES.map((c) => c.stats.speed)),
    'Kevin should be the fastest classmate on 66 Bond'
  );
  assert.ok(avery.stats.speed < kevin.stats.speed && avery.stats.control > kevin.stats.control + 0.25, 'Avery should be elite all-around while Kevin has top raw speed');
  assert.equal(
    paes.stats.control,
    Math.max(...CLASSMATES.map((c) => c.stats.control)),
    'Paes should have top ball control'
  );
  assert.ok(fizz.stats.speed < 1.70 && fizz.stats.speed > istvan.stats.speed + 0.25, 'Fizz should be below average but much better than Istvan');
  const blair = CLASSMATES.find((c) => c.name === 'BLAIR');
  const ponesse = CLASSMATES.find((c) => c.name === 'PONESSE');
  const rich = CLASSMATES.find((c) => c.name === 'RICH');
  const ernie = CLASSMATES.find((c) => c.name === 'ERNIE');
  const sanford = CLASSMATES.find((c) => c.name === 'SANFORD');
  const arpad = CLASSMATES.find((c) => c.name === 'ARPAD');
  assert.equal(ponesse.tall, true, 'Ponesse should have the tall trait');
  assert.ok(ponesse.stats.checking > blair.stats.checking, 'Ponesse should be stronger than Blair');
  assert.equal(brendan.stats.checking, Math.max(...CLASSMATES.map((c) => c.stats.checking)), 'Brendan should be the strongest beast on 66 Bond');
  assert.ok(brendan.stats.speed < 1.65 && brendan.stats.checking > ponesse.stats.checking, 'Brendan should be slow and unskilled but strongest overall');
  assert.ok(arpad.stats.speed > 1.90 && arpad.stats.kick >= 5.50 && arpad.stats.control < 0.70, 'Arpad should be fast with a hard shot, otherwise unskilled');
  const bringas = CLASSMATES.find((c) => c.name === 'BRINGAS');
  assert.equal(bringas.hairStyle, 'bald', 'Bringas should have the bald hairstyle');
  assert.ok(bringas.stats.speed > 1.65 && bringas.stats.speed < 1.78 && bringas.stats.control < 0.78, 'Bringas should have mediocre stats');
  assert.equal(rich.preferredRole, 'HOOPS', 'Rich should be a permanent corner hoops regular');
  assert.equal(ernie.preferredRole, 'HOOPS', 'Ernie should be a permanent corner hoops regular');
  assert.equal(sanford.preferredRole, 'HOOPS', 'Sanford should be a permanent corner hoops regular');

  const { homePlayers, awayPlayers, undraftedPlayers } = draftRecessTeams();
  assert.equal(homePlayers.length, 4);
  assert.equal(awayPlayers.length, 4);
  assert.deepEqual(
    undraftedPlayers.slice(0, 3).map((p) => p.name),
    ['RICH', 'ERNIE', 'SANFORD'],
    'Rich, Ernie, and Sanford should always fill the first corner basketball court'
  );

  // Verify across multiple random drafts that Rich, Ernie & Sanford always stay in corner basketball and never get randomly drafted to hockey
  for (let i = 0; i < 12; i++) {
    const d = draftRecessTeams();
    const draftedNames = [...d.homePlayers, ...d.awayPlayers].map((p) => p.name);
    for (const hoopsKid of ['RICH', 'ERNIE', 'SANFORD']) {
      assert.ok(!draftedNames.includes(hoopsKid), `${hoopsKid} should stay in corner hoops during random drafts`);
    }
    assert.deepEqual(d.undraftedPlayers.slice(0, 3).map((p) => p.name), ['RICH', 'ERNIE', 'SANFORD']);
  }

  // Two of the natural goalies (Baker, Lowell, Masangkay) should always start in net!
  const naturalGoalies = new Set(['BAKER', 'LOWELL', 'MASANGKAY']);
  assert.ok(naturalGoalies.has(homePlayers[3].name), `Home goalie (${homePlayers[3].name}) should be a natural goalie`);
  assert.ok(naturalGoalies.has(awayPlayers[3].name), `Away goalie (${awayPlayers[3].name}) should be a natural goalie`);
  assert.notEqual(homePlayers[3].name, awayPlayers[3].name);

  // Verify glasses & build traits across the classmates
  const glassesNames = CLASSMATES.filter((c) => c.glasses).map((c) => c.name).sort();
  assert.deepEqual(glassesNames, ['CHUNG', 'DEREK', 'FIZZ', 'LEN', 'LOUIE', 'LOWELL', 'PAES', 'SEAN', 'TAYLOR']);
  assert.deepEqual(CLASSMATES.filter((c) => c.thin).map((c) => c.name).sort(), ['KEVIN', 'KWONG', 'MASANGKAY', 'PAES']);
  assert.deepEqual(CLASSMATES.filter((c) => c.tall).map((c) => c.name).sort(), ['BRENDAN', 'PONESSE', 'TAYLOR']);
  assert.deepEqual(CLASSMATES.filter((c) => c.short).map((c) => c.name).sort(), ['FIZZ', 'JIMMY', 'LOUIE', 'LOWELL', 'MASANGKAY']);
  assert.deepEqual(CLASSMATES.filter((c) => c.beefy).map((c) => c.name).sort(), ['BAKER', 'BRENDAN', 'ISTVAN']);

  const allNames = [...homePlayers, ...awayPlayers].map((p) => p.name);
  assert.equal(new Set(allNames).size, 8, 'All 8 drafted players in a match must be unique');

  for (const p of homePlayers) {
    assert.equal(p.wearsJacket, false, 'USER team wears clean St. Mikes school uniform');
  }
  for (const p of awayPlayers) {
    assert.equal(p.wearsJacket, false, 'CPU team wears clean contrasting St. Mikes uniform (no random outer jacket)');
    assert.ok(p.jacketColor, 'Goalies still carry a colorful recess jacket blocker shield');
  }

  // Verify clean contrasting St. Mike's uniform pairing:
  // - Regular mode: USER & corner hoops wear maroon/blue; CPU wears dress without blazer (white shirt/maroon tie/grey pants)
  // - Dress mode:   USER wears dress blazer; CPU wears maroon/blue; corner hoops wear dress without blazer
  assert.equal(resolveUniformKit('home', 'default'), 'default');
  assert.equal(resolveUniformKit('away', 'default'), 'dress_no_blazer');
  assert.equal(resolveUniformKit('hoops', 'default'), 'default');
  assert.equal(resolveUniformKit('home', 'dress'), 'dress_blazer');
  assert.equal(resolveUniformKit('away', 'dress'), 'default');
  assert.equal(resolveUniformKit('hoops', 'dress'), 'dress_no_blazer');

  // Default uniform mode should be everyday uniform ('default'), with optional 'dress' toggle
  const game = new FootHockeyGame();
  assert.equal(game.uniformMode, 'default');
  assert.equal(game.toggleUniformMode(), 'dress');
  assert.equal(game.toggleUniformMode(), 'default');

  // Starting a match shows the Starting Lineups card during opening FACEOFF and skips cleanly on Enter!
  game.startNewMatch();
  assert.equal(game.state, 'FACEOFF');
  assert.equal(game.showLineups, true, 'Match start should display the Starting Lineups card');
  for (let i = 0; i < 20; i++) game.update();
  game.onKeyDown('Enter');
  game.update();
  game.onKeyUp('Enter');
  assert.equal(game.stateTimer, 38, 'Pressing Enter on lineups card should immediately drop the faceoff ball');
});

test('boot intro spins SMCS crest uninterruptibly then automatically transitions to TITLE', () => {
  const game = new FootHockeyGame();
  assert.equal(game.state, 'BOOT');
  assert.equal(game.bootFrames, 0);

  // Advance full boot animation (random Gloria or Magnificat spin + "In Ludo Est!") -> should land on TITLE
  const initialChantId = game.bootChant.id;
  assert.ok(['gloria', 'magnificat'].includes(initialChantId), 'Boot intro should randomly pick Gloria or Magnificat');
  for (let i = 0; i < game.bootChant.totalFrames + 5; i++) game.update();
  assert.equal(game.state, 'TITLE');

  // Pressing I on TITLE replays the boot intro and switches to the other chant!
  game.onKeyDown('KeyI');
  game.update();
  game.onKeyUp('KeyI');
  assert.equal(game.state, 'BOOT');
  assert.notEqual(game.bootChant.id, initialChantId, 'Replaying intro with I should showcase the other chant');

  // Verify OPTIONS screen opens from TITLE via KeyO, toggles settings cleanly, and returns via Escape!
  game.state = 'TITLE';
  game.onKeyDown('KeyO');
  game.update();
  game.onKeyUp('KeyO');
  assert.equal(game.state, 'OPTIONS', 'Pressing O on Title should open the Options screen');
  assert.equal(game.optionsCursor, 0);
  // Toggle Uniforms (row 0) via ArrowRight
  game.onKeyDown('ArrowRight');
  game.update();
  game.onKeyUp('ArrowRight');
  assert.equal(game.uniformMode, 'dress', 'ArrowRight on Options row 0 should toggle Uniforms');
  // Move down to Weather (row 1) and toggle to Snow Day
  game.onKeyDown('ArrowDown');
  game.update();
  game.onKeyUp('ArrowDown');
  assert.equal(game.optionsCursor, 1);
  game.onKeyDown('ArrowRight');
  game.update();
  game.onKeyUp('ArrowRight');
  assert.equal(game.weather, 'snow', 'ArrowRight on Options row 1 should toggle Weather');
  // Escape returns cleanly to TITLE
  game.onKeyDown('Escape');
  game.update();
  game.onKeyUp('Escape');
  assert.equal(game.state, 'TITLE', 'Escape on Options should return cleanly to Title');

  // Verify PICK TEAMS (TEAM_SELECT) opens via KeyL, cycles cleanly without disturbing other slots, and starts with chosen roster!
  game.onKeyDown('KeyL');
  game.update();
  game.onKeyUp('KeyL');
  assert.equal(game.state, 'TEAM_SELECT', 'Pressing L on Title should open Pick Teams screen');
  assert.equal(game.draftSlots.length, 8);
  assert.equal(new Set(game.draftSlots).size, 8, 'All 8 initial draft slots must be unique classmates');
  // Release AVERY / ISTVAN if they landed in another slot, then select AVERY at HOME C and ISTVAN at AWAY G!
  const putInSlot = (slotIdx, targetName) => {
    const other = game.draftSlots.indexOf(targetName);
    if (other !== -1 && other !== slotIdx) game.cycleDraftSlot(other, 1);
    while (game.draftSlots[slotIdx] !== targetName) {
      game.cycleDraftSlot(slotIdx, 1);
    }
  };
  putInSlot(0, 'AVERY');
  putInSlot(7, 'ISTVAN');
  assert.equal(game.draftSlots[0], 'AVERY', 'Cycling another slot must never clobber HOME C');
  assert.equal(new Set(game.draftSlots).size, 8, 'Cycling slots must never create duplicate classmates');
  game.onKeyDown('Enter');
  game.update();
  game.onKeyUp('Enter');
  assert.equal(game.state, 'FACEOFF');
  assert.equal(game.players.find((p) => p.id === 'h_c')?.name, 'AVERY', 'Custom HOME C should be AVERY');
  assert.equal(game.players.find((p) => p.id === 'a_g')?.name, 'ISTVAN', 'Custom AWAY G should be ISTVAN');
  const hockeySet = new Set(game.players.map((p) => p.name));
  for (const h of game.hoopsGames) {
    for (const k of h.kids) {
      assert.ok(!hockeySet.has(k.name), `Corner hoops kid ${k.name} must stay undrafted after custom pick`);
    }
  }

  // Verify optional START_GATE waits for user interaction then enters BOOT cleanly once
  const gatedGame = new FootHockeyGame({ startOnGate: true });
  assert.equal(gatedGame.state, 'START_GATE');
  for (let i = 0; i < 30; i++) gatedGame.update();
  assert.equal(gatedGame.state, 'START_GATE', 'START_GATE should wait until user clicks/presses a key');
  gatedGame.onKeyDown('Enter');
  gatedGame.onKeyUp('Enter');
  assert.equal(gatedGame.state, 'BOOT', 'Pressing a key on START_GATE should launch BOOT intro');
  assert.equal(gatedGame.bootFrames, 0);

  // Verify BOOT intro cannot be skipped on keypress (everyone watches the full crest spin & "IN LUDO EST!")
  const gameNoSkip = new FootHockeyGame();
  for (let i = 0; i < 20; i++) gameNoSkip.update();
  assert.equal(gameNoSkip.state, 'BOOT');
  for (const key of ['Enter', 'Space', 'Escape', 'KeyZ', 'KeyX']) {
    gameNoSkip.onKeyDown(key);
    gameNoSkip.update();
    gameNoSkip.onKeyUp(key);
    assert.equal(gameNoSkip.state, 'BOOT', `Pressing ${key} must not skip the boot intro`);
  }
});

test('66 Bond court has larger blacktop, asymmetrical 90-degree nets, and swaps nets between recesses', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';

  assert.equal(game.court.name, '66 BOND');
  assert.ok(game.court.worldW > 320, '66 Bond should be wider than the original 320px court');
  assert.equal(game.court.topWindows.length, 5, 'Top black brick wall should have 5 equally spaced windows');

  const topNet = game.court.nets[0];
  const rightNet = game.court.nets[1];
  assert.equal(topNet.wall, 'top');
  assert.equal(rightNet.wall, 'right');
  assert.ok(topNet.centerX > game.court.bounds.centerX, 'Top yellow-brick net should be right of center (2nd gap from right)');
  assert.ok(rightNet.centerY > game.court.bounds.centerY, 'Right square cage net should be lower-middle');
  assert.ok(rightNet.span < topNet.span, 'Right square cage should be slightly thinner than top rectangle');
  assert.ok(rightNet.maxZ > topNet.maxZ, 'Right square cage should be taller than top rectangle');

  // Period 1 (Morning): Home attacks Top Yellow Bricks, camera is unrotated!
  assert.equal(game.getAttackNet('home').id, 'top_yellow');
  assert.equal(game.getDefendNet('home').id, 'right_cage');
  assert.equal(game.isCameraRotated(), false, 'Period 1 should not rotate camera');

  // Period 2 (Lunch Recess): Home attacks Right Window Cage -> camera rotates 90° CCW so UP drives toward the right net!
  game.period = 2;
  assert.equal(game.getAttackNet('home').id, 'right_cage');
  assert.equal(game.isCameraRotated(), true, 'Lunch Recess should rotate camera 90° CCW so player shoots UP');
  const skater = game.getControlledPlayer();
  skater.x = 240;
  skater.y = 240;
  skater.vx = 0;
  skater.vy = 0;
  game.onKeyDown('ArrowUp');
  game.update();
  game.onKeyUp('ArrowUp');
  assert.ok(skater.vx > 0, 'Pressing UP during rotated Lunch Recess should skate +X toward the right square cage net');

  // Optional toggle (V key) disables Lunch Recess rotation cleanly -> UP returns to standard -Y world movement!
  assert.equal(game.toggleRotateLunchView(), false);
  assert.equal(game.isCameraRotated(), false, 'Disabling Lunch rotation keeps fixed court orientation');
  skater.vx = 0;
  skater.vy = 0;
  game.onKeyDown('ArrowUp');
  game.update();
  game.onKeyUp('ArrowUp');
  assert.ok(skater.vy < 0, 'With Lunch rotation off, pressing UP should skate standard -Y');
  game.toggleRotateLunchView();
  game.period = 1;

  // High shot at z=23 misses over top rectangle (maxZ=18) but SCORES on taller right square cage (maxZ=28)!
  const highTopBall = createBall(topNet.centerX, topNet.lineCoord + 8, 23);
  highTopBall.vy = -6;
  const topHighEvent = stepBallPhysics(highTopBall, {}, game.court, game.getTeamNetMap());
  assert.equal(topHighEvent, null, 'Shot above top rectangle height (z=23 > 18) should not score');

  const lowTopBall = createBall(topNet.centerX, topNet.lineCoord + 8, 10);
  lowTopBall.vy = -6;
  const topLowEvent = stepBallPhysics(lowTopBall, {}, game.court, game.getTeamNetMap());
  assert.equal(topLowEvent?.scoredBy, 'home', 'Low shot into yellow-brick gap should score for home');

  const highRightBall = createBall(rightNet.lineCoord - 8, rightNet.centerY, 23);
  highRightBall.vx = 6;
  const rightHighEvent = stepBallPhysics(highRightBall, {}, game.court, game.getTeamNetMap());
  assert.equal(rightHighEvent?.scoredBy, 'away', 'Taller right square cage (maxZ=28) should allow z=23 goal');

  // Period 2 (Lunch): Teams swap nets!
  game.period = 2;
  assert.equal(game.getAttackNet('home').id, 'right_cage', 'Teams should swap nets for Lunch Recess');
  assert.equal(game.getDefendNet('home').id, 'top_yellow');
});

test('demo mode runs full CPU-vs-CPU match, auto-starts after title idle, and exits cleanly', () => {
  const game = new FootHockeyGame();
  game.state = 'TITLE';

  // Press D on Title Screen -> launches CPU-vs-CPU Demo Mode!
  game.onKeyDown('KeyD');
  game.update();
  game.onKeyUp('KeyD');
  assert.equal(game.isDemo, true);
  assert.equal(game.state, 'FACEOFF');

  // Simulate 3 seconds of CPU-vs-CPU play — Home center should move autonomously!
  const homeCenter = game.players.find((p) => p.id === 'h_c');
  const startX = homeCenter.x;
  const startY = homeCenter.y;
  for (let i = 0; i < 180; i++) game.update();
  assert.ok(
    Math.hypot(homeCenter.x - startX, homeCenter.y - startY) > 10,
    'Home skater should move autonomously under CPU control in Demo Mode'
  );

  // Press Escape -> returns cleanly to TITLE
  game.onKeyDown('Escape');
  game.update();
  game.onKeyUp('Escape');
  assert.equal(game.isDemo, false);
  assert.equal(game.state, 'TITLE');

  // Demo GAME_OVER lingers for 21s, cycling through TEAM -> PLAYERS -> SUMMARY, then plays Amen -> TITLE!
  game.startDemoMatch();
  game.state = 'GAME_OVER';
  game.stateTimer = 0;
  game.statsPage = 'team';
  for (let i = 0; i < 420; i++) game.update();
  assert.equal(game.state, 'GAME_OVER', 'Demo Mode should still linger on final stats after 7 seconds');
  assert.equal(game.statsPage, 'players', 'Demo Mode final screen should auto-advance to PLAYERS tab');
  for (let i = 0; i < 420; i++) game.update();
  assert.equal(game.state, 'GAME_OVER', 'Demo Mode should still linger on final stats after 14 seconds');
  assert.equal(game.statsPage, 'summary', 'Demo Mode final screen should auto-advance to SUMMARY tab');
  for (let i = 0; i < MATCH.demoGameOverFrames - 840; i++) game.update();
  assert.equal(game.state, 'POST_CREDITS', 'Demo Mode should launch Amen after full 21s final-stats showcase');
  assert.equal(game.postCreditsNextState, 'TITLE', 'Demo Mode Amen should transition to TITLE');
  assert.equal(game.isDemo, false);
  game.postCreditsFrames = MARCELLI_AMEN_TIMING.totalFrames - 1;
  game.update();
  assert.equal(game.state, 'TITLE', 'Demo Mode should return cleanly to TITLE after Amen finishes');

  // Auto-attract: idling 600 frames on TITLE automatically launches Demo Mode
  for (let i = 0; i < 605; i++) game.update();
  assert.equal(game.isDemo, true, 'Title Screen should auto-launch Demo Mode after idle timeout');

  // Pressing Enter during Demo Mode jumps straight into a real 1P match
  game.onKeyDown('Enter');
  game.update();
  game.onKeyUp('Enter');
  assert.equal(game.isDemo, false);
  assert.equal(game.state, 'FACEOFF');
});

test('66 Bond top-left corner basketball players stay active and deflect the tennis ball in play', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';

  assert.ok(game.hoopsGames && game.hoopsGames.length === 2, '66 Bond should have two corner basketball games (top-left and lower-left)');
  assert.equal(game.hoopsGames[0].wall, 'left', 'Top-left basketball hoop should sit on left wall');
  assert.equal(game.hoopsGames[1].wall, 'bottom', 'Lower-left basketball hoop should sit on bottom red-brick wall');
  assert.ok(
    game.hoopsGames[1].zone.right < game.court.basementStairs.x1,
    'Lower-left basketball court should stay cleanly to the left of Basement 56 stairs'
  );
  assert.equal(game.hoops.kids.length, 3);
  assert.equal(game.hoopsGames[1].kids.length, 3);
  assert.ok(game.hoops.zone.hoopX < game.court.bounds.centerX, 'Basketball hoop should sit in top-left corner');

  // Verify all 6 corner basketball players are actual UNDRAFTED St. Mike's classmates (no overlap with hockey players!)
  const hockeyNames = new Set(game.players.map((p) => p.name));
  const rosterNames = new Set(CLASSMATES.map((c) => c.name));
  const hoopsNames = game.hoopsGames.flatMap((h) => h.kids.map((k) => k.name));
  assert.equal(new Set(hoopsNames).size, 6, 'All 6 corner basketball kids should be distinct classmates');
  for (const name of hoopsNames) {
    assert.ok(rosterNames.has(name), `Basketball player ${name} should be from CLASSMATES`);
    assert.ok(!hockeyNames.has(name), `Basketball player ${name} must be an UNDRAFTED classmate, not playing foot hockey`);
  }

  // Fire tennis ball straight at the first basketball kid -> should deflect or get booted away in play!
  const hoopKid = game.hoops.kids[0];
  game.ball.owner = null;
  game.ball.x = hoopKid.x + 6;
  game.ball.y = hoopKid.y;
  game.ball.z = 5;
  game.ball.vx = -4;
  game.ball.vy = 0;

  game.update();
  assert.ok(
    game.ball.vx > 0 || hoopKid.kickTimer > 0,
    'Tennis ball should either ricochet off or get booted away by an in-play basketball kid'
  );

  // Verify basketball kid eventually boots a nearby slow tennis ball away in a random direction
  let kicked = false;
  for (let attempt = 0; attempt < 30 && !kicked; attempt++) {
    hoopKid.kickCooldown = 0;
    hoopKid.kickTimer = 0;
    game.ball.owner = null;
    game.ball.x = hoopKid.x + 12;
    game.ball.y = hoopKid.y;
    game.ball.z = 2;
    game.ball.vx = 0;
    game.ball.vy = 0;
    game.update();
    if (hoopKid.kickTimer > 0 && Math.hypot(game.ball.vx, game.ball.vy) > 3.0) {
      kicked = true;
      assert.ok(
        game.callouts.some((c) => c.text === hoopKid.name),
        `Kicking tennis ball should pop up the basketball classmate's name (${hoopKid.name}) near his foot`
      );
    }
  }
  assert.ok(kicked, 'Basketball kid should sometimes boot a nearby tennis ball away');
});

test('body checking is legal along the left wall on clear days and legal everywhere when snowing', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';

  const leftWallX = game.court.bounds.left + 20;
  const centerX = game.court.bounds.centerX;

  // Clear weather: legal along left wall, NOT legal at center court
  assert.equal(game.weather, 'clear');
  assert.equal(game.isBodyCheckLegal(leftWallX), true);
  assert.equal(game.isBodyCheckLegal(centerX), false);

  // Execute body check along left wall -> victim gets stunned & check stat increments!
  const hitter = game.players.find((p) => p.id === 'h_c');
  const victim = game.players.find((p) => p.id === 'a_c');
  hitter.x = leftWallX + 12;
  hitter.y = 220;
  victim.x = leftWallX;
  victim.y = 220;
  game.ball.owner = victim;
  game.attemptSteal(hitter);
  assert.ok(victim.stunTimer > 0, 'Left-wall body check should stun opponent');
  assert.equal(game.ball.owner, null, 'Body check should pop the tennis ball loose');
  assert.equal(game.stats.home.checks, 1);
  assert.ok(
    game.leftWallImpact.timer > 0 && Math.abs(game.leftWallImpact.y - victim.y) < 10,
    'Checking a player into the left wall should trigger the elastic wall-flex wave at point of impact'
  );

  // Toggle to Snow weather -> body checking is now legal EVERYWHERE!
  assert.equal(game.toggleWeather(), 'snow');
  assert.equal(game.isBodyCheckLegal(centerX), true, 'In snow, body checking is legal everywhere');

  victim.stunTimer = 0;
  hitter.stealCooldown = 0;
  hitter.x = centerX - 12;
  hitter.y = 240;
  victim.x = centerX;
  victim.y = 240;
  game.attemptSteal(hitter);
  assert.ok(victim.stunTimer > 0, 'Open-court body check should stun opponent during Snow Day');
  assert.equal(game.stats.home.checks, 2);
});

test('Basement 56 staircase on bottom red-brick wall catches ball from right and awards other team restart at entrance', () => {
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';
  const s = game.court.basementStairs;
  assert.ok(s, '66 Bond should have a Basement 56 staircase along the bottom wall');

  // Low ball hitting the green barrier from above bounces off (does NOT fall in)
  game.ball.owner = null;
  game.ball.lastTouchTeam = 'home';
  game.ball.x = (s.x1 + s.x2) / 2;
  game.ball.y = s.y1 - 4;
  game.ball.z = 2;
  game.ball.vx = 0;
  game.ball.vy = 6;
  game.update();
  assert.equal(game.state, 'PLAYING', 'Green barrier should deflect low balls from above');
  assert.ok(game.ball.vy < 0, 'Ball should bounce back up off green barrier');

  // Ball rolling into the OPEN RIGHT ENTRANCE falls down into Basement 56!
  game.ball.owner = null;
  game.ball.lastTouchTeam = 'home';
  game.ball.x = s.x2 + 2;
  game.ball.y = s.y1 + 10;
  game.ball.z = 2;
  game.ball.vx = -6;
  game.ball.vy = 0;
  game.update();
  assert.equal(game.state, 'BASEMENT_56', 'Entering staircase from the right should trigger Basement 56');
  assert.equal(game.restartTeam, 'away', 'Other team should be awarded possession');

  // After Basement 56 timer expires, Away starts with possession right at the staircase entrance!
  game.stateTimer = 1;
  game.update();
  assert.equal(game.state, 'RESTART');
  assert.equal(game.ball.owner?.team, 'away');
  assert.ok(
    Math.hypot(game.ball.owner.x - s.entranceX, game.ball.owner.y - s.entranceY) < 5,
    'Awarded team should restart play right at the staircase entrance'
  );

  // Verify bottom-right ascending stairs & seated kid landmark ("The Bird That Couldn't Fly.")
  const cs = game.court.cornerStairs;
  assert.ok(cs, '66 Bond should have the bottom-right corner stairs landmark');
  assert.equal(cs.caption, "The Bird That Couldn't Fly.");
  assert.ok(cs.x1 > s.x2, 'Bottom-right stairs should sit cleanly to the right of Basement 56');

  // Verify protruding brick room just above the right-wall square cage net bounces the ball cleanly
  const pr = game.court.protrudingRoom;
  const rightNet = game.court.nets[1];
  assert.ok(pr, '66 Bond should have the protruding room on the right wall');
  assert.ok(pr.y2 < rightNet.minCoord, 'Protruding room should sit just above the right-wall net');
  game.state = 'PLAYING';
  game.ball.owner = null;
  game.ball.x = pr.x1 - 2;
  game.ball.y = (pr.y1 + pr.y2) / 2;
  game.ball.z = 4;
  game.ball.vx = 5;
  game.ball.vy = 0;
  game.update();
  assert.ok(game.ball.vx < 0, 'Tennis ball should bounce off the left face of the protruding room');
});

test('Safari audio compatibility: prefers MP3 when Ogg is unsupported and ships MP3 + OGG boot assets', () => {
  assert.deepEqual(getAudioFormatOrder(true), ['ogg', 'mp3'], 'Chrome/Firefox should prefer Ogg first');
  assert.deepEqual(getAudioFormatOrder(false), ['mp3', 'ogg'], 'Safari (no Ogg Vorbis) should prefer MP3 first');
  assert.deepEqual(
    getAudioCandidates('./assets/audio/boot-gloria', false),
    ['./assets/audio/boot-gloria.mp3', './assets/audio/boot-gloria.ogg'],
    'Safari chant candidates must request .mp3 before .ogg'
  );
  assert.deepEqual(
    getAudioCandidates('./assets/audio/boot-voice', false, ['./assets/audio/boot-voice.wav']),
    ['./assets/audio/boot-voice.mp3', './assets/audio/boot-voice.ogg', './assets/audio/boot-voice.wav'],
    'Safari voice candidates must request .mp3 before .ogg and .wav'
  );

  // Verify every boot chant and boot voice clip exists on disk in both .ogg and .mp3 formats!
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const requiredBaseUrls = [...BOOT_CHANTS.map((c) => c.baseUrl), './assets/audio/boot-voice'];
  for (const baseUrl of requiredBaseUrls) {
    for (const ext of ['ogg', 'mp3']) {
      const assetPath = resolve(repoRoot, `${baseUrl}.${ext}`);
      assert.ok(existsSync(assetPath), `Expected boot audio asset to exist: ${baseUrl}.${ext}`);
      assert.ok(statSync(assetPath).size > 4096, `Expected non-empty boot audio asset: ${baseUrl}.${ext}`);
    }
  }
});

test('mobile touch controls: analog stick deadzone/clamping, context utility shortcuts, and skating integration', () => {
  // Deadzone suppresses tiny thumb jitter
  const dead = computeStickVector(4, -3, 44, 0.2);
  assert.equal(dead.mx, 0);
  assert.equal(dead.my, 0);
  assert.equal(dead.dirKey, null);

  // Full pull right clamps cleanly to maxRadius and fires ArrowRight menu edge
  const right = computeStickVector(120, 0, 44, 0.2);
  assert.equal(right.mx, 1);
  assert.equal(right.my, 0);
  assert.equal(right.knobX, 44);
  assert.equal(right.dirKey, 'ArrowRight');

  // Diagonal pull stays unit-bounded
  const diag = computeStickVector(-50, -50, 44, 0.2);
  assert.ok(Math.hypot(diag.mx, diag.my) <= 1.001, 'Diagonal analog magnitude must stay <= 1');
  assert.ok(diag.mx < -0.6 && diag.my < -0.6);

  // Touch mode auto-detection and URL override
  assert.equal(shouldEnableTouchMode({ maxTouchPoints: 0, coarsePointer: false, search: '' }), false);
  assert.equal(shouldEnableTouchMode({ maxTouchPoints: 5, coarsePointer: true, search: '' }), true);
  assert.equal(shouldEnableTouchMode({ maxTouchPoints: 0, coarsePointer: false, search: '?touch=1' }), true);
  assert.equal(shouldEnableTouchMode({ maxTouchPoints: 5, coarsePointer: true, search: '?touch=0' }), false);

  // Context utility bar exposes the right actions for every screen (no SKIP or MUTE on mobile BOOT, no redundant AMEN on POST_CREDITS!)
  assert.deepEqual(
    getUtilityButtonsForState('BOOT', false).map((b) => b.code),
    [],
    'Mobile BOOT utility strip should show neither SKIP nor MUTE'
  );
  assert.deepEqual(
    getUtilityButtonsForState('POST_CREDITS', false).map((b) => b.code),
    [],
    'Mobile POST_CREDITS (Amen) utility strip should show no buttons (never mute Palestrina!)'
  );
  assert.deepEqual(
    getUtilityButtonsForState('PLAYING', false).map((b) => b.code),
    ['KeyP', 'KeyB', 'KeyN', 'KeyM']
  );
  assert.deepEqual(
    getUtilityButtonsForState('PAUSED', false).map((b) => b.code),
    ['KeyP', 'KeyR', 'KeyQ', 'KeyM']
  );
  assert.deepEqual(
    getUtilityButtonsForState('GAME_OVER', false).map((b) => b.code),
    ['Enter', 'KeyQ', 'KeyI', 'KeyM']
  );
  assert.deepEqual(
    getUtilityButtonsForState('TEAM_SELECT', false).map((b) => b.code),
    ['Enter', 'Tab', 'KeyR', 'Escape']
  );

  // Utility tap flow: PLAYING -> PAUSE (KeyP) -> END GAME (KeyQ) -> GAME_OVER
  const pauseGame = new FootHockeyGame();
  pauseGame.startNewMatch();
  pauseGame.state = 'PLAYING';
  pauseGame.onKeyDown('KeyP');
  pauseGame.update();
  pauseGame.onKeyUp('KeyP');
  assert.equal(pauseGame.state, 'PAUSED');
  pauseGame.onKeyDown('KeyQ');
  pauseGame.update();
  pauseGame.onKeyUp('KeyQ');
  assert.equal(pauseGame.state, 'GAME_OVER', 'END GAME utility tap on PAUSED must transition to GAME_OVER');

  // MUSIC button (KeyN) cycles through all 3 songs -> OFF -> wraps back to song 1 (Sicut Cervus)!
  sound.musicTrackIndex = 0;
  if (!sound.music.enabled) sound.toggleMusic();
  pauseGame.state = 'PLAYING';
  pauseGame.onKeyDown('KeyN');
  pauseGame.onKeyUp('KeyN');
  assert.equal(sound.music.enabled, true);
  assert.equal(sound.getMusicTrack().id, 'gloria_viii', 'First MUSIC tap should advance to Gloria VIII');
  pauseGame.onKeyDown('KeyN');
  pauseGame.onKeyUp('KeyN');
  assert.equal(sound.music.enabled, true);
  assert.equal(sound.getMusicTrack().id, 'salve_regina', 'Second MUSIC tap should advance to Salve Regina');
  pauseGame.onKeyDown('KeyN');
  pauseGame.onKeyUp('KeyN');
  assert.equal(sound.music.enabled, false, 'Third MUSIC tap after final song should turn music OFF');
  pauseGame.onKeyDown('KeyN');
  pauseGame.onKeyUp('KeyN');
  assert.equal(sound.music.enabled, true, 'Fourth MUSIC tap from OFF should turn music back ON');
  assert.equal(sound.getMusicTrack().id, 'sicut_cervus', 'Wrapping back ON from OFF should return to Sicut Cervus');

  // Virtual thumbstick drives skater movement in both normal & rotated Lunch Recess views!
  const game = new FootHockeyGame();
  game.startNewMatch();
  game.state = 'PLAYING';
  const skater = game.getControlledPlayer();
  skater.x = 220;
  skater.y = 220;
  skater.vx = 0;
  skater.vy = 0;
  game.setTouchMove(0, -1);
  game.update();
  assert.ok(skater.vy < 0, 'Pushing touch stick UP in Period 1 should skate -Y');

  // Rotated Lunch Recess: pushing touch stick UP drives +X toward the right cage net!
  game.period = 2;
  skater.vx = 0;
  skater.vy = 0;
  game.setTouchMove(0, -1);
  game.update();
  assert.ok(skater.vx > 0, 'Pushing touch stick UP in rotated Lunch Recess should skate +X');
  game.setTouchMove(0, 0);
});

test('classmate personality quirks: Adam cherry-picks, Daniel stays down & hogs ball, Istvan flees ball, Arpad bombs from deep', () => {
  const game = new FootHockeyGame();
  game.startNewMatch(false, {
    homeNames: ['ADAM', 'DANIEL', 'ARPAD', 'LOWELL'],
    awayNames: ['ISTVAN', 'BLAIR', 'PONESSE', 'MASANGKAY'],
  });
  game.state = 'PLAYING';
  game.weather = 'snow'; // Allow open-court checks to test Daniel's staysDown quirk cleanly

  const adam = game.players.find((p) => p.name === 'ADAM');
  const daniel = game.players.find((p) => p.name === 'DANIEL');
  const arpad = game.players.find((p) => p.name === 'ARPAD');
  const istvan = game.players.find((p) => p.name === 'ISTVAN');
  const ponesse = game.players.find((p) => p.name === 'PONESSE');

  // 1) ADAM (noDefense): when away has ball deep in home's end, AI Adam drifts UP toward away's top net instead of defending!
  game.controlledId = daniel.id; // Let AI steer Adam
  adam.x = 200;
  adam.y = 260;
  adam.vx = 0;
  adam.vy = 0;
  ponesse.x = 340;
  ponesse.y = 320;
  game.ball.owner = ponesse;
  for (let i = 0; i < 12; i++) game.update();
  assert.ok(adam.y < 258, `Adam (noDefense) should drift upfield toward top net instead of chasing back on defense (y=${adam.y.toFixed(1)})`);

  // 2) DANIEL (staysDown + ballHog): getting body-checked leaves Daniel sprawled out for ~4.5s (>= 260 frames)!
  assert.equal(daniel.ballHog, true, 'Daniel should have the ballHog quirk');
  ponesse.x = 200;
  ponesse.y = 240;
  daniel.x = 212;
  daniel.y = 240;
  daniel.stunTimer = 0;
  ponesse.stealCooldown = 0;
  game.ball.owner = daniel;
  game.attemptSteal(ponesse);
  assert.ok(daniel.stunTimer >= 260, `Daniel (staysDown) should stay down much longer when checked (stunTimer=${daniel.stunTimer})`);

  // 3) ISTVAN (scaredOfBall): flees AWAY when the tennis ball gets close!
  istvan.x = 180;
  istvan.y = 240;
  istvan.vx = 0;
  istvan.vy = 0;
  game.ball.owner = null;
  game.ball.x = 210;
  game.ball.y = 240;
  game.ball.z = 2;
  game.ball.vx = 0;
  game.ball.vy = 0;
  const distBefore = Math.hypot(istvan.x - game.ball.x, istvan.y - game.ball.y);
  for (let i = 0; i < 10; i++) game.update();
  const distAfter = Math.hypot(istvan.x - game.ball.x, istvan.y - game.ball.y);
  assert.ok(distAfter > distBefore + 3, `Istvan (scaredOfBall) should run away from nearby ball (${distBefore.toFixed(1)} -> ${distAfter.toFixed(1)})`);

  // 4) ARPAD (longBomber): rips a booming, accurate shot toward the top net even from 220px away!
  game.controlledId = adam.id; // Let AI steer Arpad
  const topNet = game.getAttackNet('home');
  arpad.x = topNet.centerX;
  arpad.y = topNet.lineCoord + 220;
  arpad.aiDecisionCooldown = 0;
  arpad.stunTimer = 0;
  game.ball.owner = arpad;
  game.update();
  assert.equal(game.ball.owner, null, 'Arpad (longBomber) should launch a long shot from 220px out');
  assert.ok(game.ball.vy < -5.5, `Arpad's long bomb should fire powerfully toward the top net (vy=${game.ball.vy.toFixed(2)})`);
  assert.ok(Math.abs(game.ball.vx) < 1.2, `Arpad's long bomb should stay tightly aimed on target (vx=${game.ball.vx.toFixed(2)})`);

  // 5) CHUNG (criesWhenHit): getting body-checked can make Chung sit down and cry!
  const chungGame = new FootHockeyGame();
  chungGame.startNewMatch(false, {
    homeNames: ['CHUNG', 'ADAM', 'BLAIR', 'LOWELL'],
    awayNames: ['PONESSE', 'BRENDAN', 'STEVE', 'MASANGKAY'],
  });
  chungGame.state = 'PLAYING';
  chungGame.weather = 'snow';
  const chung = chungGame.players.find((p) => p.name === 'CHUNG');
  const hitter = chungGame.players.find((p) => p.name === 'PONESSE');
  let cried = false;
  for (let attempt = 0; attempt < 25 && !cried; attempt++) {
    chung.x = 200;
    chung.y = 240;
    chung.stunTimer = 0;
    chung.cryTimer = 0;
    hitter.x = 188;
    hitter.y = 240;
    hitter.stealCooldown = 0;
    chungGame.ball.owner = chung;
    chungGame.attemptSteal(hitter);
    if (chung.cryTimer >= 200) cried = true;
  }
  assert.equal(cried, true, 'Chung (criesWhenHit) should sometimes sit down and cry when body-checked');

  // 6) AVERY (cageKicker): kicking the right-wall wire cage during a crease scramble rattles it and can steal a phantom goal!
  const averyGame = new FootHockeyGame();
  averyGame.startNewMatch(false, {
    homeNames: ['AVERY', 'BLAIR', 'STEVE', 'LOWELL'],
    awayNames: ['PONESSE', 'DEREK', 'KWONG', 'MASANGKAY'],
  });
  averyGame.state = 'PLAYING';
  averyGame.period = 2; // Lunch Recess: HOME attacks right_cage!
  const avery = averyGame.players.find((p) => p.name === 'AVERY');
  const rightCage = averyGame.getAttackNet('home');
  assert.equal(rightCage.id, 'right_cage');
  const awayG = averyGame.players.find((p) => p.id === 'a_g');
  awayG.x = rightCage.centerX - 14;
  awayG.y = rightCage.centerY;
  avery.x = rightCage.lineCoord - 14;
  avery.y = rightCage.centerY + 4;
  avery.cageKickCooldown = 0;
  averyGame.ball.owner = null;
  averyGame.ball.x = rightCage.centerX - 18;
  averyGame.ball.y = rightCage.centerY - 4;
  // Caught red-handed (rng = 0.95): cage shakes, no goal awarded!
  assert.equal(averyGame.attemptCageKick(avery, () => 0.95), 'caught');
  assert.equal(averyGame.score.home, 0);
  assert.ok(averyGame.goalShake.right_cage > 0, 'Kicking the wire cage should rattle it');
  // Gets away with it in the confusion (rng = 0.05): phantom goal counts for Avery!
  avery.cageKickCooldown = 0;
  assert.equal(averyGame.attemptCageKick(avery, () => 0.05), 'stolen');
  assert.equal(averyGame.score.home, 1, 'Successful cage-kick phantom goal should count on scoreboard');
  // Also works when timed with a fast incoming shot heading toward the cage (even from 75px out)!
  averyGame.state = 'PLAYING';
  avery.cageKickCooldown = 0;
  averyGame.ball.owner = null;
  averyGame.ball.x = rightCage.centerX - 72;
  averyGame.ball.y = rightCage.centerY + 18;
  averyGame.ball.vx = 4.5;
  averyGame.ball.vy = 0;
  assert.equal(averyGame.canAttemptCageKick(avery), true, 'Avery should be able to time a cage kick on an incoming shot');
  assert.equal(averyGame.attemptCageKick(avery, () => 0.1), 'stolen');
  assert.equal(averyGame.score.home, 2, 'Timing cage kick on incoming shot should steal a goal');
  // Teammate carrying the ball in the offensive zone makes AI Avery crash the wire cage post!
  averyGame.state = 'PLAYING';
  const blair = averyGame.players.find((p) => p.name === 'BLAIR');
  averyGame.controlledId = blair.id;
  blair.x = 280;
  blair.y = 260;
  averyGame.ball.owner = blair;
  avery.x = 340;
  avery.y = 250;
  avery.vx = 0;
  avery.vy = 0;
  const startCageDist = Math.hypot(avery.x - rightCage.lineCoord, avery.y - rightCage.centerY);
  for (let i = 0; i < 30; i++) averyGame.update();
  const endCageDist = Math.hypot(avery.x - rightCage.lineCoord, avery.y - rightCage.centerY);
  assert.ok(endCageDist < startCageDist - 25, 'AI Avery should crash toward the wire cage when a teammate has the ball');
});
