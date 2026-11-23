// Tuning lab: cents and ratios, equal divisions (EDO), just intonation, historical temperaments,
// Scala (.scl) files, JI lattices, and microtonal MIDI (pitch bend per note).
import { header, trackChunk, tempoEvent, meta } from '../io/midi.mjs';

export const cents = (ratio) => 1200 * Math.log2(ratio);
export const ratioFromCents = (c) => Math.pow(2, c / 1200);

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** parse "3/2", "1.5", 701.955 (cents if it has a dot and no slash, like Scala) */
export function parseRatio(x) {
  if (typeof x === 'number') return x;
  const s = String(x).trim();
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    if (!(a > 0 && b > 0)) throw new Error(`Bad ratio "${x}"`);
    return a / b;
  }
  if (s.includes('.')) return ratioFromCents(parseFloat(s));
  const n = Number(s);
  if (!(n > 0)) throw new Error(`Bad ratio "${x}"`);
  return n;
}

/** nearest fraction with denominator <= maxDen (continued fractions) */
export function approximateRatio(r, maxDen = 128) {
  let [h1, h0, k1, k0] = [1, 0, 0, 1];
  let x = r;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(x);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    [h0, h1, k0, k1] = [h1, h2, k1, k2];
    if (Math.abs(x - a) < 1e-12) break;
    x = 1 / (x - a);
  }
  const g = gcd(h1, k1);
  return { num: h1 / g, den: k1 / g, error: cents(r) - cents(h1 / k1) };
}

/**
 * A scale is { name, description, steps: cents above the tonic (excluding 0, including the period),
 *              period (cents, usually 1200) }
 */
export function edo(n, { period = 1200 } = {}) {
  if (!(n > 0)) throw new Error('edo: n must be > 0');
  return { name: `${n}-EDO`, description: `${n} equal divisions of ${period === 1200 ? 'the octave' : period + ' cents'}`, steps: Array.from({ length: n }, (_, i) => ((i + 1) * period) / n), period };
}

export function fromRatios(name, ratios, description = '') {
  const steps = ratios.map((r) => cents(parseRatio(r)));
  return { name, description, steps, period: steps[steps.length - 1], ratios: ratios.map(String) };
}

export const SCALES = {
  'just major': fromRatios('Just major (Ptolemy)', ['9/8', '5/4', '4/3', '3/2', '5/3', '15/8', '2/1'], '5-limit just major scale'),
  'just minor': fromRatios('Just minor', ['9/8', '6/5', '4/3', '3/2', '8/5', '9/5', '2/1'], '5-limit natural minor'),
  pythagorean: fromRatios('Pythagorean', ['9/8', '81/64', '4/3', '3/2', '27/16', '243/128', '2/1'], 'stacked pure fifths'),
  'harmonic 8-16': fromRatios('Harmonics 8-16', ['9/8', '10/8', '11/8', '12/8', '13/8', '14/8', '15/8', '2/1'], 'overtones 8 to 16 of one fundamental'),
  'just 12': fromRatios('5-limit chromatic', ['16/15', '9/8', '6/5', '5/4', '4/3', '45/32', '3/2', '8/5', '5/3', '9/5', '15/8', '2/1'], 'common 5-limit 12-note just scale'),
  'meantone 1/4': {
    name: 'Quarter-comma meantone', description: 'pure major thirds; fifths narrowed by 1/4 syntonic comma',
    steps: [], period: 1200, // filled by meantoneSteps() below
  },
  'werckmeister iii': { name: 'Werckmeister III', description: 'well temperament (1691)', steps: [90.225, 192.18, 294.135, 390.225, 498.045, 588.27, 696.09, 792.18, 888.27, 996.09, 1092.18, 1200], period: 1200 },
  'bohlen-pierce': { name: 'Bohlen-Pierce (equal)', description: '13 equal divisions of the 3/1 tritave', steps: Array.from({ length: 13 }, (_, i) => ((i + 1) * cents(3)) / 13), period: cents(3) },
  slendro: { name: 'Slendro (5-EDO approx.)', description: 'idealised as 5 equal steps; real gamelan tunings vary', steps: [240, 480, 720, 960, 1200], period: 1200 },
};

function meantoneSteps() {
  const fifth = 1200 * Math.log2(Math.pow(5, 0.25)); // 696.578 cents
  // chromatic notes as fifths from C: C#=+7, D=+2, Eb=-3, E=+4, F=-1, F#=+6, G=+1, G#=+8, A=+3, Bb=-2, B=+5
  const fifths = [7, 2, -3, 4, -1, 6, 1, 8, 3, -2, 5];
  const steps = fifths.map((f) => ((f * fifth) % 1200 + 1200) % 1200);
  steps.push(1200);
  return steps;
}
SCALES['meantone 1/4'].steps = meantoneSteps();

export function getScale(name) {
  if (typeof name === 'object') return name;
  const m = /^(\d+)-?edo$/i.exec(String(name).trim());
  if (m) return edo(Number(m[1]));
  const s = SCALES[String(name).toLowerCase()];
  if (!s) throw new Error(`Unknown tuning "${name}". Known: ${Object.keys(SCALES).join(', ')}, or "<n>-EDO"`);
  return s;
}

/** frequency of scale degree `deg` (0 = tonic, may be negative or above the period) */
export function degreeFreq(scaleIn, deg, tonicHz = 261.6256) {
  const sc = getScale(scaleIn);
  const n = sc.steps.length;
  const oct = Math.floor(deg / n);
  const k = ((deg % n) + n) % n;
  const c = (k === 0 ? 0 : sc.steps[k - 1]) + oct * sc.period;
  return tonicHz * ratioFromCents(c);
}

