#!/usr/bin/env node
// Compiles "Widor toccata (all organ).mid" into a crisp, deduplicated 4-channel 16-bit Cathedral Organ
// postlude score (src/music/widor-toccata.js) for the "ITE, LUDUS FINITUS EST" final screen!

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMidi } from './midi-to-score.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN_PATH = path.resolve(__dirname, '../Widor toccata (all organ).mid');
const OUT_PATH = path.resolve(__dirname, '../src/music/widor-toccata.js');

const round3 = (n) => Math.round(n * 1000) / 1000;

function dedupeNotes(notes) {
  const seen = new Map();
  for (const n of notes) {
    const key = `${Math.round(n[0] * 100)}:${n[2]}`;
    const prev = seen.get(key);
    if (!prev || n[1] > prev[1]) {
      seen.set(key, n);
    }
  }
  return [...seen.values()].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}

const parsed = parseMidi(fs.readFileSync(IN_PATH));

// Group simultaneous notes by onset bucket (10ms) so we can cleanly separate organ coupler doublings
function groupByOnset(notes) {
  const groups = new Map();
  for (const n of notes) {
    const k = Math.round(n[0] * 100);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(n);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g.sort((a, b) => a[2] - b[2]));
}

const leadRaw = parsed.tracks[0]?.notes || [];      // Track 0: Right-hand Toccata arpeggios (doubled in octaves)
const secLeadRaw = parsed.tracks[1]?.notes || [];   // Track 1: Middle section manual chords & melody
const leadBassRaw = parsed.tracks[2]?.notes || [];  // Track 2: Left-hand staccato manual chords (doubled)
const pedalRaw = parsed.tracks[4]?.notes || [];     // Track 4: Famous Widor pedal solo (includes subsonic 16'/32' stops)

const soprano = [];
const alto = [];
const tenor = [];
const bass = [];

// 1) Right-hand flying 16th-note Toccata (Lead): take the crisp primary register (MIDI <= 81) as Soprano!
for (const grp of groupByOnset(dedupeNotes(leadRaw))) {
  // Lead pairs each 16th note with its +12 upper octave (e.g. 77 & 89); pick the crisp lower voice (77)
  // so 16-bit square/saw oscillators sing warmly without piercing ultrasonic aliasing!
  const primary = grp[0];
  soprano.push([round3(primary[0]), round3(Math.max(0.06, primary[1] * 0.92)), primary[2], 0.48]);
}

// 2) Left-hand staccato manual chords (lead bass): deduplicate octave doublings -> clean 3-note chord split across Alto & Tenor!
for (const grp of groupByOnset(dedupeNotes(leadBassRaw))) {
  // Keep distinct pitch classes in the warm mid-register (MIDI 48..72)
  const midNotes = grp.filter((n) => n[2] >= 48 && n[2] <= 74);
  const chosen = midNotes.length > 0 ? midNotes : grp.slice(0, 3);
  const uniquePcs = [];
  const seenPc = new Set();
  for (const n of chosen) {
    const pc = n[2] % 12;
    if (!seenPc.has(pc)) {
      seenPc.add(pc);
      uniquePcs.push(n);
    }
    if (uniquePcs.length >= 3) break;
  }
  uniquePcs.forEach((n, idx) => {
    const target = idx === uniquePcs.length - 1 && uniquePcs.length >= 2 ? alto : tenor;
    target.push([round3(n[0]), round3(Math.max(0.07, n[1] * 0.9)), n[2], 0.35]);
  });
}

// 3) Secondary manual (middle section from 122.88s onward): split upper melody -> Alto, lower harmony -> Tenor
for (const grp of groupByOnset(dedupeNotes(secLeadRaw))) {
  const usable = grp.filter((n) => n[2] >= 45 && n[2] <= 82);
  if (usable.length === 0) continue;
  const top = usable[usable.length - 1];
  alto.push([round3(top[0]), round3(Math.max(0.07, top[1] * 0.92)), top[2], 0.40]);
  if (usable.length >= 2) {
    const low = usable[0];
    tenor.push([round3(low[0]), round3(Math.max(0.07, low[1] * 0.9)), low[2], 0.35]);
  }
}

// 4) Iconic Widor Pedal Theme (Track 4): thunderous coupled 16' + 8' cathedral Bombarde reed stops!
// Doubling the fundamental (MIDI 36..47) with its +12 octave pipe (MIDI 48..59) at full velocity
// makes the pedal melody roar cleanly over the manual arpeggios on any speakers!
for (const grp of groupByOnset(dedupeNotes(pedalRaw))) {
  let picked = grp.find((n) => n[2] >= 36 && n[2] <= 50);
  if (!picked) {
    let p = grp[0][2];
    while (p < 36) p += 12;
    picked = [grp[0][0], grp[0][1], p, grp[0][3]];
  }
  const start = round3(picked[0]);
  const dur = round3(Math.max(0.12, picked[1] * 0.96));
  const fundamental = picked[2];
  // 16' deep cathedral bass pipe (full roar!)
  bass.push([start, dur, fundamental, 1.0]);
  // 8' coupled upper pedal reed pipe (+12) so the pedal theme cuts boldly through the arpeggios!
  if (fundamental + 12 <= 62) {
    bass.push([start, dur, fundamental + 12, 0.92]);
  }
}

const sortNotes = (arr) => dedupeNotes(arr);
const tracks = [
  { name: 'Right Manual (Toccata)', role: 'soprano', notes: sortNotes(soprano) },
  { name: 'Upper Chords', role: 'alto', notes: sortNotes(alto) },
  { name: 'Left Manual', role: 'tenor', notes: sortNotes(tenor) },
  { name: 'Cathedral Pedal', role: 'bass', notes: sortNotes(bass) },
];

const score = {
  title: "Widor - Toccata (Symphony No. 5, Op. 42 No. 1)",
  shortTitle: 'WIDOR TOCCATA',
  duration: parsed.duration,
  tracks,
};

const js = `// Auto-generated from "Widor toccata (all organ).mid" via scripts/widor-to-score.mjs
// Iconic cathedral organ postlude for the "ITE, LUDUS FINITUS EST" final screen!
export const WIDOR_TOCCATA_SCORE = ${JSON.stringify(score)};
`;

fs.writeFileSync(OUT_PATH, js, 'utf8');
console.log(
  `Wrote ${OUT_PATH} (${(js.length / 1024).toFixed(1)} KB): duration=${score.duration}s, notes=${tracks
    .map((t) => `${t.role}:${t.notes.length}`)
    .join(', ')}`
);
