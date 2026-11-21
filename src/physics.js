import { COURT, GOAL, PHYSICS } from './constants.js';

export function createBall(x = COURT.centerX, y = COURT.centerY, z = 14) {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    owner: null,        // Player currently dribbling at their feet OR holding in hands
    lastTouchTeam: null,
    lastTouchPlayer: null,
    pickupCooldown: 0,  // Brief immunity for kicker so ball leaves their foot cleanly
    passTargetId: null, // For NHL '94 one-timer window & deliberate pass tracking
    passTimer: 0,
    shotPower: 0,       // Helps trail visuals & goalie save detection
    isThrow: false,     // True when flying from a goalie overhand throw
    trail: [],          // Recent positions for hard-shot / long-throw arcade trail
  };
}

// Kick or pass the ball from a player (works for quick shot, hard shot, pass, drop-kick, and one-timer!)
export function launchBall(ball, player, dirX, dirY, speed, loftZ = 0, options = {}) {
  const mag = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / mag;
  const ny = dirY / mag;

  ball.owner = null;
  ball.x = player.x + nx * 7;
  ball.y = player.y + ny * 7;
  ball.z = Math.max(ball.z, options.startZ ?? 2);
  ball.vx = nx * speed + player.vx * 0.25;
  ball.vy = ny * speed + player.vy * 0.25;
  ball.vz = loftZ;
  ball.lastTouchTeam = player.team;
  ball.lastTouchPlayer = player;
  ball.pickupCooldown = options.cooldown ?? 10;
  ball.passTargetId = options.passTargetId ?? null;
  ball.passTimer = options.passTargetId ? (options.passTimer ?? PHYSICS.oneTimerWindow) : 0;
  ball.shotPower = options.shotPower ?? speed;
  ball.isThrow = false;

  player.holdingBall = false;
  player.holdFrames = 0;
  player.holdDist = 0;
  player.windupFrames = 0;
  player.kickTimer = options.kickTimer ?? 11;
  player.stealCooldown = Math.max(player.stealCooldown, 12);
}

// Goalie overhand tennis-ball throw — calculates exact arc to reach a teammate anywhere on the field!
export function launchThrow(ball, thrower, targetX, targetY, options = {}) {
  const dx = targetX - thrower.x;
  const dy = targetY - thrower.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  const isBomb = Boolean(options.isBomb);
  const startZ = 10;
  const landZ = options.landZ ?? 5;

  // Choose flight time proportional to distance so both short outlets and full-court bombs feel crisp!
  const baseFrames = isBomb
    ? Math.max(20, Math.min(44, dist * 0.13 + 10))
    : Math.max(18, Math.min(48, dist * 0.155 + 10));
  const T = Math.round(baseFrames);

  // Exact drag-compensated horizontal speed for airDrag^T geometric sum
  const drag = PHYSICS.airDrag;
  const dragSum = (1 - Math.pow(drag, T)) / (1 - drag);
  const speed = Math.min(isBomb ? 9.4 : 8.4, Math.max(3.2, dist / dragSum));

  // Exact parabolic vertical launch speed so ball arcs smoothly overhead and drops to receiver!
  const vz = Math.min(6.4, Math.max(1.5, (0.5 * PHYSICS.gravity * T * T + (landZ - startZ)) / T));

  ball.owner = null;
  ball.x = thrower.x + nx * 8;
  ball.y = thrower.y + ny * 8;
  ball.z = startZ;
  ball.vx = nx * speed;
  ball.vy = ny * speed;
  ball.vz = vz;
  ball.lastTouchTeam = thrower.team;
  ball.lastTouchPlayer = thrower;
  ball.pickupCooldown = 14;
  ball.passTargetId = options.passTargetId ?? null;
  ball.passTimer = options.passTargetId ? T + 22 : 0;
  ball.shotPower = isBomb ? speed : 0;
  ball.isThrow = true;

  thrower.holdingBall = false;
  thrower.holdFrames = 0;
  thrower.holdDist = 0;
  thrower.throwTimer = 18;
  thrower.gloveTimer = 0;

  return { dist, flightFrames: T, speed, vz };
}

