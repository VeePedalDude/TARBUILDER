import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as IR from '../src/ir.mjs';
import { checkVoiceLeading, harmonizeSATB, satbToTracks } from '../src/analysis/voiceleading.mjs';
import { checkCantus, generateCantus, checkCounterpoint, writeCounterpoint, counterpointToNotes, cantusToNotes } from '../src/analysis/counterpoint.mjs';
import { REHARM, tritoneSub, coltrane } from '../src/gen/reharm.mjs';
import { chordScale, guideToneLine, bebopLine } from '../src/gen/jazz.mjs';
import { orchestrate, checkRanges, writtenPitch, INSTRUMENTS, ENSEMBLES } from '../src/analysis/orchestration.mjs';
import * as ST from '../src/analysis/style.mjs';
import { placeChords, realize } from '../src/gen/progressions.mjs';
import { generateMelody } from '../src/gen/melody.mjs';
import { arrange } from '../src/gen/arranger.mjs';
import { toMusicXml } from '../src/io/musicxml.mjs';
import { texToGp, importScore } from '../src/io/gp.mjs';
import { toAlphaTex } from '../src/io/alphatex.mjs';
import { parseChord } from '../src/theory/chord.mjs';
import { mod } from '../src/theory/pitch.mjs';

const Q = 960;
const errors = (xs) => xs.filter((x) => x.level === 'error');

test('voice-leading checker catches the classic mistakes', () => {
  const rules = (ch, o) => checkVoiceLeading(ch, o).map((x) => x.rule);
  assert.ok(rules([[72, 67, 64, 48], [74, 69, 65, 50]]).includes('parallel-fifths'));
  assert.ok(rules([[72, 67, 64, 48], [74, 69, 65, 50]]).includes('parallel-octaves'));
  assert.ok(rules([[64, 67, 60, 48]]).includes('crossing'));
  assert.ok(rules([[84, 67, 60, 48]]).includes('range'));
  assert.ok(rules([[79, 64, 60, 48]]).includes('spacing'));
  const lt = checkVoiceLeading([[71, 67, 62, 43], [67, 64, 60, 48]], { key: 'C major', romans: ['V', 'I'] });
  assert.ok(lt.some((x) => x.rule === 'leading-tone' && x.level === 'error'), 'soprano leading tone must resolve');
  const sev = checkVoiceLeading([[65, 62, 59, 43], [67, 64, 60, 48]], { key: 'C major', romans: ['V7', 'I'] });
  assert.ok(sev.some((x) => x.rule === 'seventh'), 'F rising to G is flagged');
  assert.deepEqual(errors(checkVoiceLeading([[72, 67, 64, 48], [72, 69, 65, 53], [71, 67, 62, 55], [72, 67, 64, 48]], { key: 'C major', romans: ['I', 'IV', 'V', 'I'] })), []);
});

test('SATB harmoniser writes error-free chorales', () => {
  const cases = [
    ['C major', ['I', 'IV', 'V', 'I']],
    ['C major', ['I', 'vi', 'ii6', 'V7', 'I']],
    ['A minor', ['i', 'iv', 'V', 'i']],
    ['G major', ['I', 'V6', 'vi', 'IV', 'I64', 'V7', 'I']],
    ['D minor', ['i', 'iiø65', 'V7', 'i', 'VI', 'iv6', 'V', 'i']],
    ['F major', ['I', 'V7/V', 'V', 'I']],
    ['Eb major', ['I', 'IV', 'ii7', 'V7', 'vi', 'IV', 'V7', 'I']],
  ];
  for (const [key, romans] of cases) {
    const { chords, issues } = harmonizeSATB(romans, { key });
    assert.equal(chords.length, romans.length);
    assert.deepEqual(errors(issues), [], `${key} ${romans.join(' ')}`);
  }
  const s = IR.createSong({ bars: 2 });
  satbToTracks(s, harmonizeSATB(['I', 'IV', 'V', 'I'], { key: 'C major' }).chords, { dur: 2 * Q });
  assert.equal(s.tracks.length, 4);
  assert.deepEqual(errors(IR.validateSong(s)), []);
});

test('cantus firmus generator meets every cantus rule', () => {
  for (const key of ['C major', 'A minor', 'D dorian', 'G major', 'E phrygian']) {
    for (let seed = 1; seed <= 6; seed++) {
      const cf = generateCantus({ key, length: 8 + (seed % 5), seed });
      assert.deepEqual(checkCantus(cf, key), [], `${key} seed ${seed}: ${cf}`);
    }
  }
  const fux = [62, 65, 64, 62, 67, 65, 69, 67, 65, 64, 62];
  assert.deepEqual(errors(checkCantus(fux, 'D dorian')), []);
});

