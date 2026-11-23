// Rhythm lab: Euclidean rhythms, necklaces, polymeter / polyrhythm, rhythm trees, phasing,
// additive meters and metric modulation. Patterns are arrays of 0/1 (or strings like "x..x.").
import { barStart, barLength, drum as drumNum } from '../ir.mjs';

export const toPattern = (p) => (Array.isArray(p) ? p.map((x) => (x ? 1 : 0)) : [...String(p)].map((c) => (c === 'x' || c === 'X' || c === '1' ? 1 : 0)));
export const toString = (p) => toPattern(p).map((x) => (x ? 'x' : '.')).join('');

/** Euclidean rhythm E(k, n): k onsets spread as evenly as possible over n steps (Bjorklund). */
export function euclid(k, n, rotation = 0) {
  if (!Number.isInteger(k) || !Number.isInteger(n) || n <= 0 || k < 0 || k > n) throw new Error(`euclid: need 0 <= k <= n, got ${k}, ${n}`);
  if (k === 0) return new Array(n).fill(0);
  // Bjorklund: repeatedly pair the onset groups with the remainder groups
  let a = Array.from({ length: k }, () => [1]);
  let b = Array.from({ length: n - k }, () => [0]);
  while (b.length > 1) {
    const m = Math.min(a.length, b.length);
    const merged = [];
    for (let i = 0; i < m; i++) merged.push([...a[i], ...b[i]]);
    const rest = a.length > m ? a.slice(m) : b.slice(m);
    a = merged;
    b = rest;
  }
  const pat = [...a, ...b].flat();
  return rotate(pat, rotation);
}

export function rotate(p, r) {
  const a = toPattern(p);
  const n = a.length;
  const s = ((r % n) + n) % n;
  return a.slice(s).concat(a.slice(0, s));
}

export const complement = (p) => toPattern(p).map((x) => 1 - x);
export const onsets = (p) => toPattern(p).reduce((acc, x, i) => (x ? [...acc, i] : acc), []);
/** inter-onset intervals, e.g. tresillo [3,3,2] */
export function intervals(p) {
  const o = onsets(p);
  const n = toPattern(p).length;
  return o.map((x, i) => (o[i + 1] ?? o[0] + n) - x);
}
export function fromIntervals(iois) {
  const out = [];
  for (const d of iois) out.push(1, ...new Array(d - 1).fill(0));
  return out;
}

