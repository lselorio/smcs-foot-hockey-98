import { PHYSICS } from './constants.js';
import { catchBall, dropHeldBall, launchBall, launchThrow } from './physics.js';

function steerToward(p, tx, ty, speedScale = 1, isSnow = false) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const agilityMod = 0.82 + (p.stats.control ?? 0.85) * 0.24;
  const accel = (isSnow ? 0.19 : PHYSICS.playerAccel) * speedScale * agilityMod;
  const maxSpd = p.stats.speed * speedScale * (isSnow ? 1.06 : 1);
  p.vx += nx * accel;
  p.vy += ny * accel;
  const cur = Math.hypot(p.vx, p.vy);
  if (cur > maxSpd) {
    p.vx = (p.vx / cur) * maxSpd;
    p.vy = (p.vy / cur) * maxSpd;
  }
  p.facingX = nx;
  p.facingY = ny;
}

// Goalie AI + Save Detection — supports ANY wall orientation (top yellow-brick rectangle, right square cage, etc.)!
export function updateGoalie(g, game) {
  const { ball } = game;
  const net = game.getDefendNet(g.team);
  const isVerticalWall = net.wall === 'left' || net.wall === 'right';
  const nx = net.normalX;
  const ny = net.normalY;
  // Tangent unit vector along the goal mouth
  const tx = -ny;
  const ty = nx;

  g.facingX = nx;
  g.facingY = ny;

  // If goalie caught the tennis ball in their baseball glove:
  // - Home goalie is controlled by the player to aim & THROW across the yard!
  // - Away CPU goalie scans teammates and launches an overhand throw!
  if (g.holdingBall && ball.owner === g) {
    g.holdFrames++;
    g.vx *= 0.7;
    g.vy *= 0.7;

    if (g.team === 'home' && !game.isDemo) {
      if (g.holdFrames >= PHYSICS.goalieMaxHoldFrames) {
        game.executeGoalieThrow(g, game.passTarget, false);
      }
      return;
    }

    if (g.holdFrames >= 38) {
      const attackNet = game.getAttackNet(g.team);
      const mates = game.players.filter((p) => p.team === g.team && p.role !== 'G');
      // Sort closest to opponent's net first for deep full-court throws!
      mates.sort(
        (a, b) =>
          Math.hypot(a.x - attackNet.centerX, a.y - attackNet.centerY) -
          Math.hypot(b.x - attackNet.centerX, b.y - attackNet.centerY)
      );
      const pickDeep = Math.random() < 0.55;
      const target = pickDeep ? mates[0] : mates[mates.length - 1];
      const aimX = target ? target.x + target.vx * 12 : game.court.bounds.centerX;
      const aimY = target ? target.y + target.vy * 12 : game.court.bounds.centerY;
      const info = launchThrow(ball, g, aimX, aimY, {
        passTargetId: target?.id ?? null,
        isBomb: pickDeep,
      });
      game.stats[g.team].passes++;
      if (g.matchStats) g.matchStats.passes++;
      game.onThrowEffect(g, info.dist > 165);
    }
    return;
  }

  // Track the ball along the goal mouth (horizontally for top/bottom walls, vertically for right/left walls!)
  const clampMin = net.minCoord + 8;
  const clampMax = net.maxCoord - 8;
  const baseDepth = 13;

  // Velocity toward the goal line (dot product with -normal)
  const velTowardGoal = -(ball.vx * nx + ball.vy * ny);
  const movingTowardGoal = !ball.owner && velTowardGoal > 1.0;

  let trackCoord = isVerticalWall ? ball.y : ball.x;
  if (movingTowardGoal) {
    const distFromCrease = Math.abs((ball.x - (net.centerX + nx * baseDepth)) * nx + (ball.y - (net.centerY + ny * baseDepth)) * ny);
    const framesToLine = distFromCrease / (velTowardGoal || 0.01);
    if (framesToLine < 26) {
      const predX = ball.x + ball.vx * framesToLine * 0.78;
      const predY = ball.y + ball.vy * framesToLine * 0.78;
      trackCoord = isVerticalWall ? predY : predX;
    }
  }
  const clampedCoord = Math.max(clampMin, Math.min(clampMax, trackCoord));

  const distToNet = Math.hypot(ball.x - net.centerX, ball.y - net.centerY);
  const stepOut = distToNet < 140 ? 4 : 0;
  const depth = baseDepth + stepOut;

  const targetX = isVerticalWall ? net.lineCoord + nx * depth : clampedCoord;
  const targetY = isVerticalWall ? clampedCoord : net.lineCoord + ny * depth;

  const dx = targetX - g.x;
  const dy = targetY - g.y;
  const maxSpd = g.stats.speed * (movingTowardGoal ? 1.14 : 0.88);
  g.vx = Math.max(-maxSpd, Math.min(maxSpd, dx * 0.24));
  g.vy = Math.max(-maxSpd, Math.min(maxSpd, dy * 0.24));
  g.x += g.vx;
  g.y += g.vy;

  // === CHECK GOALIE SAVE (BASEBALL GLOVE vs. JACKET SHIELD!) ===
  if (ball.owner || ball.pickupCooldown > 0) return;

  const relX = ball.x - g.x;
  const relY = ball.y - g.y;
  // Project relative ball position into goalie's local (along-mouth tangent, out-of-net normal) coordinates!
  const alongMouth = relX * tx + relY * ty;
  const outFromNet = relX * nx + relY * ny;
  const ballSpeed = Math.hypot(ball.vx, ball.vy);

  const inDepth = Math.abs(outFromNet) < 11.5;
  const inReach = Math.abs(alongMouth) < 16;
  if (!inDepth || !inReach || ball.z > net.maxZ + 2) return;

  // Hard Shots (slap-kicks) & wicked corners are tougher for the goalie to stop!
  const edgeDistance = Math.abs(alongMouth);
  const isHardShot = ball.shotPower >= 6.4 || ballSpeed >= 6.2;
  let saveChance = g.stats.reflex * 0.88;
  if (isHardShot && edgeDistance > 8.5) {
    saveChance = g.stats.reflex * 0.34;
  } else if (isHardShot) {
    saveChance = g.stats.reflex * 0.65;
  } else if (ballSpeed > 5.0 && edgeDistance > 10) {
    saveChance = g.stats.reflex * 0.50;
  }

  if (Math.random() > saveChance) {
    g.diveDir = alongMouth >= 0 ? 1 : -1;
    g.diveTimer = 14;
    return;
  }

  const shooterTeam = ball.lastTouchTeam;
  const shooterPlayer = ball.lastTouchPlayer;
  const isSlowCreaseScoop = ballSpeed < 2.4 && Math.hypot(relX, relY) < 13;
  const isGloveSide = isSlowCreaseScoop || alongMouth >= 0 || ball.z >= 7;
  if (isGloveSide) {
    catchBall(ball, g);
    g.gloveTimer = 22;
    g.diveDir = 1;
    g.diveTimer = 10;
    game.onGoalieSave(g, 'glove', shooterTeam, shooterPlayer);
    if (g.team === 'home' && !game.isDemo) {
      game.controlledId = g.id;
    }
  } else {
    g.jacketTimer = 20;
    g.diveDir = -1;
    g.diveTimer = 10;
    const rebSpeed = Math.max(1.7, Math.min(3.0, ballSpeed * 0.44));
    const spread = (alongMouth * 0.14) + (Math.random() - 0.5) * 1.4;
    ball.vx = nx * rebSpeed + tx * spread;
    ball.vy = ny * rebSpeed + ty * spread;
    ball.vz = 1.6 + Math.random() * 0.8;
    ball.pickupCooldown = 10;
    // Preserve attacking possession chain on a jacket-block rebound for primary & secondary assist credit!
    if (ball.possessionTeam && ball.possessionTeam !== g.team && ball.possessionChain.length > 0) {
      ball.reboundTeam = ball.possessionTeam;
      ball.reboundChain = [...ball.possessionChain];
    } else if (shooterPlayer && shooterPlayer.team !== g.team) {
      ball.reboundTeam = shooterPlayer.team;
      ball.reboundChain = [shooterPlayer];
    } else {
      ball.reboundTeam = null;
      ball.reboundChain = [];
    }
    ball.possessionTeam = null;
    ball.possessionChain = [];
    ball.lastTouchTeam = g.team;
    ball.lastTouchPlayer = g;
    game.onGoalieSave(g, 'jacket', shooterTeam, shooterPlayer);
  }
}

