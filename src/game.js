import { MATCH, PHYSICS, RECESS_PERIODS, SCREEN_H, SCREEN_W, SHOT, VIEW_H } from './constants.js';
import { createBond66Court } from './courts.js';
import { createCornerBasketballGames, updateCornerBasketball } from './basketball.js';
import { CLASSMATES, TEAMS, buildCustomTeams, draftRecessTeams } from './roster.js';
import { pickBootChant, sound } from './audio.js';
import { MARCELLI_AMEN_TIMING } from './music/marcelli-amen.js';
import {
  catchBall,
  clampPlayerToCourt,
  createBall,
  dropHeldBall,
  launchBall,
  launchThrow,
  recordBallTouch,
  stepBallPhysics,
} from './physics.js';
import { updateGoalie, updateSkaterAI } from './ai.js';

function createEmptyTeamStats() {
  return {
    shots: 0,
    passes: 0,
    catches: 0,
    steals: 0,
    checks: 0,
    saves: 0,
    gloveSaves: 0,
    jacketBlocks: 0,
    possessionFrames: 0,
    periodGoals: [0, 0, 0],
    periodShots: [0, 0, 0],
  };
}

const STATS_PAGES = ['team', 'players', 'summary'];

export class FootHockeyGame {
  constructor() {
    this.state = 'BOOT'; // BOOT | TITLE | FACEOFF | RESTART | PLAYING | GOAL_CELEBRATION | PERIOD_END | GAME_OVER | PAUSED
    this.prevState = 'PLAYING';
    this.tick = 0;
    this.bootFrames = 0;
    this.postCreditsFrames = 0;
    this.bootChant = pickBootChant(); // Randomly picks Gloria or Magnificat on bootup!

    this.score = { home: 0, away: 0 };
    this.stats = {
      home: createEmptyTeamStats(),
      away: createEmptyTeamStats(),
    };
    this.goalLog = [];
    this.lastScorer = null;
    this.lastGoalTeam = null;
    this.lastGoalInfo = null;
    this.statsPage = 'team'; // 'team' | 'players' | 'summary' (toggleable on PAUSED and GAME_OVER!)
    this.summaryScroll = 0;
    this.titleCursor = 0;    // 0: PLAY RECESS | 1: PICK TEAMS | 2: OPTIONS | 3: DEMO MODE
    this.optionsCursor = 0;  // 0..7 rows on the OPTIONS screen
    this.draftCursor = 0;    // 0..7 slots on TEAM_SELECT (0..3 HOME, 4..7 AWAY)
    this.draftSlots = [];    // 8 selected classmate names on TEAM_SELECT

    this.court = createBond66Court();
    this.period = 1;
    this.clockFrames = RECESS_PERIODS[0].seconds * 60;
    this.stateTimer = 0;
    this.restartTeam = null;

    this.cameraX = this.court.faceoffX - SCREEN_W / 2;
    this.cameraY = this.court.faceoffY - VIEW_H / 2;
    this.goalShake = {};
    this.screenShake = 0;
    this.leftWallImpact = { y: this.court.bounds.centerY, timer: 0, maxTimer: 40, strength: 0 };

    this.players = [];
    this.controlledId = 'h_c';
    this.ball = createBall();

    this.particles = [];
    this.callouts = [];
    this.spectators = this.createSpectators();
    this.undraftedPlayers = TEAMS.undrafted || [];
    this.hoopsGames = createCornerBasketballGames(this.court, this.undraftedPlayers);
    this.hoops = this.hoopsGames[0];
    this.snowflakes = this.createSnowflakes();

    // Input states
    this.keys = new Set();
    this.justPressed = new Set();
    this.kickCharge = 0;
    this.passTarget = null; // Highlighted teammate for deliberate passes & goalie throws
    this.gamepadName = null;
    this.uniformMode = 'default'; // 'default' (maroon shirt, tie, blue pants) | 'dress' (optional blazer dress uniform)
    this.weather = 'clear';       // 'clear' (blacktop, left-wall checks only) | 'snow' (white slippery snow, checks legal everywhere!)
    this.rotateLunchView = true;  // Optional: rotate 66 Bond 90° CCW during Lunch Recess so Home always shoots UP!
    this.isDemo = false;          // True during CPU-vs-CPU Arcade Demo / Attract Mode
    this.titleIdleFrames = 0;     // Auto-launches Demo Mode after ~10s idle on Title Screen
    this.crtEnabled = true;

    this.initRoster();
    this.resetPositionsForFaceoff();
  }

  createSpectators() {
    const kids = [];
    const shirts = ['#e84a5f', '#42b883', '#ffbe3b', '#8d5fd3', '#3fa7d6', '#f28f3b'];
    const skins = ['#f2c6a0', '#dfa47a', '#8f593b', '#c4865b', '#e8b58f'];
    const hairs = ['#231a15', '#693d1e', '#c98e32', '#171412', '#9c4b23'];

    // Left wall spectators watching recess on 66 Bond
    for (let i = 0; i < 6; i++) {
      kids.push({
        x: 11,
        y: 170 + i * 42,
        shirt: shirts[i % shirts.length],
        skin: skins[i % skins.length],
        hair: hairs[(i + 2) % hairs.length],
        phase: i * 1.1,
      });
    }
    return kids;
  }

  createSnowflakes() {
    const flakes = [];
    for (let i = 0; i < 64; i++) {
      flakes.push({
        x: Math.random() * SCREEN_W,
        y: Math.random() * SCREEN_H,
        vx: -0.25 - Math.random() * 0.35,
        vy: 0.45 + Math.random() * 0.65,
        size: i % 4 === 0 ? 2 : 1,
      });
    }
    return flakes;
  }

  // Body checking is legal along the left wall of 66 Bond on clear days, and legal EVERYWHERE in snow!
  isBodyCheckLegal(x) {
    if (this.weather === 'snow') return true;
    return x <= this.court.bounds.left + 48;
  }

  toggleWeather() {
    this.weather = this.weather === 'clear' ? 'snow' : 'clear';
    sound.playMenuSelect();
    const label = this.weather === 'snow' ? 'SNOW DAY! CHECKS ON' : 'CLEAR BLACKTOP';
    this.addCallout(this.cameraX + SCREEN_W / 2, this.cameraY + 40, label, '#9be8ff');
    return this.weather;
  }

  // Odd periods (Morning, Afternoon): Home attacks Top Yellow Bricks & defends Right Window Cage.
  // Even periods (Lunch Recess): Teams SWAP nets so both sides play both asymmetrical nets!
  getTeamNetMap() {
    const swapped = this.period % 2 === 0;
    const net0 = this.court.nets[0]; // top_yellow
    const net1 = this.court.nets[1]; // right_cage
    return swapped
      ? {
          homeAttackId: net1.id,
          homeDefendId: net0.id,
          awayAttackId: net0.id,
          awayDefendId: net1.id,
        }
      : {
          homeAttackId: net0.id,
          homeDefendId: net1.id,
          awayAttackId: net1.id,
          awayDefendId: net0.id,
        };
  }

  // Optional: rotate the viewport 90° CCW during Lunch Recess (when Home attacks the right square cage net)
  // so the player is ALWAYS skating UP and shooting UP toward the opponent's net!
  isCameraRotated() {
    return this.rotateLunchView && this.getAttackNet('home').wall === 'right';
  }

  toggleRotateLunchView() {
    this.rotateLunchView = !this.rotateLunchView;
    this.updateCamera(true);
    sound.playMenuSelect();
    const label = this.rotateLunchView ? 'LUNCH CAM: ROTATE' : 'LUNCH CAM: FIXED';
    this.addCallout(this.ball.x, this.ball.y - 16, label, '#ffd84d');
    return this.rotateLunchView;
  }

  getAttackNet(team) {
    const map = this.getTeamNetMap();
    const id = team === 'home' ? map.homeAttackId : map.awayAttackId;
    return this.court.nets.find((n) => n.id === id) || this.court.nets[0];
  }

  getDefendNet(team) {
    const map = this.getTeamNetMap();
    const id = team === 'home' ? map.homeDefendId : map.awayDefendId;
    return this.court.nets.find((n) => n.id === id) || this.court.nets[1];
  }

  initRoster(redraft = false, customRoster = null) {
    if (customRoster) {
      const { homePlayers, awayPlayers, undraftedPlayers } = buildCustomTeams(
        customRoster.homeNames,
        customRoster.awayNames
      );
      TEAMS.home.players = homePlayers;
      TEAMS.away.players = awayPlayers;
      TEAMS.undrafted = undraftedPlayers;
      this.undraftedPlayers = undraftedPlayers;
    } else if (redraft) {
      const { homePlayers, awayPlayers, undraftedPlayers } = draftRecessTeams();
      TEAMS.home.players = homePlayers;
      TEAMS.away.players = awayPlayers;
      TEAMS.undrafted = undraftedPlayers;
      this.undraftedPlayers = undraftedPlayers;
    } else {
      this.undraftedPlayers = TEAMS.undrafted || [];
    }
    this.players = [];
    for (const teamKey of ['home', 'away']) {
      const team = TEAMS[teamKey];
      team.players.forEach((tmpl, idx) => {
        this.players.push({
          ...tmpl,
          team: teamKey,
          x: this.court.faceoffX,
          y: this.court.faceoffY,
          vx: 0,
          vy: 0,
          facingX: 0,
          facingY: teamKey === 'home' ? -1 : 1,
          holdingBall: false,
          holdFrames: 0,
          holdDist: 0,
          windupFrames: 0,
          kickTimer: 0,
          catchAnim: 0,
          stealCooldown: 0,
          aiDecisionCooldown: 0,
          diveTimer: 0,
          diveDir: 0,
          jacketTimer: 0,
          gloveTimer: 0,
          throwTimer: 0,
          stunTimer: 0,
          stunDir: 1,
          animOffset: idx * 1.7,
          matchStats: { goals: 0, assists: 0, shots: 0, passes: 0, catches: 0, checks: 0, saves: 0 },
        });
      });
    }
    this.controlledId = 'h_c';
  }

  getCurrentPeriodInfo() {
    return RECESS_PERIODS[this.period - 1] || RECESS_PERIODS[0];
  }

