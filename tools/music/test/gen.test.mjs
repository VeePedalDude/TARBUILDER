import test from 'node:test';
import assert from 'node:assert/strict';
import * as IR from '../src/ir.mjs';
import { PROGRESSIONS, realize, generateProgression, placeChords } from '../src/gen/progressions.mjs';
import { chordShapes, powerChord } from '../src/gen/voicing.mjs';
import { GROOVES, writeGroove } from '../src/gen/drums.mjs';
import { planForm, FORMS, GENRES } from '../src/gen/form.mjs';
import { syllables, countSyllables, scan, fitLyrics, rhythmForLine, rhymes } from '../src/gen/lyrics.mjs';
import { generateMelody, melodyReport } from '../src/gen/melody.mjs';
import { invert, retrograde, augment, sequence, transposeDiatonic, ornament } from '../src/gen/motif.mjs';
import { harmonizeMelody, harmonyLine } from '../src/gen/harmonize.mjs';
import { bassLine, comp } from '../src/gen/accompany.mjs';
import { pedalRiff, powerRiff, legatoRun, pentatonicLick } from '../src/gen/riffs.mjs';
import { arrange } from '../src/gen/arranger.mjs';
import { texToGp } from '../src/io/gp.mjs';
import { toAlphaTex } from '../src/io/alphatex.mjs';
import { parseChord } from '../src/theory/chord.mjs';
import { midi, mod } from '../src/theory/pitch.mjs';

const Q = 960;

test('every library progression realises in a key of its mode', () => {
  for (const [name, p] of Object.entries(PROGRESSIONS)) {
    const key = p.mode === 'minor' ? 'E minor' : p.mode === 'major' ? 'G major' : `D ${p.mode}`;
    const r = realize(name, key);
    assert.equal(r.length, p.romans.length, name);
    for (const c of r) assert.ok(!/bb|##/.test(c.symbol), `${name}: no double accidentals (${c.symbol})`);
  }
});

test('generated progressions obey their cadence', () => {
  for (let seed = 0; seed < 40; seed++) {
    for (const key of ['C major', 'A minor']) {
      const minor = key.endsWith('minor');
      for (const complexity of [0, 1, 2, 3]) {
        const a = generateProgression({ key, length: 8, cadence: 'authentic', complexity, seed });
        assert.match(a[6].roman, /^V7?$/, `authentic penultimate V (${a.map((c) => c.roman)})`);
        assert.match(a[7].roman, minor ? /^i7?$/ : /^I(maj7)?$/);
        const h = generateProgression({ key, length: 6, cadence: 'half', complexity, seed });
        assert.match(h[5].roman, /^V7?$/, `half cadence ends on V (${h.map((c) => c.roman)})`);
        for (let i = 0; i < a.length - 1; i++) {
          if (a[i].roman.startsWith('V7/')) assert.ok(!a[i + 1].roman.startsWith('V7/'), 'no chained secondaries');
        }
      }
    }
  }
});

test('guitar shapes are playable and contain the chord', () => {
  for (const sym of ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm', 'F', 'Bm', 'B7', 'Cmaj7', 'G7', 'F#m7b5', 'Bb', 'Eb', 'Ab', 'C#m', 'D/F#', 'Esus4', 'Fmaj7', 'Gm7', 'A7sus4']) {
    const sh = chordShapes(sym);
    assert.ok(sh.length, `${sym} has a shape`);
    const best = sh[0];
    const tun = IR.TUNINGS.standard.map((t) => midi(t));
    const fretted = best.frets.filter((f) => f > 0);
    if (fretted.length) assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 3, `${sym} span`);
    const pcs = new Set(best.frets.map((f, i) => (f === null ? null : mod(tun[i] + f, 12))).filter((x) => x !== null));
    const c = parseChord(sym);
    for (const p of pcs) assert.ok(c.pcs.includes(p) || (c.bass && mod(p, 12) === c.pcs[0]), `${sym} only chord tones`);
    const third = c.intervals.findIndex((iv) => iv.num === 3);
    if (third >= 0) assert.ok(pcs.has(c.pcs[third]), `${sym} has its third (${best.diagram})`);
    const lowest = Math.min(...best.frets.map((f, i) => (f === null ? 999 : tun[i] + f)));
    assert.equal(mod(lowest, 12), c.bass ? mod(midi(String(sym.split('/')[1]) + '2'), 12) : c.pcs[0], `${sym} bass note (${best.diagram})`);
  }
  assert.equal(chordShapes('C')[0].diagram, 'x32010');
  assert.equal(chordShapes('G')[0].diagram, '320003');
  assert.equal(chordShapes('D')[0].diagram, 'xx0232');
  assert.equal(powerChord(40).length, 3);
});

