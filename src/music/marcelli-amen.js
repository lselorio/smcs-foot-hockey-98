// Public-domain closing "Amen" (5 measures, 6 voices: S, A, T1, T2, B1, B2)
// from Giovanni Pierluigi da Palestrina's "Missa Papae Marcelli" (1567) — Gloria.
// Arranged for our 16-bit Chiptune Choir & Cathedral Reverb post-credits stinger!

// Beat-to-second timeline (in 4/2 alla breve half-note beats, 0..20):
// Beats 0..14 flow at a stately 0.64s/half-note; beats 14..16 gently ritard into
// the final C Major chord lock at 10.58s (beat 16), held through 14.18s!
const BEAT_TIMES = [
  0.00,  // 0  (m.124 beat 1: C Major)
  0.64,  // 1
  1.28,  // 2
  1.92,  // 3
  2.56,  // 4  (m.125 beat 1: F Major bloom)
  3.20,  // 5
  3.84,  // 6
  4.48,  // 7
  5.12,  // 8  (m.126 beat 1: Lush F Major plagal swell)
  5.76,  // 9
  6.40,  // 10
  7.04,  // 11
  7.68,  // 12 (m.127 beat 1: Radiant C Major arrival)
  8.32,  // 13
  8.96,  // 14 (gentle ritardando begins)
  9.70,  // 15 (ornamental sigh B3 -> A3 in Bassus 1)
  10.58, // 16 (m.128 beat 1: FINAL C MAJOR CHORD LOCKS IN!)
  11.48, // 17
  12.38, // 18
  13.28, // 19
  14.18, // 20 (final release into cathedral reverb tail)
];

function beatToSec(b) {
  const i = Math.floor(b);
  const frac = b - i;
  const t0 = BEAT_TIMES[Math.min(i, BEAT_TIMES.length - 1)];
  const t1 = BEAT_TIMES[Math.min(i + 1, BEAT_TIMES.length - 1)];
  return Number((t0 + (t1 - t0) * frac).toFixed(3));
}

function makeNotes(entries) {
  return entries.map(([bStart, bEnd, midi, vel]) => {
    const start = beatToSec(bStart);
    const end = beatToSec(bEnd);
    const dur = Number(Math.max(0.12, end - start - 0.025).toFixed(3));
    return [start, dur, midi, vel];
  });
}

// Exact frame timings (at 60Hz) synced to the final C Major chord lock at 10.58s!
export const MARCELLI_AMEN_TIMING = {
  lockSec: 10.58,
  lockFrames: Math.round(10.58 * 60), // 635 frames — crest locks upright right on the final chord!
  totalFrames: Math.round(18.2 * 60), // 1092 frames — holds AMEN ~2.5s in quiet reverence after reverb ends
};

export const MARCELLI_AMEN_SCORE = {
  title: 'Palestrina - Missa Papae Marcelli (Gloria: Amen)',
  shortTitle: 'MARCELLI AMEN',
  duration: 14.3,
  tracks: [
    {
      name: 'Cantus (Soprano)',
      role: 'soprano',
      notes: makeNotes([
        // Iconic soaring high C5 pedal through the entire 5-measure Amen!
        [0, 8, 72, 0.66],
        [8, 20, 72, 0.72],
      ]),
    },
    {
      name: 'Altus (Alto)',
      role: 'alto',
      notes: makeNotes([
        [0, 1, 64, 0.60],     // E4
        [1, 2, 65, 0.62],     // F4
        [2, 4, 67, 0.64],     // G4
        [4, 6, 69, 0.66],     // A4
        [6, 7.5, 72, 0.68],   // C5
        [7.5, 8, 71, 0.62],   // B4
        [8, 12, 69, 0.68],    // A4 (plagal swell)
        [12, 20, 67, 0.68],   // G4 (final C Major 5th)
      ]),
    },
    {
      name: 'Tenor 1',
      role: 'tenor',
      notes: makeNotes([
        // Spotlighted melodic line with the iconic octave leap (C4 -> A3 -> A4 -> G4 -> F4 -> E4)!
        [0, 1, 67, 0.84],     // G4
        [1, 2, 65, 0.86],     // F4
        [2, 3.5, 64, 0.88],   // E4
        [3.5, 4, 62, 0.84],   // D4
        [4, 4.5, 60, 0.88],   // C4
        [4.5, 5, 57, 0.86],   // A3
        [5, 7, 69, 0.98],     // A4 (radiant octave leap!)
        [7, 8, 67, 0.94],     // G4
        [8, 12, 65, 0.92],    // F4
        [12, 20, 64, 0.84],   // E4 (final C Major 3rd!)
      ]),
    },
    {
      name: 'Tenor 2',
      role: 'tenor',
      notes: makeNotes([
        // Warm inner C4 pedal tucked softly under Tenor 1's melody
        [0, 12, 60, 0.52],
        [12, 20, 60, 0.56],
      ]),
    },
    {
      name: 'Bassus 1',
      role: 'bass',
      notes: makeNotes([
        [2, 4, 48, 0.68],     // C3
        [4, 7, 53, 0.72],     // F3
        [7, 8, 55, 0.70],     // G3
        [8, 9, 57, 0.78],     // A3
        [9, 10, 53, 0.76],    // F3
        [10, 11.5, 57, 0.84], // A3
        [11.5, 12, 59, 0.86], // B3
        // Moving bass line brought right to the front for the final cadence!
        [12, 15, 60, 0.96],   // C4
        [15, 15.5, 59, 0.98], // B3 (expressive closing ornament)
        [15.5, 16, 57, 1.00], // A3
        [16, 20, 55, 0.96],   // G3 (locks onto final C Major!)
      ]),
    },
    {
      name: 'Bassus 2',
      role: 'bass',
      notes: makeNotes([
        [0, 3, 60, 0.64],     // C4
        [3, 4, 59, 0.62],     // B3
        [4, 5.5, 57, 0.66],   // A3
        [5.5, 6, 55, 0.62],   // G3
        [6, 7, 53, 0.64],     // F3
        [7, 8, 52, 0.62],     // E3
        [8, 12, 53, 0.74],    // F3 (deep plagal foundation)
        [12, 20, 48, 0.78],   // C3 (cathedral tonic pedal!)
      ]),
    },
  ],
};
