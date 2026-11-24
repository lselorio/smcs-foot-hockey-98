#!/usr/bin/env node
// Compiles public-domain GregoBase #2435 GABC (Solesmes Liber Usualis 1961, p. 279)
// Gregorian Chant "Salve Regina" (Simple Tone, Mode V, c4 clef)
// into a 4-voice SATB 16-bit chiptune choir & cathedral-organ score for Foot Hockey 98!

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../src/music/salve-regina.js');

// Exact Solesmes Liber Usualis / GregoBase #2435 GABC for Salve Regina (Simple Tone, Mode V, c4 clef)
const SALVE_REGINA_GABC = `
SAl(c)ve,(e) Re(g')gí(h)na,(g.) *() ma(h)ter(j') mi(i)se(h)ri(g)cór(h')di(g)ae :(g.) (;)
Vi(j)ta,(g') dul(h)cé(ff)do,(d.) (;) et(e) spes(f) no(g')stra,(e) sal(e[ll:1]d)ve.(c.) (::)
Ad(g) te(h) cla(i')má(j)mus,(g.) (;) éx(h)su(i)les,(j) fí(i')li(h)i(g') He(h)vae.(g.) (::)
Ad(j) te(g') sus(h)pi(f')rá(d)mus,(e'_[oh:h]) (;) ge(e)mén(g')tes(h) et(j') flen(h)tes(g'_[oh:h]) (;) in(h) hac(g') la(f)cri(e')má(d)rum(e') val(d)le.(c.) (::)
E(g){ia}(h') er(i)go,(j'_) Ad(g)vo(h')cá(j)ta(i') no(h)stra,(g.) (;) il(j)los(g') tu(h)os(f'_) mi(d)se(e')ri(f)cór(g')des(f) ó(h')cu(g)los(g'_[oh:h]) (\`) ad(f) nos(e') con(d)vér(e[ll:1]d)te.(c.) (::)
Et(g) Je(hi)sum,(jj) be(i)ne(g')dí(h)ctum(g') fru(g)ctum(h') ven(j)tris(i') tu(h)i,(g.) (;) no(c)bis(g'_[oh:h]) post(h) hoc(j') ex(i)sí(h')li(g)um(e'_[oh:h]) os(f)tén(e[ll:1]d)de.(c.) (::)
O(e!fwg) cle(ee)mens :(c.) (::)
O(g!hwi/ji) pi(hg)a :(g.) (::)
O(jjj//ghf'fd) dul(ef)cis(g'_[oh:h]) *(;) Vir(c)go(f') Ma(e)rí(dc)a.(c.) (::)
`;

// GABC (c4) clef transposed +3 semitones to traditional organ/choir key of Eb Major
// (final c = Eb4 [63], dominant g = Bb4 [70], upper final j = Eb5 [75])
const PITCH_MAP = {
  c: 63, // Eb4 (Final)
  d: 65, // F4
  e: 67, // G4
  f: 68, // Ab4
  g: 70, // Bb4 (Reciting/dominant)
  h: 72, // C5
  i: 74, // D5
  j: 75, // Eb5 (Upper octave)
};

const BASE_PULSE = 0.42; // Lyrical, stately Marian antiphon tempo