test('counterpoint checker catches errors per species', () => {
  const cf = [60, 62, 64, 60, 65, 64, 67, 64, 62, 60];
  const s1 = (ps) => ps.map((p, i) => ({ start: i * 4, dur: 4, pitch: p }));
  const has = (cp, rule, species = 1) => checkCounterpoint(cf, cp, { species, key: 'C major' }).some((x) => x.rule === rule);
  assert.ok(has(s1([67, 69, 71, 67, 72, 71, 74, 71, 71, 72]), 'parallel-fifths'));
  assert.ok(has(s1([72, 71, 69, 67, 69, 71, 72, 67, 71, 72]), 'dissonance') || has(s1([72, 71, 69, 67, 69, 71, 72, 67, 71, 72]), 'parallel-octaves'));
  assert.ok(has(s1([64, 65, 67, 64, 69, 67, 71, 67, 71, 72]), 'start'));
  assert.ok(has(s1([72, 71, 67, 64, 69, 67, 71, 72, 71, 71]), 'end') || has(s1([72, 71, 67, 64, 69, 67, 71, 72, 71, 71]), 'repeat'));
  // species 2: an accented dissonance on a downbeat
  const s2 = [];
  cf.slice(0, -1).forEach((c, i) => s2.push({ start: i * 4, dur: 2, pitch: c + (i === 3 ? 2 : 7) }, { start: i * 4 + 2, dur: 2, pitch: c + 9 }));
  s2.push({ start: 36, dur: 4, pitch: 72 });
  assert.ok(checkCounterpoint(cf, s2, { species: 2, key: 'C major' }).some((x) => x.rule === 'downbeat-dissonance'));
});

test('counterpoint writer: all five species, above and below, pass the checker', () => {
  const cantus = [
    ['D dorian', [62, 65, 64, 62, 67, 65, 69, 67, 65, 64, 62]],
    ['C major', [60, 62, 64, 60, 65, 64, 67, 64, 62, 60]],
  ];
  for (const [key, cf] of cantus) {
    for (const species of [1, 2, 3, 4, 5]) {
      for (const above of [true, false]) {
        const cp = writeCounterpoint(cf, { species, above, key, seed: 7 });
        assert.deepEqual(errors(checkCounterpoint(cf, cp, { species, above, key })), [], `${key} species ${species} ${above ? 'above' : 'below'}`);
        const notes = counterpointToNotes(cp);
        assert.equal(notes[notes.length - 1].start + notes[notes.length - 1].dur, cf.length * 4 * Q);
      }
    }
  }
  const s = IR.createSong({ bars: 10 });
  const cf = [60, 62, 64, 60, 65, 64, 67, 64, 62, 60];
  s.tracks.push({ name: 'Cantus', kind: 'pitched', program: 52, tuning: null, notes: cantusToNotes(cf) });
  s.tracks.push({ name: 'Counterpoint', kind: 'pitched', program: 52, tuning: null, notes: counterpointToNotes(writeCounterpoint(cf, { species: 4, key: 'C major', seed: 1 })) });
  assert.deepEqual(errors(IR.validateSong(s)), []);
});

test('reharmonisation tools keep the total length and produce readable chords', () => {
  const ch = [{ start: 0, dur: 4 * Q, symbol: 'Dm7' }, { start: 4 * Q, dur: 4 * Q, symbol: 'G7' }, { start: 8 * Q, dur: 8 * Q, symbol: 'Cmaj7' }, { start: 16 * Q, dur: 4 * Q, symbol: 'C' }, { start: 20 * Q, dur: 4 * Q, symbol: 'Dm7' }];
  for (const [name, f] of Object.entries(REHARM)) {
    const out = f(ch, { key: 'C major', seed: 1, prob: 1 });
    assert.equal(out.reduce((a, c) => a + c.dur, 0), 24 * Q, name);
    for (let i = 1; i < out.length; i++) assert.equal(out[i].start, out[i - 1].start + out[i - 1].dur, `${name} contiguous`);
    for (const c of out) assert.doesNotThrow(() => parseChord(c.symbol), `${name}: ${c.symbol}`);
  }
  assert.equal(tritoneSub(ch)[1].symbol, 'Db7');
  assert.deepEqual(coltrane(ch).map((c) => c.symbol).slice(0, 7), ['Dm7', 'Eb7', 'Abmaj7', 'B7', 'Emaj7', 'G7', 'Cmaj7']);
});

