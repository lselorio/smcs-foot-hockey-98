#!/usr/bin/env node
// Compiles public-domain GregoBase GABC chant notation (Missa VIII "de Angelis" Gloria, Mode V)
// into a 4-voice SATB 16-bit chiptune cathedral-organ score for Foot Hockey 98!

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../src/music/gloria-viii.js');

// Exact Solesmes Liber Usualis / GregoBase #961 GABC for Gloria VIII (Missa de Angelis, Mode V, c3 clef)
const GLORIA_VIII_GABC = `
GLó(h')ri(h)a(f') in(e) ex(d)cél(e')sis(f) De(e.)o.(d.) (::)
Et(h') in(h) ter(f')ra(e) pax(d') ho(e)mí(f')ni(e)bus(d.) (;) bo(d')nae(e) vo(f')lun(h)tá(i.)tis.(h.) (::)
Lau(k)dá(jvIH)mus(i.) te.(h.) (::)
Be(k')ne(j)dí(i')ci(h)mus(ij) te.(ih..) (::)
Ad(h')o(h)rá(fvED)mus(ef) te.(d.) (::)
Glo(d')ri(e)fi(f)cá(h')mus(i) te.(h.) (::)
Grá(h')ti(i)as(j) á(k')gi(j)mus(ij) ti(i.)bi(h.) (;) pro(h')pter(h) ma(f')gnam(e) gló(d')ri(e)am(f) tu(e.)am.(d.) (::)
Dó(h')mi(h)ne(f') De(e)us,(d.) Rex(e') cae(f)lé(e.)stis,(d.) (;) De(d)us(ef) Pa(h)ter(ih) o(ij)mní(kj)pot(ih)ens.(h.) (::)
Dó(h')mi(h)ne(f') Fi(e)li(d') u(e)ni(f)gé(h')ni(i)te(h.) (,) Je(ij)su(kj) Chri(i.)ste.(h.) (::)
Dó(k')mi(j)ne(i') De(j)us,(ih) A(i')gnus(j) De(i.)i,(h.) (;) Fí(h')li(h)us(fvED) Pa(efe)tris.(d.) (::)
Qui(d') tol(e)lis(f') pec(h)cá(i')ta(h) mun(ij/kj)di,(ih..) (;) mi(h')se(h)ré(fvED)re(ef) no(e.)bis.(d.) (::)
Qui(k') tol(j)lis(i') pec(h)cá(i')ta(j) mun(i.)di,(h.) (;) sús(h')ci(h)pe(f.) de(e)pre(d')ca(e)ti(f')ó(h)nem(ih) no(ij/kj)stram.(ih..) (::)
Qui(h') se(h)des(f') ad(e) déx(d')te(e)ram(f) Pa(e.)tris,(d.) (;) mi(d')se(e)ré(f')re(h) no(i.)bis.(h.) (::)
Quó(k')ni(j)am(i') tu(h) so(i')lus(j) san(i.)ctus.(h.) (::)
Tu(k') so(j)lus(ih) Dó(ij)mi(ih)nus.(h.) (::)
Tu(h) so(h')lus(f) Al(e[ll:1]d)tís(ef)si(h)mus,(ih..) (,) Je(ij)su(kj) Chri(i.)ste.(h.) (::)
Cum(h') San(h)cto(fvED) Spí(ef)ri(e)tu,(d.) (;) in(d') gló(e)ri(f')a(h) De(i')i(h) Pa(ij/kj)tris.(ih..) (::)
A(gxhvFE'DgvFE)men.(e[ll:1]d..) (::)
`;

// GABC (c3) clef -> Mode V in F Major (final d = F4, reciting tone h = C5, high k = F5)
const PITCH_MAP = {
  c: 64, // E4
  d: 65, // F4 (Final)
  e: 67, // G4
  f: 69, // A4
  g: 71, // B4 (70 = Bb4 when gx flat active)
  h: 72, // C5 (Reciting tone)
  i: 74, // D5
  j: 76, // E5
  k: 77, // F5
};

const BASE_PULSE = 0.38; // Matches authentic St. Mike's sung Gloria tempo (~4.5s for "Gloria in excelsis Deo")

