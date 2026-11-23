#!/usr/bin/env node
// Zero-dependency Standard MIDI File (SMF Format 0/1) -> Compact ES Module Score converter
// Usage: node scripts/midi-to-score.mjs <input.mid> <output.js> [exportName]

import fs from 'node:fs/promises';
import path from 'node:path';

function readUint16BE(buf, off) {
  return (buf[off] << 8) | buf[off + 1];
}

function readUint32BE(buf, off) {
  return (
    ((buf[off] << 24) >>> 0) +
    (buf[off + 1] << 16) +
    (buf[off + 2] << 8) +
    buf[off + 3]
  );
}

function readVLQ(buf, off) {
  let value = 0;
  let pos = off;
  while (pos < buf.length) {
    const b = buf[pos++];
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return { value, nextOffset: pos };
}

export function parseMidi(buf) {
  if (buf.toString('ascii', 0, 4) !== 'MThd') {
    throw new Error('Invalid MIDI file: missing MThd header');
  }
  const headerLen = readUint32BE(buf, 4);
  const format = readUint16BE(buf, 8);
  const numTracks = readUint16BE(buf, 10);
  const ticksPerBeat = readUint16BE(buf, 12);

  let offset = 8 + headerLen;
  const tempoEvents = [{ tick: 0, usPerBeat: 500000 }]; // default 120 BPM
  const rawTracks = [];

  for (let t = 0; t < numTracks && offset < buf.length; t++) {
    const id = buf.toString('ascii', offset, offset + 4);
    const len = readUint32BE(buf, offset + 4);
    offset += 8;
    const end = Math.min(buf.length, offset + len);
    if (id !== 'MTrk') {
      offset = end;
      continue;
    }

    let pos = offset;
    let absTick = 0;
    let runningStatus = 0;
    let trackName = '';
    const activeNotes = new Map();
    const notes = [];

    while (pos < end) {
      const vlq = readVLQ(buf, pos);
      absTick += vlq.value;
      pos = vlq.nextOffset;
      if (pos >= end) break;

      let status = buf[pos];
      if (status < 0x80) {
        status = runningStatus;
      } else {
        pos++;
        if (status < 0xf0) runningStatus = status;
      }

      if (status === 0xff) {
        const metaType = buf[pos++];
        const ml = readVLQ(buf, pos);
        pos = ml.nextOffset;
        const dataEnd = Math.min(end, pos + ml.value);
        if (metaType === 0x51 && ml.value === 3) {
          const usPerBeat = (buf[pos] << 16) | (buf[pos + 1] << 8) | buf[pos + 2];
          tempoEvents.push({ tick: absTick, usPerBeat });
        } else if (metaType === 0x03) {
          trackName = buf.toString('utf8', pos, dataEnd).replace(/\0/g, '').trim();
        } else if (metaType === 0x2f) {
          pos = dataEnd;
          break;
        }
        pos = dataEnd;
      } else if (status === 0xf0 || status === 0xf7) {
        const sl = readVLQ(buf, pos);
        pos = Math.min(end, sl.nextOffset + sl.value);
      } else {
        const type = status & 0xf0;
        const channel = status & 0x0f;
        if (type === 0xc0 || type === 0xd0) {
          pos += 1;
        } else {
          const d1 = buf[pos++];
          const d2 = buf[pos++];
          const key = `${channel}:${d1}`;
          if (type === 0x90 && d2 > 0) {
            if (!activeNotes.has(key)) activeNotes.set(key, []);
            activeNotes.get(key).push({ startTick: absTick, velocity: d2, channel, pitch: d1 });
          } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
            const stack = activeNotes.get(key);
            if (stack && stack.length > 0) {
              const on = stack.shift();
              if (absTick > on.startTick) {
                notes.push({
                  pitch: on.pitch,
                  velocity: on.velocity,
                  channel: on.channel,
                  startTick: on.startTick,
                  endTick: absTick,
                });
              }
            }
          }
        }
      }
    }

    if (notes.length > 0) {
      rawTracks.push({ index: t, name: trackName, notes });
    }
    offset = end;
  }

  // Sort & deduplicate tempo map
  tempoEvents.sort((a, b) => a.tick - b.tick);
  const tempoMap = [];
  for (const ev of tempoEvents) {
    if (tempoMap.length && tempoMap[tempoMap.length - 1].tick === ev.tick) {
      tempoMap[tempoMap.length - 1] = ev;
    } else {
      tempoMap.push(ev);
    }
  }

  // Precompute cumulative seconds at each tempo change
  const segments = [];
  let accSec = 0;
  for (let i = 0; i < tempoMap.length; i++) {
    const cur = tempoMap[i];
    if (i > 0) {
      const prev = tempoMap[i - 1];
      accSec += ((cur.tick - prev.tick) / ticksPerBeat) * (prev.usPerBeat / 1e6);
    }
    segments.push({ tick: cur.tick, sec: accSec, usPerBeat: cur.usPerBeat });
  }

  function tickToSec(tick) {
    let seg = segments[0];
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].tick <= tick) seg = segments[i];
      else break;
    }
    return seg.sec + ((tick - seg.tick) / ticksPerBeat) * (seg.usPerBeat / 1e6);
  }

  // If Format 0 (all voices in one track separated by MIDI channel), split by channel
  let voiceTracks = rawTracks;
  if (rawTracks.length === 1) {
    const byChannel = new Map();
    for (const n of rawTracks[0].notes) {
      if (!byChannel.has(n.channel)) byChannel.set(n.channel, []);
      byChannel.get(n.channel).push(n);
    }
    if (byChannel.size > 1) {
      voiceTracks = [...byChannel.entries()].map(([ch, notes], idx) => ({
        index: idx,
        name: `Channel ${ch + 1}`,
        notes,
      }));
    }
  }

  let maxEndSec = 0;
  let minStartSec = Infinity;

  const tracks = voiceTracks.map((tr) => {
    const converted = tr.notes
      .map((n) => {
        const s = tickToSec(n.startTick);
        const e = tickToSec(n.endTick);
        if (s < minStartSec) minStartSec = s;
        if (e > maxEndSec) maxEndSec = e;
        return { s, d: Math.max(0.03, e - s), p: n.pitch, v: n.velocity };
      })
      .sort((a, b) => a.s - b.s || a.p - b.p);

    const pitches = converted.map((n) => n.p).sort((a, b) => a - b);
    const medianPitch = pitches[Math.floor(pitches.length / 2)] || 60;
    return {
      name: tr.name,
      medianPitch,
      minPitch: pitches[0],
      maxPitch: pitches[pitches.length - 1],
      notes: converted,
    };
  });

  // Trim any leading silence cleanly so music starts right away
  const trimOffset = Number.isFinite(minStartSec) && minStartSec > 0.05 ? minStartSec : 0;

  // Sort highest to lowest median pitch to auto-label SATB if unnamed
  const sortedByPitch = [...tracks].sort((a, b) => b.medianPitch - a.medianPitch);
  const satbRoles = ['soprano', 'alto', 'tenor', 'bass'];
  sortedByPitch.forEach((tr, idx) => {
    const lower = tr.name.toLowerCase();
    if (lower.includes('sop')) tr.role = 'soprano';
    else if (lower.includes('alt')) tr.role = 'alto';
    else if (lower.includes('ten')) tr.role = 'tenor';
    else if (lower.includes('bas')) tr.role = 'bass';
    else tr.role = satbRoles[idx] || `voice${idx + 1}`;
  });

  const round3 = (n) => Math.round(n * 1000) / 1000;
  const outputTracks = sortedByPitch.map((tr) => ({
    name: tr.name || tr.role.toUpperCase(),
    role: tr.role,
    medianPitch: tr.medianPitch,
    // Compact tuple format: [startSec, durSec, midiPitch, velocity01]
    notes: tr.notes.map((n) => [
      round3(n.s - trimOffset),
      round3(n.d),
      n.p,
      Math.round((n.v / 127) * 100) / 100,
    ]),
  }));

  return {
    format,
    ticksPerBeat,
    duration: round3(Math.max(0, maxEndSec - trimOffset)),
    tracks: outputTracks,
  };
}

