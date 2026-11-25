// Auto-detected 16-bit Handheld Touch Controller for iOS Safari & Android Chrome
// Supports multi-touch analog thumbstick + SHOOT/PASS/CATCH buttons + context-aware utility bar!

const MENU_STATES = new Set([
  'BOOT',
  'TITLE',
  'OPTIONS',
  'TEAM_SELECT',
  'PAUSED',
  'GAME_OVER',
]);

// Pure math helper for virtual thumbstick:
// Returns normalized analog vector (mx, my), clamped visual knob offset, and cardinal menu direction key.
export function computeStickVector(dx, dy, maxRadius = 44, deadzone = 0.2) {
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.001) {
    return { mx: 0, my: 0, knobX: 0, knobY: 0, dirKey: null };
  }

  const clampedDist = Math.min(maxRadius, dist);
  const nx = dx / dist;
  const ny = dy / dist;
  const knobX = nx * clampedDist;
  const knobY = ny * clampedDist;
  const normMag = clampedDist / maxRadius;

  if (normMag < deadzone) {
    return { mx: 0, my: 0, knobX, knobY, dirKey: null };
  }

  // Smoothly rescale (deadzone..1) -> (0..1) so gentle thumb movement feels responsive
  const scaled = Math.min(1, (normMag - deadzone) / (1 - deadzone));
  const mx = Number((nx * scaled).toFixed(3));
  const my = Number((ny * scaled).toFixed(3));

  let dirKey = null;
  if (normMag >= 0.45) {
    if (Math.abs(nx) >= Math.abs(ny)) {
      dirKey = nx < 0 ? 'ArrowLeft' : 'ArrowRight';
    } else {
      dirKey = ny < 0 ? 'ArrowUp' : 'ArrowDown';
    }
  }

  return { mx, my, knobX, knobY, dirKey };
}

// Context-aware 4-button utility strip so every screen is 100% playable on mobile!
export function getUtilityButtonsForState(state, isDemo = false) {
  if (state === 'POST_CREDITS') {
    return [
      { label: 'AMEN', code: null, tone: 'gold', disabled: true },
      { label: 'MUTE', code: 'KeyM', tone: 'neutral' },
    ];
  }
  if (state === 'BOOT') {
    return [
      { label: 'SKIP', code: 'Enter', tone: 'accent' },
      { label: 'MUTE', code: 'KeyM', tone: 'neutral' },
    ];
  }
  if (state === 'TITLE') {
    return [
      { label: 'PLAY', code: 'Enter', tone: 'accent' },
      { label: 'TEAMS', code: 'KeyL', tone: 'neutral' },
      { label: 'OPTIONS', code: 'KeyO', tone: 'neutral' },
      { label: 'INTRO', code: 'KeyI', tone: 'gold' },
    ];
  }
  if (state === 'TEAM_SELECT') {
    return [
      { label: 'START', code: 'Enter', tone: 'accent' },
      { label: 'SIDE', code: 'Tab', tone: 'neutral' },
      { label: 'RANDOM', code: 'KeyR', tone: 'gold' },
      { label: 'BACK', code: 'Escape', tone: 'danger' },
    ];
  }
  if (state === 'OPTIONS') {
    return [
      { label: 'CHANGE', code: 'Enter', tone: 'accent' },
      { label: 'MUSIC', code: 'KeyN', tone: 'neutral' },
      { label: 'MUTE', code: 'KeyM', tone: 'neutral' },
      { label: 'BACK', code: 'Escape', tone: 'danger' },
    ];
  }
  if (state === 'PAUSED') {
    return [
      { label: 'RESUME', code: 'KeyP', tone: 'accent' },
      { label: 'RESTART', code: 'KeyR', tone: 'neutral' },
      { label: 'END GAME', code: 'KeyQ', tone: 'danger' },
      { label: 'MUTE', code: 'KeyM', tone: 'neutral' },
    ];
  }
  if (state === 'GAME_OVER') {
    if (isDemo) {
      return [
        { label: 'PLAY 1P', code: 'Enter', tone: 'accent' },
        { label: 'TITLE', code: 'Escape', tone: 'neutral' },
        { label: 'MUTE', code: 'KeyM', tone: 'neutral' },
      ];
    }
    return [
      { label: 'REMATCH', code: 'Enter', tone: 'accent' },
      { label: 'TITLE', code: 'KeyQ', tone: 'neutral' },
      { label: 'AMEN', code: 'KeyI', tone: 'gold' },
      { label: 'MUTE', code: 'KeyM', tone: 'neutral' },
    ];
  }
  if (isDemo) {
    return [
      { label: 'PLAY 1P', code: 'Enter', tone: 'accent' },
      { label: 'TITLE', code: 'Escape', tone: 'neutral' },
      { label: 'MUSIC', code: 'KeyN', tone: 'neutral' },
      { label: 'MUTE', code: 'KeyM', tone: 'neutral' },
    ];
  }
  // Active match (PLAYING / FACEOFF / RESTART / GOAL_CELEBRATION / PERIOD_END / BASEMENT_56)
  return [
    { label: 'PAUSE', code: 'KeyP', tone: 'accent' },
    { label: 'SNOW', code: 'KeyB', tone: 'neutral' },
    { label: 'MUSIC', code: 'KeyN', tone: 'neutral' },
    { label: 'MUTE', code: 'KeyM', tone: 'neutral' },
  ];
}

