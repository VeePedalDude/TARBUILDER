// Instruments: sounding ranges, comfortable ranges, transpositions, and ensemble writing.
// Ranges are typical professional values (sounding pitch, midi). Edit to suit your players.
import { voiceLead, parseChord } from '../theory/chord.mjs';
import { mod, pc } from '../theory/pitch.mjs';

// [low, high] sounding, [comfortLow, comfortHigh], transposition (written = sounding + t), GM program, clef
export const INSTRUMENTS = {
  piccolo: { range: [74, 108], comfort: [76, 103], transpose: -12, program: 72, clef: 'G' },
  flute: { range: [60, 96], comfort: [62, 93], transpose: 0, program: 73, clef: 'G' },
  oboe: { range: [58, 91], comfort: [60, 86], transpose: 0, program: 68, clef: 'G' },
  'english horn': { range: [52, 81], comfort: [55, 77], transpose: 7, program: 69, clef: 'G' },
  clarinet: { range: [50, 91], comfort: [52, 86], transpose: 2, program: 71, clef: 'G' }, // in Bb
  'bass clarinet': { range: [38, 74], comfort: [40, 70], transpose: 14, program: 71, clef: 'G' },
  bassoon: { range: [34, 75], comfort: [36, 70], transpose: 0, program: 70, clef: 'F' },
  'alto sax': { range: [49, 80], comfort: [51, 77], transpose: 9, program: 65, clef: 'G' }, // in Eb
  'tenor sax': { range: [44, 75], comfort: [46, 72], transpose: 14, program: 66, clef: 'G' }, // in Bb, octave+
  'baritone sax': { range: [36, 68], comfort: [38, 65], transpose: 21, program: 67, clef: 'G' },
  'soprano sax': { range: [56, 87], comfort: [58, 84], transpose: 2, program: 64, clef: 'G' },
  horn: { range: [35, 77], comfort: [41, 72], transpose: 7, program: 60, clef: 'G' }, // in F
  trumpet: { range: [52, 82], comfort: [55, 79], transpose: 2, program: 56, clef: 'G' }, // in Bb
  trombone: { range: [40, 72], comfort: [43, 67], transpose: 0, program: 57, clef: 'F' },
  tuba: { range: [26, 65], comfort: [29, 58], transpose: 0, program: 58, clef: 'F' },
  violin: { range: [55, 103], comfort: [55, 93], transpose: 0, program: 40, clef: 'G' },
  viola: { range: [48, 88], comfort: [48, 81], transpose: 0, program: 41, clef: 'C3' },
  cello: { range: [36, 81], comfort: [36, 72], transpose: 0, program: 42, clef: 'F' },
  'double bass': { range: [28, 67], comfort: [28, 60], transpose: 12, program: 43, clef: 'F' },
  harp: { range: [23, 104], comfort: [28, 98], transpose: 0, program: 46, clef: 'G' },
  piano: { range: [21, 108], comfort: [28, 103], transpose: 0, program: 0, clef: 'G' },
  guitar: { range: [40, 88], comfort: [40, 81], transpose: 12, program: 25, clef: 'G8' },
  'bass guitar': { range: [28, 67], comfort: [28, 60], transpose: 12, program: 33, clef: 'F8' },
  glockenspiel: { range: [79, 108], comfort: [79, 105], transpose: -24, program: 9, clef: 'G' },
  vibraphone: { range: [53, 89], comfort: [53, 89], transpose: 0, program: 11, clef: 'G' },
  marimba: { range: [45, 96], comfort: [45, 96], transpose: 0, program: 12, clef: 'G' },
  xylophone: { range: [65, 108], comfort: [65, 105], transpose: -12, program: 13, clef: 'G' },
  celesta: { range: [60, 108], comfort: [60, 103], transpose: -12, program: 8, clef: 'G' },
  timpani: { range: [38, 60], comfort: [40, 57], transpose: 0, program: 47, clef: 'F' },
  soprano: { range: [60, 84], comfort: [62, 79], transpose: 0, program: 52, clef: 'G' },
  mezzo: { range: [57, 81], comfort: [58, 76], transpose: 0, program: 52, clef: 'G' },
  alto: { range: [53, 77], comfort: [55, 74], transpose: 0, program: 52, clef: 'G' },
  tenor: { range: [48, 72], comfort: [50, 69], transpose: 12, program: 52, clef: 'G8' },
  baritone: { range: [45, 69], comfort: [47, 65], transpose: 0, program: 52, clef: 'F' },
  bass: { range: [40, 64], comfort: [41, 62], transpose: 0, program: 52, clef: 'F' },
};

export const ENSEMBLES = {
  'string quartet': ['violin', 'violin', 'viola', 'cello'],
  'string orchestra': ['violin', 'violin', 'viola', 'cello', 'double bass'],
  'brass quintet': ['trumpet', 'trumpet', 'horn', 'trombone', 'tuba'],
  'woodwind quintet': ['flute', 'oboe', 'clarinet', 'horn', 'bassoon'],
  'sax quartet': ['soprano sax', 'alto sax', 'tenor sax', 'baritone sax'],
  satb: ['soprano', 'alto', 'tenor', 'bass'],
  'jazz horns': ['trumpet', 'alto sax', 'tenor sax', 'trombone'],
};

