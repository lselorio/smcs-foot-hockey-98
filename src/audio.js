// 16-bit Retro Web Audio Synthesizer (zero external assets required)
// Synthesizes authentic Sega Genesis / SNES arcade sound effects + recess school bell.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.noiseBuffer = null;
  }

  ensureContext() {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  createNoiseBuffer(ctx) {
    const length = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freqStart, freqEnd, duration, type = 'square', volume = 0.14, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  noise(duration, filterFreq = 1200, filterType = 'bandpass', volume = 0.14, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.01);
  }

  // Hollow rubber tennis ball bounce on asphalt
  playBounce(intensity = 1) {
    const v = Math.min(1, Math.max(0.2, intensity));
    this.tone(360 + v * 90, 175, 0.055, 'triangle', 0.14 * v);
  }

  // Sneaker kicking a tennis ball (*THWACK!*)
  playKick(power = 0.7) {
    const p = Math.min(1.2, Math.max(0.4, power));
    this.tone(240 * p, 68, 0.09, 'triangle', 0.22);
    this.tone(480 * p, 140, 0.05, 'square', 0.08);
    this.noise(0.05, 900, 'lowpass', 0.15 * p);
  }

  // Crisp one-timer or drop-kick volley boom
  playPowerKick() {
    this.tone(320, 62, 0.14, 'sawtooth', 0.18);
    this.tone(640, 180, 0.08, 'square', 0.12);
    this.noise(0.08, 1400, 'bandpass', 0.18);
  }

  // Catching tennis ball in bare hands
  playCatch() {
    this.tone(280, 420, 0.055, 'triangle', 0.14);
    this.noise(0.035, 1600, 'bandpass', 0.10);
  }

  // Dropping the tennis ball back to your feet
  playDrop() {
    this.tone(420, 240, 0.05, 'triangle', 0.10);
  }

  // Goalie leather baseball glove *THUMP-POP!*
  playGloveSave() {
    this.tone(180, 75, 0.11, 'triangle', 0.26);
    this.noise(0.07, 700, 'lowpass', 0.22);
    this.tone(520, 660, 0.07, 'square', 0.08, 0.04);
  }

  // Goalie billowing jacket shield *FWIP!*
  playJacketBlock() {
    this.noise(0.11, 550, 'bandpass', 0.24);
    this.tone(150, 95, 0.08, 'sine', 0.16);
  }

  // Chain-link schoolyard fence rattle
  playFenceHit() {
    this.noise(0.12, 2400, 'highpass', 0.12);
    this.tone(620, 410, 0.08, 'square', 0.06);
  }

  // Backpack / cone goalpost thud
  playPostHit() {
    this.tone(290, 140, 0.10, 'square', 0.14);
    this.noise(0.06, 800, 'bandpass', 0.12);
  }

  // Quick poke-steal / sneaker scuff
  playSteal() {
    this.noise(0.05, 1800, 'highpass', 0.11);
    this.tone(210, 130, 0.05, 'triangle', 0.10);
  }

  // Classic recess school bell (rapid metallic clapper!)
  playRecessBell() {
    for (let i = 0; i < 10; i++) {
      const t = i * 0.045;
      this.tone(1180, 1140, 0.04, 'square', 0.09, t);
      this.tone(1790, 1740, 0.04, 'triangle', 0.08, t);
    }
  }

  // Classic 16-bit hockey organ + kid cheer on goal!
  playGoalHorn() {
    // Goal horn / recess cheer chord
    this.tone(130.8, 128, 0.45, 'sawtooth', 0.13, 0.0);
    this.tone(164.8, 162, 0.45, 'sawtooth', 0.11, 0.0);
    // 16-bit arena organ riff!
    const notes = [
      [523.25, 0.12, 0.12],
      [659.25, 0.24, 0.12],
      [783.99, 0.36, 0.12],
      [1046.5, 0.50, 0.28],
      [783.99, 0.80, 0.12],
      [1046.5, 0.94, 0.38],
    ];
    for (const [freq, delay, dur] of notes) {
      this.tone(freq, freq, dur, 'square', 0.10, delay);
      this.tone(freq * 0.5, freq * 0.5, dur, 'triangle', 0.08, delay);
    }
    this.noise(0.55, 1100, 'bandpass', 0.08, 0.05);
  }

  playMenuSelect() {
    this.tone(520, 780, 0.08, 'square', 0.10);
  }

  playFaceoffDrop() {
    this.tone(440, 660, 0.08, 'square', 0.09);
  }
}

export const sound = new SoundEngine();
