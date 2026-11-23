// Species counterpoint (Fux): cantus firmus generator, a rule checker for species 1-5, and a
// search-based counterpoint writer. Two voices; diatonic in a major or minor key/mode.
//
// Time unit: one bar = 4 units (half note = 2, quarter = 1). The cantus has one whole note per bar.
// Counterpoint notes: [{ start, dur, pitch, tie? }] where start is in units from the beginning.
import { makeScale } from '../theory/scale.mjs';
import { parseKey } from '../theory/key.mjs';
import { mod } from '../theory/pitch.mjs';
import { asRng } from '../rng.mjs';

const CONSONANT = new Set([0, 3, 4, 7, 8, 9]);
const PERFECT = new Set([0, 7]);
const BAR = 4;

const ivc = (a, b) => mod(Math.abs(a - b), 12);
const isStep = (a, b) => Math.abs(a - b) >= 1 && Math.abs(a - b) <= 2;

function scaleFor(key) {
  const k = parseKey(key);
  const name = k.mode === 'major' ? 'major' : k.mode === 'minor' ? 'minor' : k.mode;
  return { k, sc: makeScale(k.tonic, name, 4) };
}

// ---- melodic rules (shared by cantus and counterpoint) ---------------------------------

/** returns issues for a single melodic line [{ level, rule, at, message }] */
export function melodicIssues(pitches, { allowRepeats = false, final = true, kind = 'line' } = {}) {
  const out = [];
  const add = (level, rule, at, message) => out.push({ level, rule, at, message });
  for (let i = 1; i < pitches.length; i++) {
    const a = pitches[i - 1];
    const b = pitches[i];
    const d = b - a;
    const ad = Math.abs(d);
    if (ad === 0 && !allowRepeats) add('error', 'repeat', i, `${kind}: repeated note`);
    if (ad > 12) add('error', 'leap-size', i, `${kind}: leap larger than an octave`);
    if (ad === 10 || ad === 11) add('error', 'seventh-leap', i, `${kind}: leap of a seventh`);
    if (ad === 6) add('error', 'tritone-leap', i, `${kind}: tritone leap`);
    if (ad === 8 && d < 0) add('error', 'descending-sixth', i, `${kind}: descending minor sixth`);
    if (ad === 9) add('warning', 'major-sixth', i, `${kind}: leap of a major sixth`);
    // leap recovery: a leap larger than a fourth is followed by a step back
    if (ad > 5 && i + 1 < pitches.length) {
      const n = pitches[i + 1] - b;
      if (!(Math.sign(n) === -Math.sign(d) && Math.abs(n) <= 2)) add('error', 'leap-recovery', i + 1, `${kind}: leap not followed by a step back`);
    }
    // two leaps in the same direction must outline a triad (no more than 2, total <= octave)
    if (i >= 2) {
      const d0 = a - pitches[i - 2];
      if (Math.abs(d0) > 2 && ad > 2 && Math.sign(d0) === Math.sign(d)) {
        if (Math.abs(d0 + d) > 12) add('error', 'compound-leap', i, `${kind}: consecutive leaps span more than an octave`);
        else if (i >= 3 && Math.abs(pitches[i - 2] - pitches[i - 3]) > 2 && Math.sign(pitches[i - 2] - pitches[i - 3]) === Math.sign(d)) add('error', 'three-leaps', i, `${kind}: three leaps in one direction`);
      }
    }
  }
  for (let i = 3; i < pitches.length; i++) {
    if (pitches[i] === pitches[i - 2] && pitches[i - 1] === pitches[i - 3]) add('warning', 'oscillation', i, `${kind}: back-and-forth a-b-a-b pattern`);
  }
  if (final && pitches.length > 2) {
    const max = Math.max(...pitches);
    if (pitches.filter((p) => p === max).length > 1) add('warning', 'climax', pitches.indexOf(max), `${kind}: highest note is not unique`);
    const range = max - Math.min(...pitches);
    if (range > 16) add('warning', 'range', 0, `${kind}: range larger than a tenth`);
    const steps = pitches.slice(1).filter((p, i) => isStep(pitches[i], p)).length;
    if (steps / (pitches.length - 1) < 0.5) add('warning', 'steps', 0, `${kind}: fewer than half the motions are steps`);
  }
  return out;
}

// ---- cantus firmus ---------------------------------------------------------------------

