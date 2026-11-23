// Guitar riff generators. All output is pre-fingered (string/fret set) for the track's tuning.
import { makeScale } from '../theory/scale.mjs';
import { parseKey } from '../theory/key.mjs';
import { midi, pc, mod } from '../theory/pitch.mjs';
import { barStart, barLength, beatTicks } from '../ir.mjs';
import { asRng } from '../rng.mjs';

const openMidi = (track) => track.tuning.map((t) => midi(t));

function place(track, pitch, { prefer = 'low', near } = {}) {
  const open = openMidi(track);
  const opts = [];
  open.forEach((o, i) => {
    const f = pitch - o;
    if (f >= 0 && f <= (track.maxFret ?? 22)) opts.push({ string: i + 1, fret: f });
  });
  if (!opts.length) throw new Error(`Pitch ${pitch} not playable on this tuning`);
  if (near !== undefined) opts.sort((a, b) => Math.abs(a.fret - near) - Math.abs(b.fret - near));
  else if (prefer === 'low') opts.sort((a, b) => a.fret - b.fret);
  return opts[0];
}

/**
 * Pedal-tone riff: alternate the open low string (or a pedal note) with scale notes above it.
 * opts: { from, to (bars), key, scale, pattern: e.g. 'p.n.p.n.' (p = pedal, n = melody note), seed }
 */
export function pedalRiff(song, track, opts = {}) {
  const rng = asRng(opts.rng ?? opts.seed);
  const key = parseKey(opts.key ?? song.key ?? 'E minor');
  const sc = makeScale(key.tonic, opts.scale ?? (key.mode === 'minor' ? 'minor' : key.mode), 3);
  const open = openMidi(track);
  const lowest = Math.min(...open);
  let pedal = lowest;
  while (mod(pedal, 12) !== key.tonicPc) pedal++;
  const pattern = opts.pattern ?? 'pnpnpnpn';
  const out = [];
  let deg = 0;
  for (let b = opts.from ?? 0; b < (opts.to ?? song.bars); b++) {
    const bs = barStart(song, b);
    const step = barLength(song, b) / pattern.length;
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === '.') continue;
      const t = bs + i * step;
      if (ch === 'p') {
        const pos = place(track, pedal);
        out.push({ start: t, dur: step, pitch: pedal, vel: 100, fx: { pm: true }, ...pos });
      } else {
        deg = Math.max(2, Math.min(9, deg + rng.pick([-2, -1, 1, 1, 2]) || 3));
        let m = sc.midi(deg) + 12;
        while (m <= pedal + 4) m += 12;
        const pos = place(track, m, { near: 7 });
        out.push({ start: t, dur: step, pitch: m, vel: 96, ...pos });
      }
    }
  }
  track.notes.push(...out);
  return out;
}

// rhythm cells for power-chord riffs, in 16ths over one beat: x = hit, - = hold, . = rest, m = muted chug
const CHUG_CELLS = ['x---', 'x.x.', 'm.m.', 'mmx.', 'x.mm', 'mxm.', 'x--x', '.x.x', 'mmmm'];

/**
 * Power-chord riff on scale-degree roots (default i bVI bVII style for minor).
 * opts: { from, to, key, degrees: [0, 5, 6, 4], cellsPerBar, seed, octave: true }
 */
export function powerRiff(song, track, opts = {}) {
  const rng = asRng(opts.rng ?? opts.seed);
  const key = parseKey(opts.key ?? song.key ?? 'E minor');
  const sc = makeScale(key.tonic, key.mode === 'minor' ? 'minor' : key.mode, 2);
  const open = openMidi(track);
  const lowest = Math.min(...open);
  const degrees = opts.degrees ?? (key.mode === 'minor' ? [0, 0, 5, 6] : [0, 4, 5, 3]);
  const cells = Array.from({ length: 4 }, () => rng.pick(CHUG_CELLS));
  const out = [];
  const shapeAt = (root) => {
    // root on the lowest string that fits within fret 12, fifth on the next string
    for (let s = open.length - 1; s >= 1; s--) {
      const f = root - open[s];
      const f5 = root + 7 - open[s - 1];
      if (f >= 0 && f <= 12 && f5 >= 0 && Math.abs(f5 - f) <= 3) return [{ string: s + 1, fret: f, pitch: root }, { string: s, fret: f5, pitch: root + 7 }];
    }
    throw new Error(`No power chord for ${root}`);
  };
  let k = 0;
  for (let b = opts.from ?? 0; b < (opts.to ?? song.bars); b++) {
    const bs = barStart(song, b);
    const beat = beatTicks(song, b);
    const beats = Math.round(barLength(song, b) / beat);
    const deg = degrees[k++ % degrees.length];
    let root = sc.midi(deg);
    while (root < lowest) root += 12;
    while (root - lowest > 12) root -= 12;
    const shape = shapeAt(root);
    for (let bt = 0; bt < beats; bt++) {
      const cell = cells[bt % cells.length];
      const six = beat / cell.length;
      for (let i = 0; i < cell.length; i++) {
        const ch = cell[i];
        if (ch === '.' || ch === '-') continue;
        let hold = 1;
        while (cell[i + hold] === '-') hold++;
        const t = bs + bt * beat + i * six;
        if (ch === 'm') out.push({ start: t, dur: six * hold, pitch: shape[0].pitch, vel: 92, fx: { pm: true }, string: shape[0].string, fret: shape[0].fret });
        else for (const n of shape) out.push({ start: t, dur: six * hold, pitch: n.pitch, vel: 110, string: n.string, fret: n.fret });
      }
    }
  }
  track.notes.push(...out);
  return out;
}

