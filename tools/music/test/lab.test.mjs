import test from 'node:test';
import assert from 'node:assert/strict';
import * as IR from '../src/ir.mjs';
import * as RH from '../src/lab/rhythm.mjs';
import * as NR from '../src/lab/neoriemannian.mjs';
import * as PC from '../src/lab/pcset.mjs';
import * as TU from '../src/lab/tuning.mjs';
import * as AL from '../src/lab/algorithmic.mjs';
import * as MU from '../src/lab/madeup.mjs';
import { parseMidi } from '../src/io/midi.mjs';
import { texToGp } from '../src/io/gp.mjs';
import { toAlphaTex } from '../src/io/alphatex.mjs';
import { makeRng } from '../src/rng.mjs';

test('Euclidean rhythms match the known patterns (up to rotation)', () => {
  const known = { '3,8': 'x..x..x.', '5,8': 'x.xx.xx.', '2,5': 'x.x..', '3,7': 'x.x.x..', '4,9': 'x.x.x.x..', '5,12': 'x..x.x..x.x.', '7,12': 'x.xx.x.xx.x.', '5,16': 'x..x..x..x..x...', '9,16': 'x.xx.x.x.xx.x.x.' };
  for (const [kn, pat] of Object.entries(known)) {
    const [k, n] = kn.split(',').map(Number);
    const e = RH.euclid(k, n);
    assert.equal(e.reduce((a, b) => a + b, 0), k);
    assert.ok(RH.necklace(e).includes(pat), `E(${k},${n}) = ${RH.toString(e)} is a rotation of ${pat}`);
  }
  for (let n = 1; n <= 24; n++) for (let k = 0; k <= n; k++) {
    const iv = RH.intervals(RH.euclid(k, n));
    if (k) assert.ok(Math.max(...iv) - Math.min(...iv) <= 1, `E(${k},${n}) gaps differ by at most 1`);
  }
  assert.ok(RH.evenness(RH.euclid(5, 8)) > RH.evenness('xxxxx...'));
  assert.deepEqual(RH.intervals('x..x..x.'), [3, 3, 2]);
  assert.equal(RH.toString(RH.additive('3+3+2')), 'x..x..x.');
});

test('polymeter, polyrhythm, rhythm trees, phasing', () => {
  const pm = RH.polymeter([{ pattern: 'x..', pitch: 'kick' }, { pattern: 'x...', pitch: 'snare' }, { pattern: 'x....', pitch: 'hh' }]);
  assert.equal(pm.steps, 60);
  assert.equal(pm.events.filter((e) => e.layer === 0).length, 20);
  assert.deepEqual(RH.polyrhythm(3, 2, 1920), { a: [0, 640, 1280], b: [0, 960] });
  const tree = RH.rhythmTree([1, [1, [1, [1, 1]], 2]], 3840);
  assert.deepEqual(tree.map((x) => x.dur), [960, 480, 480, 1920]);
  assert.throws(() => RH.rhythmTree([1, [1, 1, 1]], 100, { grid: 10 }), /can't be split/);
  const ph = RH.phase('x.xx.', { repeats: 2 });
  assert.equal(ph.length, 12);
  assert.equal(RH.metricModulation(120, 3, 2), 80);
  const s = IR.createSong({ bars: 4 });
  const d = IR.addTrack(s, { name: 'D', kind: 'drums' });
  RH.writePolymeter(s, d, [{ pattern: RH.euclid(3, 8), pitch: 'kick' }, { pattern: RH.euclid(5, 7), pitch: 'hh' }, { pattern: 'x...x', pitch: 'snare' }]);
  RH.writePattern(s, d, RH.euclid(7, 16), { bar: 0, bars: 4, pitch: 'rim' });
  assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), []);
});

test('neo-Riemannian transformations', () => {
  assert.equal(NR.apply('C', 'P').result, 'Cm');
  assert.equal(NR.apply('C', 'L').result, 'Em');
  assert.equal(NR.apply('C', 'R').result, 'Am');
  assert.equal(NR.apply('Am', 'R').result, 'C');
  assert.equal(NR.apply('C', 'N').result, 'Fm');
  assert.equal(NR.apply('C', 'S').result, 'C#m');
  assert.equal(NR.apply('C', 'H').result, 'G#m');
  for (const op of 'PLR') for (const t of ['C', 'Am', 'F#', 'Ebm']) {
    assert.equal(NR.apply(t, op + op).result, NR.triadName(NR.triad(t)), `${op} is an involution on ${t}`);
    assert.equal(NR.voiceLeadingDistance(t, NR.apply(t, op).result), op === 'R' ? 2 : op === 'L' ? 1 : 1, `${op} moves one voice`);
  }
  assert.deepEqual(NR.hexatonicCycle('C'), ['C', 'Cm', 'Ab', 'G#m', 'E', 'Em']);
  assert.equal(NR.octatonicCycle('C').length, 8);
  assert.equal(NR.lrChain('C').length, 24);
  assert.equal(NR.shortestPath('C', 'Ebm').path.length, 4);
  const walk = NR.tonnetzWalk('C', 16, makeRng(1));
  for (let i = 1; i < walk.length; i++) assert.ok(NR.voiceLeadingDistance(walk[i - 1], walk[i]) <= 2);
});

