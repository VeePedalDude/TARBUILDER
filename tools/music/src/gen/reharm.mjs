// Reharmonisation: substitution tools on chord lists [{ start, dur, symbol }].
// Each tool returns a new list and leaves the input alone. Durations are preserved overall.
import { parseChord } from '../theory/chord.mjs';
import { parseKey } from '../theory/key.mjs';
import { parseRoman, analyzeRoman } from '../theory/roman.mjs';
import { noteName, transpose, pc, mod } from '../theory/pitch.mjs';
import { asRng } from '../rng.mjs';

const isDom7 = (c) => c.names.includes('M3') && c.names.includes('m7');
const rootName = (c) => noteName(c.root);
const up = (c, iv) => noteName({ ...transpose({ ...c.root, oct: 4 }, iv), oct: null });
const clone = (list) => list.map((x) => ({ ...x }));

function split(ch, parts) {
  const d = ch.dur / parts.length;
  return parts.map((symbol, i) => ({ ...ch, start: ch.start + i * d, dur: d, symbol }));
}

/** dominant 7th -> dominant 7th a tritone away (G7 -> Db7). prob: chance per chord */
export function tritoneSub(chords, { prob = 1, seed, rng: r } = {}) {
  const rng = asRng(r ?? seed);
  return clone(chords).map((ch) => {
    const c = parseChord(ch.symbol);
    if (!isDom7(c) || !rng.chance(prob)) return ch;
    const ext = ch.symbol.replace(/^[A-G](#|b)?/, '').replace(/\/.*$/, '');
    return { ...ch, symbol: up(c, 'd5') + ext, was: ch.symbol, why: 'tritone substitution' };
  });
}

/** put the dominant of each chord in the second half of the chord before it (C | F  ->  C C7 | F) */
export function secondaryDominants(chords, { key, prob = 1, seed, rng: r } = {}) {
  const rng = asRng(r ?? seed);
  const k = parseKey(key ?? 'C major');
  const out = [];
  chords.forEach((ch, i) => {
    const next = chords[i + 1];
    if (!next || ch.dur < 2 * 480 || !rng.chance(prob)) return out.push({ ...ch });
    const target = parseChord(next.symbol);
    if (target.quality.startsWith('dim') || pc(target.root) === k.tonicPc && i === chords.length - 2) {
      // V of the tonic is already the normal dominant; keep it plain
    }
    const dom = up(target, 'P5') + '7';
    if (dom === ch.symbol || parseChord(ch.symbol).pcs.join() === parseChord(dom).pcs.join()) return out.push({ ...ch });
    out.push(...split(ch, [ch.symbol, dom]).map((x, j) => (j ? { ...x, why: `V7 of ${next.symbol}` } : x)));
  });
  return out;
}

/** turn a chord's second half (or the chord before a target) into the ii-V of the next chord */
export function insertTwoFive(chords, { prob = 1, seed, rng: r } = {}) {
  const rng = asRng(r ?? seed);
  const out = [];
  chords.forEach((ch, i) => {
    const next = chords[i + 1];
    if (!next || !rng.chance(prob)) return out.push({ ...ch });
    const t = parseChord(next.symbol);
    const minorTarget = t.names.includes('m3');
    const ii = up(t, 'M2') + (minorTarget ? 'm7b5' : 'm7');
    const V = up(t, 'P5') + (minorTarget ? '7b9' : '7');
    if (ch.symbol === ii || ch.symbol === V) return out.push({ ...ch });
    // long chords keep their first half; the ii-V takes the second half
    const parts = ch.dur >= 1920 && (ch.dur / 4) % 120 === 0 ? [ch.symbol, ch.symbol, ii, V] : [ii, V];
    const pieces = split(ch, parts);
    if (parts.length === 4) {
      pieces[0].dur *= 2;
      pieces.splice(1, 1);
    }
    out.push(...pieces.map((x) => (x.symbol === ch.symbol ? x : { ...x, was: ch.symbol, why: `ii-V into ${next.symbol}` })));
  });
  return out;
}

/** borrow from the parallel minor (major keys): IV->iv, vi->bVI, iii->bIII, ii->iiø, V->v, I stays */
export function modalInterchange(chords, { key, prob = 0.5, seed, rng: r } = {}) {
  const rng = asRng(r ?? seed);
  const k = parseKey(key ?? 'C major');
  if (k.mode !== 'major') return clone(chords);
  const MAP = { IV: 'iv', IVmaj7: 'iv7', vi: 'bVI', vi7: 'bVImaj7', iii: 'bIII', iii7: 'bIIImaj7', ii: 'iiø7', ii7: 'iiø7', V: 'v', V7: 'v7' };
  return clone(chords).map((ch, i) => {
    const rn = analyzeRoman(ch.symbol, k);
    const to = MAP[rn];
    if (!to || i === chords.length - 1 || !rng.chance(prob)) return ch;
    return { ...ch, symbol: parseRoman(to, k).symbol, was: ch.symbol, why: `borrowed ${to} from ${k.tonic} minor` };
  });
}

/** chromatic mediant: replace a chord with the same quality a major/minor third away */
export function chromaticMediant(chords, { prob = 0.3, seed, rng: r } = {}) {
  const rng = asRng(r ?? seed);
  return clone(chords).map((ch, i) => {
    if (i === 0 || i === chords.length - 1 || !rng.chance(prob)) return ch;
    const c = parseChord(ch.symbol);
    const iv = rng.pick(['M3', 'm3', 'm6', 'M6']);
    const ext = ch.symbol.replace(/^[A-G](#|b)?/, '').replace(/\/.*$/, '');
    return { ...ch, symbol: up(c, iv) + ext, was: ch.symbol, why: `chromatic mediant (${iv})` };
  });
}

/** backdoor dominant: V7 -> bVII7 (G7 -> Bb7 in C) when it resolves to the tonic */
export function backdoor(chords, { key } = {}) {
  const k = parseKey(key ?? 'C major');
  return clone(chords).map((ch, i) => {
    const next = chords[i + 1];
    if (!next) return ch;
    const c = parseChord(ch.symbol);
    const n = parseChord(next.symbol);
    if (isDom7(c) && mod(pc(c.root) - 7, 12) === pc(n.root) && pc(n.root) === k.tonicPc) {
      const tonic = parseChord(next.symbol);
      return { ...ch, symbol: up(tonic, 'm7') + '7', was: ch.symbol, why: 'backdoor dominant (bVII7)' };
    }
    return ch;
  });
}

/** passing diminished: between two chords a whole step apart, insert a dim7 on the note between */
export function passingDiminished(chords) {
  const out = [];
  chords.forEach((ch, i) => {
    const next = chords[i + 1];
    if (!next) return out.push({ ...ch });
    const a = parseChord(ch.symbol);
    const b = parseChord(next.symbol);
    if (mod(pc(b.root) - pc(a.root), 12) === 2 && ch.dur >= 960) {
      out.push(...split(ch, [ch.symbol, up(a, 'A1') + 'dim7']).map((x, j) => (j ? { ...x, why: 'passing diminished' } : x)));
    } else out.push({ ...ch });
  });
  return out;
}

/**
 * Coltrane changes (Giant Steps cycle of major thirds) on each V7 -> Imaj resolution:
 *   G7 | Cmaj7    ->   Eb7 Abmaj7 | B7 Emaj7 G7 Cmaj7
 * The V7's span holds the first two chords, the I's span the last four.
 */
export function coltrane(chords) {
  const out = [];
  for (let i = 0; i < chords.length; i++) {
    const ch = chords[i];
    const next = chords[i + 1];
    const c = parseChord(ch.symbol);
    if (next && isDom7(c)) {
      const T = parseChord(next.symbol);
      const resolves = mod(pc(c.root) - 7, 12) === pc(T.root) && T.names.includes('M3');
      const fits = (ch.dur / 2) % 120 === 0 && (next.dur / 4) % 120 === 0;
      if (resolves && fits) {
        const tonic = next.symbol;
        const a = [up(T, 'm3') + '7', up(T, 'm6') + 'maj7'];
        const b = [up(T, 'M7') + '7', up(T, 'M3') + 'maj7', up(T, 'P5') + '7', tonic];
        a.forEach((symbol, j) => out.push({ start: ch.start + (j * ch.dur) / 2, dur: ch.dur / 2, symbol, why: 'Coltrane cycle' }));
        b.forEach((symbol, j) => out.push({ start: next.start + (j * next.dur) / 4, dur: next.dur / 4, symbol, why: 'Coltrane cycle' }));
        i++;
        continue;
      }
    }
    out.push({ ...ch });
  }
  return out;
}

export const REHARM = { tritoneSub, secondaryDominants, insertTwoFive, modalInterchange, chromaticMediant, backdoor, passingDiminished, coltrane };

export { rootName };