// CLI entrypoint
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const shifts = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--shift' && args[i + 1]) {
      const [role, semitones] = args[++i].split(':');
      shifts[role.toLowerCase()] = Number(semitones) || 0;
    } else {
      positional.push(args[i]);
    }
  }
  const [inPath, outPath, exportName = 'SCORE'] = positional;
  if (!inPath || !outPath) {
    console.error('Usage: node scripts/midi-to-score.mjs <input.mid> <output.js> [exportName] [--shift role:+12]');
    process.exit(1);
  }
  const buf = await fs.readFile(inPath);
  const parsed = parseMidi(buf);

  for (const t of parsed.tracks) {
    const delta = shifts[t.role.toLowerCase()] || 0;
    if (delta !== 0) {
      t.medianPitch += delta;
      for (const n of t.notes) n[2] += delta;
    }
  }
  parsed.tracks.sort((a, b) => b.medianPitch - a.medianPitch);

  const summary = parsed.tracks
    .map((t) => `  - ${t.role.padEnd(8)} (${t.name}): ${t.notes.length} notes, median MIDI ${t.medianPitch}`)
    .join('\n');
  console.log(`Parsed ${path.basename(inPath)}: ${parsed.duration}s, ${parsed.tracks.length} tracks:\n${summary}`);

  const js = `// Auto-generated from ${path.basename(inPath)} via scripts/midi-to-score.mjs
// Compact note tuples: [startSec, durationSec, midiPitch, velocity]
export const ${exportName} = ${JSON.stringify({
    title: path.basename(inPath, path.extname(inPath)),
    duration: parsed.duration,
    tracks: parsed.tracks.map(({ name, role, notes }) => ({ name, role, notes })),
  })};
`;

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, js, 'utf8');
  console.log(`Wrote ${outPath} (${(js.length / 1024).toFixed(1)} KB)`);
}
