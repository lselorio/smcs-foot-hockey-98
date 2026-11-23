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
    throwGrace: 0,      // Protects goalie clears from instant point-blank opponent steals
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
  // High overhand baseball release so the throw clears skaters standing near the crease!
  const startZ = 14;
  const landZ = options.landZ ?? 5;

  // Choose flight time proportional to distance so both short outlets and full-court bombs feel crisp!
  const baseFrames = isBomb
    ? Math.max(22, Math.min(44, dist * 0.13 + 10))
    : Math.max(20, Math.min(48, dist * 0.155 + 10));
  const T = Math.round(baseFrames);

  // Exact drag-compensated horizontal speed for airDrag^T geometric sum
  const drag = PHYSICS.airDrag;
  const dragSum = (1 - Math.pow(drag, T)) / (1 - drag);
  const speed = Math.min(isBomb ? 9.4 : 8.4, Math.max(3.4, dist / dragSum));

  // Exact parabolic vertical launch speed (minimum 2.5 so even short clears arc safely overhead!)
  const vz = Math.min(6.4, Math.max(2.5, (0.5 * PHYSICS.gravity * T * T + (landZ - startZ)) / T));

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
  ball.throwGrace = 18; // ~0.3s protection so opponents near the crease can't insta-snag clears

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
  ball.throwGrace = 0;
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

