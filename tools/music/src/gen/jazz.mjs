// Jazz tools: chord-scale choices, guide-tone lines, and bebop-style eighth-note lines over changes.
import { parseChord } from '../theory/chord.mjs';
import { scalePcs } from '../theory/scale.mjs';
import { noteName, pc, mod } from '../theory/pitch.mjs';
import { barAt, beatTicks, barStart } from '../ir.mjs';
import { asRng } from '../rng.mjs';

/**
 * Chord-scale theory: the usual scale for a chord symbol, plus its avoid notes.
 * context: { nextSymbol } helps pick altered/b9 scales for dominants resolving to minor.
 */
export function chordScale(symbol, { nextSymbol } = {}) {
  const c = parseChord(symbol);
  const n = new Set(c.names);
  const r = noteName(c.root);
  let name;
  if (n.has('m3') && n.has('d5') && n.has('d7')) name = 'diminished wh';
  else if (n.has('m3') && n.has('d5') && n.has('m7')) name = n.has('M9') ? 'locrian #2' : 'locrian';
  else if (n.has('m3') && n.has('M7')) name = 'melodic minor';
  else if (n.has('m3') && n.has('m6')) name = 'aeolian';
  else if (n.has('m3') && n.has('m7')) name = n.has('m9') ? 'phrygian' : 'dorian';
  else if (n.has('m3')) name = 'dorian';
  else if (n.has('M3') && n.has('m7')) {
    const toMinor = nextSymbol && parseChord(nextSymbol).names.includes('m3');
    if (n.has('A9') && (n.has('m9') || n.has('m13'))) name = 'altered';
    else if (n.has('A11')) name = 'lydian dominant';
    else if (n.has('m9') || toMinor) name = 'phrygian dominant';
    else if (n.has('A5') || n.has('m13')) name = 'whole tone';
    else name = 'mixolydian';
  } else if (n.has('P4') && n.has('m7')) name = 'mixolydian';
  else if (n.has('M3') && n.has('M7')) name = n.has('A11') ? 'lydian' : 'major';
  else if (n.has('M3') && n.has('A5')) name = 'whole tone';
  else name = 'major';
  const pcs = scalePcs(c.root, name);
  // avoid notes: a semitone above a chord tone (classic: the 4th over major, b9 over minor 7 etc.)
  const avoid = pcs.filter((p) => !c.pcs.includes(p) && c.pcs.some((q) => mod(p - q, 12) === 1));
  return { scale: name, root: r, pcs, avoid };
}

/**
 * Guide tones: 3rds and 7ths moving by the smallest step chord to chord.
 * Returns [{ start, dur, pitch }] one note per chord (or two per chord with `perChord: 2`).
 */
export function guideToneLine(chords, { start = 64, range = [55, 76], perChord = 1 } = {}) {
  let prev = start;
  const out = [];
  for (const ch of chords) {
    const c = parseChord(ch.symbol);
    let tones = c.intervals.filter((iv) => [3, 7, 6].includes(((iv.num - 1) % 7) + 1)).map((iv) => mod(pc(c.root) + iv.semis, 12));
    // triads have no 7th: use the 3rd and 5th (then the root) so there are two guide tones
    for (const num of [5, 1]) {
      if (new Set(tones).size >= 2) break;
      const iv = c.intervals.find((x) => x.num === num);
      if (iv) tones.push(mod(pc(c.root) + iv.semis, 12));
    }
    tones = [...new Set(tones)];
    const pick = (avoid) => {
      let best = null;
      for (let m = range[0]; m <= range[1]; m++) {
        if (!tones.includes(mod(m, 12)) || m === avoid) continue;
        if (best === null || Math.abs(m - prev) < Math.abs(best - prev)) best = m;
      }
      return best ?? prev;
    };
    if (perChord === 2) {
      const a = pick();
      prev = a;
      const b = pick(a);
      out.push({ start: ch.start, dur: ch.dur / 2, pitch: a, vel: 85 }, { start: ch.start + ch.dur / 2, dur: ch.dur / 2, pitch: b, vel: 80 });
      prev = b;
    } else {
      const a = pick();
      out.push({ start: ch.start, dur: ch.dur, pitch: a, vel: 85 });
      prev = a;
    }
  }
  return out;
}

/**
 * Bebop line: continuous eighths, chord tones on the beats, scale/chromatic passing tones off the beat,
 * enclosures (above, below, target) into chord tones on chord changes.
 * opts: { range, seed, restProb (gaps between phrases), start }
 */
export function bebopLine(song, chords, opts = {}) {
  const rng = asRng(opts.rng ?? opts.seed);
  const [lo, hi] = opts.range ?? [58, 82];
  const restProb = opts.restProb ?? 0.12;
  const out = [];
  let prev = opts.start ?? Math.round((lo + hi) / 2);
  let dir = rng.pick([-1, 1]);
  for (let ci = 0; ci < chords.length; ci++) {
    const ch = chords[ci];
    const next = chords[ci + 1];
    const c = parseChord(ch.symbol);
    const cs = chordScale(ch.symbol, { nextSymbol: next?.symbol });
    const bar = barAt(song, ch.start);
    const beat = beatTicks(song, bar);
    const eighth = beat === song.ppq * 1.5 ? song.ppq / 2 : beat / 2;
    for (let t = ch.start; t < ch.start + ch.dur; t += eighth) {
      const onBeat = (t - barStart(song, barAt(song, t))) % beat === 0;
      if (onBeat && rng.chance(restProb) && t !== ch.start) {
        t += eighth; // a short breath (skip this beat)
        continue;
      }
      const isChange = t === ch.start;
      let p;
      if (onBeat) {
        // nearest chord tone in the current direction
        const targets = [];
        for (let m = lo; m <= hi; m++) if (c.pcs.includes(mod(m, 12))) targets.push(m);
        const ahead = targets.filter((m) => Math.sign(m - prev) === dir && Math.abs(m - prev) <= 4);
        p = ahead.length ? ahead[0 + (dir < 0 ? ahead.length - 1 : 0)] : targets.reduce((a, m) => (Math.abs(m - prev) < Math.abs(a - prev) ? m : a), targets[0]);
        if (isChange && out.length >= 2 && rng.chance(0.4)) {
          // turn the last two notes into an enclosure of p: scale step above, chromatic below
          const above = [...Array(4).keys()].map((k) => p + 1 + k).find((m) => cs.pcs.includes(mod(m, 12))) ?? p + 2;
          out[out.length - 2].pitch = Math.min(hi, above);
          out[out.length - 1].pitch = Math.max(lo, p - 1);
        }
      } else {
        // passing tone: scale step in the direction; chromatic if it lands the next beat on a chord tone
        const step = [...Array(3).keys()].map((k) => prev + dir * (k + 1)).find((m) => cs.pcs.includes(mod(m, 12)));
        p = step ?? prev + dir;
        if (rng.chance(0.25)) p = prev + dir; // chromatic
      }
      if (p >= hi - 1) dir = -1;
      if (p <= lo + 1) dir = 1;
      if (rng.chance(0.12)) dir = -dir;
      p = Math.max(lo, Math.min(hi, p));
      out.push({ start: t, dur: eighth, pitch: p, vel: onBeat ? 92 : 78 });
      prev = p;
    }
  }
  // no repeated pitch on consecutive eighths: nudge by a semitone toward the direction
  for (let i = 1; i < out.length; i++) if (out[i].pitch === out[i - 1].pitch && out[i].start === out[i - 1].start + out[i - 1].dur) out[i].pitch += out[i].pitch < hi ? 1 : -1;
  return out;
}