// Parse GABC into a flat stream of melody note events + phrase bar markers
function parseGabc(gabc) {
  const events = [];
  let t = 0.1;
  // Split by whitespace into words/bars so accidentals (gx) scope to the current word
  const tokens = gabc.trim().split(/\s+/);

  for (const word of tokens) {
    let flatG = false;
    const parenMatches = [...word.matchAll(/\(([^)]+)\)/g)];
    for (const m of parenMatches) {
      const code = m[1];
      if (code === '::') {
        // Give the final cadence note of each full line a natural Gregorian breadth!
        const prevEv = events[events.length - 1];
        if (prevEv && prevEv.type === 'note') {
          const extra = BASE_PULSE * 0.45;
          prevEv.dur += extra;
          t += extra;
        }
        events.push({ type: 'bar', kind: 'double', time: t });
        t += 0.72;
        continue;
      }
      if (code === ';') {
        const prevEv = events[events.length - 1];
        if (prevEv && prevEv.type === 'note') {
          const extra = BASE_PULSE * 0.25;
          prevEv.dur += extra;
          t += extra;
        }
        events.push({ type: 'bar', kind: 'half', time: t });
        t += 0.48;
        continue;
      }
      if (code === ',') {
        events.push({ type: 'bar', kind: 'quarter', time: t });
        t += 0.26;
        continue;
      }

      // Strip bracketed Gregorio layout directives like [ll:1]
      const clean = code.replace(/\[[^\]]*\]/g, '');
      let i = 0;
      while (i < clean.length) {
        const ch = clean[i];
        const lower = ch.toLowerCase();

        // Check for accidental (e.g. gx = B-flat)
        if (lower in PITCH_MAP && clean[i + 1] === 'x') {
          if (lower === 'g') flatG = true;
          i += 2;
          continue;
        }

        if (lower in PITCH_MAP) {
          const isInclinata = ch !== lower; // Uppercase = swift descending diamond note
          let midi = PITCH_MAP[lower];
          if (lower === 'g' && flatG) midi = 70; // Bb4!

          let accented = false;
          let dots = 0;
          i++;
          while (i < clean.length && !(/[a-kA-K]/.test(clean[i]))) {
            const mod = clean[i];
            if (mod === "'") accented = true;
            else if (mod === '.') dots++;
            i++;
          }

          let dur = isInclinata ? BASE_PULSE * 0.88 : BASE_PULSE;
          if (dots === 1) {
            dur = BASE_PULSE * 2.15;
          } else if (dots >= 2) {
            // In Solesmes GABC, ".." at the end of a 2-note neume (e.g. "ih..", "ed..")
            // doubles BOTH notes (two held cadence notes)!
            const prevEv = events[events.length - 1];
            if (prevEv && prevEv.type === 'note' && prevEv.dots === 0) {
              const oldDur = prevEv.dur;
              const newPrevDur = BASE_PULSE * 2.15;
              prevEv.dur = newPrevDur;
              prevEv.dots = 1;
              t += newPrevDur - oldDur;
            }
            dur = BASE_PULSE * 2.75;
          }

          events.push({
            type: 'note',
            start: t,
            dur,
            midi,
            accented,
            dots,
            isFlat: lower === 'g' && flatG,
          });
          t += dur;
        } else {
          i++;
        }
      }
    }
  }

  // Graceful cathedral ritardando across the final 5 notes of the closing "Amen." (Bb4 -> A4 -> G4 -> G4. -> F4.)
  const noteEvents = events.filter((e) => e.type === 'note');
  const ritFactors = [1.18, 1.56, 1.88, 1.22, 1.50];
  if (noteEvents.length >= ritFactors.length) {
    const startIdx = noteEvents.length - ritFactors.length;
    let curT = noteEvents[startIdx].start;
    for (let k = 0; k < ritFactors.length; k++) {
      const ev = noteEvents[startIdx + k];
      ev.start = curT;
      ev.dur *= ritFactors[k];
      curT += ev.dur;
    }
    t = Math.max(t, curT + 0.72);
  }

  return { events, totalDuration: t + 0.4 };
}

// Traditional Solesmes-style modal/F-major cathedral organ chords for Missa de Angelis!
// Each chord gives [bassMidi, tenorMidi, altoMidi] cleanly below Soprano (F4..F5)
const CHORDS = {
  F: { name: 'F', bass: 41, tenor: 53, alto: 60, tones: [5, 9, 0] },      // F2, F3, C4
  F6: { name: 'F6', bass: 45, tenor: 53, alto: 60, tones: [5, 9, 0] },    // A2, F3, C4
  C: { name: 'C', bass: 48, tenor: 55, alto: 60, tones: [0, 4, 7] },      // C3, G3, C4
  C_open: { name: 'C', bass: 48, tenor: 52, alto: 55, tones: [0, 4, 7] }, // C3, E3, G3
  Dm: { name: 'Dm', bass: 50, tenor: 57, alto: 62, tones: [2, 5, 9] },    // D3, A3, D4
  Bb: { name: 'Bb', bass: 46, tenor: 53, alto: 58, tones: [10, 2, 5] },   // Bb2, F3, Bb3
  Gm: { name: 'Gm', bass: 43, tenor: 55, alto: 58, tones: [7, 10, 2] },   // G2, G3, Bb3
  Am: { name: 'Am', bass: 45, tenor: 52, alto: 57, tones: [9, 0, 4] },    // A2, E3, A3
};