/**
 * Scale run, three notes per string, with hammer-ons (legato) — 16ths.
 * opts: { from (tick), notes (count), key, scale, startString (6), startFret, direction 'up'|'down' }
 */
export function legatoRun(song, track, opts = {}) {
  const key = parseKey(opts.key ?? song.key ?? 'A minor');
  const scName = opts.scale ?? (key.mode === 'minor' ? 'minor' : key.mode);
  const open = openMidi(track);
  const startString = opts.startString ?? open.length;
  const sc = makeScale(key.tonic, scName, 2);
  let deg = sc.degreeOf(open[startString - 1] + (opts.startFret ?? 5));
  const dir = opts.direction === 'down' ? -1 : 1;
  const count = opts.notes ?? 12;
  const six = song.ppq / 4;
  let t = opts.from ?? 0;
  let s = startString;
  const out = [];
  for (let i = 0; i < count; i++) {
    const m = sc.midi(deg);
    let f = m - open[s - 1];
    if (f < 0 || f > (track.maxFret ?? 22)) break;
    const posInString = i % 3;
    out.push({ start: t, dur: six, pitch: m, vel: posInString === 0 ? 100 : 80, string: s, fret: f, fx: posInString < 2 ? { h: true } : undefined });
    t += six;
    deg += dir;
    if (posInString === 2) {
      s -= dir; // up the scale = towards string 1
      if (s < 1 || s > open.length) break;
    }
  }
  for (const n of out) if (!n.fx) delete n.fx;
  track.notes.push(...out);
  return out;
}

/**
 * Pentatonic lick in a box position: random walk in the box, ends on the root.
 * opts: { from (tick), beats (4), key, box (1..5), seed }
 */
export function pentatonicLick(song, track, opts = {}) {
  const rng = asRng(opts.rng ?? opts.seed);
  const key = parseKey(opts.key ?? song.key ?? 'A minor');
  const scName = key.mode === 'major' ? 'major pentatonic' : 'minor pentatonic';
  const open = openMidi(track);
  const sc = makeScale(key.tonic, scName, 2);
  let rootFret = mod(key.tonicPc - mod(open[open.length - 1], 12), 12);
  if (rootFret < 3) rootFret += 12;
  const box = opts.box ?? 1;
  const lo = rootFret + [0, 2, 4, 7, 9][(box - 1) % 5] - 1;
  const hi = lo + 4;
  const cands = [];
  for (let s = 1; s <= open.length; s++) for (let f = lo; f <= hi; f++) if (sc.contains(open[s - 1] + f)) cands.push({ string: s, fret: f, pitch: open[s - 1] + f });
  cands.sort((a, b) => a.pitch - b.pitch);
  const beats = opts.beats ?? 4;
  const unit = song.ppq / 2;
  let t = opts.from ?? 0;
  let idx = Math.floor(cands.length * 0.7);
  const out = [];
  const total = (beats * song.ppq) / unit;
  for (let i = 0; i < total; i++) {
    const last = i === total - 1;
    if (last) {
      const roots = cands.filter((c) => mod(c.pitch, 12) === key.tonicPc);
      const r = roots.reduce((a, c) => (Math.abs(c.pitch - cands[idx].pitch) < Math.abs(a.pitch - cands[idx].pitch) ? c : a), roots[0]);
      out.push({ start: t, dur: unit, pitch: r.pitch, vel: 100, string: r.string, fret: r.fret, fx: { v: true } });
      break;
    }
    idx = Math.max(0, Math.min(cands.length - 1, idx + rng.pick([-2, -1, -1, 1, 1, 2])));
    const c = cands[idx];
    const fx = rng.chance(0.15) ? { b: [0, 4] } : undefined;
    out.push({ start: t, dur: unit, pitch: c.pitch, vel: 92, string: c.string, fret: c.fret, ...(fx ? { fx } : {}) });
    t += unit;
  }
  track.notes.push(...out);
  return out;
}

export { pc };
