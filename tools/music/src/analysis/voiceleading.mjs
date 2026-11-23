// Four-part (SATB) voice-leading: a rule checker, and a chorale harmoniser that writes parts
// for a roman-numeral progression with the checker as its cost function.
import { parseRoman } from '../theory/roman.mjs';
import { parseKey } from '../theory/key.mjs';
import { mod, pc } from '../theory/pitch.mjs';

// Typical choral ranges (midi). Tweak for your choir.
export const SATB_RANGES = {
  S: [60, 79], // C4-G5
  A: [55, 74], // G3-D5
  T: [48, 67], // C3-G4
  B: [40, 60], // E2-C4
};
const NAMES = ['S', 'A', 'T', 'B'];
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

const ic = (a, b) => mod(Math.abs(a - b), 12);
const isPerfect = (a, b) => ic(a, b) === 0 || ic(a, b) === 7;

/**
 * Check SATB voicing. chords: [[S, A, T, B], ...] midi (one entry per chord).
 * opts: { key, romans (to know chord function: leading tone, 7ths), ranges }
 * Returns [{ level: 'error'|'warning', rule, at: index, voices, message }]
 */
export function checkVoiceLeading(chords, opts = {}) {
  const out = [];
  const R = opts.ranges ?? SATB_RANGES;
  const key = opts.key ? parseKey(opts.key) : null;
  const add = (level, rule, at, voices, message) => out.push({ level, rule, at, voices, message });
  const info = opts.info ?? (opts.romans && key ? opts.romans.map((r) => parseRoman(r, key)) : null);

  chords.forEach((c, i) => {
    if (c.length !== 4) throw new Error(`Chord ${i} must have 4 voices [S, A, T, B]`);
    c.forEach((p, v) => {
      const [lo, hi] = R[NAMES[v]];
      if (p < lo || p > hi) add('error', 'range', i, [v], `${NAMES[v]} ${p} outside ${lo}-${hi}`);
    });
    for (let v = 0; v < 3; v++) if (c[v] < c[v + 1]) add('error', 'crossing', i, [v, v + 1], `${NAMES[v]} below ${NAMES[v + 1]}`);
    if (c[0] - c[1] > 12) add('error', 'spacing', i, [0, 1], 'S-A more than an octave apart');
    if (c[1] - c[2] > 12) add('error', 'spacing', i, [1, 2], 'A-T more than an octave apart');
    if (c[2] - c[3] > 19) add('warning', 'spacing', i, [2, 3], 'T-B more than a twelfth apart');
    if (info) {
      const ch = info[i].chord;
      const pcs = c.map((p) => mod(p, 12));
      for (const p of pcs) if (!ch.pcs.includes(p)) add('error', 'chord-tone', i, [pcs.indexOf(p)], `${p} is not in ${info[i].symbol}`);
      const third = ch.intervals.findIndex((iv) => iv.num === 3);
      if (third >= 0 && !pcs.includes(ch.pcs[third])) add('error', 'missing-third', i, [], `${info[i].symbol} has no third`);
      const expectBass = info[i].bass ? pc(info[i].bass) : ch.pcs[0];
      if (pcs[3] !== expectBass) add('error', 'bass', i, [3], `bass should be ${expectBass} for ${info[i].roman}`);
      const lt = mod(key.tonicPc - 1, 12);
      if (/^(V|vii)/.test(info[i].roman.replace(/^[b#]/, '')) && !info[i].roman.includes('/') && pcs.filter((p) => p === lt).length > 1) add('error', 'doubled-leading-tone', i, [], 'leading tone doubled');
    }
    if (i === 0) return;
    const p = chords[i - 1];
    for (const [a, b] of PAIRS) {
      const movedA = c[a] !== p[a];
      const movedB = c[b] !== p[b];
      if (!movedA && !movedB) continue;
      if (isPerfect(p[a], p[b]) && isPerfect(c[a], c[b]) && ic(p[a], p[b]) === ic(c[a], c[b])) {
        const same = Math.sign(c[a] - p[a]) === Math.sign(c[b] - p[b]);
        const kind = ic(c[a], c[b]) === 7 ? 'fifths' : 'octaves';
        if (movedA && movedB) {
          if (same) add('error', `parallel-${kind}`, i, [a, b], `parallel ${kind} ${NAMES[a]}-${NAMES[b]}`);
          else add('warning', `contrary-${kind}`, i, [a, b], `${kind} by contrary motion ${NAMES[a]}-${NAMES[b]}`);
        }
      }
      // direct (hidden) perfects in the outer voices: similar motion into a perfect interval with a soprano leap
      if (a === 0 && b === 3 && isPerfect(c[0], c[3]) && !isPerfect(p[0], p[3])) {
        const same = Math.sign(c[0] - p[0]) === Math.sign(c[3] - p[3]) && c[0] !== p[0];
        if (same && Math.abs(c[0] - p[0]) > 2) add('warning', 'direct-perfect', i, [0, 3], 'direct (hidden) perfect interval in outer voices with a soprano leap');
      }
    }
    // overlap: a voice moves past where its neighbour just was
    for (let v = 0; v < 3; v++) {
      if (c[v + 1] > p[v]) add('warning', 'overlap', i, [v, v + 1], `${NAMES[v + 1]} moves above the previous ${NAMES[v]}`);
      if (c[v] < p[v + 1]) add('warning', 'overlap', i, [v, v + 1], `${NAMES[v]} moves below the previous ${NAMES[v + 1]}`);
    }
    for (let v = 0; v < 4; v++) {
      const leap = Math.abs(c[v] - p[v]);
      if (leap > 12) add('error', 'leap', i, [v], `${NAMES[v]} leaps more than an octave`);
      else if (v < 3 && leap > 7 && leap !== 12) add('warning', 'leap', i, [v], `${NAMES[v]} leaps ${leap} semitones`);
      if (leap === 6) add('warning', 'tritone-leap', i, [v], `${NAMES[v]} leaps a tritone`);
    }
    if (info && key) {
      const lt = mod(key.tonicPc - 1, 12);
      const prevR = info[i - 1].roman.replace(/^[b#]/, '');
      const nowR = info[i].roman;
      const toTonic = /^(I|i)(?![IVv])/.test(nowR);
      if (/^(V|vii)/.test(prevR) && !info[i - 1].roman.includes('/') && toTonic) {
        for (let v = 0; v < 4; v++) {
          if (mod(p[v], 12) === lt && c[v] !== p[v] + 1) {
            const lvl = v === 0 ? 'error' : 'warning';
            add(lvl, 'leading-tone', i, [v], `${NAMES[v]} leading tone doesn't resolve up to the tonic`);
          }
        }
      }
      // chord sevenths resolve down by step
      const prevChord = info[i - 1].chord;
      const sevIdx = prevChord.intervals.findIndex((iv) => iv.num === 7);
      if (sevIdx >= 0) {
        const sevPc = prevChord.pcs[sevIdx];
        for (let v = 0; v < 4; v++) {
          if (mod(p[v], 12) === sevPc && !(c[v] < p[v] && p[v] - c[v] <= 2) && c[v] !== p[v]) add('warning', 'seventh', i, [v], `${NAMES[v]} chordal 7th should resolve down by step`);
        }
      }
    }
  });
  return out;
}

/**
 * Write four parts for a roman-numeral progression (beam search with the checker as cost).
 * opts: { key, soprano: optional fixed soprano line (midi[]), beam: 200 }
 * Returns { chords: [[S,A,T,B]...], issues }
 */
export function harmonizeSATB(romans, opts = {}) {
  const key = parseKey(opts.key ?? 'C major');
  const info = romans.map((r) => parseRoman(r, key));
  const R = opts.ranges ?? SATB_RANGES;
  const cand = info.map((inf, i) => {
    const ch = inf.chord;
    const bassPc = inf.bass ? pc(inf.bass) : ch.pcs[0];
    const third = ch.intervals.findIndex((iv) => iv.num === 3);
    const fifth = ch.intervals.findIndex((iv) => iv.num === 5);
    const list = [];
    const within = (v) => {
      const out = [];
      for (let m = R[NAMES[v]][0]; m <= R[NAMES[v]][1]; m++) if (ch.pcs.includes(mod(m, 12))) out.push(m);
      return out;
    };
    const Ss = opts.soprano ? [opts.soprano[i]] : within(0);
    const As = within(1);
    const Ts = within(2);
    const Bs = within(3).filter((m) => mod(m, 12) === bassPc);
    for (const s of Ss) for (const a of As) for (const t of Ts) for (const b of Bs) {
      if (!(s >= a && a >= t && t >= b) || s - a > 12 || a - t > 12 || t - b > 19) continue;
      const pcs = [s, a, t, b].map((m) => mod(m, 12));
      if (third >= 0 && !pcs.includes(ch.pcs[third])) continue;
      if (ch.pcs.length >= 4 && !ch.pcs.every((p, k) => k === fifth || pcs.includes(p))) continue;
      const lt = mod(key.tonicPc - 1, 12);
      if (/^(V|vii)/.test(inf.roman) && pcs.filter((p) => p === lt).length > 1) continue;
      // doubling preference: root doubled for root-position triads
      let cost = 0;
      const counts = {};
      for (const p of pcs) counts[p] = (counts[p] ?? 0) + 1;
      if (ch.pcs.length === 3 && !inf.inversion && (counts[ch.pcs[0]] ?? 0) < 2) cost += 1;
      if (third >= 0 && (counts[ch.pcs[third]] ?? 0) > 1 && /^[IV]/.test(inf.roman)) cost += 1.5;
      list.push({ v: [s, a, t, b], cost });
    }
    if (!list.length) throw new Error(`No SATB voicing for ${inf.roman} (${inf.symbol}) within ranges`);
    return list;
  });
  const beamW = opts.beam ?? 200;
  let beam = cand[0].map((c) => ({ cost: c.cost + Math.abs(c.v[0] - 70) * 0.05, path: [c.v] }));
  for (let i = 1; i < cand.length; i++) {
    const next = [];
    for (const st of beam) {
      const prev = st.path[st.path.length - 1];
      for (const c of cand[i]) {
        const pair = [prev, c.v];
        const iss = checkVoiceLeading(pair, { key, info: [info[i - 1], info[i]] }).filter((x) => x.at === 1);
        let cost = st.cost + c.cost;
        for (const x of iss) cost += x.level === 'error' ? 100 : 4;
        // smoothness: inner voices move little, soprano mostly by step
        for (let v = 0; v < 4; v++) cost += Math.abs(c.v[v] - prev[v]) * (v === 3 ? 0.15 : v === 0 ? 0.3 : 0.4);
        next.push({ cost, path: [...st.path, c.v] });
      }
    }
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, beamW);
  }
  const best = beam[0].path;
  return { chords: best, issues: checkVoiceLeading(best, { key, romans }) };
}

/** SATB chords -> four song tracks (one chord per `dur` ticks) */
export function satbToTracks(song, chords, { start = 0, dur = 960, names = ['Soprano', 'Alto', 'Tenor', 'Bass'], program = 52 } = {}) {
  const tracks = names.map((name) => ({ name, kind: 'pitched', program, tuning: null, maxFret: 22, notes: [] }));
  chords.forEach((c, i) => c.forEach((p, v) => tracks[v].notes.push({ start: start + i * dur, dur, pitch: p, vel: 85 })));
  // tie repeated notes into longer ones
  for (const t of tracks) {
    const merged = [];
    for (const n of t.notes) {
      const last = merged[merged.length - 1];
      if (last && last.pitch === n.pitch && last.start + last.dur === n.start) last.dur += n.dur;
      else merged.push({ ...n });
    }
    t.notes = merged;
  }
  song.tracks.push(...tracks);
  return tracks;
}
