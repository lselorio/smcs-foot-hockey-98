import { FootHockeyGame } from './game.js';
import { renderGame } from './renderer.js';
import { sound } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const padBadge = document.getElementById('pad-status');
const game = new FootHockeyGame();

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
]);

window.addEventListener('keydown', (e) => {
  if (PREVENT_KEYS.has(e.code)) e.preventDefault();
  game.onKeyDown(e.code);
});

window.addEventListener('keyup', (e) => {
  game.onKeyUp(e.code);
});

// Clicking the canvas also unlocks Web Audio cleanly so music begins right away
canvas.addEventListener('pointerdown', () => {
  sound.ensureContext();
});

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

  renderGame(ctx, game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
