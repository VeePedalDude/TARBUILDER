import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as IR from '../src/ir.mjs';
import { splitSpan } from '../src/io/notation.mjs';
import { assignFrets } from '../src/io/fret.mjs';
import { toAlphaTex } from '../src/io/alphatex.mjs';
import { toMidi, parseMidi } from '../src/io/midi.mjs';
import { toMusicXml } from '../src/io/musicxml.mjs';
import { toLilyPond } from '../src/io/lilypond.mjs';
import { texToGp, importScore, alphatab } from '../src/io/gp.mjs';
import { render } from '../src/io/render.mjs';
import { makeRng } from '../src/rng.mjs';
import { midi } from '../src/theory/pitch.mjs';

const Q = 960;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-io-'));

function demoSong(meter = [4, 4], bars = 4) {
  const s = IR.createSong({ title: 'IO', tempo: 100, key: 'E minor', bars, meter });
  const barLen = IR.barLength(s, 0);
  s.sections.push({ bar: 0, name: 'A' });
  const g = IR.addTrack(s, { name: 'Guitar', kind: 'fretted', program: 'Distortion Guitar' });
  const m = IR.addTrack(s, { name: 'Lead', kind: 'pitched', program: 'Flute' });
  const b = IR.addTrack(s, { name: 'Bass', kind: 'fretted', program: 33, tuning: 'bass' });
  const d = IR.addTrack(s, { name: 'Drums', kind: 'drums' });
  const rng = makeRng('io');
  for (let i = 0; i < bars; i++) {
    const bs = i * barLen;
    for (const p of ['E2', 'B2', 'E3']) IR.addNote(g, bs, barLen, p);
    IR.addNote(b, bs, barLen / 2, 'E1');
    IR.addNote(b, bs + barLen / 2, barLen / 2, 'B1');
    s.chords.push({ start: bs, dur: barLen, symbol: 'Em' });
    for (let t = 0; t < barLen; t += 480) {
      IR.addNote(d, bs + t, 480, 'hh');
      if (t === 0) IR.addNote(d, bs + t, 480, 'kick');
    }
  }
  // melody with random grid-aligned durations crossing barlines
  let t = 0;
  const end = IR.totalTicks(s);
  while (t < end) {
    const dur = Math.min(rng.pick([240, 480, 720, 960, 1440, 1920]), end - t);
    IR.addNote(m, t, dur, 64 + rng.int(0, 12));
    t += dur;
  }
  return s;
}

const noteSet = (track) => track.notes.map((n) => `${n.start}:${n.dur}:${n.pitch}`).sort().join(' ');

test('splitSpan: pieces always sum to the span and stay aligned', () => {
  const rng = makeRng('split');
  for (const [num, den] of [[4, 4], [3, 4], [6, 8], [7, 8], [5, 4], [2, 2], [12, 8]]) {
    const s = IR.createSong({ meter: [num, den], bars: 1 });
    const barLen = IR.barLength(s, 0);
    const beat = IR.beatTicks(s, 0);
    for (let i = 0; i < 400; i++) {
      const pos = rng.int(0, barLen / 120 - 1) * 120;
      const dur = rng.int(1, (barLen - pos) / 120) * 120;
      const pieces = splitSpan(pos, dur, { beat, barLen });
      assert.equal(pieces.reduce((a, p) => a + p.ticks, 0), dur, `${num}/${den} ${pos}+${dur}`);
      let p = pos;
      for (const pc of pieces) {
        const base = pc.dots ? (pc.ticks * 2) / 3 : pc.ticks;
        assert.equal(p % Math.min(base, 3840), 0, `aligned ${num}/${den} piece at ${p}`);
        assert.ok([1, 2, 4, 8, 16, 32, 64].includes(pc.den));
        p += pc.ticks;
      }
    }
  }
  assert.deepEqual(splitSpan(0, 2880, { beat: 960, barLen: 2880 }), [{ ticks: 2880, den: 2, dots: 1 }]);
  assert.deepEqual(splitSpan(240, 720, { beat: 960, barLen: 3840 }).map((p) => p.den), [16, 8]);
});