export function checkCantus(cf, key = 'C major') {
  const { k, sc } = scaleFor(key);
  const out = melodicIssues(cf, { kind: 'cantus' });
  const add = (level, rule, at, message) => out.push({ level, rule, at, message });
  if (cf.length < 8 || cf.length > 16) add('warning', 'length', 0, 'cantus is usually 8-16 notes');
  if (mod(cf[0] - k.tonicPc, 12) !== 0) add('error', 'start', 0, 'cantus must start on the tonic');
  if (mod(cf[cf.length - 1] - k.tonicPc, 12) !== 0) add('error', 'end', cf.length - 1, 'cantus must end on the tonic');
  const pen = cf[cf.length - 2];
  if (!(pen - cf[cf.length - 1] === 2 || pen - cf[cf.length - 1] === 1)) add('error', 'penultimate', cf.length - 2, 'cantus should end by step down (2-1)');
  for (let i = 0; i < cf.length; i++) if (!sc.contains(cf[i])) add('error', 'diatonic', i, 'cantus note not in the key');
  return out;
}

/** random-restart search for a cantus firmus */
export function generateCantus({ key = 'C major', length = 10, seed, rng: r, low, high } = {}) {
  const rng = asRng(r ?? seed);
  const { k, sc } = scaleFor(key);
  const tonic = sc.midi(0);
  const lo = low ?? tonic - 3;
  const hi = high ?? tonic + 12;
  const notesIn = [];
  for (let m = lo; m <= hi; m++) if (sc.contains(m)) notesIn.push(m);
  for (let attempt = 0; attempt < 400; attempt++) {
    const line = [tonic];
    let ok = true;
    for (let i = 1; i < length - 2 && ok; i++) {
      const prev = line[i - 1];
      const opts = notesIn
        .filter((m) => m !== prev && Math.abs(m - prev) <= 8)
        .map((m) => [m, isStep(prev, m) ? 5 : Math.abs(m - prev) <= 4 ? 2 : 0.7])
        .filter(([m]) => melodicIssues([...line, m], { final: false, kind: 'cantus' }).filter((x) => x.level === 'error').length === 0);
      if (!opts.length) ok = false;
      else line.push(rng.weighted(opts));
    }
    if (!ok) continue;
    line.push(sc.midi(1), tonic);
    // the last approach could be from above an octave: pick the tonic octave nearest
    const errs = checkCantus(line, key).filter((x) => x.level === 'error');
    const warns = checkCantus(line, key).filter((x) => x.level === 'warning');
    if (!errs.length && warns.length === 0) return line;
  }
  throw new Error('generateCantus: no cantus found; try another seed or length');
}

// ---- counterpoint checker ---------------------------------------------------------------

/**
 * Check a counterpoint against a cantus.
 * opts: { species 1-5, key, above (true), final (true = complete line; false = prefix check) }
 * Returns [{ level, rule, at (note index in cp), message }]
 */
