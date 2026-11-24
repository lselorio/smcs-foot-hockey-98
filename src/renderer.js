import { HUD_H, MATCH, PALETTE, PHYSICS, RECESS_PERIODS, SCREEN_H, SCREEN_W, SHOT, VIEW_H } from './constants.js';
import { DEFAULT_COURT } from './courts.js';
import { CLASSMATES, TEAMS } from './roster.js';
import {
  drawGoalie,
  drawPassTargetMarker,
  drawPixelText,
  drawSeatedStairsKid,
  drawSkater,
  drawSpectator,
  drawStarRing,
  drawTennisBall,
} from './sprites.js';
import { drawSpinningSmcsCrest } from './smcs-crest.js';
import { sound } from './audio.js';
import {
  HOOPS_TEAM_STYLE,
  drawBasketball,
  drawCornerBasketballCourt,
} from './basketball.js';

// Pre-generate deterministic asphalt grit specks across the larger 66 Bond blacktop!
const ASPHALT_SPECKS = [];
let seed = 1998;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
for (let i = 0; i < 380; i++) {
  const b = DEFAULT_COURT.bounds;
  ASPHALT_SPECKS.push({
    x: Math.floor(b.left + 4 + rand() * (b.right - b.left - 8)),
    y: Math.floor(b.top + 4 + rand() * (b.bottom - b.top - 8)),
    light: rand() > 0.5,
  });
}

export function renderGame(ctx, game) {
  ctx.imageSmoothingEnabled = false;

  if (game.state === 'BOOT') {
    renderBootIntro(ctx, game);
    return;
  }

  if (game.state === 'TITLE') {
    renderTitleScreen(ctx, game);
    return;
  }

  if (game.state === 'OPTIONS') {
    renderOptionsScreen(ctx, game);
    return;
  }

  if (game.state === 'TEAM_SELECT') {
    renderTeamSelectScreen(ctx, game);
    return;
  }

  // === PLAYFIELD VIEWPORT ===
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD_H, SCREEN_W, VIEW_H);
  ctx.clip();

  const shakeX = game.screenShake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
  const shakeY = game.screenShake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
  ctx.translate(-Math.round(game.cameraX) + shakeX, HUD_H - Math.round(game.cameraY) + shakeY);

  // During Lunch Recess (when Home attacks the right square cage net), rotate the schoolyard 90° CCW
  // so the attack net is ALWAYS at the TOP of the screen while all kids, balls, & text stay upright!
  const rotated = typeof game.isCameraRotated === 'function' && game.isCameraRotated();
  const W = game.court.worldW;
  const toView = (wx, wy) => (rotated ? { x: wy, y: W - wx } : { x: wx, y: wy });
  const toViewVec = (vx, vy) => (rotated ? { x: vy, y: -vx } : { x: vx, y: vy });

  ctx.save();
  if (rotated) {
    ctx.translate(0, W);
    ctx.rotate(-Math.PI / 2);
  }
  drawSchoolyard(ctx, game, rotated);
  if (rotated && game.court.protrudingRoom) {
    drawProtrudingRoom(ctx, game.court.protrudingRoom, W, game.weather === 'snow');
  }
  ctx.restore();

  // Depth-sort skaters, goalies, spectators, basketball games, and ball by screen-Y for crisp 3/4 perspective!
  const drawables = [];
  const celebrating = game.state === 'GOAL_CELEBRATION';
  for (const spec of game.spectators) {
    const wobble = Math.round(getLeftWallFlexOffset(game.leftWallImpact, spec.y) * 0.65);
    const sp = toView(spec.x + wobble, spec.y);
    drawables.push({
      y: sp.y,
      draw: () => drawSpectator(ctx, { ...spec, x: sp.x, y: sp.y }, game.tick, celebrating),
    });
  }

  for (const p of game.players) {
    const pos = toView(p.x, p.y);
    const fv = toViewVec(p.facingX, p.facingY);
    const vv = toViewVec(p.vx, p.vy);
    const vp = { ...p, x: pos.x, y: pos.y, facingX: fv.x, facingY: fv.y, vx: vv.x, vy: vv.y };
    drawables.push({
      y: pos.y,
      draw: () => {
        const team = TEAMS[p.team];
        if (!game.isDemo && p.id === game.controlledId) {
          const holdRatio = p.holdingBall
            ? p.role === 'G'
              ? Math.max(0, 1 - p.holdFrames / PHYSICS.goalieMaxHoldFrames)
              : Math.max(0, 1 - Math.max(p.holdFrames / PHYSICS.maxHoldFrames, p.holdDist / PHYSICS.maxHoldSteps))
            : 0;
          drawStarRing(ctx, pos.x, pos.y, team.ringColor, game.tick, p.holdingBall, holdRatio);
        } else if (game.ball.owner?.id === p.id) {
          drawStarRing(ctx, pos.x, pos.y, team.ringColor, game.tick, p.holdingBall, 0);
        }

        if (p.role === 'G') {
          drawGoalie(ctx, vp, team, game.tick, game.uniformMode);
        } else {
          drawSkater(ctx, vp, team, game.tick, game.uniformMode);
        }

        // Deliberate pass / goalie-throw receiver chevron on highlighted teammate!
        if (game.passTarget && game.passTarget.id === p.id) {
          const ctrl = game.getControlledPlayer();
          drawPassTargetMarker(ctx, vp, game.tick, ctrl.role === 'G');
        }

        // Two-tier Quick Shot / Hard Shot (Slap-Kick) charge meter under active skater
        if (p.id === game.controlledId && game.kickCharge > 2) {
          const isHard = game.kickCharge >= SHOT.hardMinFrames;
          const pct = Math.min(1, game.kickCharge / SHOT.hardFullFrames);
          const w = Math.round(pct * 22);
          ctx.fillStyle = '#12151f';
          ctx.fillRect(Math.round(pos.x - 12), Math.round(pos.y + 7), 24, 5);
          // Threshold notch marking where Quick Shot transitions to Hard Shot!
          const notchX = Math.round(pos.x - 11 + (SHOT.hardMinFrames / SHOT.hardFullFrames) * 22);
          ctx.fillStyle = isHard ? '#ff5238' : '#ffe84d';
          ctx.fillRect(Math.round(pos.x - 11), Math.round(pos.y + 8), w, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(notchX, Math.round(pos.y + 7), 1, 5);
        }
      },
    });
  }

  // Only draw independent tennis ball when not clutched inside a player's hands
  if (!(game.ball.owner && game.ball.owner.holdingBall)) {
    const bpos = toView(game.ball.x, game.ball.y);
    const bv = toViewVec(game.ball.vx, game.ball.vy);
    const vball = rotated
      ? {
          ...game.ball,
          x: bpos.x,
          y: bpos.y,
          vx: bv.x,
          vy: bv.y,
          trail: game.ball.trail.map((tp) => {
            const tv = toView(tp.x, tp.y);
            return { x: tv.x, y: tv.y, z: tp.z };
          }),
        }
      : game.ball;
    drawables.push({
      y: bpos.y + 0.5,
      draw: () => drawTennisBall(ctx, vball, game.tick),
    });
  }

  // Depth-sort both live corner basketball games (top-left & lower-left) right in play!
  if (game.hoopsGames) {
    for (const h of game.hoopsGames) {
      for (const k of h.kids) {
        const kpos = toView(k.x, k.y);
        const kfv = toViewVec(k.facingX, k.facingY);
        const kvv = toViewVec(k.vx, k.vy);
        const vk = { ...k, x: kpos.x, y: kpos.y, facingX: kfv.x, facingY: kfv.y, vx: kvv.x, vy: kvv.y };
        drawables.push({
          y: kpos.y,
          draw: () => drawSkater(ctx, vk, HOOPS_TEAM_STYLE, game.tick, game.uniformMode),
        });
      }
      const bbpos = toView(h.bball.x, h.bball.y);
      drawables.push({
        y: bbpos.y + 0.5,
        draw: () => drawBasketball(ctx, rotated ? { ...h.bball, x: bbpos.x, y: bbpos.y } : h.bball),
      });
    }
  }

  // Depth-sort the chubby kid sitting at the foot of the bottom-right stairs!
  if (game.court.cornerStairs) {
    const cs = game.court.cornerStairs;
    const kpos = toView(cs.kidX, cs.kidY);
    const ballViewX = toView(game.ball.x, game.ball.y).x;
    drawables.push({
      y: kpos.y,
      draw: () => drawSeatedStairsKid(ctx, kpos.x, kpos.y, game.tick, game.uniformMode, ballViewX),
    });
  }

  // Depth-sort the protruding brick room when unrotated (already drawn with rotated walls when rotated)
  if (!rotated && game.court.protrudingRoom) {
    const pr = game.court.protrudingRoom;
    drawables.push({
      y: pr.y2,
      draw: () => drawProtrudingRoom(ctx, pr, game.court.worldW, game.weather === 'snow'),
    });
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const item of drawables) item.draw();

  // Upright caption plaque out of bounds on the top red-brick wall (above & left of the seated kid!)
  if (rotated && game.court.cornerStairs) {
    const cs = game.court.cornerStairs;
    const bw = 92;
    const bh = 23;
    const bx = 330; // Cleanly right of the square cage net (312) and above-left of the seated kid (423, 60)
    const by = 4;   // Completely out of bounds inside the top red-brick wall (y: 0..32)!
    ctx.fillStyle = 'rgba(11, 15, 28, 0.88)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4aa52';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    // Little pointer tab pointing down-right toward the seated kid at the stairs
    ctx.fillStyle = '#d4aa52';
    ctx.fillRect(bx + bw - 6, by + bh, 3, 3);
    ctx.fillRect(bx + bw - 4, by + bh + 2, 3, 2);
    drawPixelText(ctx, cs.captionLines[0], bx + bw / 2, by + 4, '#fff1c4', 1, 'center', null);
    drawPixelText(ctx, cs.captionLines[1], bx + bw / 2, by + 13, '#ffe07a', 1, 'center', null);
  }

  // Particles
  for (const pt of game.particles) {
    const ppos = toView(pt.x, pt.y);
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(ppos.x), Math.round(ppos.y), pt.size, pt.size);
  }

  // Arcade callouts ("CAUGHT!", "GLOVE SAVE!", "JACKET BLOCK!", "BOARDED!", "HOOPS!")
  for (const c of game.callouts) {
    const cpos = toView(c.x, c.y);
    drawPixelText(ctx, c.text, cpos.x, cpos.y, c.color, 1, 'center', '#0c0f1a');
  }

  ctx.restore();

  // Animated 16-bit falling snowflakes across viewport on Snow Day!
  if (game.weather === 'snow' && game.snowflakes) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const fl of game.snowflakes) {
      if (fl.y >= HUD_H) {
        ctx.fillRect(Math.round(fl.x), Math.round(fl.y), fl.size, fl.size);
      }
    }
  }

  // Off-screen indicators on the larger 66 Bond blacktop:
  // 1) Targeted pass/throw teammate arrow (any edge!)
  if (game.passTarget && game.state === 'PLAYING') {
    const ptView = toView(game.passTarget.x, game.passTarget.y);
    const sx = ptView.x - game.cameraX;
    const sy = HUD_H + (ptView.y - game.cameraY);
    if (sx < 8 || sx > SCREEN_W - 8 || sy < HUD_H + 8 || sy > SCREEN_H - 8) {
      const label = game.passTarget.name;
      const pillW = Math.max(48, label.length * 6 + 8);
      const halfW = Math.ceil(pillW / 2);
      const ax = Math.max(halfW + 4, Math.min(SCREEN_W - halfW - 4, Math.round(sx)));
      const ay = Math.max(HUD_H + 10, Math.min(SCREEN_H - 12, Math.round(sy)));
      const ctrl = game.getControlledPlayer();
      const col = ctrl.role === 'G' ? '#d9ff2e' : '#7ae8ff';
      ctx.fillStyle = 'rgba(10, 14, 26, 0.84)';
      ctx.fillRect(ax - halfW, ay - 6, pillW, 12);
      drawPixelText(ctx, label, ax, ay - 3, col, 1, 'center', null);
    }
  }

  // 2) Off-screen Attack Net indicator (always points UP when Lunch Recess rotates the court!)
  if (!game.isDemo && (game.state === 'PLAYING' || game.state === 'RESTART')) {
    const atk = game.getAttackNet('home');
    const atkView = toView(atk.centerX, atk.centerY);
    const nx = atkView.x - game.cameraX;
    const ny = HUD_H + (atkView.y - game.cameraY);
    const offscreen = nx < 10 || nx > SCREEN_W - 10 || ny < HUD_H + 10 || ny > SCREEN_H - 10;
    if (offscreen) {
      const ix = Math.max(40, Math.min(SCREEN_W - 40, Math.round(nx)));
      const iy = Math.max(HUD_H + 10, Math.min(SCREEN_H - 12, Math.round(ny)));
      ctx.fillStyle = 'rgba(10, 14, 26, 0.82)';
      ctx.fillRect(ix - 34, iy - 6, 68, 12);
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 1;
      ctx.strokeRect(ix - 33.5, iy - 5.5, 67, 11);
      drawPixelText(ctx, rotated || atk.wall === 'top' ? 'NET ^' : 'NET ->', ix, iy - 3, '#ffd84d', 1, 'center', null);
    }
  }

  // === TOP 16-BIT BROADCAST SCOREBOARD HUD ===
  renderHud(ctx, game);

  // Classic 16-bit Arcade Demo Mode ticker along bottom edge!
  if (game.isDemo && game.state !== 'GAME_OVER') {
    ctx.fillStyle = 'rgba(10, 14, 26, 0.82)';
    ctx.fillRect(0, SCREEN_H - 13, SCREEN_W, 13);
    const col = Math.floor(game.tick / 20) % 2 === 0 ? '#ffe84d' : '#9be8ff';
    drawPixelText(ctx, 'DEMO MODE (CPU VS CPU) - ENTER:PLAY  ESC:TITLE', SCREEN_W / 2, SCREEN_H - 10, col, 1, 'center', null);
  }

  // === STATE OVERLAYS ===
  if (game.state === 'FACEOFF') {
    if (game.showLineups && game.stateTimer > 38) {
      renderStartingLineups(ctx, game);
    } else {
      const pInfo = game.getCurrentPeriodInfo();
      const atk = game.getAttackNet('home');
      drawBanner(ctx, pInfo.name, `66 BOND - SHOOT AT ${atk.label}`, '#ffe84d');
    }
  } else if (game.state === 'BASEMENT_56') {
    const awarded = game.restartTeam === 'home' ? TEAMS.home : TEAMS.away;
    drawBanner(ctx, 'BASEMENT 56!', `${awarded.name} BALL AT STAIRS!`, '#d9ff2e');
  } else if (game.state === 'RESTART') {
    const isHomeBall = game.restartTeam === 'home';
    const isStairs = game.restartType === 'basement56';
    drawBanner(
      ctx,
      isStairs
        ? isHomeBall
          ? 'STAIRS BALL!'
          : `${TEAMS.away.short} STAIRS BALL`
        : isHomeBall
        ? 'GOALIE BALL!'
        : `${TEAMS.away.short} GOALIE BALL`,
      isStairs
        ? isHomeBall
          ? 'PLAY FROM STAIRCASE ENTRANCE'
          : `${TEAMS.away.name} PLAYS FROM STAIRS`
        : isHomeBall
        ? 'AIM + X:THROW  Z:BOMB'
        : `${TEAMS.away.name} GOALIE RESTARTS`,
      isHomeBall ? TEAMS.home.ringColor : TEAMS.away.ringColor
    );
  } else if (game.state === 'GOAL_CELEBRATION') {
    renderGoalBanner(ctx, game);
  } else if (game.state === 'PERIOD_END') {
    const nextPeriod = RECESS_PERIODS[game.period];
    const endTitle = game.period === 1 ? 'MORNING BELL!' : 'LUNCH BELL!';
    const nextSub = nextPeriod
      ? `SWAP NETS! NEXT: ${nextPeriod.name}${nextPeriod.num === 2 ? ' (2X!)' : ''}`
      : 'PRESS ENTER TO CONTINUE';
    drawBanner(ctx, endTitle, nextSub, '#ffe84d');
  } else if (game.state === 'PAUSED') {
    renderStatsModal(ctx, game, { isFinal: false });
  } else if (game.state === 'GAME_OVER') {
    renderStatsModal(ctx, game, { isFinal: true });
  }
}

