import test from 'node:test';
import assert from 'node:assert/strict';
import { COURT, GOAL } from '../src/constants.js';
import {
  catchBall,
  createBall,
  dropHeldBall,
  launchBall,
  stepBallPhysics,
} from '../src/physics.js';
import { FootHockeyGame } from '../src/game.js';

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