test('jazz: chord scales, guide tones, bebop lines', () => {
  assert.equal(chordScale('Dm7').scale, 'dorian');
  assert.equal(chordScale('G7').scale, 'mixolydian');
  assert.equal(chordScale('G7alt').scale, 'altered');
  assert.equal(chordScale('Bm7b5').scale, 'locrian');
  assert.equal(chordScale('E7', { nextSymbol: 'Am7' }).scale, 'phrygian dominant');
  assert.equal(chordScale('Cmaj7#11').scale, 'lydian');
  const song = IR.createSong({ bars: 8, key: 'C major', tempo: 160 });
  placeChords(song, realize(['ii7', 'V7', 'Imaj7', 'vi7', 'ii7', 'V7', 'Imaj7', 'Imaj7'], 'C major'));
  const g = guideToneLine(song.chords);
  for (let i = 0; i < g.length; i++) {
    const c = parseChord(song.chords[i].symbol);
    assert.ok(c.intervals.some((iv) => [3, 7].includes(iv.num) && mod(c.pcs[0] + iv.semis, 12) === mod(g[i].pitch, 12)), 'guide tone is a 3rd or 7th');
    if (i) assert.ok(Math.abs(g[i].pitch - g[i - 1].pitch) <= 3, 'guide tones move by a minor third or less');
  }
  const line = bebopLine(song, song.chords, { seed: 3 });
  let onBeat = 0;
  let ct = 0;
  for (const n of line) {
    if (n.start % Q) continue;
    onBeat++;
    if (parseChord(IR.chordAt(song, n.start).symbol).pcs.includes(mod(n.pitch, 12))) ct++;
  }
  assert.ok(ct / onBeat >= 0.85, `bebop chord tones on beats ${ct}/${onBeat}`);
});

test('orchestration: ranges, transposition, ensembles; MusicXML writes transposed parts', async () => {
  assert.equal(writtenPitch('trumpet', 60), 62);
  assert.equal(writtenPitch('alto sax', 60), 69);
  assert.equal(writtenPitch('horn', 60), 67);
  for (const [name, list] of Object.entries(ENSEMBLES)) for (const i of list) assert.ok(INSTRUMENTS[i], `${name}: ${i}`);
  const song = IR.createSong({ bars: 8, key: 'C major' });
  placeChords(song, realize(['I', 'vi', 'IV', 'V', 'I', 'IV', 'V7', 'I'], 'C major'));
  const mel = generateMelody(song, { seed: 4, range: [67, 84] });
  orchestrate(song, mel, { ensemble: 'string quartet' });
  orchestrate(song, mel, { ensemble: 'brass quintet', rhythm: 'pulse' });
  assert.deepEqual(errors(checkRanges(song)), []);
  assert.deepEqual(errors(IR.validateSong(song)), []);
  const xml = toMusicXml(song);
  assert.match(xml, /<transpose><diatonic>-1<\/diatonic><chromatic>-2<\/chromatic><\/transpose>/, 'Bb trumpet transposition');
  assert.match(xml, /<clef><sign>C<\/sign><line>3<\/line><\/clef>/, 'viola alto clef');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tb-orch-')), 'o.musicxml');
  fs.writeFileSync(f, xml);
  const back = await importScore(f);
  const tp = song.tracks.find((t) => t.name === 'Trumpet 1');
  const tb = back.tracks.find((t) => t.name === 'Trumpet 1');
  assert.deepEqual(tb.notes.map((n) => n.pitch), tp.notes.map((n) => n.pitch), 'importer recovers concert pitch');
  const { issues } = await texToGp(toAlphaTex(song));
  assert.deepEqual(errors(issues), []);
});

test('style models learn from a corpus and generate valid material', () => {
  const corpus = [1, 2, 3, 4].map((seed) => arrange({ genre: 'pop', seed }));
  const mm = ST.trainMelodyModel(corpus, { track: 'Lead', order: 2 });
  const cm = ST.trainChordModel(corpus);
  const dm = ST.trainDrumModel(corpus);
  assert.ok(mm.trainedOn === 4 && cm.trainedOn === 4 && dm.trainedOn === 4);
  const prog = ST.generateFromChordModel(cm, { key: 'E major', length: 8, seed: 1 });
  assert.equal(prog.length, 8);
  const s = IR.createSong({ bars: 4, key: 'G major' });
  const lt = IR.addTrack(s, { name: 'L', kind: 'pitched' });
  lt.notes.push(...ST.generateFromMelodyModel(mm, s, { bars: 4, seed: 2, range: [62, 79] }));
  assert.ok(lt.notes.length > 8 && lt.notes.every((n) => n.pitch >= 62 && n.pitch <= 79));
  const dt = IR.addTrack(s, { name: 'D', kind: 'drums' });
  ST.generateFromDrumModel(dm, s, dt, { bars: 4, seed: 3 });
  assert.ok(dt.notes.length > 16);
  assert.deepEqual(errors(IR.validateSong(s)), []);
  const json = JSON.parse(JSON.stringify(mm));
  assert.deepEqual(ST.sampleTokens(json, { seed: 9, length: 10 }), ST.sampleTokens(mm, { seed: 9, length: 10 }), 'models survive JSON');
});