function drawSchoolyard(ctx, game, rotated = false) {
  const { court } = game;
  const b = court.bounds;
  const W = court.worldW;
  const H = court.worldH;
  const isSnow = game.weather === 'snow';

  // Outer recess grass / snowy yard border
  ctx.fillStyle = isSnow ? '#b8c9de' : PALETTE.grassDark;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = isSnow ? '#cad8ea' : PALETTE.grassLight;
  for (let y = 0; y < H; y += 24) {
    ctx.fillRect(0, y, W, 12);
  }

  // Sidewalk curb around left & bottom of blacktop
  ctx.fillStyle = isSnow ? '#eef4fb' : '#9aa3b2';
  ctx.fillRect(b.left - 4, b.top - 4, b.right - b.left + 8, b.bottom - b.top + 8);

  // Main 66 Bond playing surface: dry grey blacktop OR white packed snow!
  ctx.fillStyle = isSnow ? '#e2ebf5' : PALETTE.asphaltMid;
  ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

  if (isSnow) {
    // Subtle packed-snow drift bands & snow sparkle specks
    ctx.fillStyle = '#d2dfee';
    for (let y = b.top + 18; y < b.bottom - 10; y += 44) {
      ctx.fillRect(b.left + 12, y, b.right - b.left - 24, 14);
    }
    for (const s of ASPHALT_SPECKS) {
      ctx.fillStyle = s.light ? '#ffffff' : '#bfd0e3';
      ctx.fillRect(s.x, s.y, 2, 1);
    }
  } else {
    // Asphalt grit texture
    for (const s of ASPHALT_SPECKS) {
      ctx.fillStyle = s.light ? PALETTE.asphaltLight : PALETTE.asphaltDark;
      ctx.fillRect(s.x, s.y, 2, 1);
    }
    // Charming schoolyard asphalt cracks
    ctx.fillStyle = PALETTE.asphaltCrack;
    ctx.fillRect(88, 152, 24, 1);
    ctx.fillRect(110, 153, 14, 1);
    ctx.fillRect(298, 322, 28, 1);
    ctx.fillRect(286, 323, 13, 1);
    ctx.fillRect(142, 358, 18, 1);
  }

  // Subtle dashed zone line marking the Left Wall Body-Check Boards on Clear days!
  if (!isSnow) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 160, 72, 0.22)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.left + 48, b.top + 4);
    ctx.lineTo(b.left + 48, b.bottom - 4);
    ctx.stroke();
    ctx.restore();
  }

  // Subtle faded four-square chalk in the lower-left area of the yard
  ctx.strokeStyle = isSnow ? 'rgba(130, 154, 184, 0.25)' : 'rgba(233, 238, 244, 0.14)';
  ctx.lineWidth = 1;
  ctx.strokeRect(52, 240, 26, 26);
  ctx.beginPath();
  ctx.moveTo(65, 240);
  ctx.lineTo(65, 266);
  ctx.moveTo(52, 253);
  ctx.lineTo(78, 253);
  ctx.stroke();

  // Center chalk faceoff circle on 66 Bond
  ctx.strokeStyle = isSnow ? '#9ab0c9' : PALETTE.chalkFade;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(court.faceoffX, court.faceoffY, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = isSnow ? '#8ba2bd' : PALETTE.chalk;
  ctx.fillRect(court.faceoffX - 2, court.faceoffY - 2, 4, 4);

  // =========================================================================
  // TOP WALL: BLACK BRICK WALL + 5 VERTICALLY-GRILLED WINDOWS + YELLOW BRICK NET!
  // =========================================================================
  const topNet = court.nets[0]; // top_yellow (x: 255..309, gap #3 / 2nd from right)
  const topShake = game.goalShake[topNet.id] > 0 ? Math.round(Math.sin(game.tick * 1.4) * 2) : 0;

  // Black brick wall mortar base
  ctx.fillStyle = '#171920';
  ctx.fillRect(0, 0, W, b.top);
  // Black brick masonry courses
  ctx.fillStyle = '#282c36';
  for (let row = 0; row < 8; row++) {
    const by = row * 6 + 1;
    for (let bx = (row % 2) * 7; bx < W; bx += 14) {
      ctx.fillRect(bx, by, 12, 4);
    }
  }
  // Subtle brick highlight edge along top wall base
  ctx.fillStyle = '#3a404f';
  ctx.fillRect(0, b.top - 2, W, 2);

  // === YELLOW BRICK RECTANGLE NET (Gap #3, 2nd from right, just right of center!) ===
  const yx = topNet.minCoord + topShake;
  const yw = topNet.span;
  // Yellow brick mortar background
  ctx.fillStyle = '#8c691c';
  ctx.fillRect(yx, 10, yw, b.top - 10);
  // Crisp golden-yellow brick courses!
  for (let row = 0; row < 7; row++) {
    const by = 11 + row * 6;
    ctx.fillStyle = row % 2 === 0 ? '#e3bd52' : '#d1a73b';
    for (let bx = yx + (row % 2) * 5; bx < yx + yw - 2; bx += 11) {
      const clipW = Math.min(9, yx + yw - bx);
      if (clipW > 0) ctx.fillRect(bx, by, clipW, 4);
    }
  }
  // Clear rectangle top height ledge / shadow so the wide lower rectangle silhouette pops!
  ctx.fillStyle = '#12141a';
  ctx.fillRect(yx - 1, 9, yw + 2, 2);
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(yx, b.top - 2, yw, 2);

  // === 5 EQUALLY SPACED GROUND WINDOWS WITH VERTICAL METAL GRILLS ===
  for (const win of court.topWindows) {
    const wx = win.x1;
    const ww = win.x2 - win.x1;
    const wy = 16;
    const wh = b.top - 18;
    // Stone window frame + sill right along the ground
    ctx.fillStyle = '#4e5563';
    ctx.fillRect(wx - 1, wy - 2, ww + 2, wh + 3);
    // Dark recessed basement glass
    ctx.fillStyle = '#131d2b';
    ctx.fillRect(wx + 1, wy, ww - 2, wh - 2);
    // Faint glass sheen
    ctx.fillStyle = '#253952';
    ctx.fillRect(wx + 3, wy + 2, 6, 4);
    ctx.fillRect(wx + ww - 10, wy + 8, 5, 4);
    // Vertical steel security grill bars protecting the glass!
    ctx.fillStyle = '#9aa6b8';
    for (let gx = wx + 3; gx < wx + ww - 2; gx += 4) {
      ctx.fillRect(gx, wy, 1, wh - 1);
    }
    // Horizontal brace bar across the vertical grill
    ctx.fillStyle = '#7b8799';
    ctx.fillRect(wx + 1, wy + Math.floor(wh / 2), ww - 2, 1);
    // Concrete ground sill
    ctx.fillStyle = '#7b8391';
    ctx.fillRect(wx - 1, b.top - 3, ww + 2, 3);
  }

  // Chalk goalie crease semi-circle in front of the Top Yellow Brick Net
  const topDefTeam = game.getDefendNet('home').id === topNet.id ? TEAMS.home : TEAMS.away;
  ctx.save();
  ctx.strokeStyle = PALETTE.chalkFade;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(topNet.centerX, b.top, topNet.creaseRadius, 0, Math.PI, false);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = topDefTeam.ringColor;
  ctx.fillRect(topNet.minCoord + 2, b.top + 1, topNet.span - 4, 2);

  // =========================================================================
  // RIGHT WALL: RED BRICK WALL + LOWER-MIDDLE SQUARE PROTECTIVE WINDOW CAGE NET!
  // =========================================================================
  const rightNet = court.nets[1]; // right_cage (y: 266..312, narrower span, taller height!)
  const rightShake = game.goalShake[rightNet.id] > 0 ? Math.round(Math.sin(game.tick * 1.4) * 2) : 0;

  // Red brick wall mortar & masonry courses running vertically along the right side
  ctx.fillStyle = '#572019';
  ctx.fillRect(b.right, b.top - 2, W - b.right, H - b.top + 2);
  ctx.fillStyle = '#963f33';
  for (let row = 0; row < Math.ceil((H - b.top) / 6); row++) {
    const by = b.top + row * 6;
    for (let bx = b.right + 1 + (row % 2) * 6; bx < W; bx += 12) {
      ctx.fillRect(bx, by, 10, 4);
    }
  }
  // Crisp curb shadow along base of right red brick wall
  ctx.fillStyle = 'rgba(10, 12, 18, 0.45)';
  ctx.fillRect(b.right - 3, b.top, 3, b.bottom - b.top);

  // === SQUARE CAGE PROTECTING A WINDOW (THE RIGHT NET!) ===
  const cy1 = rightNet.minCoord + rightShake;
  const ch = rightNet.span; // 46px (slightly thinner than the 54px top yellow rectangle!)
  const cx1 = b.right - 7;  // Protrudes 7px out from the red brick wall like a real 3D wire cage!
  const cw = 21;

  // Ground shadow cast left by the tall square cage
  ctx.fillStyle = 'rgba(10, 14, 22, 0.42)';
  ctx.fillRect(cx1 - 4, cy1 + 2, 5, ch);

  // Recessed dark window in the red brick behind the cage
  ctx.fillStyle = '#141e2e';
  ctx.fillRect(b.right + 1, cy1 + 2, 12, ch - 4);
  ctx.fillStyle = '#2c4461';
  ctx.fillRect(b.right + 3, cy1 + 6, 4, 10);
  ctx.fillRect(b.right + 3, cy1 + 22, 4, 12);

  // Metallic square protective wire/bar cage mesh over the window!
  ctx.fillStyle = 'rgba(195, 208, 224, 0.16)';
  ctx.fillRect(cx1, cy1, cw, ch);
  ctx.strokeStyle = '#c4d0e0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx1 + 0.5, cy1 + 0.5, cw - 1, ch - 1);

  // Horizontal & vertical square cage bars
  ctx.fillStyle = '#9aa8ba';
  for (let gy = cy1 + 6; gy < cy1 + ch - 3; gy += 6) {
    ctx.fillRect(cx1 + 1, gy, cw - 2, 1);
  }
  for (let gx = cx1 + 5; gx < cx1 + cw - 2; gx += 5) {
    ctx.fillRect(gx, cy1 + 1, 1, ch - 2);
  }
  // Bright front cage corner edge
  ctx.fillStyle = '#eef4fc';
  ctx.fillRect(cx1, cy1, 1, ch);

  // Chalk goalie crease semi-circle extending LEFT from the right square cage!
  const rightDefTeam = game.getDefendNet('home').id === rightNet.id ? TEAMS.home : TEAMS.away;
  ctx.save();
  ctx.strokeStyle = PALETTE.chalkFade;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(b.right, rightNet.centerY, rightNet.creaseRadius, Math.PI / 2, Math.PI * 1.5, false);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = rightDefTeam.ringColor;
  ctx.fillRect(b.right - 3, rightNet.minCoord + 2, 2, rightNet.span - 4);

  // === LEFT WALL (FLEXIBLE BODY-CHECK BOARDS THAT GIVE & SHAKE FROM POINT OF IMPACT!) ===
  // Drawn in 4px vertical segments so body checks visibly bow the wall inward and send a wobble wave outward!
  const imp = game.leftWallImpact;
  const sliceH = 4;
  // Dark recess behind the flexing wall so when it bows inward you see the give clearly!
  ctx.fillStyle = '#1f222a';
  ctx.fillRect(0, b.top - 2, b.left + 1, b.bottom - b.top + 6);

  for (let wy = b.top; wy < b.bottom; wy += sliceH) {
    const h = Math.min(sliceH, b.bottom - wy);
    const flex = Math.round(getLeftWallFlexOffset(imp, wy + h * 0.5));
    const wallRight = b.left + flex;

    // Main flexing wall panel backing
    ctx.fillStyle = '#3b3e47';
    ctx.fillRect(0, wy, Math.max(4, wallRight), h);

    // Panel ribbing / board seams that visibly ripple along with the wave
    const rowIdx = Math.floor((wy - b.top) / 8);
    if ((wy - b.top) % 8 < 5) {
      ctx.fillStyle = '#535866';
      const panelX = Math.max(0, 2 + (rowIdx % 2) * 5 + flex);
      const panelW = Math.max(0, wallRight - 3 - panelX);
      if (panelW > 0) ctx.fillRect(panelX, wy, panelW, h);
    }

    // Crisp flexing front lip along the blacktop edge (flashes warm right at impact!)
    let lipColor = isSnow ? '#ffffff' : '#7b8394';
    if (imp && imp.timer > imp.maxTimer - 10 && Math.abs(wy - imp.y) < 18) {
      lipColor = '#ffe84d';
    } else if (Math.abs(flex) >= 2) {
      lipColor = isSnow ? '#ffffff' : '#a8b3c7';
    }
    ctx.fillStyle = lipColor;
    ctx.fillRect(Math.max(2, wallRight - 2), wy, 2, h);

    // Cast shadow strip just right of the flexing boards
    ctx.fillStyle = 'rgba(10, 12, 18, 0.30)';
    ctx.fillRect(Math.max(4, wallRight), wy, 2, h);
  }

  // === BOTTOM WALL: RED BRICK WALL + "BASEMENT 56" DOWNSTAIRS STAIRCASE & GREEN BARRIER! ===
  // Red brick wall running all along the bottom edge of 66 Bond
  ctx.fillStyle = '#572019';
  ctx.fillRect(0, b.bottom, W, H - b.bottom);
  ctx.fillStyle = '#963f33';
  for (let row = 0; row < Math.ceil((H - b.bottom) / 6); row++) {
    const by = b.bottom + 1 + row * 6;
    for (let bx = (row % 2) * 6; bx < W; bx += 12) {
      ctx.fillRect(bx, by, 10, 4);
    }
  }
  ctx.fillStyle = isSnow ? '#ffffff' : '#3a1510';
  ctx.fillRect(b.left, b.bottom, b.right - b.left, 2);

  // Downstairs staircase ("Basement 56!") right in the middle, parallel to the bottom red-brick wall!
  // Descending steps go RIGHT -> LEFT, with a GREEN SAFETY BARRIER on top & left, and OPEN entrance on the RIGHT!
  if (court.basementStairs) {
    const s = court.basementStairs;
    const sw = s.x2 - s.x1;
    const sh = s.y2 - s.y1;

    // Deep dark basement stairwell pit
    ctx.fillStyle = '#0c0f16';
    ctx.fillRect(s.x1, s.y1, sw, sh);

    // Concrete stairs descending right-to-left (brightest at right entrance, darker down into Basement 56!)
    const stepShades = ['#7d8594', '#697180', '#545c6a', '#414854', '#2e333d', '#1d2129'];
    const stepW = 12;
    for (let i = 0; i < stepShades.length; i++) {
      const sx = s.x2 - (i + 1) * stepW;
      if (sx < s.x1) break;
      ctx.fillStyle = stepShades[i];
      ctx.fillRect(sx, s.y1 + 2, stepW - 1, sh - 3);
      // Crisp step riser edge
      ctx.fillStyle = '#151821';
      ctx.fillRect(sx, s.y1 + 2, 1, sh - 3);
    }

    // Subtle concrete curb at the OPEN RIGHT ENTRANCE showing where balls can roll in
    ctx.fillStyle = isSnow ? '#d4e2f2' : '#9aa3b2';
    ctx.fillRect(s.x2, s.y1 + 1, 2, sh - 1);

    // === GREEN SAFETY BARRIER (prevents people from falling in; open on the right!) ===
    // Top horizontal green railing & vertical balusters
    ctx.fillStyle = '#123d23';
    ctx.fillRect(s.x1 - 2, s.y1 - 3, sw + 4, 5);
    ctx.fillStyle = '#259c52';
    ctx.fillRect(s.x1 - 1, s.y1 - 2, sw + 2, 3);
    ctx.fillStyle = '#53d683'; // bright top highlight on green rail
    ctx.fillRect(s.x1 - 1, s.y1 - 2, sw + 2, 1);

    // Green posts along top rail + closed left end barrier
    ctx.fillStyle = '#123d23';
    ctx.fillRect(s.x1 - 2, s.y1 - 2, 4, sh + 3);
    ctx.fillStyle = '#259c52';
    ctx.fillRect(s.x1 - 1, s.y1 - 1, 2, sh + 1);
    for (let px = s.x1 + 16; px <= s.x2; px += 18) {
      ctx.fillStyle = '#19753c';
      ctx.fillRect(px, s.y1 + 1, 2, 4);
    }
  }

  // === BOTTOM-RIGHT CORNER: FOOT OF STAIRS LEADING UP OUT OF VIEW + CAPTION ===
  if (court.cornerStairs) {
    const cs = court.cornerStairs;
    const cw = cs.x2 - cs.x1;
    const ch = cs.y2 - cs.y1;

    // Subtle ground shadow right in front of the bottom step on the blacktop
    ctx.fillStyle = 'rgba(10, 12, 20, 0.35)';
    ctx.fillRect(cs.x1 - 2, cs.y1 - 2, cw + 4, 3);

    // Concrete stairs climbing UPWARD out of view past the bottom red-brick wall!
    // Each step southward gets brighter with a crisp dark riser facing the yard so elevation reads upward.
    const stepShades = isSnow
      ? ['#c3d1e2', '#ccd9e8', '#d5e1ef', '#dee9f5', '#e7f0fa', '#f0f6fc']
      : ['#838b9c', '#9199aa', '#9fa7b8', '#adb5c6', '#bbc3d4', '#c9d1e0'];
    const stepH = 7;
    for (let i = 0; i < stepShades.length; i++) {
      const sy = cs.y1 + i * stepH;
      const drawH = Math.min(stepH, cs.y2 - sy);
      if (drawH <= 0) break;
      // Riser shadow edge facing the schoolyard
      ctx.fillStyle = '#383e4a';
      ctx.fillRect(cs.x1, sy, cw, 2);
      // Sunlit step tread climbing higher
      ctx.fillStyle = stepShades[i];
      ctx.fillRect(cs.x1, sy + 2, cw, Math.max(1, drawH - 2));
      // Crisp bright lip along the back edge of the tread
      if (drawH >= 4) {
        ctx.fillStyle = isSnow ? '#ffffff' : '#dce3f0';
        ctx.fillRect(cs.x1 + 1, sy + 2, cw - 2, 1);
      }
    }

    // Flanking stone cheek walls & dark iron handrails rising up out of view
    ctx.fillStyle = '#474d5c';
    ctx.fillRect(cs.x1 - 3, cs.y1 - 1, 4, ch + 1);
    ctx.fillRect(cs.x2 - 1, cs.y1 - 1, 4, ch + 1);
    ctx.fillStyle = '#9aa3b5';
    ctx.fillRect(cs.x1 - 2, cs.y1, 2, ch);
    ctx.fillRect(cs.x2, cs.y1, 2, ch);
    // Steel handrail bar
    ctx.fillStyle = '#202633';
    ctx.fillRect(cs.x1 - 2, cs.y1 + 2, 1, ch - 2);
    ctx.fillRect(cs.x2 + 1, cs.y1 + 2, 1, ch - 2);

    // Caption plaque right next to the seated kid on the bottom red-brick wall (drawn upright in main pass when rotated!)
    if (!rotated) {
      const bx = 298;
      const by = 432;
      const bw = 92;
      const bh = 23;
      ctx.fillStyle = 'rgba(11, 15, 28, 0.88)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#d4aa52';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      // Little pointer tab toward the seated kid at the stairs
      ctx.fillStyle = '#d4aa52';
      ctx.fillRect(bx + bw, by + 9, 4, 2);
      ctx.fillRect(bx + bw + 2, by + 8, 2, 4);

      drawPixelText(ctx, cs.captionLines[0], bx + bw / 2, by + 4, '#fff1c4', 1, 'center', null);
      drawPixelText(ctx, cs.captionLines[1], bx + bw / 2, by + 13, '#ffe07a', 1, 'center', null);
    }
  }

  // === TOP-LEFT & LOWER-LEFT CORNER BASKETBALL HALF-COURTS & HOOPS (IN PLAY!) ===
  if (game.hoopsGames) {
    for (const h of game.hoopsGames) {
      drawCornerBasketballCourt(ctx, h, isSnow);
    }
  }
}