// Skater AI — fully general for 90-degree / diagonal asymmetrical courts like 66 Bond!
export function updateSkaterAI(p, game) {
  if (p.stunTimer > 0) return;
  const { ball, court } = game;
  const isSnow = game.weather === 'snow';
  const bounds = court.bounds;
  const attackNet = game.getAttackNet(p.team);
  const defendNet = game.getDefendNet(p.team);

  // Unit attack axis from defendNet -> attackNet + perpendicular wing axis
  const axRaw = attackNet.centerX - defendNet.centerX;
  const ayRaw = attackNet.centerY - defendNet.centerY;
  const aMag = Math.hypot(axRaw, ayRaw) || 1;
  const ax = axRaw / aMag;
  const ay = ayRaw / aMag;
  const wx = -ay; // Perpendicular left/right wing axis
  const wy = ax;

  const clampX = (v) => Math.max(bounds.left + 22, Math.min(bounds.right - 22, v));
  const clampY = (v) => Math.max(bounds.top + 22, Math.min(bounds.bottom - 22, v));

  // === CASE 1: THIS AI SKATER IS HOLDING A CAUGHT BALL ===
  if (p.holdingBall && ball.owner === p) {
    p.holdFrames++;
    const distToGoal = Math.hypot(attackNet.centerX - p.x, attackNet.centerY - p.y);
    p.facingX = (attackNet.centerX - p.x) / (distToGoal || 1);
    p.facingY = (attackNet.centerY - p.y) / (distToGoal || 1);

    if (p.holdFrames > 22) {
      if (distToGoal < 175) {
        // Drop-kick volley at the net (aim slightly higher on tall square cage, lower on top rectangle!)
        const spread = (Math.random() - 0.5) * (attackNet.span * 0.65);
        const aimX = attackNet.centerX + (-attackNet.normalY) * spread - p.x;
        const aimY = attackNet.centerY + attackNet.normalX * spread - p.y;
        const loft = attackNet.maxZ > 22 ? 3.2 : 2.1;
        launchBall(ball, p, aimX, aimY, p.stats.kick * 1.04, loft, { startZ: 5 });
        game.onKickEffect(p.x, p.y, 'DROP-KICK!', '#d9ff2e', true);
      } else {
        dropHeldBall(ball, p);
        game.onDropEffect(p);
      }
    }
    return;
  }

  // === CASE 2: THIS AI SKATER HAS THE BALL AT THEIR FEET ===
  if (ball.owner === p) {
    const goalDx = attackNet.centerX - p.x;
    const goalDy = attackNet.centerY - p.y;
    const distToGoal = Math.hypot(goalDx, goalDy);

    // Shoot if in prime schoolyard range!
    if (distToGoal < 142 && p.aiDecisionCooldown <= 0) {
      const cornerOffset = (Math.random() > 0.5 ? 1 : -1) * (attackNet.span * 0.28 + Math.random() * 6);
      const aimX = attackNet.centerX + (-attackNet.normalY) * cornerOffset - p.x;
      const aimY = attackNet.centerY + attackNet.normalX * cornerOffset - p.y;
      const loft = attackNet.maxZ > 22 ? (Math.random() > 0.35 ? 2.7 : 1.4) : (Math.random() > 0.55 ? 1.8 : 0.9);
      launchBall(ball, p, aimX, aimY, p.stats.kick * (0.94 + Math.random() * 0.14), loft);
      p.aiDecisionCooldown = 35;
      game.onKickEffect(p.x, p.y, null, null, false);
      return;
    }

    // Look for an open pass closer to the attack net if pressured
    const oppTeam = p.team === 'home' ? 'away' : 'home';
    const nearestOpp = game.findNearestPlayer(p.x, p.y, oppTeam, true);
    const pressured = nearestOpp && Math.hypot(nearestOpp.x - p.x, nearestOpp.y - p.y) < 28;
    if (pressured && p.aiDecisionCooldown <= 0 && Math.random() < 0.08) {
      const openMate = game.players.find(
        (m) =>
          m.team === p.team &&
          m.id !== p.id &&
          m.role !== 'G' &&
          Math.hypot(m.x - attackNet.centerX, m.y - attackNet.centerY) < distToGoal + 18
      );
      if (openMate) {
        launchBall(ball, p, openMate.x - p.x, openMate.y - p.y, 4.4, 0.9, {
          passTargetId: openMate.id,
        });
        p.aiDecisionCooldown = 35;
        game.stats[p.team].passes++;
        if (p.matchStats) p.matchStats.passes++;
        game.onKickEffect(p.x, p.y, null, null, false);
        return;
      }
    }

    // Drive toward the shooting slot in front of attackNet
    const slotX = attackNet.centerX + attackNet.normalX * 72 + (p.role === 'LW' ? -24 * wx : p.role === 'RW' ? 24 * wx : 0);
    const slotY = attackNet.centerY + attackNet.normalY * 72 + (p.role === 'LW' ? -24 * wy : p.role === 'RW' ? 24 * wy : 0);
    let tx = clampX(slotX);
    let ty = clampY(slotY);
    if (nearestOpp && Math.hypot(nearestOpp.x - p.x, nearestOpp.y - p.y) < 34) {
      tx = clampX(tx + (p.x > nearestOpp.x ? 24 : -24));
      ty = clampY(ty + (p.y > nearestOpp.y ? 24 : -24));
    }
    steerToward(p, tx, ty, 0.92, isSnow);
    return;
  }

  // === CASE 3: TEAMMATE HAS THE BALL -> GET OPEN FOR PASS / ONE-TIMER / FULL-FIELD THROW! ===
  if (ball.owner && ball.owner.team === p.team) {
    if (ball.owner.role === 'G') {
      // Spread out across the yard toward attackNet for short, mid, and full-field goalie throws!
      let tx = bounds.centerX;
      let ty = bounds.centerY;
      if (p.role === 'LW') {
        tx = clampX(attackNet.centerX + attackNet.normalX * 74 - wx * 48);
        ty = clampY(attackNet.centerY + attackNet.normalY * 74 - wy * 48);
      } else if (p.role === 'RW') {
        tx = clampX(bounds.centerX + wx * 70 + ax * 28);
        ty = clampY(bounds.centerY + wy * 70 + ay * 28);
      } else {
        tx = clampX(defendNet.centerX + defendNet.normalX * 92 + wx * 18);
        ty = clampY(defendNet.centerY + defendNet.normalY * 92 + wy * 18);
      }
      steerToward(p, tx, ty, 0.98, isSnow);
      return;
    }

    const wingOffset = p.role === 'LW' ? -58 : p.role === 'RW' ? 58 : 0;
    const idealX = clampX(ball.owner.x + ax * 68 + wx * wingOffset);
    const idealY = clampY(ball.owner.y + ay * 68 + wy * wingOffset);
    steerToward(p, idealX, idealY, 0.9, isSnow);
    return;
  }

  // === CASE 4: BALL IS LOOSE OR OPPONENT HAS IT ===
  const distToBall = Math.hypot(ball.x - p.x, ball.y - p.y);
  const isClosestMate = game.findNearestPlayer(ball.x, ball.y, p.team, true)?.id === p.id;

  // Respect the opposing goalie's crease while they hold the ball — back off & cover passing lanes!
  if (ball.owner && ball.owner.role === 'G' && ball.owner.team !== p.team) {
    const oppNet = game.getDefendNet(ball.owner.team);
    const wingShift = p.role === 'LW' ? -64 : p.role === 'RW' ? 64 : 0;
    const safeX = clampX(oppNet.centerX + oppNet.normalX * 86 + (-oppNet.normalY) * wingShift);
    const safeY = clampY(oppNet.centerY + oppNet.normalY * 86 + oppNet.normalX * wingShift);
    steerToward(p, safeX, safeY, 0.84, isSnow);
    return;
  }

  // Opportunity to CATCH a bouncing/airborne tennis ball!
  const isOppThrow = ball.isThrow && ball.lastTouchTeam !== p.team;
  const blockedByGrace = isOppThrow && (ball.throwGrace > 0 || ball.vz > 0 || ball.z > 14);
  if (
    !ball.owner &&
    !blockedByGrace &&
    ball.z > 4 &&
    ball.z < PHYSICS.catchMaxZ &&
    distToBall < 14 &&
    p.aiDecisionCooldown <= 0
  ) {
    const catchProb = isOppThrow ? p.stats.hands * 0.05 : p.stats.hands * 0.16;
    if (Math.random() < catchProb) {
      catchBall(ball, p);
      p.aiDecisionCooldown = 45;
      game.stats[p.team].catches++;
      if (p.matchStats) p.matchStats.catches++;
      game.onCatchEffect(p);
      return;
    }
  }

  if (isClosestMate) {
    steerToward(p, ball.x, ball.y, 0.96, isSnow);

    if (
      ball.owner &&
      ball.owner.team !== p.team &&
      !ball.owner.holdingBall &&
      distToBall < 18 &&
      p.stealCooldown <= 0
    ) {
      const checkChance = game.isBodyCheckLegal(ball.owner.x, ball.owner.y) ? 0.12 : 0.07;
      if (Math.random() < checkChance) {
        game.attemptSteal(p);
      }
    }
  } else {
    // Support / defensive shape between ball and own net
    const wingShift = p.role === 'LW' ? -48 : p.role === 'RW' ? 48 : 0;
    const supportX = clampX(ball.x * 0.55 + defendNet.centerX * 0.45 + wx * wingShift * 0.6);
    const supportY = clampY(ball.y * 0.55 + defendNet.centerY * 0.45 + wy * wingShift * 0.6);
    steerToward(p, supportX, supportY, 0.84, isSnow);
  }
}
