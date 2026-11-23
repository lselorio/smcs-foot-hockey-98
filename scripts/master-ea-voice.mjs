#!/usr/bin/env node
// Masters any voice recording (phone memo, mic clip, or AI voice) into a booming
// 1994 EA Sports / Andrew Anthony broadcast bass announcer for Foot Hockey 98!
// Usage: node scripts/master-ea-voice.mjs <input-audio-file> [pitchRatio=0.88]

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [, , inputFile, pitchArg = '0.88'] = process.argv;
if (!inputFile) {
  console.error('Usage: node scripts/master-ea-voice.mjs <input.m4a|mp3|wav> [pitchRatio=0.88]');
  process.exit(1);
}

const pitchRatio = Math.max(0.7, Math.min(1.0, Number(pitchArg) || 0.88));
const outPath = path.resolve('assets/audio/boot-voice.ogg');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

// Broadcast EA Sports bass chain:
// 1) Normalize sample rate to 44100Hz FIRST so pitch shift works on any input (24kHz/44.1kHz/48kHz)
// 2) Trim leading silence, drop pitch into deep chest-rattling bass without altering speed
// 3) Heavy broadcast compressor + warm chest bass boost (115Hz) + gravelly presence (2.4kHz)
// 4) Stadium/arena slapback echo + 1994 cartridge clarity + clean 44100Hz loudness normalize
const filter = [
  'aresample=44100',
  'silenceremove=start_periods=1:start_threshold=-40dB:detection=peak',
  `asetrate=44100*${pitchRatio},aresample=44100,atempo=${(1 / pitchRatio).toFixed(3)}`,
  'equalizer=f=115:width_type=o:width=1.4:g=7',
  'equalizer=f=2400:width_type=o:width=1.5:g=4',
  'acompressor=threshold=-18dB:ratio=5:attack=4:release=80:makeup=5',
  'aecho=0.8:0.85:55|110:0.22|0.10',
  'lowpass=f=6800',
  'loudnorm=I=-13:TP=-1.5:LRA=7',
].join(',');

execFileSync(
  'ffmpeg',
  ['-y', '-i', inputFile, '-af', filter, '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '5', outPath],
  { stdio: 'inherit' }
);

console.log(`\nSaved mastered EA-style boot announcer to ${outPath}!`);
console.log('Refresh Foot Hockey 98 (or press I on Title Screen) to hear it!');