test('pitch-class sets: set-class counts, prime forms, vectors', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((c) => PC.setClasses(c).length), [1, 1, 6, 12, 29, 38, 50, 38, 29, 12, 6, 1, 1]);
  assert.deepEqual(PC.primeForm([0, 4, 7]), [0, 3, 7]);
  assert.deepEqual(PC.primeForm([2, 5, 9]), [0, 3, 7]);
  assert.deepEqual(PC.primeForm([11, 0, 4, 8]), [0, 1, 4, 8]);
  assert.deepEqual(PC.primeForm([0, 1, 5, 6, 8]), [0, 1, 5, 6, 8], 'Rahn 5-20');
  assert.deepEqual(PC.intervalVector([0, 4, 7]), [0, 0, 1, 1, 1, 0]);
  assert.deepEqual(PC.intervalVector([0, 2, 4, 5, 7, 9, 11]), [2, 5, 4, 3, 6, 1]);
  assert.ok(PC.zRelated([0, 1, 4, 6], [0, 1, 3, 7]));
  assert.ok(PC.relations([0, 4, 7], [0, 3, 7]).includes('T7I'));
  // complements share the hexachord vector (hexachord theorem)
  for (const h of PC.setClasses(6)) {
    const comp = PC.complementSet(h);
    assert.deepEqual(PC.intervalVector(h), PC.intervalVector(comp));
  }
});

