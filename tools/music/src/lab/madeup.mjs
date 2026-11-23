// Made-up music theory: describe a rule system as JSON, generate melodies that obey it, and check
// any melody against it. Theories can live in files and be shared/versioned.
//
// Theory = {
//   name, description,
//   pitch:  { steps: [cents above tonic incl. period] | edo: n | scale: 'dorian' , period: 1200 },
//   tonic: 60 (midi of degree 0), range: [lowDegree, highDegree],
//   intervals: { allowed: [..degree steps..] , weights: { "1": 3, "-1": 3, ... } },
//   forbid: [[a, b]...]  // forbidden consecutive degree pairs (mod scale size), e.g. [[6, 0]]
//   rhythm: { durations: [units...], weights: [...], unit: ticks, barUnits: 16, barEnds: 'any'|'exact' },
//   rules: [ { type, ... } ]   // see RULE_TYPES
// }
import { asRng } from '../rng.mjs';
import { getScale } from './tuning.mjs';
import { makeScale } from '../theory/scale.mjs';
import { parseKey } from '../theory/key.mjs';

export const RULE_TYPES = {
  start: 'first degree (mod size) must be one of `degrees`',
  end: 'last degree (mod size) must be one of `degrees`',
  maxSameDirection: 'no more than `n` steps in the same direction',
  leapRecovery: 'a step larger than `size` must be followed by a smaller step the other way',
  noRepeat: 'no immediate repeated degree',
  palindrome: 'the degree sequence reads the same backwards (mirror law)',
  sumPerBar: 'the sum of interval steps in each bar equals `value` (net motion per bar)',
  climax: 'the highest degree appears exactly once, in the middle `window` fraction',
  avoid: 'degrees in `degrees` (mod size) never appear',
  cadence: 'the last `pattern.length` degrees (mod size) equal `pattern`',
  durationSequence: 'durations follow `pattern` (cycled)',
};

function sizeOf(th) {
  if (th.pitch?.edo) return th.pitch.edo;
  if (th.pitch?.steps) return th.pitch.steps.length;
  if (th.pitch?.scale) return makeScale('C', th.pitch.scale).size;
  return 7;
}

/** check a degree/duration sequence against a theory. notes: [{ degree, dur (units) }] */
export function checkTheory(th, notes, { partial = false } = {}) {
  const out = [];
  const add = (rule, at, message) => out.push({ level: 'error', rule, at, message });
  const n = sizeOf(th);
  const degs = notes.map((x) => x.degree);
  const steps = degs.slice(1).map((d, i) => d - degs[i]);
  const [lo, hi] = th.range ?? [-n, 2 * n];
  degs.forEach((d, i) => {
    if (d < lo || d > hi) add('range', i, `degree ${d} outside ${lo}..${hi}`);
  });
  const allowed = th.intervals?.allowed;
  steps.forEach((s, i) => {
    if (allowed && !allowed.includes(s)) add('interval', i + 1, `step ${s} is not allowed`);
  });
  for (const [a, b] of th.forbid ?? []) {
    steps.forEach((s, i) => {
      if (((degs[i] % n) + n) % n === a && ((degs[i + 1] % n) + n) % n === b) add('forbid', i + 1, `${a} -> ${b} is forbidden`);
    });
  }
  const unit = th.rhythm?.unit ?? 240;
  const barUnits = th.rhythm?.barUnits ?? 16;
  const durs = th.rhythm?.durations;
  notes.forEach((x, i) => {
    if (durs && !durs.includes(x.dur)) add('duration', i, `duration ${x.dur} not in the rhythm alphabet`);
  });
  const modn = (d) => ((d % n) + n) % n;
  for (const r of th.rules ?? []) {
    switch (r.type) {
      case 'start':
        if (degs.length && !r.degrees.includes(modn(degs[0]))) add('start', 0, `must start on ${r.degrees}`);
        break;
      case 'end':
        if (!partial && degs.length && !r.degrees.includes(modn(degs[degs.length - 1]))) add('end', degs.length - 1, `must end on ${r.degrees}`);
        break;
      case 'maxSameDirection': {
        let run = 0;
        steps.forEach((s, i) => {
          run = i && Math.sign(s) === Math.sign(steps[i - 1]) && s !== 0 ? run + 1 : 1;
          if (run > r.n) add('maxSameDirection', i + 1, `more than ${r.n} steps the same way`);
        });
        break;
      }
      case 'leapRecovery':
        steps.forEach((s, i) => {
          if (Math.abs(s) > r.size && i + 1 < steps.length) {
            const nx = steps[i + 1];
            if (!(Math.sign(nx) === -Math.sign(s) && Math.abs(nx) < Math.abs(s))) add('leapRecovery', i + 2, 'leap not recovered');
          }
        });
        break;
      case 'noRepeat':
        steps.forEach((s, i) => {
          if (s === 0) add('noRepeat', i + 1, 'repeated degree');
        });
        break;
      case 'palindrome':
        if (!partial && degs.join() !== degs.slice().reverse().join()) add('palindrome', 0, 'sequence is not a palindrome');
        break;
      case 'sumPerBar': {
        let pos = 0;
        let sum = 0;
        let started = false;
        notes.forEach((x, i) => {
          if (i > 0) sum += degs[i] - degs[i - 1];
          pos += x.dur;
          started = true;
          if (pos % barUnits === 0 && started) {
            if (sum !== r.value && (!partial || i < notes.length - 1)) add('sumPerBar', i, `net motion ${sum} in bar ending at note ${i}, want ${r.value}`);
            sum = 0;
          }
        });
        break;
      }
      case 'climax':
        if (!partial && degs.length) {
          const max = Math.max(...degs);
          const idx = degs.map((d, i) => (d === max ? i : -1)).filter((i) => i >= 0);
          const w = r.window ?? 0.6;
          const lo2 = Math.floor((degs.length * (1 - w)) / 2);
          const hi2 = Math.ceil(degs.length - lo2 - 1);
          if (idx.length !== 1) add('climax', idx[1] ?? 0, 'highest note must appear once');
          else if (idx[0] < lo2 || idx[0] > hi2) add('climax', idx[0], 'climax outside the middle of the line');
        }
        break;
      case 'avoid':
        degs.forEach((d, i) => {
          if (r.degrees.includes(modn(d))) add('avoid', i, `degree ${modn(d)} is avoided`);
        });
        break;
      case 'cadence':
        if (!partial) {
          const tail = degs.slice(-r.pattern.length).map(modn);
          if (tail.join() !== r.pattern.join()) add('cadence', degs.length - 1, `must end with ${r.pattern}`);
        }
        break;
      case 'durationSequence':
        notes.forEach((x, i) => {
          if (x.dur !== r.pattern[i % r.pattern.length]) add('durationSequence', i, `duration should be ${r.pattern[i % r.pattern.length]}`);
        });
        break;
      default:
        throw new Error(`Unknown rule type "${r.type}". Known: ${Object.keys(RULE_TYPES).join(', ')}`);
    }
  }
  if (!partial && th.rhythm?.barEnds === 'exact') {
    const total = notes.reduce((a, x) => a + x.dur, 0);
    if (total % barUnits) add('barEnds', notes.length - 1, 'line must end on a barline');
  }
  void unit;
  return out;
}

