// Melody generation by rules (motif + phrase structure + voice-leading scoring), with a critic.
import { makeScale } from '../theory/scale.mjs';
import { parseKey } from '../theory/key.mjs';
import { parseChord } from '../theory/chord.mjs';
import { mod, pc } from '../theory/pitch.mjs';
import { asRng } from '../rng.mjs';
import { barStart, barLength, beatTicks, barAt, chordAt } from '../ir.mjs';

// Tweak these to change the melodic style.
export const MELODY_RULES = {
  chordToneStrong: 3.0,    // reward chord tones on beats
  nonChordStrong: -2.5,    // punish non-chord tones on beats
  step: 2.0,               // reward steps (1-2 semitones)
  third: 1.0,              // 3-4 semitones
  leapPenalty: -0.6,       // per semitone above a fourth (5)
  octavePlus: -8,          // leaps over an octave
  tritone: -3,
  repeat: -0.4,            // same pitch again
  leapRecovery: 3.0,       // step back after a leap
  leapNotRecovered: -2.5,
  leadingTone: 2.0,        // 7 -> 8
  rangeEdge: -1.5,         // near the range limits
  temperature: 0.9,        // lower = always the best choice, higher = more surprise
};

// one-beat rhythm cells as fractions of a beat; weights by density (0 sparse .. 1 busy)
const CELLS = [
  { cell: [1], w: [3, 1.5] },
  { cell: [0.5, 0.5], w: [1.5, 3] },
  { cell: [0.75, 0.25], w: [0.8, 1.5] },
  { cell: [0.25, 0.25, 0.5], w: [0.2, 1.5] },
  { cell: [0.5, 0.25, 0.25], w: [0.2, 1.5] },
  { cell: [0.25, 0.25, 0.25, 0.25], w: [0, 1.2] },
  { cell: ['r', 0.5], w: [0.6, 0.8] },
  { cell: [2], w: [1.5, 0.2] },
];

// compound meters (6/8, 9/8, 12/8): beats divide in three
const CELLS_COMPOUND = [
  { cell: [1], w: [3, 1] },
  { cell: [1 / 3, 1 / 3, 1 / 3], w: [1, 3] },
  { cell: [2 / 3, 1 / 3], w: [2, 2] },
  { cell: [1 / 3, 2 / 3], w: [0.8, 1] },
  { cell: ['r3', 2 / 3], w: [0.5, 0.6] },
  { cell: [2], w: [1.2, 0.2] },
];

function pickCell(rng, density, beatsLeft, compound) {
  const cells = compound ? CELLS_COMPOUND : CELLS;
  const opts = cells.filter((c) => (c.cell[0] === 2 ? beatsLeft >= 2 : true)).map((c) => [c.cell, c.w[0] * (1 - density) + c.w[1] * density]);
  return rng.weighted(opts);
}

/** rhythm for one bar: [{ start, dur, rest }] relative to bar start */
export function barRhythm(song, bar, { density = 0.5, rng, grid = 240 } = {}) {
  const beat = beatTicks(song, bar);
  const bl = barLength(song, bar);
  const beats = Math.round(bl / beat);
  const out = [];
  let b = 0;
  const compound = beat === song.ppq * 1.5;
  while (b < beats) {
    const cell = pickCell(rng, density, beats - b, compound);
    let t = b * beat;
    let used = 0;
    for (const v of cell) {
      if (v === 'r' || v === 'r3') {
        const f = v === 'r' ? 0.5 : 1 / 3;
        t += Math.round((beat * f) / grid) * grid;
        used += f;
        continue;
      }
      const d = Math.max(grid, Math.round((v * beat) / grid) * grid);
      out.push({ start: t, dur: d });
      t += d;
      used += v;
    }
    b += Math.max(1, Math.round(used));
  }
  // in order, one note per start (short beats like x/16 can make cells collide), inside the bar
  const kept = out.filter((n) => n.start < bl).sort((x, y) => x.start - y.start).filter((n, i, arr) => i === 0 || n.start > arr[i - 1].start);
  // never overlap the next note or the barline
  return kept.map((n, i) => ({ ...n, dur: Math.min(n.dur, (kept[i + 1]?.start ?? bl) - n.start) })).filter((n) => n.dur > 0);
}

/**
 * Generate a melody over a song's chords.
 * opts: { key, from (bar), to (bar, exclusive), range: [lo, hi] midi, density 0..1,
 *         phrase: bars per phrase (4), form: 'sentence'|'period', scale (name), seed|rng,
 *         candidates: how many melodies to generate and keep the best (6), rules }
 * Returns notes [{start, dur, pitch, vel}] (absolute ticks).
 */
