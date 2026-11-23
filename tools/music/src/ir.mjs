// The shared song format every TARBUILDER generator writes and every exporter reads.
//
// Song = {
//   title, artist, tempo (BPM), ppq (ticks per quarter, 960),
//   meter: { num, den },  meterChanges: [{ bar, num, den }],  tempoChanges: [{ bar, bpm }],
//   key: 'C major', bars: N,
//   sections: [{ bar, name }],
//   chords:   [{ start, dur, symbol }],          // ticks; for lead sheets / analysis
//   tracks:   [Track],
// }
// Track = { name, kind: 'fretted' | 'pitched' | 'drums', program (GM 0-127), tuning (fretted only,
//           high string first, e.g. ['E4','B3','G3','D3','A2','E2']), maxFret, clef, notes: [Note] }
// Note  = { start, dur, pitch (midi; GM drum number for drums), vel (1-127),
//           fx?: { pm, h, sl, b:[from,to] quarter-tones, v, lr, x (dead), nh, g, ac, st },
//           string?, fret?  (optional fixed fingering; string 1 = highest),
//           lyric? }
//         tuplets?: [{ start, dur, leaves: [{ start, ticks, den, dots, n, m }] }]   (see tuplets.mjs)
// Times are in ticks from the start of bar 1. Grid: everything must land on 1/32 notes (120 ticks)
// unless song.grid is changed.

import { midi as toMidi, parseNote } from './theory/pitch.mjs';

export const PPQ = 960;
export const DEFAULT_GRID = 120; // 1/32 note

export const GM_PROGRAMS = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano', 'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)', 'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Choir', 'Orchestra Hit',
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)', 'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot',
];

const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const GM_LOOKUP = new Map(GM_PROGRAMS.map((n, i) => [squash(n), i]));
const PROGRAM_ALIASES = {
  piano: 0, epiano: 4, rhodes: 4, organ: 16, nylon: 24, acoustic: 25, steel: 25, jazzguitar: 26, cleanguitar: 27, clean: 27,
  guitar: 29, overdrive: 29, distortion: 30, bass: 33, fingerbass: 33, pickbass: 34, fretless: 35, synthbass: 38,
  strings: 48, choir: 52, brass: 61, sax: 65, flute: 73, lead: 80, pad: 89, drums: 0,
};

/** GM program number from number | name ("Distortion Guitar", "distortionguitar", "bass") */
export function program(p) {
  if (typeof p === 'number') {
    if (!Number.isInteger(p) || p < 0 || p > 127) throw new Error(`GM program must be 0-127, got ${p}`);
    return p;
  }
  const k = squash(String(p));
  if (GM_LOOKUP.has(k)) return GM_LOOKUP.get(k);
  if (k in PROGRAM_ALIASES) return PROGRAM_ALIASES[k];
  throw new Error(`Unknown instrument "${p}". Use a GM name like "Distortion Guitar" or a number 0-127.`);
}

// General MIDI percussion key map (channel 10)
export const GM_DRUMS = {
  35: 'Acoustic Bass Drum', 36: 'Bass Drum 1', 37: 'Side Stick', 38: 'Acoustic Snare', 39: 'Hand Clap', 40: 'Electric Snare',
  41: 'Low Floor Tom', 42: 'Closed Hi-Hat', 43: 'High Floor Tom', 44: 'Pedal Hi-Hat', 45: 'Low Tom', 46: 'Open Hi-Hat',
  47: 'Low-Mid Tom', 48: 'Hi-Mid Tom', 49: 'Crash Cymbal 1', 50: 'High Tom', 51: 'Ride Cymbal 1', 52: 'Chinese Cymbal',
  53: 'Ride Bell', 54: 'Tambourine', 55: 'Splash Cymbal', 56: 'Cowbell', 57: 'Crash Cymbal 2', 58: 'Vibraslap',
  59: 'Ride Cymbal 2', 60: 'Hi Bongo', 61: 'Low Bongo', 62: 'Mute Hi Conga', 63: 'Open Hi Conga', 64: 'Low Conga',
  65: 'High Timbale', 66: 'Low Timbale', 67: 'High Agogo', 68: 'Low Agogo', 69: 'Cabasa', 70: 'Maracas',
  71: 'Short Whistle', 72: 'Long Whistle', 73: 'Short Guiro', 74: 'Long Guiro', 75: 'Claves', 76: 'Hi Wood Block',
  77: 'Low Wood Block', 78: 'Mute Cuica', 79: 'Open Cuica', 80: 'Mute Triangle', 81: 'Open Triangle',
};