/**
 * Generate a line obeying a theory by randomized backtracking.
 * opts: { length (notes), seed, maxNodes }
 * Palindrome theories generate the first half and mirror it.
 */
export function generateFromTheory(th, { length = 16, seed, rng: r, maxNodes = 200000 } = {}) {
  const rng = asRng(r ?? seed);
  const n = sizeOf(th);
  const [lo, hi] = th.range ?? [-n, 2 * n];
  const allowed = th.intervals?.allowed ?? [-2, -1, 1, 2];
  const w = th.intervals?.weights ?? {};
  const durs = th.rhythm?.durations ?? [4];
  const dw = th.rhythm?.weights ?? durs.map(() => 1);
  const durSeq = (th.rules ?? []).find((x) => x.type === 'durationSequence')?.pattern;
  const startRule = (th.rules ?? []).find((x) => x.type === 'start');
  const palindrome = (th.rules ?? []).some((x) => x.type === 'palindrome');
  if (palindrome && length % 2 === 0 && !allowed.includes(0)) {
    throw new Error(`"${th.name}": a palindrome of even length repeats its middle note, but step 0 isn't allowed. Use an odd length (${length + 1}).`);
  }
  const target = palindrome ? Math.ceil(length / 2) : length;
  let nodes = 0;
  const line = [];
  const dfs = () => {
    if (nodes++ > maxNodes) return false;
    if (line.length === target) {
      const full = palindrome ? [...line, ...line.slice(0, length - target).reverse()] : line;
      return checkTheory(th, full).length === 0;
    }
    const i = line.length;
    const durOpts = durSeq ? [durSeq[i % durSeq.length]] : rng.shuffle(durs.map((d, k) => [d, dw[k]])).sort((a, b) => b[1] * rng.next() - a[1] * rng.next()).map(([d]) => d);
    let degOpts;
    if (i === 0) {
      const starts = startRule ? startRule.degrees : [0];
      degOpts = rng.shuffle(starts.flatMap((s) => [s, s + n, s - n]).filter((d) => d >= lo && d <= hi));
    } else {
      const prev = line[i - 1].degree;
      degOpts = rng
        .shuffle(allowed)
        .map((s) => [prev + s, (w[String(s)] ?? 1) * (0.5 + rng.next())])
        .sort((a, b) => b[1] - a[1])
        .map(([d]) => d)
        .filter((d) => d >= lo && d <= hi);
    }
    for (const d of degOpts) {
      for (const du of durOpts) {
        line.push({ degree: d, dur: du });
        const probe = palindrome ? line : line;
        if (checkTheory(th, probe, { partial: true }).length === 0 && dfs()) return true;
        line.pop();
      }
    }
    return false;
  };
  for (let attempt = 0; attempt < 20; attempt++) {
    nodes = 0;
    line.length = 0;
    if (dfs()) return palindrome ? [...line, ...line.slice(0, length - target).reverse()] : line.slice();
  }
  throw new Error(`generateFromTheory: no line of ${length} notes satisfies "${th.name}" (loosen the rules or change the length)`);
}

