import { PALETTE, GOAL } from './constants.js';
import { UNIFORM_COLORS, resolveUniformKit } from './roster.js?v=13';

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
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
  '>': ['10000', '01000', '00100', '00010', '00100', '01000', '10000'],
  '<': ['00001', '00010', '00100', '01000', '00100', '00010', '00001'],
  '^': ['00100', '01010', '10001', '00000', '00000', '00000', '00000'],
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

// Draw neon-yellow fuzzy tennis ball with 2.5D shadow, bounce scale, and hard-shot speed trail
export function drawTennisBall(ctx, ball, tick) {
  const bx = Math.round(ball.x);
  const by = Math.round(ball.y);
  const bz = Math.round(ball.z);

  // Speed afterimage trail for Hard Shots / One-Timers / Full-Field Throws!
  if (ball.trail && ball.trail.length > 1) {
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const alpha = ((i + 1) / (ball.trail.length + 1)) * 0.45;
      ctx.fillStyle = ball.isThrow
        ? `rgba(255, 232, 77, ${alpha.toFixed(2)})`
        : `rgba(255, 118, 46, ${alpha.toFixed(2)})`;
      const tr = i > 2 ? 2 : 1;
      ctx.fillRect(Math.round(t.x) - tr, Math.round(t.y - t.z) - tr, tr * 2 + 1, tr * 2 + 1);
    }
  }

  // Asphalt shadow shrinks as ball rises high in the air (e.g. full-field goalie throw!)
  const shadowScale = Math.max(0.32, 1 - bz / 78);
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
// uniformMode: 'default' (maroon shirt, darker maroon tie, blue pants) | 'dress' (maroon blazer, white shirt, tie, grey trousers)
export function drawSkater(ctx, p, team, tick, uniformMode = 'default') {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const speed = Math.hypot(p.vx, p.vy);
  const stride = speed > 0.2 ? Math.sin(tick * 0.35 + p.animOffset) : 0;
  const bob = speed > 0.2 ? Math.abs(Math.round(stride)) : 0;
  const facingUp = p.facingY < -0.3;
  const flipX = p.facingX < -0.25 ? -1 : 1;
  const kit =
    p.wearsJacket && p.coatColor
      ? 'jacket'
      : resolveUniformKit(p.team || team?.id || 'home', uniformMode);
  const isDressPants = kit === 'dress_blazer' || kit === 'dress_no_blazer';
  const isDress = uniformMode === 'dress';
  const isCrying = p.cryTimer > 0;
  const isStunned = p.stunTimer > 0;

  // Ground shadow
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, isCrying ? 8 : isStunned ? 9 : p.beefy ? 8 : p.thin ? 5 : 6, p.beefy ? 3.5 : 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // If crying (Chung quirk!), sit upright on the blacktop sobbing; otherwise tilt/sprawl when stunned!
  ctx.save();
  if (isCrying) {
    const sob = Math.floor(tick / 6) % 2;
    ctx.translate(0, 4 + sob);
  } else if (isStunned) {
    const tilt = p.staysDown && p.stunTimer > 35 ? 1.38 : 0.55;
    ctx.translate(x, y - 4);
    ctx.rotate((p.stunDir || 1) * tilt);
    ctx.translate(-x, -(y - 4));
  }

  // Legs & Sneakers (animated run, slap-kick wind-up cockback, or big kick extension!)
  const leftLegY = y - 1 + Math.round(stride * 2);
  const rightLegY = y - 1 - Math.round(stride * 2);
  const isWindup = p.windupFrames >= 10;
  const kickExt = p.kickTimer > 0 ? 4 : isWindup ? -4 : 0;

  // School uniform pants: grey trousers for dress kits, classic blue pants for default!
  const tallLift = p.tall ? 2 : p.short ? -2 : 0;
  ctx.fillStyle = isDressPants ? UNIFORM_COLORS.dressPants : UNIFORM_COLORS.bluePants;
  if (p.beefy) {
    ctx.fillRect(x - 5, y - 5 - tallLift - bob, 4, 4 + tallLift);
    ctx.fillRect(x + 1, y - 5 - tallLift - bob, 4, 4 + tallLift);
  } else if (p.thin) {
    ctx.fillRect(x - 3, y - 5 - tallLift - bob, 2, 4 + tallLift);
    ctx.fillRect(x + 1, y - 5 - tallLift - bob, 2, 4 + tallLift);
  } else {
    ctx.fillRect(x - 4, y - 5 - tallLift - bob, 3, 4 + tallLift);
    ctx.fillRect(x + 1, y - 5 - tallLift - bob, 3, 4 + tallLift);
  }

  // Sneakers / school shoes
  const rkOx = kickExt ? Math.round(p.facingX * kickExt) : 0;
  const rkOy = kickExt ? Math.round(p.facingY * kickExt * 0.5) : 0;
  const shoePad = p.beefy ? 1 : 0;
  ctx.fillStyle = '#151822';
  ctx.fillRect(x - 5 - shoePad, leftLegY - 1, 5 + shoePad, 3);
  ctx.fillRect(x + rkOx, rightLegY - 1 + rkOy, 5 + shoePad, 3);
  ctx.fillStyle = p.sneakers;
  ctx.fillRect(x - 4 - shoePad, leftLegY, 3 + shoePad, 2);
  ctx.fillRect(x + 1 + rkOx, rightLegY + rkOy, 3 + shoePad, 2);

  // Flashing spark at kicking heel when fully cocked for a Hard Shot!
  if (isWindup && p.windupFrames >= 20 && Math.floor(tick / 3) % 2 === 0) {
    ctx.fillStyle = '#ff6d2e';
    ctx.fillRect(x + 2 + rkOx, rightLegY - 1 + rkOy, 2, 2);
  }

  // Torso:
  // - 'default': maroon collared shirt + darker maroon tie (+ blue pants)
  // - 'dress_no_blazer': white collared shirt + maroon tie (+ grey pants)
  // - 'dress_blazer': maroon blazer + gold crest + white collar + maroon tie (+ grey pants)
  // - 'jacket': casual outdoor jacket over school uniform (corner basketball players)
  const ty = y - 12 - tallLift - bob;
  const bw = p.beefy ? 2 : p.thin ? -1 : 0; // Broad, hefty torso for beefy builds; trim silhouette for thin builds!
  const bh = p.beefy ? 1 : 0;               // Fuller belly/torso depth for beefy builds
  const sleeveColor =
    kit === 'jacket'
      ? p.coatColor
      : kit === 'dress_no_blazer'
      ? UNIFORM_COLORS.whiteShirt
      : kit === 'dress_blazer'
      ? UNIFORM_COLORS.maroon
      : UNIFORM_COLORS.maroonShirt;
  ctx.fillStyle = '#12151f'; // crisp 16-bit outline
  ctx.fillRect(x - 6 - bw, ty - 1, 12 + bw * 2, 9 + bh);

  if (kit === 'jacket') {
    // Casual colorful recess jacket (puffy/zippered outerwear, NOT a blazer!)
    ctx.fillStyle = p.coatColor;
    ctx.fillRect(x - 5 - bw, ty, 10 + bw * 2, 7 + bh);
    // Ribbed elastic jacket waist & sporty side stripe/collar
    ctx.fillStyle = p.coatTrim || '#1a2233';
    ctx.fillRect(x - 5 - bw, ty + 6 + bh, 10 + bw * 2, 1);
    ctx.fillRect(x - 5 - bw, ty, 2, 1);
    ctx.fillRect(x + 3 + bw, ty, 2, 1);
    if (!facingUp) {
      // Open zipped jacket reveals the school uniform shirt + slightly darker maroon tie underneath!
      ctx.fillStyle = isDress ? UNIFORM_COLORS.whiteShirt : UNIFORM_COLORS.maroonShirt;
      ctx.fillRect(x - 2, ty, 4, 5 + bh);
      // Zipper edge flecks
      ctx.fillStyle = '#d8e2f0';
      ctx.fillRect(x - 2, ty + 2, 1, 3 + bh);
      ctx.fillRect(x + 2, ty + 2, 1, 3 + bh);
      // Slightly darker maroon tie peeking cleanly through the open jacket!
      ctx.fillStyle = UNIFORM_COLORS.tie;
      ctx.fillRect(x - 1, ty, 2, 5 + bh);
    } else {
      // Hood/collar seam across back of casual recess jacket
      ctx.fillStyle = p.coatTrim || '#1a2233';
      ctx.fillRect(x - 4 - bw, ty + 1, 8 + bw * 2, 2);
    }
  } else if (kit === 'dress_no_blazer') {
    // Dress Uniform without blazer: crisp white collared shirt + maroon tie (+ grey pants)!
    ctx.fillStyle = UNIFORM_COLORS.whiteShirt;
    ctx.fillRect(x - 5 - bw, ty, 10 + bw * 2, 7 + bh);
    // Subtle lower shirt shadow & belt line
    ctx.fillStyle = UNIFORM_COLORS.whiteShirtShade;
    ctx.fillRect(x - 5 - bw, ty + 5 + bh, 10 + bw * 2, 1);
    ctx.fillStyle = '#1d2230';
    ctx.fillRect(x - 5 - bw, ty + 6 + bh, 10 + bw * 2, 1);
    if (!facingUp) {
      // Crisp collar shading & bold maroon tie down the front of the white shirt!
      ctx.fillStyle = UNIFORM_COLORS.whiteShirtShade;
      ctx.fillRect(x - 3, ty, 6, 1);
      ctx.fillStyle = UNIFORM_COLORS.dressTie;
      ctx.fillRect(x - 1, ty, 2, 5 + bh);
      ctx.fillRect(x - 1, ty + 5 + bh, 1, 1);
    }
  } else if (kit === 'dress_blazer') {
    // Optional Dress Uniform: Maroon blazer + white shirt collar + maroon tie + gold crest (+ grey pants)
    ctx.fillStyle = UNIFORM_COLORS.maroon;
    ctx.fillRect(x - 5 - bw, ty, 10 + bw * 2, 7 + bh);
    ctx.fillStyle = UNIFORM_COLORS.maroonShade;
    ctx.fillRect(x - 5 - bw, ty + 6 + bh, 10 + bw * 2, 1);
    if (!facingUp) {
      ctx.fillStyle = UNIFORM_COLORS.whiteShirt;
      ctx.fillRect(x - 2, ty, 4, 2);
      ctx.fillStyle = UNIFORM_COLORS.tie;
      ctx.fillRect(x - 1, ty + 1, 2, 4 + bh);
      ctx.fillRect(x - 1, ty + 5 + bh, 1, 1);
      ctx.fillStyle = UNIFORM_COLORS.crest;
      ctx.fillRect(x + 2 + (p.beefy ? 1 : 0), ty + 2, 1, 1);
    }
  } else {
    // Default Everyday Uniform: Maroon collared shirt + slightly darker maroon tie (+ blue pants)!
    ctx.fillStyle = UNIFORM_COLORS.maroonShirt;
    ctx.fillRect(x - 5 - bw, ty, 10 + bw * 2, 7 + bh);
    // Subtle tucked shirt belt/waist line
    ctx.fillStyle = '#1d2230';
    ctx.fillRect(x - 5 - bw, ty + 6 + bh, 10 + bw * 2, 1);
    if (!facingUp) {
      // Slightly darker maroon collar fold + tie down the center of the maroon shirt
      ctx.fillStyle = UNIFORM_COLORS.maroonShirtShade;
      ctx.fillRect(x - 3, ty, 6, 1);
      ctx.fillStyle = UNIFORM_COLORS.tie;
      ctx.fillRect(x - 1, ty, 2, 5 + bh);
      ctx.fillRect(x - 1, ty + 5 + bh, 1, 1);
    }
  }

  // Arms — raised forward if catching/holding the tennis ball!
  const armsUp = p.holdingBall || p.catchAnim > 0;
  const armW = p.beefy ? 3 : 2;
  ctx.fillStyle = sleeveColor;
  if (armsUp) {
    ctx.fillRect(x - 5 - bw - armW, ty - 1, armW, 4);
    ctx.fillRect(x + 5 + bw, ty - 1, armW, 4);
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - 5 - bw - armW, ty - 2, armW, 2);
    ctx.fillRect(x + 5 + bw, ty - 2, armW, 2);
  } else {
    const armSwing = Math.round(stride * 1.5);
    ctx.fillRect(x - 5 - bw - armW, ty + 1 - armSwing, armW, 5);
    ctx.fillRect(x + 5 + bw, ty + 1 + armSwing, armW, 5);
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - 5 - bw - armW, ty + 5 - armSwing, armW, 2);
    ctx.fillRect(x + 5 + bw, ty + 5 + armSwing, armW, 2);
  }

  // Head (rounder/fuller head for beefy builds!)
  const hy = ty - 7;
  const hw = p.beefy ? 1 : 0;
  ctx.fillStyle = '#12151f';
  ctx.fillRect(x - 5 - hw, hy - 1, 10 + hw * 2, 8);
  ctx.fillStyle = p.skin;
  ctx.fillRect(x - 4 - hw, hy, 8 + hw * 2, 6);

  // Hair styles (classic 90s kids — including clean bald dome!)
  ctx.fillStyle = p.hair;
  if (p.hairStyle === 'bald') {
    // Smooth rounded bald crown with subtle sunlit scalp gleam
    ctx.fillStyle = '#12151f';
    ctx.fillRect(x - 3 - hw, hy - 2, 6 + hw * 2, 1);
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - 3 - hw, hy - 1, 6 + hw * 2, 1);
    ctx.fillStyle = 'rgba(255, 240, 220, 0.45)';
    ctx.fillRect(x - 2, hy, 2, 1);
  } else if (p.hairStyle === 'cap') {
    // Backwards or forwards 90s baseball cap
    ctx.fillStyle = team.primary;
    ctx.fillRect(x - 5 - hw, hy - 2, 10 + hw * 2, 3);
    ctx.fillStyle = team.trim;
    ctx.fillRect(x - 5 + (flipX > 0 ? 3 : -2), hy, 5, 1);
  } else if (p.hairStyle === 'spiky') {
    ctx.fillRect(x - 4 - hw, hy - 2, 8 + hw * 2, 3);
    ctx.fillRect(x - 3, hy - 3, 2, 1);
    ctx.fillRect(x, hy - 3, 2, 1);
    ctx.fillRect(x + 2, hy - 3, 2, 1);
  } else if (p.hairStyle === 'pony') {
    ctx.fillRect(x - 4 - hw, hy - 2, 8 + hw * 2, 3);
    ctx.fillRect(x - 5 - hw, hy, 1, 3);
    ctx.fillRect(x + 4 + hw, hy, 2, 4); // ponytail
  } else if (p.hairStyle === 'buzz') {
    ctx.fillRect(x - 4 - hw, hy - 1, 8 + hw * 2, 2);
  } else {
    ctx.fillRect(x - 4 - hw, hy - 2, 8 + hw * 2, 3);
    ctx.fillRect(x - 4 - hw, hy, 2, 2);
  }

  // Face (eyes + optional 16-bit glasses when facing down/side; hair back when facing up)
  if (!facingUp) {
    if (p.glasses) {
      const glx = x + (flipX > 0 ? 0 : -1);
      ctx.fillStyle = '#181e2c'; // dark frames
      ctx.fillRect(glx - 3, hy + 1, 3, 3);
      ctx.fillRect(glx + 1, hy + 1, 3, 3);
      ctx.fillRect(glx, hy + 2, 1, 1); // nose bridge
      ctx.fillStyle = '#d4eeff'; // crisp retro lens glint
      ctx.fillRect(glx - 2, hy + 2, 1, 1);
      ctx.fillRect(glx + 2, hy + 2, 1, 1);
    } else {
      ctx.fillStyle = '#12151f';
      ctx.fillRect(x - 2 + (flipX > 0 ? 0 : -1), hy + 2, 1, 2);
      ctx.fillRect(x + 1 + (flipX > 0 ? 1 : 0), hy + 2, 1, 2);
    }
  } else if (p.hairStyle !== 'bald') {
    // Hair covers back of head
    ctx.fillStyle = p.hair;
    ctx.fillRect(x - 4 - hw, hy + 1, 8 + hw * 2, 4);
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

  ctx.restore();

  // Spinning golden stars above head when body-checked (or streaming pixel teardrops when Chung cries!)
  if (isCrying) {
    const dropY = (tick * 0.35) % 6;
    ctx.fillStyle = '#6fd6ff';
    ctx.fillRect(x - 3, Math.round(y - 12 - tallLift + dropY), 2, 2);
    ctx.fillRect(x + 2, Math.round(y - 12 - tallLift + ((dropY + 3) % 6)), 2, 2);
  } else if (isStunned) {
    for (let i = 0; i < 3; i++) {
      const a = tick * 0.25 + (i * Math.PI * 2) / 3;
      const sx = Math.round(x + Math.cos(a) * 6);
      const sy = Math.round(y - 22 - tallLift + Math.sin(a) * 2.5);
      ctx.fillStyle = '#ffe84d';
      ctx.fillRect(sx - 1, sy, 2, 2);
    }
  }
}