// Compute elastic give & traveling ripple displacement along the flexible left wall of 66 Bond!
function getLeftWallFlexOffset(imp, y) {
  if (!imp || imp.timer <= 0 || imp.strength <= 0) return 0;
  const elapsed = imp.maxTimer - imp.timer;
  const distY = Math.abs(y - imp.y);
  // Wavefront radiates upward & downward from the exact point of impact
  const waveDelay = distY * 0.08;
  if (elapsed < waveDelay) return 0;
  const localT = elapsed - waveDelay;
  const decay = Math.exp(-distY / 72) * Math.exp(-localT * 0.085);
  // Deep initial give inward to the left (-7px max) followed by springy reverberating rattle!
  return -Math.sin(localT * 0.62) * 7.5 * imp.strength * decay;
}

// Draw the small red-brick room protruding out of the right wall just above the square cage net
function drawProtrudingRoom(ctx, pr, worldW, isSnow) {
  const rx = pr.x1;
  const ry = pr.y1;
  const rw = pr.x2 - pr.x1;
  const rh = pr.y2 - pr.y1;
  const wallH = 14; // Visible south-facing red-brick wall below the flat roof
  const roofH = rh - wallH;
  const fullW = worldW - rx;

  // Ground shadow cast left & downward onto the schoolyard blacktop
  ctx.fillStyle = 'rgba(10, 12, 20, 0.42)';
  ctx.fillRect(rx - 4, ry + 3, 4, rh + 2);
  ctx.fillRect(rx - 3, pr.y2, rw + 3, 4);

  // South-facing red brick facade (seamlessly matches the right red-brick school wall!)
  const brickY = ry + roofH;
  ctx.fillStyle = '#572019';
  ctx.fillRect(rx, brickY, fullW, wallH);
  ctx.fillStyle = '#963f33';
  for (let row = 0; row < 2; row++) {
    const by = brickY + 1 + row * 6;
    for (let bx = rx + 1 + (row % 2) * 5; bx < worldW; bx += 11) {
      const clipW = Math.min(9, worldW - bx);
      if (clipW > 0) ctx.fillRect(bx, by, clipW, 4);
    }
  }
  // Crisp dark brick base trim & corner edge shadow
  ctx.fillStyle = '#3a1510';
  ctx.fillRect(rx, pr.y2 - 1, rw + 1, 2);
  ctx.fillRect(rx, ry, 2, rh);

  // Flat tar/gravel roof (or packed snow roof on Snow Day!) extending into the right building
  ctx.fillStyle = isSnow ? '#d8e4f2' : '#4a505e';
  ctx.fillRect(rx + 2, ry + 2, fullW - 2, roofH - 2);
  ctx.fillStyle = isSnow ? '#edf4fc' : '#5e6575';
  ctx.fillRect(rx + 4, ry + 4, rw - 4, roofH - 6);

  // Stone roof coping parapet edging along top, left, and bottom lip of the roof
  ctx.fillStyle = isSnow ? '#ffffff' : '#969fae';
  ctx.fillRect(rx, ry, fullW, 2);
  ctx.fillRect(rx, ry, 2, roofH);
  ctx.fillRect(rx, brickY - 2, fullW, 2);
  ctx.fillStyle = '#2d323d';
  ctx.fillRect(rx, brickY, fullW, 1);

  // Small dark frosted utility window on the south brick wall for school-building character
  ctx.fillStyle = '#333b4a';
  ctx.fillRect(rx + 8, brickY + 3, 12, 7);
  ctx.fillStyle = '#182436';
  ctx.fillRect(rx + 9, brickY + 4, 10, 5);
  ctx.fillStyle = '#2e4766';
  ctx.fillRect(rx + 10, brickY + 5, 3, 2);
}

