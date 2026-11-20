import { PALETTE, GOAL } from './constants.js';

// Crisp 5x7 16-bit arcade pixel font (uppercase, digits, punctuation)
const FONT_5X7 = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  "'": ['00100', '00100', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

export function measurePixelText(text, scale = 1) {
  return text.length * 6 * scale - scale;
}

export function drawPixelText(ctx, text, x, y, color = '#ffffff', scale = 1, align = 'left', shadow = '#0b0e18') {
  const str = String(text).toUpperCase();
  const totalW = measurePixelText(str, scale);
  let startX = Math.round(x);
  if (align === 'center') startX = Math.round(x - totalW / 2);
  else if (align === 'right') startX = Math.round(x - totalW);
  const startY = Math.round(y);

  const renderPass = (ox, oy, fill) => {
    ctx.fillStyle = fill;
    for (let i = 0; i < str.length; i++) {
      const glyph = FONT_5X7[str[i]] || FONT_5X7[' '];
      const gx = startX + i * 6 * scale + ox;
      for (let row = 0; row < 7; row++) {
        const line = glyph[row];
        for (let col = 0; col < 5; col++) {
          if (line[col] === '1') {
            ctx.fillRect(gx + col * scale, startY + row * scale + oy, scale, scale);
          }
        }
      }
    }
  };

  if (shadow) {
    renderPass(scale, scale, shadow);
  }
  renderPass(0, 0, color);
}

// Draw classic NHL '94 star ring underneath the active player
export function drawStarRing(ctx, x, y, color, tick, isHoldingBall = false, holdRatio = 0) {
  const rx = Math.round(x);
  const ry = Math.round(y + 1);
  ctx.save();

  // Outer pixel ellipse
  ctx.strokeStyle = isHoldingBall ? '#ffe84d' : color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(rx, ry, 10, 5.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Iconic NHL '94 5-point star ticks spinning gently around ring
  const phase = (tick * 0.08) % (Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const a = phase + (i * Math.PI) / 2;
    const sx = Math.round(rx + Math.cos(a) * 10);
    const sy = Math.round(ry + Math.sin(a) * 5.5);
    ctx.fillRect(sx - 1, sy, 2, 1);
  }

  // If holding the caught tennis ball, draw countdown arc so player knows to drop/kick!
  if (isHoldingBall && holdRatio > 0) {
    ctx.strokeStyle = holdRatio > 0.35 ? '#d9ff2e' : '#ff4f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(rx, ry, 13, 7, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * holdRatio);
    ctx.stroke();
  }

  ctx.restore();
}

// Draw neon-yellow fuzzy tennis ball with 2.5D shadow and bounce scale
export function drawTennisBall(ctx, ball, tick) {
  const bx = Math.round(ball.x);
  const by = Math.round(ball.y);
  const bz = Math.round(ball.z);

  // Asphalt shadow shrinks slightly as ball rises
  const shadowScale = Math.max(0.45, 1 - bz / 48);
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(bx, by + 2, 3.8 * shadowScale, 2.2 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball rendered lifted by z
  const drawY = by - bz;
  const r = bz > 10 ? 4 : 3;

  // Outline for crisp 16-bit visibility on gray asphalt
  ctx.fillStyle = '#18240a';
  ctx.fillRect(bx - r, drawY - r + 1, r * 2 + 1, r * 2 - 1);
  ctx.fillRect(bx - r + 1, drawY - r, r * 2 - 1, r * 2 + 1);

  // Tennis yellow core
  ctx.fillStyle = PALETTE.tennisYellow;
  ctx.fillRect(bx - r + 1, drawY - r + 1, r * 2 - 1, r * 2 - 1);

  // Lower shading
  ctx.fillStyle = PALETTE.tennisShade;
  ctx.fillRect(bx - r + 1, drawY + r - 2, r * 2 - 1, 1);

  // Iconic white tennis ball curved seam (animates with spin)
  ctx.fillStyle = PALETTE.tennisSeam;
  const spin = Math.floor((tick + Math.abs(ball.vx + ball.vy) * 4) / 4) % 2;
  ctx.fillRect(bx - 1 + spin, drawY - 1, 2, 1);
  ctx.fillRect(bx - 2 + spin, drawY, 1, 1);
}

// Draw makeshift recess goal: colorful backpacks + orange cones + fence backstop
export function drawRecessGoal(ctx, isTop, shakeOffset = 0) {
  const lineY = isTop ? GOAL.topLineY : GOAL.bottomLineY;
  const lx = GOAL.leftX;
  const rx = GOAL.rightX;
  const depth = GOAL.depth;
  const backY = isTop ? lineY - depth : lineY + depth;
  const sx = Math.round(shakeOffset);

  // Chalk goal line + goalie crease semi-circle
  ctx.fillStyle = PALETTE.chalk;
  ctx.fillRect(lx, lineY, GOAL.width, 2);

  // Crease chalk arc
  ctx.save();
  ctx.strokeStyle = PALETTE.chalkFade;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (isTop) {
    ctx.arc(160, lineY, 26, 0, Math.PI, false);
  } else {
    ctx.arc(160, lineY, 26, Math.PI, Math.PI * 2, false);
  }
  ctx.stroke();
  ctx.restore();

  // Chalk side-net guidelines to backstop
  ctx.fillStyle = 'rgba(233, 238, 244, 0.35)';
  const minY = Math.min(lineY, backY);
  ctx.fillRect(lx, minY, 1, depth);
  ctx.fillRect(rx, minY, 1, depth);

  // Subtle shaded goal mouth area
  ctx.fillStyle = 'rgba(20, 26, 38, 0.22)';
  ctx.fillRect(lx + 1, minY, GOAL.width - 2, depth);

  // Backstop chain-link mesh strip
  ctx.fillStyle = '#3b4250';
  ctx.fillRect(lx - 2 + sx, backY - 2, GOAL.width + 4, 4);
  ctx.fillStyle = '#9aa6b8';
  for (let x = lx; x <= rx; x += 4) {
    ctx.fillRect(x + sx, backY - 1, 2, 2);
  }

  // Left Goalpost: Classic 90s Backpack!
  drawBackpack(ctx, lx - 4 + sx, lineY - 5, isTop ? '#d9483b' : '#2d7be8', '#ffd84d');

  // Right Goalpost: Orange recess cone + crumpled sweater!
  drawCone(ctx, rx + 4 + sx, lineY - 4);
  drawBackpack(ctx, rx + 9 + sx, lineY - 4, isTop ? '#2da866' : '#8b4ad9', '#f4f7ff');
}

function drawBackpack(ctx, x, y, color, pocketColor) {
  const px = Math.round(x);
  const py = Math.round(y);
  // Shadow
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(px - 4, py + 5, 9, 3);
  // Outline
  ctx.fillStyle = '#151822';
  ctx.fillRect(px - 4, py - 2, 9, 8);
  // Main pack
  ctx.fillStyle = color;
  ctx.fillRect(px - 3, py - 1, 7, 6);
  // Front pocket + zipper
  ctx.fillStyle = pocketColor;
  ctx.fillRect(px - 2, py + 2, 5, 2);
  // Top loop
  ctx.fillStyle = '#151822';
  ctx.fillRect(px - 1, py - 3, 3, 1);
}

function drawCone(ctx, x, y) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(px - 3, py + 4, 7, 2);
  ctx.fillStyle = '#d95416';
  ctx.fillRect(px - 3, py + 3, 7, 2);
  ctx.fillStyle = '#ff7221';
  ctx.fillRect(px - 2, py + 1, 5, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px - 1, py, 3, 1);
  ctx.fillStyle = '#ff7221';
  ctx.fillRect(px - 1, py - 2, 3, 2);
}

// Draw a 16-bit pixel-art schoolkid skater!
export function drawSkater(ctx, p, team, tick) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const speed = Math.hypot(p.vx, p.vy);
  const stride = speed > 0.2 ? Math.sin(tick * 0.35 + p.animOffset) : 0;
  const bob = speed > 0.2 ? Math.abs(Math.round(stride)) : 0;
  const facingUp = p.facingY < -0.3;
  const flipX = p.facingX < -0.25 ? -1 : 1;

  // Ground shadow
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs & Sneakers (animated run or big kick extension!)
  const leftLegY = y - 1 + Math.round(stride * 2);
  const rightLegY = y - 1 - Math.round(stride * 2);
  const kickExt = p.kickTimer > 0 ? 4 : 0;

  // Jeans / shorts
  ctx.fillStyle = '#293957';
  ctx.fillRect(x - 4, y - 5 - bob, 3, 4);
  ctx.fillRect(x + 1, y - 5 - bob, 3, 4);

  // Sneakers
  ctx.fillStyle = '#151822';
  ctx.fillRect(x - 5, leftLegY - 1, 5, 3);
  ctx.fillRect(x + (kickExt ? Math.round(p.facingX * kickExt) : 0), rightLegY - 1 + Math.round(p.facingY * kickExt * 0.5), 5, 3);
  ctx.fillStyle = p.sneakers;
  ctx.fillRect(x - 4, leftLegY, 3, 2);
  ctx.fillRect(x + 1 + (kickExt ? Math.round(p.facingX * kickExt) : 0), rightLegY + Math.round(p.facingY * kickExt * 0.5), 3, 2);

  // Torso (90s oversized schoolyard jersey/hoodie)
  const ty = y - 12 - bob;
  ctx.fillStyle = '#12151f'; // crisp 16-bit outline
  ctx.fillRect(x - 6, ty - 1, 12, 9);
  ctx.fillStyle = team.primary;
  ctx.fillRect(x - 5, ty, 10, 7);
  // Horizontal varsity stripe
  ctx.fillStyle = team.secondary;
  ctx.fillRect(x - 5, ty + 3, 10, 2);
  ctx.fillStyle = team.trim;
  ctx.fillRect(x - 5, ty + 5, 10, 1);

  // Arms — raised forward if catching/holding the tennis ball!
  const armsUp = p.holdingBall || p.catchAnim > 0;
  ctx.fillStyle = team.primary;
  if (armsUp) {
    ctx.fillRect(x - 7, ty - 1, 2, 4);
    ctx.fillRect(x + 5, ty - 1, 2, 4);
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - 7, ty - 2, 2, 2);
    ctx.fillRect(x + 5, ty - 2, 2, 2);
  } else {
    const armSwing = Math.round(stride * 1.5);
    ctx.fillRect(x - 7, ty + 1 - armSwing, 2, 5);
    ctx.fillRect(x + 5, ty + 1 + armSwing, 2, 5);
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - 7, ty + 5 - armSwing, 2, 2);
    ctx.fillRect(x + 5, ty + 5 + armSwing, 2, 2);
  }

  // Head
  const hy = ty - 7;
  ctx.fillStyle = '#12151f';
  ctx.fillRect(x - 5, hy - 1, 10, 8);
  ctx.fillStyle = p.skin;
  ctx.fillRect(x - 4, hy, 8, 6);

  // Hair styles (classic 90s kids!)
  ctx.fillStyle = p.hair;
  if (p.hairStyle === 'cap') {
    // Backwards or forwards 90s baseball cap
    ctx.fillStyle = team.primary;
    ctx.fillRect(x - 5, hy - 2, 10, 3);
    ctx.fillStyle = team.trim;
    ctx.fillRect(x - 5 + (flipX > 0 ? 3 : -2), hy, 5, 1);
  } else if (p.hairStyle === 'spiky') {
    ctx.fillRect(x - 4, hy - 2, 8, 3);
    ctx.fillRect(x - 3, hy - 3, 2, 1);
    ctx.fillRect(x, hy - 3, 2, 1);
    ctx.fillRect(x + 2, hy - 3, 2, 1);
  } else if (p.hairStyle === 'pony') {
    ctx.fillRect(x - 4, hy - 2, 8, 3);
    ctx.fillRect(x - 5, hy, 1, 3);
    ctx.fillRect(x + 4, hy, 2, 4); // ponytail
  } else if (p.hairStyle === 'buzz') {
    ctx.fillRect(x - 4, hy - 1, 8, 2);
  } else {
    ctx.fillRect(x - 4, hy - 2, 8, 3);
    ctx.fillRect(x - 4, hy, 2, 2);
  }

  // Face (eyes when facing down/side; jersey back highlight when facing up)
  if (!facingUp) {
    ctx.fillStyle = '#12151f';
    ctx.fillRect(x - 2 + (flipX > 0 ? 0 : -1), hy + 2, 1, 2);
    ctx.fillRect(x + 1 + (flipX > 0 ? 1 : 0), hy + 2, 1, 2);
  } else {
    // Hair covers back of head
    ctx.fillStyle = p.hair;
    ctx.fillRect(x - 4, hy + 1, 8, 4);
  }

  // If holding the caught tennis ball in hands, draw it clutched visibly right in front!
  if (p.holdingBall) {
    const bx = x + Math.round(p.facingX * 5);
    const by = ty + 1 + Math.round(p.facingY * 2);
    ctx.fillStyle = '#18240a';
    ctx.fillRect(bx - 3, by - 3, 7, 7);
    ctx.fillStyle = PALETTE.tennisYellow;
    ctx.fillRect(bx - 2, by - 2, 5, 5);
    ctx.fillStyle = PALETTE.tennisSeam;
    ctx.fillRect(bx - 1, by - 1, 2, 1);
  }
}