test('twelve-tone: matrix, forms, all-interval, combinatoriality', () => {
  const row = [0, 11, 7, 8, 3, 1, 2, 10, 6, 5, 4, 9];
  const m = PC.rowMatrix(row);
  assert.deepEqual(m.map((r, i) => r[i]), new Array(12).fill(0), 'diagonal is all P0 start');
  for (const r of m) assert.ok(PC.isRow(r));
  const f = PC.rowForms(row);
  assert.deepEqual(f.R0, f.P0.slice().reverse());
  assert.deepEqual(f.I0, f.P0.map((x) => (12 - x) % 12));
  assert.ok(PC.isAllInterval([0, 1, 3, 2, 9, 5, 10, 4, 7, 11, 8, 6]));
  for (let seed = 1; seed <= 5; seed++) assert.ok(PC.isAllInterval(PC.randomRow({ seed, allInterval: true })));
  assert.deepEqual(PC.combinatoriality([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).P, ['P6']);
  const notes = PC.rowToNotes(f.P0);
  assert.equal(notes.length, 12);
  assert.throws(() => PC.rowForms([0, 1, 2]), /all 12/);
});

test('tuning: cents, EDO errors, temperaments, Scala, microtonal MIDI', () => {
  assert.equal(+TU.cents(3 / 2).toFixed(3), 701.955);
  assert.equal(+TU.edoErrors(12)[0].error.toFixed(3), -1.955);
  assert.ok(Math.abs(TU.edoErrors(31)[1].error) < 1, '31-EDO thirds are nearly pure');
  const mt = TU.getScale('meantone 1/4');
  assert.ok(Math.abs(mt.steps[3] - TU.cents(5 / 4)) < 0.01, 'meantone major third is pure');
  const scl = TU.toScala('just major');
  const back = TU.parseScala(scl);
  assert.deepEqual(back.steps.map((x) => x.toFixed(6)), TU.getScale('just major').steps.map((x) => x.toFixed(6)));
  assert.deepEqual(TU.monzo('81/80'), [-4, 4, -1, 0, 0, 0]);
  assert.equal(TU.degreeFreq('12-edo', 9, 261.6256).toFixed(2), '440.00');
  const mid = parseMidi(TU.microtonalMidi([{ start: 0, dur: 960, degree: 0 }, { start: 0, dur: 960, degree: 2 }, { start: 960, dur: 960, degree: 4 }], { scale: 'just major' }));
  const bends = mid.tracks[1].events.filter((e) => e.type === 0xe0);
  assert.equal(bends.length, 3);
  const third = bends[1];
  const value = third.d1 | (third.d2 << 7);
  const bendCents = ((value - 8192) / 8192) * 200;
  assert.ok(Math.abs(bendCents - (TU.cents(5 / 4) - 400)) < 0.2, `just third bent ${bendCents.toFixed(2)} cents`);
  const chans = new Set(mid.tracks[1].events.filter((e) => e.type === 0x90).map((e) => e.ch));
  assert.ok(chans.size >= 2, 'simultaneous notes on separate channels');
});

test('algorithmic: L-systems, CA, chaos, sieves, numerology, mapping', () => {
  assert.equal(AL.lsystem('A', { A: 'AB', B: 'A' }, 5), 'ABAABABAABAAB');
  const mel = AL.turtleMelody(AL.lsystem('F', { F: 'F+F-F' }, 3));
  assert.equal(mel.length, 27);
  const ca = AL.elementaryCA(90, { width: 15, generations: 8 });
  assert.equal(ca.length, 8);
  assert.deepEqual(ca[1].join(''), '000000101000000');
  const lg = AL.logistic(50);
  assert.ok(lg.every((x) => x > 0 && x < 1));
  const w = AL.randomWalk(100, { seed: 1, min: -5, max: 5 });
  assert.ok(w.every((x) => x >= -5 && x <= 5));
  assert.deepEqual(AL.sieve('3@0 | 4@1', 0, 12), [0, 1, 3, 5, 6, 9, 12]);
  assert.deepEqual(AL.sieve('(3@0 | 4@1) & !2@0', 0, 12), [1, 3, 5, 9]);
  assert.throws(() => AL.sieve('3@0 |', 0, 5));
  assert.deepEqual(AL.letterValues('abc'), [1, 2, 3]);
  assert.equal(AL.digitRoot(1987), 7);
  assert.equal(AL.digitRoot(29, { keepMasters: true }), 11);
  assert.deepEqual(AL.fibonacciWord(8), [1, 0, 1, 1, 0, 1, 0, 1]);
  const gs = AL.grayScott1D({ cells: 32, steps: 500, seed: 1 });
  assert.equal(gs.length, 32);
  assert.ok(gs.every((v) => Number.isFinite(v)));
  const s = IR.createSong({ bars: 4, key: 'D minor' });
  const t = IR.addTrack(s, { name: 'L', kind: 'pitched' });
  t.notes.push(...AL.toNotes(AL.wordNumbers('our father who art in heaven').map((x) => x % 8), { key: 'D minor', unit: 960 }));
  t.notes.push(...AL.toNotes(AL.logistic(16), { normalize: true, key: 'D minor', unit: 240, start: 3840 * 2 }));
  assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), []);
});

test('made-up theories generate lines that satisfy their own rules', async () => {
  for (const [name, th] of Object.entries(MU.THEORIES)) {
    const line = MU.generateFromTheory(th, { length: name === 'mirror law' ? 11 : 12, seed: 4 });
    assert.deepEqual(MU.checkTheory(th, line), [], name);
    const notes = MU.theoryToNotes(th, line);
    assert.equal(notes.length, line.length);
  }
  const custom = {
    name: 'Whole-tone climber', pitch: { scale: 'whole tone' }, tonic: 60, range: [0, 12],
    intervals: { allowed: [-1, 1, 2] }, rhythm: { durations: [2, 4], unit: 240, barUnits: 16 },
    rules: [{ type: 'start', degrees: [0] }, { type: 'cadence', pattern: [1, 0] }, { type: 'avoid', degrees: [3] }],
  };
  const line = MU.generateFromTheory(custom, { length: 10, seed: 2 });
  assert.deepEqual(MU.checkTheory(custom, line), []);
  assert.ok(line.every((x) => x.degree % 6 !== 3));
  assert.throws(() => MU.checkTheory({ rules: [{ type: 'nope' }] }, line), /Unknown rule/);
  // a theory line can go straight to GP through the song IR
  const s = IR.createSong({ bars: 4 });
  const tr = IR.addTrack(s, { name: 'T', kind: 'pitched' });
  for (const n of MU.theoryToNotes(MU.THEORIES['golden steps'], MU.generateFromTheory(MU.THEORIES['golden steps'], { length: 12, seed: 5 }))) {
    if (n.start + n.dur <= IR.totalTicks(s)) tr.notes.push({ start: n.start, dur: n.dur, pitch: n.pitch, vel: 90 });
  }
  const { issues } = await texToGp(toAlphaTex(s));
  assert.deepEqual(issues.filter((i) => i.level === 'error'), []);
});
