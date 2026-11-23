// Chord symbols: parse "F#m7b5/C", spell them, name a set of notes, and build voicings.
import { parseNote, transpose, noteName, pc, midi, parseInterval, intervalName, mod, nearest, isNote } from './pitch.mjs';

const ROOT_RE = /^([A-G](?:##|#|bb|b|♯|♭)?)/;

/**
 * Parse a chord symbol. Returns
 * { symbol, root, bass, intervals: [{num, semis}], names: ['P1','M3',...], notes: [spelled], quality }
 * Throws with a clear message on anything it doesn't understand.
 */
export function parseChord(symbol) {
  const raw = String(symbol).trim();
  if (!raw) throw new Error('Empty chord symbol');
  const rm = ROOT_RE.exec(raw);
  if (!rm) throw new Error(`Chord "${raw}" must start with a root note A-G`);
  const root = parseNote(rm[1].replace('♯', '#').replace('♭', 'b'));
  let body = raw.slice(rm[1].length);

  // slash bass (but not 6/9)
  let bass = null;
  body = body.replace(/6\/9/g, '69');
  const slash = /\/([A-G](?:##|#|bb|b)?)$/.exec(body);
  if (slash) {
    bass = parseNote(slash[1]);
    body = body.slice(0, slash.index);
  }

  // normalise spellings
  body = body
    .replace(/[\s,()]/g, '')
    .replace(/Δ/g, 'maj')
    .replace(/ø/g, 'm7b5')
    .replace(/°/g, 'dim')
    .replace(/^M(?=\d|$|add|sus|b|#)/, 'maj')
    .replace(/^ma(?=\d)/, 'maj')
    .replace(/^-/, 'm')
    .replace(/^\+/, 'aug');
  let s = body.toLowerCase().replace(/^min/, 'm').replace(/^mi(?!n)/, 'm').replace(/^o(?=7|$)/, 'dim');

  let third = 'M3';
  let fifth = 'P5';
  let seventhKind = 'dom'; // what a "7" means: dom (m7) | maj (M7) | dim (d7)
  let seventh = null;
  const ext = new Map(); // generic number -> interval name
  let quality = 'maj';
  let power = false;

  const take = (re) => {
    const m = re.exec(s);
    if (!m) return null;
    s = s.slice(m[0].length);
    return m;
  };

  if (take(/^(mmaj|mm(?=7|9|11|13)|m\+?maj|minmaj)/)) {
    third = 'm3';
    seventhKind = 'maj';
    quality = 'mMaj';
  } else if (take(/^maj/)) {
    seventhKind = 'maj';
    quality = 'maj';
  } else if (take(/^m(?!aj)/)) {
    third = 'm3';
    quality = 'm';
  } else if (take(/^dim/)) {
    third = 'm3';
    fifth = 'd5';
    seventhKind = 'dim';
    quality = 'dim';
  } else if (take(/^aug/)) {
    fifth = 'A5';
    quality = 'aug';
  }

  if (quality === 'maj' && s === '5') {
    power = true;
    s = '';
  }

  const num = take(/^(13|11|9|7|69|6)/);
  if (num) {
    const n = num[1];
    const sev = seventhKind === 'maj' ? 'M7' : seventhKind === 'dim' && n === '7' ? 'd7' : 'm7';
    if (n === '6') ext.set(6, 'M6');
    else if (n === '69') {
      ext.set(6, 'M6');
      ext.set(9, 'M9');
    } else {
      seventh = sev;
      if (n === '9' || n === '11' || n === '13') ext.set(9, 'M9');
      if (n === '11') ext.set(11, 'P11');
      if (n === '13') ext.set(13, 'M13');
    }
  } else if (seventhKind === 'maj' && quality === 'mMaj') {
    seventh = 'M7'; // "CmMaj" with no number still means the 7th
  }

  const omit = new Set();
  // modifiers, any order
  for (let guard = 0; s.length && guard < 20; guard++) {
    let m;
    if ((m = take(/^sus(2|4)?/))) {
      third = null;
      if (m[1] === '2') ext.set(2, 'M2');
      else ext.set(4, 'P4');
      continue;
    }
    if ((m = take(/^add(b|#)?(2|4|6|9|11|13)/))) {
      const n = parseInt(m[2], 10);
      ext.set(n, alter(n, m[1]));
      continue;
    }
    if ((m = take(/^(b|#)(5|4|6|9|11|13)/))) {
      const n = parseInt(m[2], 10);
      if (n === 5) fifth = m[1] === 'b' ? 'd5' : 'A5';
      else {
        if (n === 9 || n === 11 || n === 13) seventh = seventh ?? (seventhKind === 'maj' ? 'M7' : 'm7');
        ext.set(n === 4 ? 11 : n === 6 ? 13 : n, alter(n === 4 ? 11 : n === 6 ? 13 : n, m[1]));
      }
      continue;
    }
    if (take(/^alt/)) {
      seventh = 'm7';
      fifth = null;
      ext.set(9, 'm9');
      ext.set(10, 'A9');
      ext.set(11, 'A11');
      ext.set(13, 'm13');
      continue;
    }
    if (take(/^maj7/)) {
      seventh = 'M7';
      continue;
    }
    if ((m = take(/^(no|omit)(3|5)/))) {
      omit.add(m[2]);
      continue;
    }
    if (take(/^7/) && seventh === null) {
      // e.g. "Cdim7" handled above; this catches "C7sus4" style leftovers
      seventh = seventhKind === 'maj' ? 'M7' : 'm7';
      continue;
    }
    break;
  }
  if (s.length) throw new Error(`Can't read chord "${raw}" (stuck at "${s}")`);

  const names = ['P1'];
  if (!power && third && !omit.has('3')) names.push(third);
  if (fifth && !omit.has('5')) names.push(fifth);
  if (seventh) names.push(seventh);
  for (const v of ext.values()) names.push(v);
  // de-dup by semis, order by semis
  const seen = new Set();
  const intervals = names
    .map(parseInterval)
    .filter((iv) => (seen.has(iv.semis) ? false : (seen.add(iv.semis), true)))
    .sort((a, b) => a.semis - b.semis);

  const notes = intervals.map((iv) => {
    const n = transpose({ ...root, oct: 4 }, iv);
    return { ...n, oct: null };
  });
  return {
    symbol: raw,
    root: { ...root, oct: null },
    bass: bass ? { ...bass, oct: null } : null,
    intervals,
    names: intervals.map(intervalName),
    notes,
    pcs: notes.map(pc),
    quality: power ? '5' : seventh ? `${quality}${seventh === 'M7' ? 'M7' : seventh === 'd7' ? 'd7' : 'm7'}` : quality,
    hasSeventh: !!seventh,
  };
}

function alter(n, acc) {
  const base = { 2: 'M2', 4: 'P4', 6: 'M6', 9: 'M9', 11: 'P11', 13: 'M13' }[n];
  if (!acc) return base;
  const iv = parseInterval(base);
  return intervalName({ num: iv.num, semis: iv.semis + (acc === '#' ? 1 : -1) });
}

export function isChordSymbol(s) {
  try {
    parseChord(s);
    return true;
  } catch {
    return false;
  }
}

// ---- naming a set of pitches ------------------------------------------------
// Ordered by preference: simpler names win when several fit.
const TEMPLATES = [
  ['', [0, 4, 7]], ['m', [0, 3, 7]], ['5', [0, 7]], ['dim', [0, 3, 6]], ['aug', [0, 4, 8]],
  ['sus4', [0, 5, 7]], ['sus2', [0, 2, 7]],
  ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]], ['m7b5', [0, 3, 6, 10]],
  ['dim7', [0, 3, 6, 9]], ['mMaj7', [0, 3, 7, 11]], ['6', [0, 4, 7, 9]], ['m6', [0, 3, 7, 9]],
  ['7sus4', [0, 5, 7, 10]], ['add9', [0, 2, 4, 7]], ['madd9', [0, 2, 3, 7]], ['aug7', [0, 4, 8, 10]],
  ['7b5', [0, 4, 6, 10]], ['maj7#5', [0, 4, 8, 11]],
  ['9', [0, 2, 4, 7, 10]], ['maj9', [0, 2, 4, 7, 11]], ['m9', [0, 2, 3, 7, 10]], ['69', [0, 2, 4, 7, 9]],
  ['7b9', [0, 1, 4, 7, 10]], ['7#9', [0, 3, 4, 7, 10]], ['7#11', [0, 4, 6, 7, 10]], ['m11', [0, 2, 3, 5, 7, 10]],
  ['11', [0, 2, 4, 5, 7, 10]], ['13', [0, 2, 4, 7, 9, 10]], ['maj13', [0, 2, 4, 7, 9, 11]],
  // shells (no fifth), common in jazz voicings
  ['7', [0, 4, 10]], ['maj7', [0, 4, 11]], ['m7', [0, 3, 10]],
];

const SHARP = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Name a chord from notes (names or midi). Returns best symbol or null, plus alternatives.
 * The lowest note (if midi given) is used as bass for inversions/slash chords.
 */
export function nameChord(notes, { spell } = {}) {
  const ms = notes.map((n) => (typeof n === 'number' ? n : isNote(n) && /\d/.test(String(n)) ? midi(n) : pc(n)));
  const pcs = [...new Set(ms.map((m) => mod(m, 12)))];
  const bassPc = mod(Math.min(...ms), 12);
  const name = spell ?? ((p) => SHARP[p]);
  const found = [];
  TEMPLATES.forEach(([suffix, tpl], rank) => {
    for (const r of pcs) {
      const set = tpl.map((x) => mod(r + x, 12));
      if (set.length === pcs.length && set.every((p) => pcs.includes(p))) {
        const slash = r !== bassPc ? `/${name(bassPc)}` : '';
        found.push({ symbol: name(r) + suffix + slash, rootPc: r, rank: rank + (slash ? 0.5 : 0) });
      }
    }
  });
  found.sort((a, b) => a.rank - b.rank);
  return { symbol: found[0]?.symbol ?? null, alternatives: found.slice(1).map((f) => f.symbol) };
}

// ---- voicings -----------------------------------------------------------------

/** Close-position voicing: root at/above `low` (midi), stacked upward. inversion 0..n-1. */
export function closeVoicing(chordOrSymbol, { low = 48, inversion = 0 } = {}) {
  const c = typeof chordOrSymbol === 'string' ? parseChord(chordOrSymbol) : chordOrSymbol;
  const rootM = midi(nearestAbove(c.root, low));
  let ms = c.intervals.map((iv) => rootM + iv.semis);
  // fold extensions above an octave down into close position
  ms = ms.map((m) => (m - rootM >= 12 ? m - 12 : m));
  ms = [...new Set(ms)].sort((a, b) => a - b);
  for (let i = 0; i < mod(inversion, ms.length); i++) ms.push(ms.shift() + 12);
  if (c.bass) {
    const b = midi(nearestBelow(c.bass, ms[0]));
    ms = [b, ...ms.filter((m) => mod(m, 12) !== mod(b, 12) || m - b > 12)];
  }
  return ms;
}

export function nearestAbove(note, m) {
  const n = parseNote(note);
  let cand = nearest({ ...n, oct: null }, m);
  while (midi(cand) < m) cand = { ...cand, oct: cand.oct + 1 };
  return cand;
}

export function nearestBelow(note, m) {
  const n = parseNote(note);
  let cand = nearest({ ...n, oct: null }, m);
  while (midi(cand) >= m) cand = { ...cand, oct: cand.oct - 1 };
  return cand;
}

/**
 * Voice-led voicing: pick the inversion/octave of `chord` closest to the previous voicing,
 * keeping `voices` notes within [low, high]. Good for pads, comping, string parts.
 */
export function voiceLead(prev, chordOrSymbol, { voices = 4, low = 48, high = 79 } = {}) {
  const c = typeof chordOrSymbol === 'string' ? parseChord(chordOrSymbol) : chordOrSymbol;
  const pcsAll = c.pcs;
  // choose which pcs to use when there are more pcs than voices: drop 5th first, then extensions above 9
  let pcsUse = pcsAll.slice();
  const fifthPc = mod(pc(c.root) + 7, 12);
  while (pcsUse.length > voices) {
    const idx = pcsUse.indexOf(fifthPc) > 0 ? pcsUse.indexOf(fifthPc) : pcsUse.length - 1;
    pcsUse.splice(idx, 1);
  }
  // double root if fewer pcs than voices
  const multiset = pcsUse.slice();
  let k = 0;
  while (multiset.length < voices) multiset.push(pcsUse[k++ % pcsUse.length]);

  const candidates = [];
  const options = multiset.map((p) => {
    const list = [];
    for (let m = low; m <= high; m++) if (mod(m, 12) === p) list.push(m);
    return list;
  });
  // brute force over small option lists
  const rec = (i, acc) => {
    if (i === options.length) {
      const sorted = acc.slice().sort((a, b) => a - b);
      if (new Set(sorted).size !== sorted.length) return;
      if (sorted[sorted.length - 1] - sorted[0] > 24) return;
      candidates.push(sorted);
      return;
    }
    for (const m of options[i]) rec(i + 1, [...acc, m]);
  };
  rec(0, []);
  if (!candidates.length) return closeVoicing(c, { low });
  const cost = (v) => {
    if (!prev || prev.length !== v.length) return Math.abs(v[0] - (low + 7)) + (mod(v[0], 12) === pc(c.root) ? 0 : 3);
    let s = 0;
    for (let i = 0; i < v.length; i++) s += Math.abs(v[i] - prev[i]);
    return s;
  };
  candidates.sort((a, b) => cost(a) - cost(b));
  return candidates[0];
}

export function chordNames(c) {
  return (typeof c === 'string' ? parseChord(c) : c).notes.map((n) => noteName(n));
}
