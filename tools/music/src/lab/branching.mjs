// Branching rhythm trees: nested tuplets / polyrhythms written exactly, phrase by phrase.
//
// A rhythm tree splits a span into weighted children, each of which may split again.
// Grammar (OpenMusic style, like rhythm.mjs rhythmTree):
//   leaf  = weight (number; negative = rest)
//   node  = [weight, [children...]]       (always exactly two items: a number, then an array)
//   tree  = a node, or a plain list of children
//   [3, 1, 2]                     one span split 3:1:2
//   [[1, [1, 1, 1, 1, 1]], 1, 1]  thirds, the first third split in five: a quintuplet nested in a triplet
//   [1, [1, 1]]                   read as a NODE (weight 1, two children) - wrap lists of two as [1, [...]]
// Every leaf keeps its exact length as a fraction.
//
// phraseRhythm() puts trees on the metric skeleton of real bars (beat groups of each meter,
// meter changes included), varies them across a phrase (a a' b a), and writes several layers at
// once, each splitting the same groups differently (3 against 5 against 4): branching polyrhythm.
import { barStart, barLength, meterAt, drum as drumNum, PPQ } from '../ir.mjs';
import { asRng } from '../rng.mjs';
import { meterGrouping } from '../gen/drums.mjs';
import { frac, fadd, fmul, fcmp, makeRegion, addRegion } from '../tuplets.mjs';
import { midi as toMidi } from '../theory/pitch.mjs';

// tuning knobs
export const BRANCH = {
  splits: [2, 3, 4, 5],   // child counts a node may split into
  depth: 2,               // levels below the top split
  branchChance: 0.45,     // chance a child splits again (per level, shrinking with depth)
  restChance: 0.08,       // chance a leaf is a rest (never the first leaf of a group)
  unevenChance: 0.25,     // chance two neighbouring units merge (2+1+2 instead of 1+1+1+1+1)
  minLeaf: [1, 16],       // shortest leaf, in quarter notes (1/16 quarter = a 64th)
};

// ---- trees -----------------------------------------------------------------------------------
const isNode = (t) => Array.isArray(t);
const isPair = (t) => Array.isArray(t) && t.length === 2 && typeof t[0] === 'number' && Array.isArray(t[1]);
const kidsOf = (t) => (isPair(t) ? t[1] : t);
const weightOf = (t) => (typeof t === 'number' ? Math.abs(t) : isPair(t) ? Math.abs(t[0]) : 1);
const clone = (t) => JSON.parse(JSON.stringify(t));

/**
 * Exact leaves of a tree over `span` quarter notes (fraction [num, den] or number).
 * Returns [{ dur: [n, d], at: [n, d], rest, depth, path: [i, j, ...] }] in order.
 */
export function nestedRhythm(tree, span = [1, 1]) {
  const sp = Array.isArray(span) ? span : frac(Math.round(span * 1e6), 1e6);
  const out = [];
  const walk = (node, at, len, depth, path) => {
    if (typeof node === 'number') {
      if (!node) throw new Error('nestedRhythm: zero-weight leaf');
      out.push({ dur: len, at, rest: node < 0, depth, path });
      return;
    }
    const kids = kidsOf(node);
    if (!kids.length) throw new Error('nestedRhythm: empty node');
    const total = kids.reduce((a, k) => a + weightOf(k), 0);
    let t = at;
    kids.forEach((k, i) => {
      const l = fmul(len, frac(weightOf(k), total));
      walk(typeof k === 'number' ? k : k, t, l, depth + 1, [...path, i]);
      t = fadd(t, l);
    });
  };
  walk(tree, [0, 1], sp, 0, []);
  return out;
}

/** number of leaves */
export const leafCount = (tree) => nestedRhythm(tree).length;

/**
 * Grow a random branching tree. opts: { splits, depth, branchChance, restChance, unevenChance,
 * minLeaf (quarters, fraction), span (quarters, for the minLeaf check), top (force the top split), rng|seed }
 */