// Player catches a loose/bouncing/airborne tennis ball in their hands!
export function catchBall(ball, player) {
  ball.owner = player;
  ball.vx = 0;
  ball.vy = 0;
  ball.vz = 0;
  ball.z = 8;
  ball.x = player.x;
  ball.y = player.y;
  ball.lastTouchTeam = player.team;
  ball.lastTouchPlayer = player;
  ball.passTargetId = null;
  ball.passTimer = 0;
  ball.shotPower = 0;
  ball.isThrow = false;
  ball.trail = [];

  player.holdingBall = true;
  player.holdFrames = 0;
  player.holdDist = 0;
  player.windupFrames = 0;
  player.catchAnim = 14;
}

// Drop a caught tennis ball cleanly to the player's feet so they can dribble/kick it!
export function dropHeldBall(ball, player, nudgeSpeed = 0.65) {
  if (!player.holdingBall || ball.owner !== player) return false;
  player.holdingBall = false;
  player.holdFrames = 0;
  player.holdDist = 0;

  // Keep dribbling possession right at player's feet with a little bounce pop
  ball.z = 6;
  ball.vz = -0.35;
  ball.vx = player.facingX * nudgeSpeed;
  ball.vy = player.facingY * nudgeSpeed;
  ball.x = player.x + player.facingX * PHYSICS.dribbleDist;
  ball.y = player.y + player.facingY * PHYSICS.dribbleDist;
  return true;
}

