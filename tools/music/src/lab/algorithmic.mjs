// Algorithmic composition: L-systems, cellular automata, chaos maps, random walks,
// reaction-diffusion, Fibonacci words, Xenakis sieves, and number/letter mappings (numerology).
// Everything produces plain numbers or symbol strings; `toNotes` maps them into a scale.
import { makeScale } from '../theory/scale.mjs';
import { parseKey } from '../theory/key.mjs';
import { asRng } from '../rng.mjs';

// ---- L-systems ---------------------------------------------------------------------------

/** rewrite `axiom` with `rules` (string or [[weight, string], ...] for stochastic rules) */
export function lsystem(axiom, rules, iterations = 4, { seed, rng: r, maxLength = 20000 } = {}) {
  const rng = asRng(r ?? seed);
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    let next = '';
    for (const ch of s) {
      const rule = rules[ch];
      if (rule === undefined) next += ch;
      else if (typeof rule === 'string') next += rule;
      else next += rng.weighted(rule.map(([w, str]) => [str, w]));
      if (next.length > maxLength) throw new Error(`lsystem: string grew past ${maxLength} symbols; use fewer iterations`);
    }
    s = next;
  }
  return s;
}

/**
 * Turtle reading of an L-system string as melody:
 *   F / G = play a note and step; + / - = turn up / down (change step direction or size);
 *   [ ] = push / pop state (branch); > < = longer / shorter note; anything else = ignored.
 * Returns [{ degree, dur (in units) }].
 */
export function turtleMelody(str, { step = 1, startDegree = 0, unit = 1, play = 'FG', maxNotes = 512 } = {}) {
  const out = [];
  let st = { deg: startDegree, dir: 1, size: step, dur: unit };
  const stack = [];
  for (const ch of str) {
    if (out.length >= maxNotes) break;
    if (play.includes(ch)) {
      out.push({ degree: st.deg, dur: st.dur });
      st.deg += st.dir * st.size;
    } else if (ch === '+') st.dir = 1;
    else if (ch === '-') st.dir = -1;
    else if (ch === '[') stack.push({ ...st });
    else if (ch === ']') st = stack.pop() ?? st;
    else if (ch === '>') st.dur *= 2;
    else if (ch === '<') st.dur = Math.max(unit / 4, st.dur / 2);
  }
  return out;
}

// ---- cellular automata ---------------------------------------------------------------------

/** elementary CA (Wolfram rule 0-255). Returns rows (arrays of 0/1). */
export function elementaryCA(rule, { width = 16, generations = 16, start } = {}) {
  if (!(rule >= 0 && rule <= 255)) throw new Error('rule must be 0-255');
  let row = start ? start.slice() : Array.from({ length: width }, (_, i) => (i === Math.floor(width / 2) ? 1 : 0));
  const rows = [row];
  for (let g = 1; g < generations; g++) {
    const n = row.length;
    row = row.map((_, i) => {
      const idx = (row[(i - 1 + n) % n] << 2) | (row[i] << 1) | row[(i + 1) % n];
      return (rule >> idx) & 1;
    });
    rows.push(row);
  }
  return rows;
}

// ---- chaos and random walks ----------------------------------------------------------------

/** logistic map x' = r x (1 - x); r around 3.57-4 is chaotic. Returns values in 0..1. */
export function logistic(n, { r = 3.9, x0 = 0.5 } = {}) {
  const out = [];
  let x = x0;
  for (let i = 0; i < n; i++) {
    x = r * x * (1 - x);
    out.push(x);
  }
  return out;
}

/** bounded random walk of integer steps (brownian melody) */
export function randomWalk(n, { start = 0, steps = [-2, -1, 1, 2], min = -7, max = 14, seed, rng: r } = {}) {
  const rng = asRng(r ?? seed);
  const out = [start];
  for (let i = 1; i < n; i++) {
    let v = out[i - 1] + rng.pick(steps);
    if (v < min) v = min + (min - v);
    if (v > max) v = max - (v - max);
    out.push(Math.max(min, Math.min(max, v)));
  }
  return out;
}

/** 1/f ("pink") sequence by the Voss-McCartney method: smoother than white noise, less than brown */
export function pinkNoise(n, { rows = 5, range = 7, seed, rng: r } = {}) {
  const rng = asRng(r ?? seed);
  const vals = new Array(rows).fill(0).map(() => rng.int(0, range));
  const out = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < rows; k++) if (i % (1 << k) === 0) vals[k] = rng.int(0, range);
    out.push(vals.reduce((a, b) => a + b, 0));
  }
  return out;
}

// ---- reaction-diffusion ------------------------------------------------------------------------

/** 1D Gray-Scott: returns final V concentration per cell (0..~0.5). Spots/stripes -> densities. */
export function grayScott1D({ cells = 64, steps = 2000, F = 0.037, k = 0.06, Du = 0.16, Dv = 0.08, seed, rng: r } = {}) {
  const rng = asRng(r ?? seed);
  let U = new Array(cells).fill(1);
  let V = new Array(cells).fill(0);
  for (let i = Math.floor(cells * 0.4); i < Math.floor(cells * 0.6); i++) {
    U[i] = 0.5;
    V[i] = 0.25 + rng.next() * 0.05;
  }
  for (let s = 0; s < steps; s++) {
    const U2 = U.slice();
    const V2 = V.slice();
    for (let i = 0; i < cells; i++) {
      const l = (i - 1 + cells) % cells;
      const rr = (i + 1) % cells;
      const lapU = U[l] + U[rr] - 2 * U[i];
      const lapV = V[l] + V[rr] - 2 * V[i];
      const uvv = U[i] * V[i] * V[i];
      U2[i] = U[i] + Du * lapU - uvv + F * (1 - U[i]);
      V2[i] = V[i] + Dv * lapV + uvv - (F + k) * V[i];
    }
    U = U2;
    V = V2;
  }
  return V;
}