export function branchingTree(opts = {}) {
  const C = { ...BRANCH, ...opts };
  const rng = asRng(opts.rng ?? opts.seed);
  const span = Array.isArray(C.span) ? C.span : frac(C.span ?? 1, 1);
  const split = (len, level, first) => {
    const choices = C.splits.filter((n) => fcmp(fmul(len, frac(1, n)), C.minLeaf) >= 0);
    const n = level === 0 && C.top ? C.top : choices.length ? rng.pick(choices) : 1;
    if (n <= 1) return 1;
    // uneven splits merge neighbouring units (5 -> 2+1+2), so the tuplet stays an n-tuplet
    const weights = [];
    for (let u = 0; u < n; u++) {
      if (u < n - 1 && rng.chance(C.unevenChance)) { weights.push(2); u++; } else weights.push(1);
    }
    const total = n;
    return weights.map((w, i) => {
      const l = fmul(len, frac(w, total));
      const canGo = level < C.depth && rng.chance(C.branchChance / (level + 1));
      if (canGo) {
        const sub = split(l, level + 1, first && i === 0);
        if (Array.isArray(sub)) return [w, sub];
      }
      return !(first && i === 0) && rng.chance(C.restChance) ? -w : w;
    });
  };
  const t = split(span, 0, true);
  return [1, Array.isArray(t) ? t : [1]]; // always an explicit node, so a 2-way split can't be misread
}

/**
 * Vary a tree (for a' bars). op: 'rebranch' (regrow one child), 'rest' (silence one later leaf),
 * 'merge' (collapse one branch back to a single note), 'rotate' (rotate the top children),
 * 'random' (pick one). Returns a new tree.
 */
export function mutateTree(tree, opts = {}) {
  const rng = asRng(opts.rng ?? opts.seed);
  const t = clone(tree);
  const ops = ['rebranch', 'rest', 'merge', 'rotate'];
  const op = !opts.op || opts.op === 'random' ? rng.pick(ops) : opts.op;
  const top = kidsOf(t);
  if (op === 'rotate' && top.length > 1) {
    top.push(top.shift());
    return t;
  }
  if (op === 'rest') {
    const idx = top.map((k, i) => (i > 0 && typeof k === 'number' && k > 0 ? i : -1)).filter((i) => i >= 0);
    if (idx.length) {
      const i = rng.pick(idx);
      top[i] = -top[i];
      return t;
    }
  }
  if (op === 'merge') {
    const idx = top.map((k, i) => (isNode(k) ? i : -1)).filter((i) => i >= 0);
    if (idx.length) {
      const i = rng.pick(idx);
      top[i] = weightOf(top[i]);
      return t;
    }
  }
  // rebranch (also the fallback when another op had nothing to work on)
  const i = rng.int(0, top.length - 1);
  const w = weightOf(top[i]);
  const sub = branchingTree({ ...opts, depth: Math.max(0, (opts.depth ?? BRANCH.depth) - 1), span: frac(1, top.length), top: undefined, rng: rng.fork('re') });
  top[i] = Array.isArray(sub) && sub.length > 1 ? [w, sub] : w;
  return t;
}

// ---- writing ---------------------------------------------------------------------------------
const resolvePitch = (track, p) => (track.kind === 'drums' ? drumNum(p) : typeof p === 'number' ? p : toMidi(p));

/**
 * Write one tree as a tuplet region at `start` (ticks, on the grid) lasting `span` ticks (same bar).
 * opts: { tree, pitches (array, cycled; drum names ok) | pitch | pitchFn(leaf, i) -> pitch,
 *         vel (96), accent (first leaf +18), legato (true: notes last the whole leaf) }
 * Returns { region, notes, leaves }.
 */
export function writeTree(song, track, opts = {}) {
  const { start, span, tree } = opts;
  if (!Number.isInteger(start) || !Number.isInteger(span)) throw new Error('writeTree: start and span are ticks');
  const leaves = nestedRhythm(tree, frac(span, song.ppq ?? PPQ));
  const region = addRegion(song, track, makeRegion(start, leaves.map((l) => ({ dur: l.dur, rest: l.rest, depth: l.depth })), song.ppq ?? PPQ));
  const pitches = opts.pitches ?? [opts.pitch ?? (track.kind === 'drums' ? 'snare' : 'E2')];
  const notes = [];
  let k = 0;
  region.leaves.forEach((lf, i) => {
    if (lf.rest) return;
    const raw = opts.pitchFn ? opts.pitchFn(lf, i, k) : pitches[k % pitches.length];
    k++;
    const p = resolvePitch(track, raw);
    const n = { start: lf.start, dur: lf.ticks, pitch: p, vel: Math.min(127, (opts.vel ?? 96) + (i === 0 ? opts.accent ?? 18 : 0)) };
    if (opts.fx) n.fx = { ...opts.fx };
    notes.push(n);
  });
  track.notes.push(...notes);
  return { region, notes, leaves: region.leaves };
}