/** theory line -> song notes. Pitch from theory.pitch (scale name, EDO via nearest 12-TET + cents) */
export function theoryToNotes(th, line, { start = 0, key } = {}) {
  const unit = th.rhythm?.unit ?? 240;
  const tonic = th.tonic ?? 60;
  let t = start;
  const out = [];
  let scale12 = null;
  if (th.pitch?.scale) {
    const k = parseKey(key ?? 'C major');
    scale12 = makeScale(k.tonic, th.pitch.scale, Math.floor(tonic / 12) - 1);
  }
  const sc = th.pitch?.edo || th.pitch?.steps ? getScale(th.pitch.edo ? `${th.pitch.edo}-EDO` : { name: th.name, steps: th.pitch.steps, period: th.pitch.period ?? 1200 }) : null;
  for (const x of line) {
    let pitch;
    let cents = 0;
    if (scale12) pitch = scale12.midi(x.degree) + (tonic - scale12.midi(0));
    else if (sc) {
      const n = sc.steps.length;
      const oct = Math.floor(x.degree / n);
      const k = ((x.degree % n) + n) % n;
      const c = (k === 0 ? 0 : sc.steps[k - 1]) + oct * sc.period;
      pitch = Math.round(tonic + c / 100);
      cents = +(c - (pitch - tonic) * 100).toFixed(2);
    } else pitch = tonic + x.degree;
    out.push({ start: t, dur: x.dur * unit, pitch, vel: 90, ...(cents ? { cents } : {}), degree: x.degree });
    t += x.dur * unit;
  }
  return out;
}

// A few starter theories to copy and bend.
export const THEORIES = {
  'golden steps': {
    name: 'Golden Steps', description: 'only Fibonacci-sized steps; durations from Fibonacci numbers; lines climb in the middle',
    pitch: { scale: 'major' }, tonic: 60, range: [-3, 10],
    intervals: { allowed: [-5, -3, -2, -1, 1, 2, 3, 5], weights: { 1: 3, '-1': 3, 2: 2, '-2': 2 } },
    rhythm: { durations: [1, 2, 3, 5], weights: [3, 3, 2, 1], unit: 240, barUnits: 16 },
    rules: [{ type: 'start', degrees: [0] }, { type: 'end', degrees: [0] }, { type: 'leapRecovery', size: 2 }, { type: 'climax', window: 0.6 }, { type: 'noRepeat' }],
  },
  'mirror law': {
    name: 'Mirror Law', description: 'every line is a palindrome; no more than 3 steps the same way',
    pitch: { scale: 'dorian' }, tonic: 62, range: [-4, 9],
    intervals: { allowed: [-3, -2, -1, 1, 2, 3] },
    rhythm: { durations: [2, 4], unit: 240, barUnits: 16 },
    rules: [{ type: 'palindrome' }, { type: 'maxSameDirection', n: 3 }, { type: 'start', degrees: [0, 4] }],
  },
  'ratio engine': {
    name: 'Ratio Engine', description: 'just-intonation 7-limit pitch set; small steps only; ends on the root',
    pitch: { steps: [8 / 7, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 7 / 4, 2].map((r) => 1200 * Math.log2(r)), period: 1200 }, tonic: 57, range: [-3, 10],
    intervals: { allowed: [-2, -1, 1, 2, 3] },
    rhythm: { durations: [1, 2, 4], weights: [2, 3, 1], unit: 240, barUnits: 16 },
    rules: [{ type: 'start', degrees: [0] }, { type: 'end', degrees: [0] }, { type: 'noRepeat' }],
  },
  'prime pulse': {
    name: 'Prime Pulse', description: 'durations are primes (2, 3, 5, 7 sixteenths); net motion per bar returns home',
    pitch: { edo: 19 }, tonic: 60, range: [-10, 25],
    intervals: { allowed: [-5, -3, -2, 2, 3, 5] },
    rhythm: { durations: [2, 3, 5, 7], unit: 240, barUnits: 17, barEnds: 'exact' },
    rules: [{ type: 'start', degrees: [0] }, { type: 'end', degrees: [0] }, { type: 'maxSameDirection', n: 2 }],
  },
};