export function checkCounterpoint(cf, cp, opts = {}) {
  const species = opts.species ?? 1;
  const above = opts.above ?? true;
  const final = opts.final ?? true;
  const { k, sc } = scaleFor(opts.key ?? 'C major');
  const out = [];
  const add = (level, rule, at, message) => out.push({ level, rule, at, message });
  const notes = cp.slice().sort((a, b) => a.start - b.start);
  const cfAt = (u) => cf[Math.floor(u / BAR)];
  const total = cf.length * BAR;

  // structure
  let t = notes.length ? notes[0].start : 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.start !== t && i > 0) add('error', 'gap', i, 'notes must follow each other without gaps');
    t = n.start + n.dur;
    if (n.pitch !== null && !sc.contains(n.pitch)) {
      const raisedLT = mod(n.pitch - k.tonicPc, 12) === 11 && Math.floor(n.start / BAR) === cf.length - 2;
      const raised6 = k.mode === 'minor' && mod(n.pitch - k.tonicPc, 12) === 9;
      if (!raisedLT && !raised6) add('error', 'diatonic', i, 'note not in the key');
    }
  }
  if (final && t !== total) add('error', 'length', notes.length - 1, `counterpoint must fill ${cf.length} bars`);
  if (final && notes.length && notes[notes.length - 1].start !== (cf.length - 1) * BAR) add('error', 'final-whole', notes.length - 1, 'last bar must be one whole note');

  const sounding = notes.filter((n) => n.pitch !== null);
  // voice relation
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.pitch === null) continue;
    const c = cfAt(n.start);
    if (above ? n.pitch < c : n.pitch > c) add('error', 'crossing', i, 'voices cross');
    if (Math.abs(n.pitch - c) > 19) add('warning', 'distance', i, 'voices more than a twelfth apart');
  }

  // vertical intervals and dissonance treatment
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.pitch === null) continue;
    const bar = Math.floor(n.start / BAR);
    const onDownbeat = n.start % BAR === 0;
    const c = cf[bar];
    const iv = ivc(n.pitch, c);
    const consonant = CONSONANT.has(iv);
    const prev = sounding[sounding.indexOf(n) - 1];
    const next = sounding[sounding.indexOf(n) + 1];
    if (species === 1 && !consonant) add('error', 'dissonance', i, 'species 1 allows only consonances');
    if (species >= 2 && species !== 4 && onDownbeat && !consonant) {
      // species 5 allows suspension handled below via ties
      if (!(species === 5 && n.tie)) add('error', 'downbeat-dissonance', i, 'downbeats must be consonant');
    }
    if ((species === 2 || species === 3 || species === 5) && !onDownbeat && !consonant) {
      if (!prev || (!next && final)) add('error', 'dissonance', i, 'dissonance must be approached and left by step');
      else if (next) {
        const inStep = isStep(prev.pitch, n.pitch);
        const outStep = isStep(n.pitch, next.pitch);
        const passing = inStep && outStep && Math.sign(n.pitch - prev.pitch) === Math.sign(next.pitch - n.pitch);
        const neighbor = inStep && outStep && Math.sign(n.pitch - prev.pitch) !== Math.sign(next.pitch - n.pitch);
        const after = sounding[sounding.indexOf(n) + 2];
        // cambiata: step down into the dissonance, leap down a third, then step up
        const camb = (species === 3 || species === 5) && inStep && n.pitch < prev.pitch && [-3, -4].includes(next.pitch - n.pitch) && (!after || (after.pitch > next.pitch && isStep(next.pitch, after.pitch)));
        if (species === 2 && !passing) add('error', 'dissonance', i, 'second species: weak-beat dissonance must be a passing tone');
        if ((species === 3 || species === 5) && !passing && !neighbor && !camb) add('error', 'dissonance', i, 'dissonance must be a passing tone, neighbour, or cambiata');
      }
    }
    // suspensions (species 4/5): a note tied into a downbeat may be dissonant if it resolves down by step
    if ((species === 4 || species === 5) && onDownbeat && n.tie && !consonant) {
      if (next) {
        const resolvesDown = n.pitch - next.pitch >= 1 && n.pitch - next.pitch <= 2;
        const resIv = ivc(next.pitch, cf[Math.floor(next.start / BAR)]);
        if (!resolvesDown || !CONSONANT.has(resIv)) add('error', 'suspension', i, 'suspension must resolve down by step to a consonance');
        if (next.pitch === cf[Math.floor(next.start / BAR)]) add('error', 'suspension', i, 'suspension may not resolve to a unison (9-8 to the octave is fine)');
        if (!above && iv === 2 && resIv !== 3 && resIv !== 4) add('warning', 'suspension', i, 'lower-voice suspension usually resolves 2-3');
      } else if (final) add('error', 'suspension', i, 'unresolved suspension');
      if (prev && !CONSONANT.has(ivc(prev.pitch, cf[Math.floor(prev.start / BAR)]))) add('error', 'preparation', i, 'suspension must be prepared by a consonance');
    }
    if (species === 4 && !onDownbeat && !consonant) add('error', 'dissonance', i, 'fourth species: weak beats must be consonant');
    if (species === 4 && onDownbeat && !n.tie && !consonant) add('error', 'dissonance', i, 'untied downbeat must be consonant');
    // unisons only at the ends (species 1); never on a downbeat elsewhere
    if (iv === 0 && n.pitch === c && i !== 0 && !(final && i === notes.length - 1) && (species === 1 || onDownbeat)) add('error', 'unison', i, 'unison only at the beginning and end');
  }

  // parallels: compare successive downbeats (species 1: successive notes)
  const downs = [];
  for (let b = 0; b < cf.length; b++) {
    const n = sounding.find((x) => x.start <= b * BAR && x.start + x.dur > b * BAR) ?? null;
    downs.push(n);
  }
  for (let b = 1; b < cf.length; b++) {
    const a = downs[b - 1];
    const z = downs[b];
    if (!a || !z) continue;
    const i1 = ivc(a.pitch, cf[b - 1]);
    const i2 = ivc(z.pitch, cf[b]);
    const idx = notes.indexOf(z);
    if (PERFECT.has(i1) && i1 === i2 && z.pitch !== a.pitch) add('error', i1 === 7 ? 'parallel-fifths' : 'parallel-octaves', idx, `parallel ${i1 === 7 ? 'fifths' : 'octaves'} between downbeats`);
    if (PERFECT.has(i2) && !PERFECT.has(i1) && species === 1) {
      const sameDir = Math.sign(z.pitch - a.pitch) === Math.sign(cf[b] - cf[b - 1]);
      if (sameDir) add('error', 'direct-perfect', idx, 'perfect interval approached by similar motion');
    }
  }
  // species 2/3: also catch parallels from the last note of a bar to the next downbeat
  if (species === 2 || species === 3) {
    for (let i = 1; i < sounding.length; i++) {
      const a = sounding[i - 1];
      const z = sounding[i];
      if (z.start % BAR !== 0) continue;
      const i1 = ivc(a.pitch, cfAt(a.start));
      const i2 = ivc(z.pitch, cfAt(z.start));
      if (PERFECT.has(i1) && i1 === i2 && Math.sign(z.pitch - a.pitch) === Math.sign(cfAt(z.start) - cfAt(a.start)) && z.pitch !== a.pitch) add('error', 'parallel-perfect', notes.indexOf(z), 'parallel perfect interval across the barline');
    }
  }

  // beginning and end
  if (sounding.length) {
    const f = sounding[0];
    const iv0 = ivc(f.pitch, cfAt(f.start));
    const okStart = above ? [0, 7].includes(iv0) : iv0 === 0;
    if (!okStart) add('error', 'start', notes.indexOf(f), above ? 'start on a unison, fifth or octave' : 'start on a unison or octave below');
    if (final) {
      const l = sounding[sounding.length - 1];
      if (ivc(l.pitch, cf[cf.length - 1]) !== 0) add('error', 'end', notes.indexOf(l), 'end on a unison or octave');
      const pen = sounding[sounding.length - 2];
      if (pen && !isStep(pen.pitch, l.pitch)) add('error', 'cadence', notes.indexOf(l), 'approach the final note by step');
      if (pen && Math.sign(l.pitch - pen.pitch) === Math.sign(cf[cf.length - 1] - cf[cf.length - 2])) add('error', 'cadence', notes.indexOf(l), 'final cadence must be in contrary motion');
    }
  }

  // too many parallel imperfects
  let run = 0;
  for (let b = 1; b < cf.length; b++) {
    const a = downs[b - 1];
    const z = downs[b];
    if (a && z && ivc(a.pitch, cf[b - 1]) === ivc(z.pitch, cf[b]) && !PERFECT.has(ivc(z.pitch, cf[b]))) {
      run++;
      if (run >= 3) add('warning', 'parallel-imperfect', notes.indexOf(z), 'more than three parallel thirds/sixths in a row');
    } else run = 0;
  }

  // melody of the counterpoint itself
  // tied notes are one sustained note melodically
  const struck = sounding.filter((n) => !n.tie);
  const mel = melodicIssues(struck.map((n) => n.pitch), { allowRepeats: false, final, kind: 'counterpoint' });
  for (const m of mel) out.push({ ...m, at: notes.indexOf(struck[Math.min(m.at, struck.length - 1)]) });
  if (species === 1 || species === 2 || species === 3) {
    for (let i = 1; i < sounding.length; i++) if (sounding[i].pitch === sounding[i - 1].pitch) add('error', 'repeat', notes.indexOf(sounding[i]), 'repeated note');
  }
  return out;
}