function renderHud(ctx, game) {
  // Authentic 16-bit NHL '94 dark navy broadcast scoreboard bar
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, SCREEN_W, HUD_H);
  ctx.fillStyle = PALETTE.hudBorder;
  ctx.fillRect(0, HUD_H - 2, SCREEN_W, 2);
  ctx.fillStyle = '#253152';
  ctx.fillRect(0, 0, SCREEN_W, 1);

  // Left: HOME TEAM (ROOM 12) + SCORE
  ctx.fillStyle = TEAMS.home.primary;
  ctx.fillRect(4, 3, 56, 16);
  ctx.fillStyle = TEAMS.home.trim;
  ctx.fillRect(4, 17, 56, 2);
  drawPixelText(ctx, TEAMS.home.short, 8, 8, '#ffffff', 1, 'left');
  drawPixelText(ctx, String(game.score.home), 56, 8, '#ffe84d', 1, 'right');

  // Right: AWAY TEAM (ROOM 14) + SCORE
  ctx.fillStyle = TEAMS.away.primary;
  ctx.fillRect(SCREEN_W - 60, 3, 56, 16);
  ctx.fillStyle = TEAMS.away.trim;
  ctx.fillRect(SCREEN_W - 60, 17, 56, 2);
  drawPixelText(ctx, TEAMS.away.short, SCREEN_W - 56, 8, '#ffffff', 1, 'left');
  drawPixelText(ctx, String(game.score.away), SCREEN_W - 8, 8, '#ffe84d', 1, 'right');

  // Center: RECESS PERIOD + CLOCK + ACTIVE PLAYER NAMEPLATE!
  const secs = Math.max(0, Math.ceil(game.clockFrames / 60));
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  const periodShort = game.getCurrentPeriodInfo().short;

  ctx.fillStyle = '#090d18';
  ctx.fillRect(108, 2, 104, 18);
  ctx.strokeStyle = '#3b4a73';
  ctx.strokeRect(108.5, 2.5, 103, 17);
  drawPixelText(ctx, `${periodShort} ${mm}:${ss}`, 160, 4, '#ffe84d', 1, 'center');

  // Show controlled player name & context prompt (or DEMO badge during CPU-vs-CPU!)
  const ctrl = game.getControlledPlayer();
  let statusText = ctrl.name;
  let statusColor = '#9be8ff';
  if (game.isDemo) {
    statusText = game.ball.owner ? `${game.ball.owner.name} (CPU)` : 'DEMO CPU VS CPU';
    statusColor = '#ffe84d';
  } else if (ctrl.role === 'G' && ctrl.holdingBall) {
    statusText = 'THROW! X:PASS Z:BOMB';
    statusColor = '#d9ff2e';
  } else if (ctrl.holdingBall) {
    statusText = 'HOLD! X:DROP Z:KICK';
    statusColor = '#d9ff2e';
  } else if (game.kickCharge >= SHOT.hardMinFrames) {
    statusText = 'HARD SHOT READY!';
    statusColor = '#ff6d2e';
  }
  drawPixelText(ctx, statusText, 160, 13, statusColor, 1, 'center', null);
}