// Draw a 16-bit pixel-art SCHOOLYARD GOALIE wielding an outstretched JACKET + BASEBALL GLOVE!
export function drawGoalie(ctx, g, team, tick) {
  const x = Math.round(g.x);
  const y = Math.round(g.y);
  const diveX = g.diveTimer > 0 ? Math.round(g.diveDir * 5) : 0;
  const jacketFlare = g.jacketTimer > 0 ? 4 : Math.round(Math.sin(tick * 0.16) * 1);
  const gloveReach = g.gloveTimer > 0 ? 5 : 0;
  const facingDown = g.team === 'away'; // Top goalie faces down; bottom goalie faces up

  // Wide goalie shadow
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(x + diveX * 0.5, y + 2, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const gx = x + diveX;
  const gy = y;

  // === LEFT SIDE: OUTSTRETCHED RECESS JACKET (held like a cape/blocker!) ===
  const jx = gx - 13 - jacketFlare;
  const jy = gy - 12;
  const jw = 9 + jacketFlare;
  const jh = 11;
  ctx.fillStyle = '#12151f';
  ctx.fillRect(jx - 1, jy - 1, jw + 2, jh + 2);
  ctx.fillStyle = g.jacketColor || '#22a65b';
  ctx.fillRect(jx, jy, jw, jh);
  // Jacket folds, zipper stripe & dangling sleeve
  ctx.fillStyle = g.jacketTrim || '#146b39';
  ctx.fillRect(jx + 2, jy + 1, 2, jh - 2);
  ctx.fillRect(jx, jy + jh - 2, jw, 2);
  ctx.fillStyle = '#e6edf5'; // shiny jacket zipper!
  ctx.fillRect(jx + jw - 2, jy + 1, 1, jh - 3);

  // Legs & crouched goalie stance
  ctx.fillStyle = '#26344f';
  ctx.fillRect(gx - 5, gy - 5, 4, 4);
  ctx.fillRect(gx + 1, gy - 5, 4, 4);
  ctx.fillStyle = '#151822';
  ctx.fillRect(gx - 6, gy - 1, 5, 3);
  ctx.fillRect(gx + 1, gy - 1, 5, 3);
  ctx.fillStyle = g.sneakers;
  ctx.fillRect(gx - 5, gy, 3, 2);
  ctx.fillRect(gx + 2, gy, 3, 2);

  // Torso (team sweater)
  const ty = gy - 12;
  ctx.fillStyle = '#12151f';
  ctx.fillRect(gx - 6, ty - 1, 12, 9);
  ctx.fillStyle = team.primary;
  ctx.fillRect(gx - 5, ty, 10, 7);
  ctx.fillStyle = team.secondary;
  ctx.fillRect(gx - 5, ty + 3, 10, 2);

  // === RIGHT SIDE: GIANT LEATHER BASEBALL GLOVE! ===
  const glx = gx + 6 + gloveReach;
  const gly = ty - 2 - (gloveReach > 0 ? 2 : 0);
  // Arm reaching out
  ctx.fillStyle = team.primary;
  ctx.fillRect(gx + 4, ty + 1, 4 + gloveReach, 3);
  // Oversized leather mitt outline
  ctx.fillStyle = '#1b0f08';
  ctx.fillRect(glx - 1, gly - 1, 9, 9);
  // Leather body
  ctx.fillStyle = g.gloveColor || '#a65d2a';
  ctx.fillRect(glx, gly, 7, 7);
  // Thumb notch + webbed pocket highlight
  ctx.fillStyle = '#d48c4e';
  ctx.fillRect(glx + 1, gly + 1, 4, 4);
  ctx.fillStyle = '#5c2d10'; // glove pocket webbing
  ctx.fillRect(glx + 2, gly + 2, 2, 2);
  ctx.fillRect(glx + 1, gly + 4, 3, 1);

  // If goalie caught the ball in their baseball glove, show neon-yellow ball nestled in the mitt!
  if (g.holdingBall) {
    ctx.fillStyle = PALETTE.tennisYellow;
    ctx.fillRect(glx + 1, gly + 1, 4, 4);
    ctx.fillStyle = PALETTE.tennisSeam;
    ctx.fillRect(glx + 2, gly + 2, 2, 1);
  }

  // Head
  const hy = ty - 7;
  ctx.fillStyle = '#12151f';
  ctx.fillRect(gx - 5, hy - 1, 10, 8);
  ctx.fillStyle = g.skin;
  ctx.fillRect(gx - 4, hy, 8, 6);

  // Hair / Cap
  if (g.hairStyle === 'cap') {
    ctx.fillStyle = team.primary;
    ctx.fillRect(gx - 5, hy - 2, 10, 3);
    ctx.fillStyle = team.trim;
    ctx.fillRect(gx - 2, hy, 6, 1);
  } else {
    ctx.fillStyle = g.hair;
    ctx.fillRect(gx - 4, hy - 2, 8, 3);
    ctx.fillRect(gx - 5, hy - 1, 2, 2);
    ctx.fillRect(gx + 3, hy - 1, 2, 2);
  }

  if (facingDown) {
    ctx.fillStyle = '#12151f';
    ctx.fillRect(gx - 2, hy + 2, 1, 2);
    ctx.fillRect(gx + 1, hy + 2, 1, 2);
  } else {
    ctx.fillStyle = g.hair;
    ctx.fillRect(gx - 4, hy + 1, 8, 4);
  }
}

// Draw little sideline recess spectators who bounce and cheer!
export function drawSpectator(ctx, spec, tick, celebrating) {
  const jump = celebrating
    ? Math.abs(Math.round(Math.sin(tick * 0.45 + spec.phase) * 4))
    : Math.round(Math.max(0, Math.sin(tick * 0.08 + spec.phase)) * 1);
  const x = spec.x;
  const y = spec.y - jump;

  ctx.fillStyle = '#12151f';
  ctx.fillRect(x - 4, y - 8, 8, 9);
  // Shirt
  ctx.fillStyle = spec.shirt;
  ctx.fillRect(x - 3, y - 4, 6, 4);
  // Head
  ctx.fillStyle = spec.skin;
  ctx.fillRect(x - 3, y - 7, 6, 3);
  // Hair
  ctx.fillStyle = spec.hair;
  ctx.fillRect(x - 3, y - 8, 6, 2);
  // Raised arms when cheering!
  if (celebrating) {
    ctx.fillStyle = spec.shirt;
    ctx.fillRect(x - 5, y - 6, 2, 3);
    ctx.fillRect(x + 3, y - 6, 2, 3);
  }
}