// ---- counterpoint writer -------------------------------------------------------------------

/** rhythm template per species for n bars: [{ start, dur, tie? }] */
export function speciesRhythm(species, bars, rng) {
  const out = [];
  for (let b = 0; b < bars; b++) {
    const s = b * BAR;
    const last = b === bars - 1;
    if (last) {
      out.push({ start: s, dur: BAR });
      continue;
    }
    if (species === 1) out.push({ start: s, dur: BAR });
    else if (species === 2) out.push({ start: s, dur: 2 }, { start: s + 2, dur: 2 });
    else if (species === 3) for (let q = 0; q < 4; q++) out.push({ start: s + q, dur: 1 });
    else if (species === 4) {
      // syncopated halves: first bar starts with a half rest; each weak-beat note ties into the next downbeat
      if (b === 0) out.push({ start: s, dur: 2, rest: true });
      else out.push({ start: s, dur: 2, tie: true });
      out.push({ start: s + 2, dur: 2, tieOut: b < bars - 2 });
    } else if (species === 5) {
      const pat = rng.pick([[2, 2], [2, 1, 1], [1, 1, 2], [3, 1], ['t', 2]]);
      let q = 0;
      for (const d of pat) {
        if (d === 't') {
          if (b > 0) out.push({ start: s, dur: 2, tie: true });
          else out.push({ start: s, dur: 2 });
          q = 2;
          continue;
        }
        out.push({ start: s + q, dur: d });
        q += d;
      }
    }
  }
  return out;
}

