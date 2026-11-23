// Live Top-Left Corner Basketball Court Hazard on 66 Bond!
// Kids actively dribble, pass, and shoot an orange basketball — and are 100% IN PLAY
// (blocking lanes, bumping skaters, and ricocheting the foot-hockey tennis ball!).

import { PHYSICS } from './constants.js';
import { UNIFORM_COLORS } from './roster.js';

export function createCornerBasketball(court) {
  const b = court.bounds;
  // Top-left corner half-court on 66 Bond with hoop mounted on the LEFT WALL facing right!
  const zone = {
    left: b.left + 10,
    right: b.left + 124,
    top: b.top + 10,
    bottom: b.top + 122,
    hoopX: b.left + 8,  // Mounted on the left wall (x = 36), protruding right into the yard
    hoopY: b.top + 64,  // Upper-left portion of the left wall (y = 116)
    hoopZ: 24,
  };

  const kids = [
    {
      id: 'bb_1',
      x: zone.left + 44,
      y: zone.hoopY - 22,
      vx: 0,
      vy: 0,
      facingX: -1,
      facingY: 0,
      skin: '#e5b088',
      hair: '#1b1614',
      hairStyle: 'spiky',
      coatColor: '#d96b27',
      coatTrim: '#8f3f10',
      wearsJacket: true,
      sneakers: '#ffffff',
      homeX: zone.left + 46,
      homeY: zone.hoopY - 24,
      animOffset: 0.4,
      decisionTimer: 35,
      kickTimer: 0,
      kickCooldown: 0,
    },
    {
      id: 'bb_2',
      x: zone.left + 52,
      y: zone.hoopY + 26,
      vx: 0,
      vy: 0,
      facingX: -1,
      facingY: 0,
      skin: '#c4865b',
      hair: '#171412',
      hairStyle: 'buzz',
      coatColor: null,
      coatTrim: null,
      wearsJacket: false, // Wearing maroon school uniform!
      sneakers: '#1d222e',
      homeX: zone.left + 54,
      homeY: zone.hoopY + 28,
      animOffset: 2.1,
      decisionTimer: 55,
      kickTimer: 0,
      kickCooldown: 0,
    },
    {
      id: 'bb_3',
      x: zone.left + 86,
      y: zone.hoopY + 2,
      vx: 0,
      vy: 0,
      facingX: -1,
      facingY: 0,
      skin: '#f0c49e',
      hair: '#693d1e',
      hairStyle: 'part',
      coatColor: '#2570bd',
      coatTrim: '#144478',
      wearsJacket: true,
      sneakers: '#e8ecf4',
      homeX: zone.left + 84,
      homeY: zone.hoopY,
      animOffset: 3.9,
      decisionTimer: 45,
      kickTimer: 0,
      kickCooldown: 0,
    },
  ];

  const bball = {
    x: kids[0].x,
    y: kids[0].y,
    z: 4,
    vx: 0,
    vy: 0,
    vz: 0,
    owner: kids[0],
    cooldown: 0,
    dribblePhase: 0,
  };

  return {
    zone,
    kids,
    bball,
    netSwishTimer: 0,
  };
}

