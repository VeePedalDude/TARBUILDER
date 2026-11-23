// Scales and modes as spelled interval lists, so every degree has a proper letter name.
import { parseNote, transpose, noteName, pc, midi, parseInterval, mod } from './pitch.mjs';

// Add scales here. Intervals from the tonic, ascending, within one octave.
export const SCALES = {
  major: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'],
  minor: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'],
  'harmonic minor': ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'M7'],
  'melodic minor': ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'M7'],
  ionian: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'],
  dorian: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'm7'],
  phrygian: ['P1', 'm2', 'm3', 'P4', 'P5', 'm6', 'm7'],
  lydian: ['P1', 'M2', 'M3', 'A4', 'P5', 'M6', 'M7'],
  mixolydian: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7'],
  aeolian: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'],
  locrian: ['P1', 'm2', 'm3', 'P4', 'd5', 'm6', 'm7'],
  'harmonic major': ['P1', 'M2', 'M3', 'P4', 'P5', 'm6', 'M7'],
  'phrygian dominant': ['P1', 'm2', 'M3', 'P4', 'P5', 'm6', 'm7'],
  'lydian dominant': ['P1', 'M2', 'M3', 'A4', 'P5', 'M6', 'm7'],
  'dorian #4': ['P1', 'M2', 'm3', 'A4', 'P5', 'M6', 'm7'],
  altered: ['P1', 'm2', 'm3', 'd4', 'd5', 'm6', 'm7'],
  'locrian #2': ['P1', 'M2', 'm3', 'P4', 'd5', 'm6', 'm7'],
  'hungarian minor': ['P1', 'M2', 'm3', 'A4', 'P5', 'm6', 'M7'],
  'double harmonic': ['P1', 'm2', 'M3', 'P4', 'P5', 'm6', 'M7'],
  'neapolitan minor': ['P1', 'm2', 'm3', 'P4', 'P5', 'm6', 'M7'],
  'neapolitan major': ['P1', 'm2', 'm3', 'P4', 'P5', 'M6', 'M7'],
  'major pentatonic': ['P1', 'M2', 'M3', 'P5', 'M6'],
  'minor pentatonic': ['P1', 'm3', 'P4', 'P5', 'm7'],
  blues: ['P1', 'm3', 'P4', 'd5', 'P5', 'm7'],
  'major blues': ['P1', 'M2', 'm3', 'M3', 'P5', 'M6'],
  'whole tone': ['P1', 'M2', 'M3', 'A4', 'A5', 'A6'],
  'diminished hw': ['P1', 'm2', 'm3', 'M3', 'A4', 'P5', 'M6', 'm7'],
  'diminished wh': ['P1', 'M2', 'm3', 'P4', 'd5', 'm6', 'M6', 'M7'],
  'bebop dominant': ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7', 'M7'],
  'bebop major': ['P1', 'M2', 'M3', 'P4', 'P5', 'm6', 'M6', 'M7'],
  'bebop dorian': ['P1', 'M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'm7'],
  hirajoshi: ['P1', 'M2', 'm3', 'P5', 'm6'],
  'in sen': ['P1', 'm2', 'P4', 'P5', 'm7'],
  iwato: ['P1', 'm2', 'P4', 'd5', 'm7'],
  egyptian: ['P1', 'M2', 'P4', 'P5', 'm7'],
  prometheus: ['P1', 'M2', 'M3', 'A4', 'M6', 'm7'],
  augmented: ['P1', 'm3', 'M3', 'P5', 'A5', 'M7'],
  chromatic: ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7'],
};

const ALIASES = {
  'natural minor': 'minor', aeolian: 'aeolian', maj: 'major', min: 'minor', m: 'minor',
  pentatonic: 'major pentatonic', 'minor pent': 'minor pentatonic', 'major pent': 'major pentatonic',
  'super locrian': 'altered', 'jazz minor': 'melodic minor', 'spanish': 'phrygian dominant',
  'octatonic': 'diminished hw', 'half-whole': 'diminished hw', 'whole-half': 'diminished wh',
  'lydian b7': 'lydian dominant', 'mixolydian b6': null, 'gypsy': 'hungarian minor',
  'byzantine': 'double harmonic', 'arabic': 'double harmonic',
};