test('grooves fill their bars in every meter they claim', () => {
  for (const [name, g] of Object.entries(GROOVES)) {
    const s = IR.createSong({ meter: g.meter, bars: 4 });
    const d = IR.addTrack(s, { name: 'D', kind: 'drums' });
    writeGroove(s, d, 0, 4, { groove: name, seed: 1, fillEvery: 4 });
    assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), [], name);
    assert.ok(d.notes.some((n) => n.start >= IR.barStart(s, 3)), `${name} reaches the last bar`);
  }
});

test('forms and genres are consistent', () => {
  for (const name of Object.keys(FORMS)) {
    const p = planForm(name);
    let bar = 0;
    for (const s of p) {
      assert.equal(s.bar, bar);
      bar += s.bars;
      assert.ok(s.energy >= 0 && s.energy <= 1);
    }
  }
  for (const [g, d] of Object.entries(GENRES)) {
    assert.ok(FORMS[d.form], `${g} form`);
    assert.ok(GROOVES[d.groove], `${g} groove`);
    for (const p of d.progression) assert.ok(PROGRESSIONS[p], `${g} progression ${p}`);
  }
});

test('lyrics: syllables, stress, fitting', () => {
  const expect = { beautiful: 3, table: 2, little: 2, remember: 3, tonight: 2, sometimes: 2, lonely: 2, heartbreak: 2, walked: 1, wanted: 2, horses: 2, fire: 1, everything: 3, guitar: 2, yesterday: 3 };
  for (const [w, n] of Object.entries(expect)) assert.equal(syllables(w).length, n, `${w} -> ${syllables(w).join('-')}`);
  assert.equal(countSyllables('I walked along the river in the cold December rain'), 14);
  assert.deepEqual(scan('a-way').map((s) => s.stress), [0, 1]);
  const r = rhythmForLine('I believe in yesterday');
  const strong = r.filter((x) => x.stress).every((x) => x.start % Q === 0);
  assert.ok(strong, 'stressed syllables on beats');
  assert.ok(rhymes('night', 'light') && !rhymes('cat', 'dog'));
  const s = IR.createSong({ bars: 1 });
  const t = IR.addTrack(s, { name: 'V', kind: 'pitched' });
  for (let i = 0; i < 4; i++) IR.addNote(t, i * Q, Q, 60 + i);
  const fit = fitLyrics(t, 'hello there my friend and more');
  assert.equal(fit.assigned, 4);
  assert.equal(t.notes[0].lyric, 'hel-');
  assert.ok(fit.warnings.some((w) => /left over/.test(w)));
});

function chordSong(symbols, meter = [4, 4], key = 'C major') {
  const s = IR.createSong({ bars: symbols.length, meter, key });
  placeChords(s, symbols.map((x) => ({ symbol: x })));
  return s;
}

test('melody generator: singable statistics across seeds and meters', () => {
  for (const meter of [[4, 4], [3, 4], [6, 8]]) {
    const s = chordSong(['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G', 'C'], meter);
    for (let seed = 1; seed <= 8; seed++) {
      const notes = generateMelody(s, { seed, range: [60, 79], to: 8 });
      const t = IR.addTrack(s, { name: 'M' + seed, kind: 'pitched' });
      t.notes.push(...notes);
      const rep = melodyReport(s, notes);
      assert.ok(rep.chordToneStrong >= 0.8, `${meter} seed ${seed} chord tones on beats ${rep.chordToneStrong}`);
      assert.ok(rep.stepwise >= 0.4, `stepwise ${rep.stepwise}`);
      assert.equal(rep.bigLeaps, 0);
      assert.ok(rep.endsOnTonic, 'ends on tonic');
      assert.ok(notes.every((n) => n.pitch >= 60 && n.pitch <= 79));
    }
    assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), [], `${meter} valid`);
  }
  const s = chordSong(['C', 'G', 'C', 'G']);
  assert.deepEqual(generateMelody(s, { seed: 5 }), generateMelody(s, { seed: 5 }), 'deterministic');
});

test('motif transforms', () => {
  const m = [{ start: 0, dur: 480, pitch: 60 }, { start: 480, dur: 480, pitch: 64 }, { start: 960, dur: 960, pitch: 67 }];
  assert.deepEqual(invert(m).map((n) => n.pitch), [60, 56, 53]);
  assert.deepEqual(invert(m, { key: 'C major' }).map((n) => n.pitch), [60, 57, 53]);
  assert.deepEqual(retrograde(m).map((n) => [n.start, n.pitch]), [[0, 67], [960, 64], [1440, 60]]);
  assert.deepEqual(augment(m).map((n) => n.dur), [960, 960, 1920]);
  assert.deepEqual(transposeDiatonic(m, 1, 'C major').map((n) => n.pitch), [62, 65, 69]);
  assert.equal(sequence(m, { times: 3, steps: -1 }).length, 9);
  assert.ok(ornament(m).length > m.length);
});