/** Scala .scl text */
export function toScala(scaleIn) {
  const sc = getScale(scaleIn);
  const lines = [`! ${sc.name.replace(/\s+/g, '_')}.scl`, '!', sc.description || sc.name, ` ${sc.steps.length}`, '!'];
  sc.steps.forEach((c, i) => {
    const r = sc.ratios?.[i];
    lines.push(' ' + (r ?? c.toFixed(5)));
  });
  return lines.join('\n') + '\n';
}

export function parseScala(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => !l.trim().startsWith('!'));
  if (lines.length < 2) throw new Error('Not a Scala file (need a description line and a note count)');
  const description = lines[0].trim();
  const count = parseInt(lines[1].trim(), 10);
  if (!(count >= 0)) throw new Error('Scala: bad note count');
  const vals = lines.slice(2, 2 + count).map((l) => l.trim().split(/\s+/)[0]);
  if (vals.length !== count) throw new Error(`Scala: expected ${count} pitches, found ${vals.length}`);
  const steps = vals.map((v) => (v.includes('.') && !v.includes('/') ? parseFloat(v) : cents(parseRatio(v))));
  return { name: description || 'Scala scale', description, steps, period: steps[steps.length - 1], ratios: vals.map((v) => (v.includes('/') || !v.includes('.') ? v : undefined)) };
}

/** how well an EDO approximates key just intervals: [{ interval, ratio, edoCents, error }] */
export function edoErrors(n, targets = ['3/2', '5/4', '6/5', '7/4', '11/8', '13/8']) {
  const step = 1200 / n;
  return targets.map((t) => {
    const c = cents(parseRatio(t));
    const k = Math.round(c / step);
    return { interval: t, cents: +c.toFixed(3), steps: k, edoCents: +(k * step).toFixed(3), error: +(k * step - c).toFixed(3) };
  });
}

/** JI ratio -> prime exponent vector over [2,3,5,7,11,13] (a lattice coordinate) */
export function monzo(ratio) {
  const r = approximateRatio(parseRatio(ratio), 1 << 20);
  const primes = [2, 3, 5, 7, 11, 13];
  const v = primes.map(() => 0);
  let [n, d] = [r.num, r.den];
  primes.forEach((p, i) => {
    while (n % p === 0) { n /= p; v[i]++; }
    while (d % p === 0) { d /= p; v[i]--; }
  });
  if (n !== 1 || d !== 1) throw new Error(`${ratio} has primes above 13`);
  return v;
}

/** Tenney height log2(n*d): a common simplicity measure for JI intervals */
export function tenneyHeight(ratio) {
  const r = approximateRatio(parseRatio(ratio), 1 << 20);
  return Math.log2(r.num * r.den);
}

/**
 * Microtonal MIDI: each note is { start, dur, degree } in a scale; written with pitch bend.
 * Every note gets its own channel (round robin over channels 0-15 except 9) so bends don't collide.
 * opts: { scale, tonicMidi (60), bendRange (semitones, 2), tempo, ppq }
 */
export function microtonalMidi(notes, { scale = '12-EDO', tonicMidi = 60, bendRange = 2, tempo = 100, ppq = 960, program = 0 } = {}) {
  const sc = getScale(scale);
  const n = sc.steps.length;
  const channels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  const conductor = [meta(0, 0x03, [...Buffer.from('Microtonal')]), tempoEvent(0, tempo)];
  const ev = [];
  for (const ch of channels) {
    ev.push({ tick: 0, order: 0, bytes: [0xc0 | ch, program] });
    // pitch bend sensitivity (RPN 0,0) = bendRange semitones
    ev.push({ tick: 0, order: 0, bytes: [0xb0 | ch, 101, 0] }, { tick: 0, order: 0, bytes: [0xb0 | ch, 100, 0] }, { tick: 0, order: 0, bytes: [0xb0 | ch, 6, bendRange] }, { tick: 0, order: 0, bytes: [0xb0 | ch, 38, 0] });
  }
  const sorted = notes.slice().sort((a, b) => a.start - b.start);
  const busyUntil = new Map(channels.map((c) => [c, -1]));
  sorted.forEach((note) => {
    const oct = Math.floor(note.degree / n);
    const k = ((note.degree % n) + n) % n;
    const c = (k === 0 ? 0 : sc.steps[k - 1]) + oct * sc.period;
    const exact = tonicMidi + c / 100;
    const key = Math.round(exact);
    const bendSemis = exact - key;
    if (Math.abs(bendSemis) > bendRange) throw new Error('bend out of range');
    const value = Math.max(0, Math.min(16383, Math.round(8192 + (bendSemis / bendRange) * 8192)));
    // a free channel (no note sounding), else the one that frees up first
    let ch = channels.find((x) => busyUntil.get(x) <= note.start);
    if (ch === undefined) ch = channels.reduce((a, x) => (busyUntil.get(x) < busyUntil.get(a) ? x : a), channels[0]);
    busyUntil.set(ch, note.start + note.dur);
    ev.push({ tick: note.start, order: 2, bytes: [0xe0 | ch, value & 0x7f, value >> 7] });
    ev.push({ tick: note.start, order: 3, bytes: [0x90 | ch, key, note.vel ?? 90] });
    ev.push({ tick: note.start + note.dur, order: 1, bytes: [0x80 | ch, key, 0] });
  });
  const chunks = [trackChunk(conductor), trackChunk(ev)];
  return Uint8Array.from([...header(chunks.length, ppq), ...chunks.flat()]);
}