  startNewMatch(demo = false, customRoster = null) {
    // Draft a fresh collection of classmates (or apply player-chosen custom lineups!)
    this.isDemo = Boolean(demo);
    this.titleIdleFrames = 0;
    this.initRoster(true, customRoster);
    this.score = { home: 0, away: 0 };
    this.stats = {
      home: createEmptyTeamStats(),
      away: createEmptyTeamStats(),
    };
    this.goalLog = [];
    this.lastScorer = null;
    this.lastGoalTeam = null;
    this.lastGoalInfo = null;
    this.statsPage = 'team'; // 'team' | 'players' | 'summary' (toggleable on PAUSED and GAME_OVER!)
    this.summaryScroll = 0;
    this.titleCursor = 0;    // 0: PLAY RECESS | 1: PICK TEAMS | 2: OPTIONS | 3: DEMO MODE
    this.optionsCursor = 0;  // 0..7 rows on the OPTIONS screen
    this.draftCursor = 0;    // 0..7 slots on TEAM_SELECT (0..3 HOME, 4..7 AWAY)
    this.draftSlots = [];    // 8 selected classmate names on TEAM_SELECT
    this.period = 1;
    this.clockFrames = this.getCurrentPeriodInfo().seconds * 60;
    this.restartTeam = null;
    this.particles = [];
    this.callouts = [];
    this.hoopsGames = createCornerBasketballGames(this.court, this.undraftedPlayers);
    this.hoops = this.hoopsGames[0];
    this.startFaceoff(true); // Show the starting lineups card at the beginning of each match!
    sound.playRecessBell();
  }

  startDemoMatch() {
    this.startNewMatch(true);
  }

  startFaceoff(showLineups = false) {
    this.resetPositionsForFaceoff();
    this.restartTeam = null;
    this.state = 'FACEOFF';
    this.showLineups = Boolean(showLineups);
    this.stateTimer = this.showLineups ? (this.isDemo ? 105 : 210) : 58;
    this.updateCamera(true); // Snap camera cleanly on period/orientation swaps!
    sound.playFaceoffDrop();
  }

  // Post-goal possession rule: the conceding team's GOALIE gets possession right in their crease to throw/restart play!
  startPostGoalRestart(concedingTeam) {
    this.resetPositionsForFaceoff();
    this.restartTeam = concedingTeam;

    const bounds = this.court.bounds;
    const clampX = (v) => Math.max(bounds.left + 20, Math.min(bounds.right - 20, v));
    const clampY = (v) => Math.max(bounds.top + 20, Math.min(bounds.bottom - 20, v));

    const homeNet = this.getDefendNet('home');
    const awayNet = this.getDefendNet('away');
    const concedingNet = concedingTeam === 'home' ? homeNet : awayNet;
    const scoringNet = concedingTeam === 'home' ? awayNet : homeNet;

    // Direction from conceding net toward opponent's net + perpendicular wing axis
    const dx = scoringNet.centerX - concedingNet.centerX;
    const dy = scoringNet.centerY - concedingNet.centerY;
    const mag = Math.hypot(dx, dy) || 1;
    const ax = dx / mag;
    const ay = dy / mag;
    const wx = -ay;
    const wy = ax;

    const setPos = (id, x, y, fx, fy) => {
      const p = this.players.find((pl) => pl.id === id);
      if (!p) return;
      p.x = x;
      p.y = y;
      p.facingX = fx;
      p.facingY = fy;
    };

    // Place both goalies cleanly in their own creases
    setPos('h_g', homeNet.centerX + homeNet.normalX * 13, homeNet.centerY + homeNet.normalY * 13, homeNet.normalX, homeNet.normalY);
    setPos('a_g', awayNet.centerX + awayNet.normalX * 13, awayNet.centerY + awayNet.normalY * 13, awayNet.normalX, awayNet.normalY);

    // Conceding team skaters fan out cleanly to receive their goalie's restart throw (short, mid, deep)
    const cPrefix = concedingTeam === 'home' ? 'h' : 'a';
    setPos(`${cPrefix}_c`, clampX(concedingNet.centerX + concedingNet.normalX * 72 + wx * 10), clampY(concedingNet.centerY + concedingNet.normalY * 72 + wy * 10), ax, ay);
    setPos(`${cPrefix}_lw`, clampX(concedingNet.centerX + ax * 135 - wx * 58), clampY(concedingNet.centerY + ay * 135 - wy * 58), ax, ay);
    setPos(`${cPrefix}_rw`, clampX(concedingNet.centerX + ax * 110 + wx * 62), clampY(concedingNet.centerY + ay * 110 + wy * 62), ax, ay);

    // Scoring team backs off toward midfield / own end to give the goalie clean room to restart
    const sPrefix = concedingTeam === 'home' ? 'a' : 'h';
    setPos(`${sPrefix}_c`, clampX(this.court.faceoffX + ax * 48), clampY(this.court.faceoffY + ay * 48), -ax, -ay);
    setPos(`${sPrefix}_lw`, clampX(this.court.faceoffX + ax * 64 - wx * 64), clampY(this.court.faceoffY + ay * 64 - wy * 64), -ax, -ay);
    setPos(`${sPrefix}_rw`, clampX(this.court.faceoffX + ax * 64 + wx * 64), clampY(this.court.faceoffY + ay * 64 + wy * 64), -ax, -ay);

    // Conceding goalie holds the ball in their glove right in the crease!
    const goalie = this.players.find((p) => p.id === `${cPrefix}_g`);
    this.ball = createBall(goalie.x, goalie.y, 8);
    catchBall(this.ball, goalie);

    // If Home conceded, hand control immediately to Home's goalie to aim & throw!
    this.controlledId = concedingTeam === 'home' ? 'h_g' : 'h_c';
    this.restartType = 'goalie';
    this.state = 'RESTART';
    this.stateTimer = 36;
    sound.playFaceoffDrop();
  }

  // Basement 56! When the tennis ball falls down the bottom-wall stairs,
  // the OTHER team plays the ball from the right entrance to the staircase!
  handleBasement56(faultTeam) {
    const awardedTeam = faultTeam === 'home' ? 'away' : 'home';
    this.restartTeam = awardedTeam;
    this.restartType = 'basement56';
    this.state = 'BASEMENT_56';
    this.stateTimer = 85;
    sound.playBasement56();
    const s = this.court.basementStairs;
    this.spawnParticles((s.x1 + s.x2) / 2, s.y1 + 10, '#d9ff2e', 10);
    this.addCallout((s.x1 + s.x2) / 2, s.y1 - 8, 'BASEMENT 56!', '#d9ff2e');
  }

  startBasement56Restart(awardedTeam) {
    const s = this.court.basementStairs;
    const bounds = this.court.bounds;
    const clampX = (v) => Math.max(bounds.left + 20, Math.min(bounds.right - 20, v));
    const clampY = (v) => Math.max(bounds.top + 20, Math.min(bounds.bottom - 20, v));

    this.resetPositionsForFaceoff();
    this.restartTeam = awardedTeam;
    this.restartType = 'basement56';

    const aPrefix = awardedTeam === 'home' ? 'h' : 'a';
    const oPrefix = awardedTeam === 'home' ? 'a' : 'h';

    const setPos = (id, x, y, fx, fy) => {
      const p = this.players.find((pl) => pl.id === id);
      if (!p) return;
      p.x = x;
      p.y = y;
      p.facingX = fx;
      p.facingY = fy;
    };

    // Awarded team's center plays the ball right at the open RIGHT entrance to the staircase!
    setPos(`${aPrefix}_c`, s.entranceX, s.entranceY, 0, -1);
    setPos(`${aPrefix}_lw`, clampX(s.entranceX - 58), clampY(s.entranceY - 46), 0, -1);
    setPos(`${aPrefix}_rw`, clampX(s.entranceX + 64), clampY(s.entranceY - 44), 0, -1);

    // Faulting team gives respectful spacing upfield from the staircase entrance
    setPos(`${oPrefix}_c`, clampX(s.entranceX), clampY(s.entranceY - 68), 0, 1);
    setPos(`${oPrefix}_lw`, clampX(s.entranceX - 66), clampY(s.entranceY - 96), 0, 1);
    setPos(`${oPrefix}_rw`, clampX(s.entranceX + 66), clampY(s.entranceY - 96), 0, 1);

    const starter = this.players.find((p) => p.id === `${aPrefix}_c`);
    this.controlledId = 'h_c';
    this.ball = createBall(starter.x, starter.y - PHYSICS.dribbleDist, 0);
    this.ball.owner = starter;
    this.ball.lastTouchTeam = awardedTeam;
    this.ball.lastTouchPlayer = starter;
    this.state = 'RESTART';
    this.stateTimer = 34;
    sound.playFaceoffDrop();
  }

  resetPositionsForFaceoff() {
    const cx = this.court.faceoffX;
    const cy = this.court.faceoffY;
    const homeNet = this.getDefendNet('home');
    const awayNet = this.getDefendNet('away');

    // Align faceoff symmetrically along the axis connecting the two nets (90-degree diagonal on 66 Bond!)
    const dx = awayNet.centerX - homeNet.centerX;
    const dy = awayNet.centerY - homeNet.centerY;
    const mag = Math.hypot(dx, dy) || 1;
    const ax = dx / mag;
    const ay = dy / mag;
    const wx = -ay;
    const wy = ax;

    const bounds = this.court.bounds;
    const clampX = (v) => Math.max(bounds.left + 20, Math.min(bounds.right - 20, v));
    const clampY = (v) => Math.max(bounds.top + 20, Math.min(bounds.bottom - 20, v));

    const spots = {
      h_c: [clampX(cx - ax * 20), clampY(cy - ay * 20), ax, ay],
      h_lw: [clampX(cx - ax * 42 - wx * 64), clampY(cy - ay * 42 - wy * 64), ax, ay],
      h_rw: [clampX(cx - ax * 42 + wx * 64), clampY(cy - ay * 42 + wy * 64), ax, ay],
      h_g: [homeNet.centerX + homeNet.normalX * 13, homeNet.centerY + homeNet.normalY * 13, homeNet.normalX, homeNet.normalY],
      a_c: [clampX(cx + ax * 20), clampY(cy + ay * 20), -ax, -ay],
      a_lw: [clampX(cx + ax * 42 + wx * 64), clampY(cy + ay * 42 + wy * 64), -ax, -ay],
      a_rw: [clampX(cx + ax * 42 - wx * 64), clampY(cy + ay * 42 - wy * 64), -ax, -ay],
      a_g: [awayNet.centerX + awayNet.normalX * 13, awayNet.centerY + awayNet.normalY * 13, awayNet.normalX, awayNet.normalY],
    };

    for (const p of this.players) {
      const [x, y, fx, fy] = spots[p.id];
      p.x = x;
      p.y = y;
      p.vx = 0;
      p.vy = 0;
      p.facingX = fx;
      p.facingY = fy;
      p.holdingBall = false;
      p.holdFrames = 0;
      p.holdDist = 0;
      p.windupFrames = 0;
      p.kickTimer = 0;
      p.catchAnim = 0;
      p.stealCooldown = 0;
      p.diveTimer = 0;
      p.jacketTimer = 0;
      p.gloveTimer = 0;
      p.throwTimer = 0;
      p.stunTimer = 0;
      p.stunDir = 1;
    }

    this.controlledId = 'h_c';
    this.ball = createBall(cx, cy, 26);
    this.ball.vz = -0.3;
    this.kickCharge = 0;
    this.passTarget = null;
  }