// Step 2.5D tennis ball physics and check wall/grill/post/goal collisions
// Supports both classic symmetric GOAL and arbitrary multi-wall court nets (like 66 Bond's top rectangle + right square cage!)
export function stepBallPhysics(ball, callbacks = {}, court = null, teamNetMap = null, isSnow = false) {
  const bounds = court ? court.bounds : COURT;
  if (ball.pickupCooldown > 0) ball.pickupCooldown--;
  if (ball.throwGrace > 0) ball.throwGrace--;
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

  const prevX = ball.x;
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

  // Drag / asphalt rolling friction (slightly slicker glide on packed snow!)
  const groundDrag = isSnow ? 0.985 : PHYSICS.groundFriction;
  const drag = ball.z > 0.5 ? PHYSICS.airDrag : groundDrag;
  ball.vx *= drag;
  ball.vy *= drag;
  if (Math.hypot(ball.vx, ball.vy) < 0.04) {
    ball.vx = 0;
    ball.vy = 0;
    ball.shotPower = 0;
  }

  const r = PHYSICS.ballRadius;

  // === CHECK GOAL SCORING ON COURT NETS (66 Bond asymmetrical walls & heights!) ===
  if (court && court.nets && teamNetMap) {
    for (const net of court.nets) {
      const scoringTeam = teamNetMap.homeAttackId === net.id ? 'home' : 'away';
      const underTop = ball.z <= net.maxZ;

      if (net.wall === 'top') {
        const inSpan = ball.x > net.minCoord + 2 && ball.x < net.maxCoord - 2;
        if (inSpan && underTop && prevY >= net.lineCoord + r && ball.y <= net.lineCoord + r) {
          ball.y = net.lineCoord + r;
          ball.vx *= 0.25;
          ball.vy = Math.abs(ball.vy) * 0.25;
          return { scoredBy: scoringTeam, netId: net.id, goalSide: net.id };
        }
      } else if (net.wall === 'right') {
        const inSpan = ball.y > net.minCoord + 2 && ball.y < net.maxCoord - 2;
        if (inSpan && underTop && prevX <= net.lineCoord - r && ball.x >= net.lineCoord - r) {
          ball.x = net.lineCoord - r;
          ball.vx = -Math.abs(ball.vx) * 0.25;
          ball.vy *= 0.25;
          return { scoredBy: scoringTeam, netId: net.id, goalSide: net.id };
        }
      } else if (net.wall === 'bottom') {
        const inSpan = ball.x > net.minCoord + 2 && ball.x < net.maxCoord - 2;
        if (inSpan && underTop && prevY <= net.lineCoord - r && ball.y >= net.lineCoord - r) {
          ball.y = net.lineCoord - r;
          ball.vx *= 0.25;
          ball.vy = -Math.abs(ball.vy) * 0.25;
          return { scoredBy: scoringTeam, netId: net.id, goalSide: net.id };
        }
      } else if (net.wall === 'left') {
        const inSpan = ball.y > net.minCoord + 2 && ball.y < net.maxCoord - 2;
        if (inSpan && underTop && prevX >= net.lineCoord + r && ball.x <= net.lineCoord + r) {
          ball.x = net.lineCoord + r;
          ball.vx = Math.abs(ball.vx) * 0.25;
          ball.vy *= 0.25;
          return { scoredBy: scoringTeam, netId: net.id, goalSide: net.id };
        }
      }
    }

    // Net edge / window-frame corner post deflections
    for (const net of court.nets) {
      const posts =
        net.wall === 'top' || net.wall === 'bottom'
          ? [
              { x: net.minCoord, y: net.lineCoord },
              { x: net.maxCoord, y: net.lineCoord },
            ]
          : [
              { x: net.lineCoord, y: net.minCoord },
              { x: net.lineCoord, y: net.maxCoord },
            ];
      for (const post of posts) {
        const dx = ball.x - post.x;
        const dy = ball.y - post.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6 && dist > 0.001 && ball.z <= net.maxZ + 2) {
          const nx = dx / dist;
          const ny = dy / dist;
          ball.x = post.x + nx * 6;
          ball.y = post.y + ny * 6;
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) {
            ball.vx = (ball.vx - 2 * dot * nx) * 0.74;
            ball.vy = (ball.vy - 2 * dot * ny) * 0.74;
            callbacks.onPostHit?.(net.id);
          }
        }
      }
    }
  } else {
    // Classic symmetric GOAL fallback (keeps legacy unit tests passing cleanly)
    const inMouthX = ball.x > GOAL.leftX + 3 && ball.x < GOAL.rightX - 3;
    const underCrossbar = ball.z <= GOAL.height;

    if (inMouthX && underCrossbar && prevY >= GOAL.topLineY && ball.y < GOAL.topLineY) {
      ball.y = Math.max(GOAL.topLineY - GOAL.depth + 3, ball.y);
      ball.vx *= 0.3;
      ball.vy *= 0.3;
      return { scoredBy: 'home', goalSide: 'top' };
    }

    if (inMouthX && underCrossbar && prevY <= GOAL.bottomLineY && ball.y > GOAL.bottomLineY) {
      ball.y = Math.min(GOAL.bottomLineY + GOAL.depth - 3, ball.y);
      ball.vx *= 0.3;
      ball.vy *= 0.3;
      return { scoredBy: 'away', goalSide: 'bottom' };
    }

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
  }

  // === BASEMENT 56 DOWNSTAIRS STAIRCASE (BOTTOM WALL, GREEN BARRIER, OPEN RIGHT ENTRANCE!) ===
  if (court && court.basementStairs) {
    const s = court.basementStairs;
    const inStairX = ball.x >= s.x1 && ball.x <= s.x2;
    const inStairY = ball.y >= s.y1 + 1;

    if (inStairX && inStairY) {
      const enteredFromRight = prevX > s.x2 - 2;
      const lobbedOverBarrier = ball.z >= 10;
      if (enteredFromRight || lobbedOverBarrier) {
        // Tennis ball tumbles down into Basement 56!
        ball.x = Math.max(s.x1 + 10, Math.min(s.x2 - 8, ball.x));
        ball.y = (s.y1 + s.y2) / 2;
        ball.vx = -1.1;
        ball.vy = 0;
        ball.vz = 0;
        return { basement56: true, faultTeam: ball.lastTouchTeam || 'home' };
      }
      // Low ball hitting the green barrier from above or the closed left end bounces back into play!
      if (prevY <= s.y1 + 2) {
        ball.y = s.y1 - r;
        ball.vy = -Math.abs(ball.vy) * PHYSICS.fenceRestitution;
        callbacks.onFenceHit?.();
      } else if (prevX < s.x1) {
        ball.x = s.x1 - r;
        ball.vx = -Math.abs(ball.vx) * PHYSICS.fenceRestitution;
        callbacks.onFenceHit?.();
      }
    }
  }

  // === BOTTOM-RIGHT CORNER STAIRS (FOOT OF UPWARD STAIRS & SEATED KID) ===
  if (court && court.cornerStairs) {
    const cs = court.cornerStairs;
    if (ball.x >= cs.x1 - r && ball.x <= cs.x2 + r && ball.y >= cs.y1 - r) {
      if (prevY <= cs.y1) {
        ball.y = cs.y1 - r;
        ball.vy = -Math.abs(ball.vy) * PHYSICS.fenceRestitution;
        callbacks.onFenceHit?.();
      } else if (prevX < cs.x1) {
        ball.x = cs.x1 - r;
        ball.vx = -Math.abs(ball.vx) * PHYSICS.fenceRestitution;
        callbacks.onFenceHit?.();
      }
    }
  }

  // === SCHOOLYARD WALL / WINDOW-GRILL / FENCE BOUNDARY BOUNCES ===
  let hitWall = false;
  let hitGrill = false;
  if (ball.x < bounds.left + r) {
    ball.x = bounds.left + r;
    ball.vx = Math.abs(ball.vx) * PHYSICS.fenceRestitution;
    hitWall = true;
  } else if (ball.x > bounds.right - r) {
    ball.x = bounds.right - r;
    ball.vx = -Math.abs(ball.vx) * PHYSICS.fenceRestitution;
    hitWall = true;
  }

  if (ball.y < bounds.top + r) {
    ball.y = bounds.top + r;
    ball.vy = Math.abs(ball.vy) * PHYSICS.fenceRestitution;
    hitWall = true;
    // Check if the ball clanged off one of the 5 vertical window grills on the top black brick wall!
    if (court && court.topWindows) {
      for (const w of court.topWindows) {
        if (ball.x >= w.x1 && ball.x <= w.x2) {
          hitGrill = true;
          break;
        }
      }
    }
  } else if (ball.y > bounds.bottom - r) {
    ball.y = bounds.bottom - r;
    ball.vy = -Math.abs(ball.vy) * PHYSICS.fenceRestitution;
    hitWall = true;
  }

  if (hitGrill) {
    callbacks.onGrillHit?.();
  } else if (hitWall) {
    callbacks.onFenceHit?.();
  }

  return null;
}

