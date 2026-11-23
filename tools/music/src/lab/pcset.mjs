// Pitch-class set theory and twelve-tone tools.
// Prime forms use Rahn's algorithm (as most current software does); a handful of sets
// (5-20, 6-Z29, 6-31, 7-20, 8-26 and complements) differ from Forte's original book.
import { mod, pc as pcOf } from '../theory/pitch.mjs';
import { asRng } from '../rng.mjs';

const norm = (set) => [...new Set(set.map((x) => mod(typeof x === 'number' ? x : pcOf(x), 12)))].sort((a, b) => a - b);

export const transposeSet = (set, n) => norm(set.map((x) => x + n));
export const invertSet = (set, n = 0) => norm(set.map((x) => n - x));
export const complementSet = (set) => {
  const s = new Set(norm(set));
  return [...Array(12).keys()].filter((x) => !s.has(x));
};

/** normal form (Rahn): most compact rotation, ties broken by packing to the left from the end */
export function normalForm(setIn) {
  const s = norm(setIn);
  const n = s.length;
  if (n <= 1) return s;
  const rots = [];
  for (let i = 0; i < n; i++) rots.push([...s.slice(i), ...s.slice(0, i).map((x) => x + 12)]);
  rots.sort((a, b) => {
    // Rahn: compare spans first-to-last, then first-to-second-last, ... (right to left)
    for (let k = n - 1; k >= 1; k--) {
      const d = a[k] - a[0] - (b[k] - b[0]);
      if (d) return d;
    }
    return a[0] - b[0];
  });
  return rots[0].map((x) => mod(x, 12));
}

/** prime form: the more compact of the normal forms of the set and its inversion, transposed to 0 */
export function primeForm(setIn) {
  const s = norm(setIn);
  if (!s.length) return [];
  const zero = (nf) => nf.map((x) => mod(x - nf[0], 12));
  const a = zero(normalForm(s));
  const b = zero(normalForm(invertSet(s)));
  for (let k = a.length - 1; k >= 1; k--) {
    if (a[k] !== b[k]) return a[k] < b[k] ? a : b;
  }
  return a;
}

/** interval-class vector [ic1..ic6] */
export function intervalVector(setIn) {
  const s = norm(setIn);
  const v = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    const d = mod(s[j] - s[i], 12);
    v[Math.min(d, 12 - d) - 1]++;
  }
  return v;
}

/** Tn / TnI relations from a to b: [{ op: 'T3' | 'T5I', n }] */
export function relations(a, b) {
  const A = norm(a);
  const B = norm(b).join();
  const out = [];
  for (let n = 0; n < 12; n++) {
    if (transposeSet(A, n).join() === B) out.push(`T${n}`);
    if (invertSet(A, n).join() === B) out.push(`T${n}I`);
  }
  return out;
}

/** every set class (prime forms) of a cardinality, sorted */
export function setClasses(cardinality) {
  const seen = new Set();
  const out = [];
  for (let mask = 0; mask < 4096; mask++) {
    let bits = 0;
    for (let k = mask; k; k &= k - 1) bits++;
    if (bits !== cardinality) continue;
    const set = [...Array(12).keys()].filter((i) => mask & (1 << i));
    const p = primeForm(set).join(',');
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p.split(',').filter((x) => x !== '').map(Number));
    }
  }
  return out.sort((a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  });
}

/** Z-related: same interval vector, different set class */
export function zRelated(a, b) {
  return intervalVector(a).join() === intervalVector(b).join() && primeForm(a).join() !== primeForm(b).join();
}

export function describeSet(set) {
  const p = primeForm(set);
  return { pcs: norm(set), normal: normalForm(set), prime: p, primeString: '[' + p.map((x) => (x === 10 ? 'T' : x === 11 ? 'E' : x)).join('') + ']', vector: intervalVector(set), cardinality: p.length, complementPrime: primeForm(complementSet(set)) };
}

// ---- twelve-tone ----------------------------------------------------------------

