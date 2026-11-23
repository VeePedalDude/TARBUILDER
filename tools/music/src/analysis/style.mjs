// Style models: variable-order Markov chains trained on your own music (IR songs or GP files),
// for melodies (scale-degree intervals + rhythm), chord progressions (roman numerals) and drums.
// Models are plain JSON so they can be saved next to a corpus and reused.
import { parseKey, detectKey } from '../theory/key.mjs';
import { analyzeRoman, parseRoman } from '../theory/roman.mjs';
import { makeScale } from '../theory/scale.mjs';
import { mod } from '../theory/pitch.mjs';
import { asRng } from '../rng.mjs';
import { barStart, barLength, barAt } from '../ir.mjs';

function emptyModel(type, order) {
  return { type, order, counts: {}, starts: {}, trainedOn: 0 };
}

function bump(obj, k, n = 1) {
  obj[k] = (obj[k] ?? 0) + n;
}

/** train an order-N model on token sequences (arrays of strings) */
export function trainTokens(sequences, { order = 2, type = 'tokens', model } = {}) {
  const m = model ?? emptyModel(type, order);
  for (const seq of sequences) {
    if (!seq.length) continue;
    m.trainedOn++;
    bump(m.starts, seq.slice(0, Math.min(order, seq.length)).join('|'));
    for (let i = 0; i < seq.length; i++) {
      for (let o = 0; o <= order; o++) {
        if (i - o < 0) break;
        const ctx = seq.slice(i - o, i).join('|');
        const key = `${o}:${ctx}`;
        if (!m.counts[key]) m.counts[key] = {};
        bump(m.counts[key], seq[i]);
      }
    }
  }
  return m;
}

/** sample `length` tokens; backs off to shorter contexts when a context was never seen */
export function sampleTokens(model, { length = 16, seed, rng: r, start, temperature = 1, allow } = {}) {
  const rng = asRng(r ?? seed);
  const out = start ? start.slice() : rng.weighted(Object.entries(model.starts)).split('|');
  while (out.length < length) {
    let dist = null;
    for (let o = Math.min(model.order, out.length); o >= 0; o--) {
      const ctx = out.slice(out.length - o).join('|');
      const d = model.counts[`${o}:${ctx}`];
      if (d) {
        const entries = Object.entries(d).filter(([tok]) => !allow || allow(tok, out));
        if (entries.length) {
          dist = entries;
          break;
        }
      }
    }
    if (!dist) break;
    out.push(rng.weighted(dist.map(([tok, c]) => [tok, Math.pow(c, 1 / Math.max(0.05, temperature))])));
  }
  return out.slice(0, length);
}

// ---- melodies -----------------------------------------------------------------------------

/** melody notes -> tokens "degreeStep:durationInSixteenths" relative to the key */
export function melodyTokens(notes, key, ppq = 960) {
  const k = parseKey(key);
  const sc = makeScale(k.tonic, k.mode === 'minor' ? 'minor' : k.mode === 'major' ? 'major' : k.mode, 4);
  const sorted = notes.slice().sort((a, b) => a.start - b.start);
  const toks = [];
  let prevDeg = null;
  for (const n of sorted) {
    const deg = sc.degreeOf(n.pitch);
    const step = prevDeg === null ? `@${mod(deg, sc.size)}` : String(deg - prevDeg);
    const d = Math.max(1, Math.round(n.dur / (ppq / 4)));
    toks.push(`${step}:${d}`);
    prevDeg = deg;
  }
  return toks;
}

/**
 * Train a melody model from songs (IR). Pick the track by name/index or every pitched track.
 * opts: { order (2), track: name | index | undefined }
 */
export function trainMelodyModel(songs, opts = {}) {
  const seqs = [];
  for (const s of songs) {
    const key = s.key ?? detectKey(s.tracks.flatMap((t) => t.notes.map((n) => ({ pitch: n.pitch, dur: n.dur }))))[0].key;
    const tracks = opts.track === undefined ? s.tracks.filter((t) => t.kind !== 'drums') : [typeof opts.track === 'number' ? s.tracks[opts.track] : s.tracks.find((t) => t.name === opts.track)].filter(Boolean);
    for (const t of tracks) {
      // monophonic line: highest note per onset
      const byStart = new Map();
      for (const n of t.notes) if (!byStart.has(n.start) || byStart.get(n.start).pitch < n.pitch) byStart.set(n.start, n);
      const line = [...byStart.values()].sort((a, b) => a.start - b.start);
      if (line.length >= 4) seqs.push(melodyTokens(line, key, s.ppq));
    }
  }
  return trainTokens(seqs, { order: opts.order ?? 2, type: 'melody' });
}