// Short names for writing drum parts by hand.
export const DRUM = {
  kick: 36, kick2: 35, snare: 38, rim: 37, sidestick: 37, clap: 39, esnare: 40,
  hh: 42, hat: 42, hhopen: 46, openhat: 46, hhpedal: 44, pedalhat: 44,
  tom1: 50, tom2: 48, tom3: 47, tom4: 45, floortom: 43, floortom2: 41,
  crash: 49, crash2: 57, ride: 51, ridebell: 53, china: 52, splash: 55,
  cowbell: 56, tambourine: 54, shaker: 70, claves: 75, woodblock: 76, congahi: 63, congalo: 64, bongohi: 60, bongolo: 61,
};

export function drum(name) {
  if (typeof name === 'number') return name;
  const k = squash(name);
  if (k in DRUM) return DRUM[k];
  throw new Error(`Unknown drum "${name}". Known: ${Object.keys(DRUM).join(' ')}`);
}

export const TUNINGS = {
  standard: ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'],
  'drop d': ['E4', 'B3', 'G3', 'D3', 'A2', 'D2'],
  'eb standard': ['Eb4', 'Bb3', 'Gb3', 'Db3', 'Ab2', 'Eb2'],
  'd standard': ['D4', 'A3', 'F3', 'C3', 'G2', 'D2'],
  'drop c': ['D4', 'A3', 'F3', 'C3', 'G2', 'C2'],
  'drop b': ['C#4', 'G#3', 'E3', 'B2', 'F#2', 'B1'],
  'open g': ['D4', 'B3', 'G3', 'D3', 'G2', 'D2'],
  'open d': ['D4', 'A3', 'F#3', 'D3', 'A2', 'D2'],
  'open e': ['E4', 'B3', 'G#3', 'E3', 'B2', 'E2'],
  dadgad: ['D4', 'A3', 'G3', 'D3', 'A2', 'D2'],
  'b standard': ['B3', 'F#3', 'D3', 'A2', 'E2', 'B1'],
  'drop a': ['B3', 'F#3', 'D3', 'A2', 'E2', 'A1'],
  '7 string': ['E4', 'B3', 'G3', 'D3', 'A2', 'E2', 'B1'],
  '7 string drop a': ['E4', 'B3', 'G3', 'D3', 'A2', 'E2', 'A1'],
  '7 string drop g': ['D4', 'A3', 'F3', 'C3', 'G2', 'D2', 'G1'],
  '8 string': ['E4', 'B3', 'G3', 'D3', 'A2', 'E2', 'B1', 'F#1'],
  bass: ['G2', 'D2', 'A1', 'E1'],
  'bass drop d': ['G2', 'D2', 'A1', 'D1'],
  'bass drop c': ['F2', 'C2', 'G1', 'C1'],
  'bass 5': ['G2', 'D2', 'A1', 'E1', 'B0'],
  'bass 5 drop a': ['G2', 'D2', 'A1', 'E1', 'A0'],
  ukulele: ['A4', 'E4', 'C4', 'G4'],
};

export function tuning(t) {
  if (Array.isArray(t)) return t.map((n) => String(n));
  const k = String(t).toLowerCase().trim();
  if (!TUNINGS[k]) throw new Error(`Unknown tuning "${t}". Known: ${Object.keys(TUNINGS).join(', ')}`);
  return TUNINGS[k].slice();
}

// ---- construction --------------------------------------------------------------