/**
 * Beat groups of a bar (the metric skeleton the trees hang from), as [{ start, ticks, units }].
 *  x/4 and x/2: one group per beat; x/8 and x/16: groups of 2 and 3 (resp. 4 and 3) units, 3s last
 *  (7/8 = 2+2+3, 5/8 = 2+3, 13/16 = 4+3+3+3); 6/8, 9/8, 12/8: dotted quarters.
 *  grouping: explicit unit counts, e.g. [3, 2, 2] for a 7/8 bar.
 */
export function beatGroups(song, bar, grouping) {
  const m = meterAt(song, bar);
  const unit = ((song.ppq ?? PPQ) * 4) / m.den;
  const g = grouping ?? meterGrouping(m.num, m.den);
  if (g.reduce((a, b) => a + b, 0) !== m.num) throw new Error(`beatGroups: grouping ${g.join('+')} doesn't fill ${m.num}/${m.den}`);
  const bs = barStart(song, bar);
  let t = bs;
  return g.map((u) => {
    const out = { start: t, ticks: u * unit, units: u };
    t += u * unit;
    return out;
  });
}

/**
 * Branching polyrhythm over a phrase.
 * opts: {
 *   from, bars,                       bar range (meters may change inside it)
 *   form: "a a' b a",                 one letter per bar, cycled; ' = varied, letters = new material
 *   layers: [{ track, pitches|pitch|pitchFn, splits, depth, branchChance, restChance,
 *              across: n,             split each whole bar into n first (n against the beat), else per beat group
 *              grouping, vel, fx }],
 *   seed|rng
 * }
 * Every layer grows its own trees, so the same beat groups get different nested divisions in each
 * layer. Returns [{ track, bars: [{ bar, label, trees: [...] }] }].
 */
export function phraseRhythm(song, opts = {}) {
  const rng = asRng(opts.rng ?? opts.seed);
  const from = opts.from ?? 0;
  const bars = opts.bars ?? song.bars - from;
  const labels = String(opts.form ?? "a a' b a").trim().split(/\s+/);
  const report = [];
  (opts.layers ?? []).forEach((layer, li) => {
    const lr = rng.fork('layer' + li);
    const material = new Map(); // letter -> trees per slot
    const out = { track: layer.track, bars: [] };
    for (let b = from; b < from + bars; b++) {
      const label = labels[(b - from) % labels.length];
      const letter = label.replace(/'+$/, '');
      const varied = label.length - letter.length;
      const slots = layer.across
        ? [{ start: barStart(song, b), ticks: barLength(song, b), top: layer.across }]
        : beatGroups(song, b, layer.grouping).map((g) => ({ ...g, top: null }));
      if (!material.has(letter)) material.set(letter, []);
      const base = material.get(letter);
      const trees = slots.map((slot, si) => {
        if (!base[si]) {
          base[si] = branchingTree({
            splits: layer.splits ?? BRANCH.splits, depth: layer.depth ?? BRANCH.depth, branchChance: layer.branchChance ?? BRANCH.branchChance,
            restChance: layer.restChance ?? BRANCH.restChance, unevenChance: layer.unevenChance ?? BRANCH.unevenChance,
            span: frac(slot.ticks, song.ppq ?? PPQ), top: slot.top ?? undefined, rng: lr.fork(`${letter}${si}`),
          });
        }
        let t = base[si];
        for (let v = 0; v < varied; v++) t = mutateTree(t, { rng: lr.fork(`${label}${b}${si}${v}`), depth: layer.depth ?? BRANCH.depth, splits: layer.splits ?? BRANCH.splits });
        writeTree(song, layer.track, { start: slot.start, span: slot.ticks, tree: t, pitches: layer.pitches, pitch: layer.pitch, pitchFn: layer.pitchFn, vel: layer.vel, fx: layer.fx });
        return t;
      });
      out.bars.push({ bar: b, label, trees });
    }
    report.push(out);
  });
  return report;
}

