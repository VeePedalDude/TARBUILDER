// Keys: signatures, spelling midi notes in a key, and key detection.
import { parseNote, noteName, pc, mod, fromMidi, LETTERS } from './pitch.mjs';
import { scale } from './scale.mjs';

const LETTER_FIFTHS = [0, 2, 4, -1, 1, 3, 5]; // C D E F G A B on the circle of fifths

/** parseKey('F# minor' | 'Bbm' | 'C' | {tonic, mode}) -> { tonic, mode, fifths, name } */
export function parseKey(k) {
  if (k && typeof k === 'object' && 'tonic' in k) return makeKey(k.tonic, k.mode);
  const str = String(k ?? 'C major').trim();
  const m = /^([A-Ga-g](?:#|b)?)\s*(major|minor|maj|min|m|M|dorian|phrygian|lydian|mixolydian|aeolian|ionian|locrian)?$/.exec(str);
  if (!m) throw new Error(`Can't read key "${k}" (try "E minor", "Bb", "F#m")`);
  let mode = m[2] ?? 'major';
  if (mode === 'm' || mode === 'min') mode = 'minor';
  if (mode === 'M' || mode === 'maj') mode = 'major';
  return makeKey(m[1][0].toUpperCase() + m[1].slice(1), mode);
}

const MODE_OFFSET = { major: 0, ionian: 0, dorian: -2, phrygian: -4, lydian: 1, mixolydian: -1, minor: -3, aeolian: -3, locrian: -5 };

export function makeKey(tonic, mode = 'major') {
  const t = parseNote(tonic);
  const tonicFifths = LETTER_FIFTHS[t.letter] + 7 * t.acc;
  const fifths = tonicFifths + (MODE_OFFSET[mode] ?? 0);
  const scaleName = mode === 'major' ? 'major' : mode === 'minor' ? 'minor' : mode;
  const notes = scale(t, scaleName);
  return {
    tonic: noteName({ ...t, oct: null }),
    tonicPc: pc(t),
    mode,
    fifths, // + sharps, - flats
    name: `${noteName({ ...t, oct: null })} ${mode}`,
    scale: notes,
    pcs: notes.map(pc),
  };
}

/** accidentals in the key signature, e.g. ['F#','C#'] */
export function signature(key) {
  const k = parseKey(key);
  const sharps = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const flats = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  if (k.fifths >= 0) return sharps.slice(0, Math.min(k.fifths, 7)).map((l) => l + '#');
  return flats.slice(0, Math.min(-k.fifths, 7)).map((l) => l + 'b');
}

/**
 * Spell a midi note in a key: diatonic notes get the key's spelling; in minor the raised
 * 6th/7th are spelled as raised degrees; other chromatic notes follow the key's sharp/flat side.
 */
export function spellInKey(m, key) {
  const k = parseKey(key);
  const p = mod(m, 12);
  const oct = Math.floor(m / 12) - 1;
  const withOct = (n) => {
    // octave belongs to the letter: B#3 is midi 60
    const natural = [0, 2, 4, 5, 7, 9, 11][n.letter] + n.acc;
    return { letter: n.letter, acc: n.acc, oct: oct + Math.round((p - natural) / 12) };
  };
  const idx = k.pcs.indexOf(p);
  if (idx >= 0) return withOct(k.scale[idx]);
  if (k.mode === 'minor') {
    for (const deg of [5, 6]) {
      const n = k.scale[deg];
      if (mod(pc(n) + 1, 12) === p) return withOct({ ...n, acc: n.acc + 1 });
    }
  }
  // chromatic: alter a neighbouring diatonic note by one semitone; prefer the spelling with the
  // smallest accidental (C natural in E major, not B#); on a tie use the key's side
  // (flats in flat keys and C major, except the #4 which stays sharp).
  const preferFlat = k.fifths < 0 || (k.fifths === 0 && mod(p - k.tonicPc, 12) !== 6);
  const cands = [];
  for (const n of k.scale) {
    if (mod(pc(n) - 1, 12) === p) cands.push({ ...n, acc: n.acc - 1, flat: true });
    if (mod(pc(n) + 1, 12) === p) cands.push({ ...n, acc: n.acc + 1, flat: false });
  }
  cands.sort((a, b) => Math.abs(a.acc) - Math.abs(b.acc) || (a.flat === preferFlat ? -1 : 1) - (b.flat === preferFlat ? -1 : 1));
  if (cands.length) return withOct({ letter: cands[0].letter, acc: cands[0].acc });
  return fromMidi(m, { preferFlats: preferFlat });
}

export function spellNameInKey(m, key) {
  return noteName(spellInKey(m, key));
}

// Krumhansl-Kessler key profiles
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

/**
 * Detect key from notes: array of midi numbers or {pitch, dur}. Returns ranked list
 * [{ key: 'G major', score }] with Pearson correlation scores (-1..1).
 */
export function detectKey(notes) {
  const hist = new Array(12).fill(0);
  for (const n of notes) {
    const p = typeof n === 'number' ? n : n.pitch;
    const w = typeof n === 'number' ? 1 : n.dur ?? 1;
    hist[mod(p, 12)] += w;
  }
  const out = [];
  for (let t = 0; t < 12; t++) {
    out.push({ key: `${MAJOR_NAMES[t]} major`, score: corr(hist, rotate(KK_MAJOR, t)) });
    out.push({ key: `${MINOR_NAMES[t]} minor`, score: corr(hist, rotate(KK_MINOR, t)) });
  }
  return out.sort((a, b) => b.score - a.score);
}

function rotate(profile, t) {
  return profile.map((_, i) => profile[mod(i - t, 12)]);
}

function corr(a, b) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export function relativeKey(key) {
  const k = parseKey(key);
  if (k.mode === 'major') return makeKey(k.scale[5], 'minor');
  if (k.mode === 'minor') return makeKey(k.scale[2], 'major');
  throw new Error('relativeKey: only major/minor');
}

export function parallelKey(key) {
  const k = parseKey(key);
  return makeKey(k.tonic, k.mode === 'major' ? 'minor' : 'major');
}

/** keys one step around the circle of fifths: dominant, subdominant, relative */
export function closelyRelated(key) {
  const k = parseKey(key);
  const out = [];
  for (const deg of k.mode === 'major' ? [1, 2, 3, 4, 5] : [2, 3, 4, 5, 6]) {
    const n = k.scale[deg];
    const triadMinor = mod(pc(k.scale[(deg + 2) % 7]) - pc(n), 12) === 3;
    out.push(makeKey(n, triadMinor ? 'minor' : 'major').name);
  }
  return out;
}

export { LETTERS };