export function generateMelody(song, opts = {}) {
  const rng = asRng(opts.rng ?? opts.seed);
  const n = opts.candidates ?? 6;
  let best = null;
  for (let i = 0; i < n; i++) {
    const notes = generateOnce(song, { ...opts, rng: rng.fork('cand' + i) });
    const rep = melodyReport(song, notes, opts);
    if (!best || rep.score > best.rep.score) best = { notes, rep };
  }
  return best.notes;
}

function generateOnce(song, opts) {
  const R = { ...MELODY_RULES, ...opts.rules };
  const rng = opts.rng;
  const key = parseKey(opts.key ?? song.key ?? 'C major');
  const scaleName = opts.scale ?? (key.mode === 'major' ? 'major' : key.mode === 'minor' ? 'minor' : key.mode);
  const sc = makeScale(key.tonic, scaleName, 4);
  const [lo, hi] = opts.range ?? [60, 79];
  const from = opts.from ?? 0;
  const to = opts.to ?? song.bars;
  const phraseLen = opts.phrase ?? Math.min(4, to - from);
  const form = opts.form ?? 'sentence';
  const density = opts.density ?? 0.5;
  const notes = [];

  // rhythm plan per phrase: motif bar(s) reused
  let prev = null;
  let prevInterval = 0;
  for (let p = from; p < to; p += phraseLen) {
    const bars = Math.min(phraseLen, to - p);
    const motifRhythm = barRhythm(song, p, { density, rng });
    const contrast = barRhythm(song, p, { density: Math.min(1, density + 0.2), rng });
    const phraseIndex = Math.floor((p - from) / phraseLen);
    const isLastPhrase = p + phraseLen >= to;
    const endDegree = form === 'period' && phraseIndex % 2 === 0 && !isLastPhrase ? rng.pick([1, 4]) : 0; // half cadence: 2 or 5
    const motifPitches = [];
    for (let k = 0; k < bars; k++) {
      const bar = p + k;
      const bs = barStart(song, bar);
      const bl = barLength(song, bar);
      let rhythm;
      const last = k === bars - 1;
      if (last) {
        // cadence bar: a couple of notes then a long final note on beat 1 or 3
        const beat = beatTicks(song, bar);
        rhythm = [{ start: 0, dur: beat }, { start: beat, dur: bl - beat }];
        if (bl / beat >= 4 && rng.chance(0.5)) rhythm = [{ start: 0, dur: beat / 2 }, { start: beat / 2, dur: beat / 2 }, { start: beat, dur: beat }, { start: 2 * beat, dur: bl - 2 * beat }];
      } else if (form === 'sentence') rhythm = k === 0 || k === 1 ? motifRhythm : contrast;
      else rhythm = k % 2 === 0 ? motifRhythm : contrast;
      // meter changes: a motif from a longer bar is clipped to this bar; one from a shorter bar is fine
      if (!last && bl !== barLength(song, p)) {
        rhythm = rhythm.filter((r) => r.start < bl).map((r) => ({ ...r, dur: Math.min(r.dur, bl - r.start) }));
        if (!rhythm.length) rhythm = barRhythm(song, bar, { density, rng });
      }
      const reuseMotif = form === 'sentence' ? k === 1 : k === 2 && bars >= 4;
      rhythm.forEach((r, ri) => {
        const t = bs + r.start;
        const chord = chordAt(song, t);
        const chordPcs = chord ? safeChordPcs(chord.symbol) : null;
        const strong = r.start % beatTicks(song, bar) === 0;
        const isFinal = last && ri === rhythm.length - 1;
        // candidate pitches
        let best = [];
        for (let m = lo; m <= hi; m++) {
          if (!sc.contains(m)) continue;
          let s = 0;
          const cp = chordPcs && chordPcs.includes(mod(m, 12));
          if (strong) s += cp ? R.chordToneStrong : chordPcs ? R.nonChordStrong : 0;
          else if (cp) s += 0.5;
          if (prev !== null) {
            const iv = m - prev;
            const a = Math.abs(iv);
            if (a === 0) s += R.repeat;
            else if (a <= 2) s += R.step;
            else if (a <= 4) s += R.third;
            if (a > 5) s += (a - 5) * R.leapPenalty;
            if (a > 12) s += R.octavePlus;
            if (a === 6) s += R.tritone;
            if (Math.abs(prevInterval) > 4) {
              const back = Math.sign(iv) === -Math.sign(prevInterval) && a <= 2;
              s += back ? R.leapRecovery : R.leapNotRecovered;
            }
            if (mod(prev - key.tonicPc, 12) === 11 && mod(m - key.tonicPc, 12) === 0 && iv === 1) s += R.leadingTone;
          }
          if (m - lo < 2 || hi - m < 2) s += R.rangeEdge;
          // phrase arch: aim higher in the middle of the phrase
          const pos = (bar - p + r.start / bl) / bars;
          const target = lo + (hi - lo) * (0.35 + 0.35 * Math.sin(Math.PI * pos));
          s -= Math.abs(m - target) * 0.08;
          // motif reuse: follow the motif's interval shape
          if (reuseMotif && motifPitches[ri] !== undefined && motifPitches[ri - 1] !== undefined && prev !== null) {
            const want = motifPitches[ri] - motifPitches[ri - 1];
            if (Math.sign(m - prev) === Math.sign(want)) s += 1.2;
            if (m - prev === want) s += 1.0;
          }
          if (isFinal) {
            const deg = mod(sc.degreeOf(m), sc.size);
            s += deg === endDegree ? 8 : -6;
          }
          best.push([m, s]);
        }
        best.sort((a, b) => b[1] - a[1]);
        best = best.slice(0, 5);
        const top = best[0][1];
        const choice = rng.weighted(best.map(([m, s]) => [m, Math.exp((s - top) / Math.max(0.05, R.temperature))]));
        if (k === 0) motifPitches[ri] = choice;
        if (prev !== null) prevInterval = choice - prev;
        prev = choice;
        notes.push({ start: t, dur: r.dur, pitch: choice, vel: strong ? 100 : 88 });
      });
    }
  }
  return notes;
}

