// Harmonisation: choose chords for a melody (Viterbi over functional harmony), and write
// a counter-melody or parallel harmony line against a melody.
import { parseRoman } from '../theory/roman.mjs';
import { parseKey } from '../theory/key.mjs';
import { parseChord } from '../theory/chord.mjs';
import { makeScale } from '../theory/scale.mjs';
import { mod } from '../theory/pitch.mjs';
import { barStart, barLength, beatTicks, chordAt, barAt } from '../ir.mjs';
import { asRng } from '../rng.mjs';

const DIATONIC = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'VII'],
};
const FUNC = { I: 'T', vi: 'T', iii: 'T', IV: 'S', ii: 'S', V: 'D', 'vii°': 'D', i: 'T', VI: 'T', III: 'T', iv: 'S', 'ii°': 'S', VII: 'D', V7: 'D', bVII: 'S', 'V7/V': 'S', 'V7/vi': 'T', 'V7/ii': 'T', 'V7/IV': 'T', 'V7/iv': 'T', 'V7/VI': 'T' };
const FLOW = { T: { T: 1, S: 1.6, D: 1.3 }, S: { T: 0.6, S: 1, D: 1.8 }, D: { T: 2, S: 0.3, D: 0.8 } };

// Tweak weights
export const HARMONY_RULES = {
  melodyFit: 2.0,        // per beat of melody note that's a chord tone (weighted by duration and beat)
  nonChordStrong: -1.5,
  rootInMelody: 0.5,
  repeatSame: -0.8,
  finalTonic: 4,
  penultimateDominant: 2,
  secondaryWeight: -0.4, // small cost for secondary dominants (colour, not default)
};

/**
 * Choose chords for melody notes.
 * opts: { key, from, to (bars), perBar (1|2), secondaries (bool), sevenths (bool), seed }
 * Returns [{ start, dur, symbol, roman }] and (if write) sets song.chords.
 */
export function harmonizeMelody(song, melody, opts = {}) {
  const R = { ...HARMONY_RULES, ...opts.rules };
  const key = parseKey(opts.key ?? song.key ?? 'C major');
  const mode = key.mode === 'minor' ? 'minor' : 'major';
  const from = opts.from ?? 0;
  const to = opts.to ?? song.bars;
  const perBar = opts.perBar ?? 1;
  let cands = DIATONIC[mode].slice();
  if (mode === 'minor') cands.push('V7');
  if (opts.secondaries) cands.push('V7/V', mode === 'major' ? 'V7/vi' : 'V7/VI', mode === 'major' ? 'V7/ii' : 'V7/iv', mode === 'major' ? 'V7/IV' : 'V7/III');
  if (mode === 'major' && opts.borrowed) cands.push('bVII', 'iv');
  cands = cands.filter((r) => { try { parseRoman(r, key); return true; } catch { return false; } });
  const info = cands.map((r) => {
    const p = parseRoman(r, key);
    return { roman: r, symbol: p.symbol, pcs: p.chord.pcs, root: p.chord.pcs[0], func: FUNC[r] ?? FUNC[r.replace(/7$/, '')] ?? 'T' };
  });
  // slots
  const slots = [];
  for (let b = from; b < to; b++) {
    const bs = barStart(song, b);
    const bl = barLength(song, b);
    for (let k = 0; k < perBar; k++) slots.push({ start: bs + (k * bl) / perBar, dur: bl / perBar, bar: b });
  }
  const notesIn = (s) => melody.filter((n) => n.start < s.start + s.dur && n.start + n.dur > s.start);
  const emit = slots.map((s) =>
    info.map((c) => {
      let sc = 0;
      for (const n of notesIn(s)) {
        const overlap = Math.min(n.start + n.dur, s.start + s.dur) - Math.max(n.start, s.start);
        const w = overlap / song.ppq;
        const strong = (n.start - barStart(song, s.bar)) % beatTicks(song, s.bar) === 0 && n.start >= s.start;
        const inChord = c.pcs.includes(mod(n.pitch, 12));
        if (inChord) sc += R.melodyFit * w * (strong ? 1.5 : 1);
        else if (strong) sc += R.nonChordStrong * w;
        if (mod(n.pitch, 12) === c.root) sc += R.rootInMelody;
      }
      if (c.roman.includes('/')) sc += R.secondaryWeight;
      return sc;
    }),
  );
  // Viterbi
  const N = slots.length;
  const C = info.length;
  const score = Array.from({ length: N }, () => new Array(C).fill(-Infinity));
  const back = Array.from({ length: N }, () => new Array(C).fill(0));
  for (let c = 0; c < C; c++) score[0][c] = emit[0][c] + (info[c].func === 'T' ? 1 : 0) + (c === 0 ? 1.5 : 0);
  for (let i = 1; i < N; i++) {
    for (let c = 0; c < C; c++) {
      let best = -Infinity;
      let arg = 0;
      for (let p = 0; p < C; p++) {
        let tr = Math.log(FLOW[info[p].func][info[c].func]);
        if (p === c) tr += R.repeatSame;
        // a secondary dominant must resolve to its target
        if (info[p].roman.startsWith('V7/')) {
          const target = info[p].roman.slice(3);
          tr += info[c].roman === target ? 1.5 : -6;
        }
        const v = score[i - 1][p] + tr;
        if (v > best) {
          best = v;
          arg = p;
        }
      }
      let e = emit[i][c];
      if (i === N - 1) e += info[c].roman === DIATONIC[mode][0] ? R.finalTonic : -R.finalTonic;
      if (i === N - 2 && /^V/.test(info[c].roman) && !info[c].roman.includes('/')) e += R.penultimateDominant;
      score[i][c] = best + e;
      back[i][c] = arg;
    }
  }
  let c = score[N - 1].indexOf(Math.max(...score[N - 1]));
  const path = new Array(N);
  for (let i = N - 1; i >= 0; i--) {
    path[i] = c;
    c = back[i][c];
  }
  let out = slots.map((s, i) => ({ start: s.start, dur: s.dur, symbol: info[path[i]].symbol, roman: info[path[i]].roman }));
  if (opts.sevenths) out = out.map((ch) => addSeventh(ch, key));
  // merge repeated chords
  const merged = [];
  for (const ch of out) {
    const last = merged[merged.length - 1];
    if (last && last.symbol === ch.symbol && last.start + last.dur === ch.start) last.dur += ch.dur;
    else merged.push({ ...ch });
  }
  if (opts.write !== false) {
    song.chords = song.chords.filter((x) => x.start + x.dur <= slots[0].start || x.start >= slots[N - 1].start + slots[N - 1].dur);
    song.chords.push(...merged);
    song.chords.sort((a, b) => a.start - b.start);
  }
  return merged;
}