function drawBanner(ctx, title, subtitle, accent) {
  ctx.fillStyle = 'rgba(10, 14, 26, 0.86)';
  ctx.fillRect(34, 92, SCREEN_W - 68, 52);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 93, SCREEN_W - 70, 50);

  drawPixelText(ctx, title, SCREEN_W / 2, 102, accent, 2, 'center');
  drawPixelText(ctx, subtitle, SCREEN_W / 2, 126, '#f4f7ff', 1, 'center');
}

// 16-bit NHL '94 Goal Celebration Banner with live 2x celebrating pixel-art portrait of the scorer on the left!
function renderGoalBanner(ctx, game) {
  const team = TEAMS[game.lastGoalTeam] || TEAMS.home;
  const scorer = game.lastScorer;
  const info = game.lastGoalInfo;
  const scorerName = info?.scorerName || scorer?.name || null;
  const goalCount = info?.goalCount || scorer?.matchStats?.goals || 1;
  const scorerLabel = scorerName
    ? goalCount > 1
      ? `${scorerName} SCORES! (${goalCount} GOALS)`
      : `${scorerName} SCORES!`
    : `${team.name} SCORES!`;
  const assists = info?.assists || [];
  const assistLabel =
    assists.length === 1
      ? `ASSIST: ${assists[0]}`
      : assists.length >= 2
      ? `ASSISTS: ${assists[0]}, ${assists[1]}`
      : 'UNASSISTED';

  const bx = 14;
  const by = 82;
  const bw = SCREEN_W - 28;
  const bh = 72;
  ctx.fillStyle = 'rgba(10, 14, 28, 0.94)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = team.ringColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

  // Left portrait box featuring a 2x pixel-art celebrating sprite of the goal scorer!
  const px = bx + 8;
  const py = by + 8;
  const pw = 46;
  const ph = 56;
  ctx.fillStyle = '#131b32';
  ctx.fillRect(px, py, pw, ph);
  // Subtle team color stripe at top & bottom of portrait frame
  ctx.fillStyle = team.primary;
  ctx.fillRect(px + 1, py + 1, pw - 2, 6);
  ctx.fillRect(px + 1, py + ph - 5, pw - 2, 4);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

  if (scorer) {
    const hop = Math.round(Math.abs(Math.sin(game.tick * 0.22)) * 2);
    const portraitEntity = {
      ...scorer,
      x: 0,
      y: -hop,
      vx: 0,
      vy: 0,
      facingX: 0,
      facingY: 1,
      holdingBall: false,
      windupFrames: 0,
      kickTimer: 0,
      catchAnim: Math.floor(game.tick / 10) % 2 === 0 ? 10 : 0, // Pumping arms in celebration!
      stunTimer: 0,
      diveTimer: 0,
      diveDir: 0,
      jacketTimer: 0,
      gloveTimer: 0,
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 1, py + 1, pw - 2, ph - 2);
    ctx.clip();
    ctx.translate(Math.round(px + pw / 2), Math.round(py + ph - 7));
    ctx.scale(2, 2);
    if (scorer.role === 'G') {
      drawGoalie(ctx, portraitEntity, team, game.tick, game.uniformMode);
    } else {
      drawSkater(ctx, portraitEntity, team, game.tick, game.uniformMode);
    }
    ctx.restore();
  }

  // Right text area: GOAL!! + Scorer (+ multi-goal count) + Assist(s) / Unassisted
  const textCenterX = Math.round((px + pw + 6 + bx + bw - 8) / 2);
  drawPixelText(ctx, 'GOAL!!', textCenterX, by + 11, team.ringColor, 2, 'center');
  drawPixelText(ctx, scorerLabel, textCenterX, by + 35, '#f4f7ff', 1, 'center');
  drawPixelText(
    ctx,
    assistLabel,
    textCenterX,
    by + 51,
    assists.length > 0 ? '#9be8ff' : '#96a5c4',
    1,
    'center',
    null
  );
}

// Classic 16-bit NHL '94 Starting Lineups Card shown at the start of every recess match!
function renderStartingLineups(ctx, game) {
  // Dim playfield slightly behind the lineup card
  ctx.fillStyle = 'rgba(6, 9, 18, 0.62)';
  ctx.fillRect(0, HUD_H, SCREEN_W, VIEW_H);

  const x = 16;
  const y = 32;
  const w = SCREEN_W - 32;
  const h = 186;
  ctx.fillStyle = 'rgba(10, 14, 28, 0.96)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  const pInfo = game.getCurrentPeriodInfo();
  const atk = game.getAttackNet('home');
  drawPixelText(ctx, 'STARTING LINEUPS - 66 BOND', SCREEN_W / 2, y + 8, '#ffe84d', 1, 'center');
  drawPixelText(ctx, `${pInfo.name} - SHOOT AT ${atk.label}`, SCREEN_W / 2, y + 19, '#9be8ff', 1, 'center');

  // Left & right team headers
  const colW = 128;
  const leftX = x + 10;
  const rightX = x + w - 10 - colW;
  ctx.fillStyle = TEAMS.home.primary;
  ctx.fillRect(leftX, y + 32, colW, 14);
  ctx.fillStyle = TEAMS.home.trim;
  ctx.fillRect(leftX, y + 45, colW, 2);
  drawPixelText(ctx, TEAMS.home.name, leftX + colW / 2, y + 36, '#ffffff', 1, 'center');

  ctx.fillStyle = TEAMS.away.primary;
  ctx.fillRect(rightX, y + 32, colW, 14);
  ctx.fillStyle = TEAMS.away.trim;
  ctx.fillRect(rightX, y + 45, colW, 2);
  drawPixelText(ctx, TEAMS.away.name, rightX + colW / 2, y + 36, '#ffffff', 1, 'center');

  // Vertical center divider
  ctx.fillStyle = '#324066';
  ctx.fillRect(SCREEN_W / 2, y + 32, 1, 86);

  const homeRoster = game.players.filter((p) => p.team === 'home');
  const awayRoster = game.players.filter((p) => p.team === 'away');

  for (let i = 0; i < 4; i++) {
    const ry = y + 54 + i * 16;
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(34, 46, 78, 0.40)';
      ctx.fillRect(leftX, ry - 2, colW, 12);
      ctx.fillRect(rightX, ry - 2, colW, 12);
    }
    const hp = homeRoster[i];
    if (hp) {
      const roleCol = hp.role === 'G' ? '#ffd84d' : '#ff9cb2';
      drawPixelText(ctx, hp.role, leftX + 4, ry, roleCol, 1, 'left', null);
      drawPixelText(ctx, hp.name, leftX + 24, ry, '#ffffff', 1, 'left', null);
    }
    const ap = awayRoster[i];
    if (ap) {
      const roleCol = ap.role === 'G' ? '#ffd84d' : '#7ae8ff';
      drawPixelText(ctx, ap.role, rightX + 4, ry, roleCol, 1, 'left', null);
      drawPixelText(ctx, ap.name, rightX + 24, ry, '#ffffff', 1, 'left', null);
    }
  }

  // Undrafted classmates playing corner hoops!
  ctx.fillStyle = '#324066';
  ctx.fillRect(x + 10, y + 123, w - 20, 1);
  const hoopsKids = game.hoopsGames ? game.hoopsGames.flatMap((hg) => hg.kids.map((k) => k.name)) : [];
  if (hoopsKids.length > 0) {
    drawPixelText(ctx, 'CORNER HOOPS (UNDRAFTED):', SCREEN_W / 2, y + 129, '#f58c38', 1, 'center', null);
    const line1 = hoopsKids.slice(0, 3).join(', ');
    const line2 = hoopsKids.slice(3, 6).join(', ');
    drawPixelText(ctx, line1, SCREEN_W / 2, y + 140, '#e3ebfa', 1, 'center', null);
    if (line2) {
      drawPixelText(ctx, line2, SCREEN_W / 2, y + 150, '#e3ebfa', 1, 'center', null);
    }
  }

  // Action prompt at bottom
  if (Math.floor(game.tick / 18) % 2 === 0) {
    const prompt = game.isDemo ? 'DEMO MODE - PRESS ENTER TO PLAY' : 'ENTER/Z: DROP BALL   L: PICK TEAMS';
    drawPixelText(ctx, prompt, SCREEN_W / 2, y + 168, '#d9ff2e', 1, 'center');
  }
}

