// Live Corner Basketball Games on 66 Bond!
// 1) Top-Left Corner: hoop mounted on the LEFT WALL facing right.
// 2) Lower-Left Corner: hoop mounted on the BOTTOM RED-BRICK WALL facing up (left of Basement 56!).
// Kids actively dribble, pass, rebound, shoot, bump skaters, ricochet the tennis ball,
// and sometimes boot a nearby tennis ball away yelling "HEY!!".

import { PHYSICS } from './constants.js';
import { UNIFORM_COLORS } from './roster.js';

function createHoopGame({ id, wall, zone, kidTemplates, classmates = [] }) {
  const kids = kidTemplates.map((k, idx) => {
    const mate = classmates[idx] || null;
    return {
      id: `${id}_${idx + 1}`,
      name: mate ? mate.name : `KID ${idx + 1}`,
      team: 'hoops',
      x: k.x,
      y: k.y,
      vx: 0,
      vy: 0,
      facingX: wall === 'left' ? -1 : 0,
      facingY: wall === 'left' ? 0 : 1,
      skin: mate ? mate.skin : k.skin,
      hair: mate ? mate.hair : k.hair,
      hairStyle: mate ? mate.hairStyle : k.hairStyle,
      glasses: mate ? Boolean(mate.glasses) : false,
      tall: mate ? Boolean(mate.tall) : false,
      short: mate ? Boolean(mate.short) : false,
      beefy: mate ? Boolean(mate.beefy) : false,
      thin: mate ? Boolean(mate.thin) : false,
      coatColor: null,
      coatTrim: null,
      wearsJacket: false,
      sneakers: mate ? mate.sneakers : k.sneakers,
      stats: mate ? { ...mate.stats } : null,
      homeX: k.x,
      homeY: k.y,
      animOffset: k.animOffset,
      decisionTimer: k.decisionTimer,
      kickTimer: 0,
      kickCooldown: 0,
    };
  });

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
    id,
    wall,
    zone,
    kids,
    bball,
    netSwishTimer: 0,
  };
}

export function createCornerBasketballGames(court, undraftedPlayers = []) {
  const b = court.bounds;

  // === GAME 1: TOP-LEFT CORNER (Hoop on LEFT WALL facing right!) ===
  const topLeftZone = {
    left: b.left + 10,
    right: b.left + 124,
    top: b.top + 10,
    bottom: b.top + 122,
    hoopX: b.left + 8,  // Mounted on left wall (x = 36)
    hoopY: b.top + 64,  // Upper-left portion of left wall (y = 116)
    hoopZ: 24,
  };

  const topLeftGame = createHoopGame({
    id: 'bb_tl',
    wall: 'left',
    zone: topLeftZone,
    classmates: undraftedPlayers.slice(0, 3),
    kidTemplates: [
      {
        x: topLeftZone.left + 44,
        y: topLeftZone.hoopY - 22,
        skin: '#e5b088',
        hair: '#1b1614',
        hairStyle: 'spiky',
        coatColor: '#d96b27',
        coatTrim: '#8f3f10',
        wearsJacket: true,
        sneakers: '#ffffff',
        animOffset: 0.4,
        decisionTimer: 35,
      },
      {
        x: topLeftZone.left + 52,
        y: topLeftZone.hoopY + 26,
        skin: '#c4865b',
        hair: '#171412',
        hairStyle: 'buzz',
        coatColor: null,
        coatTrim: null,
        wearsJacket: false, // Maroon everyday school uniform!
        sneakers: '#1d222e',
        animOffset: 2.1,
        decisionTimer: 55,
      },
      {
        x: topLeftZone.left + 86,
        y: topLeftZone.hoopY + 2,
        skin: '#f0c49e',
        hair: '#693d1e',
        hairStyle: 'part',
        coatColor: '#2570bd',
        coatTrim: '#144478',
        wearsJacket: true,
        sneakers: '#e8ecf4',
        animOffset: 3.9,
        decisionTimer: 45,
      },
    ],
  });

  // === GAME 2: LOWER-LEFT CORNER (Hoop on BOTTOM RED-BRICK WALL facing up, left of Basement 56!) ===
  const botLeftZone = {
    left: b.left + 10,
    right: b.left + 138, // Ends at x = 166, cleanly left of Basement 56 (x1 = 188)!
    top: b.bottom - 122,
    bottom: b.bottom - 10,
    hoopX: b.left + 74,  // x = 102, mounted on the bottom red-brick wall
    hoopY: b.bottom - 6, // y = 422, facing UP into the lower-left yard
    hoopZ: 24,
  };

  const botLeftGame = createHoopGame({
    id: 'bb_bl',
    wall: 'bottom',
    zone: botLeftZone,
    classmates: undraftedPlayers.slice(3, 6),
    kidTemplates: [
      {
        x: botLeftZone.hoopX - 24,
        y: botLeftZone.bottom - 44,
        skin: '#f1c7a4',
        hair: '#8c4c23',
        hairStyle: 'messy',
        coatColor: '#239957',
        coatTrim: '#136136',
        wearsJacket: true,
        sneakers: '#ffffff',
        animOffset: 1.2,
        decisionTimer: 40,
      },
      {
        x: botLeftZone.hoopX + 26,
        y: botLeftZone.bottom - 48,
        skin: '#d9a178',
        hair: '#1e1918',
        hairStyle: 'part',
        coatColor: '#7b4bd6',
        coatTrim: '#4f2c96',
        wearsJacket: true,
        sneakers: '#1d222e',
        animOffset: 2.9,
        decisionTimer: 60,
      },
      {
        x: botLeftZone.hoopX + 2,
        y: botLeftZone.bottom - 84,
        skin: '#e8b690',
        hair: '#2b1d14',
        hairStyle: 'spiky',
        coatColor: null,
        coatTrim: null,
        wearsJacket: false, // Maroon everyday school uniform!
        sneakers: '#e8ecf4',
        animOffset: 4.6,
        decisionTimer: 50,
      },
    ],
  });

  return [topLeftGame, botLeftGame];
}

