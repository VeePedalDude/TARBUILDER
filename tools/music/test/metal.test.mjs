import test from 'node:test';
import assert from 'node:assert/strict';
import * as IR from '../src/ir.mjs';
import { GROOVES, writeGroove } from '../src/gen/drums.mjs';
import { breakdownRiff, BREAKDOWN } from '../src/gen/riffs.mjs';
import { arrange } from '../src/gen/arranger.mjs';
import { texToGp } from '../src/io/gp.mjs';
import { toAlphaTex } from '../src/io/alphatex.mjs';
import { midi } from '../src/theory/pitch.mjs';

const onsets = (notes, t0, t1, pitch) => [...new Set(notes.filter((n) => n.start >= t0 && n.start < t1 && (pitch === undefined || n.pitch === pitch)).map((n) => n.start))].sort((a, b) => a - b);

test('metal tunings: strings run high to low, drop tunings drop the low string a tone', () => {
  for (const name of ['b standard', 'drop a', '7 string drop a', '7 string drop g', '8 string', 'bass drop c', 'bass 5 drop a']) {
    const m = IR.tuning(name).map(midi);
    for (let i = 1; i < m.length; i++) assert.ok(m[i] < m[i - 1], `${name} string ${i + 1} below string ${i}`);
  }
  assert.equal(IR.tuning('drop a').at(-1), 'A1');
  assert.equal(IR.tuning('7 string drop g').at(-1), 'G1');
  assert.equal(IR.tuning('8 string').at(-1), 'F#1');
  // drop: low string a perfect fifth under the next
  for (const name of ['drop a', '7 string drop a', '7 string drop g']) {
    const m = IR.tuning(name).map(midi);
    assert.equal(m.at(-2) - m.at(-1), 7, name);
  }
});

test('two-bar grooves: quarter time puts one snare in every second bar', () => {
  const s = IR.createSong({ bars: 4 });
  const d = IR.addTrack(s, { name: 'D', kind: 'drums' });
  writeGroove(s, d, 0, 4, { groove: 'quarter time', crashOnFirst: false, seed: 1 });
  const snareBars = d.notes.filter((n) => n.pitch === IR.DRUM.snare).map((n) => IR.barAt(s, n.start));
  assert.deepEqual(snareBars, [1, 3]);
  for (const name of ['skank', 'gravity blast', 'double kick']) assert.ok(GROOVES[name], name);
  assert.throws(() => writeGroove(s, d, 0, 1, { groove: { meter: [4, 4], steps: 16, bars: 2, lanes: { kick: 'x...' } } }), /expected 32/);
});

test('breakdown riff: kick locked to guitar, written rests, half/quarter snare, escalation, fingering', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const feel of ['half', 'quarter']) {
      const s = IR.createSong({ bars: 4, key: 'A minor', tempo: 160 });
      const g = IR.addTrack(s, { name: 'G', kind: 'fretted', tuning: 'drop a' });
      const d = IR.addTrack(s, { name: 'D', kind: 'drums' });
      const r = breakdownRiff(s, g, { drums: d, seed, feel });
      const end = IR.totalTicks(s);
      assert.deepEqual(onsets(g.notes, 0, end), onsets(d.notes, 0, end, IR.DRUM.kick), `seed ${seed}: kick = guitar onsets`);
      for (const n of g.notes) assert.equal(midi(g.tuning[n.string - 1]) + n.fret, n.pitch, 'fingering');
      assert.equal(Math.min(...g.notes.map((n) => n.pitch)), midi('A1'), 'root on the open low string');
      for (let b = 0; b < 4; b++) {
        const pat = r.patterns[b];
        assert.equal(pat.length, BREAKDOWN.steps);
        assert.match(pat[0], /[xm]/, 'downbeat struck');
        assert.ok([...pat].filter((c) => c === '.').length >= BREAKDOWN.minRests, `bar ${b} keeps ${BREAKDOWN.minRests} rests: ${pat}`);
        const bs = IR.barStart(s, b);
        const snares = onsets(d.notes, bs, bs + IR.barLength(s, b), IR.DRUM.snare);
        const want = feel === 'half' || b % 2 === 1 ? [bs + IR.barLength(s, b) / 2] : [];
        assert.deepEqual(snares, want, `${feel} snare in bar ${b}`);
      }
      const hits = (p) => [...p].filter((c) => c === 'x' || c === 'm').length;
      assert.ok(hits(r.patterns[3]) >= hits(r.patterns[0]), 'second pass is at least as dense');
      assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), []);
    }
  }
  const a = IR.createSong({ bars: 2, key: 'A minor' });
  const b = IR.createSong({ bars: 2, key: 'A minor' });
  const ga = IR.addTrack(a, { name: 'G', kind: 'fretted', tuning: 'drop a' });
  const gb = IR.addTrack(b, { name: 'G', kind: 'fretted', tuning: 'drop a' });
  assert.deepEqual(breakdownRiff(a, ga, { seed: 9 }).notes, breakdownRiff(b, gb, { seed: 9 }).notes, 'deterministic');
});

test('arranger: metalcore and deathcore breakdowns sit on the tonic, double the bass and escalate', async () => {
  for (const genre of ['metalcore', 'deathcore']) {
    const s = arrange({ genre, seed: 4 });
    const g = s.tracks.find((t) => t.name === 'Rhythm Guitar');
    const d = s.tracks.find((t) => t.name === 'Drums');
    const bass = s.tracks.find((t) => t.name === 'Bass');
    const bds = s.sections.filter((x) => x.name === 'Breakdown');
    assert.ok(bds.length >= 1, `${genre} has a breakdown`);
    const snareCounts = [];
    for (const sec of bds) {
      const t0 = IR.barStart(s, sec.bar);
      const next = s.sections.find((x) => x.bar > sec.bar);
      const t1 = next ? IR.barStart(s, next.bar) : IR.totalTicks(s);
      assert.ok(s.chords.filter((c) => c.start >= t0 && c.start < t1).every((c) => /^i$|^I$/.test(c.roman)), 'tonic only');
      assert.deepEqual(onsets(g.notes, t0, t1), onsets(d.notes, t0, t1, IR.DRUM.kick), 'kick locked');
      assert.deepEqual(onsets(bass.notes, t0, t1), onsets(g.notes, t0, t1), 'bass doubles the chugs');
      snareCounts.push(onsets(d.notes, t0, t1, IR.DRUM.snare).length);
    }
    if (genre === 'deathcore') {
      assert.ok(snareCounts.at(-1) < snareCounts[0], 'last breakdown drops to quarter time');
      assert.ok(!s.tracks.some((t) => t.name === 'Lead'), 'no clean lead in deathcore');
    } else assert.ok(s.tracks.some((t) => t.name === 'Lead'), 'metalcore keeps the clean chorus lead');
    const { issues } = await texToGp(toAlphaTex(s));
    assert.deepEqual(issues.filter((i) => i.level === 'error'), [], `${genre} passes tarb`);
  }
});