// Iconic 16-bit EA Sports-style Boot Splash with 360° spinning SMCS Circular Crest
// synced dynamically to sung "Gloria in excelsis Deo!" or "Magnificat" -> deep announcer "IN LUDO EST!"
function renderBootIntro(ctx, game) {
  const f = game.bootFrames;
  const chant = game.bootChant || { spinFrames: 290, voiceFrame: 304, totalFrames: 470 };
  const spinDur = chant.spinFrames;
  const voiceF = chant.voiceFrame;
  const totalF = chant.totalFrames;

  // Classic Genesis sports boot dark cathedral-navy backdrop with subtle gold spotlight
  ctx.fillStyle = '#070a14';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Subtle radial cathedral spotlight blooming behind the spinning crest
  const glowAlpha = Math.min(0.32, (f / 90) * 0.32);
  const grad = ctx.createRadialGradient(160, 96, 8, 160, 96, 128);
  grad.addColorStop(0, `rgba(134, 38, 51, ${(glowAlpha * 1.45).toFixed(2)})`);
  grad.addColorStop(0.55, `rgba(208, 173, 103, ${(glowAlpha * 0.48).toFixed(2)})`);
  grad.addColorStop(1, 'rgba(7, 10, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Phase 1 (frames 0..spinDur): Majestic 2 full 360° spins synced to the chosen chant!
  const t = Math.min(1, f / spinDur);
  // Smooth ease-out curve so the medallion rotates gracefully and locks cleanly on the final note!
  const ease = 1 - Math.pow(1 - t, 2.4);
  const angle = ease * Math.PI * 4; // 2 full 360° rotations!
  const radius = 12 + ease * 36;    // zooms from 12px up to crisp 48px radius (96px diameter!)

  // Phase 2: Bright gold sheen sweeps across the settled crest right at lock-in
  const sheen = f >= spinDur && f <= spinDur + 36 ? (f - spinDur) / 36 : -1;

  drawSpinningSmcsCrest(ctx, SCREEN_W / 2, 92, radius, angle, sheen);

  // Phase 3: Punchy EA Sports-style Latin tagline — "IN LUDO EST!" ("It's in the game!")
  if (f >= voiceF) {
    const a = Math.min(1, (f - voiceF) / 14);
    const slide = Math.round((1 - a) * 10);
    ctx.save();
    ctx.globalAlpha = a;
    drawPixelText(ctx, 'IN LUDO EST!', SCREEN_W / 2, 162 + slide, '#ffffff', 2, 'center');
    ctx.restore();
  }

  // Gold decorative rule sweeping out right under "IN LUDO EST!"
  if (f >= voiceF + 18) {
    const lineW = Math.min(156, (f - (voiceF + 18)) * 10);
    ctx.fillStyle = '#d0ad67';
    ctx.fillRect(Math.round(SCREEN_W / 2 - lineW / 2), 184, lineW, 2);
  }

  // Subtle prompt ONLY if browser autoplay policy muted initial load so user can click to restart with sound
  if (!sound.isAudioUnlocked() && f < totalF - 30) {
    const pulse = Math.floor(f / 20) % 2 === 0 ? '#d0ad67' : '#7b87a8';
    drawPixelText(ctx, 'CLICK FOR SOUND  -  ENTER: SKIP', SCREEN_W / 2, 224, pulse, 1, 'center', null);
  }

  // Smooth fade-out into Title Screen during final 28 frames
  const fadeStart = totalF - 28;
  if (f > fadeStart) {
    const fade = Math.min(1, (f - fadeStart) / 28);
    ctx.fillStyle = `rgba(7, 10, 20, ${fade.toFixed(2)})`;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }
}

function renderTitleScreen(ctx, game) {
  // 16-bit Genesis sports cartridge title screen!
  ctx.fillStyle = '#121933';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Diagonal schoolyard stripes
  ctx.fillStyle = '#1b264d';
  for (let i = -240; i < SCREEN_W + 240; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 14, 0);
    ctx.lineTo(i - 60, SCREEN_H);
    ctx.lineTo(i - 74, SCREEN_H);
    ctx.closePath();
    ctx.fill();
  }

  // Vintage gold/red NHL '94-style marquee panel
  ctx.fillStyle = '#0a0f21';
  ctx.fillRect(18, 20, SCREEN_W - 36, 66);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  ctx.strokeRect(19, 21, SCREEN_W - 38, 64);

  drawPixelText(ctx, 'FOOT HOCKEY 98', SCREEN_W / 2, 36, '#ffe84d', 2, 'center');
  drawPixelText(ctx, `COURT: ${game.court.name}  -  16-BIT ARCADE`, SCREEN_W / 2, 64, '#48b8ff', 1, 'center');

  // Showcase animated sprite preview: Skater + Tennis Ball + Jacket/Glove Goalie!
  const previewY = 148;
  ctx.fillStyle = PALETTE.asphaltMid;
  ctx.fillRect(36, 114, SCREEN_W - 72, 54);
  ctx.strokeStyle = PALETTE.chalk;
  ctx.lineWidth = 1;
  ctx.strokeRect(36.5, 114.5, SCREEN_W - 73, 53);

  const demoSkater = {
    ...TEAMS.home.players[0],
    x: 96,
    y: previewY,
    vx: 1,
    vy: 0,
    facingX: 1,
    facingY: 0,
    animOffset: 0,
    holdingBall: Math.floor(game.tick / 70) % 2 === 1,
    kickTimer: 0,
    catchAnim: 0,
  };
  drawStarRing(ctx, demoSkater.x, demoSkater.y, TEAMS.home.ringColor, game.tick, demoSkater.holdingBall, 0.7);
  drawSkater(ctx, demoSkater, TEAMS.home, game.tick, game.uniformMode);

  // Bouncing neon tennis ball in center
  const demoBounce = Math.abs(Math.sin(game.tick * 0.1)) * 14;
  drawTennisBall(ctx, { x: 160, y: previewY - 2, z: demoBounce, vx: 1.5, vy: 0 }, game.tick);

  // Goalie with puffy jacket + leather baseball glove!
  const demoGoalie = {
    ...TEAMS.away.players[3],
    team: 'away',
    x: 224,
    y: previewY,
    diveTimer: 0,
    diveDir: 0,
    jacketTimer: Math.floor(game.tick / 50) % 2 === 0 ? 10 : 0,
    gloveTimer: Math.floor(game.tick / 50) % 2 === 1 ? 10 : 0,
    holdingBall: false,
  };
  drawGoalie(ctx, demoGoalie, TEAMS.away, game.tick, game.uniformMode);

  drawPixelText(ctx, 'KICK + CATCH & DROP', 96, 158, '#9be8ff', 1, 'center', null);
  drawPixelText(ctx, 'JACKET + GLOVE!', 224, 158, '#ffd84d', 1, 'center', null);

  // Clean 16-bit Genesis sports Title Menu (PLAY RECESS / PICK TEAMS / OPTIONS / DEMO MODE)
  const items = [
    { label: 'PLAY RECESS', hint: '' },
    { label: 'PICK TEAMS', hint: '(L)' },
    { label: 'OPTIONS', hint: '(O)' },
    { label: 'DEMO MODE', hint: '(D)' },
  ];
  for (let i = 0; i < items.length; i++) {
    const iy = 172 + i * 12;
    const selected = (game.titleCursor || 0) === i;
    if (selected) {
      ctx.fillStyle = 'rgba(255, 216, 77, 0.16)';
      ctx.fillRect(88, iy - 2, 144, 10);
      drawPixelText(ctx, '>', 96, iy, '#ffe84d', 1, 'left', null);
    }
    const text = items[i].hint ? `${items[i].label} ${items[i].hint}` : items[i].label;
    drawPixelText(ctx, text, SCREEN_W / 2, iy, selected ? '#d9ff2e' : '#cfd9ef', 1, 'center');
  }

  // Subtle bottom shortcut strip
  const padReady = game.gamepadName ? 'PAD READY  ' : '';
  drawPixelText(ctx, `${padReady}ENTER/Z:SELECT   I:REPLAY INTRO`, SCREEN_W / 2, 224, '#7fa3d9', 1, 'center', null);
}

// 16-Bit NHL '94 Recess Team Draft / Roster Selector with live scouting bars & pixel preview!
function renderTeamSelectScreen(ctx, game) {
  ctx.fillStyle = '#121933';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  ctx.fillStyle = '#192347';
  for (let i = -240; i < SCREEN_W + 240; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 14, 0);
    ctx.lineTo(i - 66, SCREEN_H);
    ctx.lineTo(i - 80, SCREEN_H);
    ctx.closePath();
    ctx.fill();
  }

  const x = 12;
  const y = 10;
  const w = SCREEN_W - 24;
  const h = 220;
  ctx.fillStyle = 'rgba(10, 14, 28, 0.96)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  drawPixelText(ctx, 'PICK TEAMS - 66 BOND RECESS', SCREEN_W / 2, y + 8, '#ffe84d', 1, 'center');

  const roles = ['C', 'LW', 'RW', 'G'];
  const slots = game.draftSlots && game.draftSlots.length === 8 ? game.draftSlots : [];
  const cursor = game.draftCursor || 0;

  const colW = 132;
  const leftX = x + 10;
  const rightX = x + w - 10 - colW;

  // Team banners
  ctx.fillStyle = TEAMS.home.primary;
  ctx.fillRect(leftX, y + 22, colW, 13);
  ctx.fillStyle = TEAMS.home.trim;
  ctx.fillRect(leftX, y + 34, colW, 2);
  drawPixelText(ctx, TEAMS.home.name, leftX + colW / 2, y + 25, '#ffffff', 1, 'center');

  ctx.fillStyle = TEAMS.away.primary;
  ctx.fillRect(rightX, y + 22, colW, 13);
  ctx.fillStyle = TEAMS.away.trim;
  ctx.fillRect(rightX, y + 34, colW, 2);
  drawPixelText(ctx, TEAMS.away.name, rightX + colW / 2, y + 25, '#ffffff', 1, 'center');

  // 4 HOME slots (0..3) and 4 AWAY slots (4..7)
  for (let i = 0; i < 4; i++) {
    const ry = y + 42 + i * 19;
    const drawSlot = (slotIdx, sx, roleColor) => {
      const selected = cursor === slotIdx;
      const name = slots[slotIdx] || '---';
      ctx.fillStyle = selected ? 'rgba(56, 86, 156, 0.65)' : i % 2 === 0 ? 'rgba(34, 46, 78, 0.36)' : 'rgba(18, 25, 44, 0.36)';
      ctx.fillRect(sx, ry - 2, colW, 14);
      if (selected) {
        ctx.strokeStyle = '#ffd84d';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, ry - 1.5, colW - 1, 13);
      }
      const rCol = i === 3 ? '#ffd84d' : roleColor;
      drawPixelText(ctx, roles[i], sx + 4, ry + 1, rCol, 1, 'left', null);
      const label = selected ? `<${name}>` : name;
      drawPixelText(ctx, label, sx + 22, ry + 1, selected ? '#d9ff2e' : '#ffffff', 1, 'left', null);
    };
    drawSlot(i, leftX, '#ff9cb2');
    drawSlot(i + 4, rightX, '#7ae8ff');
  }

  // === LIVE SCOUTING CARD FOR HIGHLIGHTED CLASSMATE ===
  ctx.fillStyle = '#324066';
  ctx.fillRect(x + 10, y + 120, w - 20, 1);

  const selectedName = slots[cursor];
  const mate = CLASSMATES.find((c) => c.name === selectedName) || CLASSMATES[0];
  const isHomeSlot = cursor < 4;
  const isGoalieSlot = cursor % 4 === 3;
  const previewTeam = isHomeSlot ? TEAMS.home : TEAMS.away;

  // Mini live sprite preview on the left of the scouting box
  const px = x + 30;
  const py = y + 158;
  ctx.fillStyle = 'rgba(26, 36, 62, 0.65)';
  ctx.fillRect(x + 12, y + 126, 36, 44);
  ctx.strokeStyle = '#3b4f80';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 12.5, y + 126.5, 35, 43);

  const previewEntity = {
    ...mate,
    team: isHomeSlot ? 'home' : 'away',
    wearsJacket: !isHomeSlot,
    coatColor: !isHomeSlot ? '#1f78d1' : null,
    coatTrim: !isHomeSlot ? '#124b8a' : null,
    jacketColor: '#22a05b',
    jacketTrim: '#146638',
    x: px,
    y: py,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: 1,
    animOffset: 0,
    holdingBall: false,
    kickTimer: 0,
    catchAnim: 0,
    diveTimer: 0,
    diveDir: 0,
    jacketTimer: 0,
    gloveTimer: 0,
  };
  if (isGoalieSlot) {
    drawGoalie(ctx, previewEntity, previewTeam, game.tick, game.uniformMode);
  } else {
    drawSkater(ctx, previewEntity, previewTeam, game.tick, game.uniformMode);
  }

  // Scout header & 6 normalized NHL '94 rating bars!
  const scoutTitle =
    mate.preferredRole === 'G'
      ? `${mate.name} (NATURAL GOALIE)`
      : mate.preferredRole === 'HOOPS'
      ? `${mate.name} (HOOPS REGULAR)`
      : mate.name;
  drawPixelText(ctx, scoutTitle, x + 56, y + 127, '#ffe84d', 1, 'left', null);

  const s = mate.stats;
  const barSpecs = [
    ['SPD', (s.speed - 1.15) / 0.97],
    ['KCK', (s.kick - 3.0) / 2.9],
    ['CTL', (s.control - 0.30) / 0.70],
    ['HND', (s.hands - 0.30) / 0.70],
    ['RFX', (s.reflex - 0.30) / 0.70],
    ['CHK', ((s.checking ?? 0.8) - 0.30) / 0.70],
  ];
  for (let i = 0; i < barSpecs.length; i++) {
    const [lbl, rawPct] = barSpecs[i];
    const pct = Math.max(0.08, Math.min(1, rawPct));
    const col = i < 3 ? 0 : 1;
    const row = i % 3;
    const bx = x + 56 + col * 116;
    const by = y + 140 + row * 12;
    drawPixelText(ctx, lbl, bx, by, '#9be8ff', 1, 'left', null);
    ctx.fillStyle = '#19223a';
    ctx.fillRect(bx + 24, by + 1, 78, 5);
    const fillCol = pct >= 0.82 ? '#6ef0a4' : pct >= 0.58 ? '#ffe84d' : '#ff5e5e';
    ctx.fillStyle = fillCol;
    ctx.fillRect(bx + 24, by + 1, Math.round(78 * pct), 5);
  }

  // Controls footer
  ctx.fillStyle = '#324066';
  ctx.fillRect(x + 10, y + 180, w - 20, 1);
  drawPixelText(ctx, 'UP/DN:SLOT  </>:PLAYER  TAB:SIDE  R:RAND', SCREEN_W / 2, y + 187, '#9be8ff', 1, 'center', null);
  if (Math.floor(game.tick / 20) % 2 === 0) {
    drawPixelText(ctx, 'ENTER / Z: START MATCH   ESC: BACK', SCREEN_W / 2, y + 202, '#d9ff2e', 1, 'center', null);
  }
}