  getControlledPlayer() {
    return this.players.find((p) => p.id === this.controlledId) || this.players[0];
  }

  findNearestPlayer(x, y, team, excludeGoalie = true, excludeId = null) {
    let best = null;
    let bestDist = Infinity;
    for (const p of this.players) {
      if (team && p.team !== team) continue;
      if (excludeGoalie && p.role === 'G') continue;
      if (excludeId && p.id === excludeId) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  // === INPUT HANDLING (Keyboard + HTML5 Gamepad) ===
  onKeyDown(code) {
    if (!this.keys.has(code)) {
      this.justPressed.add(code);
    }
    this.keys.add(code);

    // Post-credits Palestrina "Amen" stinger is completely uninterruptible!
    if (this.state === 'POST_CREDITS') {
      sound.ensureContext();
      return;
    }

    if (code === 'KeyM') {
      const muted = sound.toggleMute();
      this.addCallout(this.cameraX + SCREEN_W / 2, this.cameraY + 40, muted ? 'AUDIO OFF' : 'AUDIO ON', '#ffe84d');
    } else if (code === 'KeyN') {
      const musicOn = sound.toggleMusic();
      this.addCallout(this.cameraX + SCREEN_W / 2, this.cameraY + 40, musicOn ? 'MUSIC ON' : 'MUSIC OFF', '#9be8ff');
    } else if (code === 'KeyG') {
      const track = sound.cycleMusicTrack();
      this.addCallout(this.cameraX + SCREEN_W / 2, this.cameraY + 40, `BGM: ${track.label}`, '#9be8ff');
    } else if (code === 'KeyU') {
      this.toggleUniformMode();
    } else if (code === 'KeyW' && this.state === 'TITLE') {
      this.titleIdleFrames = 0;
      this.toggleWeather();
    } else if (code === 'KeyB') {
      // Quick weather toggle anytime during play too (W is WASD Up during play)
      this.toggleWeather();
    } else if (code === 'KeyV') {
      if (this.state === 'TITLE') this.titleIdleFrames = 0;
      this.toggleRotateLunchView();
    } else if (code === 'KeyT') {
      this.toggleCrt();
    } else {
      // Unlock Web Audio cleanly on first user keypress so Sicut Cervus starts immediately!
      sound.ensureContext();
    }
  }

  toggleUniformMode() {
    this.uniformMode = this.uniformMode === 'default' ? 'dress' : 'default';
    sound.playMenuSelect();
    const label = this.uniformMode === 'dress' ? 'DRESS UNIFORM' : 'REGULAR UNIFORM';
    this.addCallout(this.cameraX + SCREEN_W / 2, this.cameraY + 40, label, '#ffd84d');
    return this.uniformMode;
  }

  onKeyUp(code) {
    this.keys.delete(code);
  }

  toggleCrt() {
    this.crtEnabled = !this.crtEnabled;
    if (typeof document !== 'undefined') {
      const overlay = document.getElementById('crt-overlay');
      if (overlay) overlay.classList.toggle('active', this.crtEnabled);
    }
  }

  pollGamepad(padsOverride = null) {
    const pads =
      padsOverride ||
      (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null);
    if (!pads) {
      this.gamepadName = null;
      return null;
    }

    // Scan all slots — on Linux/Bluetooth/Steam, the active controller is often at index 1+!
    let gp = null;
    for (let i = 0; i < pads.length; i++) {
      const candidate = pads[i];
      if (candidate && candidate.connected !== false) {
        gp = candidate;
        break;
      }
    }
    if (!gp) {
      this.gamepadName = null;
      return null;
    }
    this.gamepadName = gp.id || 'GAMEPAD';

    // Left analog stick with radial deadzone
    let ax = gp.axes?.[0] || 0;
    let ay = gp.axes?.[1] || 0;
    if (Math.hypot(ax, ay) < 0.22) {
      ax = 0;
      ay = 0;
    }

    // Standard W3C D-pad buttons (Xbox, PS, Switch Pro, 8BitDo X-Input)
    const btns = gp.buttons || [];
    if (btns[14]?.pressed) ax = -1;
    if (btns[15]?.pressed) ax = 1;
    if (btns[12]?.pressed) ay = -1;
    if (btns[13]?.pressed) ay = 1;

    // Non-standard retro USB / Linux hidraw D-pad fallback (axes 6/7)
    if (gp.mapping !== 'standard' && gp.axes && gp.axes.length >= 8) {
      if (Math.abs(gp.axes[6]) > 0.5) ax = Math.sign(gp.axes[6]);
      if (Math.abs(gp.axes[7]) > 0.5) ay = Math.sign(gp.axes[7]);
    }

    // Classic NHL '94 + modern console mapping:
    // - Pass / Drop / Goalie Throw / Switch: A / Cross / SNES B (buttons[0])
    // - Shoot (Tap Quick / Hold Hard) / Steal / Bomb Throw: B / Circle / SNES A (buttons[1]) OR X / Square (buttons[2])
    // - Catch / Drop: Y / Triangle (buttons[3]) OR LB/L1 (buttons[4]) OR RB/R1 (buttons[5])
    // - Start / Pause: Start / Options (buttons[9])
    // - CRT Toggle: Select / Share (buttons[8])
    return {
      ax,
      ay,
      passDown: Boolean(btns[0]?.pressed),
      kickDown: Boolean(btns[1]?.pressed || btns[2]?.pressed),
      catchDown: Boolean(btns[3]?.pressed || btns[4]?.pressed || btns[5]?.pressed),
      selectDown: Boolean(btns[8]?.pressed),
      startDown: Boolean(btns[9]?.pressed),
    };
  }

  readInput() {
    const gp = this.pollGamepad();
    let mx = 0;
    let my = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) mx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) mx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) my -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) my += 1;
    if (gp && (gp.ax !== 0 || gp.ay !== 0)) {
      mx = gp.ax;
      my = gp.ay;
    }

    const kickPressed =
      this.justPressed.has('KeyZ') ||
      this.justPressed.has('KeyJ') ||
      (gp?.kickDown && !this._prevGpKick);
    const kickHeld =
      this.keys.has('KeyZ') || this.keys.has('KeyJ') || Boolean(gp?.kickDown);
    const kickReleased = !kickHeld && this._prevKickHeld;

    const passPressed =
      this.justPressed.has('KeyX') ||
      this.justPressed.has('KeyK') ||
      (gp?.passDown && !this._prevGpPass);

    const catchPressed =
      this.justPressed.has('KeyC') ||
      this.justPressed.has('KeyL') ||
      this.justPressed.has('Space') ||
      (gp?.catchDown && !this._prevGpCatch);

    const startPressed =
      this.justPressed.has('Enter') ||
      (gp?.startDown && !this._prevGpStart);

    const pausePressed =
      startPressed ||
      this.justPressed.has('KeyP') ||
      this.justPressed.has('Escape');

    const restartPressed = this.justPressed.has('KeyR');
    const quitPressed = this.justPressed.has('KeyQ');
    const escapePressed = this.justPressed.has('Escape');
    const replayIntroPressed = this.justPressed.has('KeyI');
    const optionsPressed = this.justPressed.has('KeyO');
    const teamSelectPressed = this.justPressed.has('KeyL');
    const tabPressed = this.justPressed.has('Tab');
    const demoPressed = this.justPressed.has('KeyD');
    const exitDemoPressed = escapePressed || this.justPressed.has('KeyP') || quitPressed;
    const menuTogglePressed =
      this.justPressed.has('ArrowLeft') ||
      this.justPressed.has('ArrowRight');
    const menuUpPressed = this.justPressed.has('ArrowUp') || this.justPressed.has('KeyW');
    const menuDownPressed = this.justPressed.has('ArrowDown') || this.justPressed.has('KeyS');
    const statsPagePrevPressed =
      this.justPressed.has('ArrowLeft') ||
      this.justPressed.has('KeyA');
    const statsPageNextPressed =
      this.justPressed.has('ArrowRight') ||
      this.justPressed.has('KeyD') ||
      this.justPressed.has('KeyS') ||
      this.justPressed.has('Tab');
    const summaryScrollUp = this.justPressed.has('ArrowUp') || this.justPressed.has('KeyW');
    const summaryScrollDown = this.justPressed.has('ArrowDown');

    const selectPressed = Boolean(gp?.selectDown && !this._prevGpSelect);
    if (selectPressed) {
      this.toggleCrt();
    }

    // Unlock Web Audio automatically on first gamepad press too
    if (kickPressed || passPressed || catchPressed || startPressed || pausePressed) {
      sound.ensureContext();
    }

    this._prevKickHeld = kickHeld;
    this._prevGpKick = Boolean(gp?.kickDown);
    this._prevGpPass = Boolean(gp?.passDown);
    this._prevGpCatch = Boolean(gp?.catchDown);
    this._prevGpSelect = Boolean(gp?.selectDown);
    this._prevGpStart = Boolean(gp?.startDown);

    return {
      mx,
      my,
      kickPressed,
      kickHeld,
      kickReleased,
      passPressed,
      catchPressed,
      startPressed,
      pausePressed,
      restartPressed,
      quitPressed,
      escapePressed,
      replayIntroPressed,
      optionsPressed,
      teamSelectPressed,
      tabPressed,
      demoPressed,
      exitDemoPressed,
      menuTogglePressed,
      menuUpPressed,
      menuDownPressed,
      statsPagePrevPressed,
      statsPageNextPressed,
      summaryScrollUp,
      summaryScrollDown,
    };
  }

  activateOptionRow(row) {
    switch (row) {
      case 0:
        this.toggleUniformMode();
        break;
      case 1:
        this.toggleWeather();
        break;
      case 2:
        this.toggleRotateLunchView();
        break;
      case 3:
        sound.cycleMusicTrack();
        sound.playMenuSelect();
        break;
      case 4:
        sound.toggleMusic();
        sound.playMenuSelect();
        break;
      case 5:
        sound.toggleMute();
        break;
      case 6:
        this.toggleCrt();
        sound.playMenuSelect();
        break;
      case 7:
        this.returnToTitle();
        break;
      default:
        break;
    }
  }

  toggleStatsPage(dir = 1) {
    const idx = STATS_PAGES.indexOf(this.statsPage);
    const nextIdx = (idx + dir + STATS_PAGES.length) % STATS_PAGES.length;
    this.statsPage = STATS_PAGES[nextIdx];
    this.summaryScroll = 0;
    sound.playMenuSelect();
    return this.statsPage;
  }

  scrollSummary(delta) {
    const maxScroll = Math.max(0, this.goalLog.length - 7);
    this.summaryScroll = Math.max(0, Math.min(maxScroll, this.summaryScroll + delta));
  }

  openTeamSelect(useCurrentPlayers = false) {
    this.isDemo = false;
    this.titleIdleFrames = 0;
    this.draftCursor = 0;
    if (useCurrentPlayers && this.players.length === 8) {
      const home = this.players.filter((p) => p.team === 'home').map((p) => p.name);
      const away = this.players.filter((p) => p.team === 'away').map((p) => p.name);
      this.draftSlots = [...home, ...away];
    } else {
      this.randomizeDraftSlots(true);
    }
    this.state = 'TEAM_SELECT';
    sound.playMenuSelect();
  }

  randomizeDraftSlots(silent = false) {
    const { homePlayers, awayPlayers } = draftRecessTeams();
    this.draftSlots = [...homePlayers.map((p) => p.name), ...awayPlayers.map((p) => p.name)];
    if (!silent) sound.playMenuSelect();
  }

  cycleDraftSlot(slotIdx, dir = 1) {
    if (!this.draftSlots || this.draftSlots.length !== 8) return;
    const curName = this.draftSlots[slotIdx];
    const curIdx = Math.max(0, CLASSMATES.findIndex((c) => c.name === curName));
    const takenElsewhere = new Set(this.draftSlots.filter((_, i) => i !== slotIdx));
    // Step cleanly to the next available (undrafted) classmate without disturbing any other slot!
    for (let step = 1; step <= CLASSMATES.length; step++) {
      const candidate = CLASSMATES[(curIdx + dir * step + CLASSMATES.length * 2) % CLASSMATES.length];
      if (!takenElsewhere.has(candidate.name)) {
        this.draftSlots[slotIdx] = candidate.name;
        break;
      }
    }
    sound.playMenuSelect();
  }

  returnToTitle() {
    this.isDemo = false;
    this.titleIdleFrames = 0;
    this.kickCharge = 0;
    this.passTarget = null;
    this.state = 'TITLE';
    sound.updateMusic('TITLE', false);
    sound.playMenuSelect();
  }

  returnToBoot() {
    this.isDemo = false;
    this.titleIdleFrames = 0;
    this.kickCharge = 0;
    this.passTarget = null;
    this.bootChant = pickBootChant(this.bootChant?.id);
    this.bootFrames = 0;
    this.state = 'BOOT';
    sound.updateMusic('BOOT', false);
  }

  // Uninterruptible secret post-credits stinger after Widor Toccata:
  // SMCS crest rotates slowly and locks upright at the end of Palestrina's Missa Papae Marcelli Gloria "Amen"!
  startPostCredits() {
    this.isDemo = false;
    this.titleIdleFrames = 0;
    this.kickCharge = 0;
    this.passTarget = null;
    this.postCreditsFrames = 0;
    sound.stopBootVoice();
    this.state = 'POST_CREDITS';
    sound.updateMusic('POST_CREDITS', false);
  }

  // === MAIN FIXED-TIMESTEP UPDATE (60Hz) ===
  update() {
    this.tick++;
    const input = this.readInput();
    this.justPressed.clear();

    // Keep live 4-voice chiptune Sicut Cervus synced with match state & final-seconds rush!
    sound.updateMusic(this.state, this.state === 'PLAYING' && this.clockFrames <= 15 * 60);

    // Uninterruptible post-credits scene (Palestrina Missa Papae Marcelli "Amen" + rotating SMCS crest)!
    if (this.state === 'POST_CREDITS') {
      this.postCreditsFrames++;
      if (this.postCreditsFrames >= MARCELLI_AMEN_TIMING.totalFrames) {
        this.returnToBoot();
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (input.statsPagePrevPressed) {
        this.toggleStatsPage(-1);
      } else if (input.statsPageNextPressed) {
        this.toggleStatsPage(1);
      } else if (this.statsPage === 'summary' && input.summaryScrollUp) {
        this.scrollSummary(-1);
      } else if (this.statsPage === 'summary' && input.summaryScrollDown) {
        this.scrollSummary(1);
      } else if (input.pausePressed) {
        this.state = this.prevState;
        sound.playMenuSelect();
      } else if (input.restartPressed) {
        sound.playMenuSelect();
        this.startNewMatch();
      } else if (input.quitPressed) {
        this.returnToTitle();
      }
      return;
    }

    // Update particles & floating arcade text when not paused
    this.updateEffects();

    if (this.state === 'BOOT') {
      this.bootFrames++;
      const chant = this.bootChant;
      if (this.bootFrames === 1) {
        sound.preloadBootVoice();
        sound.playBootChant(chant.id);
      }
      // Fallback synth sting only if the sung chant clip isn't loaded
      if (this.bootFrames === chant.spinFrames && !sound.hasBootChant(chant.id)) {
        sound.playBootSting();
      }
      // Right as Gloria / Magnificat finishes & the spinning crest locks in -> "IN LUDO EST!"
      if (this.bootFrames === chant.voiceFrame) {
        sound.playBootVoice();
      }
      const skip =
        this.bootFrames > 14 &&
        (input.startPressed || input.kickPressed || input.passPressed || input.catchPressed);
      if (skip || this.bootFrames >= chant.totalFrames) {
        if (skip) sound.stopBootVoice();
        this.state = 'TITLE';
      }
      return;
    }

    if (this.state === 'TEAM_SELECT') {
      if (input.menuUpPressed) {
        this.draftCursor = (this.draftCursor - 1 + 8) % 8;
        sound.playMenuSelect();
        return;
      }
      if (input.menuDownPressed) {
        this.draftCursor = (this.draftCursor + 1) % 8;
        sound.playMenuSelect();
        return;
      }
      if (input.tabPressed || input.passPressed) {
        // Quick jump between HOME column (0..3) and AWAY column (4..7) at the same position!
        this.draftCursor = (this.draftCursor + 4) % 8;
        sound.playMenuSelect();
        return;
      }
      if (input.statsPagePrevPressed) {
        this.cycleDraftSlot(this.draftCursor, -1);
        return;
      }
      if (input.statsPageNextPressed && !input.menuDownPressed) {
        this.cycleDraftSlot(this.draftCursor, 1);
        return;
      }
      if (input.restartPressed) {
        this.randomizeDraftSlots();
        return;
      }
      if (input.escapePressed || input.quitPressed) {
        this.returnToTitle();
        return;
      }
      if (input.startPressed || input.kickPressed || input.catchPressed) {
        sound.playMenuSelect();
        this.startNewMatch(false, {
          homeNames: this.draftSlots.slice(0, 4),
          awayNames: this.draftSlots.slice(4, 8),
        });
      }
      return;
    }

    if (this.state === 'OPTIONS') {
      const OPTION_COUNT = 8;
      if (input.menuUpPressed) {
        this.optionsCursor = (this.optionsCursor - 1 + OPTION_COUNT) % OPTION_COUNT;
        sound.playMenuSelect();
        return;
      }
      if (input.menuDownPressed) {
        this.optionsCursor = (this.optionsCursor + 1) % OPTION_COUNT;
        sound.playMenuSelect();
        return;
      }
      if (input.escapePressed || input.quitPressed || input.optionsPressed) {
        this.returnToTitle();
        return;
      }
      if (
        input.menuTogglePressed ||
        input.startPressed ||
        input.kickPressed ||
        input.passPressed ||
        input.catchPressed
      ) {
        this.activateOptionRow(this.optionsCursor);
      }
      return;
    }

    if (this.state === 'TITLE') {
      this.titleIdleFrames++;
      if (input.replayIntroPressed) {
        sound.ensureContext();
        // Shift+I on Title Screen lets you preview the secret Palestrina "Amen" post-credits stinger!
        if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
          this.startPostCredits();
          return;
        }
        this.titleIdleFrames = 0;
        this.bootChant = pickBootChant(this.bootChant?.id);
        this.bootFrames = 0;
        this.state = 'BOOT';
        return;
      }
      if (input.teamSelectPressed) {
        this.openTeamSelect(false);
        return;
      }
      if (input.optionsPressed) {
        this.titleIdleFrames = 0;
        this.optionsCursor = 0;
        this.state = 'OPTIONS';
        sound.playMenuSelect();
        return;
      }
      if (input.menuUpPressed) {
        this.titleIdleFrames = 0;
        this.titleCursor = (this.titleCursor - 1 + 4) % 4;
        sound.playMenuSelect();
        return;
      }
      if (input.menuDownPressed) {
        this.titleIdleFrames = 0;
        this.titleCursor = (this.titleCursor + 1) % 4;
        sound.playMenuSelect();
        return;
      }
      if (input.menuTogglePressed) {
        this.titleIdleFrames = 0;
        this.toggleUniformMode();
      }
      if (input.demoPressed || this.titleIdleFrames >= 600) {
        if (input.demoPressed) sound.playMenuSelect();
        this.startDemoMatch();
        return;
      }
      if (input.startPressed || input.kickPressed || input.passPressed || input.catchPressed) {
        sound.playMenuSelect();
        if (this.titleCursor === 1) {
          this.openTeamSelect(false);
        } else if (this.titleCursor === 2) {
          this.titleIdleFrames = 0;
          this.optionsCursor = 0;
          this.state = 'OPTIONS';
        } else if (this.titleCursor === 3) {
          this.startDemoMatch();
        } else {
          this.startNewMatch(false);
        }
      }
      return;
    }

    // In Demo Mode (CPU vs CPU): Escape/P returns to Title, Enter/Z/X/Space jumps straight into a 1P match!
    if (this.isDemo) {
      if (input.exitDemoPressed) {
        sound.playMenuSelect();
        this.isDemo = false;
        this.titleIdleFrames = 0;
        this.state = 'TITLE';
        return;
      }
      if (input.startPressed || input.kickPressed || input.passPressed || input.catchPressed) {
        sound.playMenuSelect();
        this.startNewMatch(false);
        return;
      }
    }

    // During the opening Starting Lineups card: L edits teams, Enter/Z/X/Space drops the ball right away!
    const lineupOverlayActive = this.state === 'FACEOFF' && this.showLineups && this.stateTimer > 38;
    if (!this.isDemo && lineupOverlayActive && input.teamSelectPressed) {
      this.openTeamSelect(true);
      return;
    }
    if (
      !this.isDemo &&
      lineupOverlayActive &&
      this.stateTimer < 196 &&
      (input.startPressed || input.kickPressed || input.passPressed || input.catchPressed)
    ) {
      sound.playMenuSelect();
      this.stateTimer = 38;
      return;
    }

    if (
      !this.isDemo &&
      input.pausePressed &&
      (this.state === 'PLAYING' ||
        this.state === 'FACEOFF' ||
        this.state === 'RESTART' ||
        this.state === 'GOAL_CELEBRATION')
    ) {
      this.prevState = this.state;
      this.state = 'PAUSED';
      sound.playMenuSelect();
      return;
    }

    if (this.state === 'FACEOFF') {
      this.stateTimer--;
      // Let tennis ball drop and bounce dramatically at center chalk circle!
      if (this.stateTimer < 38) {
        stepBallPhysics(
          this.ball,
          {
            onBounce: (v) => {
              sound.playBounce(v);
              this.spawnParticles(this.ball.x, this.ball.y, '#e9eef4', 4);
            },
          },
          this.court
        );
      }
      this.updateCamera();
      if (this.stateTimer <= 0) {
        this.showLineups = false;
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'RESTART') {
      this.stateTimer--;
      this.updateCamera();
      const playerReady =
        this.restartTeam === 'home' &&
        (input.mx !== 0 || input.my !== 0 || input.passPressed || input.kickPressed);
      if (this.stateTimer <= 0 || (this.stateTimer < 26 && playerReady)) {
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'BASEMENT_56') {
      this.stateTimer--;
      // Ball gently rolls deeper down into the dark stairwell
      if (this.court.basementStairs) {
        this.ball.x = Math.max(this.court.basementStairs.x1 + 6, this.ball.x - 0.6);
      }
      this.updateCamera();
      if (this.stateTimer <= 0) {
        this.startBasement56Restart(this.restartTeam || 'home');
      }
      return;
    }

    if (this.state === 'GOAL_CELEBRATION') {
      this.stateTimer--;
      // Scorer pumps fists / skates around celebrating!
      if (this.lastScorer) {
        this.lastScorer.catchAnim = 10;
      }
      stepBallPhysics(this.ball, {}, this.court);
      this.updateCamera();
      if (this.stateTimer <= 0) {
        // Post-goal possession rule: team that gave up the goal restarts with the ball!
        const concedingTeam = this.lastGoalTeam === 'home' ? 'away' : 'home';
        this.startPostGoalRestart(concedingTeam);
      }
      return;
    }

    if (this.state === 'PERIOD_END') {
      if (input.quitPressed) {
        this.returnToTitle();
        return;
      }
      this.stateTimer--;
      const autoNext = this.isDemo ? this.stateTimer <= -30 : this.stateTimer < -90;
      if (this.stateTimer <= 0 && (input.startPressed || input.kickPressed || input.passPressed || autoNext)) {
        this.period++;
        this.clockFrames = this.getCurrentPeriodInfo().seconds * 60;
        this.startFaceoff();
        sound.playRecessBell();
      }
      return;
    }

    if (this.state === 'GAME_OVER') {
      this.stateTimer++;
      if (this.isDemo) {
        const pageSpan = Math.floor(MATCH.demoGameOverFrames / STATS_PAGES.length);
        if (this.stateTimer === pageSpan) {
          this.statsPage = STATS_PAGES[1]; // PLAYERS
          this.summaryScroll = 0;
        } else if (this.stateTimer === pageSpan * 2) {
          this.statsPage = STATS_PAGES[2]; // SUMMARY
          this.summaryScroll = 0;
        }
        if (this.stateTimer >= MATCH.demoGameOverFrames) {
          this.isDemo = false;
          this.titleIdleFrames = 0;
          this.state = 'TITLE';
          sound.updateMusic('TITLE', false);
        }
        return;
      }
      // Once Widor's Toccata finishes playing, launch the uninterruptible Palestrina "Amen" post-credits scene!
      if (sound.consumePostludeFinished()) {
        this.startPostCredits();
        return;
      }
      if (input.statsPagePrevPressed) {
        this.toggleStatsPage(-1);
        return;
      }
      if (input.statsPageNextPressed) {
        this.toggleStatsPage(1);
        return;
      }
      if (this.statsPage === 'summary' && input.summaryScrollUp) {
        this.scrollSummary(-1);
        return;
      }
      if (this.statsPage === 'summary' && input.summaryScrollDown) {
        this.scrollSummary(1);
        return;
      }
      // Lock exiting the final stats screen for 15 seconds so pressing buttons at the buzzer never skips stats!
      if (this.stateTimer < MATCH.gameOverLockFrames) {
        return;
      }
      if (input.quitPressed || input.escapePressed) {
        this.returnToTitle();
        return;
      }
      if (input.startPressed || input.kickPressed || input.passPressed) {
        sound.playMenuSelect();
        this.startNewMatch(false);
      }
      return;
    }

    // === PLAYING STATE ===
    this.clockFrames--;
    if (this.ball.owner) {
      this.stats[this.ball.owner.team].possessionFrames++;
    }
    if (this.clockFrames <= 0) {
      sound.playRecessBell();
      if (this.period < MATCH.periods) {
        this.state = 'PERIOD_END';
        this.stateTimer = 75;
      } else {
        this.state = 'GAME_OVER';
        this.stateTimer = 0;
      }
      return;
    }

    if (!this.isDemo) {
      this.handlePlayerControl(input);
    } else {
      this.passTarget = null;
      this.kickCharge = 0;
    }

    // Update all players (AI + physics integration + timers)
    const isSnow = this.weather === 'snow';
    const skaterFriction = isSnow ? 0.942 : PHYSICS.playerFriction;

    for (const p of this.players) {
      if (p.kickTimer > 0) p.kickTimer--;
      if (p.catchAnim > 0) p.catchAnim--;
      if (p.stealCooldown > 0) p.stealCooldown--;
      if (p.aiDecisionCooldown > 0) p.aiDecisionCooldown--;
      if (p.diveTimer > 0) p.diveTimer--;
      if (p.jacketTimer > 0) p.jacketTimer--;
      if (p.gloveTimer > 0) p.gloveTimer--;
      if (p.throwTimer > 0) p.throwTimer--;
      if (p.stunTimer > 0) p.stunTimer--;

      if (p.role === 'G') {
        updateGoalie(p, this);
        continue;
      }

      if ((this.isDemo || p.id !== this.controlledId) && p.stunTimer <= 0) {
        updateSkaterAI(p, this);
      }

      const prevX = p.x;
      const prevY = p.y;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= skaterFriction;
      p.vy *= skaterFriction;

      // Checked skater slamming into the flexible left wall makes it bow & ripple from impact!
      const slammedLeftWall = p.stunTimer > 0 && p.x <= this.court.bounds.left + 8 && p.vx < -0.5;
      const impactVx = Math.abs(p.vx);
      clampPlayerToCourt(
        p,
        this.court.bounds,
        this.court.basementStairs,
        this.court.cornerStairs,
        this.court.protrudingRoom
      );
      if (slammedLeftWall) {
        this.triggerLeftWallGive(p.y, Math.min(1.15, Math.max(0.65, impactVx / 2.8)));
        // Springy wall flex rebounds the checked player gently back onto the blacktop!
        p.vx = impactVx * 0.42 + 0.95;
      }

      // Kick up crisp white snow spray when carving hard in Snow Day weather!
      if (isSnow && Math.hypot(p.vx, p.vy) > 1.25 && this.tick % 5 === 0) {
        this.spawnParticles(p.x, p.y + 1, '#ffffff', 1);
      }

      // Enforce recess catch-and-drop rule: can't run across the yard holding the ball!
      if (p.holdingBall && this.ball.owner === p) {
        p.holdFrames++;
        p.holdDist += Math.hypot(p.x - prevX, p.y - prevY);
        if (p.holdFrames >= PHYSICS.maxHoldFrames || p.holdDist >= PHYSICS.maxHoldSteps) {
          dropHeldBall(this.ball, p);
          this.onDropEffect(p, 'AUTO-DROP!');
        }
      }
    }

    // Soft skater-vs-skater body spacing
    this.resolvePlayerCollisions();

    // Update both live corner basketball games (top-left & lower-left) & check in-play interference!
    for (const h of this.hoopsGames) {
      updateCornerBasketball(h, this);
    }

    // Step 2.5D tennis ball physics & check goal across 66 Bond's asymmetrical nets!
    const goalEvent = stepBallPhysics(
      this.ball,
      {
        onBounce: (v) => {
          sound.playBounce(v);
          this.spawnParticles(this.ball.x, this.ball.y, isSnow ? '#ffffff' : '#e9eef4', 3);
        },
        onFenceHit: () => {
          sound.playFenceHit();
          this.spawnParticles(this.ball.x, this.ball.y, '#b9c4d0', 4);
          if (this.ball.x <= this.court.bounds.left + 8 && Math.abs(this.ball.vx) > 2.0) {
            this.triggerLeftWallGive(this.ball.y, Math.min(0.55, Math.abs(this.ball.vx) / 9), true);
          }
        },
        onGrillHit: () => {
          sound.playPostHit();
          this.spawnParticles(this.ball.x, this.ball.y, '#d6dee8', 6);
          this.addCallout(this.ball.x, this.ball.y + 10, 'GRILL!', '#9be8ff');
        },
        onPostHit: (netId) => {
          sound.playPostHit();
          this.goalShake[netId] = 10;
          this.addCallout(this.ball.x, this.ball.y - 10, 'POST!', '#ffbe3b');
        },
      },
      this.court,
      this.getTeamNetMap(),
      isSnow
    );

    if (goalEvent) {
      if (goalEvent.basement56) {
        this.handleBasement56(goalEvent.faultTeam);
      } else {
        this.handleGoalScored(goalEvent.scoredBy, goalEvent.goalSide);
      }
      return;
    }

    // Check ball pickup by feet (when loose & near ground)
    this.checkLooseBallPickup();

    // Auto-switch controlled player if teammate receives a pass!
    if (this.ball.owner && this.ball.owner.team === 'home' && this.ball.owner.role !== 'G') {
      this.controlledId = this.ball.owner.id;
    }

    this.updateCamera();
  }

  handlePlayerControl(rawInput) {
    // When Lunch Recess rotates the map 90° CCW so the right net is at the TOP of the screen,
    // remap directional stick/arrow input so pressing UP always skates & aims UP toward the net!
    const input = this.isCameraRotated()
      ? { ...rawInput, mx: -rawInput.my, my: rawInput.mx }
      : rawInput;

    const p = this.getControlledPlayer();
    const { ball } = this;

    // Update highlighted deliberate pass/throw target whenever our controlled player owns the ball
    if (ball.owner === p) {
      this.passTarget = this.findPassTarget(p, input);
    } else {
      this.passTarget = null;
    }

    // === SPECIAL CASE: HOME GOALIE HOLDING THE BALL -> AIM & THROW ACROSS THE WHOLE FIELD! ===
    if (p.role === 'G') {
      if (!p.holdingBall || ball.owner !== p) {
        // Return control to nearest skater once goalie no longer holds ball
        const skater = this.findNearestPlayer(ball.x, ball.y, 'home', true);
        if (skater) this.controlledId = skater.id;
        return;
      }

      // Let player aim across the schoolyard with Arrows/WASD (doesn't walk goalie out of crease)
      if (input.mx !== 0 || input.my !== 0) {
        const mag = Math.hypot(input.mx, input.my) || 1;
        p.facingX = input.mx / mag;
        p.facingY = input.my / mag;
      }

      if (input.passPressed) {
        // Deliberate accurate overhand throw to the highlighted teammate (short, mid, or full-court!)
        this.executeGoalieThrow(p, this.passTarget, false);
        return;
      }
      if (input.kickPressed) {
        // Full-field BOMB throw! Faster high-velocity baseball heave downfield!
        this.executeGoalieThrow(p, this.passTarget, true);
        return;
      }
      if (input.catchPressed) {
        // Quick short underhand toss just out from the crease
        const net = this.getDefendNet('home');
        const tx = p.x + net.normalX * 42 + input.mx * 24;
        const ty = p.y + net.normalY * 42 + input.my * 24;
        const info = launchThrow(ball, p, tx, ty, { isBomb: false, landZ: 2 });
        const next = this.findNearestPlayer(tx, ty, 'home', true);
        if (next) this.controlledId = next.id;
        this.onThrowEffect(p, info.dist > 165, 'TOSS!');
        return;
      }
      return;
    }

    // 8-way schoolyard footwork movement (slows during slap-kick wind-up or while holding ball; slippery in Snow!)
    if (p.stunTimer > 0) return;
    if (input.mx !== 0 || input.my !== 0) {
      const mag = Math.hypot(input.mx, input.my) || 1;
      const nx = input.mx / mag;
      const ny = input.my / mag;
      const isSnow = this.weather === 'snow';
      const speedMod = p.holdingBall ? 0.45 : p.windupFrames >= SHOT.hardMinFrames ? 0.56 : 1;
      const agilityMod = 0.82 + (p.stats.control ?? 0.85) * 0.24;
      const accel = (isSnow ? 0.19 : PHYSICS.playerAccel) * speedMod * agilityMod;
      const maxSpd = p.stats.speed * speedMod * (isSnow ? 1.07 : 1);
      p.vx += nx * accel;
      p.vy += ny * accel;
      const cur = Math.hypot(p.vx, p.vy);
      if (cur > maxSpd) {
        p.vx = (p.vx / cur) * maxSpd;
        p.vy = (p.vy / cur) * maxSpd;
      }
      p.facingX = nx;
      p.facingY = ny;
    }

    // === ACTION 1: WHILE HOLDING A CAUGHT TENNIS BALL ===
    if (p.holdingBall && ball.owner === p) {
      if (input.catchPressed || input.passPressed) {
        // Drop cleanly at feet to dribble & play!
        dropHeldBall(ball, p);
        this.onDropEffect(p, 'DROP!');
        return;
      }
      if (input.kickPressed) {
        // Signature schoolyard DROP-KICK volley!
        const aim = this.getAimVector(p, input);
        launchBall(ball, p, aim.x, aim.y, p.stats.kick * 1.18, 3.1, { startZ: 5 });
        this.onKickEffect(p.x, p.y, 'DROP-KICK!', '#d9ff2e', true);
        return;
      }
      return;
    }

    // === ACTION 2: DRIBBLING BALL AT FEET ===
    if (ball.owner === p) {
      // Deliberate Pass (X / K) — works anytime AND cancels a hard-shot wind-up just like NHL '94!
      if (input.passPressed) {
        this.kickCharge = 0;
        p.windupFrames = 0;
        this.executeDeliberatePass(p, this.passTarget, input);
        return;
      }

      // Scoop-catch own ball with C / Space (great to set up a drop-kick!)
      if (input.catchPressed) {
        this.kickCharge = 0;
        p.windupFrames = 0;
        catchBall(ball, p);
        this.stats.home.catches++;
        if (p.matchStats) p.matchStats.catches++;
        this.onCatchEffect(p);
        return;
      }

      // Two-tier NHL '94 Shooting on Z / J:
      // - TAP (< 10 frames): QUICK SHOT (instant low-mid snap kick!)
      // - HOLD (>= 10 frames): HARD SHOT / SLAP-KICK (leg cocks back, charges power, screaming shot!)
      if (input.kickHeld) {
        this.kickCharge++;
        p.windupFrames = this.kickCharge;
        if (this.kickCharge === SHOT.hardMinFrames) {
          sound.playWindupTick();
        }
      }

      const subFrameTap = input.kickPressed && !input.kickHeld;
      const autoFire = this.kickCharge >= SHOT.hardAutoFireFrames && input.kickHeld;
      if (subFrameTap || (input.kickReleased && this.kickCharge > 0) || autoFire) {
        const isHardShot = this.kickCharge >= SHOT.hardMinFrames;
        const aim = this.getAimVector(p, input);
        if (isHardShot) {
          const chargeRatio = Math.min(
            1,
            (this.kickCharge - SHOT.hardMinFrames) / (SHOT.hardFullFrames - SHOT.hardMinFrames)
          );
          const mult = SHOT.hardMinSpeedMult + chargeRatio * (SHOT.hardMaxSpeedMult - SHOT.hardMinSpeedMult);
          const speed = p.stats.kick * mult;
          launchBall(ball, p, aim.x, aim.y, speed, SHOT.hardLoft, {
            shotPower: speed,
            kickTimer: 15,
          });
          this.onKickEffect(p.x, p.y, chargeRatio > 0.75 ? 'SLAP-KICK!' : 'HARD SHOT!', '#ff6d2e', true);
        } else {
          // Instant crisp QUICK SHOT!
          const speed = p.stats.kick * SHOT.quickSpeedMult;
          launchBall(ball, p, aim.x, aim.y, speed, SHOT.quickLoft, {
            shotPower: speed,
            kickTimer: 9,
          });
          this.onKickEffect(p.x, p.y, 'QUICK SHOT', '#ffe84d', false);
        }
        this.kickCharge = 0;
        p.windupFrames = 0;
        return;
      }
      return;
    }

    this.kickCharge = 0;
    p.windupFrames = 0;

    // === ACTION 3: WITHOUT BALL (DEFENSE / ONE-TIMER / CATCH INTERCEPT!) ===

    // NHL '94 ONE-TIMER! If a pass/throw is coming toward this player and you hit SHOOT!
    if (
      input.kickPressed &&
      !ball.owner &&
      ball.passTimer > 0 &&
      ball.passTargetId === p.id &&
      Math.hypot(ball.x - p.x, ball.y - p.y) < 34
    ) {
      const targetNet = this.getAttackNet('home');
      const aimX = targetNet.centerX + (-targetNet.normalY) * (input.mx * 20) - p.x;
      const aimY = targetNet.centerY + targetNet.normalX * (input.my * 20) - p.y;
      const speed = p.stats.kick * 1.38;
      launchBall(ball, p, aimX, aimY, speed, targetNet.maxZ > 22 ? 2.5 : 1.7, { startZ: 3, shotPower: speed });
      this.onKickEffect(p.x, p.y, 'ONE-TIMER!', '#ff8c2e', true);
      return;
    }

    // CATCH / INTERCEPT! Press C / Space to snag a loose, bouncing, or thrown tennis ball!
    // Hands rating scales catch reach, snag height, and cleanly catching blistering fast shots!
    if (input.catchPressed) {
      p.catchAnim = 12;
      const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
      const isOppGoalieClear = ball.isThrow && ball.lastTouchTeam !== p.team && ball.throwGrace > 0;
      const hands = p.stats.hands ?? 0.85;
      const baseReach = ball.passTargetId === p.id ? PHYSICS.catchReach + 9 : PHYSICS.catchReach + 4;
      const catchRadius = baseReach * (0.78 + hands * 0.28);
      const catchMaxZ = PHYSICS.catchMaxZ * (0.78 + hands * 0.28);
      if (!ball.owner && !isOppGoalieClear && dist <= catchRadius && ball.z <= catchMaxZ) {
        const ballSpeed = Math.hypot(ball.vx, ball.vy);
        const bobbleRisk = ballSpeed > 5.5 && hands < 0.72 ? (0.75 - hands) * 0.85 : 0;
        if (bobbleRisk > 0 && Math.random() < bobbleRisk) {
          // Butterfingers! Bobbles a blistering shot instead of catching cleanly
          ball.vx = p.facingX * 1.4 + (Math.random() - 0.5) * 1.8;
          ball.vy = p.facingY * 1.4 + (Math.random() - 0.5) * 1.8;
          ball.vz = 1.6;
          ball.pickupCooldown = 10;
          sound.playBounce(0.7);
          this.addCallout(p.x, p.y - 18, 'BOBBLED!', '#ffbe3b');
          return;
        }
        catchBall(ball, p);
        this.stats.home.catches++;
        if (p.matchStats) p.matchStats.catches++;
        this.onCatchEffect(p);
        return;
      }
    }

    // SWITCH PLAYER (X / K) — NHL '94 classic switch to closest skater to ball!
    if (input.passPressed) {
      const next = this.findNearestPlayer(ball.x, ball.y, 'home', true, p.id);
      if (next) {
        this.controlledId = next.id;
        sound.playMenuSelect();
      }
      return;
    }

    // POKE-STEAL / LUNGE KICK (Z / J)
    if (input.kickPressed && p.stealCooldown <= 0) {
      this.attemptSteal(p);
    }
  }

  executeDeliberatePass(p, target, input) {
    const { ball } = this;
    const bounds = this.court.bounds;
    if (target) {
      const rawDist = Math.hypot(target.x - p.x, target.y - p.y);
      // Scale pass speed smoothly with distance so both crisp short passes and cross-yard feeds land on the tape!
      const speed = Math.max(4.2, Math.min(6.6, rawDist * 0.022 + 3.4));
      const leadFrames = Math.min(18, rawDist / speed);
      const tx = Math.max(bounds.left + 12, Math.min(bounds.right - 12, target.x + target.vx * leadFrames * 0.7));
      const ty = Math.max(bounds.top + 12, Math.min(bounds.bottom - 12, target.y + target.vy * leadFrames * 0.7));
      const dx = tx - p.x;
      const dy = ty - p.y;
      const loft = rawDist > 130 ? 1.5 : 0.7;
      launchBall(ball, p, dx, dy, speed, loft, {
        passTargetId: target.id,
        passTimer: Math.max(PHYSICS.oneTimerWindow, Math.round(leadFrames) + 18),
        shotPower: 0,
      });
      this.controlledId = target.id;
      this.stats[p.team].passes++;
      if (p.matchStats) p.matchStats.passes++;
      sound.playPass();
      this.spawnParticles(p.x, p.y, '#7ae8ff', 5);
    } else {
      const aim = this.getAimVector(p, input);
      launchBall(ball, p, aim.x, aim.y, 4.4, 0.7, { shotPower: 0 });
      this.stats[p.team].passes++;
      if (p.matchStats) p.matchStats.passes++;
      sound.playPass();
    }
  }

  executeGoalieThrow(g, target, isBomb = false) {
    const { ball } = this;
    const bounds = this.court.bounds;
    const mates = this.players.filter((m) => m.team === g.team && m.role !== 'G');
    const receiver = target || mates[0];
    if (!receiver) return;

    // Predict where receiver is heading so full-field throws lead them cleanly in stride!
    const approxDist = Math.hypot(receiver.x - g.x, receiver.y - g.y);
    const leadFrames = Math.min(26, approxDist * 0.09);
    const tx = Math.max(bounds.left + 14, Math.min(bounds.right - 14, receiver.x + receiver.vx * leadFrames * 0.55));
    const ty = Math.max(bounds.top + 18, Math.min(bounds.bottom - 18, receiver.y + receiver.vy * leadFrames * 0.55));

    const info = launchThrow(ball, g, tx, ty, {
      passTargetId: receiver.id,
      isBomb,
      landZ: 5,
    });

    if (g.team === 'home') {
      this.controlledId = receiver.id;
    }
    this.stats[g.team].passes++;
    if (g.matchStats) g.matchStats.passes++;
    this.onThrowEffect(g, info.dist > 165 || isBomb);
  }

  getAimVector(p, input) {
    if (input.mx !== 0 || input.my !== 0) {
      return { x: input.mx, y: input.my };
    }
    // Slight aim assist toward the team's current attack net if facing generally toward it
    const targetNet = this.getAttackNet(p.team);
    const toNetX = targetNet.centerX - p.x;
    const toNetY = targetNet.centerY - p.y;
    const dist = Math.hypot(toNetX, toNetY) || 1;
    const align = (toNetX / dist) * p.facingX + (toNetY / dist) * p.facingY;
    if (align > 0.35) {
      return { x: toNetX, y: toNetY };
    }
    return { x: p.facingX, y: p.facingY };
  }

  findPassTarget(p, input) {
    const mates = this.players.filter((m) => m.team === p.team && m.id !== p.id && m.role !== 'G');
    if (!mates.length) return null;

    const hasStickAim = input.mx !== 0 || input.my !== 0;
    const ax = hasStickAim ? input.mx : p.facingX;
    const ay = hasStickAim ? input.my : p.facingY;
    const amag = Math.hypot(ax, ay) || 1;
    const nx = ax / amag;
    const ny = ay / amag;

    // Goalie throwing can aim all the way across the entire court with zero distance penalty!
    const distWeight = p.role === 'G' ? 0.0005 : hasStickAim ? 0.0018 : 0.0038;
    const alignWeight = hasStickAim ? 3.8 : 2.2;

    let best = mates[0];
    let bestScore = -Infinity;
    for (const m of mates) {
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const align = (dx / dist) * nx + (dy / dist) * ny;
      const score = align * alignWeight - dist * distWeight;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  attemptSteal(p) {
    if (p.stunTimer > 0) return;
    p.kickTimer = 10;
    p.stealCooldown = 22;
    // Quick forward lunge
    p.vx += p.facingX * 1.5;
    p.vy += p.facingY * 1.5;

    const { ball } = this;

    // === BODY CHECK! Legal along the left wall of 66 Bond, and EVERYWHERE when snowing! ===
    const oppTeam = p.team === 'home' ? 'away' : 'home';
    const targetOpp = this.findNearestPlayer(p.x, p.y, oppTeam, true);
    if (
      targetOpp &&
      targetOpp.stunTimer <= 0 &&
      Math.hypot(targetOpp.x - p.x, targetOpp.y - p.y) <= 22 &&
      (this.isBodyCheckLegal(targetOpp.x, targetOpp.y) || this.isBodyCheckLegal(p.x, p.y))
    ) {
      const dx = targetOpp.x - p.x;
      const dy = targetOpp.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      // Checking attribute governs knockback power, stun duration, hit resistance & left-wall flex!
      const hitterChk = p.stats.checking ?? 0.80;
      const victimChk = targetOpp.stats.checking ?? 0.80;
      const impact = Math.max(0.55, Math.min(1.45, 0.88 + (hitterChk - victimChk) * 0.65 + (hitterChk - 0.78) * 0.50));

      targetOpp.vx = nx * (4.2 * impact);
      targetOpp.vy = ny * (4.2 * impact);
      targetOpp.stunTimer = Math.round(36 * impact);
      targetOpp.stunDir = nx >= 0 ? 1 : -1;
      targetOpp.windupFrames = 0;
      targetOpp.stealCooldown = Math.round(36 * impact);
      this.stats[p.team].checks++;
      if (p.matchStats) p.matchStats.checks++;
      this.screenShake = Math.round(6 * impact);
      sound.playBodyCheck();

      const nearLeftWall = targetOpp.x <= this.court.bounds.left + 48;
      if (nearLeftWall && (targetOpp.x <= this.court.bounds.left + 22 || nx < -0.15)) {
        this.triggerLeftWallGive(targetOpp.y, Math.min(1.2, impact));
      }
      this.spawnParticles(targetOpp.x, targetOpp.y, this.weather === 'snow' ? '#ffffff' : '#ffe84d', 12);
      this.addCallout(
        targetOpp.x,
        targetOpp.y - 18,
        nearLeftWall ? 'BOARDED!' : 'BODY CHECK!',
        '#ff6d2e'
      );

      // Pop the tennis ball loose if the checked player had it!
      if (ball.owner === targetOpp) {
        targetOpp.holdingBall = false;
        ball.owner = null;
        ball.vx = nx * 2.2 + (Math.random() - 0.5) * 1.4;
        ball.vy = ny * 2.2 + (Math.random() - 0.5) * 1.4;
        ball.vz = 1.8;
        ball.pickupCooldown = 8;
        recordBallTouch(ball, p);
      }
      return;
    }

    // Standard poke-steal when body checking is not legal or no opponent within check range
    sound.playSteal();
    const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (dist > 20 || ball.z > 10) return;

    if (ball.owner && ball.owner.team !== p.team && ball.owner.role !== 'G') {
      const victim = ball.owner;
      if (!victim.holdingBall) {
        // High ball control (e.g. Paes 0.97, Avery 0.96) resists casual poke-steals; low control (Istvan) gets stripped cleanly!
        const attCtrl = p.stats.control ?? 0.82;
        const defCtrl = victim.stats.control ?? 0.82;
        const stealChance = Math.max(0.45, Math.min(1.0, 0.88 + (attCtrl - defCtrl) * 0.75 - Math.max(0, defCtrl - 0.90) * 2.5));
        if (Math.random() > stealChance) {
          victim.vx += (victim.x - p.x) * 0.08;
          victim.vy += (victim.y - p.y) * 0.08;
          this.addCallout(victim.x, victim.y - 16, 'DEKED!', '#9be8ff');
          return;
        }
        victim.stealCooldown = 26;
        victim.windupFrames = 0;
        ball.owner = p;
        recordBallTouch(ball, p);
        this.stats[p.team].steals++;
        this.spawnParticles(ball.x, ball.y, '#ffe84d', 6);
        this.addCallout(p.x, p.y - 16, 'STEAL!', '#48b8ff');
      }
    } else if (!ball.owner && ball.z < 9) {
      launchBall(ball, p, p.facingX, p.facingY, 3.6, 1.1);
    }
  }

  checkLooseBallPickup() {
    const { ball } = this;
    if (ball.owner) return;

    for (const p of this.players) {
      if (p.role === 'G') continue;
      if (p.stunTimer > 0) continue;
      if (p.stealCooldown > 10) continue;
      if (ball.pickupCooldown > 0 && ball.lastTouchPlayer?.id === p.id) continue;
      // Protect goalie clears from instant opponent steals right as the throw leaves the crease!
      if (ball.throwGrace > 0 && ball.lastTouchTeam !== p.team) continue;

      const isIntendedTarget = ball.passTargetId === p.id && ball.passTimer > 0;
      const maxZ = isIntendedTarget ? 12.5 : 7.5;
      const maxDist = isIntendedTarget ? 14.5 : 10.5;
      if (ball.z > maxZ) continue;

      const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
      if (dist < maxDist) {
        ball.owner = p;
        recordBallTouch(ball, p);
        ball.passTargetId = null;
        ball.passTimer = 0;
        ball.shotPower = 0;
        ball.isThrow = false;
        ball.trail = [];
        return;
      }
    }
  }

  resolvePlayerCollisions() {
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i];
        const b = this.players[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 11.5;
        if (dist < minDist && dist > 0.01) {
          const push = (minDist - dist) * 0.4;
          const nx = dx / dist;
          const ny = dy / dist;
          if (a.role !== 'G') {
            a.x -= nx * push;
            a.y -= ny * push;
          }
          if (b.role !== 'G') {
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }
    }
  }

  handleGoalScored(team, goalSide) {
    const pIdx = Math.max(0, Math.min(2, this.period - 1));
    this.score[team]++;
    this.stats[team].shots++; // True hockey Shot on Goal!
    this.stats[team].periodGoals[pIdx]++;
    this.stats[team].periodShots[pIdx]++;
    this.lastGoalTeam = team;
    this.lastScorer =
      this.ball.lastTouchPlayer && this.ball.lastTouchPlayer.team === team
        ? this.ball.lastTouchPlayer
        : this.players.find((p) => p.team === team && p.role === 'C');

    if (this.lastScorer) {
      if (this.lastScorer.matchStats) {
        this.lastScorer.matchStats.goals++;
        this.lastScorer.matchStats.shots++;
      }
      // Credit Primary & Secondary Assists (true NHL rules: up to 2 distinct teammates prior to scorer!)
      const activeChain =
        this.ball.possessionTeam === team
          ? this.ball.possessionChain
          : this.ball.reboundTeam === team
          ? this.ball.reboundChain
          : [];
      const assisters = activeChain
        .filter((m) => m && m.team === team && m.id !== this.lastScorer.id)
        .slice(-2)
        .reverse(); // [primaryAssist, secondaryAssist]
      for (const a of assisters) {
        if (a.matchStats) a.matchStats.assists++;
      }
      // Compute NHL-style elapsed time in the current recess period (e.g. "0:24", "1:12")
      const pInfo = this.getCurrentPeriodInfo();
      const remSec = Math.max(0, Math.ceil(this.clockFrames / 60));
      const elapsedSec = Math.max(0, Math.min(pInfo.seconds, pInfo.seconds - remSec));
      const timeStr = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;

      const assistNames = assisters.map((a) => a.name);
      const goalCount = this.lastScorer.matchStats ? this.lastScorer.matchStats.goals : 1;
      this.lastGoalInfo = {
        team,
        scorerName: this.lastScorer.name,
        goalCount,
        assists: assistNames,
      };

      this.goalLog.push({
        team,
        name: this.lastScorer.name,
        goalCount,
        assists: assistNames,
        period: this.period,
        periodShort: pInfo.short,
        time: timeStr,
      });
    } else {
      this.lastGoalInfo = {
        team,
        scorerName: null,
        goalCount: 1,
        assists: [],
      };
    }

    this.state = 'GOAL_CELEBRATION';
    this.stateTimer = 145;
    this.goalShake[goalSide] = 18;
    this.screenShake = 10;

    sound.playGoalHorn();
    this.spawnParticles(this.ball.x, this.ball.y, '#ffe84d', 18);
    this.spawnParticles(this.ball.x, this.ball.y, team === 'home' ? '#ff7090' : '#48c6ff', 14);
    const scoredNet = this.court.nets.find((n) => n.id === goalSide) || this.getAttackNet(team);
    this.addCallout(
      scoredNet.centerX + scoredNet.normalX * 26,
      scoredNet.centerY + scoredNet.normalY * 26,
      'GOAL!!',
      '#ffe84d'
    );
  }

  // === FEEDBACK HOOKS ===
  onKickEffect(x, y, label, color, isPower) {
    if (isPower) {
      sound.playPowerKick();
      this.screenShake = 5;
      this.spawnParticles(x, y, '#d9ff2e', 10);
    } else {
      sound.playKick(0.85);
      this.spawnParticles(x, y, '#e9eef4', 5);
    }
    if (label) {
      this.addCallout(x, y - 16, label, color || '#ffe84d');
    }
  }

  onCatchEffect(p) {
    sound.playCatch();
    this.spawnParticles(p.x, p.y - 8, '#d9ff2e', 7);
    this.addCallout(p.x, p.y - 18, 'CAUGHT!', '#d9ff2e');
  }

  onDropEffect(p, label = 'DROP!') {
    sound.playDrop();
    this.spawnParticles(p.x, p.y, '#e9eef4', 4);
    if (label) this.addCallout(p.x, p.y - 16, label, '#9be8ff');
  }

  onThrowEffect(g, isLong = false, customLabel = null) {
    sound.playThrow(isLong);
    this.spawnParticles(g.x + 8, g.y - 10, '#ffe84d', isLong ? 10 : 6);
    const label = customLabel || (isLong ? 'LONG THROW!' : 'THROW!');
    this.addCallout(g.x, g.y - 20, label, isLong ? '#d9ff2e' : '#7ae8ff');
  }

  onHoopsInterference(x, y, label = 'HOOPS!') {
    sound.playBounce(0.95);
    this.spawnParticles(x, y, '#f58c38', 7);
    this.addCallout(x, y - 14, label, '#f58c38');
  }

  onHoopsKickAway(x, y) {
    sound.playKick(0.9);
    this.spawnParticles(x, y, '#f58c38', 8);
    this.addCallout(x, y - 16, 'HEY!!', '#ff9642');
  }

  onGoalieSave(g, type, shooterTeam = null, shooterPlayer = null) {
    const oppTeam = g.team === 'home' ? 'away' : 'home';
    // Only credit a Shot on Goal & Save when stopping an opponent's shot (not a teammate's back-pass!)
    if (shooterTeam !== g.team) {
      const pIdx = Math.max(0, Math.min(2, this.period - 1));
      this.stats[oppTeam].shots++;
      this.stats[oppTeam].periodShots[pIdx]++;
      this.stats[g.team].saves++;
      if (g.matchStats) g.matchStats.saves++;
      if (shooterPlayer && shooterPlayer.team === oppTeam && shooterPlayer.matchStats) {
        shooterPlayer.matchStats.shots++;
      }
      if (type === 'glove') {
        this.stats[g.team].gloveSaves++;
      } else {
        this.stats[g.team].jacketBlocks++;
      }
    }
    if (type === 'glove') {
      sound.playGloveSave();
      this.spawnParticles(g.x + 10, g.y - 8, '#f0b86e', 9);
      this.addCallout(g.x, g.y - 20, 'GLOVE SAVE!', '#ffd84d');
    } else {
      sound.playJacketBlock();
      this.spawnParticles(g.x - 10, g.y - 6, g.jacketColor || '#22a65b', 9);
      this.addCallout(g.x, g.y - 20, 'JACKET BLOCK!', '#6ef0a4');
    }
  }

  spawnParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.5 + Math.random() * 2.1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 16 + Math.floor(Math.random() * 14),
        maxLife: 30,
        color,
        size: Math.random() > 0.5 ? 2 : 1,
      });
    }
  }

  addCallout(x, y, text, color) {
    const bounds = this.court.bounds;
    this.callouts.push({
      x: Math.max(bounds.left + 26, Math.min(bounds.right - 26, x)),
      y: Math.max(bounds.top + 12, Math.min(bounds.bottom - 12, y)),
      text,
      color,
      life: 44,
    });
  }

  triggerLeftWallGive(impactY, strength = 1.0, silent = false) {
    const b = this.court.bounds;
    const clampedY = Math.max(b.top + 8, Math.min(b.bottom - 8, impactY));
    const maxTimer = strength >= 0.7 ? 42 : 24;
    this.leftWallImpact = {
      y: clampedY,
      timer: maxTimer,
      maxTimer,
      strength: Math.max(0.25, Math.min(1.2, strength)),
    };
    if (!silent) {
      sound.playLeftWallFlex();
      this.spawnParticles(b.left + 1, clampedY, this.weather === 'snow' ? '#ffffff' : '#cfd7e6', 8);
    }
  }

  updateEffects() {
    for (const k of Object.keys(this.goalShake)) {
      if (this.goalShake[k] > 0) this.goalShake[k]--;
    }
    if (this.screenShake > 0) this.screenShake--;
    if (this.leftWallImpact && this.leftWallImpact.timer > 0) {
      this.leftWallImpact.timer--;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life--;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    const rotated = this.isCameraRotated();
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      if (rotated) {
        c.x += 0.35; // +worldX is UP on screen when rotated 90° CCW!
      } else {
        c.y -= 0.35;
      }
      c.life--;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    if (this.weather === 'snow' && this.snowflakes) {
      for (const fl of this.snowflakes) {
        fl.x += fl.vx;
        fl.y += fl.vy;
        if (fl.x < 0) fl.x += SCREEN_W;
        if (fl.y > SCREEN_H) {
          fl.y = 0;
          fl.x = Math.random() * SCREEN_W;
        }
      }
    }
  }

  updateCamera(snap = false) {
    const focusX = this.ball.x + (this.ball.owner ? this.ball.owner.facingX * 22 : this.ball.vx * 8);
    const focusY = this.ball.y + (this.ball.owner ? this.ball.owner.facingY * 18 : this.ball.vy * 8);
    const rotated = this.isCameraRotated();
    const viewFocusX = rotated ? focusY : focusX;
    const viewFocusY = rotated ? this.court.worldW - focusX : focusY;
    const mapW = rotated ? this.court.worldH : this.court.worldW;
    const mapH = rotated ? this.court.worldW : this.court.worldH;
    const maxCamX = Math.max(0, mapW - SCREEN_W);
    const maxCamY = Math.max(0, mapH - VIEW_H);
    const targetX = Math.max(0, Math.min(maxCamX, viewFocusX - SCREEN_W / 2));
    const targetY = Math.max(0, Math.min(maxCamY, viewFocusY - VIEW_H / 2));
    if (snap) {
      this.cameraX = targetX;
      this.cameraY = targetY;
    } else {
      this.cameraX += (targetX - this.cameraX) * 0.14;
      this.cameraY += (targetY - this.cameraY) * 0.14;
    }
  }
}