export function isRow(row) {
  const r = row.map((x) => mod(typeof x === 'number' ? x : pcOf(x), 12));
  return r.length === 12 && new Set(r).size === 12;
}

function asRow(row) {
  const r = row.map((x) => mod(typeof x === 'number' ? x : pcOf(x), 12));
  if (!isRow(r)) throw new Error('A twelve-tone row needs all 12 pitch classes exactly once');
  return r;
}

/**
 * Row forms with the usual labels. P0 = the row transposed to start on pc 0 (C) by default
 * (set `labelFromFirst: true` to call the given row P0 whatever its first note).
 */
export function rowForms(rowIn, { labelFromFirst = false } = {}) {
  const row = asRow(rowIn);
  const base = labelFromFirst ? row[0] : 0;
  const P0 = row.map((x) => mod(x - row[0] + base, 12));
  const I0 = P0.map((x) => mod(2 * P0[0] - x, 12));
  const forms = {};
  for (let n = 0; n < 12; n++) {
    const p = P0.map((x) => mod(x + n - base, 12));
    const i = I0.map((x) => mod(x + n - base, 12));
    forms[`P${n}`] = p;
    forms[`I${n}`] = i;
    forms[`R${n}`] = p.slice().reverse();
    forms[`RI${n}`] = i.slice().reverse();
  }
  return forms;
}

/** 12x12 matrix: rows are P forms read left to right, columns are I forms read down */
export function rowMatrix(rowIn) {
  const row = asRow(rowIn);
  const inv = row.map((x) => mod(2 * row[0] - x, 12));
  return inv.map((start) => row.map((x) => mod(x - row[0] + start, 12)));
}

/** all-interval row: the 11 successive intervals are all different */
export function isAllInterval(rowIn) {
  const r = asRow(rowIn);
  const ivs = r.slice(1).map((x, i) => mod(x - r[i], 12));
  return new Set(ivs).size === 11;
}

/** hexachordal combinatoriality: which transforms map the first hexachord onto the complement */
export function combinatoriality(rowIn) {
  const r = asRow(rowIn);
  const h1 = norm(r.slice(0, 6));
  const comp = complementSet(h1).join();
  const out = [];
  for (let n = 0; n < 12; n++) {
    if (transposeSet(h1, n).join() === comp) out.push(`P${n}`);
    if (invertSet(h1, n).join() === comp) out.push(`I${n}`);
  }
  // R-combinatoriality is trivial (every row); RI-combinatorial = I-combinatorial with retrograde
  return { P: out.filter((x) => x.startsWith('P')), I: out.filter((x) => x.startsWith('I')), all: out };
}

export function randomRow({ seed, rng: r, allInterval = false } = {}) {
  const rng = asRng(r ?? seed);
  if (!allInterval) return rng.shuffle([...Array(12).keys()]);
  // backtracking search for an all-interval row
  const row = [0];
  const used = new Set([0]);
  const ivs = new Set();
  const dfs = () => {
    if (row.length === 12) return true;
    for (const iv of rng.shuffle([...Array(11).keys()].map((x) => x + 1))) {
      if (ivs.has(iv)) continue;
      const nx = mod(row[row.length - 1] + iv, 12);
      if (used.has(nx)) continue;
      row.push(nx); used.add(nx); ivs.add(iv);
      if (dfs()) return true;
      row.pop(); used.delete(nx); ivs.delete(iv);
    }
    return false;
  };
  dfs();
  return row;
}

/** realise a row form as melody notes: octave chosen nearest to the previous note within range */
export function rowToNotes(form, { start = 0, dur = 480, range = [55, 79], durs } = {}) {
  let prev = Math.round((range[0] + range[1]) / 2);
  let t = start;
  return form.map((p, i) => {
    let best = null;
    for (let m = range[0]; m <= range[1]; m++) if (mod(m, 12) === p && (best === null || Math.abs(m - prev) < Math.abs(best - prev))) best = m;
    prev = best;
    const d = durs ? durs[i % durs.length] : dur;
    const n = { start: t, dur: d, pitch: best, vel: 85 };
    t += d;
    return n;
  });
}