// Dedicated 16-bit NHL '94 OPTIONS Screen organizing all 7 game toggles cleanly!
function renderOptionsScreen(ctx, game) {
  ctx.fillStyle = '#121933';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Subtle schoolyard diagonal stripes matching Title Screen
  ctx.fillStyle = '#192347';
  for (let i = -240; i < SCREEN_W + 240; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 14, 0);
    ctx.lineTo(i - 66, SCREEN_H);
    ctx.lineTo(i - 80, SCREEN_H);
    ctx.closePath();
    ctx.fill();
  }

  const x = 22;
  const y = 16;
  const w = SCREEN_W - 44;
  const h = 208;
  ctx.fillStyle = 'rgba(10, 14, 28, 0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  drawPixelText(ctx, 'FOOT HOCKEY 98 - OPTIONS', SCREEN_W / 2, y + 10, '#ffe84d', 1, 'center');
  ctx.fillStyle = '#324066';
  ctx.fillRect(x + 12, y + 23, w - 24, 1);

  const rows = [
    {
      label: 'UNIFORMS',
      value: game.uniformMode === 'dress' ? 'DRESS BLAZER' : 'DEFAULT',
      color: '#ffd84d',
    },
    {
      label: 'WEATHER',
      value: game.weather === 'snow' ? 'SNOW' : 'CLEAR',
      color: game.weather === 'snow' ? '#9be8ff' : '#e3ebfa',
    },
    {
      label: 'LUNCH CAMERA',
      value: game.rotateLunchView ? 'ROTATE UP' : 'FIXED COURT',
      color: '#d9ff2e',
    },
    {
      label: 'MUSIC TRACK',
      value: sound.getMusicTrack().label,
      color: '#9be8ff',
    },
    {
      label: 'MUSIC BGM',
      value: sound.music.enabled ? 'ON' : 'OFF',
      color: sound.music.enabled ? '#6ef0a4' : '#ff7090',
    },
    {
      label: 'ALL AUDIO',
      value: sound.muted ? 'MUTED' : 'ON',
      color: sound.muted ? '#ff7090' : '#6ef0a4',
    },
    {
      label: 'CRT SCANLINES',
      value: game.crtEnabled ? 'ON' : 'OFF',
      color: game.crtEnabled ? '#6ef0a4' : '#96a5c4',
    },
    {
      label: 'BACK TO TITLE',
      value: '',
      color: '#ffe84d',
    },
  ];

  const cursor = game.optionsCursor || 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ry = y + 32 + i * 19;
    const selected = cursor === i;
    if (selected) {
      ctx.fillStyle = 'rgba(56, 86, 156, 0.55)';
      ctx.fillRect(x + 10, ry - 3, w - 20, 14);
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 10.5, ry - 2.5, w - 21, 13);
      drawPixelText(ctx, '>', x + 15, ry + 1, '#ffe84d', 1, 'left', null);
    }

    if (r.value) {
      drawPixelText(ctx, r.label, x + 26, ry + 1, selected ? '#ffffff' : '#b4c2e0', 1, 'left', null);
      const valDisplay = selected ? `< ${r.value} >` : r.value;
      drawPixelText(ctx, valDisplay, x + w - 16, ry + 1, r.color, 1, 'right', null);
    } else {
      drawPixelText(ctx, r.label, SCREEN_W / 2, ry + 1, selected ? '#d9ff2e' : '#ffe84d', 1, 'center', null);
    }
  }

  ctx.fillStyle = '#324066';
  ctx.fillRect(x + 12, y + 186, w - 24, 1);
  drawPixelText(ctx, 'UP/DN:MOVE  </>/Z:CHANGE  ESC:BACK', SCREEN_W / 2, y + 193, '#9be8ff', 1, 'center', null);
}

