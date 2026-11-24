// 4-Channel 16-Bit Chiptune Choir + Cathedral Reverb Sequencer
// Plays 4-voice SATB scores (like Palestrina's Sicut Cervus) live via Web Audio!

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Distinct 16-bit chiptune + vocal formant settings per SATB voice
const VOICE_PROFILES = {
  soprano: {
    waveA: 'square',
    waveB: 'sawtooth',
    mixB: 0.42,
    detune: 4.5,
    formant1: 580,
    formant2: 1240,
    chipBody: 0.28,
    pan: 0.28,
    gain: 0.145,
  },
  alto: {
    waveA: 'square',
    waveB: 'triangle',
    mixB: 0.55,
    detune: 3.5,
    formant1: 450,
    formant2: 1020,
    chipBody: 0.26,
    pan: -0.28,
    gain: 0.14,
  },
  tenor: {
    waveA: 'sawtooth',
    waveB: 'square',
    mixB: 0.35,
    detune: 5.0,
    formant1: 360,
    formant2: 880,
    chipBody: 0.24,
    pan: 0.14,
    gain: 0.14,
  },
  bass: {
    waveA: 'triangle',
    waveB: 'sawtooth',
    mixB: 0.45,
    detune: 3.0,
    formant1: 280,
    formant2: 680,
    chipBody: 0.34,
    pan: -0.14,
    gain: 0.20,
  },
};

export class ChiptuneChoirPlayer {
  constructor(score, { onTrackEnded = null } = {}) {
    this.score = score;
    this.onTrackEnded = onTrackEnded;
    this.ctx = null;
    this.masterGain = null;
    this.voiceBuses = new Map();
    this.activeOscs = new Set();

    this.enabled = true;
    this.muted = false;
    this.playing = false;

    this.songPos = 0; // Current playhead in score seconds
    this.lastAudioTime = 0;
    this.tempoRate = 1.0;
    this.targetVolume = 0.78;
    this.trackCursors = score.tracks.map(() => 0);
  }

  initGraph(ctx) {
    if (this.ctx === ctx && this.masterGain) return;
    this.ctx = ctx;

    // Master bus -> Warm 16-bit SPC700-style low-pass -> Dry + Cathedral Reverb
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.effectiveVolume(), ctx.currentTime);

    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.setValueAtTime(4400, ctx.currentTime);
    warmth.Q.setValueAtTime(0.7, ctx.currentTime);

    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(0.60, ctx.currentTime);

    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(0.46, ctx.currentTime);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.createCathedralImpulse(ctx, 1.9, 2.8);

    this.masterGain.connect(warmth);
    warmth.connect(dryGain);
    dryGain.connect(ctx.destination);

    warmth.connect(reverb);
    reverb.connect(wetGain);
    wetGain.connect(ctx.destination);