/** values -> 0/1 rhythm by threshold (default: above the mean) */
export function threshold(values, t) {
  const th = t ?? values.reduce((a, b) => a + b, 0) / values.length;
  return values.map((v) => (v > th ? 1 : 0));
}

// ---- Fibonacci / golden ratio ---------------------------------------------------------------

export function fibonacci(n) {
  const out = [1, 1];
  while (out.length < n) out.push(out[out.length - 1] + out[out.length - 2]);
  return out.slice(0, n);
}

/** Fibonacci word (a -> ab, b -> a) as 1/0: a quasi-periodic rhythm */
export function fibonacciWord(length) {
  let s = 'a';
  while (s.length < length) s = s.replace(/[ab]/g, (c) => (c === 'a' ? 'ab' : 'a'));
  return [...s.slice(0, length)].map((c) => (c === 'a' ? 1 : 0));
}

// ---- Xenakis sieves -------------------------------------------------------------------------------

/**
 * Sieve expression: residue classes "m@r" combined with | (union), & (intersection), ! (complement),
 * parentheses. Example: "(3@0 | 4@1) & !5@0". Returns members in [lo, hi].
 */
export function sieve(expr, lo = 0, hi = 24) {
  const tokens = String(expr).match(/\d+@\d+|[|&!()]/g);
  if (!tokens) throw new Error(`Bad sieve "${expr}"`);
  let i = 0;
  const parseOr = () => {
    let a = parseAnd();
    while (tokens[i] === '|') {
      i++;
      const b = parseAnd();
      const A = a;
      a = (x) => A(x) || b(x);
    }
    return a;
  };
  const parseAnd = () => {
    let a = parseUnary();
    while (tokens[i] === '&') {
      i++;
      const b = parseUnary();
      const A = a;
      a = (x) => A(x) && b(x);
    }
    return a;
  };
  const parseUnary = () => {
    if (tokens[i] === '!') {
      i++;
      const a = parseUnary();
      return (x) => !a(x);
    }
    if (tokens[i] === '(') {
      i++;
      const a = parseOr();
      if (tokens[i++] !== ')') throw new Error(`Sieve "${expr}": missing )`);
      return a;
    }
    const t = tokens[i++];
    const m = /^(\d+)@(\d+)$/.exec(t ?? '');
    if (!m) throw new Error(`Sieve "${expr}": expected m@r at "${t}"`);
    const mod = Number(m[1]);
    const res = Number(m[2]);
    if (!mod) throw new Error('Sieve modulus must be > 0');
    return (x) => ((x % mod) + mod) % mod === res % mod;
  };
  const f = parseOr();
  if (i !== tokens.length) throw new Error(`Sieve "${expr}": unexpected "${tokens[i]}"`);
  const out = [];
  for (let x = lo; x <= hi; x++) if (f(x)) out.push(x);
  return out;
}

// ---- numerology / text mappings ---------------------------------------------------------------

/** English ordinal gematria: a=1 .. z=26 (simple), or 'pythagorean' (1-9 cycling) */
export function letterValues(text, system = 'ordinal') {
  return [...String(text).toLowerCase()].filter((c) => c >= 'a' && c <= 'z').map((c) => {
    const v = c.charCodeAt(0) - 96;
    return system === 'pythagorean' ? ((v - 1) % 9) + 1 : v;
  });
}

/** repeated digit sum (numerology "reduction"): 1987 -> 25 -> 7; keeps master numbers 11/22/33 if asked */
export function digitRoot(n, { keepMasters = false } = {}) {
  let x = Math.abs(Math.floor(n));
  while (x > 9 && !(keepMasters && [11, 22, 33].includes(x))) x = String(x).split('').reduce((a, d) => a + Number(d), 0);
  return x;
}

/** word -> numbers per word (sum of letters), handy for rhythm/degree seeds */
export function wordNumbers(text, system = 'ordinal') {
  return String(text).split(/\s+/).filter(Boolean).map((w) => letterValues(w, system).reduce((a, b) => a + b, 0));
}

// ---- mapping to music -------------------------------------------------------------------------------

/**
 * Turn a number sequence into notes in a key.
 * values: numbers (degrees by default; with `normalize: true` values 0..1 are spread over `span` degrees)
 * durs: number of units per note (array cycles), unit: ticks per unit, rests: values marked null
 */
export function toNotes(values, { key = 'C major', octave = 4, unit = 480, durs = [1], start = 0, normalize = false, span = 14, low = 0, range = [48, 84] } = {}) {
  const k = parseKey(key);
  const sc = makeScale(k.tonic, k.mode === 'minor' ? 'minor' : k.mode === 'major' ? 'major' : k.mode, octave);
  const out = [];
  let t = start;
  values.forEach((v, i) => {
    const d = durs[i % durs.length] * unit;
    if (v !== null && v !== undefined) {
      const deg = normalize ? low + Math.round(v * span) : Math.round(v);
      let m = sc.midi(deg);
      while (m < range[0]) m += 12;
      while (m > range[1]) m -= 12;
      out.push({ start: t, dur: d, pitch: m, vel: 90 });
    }
    t += d;
  });
  return out;
}

/** 0/1 pattern -> note onsets (each hit lasts until the next hit, max `maxUnits`) */
export function patternToNotes(pattern, { unit = 240, start = 0, pitch = 60, maxUnits = 4 } = {}) {
  const out = [];
  const idx = pattern.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  idx.forEach((i, k) => {
    const next = idx[k + 1] ?? pattern.length;
    out.push({ start: start + i * unit, dur: Math.min(next - i, maxUnits) * unit, pitch, vel: 96 });
  });
  return out;
}
