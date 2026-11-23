// Chord progressions: a curated library plus a functional-harmony generator with cadences.
import { parseRoman } from '../theory/roman.mjs';
import { parseKey } from '../theory/key.mjs';
import { asRng } from '../rng.mjs';
import { barStart, barLength } from '../ir.mjs';

// Roman numerals are relative to the key. Minor-key entries assume a minor key.
export const PROGRESSIONS = {
  // pop / rock
  'axis': { mode: 'major', romans: ['I', 'V', 'vi', 'IV'], tags: ['pop', 'anthem'] },
  'sensitive female': { mode: 'major', romans: ['vi', 'IV', 'I', 'V'], tags: ['pop', 'emotional'] },
  'doo-wop': { mode: 'major', romans: ['I', 'vi', 'IV', 'V'], tags: ['50s', 'pop'] },
  'royal road': { mode: 'major', romans: ['IVmaj7', 'V7', 'iii7', 'vi'], tags: ['jpop', 'anime'] },
  'canon': { mode: 'major', romans: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], tags: ['classical', 'pop'] },
  'mixolydian rock': { mode: 'major', romans: ['I', 'bVII', 'IV', 'I'], tags: ['rock', 'classic rock'] },
  'three chord': { mode: 'major', romans: ['I', 'IV', 'V', 'I'], tags: ['punk', 'folk', 'country'] },
  'punk': { mode: 'major', romans: ['I', 'V', 'vi', 'IV'], tags: ['punk'] },
  'grunge': { mode: 'minor', romans: ['i', 'VI', 'III', 'VII'], tags: ['rock', 'grunge'] },
  'epic minor': { mode: 'minor', romans: ['i', 'VI', 'III', 'VII'], tags: ['epic', 'film'] },
  'andalusian': { mode: 'minor', romans: ['i', 'VII', 'VI', 'V'], tags: ['flamenco', 'surf', 'metal'] },
  'minor plagal': { mode: 'minor', romans: ['i', 'iv', 'i', 'V'], tags: ['minor', 'classical'] },
  'aeolian vamp': { mode: 'minor', romans: ['i', 'VII', 'VI', 'VII'], tags: ['rock', 'metal'] },
  'metal gallop': { mode: 'minor', romans: ['i', 'VI', 'VII', 'i'], tags: ['metal'] },
  'phrygian': { mode: 'minor', romans: ['i', 'bII', 'i', 'bII'], tags: ['metal', 'dark'] },
  'creep': { mode: 'major', romans: ['I', 'III', 'IV', 'iv'], tags: ['alt', 'chromatic'] },
  'lament': { mode: 'minor', romans: ['i', 'v', 'iv', 'V'], tags: ['minor'] },
  // blues / jazz
  '12-bar blues': { mode: 'major', romans: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], tags: ['blues'] },
  'quick-change blues': { mode: 'major', romans: ['I7', 'IV7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], tags: ['blues'] },
  'minor blues': { mode: 'minor', romans: ['i7', 'i7', 'i7', 'i7', 'iv7', 'iv7', 'i7', 'i7', 'VI7', 'V7', 'i7', 'V7'], tags: ['blues', 'jazz'] },
  'ii-V-I': { mode: 'major', romans: ['ii7', 'V7', 'Imaj7', 'Imaj7'], tags: ['jazz'] },
  'minor ii-V-i': { mode: 'minor', romans: ['iiø7', 'V7', 'i7', 'i7'], tags: ['jazz'] },
  'turnaround': { mode: 'major', romans: ['Imaj7', 'vi7', 'ii7', 'V7'], tags: ['jazz'] },
  'rhythm changes A': { mode: 'major', romans: ['Imaj7', 'vi7', 'ii7', 'V7', 'iii7', 'vi7', 'ii7', 'V7', 'I7', 'I7', 'IVmaj7', 'iv7', 'iii7', 'vi7', 'ii7', 'V7'], tags: ['jazz'], perBar: 2 },
  'autumn': { mode: 'minor', romans: ['iv7', 'VII7', 'IIImaj7', 'VImaj7', 'iiø7', 'V7', 'i7', 'i7'], tags: ['jazz'] },
  'backdoor': { mode: 'major', romans: ['Imaj7', 'iv7', 'bVII7', 'Imaj7'], tags: ['jazz', 'soul'] },
  // soul / gospel / lofi
  'neo soul': { mode: 'major', romans: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'], tags: ['neo-soul', 'lofi'] },
  'lofi': { mode: 'major', romans: ['ii9', 'V9', 'Imaj7', 'vi7'], tags: ['lofi', 'chill'] },
  'gospel': { mode: 'major', romans: ['I', 'iii7', 'IV', 'iv', 'I', 'vi7', 'ii7', 'V7'], tags: ['gospel'] },
  'dorian vamp': { mode: 'dorian', romans: ['i7', 'IV7', 'i7', 'IV7'], tags: ['funk', 'jazz', 'modal'] },
  'lydian float': { mode: 'lydian', romans: ['I', 'II', 'I', 'II'], tags: ['film', 'dreamy'] },
};

export function listProgressions(tag) {
  return Object.entries(PROGRESSIONS)
    .filter(([, p]) => !tag || p.tags.includes(tag))
    .map(([name, p]) => ({ name, ...p }));
}

/** realise a library progression or roman list in a key -> [{ roman, symbol }] */
export function realize(romansOrName, key) {
  const romans = Array.isArray(romansOrName) ? romansOrName : PROGRESSIONS[romansOrName]?.romans;
  if (!romans) throw new Error(`Unknown progression "${romansOrName}". Known: ${Object.keys(PROGRESSIONS).join(', ')}`);
  return romans.map((r) => ({ roman: r, symbol: parseRoman(r, key).symbol }));
}

// ---- functional generator ---------------------------------------------------------
// Each chord has a function: T (tonic), S (predominant), D (dominant).
const FUNCS = {
  major: {
    T: ['I', 'vi', 'iii'],
    S: ['IV', 'ii'],
    D: ['V', 'vii°'],
  },
  minor: {
    T: ['i', 'VI', 'III'],
    S: ['iv', 'ii°'],
    D: ['V', 'vii°', 'VII'],
  },
};

// transition weights between functions (phrase grammar: T -> S -> D -> T)
const FLOW = { T: { T: 2, S: 5, D: 3 }, S: { T: 1, S: 2, D: 6 }, D: { T: 8, S: 0.5, D: 1 } };

const SEVENTHS = {
  major: { I: 'Imaj7', ii: 'ii7', iii: 'iii7', IV: 'IVmaj7', V: 'V7', vi: 'vi7', 'vii°': 'viiø7' },
  minor: { i: 'i7', 'ii°': 'iiø7', III: 'IIImaj7', iv: 'iv7', V: 'V7', VI: 'VImaj7', VII: 'VII7', 'vii°': 'vii°7' },
};

const BORROWED_MAJOR = ['bVII', 'iv', 'bVI', 'bIII'];

/**
 * Generate a progression.
 * opts: { key, length (chords), complexity 0..3, cadence: 'authentic'|'half'|'plagal'|'deceptive'|'none',
 *         startTonic (true), seed | rng }
 *  complexity 0 = triads, 1 = some sevenths, 2 = sevenths + secondary dominants,
 *  3 = also borrowed chords and extensions.
 */
export function generateProgression(opts = {}) {
  const key = parseKey(opts.key ?? 'C major');
  const mode = key.mode === 'minor' ? 'minor' : 'major';
  const rng = asRng(opts.rng ?? opts.seed);
  const length = opts.length ?? 4;
  const complexity = opts.complexity ?? 0;
  const cadence = opts.cadence ?? 'authentic';
  if (length < 2) throw new Error('generateProgression: length must be >= 2');
  const F = FUNCS[mode];
  const tonic = F.T[0];
  const funcs = [];
  // plan the cadence at the end
  const tail = {
    authentic: ['D', 'T'], half: ['S', 'D'], plagal: ['S', 'T'], deceptive: ['D', 'T*'], none: [],
  }[cadence];
  if (!tail) throw new Error(`Unknown cadence "${cadence}"`);
  const free = length - tail.length;
  let prev = 'T';
  for (let i = 0; i < free; i++) {
    let f;
    if (i === 0 && opts.startTonic !== false) f = 'T';
    else f = rng.weighted(Object.entries(FLOW[prev]));
    funcs.push(f);
    prev = f;
  }
  funcs.push(...tail);
  const romans = [];
  funcs.forEach((f, i) => {
    let r;
    if (i === 0 && f === 'T' && opts.startTonic !== false) r = tonic;
    else if (f === 'T*') r = mode === 'major' ? 'vi' : 'VI';
    else if (f === 'T' && i === funcs.length - 1 && tail.length) r = tonic;
    else if (f === 'D' && ((i >= funcs.length - 2 && tail[0] === 'D') || (i === funcs.length - 1 && cadence === 'half'))) r = 'V';
    else {
      const opts2 = F[f].filter((x) => x !== romans[romans.length - 1]);
      r = rng.weighted(opts2.map((x, k) => [x, k === 0 ? 3 : 1.5]));
    }
    romans.push(r);
  });
  // never the same chord twice in a row (e.g. a random V right before the cadential V)
  for (let i = romans.length - 2; i >= 0; i--) {
    if (romans[i] === romans[i + 1]) romans[i] = rng.pick(F.S.filter((x) => x !== romans[i - 1]));
  }
  // colour by complexity
  const out = romans.map((r, i) => {
    let rr = r;
    if (complexity >= 1 && rng.chance(complexity >= 2 ? 0.7 : 0.35)) rr = SEVENTHS[mode][r] ?? r;
    if (complexity >= 1 && r === 'V' && i === romans.length - 2) rr = 'V7';
    return rr;
  });
  if (complexity >= 2) {
    // insert secondary dominants: replace a chord before a non-tonic diatonic target with V7/target
    for (let i = 1; i < out.length - 1; i++) {
      const target = romans[i + 1];
      const plain = target.replace(/[°ø+7]|maj7/g, '');
      if (plain === tonic || /°/.test(target) || plain === romans[i]) continue;
      if (rng.chance(0.25)) {
        out[i] = `V7/${plain}`;
        i++; // never chain two secondaries: the target must sound next
      }
    }
  }
  if (complexity >= 3 && mode === 'major') {
    for (let i = 1; i < out.length - 2; i++) if (romans[i] === 'IV' && rng.chance(0.4)) out[i] = rng.pick(['iv', 'bVII', 'bVI']);
    for (let i = 0; i < out.length; i++) if (out[i] === 'ii7' && rng.chance(0.5)) out[i] = 'ii9';
  }
  void BORROWED_MAJOR;
  return out.map((r) => ({ roman: r, symbol: parseRoman(r, key).symbol }));
}

/**
 * Lay chords onto a song timeline: chords spread over bars from `bar`, `perBar` chords per bar
 * (or `beats` per chord). Writes song.chords and returns the placed list.
 */
export function placeChords(song, prog, { bar = 0, perBar = 1, beats = null, repeat = 1 } = {}) {
  const placed = [];
  let b = bar;
  let t = barStart(song, bar);
  for (let r = 0; r < repeat; r++) {
    for (const c of prog) {
      const bl = barLength(song, b);
      const dur = beats ? (beats * song.ppq * 4) / song.meter.den : bl / perBar;
      placed.push({ start: t, dur, symbol: c.symbol, roman: c.roman });
      t += dur;
      while (t >= barStart(song, b + 1) && b < song.bars) b++;
    }
  }
  song.chords.push(...placed);
  song.chords.sort((a, b2) => a.start - b2.start);
  return placed;
}
