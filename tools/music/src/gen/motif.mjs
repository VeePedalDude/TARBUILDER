// Motif development: classic transformations on short note lists.
// A motif is [{ start (ticks from motif start), dur, pitch }].
import { makeScale } from '../theory/scale.mjs';
import { parseKey } from '../theory/key.mjs';

const clone = (m) => m.map((n) => ({ ...n }));
const length = (m) => (m.length ? Math.max(...m.map((n) => n.start + n.dur)) : 0);

/** chromatic transposition */
export function transposeMotif(m, semis) {
  return clone(m).map((n) => ({ ...n, pitch: n.pitch + semis }));
}

/** diatonic transposition: move every note `steps` scale degrees (stays in key) */
export function transposeDiatonic(m, steps, key = 'C major', scaleName) {
  const k = parseKey(key);
  const sc = makeScale(k.tonic, scaleName ?? (k.mode === 'minor' ? 'minor' : k.mode), 4);
  return clone(m).map((n) => {
    const d = sc.degreeOf(n.pitch);
    const off = n.pitch - sc.midi(d); // keep chromatic alterations
    return { ...n, pitch: sc.midi(d + steps) + off };
  });
}

/** mirror intervals around the first note (diatonic if key given, else chromatic) */
export function invert(m, { key, axis } = {}) {
  if (!m.length) return [];
  const ax = axis ?? m[0].pitch;
  if (!key) return clone(m).map((n) => ({ ...n, pitch: 2 * ax - n.pitch }));
  const k = parseKey(key);
  const sc = makeScale(k.tonic, k.mode === 'minor' ? 'minor' : k.mode, 4);
  const a = sc.degreeOf(ax);
  return clone(m).map((n) => ({ ...n, pitch: sc.midi(2 * a - sc.degreeOf(n.pitch)) }));
}

/** play backwards (rhythm reversed too) */
export function retrograde(m) {
  const L = length(m);
  return clone(m)
    .map((n) => ({ ...n, start: L - n.start - n.dur }))
    .sort((a, b) => a.start - b.start);
}

export function retrogradeInversion(m, opts) {
  return retrograde(invert(m, opts));
}

/** stretch time by factor (2 = augmentation, 0.5 = diminution). Rounded to the grid. */
export function scaleTime(m, factor, grid = 120) {
  return clone(m).map((n) => ({
    ...n,
    start: Math.round((n.start * factor) / grid) * grid,
    dur: Math.max(grid, Math.round((n.dur * factor) / grid) * grid),
  }));
}

export const augment = (m, grid) => scaleTime(m, 2, grid);
export const diminish = (m, grid) => scaleTime(m, 0.5, grid);

/** shift in time (rhythmic displacement) */
export function displace(m, ticks) {
  return clone(m).map((n) => ({ ...n, start: n.start + ticks }));
}

/** first `count` notes */
export function fragment(m, count) {
  return clone(m).sort((a, b) => a.start - b.start).slice(0, count);
}

/** sequence: repeat the motif `times`, each copy moved by `steps` scale degrees and `gap` ticks later */
export function sequence(m, { times = 3, steps = -1, key = 'C major', gap } = {}) {
  const L = gap ?? length(m);
  const out = [];
  for (let i = 0; i < times; i++) out.push(...displace(transposeDiatonic(m, steps * i, key), L * i));
  return out;
}

/** connect and decorate: fill gaps of a third with a passing tone, add a neighbour on long notes */
export function ornament(m, { key = 'C major', grid = 240 } = {}) {
  const k = parseKey(key);
  const sc = makeScale(k.tonic, k.mode === 'minor' ? 'minor' : k.mode, 4);
  const src = clone(m).sort((a, b) => a.start - b.start);
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const n = src[i];
    const next = src[i + 1];
    const dn = sc.degreeOf(n.pitch);
    if (next && n.dur >= 2 * grid && Math.abs(sc.degreeOf(next.pitch) - dn) === 2) {
      out.push({ ...n, dur: n.dur - grid });
      out.push({ ...n, start: n.start + n.dur - grid, dur: grid, pitch: sc.midi((dn + sc.degreeOf(next.pitch)) / 2) });
    } else if (n.dur >= 4 * grid) {
      out.push({ ...n, dur: n.dur / 2 });
      out.push({ ...n, start: n.start + n.dur / 2, dur: grid, pitch: sc.midi(dn + 1) });
      out.push({ ...n, start: n.start + n.dur / 2 + grid, dur: n.dur / 2 - grid });
    } else out.push(n);
  }
  return out;
}

export const TRANSFORMS = { transposeMotif, transposeDiatonic, invert, retrograde, retrogradeInversion, augment, diminish, displace, fragment, sequence, ornament };