test('fretting: playable shapes, sustained notes keep their strings', () => {
  const s = IR.createSong({ bars: 2 });
  const g = IR.addTrack(s, { name: 'G', kind: 'fretted' });
  for (const p of ['G2', 'B2', 'D3', 'G3', 'B3', 'G4']) IR.addNote(g, 0, 2 * Q, p);
  IR.addNote(g, 2 * Q, Q, 'A3');
  IR.addNote(g, 3 * Q, Q, 'C4');
  for (const p of ['F2', 'C3', 'F3', 'A3', 'C4', 'F4']) IR.addNote(g, 4 * Q, 4 * Q, p);
  assignFrets(g);
  for (const n of g.notes) {
    assert.equal(midi(g.tuning[n.string - 1]) + n.fret, n.pitch, 'string+fret gives the pitch');
  }
  const atStart = (t) => g.notes.filter((n) => n.start === t);
  for (const t of [0, 4 * Q]) {
    const fr = atStart(t).filter((n) => n.fret > 0).map((n) => n.fret);
    assert.ok(Math.max(...fr) - Math.min(...fr) <= 4, 'span within 5 frets');
    assert.equal(new Set(atStart(t).map((n) => n.string)).size, atStart(t).length, 'one note per string');
  }
  const bad = IR.createSong({ bars: 1 });
  const bg = IR.addTrack(bad, { name: 'B', kind: 'fretted' });
  for (const p of ['E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2']) IR.addNote(bg, 0, Q, p);
  assert.throws(() => assignFrets(bg), /can't finger/);
});

test('validation catches bad notes', () => {
  const s = IR.createSong({ bars: 1 });
  const g = IR.addTrack(s, { name: 'G', kind: 'fretted' });
  IR.addNote(g, 0, 100, 'E2'); // off grid
  IR.addNote(g, 0, Q, 'C1'); // below tuning
  IR.addNote(g, 3 * Q, 2 * Q, 'E3'); // past end
  const errs = IR.validateSong(s).filter((e) => e.level === 'error').map((e) => e.message).join('\n');
  assert.match(errs, /grid/);
  assert.match(errs, /outside this tuning/);
  assert.match(errs, /past the end/);
  assert.throws(() => toAlphaTex(s), /invalid/);
});

for (const meter of [[4, 4], [3, 4], [6, 8], [7, 8], [5, 4]]) {
  test(`round trip ${meter.join('/')}: alphaTex -> GP7 and MusicXML -> alphaTab keep every note`, async () => {
    const s = demoSong(meter, 4);
    assert.deepEqual(IR.validateSong(s), []);
    const { gp, issues } = await texToGp(toAlphaTex(s));
    assert.deepEqual(issues.filter((i) => i.level !== 'hint'), [], 'tarb check is clean');
    const fgp = path.join(tmp, `rt-${meter.join('-')}.gp`);
    fs.writeFileSync(fgp, gp);
    const fxml = path.join(tmp, `rt-${meter.join('-')}.musicxml`);
    fs.writeFileSync(fxml, toMusicXml(s));
    for (const f of [fgp, fxml]) {
      const back = await importScore(f);
      assert.equal(back.tracks.length, s.tracks.length);
      s.tracks.forEach((t, i) => assert.equal(noteSet(back.tracks[i]), noteSet(t), `${path.extname(f)} track ${t.name}`));
      assert.equal(back.tempo, s.tempo);
    }
  });
}

test('MIDI: every note comes back with the right channel and program', () => {
  const s = demoSong();
  const m = parseMidi(toMidi(s));
  assert.equal(m.ppq, 960);
  assert.equal(m.tracks.length, s.tracks.length + 1);
  s.tracks.forEach((t, i) => {
    const mt = m.tracks[i + 1];
    assert.equal(mt.name, t.name);
    if (t.kind === 'drums') assert.ok(mt.notes.every((n) => n.ch === 9));
    else {
      assert.equal(noteSet({ notes: mt.notes.map((n) => ({ start: n.tick, dur: n.dur, pitch: n.pitch })) }), noteSet(t));
      assert.ok(mt.events.some((e) => e.type === 0xc0 && e.d1 === t.program));
    }
  });
});

test('LilyPond: one bar check per bar per voice, tab staff for fretted parts', () => {
  const s = demoSong([3, 4], 3);
  const ly = toLilyPond(s);
  assert.match(ly, /\\version "2\.24\.0"/);
  assert.match(ly, /\\new TabStaff/);
  assert.match(ly, /\\drummode/);
  const leadBody = ly.split('\n').find((l) => l.startsWith('trackB'));
  assert.ok(leadBody, 'lead track defined');
  const bodyLines = ly.split('trackB = ')[1].split('\n\n')[0];
  assert.equal((bodyLines.match(/\|/g) ?? []).length, 3);
});

test('render writes all formats and the GP passes tarb', async () => {
  const s = demoSong();
  const { files, issues } = await render(s, path.join(tmp, 'all'));
  assert.equal(files.length, 6);
  assert.deepEqual(issues.filter((i) => i.level === 'error'), []);
  const t = await alphatab();
  const { score } = t.loadFile(path.join(tmp, 'all.gp'));
  assert.deepEqual(t.check(score).filter((i) => i.level === 'error'), []);
});

test('quantize snaps imported timing', () => {
  const s = IR.createSong({ bars: 1 });
  const t = IR.addTrack(s, { name: 'P', kind: 'pitched' });
  t.notes.push({ start: 10, dur: 300, pitch: 60, vel: 90 }, { start: 320, dur: 320, pitch: 60, vel: 90 }, { start: 640, dur: 330, pitch: 62, vel: 90 });
  IR.quantize(s, 240);
  assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), []);
});
