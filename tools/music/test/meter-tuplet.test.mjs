import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as IR from '../src/ir.mjs';
import { notate, makeRegion, addRegion, frac, fadd } from '../src/tuplets.mjs';
import { nestedRhythm, branchingTree, mutateTree, beatGroups, phraseRhythm, writeTree, BRANCH } from '../src/lab/branching.mjs';
import { meterGrouping, additiveGroove, writeGroove } from '../src/gen/drums.mjs';
import { arrange } from '../src/gen/arranger.mjs';
import { toAlphaTex } from '../src/io/alphatex.mjs';
import { toMusicXml } from '../src/io/musicxml.mjs';
import { toLilyPond } from '../src/io/lilypond.mjs';
import { toMidi, parseMidi } from '../src/io/midi.mjs';
import { texToGp, importScore } from '../src/io/gp.mjs';

const tarbClean = async (song) => (await texToGp(toAlphaTex(song))).issues.filter((i) => i.level !== 'hint');

test('notate: any rational duration gets a note value and a tuplet ratio', () => {
  const cases = [
    [[1, 3], { den: 8, dots: 0, n: 3, m: 2 }],
    [[2, 3], { den: 4, dots: 0, n: 3, m: 2 }],
    [[1, 5], { den: 16, dots: 0, n: 5, m: 4 }],
    [[2, 5], { den: 8, dots: 0, n: 5, m: 4 }],
    [[1, 7], { den: 16, dots: 0, n: 7, m: 4 }],
    [[1, 15], { den: 32, dots: 0, n: 15, m: 8 }],
    [[1, 4], { den: 16, dots: 0, n: 1, m: 1 }],
    [[3, 8], { den: 16, dots: 1, n: 1, m: 1 }],
    [[3, 2], { den: 4, dots: 1, n: 1, m: 1 }],
  ];
  for (const [q, want] of cases) assert.deepEqual(notate(q), want, `${q[0]}/${q[1]} quarter`);
});

test('regions: septuplet ticks are rounded but always add up; validation guards leaf boundaries', () => {
  const r = makeRegion(0, Array(7).fill({ dur: frac(1, 7) }));
  assert.equal(r.dur, 960);
  assert.equal(r.leaves.reduce((a, l) => a + l.ticks, 0), 960);
  assert.ok(r.leaves.every((l, i) => i === 0 || l.start === r.leaves[i - 1].start + r.leaves[i - 1].ticks));
  const s = IR.createSong({ bars: 1 });
  const g = IR.addTrack(s, { name: 'G', kind: 'pitched' });
  addRegion(s, g, r);
  g.notes.push({ start: r.leaves[1].start, dur: r.leaves[1].ticks, pitch: 60, vel: 90 });
  assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), []);
  g.notes.push({ start: 150, dur: 120, pitch: 62, vel: 90 });
  assert.ok(IR.validateSong(s).some((e) => /tuplet leaf boundaries/.test(e.message)), 'off-leaf note is caught');
  assert.throws(() => addRegion(s, g, makeRegion(0, [{ dur: frac(1, 3) }, { dur: frac(2, 3) }])), /overlap/);
  assert.throws(() => addRegion(s, g, makeRegion(3840 - 960 + 0, Array(3).fill({ dur: frac(2, 3) }))), /barline/);
  assert.throws(() => makeRegion(0, [{ dur: frac(1, 7) }]), /whole number of ticks/);
});

