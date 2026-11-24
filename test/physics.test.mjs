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
import { GLORIA_VIII_SCORE } from '../src/music/gloria-viii.js';
import { ChiptuneChoirPlayer } from '../src/music-player.js';
import { sound } from '../src/audio.js';

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

  // Pause and press Q -> quits cleanly back to TITLE screen!
  game.onKeyDown('KeyP');
  game.update();
  game.onKeyUp('KeyP');
  assert.equal(game.state, 'PAUSED');
  game.onKeyDown('KeyQ');
  game.update();
  game.onKeyUp('KeyQ');
  assert.equal(game.state, 'TITLE', 'Pressing Q while paused should return to Title screen');

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
  const lastGoal = game.goalLog[game.goalLog.length - 1];
  assert.deepEqual(lastGoal.assists, [passer.name, goalie.name]);
  assert.match(lastGoal.time, /^\d:\d\d$/, 'Goal log entry should record NHL-style period elapsed time');
  assert.equal(game.stats.home.periodGoals[0], 1, 'Period 1 goal count should increment for Game Summary');
  assert.equal(game.stats.home.periodShots[0], 1, 'Period 1 shots-on-goal count should increment for Game Summary');

  // On GAME_OVER ("Ite, ludus finitus est"), ArrowRight toggles Player Stats and Escape returns to TITLE!
  game.state = 'GAME_OVER';
  game.onKeyDown('ArrowRight');
  game.update();
  game.onKeyUp('ArrowRight');
  assert.equal(game.statsPage, 'players', 'ArrowRight on GAME_OVER should switch to Player Stats page');
  game.onKeyDown('Escape');
  game.update();
  game.onKeyUp('Escape');
  assert.equal(game.state, 'TITLE', 'Pressing Escape on GAME_OVER should return to Title screen');
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
  // Final Amen includes the signature B-flat (70)
  assert.ok(GLORIA_VIII_SCORE.tracks[0].notes.some((n) => n[2] === 70), 'Gloria VIII Amen should include Bb4');

  // Default track should be Sicut Cervus, and cycling / auto-advancing switches cleanly to Gloria VIII!
  assert.equal(sound.getMusicTrack().id, 'sicut_cervus', 'Default BGM track should be Sicut Cervus');
  const nextTrack = sound.cycleMusicTrack().id;
  assert.equal(nextTrack, 'gloria_viii');
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
  ];
  assert.deepEqual(
    CLASSMATES.map((c) => c.name),
    expectedNames,
    'Master classmate roster should contain all 15 classmates'
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
  assert.equal(
    avery.stats.speed,
    Math.max(...CLASSMATES.map((c) => c.stats.speed)),
    'Avery should be the fastest classmate on 66 Bond'
  );
  assert.equal(
    paes.stats.control,
    Math.max(...CLASSMATES.map((c) => c.stats.control)),
    'Paes should have top ball control'
  );
  assert.ok(fizz.stats.speed < 1.70 && fizz.stats.speed > istvan.stats.speed + 0.25, 'Fizz should be below average but much better than Istvan');

  const { homePlayers, awayPlayers } = draftRecessTeams();
  assert.equal(homePlayers.length, 4);
  assert.equal(awayPlayers.length, 4);

  // Lowell & Masangkay should always be slotted as the two starting goalies!
  const goalieNames = [homePlayers[3].name, awayPlayers[3].name].sort();
  assert.deepEqual(goalieNames, ['LOWELL', 'MASANGKAY'], 'Lowell and Masangkay should always play goalie');

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

test('boot intro spins SMCS crest then automatically transitions to TITLE (or skips on input)', () => {
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

  // Verify skipping on keypress after brief intro
  const gameSkip = new FootHockeyGame();
  for (let i = 0; i < 20; i++) gameSkip.update();
  assert.equal(gameSkip.state, 'BOOT');
  gameSkip.onKeyDown('Enter');
  gameSkip.update();
  gameSkip.onKeyUp('Enter');
  assert.equal(gameSkip.state, 'TITLE');
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

  // Period 1 (Morning): Home attacks Top Yellow Bricks, defends Right Square Cage
  assert.equal(game.getAttackNet('home').id, 'top_yellow');
  assert.equal(game.getDefendNet('home').id, 'right_cage');

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
