// Playable guitar/bass chord shapes from a chord symbol and tuning.
import { parseChord } from '../theory/chord.mjs';
import { midi, pc, mod } from '../theory/pitch.mjs';
import { tuning as getTuning } from '../ir.mjs';

// Tweak to change what counts as a good shape.
export const SHAPE_RULES = {
  maxSpan: 3,       // fretted notes within 4 frets
  minStrings: 3,
  maxFret: 15,
  openBonus: 1.5,
  positionCost: 0.25,   // per fret of hand position
  mutedInsideCost: 4,   // muted string between played strings
  missingToneCost: 6,   // chord tone not present (3rd and 7th weigh double)
  extraBassCost: 3,     // lowest note isn't the bass/root
  spanCost: 0.7,        // per fret of stretch
  openWithHighCost: 0.5, // open strings mixed with frets above 4 (awkward)
};

/**
 * All good shapes for a chord, best first. Each shape: { frets: [f or null per string, string 1 first],
 *   notes: midi[], position, score, name }
 * opts: { tuning, maxFret, minFret, limit, requireRootBass }
 */
const shapeCache = new Map();

export function chordShapes(symbol, opts = {}) {
  const ck = JSON.stringify([typeof symbol === 'string' ? symbol : symbol.symbol, opts]);
  if (shapeCache.has(ck)) return shapeCache.get(ck).map((x) => ({ ...x, frets: x.frets.slice(), notes: x.notes.slice() }));
  const res = chordShapesUncached(symbol, opts);
  shapeCache.set(ck, res);
  return res.map((x) => ({ ...x, frets: x.frets.slice(), notes: x.notes.slice() }));
}

function chordShapesUncached(symbol, opts) {
  const R = { ...SHAPE_RULES, ...opts.rules };
  const tun = getTuning(opts.tuning ?? 'standard');
  const open = tun.map((t) => midi(t)); // string 1 = highest
  const c = typeof symbol === 'string' ? parseChord(symbol) : symbol;
  const pcs = c.pcs;
  const rootPc = pc(c.root);
  const bassPc = c.bass ? pc(c.bass) : rootPc;
  // 3rds, 7ths and sus tones define the chord; missing them costs double
  const important = new Set(
    c.intervals.filter((iv, i) => /^[mMd]3$|^[mMd]7$|^P4$|^M2$/.test(c.names[i])).map((iv) => mod(rootPc + iv.semis, 12)),
  );
  const maxFret = opts.maxFret ?? R.maxFret;
  const minFret = opts.minFret ?? 0;
  const n = open.length;
  const results = [];
  for (let pos = Math.max(1, minFret); pos <= maxFret - R.maxSpan; pos++) {
    // per string choices: muted, open (if chord tone), or fret in [pos, pos+span] that is a chord tone
    const choices = open.map((o) => {
      const list = [null];
      if (minFret === 0 && pcs.includes(mod(o, 12))) list.push(0);
      for (let f = pos; f <= pos + R.maxSpan; f++) if (pcs.includes(mod(o + f, 12))) list.push(f);
      return list;
    });
    const rec = (s, acc) => {
      if (s < 0) {
        evaluate(acc.slice());
        return;
      }
      for (const f of choices[s]) {
        acc[s] = f;
        rec(s - 1, acc);
      }
    };
    rec(n - 1, new Array(n).fill(null));
  }

  function evaluate(frets) {
    const played = frets.map((f, i) => (f === null ? null : open[i] + f));
    const idx = played.map((m, i) => (m === null ? -1 : i)).filter((i) => i >= 0);
    if (idx.length < Math.min(R.minStrings, pcs.length)) return;
    const ms = idx.map((i) => played[i]);
    const fretted = idx.map((i) => frets[i]).filter((f) => f > 0);
    if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > R.maxSpan) return;
    const fingersNeeded = new Set(idx.filter((i) => frets[i] > 0).map((i) => `${frets[i]}`)).size;
    if (idx.filter((i) => frets[i] > 0).length > 4 && fingersNeeded > 3) {
      // more than 4 fretted strings needs a barre at the lowest fret
      const low = Math.min(...fretted);
      const nonBarre = idx.filter((i) => frets[i] > low).length;
      if (nonBarre > 3) return;
    }
    const lowest = Math.min(...ms);
    let score = 0;
    if (mod(lowest, 12) !== bassPc) {
      if (opts.requireRootBass !== false) return;
      score += R.extraBassCost;
    }
    const present = new Set(ms.map((m) => mod(m, 12)));
    for (const p of pcs) if (!present.has(p)) score += R.missingToneCost * (important.has(p) ? 2 : 1) * (p === mod(rootPc + 7, 12) ? 0.3 : 1);
    // contiguity: muted strings between played strings are hard to strum
    const first = idx[0];
    const last = idx[idx.length - 1];
    for (let i = first; i <= last; i++) if (played[i] === null) score += R.mutedInsideCost;
    const position = fretted.length ? Math.min(...fretted) : 0;
    score += position * R.positionCost;
    if (fretted.length) score += (Math.max(...fretted) - Math.min(...fretted)) * R.spanCost;
    if (idx.some((i) => frets[i] === 0) && fretted.some((f) => f > 4)) score += R.openWithHighCost * idx.filter((i) => frets[i] === 0).length;
    score -= idx.filter((i) => frets[i] === 0).length * R.openBonus * 0.5;
    score -= idx.length * 0.4; // fuller shapes preferred
    results.push({ frets, notes: ms.slice().sort((a, b) => a - b), position, score });
  }

  const seen = new Set();
  const uniq = results
    .sort((a, b) => a.score - b.score)
    .filter((r) => {
      const k = r.frets.join(',');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return uniq.slice(0, opts.limit ?? 8).map((r) => ({ ...r, name: c.symbol, diagram: diagram(r.frets) }));
}

/** "x32010" style (low string first, like chord charts) */
export function diagram(frets) {
  return frets
    .slice()
    .reverse()
    .map((f) => (f === null ? 'x' : f > 9 ? `(${f})` : String(f)))
    .join('');
}

/** power chord shape: root + fifth (+ octave) with root on the given string (1 = highest) */
export function powerChord(rootMidi, { tuning = 'standard', string, octave = true, maxFret = 14 } = {}) {
  const open = getTuning(tuning).map((t) => midi(t));
  const strings = string ? [string - 1] : [open.length - 1, open.length - 2, open.length - 3];
  const found = [];
  for (const s of strings) {
    const f = rootMidi - open[s];
    if (f < 0 || f > maxFret || s - 1 < 0) continue;
    const fifthF = rootMidi + 7 - open[s - 1];
    if (fifthF < 0 || Math.abs(fifthF - f) > 3) continue;
    const notes = [{ string: s + 1, fret: f, pitch: rootMidi }, { string: s, fret: fifthF, pitch: rootMidi + 7 }];
    if (octave && s - 2 >= 0) {
      const of = rootMidi + 12 - open[s - 2];
      if (of >= 0 && Math.abs(of - f) <= 3) notes.push({ string: s - 1, fret: of, pitch: rootMidi + 12 });
    }
    found.push({ f, notes });
  }
  if (!found.length) throw new Error(`No power chord shape for midi ${rootMidi} on this tuning`);
  // lowest position wins (D on the A string at fret 5 rather than the low E at fret 10)
  found.sort((a, b) => a.f - b.f);
  return found[0].notes;
}