test('nested trees: exact leaves, the [w, [kids]] node rule, deterministic branching', () => {
  const leaves = nestedRhythm([[1, [1, 1, 1, 1, 1]], 1, 1]);
  assert.deepEqual(leaves.map((l) => l.dur), [...Array(5).fill([1, 15]), [1, 3], [1, 3]]);
  assert.deepEqual(leaves.reduce((a, l) => fadd(a, l.dur), [0, 1]), [1, 1]);
  assert.equal(nestedRhythm([1, [1, 1]]).length, 2, 'a [number, array] pair is a node');
  assert.equal(nestedRhythm([3, -1, 2]).filter((l) => l.rest).length, 1);
  for (let seed = 1; seed <= 30; seed++) {
    const t = branchingTree({ seed, splits: [2, 3, 5, 7], depth: 3, span: [1, 1] });
    assert.deepEqual(t, branchingTree({ seed, splits: [2, 3, 5, 7], depth: 3, span: [1, 1] }), 'deterministic');
    const ls = nestedRhythm(t);
    assert.deepEqual(ls.reduce((a, l) => fadd(a, l.dur), [0, 1]), [1, 1], 'fills the span');
    assert.ok(ls.every((l) => l.dur[0] * BRANCH.minLeaf[1] >= l.dur[1] * BRANCH.minLeaf[0]), 'no leaf under minLeaf');
    assert.ok(!ls[0].rest, 'first leaf sounds');
    const m = mutateTree(t, { seed, op: 'rebranch' });
    assert.deepEqual(nestedRhythm(m).reduce((a, l) => fadd(a, l.dur), [0, 1]), [1, 1], 'mutation keeps the span');
  }
  const top = branchingTree({ seed: 3, top: 5, depth: 0 })[1];
  assert.equal(top.reduce((a, w) => a + Math.abs(typeof w === 'number' ? w : w[0]), 0), 5, 'forced top split into 5 units');
});

test('meters: grouping, additive grooves and beat groups', () => {
  assert.deepEqual(meterGrouping(7, 8), [2, 2, 3]);
  assert.deepEqual(meterGrouping(5, 8), [2, 3]);
  assert.deepEqual(meterGrouping(6, 8), [3, 3]);
  assert.deepEqual(meterGrouping(13, 16), [4, 3, 3, 3]);
  assert.deepEqual(meterGrouping(5, 4), [1, 1, 1, 1, 1]);
  const g = additiveGroove(7, 8);
  assert.equal(g.steps, 14);
  assert.equal(g.lanes.kick, 'x.......x.....');
  assert.equal(g.lanes.snare, '....x.........');
  const s = IR.createSong({ bars: 3, meter: [7, 8] });
  s.meterChanges.push({ bar: 1, num: 13, den: 16 }, { bar: 2, num: 5, den: 4 });
  const d = IR.addTrack(s, { name: 'D', kind: 'drums' });
  writeGroove(s, d, 0, 1, { groove: g, seed: 1 });
  writeGroove(s, d, 1, 2, { groove: additiveGroove(13, 16, { style: 'skank' }), seed: 1 });
  writeGroove(s, d, 2, 3, { groove: additiveGroove(5, 4, { style: 'halftime' }), seed: 1 });
  assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), []);
  assert.deepEqual(beatGroups(s, 1).map((x) => x.ticks), [960, 720, 720, 720]);
});

test('phraseRhythm: a a\' b a phrasing, layers split differently, exports everywhere', async () => {
  const s = IR.createSong({ bars: 4, meter: [7, 8], tempo: 150, key: 'E minor' });
  s.meterChanges.push({ bar: 2, num: 13, den: 16 }, { bar: 3, num: 7, den: 8 });
  const g = IR.addTrack(s, { name: 'Gtr', kind: 'fretted', program: 'Distortion Guitar' });
  const d = IR.addTrack(s, { name: 'Drums', kind: 'drums' });
  const rep = phraseRhythm(s, { seed: 7, form: "a a' b a", layers: [
    { track: g, pitches: ['E2', 'F2', 'E2', 'A#2'], splits: [3, 5], depth: 1 },
    { track: d, pitches: ['kick', 'snare'], splits: [2, 4], depth: 1 },
  ] });
  const gb = rep[0].bars;
  assert.deepEqual(gb[3].trees, gb[0].trees, 'bar 4 restates a');
  assert.notDeepEqual(gb[1].trees, gb[0].trees, "a' varies a");
  assert.notDeepEqual(rep[1].bars[0].trees, gb[0].trees, 'drums branch differently from the guitar');
  assert.equal(g.tuplets.length, 3 + 3 + 4 + 3, 'one region per beat group');
  assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), []);
  assert.deepEqual(await tarbClean(s), [], 'alphaTex -> GP7 passes tarb');
  const xml = toMusicXml(s);
  assert.ok(/<time-modification><actual-notes>[35]<\/actual-notes>/.test(xml));
  assert.equal((xml.match(/<tuplet type="start"/g) ?? []).length, (xml.match(/<tuplet type="stop"/g) ?? []).length);
  assert.ok(/\\tuplet [35]\/[24] \{/.test(toLilyPond(s)));
  const midi = parseMidi(toMidi(s));
  const total = midi.tracks.reduce((a, t) => a + (t.notes?.length ?? 0), 0);
  assert.equal(total, g.notes.length + d.notes.length, 'every note reaches the MIDI file');
});

