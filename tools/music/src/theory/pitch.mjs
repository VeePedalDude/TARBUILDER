// Spelled pitches and intervals.
// A note is { letter: 0..6 (C D E F G A B), acc: int (-2..2 typical), oct: int|null }.
// Spelling is kept so B major gets A#, not Bb, and intervals keep their names (A4 vs d5).

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

const NOTE_RE = /^([A-Ga-g])(#{1,3}|x|b{1,3}|♯|♭|𝄪|𝄫)?(-?\d+)?$/;

export function parseNote(input) {
  if (typeof input === 'object' && input && 'letter' in input) return { ...input };
  if (typeof input === 'number') return fromMidi(input);
  const m = NOTE_RE.exec(String(input).trim());
  if (!m) throw new Error(`Not a note name: "${input}"`);
  const letter = LETTERS.indexOf(m[1].toUpperCase());
  const a = m[2] ?? '';
  const acc = a === 'x' || a === '𝄪' ? 2 : a === '𝄫' ? -2 : a === '♯' ? 1 : a === '♭' ? -1 : a.startsWith('#') ? a.length : -a.length;
  const oct = m[3] !== undefined ? parseInt(m[3], 10) : null;
  return { letter, acc, oct };
}

export function isNote(s) {
  return NOTE_RE.test(String(s).trim());
}

export function pc(note) {
  const n = parseNote(note);
  return mod(LETTER_PC[n.letter] + n.acc, 12);
}

export function midi(note) {
  if (typeof note === 'number') return note;
  const n = parseNote(note);
  if (n.oct === null) throw new Error(`midi(): note "${noteName(n)}" has no octave`);
  // octave belongs to the letter: B#3 = C4 (60), Cb4 = B3 (59)
  return 12 * (n.oct + 1) + LETTER_PC[n.letter] + n.acc;
}

export function noteName(note, { ascii = true } = {}) {
  const n = parseNote(note);
  const acc = n.acc > 0 ? '#'.repeat(n.acc) : 'b'.repeat(-n.acc);
  return LETTERS[n.letter] + (ascii ? acc : acc.replace(/#/g, '♯').replace(/b/g, '♭')) + (n.oct === null ? '' : n.oct);
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** midi number -> spelled note. preferFlats chooses Db over C# for black keys. */
export function fromMidi(m, { preferFlats = false } = {}) {
  if (!Number.isInteger(m)) throw new Error(`fromMidi: not an integer: ${m}`);
  const name = (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod(m, 12)];
  return parseNote(name + (Math.floor(m / 12) - 1));
}

export function midiToName(m, opts) {
  return noteName(fromMidi(m, opts));
}

export function mod(a, n) {
  return ((a % n) + n) % n;
}

// ---- intervals --------------------------------------------------------------
// An interval is { num: generic size (1 = unison, 3 = third, 9 = ninth), semis }.
const PERFECT = new Set([1, 4, 5]);
const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11]; // semis of the major/perfect form per simple generic size

const INTERVAL_RE = /^(P|M|m|A+|d+)(\d+)$/;

export function parseInterval(input) {
  if (typeof input === 'object' && input && 'num' in input) return { ...input };
  const m = INTERVAL_RE.exec(String(input).trim());
  if (!m) throw new Error(`Not an interval name: "${input}" (use P1 m2 M2 m3 M3 P4 A4 d5 P5 m6 M6 m7 M7 P8 M9 ...)`);
  const q = m[1];
  const num = parseInt(m[2], 10);
  if (num < 1) throw new Error(`Interval size must be >= 1: ${input}`);
  const simple = ((num - 1) % 7) + 1;
  const octaves = Math.floor((num - 1) / 7);
  const base = MAJOR_SEMIS[simple - 1] + 12 * octaves;
  let semis;
  if (PERFECT.has(simple)) {
    if (q === 'M' || q === 'm') throw new Error(`"${input}": ${simple}ths are perfect, not major/minor`);
    semis = q === 'P' ? base : q[0] === 'A' ? base + q.length : base - q.length;
  } else {
    if (q === 'P') throw new Error(`"${input}": ${simple}s are major/minor, not perfect`);
    semis = q === 'M' ? base : q === 'm' ? base - 1 : q[0] === 'A' ? base + q.length : base - 1 - q.length;
  }
  return { num, semis };
}

export function intervalName(iv) {
  const { num, semis } = parseInterval(iv);
  const simple = ((num - 1) % 7) + 1;
  const base = MAJOR_SEMIS[simple - 1] + 12 * Math.floor((num - 1) / 7);
  const d = semis - base;
  let q;
  if (PERFECT.has(simple)) q = d === 0 ? 'P' : d > 0 ? 'A'.repeat(d) : 'd'.repeat(-d);
  else q = d === 0 ? 'M' : d === -1 ? 'm' : d > 0 ? 'A'.repeat(d) : 'd'.repeat(-d - 1);
  return q + num;
}

/** spelled interval from a up to b (b must not be below a when octaves are given) */
export function interval(a, b) {
  const na = parseNote(a);
  const nb = parseNote(b);
  if (na.oct === null || nb.oct === null) {
    const steps = mod(nb.letter - na.letter, 7);
    const semis = mod(pc(nb) - pc(na), 12);
    // keep semis consistent with the generic size (e.g. B# above B is A1 = 1, Cb above B# ... )
    const base = MAJOR_SEMIS[steps];
    let s = semis;
    while (s - base > 6) s -= 12;
    while (base - s > 6) s += 12;
    return { num: steps + 1, semis: s };
  }
  const steps = nb.letter - na.letter + 7 * (nb.oct - na.oct);
  const semis = midi(nb) - midi(na);
  if (steps < 0) {
    const r = interval(nb, na);
    return { num: -r.num, semis: -r.semis };
  }
  return { num: steps + 1, semis };
}

/** transpose a spelled note by a spelled interval (use negative via down=true) */
export function transpose(note, iv, { down = false } = {}) {
  const n = parseNote(note);
  const { num, semis } = parseInterval(iv);
  const steps = (num - 1) * (down ? -1 : 1);
  const s = semis * (down ? -1 : 1);
  const rawLetter = n.letter + steps;
  const letter = mod(rawLetter, 7);
  const octShift = Math.floor(rawLetter / 7);
  const naturalSemis = LETTER_PC[letter] + 12 * octShift - LETTER_PC[n.letter];
  const acc = n.acc + s - naturalSemis;
  return { letter, acc, oct: n.oct === null ? null : n.oct + octShift };
}

/** simplify double accidentals / odd spellings: Fb -> E, B# -> C, Cx -> D */
export function simplify(note) {
  const n = parseNote(note);
  if (n.acc >= -1 && n.acc <= 1 && !(n.acc === 1 && (n.letter === 2 || n.letter === 6)) && !(n.acc === -1 && (n.letter === 0 || n.letter === 3))) return n;
  const m = n.oct === null ? pc(n) + 60 : midi(n);
  const out = fromMidi(m, { preferFlats: n.acc < 0 });
  if (n.oct === null) out.oct = null;
  return out;
}

/** Pick an octave for a pitch class/note so it lands nearest to a target midi value. */
export function nearest(note, targetMidi) {
  const n = parseNote(note);
  const p = pc(n);
  let best = null;
  for (let o = -1; o <= 9; o++) {
    const cand = { ...n, oct: o };
    const m = midi(cand);
    if (best === null || Math.abs(m - targetMidi) < Math.abs(best.m - targetMidi)) best = { m, cand };
  }
  void p;
  return best.cand;
}

export function freq(m, a4 = 440) {
  return a4 * Math.pow(2, (midi(m) - 69) / 12);
}