// Keep a player inside the schoolyard walls/fence and out of the Basement 56 stairwell & corner stairs!
export function clampPlayerToCourt(p, bounds = COURT, basementStairs = null, cornerStairs = null) {
  const pad = 7;
  if (p.x < bounds.left + pad) {
    p.x = bounds.left + pad;
    if (p.vx < 0) p.vx = 0;
  } else if (p.x > bounds.right - pad) {
    p.x = bounds.right - pad;
    if (p.vx > 0) p.vx = 0;
  }
  if (p.y < bounds.top + pad) {
    p.y = bounds.top + pad;
    if (p.vy < 0) p.vy = 0;
  } else if (p.y > bounds.bottom - pad) {
    p.y = bounds.bottom - pad;
    if (p.vy > 0) p.vy = 0;
  }

  // Green safety barrier keeps skaters from falling into the Basement 56 staircase!
  if (basementStairs) {
    const s = basementStairs;
    const minX = s.x1 - 6;
    const maxX = s.x2 + 6;
    const minY = s.y1 - 6;
    if (p.x > minX && p.x < maxX && p.y > minY) {
      const distTop = Math.abs(p.y - minY);
      const distLeft = Math.abs(p.x - minX);
      const distRight = Math.abs(p.x - maxX);
      if (distTop <= distLeft && distTop <= distRight) {
        p.y = minY;
        if (p.vy > 0) p.vy = 0;
      } else if (distLeft <= distRight) {
        p.x = minX;
        if (p.vx > 0) p.vx = 0;
      } else {
        p.x = maxX;
        if (p.vx < 0) p.vx = 0;
      }
    }
  }

  // Keep skaters from trampling the kid sitting at the foot of the bottom-right stairs!
  if (cornerStairs) {
    const cs = cornerStairs;
    const minX = cs.x1 - 6;
    const minY = cs.y1 - 5;
    if (p.x > minX && p.y > minY) {
      const distTop = Math.abs(p.y - minY);
      const distLeft = Math.abs(p.x - minX);
      if (distTop <= distLeft) {
        p.y = minY;
        if (p.vy > 0) p.vy = 0;
      } else {
        p.x = minX;
        if (p.vx > 0) p.vx = 0;
      }
    }
  }
}