export function instrument(name) {
  const i = INSTRUMENTS[String(name).toLowerCase()];
  if (!i) throw new Error(`Unknown instrument "${name}". Known: ${Object.keys(INSTRUMENTS).join(', ')}`);
  return i;
}

/** written pitch for a transposing instrument (e.g. sounding C4 on Bb trumpet -> written D4) */
export function writtenPitch(name, sounding) {
  return sounding + instrument(name).transpose;
}

/**
 * Range check for tracks that name an instrument: track.instrument = 'violin' etc.
 * Returns [{ level, track, at (tick), pitch, message }]
 */
export function checkRanges(song, { map } = {}) {
  const out = [];
  for (const t of song.tracks) {
    const name = map?.[t.name] ?? t.instrument;
    if (!name || !INSTRUMENTS[String(name).toLowerCase()]) continue;
    const ins = instrument(name);
    for (const n of t.notes) {
      if (n.pitch < ins.range[0] || n.pitch > ins.range[1]) out.push({ level: 'error', track: t.name, at: n.start, pitch: n.pitch, message: `${name}: ${n.pitch} is outside the range ${ins.range.join('-')}` });
      else if (n.pitch < ins.comfort[0] || n.pitch > ins.comfort[1]) out.push({ level: 'warning', track: t.name, at: n.start, pitch: n.pitch, message: `${name}: ${n.pitch} is outside the comfortable range ${ins.comfort.join('-')}` });
    }
  }
  return out;
}

/**
 * Orchestrate a melody + song.chords for an ensemble: top part plays the melody (octave-shifted to fit),
 * inner parts voice-led chord tones, the lowest part plays chord roots.
 * opts: { ensemble name or instrument list, melody (notes), rhythm: 'sustain' | 'pulse' (quarter pulses) }
 * Adds tracks to the song and returns them.
 */
export function orchestrate(song, melody, { ensemble = 'string quartet', rhythm = 'sustain', names } = {}) {
  const list = Array.isArray(ensemble) ? ensemble : ENSEMBLES[ensemble];
  if (!list) throw new Error(`Unknown ensemble "${ensemble}". Known: ${Object.keys(ENSEMBLES).join(', ')}`);
  const ins = list.map(instrument);
  const tracks = list.map((n, i) => ({ name: names?.[i] ?? `${n[0].toUpperCase()}${n.slice(1)}${list.filter((x) => x === n).length > 1 ? ' ' + (list.slice(0, i + 1).filter((x) => x === n).length) : ''}`, kind: 'pitched', program: ins[i].program, instrument: n, tuning: null, maxFret: 22, notes: [] }));
  const fit = (p, r) => {
    let m = p;
    while (m < r[0]) m += 12;
    while (m > r[1]) m -= 12;
    return m;
  };
  // melody in the top part
  for (const n of melody) tracks[0].notes.push({ ...n, pitch: fit(n.pitch, ins[0].comfort) });
  // inner parts + bass from the chords
  const inner = ins.slice(1, -1);
  let prev = null;
  for (const ch of song.chords) {
    const c = parseChord(ch.symbol);
    const pulses = rhythm === 'pulse' ? Math.max(1, Math.round(ch.dur / song.ppq)) : 1;
    const step = ch.dur / pulses;
    const low = Math.max(...inner.map((x) => x.comfort[0]));
    const high = Math.min(...inner.map((x) => x.comfort[1]));
    const v = inner.length ? voiceLead(prev, c, { voices: inner.length, low: Math.min(low, high - 12), high }) : [];
    prev = v;
    const sortedV = v.slice().sort((a, b) => b - a);
    for (let k = 0; k < pulses; k++) {
      const t = ch.start + k * step;
      sortedV.forEach((p, i) => tracks[i + 1].notes.push({ start: t, dur: step, pitch: fit(p, ins[i + 1].range), vel: 72 }));
      const bassPc = c.bass ? pc(c.bass) : c.pcs[0]; // slash chords put their bass note in the lowest part
      const bp = fit(36 + bassPc, ins[ins.length - 1].comfort);
      tracks[tracks.length - 1].notes.push({ start: t, dur: step, pitch: bp, vel: 80 });
    }
  }
  // inner parts must not cross the melody: drop an octave where they do
  for (let i = 1; i < tracks.length - 1; i++) {
    for (const n of tracks[i].notes) {
      const mel = tracks[0].notes.find((m) => m.start <= n.start && m.start + m.dur > n.start);
      if (mel && n.pitch >= mel.pitch && n.pitch - 12 >= ins[i].range[0]) n.pitch -= 12;
    }
  }
  // merge repeated notes in sustained parts
  for (const t of tracks) {
    const merged = [];
    for (const n of t.notes.sort((a, b) => a.start - b.start)) {
      const last = merged[merged.length - 1];
      if (rhythm === 'sustain' && last && last.pitch === n.pitch && last.start + last.dur === n.start && t !== tracks[0]) last.dur += n.dur;
      else merged.push({ ...n });
    }
    t.notes = merged;
  }
  song.tracks.push(...tracks);
  return tracks;
}
