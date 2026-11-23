// Turning tick spans into writable note values: split at barlines, then into
// whole/half/quarter/... (with single dots) that respect beat alignment.
import { barStart, barLength, beatTicks, totalTicks, toVoices, drumBeats } from '../ir.mjs';

/**
 * Split a span [pos, pos+dur) inside one bar into writable pieces.
 * pos is relative to the bar start. Returns [{ ticks, den, dots }].
 * 1. cut at the next beat if the span starts off the beat;
 * 2. fill with the largest power-of-two values that start on a multiple of themselves;
 * 3. merge a value followed by its half into a single dotted value when it starts aligned.
 * Pieces never cross the bar.
 */
export function splitSpan(pos, dur, { ppq = 960, beat = ppq, barLen } = {}) {
  if (dur <= 0) return [];
  const scale = ppq / 960;
  const units = [3840, 1920, 960, 480, 240, 120, 60].map((t) => Math.round(t * scale));
  const end = pos + dur;
  if (barLen !== undefined && end > barLen) throw new Error(`splitSpan: span ${pos}+${dur} crosses the bar (${barLen})`);
  const raw = [];
  const binary = (from, to) => {
    let p = from;
    while (p < to) {
      const v = units.find((u) => p % u === 0 && p + u <= to && !(u === units[0] && p !== 0));
      if (!v) throw new Error(`splitSpan: ${to - p} ticks at ${p} is finer than a 1/64 note (use the 1/32 grid)`);
      raw.push([p, v]);
      p += v;
    }
  };
  let p = pos;
  if (p % beat !== 0) {
    const segEnd = Math.min(end, Math.ceil(p / beat) * beat);
    binary(p, segEnd);
    p = segEnd;
  }
  binary(p, end);
  // merge into dotted values
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const [pa, a] = raw[i];
    const next = raw[i + 1];
    if (next && next[1] * 2 === a && pa % a === 0 && a >= units[4] && a < units[0]) {
      out.push({ ticks: a + next[1], den: Math.round((3840 * scale) / a), dots: 1 });
      i++;
    } else {
      out.push({ ticks: a, den: Math.round((3840 * scale) / a), dots: 0 });
    }
  }
  return out;
}

/**
 * Lay out one voice (a list of beats {start, dur, notes}) as bars of items:
 * bars[b] = [{ kind: 'note'|'rest', ticks, den, dots, notes, tieIn, first }]
 *  - tieIn: this item continues the previous item's notes (write ties)
 *  - first: first piece of the original beat (put effects/lyrics/chord names here)
 */
export function layoutVoice(song, beats, cuts = [], regions = []) {
  // cuts (chord-name positions) inside a tuplet region only count on leaf boundaries
  const insideOffLeaf = (c) => regions.some((r) => c > r.start && c < r.start + r.dur && !r.leaves.some((lf) => lf.start === c));
  const cutList = [...new Set([...cuts.filter((c) => !insideOffLeaf(c)), ...regions.flatMap((r) => [r.start, r.start + r.dur])])].sort((a, b) => a - b);
  // a span inside a tuplet region is written leaf by leaf with that leaf's tuplet notation
  const regionOf = (a) => regions.find((r) => a >= r.start && a < r.start + r.dur);
  const pieces = (a, z, bs, opts) => {
    const r = regionOf(a);
    if (!r) return splitSpan(a - bs, z - a, opts);
    const out = r.leaves.filter((lf) => lf.start >= a && lf.start < z).map((lf) => ({ ticks: lf.ticks, den: lf.den, dots: lf.dots, tu: lf.n !== lf.m ? { n: lf.n, m: lf.m } : null }));
    const sum = out.reduce((x, o) => x + o.ticks, 0);
    if (sum !== z - a) throw new Error(`Span ${a}-${z} doesn't fall on tuplet leaves of the region at ${r.start}`);
    return out;
  };
  const subspans = (from, to) => {
    const pts = [from, ...cutList.filter((c) => c > from && c < to), to];
    return pts.slice(0, -1).map((p, i) => [p, pts[i + 1]]);
  };
  const ppq = song.ppq;
  const bars = [];
  const sorted = beats.slice().sort((a, b) => a.start - b.start);
  let bi = 0;
  for (let b = 0; b < song.bars; b++) {
    const bs = barStart(song, b);
    const bl = barLength(song, b);
    const be = bs + bl;
    const beat = beatTicks(song, b);
    const items = [];
    let cursor = bs;
    const pushRest = (from, to) => {
      for (const [a, z] of subspans(from, to)) {
        for (const piece of pieces(a, z, bs, { ppq, beat, barLen: bl })) items.push({ kind: 'rest', ...piece });
      }
    };
    // beats that started in an earlier bar and continue into this one
    for (let i = Math.max(0, bi - 1); i < sorted.length; i++) {
      const bt = sorted[i];
      const s = bt.start;
      const e = bt.start + bt.dur;
      if (e <= bs) continue;
      if (s >= be) break;
      const from = Math.max(s, bs);
      const to = Math.min(e, be);
      if (from < cursor) continue; // already handled (overlap protection)
      if (from > cursor) pushRest(cursor, from);
      let k = 0;
      for (const [a, z] of subspans(from, to)) {
        for (const piece of pieces(a, z, bs, { ppq, beat, barLen: bl })) {
          items.push({ kind: 'note', ...piece, notes: bt.notes, beat: bt, tieIn: s < from || k > 0, first: s === from && k === 0 });
          k++;
        }
      }
      cursor = to;
    }
    if (cursor < be) pushRest(cursor, be);
    while (bi < sorted.length && sorted[bi].start + sorted[bi].dur <= be) bi++;
    bars.push(items);
  }
  return bars;
}

/** voices for any track kind, already laid out into bars */
export function trackLayout(song, track, cuts = []) {
  let layouts;
  const regions = track.tuplets ?? [];
  if (track.kind === 'drums') layouts = [layoutVoice(song, drumBeats(track, song), cuts, regions)];
  else {
    const voices = toVoices(track);
    layouts = voices.length ? voices.map((v, i) => layoutVoice(song, v, i === 0 ? cuts : [], regions)) : [layoutVoice(song, [], cuts, regions)];
  }
  // mark items whose notes continue into the next item (tie start), across barlines too
  for (const bars of layouts) {
    const flat = bars.flat();
    for (let i = 0; i < flat.length - 1; i++) {
      if (flat[i].kind === 'note' && flat[i + 1].kind === 'note' && flat[i + 1].tieIn) flat[i]._tieOut = true;
    }
    // tuplet runs: consecutive items in one bar with the same n:m share a bracket
    const same = (a, b) => a?.tu && b?.tu && a.tu.n === b.tu.n && a.tu.m === b.tu.m;
    for (const items of bars) {
      items.forEach((it, i) => {
        if (!it.tu) return;
        if (!same(items[i - 1], it)) it._tuStart = true;
        if (!same(it, items[i + 1])) it._tuStop = true;
      });
    }
  }
  return layouts;
}

export { totalTicks };
