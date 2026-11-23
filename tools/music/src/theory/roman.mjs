// Roman numerals: "V7/ii" in a key -> chord, and chord -> roman numeral analysis.
import { parseNote, transpose, noteName, pc, mod, parseInterval, intervalName, interval } from './pitch.mjs';
import { parseChord } from './chord.mjs';
import { parseKey, makeKey } from './key.mjs';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const RN_RE = /^(bb|b|##|#|♭|♯)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|o|ø|\+)?(maj7|M7|add9|sus4|sus2|7|9|11|13|65|64|63|43|42|6|2)?(?:\/(.+))?$/;

/**
 * Parse a roman numeral in a key.
 * Rules: case gives triad quality (upper major, lower minor); ° dim, ø half-dim 7th, + aug.
 * Figures: 7 9 11 13 add9 sus4 sus2 maj7; inversions 6 / 64 (triads) and 65 / 43 / 42 (sevenths).
 * In minor keys, lowercase vii and uppercase V/V7 use the raised leading tone automatically
 * (vii° in A minor = G#°), while VII is the natural 7th (G).
 * Secondary chords: "V7/ii", "vii°7/V".
 * Returns { roman, symbol, chord, inversion, bass }
 */
export function parseRoman(rn, keyIn = 'C major') {
  const key = parseKey(keyIn);
  const special = specialChord(String(rn).trim(), key);
  if (special) return special;
  const m = RN_RE.exec(String(rn).trim());
  if (!m) throw new Error(`Can't read roman numeral "${rn}"`);
  const [, accRaw, numeral, qual, fig, secondary] = m;

  if (secondary) {
    const target = parseRoman(secondary, key);
    const isMinor = target.chord.quality.startsWith('m') && !target.chord.quality.startsWith('maj');
    const tonicKey = makeKey(target.chord.root, isMinor || target.chord.quality.startsWith('dim') ? 'minor' : 'major');
    const inner = parseRoman(accRaw ? accRaw + numeral + (qual ?? '') + (fig ?? '') : numeral + (qual ?? '') + (fig ?? ''), tonicKey);
    return { ...inner, roman: String(rn).trim() };
  }

  const degree = NUMERALS.indexOf(numeral.toUpperCase());
  const upper = numeral === numeral.toUpperCase();
  let root = key.scale[degree];
  const minorKey = key.mode === 'minor' || key.mode === 'aeolian';
  // raised leading tone for vii and V in minor
  if (minorKey && degree === 6 && !upper && !accRaw) root = { ...root, acc: root.acc + 1 };
  const acc = accRaw ? (accRaw.replace('♭', 'b').replace('♯', '#').startsWith('b') ? -accRaw.length : accRaw.length) : 0;
  root = { ...root, acc: root.acc + acc, oct: null };
  const rootName = noteName(root);

  let suffix;
  const figure = fig ?? '';
  const seventhFig = ['7', '65', '43', '42', '2'].includes(figure);
  if (qual === 'ø') suffix = 'm7b5';
  else if (qual === '°' || qual === 'o') suffix = seventhFig ? 'dim7' : 'dim';
  else if (qual === '+') suffix = seventhFig ? 'aug7' : 'aug';
  else if (upper) {
    if (figure === 'maj7' || figure === 'M7') suffix = 'maj7';
    else if (seventhFig) suffix = '7';
    else if (['9', '11', '13'].includes(figure)) suffix = figure;
    else suffix = '';
  } else {
    if (figure === 'maj7' || figure === 'M7') suffix = 'mMaj7';
    else if (seventhFig) suffix = 'm7';
    else if (['9', '11', '13'].includes(figure)) suffix = 'm' + figure;
    else suffix = 'm';
  }
  if (figure === 'add9' || figure === 'sus4' || figure === 'sus2') suffix += figure;
  if (qual === 'ø' && !seventhFig && figure) suffix = 'm7b5';

  const inversion = { '6': 1, '63': 1, '64': 2, '65': 1, '43': 2, '42': 3, '2': 3 }[figure] ?? 0;
  const chord = parseChord(rootName + suffix);
  const bassNote = chord.notes[Math.min(inversion, chord.notes.length - 1)];
  const sortedThirds = stackThirds(chord);
  const bass = inversion ? sortedThirds[inversion] : null;
  const symbol = rootName + suffix + (bass ? '/' + noteName(bass) : '');
  void bassNote;
  return { roman: String(rn).trim(), symbol, chord: parseChord(symbol), inversion, bass: bass ? noteName(bass) : null };
}

// Neapolitan (N, N6) and augmented sixths (It6, Fr6, Ger6). Built on the key's tonic:
// N = major triad on b2. Aug 6ths share b6 (bass) + tonic + #4; Fr adds 2, Ger adds b3.
function specialChord(rn, key) {
  const t = { ...parseNote(key.tonic), oct: 4 };
  const at = (iv) => ({ ...transpose(t, iv), oct: null });
  if (rn === 'N' || rn === 'N6') {
    const root = at('m2');
    const sym = noteName(root) + (rn === 'N6' ? '/' + noteName(at('P4')) : '');
    return { roman: rn, symbol: sym, chord: parseChord(sym), inversion: rn === 'N6' ? 1 : 0, bass: rn === 'N6' ? noteName(at('P4')) : null };
  }
  const aug = { It6: ['m6', 'P1', 'A4'], Fr6: ['m6', 'P1', 'M2', 'A4'], Ger6: ['m6', 'P1', 'm3', 'A4'] }[rn];
  if (!aug) return null;
  const notes = aug.map(at);
  const bass = notes[0];
  const intervals = notes.map((n) => {
    const iv = interval({ ...bass, oct: 4 }, { ...n, oct: n.letter < bass.letter || (n.letter === bass.letter && n.acc < bass.acc) ? 5 : 4 });
    return iv;
  });
  const chord = {
    symbol: rn,
    root: bass,
    bass: null,
    intervals,
    names: intervals.map(intervalName),
    notes,
    pcs: notes.map(pc),
    quality: rn,
    hasSeventh: false,
  };
  return { roman: rn, symbol: rn, chord, inversion: 0, bass: noteName(bass) };
}

// chord tones in stacked-thirds order: root, 3rd, 5th, 7th (for inversions)
function stackThirds(chord) {
  const order = [1, 3, 5, 7, 9, 11, 13, 2, 4, 6];
  const withNum = chord.intervals.map((iv, i) => ({ n: ((iv.num - 1) % 7) + 1, note: chord.notes[i], num: iv.num }));
  return order.flatMap((o) => withNum.filter((w) => w.num === o || (o > 7 && w.num === o)).map((w) => w.note));
}

export function romanToSymbols(romans, key) {
  return romans.map((r) => parseRoman(r, key).symbol);
}

/**
 * Analyse a chord symbol in a key -> roman numeral string (best effort).
 * Handles diatonic chords, borrowed chords (bVII, iv in major), and secondary dominants (V7/V).
 */
export function analyzeRoman(symbol, keyIn = 'C major') {
  const key = parseKey(keyIn);
  const c = parseChord(symbol);
  const rn = numeralFor(c, key);
  // secondary dominant: major/dom7 chord whose root is a 5th above a diatonic non-tonic degree,
  // and that isn't itself diatonic
  const diatonic = c.pcs.every((p) => key.pcs.includes(p));
  if (!diatonic && (c.quality === 'maj' || c.quality === 'majm7')) {
    const targetPc = mod(pc(c.root) - 7, 12);
    const deg = key.pcs.indexOf(targetPc);
    if (deg > 0) {
      const targetTriad = triadOnDegree(key, deg);
      if (targetTriad && !targetTriad.endsWith('°')) return `V${c.hasSeventh ? '7' : ''}/${targetTriad}`;
    }
  }
  return rn;
}

function triadOnDegree(key, deg) {
  const r = key.scale[deg];
  const t = key.scale[(deg + 2) % 7];
  const f = key.scale[(deg + 4) % 7];
  const third = mod(pc(t) - pc(r), 12);
  const fifth = mod(pc(f) - pc(r), 12);
  const num = NUMERALS[deg];
  if (third === 4 && fifth === 7) return num;
  if (third === 3 && fifth === 7) return num.toLowerCase();
  if (third === 3 && fifth === 6) return num.toLowerCase() + '°';
  if (third === 4 && fifth === 8) return num + '+';
  return null;
}

function numeralFor(c, key) {
  // degree by letter, accidental relative to the key's scale degree
  const tonic = parseNote(key.tonic);
  const deg = mod(c.root.letter - tonic.letter, 7);
  const diatonic = key.scale[deg];
  let acc = c.root.acc - diatonic.acc;
  // in minor, a raised 7th root is the normal leading tone, not "#vii"
  const minorKey = key.mode === 'minor';
  if (minorKey && deg === 6 && acc === 1) acc = 0;
  const prefix = acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc);
  const q = c.quality;
  let num = NUMERALS[deg];
  let tail = '';
  if (q.startsWith('mMaj')) { num = num.toLowerCase(); tail = 'maj7'; }
  else if (q === 'm' ) num = num.toLowerCase();
  else if (q === 'mm7') { num = num.toLowerCase(); tail = '7'; }
  else if (q === 'dim') { num = num.toLowerCase(); tail = '°'; }
  else if (q === 'dimd7') { num = num.toLowerCase(); tail = '°7'; }
  else if (q === 'dimm7') { num = num.toLowerCase(); tail = 'ø7'; }
  else if (q === 'mm7' ) { num = num.toLowerCase(); tail = '7'; }
  else if (q === 'aug') tail = '+';
  else if (q === 'augm7') tail = '+7';
  else if (q === 'majM7') tail = 'maj7';
  else if (q === 'majm7') tail = '7';
  else if (q === '5') tail = '5';
  // half-diminished parsed from "m7b5" arrives as quality 'mm7' with a d5
  if (c.names.includes('d5') && c.names.includes('m3') && c.names.includes('m7')) { num = NUMERALS[deg].toLowerCase(); tail = 'ø7'; }
  if (c.names.includes('d5') && c.names.includes('m3') && c.names.includes('d7')) { num = NUMERALS[deg].toLowerCase(); tail = '°7'; }
  return prefix + num + tail;
}

export { parseInterval, intervalName, interval, transpose };
