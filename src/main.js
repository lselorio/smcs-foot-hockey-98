import { FootHockeyGame } from './game.js?v=4';
import { renderGame } from './renderer.js?v=4';
import { sound } from './audio.js';
import { initTouchControls } from './touch-controls.js?v=4';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const padBadge = document.getElementById('pad-status');
const game = new FootHockeyGame();
const touchControls = initTouchControls(game, sound);
if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location?.hostname || '')) {
  window.game = game;
}

function updatePadBadge(name) {
  if (!padBadge) return;
  if (name) {
    const shortName = name.replace(/\s*\(.*?\)\s*/g, '').trim().slice(0, 22) || 'GAMEPAD';
    padBadge.textContent = `PAD: ${shortName} (A:Pass B/X:Shoot Y/RB:Catch)`;
    padBadge.classList.add('connected');
  } else {
    padBadge.textContent = 'PAD: PLUG IN & PRESS ANY BUTTON';
    padBadge.classList.remove('connected');
  }
}

window.addEventListener('gamepadconnected', (e) => {
  updatePadBadge(e.gamepad?.id || 'GAMEPAD');
});

window.addEventListener('gamepaddisconnected', () => {
  updatePadBadge(null);
});

const PREVENT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
]);

window.addEventListener('keydown', (e) => {
  if (PREVENT_KEYS.has(e.code)) e.preventDefault();
  sound.ensureContext();
  sound.preloadBootVoice();
  game.onKeyDown(e.code);
});

window.addEventListener('keyup', (e) => {
  game.onKeyUp(e.code);
});

// Immediately initialize audio on boot so sound plays automatically whenever browser allows it
sound.ensureContext();
sound.preloadBootVoice();

// Fallback unlock on first gesture if the browser's autoplay policy initially suspended audio.
// If clicked during the boot intro while audio was still locked, restart the boot spin cleanly with sound!
window.addEventListener('pointerdown', () => {
  const wasLocked = !sound.isAudioUnlocked();
  const ctx = sound.ensureContext();
  sound.preloadBootVoice();
  if (wasLocked && game.state === 'BOOT') {
    const restartWithSound = () => {
      if (game.state === 'BOOT') {
        sound.stopBootVoice();
        game.bootFrames = 0; // Frame 1 immediately fires playBootChant() cleanly!
      }
    };
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(restartWithSound).catch(() => {});
    } else {
      restartWithSound();
    }
  }
});

// Warm up browser speech synthesis voices asynchronously so the boot announcer has voices ready
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
}

// Fixed 60Hz simulation step so physics feel identically crisp on 60Hz/120Hz/144Hz monitors
const STEP_MS = 1000 / 60;
let lastTime = performance.now();
let accumulator = 0;

let lastPadName = null;

function frame(now) {
  const delta = Math.min(100, now - lastTime);
  lastTime = now;
  accumulator += delta;

  while (accumulator >= STEP_MS) {
    game.update();
    accumulator -= STEP_MS;
  }

  if (game.gamepadName !== lastPadName) {
    lastPadName = game.gamepadName;
    updatePadBadge(lastPadName);
  }

  touchControls.syncState(game.state, game.isDemo);
  renderGame(ctx, game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