/**
 * Generate a melody from a model into [{start, dur, pitch}] starting at tick `start`, in `key`,
 * kept inside `range`, filling `bars` of the song (stops at the bar end).
 */
export function generateFromMelodyModel(model, song, { key, start = 0, bars = 4, range = [60, 79], seed, rng: r, temperature = 1 } = {}) {
  const rng = asRng(r ?? seed);
  const k = parseKey(key ?? song.key ?? 'C major');
  const sc = makeScale(k.tonic, k.mode === 'minor' ? 'minor' : k.mode === 'major' ? 'major' : k.mode, 4);
  const sixteenth = song.ppq / 4;
  const startBar = barAt(song, start);
  const endTick = barStart(song, Math.min(song.bars, startBar + bars));
  const out = [];
  let deg = null;
  let t = start;
  const toks = sampleTokens(model, {
    length: 512, rng, temperature,
    allow: (tok) => {
      const [step] = tok.split(':');
      if (step.startsWith('@') || deg === null) return true;
      const m = sc.midi(deg + Number(step));
      return m >= range[0] && m <= range[1];
    },
  });
  for (const tok of toks) {
    const [step, d] = tok.split(':');
    if (step.startsWith('@')) {
      const base = Number(step.slice(1));
      deg = base;
      while (sc.midi(deg) < range[0]) deg += sc.size;
      while (sc.midi(deg) > range[1]) deg -= sc.size;
    } else deg = (deg ?? 0) + Number(step);
    let m = sc.midi(deg);
    while (m < range[0]) { deg += sc.size; m = sc.midi(deg); }
    while (m > range[1]) { deg -= sc.size; m = sc.midi(deg); }
    const dur = Math.max(1, Number(d)) * sixteenth;
    if (t >= endTick) break;
    out.push({ start: t, dur: Math.min(dur, endTick - t), pitch: m, vel: 90 });
    t += dur;
  }
  return out;
}

// ---- chord progressions ---------------------------------------------------------------------

/** train on songs' chord lists (analysed as roman numerals so keys don't matter) */
export function trainChordModel(songs, { order = 2 } = {}) {
  const seqs = [];
  for (const s of songs) {
    if (!s.chords?.length) continue;
    const key = s.key ?? 'C major';
    const romans = [];
    for (const c of s.chords) {
      try {
        const r = analyzeRoman(c.symbol, key);
        if (romans[romans.length - 1] !== r) romans.push(r);
      } catch {
        /* skip unreadable chords */
      }
    }
    if (romans.length >= 2) seqs.push(romans);
  }
  return trainTokens(seqs, { order, type: 'chords' });
}

/** romans sampled from a chord model, realised in a key: [{ roman, symbol }] */
export function generateFromChordModel(model, { key = 'C major', length = 8, seed, rng: r, temperature = 1 } = {}) {
  const rng = asRng(r ?? seed);
  const romans = sampleTokens(model, { length, rng, temperature });
  const out = [];
  for (const rn of romans) {
    try {
      out.push({ roman: rn, symbol: parseRoman(rn, key).symbol });
    } catch {
      /* a roman the parser can't read (rare analysis output): skip */
    }
  }
  return out;
}

// ---- drums ------------------------------------------------------------------------------------

/** drum bars as tokens: one token per 16th step = sorted GM numbers joined by '+', or '.' */
export function trainDrumModel(songs, { order = 4, steps = 16 } = {}) {
  const seqs = [];
  for (const s of songs) {
    for (const t of s.tracks.filter((x) => x.kind === 'drums')) {
      const seq = [];
      for (let b = 0; b < s.bars; b++) {
        const bs = barStart(s, b);
        const step = barLength(s, b) / steps;
        for (let i = 0; i < steps; i++) {
          const hits = t.notes.filter((n) => n.start >= bs + i * step && n.start < bs + (i + 1) * step).map((n) => n.pitch).sort((a, b) => a - b);
          seq.push(hits.length ? [...new Set(hits)].join('+') : '.');
        }
      }
      if (seq.length) seqs.push(seq);
    }
  }
  return { ...trainTokens(seqs, { order, type: 'drums' }), steps };
}

export function generateFromDrumModel(model, song, track, { from = 0, bars = 4, seed, rng: r, temperature = 1 } = {}) {
  const rng = asRng(r ?? seed);
  const toks = sampleTokens(model, { length: bars * model.steps, rng, temperature });
  toks.forEach((tok, i) => {
    if (tok === '.') return;
    const b = from + Math.floor(i / model.steps);
    if (b >= song.bars) return;
    const step = barLength(song, b) / model.steps;
    const t = barStart(song, b) + (i % model.steps) * step;
    for (const p of tok.split('+')) track.notes.push({ start: t, dur: step, pitch: Number(p), vel: 96 });
  });
  return track;
}
