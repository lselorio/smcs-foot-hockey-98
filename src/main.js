import { FootHockeyGame } from './game.js?v=11';
import { renderGame } from './renderer.js?v=11';
import { sound } from './audio.js?v=10';
import { initTouchControls } from './touch-controls.js?v=11';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const padBadge = document.getElementById('pad-status');
const game = new FootHockeyGame({ startOnGate: true });
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

function triggerStartGate() {
  sound.ensureContext();
  sound.preloadBootVoice();
  if (game.state === 'START_GATE') {
    game.beginBoot();
  }
}

window.addEventListener('keydown', (e) => {
  if (PREVENT_KEYS.has(e.code)) e.preventDefault();
  if (game.state === 'START_GATE' && e.code !== 'KeyM') {
    triggerStartGate();
    return;
  }
  sound.ensureContext();
  sound.preloadBootVoice();
  game.onKeyDown(e.code);
});

window.addEventListener('keyup', (e) => {
  game.onKeyUp(e.code);
});

// Preload boot chants and voice clips immediately while waiting on the Start Gate
sound.ensureContext();
sound.preloadBootVoice();

// Unlock audio cleanly on pointerdown, pointerup, and click (Android Chrome & iOS Safari require touchend/click for user activation!)
const onUserGesture = () => {
  if (game.state === 'START_GATE') {
    triggerStartGate();
    return;
  }
  sound.ensureContext();
  sound.preloadBootVoice();
};
window.addEventListener('pointerdown', onUserGesture);
window.addEventListener('pointerup', onUserGesture);
window.addEventListener('click', onUserGesture);

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