test('harmonizer finds I-IV-V-I under an arpeggiated melody', () => {
  const s = IR.createSong({ bars: 4 });
  const mel = [];
  [[60, 64, 67, 72], [65, 69, 72, 69], [67, 71, 74, 71], [72, 67, 64, 60]].forEach((bar, b) => bar.forEach((p, i) => mel.push({ start: b * 4 * Q + i * Q, dur: Q, pitch: p })));
  const ch = harmonizeMelody(s, mel);
  assert.deepEqual(ch.map((c) => c.symbol), ['C', 'F', 'G', 'C']);
  const minor = IR.createSong({ bars: 4, key: 'A minor' });
  const mel2 = [];
  [[69, 72, 76], [74, 77, 74], [76, 80, 83], [81, 76, 69]].forEach((bar, b) => bar.forEach((p, i) => mel2.push({ start: b * 4 * Q + i * 1280 - (i * 1280) % 480, dur: 960, pitch: p })));
  const ch2 = harmonizeMelody(minor, mel2);
  assert.equal(ch2[ch2.length - 1].symbol, 'Am');
  assert.equal(ch2[ch2.length - 2].symbol, 'E');
  const thirds = harmonyLine(s, mel, { mode: 'thirds' });
  assert.equal(thirds.length, mel.length);
  assert.ok(thirds.every((n, i) => n.pitch < mel[i].pitch || n.pitch - 12 < mel[i].pitch));
});

test('bass and comping follow the chords and stay playable', async () => {
  for (const meter of [[4, 4], [12, 8], [3, 4]]) {
    const s = chordSong(['Em', 'C', 'G', 'D', 'Am7', 'B7', 'Em', 'Em'], meter, 'E minor');
    for (const style of ['root', 'eighths', 'root-fifth', 'octaves', 'walking', 'syncopated', 'arpeggio']) {
      const b = IR.addTrack(s, { name: 'B ' + style, kind: 'fretted', tuning: 'bass', program: 33 });
      bassLine(s, b, { style, seed: 3 });
      for (const n of b.notes) {
        const c = IR.chordAt(s, n.start);
        if (n.start === c.start && style !== 'walking') assert.equal(mod(n.pitch, 12), parseChord(c.symbol).pcs[0], `${style} root on chord change`);
      }
    }
    for (const style of ['strum', 'power', 'gallop', 'arpeggio', 'skank', 'pad', 'block', 'jazz', 'shuffle', 'funk']) {
      const g = IR.addTrack(s, { name: 'G ' + style, kind: 'fretted' });
      comp(s, g, { style, seed: 2 });
      const k = IR.addTrack(s, { name: 'K ' + style, kind: 'pitched' });
      comp(s, k, { style, seed: 2 });
    }
    assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), [], `${meter} valid`);
    const { issues } = await texToGp(toAlphaTex(s));
    assert.deepEqual(issues.filter((i) => i.level === 'error'), [], `${meter} passes tarb`);
  }
});

test('riffs are pre-fingered correctly', () => {
  const s = IR.createSong({ bars: 4, key: 'E minor' });
  const g = IR.addTrack(s, { name: 'G', kind: 'fretted' });
  pedalRiff(s, g, { from: 0, to: 1, seed: 1 });
  powerRiff(s, g, { from: 1, to: 2, seed: 1 });
  legatoRun(s, g, { from: IR.barStart(s, 2), notes: 12, key: 'A minor' });
  pentatonicLick(s, g, { from: IR.barStart(s, 3), beats: 4, seed: 4, key: 'A minor' });
  for (const n of g.notes) assert.equal(midi(g.tuning[n.string - 1]) + n.fret, n.pitch, `fingering of ${n.pitch}`);
  assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), []);
});

test('arranger: every genre makes a valid song that passes tarb, deterministically', async () => {
  for (const genre of Object.keys(GENRES)) {
    const s = arrange({ genre, seed: 11 });
    assert.deepEqual(IR.validateSong(s).filter((e) => e.level === 'error'), [], genre);
    const { issues } = await texToGp(toAlphaTex(s));
    assert.deepEqual(issues.filter((i) => i.level !== 'hint'), [], `${genre} tarb clean`);
    assert.ok(s.tracks.every((t) => t.notes.length > 0), `${genre} all tracks have notes`);
  }
  assert.deepEqual(arrange({ genre: 'pop', seed: 3 }), arrange({ genre: 'pop', seed: 3 }));
  assert.notDeepEqual(arrange({ genre: 'pop', seed: 3 }).tracks[3].notes, arrange({ genre: 'pop', seed: 4 }).tracks[3].notes);
});
