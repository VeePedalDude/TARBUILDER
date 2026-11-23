// Neo-Riemannian theory: P, L, R (and N, S, H) on major/minor triads, Tonnetz coordinates,
// shortest transformation paths, and the hexatonic/octatonic cycles.
import { mod, pc as pcOf } from '../theory/pitch.mjs';
import { parseChord } from '../theory/chord.mjs';

// usual spellings: Db major but C# minor, Ab major but G# minor
const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

/** triad from symbol ("C", "Am", "F#m") or { root, minor } */
export function triad(x) {
  if (typeof x === 'object' && x && 'root' in x) return { root: mod(x.root, 12), minor: !!x.minor };
  const c = parseChord(x);
  const third = c.names.includes('m3');
  if (!(c.names.includes('M3') || third) || !c.names.includes('P5') || c.names.length !== 3) throw new Error(`"${x}" is not a major or minor triad`);
  return { root: pcOf(c.root), minor: third };
}

export const triadName = (t) => (t.minor ? MINOR_NAMES[t.root] + 'm' : MAJOR_NAMES[t.root]);
export const triadPcs = (t) => [t.root, mod(t.root + (t.minor ? 3 : 4), 12), mod(t.root + 7, 12)];

// The three basic transformations each keep two common tones and move one voice.
export const P = (t) => ({ root: t.root, minor: !t.minor }); // parallel: C <-> Cm
export const L = (t) => (t.minor ? { root: mod(t.root - 4, 12), minor: false } : { root: mod(t.root + 4, 12), minor: true }); // leading-tone: C <-> Em
export const R = (t) => (t.minor ? { root: mod(t.root + 3, 12), minor: false } : { root: mod(t.root - 3, 12), minor: true }); // relative: C <-> Am
export const OPS = {
  P, L, R,
  N: (t) => P(L(R(t))), // Nebenverwandt: C <-> Fm (RLP)
  S: (t) => R(P(L(t))), // Slide: C <-> C#m (LPR)
  H: (t) => L(P(L(t))), // hexatonic pole: C <-> Abm (LPL)
};

/** apply a string of operations left to right: apply('C', 'PLR') */
export function apply(start, ops) {
  let t = triad(start);
  const path = [triadName(t)];
  for (const o of String(ops).replace(/\s/g, '')) {
    if (!OPS[o]) throw new Error(`Unknown transformation "${o}" (use P L R N S H)`);
    t = OPS[o](t);
    path.push(triadName(t));
  }
  return { result: triadName(t), path };
}

/** shortest P/L/R path between two triads (BFS). ops: which transformations to allow. */
export function shortestPath(from, to, { ops = 'PLR' } = {}) {
  const a = triad(from);
  const b = triad(to);
  const key = (t) => `${t.root}${t.minor ? 'm' : ''}`;
  const seen = new Map([[key(a), null]]);
  const q = [a];
  while (q.length) {
    const t = q.shift();
    if (key(t) === key(b)) break;
    for (const o of ops) {
      const n = OPS[o](t);
      if (!seen.has(key(n))) {
        seen.set(key(n), { prev: t, op: o });
        q.push(n);
      }
    }
  }
  const opsOut = [];
  let k = key(b);
  while (seen.get(k)) {
    const s = seen.get(k);
    opsOut.unshift(s.op);
    k = key(s.prev);
  }
  return apply(from, opsOut.join(''));
}

/** Tonnetz coordinates: x steps of perfect fifths, y steps of major thirds. pc = 7x + 4y (mod 12). */
export function tonnetzCoord(pcNum) {
  for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) if (mod(7 * x + 4 * y, 12) === mod(pcNum, 12)) return { x, y };
  return null;
}

/** the triangle (3 pcs) a triad occupies on the Tonnetz, plus its neighbours by P, L, R */
export function neighbours(x) {
  const t = triad(x);
  return { triad: triadName(t), pcs: triadPcs(t), P: triadName(P(t)), L: triadName(L(t)), R: triadName(R(t)) };
}

/** hexatonic cycle (alternate P and L): 6 triads sharing one hexatonic collection */
export function hexatonicCycle(start = 'C') {
  return cycle(start, 'PL');
}

/** octatonic cycle (alternate P and R): 8 triads in one octatonic collection */
export function octatonicCycle(start = 'C') {
  return cycle(start, 'PR');
}

/** Weitzmann-style L/R chain (the "Hauptstimme" cycle of 24 triads by alternating L and R) */
export function lrChain(start = 'C') {
  return cycle(start, 'LR');
}

export function cycle(start, pattern) {
  let t = triad(start);
  const out = [triadName(t)];
  const startKey = triadName(t);
  for (let i = 0; i < 48; i++) {
    t = OPS[pattern[i % pattern.length]](t);
    if (triadName(t) === startKey) break;
    out.push(triadName(t));
  }
  return out;
}

/** voice-leading distance (sum of smallest semitone moves) between two triads' pitch classes */
export function voiceLeadingDistance(a, b) {
  const pa = triadPcs(triad(a));
  const pb = triadPcs(triad(b));
  let best = Infinity;
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) {
    let d = 0;
    for (let i = 0; i < 3; i++) {
      const x = mod(pb[p[i]] - pa[i], 12);
      d += Math.min(x, 12 - x);
    }
    best = Math.min(best, d);
  }
  return best;
}

/** random walk on the Tonnetz -> chord symbols (each step one P, L or R) */
export function tonnetzWalk(start, steps, rng, ops = 'PLR') {
  let t = triad(start);
  const out = [triadName(t)];
  let last = '';
  for (let i = 0; i < steps; i++) {
    const choices = [...ops].filter((o) => o !== last); // P P / L L just undo
    const o = rng.pick(choices);
    t = OPS[o](t);
    last = o;
    out.push(triadName(t));
  }
  return out;
}