test('GP round-trip keeps tuplets exact (regions rebuilt on import)', async () => {
  const s = IR.createSong({ bars: 2, tempo: 120 });
  const g = IR.addTrack(s, { name: 'G', kind: 'fretted' });
  writeTree(s, g, { start: 0, span: 960, tree: [[1, [1, 1, 1, 1, 1]], 1, 1], pitches: [40, 41, 43] });
  writeTree(s, g, { start: 960, span: 960, tree: Array(7).fill(1), pitches: [45] });
  g.notes.push({ start: 1920, dur: 1920 + 3840, pitch: 40, vel: 90 });
  const { gp } = await texToGp(toAlphaTex(s));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-tu-'));
  const f = path.join(dir, 'tu.gp');
  fs.writeFileSync(f, gp);
  const back = await importScore(f);
  const key = (t) => t.notes.map((n) => `${n.start}:${n.pitch}`).sort().join();
  assert.equal(key(back.tracks[0]), key(g), 'same onsets and pitches');
  const ratios = back.tracks[0].tuplets.flatMap((r) => r.leaves.map((l) => l.n + ':' + l.m));
  assert.deepEqual(ratios, [...Array(5).fill('15:8'), '3:2', '3:2', ...Array(7).fill('7:4')], 'every leaf keeps its ratio');
  assert.deepEqual(IR.validateSong(back).filter((e) => e.level === 'error'), []);
  // a whole mathcore arrangement (meter changes, 64ths, rounding drift after septuplets) comes back note for note
  const m = arrange({ genre: 'mathcore', seed: 6 });
  const f2 = path.join(dir, 'math.gp');
  fs.writeFileSync(f2, (await texToGp(toAlphaTex(m))).gp);
  const mb = await importScore(f2);
  m.tracks.forEach((t, i) => assert.equal(key(mb.tracks[i]), key(t), `${t.name} round-trips`));
  assert.deepEqual(mb.meterChanges.map((x) => `${x.bar}:${x.num}/${x.den}`), m.meterChanges.map((x) => `${x.bar}:${x.num}/${x.den}`));
  assert.deepEqual(IR.validateSong(mb).filter((e) => e.level === 'error'), []);
});

