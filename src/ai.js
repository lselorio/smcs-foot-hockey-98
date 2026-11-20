import { COURT, GOAL, PHYSICS } from './constants.js';
import { catchBall, dropHeldBall, launchBall } from './physics.js';

function steerToward(p, tx, ty, speedScale = 1) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const maxSpd = p.stats.speed * speedScale;
  p.vx += nx * PHYSICS.playerAccel * speedScale;
  p.vy += ny * PHYSICS.playerAccel * speedScale;
  const cur = Math.hypot(p.vx, p.vy);
  if (cur > maxSpd) {
    p.vx = (p.vx / cur) * maxSpd;
    p.vy = (p.vy / cur) * maxSpd;
  }
  p.facingX = nx;
  p.facingY = ny;
}

// Goalie AI + Save Detection (Baseball Glove Catch vs. Jacket Shield Block!)
export function updateGoalie(g, game) {
  const { ball } = game;
  const isTop = g.team === 'away';
  const goalLineY = isTop ? GOAL.topLineY : GOAL.bottomLineY;
  const homeCreaseY = isTop ? goalLineY + 11 : goalLineY - 11;
  g.facingX = 0;
  g.facingY = isTop ? 1 : -1;

  // If goalie caught the tennis ball in their baseball glove, pause briefly then clear/pass!
  if (g.holdingBall && ball.owner === g) {
    g.holdFrames++;
    g.vx *= 0.7;
    g.vy *= 0.7;
    if (g.holdFrames >= 38) {
      // Outlet pass to an open teammate on the wing!
      const mates = game.players.filter((p) => p.team === g.team && p.role !== 'G');
      mates.sort((a, b) => (isTop ? b.y - a.y : a.y - b.y));
      const target = mates[0];
      const dx = target ? target.x - g.x : (Math.random() - 0.5) * 80;
      const dy = target ? target.y - g.y : (isTop ? 90 : -90);
      launchBall(ball, g, dx, dy, 4.4, 2.2, {
        startZ: 7,
        cooldown: 14,
        passTargetId: target?.id ?? null,
      });
      game.onKickEffect(g.x, g.y, 'CLEAR!', '#ffe84d', false);
    }
    return;
  }

  // Track the ball along the goal mouth, cutting down the angle like an NHL '94 tender
  const clampLeft = GOAL.leftX + 9;
  const clampRight = GOAL.rightX - 9;
  let targetX = Math.max(clampLeft, Math.min(clampRight, ball.x));
  // Predict shot trajectory slightly when ball is flying toward the net
  const movingTowardGoal = isTop ? ball.vy < -1.1 : ball.vy > 1.1;
  if (!ball.owner && movingTowardGoal) {
    const framesToLine = Math.abs((homeCreaseY - ball.y) / (ball.vy || 0.01));
    if (framesToLine < 26) {
      const predX = ball.x + ball.vx * framesToLine * 0.78;
      targetX = Math.max(clampLeft - 4, Math.min(clampRight + 4, predX));
    }
  }

  const distToNet = Math.abs(ball.y - goalLineY);
  const stepOut = distToNet < 120 ? (isTop ? 4 : -4) : 0;
  const targetY = homeCreaseY + stepOut;

  const dx = targetX - g.x;
  const dy = targetY - g.y;
  const maxSpd = g.stats.speed * (movingTowardGoal ? 1.12 : 0.85);
  g.vx = Math.max(-maxSpd, Math.min(maxSpd, dx * 0.22));
  g.vy = Math.max(-maxSpd, Math.min(maxSpd, dy * 0.22));
  g.x += g.vx;
  g.y += g.vy;

  // === CHECK GOALIE SAVE (BASEBALL GLOVE vs. JACKET SHIELD!) ===
  if (ball.owner || ball.pickupCooldown > 0) return;

  const relX = ball.x - g.x;
  const relY = ball.y - g.y;
  const ballSpeed = Math.hypot(ball.vx, ball.vy);

  // Reach zone covers jacket on left (-17..0) and baseball glove on right (0..+16)
  const inY = Math.abs(relY) < 11;
  const inX = relX > -17 && relX < 17;
  if (!inY || !inX || ball.z > GOAL.height + 2) return;

  // Slightly beat-able on wicked corners/one-timers so goals feel rewarding!
  const edgeDistance = Math.abs(relX);
  const saveChance =
    ballSpeed > 5.4 && edgeDistance > 11
      ? g.stats.reflex * 0.52
      : g.stats.reflex * 0.94;

  if (Math.random() > saveChance) {
    // Goalie dives heroically but misses!
    g.diveDir = relX >= 0 ? 1 : -1;
    g.diveTimer = 14;
    return;
  }

  // Decide Baseball Glove Catch vs. Jacket Block based on side & ball height!
  const isGloveSide = relX >= 0 || ball.z >= 7;
  if (isGloveSide) {
    // BASEBALL GLOVE SNATCH!
    catchBall(ball, g);
    g.gloveTimer = 22;
    g.diveDir = 1;
    g.diveTimer = 10;
    game.onGoalieSave(g, 'glove');
  } else {
    // JACKET SHIELD BLOCK! Swings puffy coat out to deaden the shot into a rebound
    g.jacketTimer = 20;
    g.diveDir = -1;
    g.diveTimer = 10;
    const clearDirY = isTop ? 1 : -1;
    ball.vx = (relX * 0.14) + (Math.random() - 0.5) * 1.4;
    ball.vy = clearDirY * Math.max(1.6, Math.min(2.8, ballSpeed * 0.42));
    ball.vz = 1.6 + Math.random() * 0.8;
    ball.pickupCooldown = 10;
    ball.lastTouchTeam = g.team;
    ball.lastTouchPlayer = g;
    game.onGoalieSave(g, 'jacket');
  }
}