function formatScorerSummary(goalLog) {
  if (!goalLog || goalLog.length === 0) return 'NO GOALS YET';
  const counts = new Map();
  for (const g of goalLog) {
    const key = g.name;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const parts = [];
  for (const [label, count] of counts.entries()) {
    parts.push(count > 1 ? `${label} (${count})` : label);
  }
  const full = parts.join(', ');
  return full.length > 34 ? full.slice(0, 33) + '.' : full;
}

// Shared 16-bit NHL '94-style Match Stats modal (TEAM STATS + PLAYER STATS pages on PAUSE and FINAL!)
function renderStatsModal(ctx, game, { isFinal }) {
  // Dim playfield behind modal
  ctx.fillStyle = 'rgba(6, 9, 18, 0.72)';
  ctx.fillRect(0, HUD_H, SCREEN_W, VIEW_H);

  // Outer 16-bit scoreboard panel
  const x = 18;
  const y = 26;
  const w = SCREEN_W - 36;
  const h = 206;
  ctx.fillStyle = 'rgba(10, 14, 28, 0.96)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = isFinal ? '#ffd84d' : '#48b8ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // Top title header
  const secs = Math.max(0, Math.ceil(game.clockFrames / 60));
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  const periodName = game.getCurrentPeriodInfo().name;

  if (isFinal) {
    const verdict =
      game.score.home > game.score.away
        ? `${TEAMS.home.name} WINS RECESS!`
        : game.score.away > game.score.home
        ? `${TEAMS.away.name} WINS RECESS!`
        : 'RECESS TIE GAME!';
    drawPixelText(ctx, 'ITE, LUDUS FINITUS EST', SCREEN_W / 2, y + 6, '#ffe84d', 1, 'center');
    drawPixelText(ctx, verdict, SCREEN_W / 2, y + 16, '#48b8ff', 1, 'center');
  } else {
    drawPixelText(ctx, 'PAUSED - STATS TO DATE', SCREEN_W / 2, y + 6, '#ffe84d', 1, 'center');
    drawPixelText(ctx, `${periodName}  ${mm}:${ss} LEFT`, SCREEN_W / 2, y + 16, '#9be8ff', 1, 'center');
  }

  // 3-Page switcher tabs: TEAM  |  PLAYERS  |  SUMMARY
  const page = game.statsPage || 'team';
  const tabY = y + 26;
  const tabW = 84;
  const tabH = 12;
  const tabs = [
    { id: 'team', label: 'TEAM', tx: x + 10 },
    { id: 'players', label: 'PLAYERS', tx: x + 100 },
    { id: 'summary', label: 'SUMMARY', tx: x + 190 },
  ];
  ctx.lineWidth = 1;
  for (const t of tabs) {
    const active = page === t.id;
    ctx.fillStyle = active ? '#243563' : '#11182c';
    ctx.fillRect(t.tx, tabY, tabW, tabH);
    ctx.strokeStyle = active ? '#ffd84d' : '#324066';
    ctx.strokeRect(t.tx + 0.5, tabY + 0.5, tabW - 1, tabH - 1);
    drawPixelText(ctx, t.label, t.tx + tabW / 2, tabY + 3, active ? '#ffe84d' : '#7f90b5', 1, 'center', null);
  }

  if (page === 'summary') {
    // === PAGE 3: NHL-STYLE GAME SUMMARY (PERIOD LINESCORE, SHOTS/PERIOD & SCORING LOG!) ===
    const ty = y + 43;

    // Left table: GOALS BY PERIOD (1, 2, 3, T)
    drawPixelText(ctx, 'GOALS', x + 10, ty, '#ffe84d', 1, 'left', null);
    drawPixelText(ctx, '1', x + 58, ty, '#8fa1c7', 1, 'center', null);
    drawPixelText(ctx, '2', x + 78, ty, '#8fa1c7', 1, 'center', null);
    drawPixelText(ctx, '3', x + 98, ty, '#8fa1c7', 1, 'center', null);
    drawPixelText(ctx, 'T', x + 120, ty, '#ffe84d', 1, 'center', null);

    // Center divider between Goals & Shots tables
    ctx.fillStyle = '#324066';
    ctx.fillRect(x + 141, ty - 1, 1, 35);

    // Right table: SHOTS BY PERIOD (1, 2, 3, T)
    drawPixelText(ctx, 'SHOTS', x + 148, ty, '#9be8ff', 1, 'left', null);
    drawPixelText(ctx, '1', x + 196, ty, '#8fa1c7', 1, 'center', null);
    drawPixelText(ctx, '2', x + 216, ty, '#8fa1c7', 1, 'center', null);
    drawPixelText(ctx, '3', x + 236, ty, '#8fa1c7', 1, 'center', null);
    drawPixelText(ctx, 'T', x + 258, ty, '#9be8ff', 1, 'center', null);

    const teamRows = [
      { key: 'home', color: '#ff9cb2', rowY: ty + 12 },
      { key: 'away', color: '#7ae8ff', rowY: ty + 24 },
    ];
    for (let r = 0; r < teamRows.length; r++) {
      const tr = teamRows[r];
      const st = game.stats[tr.key];
      const pg = st.periodGoals || [0, 0, 0];
      const ps = st.periodShots || [0, 0, 0];
      if (r === 0) {
        ctx.fillStyle = 'rgba(34, 46, 78, 0.38)';
        ctx.fillRect(x + 8, tr.rowY - 2, w - 16, 10);
      }
      drawPixelText(ctx, TEAMS[tr.key].short, x + 10, tr.rowY, tr.color, 1, 'left', null);
      drawPixelText(ctx, String(pg[0]), x + 58, tr.rowY, '#ffffff', 1, 'center', null);
      drawPixelText(ctx, String(pg[1]), x + 78, tr.rowY, game.period >= 2 ? '#ffffff' : '#556380', 1, 'center', null);
      drawPixelText(ctx, String(pg[2]), x + 98, tr.rowY, game.period >= 3 ? '#ffffff' : '#556380', 1, 'center', null);
      drawPixelText(ctx, String(game.score[tr.key]), x + 120, tr.rowY, '#ffe84d', 1, 'center', null);

      drawPixelText(ctx, TEAMS[tr.key].short, x + 148, tr.rowY, tr.color, 1, 'left', null);
      drawPixelText(ctx, String(ps[0]), x + 196, tr.rowY, '#ffffff', 1, 'center', null);
      drawPixelText(ctx, String(ps[1]), x + 216, tr.rowY, game.period >= 2 ? '#ffffff' : '#556380', 1, 'center', null);
      drawPixelText(ctx, String(ps[2]), x + 236, tr.rowY, game.period >= 3 ? '#ffffff' : '#556380', 1, 'center', null);
      drawPixelText(ctx, String(st.shots), x + 258, tr.rowY, '#9be8ff', 1, 'center', null);
    }

    // Divider before Scoring Summary log
    ctx.fillStyle = '#324066';
    ctx.fillRect(x + 8, y + 81, w - 16, 1);

    const goals = game.goalLog || [];
    const maxVisible = 7;
    const scroll = Math.max(0, Math.min(Math.max(0, goals.length - maxVisible), game.summaryScroll || 0));
    const headerTitle =
      goals.length > maxVisible
        ? `SCORING SUMMARY (${scroll + 1}-${Math.min(goals.length, scroll + maxVisible)}/${goals.length} UP/DN)`
        : 'SCORING SUMMARY';
    drawPixelText(ctx, headerTitle, x + 10, y + 86, '#ffe84d', 1, 'left', null);

    if (goals.length === 0) {
      drawPixelText(ctx, 'NO GOALS SCORED YET', SCREEN_W / 2, y + 124, '#7f90b5', 1, 'center', null);
    } else {
      const visible = goals.slice(scroll, scroll + maxVisible);
      for (let i = 0; i < visible.length; i++) {
        const g = visible[i];
        const gy = y + 98 + i * 12;
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(34, 46, 78, 0.36)';
          ctx.fillRect(x + 8, gy - 1, w - 16, 10);
        }
        const tag = g.team === 'home' ? 'H' : 'A';
        const tagCol = g.team === 'home' ? '#ff7090' : '#48c6ff';
        const timeText = `P${g.period} ${g.time || '0:00'}`;
        drawPixelText(ctx, timeText, x + 10, gy, '#9be8ff', 1, 'left', null);
        drawPixelText(ctx, tag, x + 56, gy, tagCol, 1, 'left', null);

        const assistList = Array.isArray(g.assists) && g.assists.length > 0 ? g.assists.join(', ') : 'UNASSISTED';
        const detail = `${g.name} (${assistList})`;
        const trimmed = detail.length > 34 ? detail.slice(0, 33) + '.' : detail;
        drawPixelText(ctx, trimmed, x + 66, gy, '#ffffff', 1, 'left', null);
      }
    }
  } else if (page === 'players') {
    // === PAGE 2: INDIVIDUAL PLAYER BOX SCORE (G, A, SOG, PAS, CAT, CHK — plus SV for goalies only!) ===
    const colRole = x + 10;
    const colName = x + 26;
    const colG = x + 128;
    const colA = x + 150;
    const colSog = x + 176;
    const colPas = x + 204;
    const colCat = x + 232;
    const colChk = x + 260;

    // Column headers
    const hy = y + 43;
    drawPixelText(ctx, 'PLAYER', colName, hy, '#8fa1c7', 1, 'left', null);
    drawPixelText(ctx, 'G', colG, hy, '#ffe84d', 1, 'center', null);
    drawPixelText(ctx, 'A', colA, hy, '#ffd06b', 1, 'center', null);
    drawPixelText(ctx, 'SOG', colSog, hy, '#ffffff', 1, 'center', null);
    drawPixelText(ctx, 'PAS', colPas, hy, '#9be8ff', 1, 'center', null);
    drawPixelText(ctx, 'CAT', colCat, hy, '#d9ff2e', 1, 'center', null);
    drawPixelText(ctx, 'CHK', colChk, hy, '#ff8c42', 1, 'center', null);

    const drawTeamBlock = (teamKey, startY) => {
      const team = TEAMS[teamKey];
      ctx.fillStyle = team.primary;
      ctx.fillRect(x + 8, startY, w - 16, 10);
      drawPixelText(ctx, `${team.name} (${game.score[teamKey]})`, x + 12, startY + 2, '#ffffff', 1, 'left', null);

      const list = game.players.filter((p) => p.team === teamKey);
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const ms = p.matchStats || { goals: 0, assists: 0, shots: 0, passes: 0, catches: 0, checks: 0, saves: 0 };
        const ry = startY + 12 + i * 12;
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(34, 46, 78, 0.36)';
          ctx.fillRect(x + 8, ry - 1, w - 16, 10);
        }
        const roleCol = p.role === 'G' ? '#ffd84d' : teamKey === 'home' ? '#ff9cb2' : '#7ae8ff';
        drawPixelText(ctx, p.role, colRole, ry, roleCol, 1, 'left', null);
        drawPixelText(ctx, p.name, colName, ry, '#ffffff', 1, 'left', null);
        drawPixelText(ctx, String(ms.goals), colG, ry, ms.goals > 0 ? '#ffe84d' : '#96a5c4', 1, 'center', null);
        drawPixelText(ctx, String(ms.assists), colA, ry, ms.assists > 0 ? '#ffd06b' : '#96a5c4', 1, 'center', null);
        drawPixelText(ctx, String(ms.shots), colSog, ry, '#e3ebfa', 1, 'center', null);
        drawPixelText(ctx, String(ms.passes), colPas, ry, '#9be8ff', 1, 'center', null);
        if (p.role === 'G') {
          // Goalies show SV right on their row instead of CAT/CHK!
          drawPixelText(ctx, `SV:${ms.saves}`, Math.round((colCat + colChk) / 2), ry, '#6ef0a4', 1, 'center', null);
        } else {
          drawPixelText(ctx, String(ms.catches), colCat, ry, '#d9ff2e', 1, 'center', null);
          drawPixelText(ctx, String(ms.checks), colChk, ry, '#ff8c42', 1, 'center', null);
        }
      }
    };

    drawTeamBlock('home', y + 54);
    drawTeamBlock('away', y + 116);
  } else {
    // === PAGE 1: TEAM STATS ===
    ctx.fillStyle = TEAMS.home.primary;
    ctx.fillRect(x + 10, y + 43, 84, 16);
    ctx.fillStyle = TEAMS.away.primary;
    ctx.fillRect(x + w - 94, y + 43, 84, 16);
    drawPixelText(ctx, TEAMS.home.name, x + 52, y + 48, '#ffffff', 1, 'center');
    drawPixelText(ctx, TEAMS.away.name, x + w - 52, y + 48, '#ffffff', 1, 'center');
    drawPixelText(ctx, `${game.score.home} - ${game.score.away}`, SCREEN_W / 2, y + 44, '#ffe84d', 2, 'center');

    // Divider line
    ctx.fillStyle = '#324066';
    ctx.fillRect(x + 10, y + 63, w - 20, 1);

    // Possession percentages
    const totalPoss = game.stats.home.possessionFrames + game.stats.away.possessionFrames;
    const homePossPct = totalPoss > 0 ? Math.round((game.stats.home.possessionFrames / totalPoss) * 100) : 50;
    const awayPossPct = totalPoss > 0 ? 100 - homePossPct : 50;

    const rows = [
      ['SHOTS', String(game.stats.home.shots), String(game.stats.away.shots), '#ffffff'],
      ['PASSES', String(game.stats.home.passes), String(game.stats.away.passes), '#9be8ff'],
      ['CATCHES', String(game.stats.home.catches), String(game.stats.away.catches), '#d9ff2e'],
      ['STEAL/CHK', `${game.stats.home.steals}/${game.stats.home.checks}`, `${game.stats.away.steals}/${game.stats.away.checks}`, '#ff8c42'],
      ['GLOVE SAVES', String(game.stats.home.gloveSaves), String(game.stats.away.gloveSaves), '#ffd84d'],
      ['JACKET BLOCKS', String(game.stats.home.jacketBlocks), String(game.stats.away.jacketBlocks), '#6ef0a4'],
      ['POSSESSION', `${homePossPct}%`, `${awayPossPct}%`, '#ffffff'],
    ];

    let ry = y + 69;
    for (let i = 0; i < rows.length; i++) {
      const [label, hVal, aVal, color] = rows[i];
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(34, 46, 78, 0.42)';
        ctx.fillRect(x + 10, ry - 2, w - 20, 11);
      }
      drawPixelText(ctx, hVal, x + 52, ry, color, 1, 'center');
      drawPixelText(ctx, label, SCREEN_W / 2, ry, '#8fa1c7', 1, 'center');
      drawPixelText(ctx, aVal, x + w - 52, ry, color, 1, 'center');
      ry += 13;
    }

    // Goal scorers strip
    ctx.fillStyle = '#324066';
    ctx.fillRect(x + 10, y + 162, w - 20, 1);
    drawPixelText(ctx, `GOALS: ${formatScorerSummary(game.goalLog)}`, SCREEN_W / 2, y + 168, '#ffe84d', 1, 'center', null);
  }

  // Action prompts at bottom
  if (isFinal) {
    if (game.isDemo) {
      if (Math.floor(game.tick / 22) % 2 === 0) {
        drawPixelText(ctx, 'DEMO FINAL - ENTER:PLAY   ESC:TITLE', SCREEN_W / 2, y + 189, '#ffe84d', 1, 'center');
      }
    } else {
      const lockRemaining = MATCH.gameOverLockFrames - (game.stateTimer || 0);
      if (lockRemaining > 0) {
        const remSec = Math.max(1, Math.ceil(lockRemaining / 60));
        drawPixelText(ctx, `</>:BROWSE STATS   CONTINUE IN ${remSec}S`, SCREEN_W / 2, y + 189, '#9be8ff', 1, 'center');
      } else if (Math.floor(game.tick / 22) % 2 === 0) {
        drawPixelText(ctx, '</>:PAGE  ENTER/Z:REMATCH  Q/ESC:TITLE', SCREEN_W / 2, y + 189, '#d9ff2e', 1, 'center');
      }
    }
  } else {
    drawPixelText(ctx, '</>:PAGE  P:RESUME  R:RESTART  Q:TITLE', SCREEN_W / 2, y + 189, '#d9ff2e', 1, 'center');
  }
}
