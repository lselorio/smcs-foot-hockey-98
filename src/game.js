import { COURT, GOAL, MATCH, PHYSICS, SHOT, VIEW_H, WORLD_H } from './constants.js';
import { TEAMS } from './roster.js';
import { sound } from './audio.js';
import {
  catchBall,
  clampPlayerToCourt,
  createBall,
  dropHeldBall,
  launchBall,
  launchThrow,
  stepBallPhysics,
} from './physics.js';
import { updateGoalie, updateSkaterAI } from './ai.js';

function createEmptyTeamStats() {
  return {
    shots: 0,
    passes: 0,
    catches: 0,
    steals: 0,
    saves: 0,
    gloveSaves: 0,
    jacketBlocks: 0,
    possessionFrames: 0,
  };
}

export class FootHockeyGame {
  constructor() {
    this.state = 'TITLE'; // TITLE | FACEOFF | PLAYING | GOAL_CELEBRATION | PERIOD_END | GAME_OVER | PAUSED
    this.prevState = 'PLAYING';
    this.tick = 0;

    this.score = { home: 0, away: 0 };
    this.stats = {
      home: createEmptyTeamStats(),
      away: createEmptyTeamStats(),
    };
    this.goalLog = [];

    this.period = 1;
    this.clockFrames = MATCH.periodSeconds * 60;
    this.stateTimer = 0;
    this.lastScorer = null;
    this.lastGoalTeam = null;

    this.cameraY = COURT.centerY - VIEW_H / 2;
    this.goalShake = { top: 0, bottom: 0 };
    this.screenShake = 0;

    this.players = [];
    this.controlledId = 'h_c';
    this.ball = createBall();

    this.particles = [];
    this.callouts = [];
    this.spectators = this.createSpectators();

    // Input states
    this.keys = new Set();
    this.justPressed = new Set();
    this.kickCharge = 0;
    this.passTarget = null; // Highlighted teammate for deliberate passes & goalie throws
    this.gamepadName = null;
    this.crtEnabled = true;

    this.initRoster();
    this.resetPositionsForFaceoff();
  }

  createSpectators() {
    const kids = [];
    const shirts = ['#e84a5f', '#42b883', '#ffbe3b', '#8d5fd3', '#3fa7d6', '#f28f3b'];
    const skins = ['#f2c6a0', '#dfa47a', '#8f593b', '#c4865b', '#e8b58f'];
    const hairs = ['#231a15', '#693d1e', '#c98e32', '#171412', '#9c4b23'];

    // Left & right recess sidelines watching the game
    for (let i = 0; i < 8; i++) {
      const y = 78 + i * 42;
      kids.push({
        x: 11,
        y,
        shirt: shirts[i % shirts.length],
        skin: skins[i % skins.length],
        hair: hairs[(i + 2) % hairs.length],
        phase: i * 1.1,
      });
      kids.push({
        x: 309,
        y: y + 14,
        shirt: shirts[(i + 3) % shirts.length],
        skin: skins[(i + 1) % skins.length],
        hair: hairs[(i + 4) % hairs.length],
        phase: i * 1.5 + 0.6,
      });
    }
    return kids;
  }

  initRoster() {
    this.players = [];
    for (const teamKey of ['home', 'away']) {
      const team = TEAMS[teamKey];
      team.players.forEach((tmpl, idx) => {
        this.players.push({
          ...tmpl,
          team: teamKey,
          x: COURT.centerX,
          y: COURT.centerY,
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
          animOffset: idx * 1.7,
        });
      });
    }
    this.controlledId = 'h_c';
  }

  startNewMatch() {
    this.score = { home: 0, away: 0 };
    this.stats = {
      home: createEmptyTeamStats(),
      away: createEmptyTeamStats(),
    };
    this.goalLog = [];
    this.period = 1;
    this.clockFrames = MATCH.periodSeconds * 60;
    this.particles = [];
    this.callouts = [];
    this.startFaceoff();
    sound.playRecessBell();
  }

  startFaceoff() {
    this.resetPositionsForFaceoff();
    this.state = 'FACEOFF';
    this.stateTimer = 58;
    sound.playFaceoffDrop();
  }