function parseGabc(gabc) {
  const events = [];
  let t = 0.1;
  const tokens = gabc.trim().split(/\s+/);

  for (const word of tokens) {
    const parenMatches = [...word.matchAll(/\(([^)]*)\)/g)];
    for (const m of parenMatches) {
      const code = m[1].trim();
      if (!code) continue;

      if (code === '::') {
        const prevEv = events[events.length - 1];
        if (prevEv && prevEv.type === 'note') {
          const extra = BASE_PULSE * 0.55;
          prevEv.dur += extra;
          t += extra;
        }
        events.push({ type: 'bar', kind: 'double', time: t });
        t += 0.78;
        continue;
      }
      if (code === ';') {
        const prevEv = events[events.length - 1];
        if (prevEv && prevEv.type === 'note') {
          const extra = BASE_PULSE * 0.30;
          prevEv.dur += extra;
          t += extra;
        }
        events.push({ type: 'bar', kind: 'half', time: t });
        t += 0.50;
        continue;
      }
      if (code === ',' || code === '`') {
        events.push({ type: 'bar', kind: 'quarter', time: t });
        t += 0.28;
        continue;
      }

      // Strip bracketed Gregorio directives like [ll:1], [oh:h]
      const clean = code.replace(/\[[^\]]*\]/g, '');
      let i = 0;
      while (i < clean.length) {
        const ch = clean[i];
        const lower = ch.toLowerCase();

        if (lower in PITCH_MAP) {
          const midi = PITCH_MAP[lower];
          let accented = false;
          let episema = false;
          let quilisma = false;
          let dots = 0;
          let doubleSlashAfter = false;
          i++;

          while (i < clean.length && !(/[a-jA-J]/.test(clean[i]))) {
            const mod = clean[i];
            if (mod === "'") accented = true;
            else if (mod === '_') episema = true;
            else if (mod === 'w') quilisma = true;
            else if (mod === '.') dots++;
            else if (mod === '/' && clean[i + 1] === '/') {
              doubleSlashAfter = true;
              i++;
            }
            i++;
          }

          let dur = BASE_PULSE;
          if (dots === 1) {
            dur = BASE_PULSE * 2.15;
          } else if (dots >= 2) {
            const prevEv = events[events.length - 1];
            if (prevEv && prevEv.type === 'note' && prevEv.dots === 0) {
              const oldDur = prevEv.dur;
              const newPrevDur = BASE_PULSE * 2.15;
              prevEv.dur = newPrevDur;
              prevEv.dots = 1;
              t += newPrevDur - oldDur;
            }
            dur = BASE_PULSE * 2.75;
          } else if (episema) {
            dur = BASE_PULSE * 1.55;
          } else if (quilisma) {
            // Subtle expressive lengthening before rising quilisma
            dur = BASE_PULSE * 1.15;
          }

          if (doubleSlashAfter) {
            dur += BASE_PULSE * 0.35;
          }

          events.push({
            type: 'note',
            start: t,
            dur,
            midi,
            accented: accented || episema,
            dots,
          });
          t += dur;
        } else {
          i++;
        }
      }
    }
  }

  return { events, totalDuration: t + 0.5 };
}

// Warm Solesmes modal organ chords in Eb Major (c4 transposed +3)
// Each chord gives [bassMidi, tenorMidi, altoMidi] cleanly below Soprano (Eb4..Eb5)
const CHORDS = {
  Eb: { name: 'Eb', bass: 39, tenor: 51, alto: 58, tones: [3, 7, 10] },   // Eb2, Eb3, Bb3
  Eb6: { name: 'Eb6', bass: 43, tenor: 51, alto: 58, tones: [3, 7, 10] }, // G2, Eb3, Bb3
  Bb: { name: 'Bb', bass: 46, tenor: 53, alto: 58, tones: [10, 2, 5] },   // Bb2, F3, Bb3
  Cm: { name: 'Cm', bass: 48, tenor: 55, alto: 60, tones: [0, 3, 7] },    // C3, G3, C4
  Ab: { name: 'Ab', bass: 44, tenor: 51, alto: 60, tones: [8, 0, 3] },    // Ab2, Eb3, C4
  Fm: { name: 'Fm', bass: 41, tenor: 53, alto: 60, tones: [5, 8, 0] },    // F2, F3, C4
  Gm: { name: 'Gm', bass: 43, tenor: 55, alto: 58, tones: [7, 10, 2] },   // G2, G3, Bb3
};