// Auto-detect touch devices (with ?touch=1 / ?touch=0 URL override for easy desktop testing)
export function shouldEnableTouchMode({ maxTouchPoints = 0, coarsePointer = false, search = '' } = {}) {
  if (/(?:^|[?&])touch=0(?:&|$)/.test(search)) return false;
  if (/(?:^|[?&])touch=1(?:&|$)/.test(search)) return true;
  return Boolean(coarsePointer || maxTouchPoints > 0);
}

export function initTouchControls(game, sound) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { syncState() {}, releaseAll() {} };
  }

  const stickEl = document.getElementById('touch-stick');
  const knobEl = document.getElementById('touch-knob');
  const utilityEl = document.getElementById('touch-utility');
  const actionButtons = Array.from(document.querySelectorAll('[data-touch-key]'));

  let touchModeEnabled = false;
  const enableTouchMode = () => {
    if (touchModeEnabled) return;
    touchModeEnabled = true;
    document.body.classList.add('touch-mode');
  };

  const coarsePointer = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (
    shouldEnableTouchMode({
      maxTouchPoints: navigator.maxTouchPoints || 0,
      coarsePointer,
      search: window.location?.search || '',
    })
  ) {
    enableTouchMode();
  }

  // Also auto-enable if a hybrid/2-in-1 user touches the screen for the first time
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') {
        enableTouchMode();
      }
    },
    { passive: true }
  );

  // Track active virtual keys by pointerId so multi-touch never sticks or collides
  const activeKeyPointers = new Map(); // pointerId -> { code, el, isUtility }
  const heldKeyCounts = new Map();     // code -> count

  const pressVirtualKey = (pointerId, code, el, isUtility = false) => {
    if (!code) return;
    sound.ensureContext();
    sound.preloadBootVoice();
    activeKeyPointers.set(pointerId, { code, el, isUtility });
    const count = heldKeyCounts.get(code) || 0;
    heldKeyCounts.set(code, count + 1);
    if (el) el.classList.add('pressed');
    if (count === 0) {
      game.onKeyDown(code);
    }
  };

  const releaseVirtualPointer = (pointerId) => {
    const entry = activeKeyPointers.get(pointerId);
    if (!entry) return;
    activeKeyPointers.delete(pointerId);
    const { code, el } = entry;
    if (el) el.classList.remove('pressed');
    const nextCount = Math.max(0, (heldKeyCounts.get(code) || 1) - 1);
    if (nextCount === 0) {
      heldKeyCounts.delete(code);
      game.onKeyUp(code);
    } else {
      heldKeyCounts.set(code, nextCount);
    }
  };

  // Global release listener guarantees keys never stick even if a utility button re-renders on state change!
  const onGlobalPointerEnd = (e) => {
    releaseVirtualPointer(e.pointerId);
  };
  window.addEventListener('pointerup', onGlobalPointerEnd, { passive: true });
  window.addEventListener('pointercancel', onGlobalPointerEnd, { passive: true });

  // === LEFT VIRTUAL THUMBSTICK / D-PAD ===
  let stickPointerId = null;
  let stickCenterX = 0;
  let stickCenterY = 0;
  let stickMaxRadius = 42;
  let activeMenuDirKey = null;

  const updateStickVisual = (knobX, knobY, active) => {
    if (knobEl) {
      knobEl.style.transform = `translate(${knobX.toFixed(1)}px, ${knobY.toFixed(1)}px)`;
    }
    if (stickEl) {
      stickEl.classList.toggle('active', active);
    }
  };

  const setMenuDirKey = (nextDirKey) => {
    if (nextDirKey === activeMenuDirKey) return;
    if (activeMenuDirKey) {
      game.onKeyUp(activeMenuDirKey);
    }
    activeMenuDirKey = nextDirKey;
    if (activeMenuDirKey) {
      game.onKeyDown(activeMenuDirKey);
    }
  };

  const applyStickPosition = (clientX, clientY) => {
    const dx = clientX - stickCenterX;
    const dy = clientY - stickCenterY;
    const { mx, my, knobX, knobY, dirKey } = computeStickVector(dx, dy, stickMaxRadius, 0.2);
    updateStickVisual(knobX, knobY, true);

    if (MENU_STATES.has(game.state)) {
      game.setTouchMove(0, 0);
      setMenuDirKey(dirKey);
    } else {
      setMenuDirKey(null);
      game.setTouchMove(mx, my);
    }
  };

  const releaseStick = () => {
    stickPointerId = null;
    game.setTouchMove(0, 0);
    setMenuDirKey(null);
    updateStickVisual(0, 0, false);
  };

  if (stickEl) {
    stickEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      enableTouchMode();
      sound.ensureContext();
      sound.preloadBootVoice();
      if (stickPointerId !== null) return;
      stickPointerId = e.pointerId;
      try {
        stickEl.setPointerCapture(e.pointerId);
      } catch {
        // ignore if unsupported
      }
      const rect = stickEl.getBoundingClientRect();
      stickCenterX = rect.left + rect.width / 2;
      stickCenterY = rect.top + rect.height / 2;
      stickMaxRadius = Math.max(28, rect.width * 0.36);
      applyStickPosition(e.clientX, e.clientY);
    });

    stickEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickPointerId) return;
      e.preventDefault();
      applyStickPosition(e.clientX, e.clientY);
    });

    const onStickEnd = (e) => {
      if (e.pointerId !== stickPointerId) return;
      e.preventDefault();
      releaseStick();
    };
    stickEl.addEventListener('pointerup', onStickEnd);
    stickEl.addEventListener('pointercancel', onStickEnd);
    stickEl.addEventListener('lostpointercapture', onStickEnd);
  }

  // === RIGHT ARCADE BUTTONS (SHOOT / PASS / CATCH) ===
  for (const btn of actionButtons) {
    const code = btn.dataset.touchKey;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      enableTouchMode();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      pressVirtualKey(e.pointerId, code, btn);
    });

    const onBtnEnd = (e) => {
      e.preventDefault();
      releaseVirtualPointer(e.pointerId);
    };
    btn.addEventListener('pointerup', onBtnEnd);
    btn.addEventListener('pointercancel', onBtnEnd);
    btn.addEventListener('lostpointercapture', onBtnEnd);
  }

  // === CONTEXT-AWARE UTILITY BAR ===
  let lastUtilitySignature = '';

  const renderUtilityButtons = (state, isDemo) => {
    if (!utilityEl) return;
    const sig = `${state}:${isDemo ? 1 : 0}`;
    if (sig === lastUtilitySignature) return;
    lastUtilitySignature = sig;

    // Release any held utility button before replacing DOM nodes so keys never stick across state swaps
    for (const [pid, entry] of Array.from(activeKeyPointers.entries())) {
      if (entry.isUtility) releaseVirtualPointer(pid);
    }

    const specs = getUtilityButtonsForState(state, isDemo);
    utilityEl.textContent = '';
    for (const spec of specs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `touch-util-btn tone-${spec.tone || 'neutral'}`;
      btn.textContent = spec.label;
      if (spec.disabled || !spec.code) {
        btn.disabled = true;
      } else {
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          enableTouchMode();
          pressVirtualKey(e.pointerId, spec.code, btn, true);
        });
        const onEnd = (e) => {
          e.preventDefault();
          releaseVirtualPointer(e.pointerId);
        };
        btn.addEventListener('pointerup', onEnd);
        btn.addEventListener('pointercancel', onEnd);
      }
      utilityEl.appendChild(btn);
    }
  };

  const releaseAll = () => {
    releaseStick();
    for (const pointerId of Array.from(activeKeyPointers.keys())) {
      releaseVirtualPointer(pointerId);
    }
  };

  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });

  renderUtilityButtons(game.state, game.isDemo);

  return {
    syncState(state, isDemo) {
      if (touchModeEnabled) {
        renderUtilityButtons(state, isDemo);
      }
    },
    releaseAll,
  };
}