function addSeventh(ch, key) {
  const map = key.mode === 'minor'
    ? { i: 'i7', 'ii°': 'iiø7', III: 'IIImaj7', iv: 'iv7', V: 'V7', VI: 'VImaj7', VII: 'VII7' }
    : { I: 'Imaj7', ii: 'ii7', iii: 'iii7', IV: 'IVmaj7', V: 'V7', vi: 'vi7', 'vii°': 'viiø7' };
  const r = map[ch.roman];
  return r ? { ...ch, roman: r, symbol: parseRoman(r, key).symbol } : ch;
}

/**
 * Harmony line against a melody.
 * mode 'thirds' | 'sixths': diatonic parallel 3rds/6ths below, nudged to chord tones on beats.
 * mode 'counter': contrary-motion chord-tone line with longer notes (one per beat or half bar).
 */
export function harmonyLine(song, melody, { mode = 'thirds', key: k, range = [52, 74], seed, rng: r } = {}) {
  const rng = asRng(r ?? seed);
  const key = parseKey(k ?? song.key ?? 'C major');
  const sc = makeScale(key.tonic, key.mode === 'minor' ? 'minor' : key.mode === 'major' ? 'major' : key.mode, 4);
  const out = [];
  const clampOct = (m) => {
    while (m < range[0]) m += 12;
    while (m > range[1]) m -= 12;
    return m;
  };
  if (mode === 'thirds' || mode === 'sixths') {
    const steps = mode === 'thirds' ? -2 : -5;
    for (const n of melody) {
      let m = sc.midi(sc.degreeOf(n.pitch) + steps);
      const c = chordAt(song, n.start);
      const bar = barAt(song, n.start);
      const strong = (n.start - barStart(song, bar)) % beatTicks(song, bar) === 0;
      if (c && strong) {
        const pcs = parseChord(c.symbol).pcs;
        if (!pcs.includes(mod(m, 12))) {
          // nearest chord tone below the melody
          for (let d = 1; d <= 4; d++) {
            if (pcs.includes(mod(m - d, 12)) && m - d < n.pitch) { m -= d; break; }
            if (pcs.includes(mod(m + d, 12)) && m + d < n.pitch) { m += d; break; }
          }
        }
      }
      out.push({ start: n.start, dur: n.dur, pitch: clampOct(m), vel: Math.max(1, (n.vel ?? 96) - 12) });
    }
    return out;
  }
  if (mode === 'counter') {
    let prev = null;
    for (let b = 0; b < song.bars; b++) {
      const bs = barStart(song, b);
      const beat = beatTicks(song, b);
      const bl = barLength(song, b);
      const unit = bl >= 4 * beat ? 2 * beat : beat;
      for (let t = bs; t < bs + bl; t += unit) {
        const c = chordAt(song, t);
        if (!c) continue;
        const pcs = parseChord(c.symbol).pcs;
        const mel = melody.filter((n) => n.start < t + unit && n.start + n.dur > t);
        const melDir = mel.length > 1 ? Math.sign(mel[mel.length - 1].pitch - mel[0].pitch) : 0;
        const cands = [];
        for (let m = range[0]; m <= range[1]; m++) {
          if (!pcs.includes(mod(m, 12))) continue;
          if (mel.some((x) => Math.abs(x.pitch - m) < 3 || m > x.pitch)) continue;
          let s = 0;
          if (prev !== null) {
            const iv = m - prev;
            s -= Math.abs(iv) * 0.4;
            if (melDir && Math.sign(iv) === -melDir) s += 2; // contrary motion
            if (iv === 0) s -= 0.5;
          }
          cands.push([m, s]);
        }
        if (!cands.length) continue;
        cands.sort((a, b2) => b2[1] - a[1]);
        const pick = rng.weighted(cands.slice(0, 3).map(([m, s], i) => [m, Math.exp(s - cands[0][1]) * (i === 0 ? 2 : 1)]));
        out.push({ start: t, dur: Math.min(unit, bs + bl - t), pitch: pick, vel: 80 });
        prev = pick;
      }
    }
    return out;
  }
  throw new Error(`harmonyLine: unknown mode "${mode}"`);
}
