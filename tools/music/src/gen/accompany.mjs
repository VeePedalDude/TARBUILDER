// Accompaniment from song.chords: bass lines and comping (guitar strums, power chords,
// arpeggios, skanks, pads, jazz comping). Everything is chord-driven so it follows any progression.
import { parseChord, voiceLead } from '../theory/chord.mjs';
import { parseKey } from '../theory/key.mjs';
import { makeScale } from '../theory/scale.mjs';
import { midi, pc, mod } from '../theory/pitch.mjs';
import { barStart, barLength, beatTicks, barAt } from '../ir.mjs';
import { chordShapes, powerChord } from './voicing.mjs';
import { asRng } from '../rng.mjs';

function chordsBetween(song, from, to) {
  const a = barStart(song, from);
  const z = barStart(song, to);
  return song.chords.filter((c) => c.start < z && c.start + c.dur > a).map((c) => ({ ...c, start: Math.max(c.start, a), end: Math.min(c.start + c.dur, z) }));
}

function lowestIn(pcNum, lo) {
  let m = lo;
  while (mod(m, 12) !== pcNum) m++;
  return m;
}

// ---- bass --------------------------------------------------------------------------

/**
 * styles: 'root' (one note per chord), 'eighths', 'root-fifth', 'octaves', 'walking', 'syncopated', 'arpeggio'
 * opts: { from, to (bars), style, low (midi, 28 = E1), high, energy, seed }
 */
export function bassLine(song, track, opts = {}) {
  const style = opts.style ?? 'root';
  const rng = asRng(opts.rng ?? opts.seed);
  const lo = opts.low ?? (track.tuning ? Math.min(...track.tuning.map((t) => midi(t))) : 28);
  const hi = opts.high ?? lo + 19;
  const key = parseKey(song.key ?? 'C major');
  const sc = makeScale(key.tonic, key.mode === 'minor' ? 'minor' : key.mode === 'major' ? 'major' : key.mode, 2);
  const chords = chordsBetween(song, opts.from ?? 0, opts.to ?? song.bars);
  const out = [];
  const push = (start, dur, pitch, vel = 100, fx) => {
    let p = pitch;
    while (p < lo) p += 12;
    while (p > hi) p -= 12;
    const n = { start, dur, pitch: p, vel };
    if (fx) n.fx = fx;
    out.push(n);
  };
  chords.forEach((c, ci) => {
    const ch = parseChord(c.symbol);
    const bassPc = pc(ch.bass ?? ch.root);
    const root = lowestIn(bassPc, lo);
    const fifth = root + 7 > hi ? root - 5 : root + 7;
    const len = c.end - c.start;
    const bar = barAt(song, c.start);
    const beat = beatTicks(song, bar);
    const eighth = beat === song.ppq * 1.5 ? song.ppq / 2 : beat / 2;
    const next = chords[ci + 1];
    const nextRoot = next ? lowestIn(pc(parseChord(next.symbol).bass ?? parseChord(next.symbol).root), lo) : root;
    if (style === 'root') push(c.start, len, root);
    else if (style === 'eighths') {
      for (let t = c.start; t < c.end; t += eighth) push(t, Math.min(eighth, c.end - t), root, (t - c.start) % beat === 0 ? 105 : 90, opts.palmMute ? { pm: true } : undefined);
    } else if (style === 'octaves') {
      let k = 0;
      for (let t = c.start; t < c.end; t += eighth) push(t, Math.min(eighth, c.end - t), k++ % 2 ? root + 12 : root);
    } else if (style === 'root-fifth') {
      let k = 0;
      for (let t = c.start; t < c.end; t += beat) push(t, Math.min(beat, c.end - t), k++ % 2 ? fifth : root);
    } else if (style === 'arpeggio') {
      const tones = ch.intervals.map((iv) => root + iv.semis).filter((m) => m <= hi);
      let k = 0;
      for (let t = c.start; t < c.end; t += eighth) push(t, Math.min(eighth, c.end - t), tones[k++ % tones.length]);
    } else if (style === 'syncopated') {
      // 1, (and of 2), 3, (and of 4) with octave pops
      const cell = [[0, 1.5, root], [1.5, 0.5, root + 12], [2, 1, root], [3.5, 0.5, fifth]];
      for (let t = c.start; t < c.end; t += 4 * beat) {
        for (const [o, d, p] of cell) {
          const s = t + o * beat;
          if (s < c.end) push(s, Math.min(d * beat, c.end - s), p, o === 0 ? 108 : 92);
        }
      }
    } else if (style === 'walking') {
      // 4 per bar: root, chord tone/scale step, chord tone, chromatic or scale approach to next root
      const tones = ch.intervals.map((iv) => mod(bassPc + iv.semis, 12));
      let prev = root;
      const notesN = Math.max(1, Math.round(len / beat));
      for (let k = 0; k < notesN; k++) {
        const t = c.start + k * beat;
        let p;
        if (k === 0) p = root;
        else if (k === notesN - 1) {
          const approach = rng.chance(0.6) ? nextRoot + (rng.chance(0.5) ? 1 : -1) : sc.snap(nextRoot + (nextRoot > prev ? -2 : 2));
          p = approach;
        } else {
          const cands = [];
          for (let m = lo; m <= hi; m++) {
            const isCT = tones.includes(mod(m, 12));
            const inScale = sc.contains(m);
            if (!isCT && !inScale) continue;
            const d = Math.abs(m - prev);
            if (d === 0 || d > 7) continue;
            cands.push([m, (isCT ? 2 : 1) / d]);
          }
          p = cands.length ? rng.weighted(cands) : root;
        }
        push(t, Math.min(beat, c.end - t), p, k === 0 ? 100 : 88);
        prev = out[out.length - 1].pitch;
      }
    } else throw new Error(`bassLine: unknown style "${style}"`);
  });
  track.notes.push(...out);
  return out;
}