// Draw a 16-bit pixel-art SCHOOLYARD GOALIE wielding an outstretched JACKET + BASEBALL GLOVE!
export function drawGoalie(ctx, g, team, tick, uniformMode = 'default') {
  const x = Math.round(g.x);
  const y = Math.round(g.y);
  const diveX = g.diveTimer > 0 ? Math.round(g.diveDir * 5) : 0;
  const jacketFlare = g.jacketTimer > 0 ? 4 : Math.round(Math.sin(tick * 0.16) * 1);
  const gloveReach = g.gloveTimer > 0 ? 5 : 0;
  const facingDown = g.facingY >= -0.25; // Show eyes & tie when facing down or left/right into court
  const kit =
    g.wearsJacket && g.coatColor
      ? 'jacket'
      : resolveUniformKit(g.team || team?.id || 'home', uniformMode);
  const isDressPants = kit === 'dress_blazer' || kit === 'dress_no_blazer';
  const isDress = uniformMode === 'dress';

  // Wide goalie shadow
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(x + diveX * 0.5, y + 2, g.beefy ? 13 : 11, g.beefy ? 4 : 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const gx = x + diveX;
  const gy = y;
  const tallLift = g.tall ? 2 : g.short ? -2 : 0;
  const bw = g.beefy ? 2 : g.thin ? -1 : 0; // Broad hefty torso for beefy goalies like Baker & Brendan!
  const bh = g.beefy ? 1 : 0;
  const hw = g.beefy ? 1 : 0;

  // === LEFT SIDE: OUTSTRETCHED RECESS JACKET (held like a cape/blocker!) ===
  const jx = gx - 13 - Math.max(0, bw) - jacketFlare;
  const jy = gy - 12 - tallLift;
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

  // Legs & crouched goalie stance (grey trousers for dress kits, blue pants for default!)
  const legPad = g.beefy ? 1 : 0;
  ctx.fillStyle = isDressPants ? UNIFORM_COLORS.dressPants : UNIFORM_COLORS.bluePants;
  ctx.fillRect(gx - 5 - legPad, gy - 5 - tallLift, 4 + legPad, 4 + tallLift);
  ctx.fillRect(gx + 1, gy - 5 - tallLift, 4 + legPad, 4 + tallLift);
  ctx.fillStyle = '#151822';
  ctx.fillRect(gx - 6 - legPad, gy - 1, 5 + legPad, 3);
  ctx.fillRect(gx + 1, gy - 1, 5 + legPad, 3);
  ctx.fillStyle = g.sneakers;
  ctx.fillRect(gx - 5 - legPad, gy, 3 + legPad, 2);
  ctx.fillRect(gx + 2, gy, 3 + legPad, 2);

  // Torso (matches team's St. Mike's uniform kit while still holding a colorful jacket blocker shield!)
  const ty = gy - 12 - tallLift;
  const gSleeve =
    kit === 'jacket'
      ? g.coatColor
      : kit === 'dress_no_blazer'
      ? UNIFORM_COLORS.whiteShirt
      : kit === 'dress_blazer'
      ? UNIFORM_COLORS.maroon
      : UNIFORM_COLORS.maroonShirt;
  ctx.fillStyle = '#12151f';
  ctx.fillRect(gx - 6 - bw, ty - 1, 12 + bw * 2, 9 + bh);
  if (kit === 'jacket') {
    ctx.fillStyle = g.coatColor;
    ctx.fillRect(gx - 5 - bw, ty, 10 + bw * 2, 7 + bh);
    ctx.fillStyle = g.coatTrim || '#1a2233';
    ctx.fillRect(gx - 5 - bw, ty + 6 + bh, 10 + bw * 2, 1);
    if (facingDown) {
      ctx.fillStyle = isDress ? UNIFORM_COLORS.whiteShirt : UNIFORM_COLORS.maroonShirt;
      ctx.fillRect(gx - 2, ty, 4, 5 + bh);
      ctx.fillStyle = '#d8e2f0';
      ctx.fillRect(gx - 2, ty + 2, 1, 3 + bh);
      ctx.fillRect(gx + 2, ty + 2, 1, 3 + bh);
      ctx.fillStyle = UNIFORM_COLORS.tie;
      ctx.fillRect(gx - 1, ty, 2, 5 + bh);
    } else {
      ctx.fillStyle = g.coatTrim || '#1a2233';
      ctx.fillRect(gx - 4 - bw, ty + 1, 8 + bw * 2, 2);
    }
  } else if (kit === 'dress_no_blazer') {
    // Dress Uniform without blazer: crisp white shirt + maroon tie (+ grey pants)
    ctx.fillStyle = UNIFORM_COLORS.whiteShirt;
    ctx.fillRect(gx - 5 - bw, ty, 10 + bw * 2, 7 + bh);
    ctx.fillStyle = UNIFORM_COLORS.whiteShirtShade;
    ctx.fillRect(gx - 5 - bw, ty + 5 + bh, 10 + bw * 2, 1);
    ctx.fillStyle = '#1d2230';
    ctx.fillRect(gx - 5 - bw, ty + 6 + bh, 10 + bw * 2, 1);
    if (facingDown) {
      ctx.fillStyle = UNIFORM_COLORS.whiteShirtShade;
      ctx.fillRect(gx - 3, ty, 6, 1);
      ctx.fillStyle = UNIFORM_COLORS.dressTie;
      ctx.fillRect(gx - 1, ty, 2, 5 + bh);
    }
  } else if (kit === 'dress_blazer') {
    ctx.fillStyle = UNIFORM_COLORS.maroon;
    ctx.fillRect(gx - 5 - bw, ty, 10 + bw * 2, 7 + bh);
    if (facingDown) {
      ctx.fillStyle = UNIFORM_COLORS.whiteShirt;
      ctx.fillRect(gx - 2, ty, 4, 2);
      ctx.fillStyle = UNIFORM_COLORS.tie;
      ctx.fillRect(gx - 1, ty + 1, 2, 5 + bh);
      ctx.fillStyle = UNIFORM_COLORS.crest;
      ctx.fillRect(gx + 2 + (g.beefy ? 1 : 0), ty + 2, 1, 1);
    }
  } else {
    ctx.fillStyle = UNIFORM_COLORS.maroonShirt;
    ctx.fillRect(gx - 5 - bw, ty, 10 + bw * 2, 7 + bh);
    ctx.fillStyle = '#1d2230';
    ctx.fillRect(gx - 5 - bw, ty + 6 + bh, 10 + bw * 2, 1);
    if (facingDown) {
      ctx.fillStyle = UNIFORM_COLORS.tie;
      ctx.fillRect(gx - 1, ty, 2, 5 + bh);
    }
  }

  // === RIGHT SIDE: GIANT LEATHER BASEBALL GLOVE (+ OVERHAND THROW ANIMATION!) ===
  const isThrowing = g.throwTimer > 0;
  const throwWhipY = isThrowing ? (facingDown ? 4 : -6) : 0;
  const glx = gx + 6 + bw + gloveReach + (isThrowing ? 2 : 0);
  const gly = ty - 2 - (gloveReach > 0 ? 2 : 0) + throwWhipY;
  // Arm reaching out or whipping forward on an overhand throw
  ctx.fillStyle = gSleeve;
  ctx.fillRect(gx + 4 + bw, ty + 1 + Math.round(throwWhipY * 0.5), 4 + gloveReach, g.beefy ? 4 : 3);
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
  ctx.fillRect(gx - 5 - hw, hy - 1, 10 + hw * 2, 8);
  ctx.fillStyle = g.skin;
  ctx.fillRect(gx - 4 - hw, hy, 8 + hw * 2, 6);

  // Hair / Cap / Bald
  if (g.hairStyle === 'bald') {
    ctx.fillStyle = '#12151f';
    ctx.fillRect(gx - 3 - hw, hy - 2, 6 + hw * 2, 1);
    ctx.fillStyle = g.skin;
    ctx.fillRect(gx - 3 - hw, hy - 1, 6 + hw * 2, 1);
    ctx.fillStyle = 'rgba(255, 240, 220, 0.45)';
    ctx.fillRect(gx - 2, hy, 2, 1);
  } else if (g.hairStyle === 'cap') {
    ctx.fillStyle = team.primary;
    ctx.fillRect(gx - 5 - hw, hy - 2, 10 + hw * 2, 3);
    ctx.fillStyle = team.trim;
    ctx.fillRect(gx - 2, hy, 6, 1);
  } else {
    ctx.fillStyle = g.hair;
    ctx.fillRect(gx - 4 - hw, hy - 2, 8 + hw * 2, 3);
    ctx.fillRect(gx - 5 - hw, hy - 1, 2, 2);
    ctx.fillRect(gx + 3 + hw, hy - 1, 2, 2);
  }

  if (facingDown) {
    if (g.glasses) {
      ctx.fillStyle = '#181e2c';
      ctx.fillRect(gx - 3, hy + 1, 3, 3);
      ctx.fillRect(gx + 1, hy + 1, 3, 3);
      ctx.fillRect(gx, hy + 2, 1, 1);
      ctx.fillStyle = '#d4eeff';
      ctx.fillRect(gx - 2, hy + 2, 1, 1);
      ctx.fillRect(gx + 2, hy + 2, 1, 1);
    } else {
      ctx.fillStyle = '#12151f';
      ctx.fillRect(gx - 2, hy + 2, 1, 2);
      ctx.fillRect(gx + 1, hy + 2, 1, 2);
    }
  } else if (g.hairStyle !== 'bald') {
    ctx.fillStyle = g.hair;
    ctx.fillRect(gx - 4 - hw, hy + 1, 8 + hw * 2, 4);
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

// Draw the chubby kid in St. Mike's maroon uniform sitting at the foot of the bottom-right stairs
// ("The Bird That Couldn't Fly.") watching the recess game unfold!
export function drawSeatedStairsKid(ctx, x, y, tick = 0, uniformMode = 'everyday', lookX = x) {
  const kx = Math.round(x);
  const ky = Math.round(y);
  const isDress = uniformMode === 'dress';
  const breathe = Math.sin(tick * 0.06) > 0.55 ? 1 : 0;
  const blinking = tick % 210 > 204;
  const eyeShift = lookX < kx - 35 ? -1 : lookX > kx + 35 ? 1 : 0;

  // Soft shadow resting on the bottom concrete step
  ctx.fillStyle = 'rgba(10, 12, 20, 0.42)';
  ctx.beginPath();
  ctx.ellipse(kx, ky + 2, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Seated legs & sneakers bent forward on the foot of the stairs (facing up into the yard)
  const pantsColor = isDress ? UNIFORM_COLORS.dressPants : UNIFORM_COLORS.bluePants;
  const pantsShade = isDress ? '#272b35' : '#183461';
  // Left & right thick seated thighs/knees
  ctx.fillStyle = '#12151f';
  ctx.fillRect(kx - 8, ky - 5, 16, 7);
  ctx.fillStyle = pantsColor;
  ctx.fillRect(kx - 7, ky - 4, 6, 5);
  ctx.fillRect(kx + 1, ky - 4, 6, 5);
  ctx.fillStyle = pantsShade;
  ctx.fillRect(kx - 1, ky - 4, 2, 5);

  // Sneakers resting forward on the step/asphalt
  ctx.fillStyle = '#12151f';
  ctx.fillRect(kx - 8, ky, 5, 3);
  ctx.fillRect(kx + 3, ky, 5, 3);
  ctx.fillStyle = '#2b3242';
  ctx.fillRect(kx - 7, ky + 1, 3, 1);
  ctx.fillRect(kx + 4, ky + 1, 3, 1);
  ctx.fillStyle = '#e8edf5'; // crisp white rubber soles
  ctx.fillRect(kx - 7, ky + 2, 3, 1);
  ctx.fillRect(kx + 4, ky + 2, 3, 1);

  // Wide plump maroon uniform torso!
  const ty = ky - 14 + breathe;
  ctx.fillStyle = '#12151f';
  ctx.fillRect(kx - 8, ty - 1, 16, 11);

  if (isDress) {
    // Dress Uniform: maroon blazer, white shirt V, darker maroon tie, gold SMCS crest
    ctx.fillStyle = UNIFORM_COLORS.maroon;
    ctx.fillRect(kx - 7, ty, 14, 9);
    ctx.fillStyle = UNIFORM_COLORS.maroonShade;
    ctx.fillRect(kx - 7, ty + 6, 14, 3);
    ctx.fillStyle = UNIFORM_COLORS.whiteShirt;
    ctx.fillRect(kx - 2, ty, 4, 5);
    ctx.fillStyle = UNIFORM_COLORS.tie;
    ctx.fillRect(kx - 1, ty + 1, 2, 6);
    ctx.fillStyle = UNIFORM_COLORS.crest;
    ctx.fillRect(kx + 3, ty + 2, 2, 2);
  } else {
    // Everyday Uniform: maroon shirt + slightly darker maroon tie!
    ctx.fillStyle = UNIFORM_COLORS.maroonShirt;
    ctx.fillRect(kx - 7, ty, 14, 9);
    ctx.fillStyle = UNIFORM_COLORS.maroonShirtShade;
    ctx.fillRect(kx - 7, ty + 6, 14, 3);
    ctx.fillRect(kx - 7, ty, 2, 7);
    ctx.fillRect(kx + 5, ty, 2, 7);
    // Maroon shirt collar highlight + slightly darker maroon tie down his round belly
    ctx.fillStyle = '#a12c44';
    ctx.fillRect(kx - 3, ty, 6, 1);
    ctx.fillStyle = UNIFORM_COLORS.tie;
    ctx.fillRect(kx - 1, ty + 1, 2, 7);
  }

  // Chubby arms resting relaxed on his knees/step
  const sleeve = isDress ? UNIFORM_COLORS.maroon : UNIFORM_COLORS.maroonShirt;
  ctx.fillStyle = '#12151f';
  ctx.fillRect(kx - 10, ty + 1, 3, 7);
  ctx.fillRect(kx + 7, ty + 1, 3, 7);
  ctx.fillStyle = sleeve;
  ctx.fillRect(kx - 9, ty + 2, 2, 5);
  ctx.fillRect(kx + 7, ty + 2, 2, 5);
  // Hands resting on knees
  ctx.fillStyle = '#b97e54';
  ctx.fillRect(kx - 8, ty + 7, 2, 2);
  ctx.fillRect(kx + 6, ty + 7, 2, 2);

  // Round head with warm brown Filipino complexion & rosy chubby cheeks watching the game
  const hy = ty - 7;
  ctx.fillStyle = '#12151f';
  ctx.fillRect(kx - 6, hy - 1, 12, 8);
  ctx.fillStyle = '#b97e54';
  ctx.fillRect(kx - 5, hy, 10, 6);
  // Subtle warm cheeks
  ctx.fillStyle = '#a36442';
  ctx.fillRect(kx - 4, hy + 4, 2, 1);
  ctx.fillRect(kx + 2, hy + 4, 2, 1);

  // Jet-black bowl-cut / neat schoolboy hair
  ctx.fillStyle = '#161417';
  ctx.fillRect(kx - 5, hy - 2, 10, 3);
  ctx.fillRect(kx - 6, hy - 1, 2, 3);
  ctx.fillRect(kx + 4, hy - 1, 2, 3);

  // Eyes tracking the ball (with occasional slow blink)
  ctx.fillStyle = '#12151f';
  if (blinking) {
    ctx.fillRect(kx - 3 + eyeShift, hy + 3, 2, 1);
    ctx.fillRect(kx + 1 + eyeShift, hy + 3, 2, 1);
  } else {
    ctx.fillRect(kx - 2 + eyeShift, hy + 2, 1, 2);
    ctx.fillRect(kx + 1 + eyeShift, hy + 2, 1, 2);
  }
}

// Draw NHL '94 deliberate pass/throw receiver chevron over targeted teammate!
export function drawPassTargetMarker(ctx, target, tick, isGoalieThrow = false) {
  const x = Math.round(target.x);
  const y = Math.round(target.y);
  const bob = Math.round(Math.sin(tick * 0.25) * 2);
  const color = isGoalieThrow ? '#d9ff2e' : '#7ae8ff';

  // Subtle dashed receiver ring at feet
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([2, 2]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Pulsing downward chevron right above teammate's head
  const cy = y - 24 + bob;
  ctx.fillStyle = '#0d111d';
  ctx.fillRect(x - 4, cy - 1, 9, 3);
  ctx.fillRect(x - 3, cy + 2, 7, 2);
  ctx.fillRect(x - 1, cy + 4, 3, 2);

  ctx.fillStyle = color;
  ctx.fillRect(x - 3, cy, 7, 1);
  ctx.fillRect(x - 2, cy + 1, 5, 1);
  ctx.fillRect(x - 1, cy + 2, 3, 1);
  ctx.fillRect(x, cy + 3, 1, 1);
}
