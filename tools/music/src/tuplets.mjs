// Tuplets: exact fractions, notation for any rational duration, and tuplet regions on tracks.
//
// A tuplet region is a span of one bar whose rhythm is written leaf by leaf with explicit notation:
//   track.tuplets = [{ start, dur, leaves: [{ start, ticks, den, dots, n, m }] }]
// n:m is "n notes in the time of m" for that leaf's note value (den = 4 quarter, 8 eighth ...).
// Leaves come from rhythm trees (lab/rhythm.mjs nestedRhythm). Nested tuplets are flattened to one
// ratio per leaf (Guitar Pro 7 and alphaTab hold one tuplet per beat): five in the space of one
// triplet eighth becomes 15:8 thirty-seconds. Exact rhythm is kept as fractions; ticks are rounded
// so the leaves always add up to the region length exactly.
import { PPQ, DEFAULT_GRID, barAt, barStart, barLength } from './ir.mjs';

// tuning knobs
export const TUPLETS = {
  noteValues: [1, 2, 4, 8, 16, 32, 64, 128], // note values a leaf may be written as
  maxN: 31,                                  // largest tuplet numerator accepted
};

// ---- fractions [num, den] ------------------------------------------------------------------
export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const frac = (n, d = 1) => {
  if (!d) throw new Error('fraction with zero denominator');
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return [(s * n) / g, (s * d) / g];
};
export const fadd = ([a, b], [c, d]) => frac(a * d + c * b, b * d);
export const fsub = ([a, b], [c, d]) => frac(a * d - c * b, b * d);
export const fmul = ([a, b], [c, d]) => frac(a * c, b * d);
export const fdiv = ([a, b], [c, d]) => frac(a * d, b * c);
export const fcmp = ([a, b], [c, d]) => a * d - c * b;
export const fval = ([a, b]) => a / b;
const isPow2 = (x) => x > 0 && (x & (x - 1)) === 0;

/**
 * How to write a duration of `q` quarter notes (fraction). Returns { den, dots, n, m }:
 * the note value (den), dots (0/1) and tuplet ratio n:m (1:1 = no tuplet).
 * Picks the reading with the smallest tuplet, preferring m a power of two (3:2, 5:4, 7:4, 15:8).
 */
export function notate(q) {
  const cands = [];
  for (const den of TUPLETS.noteValues) {
    for (const dots of [0, 1]) {
      const base = dots ? frac(4 * 3, den * 2) : frac(4, den); // in quarters
      const ratio = fdiv(base, q); // n/m
      const [n, m] = ratio;
      if (fcmp(ratio, [1, 1]) < 0 || fcmp(ratio, [2, 1]) >= 0) continue; // a tuplet squeezes, by less than half
      if (n > TUPLETS.maxN) continue;
      cands.push({ den, dots, n, m, score: (n === m ? 0 : 10 + n) + (isPow2(m) || n === m ? 0 : 50) + dots * 2 });
    }
  }
  if (!cands.length) throw new Error(`Can't notate ${q[0]}/${q[1]} quarters`);
  cands.sort((a, b) => a.score - b.score);
  const { den, dots, n, m } = cands[0];
  return n === m ? { den, dots, n: 1, m: 1 } : { den, dots, n, m };
}

/**
 * Build a tuplet region from exact leaves.
 * start: region start tick (on the grid); leaves: [{ dur: [num, den] quarters, ... }] in order.
 * Returns { start, dur, leaves: [{ start, ticks, den, dots, n, m, q, ...extra }] }.
 */
export function makeRegion(start, leaves, ppq = PPQ) {
  let acc = [0, 1];
  const out = [];
  const tickAt = (f) => Math.round(fval(fmul(f, [ppq, 1])));
  for (const lf of leaves) {
    const s = start + tickAt(acc);
    acc = fadd(acc, lf.dur);
    const e = start + tickAt(acc);
    const { dur, ...extra } = lf;
    out.push({ ...extra, start: s, ticks: e - s, q: dur, ...notate(dur) });
  }
  const total = fmul(acc, [ppq, 1]);
  if (total[1] !== 1) throw new Error(`Tuplet region length ${fval(acc)} quarters is not a whole number of ticks`);
  return { start, dur: total[0], leaves: out };
}

/** add a region to a track (checks it sits inside one bar and doesn't overlap another region) */
export function addRegion(song, track, region) {
  const grid = song.grid ?? DEFAULT_GRID;
  if (region.start % grid || region.dur % grid) throw new Error(`Tuplet region ${region.start}+${region.dur} must start and end on the ${grid}-tick grid`);
  const b = barAt(song, region.start);
  if (region.start + region.dur > barStart(song, b) + barLength(song, b)) throw new Error(`Tuplet region at bar ${b + 1} crosses the barline`);
  track.tuplets = track.tuplets ?? [];
  for (const r of track.tuplets) {
    if (region.start < r.start + r.dur && r.start < region.start + region.dur) throw new Error(`Tuplet regions overlap at tick ${region.start}`);
  }
  track.tuplets.push(region);
  track.tuplets.sort((x, y) => x.start - y.start);
  return region;
}