  resetPositionsForFaceoff() {
    const spots = {
      h_c: [COURT.centerX, COURT.centerY + 18, 0, -1],
      h_lw: [COURT.centerX - 66, COURT.centerY + 42, 0, -1],
      h_rw: [COURT.centerX + 66, COURT.centerY + 42, 0, -1],
      h_g: [COURT.centerX, GOAL.bottomLineY - 12, 0, -1],
      a_c: [COURT.centerX, COURT.centerY - 18, 0, 1],
      a_lw: [COURT.centerX - 66, COURT.centerY - 42, 0, 1],
      a_rw: [COURT.centerX + 66, COURT.centerY - 42, 0, 1],
      a_g: [COURT.centerX, GOAL.topLineY + 12, 0, 1],
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
    }

    this.controlledId = 'h_c';
    this.ball = createBall(COURT.centerX, COURT.centerY, 26);
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

    if (code === 'KeyM') {
      const muted = sound.toggleMute();
      this.addCallout(COURT.centerX, this.cameraY + 40, muted ? 'AUDIO OFF' : 'AUDIO ON', '#ffe84d');
    } else if (code === 'KeyT') {
      this.crtEnabled = !this.crtEnabled;
      const overlay = document.getElementById('crt-overlay');
      if (overlay) overlay.classList.toggle('active', this.crtEnabled);
    }
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
    };
  }

  // === MAIN FIXED-TIMESTEP UPDATE (60Hz) ===
  update() {
    this.tick++;
    const input = this.readInput();
    this.justPressed.clear();

    if (this.state === 'PAUSED') {
      if (input.pausePressed) {
        this.state = this.prevState;
        sound.playMenuSelect();
      } else if (input.restartPressed) {
        sound.playMenuSelect();
        this.startNewMatch();
      }
      return;
    }

    // Update particles & floating arcade text when not paused
    this.updateEffects();

    if (this.state === 'TITLE') {
      if (input.startPressed || input.kickPressed || input.passPressed || input.catchPressed) {
        sound.playMenuSelect();
        this.startNewMatch();
      }
      return;
    }

    if (
      input.pausePressed &&
      (this.state === 'PLAYING' || this.state === 'FACEOFF' || this.state === 'GOAL_CELEBRATION')
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
        stepBallPhysics(this.ball, {
          onBounce: (v) => {
            sound.playBounce(v);
            this.spawnParticles(this.ball.x, this.ball.y, '#e9eef4', 4);
          },
        });
      }
      this.updateCamera();
      if (this.stateTimer <= 0) {
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'GOAL_CELEBRATION') {
      this.stateTimer--;
      // Scorer pumps fists / skates around celebrating!
      if (this.lastScorer) {
        this.lastScorer.catchAnim = 10;
      }
      stepBallPhysics(this.ball, {});
      this.updateCamera();
      if (this.stateTimer <= 0) {
        this.startFaceoff();
      }
      return;
    }

    if (this.state === 'PERIOD_END') {
      this.stateTimer--;
      if (this.stateTimer <= 0 && (input.startPressed || input.kickPressed || this.stateTimer < -90)) {
        this.period++;
        this.clockFrames = MATCH.periodSeconds * 60;
        this.startFaceoff();
        sound.playRecessBell();
      }
      return;
    }

    if (this.state === 'GAME_OVER') {
      if (input.startPressed || input.kickPressed || input.passPressed) {
        sound.playMenuSelect();
        this.startNewMatch();
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

    this.handlePlayerControl(input);

    // Update all players (AI + physics integration + timers)
    for (const p of this.players) {
      if (p.kickTimer > 0) p.kickTimer--;
      if (p.catchAnim > 0) p.catchAnim--;
      if (p.stealCooldown > 0) p.stealCooldown--;
      if (p.aiDecisionCooldown > 0) p.aiDecisionCooldown--;
      if (p.diveTimer > 0) p.diveTimer--;
      if (p.jacketTimer > 0) p.jacketTimer--;
      if (p.gloveTimer > 0) p.gloveTimer--;
      if (p.throwTimer > 0) p.throwTimer--;

      if (p.role === 'G') {
        updateGoalie(p, this);
        continue;
      }

      if (p.id !== this.controlledId) {
        updateSkaterAI(p, this);
      }

      const prevX = p.x;
      const prevY = p.y;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= PHYSICS.playerFriction;
      p.vy *= PHYSICS.playerFriction;
      clampPlayerToCourt(p);

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

    // Step 2.5D tennis ball physics & check goal!
    const goalEvent = stepBallPhysics(this.ball, {
      onBounce: (v) => {
        sound.playBounce(v);
        this.spawnParticles(this.ball.x, this.ball.y, '#e9eef4', 3);
      },
      onFenceHit: () => {
        sound.playFenceHit();
        this.spawnParticles(this.ball.x, this.ball.y, '#b9c4d0', 4);
      },
      onPostHit: (side) => {
        sound.playPostHit();
        this.goalShake[side] = 10;
        this.addCallout(this.ball.x, this.ball.y - 10, 'POST!', '#ffbe3b');
      },
    });

    if (goalEvent) {
      this.handleGoalScored(goalEvent.scoredBy, goalEvent.goalSide);
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

  handlePlayerControl(input) {
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
        // Quick short underhand toss just outside the crease
        const tx = p.x + (input.mx * 34);
        const ty = p.y - 42;
        const info = launchThrow(ball, p, tx, ty, { isBomb: false, landZ: 2 });
        const next = this.findNearestPlayer(tx, ty, 'home', true);
        if (next) this.controlledId = next.id;
        this.onThrowEffect(p, info.dist > 165, 'TOSS!');
        return;
      }
      return;
    }

    // 8-way schoolyard footwork movement (slows slightly during slap-kick wind-up or while holding ball)
    if (input.mx !== 0 || input.my !== 0) {
      const mag = Math.hypot(input.mx, input.my) || 1;
      const nx = input.mx / mag;
      const ny = input.my / mag;
      const speedMod = p.holdingBall ? 0.45 : p.windupFrames >= SHOT.hardMinFrames ? 0.56 : 1;
      const maxSpd = p.stats.speed * speedMod;
      p.vx += nx * PHYSICS.playerAccel * speedMod;
      p.vy += ny * PHYSICS.playerAccel * speedMod;
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
        this.stats.home.shots++;
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
          this.stats.home.shots++;
          this.onKickEffect(p.x, p.y, chargeRatio > 0.75 ? 'SLAP-KICK!' : 'HARD SHOT!', '#ff6d2e', true);
        } else {
          // Instant crisp QUICK SHOT!
          const speed = p.stats.kick * SHOT.quickSpeedMult;
          launchBall(ball, p, aim.x, aim.y, speed, SHOT.quickLoft, {
            shotPower: speed,
            kickTimer: 9,
          });
          this.stats.home.shots++;
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
      const aimX = COURT.centerX + (input.mx * 26) - p.x;
      const aimY = GOAL.topLineY - p.y;
      const speed = p.stats.kick * 1.38;
      launchBall(ball, p, aimX, aimY, speed, 2.3, { startZ: 3, shotPower: speed });
      this.stats.home.shots++;
      this.onKickEffect(p.x, p.y, 'ONE-TIMER!', '#ff8c2e', true);
      return;
    }

    // CATCH / INTERCEPT! Press C / Space to snag a loose, bouncing, or thrown tennis ball!
    if (input.catchPressed) {
      p.catchAnim = 12;
      const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
      const catchRadius = ball.passTargetId === p.id ? PHYSICS.catchReach + 9 : PHYSICS.catchReach + 4;
      if (!ball.owner && dist <= catchRadius && ball.z <= PHYSICS.catchMaxZ) {
        catchBall(ball, p);
        this.stats.home.catches++;
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
    if (target) {
      const rawDist = Math.hypot(target.x - p.x, target.y - p.y);
      // Scale pass speed smoothly with distance so both crisp short passes and cross-yard feeds land on the tape!
      const speed = Math.max(4.2, Math.min(6.4, rawDist * 0.022 + 3.4));
      const leadFrames = Math.min(18, rawDist / speed);
      const tx = Math.max(COURT.left + 12, Math.min(COURT.right - 12, target.x + target.vx * leadFrames * 0.7));
      const ty = Math.max(COURT.top + 12, Math.min(COURT.bottom - 12, target.y + target.vy * leadFrames * 0.7));
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
      sound.playPass();
      this.spawnParticles(p.x, p.y, '#7ae8ff', 5);
    } else {
      const aim = this.getAimVector(p, input);
      launchBall(ball, p, aim.x, aim.y, 4.4, 0.7, { shotPower: 0 });
      this.stats[p.team].passes++;
      sound.playPass();
    }
  }

  executeGoalieThrow(g, target, isBomb = false) {
    const { ball } = this;
    const mates = this.players.filter((m) => m.team === g.team && m.role !== 'G');
    const receiver = target || mates[0];
    if (!receiver) return;

    // Predict where receiver is heading so full-field throws lead them cleanly in stride!
    const approxDist = Math.hypot(receiver.x - g.x, receiver.y - g.y);
    const leadFrames = Math.min(26, approxDist * 0.09);
    const tx = Math.max(COURT.left + 14, Math.min(COURT.right - 14, receiver.x + receiver.vx * leadFrames * 0.55));
    const ty = Math.max(COURT.top + 18, Math.min(COURT.bottom - 18, receiver.y + receiver.vy * leadFrames * 0.55));

    const info = launchThrow(ball, g, tx, ty, {
      passTargetId: receiver.id,
      isBomb,
      landZ: 5,
    });

    if (g.team === 'home') {
      this.controlledId = receiver.id;
    }
    this.stats[g.team].passes++;
    this.onThrowEffect(g, info.dist > 165 || isBomb);
  }

  getAimVector(p, input) {
    if (input.mx !== 0 || input.my !== 0) {
      return { x: input.mx, y: input.my };
    }
    // Slight aim assist toward opponent's makeshift net if facing generally up
    if (p.facingY < -0.25) {
      return { x: (COURT.centerX - p.x) * 0.4 + p.facingX * 80, y: GOAL.topLineY - p.y };
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
    p.kickTimer = 10;
    p.stealCooldown = 20;
    // Quick forward lunge
    p.vx += p.facingX * 1.3;
    p.vy += p.facingY * 1.3;
    sound.playSteal();

    const { ball } = this;
    const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
    if (dist > 20 || ball.z > 10) return;

    if (ball.owner && ball.owner.team !== p.team && ball.owner.role !== 'G') {
      const victim = ball.owner;
      // Can't steal directly out of hands if they're holding—Wait: a poke knocks it loose if dribbling!
      if (!victim.holdingBall) {
        victim.stealCooldown = 26;
        victim.windupFrames = 0;
        ball.owner = p;
        ball.lastTouchTeam = p.team;
        ball.lastTouchPlayer = p;
        this.stats[p.team].steals++;
        this.spawnParticles(ball.x, ball.y, '#ffe84d', 6);
        this.addCallout(p.x, p.y - 16, 'STEAL!', '#48b8ff');
      }
    } else if (!ball.owner && ball.z < 9) {
      // Poke a loose ball forward!
      launchBall(ball, p, p.facingX, p.facingY, 3.6, 1.1);
    }
  }

  checkLooseBallPickup() {
    const { ball } = this;
    if (ball.owner) return;

    for (const p of this.players) {
      if (p.role === 'G') continue;
      if (p.stealCooldown > 10) continue;
      if (ball.pickupCooldown > 0 && ball.lastTouchPlayer?.id === p.id) continue;

      const isIntendedTarget = ball.passTargetId === p.id && ball.passTimer > 0;
      const maxZ = isIntendedTarget ? 12.5 : 7.5;
      const maxDist = isIntendedTarget ? 14.5 : 10.5;
      if (ball.z > maxZ) continue;

      const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
      if (dist < maxDist) {
        ball.owner = p;
        ball.lastTouchTeam = p.team;
        ball.lastTouchPlayer = p;
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
    this.score[team]++;
    this.lastGoalTeam = team;
    this.lastScorer =
      this.ball.lastTouchPlayer && this.ball.lastTouchPlayer.team === team
        ? this.ball.lastTouchPlayer
        : this.players.find((p) => p.team === team && p.role === 'C');

    if (this.lastScorer) {
      this.goalLog.push({
        team,
        name: this.lastScorer.name,
        number: this.lastScorer.number,
        period: this.period,
      });
    }

    this.state = 'GOAL_CELEBRATION';
    this.stateTimer = 145;
    this.goalShake[goalSide] = 18;
    this.screenShake = 10;

    sound.playGoalHorn();
    this.spawnParticles(this.ball.x, this.ball.y, '#ffe84d', 18);
    this.spawnParticles(this.ball.x, this.ball.y, team === 'home' ? '#48b8ff' : '#ff4f5e', 14);
    this.addCallout(COURT.centerX, goalSide === 'top' ? GOAL.topLineY + 26 : GOAL.bottomLineY - 26, 'GOAL!!', '#ffe84d');
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

  onGoalieSave(g, type) {
    this.stats[g.team].saves++;
    if (type === 'glove') {
      this.stats[g.team].gloveSaves++;
      sound.playGloveSave();
      this.spawnParticles(g.x + 10, g.y - 8, '#f0b86e', 9);
      this.addCallout(g.x, g.y - 20, 'GLOVE SAVE!', '#ffd84d');
    } else {
      this.stats[g.team].jacketBlocks++;
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
    this.callouts.push({
      x: Math.max(46, Math.min(274, x)),
      y,
      text,
      color,
      life: 44,
    });
  }

  updateEffects() {
    if (this.goalShake.top > 0) this.goalShake.top--;
    if (this.goalShake.bottom > 0) this.goalShake.bottom--;
    if (this.screenShake > 0) this.screenShake--;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life--;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 0.35;
      c.life--;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  updateCamera() {
    const focusY = this.ball.y + (this.ball.owner ? this.ball.owner.facingY * 18 : this.ball.vy * 8);
    const targetY = Math.max(0, Math.min(WORLD_H - VIEW_H, focusY - VIEW_H / 2));
    this.cameraY += (targetY - this.cameraY) * 0.14;
  }
}