/**
 * Write a counterpoint by depth-first search with pruning (the checker runs on each prefix).
 * opts: { species, key, above, seed, range: [lo, hi], maxNodes }
 * Returns notes [{ start, dur, pitch, tie }] (species 4 ties: the downbeat note repeats the previous pitch).
 */
export function writeCounterpoint(cf, opts = {}) {
  const species = opts.species ?? 1;
  const above = opts.above ?? true;
  const rng = asRng(opts.rng ?? opts.seed);
  const { sc } = scaleFor(opts.key ?? 'C major');
  const lo = opts.range?.[0] ?? (above ? Math.min(...cf) : Math.min(...cf) - 15);
  const hi = opts.range?.[1] ?? (above ? Math.max(...cf) + 15 : Math.max(...cf));
  const pool = [];
  for (let m = lo; m <= hi; m++) if (sc.contains(m) || mod(m - sc.pcs[0], 12) === 11) pool.push(m);
  const maxNodes = opts.maxNodes ?? 60000;
  const want = opts.solutions ?? 6; // keep the best (fewest warnings) of this many solutions
  let best = null;
  let solutionsLeft = want;
  for (let attempt = 0; attempt < (opts.attempts ?? 30); attempt++) {
    const r = rng.fork('try' + attempt);
    const rhythm = speciesRhythm(species, cf.length, r);
    let nodes = 0;
    const line = [];
    const dfs = (i) => {
      if (nodes++ > maxNodes) return false;
      if (i === rhythm.length) {
        const errs = checkCounterpoint(cf, line, { species, above, key: opts.key, final: true }).filter((x) => x.level === 'error');
        return errs.length === 0;
      }
      const slot = rhythm[i];
      if (slot.rest) {
        line.push({ start: slot.start, dur: slot.dur, pitch: null });
        if (dfs(i + 1)) return true;
        line.pop();
        return false;
      }
      let cands;
      if (slot.tie && line.length && line[line.length - 1].pitch !== null) cands = [line[line.length - 1].pitch];
      else {
        const prev = [...line].reverse().find((n) => n.pitch !== null);
        cands = r.shuffle(pool).sort((a, b) => {
          const sa = prev ? Math.abs(a - prev.pitch) : 0;
          const sb = prev ? Math.abs(b - prev.pitch) : 0;
          const wa = sa >= 1 && sa <= 2 ? 0 : sa <= 4 ? 1 : 2;
          const wb = sb >= 1 && sb <= 2 ? 0 : sb <= 4 ? 1 : 2;
          return wa - wb + (r.next() - 0.5) * 1.5;
        });
      }
      for (const p of cands) {
        line.push({ start: slot.start, dur: slot.dur, pitch: p, ...(slot.tie ? { tie: true } : {}) });
        const errs = checkCounterpoint(cf, line, { species, above, key: opts.key, final: false }).filter((x) => x.level === 'error');
        if (!errs.length && dfs(i + 1)) return true;
        line.pop();
      }
      return false;
    };
    if (dfs(0)) {
      const warns = checkCounterpoint(cf, line, { species, above, key: opts.key }).filter((x) => x.level === 'warning').length;
      if (!best || warns < best.warns) best = { warns, line: line.map((n) => ({ ...n })) };
      if (--solutionsLeft <= 0 || warns === 0) break;
    }
  }
  if (best) return best.line;
  throw new Error(`writeCounterpoint: no species ${species} solution found for this cantus (try another seed or range)`);
}

/** counterpoint -> song notes (ticks), merging ties for playback/notation */
export function counterpointToNotes(cp, { ppq = 960, startTick = 0 } = {}) {
  const unit = ppq; // 1 unit = quarter note
  const out = [];
  for (const n of cp) {
    if (n.pitch === null) continue;
    const last = out[out.length - 1];
    if (n.tie && last && last.pitch === n.pitch && last.start + last.dur === startTick + n.start * unit) last.dur += n.dur * unit;
    else out.push({ start: startTick + n.start * unit, dur: n.dur * unit, pitch: n.pitch, vel: 80 });
  }
  return out;
}

export function cantusToNotes(cf, { ppq = 960, startTick = 0 } = {}) {
  return cf.map((p, i) => ({ start: startTick + i * BAR * ppq, dur: BAR * ppq, pitch: p, vel: 80 }));
}
