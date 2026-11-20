import { COURT, GOAL, HUD_H, PALETTE, PHYSICS, SCREEN_H, SCREEN_W, VIEW_H, WORLD_H } from './constants.js';
import { TEAMS } from './roster.js';
import {
  drawGoalie,
  drawPixelText,
  drawRecessGoal,
  drawSkater,
  drawSpectator,
  drawStarRing,
  drawTennisBall,
} from './sprites.js';

// Pre-generate deterministic asphalt cracks & schoolyard pebble texture once!
const ASPHALT_SPECKS = [];
let seed = 1994;
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
            ? Math.max(0, 1 - Math.max(p.holdFrames / PHYSICS.maxHoldFrames, p.holdDist / PHYSICS.maxHoldSteps))
            : 0;
          drawStarRing(ctx, p.x, p.y, team.ringColor, game.tick, p.holdingBall, holdRatio);
        } else if (game.ball.owner?.id === p.id && p.team === 'away') {
          drawStarRing(ctx, p.x, p.y, team.ringColor, game.tick, p.holdingBall, 0);
        }

        if (p.role === 'G') {
          drawGoalie(ctx, p, team, game.tick);
        } else {
          drawSkater(ctx, p, team, game.tick);
        }

        // Kick power meter right under controlled player while charging Z/J
        if (p.id === game.controlledId && game.kickCharge > 2) {
          const w = Math.round((game.kickCharge / 24) * 18);
          ctx.fillStyle = '#12151f';
          ctx.fillRect(Math.round(p.x - 10), Math.round(p.y + 7), 20, 4);
          ctx.fillStyle = game.kickCharge > 16 ? '#ff5263' : '#ffe84d';
          ctx.fillRect(Math.round(p.x - 9), Math.round(p.y + 8), w, 2);
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

  // === TOP 16-BIT BROADCAST SCOREBOARD HUD ===
  renderHud(ctx, game);

  // === STATE OVERLAYS ===
  if (game.state === 'FACEOFF') {
    drawBanner(ctx, 'FACEOFF!', 'GET READY TO KICK!', '#ffe84d');
  } else if (game.state === 'GOAL_CELEBRATION') {
    const team = TEAMS[game.lastGoalTeam];
    const scorerLabel = game.lastScorer
      ? `${game.lastScorer.name} #${game.lastScorer.number} SCORES!`
      : `${team.name} SCORES!`;
    drawBanner(ctx, 'GOAL!!', scorerLabel, team.ringColor);
  } else if (game.state === 'PERIOD_END') {
    drawBanner(ctx, 'HALF-TIME BELL!', 'SWITCHING SIDES - PRESS ENTER', '#ffe84d');
  } else if (game.state === 'PAUSED') {
    drawBanner(ctx, 'RECESS PAUSED', 'PRESS ENTER TO RESUME', '#ffffff');
  } else if (game.state === 'GAME_OVER') {
    renderGameOver(ctx, game);
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

  // Center: RECESS HALF + CLOCK + ACTIVE PLAYER NAMEPLATE!
  const secs = Math.max(0, Math.ceil(game.clockFrames / 60));
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  const halfLabel = game.period === 1 ? '1ST' : '2ND';

  ctx.fillStyle = '#090d18';
  ctx.fillRect(114, 2, 92, 18);
  ctx.strokeStyle = '#3b4a73';
  ctx.strokeRect(114.5, 2.5, 91, 17);
  drawPixelText(ctx, `${halfLabel}  ${mm}:${ss}`, 160, 4, '#ffe84d', 1, 'center');

  // Show controlled player name & prompt (e.g. "YOU #94" or "DROP OR KICK!")
  const ctrl = game.getControlledPlayer();
  const statusText = ctrl.holdingBall
    ? 'HOLD! X:DROP Z:KICK'
    : `${ctrl.name} #${ctrl.number}`;
  const statusColor = ctrl.holdingBall ? '#d9ff2e' : '#9be8ff';
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
  ctx.fillRect(18, 14, SCREEN_W - 36, 78);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  ctx.strokeRect(19, 15, SCREEN_W - 38, 76);

  drawPixelText(ctx, 'RECESS', SCREEN_W / 2, 24, '#48b8ff', 2, 'center');
  drawPixelText(ctx, "FOOT HOCKEY '94", SCREEN_W / 2, 46, '#ffe84d', 2, 'center');
  drawPixelText(ctx, 'SCHOOLYARD 16-BIT EDITION', SCREEN_W / 2, 72, '#d9ff2e', 1, 'center');

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
  drawSkater(ctx, demoSkater, TEAMS.home, game.tick);

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
  drawGoalie(ctx, demoGoalie, TEAMS.away, game.tick);

  drawPixelText(ctx, 'KICK + CATCH & DROP', 96, 158, '#9be8ff', 1, 'center', null);
  drawPixelText(ctx, 'JACKET + GLOVE!', 224, 158, '#ffd84d', 1, 'center', null);

  // Matchup summary
  drawPixelText(ctx, 'ROOM 12 (YOU)  VS  ROOM 14 (CPU)', SCREEN_W / 2, 180, '#f4f7ff', 1, 'center');
  drawPixelText(ctx, 'Z:KICK  X:PASS/DROP  C:CATCH', SCREEN_W / 2, 194, '#b8c7e6', 1, 'center');

  // Blinking arcade prompt
  if (Math.floor(game.tick / 24) % 2 === 0) {
    drawPixelText(ctx, 'PRESS ENTER OR Z TO PLAY!', SCREEN_W / 2, 216, '#d9ff2e', 1, 'center');
  }
}

function renderGameOver(ctx, game) {
  ctx.fillStyle = 'rgba(8, 11, 22, 0.92)';
  ctx.fillRect(28, 46, SCREEN_W - 56, 160);
  ctx.strokeStyle = '#ffd84d';
  ctx.lineWidth = 2;
  ctx.strokeRect(29, 47, SCREEN_W - 58, 158);

  const verdict =
    game.score.home > game.score.away
      ? 'ROOM 12 WINS RECESS!'
      : game.score.away > game.score.home
      ? 'ROOM 14 TAKES RECESS!'
      : 'RECESS TIE GAME!';

  drawPixelText(ctx, 'BELL RANG! FINAL', SCREEN_W / 2, 58, '#ffe84d', 1, 'center');
  drawPixelText(ctx, verdict, SCREEN_W / 2, 72, '#48b8ff', 1, 'center');

  // Box score
  drawPixelText(ctx, `RM12  ${game.score.home} - ${game.score.away}  RM14`, SCREEN_W / 2, 92, '#ffffff', 2, 'center');

  drawPixelText(ctx, 'SHOTS', SCREEN_W / 2, 124, '#8fa1c7', 1, 'center');
  drawPixelText(ctx, String(game.stats.home.shots), 96, 124, '#ffffff', 1, 'center');
  drawPixelText(ctx, String(game.stats.away.shots), 224, 124, '#ffffff', 1, 'center');

  drawPixelText(ctx, 'CATCHES', SCREEN_W / 2, 138, '#8fa1c7', 1, 'center');
  drawPixelText(ctx, String(game.stats.home.catches), 96, 138, '#d9ff2e', 1, 'center');
  drawPixelText(ctx, String(game.stats.away.catches), 224, 138, '#d9ff2e', 1, 'center');

  drawPixelText(ctx, 'SAVES', SCREEN_W / 2, 152, '#8fa1c7', 1, 'center');
  drawPixelText(ctx, String(game.stats.home.saves), 96, 152, '#ffd84d', 1, 'center');
  drawPixelText(ctx, String(game.stats.away.saves), 224, 152, '#ffd84d', 1, 'center');

  if (Math.floor(game.tick / 22) % 2 === 0) {
    drawPixelText(ctx, 'PRESS ENTER OR Z FOR REMATCH', SCREEN_W / 2, 182, '#d9ff2e', 1, 'center');
  }
}