// Legacy alias returning the first game if imported directly
export function createCornerBasketball(court) {
  return createCornerBasketballGames(court)[0];
}

export function updateCornerBasketball(hoops, game) {
  if (!hoops) return;
  const { wall, zone, kids, bball } = hoops;
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

    // Check basketball hitting the hoop (rebounds back into the half-court!)
    const distHoop = Math.hypot(bball.x - zone.hoopX, bball.y - zone.hoopY);
    if (distHoop < 10 && bball.z > 16 && bball.z < 30 && bball.vz < 0) {
      hoops.netSwishTimer = 22;
      if (wall === 'left') {
        bball.vx = 0.8 + Math.random() * 0.6;
        bball.vy *= 0.25;
      } else {
        bball.vx *= 0.25;
        bball.vy = -(0.8 + Math.random() * 0.6);
      }
      bball.vz = -1.2;
    }

    // Keep basketball roughly inside its corner half-court
    const minX = wall === 'left' ? zone.left - 4 : zone.left;
    const maxX = zone.right + 10;
    const minY = zone.top - 10;
    const maxY = wall === 'bottom' ? zone.bottom + 4 : zone.bottom + 10;

    if (bball.x < minX) {
      bball.x = minX;
      bball.vx = Math.abs(bball.vx) * 0.68;
    } else if (bball.x > maxX) {
      bball.x = maxX;
      bball.vx = -Math.abs(bball.vx) * 0.7;
    }
    if (bball.y < minY) {
      bball.y = minY;
      bball.vy = Math.abs(bball.vy) * 0.68;
    } else if (bball.y > maxY) {
      bball.y = maxY;
      bball.vy = -Math.abs(bball.vy) * 0.68;
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
      // Drive closer to their wall hoop, then shoot a jumper or dish a pass!
      if (wall === 'left') {
        tx = zone.hoopX + 36;
        ty = zone.hoopY + Math.sin(game.tick * 0.05 + i) * 26;
      } else {
        tx = zone.hoopX + Math.sin(game.tick * 0.05 + i) * 28;
        ty = zone.hoopY - 36;
      }

      if (k.decisionTimer <= 0) {
        if (Math.random() < 0.55) {
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
        game.onHoopsKickAway(k.x, k.y, k.name);
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
        game.onHoopsInterference(k.x, k.y, k.name ? `${k.name}!` : 'HOOPS!');
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

// Draw faded basketball half-court lines + wall-mounted hoop & backboard ('left' wall OR 'bottom' wall!)
export function drawCornerBasketballCourt(ctx, hoops, isSnow) {
  if (!hoops) return;
  const { wall, zone } = hoops;
  const swish = hoops.netSwishTimer > 0 ? Math.round(Math.sin(hoops.netSwishTimer * 0.9) * 2) : 0;

  if (wall === 'left') {
    const wallX = zone.hoopX - 8;
    const hy = Math.round(zone.hoopY);

    ctx.save();
    ctx.strokeStyle = isSnow ? 'rgba(130, 154, 184, 0.36)' : 'rgba(245, 198, 118, 0.34)';
    ctx.lineWidth = 1;
    ctx.strokeRect(wallX, hy - 20, 44, 40);
    ctx.beginPath();
    ctx.arc(wallX + 44, hy, 16, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(wallX + 10, hy, 56, -Math.PI / 2 + 0.16, Math.PI / 2 - 0.16, false);
    ctx.stroke();
    ctx.restore();

    // Ground shadow
    ctx.fillStyle = 'rgba(10, 14, 22, 0.35)';
    ctx.beginPath();
    ctx.ellipse(wallX + 10, hy + 2, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Steel wall bracket mounted into the left wall
    ctx.fillStyle = '#474f5e';
    ctx.fillRect(wallX - 10, hy - 24, 13, 3);
    ctx.fillRect(wallX - 10, hy - 28, 3, 12);

    // Angled white schoolyard backboard standing vertically along the left wall
    ctx.fillStyle = '#141822';
    ctx.fillRect(wallX + 1, hy - 34, 6, 22);
    ctx.fillStyle = '#eef3fa';
    ctx.fillRect(wallX + 2, hy - 33, 4, 20);
    ctx.fillStyle = '#c9382b';
    ctx.fillRect(wallX + 4, hy - 26, 2, 8);
    if (isSnow) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(wallX + 1, hy - 35, 6, 2);
    }

    // Orange basketball rim protruding RIGHT
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
    return;
  }

  // === BOTTOM RED-BRICK WALL HOOP (Lower-Left Corner, Facing UP into the yard!) ===
  const hx = Math.round(zone.hoopX);
  const wallY = Math.round(zone.hoopY + 6); // Bottom red-brick wall edge (b.bottom = 428)

  ctx.save();
  ctx.strokeStyle = isSnow ? 'rgba(130, 154, 184, 0.36)' : 'rgba(245, 198, 118, 0.34)';
  ctx.lineWidth = 1;
  // Key / paint box extending UP from the bottom red-brick wall
  ctx.strokeRect(hx - 20, wallY - 44, 40, 44);
  // Free-throw semi-circle arcing UP
  ctx.beginPath();
  ctx.arc(hx, wallY - 44, 16, Math.PI, Math.PI * 2, false);
  ctx.stroke();
  // 3-point arc sweeping UP from the bottom wall
  ctx.beginPath();
  ctx.arc(hx, wallY - 10, 56, Math.PI + 0.16, Math.PI * 2 - 0.16, false);
  ctx.stroke();
  ctx.restore();

  // Ground shadow under the bottom-wall hoop
  ctx.fillStyle = 'rgba(10, 14, 22, 0.35)';
  ctx.beginPath();
  ctx.ellipse(hx, wallY - 8, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Orange basketball rim & net protruding UP (north) from the bottom-wall backboard
  ctx.fillStyle = '#d4dde8';
  ctx.fillRect(hx - 5 + swish, wallY - 13, 1, 6);
  ctx.fillRect(hx - 2 + swish, wallY - 14, 1, 7);
  ctx.fillRect(hx + 1 + swish, wallY - 14, 1, 7);
  ctx.fillRect(hx + 4 + swish, wallY - 13, 1, 6);
  ctx.fillRect(hx - 4 + swish, wallY - 10, 8, 1);

  ctx.fillStyle = '#1c1008';
  ctx.fillRect(hx - 7, wallY - 15, 14, 4);
  ctx.fillStyle = '#eb5e1e';
  ctx.fillRect(hx - 6, wallY - 14, 12, 2);

  // Backboard mounted onto the bottom red-brick wall (seen from behind/top in 3/4 view!)
  ctx.fillStyle = '#474f5e';
  ctx.fillRect(hx - 2, wallY - 8, 4, 12); // steel wall bracket into bottom red brick
  ctx.fillStyle = '#141822';
  ctx.fillRect(hx - 15, wallY - 10, 30, 8);
  ctx.fillStyle = '#d8e1ee'; // rear/top white backboard panel
  ctx.fillRect(hx - 14, wallY - 9, 28, 6);
  ctx.fillStyle = '#9aa6b8';
  ctx.fillRect(hx - 14, wallY - 5, 28, 2);
  if (isSnow) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(hx - 14, wallY - 10, 28, 2);
  }
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
  ctx.fillStyle = '#29170b';
  ctx.fillRect(bx - 3, dy, 7, 1);
  ctx.fillRect(bx, dy - 3, 1, 7);
}

export const HOOPS_TEAM_STYLE = {
  primary: UNIFORM_COLORS.maroonShirt,
  trim: UNIFORM_COLORS.crest,
};
