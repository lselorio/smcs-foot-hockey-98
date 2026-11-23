import { COURT, GOAL, HUD_H, PALETTE, PHYSICS, RECESS_PERIODS, SCREEN_H, SCREEN_W, SHOT, VIEW_H, WORLD_H } from './constants.js';
import { TEAMS } from './roster.js';
import {
  drawGoalie,
  drawPassTargetMarker,
  drawPixelText,
  drawRecessGoal,
  drawSkater,
  drawSpectator,
  drawStarRing,
  drawTennisBall,
} from './sprites.js';
import { drawSpinningSmcsCrest } from './smcs-crest.js';

// Pre-generate deterministic asphalt cracks & schoolyard pebble texture once!
const ASPHALT_SPECKS = [];
let seed = 1998;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
for (let i = 0; i < 240; i++) {
  ASPHALT_SPECKS.push({
    x: Math.floor(COURT.left + 4 + rand() * (COURT.right - COURT.left - 8)),
    y: Math.floor(COURT.top + 4 + rand() * (COURT.bottom - COURT.top - 8)),
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
  ctx.translate(shakeX, HUD_H - Math.round(game.cameraY) + shakeY);

  drawSchoolyard(ctx, game);

  // Depth-sort skaters, goalies, and ball by Y coordinate for authentic 3/4 perspective!
  const drawables = [];
  for (const p of game.players) {
    drawables.push({
      y: p.y,
      draw: () => {
        const team = TEAMS[p.team];
        if (p.id === game.controlledId) {
          const holdRatio = p.holdingBall
            ? p.role === 'G'
              ? Math.max(0, 1 - p.holdFrames / PHYSICS.goalieMaxHoldFrames)
              : Math.max(0, 1 - Math.max(p.holdFrames / PHYSICS.maxHoldFrames, p.holdDist / PHYSICS.maxHoldSteps))
            : 0;
          drawStarRing(ctx, p.x, p.y, team.ringColor, game.tick, p.holdingBall, holdRatio);
        } else if (game.ball.owner?.id === p.id && p.team === 'away') {
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

  drawables.sort((a, b) => a.y - b.y);
  for (const item of drawables) item.draw();

  // Particles
  for (const pt of game.particles) {
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
  }

  // Arcade callouts ("CAUGHT!", "GLOVE SAVE!", "JACKET BLOCK!", "ONE-TIMER!")
  for (const c of game.callouts) {
    drawPixelText(ctx, c.text, c.x, c.y, c.color, 1, 'center', '#0c0f1a');
  }

  ctx.restore();

  // If the targeted teammate (e.g. during a full-field goalie throw!) is off-screen upfield, draw a top-edge arrow + name!
  if (game.passTarget && game.state === 'PLAYING') {
    const tyScreen = HUD_H + (game.passTarget.y - game.cameraY);
    if (tyScreen < HUD_H + 8) {
      const ax = Math.max(36, Math.min(SCREEN_W - 36, Math.round(game.passTarget.x)));
      const ctrl = game.getControlledPlayer();
      const col = ctrl.role === 'G' ? '#d9ff2e' : '#7ae8ff';
      ctx.fillStyle = 'rgba(10, 14, 26, 0.82)';
      ctx.fillRect(ax - 26, HUD_H + 3, 52, 13);
      ctx.fillStyle = col;
      ctx.fillRect(ax - 3, HUD_H + 4, 7, 1);
      ctx.fillRect(ax - 2, HUD_H + 3, 5, 1);
      ctx.fillRect(ax - 1, HUD_H + 2, 3, 1);
      drawPixelText(ctx, `${game.passTarget.name} #${game.passTarget.number}`, ax, HUD_H + 7, col, 1, 'center', null);
    }
  }

  // === TOP 16-BIT BROADCAST SCOREBOARD HUD ===
  renderHud(ctx, game);

  // === STATE OVERLAYS ===
  if (game.state === 'FACEOFF') {
    const pInfo = game.getCurrentPeriodInfo();
    drawBanner(ctx, pInfo.name, 'FACEOFF - GET READY!', '#ffe84d');
  } else if (game.state === 'RESTART') {
    const isHomeBall = game.restartTeam === 'home';
    drawBanner(
      ctx,
      isHomeBall ? 'YOUR BALL!' : `${TEAMS.away.short} BALL!`,
      isHomeBall ? 'MOVE OR PASS TO RESTART' : `${TEAMS.away.name} RESTARTS PLAY`,
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
      ? `NEXT: ${nextPeriod.name}${nextPeriod.num === 2 ? ' (2X!)' : ''}`
      : 'PRESS ENTER TO CONTINUE';
    drawBanner(ctx, endTitle, nextSub, '#ffe84d');
  } else if (game.state === 'PAUSED') {
    renderStatsModal(ctx, game, { isFinal: false });
  } else if (game.state === 'GAME_OVER') {
    renderStatsModal(ctx, game, { isFinal: true });
  }
}

function drawSchoolyard(ctx, game) {
  // Recess grass surrounding the blacktop court
  ctx.fillStyle = PALETTE.grassDark;
  ctx.fillRect(0, 0, SCREEN_W, WORLD_H);
  // Subtle mowed grass stripes
  ctx.fillStyle = PALETTE.grassLight;
  for (let y = 0; y < WORLD_H; y += 24) {
    ctx.fillRect(0, y, SCREEN_W, 12);
  }

  // Elementary school red-brick building facade at very top of yard!
  ctx.fillStyle = PALETTE.brickDark;
  ctx.fillRect(0, 0, SCREEN_W, COURT.top - 10);
  ctx.fillStyle = PALETTE.brickLight;
  for (let row = 0; row < 5; row++) {
    for (let x = (row % 2) * 8; x < SCREEN_W; x += 16) {
      ctx.fillRect(x, row * 6 + 2, 13, 4);
    }
  }
  // School windows + "RECESS" chalk sign on brick wall
  for (let x = 24; x < SCREEN_W - 24; x += 56) {
    ctx.fillStyle = '#232e42';
    ctx.fillRect(x, 6, 26, 18);
    ctx.fillStyle = '#6da6cf';
    ctx.fillRect(x + 2, 8, 10, 6);
    ctx.fillRect(x + 14, 8, 10, 6);
    ctx.fillRect(x + 2, 16, 10, 6);
    ctx.fillRect(x + 14, 16, 10, 6);
  }
  // Schoolyard sidewalk curb
  ctx.fillStyle = '#9aa3b2';
  ctx.fillRect(COURT.left - 4, COURT.top - 4, COURT.right - COURT.left + 8, COURT.bottom - COURT.top + 8);

  // Main blacktop asphalt surface
  ctx.fillStyle = PALETTE.asphaltMid;
  ctx.fillRect(COURT.left, COURT.top, COURT.right - COURT.left, COURT.bottom - COURT.top);

  // Subtle asphalt grit specks
  for (const s of ASPHALT_SPECKS) {
    ctx.fillStyle = s.light ? PALETTE.asphaltLight : PALETTE.asphaltDark;
    ctx.fillRect(s.x, s.y, 2, 1);
  }

  // Charming schoolyard asphalt cracks
  ctx.fillStyle = PALETTE.asphaltCrack;
  ctx.fillRect(62, 134, 18, 1);
  ctx.fillRect(79, 135, 11, 1);
  ctx.fillRect(218, 286, 24, 1);
  ctx.fillRect(210, 287, 9, 1);
  ctx.fillRect(102, 330, 14, 1);

  // Faded four-square / hopscotch chalk doodles in the corner for recess nostalgia!
  ctx.strokeStyle = 'rgba(233, 238, 244, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(36, 170, 22, 22);
  ctx.beginPath();
  ctx.moveTo(47, 170);
  ctx.lineTo(47, 192);
  ctx.moveTo(36, 181);
  ctx.lineTo(58, 181);
  ctx.stroke();

  // === HAND-DRAWN CHALK COURT MARKINGS ===
  // Outer chalk boundary
  ctx.strokeStyle = PALETTE.chalkFade;
  ctx.lineWidth = 1;
  ctx.strokeRect(COURT.left + 4, COURT.top + 4, COURT.right - COURT.left - 8, COURT.bottom - COURT.top - 8);

  // Center chalk line (red-ish faded playground paint / chalk)
  ctx.fillStyle = '#d46666';
  ctx.fillRect(COURT.left + 5, COURT.centerY - 1, COURT.right - COURT.left - 10, 3);

  // Blue-ish schoolyard zone lines (NHL '94 homage!)
  ctx.fillStyle = 'rgba(79, 140, 220, 0.55)';
  ctx.fillRect(COURT.left + 5, COURT.centerY - 76, COURT.right - COURT.left - 10, 2);
  ctx.fillRect(COURT.left + 5, COURT.centerY + 76, COURT.right - COURT.left - 10, 2);

  // Center chalk faceoff circle
  ctx.strokeStyle = PALETTE.chalk;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(COURT.centerX, COURT.centerY, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.chalk;
  ctx.fillRect(COURT.centerX - 2, COURT.centerY - 2, 4, 4);

  // === CHAIN-LINK FENCE POSTS ALONG SIDELINES ===
  ctx.fillStyle = PALETTE.fencePost;
  for (let y = COURT.top; y <= COURT.bottom; y += 32) {
    ctx.fillRect(COURT.left - 5, y - 2, 4, 4);
    ctx.fillRect(COURT.right + 1, y - 2, 4, 4);
  }
  ctx.fillStyle = PALETTE.fenceWire;
  ctx.fillRect(COURT.left - 3, COURT.top, 1, COURT.bottom - COURT.top);
  ctx.fillRect(COURT.right + 2, COURT.top, 1, COURT.bottom - COURT.top);

  // === MAKESHIFT RECESS GOALS (BACKPACKS & CONES) ===
  const topShake = game.goalShake.top > 0 ? Math.sin(game.tick * 1.4) * 2 : 0;
  const botShake = game.goalShake.bottom > 0 ? Math.sin(game.tick * 1.4) * 2 : 0;
  drawRecessGoal(ctx, true, topShake);
  drawRecessGoal(ctx, false, botShake);

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

  // Show controlled player name & context prompt (goalie throw, skater hold, or slap-kick wind-up!)
  const ctrl = game.getControlledPlayer();
  let statusText = `${ctrl.name} #${ctrl.number}`;
  let statusColor = '#9be8ff';
  if (ctrl.role === 'G' && ctrl.holdingBall) {
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

  drawPixelText(ctx, 'FOOT HOCKEY 98', SCREEN_W / 2, 40, '#ffe84d', 2, 'center');
  drawPixelText(ctx, '16-BIT ARCADE', SCREEN_W / 2, 66, '#48b8ff', 1, 'center');

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

  // Matchup summary + Uniform mode toggle (Default Everyday vs Optional Dress Uniform!)
  drawPixelText(ctx, `${TEAMS.home.name} (YOU)  VS  ${TEAMS.away.name} (CPU)`, SCREEN_W / 2, 175, '#f4f7ff', 1, 'center');
  const uniformLabel =
    game.uniformMode === 'dress'
      ? 'UNIFORM: DRESS BLAZER  (U / ARROWS)'
      : 'UNIFORM: DEFAULT SHIRT (U / ARROWS)';
  drawPixelText(ctx, uniformLabel, SCREEN_W / 2, 188, '#ffd84d', 1, 'center');
  if (game.gamepadName) {
    drawPixelText(ctx, 'PAD READY! B/X:SHOOT A:PASS Y/RB:CATCH', SCREEN_W / 2, 201, '#6ef0a4', 1, 'center');
  } else {
    drawPixelText(ctx, 'Z:TAP QUICK / HOLD HARD  X:PASS  C:CATCH', SCREEN_W / 2, 201, '#b8c7e6', 1, 'center');
  }

  // Blinking arcade prompt
  if (Math.floor(game.tick / 24) % 2 === 0) {
    const prompt = game.gamepadName ? 'PRESS START OR A TO PLAY!' : 'PRESS ENTER OR Z TO PLAY!';
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
        ? `${TEAMS.home.name} WIN RECESS!`
        : game.score.away > game.score.home
        ? `${TEAMS.away.name} TAKE RECESS!`
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
    ['STEALS', String(game.stats.home.steals), String(game.stats.away.steals), '#6ef0a4'],
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