// Step 2.5D tennis ball physics and check fence/post/goal collisions
export function stepBallPhysics(ball, callbacks = {}) {
  if (ball.pickupCooldown > 0) ball.pickupCooldown--;
  if (ball.passTimer > 0) {
    ball.passTimer--;
    if (ball.passTimer === 0) ball.passTargetId = null;
  }

  // If possessed by a player (dribbling or held in hands)
  if (ball.owner) {
    const p = ball.owner;
    if (p.holdingBall) {
      ball.x = p.x + p.facingX * 5;
      ball.y = p.y + p.facingY * 3;
      ball.z = 8;
      ball.vx = p.vx;
      ball.vy = p.vy;
      ball.vz = 0;
    } else {
      // Dribbling at feet with subtle tennis-ball roll/bob!
      const targetX = p.x + p.facingX * PHYSICS.dribbleDist;
      const targetY = p.y + p.facingY * PHYSICS.dribbleDist;
      ball.x += (targetX - ball.x) * 0.55;
      ball.y += (targetY - ball.y) * 0.55;
      ball.vx = p.vx;
      ball.vy = p.vy;

      // Vertical settle if just dropped to feet
      if (ball.z > 0 || ball.vz !== 0) {
        ball.vz -= PHYSICS.gravity;
        ball.z += ball.vz;
        if (ball.z <= 0) {
          ball.z = 0;
          if (Math.abs(ball.vz) > 0.7) {
            ball.vz = -ball.vz * 0.48;
            callbacks.onBounce?.(Math.abs(ball.vz) / 3);
          } else {
            ball.vz = 0;
          }
        }
      }
    }
    return null;
  }

  // Free-flight / rolling 2.5D tennis ball physics
  if (ball.shotPower >= 6.0 || ball.isThrow) {
    ball.trail.push({ x: ball.x, y: ball.y, z: ball.z });
    if (ball.trail.length > 6) ball.trail.shift();
  } else if (ball.trail.length > 0) {
    ball.trail.shift();
  }

  const prevY = ball.y;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Vertical gravity & lively rubber tennis ball bounce
  if (ball.z > 0 || ball.vz !== 0) {
    ball.vz -= PHYSICS.gravity;
    ball.z += ball.vz;
    if (ball.z <= 0) {
      ball.z = 0;
      ball.isThrow = false;
      if (Math.abs(ball.vz) > PHYSICS.minBounceVz) {
        const impact = Math.abs(ball.vz);
        ball.vz = impact * PHYSICS.bounceRestitution;
        // Slight friction nibble on bounce
        ball.vx *= 0.96;
        ball.vy *= 0.96;
        callbacks.onBounce?.(Math.min(1, impact / 3.5));
      } else {
        ball.vz = 0;
      }
    }
  }

  // Drag / asphalt rolling friction
  const drag = ball.z > 0.5 ? PHYSICS.airDrag : PHYSICS.groundFriction;
  ball.vx *= drag;
  ball.vy *= drag;
  if (Math.hypot(ball.vx, ball.vy) < 0.04) {
    ball.vx = 0;
    ball.vy = 0;
    ball.shotPower = 0;
  }

  // === CHECK GOAL SCORING (Crossing between backpacks/cones under crossbar height!) ===
  const inMouthX = ball.x > GOAL.leftX + 3 && ball.x < GOAL.rightX - 3;
  const underCrossbar = ball.z <= GOAL.height;

  // Top goal (Home scores on Away!)
  if (inMouthX && underCrossbar && prevY >= GOAL.topLineY && ball.y < GOAL.topLineY) {
    // Clamp inside goal backstop visually
    ball.y = Math.max(GOAL.topLineY - GOAL.depth + 3, ball.y);
    ball.vx *= 0.3;
    ball.vy *= 0.3;
    return { scoredBy: 'home', goalSide: 'top' };
  }

  // Bottom goal (Away scores on Home!)
  if (inMouthX && underCrossbar && prevY <= GOAL.bottomLineY && ball.y > GOAL.bottomLineY) {
    ball.y = Math.min(GOAL.bottomLineY + GOAL.depth - 3, ball.y);
    ball.vx *= 0.3;
    ball.vy *= 0.3;
    return { scoredBy: 'away', goalSide: 'bottom' };
  }

  // === BACKPACK / CONE GOALPOST COLLISIONS ===
  const posts = [
    { x: GOAL.leftX, y: GOAL.topLineY },
    { x: GOAL.rightX, y: GOAL.topLineY },
    { x: GOAL.leftX, y: GOAL.bottomLineY },
    { x: GOAL.rightX, y: GOAL.bottomLineY },
  ];
  for (const post of posts) {
    const dx = ball.x - post.x;
    const dy = ball.y - post.y;
    const dist = Math.hypot(dx, dy);
    const minDist = 6.5;
    if (dist < minDist && dist > 0.001 && ball.z < 14) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = post.x + nx * minDist;
      ball.y = post.y + ny * minDist;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx = (ball.vx - 2 * dot * nx) * 0.72;
        ball.vy = (ball.vy - 2 * dot * ny) * 0.72;
        callbacks.onPostHit?.(post.y < COURT.centerY ? 'top' : 'bottom');
      }
    }
  }

  // === SCHOOLYARD CHAIN-LINK FENCE BOUNDARY BOUNCES ===
  const r = PHYSICS.ballRadius;
  let hitFence = false;
  if (ball.x < COURT.left + r) {
    ball.x = COURT.left + r;
    ball.vx = Math.abs(ball.vx) * PHYSICS.fenceRestitution;
    hitFence = true;
  } else if (ball.x > COURT.right - r) {
    ball.x = COURT.right - r;
    ball.vx = -Math.abs(ball.vx) * PHYSICS.fenceRestitution;
    hitFence = true;
  }

  // Top/bottom fence boundaries (allowing ball to enter goal mouth if under crossbar)
  if (ball.y < COURT.top + r) {
    ball.y = COURT.top + r;
    ball.vy = Math.abs(ball.vy) * PHYSICS.fenceRestitution;
    hitFence = true;
  } else if (ball.y > COURT.bottom - r) {
    ball.y = COURT.bottom - r;
    ball.vy = -Math.abs(ball.vy) * PHYSICS.fenceRestitution;
    hitFence = true;
  }

  if (hitFence) {
    callbacks.onFenceHit?.();
  }

  return null;
}

// Keep a player inside the schoolyard fence
export function clampPlayerToCourt(p) {
  const pad = 7;
  if (p.x < COURT.left + pad) {
    p.x = COURT.left + pad;
    if (p.vx < 0) p.vx = 0;
  } else if (p.x > COURT.right - pad) {
    p.x = COURT.right - pad;
    if (p.vx > 0) p.vx = 0;
  }
  if (p.y < COURT.top + pad) {
    p.y = COURT.top + pad;
    if (p.vy < 0) p.vy = 0;
  } else if (p.y > COURT.bottom - pad) {
    p.y = COURT.bottom - pad;
    if (p.vy > 0) p.vy = 0;
  }
}