/** all distinct rotations (the necklace) */
export function necklace(p) {
  const a = toPattern(p);
  const seen = new Set();
  const out = [];
  for (let r = 0; r < a.length; r++) {
    const s = toString(rotate(a, r));
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** evenness: 1 = maximally even (Euclidean), lower = clumped */
export function evenness(p) {
  const a = toPattern(p);
  const o = onsets(a);
  const n = a.length;
  const k = o.length;
  if (k < 2) return 1;
  let err = 0;
  for (let i = 0; i < k; i++) {
    const ideal = (i * n) / k;
    const d = Math.min(...o.map((x) => Math.abs(((x - o[0] - ideal) % n + n) % n)));
    err += Math.min(d, n - d);
  }
  return 1 / (1 + err / k);
}

/** additive meter "3+3+2" -> accent pattern [1,0,0,1,0,0,1,0] */
export function additive(spec) {
  const parts = String(spec).split('+').map((x) => parseInt(x, 10));
  if (parts.some((x) => !(x > 0))) throw new Error(`additive: bad spec "${spec}"`);
  return fromIntervals(parts);
}

/** least common multiple */
export const lcm = (...xs) => xs.reduce((a, b) => (a * b) / gcd(a, b));
export function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}

/**
 * Polymeter: several looping patterns of different lengths on one pulse.
 * layers: [{ pattern, pitch, vel }], returns events [{ step, layer, pitch, vel }] for `steps` pulses
 * (default: until all layers realign = lcm of lengths).
 */
export function polymeter(layers, { steps } = {}) {
  const pats = layers.map((l) => toPattern(l.pattern));
  const total = steps ?? lcm(...pats.map((p) => p.length));
  const ev = [];
  for (let s = 0; s < total; s++) {
    pats.forEach((p, li) => {
      if (p[s % p.length]) ev.push({ step: s, layer: li, pitch: layers[li].pitch, vel: layers[li].vel ?? 96 });
    });
  }
  return { events: ev, steps: total };
}

/** Polyrhythm a:b over a span (ticks): onsets of each stream. Requires span divisible by a and b. */
export function polyrhythm(a, b, span) {
  if (span % a || span % b) throw new Error(`polyrhythm: span ${span} isn't divisible by ${a} and ${b}`);
  return { a: Array.from({ length: a }, (_, i) => (i * span) / a), b: Array.from({ length: b }, (_, i) => (i * span) / b) };
}

/**
 * Rhythm tree (OpenMusic/Ferneyhough style): [weight, [children]] or a number (leaf weight).
 * Negative leaf = rest. Example: [1, [1, [1, [1, 1]], 2]] splits a span 1 : 1 : 2 with the middle
 * part split again in two. Returns [{ start, dur, rest }] in ticks over `span`.
 * Throws if a split doesn't land on the grid.
 */
export function rhythmTree(tree, span, { grid = 1 } = {}) {
  const out = [];
  const walk = (node, start, len) => {
    if (typeof node === 'number') {
      out.push({ start, dur: len, rest: node < 0 });
      return;
    }
    const kids = Array.isArray(node[1]) ? node[1] : node;
    const weights = kids.map((k) => Math.abs(typeof k === 'number' ? k : k[0]));
    const total = weights.reduce((x, y) => x + y, 0);
    let t = start;
    kids.forEach((k, i) => {
      const l = (len * weights[i]) / total;
      if (!Number.isInteger(l) || l % grid) throw new Error(`rhythmTree: ${len} ticks can't be split ${weights.join(':')} on a ${grid}-tick grid`);
      walk(typeof k === 'number' ? k : k, t, l);
      t += l;
    });
  };
  walk(Array.isArray(tree[1]) ? tree : [1, tree], 0, span);
  return out;
}

/**
 * Steve Reich-style phasing: two copies of a pattern, the second shifted one step further every
 * `repeats` cycles. Returns [{ cycle, shift, a: pattern, b: pattern }].
 */
export function phase(p, { repeats = 4 } = {}) {
  const a = toPattern(p);
  const out = [];
  for (let s = 0; s <= a.length; s++) for (let r = 0; r < repeats; r++) out.push({ cycle: out.length, shift: s % a.length, a, b: rotate(a, s) });
  return out;
}

/** metric modulation: new tempo so `oldUnits` of the old beat equal `newUnits` of the new beat */
export function metricModulation(tempo, oldUnits, newUnits) {
  return (tempo * newUnits) / oldUnits;
}

/**
 * Write a pattern into a track as notes. pattern steps run across bars from `bar`.
 * opts: { pitch (midi or drum name), steps per bar (pattern length by default), bars, vel, dur }
 */
export function writePattern(song, track, pattern, { bar = 0, bars = 1, stepsPerBar, pitch = 'kick', vel = 96, dur } = {}) {
  const p = toPattern(pattern);
  const spb = stepsPerBar ?? p.length;
  const pc = track.kind === 'drums' ? drumNum(pitch) : pitch;
  let k = 0;
  for (let b = bar; b < Math.min(song.bars, bar + bars); b++) {
    const step = barLength(song, b) / spb;
    if (!Number.isInteger(step)) throw new Error(`writePattern: ${spb} steps don't divide bar ${b + 1}`);
    for (let i = 0; i < spb; i++, k++) {
      if (p[k % p.length]) track.notes.push({ start: barStart(song, b) + i * step, dur: dur ?? step, pitch: pc, vel });
    }
  }
  return track;
}

/** polymeter -> drum track notes (one step = stepTicks) */
export function writePolymeter(song, track, layers, { from = 0, stepTicks = 240, steps } = {}) {
  const end = barStart(song, song.bars);
  const start = barStart(song, from);
  const total = steps ?? Math.floor((end - start) / stepTicks);
  const { events } = polymeter(layers, { steps: total });
  for (const e of events) {
    const t = start + e.step * stepTicks;
    if (t >= end) continue;
    track.notes.push({ start: t, dur: stepTicks, pitch: track.kind === 'drums' ? drumNum(e.pitch) : e.pitch, vel: e.vel });
  }
  return track;
}