    // Build dedicated stereo + formant channel bus for each SATB voice
    this.voiceBuses.clear();
    for (const role of Object.keys(VOICE_PROFILES)) {
      const prof = VOICE_PROFILES[role];
      const input = ctx.createGain();
      input.gain.setValueAtTime(prof.gain, ctx.currentTime);

      // Parallel vocal formant filters ("OOH/AAH" monastic resonance) + subtle chiptune body
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(prof.formant1, ctx.currentTime);
      f1.Q.setValueAtTime(3.0, ctx.currentTime);

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.setValueAtTime(prof.formant2, ctx.currentTime);
      f2.Q.setValueAtTime(3.6, ctx.currentTime);

      const f1Gain = ctx.createGain();
      f1Gain.gain.setValueAtTime(0.95, ctx.currentTime);
      const f2Gain = ctx.createGain();
      f2Gain.gain.setValueAtTime(0.65, ctx.currentTime);

      const chipGain = ctx.createGain();
      chipGain.gain.setValueAtTime(prof.chipBody, ctx.currentTime);

      const outNode = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (outNode.pan) outNode.pan.setValueAtTime(prof.pan, ctx.currentTime);

      input.connect(f1);
      f1.connect(f1Gain);
      f1Gain.connect(outNode);

      input.connect(f2);
      f2.connect(f2Gain);
      f2Gain.connect(outNode);

      input.connect(chipGain);
      chipGain.connect(outNode);

      outNode.connect(this.masterGain);
      this.voiceBuses.set(role, input);
    }
  }

  // Synthesizes a lush, warm cathedral reverb impulse response (no external .wav needed)
  createCathedralImpulse(ctx, durationSec = 1.9, decay = 2.8) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * durationSec);
    const buffer = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay);
        const white = Math.random() * 2 - 1;
        // One-pole low-pass damping so cathedral tail sounds warm, never hissy
        lp = lp * 0.72 + white * 0.28;
        data[i] = lp * env;
      }
    }
    return buffer;
  }

  effectiveVolume() {
    return this.enabled && !this.muted ? this.targetVolume : 0;
  }

  setMuted(muted) {
    this.muted = muted;
    this.applyVolume();
  }

  setScore(newScore, forceRestart = false) {
    if (!newScore || (!forceRestart && newScore === this.score)) return;
    this.stopAllActiveNotes();
    this.score = newScore;
    this.songPos = 0;
    this.trackCursors = newScore.tracks.map(() => 0);
    if (this.ctx) {
      this.lastAudioTime = this.ctx.currentTime;
    }
  }

  toggleEnabled() {
    this.enabled = !this.enabled;
    this.applyVolume();
    if (!this.enabled) this.stopAllActiveNotes();
    return this.enabled;
  }

  setMood({ tempoRate = 1.0, volume = 0.78 } = {}) {
    this.tempoRate = tempoRate;
    this.targetVolume = volume;
    this.applyVolume();
  }

  applyVolume() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.effectiveVolume(), now, 0.08);
  }

  stopAllActiveNotes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const osc of this.activeOscs) {
      try {
        osc.stop(now + 0.02);
      } catch {
        // already stopped
      }
    }
    this.activeOscs.clear();
  }

  start(ctx) {
    if (!ctx) return;
    this.initGraph(ctx);
    if (!this.playing) {
      this.playing = true;
      this.lastAudioTime = ctx.currentTime;
    }
  }

  // Called once per frame from the game loop — sample-accurate Web Audio lookahead scheduler!
  tick(ctx) {
    if (!ctx || ctx.state !== 'running') return;
    if (!this.playing) this.start(ctx);

    const now = ctx.currentTime;
    const dt = Math.min(0.12, Math.max(0, now - this.lastAudioTime));
    this.lastAudioTime = now;

    if (!this.enabled || this.muted) {
      return;
    }

    let prevPos = this.songPos;
    this.songPos += dt * this.tempoRate;

    const loopEnd = this.score.duration + 1.6;
    if (this.songPos >= loopEnd) {
      if (this.onTrackEnded) {
        const nextScore = this.onTrackEnded();
        if (nextScore === null) {
          // One-shot score finished (e.g. Widor Toccata postlude) — stop cleanly without restarting!
          this.stopAllActiveNotes();
          this.songPos = loopEnd;
          this.trackCursors = this.score.tracks.map((tr) => tr.notes.length);
          return;
        }
        if (nextScore && nextScore !== this.score) {
          this.score = nextScore;
        }
      }
      prevPos = 0;
      this.songPos = 0;
      this.trackCursors = this.score.tracks.map(() => 0);
    }

    const lookaheadScoreSec = 0.24 * this.tempoRate;
    const windowEnd = this.songPos + lookaheadScoreSec;

    for (let ti = 0; ti < this.score.tracks.length; ti++) {
      const track = this.score.tracks[ti];
      const notes = track.notes;
      let idx = this.trackCursors[ti];

      // Skip any notes strictly behind prevPos (e.g. right after unmuting/tab resume)
      while (idx < notes.length && notes[idx][0] < prevPos - 0.02) {
        idx++;
      }

      while (idx < notes.length && notes[idx][0] <= windowEnd) {
        const [startSec, durSec, midi, vel] = notes[idx];
        const delaySec = Math.max(0, (startSec - this.songPos) / this.tempoRate);
        const playDur = Math.max(0.06, durSec / this.tempoRate);
        this.scheduleNote(track.role, now + delaySec, playDur, midi, vel);
        idx++;
      }
      this.trackCursors[ti] = idx;
    }
  }

  scheduleNote(role, startTime, duration, midi, velocity = 0.65) {
    const ctx = this.ctx;
    const bus = this.voiceBuses.get(role) || this.voiceBuses.get('tenor');
    const prof = VOICE_PROFILES[role] || VOICE_PROFILES.tenor;
    if (!ctx || !bus) return;

    const freq = midiToFreq(midi);
    const noteGain = ctx.createGain();
    const peak = Math.max(0.25, Math.min(1, velocity)) * 0.9;
    const attack = Math.min(0.045, duration * 0.25);
    const release = Math.min(0.14, duration * 0.35 + 0.05);
    const endTime = startTime + duration;
    const stopTime = endTime + release;

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(peak, startTime + attack);
    noteGain.gain.setValueAtTime(peak * 0.88, Math.max(startTime + attack, endTime - 0.03));
    noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    noteGain.connect(bus);

    // Dual detuned 16-bit oscillators for rich choir unison thickness
    const oscA = ctx.createOscillator();
    oscA.type = prof.waveA;
    oscA.frequency.setValueAtTime(freq, startTime);
    oscA.detune.setValueAtTime(-prof.detune, startTime);

    const oscB = ctx.createOscillator();
    oscB.type = prof.waveB;
    oscB.frequency.setValueAtTime(freq, startTime);
    oscB.detune.setValueAtTime(prof.detune, startTime);

    const gainB = ctx.createGain();
    gainB.gain.setValueAtTime(prof.mixB, startTime);

    oscA.connect(noteGain);
    oscB.connect(gainB);
    gainB.connect(noteGain);

    // Subtle delayed vocal vibrato on sustained Palestrina notes
    let vibOsc = null;
    if (duration > 0.55) {
      vibOsc = ctx.createOscillator();
      const vibGain = ctx.createGain();
      vibOsc.type = 'sine';
      vibOsc.frequency.setValueAtTime(5.1, startTime);
      vibGain.gain.setValueAtTime(0.001, startTime);
      vibGain.gain.setValueAtTime(0.001, startTime + 0.24);
      vibGain.gain.linearRampToValueAtTime(5.5, startTime + 0.55); // ±5.5 cents
      vibOsc.connect(vibGain);
      vibGain.connect(oscA.detune);
      vibGain.connect(oscB.detune);
      vibOsc.start(startTime);
      vibOsc.stop(stopTime + 0.02);
      this.activeOscs.add(vibOsc);
    }

    oscA.start(startTime);
    oscB.start(startTime);
    oscA.stop(stopTime + 0.02);
    oscB.stop(stopTime + 0.02);

    this.activeOscs.add(oscA);
    this.activeOscs.add(oscB);
    oscA.onended = () => {
      this.activeOscs.delete(oscA);
      this.activeOscs.delete(oscB);
      if (vibOsc) this.activeOscs.delete(vibOsc);
    };
  }
}
