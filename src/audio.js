// 16-bit Retro Web Audio Synthesizer + Live 4-Voice Chiptune Choir Music Engine
// Synthesizes Sega Genesis / SNES arcade SFX + Palestrina's Sicut Cervus in 16-bit chiptune!

import { SICUT_CERVUS_SCORE } from './music/sicut-cervus.js';
import { ChiptuneChoirPlayer } from './music-player.js';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.noiseBuffer = null;
    this.music = new ChiptuneChoirPlayer(SICUT_CERVUS_SCORE);
    this.bootVoiceBuffer = null;
    this.bootVoiceChecked = false;
    this.bootVoiceSource = null;
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
    this.music.setMuted(this.muted);
    if (this.muted) this.stopBootVoice();
    return this.muted;
  }

  toggleMusic() {
    const enabled = this.music.toggleEnabled();
    if (enabled) this.ensureContext();
    return enabled;
  }

  updateMusic(state, isFinalSeconds = false) {
    if (this.muted || !this.music.enabled) return;
    if (state === 'BOOT') return;
    if (!this.ctx || this.ctx.state !== 'running') return;

    if (state === 'PAUSED') {
      this.music.setMood({ tempoRate: 0.92, volume: 0.26 });
    } else if (state === 'GOAL_CELEBRATION') {
      this.music.setMood({ tempoRate: 1.0, volume: 0.22 });
    } else if (state === 'TITLE' || state === 'GAME_OVER' || state === 'PERIOD_END') {
      this.music.setMood({ tempoRate: 1.0, volume: 0.72 });
    } else if (isFinalSeconds) {
      // Classic 16-bit hurry-up tempo in the last 15 seconds before the recess bell!
      this.music.setMood({ tempoRate: 1.34, volume: 0.76 });
    } else {
      this.music.setMood({ tempoRate: 1.18, volume: 0.68 });
    }

    this.music.tick(this.ctx);
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

  // Crisp controlled pass kick
  playPass() {
    this.tone(290, 120, 0.06, 'triangle', 0.16);
    this.noise(0.035, 1100, 'lowpass', 0.10);
  }

  // Subtle click/whoosh when entering slap-kick hard-shot wind-up
  playWindupTick() {
    this.tone(320, 480, 0.045, 'square', 0.07);
  }

  // Booming NHL '94 slap-kick hard shot / one-timer / drop-kick
  playPowerKick() {
    this.tone(340, 56, 0.16, 'sawtooth', 0.21);
    this.tone(680, 160, 0.09, 'square', 0.13);
    this.noise(0.09, 1500, 'bandpass', 0.20);
  }

  // Goalie overhand baseball throw across the schoolyard (*WHOOSH-ZIP!*)
  playThrow(isLong = false) {
    this.noise(isLong ? 0.14 : 0.09, isLong ? 1700 : 1200, 'bandpass', 0.17);
    this.tone(isLong ? 420 : 320, isLong ? 880 : 620, isLong ? 0.12 : 0.08, 'triangle', 0.14);
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

  // Iconic 16-bit EA Sports-style brass/choral boot sting as the SMCS crest locks in!
  playBootSting() {
    const chord = [
      [293.66, 0.0, 0.22], // D4
      [369.99, 0.06, 0.24], // F#4
      [440.0, 0.12, 0.28], // A4
      [587.33, 0.20, 0.55], // D5 triumphant brass/organ finish!
    ];
    for (const [f, d, dur] of chord) {
      this.tone(f, f, dur, 'sawtooth', 0.09, d);
      this.tone(f * 0.5, f * 0.5, dur, 'triangle', 0.09, d);
    }
  }

  // Silently check if a custom recorded boot announcer file exists in assets/audio/
  async preloadBootVoice() {
    if (this.bootVoiceChecked || typeof fetch === 'undefined') return;
    this.bootVoiceChecked = true;
    const candidates = [
      './assets/audio/boot-voice.ogg',
      './assets/audio/boot-voice.mp3',
      './assets/audio/boot-voice.wav',
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const ctx = this.ensureContext();
        if (!ctx) return;
        this.bootVoiceBuffer = await ctx.decodeAudioData(arr);
        return;
      } catch {
        // Optional custom clip not present; fallback to built-in baritone announcer
      }
    }
  }

  stopBootVoice() {
    if (this.bootVoiceSource) {
      try {
        this.bootVoiceSource.stop();
      } catch {
        // already stopped
      }
      this.bootVoiceSource = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  // Booming EA Sports-style deep announcer: "Si in ludo est, in ludo est!"
  // Uses custom assets/audio/boot-voice.{ogg,mp3,wav} (with 1994 Genesis crunch + arena echo) if present,
  // otherwise falls back to browser Web Speech API pitched down into a deep baritone!
  playBootVoice() {
    if (this.muted) return;
    this.stopBootVoice();

    // Path 1: Mastered neural/recorded voice sample (assets/audio/boot-voice.ogg) — clean & punchy!
    if (this.bootVoiceBuffer) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const src = ctx.createBufferSource();
      src.buffer = this.bootVoiceBuffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.0, ctx.currentTime);

      src.connect(gain);
      gain.connect(ctx.destination);

      this.bootVoiceSource = src;
      src.onended = () => {
        if (this.bootVoiceSource === src) this.bootVoiceSource = null;
      };
      src.start();
      return;
    }

    // Path 2: Built-in Web Speech API — deep badass North American bass announcer!
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      return;
    }

    // Subtle dramatic sub-bass trailer boom underneath the announcer's voice!
    this.tone(72, 46, 0.75, 'sine', 0.24, 0.0);
    this.tone(110, 73, 0.55, 'triangle', 0.10, 0.05);

    const voices = window.speechSynthesis.getVoices() || [];
    // Prefer deep English/North American male voices (never Italian accent!)
    const badassMale =
      voices.find(
        (v) =>
          /^en(-US|-CA|-GB)?/i.test(v.lang) &&
          /david|guy|christopher|eric|andrew|brian|mark|daniel|alex|george|fred|male/i.test(v.name)
      ) ||
      voices.find((v) => /^en-US/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang));

    const utter = new SpeechSynthesisUtterance('In loo-doh est!');
    if (badassMale) {
      utter.voice = badassMale;
      utter.lang = badassMale.lang;
    }
    utter.pitch = 0.28; // Rumbling badass bass register!
    utter.rate = 0.80;  // Deliberate EA Sports announcer cadence
    utter.volume = 1.0;

    window.speechSynthesis.speak(utter);
  }

  isAudioUnlocked() {
    return Boolean(this.ctx && this.ctx.state === 'running');
  }
}

export const sound = new SoundEngine();