export function createSong({ title = 'Untitled', artist = 'VeePedalDude', tempo = 120, meter = [4, 4], key = 'C major', bars = 8 } = {}) {
  const [num, den] = Array.isArray(meter) ? meter : [meter.num, meter.den];
  return {
    title, artist, tempo, ppq: PPQ, grid: DEFAULT_GRID,
    meter: { num, den }, meterChanges: [], tempoChanges: [],
    key, bars, sections: [], chords: [], tracks: [],
  };
}

export function addTrack(song, { name, kind, program: prog, tuning: tun, maxFret = 22, clef } = {}) {
  if (!name) throw new Error('addTrack: name required');
  if (!['fretted', 'pitched', 'drums'].includes(kind)) throw new Error(`addTrack: kind must be fretted|pitched|drums, got ${kind}`);
  const t = {
    name, kind,
    program: kind === 'drums' ? 0 : program(prog ?? (kind === 'fretted' ? 29 : 0)),
    tuning: kind === 'fretted' ? tuning(tun ?? 'standard') : null,
    maxFret,
    clef: clef ?? (kind === 'drums' ? 'neutral' : undefined),
    notes: [],
  };
  song.tracks.push(t);
  return t;
}

export function addNote(track, start, dur, pitch, extra = {}) {
  const p = track.kind === 'drums' ? drum(pitch) : typeof pitch === 'number' ? pitch : toMidi(pitch);
  const n = { start, dur, pitch: p, ...extra, vel: extra.vel ?? 96 };
  track.notes.push(n);
  return n;
}

// ---- time helpers --------------------------------------------------------------

export function meterAt(song, bar) {
  let m = song.meter;
  for (const c of song.meterChanges ?? []) if (c.bar <= bar) m = { num: c.num, den: c.den };
  return m;
}

export function barLength(song, bar) {
  const m = meterAt(song, bar);
  return (song.ppq * 4 * m.num) / m.den;
}

/** tick where bar (0-based) starts */
export function barStart(song, bar) {
  let t = 0;
  for (let b = 0; b < bar; b++) t += barLength(song, b);
  return t;
}

export function totalTicks(song) {
  return barStart(song, song.bars);
}

/** bar index (0-based) containing a tick */
export function barAt(song, tick) {
  let t = 0;
  for (let b = 0; b < song.bars; b++) {
    const l = barLength(song, b);
    if (tick < t + l) return b;
    t += l;
  }
  return song.bars;
}

/** length of one beat in ticks (compound meters: dotted quarter in 6/8) */
export function beatTicks(song, bar = 0) {
  const m = meterAt(song, bar);
  const unit = (song.ppq * 4) / m.den;
  return m.den === 8 && m.num % 3 === 0 && m.num > 3 ? unit * 3 : unit;
}

export function chordAt(song, tick) {
  let found = null;
  for (const c of song.chords) if (c.start <= tick && tick < c.start + c.dur) found = c;
  return found;
}

// ---- validation ----------------------------------------------------------------