// ---- comping -------------------------------------------------------------------------

// strum patterns over 8 eighths (4/4): D = down, U = up, . = rest, - = hold
export const STRUMS = {
  folk: 'D.DU.UDU',
  pop: 'D.D.DUDU',
  rock: 'D.DUD.DU',
  ballad: 'D...D.DU',
  island: '.U.U.U.U',
  straight: 'DDDDDDDD',
  whole: 'D-------',
};

/**
 * styles: 'strum' | 'power' | 'gallop' | 'arpeggio' | 'skank' | 'pad' | 'block' | 'jazz' | 'shuffle' | 'funk'
 * opts: { from, to, style, pattern (strum), energy, seed, voices (pad/block), range }
 * Fretted tracks get real guitar shapes (string/fret fixed); pitched tracks get voice-led chords.
 */
export function comp(song, track, opts = {}) {
  const style = opts.style ?? 'strum';
  const rng = asRng(opts.rng ?? opts.seed);
  const fretted = track.kind === 'fretted';
  const chords = chordsBetween(song, opts.from ?? 0, opts.to ?? song.bars);
  const out = [];
  let prevVoicing = null;
  const shapeFor = (sym) => {
    const sh = chordShapes(sym, { tuning: track.tuning, maxFret: Math.min(track.maxFret ?? 15, 12) });
    if (!sh.length) throw new Error(`No guitar shape for ${sym}`);
    return sh[0];
  };
  const shapeNotes = (shape) => shape.frets.map((f, i) => (f === null ? null : { string: i + 1, fret: f, pitch: midi(track.tuning[i]) + f })).filter(Boolean);
  const voicing = (sym, voices = 4, range = opts.range ?? [52, 76]) => {
    const v = voiceLead(prevVoicing, sym, { voices, low: range[0], high: range[1] });
    prevVoicing = v;
    return v.map((p) => ({ pitch: p }));
  };
  let curEnd = Infinity; // every comp note stays inside its chord
  const add = (start, dur, notes, vel = 90, fx) => {
    if (start >= curEnd) return;
    dur = Math.min(dur, curEnd - start);
    for (const n of notes) {
      const o = { start, dur, pitch: n.pitch, vel };
      if (fretted && n.string) {
        o.string = n.string;
        o.fret = n.fret;
      }
      if (fx) o.fx = { ...fx };
      out.push(o);
    }
  };
  for (const c of chords) {
    curEnd = c.end;
    const bar = barAt(song, c.start);
    const beat = beatTicks(song, bar);
    const compound = beat === song.ppq * 1.5;
    const eighth = compound ? song.ppq / 2 : beat / 2;
    const len = c.end - c.start;
    const ch = parseChord(c.symbol);
    const full = fretted ? shapeNotes(shapeFor(c.symbol)) : voicing(c.symbol, opts.voices ?? 4);
    if (style === 'pad' || style === 'block') {
      if (style === 'pad') add(c.start, len, full, 75);
      else for (let t = c.start; t < c.end; t += beat) add(t, Math.min(beat, c.end - t), full, (t - c.start) % (2 * beat) ? 80 : 95);
    } else if (style === 'strum') {
      const pat = STRUMS[opts.pattern ?? 'pop'] ?? opts.pattern;
      if (!/^[DU.\-]+$/.test(pat)) throw new Error(`Bad strum pattern "${pat}" (use D U . -)`);
      const step = (beat * 4) / pat.length / (compound ? 1 : 1);
      for (let t = c.start, i = 0; t < c.end; t += step, i++) {
        const ch2 = pat[i % pat.length];
        if (ch2 === '.' || ch2 === '-') continue;
        let hold = 1;
        while (pat[(i + hold) % pat.length] === '-' && hold < pat.length) hold++;
        const dur = Math.min(step * hold, c.end - t);
        const notes = ch2 === 'U' ? full.filter((n, k, arr) => k < Math.ceil(arr.length * 0.66)) : full;
        add(t, dur, notes, ch2 === 'D' ? 96 : 78);
      }
    } else if (style === 'power' || style === 'gallop') {
      const rootP = lowestIn(pc(ch.bass ?? ch.root), fretted ? midi(track.tuning[track.tuning.length - 1]) : 40);
      const pn = fretted ? powerChord(rootP, { tuning: track.tuning }) : [{ pitch: rootP }, { pitch: rootP + 7 }, { pitch: rootP + 12 }];
      const energy = opts.energy ?? 0.8;
      if (style === 'power') {
        if (energy < 0.5) add(c.start, len, pn, 95, { lr: true });
        else for (let t = c.start; t < c.end; t += eighth) add(t, Math.min(eighth, c.end - t), pn, (t - c.start) % beat ? 88 : 104, (t - c.start) % beat ? { pm: true } : undefined);
      } else {
        // gallop: 8th + two 16ths, palm-muted root on the low string
        const low = pn.slice(0, 1);
        for (let t = c.start; t < c.end; t += beat) {
          const sixteenth = beat / 4;
          if (t === c.start) add(t, beat / 2, pn, 110);
          else add(t, beat / 2, low, 100, { pm: true });
          if (t + beat / 2 < c.end) add(t + beat / 2, sixteenth, low, 90, { pm: true });
          if (t + (3 * beat) / 4 < c.end) add(t + (3 * beat) / 4, sixteenth, low, 90, { pm: true });
        }
      }
    } else if (style === 'arpeggio') {
      const order = full.slice().sort((a, b) => a.pitch - b.pitch);
      const seq = order.length >= 4 ? [0, 2, 1, 3, order.length - 1, 3, 1, 2] : [0, 1, 2, 1];
      let i = 0;
      for (let t = c.start; t < c.end; t += eighth) {
        const n = order[seq[i++ % seq.length] % order.length];
        add(t, Math.min(eighth * 2, c.end - t), [n], i === 1 ? 92 : 80, { lr: fretted });
      }
      // let notes ring but never overlap the same string/pitch: trim later
    } else if (style === 'skank') {
      const top = full.slice().sort((a, b) => b.pitch - a.pitch).slice(0, 3);
      for (let t = c.start + beat / 2; t < c.end; t += beat) add(t, Math.min(beat / 4, c.end - t), top, 90, { st: true });
    } else if (style === 'shuffle') {
      // boogie: root+5 / root+6 alternating, on beat (compound meters: long-short)
      const rootP = lowestIn(pc(ch.root), fretted ? midi(track.tuning[track.tuning.length - 1]) : 40);
      const pairs = [[rootP, rootP + 7], [rootP, rootP + 9]];
      let k = 0;
      for (let t = c.start; t < c.end; t += beat) {
        const [a, b] = pairs[k++ % 2];
        const notes = fretted ? fitPairLow(track, a, b) : [{ pitch: a }, { pitch: b }];
        if (compound) {
          add(t, 2 * eighth, notes, 98);
          if (t + 2 * eighth < c.end) add(t + 2 * eighth, eighth, notes, 80);
        } else {
          add(t, beat * 0.75 > 0 ? beat / 2 : beat, notes, 98);
          add(t + beat / 2, beat / 2, notes, 80);
        }
      }
    } else if (style === 'jazz') {
      // shell voicings (3rd + 7th, root optional) in a Charleston rhythm: 1, and-of-2
      const shell = jazzShell(ch, fretted ? track : null);
      add(c.start, Math.min(beat, len), shell, 85);
      const t2 = c.start + beat * 1.5;
      if (t2 < c.end) add(t2, Math.min(beat / 2, c.end - t2), shell, 75, { st: true });
    } else if (style === 'funk') {
      const top = full.slice().sort((a, b) => b.pitch - a.pitch).slice(0, 3);
      const sixteenth = beat / 4;
      for (let t = c.start; t < c.end; t += sixteenth) {
        const k = Math.round((t - c.start) / sixteenth) % 16;
        if ([0, 3, 6, 10, 12, 14].includes(k)) add(t, sixteenth, top, k === 0 ? 100 : 82, { st: true });
        else if (rng.chance(0.35)) add(t, sixteenth, top.map((n) => ({ ...n })), 50, { x: true });
      }
    } else throw new Error(`comp: unknown style "${style}"`);
  }
  // remove overlaps on the same pitch (arpeggio let-ring) by trimming
  out.sort((a, b) => a.start - b.start);
  const lastByPitch = new Map();
  for (const n of out) {
    const p = lastByPitch.get(n.pitch);
    if (p && p.start + p.dur > n.start) p.dur = n.start - p.start;
    lastByPitch.set(n.pitch, n);
  }
  // fretted arpeggios: notes ringing on the same string must stop when the string is replucked
  if (fretted) {
    const lastByString = new Map();
    for (const n of out) {
      if (!n.string) continue;
      const p = lastByString.get(n.string);
      if (p && p.start + p.dur > n.start) p.dur = n.start - p.start;
      lastByString.set(n.string, n);
    }
  }
  const kept = out.filter((n) => n.dur > 0);
  // dedupe identical start+pitch
  const seen = new Set();
  const final = kept.filter((n) => {
    const k = `${n.start}:${n.pitch}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  track.notes.push(...final);
  return final;
}

/** two notes on adjacent low strings (boogie shapes): root on the lowest string that fits */
function fitPairLow(track, a, b) {
  const open = track.tuning.map((t) => midi(t));
  for (let s = open.length - 1; s >= 1; s--) {
    const fa = a - open[s];
    const fb = b - open[s - 1];
    if (fa >= 0 && fa <= 12 && fb >= 0 && fb <= 12 && Math.abs(fa - fb) <= 4) {
      return [{ pitch: a, string: s + 1, fret: fa }, { pitch: b, string: s, fret: fb }];
    }
  }
  return [{ pitch: a }, { pitch: b }];
}

function jazzShell(ch, track) {
  const r = pc(ch.root);
  const third = ch.intervals.find((iv) => iv.num === 3 || iv.num === 4 || iv.num === 2);
  const sev = ch.intervals.find((iv) => iv.num === 7) ?? ch.intervals.find((iv) => iv.num === 6) ?? ch.intervals.find((iv) => iv.num === 5);
  const rootM = lowestIn(r, track ? midi(track.tuning[track.tuning.length - 1]) : 43);
  const notes = [rootM];
  if (sev) notes.push(rootM + sev.semis);
  if (third) notes.push(rootM + third.semis + 12);
  return notes.map((p) => ({ pitch: p })); // fretted tracks get fingered by assignFrets
}