export function updateCornerBasketball(hoops, game) {
  if (!hoops) return;
  const { zone, kids, bball } = hoops;
  if (hoops.netSwishTimer > 0) hoops.netSwishTimer--;
  if (bball.cooldown > 0) bball.cooldown--;

  // === UPDATE ORANGE BASKETBALL PHYSICS ===
  if (bball.owner) {
    const o = bball.owner;
    bball.dribblePhase += 0.24;
    bball.x = o.x + o.facingX * 6;
    bball.y = o.y + o.facingY * 4;
    bball.z = Math.abs(Math.sin(bball.dribblePhase)) * 8;
    bball.vx = o.vx;
    bball.vy = o.vy;
    bball.vz = 0;
  } else {
    bball.x += bball.vx;
    bball.y += bball.vy;
    bball.vz -= PHYSICS.gravity * 0.92;
    bball.z += bball.vz;

    if (bball.z <= 0) {
      bball.z = 0;
      if (Math.abs(bball.vz) > 0.5) {
        bball.vz = Math.abs(bball.vz) * 0.72;
        bball.vx *= 0.92;
        bball.vy *= 0.92;
      } else {
        bball.vz = 0;
      }
    }
    bball.vx *= 0.985;
    bball.vy *= 0.985;

    // Check basketball hitting the left-wall hoop (rebounds back right into the corner court!)
    const distHoop = Math.hypot(bball.x - zone.hoopX, bball.y - zone.hoopY);
    if (distHoop < 10 && bball.z > 16 && bball.z < 30 && bball.vz < 0) {
      hoops.netSwishTimer = 22;
      bball.vx = 0.8 + Math.random() * 0.6;
      bball.vy *= 0.25;
      bball.vz = -1.2;
    }

    // Keep basketball roughly inside the top-left corner court
    if (bball.x < zone.left - 4) {
      bball.x = zone.left - 4;
      bball.vx = Math.abs(bball.vx) * 0.68;
    } else if (bball.x > zone.right + 14) {
      bball.x = zone.right + 14;
      bball.vx = -Math.abs(bball.vx) * 0.7;
    }
    if (bball.y < zone.top) {
      bball.y = zone.top;
      bball.vy = Math.abs(bball.vy) * 0.65;
    } else if (bball.y > zone.bottom + 14) {
      bball.y = zone.bottom + 14;
      bball.vy = -Math.abs(bball.vy) * 0.7;
    }

    // Loose basketball pickup by one of the basketball kids
    if (bball.cooldown <= 0 && bball.z < 12) {
      for (const k of kids) {
        if (Math.hypot(bball.x - k.x, bball.y - k.y) < 12) {
          bball.owner = k;
          k.decisionTimer = 32 + Math.floor(Math.random() * 35);
          break;
        }
      }
    }
  }

  // === UPDATE BASKETBALL KIDS AI (DRIBBLE, PASS, SHOOT, REBOUND!) ===
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.decisionTimer > 0) k.decisionTimer--;
    if (k.kickTimer > 0) k.kickTimer--;
    if (k.kickCooldown > 0) k.kickCooldown--;

    let tx = k.homeX + Math.sin(game.tick * 0.03 + k.animOffset) * 18;
    let ty = k.homeY + Math.cos(game.tick * 0.025 + k.animOffset) * 16;

    if (bball.owner === k) {
      // Drive closer to the LEFT WALL hoop, then either shoot a jumper or dish a pass!
      tx = zone.hoopX + 36;
      ty = zone.hoopY + Math.sin(game.tick * 0.05 + i) * 26;

      if (k.decisionTimer <= 0) {
        if (Math.random() < 0.55) {
          // High-arcing jump shot at the top-left hoop!
          const dx = zone.hoopX - k.x;
          const dy = zone.hoopY - k.y;
          const T = 26;
          bball.owner = null;
          bball.z = 11;
          bball.vx = dx / T;
          bball.vy = dy / T;
          bball.vz = (0.5 * PHYSICS.gravity * 0.92 * T * T + (zone.hoopZ - 11)) / T;
          bball.cooldown = 16;
          k.decisionTimer = 50;
        } else {
          // Pass to another basketball kid!
          const other = kids[(i + 1 + Math.floor(Math.random() * 2)) % kids.length];
          const dx = other.x - k.x;
          const dy = other.y - k.y;
          const dist = Math.hypot(dx, dy) || 1;
          bball.owner = null;
          bball.z = 8;
          bball.vx = (dx / dist) * 3.0;
          bball.vy = (dy / dist) * 3.0;
          bball.vz = 1.6;
          bball.cooldown = 12;
          k.decisionTimer = 45;
        }
      }
    } else if (!bball.owner) {
      // Chase the rebound / loose basketball!
      tx = bball.x;
      ty = bball.y;
    }

    const dx = tx - k.x;
    const dy = ty - k.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 3) {
      const spd = 1.15;
      k.vx += (dx / dist) * 0.16;
      k.vy += (dy / dist) * 0.16;
      const cur = Math.hypot(k.vx, k.vy);
      if (cur > spd) {
        k.vx = (k.vx / cur) * spd;
        k.vy = (k.vy / cur) * spd;
      }
      k.facingX = dx / dist;
      k.facingY = dy / dist;
    }
    k.x = Math.max(zone.left, Math.min(zone.right, k.x + k.vx));
    k.y = Math.max(zone.top, Math.min(zone.bottom, k.y + k.vy));
    k.vx *= 0.84;
    k.vy *= 0.84;
  }

  // Soft spacing among the basketball kids themselves
  for (let i = 0; i < kids.length; i++) {
    for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i];
      const b = kids[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 13 && d > 0.01) {
        const push = (13 - d) * 0.35;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }

  // =========================================================================
  // IN-PLAY INTERFERENCE WITH FOOT HOCKEY PLAYERS & THE TENNIS BALL!
  // =========================================================================
  const { ball } = game;

  // 1) Foot-hockey skaters bumping into the basketball kids!
  for (const p of game.players) {
    if (p.role === 'G') continue;
    for (const k of kids) {
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const dist = Math.hypot(dx, dy);
      const minDist = 12;
      if (dist < minDist && dist > 0.01) {
        const nx = dx / dist;
        const ny = dy / dist;
        const push = (minDist - dist) * 0.55;
        p.x += nx * push;
        p.y += ny * push;
        k.x -= nx * push * 0.45;
        k.y -= ny * push * 0.45;
        // Slight momentum bounce if skater runs straight into a hoopster
        p.vx += nx * 0.35;
        p.vy += ny * 0.35;
      }
    }
  }

  // 2) Tennis ball gets too close to a basketball kid -> sometimes they BOOT it away in a random direction,
  //    or otherwise it ricochets off them!
  if (!ball.owner && ball.z < 18) {
    for (const k of kids) {
      const dx = ball.x - k.x;
      const dy = ball.y - k.y;
      const dist = Math.hypot(dx, dy);

      // Annoyed basketball kid kicks a nearby low tennis ball away in a random direction!
      if (dist < 15 && ball.z < 10 && k.kickCooldown <= 0 && Math.random() < 0.45) {
        const angle = Math.random() * Math.PI * 2;
        const kickSpd = 3.8 + Math.random() * 2.4;
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        ball.x = k.x + nx * 11;
        ball.y = k.y + ny * 11;
        ball.vx = nx * kickSpd;
        ball.vy = ny * kickSpd;
        ball.vz = 1.6 + Math.random() * 1.4;
        ball.pickupCooldown = 8;
        k.facingX = nx;
        k.facingY = ny;
        k.kickTimer = 13;
        k.kickCooldown = 50;
        game.onHoopsKickAway(k.x, k.y);
        break;
      }

      if (dist < 10 && dist > 0.01) {
        const nx = dx / dist;
        const ny = dy / dist;
        ball.x = k.x + nx * 10.5;
        ball.y = k.y + ny * 10.5;
        const spd = Math.max(1.8, Math.hypot(ball.vx, ball.vy) * 0.78);
        ball.vx = nx * spd;
        ball.vy = ny * spd;
        ball.vz = Math.max(ball.vz, 1.4);
        game.onHoopsInterference(ball.x, ball.y, 'HOOPS!');
        break;
      }
    }
  }

  // 3) Mid-air or ground collision between the tennis ball and the ORANGE BASKETBALL!
  if (!ball.owner && Math.abs(ball.z - bball.z) < 9) {
    const dx = ball.x - bball.x;
    const dy = ball.y - bball.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8.5 && dist > 0.01) {
      const nx = dx / dist;
      const ny = dy / dist;
      const spd = Math.max(2.2, Math.hypot(ball.vx, ball.vy) * 0.85);
      ball.vx = nx * spd;
      ball.vy = ny * spd;
      ball.vz = Math.max(ball.vz, 2.0);
      if (!bball.owner) {
        bball.vx -= nx * 1.4;
        bball.vy -= ny * 1.4;
      }
      game.onHoopsInterference(ball.x, ball.y, 'BALL BUMP!');
    }
  }
}

