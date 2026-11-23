import { HUD_H, PALETTE, PHYSICS, RECESS_PERIODS, SCREEN_H, SCREEN_W, SHOT, VIEW_H } from './constants.js';
import { DEFAULT_COURT } from './courts.js';
import { TEAMS } from './roster.js';
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

  // === PLAYFIELD VIEWPORT ===
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, HUD_H, SCREEN_W, VIEW_H);
  ctx.clip();

  const shakeX = game.screenShake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
  const shakeY = game.screenShake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
  ctx.translate(-Math.round(game.cameraX) + shakeX, HUD_H - Math.round(game.cameraY) + shakeY);

  drawSchoolyard(ctx, game);

  // Depth-sort skaters, goalies, and ball by Y coordinate for authentic 3/4 perspective!
  const drawables = [];
  for (const p of game.players) {
    drawables.push({
      y: p.y,
      draw: () => {
        const team = TEAMS[p.team];
        if (!game.isDemo && p.id === game.controlledId) {
          const holdRatio = p.holdingBall
            ? p.role === 'G'
              ? Math.max(0, 1 - p.holdFrames / PHYSICS.goalieMaxHoldFrames)
              : Math.max(0, 1 - Math.max(p.holdFrames / PHYSICS.maxHoldFrames, p.holdDist / PHYSICS.maxHoldSteps))
            : 0;
          drawStarRing(ctx, p.x, p.y, team.ringColor, game.tick, p.holdingBall, holdRatio);
        } else if (game.ball.owner?.id === p.id) {
          drawStarRing(ctx, p.x, p.y, team.ringColor, game.tick, p.holdingBall, 0);
        }

        if (p.role === 'G') {
          drawGoalie(ctx, p, team, game.tick, game.uniformMode);
        } else {
          drawSkater(ctx, p, team, game.tick, game.uniformMode);
        }

        // Deliberate pass / goalie-throw receiver chevron on highlighted teammate!
        if (game.passTarget && game.passTarget.id === p.id) {
          const ctrl = game.getControlledPlayer();
          drawPassTargetMarker(ctx, p, game.tick, ctrl.role === 'G');
        }

        // Two-tier Quick Shot / Hard Shot (Slap-Kick) charge meter under active skater
        if (p.id === game.controlledId && game.kickCharge > 2) {
          const isHard = game.kickCharge >= SHOT.hardMinFrames;
          const pct = Math.min(1, game.kickCharge / SHOT.hardFullFrames);
          const w = Math.round(pct * 22);
          ctx.fillStyle = '#12151f';
          ctx.fillRect(Math.round(p.x - 12), Math.round(p.y + 7), 24, 5);
          // Threshold notch marking where Quick Shot transitions to Hard Shot!
          const notchX = Math.round(p.x - 11 + (SHOT.hardMinFrames / SHOT.hardFullFrames) * 22);
          ctx.fillStyle = isHard ? '#ff5238' : '#ffe84d';
          ctx.fillRect(Math.round(p.x - 11), Math.round(p.y + 8), w, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(notchX, Math.round(p.y + 7), 1, 5);
        }
      },
    });
  }

  // Only draw independent tennis ball when not clutched inside a player's hands
  if (!(game.ball.owner && game.ball.owner.holdingBall)) {
    drawables.push({
      y: game.ball.y + 0.5,
      draw: () => drawTennisBall(ctx, game.ball, game.tick),
    });
  }

  // Depth-sort both live corner basketball games (top-left & lower-left) right in play!
  if (game.hoopsGames) {
    for (const h of game.hoopsGames) {
      for (const k of h.kids) {
        drawables.push({
          y: k.y,
          draw: () => drawSkater(ctx, k, HOOPS_TEAM_STYLE, game.tick, game.uniformMode),
        });
      }
      drawables.push({
        y: h.bball.y + 0.5,
        draw: () => drawBasketball(ctx, h.bball),
      });
    }
  }

  // Depth-sort the chubby kid sitting at the foot of the bottom-right stairs!
  if (game.court.cornerStairs) {
    const cs = game.court.cornerStairs;
    drawables.push({
      y: cs.kidY,
      draw: () => drawSeatedStairsKid(ctx, cs.kidX, cs.kidY, game.tick, game.uniformMode, game.ball.x),
    });
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const item of drawables) item.draw();

  // Particles
  for (const pt of game.particles) {
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
  }

  // Arcade callouts ("CAUGHT!", "GLOVE SAVE!", "JACKET BLOCK!", "BOARDED!", "HOOPS!")
  for (const c of game.callouts) {
    drawPixelText(ctx, c.text, c.x, c.y, c.color, 1, 'center', '#0c0f1a');
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
    const sx = game.passTarget.x - game.cameraX;
    const sy = HUD_H + (game.passTarget.y - game.cameraY);
    if (sx < 8 || sx > SCREEN_W - 8 || sy < HUD_H + 8 || sy > SCREEN_H - 8) {
      const ax = Math.max(36, Math.min(SCREEN_W - 36, Math.round(sx)));
      const ay = Math.max(HUD_H + 10, Math.min(SCREEN_H - 12, Math.round(sy)));
      const ctrl = game.getControlledPlayer();
      const col = ctrl.role === 'G' ? '#d9ff2e' : '#7ae8ff';
      ctx.fillStyle = 'rgba(10, 14, 26, 0.84)';
      ctx.fillRect(ax - 28, ay - 6, 56, 12);
      drawPixelText(ctx, `${game.passTarget.name} #${game.passTarget.number}`, ax, ay - 3, col, 1, 'center', null);
    }
  }

  // 2) Off-screen Attack Net indicator so you always know where to shoot on 66 Bond!
  if (!game.isDemo && (game.state === 'PLAYING' || game.state === 'RESTART')) {
    const atk = game.getAttackNet('home');
    const nx = atk.centerX - game.cameraX;
    const ny = HUD_H + (atk.centerY - game.cameraY);
    const offscreen = nx < 10 || nx > SCREEN_W - 10 || ny < HUD_H + 10 || ny > SCREEN_H - 10;
    if (offscreen) {
      const ix = Math.max(40, Math.min(SCREEN_W - 40, Math.round(nx)));
      const iy = Math.max(HUD_H + 10, Math.min(SCREEN_H - 12, Math.round(ny)));
      ctx.fillStyle = 'rgba(10, 14, 26, 0.82)';
      ctx.fillRect(ix - 34, iy - 6, 68, 12);
      ctx.strokeStyle = '#ffd84d';
      ctx.lineWidth = 1;
      ctx.strokeRect(ix - 33.5, iy - 5.5, 67, 11);
      drawPixelText(ctx, atk.wall === 'right' ? 'NET ->' : 'NET ^', ix, iy - 3, '#ffd84d', 1, 'center', null);
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
    const pInfo = game.getCurrentPeriodInfo();
    const atk = game.getAttackNet('home');
    drawBanner(ctx, pInfo.name, `66 BOND - SHOOT AT ${atk.label}`, '#ffe84d');
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
    const team = TEAMS[game.lastGoalTeam];
    const scorerLabel = game.lastScorer
      ? `${game.lastScorer.name} #${game.lastScorer.number} SCORES!`
      : `${team.name} SCORES!`;
    drawBanner(ctx, 'GOAL!!', scorerLabel, team.ringColor);
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

function drawSchoolyard(ctx, game) {
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

  // === LEFT WALL (BODY-CHECK BOARDS!) & BOTTOM CHAIN-LINK FENCE ===
  // Sturdy left brick/concrete wall along 66 Bond where body checks are legal!
  ctx.fillStyle = '#3b3e47';
  ctx.fillRect(0, b.top - 2, b.left, b.bottom - b.top + 6);
  ctx.fillStyle = '#535866';
  for (let row = 0; row < Math.ceil((b.bottom - b.top) / 8); row++) {
    const wy = b.top + row * 8;
    ctx.fillRect(2 + (row % 2) * 5, wy, b.left - 8, 5);
  }
  ctx.fillStyle = isSnow ? '#ffffff' : '#7b8394';
  ctx.fillRect(b.left - 2, b.top, 2, b.bottom - b.top);

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

    // Caption plaque right next to the seated kid on the bottom red-brick wall:
    // "The Bird That Couldn't Fly."
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

  // === TOP-LEFT & LOWER-LEFT CORNER BASKETBALL HALF-COURTS & HOOPS (IN PLAY!) ===
  if (game.hoopsGames) {
    for (const h of game.hoopsGames) {
      drawCornerBasketballCourt(ctx, h, isSnow);
    }
  }

  // === SIDELINE CLASSMATES WATCHING RECESS ===
  const celebrating = game.state === 'GOAL_CELEBRATION';
  for (const spec of game.spectators) {
    drawSpectator(ctx, spec, game.tick, celebrating);
  }
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
  let statusText = `${ctrl.name} #${ctrl.number}`;
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

// Iconic 16-bit EA Sports-style Boot Splash with 360° spinning SMCS Circular Crest + Latin Motto!
function renderBootIntro(ctx, game) {
  const f = game.bootFrames;

  // Classic Genesis sports boot dark cathedral-navy backdrop with subtle gold spotlight
  ctx.fillStyle = '#070a14';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Subtle radial spotlight behind the crest
  const glowAlpha = Math.min(0.28, (f / 45) * 0.28);
  const grad = ctx.createRadialGradient(160, 96, 8, 160, 96, 120);
  grad.addColorStop(0, `rgba(134, 38, 51, ${(glowAlpha * 1.4).toFixed(2)})`);
  grad.addColorStop(0.55, `rgba(208, 173, 103, ${(glowAlpha * 0.45).toFixed(2)})`);
  grad.addColorStop(1, 'rgba(7, 10, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // Phase 1 (frames 0..84): Smooth eased 360° horizontal medallion spin + zoom in!
  const spinDur = 84;
  const t = Math.min(1, f / spinDur);
  // Smooth ease-out cubic so the spin whips cleanly and locks into place at exactly 360°!
  const ease = 1 - Math.pow(1 - t, 3);
  const angle = ease * Math.PI * 2;
  const radius = 12 + ease * 36; // zooms from 12px to crisp 48px radius (96px diameter!)

  // Phase 2 (frames 84..116): Bright gold sheen sweeps across the settled crest
  const sheen = f >= 84 && f <= 116 ? (f - 84) / 32 : -1;

  drawSpinningSmcsCrest(ctx, SCREEN_W / 2, 92, radius, angle, sheen);

  // Phase 3 (frames 98+): Punchy EA Sports-style Latin tagline — "IN LUDO EST!" ("It's in the game!")
  if (f >= 98) {
    const a = Math.min(1, (f - 98) / 14);
    const slide = Math.round((1 - a) * 10);
    ctx.save();
    ctx.globalAlpha = a;
    drawPixelText(ctx, 'IN LUDO EST!', SCREEN_W / 2, 162 + slide, '#ffffff', 2, 'center');
    ctx.restore();
  }

  // Gold decorative rule sweeping out right under "IN LUDO EST!"
  if (f >= 118) {
    const lineW = Math.min(156, (f - 118) * 10);
    ctx.fillStyle = '#d0ad67';
    ctx.fillRect(Math.round(SCREEN_W / 2 - lineW / 2), 184, lineW, 2);
  }

  // Smooth fade-out into Title Screen during final 28 frames (252..280)
  if (f > 252) {
    const fade = Math.min(1, (f - 252) / 28);
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

  // Matchup summary + Uniform & Weather toggles!
  const uniformShort = game.uniformMode === 'dress' ? 'DRESS' : 'DEFAULT';
  const weatherShort = game.weather === 'snow' ? 'SNOW (CHECKS ALL!)' : 'CLEAR';
  drawPixelText(ctx, `UNIFORM: ${uniformShort} (U)   WEATHER: ${weatherShort} (W)`, SCREEN_W / 2, 178, '#ffd84d', 1, 'center');
  if (game.gamepadName) {
    drawPixelText(ctx, 'PAD READY! B/X:SHOOT/CHECK A:PASS Y:CATCH', SCREEN_W / 2, 196, '#6ef0a4', 1, 'center');
  } else {
    drawPixelText(ctx, 'Z:SHOOT/CHECK  X:PASS  C:CATCH  B:SNOW', SCREEN_W / 2, 196, '#b8c7e6', 1, 'center');
  }

  // Blinking arcade prompt + Demo Mode shortcut
  if (Math.floor(game.tick / 24) % 2 === 0) {
    const prompt = game.gamepadName
      ? 'START/A: PLAY   D: DEMO (CPU VS CPU)'
      : 'ENTER/Z: PLAY   D: DEMO (CPU VS CPU)';
    drawPixelText(ctx, prompt, SCREEN_W / 2, 219, '#d9ff2e', 1, 'center');
  }
}

function formatScorerSummary(goalLog) {
  if (!goalLog || goalLog.length === 0) return 'NO GOALS YET';
  const counts = new Map();
  for (const g of goalLog) {
    const key = `${g.name} #${g.number}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const parts = [];
  for (const [label, count] of counts.entries()) {
    parts.push(count > 1 ? `${label} (${count})` : label);
  }
  const full = parts.join(', ');
  return full.length > 34 ? full.slice(0, 33) + '.' : full;
}

// Shared 16-bit NHL '94-style Match Stats modal (used for PAUSE "Stats To Date" and FINAL Box Score!)
function renderStatsModal(ctx, game, { isFinal }) {
  // Dim playfield behind modal
  ctx.fillStyle = 'rgba(6, 9, 18, 0.72)';
  ctx.fillRect(0, HUD_H, SCREEN_W, VIEW_H);

  // Outer 16-bit scoreboard panel
  const x = 18;
  const y = 30;
  const w = SCREEN_W - 36;
  const h = 200;
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
    drawPixelText(ctx, 'FINAL BELL! STATS', SCREEN_W / 2, y + 8, '#ffe84d', 1, 'center');
    drawPixelText(ctx, verdict, SCREEN_W / 2, y + 19, '#48b8ff', 1, 'center');
  } else {
    drawPixelText(ctx, 'PAUSED - STATS TO DATE', SCREEN_W / 2, y + 8, '#ffe84d', 1, 'center');
    drawPixelText(ctx, `${periodName}  ${mm}:${ss} LEFT`, SCREEN_W / 2, y + 19, '#9be8ff', 1, 'center');
  }

  // Team banners & current score
  ctx.fillStyle = TEAMS.home.primary;
  ctx.fillRect(x + 10, y + 32, 84, 18);
  ctx.fillStyle = TEAMS.away.primary;
  ctx.fillRect(x + w - 94, y + 32, 84, 18);
  drawPixelText(ctx, TEAMS.home.name, x + 52, y + 38, '#ffffff', 1, 'center');
  drawPixelText(ctx, TEAMS.away.name, x + w - 52, y + 38, '#ffffff', 1, 'center');
  drawPixelText(ctx, `${game.score.home} - ${game.score.away}`, SCREEN_W / 2, y + 34, '#ffe84d', 2, 'center');

  // Divider line
  ctx.fillStyle = '#324066';
  ctx.fillRect(x + 10, y + 55, w - 20, 1);

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

  let ry = y + 62;
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
  ctx.fillRect(x + 10, y + 155, w - 20, 1);
  drawPixelText(ctx, `GOALS: ${formatScorerSummary(game.goalLog)}`, SCREEN_W / 2, y + 161, '#ffe84d', 1, 'center', null);

  // Action prompts at bottom
  if (isFinal) {
    if (Math.floor(game.tick / 22) % 2 === 0) {
      drawPixelText(ctx, 'PRESS ENTER / START / Z FOR REMATCH', SCREEN_W / 2, y + 181, '#d9ff2e', 1, 'center');
    }
  } else {
    drawPixelText(ctx, 'P / ESC / ENTER: RESUME   R: RESTART', SCREEN_W / 2, y + 181, '#d9ff2e', 1, 'center');
  }
}