/** returns [{ level: 'error'|'warning', where, message }] */
export function validateSong(song) {
  const out = [];
  const err = (where, message) => out.push({ level: 'error', where, message });
  const warn = (where, message) => out.push({ level: 'warning', where, message });
  const grid = song.grid ?? DEFAULT_GRID;
  const end = totalTicks(song);
  if (!(song.tempo > 0)) err('song', `Tempo must be > 0, got ${song.tempo}`);
  if (!Number.isInteger(song.bars) || song.bars < 1) err('song', `bars must be a positive integer, got ${song.bars}`);
  for (const c of song.chords ?? []) {
    try {
      // lazy import avoided: chord symbols checked by exporters that need them
      if (!c.symbol) err('chords', `Chord at ${c.start} has no symbol`);
    } catch (e) {
      err('chords', e.message);
    }
  }
  for (const t of song.tracks) {
    const w = (n) => `track "${t.name}" bar ${barAt(song, n.start) + 1}`;
    if (t.kind === 'fretted') {
      try {
        const ms = t.tuning.map((x) => toMidi(x));
        const lo = Math.min(...ms);
        const hi = Math.max(...ms) + t.maxFret;
        for (const n of t.notes) {
          if (n.pitch < lo || n.pitch > hi) err(w(n), `Pitch ${n.pitch} is outside this tuning's range ${lo}-${hi}`);
        }
      } catch (e) {
        err(`track "${t.name}"`, `Bad tuning: ${e.message}`);
      }
    }
    // tuplet regions: inside one bar, on the grid, leaves contiguous, no overlaps
    const regions = (t.tuplets ?? []).slice().sort((a, b) => a.start - b.start);
    regions.forEach((r, i) => {
      const where = `track "${t.name}" bar ${barAt(song, r.start) + 1}`;
      if (r.start % grid || r.dur % grid) err(where, `Tuplet region ${r.start}+${r.dur} is off the ${grid}-tick grid`);
      const b = barAt(song, r.start);
      if (r.start + r.dur > barStart(song, b) + barLength(song, b)) err(where, `Tuplet region crosses the barline`);
      if (i && r.start < regions[i - 1].start + regions[i - 1].dur) err(where, `Tuplet regions overlap`);
      let p = r.start;
      for (const lf of r.leaves ?? []) {
        if (lf.start !== p || !(lf.ticks > 0)) { err(where, `Tuplet leaves must be contiguous (gap or overlap at ${lf.start})`); break; }
        p += lf.ticks;
      }
      if (p !== r.start + r.dur) err(where, `Tuplet leaves add up to ${p - r.start} ticks, region is ${r.dur}`);
    });
    const regionAt = (tick) => regions.find((r) => tick > r.start && tick < r.start + r.dur);
    const okPoint = (tick) => {
      const r = regionAt(tick);
      return r ? r.leaves.some((lf) => lf.start === tick) : tick % grid === 0;
    };
    const byStart = new Map();
    for (const n of t.notes) {
      if (!Number.isInteger(n.start) || n.start < 0) err(w(n), `Bad start ${n.start}`);
      if (!Number.isInteger(n.dur) || n.dur <= 0) err(w(n), `Bad duration ${n.dur}`);
      if (!okPoint(n.start) || !okPoint(n.start + n.dur)) {
        err(w(n), regionAt(n.start) || regionAt(n.start + n.dur)
          ? `Note at ${n.start} (dur ${n.dur}) doesn't start and end on tuplet leaf boundaries`
          : `Note at ${n.start} (dur ${n.dur}) is off the ${grid}-tick grid`);
      }
      if (n.start + n.dur > end) err(w(n), `Note runs past the end of the song (bar ${song.bars})`);
      if (!Number.isInteger(n.pitch) || n.pitch < 0 || n.pitch > 127) err(w(n), `Bad pitch ${n.pitch}`);
      if (t.kind === 'drums' && !GM_DRUMS[n.pitch]) warn(w(n), `Drum note ${n.pitch} is not in the GM drum map (35-81)`);
      if (n.vel !== undefined && (n.vel < 1 || n.vel > 127)) err(w(n), `Velocity ${n.vel} out of 1-127`);
      const key = `${n.start}:${n.pitch}`;
      if (byStart.has(key)) err(w(n), `Duplicate note pitch ${n.pitch} at tick ${n.start}`);
      byStart.set(key, n);
    }
    // same pitch overlapping itself
    const sorted = t.notes.slice().sort((a, b) => a.pitch - b.pitch || a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      if (a.pitch === b.pitch && b.start < a.start + a.dur && b.start !== a.start) {
        if (t.kind !== 'drums') err(w(b), `Pitch ${b.pitch} starts while the same pitch is still sounding`);
      }
    }
  }
  return out;
}

export function assertValid(song) {
  const errs = validateSong(song).filter((d) => d.level === 'error');
  if (errs.length) throw new Error('Song is invalid:\n' + errs.slice(0, 20).map((e) => `  ${e.where}: ${e.message}`).join('\n'));
  return song;
}

// ---- voices -----------------------------------------------------------------------

/**
 * Group a track's notes into beats (notes that start and end together) and pack beats into
 * non-overlapping voices for notation. Drum hits are treated as one voice with durations
 * trimmed to the next hit.
 */