function chooseChordForNotes(sliceNotes, isPhraseEnd, prevChordName) {
  const pcs = sliceNotes.map((n) => n.midi % 12);
  const lastPc = pcs[pcs.length - 1];

  // Classic Salve Regina Mode V cadences:
  if (isPhraseEnd) {
    if (lastPc === 3) return CHORDS.Eb;  // Final cadence on Eb -> Eb Major
    if (lastPc === 10) return CHORDS.Bb; // Half cadence on Bb -> Bb Major
    if (lastPc === 5) return CHORDS.Fm;  // Dulcedo cadence on F -> F minor (or Bb)
    if (lastPc === 7) return CHORDS.Eb;  // Suspiramus / exsilium on G -> Eb Major
  }

  const candidates = [CHORDS.Eb, CHORDS.Bb, CHORDS.Cm, CHORDS.Ab, CHORDS.Fm, CHORDS.Gm];
  let best = CHORDS.Eb;
  let bestScore = -1e9;

  for (const ch of candidates) {
    let score = 0;
    for (const n of sliceNotes) {
      const pc = n.midi % 12;
      const weight = n.accented || n.dots > 0 ? 2.2 : 1.0;
      if (ch.tones.includes(pc)) score += weight * 2.0;
      else score -= weight * 0.65;
    }
    if (ch.name === 'Eb') score += 0.85;
    if (ch.name === 'Bb') score += 0.45;
    if (ch.name === 'Cm' || ch.name === 'Ab') score += 0.2;
    if (ch.name === prevChordName) score -= 0.18;
    if (score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return best;
}

function buildScore() {
  const { events, totalDuration } = parseGabc(SALVE_REGINA_GABC);
  const soprano = [];
  const alto = [];
  const tenor = [];
  const bass = [];

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
    for (const n of notes) {
      const vel = n.accented ? 0.78 : n.dots > 0 ? 0.74 : 0.66;
      soprano.push([
        Number(n.start.toFixed(3)),
        Number((n.dur * 0.96).toFixed(3)),
        n.midi,
        vel,
      ]);
    }

    const spans = [];
    let spanStart = 0;
    for (let i = 1; i < notes.length; i++) {
      const spanLen = i - spanStart;
      const isCadenceStart = i === notes.length - 1 && notes[i].dots > 0;
      const isStrongAccent = notes[i].accented && spanLen >= 2;
      if (isCadenceStart || isStrongAccent || spanLen >= 4) {
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
      const t1 = last.start + last.dur + (isEnd && ph.barKind === 'double' ? 0.16 : 0.02);
      const dur = Math.max(0.24, t1 - t0);

      // Keep alto cleanly below the lowest soprano note in this harmonic span
      const minSop = Math.min(...slice.map((n) => n.midi));
      const altoMidi = chord.alto >= minSop - 2 ? chord.alto - 5 : chord.alto;

      alto.push([Number(t0.toFixed(3)), Number((dur * 0.96).toFixed(3)), altoMidi, 0.50]);
      tenor.push([Number(t0.toFixed(3)), Number((dur * 0.96).toFixed(3)), chord.tenor, 0.52]);
      bass.push([Number(t0.toFixed(3)), Number((dur * 0.96).toFixed(3)), chord.bass, 0.62]);
    }
  }

  return {
    title: 'Salve Regina (Simple Tone, Mode V) - 16-Bit Chiptune Choir & Organ',
    shortTitle: 'SALVE REGINA',
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
const js = `// Generated from public-domain GregoBase #2435 GABC (Solesmes Liber Usualis 1961, p. 279)
// Gregorian Chant "Salve Regina" (Simple Tone, Mode V) arranged for 4-voice 16-bit Chiptune Choir & Organ!
export const SALVE_REGINA_SCORE = ${JSON.stringify(score)};
`;

fs.writeFileSync(OUT_PATH, js);
console.log(
  `Wrote ${OUT_PATH} (${score.duration}s, notes: S=${score.tracks[0].notes.length}, A=${score.tracks[1].notes.length}, T=${score.tracks[2].notes.length}, B=${score.tracks[3].notes.length})`
);