function chooseChordForNotes(sliceNotes, isPhraseEnd, prevChordName) {
  const pcs = sliceNotes.map((n) => n.midi % 12);
  const lastPc = pcs[pcs.length - 1];
  const hasBb = pcs.includes(10);

  // Iconic Missa de Angelis cadence resolutions:
  if (isPhraseEnd) {
    if (lastPc === 5) return CHORDS.F;  // Cadence on F -> warm F Major
    if (lastPc === 0) return CHORDS.C;  // Cadence on C -> bright C Major (or F)
    if (lastPc === 2) return CHORDS.Dm; // Cadence on D -> D minor
  }

  if (hasBb) {
    return lastPc === 7 ? CHORDS.Gm : CHORDS.Bb;
  }

  // Score candidate chords by melody consonance, preferring smooth cathedral progressions
  const candidates = [CHORDS.F, CHORDS.C, CHORDS.Dm, CHORDS.Bb, CHORDS.Am, CHORDS.Gm];
  let best = CHORDS.F;
  let bestScore = -1e9;

  for (const ch of candidates) {
    let score = 0;
    for (const n of sliceNotes) {
      const pc = n.midi % 12;
      const weight = n.accented || n.dots > 0 ? 2.2 : 1.0;
      if (ch.tones.includes(pc)) score += weight * 2.0;
      else score -= weight * 0.6;
    }
    // Slight preference for F and C pillars in Mode V, and gentle variety if previous chord held long
    if (ch.name === 'F') score += 0.9;
    if (ch.name === 'C') score += 0.45;
    if (ch.name === prevChordName) score -= 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return best;
}

function buildScore() {
  const { events, totalDuration } = parseGabc(GLORIA_VIII_GABC);
  const soprano = [];
  const alto = [];
  const tenor = [];
  const bass = [];

  // Split into phrases at barlines
  const phrases = [];
  let current = [];
  for (const ev of events) {
    if (ev.type === 'note') {
      current.push(ev);
    } else if (ev.type === 'bar' && current.length > 0) {
      phrases.push({ notes: current, barKind: ev.kind });
      current = [];
    }
  }
  if (current.length > 0) phrases.push({ notes: current, barKind: 'double' });

  let prevChord = null;
  for (const ph of phrases) {
    const notes = ph.notes;
    // Emit crisp legato Soprano lead melody (100% authentic Liber Usualis pitches!)
    for (const n of notes) {
      const vel = n.accented ? 0.78 : n.dots > 0 ? 0.74 : 0.66;
      soprano.push([
        Number(n.start.toFixed(3)),
        Number((n.dur * 0.96).toFixed(3)),
        n.midi,
        vel,
      ]);
    }

    // Divide each phrase into harmonic spans (~2-4 notes each, changing on accents & cadences!)
    const spans = [];
    let spanStart = 0;
    for (let i = 1; i < notes.length; i++) {
      const spanLen = i - spanStart;
      const isCadenceStart = i === notes.length - 1 && notes[i].dots > 0;
      const isStrongAccent = notes[i].accented && spanLen >= 2;
      const isBbShift = notes[i].isFlat && !notes[i - 1].isFlat;
      if (isCadenceStart || isStrongAccent || isBbShift || spanLen >= 4) {
        spans.push(notes.slice(spanStart, i));
        spanStart = i;
      }
    }
    if (spanStart < notes.length) {
      spans.push(notes.slice(spanStart));
    }

    for (let si = 0; si < spans.length; si++) {
      const slice = spans[si];
      const isEnd = si === spans.length - 1;
      const chord = chooseChordForNotes(slice, isEnd, prevChord);
      prevChord = chord.name;

      const t0 = slice[0].start;
      const last = slice[slice.length - 1];
      const t1 = last.start + last.dur + (isEnd && ph.barKind === 'double' ? 0.14 : 0.02);
      const dur = Math.max(0.22, t1 - t0);

      // Keep alto safely below soprano melody
      const minSop = Math.min(...slice.map((n) => n.midi));
      const altoMidi = chord.alto >= minSop - 2 ? chord.alto - 5 : chord.alto;

      alto.push([Number(t0.toFixed(3)), Number((dur * 0.96).toFixed(3)), altoMidi, 0.50]);
      tenor.push([Number(t0.toFixed(3)), Number((dur * 0.96).toFixed(3)), chord.tenor, 0.52]);
      bass.push([Number(t0.toFixed(3)), Number((dur * 0.96).toFixed(3)), chord.bass, 0.62]);
    }
  }

  return {
    title: 'Missa VIII (de Angelis) - Gloria (16-Bit Chiptune Organ & Choir)',
    shortTitle: 'GLORIA VIII',
    duration: Number(totalDuration.toFixed(2)),
    tracks: [
      { role: 'soprano', notes: soprano },
      { role: 'alto', notes: alto },
      { role: 'tenor', notes: tenor },
      { role: 'bass', notes: bass },
    ],
  };
}

const score = buildScore();
const js = `// Generated from public-domain GregoBase #961 GABC (Solesmes Liber Usualis)
// Gregorian Missa VIII "de Angelis" Gloria arranged for 4-voice 16-bit Chiptune Choir & Organ!
export const GLORIA_VIII_SCORE = ${JSON.stringify(score)};
`;

fs.writeFileSync(OUT_PATH, js, 'utf8');
console.log(
  `Wrote ${OUT_PATH} (${(js.length / 1024).toFixed(1)} KB): duration=${score.duration}s, notes=${score.tracks
    .map((t) => `${t.role}:${t.notes.length}`)
    .join(', ')}`
);