function safeChordPcs(symbol) {
  try {
    return parseChord(symbol).pcs;
  } catch {
    return null;
  }
}

/**
 * Critic: numbers that describe a melody, and an overall score (higher = more singable/coherent).
 * Returns { notes, range, stepwise, chordToneStrong, bigLeaps, unrecoveredLeaps, tritones, repeats,
 *           endsOnTonic, score, notesList }
 */
export function melodyReport(song, notes, opts = {}) {
  const key = parseKey(opts.key ?? song.key ?? 'C major');
  const sorted = notes.slice().sort((a, b) => a.start - b.start);
  if (!sorted.length) return { notes: 0, score: -Infinity };
  const ps = sorted.map((n) => n.pitch);
  let steps = 0, big = 0, unrec = 0, tri = 0, rep = 0, strongCt = 0, strongN = 0;
  for (let i = 1; i < ps.length; i++) {
    const a = Math.abs(ps[i] - ps[i - 1]);
    if (a > 0 && a <= 2) steps++;
    if (a === 0) rep++;
    if (a > 12) big++;
    if (a === 6) tri++;
    if (a > 4 && i + 1 < ps.length) {
      const nx = ps[i + 1] - ps[i];
      if (!(Math.sign(nx) === -Math.sign(ps[i] - ps[i - 1]) && Math.abs(nx) <= 2)) unrec++;
    }
  }
  for (const n of sorted) {
    const bar = barAt(song, n.start);
    if ((n.start - barStart(song, bar)) % beatTicks(song, bar) !== 0) continue;
    const c = chordAt(song, n.start);
    if (!c) continue;
    const pcs = safeChordPcs(c.symbol);
    if (!pcs) continue;
    strongN++;
    if (pcs.includes(mod(n.pitch, 12))) strongCt++;
  }
  const intervals = Math.max(1, ps.length - 1);
  const range = Math.max(...ps) - Math.min(...ps);
  const endsOnTonic = mod(ps[ps.length - 1] - key.tonicPc, 12) === 0;
  const stepwise = steps / intervals;
  const ct = strongN ? strongCt / strongN : 1;
  const score =
    3 * ct + 2 * Math.min(stepwise, 0.75) - 1.5 * (big / intervals) * 10 - 1.0 * (unrec / intervals) * 4 - 0.8 * (tri / intervals) * 5
    - Math.max(0, rep / intervals - 0.2) * 3 + (endsOnTonic ? 1 : 0) - Math.max(0, range - 16) * 0.2 - Math.max(0, 5 - range) * 0.3;
  return {
    notes: ps.length, range, stepwise: +stepwise.toFixed(3), chordToneStrong: +ct.toFixed(3), bigLeaps: big,
    unrecoveredLeaps: unrec, tritones: tri, repeats: rep, endsOnTonic, score: +score.toFixed(3),
  };
}

export { pc };