export function toVoices(track, maxVoices = 4) {
  const groups = new Map();
  for (const n of track.notes) {
    const k = `${n.start}:${n.dur}`;
    if (!groups.has(k)) groups.set(k, { start: n.start, dur: n.dur, notes: [] });
    groups.get(k).notes.push(n);
  }
  const beats = [...groups.values()].sort((a, b) => a.start - b.start || b.dur - a.dur);
  for (const b of beats) b.notes.sort((x, y) => y.pitch - x.pitch);
  const voices = [];
  for (const b of beats) {
    let placed = false;
    for (const v of voices) {
      const last = v[v.length - 1];
      if (last.start + last.dur <= b.start) {
        v.push(b);
        placed = true;
        break;
      }
    }
    if (!placed) {
      if (voices.length >= maxVoices) {
        throw new Error(`Track "${track.name}": needs more than ${maxVoices} voices at tick ${b.start}. Simplify overlapping notes.`);
      }
      voices.push([b]);
    }
  }
  return voices;
}

/** drum tracks: merge hits at the same tick, each lasting until the next hit (max a quarter) */
export function drumBeats(track, song) {
  const at = new Map();
  for (const n of track.notes) {
    if (!at.has(n.start)) at.set(n.start, []);
    at.get(n.start).push(n);
  }
  const starts = [...at.keys()].sort((a, b) => a - b);
  const end = totalTicks(song);
  const grid = song.grid ?? DEFAULT_GRID;
  const regions = track.tuplets ?? [];
  return starts.map((s, i) => {
    // inside a tuplet region a drum hit lasts exactly one leaf
    const leaf = regions.find((r) => s >= r.start && s < r.start + r.dur)?.leaves.find((lf) => lf.start === s);
    if (leaf) return { start: s, dur: leaf.ticks, notes: at.get(s) };
    const next = i + 1 < starts.length ? starts[i + 1] : end;
    const barEnd = barStart(song, barAt(song, s) + 1);
    const regionStart = regions.find((r) => r.start > s)?.start ?? Infinity;
    let dur = Math.min(next, barEnd, regionStart) - s;
    dur = Math.min(dur, song.ppq);
    dur = Math.max(grid, Math.floor(dur / grid) * grid);
    return { start: s, dur, notes: at.get(s) };
  });
}

export function cloneSong(song) {
  return JSON.parse(JSON.stringify(song));
}

export function noteFromName(name) {
  return toMidi(parseNote(name));
}

/**
 * Snap every note to a grid (default 1/16 = 240 ticks), keep at least one grid step of length,
 * trim notes so the same pitch never overlaps itself, and drop exact duplicates.
 * Use after importing GP/MIDI with tuplets or human timing before exporting.
 * Notes inside written tuplet regions (track.tuplets) are left exactly as they are.
 */
export function quantize(song, grid = 240) {
  const end = totalTicks(song);
  for (const t of song.tracks) {
    const inRegion = (n) => (t.tuplets ?? []).some((r) => n.start >= r.start && n.start < r.start + r.dur);
    for (const n of t.notes) {
      if (inRegion(n)) continue; // written tuplets stay exact
      const s = Math.round(n.start / grid) * grid;
      let e = Math.round((n.start + n.dur) / grid) * grid;
      if (e <= s) e = s + grid;
      n.start = Math.min(s, end - grid);
      n.dur = Math.min(e, end) - n.start;
    }
    const seen = new Set();
    t.notes = t.notes.filter((n) => {
      const k = `${n.start}:${n.pitch}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (t.kind !== 'drums') {
      const byPitch = new Map();
      for (const n of t.notes.slice().sort((a, b) => a.start - b.start)) {
        const prev = byPitch.get(n.pitch);
        if (prev && prev.start + prev.dur > n.start) prev.dur = n.start - prev.start;
        byPitch.set(n.pitch, n);
      }
      t.notes = t.notes.filter((n) => n.dur > 0);
    }
  }
  song.grid = Math.min(song.grid ?? DEFAULT_GRID, grid);
  return song;
}