// Draw the faded basketball half-court lines + LEFT-WALL hoop & backboard in the top-left corner of 66 Bond
export function drawCornerBasketballCourt(ctx, hoops, isSnow) {
  if (!hoops) return;
  const { zone } = hoops;
  const wallX = zone.hoopX - 8; // Left wall edge (b.left = 28)
  const hy = Math.round(zone.hoopY);

  // Faded half-court key, free-throw arc, and 3-point arc extending RIGHT from the left wall!
  ctx.save();
  ctx.strokeStyle = isSnow ? 'rgba(130, 154, 184, 0.36)' : 'rgba(245, 198, 118, 0.34)';
  ctx.lineWidth = 1;
  // Paint / key box extending right from left wall
  ctx.strokeRect(wallX, hy - 20, 44, 40);
  // Free-throw semi-circle facing right
  ctx.beginPath();
  ctx.arc(wallX + 44, hy, 16, -Math.PI / 2, Math.PI / 2, false);
  ctx.stroke();
  // 3-point arc sweeping rightward from the left wall
  ctx.beginPath();
  ctx.arc(wallX + 10, hy, 56, -Math.PI / 2 + 0.16, Math.PI / 2 - 0.16, false);
  ctx.stroke();
  ctx.restore();

  // Side-mounted Backboard + Orange Rim + Chain Net mounted onto the LEFT WALL facing right!
  const swish = hoops.netSwishTimer > 0 ? Math.round(Math.sin(hoops.netSwishTimer * 0.9) * 2) : 0;

  // Ground shadow under the left-wall hoop
  ctx.fillStyle = 'rgba(10, 14, 22, 0.35)';
  ctx.beginPath();
  ctx.ellipse(wallX + 10, hy + 2, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Steel wall bracket mounted into the left brick/concrete wall
  ctx.fillStyle = '#474f5e';
  ctx.fillRect(wallX - 10, hy - 24, 13, 3);
  ctx.fillRect(wallX - 10, hy - 28, 3, 12);

  // Angled white schoolyard backboard standing vertically along the left wall
  ctx.fillStyle = '#141822';
  ctx.fillRect(wallX + 1, hy - 34, 6, 22);
  ctx.fillStyle = '#eef3fa';
  ctx.fillRect(wallX + 2, hy - 33, 4, 20);
  // Red shooter's square stripe on backboard face
  ctx.fillStyle = '#c9382b';
  ctx.fillRect(wallX + 4, hy - 26, 2, 8);
  if (isSnow) {
    // Snow dusting on top of the backboard!
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(wallX + 1, hy - 35, 6, 2);
  }

  // Orange basketball rim protruding RIGHT into the blacktop!
  ctx.fillStyle = '#1c1008';
  ctx.fillRect(wallX + 6, hy - 21, 11, 4);
  ctx.fillStyle = '#eb5e1e';
  ctx.fillRect(wallX + 6, hy - 20, 10, 2);

  // Hanging chain/string hoop net below the rim
  ctx.fillStyle = '#d4dde8';
  ctx.fillRect(wallX + 7 + swish, hy - 18, 1, 7);
  ctx.fillRect(wallX + 10 + swish, hy - 18, 1, 8);
  ctx.fillRect(wallX + 13 + swish, hy - 18, 1, 7);
  ctx.fillRect(wallX + 8 + swish, hy - 14, 5, 1);
}

// Draw the orange basketball with 2.5D shadow
export function drawBasketball(ctx, bball) {
  const bx = Math.round(bball.x);
  const by = Math.round(bball.y);
  const bz = Math.round(bball.z);

  const shadowScale = Math.max(0.35, 1 - bz / 52);
  ctx.fillStyle = 'rgba(12, 16, 26, 0.40)';
  ctx.beginPath();
  ctx.ellipse(bx, by + 2, 4.5 * shadowScale, 2.5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  const dy = by - bz;
  ctx.fillStyle = '#1c1008';
  ctx.fillRect(bx - 4, dy - 3, 9, 7);
  ctx.fillRect(bx - 3, dy - 4, 7, 9);
  ctx.fillStyle = '#e8681c';
  ctx.fillRect(bx - 3, dy - 3, 7, 7);
  ctx.fillStyle = '#f58c38';
  ctx.fillRect(bx - 2, dy - 2, 3, 2);
  // Classic black basketball seam lines
  ctx.fillStyle = '#29170b';
  ctx.fillRect(bx - 3, dy, 7, 1);
  ctx.fillRect(bx, dy - 3, 1, 7);
}

// Subtle marker helper (uses same uniform palette so hoopsters look like real St. Mike's classmates!)
export const HOOPS_TEAM_STYLE = {
  primary: UNIFORM_COLORS.maroonShirt,
  trim: UNIFORM_COLORS.crest,
};
