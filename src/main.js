import { FootHockeyGame } from './game.js';
import { renderGame } from './renderer.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = new FootHockeyGame();

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

// Fixed 60Hz simulation step so physics feel identically crisp on 60Hz/120Hz/144Hz monitors
const STEP_MS = 1000 / 60;
let lastTime = performance.now();
let accumulator = 0;

function frame(now) {
  const delta = Math.min(100, now - lastTime);
  lastTime = now;
  accumulator += delta;

  while (accumulator >= STEP_MS) {
    game.update();
    accumulator -= STEP_MS;
  }

  renderGame(ctx, game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