// Skater AI (Both Home AI teammates and Away CPU opponents!)
export function updateSkaterAI(p, game) {
  const { ball } = game;
  const isHome = p.team === 'home';
  const attackGoalY = isHome ? GOAL.topLineY : GOAL.bottomLineY;
  const defendGoalY = isHome ? GOAL.bottomLineY : GOAL.topLineY;
  const attackDir = isHome ? -1 : 1;

  // === CASE 1: THIS AI SKATER IS HOLDING A CAUGHT BALL ===
  if (p.holdingBall && ball.owner === p) {
    p.holdFrames++;
    // Aim toward goal or open teammate, then drop-kick or drop to feet!
    const distToGoal = Math.hypot(COURT.centerX - p.x, attackGoalY - p.y);
    p.facingX = (COURT.centerX - p.x) / (distToGoal || 1);
    p.facingY = (attackGoalY - p.y) / (distToGoal || 1);

    if (p.holdFrames > 22) {
      if (distToGoal < 165) {
        // Drop-kick volley at the net!
        const aimX = COURT.centerX + (Math.random() - 0.5) * 48 - p.x;
        const aimY = attackGoalY - p.y;
        launchBall(ball, p, aimX, aimY, p.stats.kick * 1.04, 2.9, { startZ: 5 });
        game.onKickEffect(p.x, p.y, 'DROP-KICK!', '#d9ff2e', true);
      } else {
        // Drop to feet to dribble forward!
        dropHeldBall(ball, p);
        game.onDropEffect(p);
      }
    }
    return;
  }

  // === CASE 2: THIS AI SKATER HAS THE BALL AT THEIR FEET ===
  if (ball.owner === p) {
    const goalDx = COURT.centerX - p.x;
    const goalDy = attackGoalY - p.y;
    const distToGoal = Math.hypot(goalDx, goalDy);

    // Shoot if in prime schoolyard range!
    if (distToGoal < 128 && p.aiDecisionCooldown <= 0) {
      const cornerOffset = (Math.random() > 0.5 ? 1 : -1) * (16 + Math.random() * 14);
      const aimX = COURT.centerX + cornerOffset - p.x;
      const aimY = attackGoalY - p.y;
      const loft = Math.random() > 0.45 ? 2.4 : 1.1;
      launchBall(ball, p, aimX, aimY, p.stats.kick * (0.94 + Math.random() * 0.14), loft);
      p.aiDecisionCooldown = 35;
      game.onKickEffect(p.x, p.y, null, null, false);
      return;
    }

    // Look for an open pass up-court if pressured
    const nearestOpp = game.findNearestPlayer(p.x, p.y, isHome ? 'away' : 'home', true);
    const pressured = nearestOpp && Math.hypot(nearestOpp.x - p.x, nearestOpp.y - p.y) < 26;
    if (pressured && p.aiDecisionCooldown <= 0 && Math.random() < 0.08) {
      const openMate = game.players.find(
        (m) =>
          m.team === p.team &&
          m.id !== p.id &&
          m.role !== 'G' &&
          (isHome ? m.y < p.y - 10 : m.y > p.y + 10)
      );
      if (openMate) {
        launchBall(ball, p, openMate.x - p.x, openMate.y - p.y, 4.2, 0.9, {
          passTargetId: openMate.id,
        });
        p.aiDecisionCooldown = 35;
        game.onKickEffect(p.x, p.y, null, null, false);
        return;
      }
    }

    // Drive toward the net while weaving slightly away from defender
    let tx = COURT.centerX + (p.role === 'LW' ? -28 : p.role === 'RW' ? 28 : 0);
    let ty = attackGoalY - attackDir * 58;
    if (nearestOpp && Math.hypot(nearestOpp.x - p.x, nearestOpp.y - p.y) < 34) {
      tx += p.x > nearestOpp.x ? 26 : -26;
    }
    steerToward(p, tx, ty, 0.92);
    return;
  }

  // === CASE 3: TEAMMATE HAS THE BALL -> GET OPEN FOR PASS / ONE-TIMER! ===
  if (ball.owner && ball.owner.team === p.team) {
    const laneX =
      p.role === 'LW'
        ? COURT.left + 44
        : p.role === 'RW'
        ? COURT.right - 44
        : COURT.centerX;
    // Push ahead into the slot for juicy NHL '94 cross-crease one-timers!
    const idealY = Math.max(
      COURT.top + 46,
      Math.min(COURT.bottom - 46, ball.owner.y + attackDir * 58)
    );
    steerToward(p, laneX, idealY, 0.9);
    return;
  }

  // === CASE 4: BALL IS LOOSE OR OPPONENT HAS IT ===
  const distToBall = Math.hypot(ball.x - p.x, ball.y - p.y);
  const isClosestMate = game.findNearestPlayer(ball.x, ball.y, p.team, true)?.id === p.id;

  // Opportunity to CATCH a bouncing/airborne tennis ball!
  if (!ball.owner && ball.z > 4 && ball.z < PHYSICS.catchMaxZ && distToBall < 14 && p.aiDecisionCooldown <= 0) {
    if (Math.random() < p.stats.hands * 0.16) {
      catchBall(ball, p);
      p.aiDecisionCooldown = 45;
      game.onCatchEffect(p);
      return;
    }
  }

  if (isClosestMate) {
    // Forecheck / chase the tennis ball!
    steerToward(p, ball.x, ball.y, 0.96);

    // Attempt poke-steal if opponent is dribbling right in front
    if (
      ball.owner &&
      ball.owner.team !== p.team &&
      !ball.owner.holdingBall &&
      distToBall < 15 &&
      p.stealCooldown <= 0
    ) {
      if (Math.random() < 0.07) {
        game.attemptSteal(p);
      }
    }
  } else {
    // Support / defensive shape between ball and own goal
    const laneX =
      p.role === 'LW'
        ? COURT.left + 56
        : p.role === 'RW'
        ? COURT.right - 56
        : COURT.centerX;
    const supportY = (ball.y * 0.55 + defendGoalY * 0.45);
    steerToward(p, (laneX + ball.x) * 0.5, supportY, 0.82);
  }
}