export function scaleIntervals(name) {
  const key = String(name).toLowerCase().trim();
  const resolved = SCALES[key] ? key : ALIASES[key];
  if (!resolved || !SCALES[resolved]) {
    throw new Error(`Unknown scale "${name}". Known: ${Object.keys(SCALES).join(', ')}`);
  }
  return SCALES[resolved].map(parseInterval);
}

/** spelled scale: scale('Eb', 'dorian') -> [Eb F Gb Ab Bb C Db] (no octave) */
export function scale(tonic, name = 'major') {
  const t = parseNote(tonic);
  return scaleIntervals(name).map((iv) => transpose(t, iv));
}

export function scaleNames(tonic, name = 'major') {
  return scale(tonic, name).map((n) => noteName(n));
}

export function scalePcs(tonic, name = 'major') {
  return scale(tonic, name).map(pc);
}

/**
 * A scale you can index by degree across octaves.
 * degree 0 = tonic in the given octave, 7 = tonic an octave up (for 7-note scales),
 * negative degrees go down.
 */
export function makeScale(tonic, name = 'major', octave = 4) {
  const t = { ...parseNote(tonic), oct: octave };
  const ivs = scaleIntervals(name);
  const n = ivs.length;
  const notes = ivs.map((iv) => transpose(t, iv));
  const pcs = notes.map(pc);
  return {
    tonic: noteName({ ...t, oct: null }),
    name,
    size: n,
    pcs,
    /** spelled note for a degree */
    note(deg) {
      const o = Math.floor(deg / n);
      const base = notes[mod(deg, n)];
      return { ...base, oct: base.oct + o };
    },
    midi(deg) {
      return midi(this.note(deg));
    },
    contains(m) {
      return pcs.includes(mod(typeof m === 'number' ? m : pc(m), 12));
    },
    /** nearest degree to a midi value (ties go down) */
    degreeOf(m) {
      let best = 0;
      let bestD = Infinity;
      const guess = Math.round(((m - midi(notes[0])) / 12) * n);
      for (let d = guess - n - 1; d <= guess + n + 1; d++) {
        const dist = Math.abs(this.midi(d) - m);
        if (dist < bestD || (dist === bestD && d < best)) {
          best = d;
          bestD = dist;
        }
      }
      return best;
    },
    /** snap midi into the scale (nearest scale tone) */
    snap(m) {
      return this.midi(this.degreeOf(m));
    },
  };
}

/** modes of a scale: rotate the step pattern */
export function modeOf(name, rotation) {
  const ivs = scaleIntervals(name);
  const semis = ivs.map((i) => i.semis);
  const n = semis.length;
  const r = mod(rotation, n);
  return semis.slice(r).concat(semis.slice(0, r).map((s) => s + 12)).map((s) => s - semis[r]);
}

/** Which named scales contain every pitch class given (for "what scale fits these notes") */
export function scalesContaining(pcsIn, { tonic } = {}) {
  const want = [...new Set(pcsIn.map((p) => mod(typeof p === 'number' ? p : pc(p), 12)))];
  const out = [];
  const tonics = tonic !== undefined ? [mod(typeof tonic === 'number' ? tonic : pc(tonic), 12)] : [...Array(12).keys()];
  for (const t of tonics) {
    for (const name of Object.keys(SCALES)) {
      if (name === 'chromatic' || name === 'ionian' || name === 'aeolian') continue;
      const set = SCALES[name].map((iv) => mod(t + parseInterval(iv).semis, 12));
      if (want.every((p) => set.includes(p))) out.push({ tonicPc: t, name, size: set.length });
    }
  }
  return out.sort((a, b) => a.size - b.size);
}