test('arranger: per-section meters and the mathcore preset (polymeter cell, branching cell, breakdown)', async () => {
  const s = arrange({ genre: 'mathcore', seed: 6 });
  const meters = new Set([s.meter, ...s.meterChanges].map((m) => `${m.num}/${m.den}`));
  for (const m of ['7/8', '5/8', '13/16', '4/4']) assert.ok(meters.has(m), `uses ${m}`);
  assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), []);
  assert.deepEqual(await tarbClean(s), [], 'mathcore passes tarb');
  const g = s.tracks.find((t) => t.name === 'Rhythm Guitar');
  const d = s.tracks.find((t) => t.name === 'Drums');
  const bass = s.tracks.find((t) => t.name === 'Bass');
  const sec = (name) => {
    const x = s.sections.find((y) => y.name === name);
    const nx = s.sections.find((y) => y.bar > x.bar);
    return [IR.barStart(s, x.bar), nx ? IR.barStart(s, nx.bar) : IR.totalTicks(s)];
  };
  const on = (t, [a, z], p) => [...new Set(t.notes.filter((n) => n.start >= a && n.start < z && (p === undefined || n.pitch === p)).map((n) => n.start))].sort((x, y) => x - y);
  // Cell B: a 7-sixteenth cycle against 4/4, kick locked to it
  const cb = sec('Cell B');
  const go = on(g, cb);
  assert.deepEqual(go, on(d, cb, IR.DRUM.kick), 'kick follows the 7-cycle');
  const steps = new Set(go.map((t) => (t - cb[0]) / 240));
  const total = (cb[1] - cb[0]) / 240;
  assert.ok([...steps].every((k) => k + 7 >= total || steps.has(k + 7)), 'the riff repeats every 7 sixteenths');
  const perBar = (b) => [...steps].filter((k) => Math.floor(k / 16) === b).map((k) => k % 16).join();
  assert.notEqual(perBar(0), perBar(1), 'so it lands differently in each 4/4 bar');
  // Spiral: nested tuplets on guitar and drums, bass mirrors the guitar's regions
  const sp = sec('Spiral');
  const inSp = (r) => r.start >= sp[0] && r.start < sp[1];
  assert.ok(g.tuplets.filter(inSp).some((r) => r.leaves.some((l) => l.n !== l.m)), 'guitar has tuplets');
  assert.ok(d.tuplets.filter(inSp).length > 0, 'drums have tuplets');
  assert.deepEqual(bass.tuplets.filter(inSp).map((r) => r.start), g.tuplets.filter(inSp).map((r) => r.start));
  assert.deepEqual(on(bass, sp), on(g, sp), 'bass doubles the guitar');
  assert.ok(s.sections.some((x) => x.name === 'Breakdown'));
  assert.deepEqual(arrange({ genre: 'mathcore', seed: 6 }), s, 'deterministic');
  // a plain genre with a custom form that changes meter
  const r = arrange({ genre: 'rock', seed: 2, form: [['Verse', 4, 0.7, { meters: [[7, 8]] }], ['Chorus', 4, 0.9, { meters: [[4, 4], [3, 4]] }]] });
  assert.deepEqual(r.meterChanges.map((m) => `${m.bar}:${m.num}/${m.den}`), ['4:4/4', '5:3/4', '6:4/4', '7:3/4']);
  assert.deepEqual(await tarbClean(r), [], 'rock in changing meters passes tarb');
});

test('robustness: every genre survives changing odd meters, tuplet cells and polymeter cells', async () => {
  const sets = [[[7, 8]], [[5, 4], [3, 4]], [[13, 16]], [[6, 8]], [[7, 8], [5, 8], [13, 16]], [[9, 8], [4, 4]], [[2, 4]], [[11, 8]], [[3, 8], [15, 16]], [[5, 16], [7, 16]]];
  let k = 0;
  for (const genre of Object.keys((await import('../src/gen/form.mjs')).GENRES)) {
    const a = sets[k++ % sets.length];
    const b = sets[(k * 3) % sets.length];
    const form = [['Intro', 2, 0.5, { meters: a }], ['Verse', 4, 0.7, { meters: b }], ['Chorus', 4, 0.9, { meters: a }], ['Breakdown', 2, 0.95, { meters: [[4, 4]] }],
      ['Spiral', 2, 0.8, { meters: b, branching: true }], ['Cell', 2, 0.8, { meters: [[4, 4]], poly: 5 }], ['Outro', 2, 0.4, { meters: b }]];
    const s = arrange({ genre, seed: k, form });
    assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), [], genre);
    assert.deepEqual(await tarbClean(s), [], `${genre} tarb`);
    toMusicXml(s);
    toLilyPond(s);
    toMidi(s);
  }
});
