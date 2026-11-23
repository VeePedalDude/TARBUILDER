import test from 'node:test';
import assert from 'node:assert/strict';
import { midi, noteName, transpose, interval, intervalName, parseInterval, fromMidi, simplify } from '../src/theory/pitch.mjs';
import { scaleNames, makeScale, scalesContaining, SCALES, modeOf } from '../src/theory/scale.mjs';
import { parseChord, nameChord, closeVoicing, voiceLead, chordNames } from '../src/theory/chord.mjs';
import { parseKey, signature, spellNameInKey, detectKey, relativeKey, closelyRelated } from '../src/theory/key.mjs';
import { parseRoman, analyzeRoman } from '../src/theory/roman.mjs';

test('pitch: midi numbers and octave belonging to the letter', () => {
  assert.equal(midi('C4'), 60);
  assert.equal(midi('A4'), 69);
  assert.equal(midi('B#3'), 60);
  assert.equal(midi('Cb4'), 59);
  assert.equal(midi('E1'), 28);
  assert.equal(noteName(fromMidi(61, { preferFlats: true })), 'Db4');
  assert.equal(noteName(simplify('Fb4')), 'E4');
});

test('pitch: spelled intervals and transposition', () => {
  const cases = [['C4', 'E4', 'M3'], ['C4', 'Eb4', 'm3'], ['C4', 'F#4', 'A4'], ['C4', 'Gb4', 'd5'], ['E4', 'C6', 'm13'], ['B3', 'F4', 'd5'], ['C4', 'C5', 'P8']];
  for (const [a, b, name] of cases) assert.equal(intervalName(interval(a, b)), name, `${a}-${b}`);
  assert.equal(noteName(transpose('B3', 'M3')), 'D#4');
  assert.equal(noteName(transpose('Db4', 'A4')), 'G4');
  assert.equal(noteName(transpose('F#4', 'P5', { down: true })), 'B3');
  for (const n of ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8', 'm9', 'A9', 'P11', 'A11', 'M13']) {
    assert.equal(intervalName(parseInterval(n)), n);
  }
  assert.throws(() => parseInterval('M5'), /perfect/);
  assert.throws(() => parseInterval('P3'), /major\/minor/);
});

test('scales: spelling uses one letter per degree', () => {
  assert.deepEqual(scaleNames('B', 'major'), ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#']);
  assert.deepEqual(scaleNames('F', 'major'), ['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
  assert.deepEqual(scaleNames('F#', 'harmonic minor'), ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E#']);
  assert.deepEqual(scaleNames('D', 'dorian'), ['D', 'E', 'F', 'G', 'A', 'B', 'C']);
  for (const [name, ivs] of Object.entries(SCALES)) {
    const semis = ivs.map((i) => parseInterval(i).semis);
    assert.ok(semis.every((s, i) => i === 0 || s > semis[i - 1]), `${name} ascending`);
    assert.ok(semis[semis.length - 1] < 12, `${name} within an octave`);
  }
  const s = makeScale('C', 'major', 4);
  assert.equal(s.midi(0), 60);
  assert.equal(s.midi(7), 72);
  assert.equal(s.midi(-1), 59);
  assert.equal(s.snap(61), 60);
  assert.equal(s.degreeOf(67), 4);
  assert.deepEqual(modeOf('major', 1), [0, 2, 3, 5, 7, 9, 10]); // dorian
  assert.ok(scalesContaining([0, 2, 4, 7, 9], { tonic: 0 }).some((x) => x.name === 'major pentatonic'));
});

test('chords: parsing common and jazz symbols', () => {
  const cases = {
    C: 'C E G', Cm: 'C Eb G', C7: 'C E G Bb', Cmaj7: 'C E G B', CM7: 'C E G B', 'CΔ7': 'C E G B', Cm7: 'C Eb G Bb',
    Cm7b5: 'C Eb Gb Bb', 'Cø': 'C Eb Gb Bb', Cdim7: 'C Eb Gb Bbb', Caug: 'C E G#', Csus4: 'C F G', Csus2: 'C D G',
    C7sus4: 'C F G Bb', C9: 'C E G Bb D', Cm9: 'C Eb G Bb D', C13: 'C E G Bb D A', C7b9: 'C E G Bb Db', 'C7#9': 'C E G Bb D#',
    'Cmaj7#11': 'C E G B F#', C6: 'C E G A', 'C6/9': 'C E G A D', Cadd9: 'C E G D', 'Cm(maj7)': 'C Eb G B', C5: 'C G',
    'C-7': 'C Eb G Bb', Ebm7: 'Eb Gb Bb Db', 'F#7': 'F# A# C# E', Bbmaj9: 'Bb D F A C',
  };
  for (const [sym, notes] of Object.entries(cases)) assert.equal(chordNames(sym).join(' '), notes, sym);
  assert.equal(noteName(parseChord('D/F#').bass), 'F#');
  assert.throws(() => parseChord('Cxyz'), /stuck at "xyz"/);
  assert.throws(() => parseChord('H7'), /root/);
});

test('chords: naming notes and voicings', () => {
  assert.equal(nameChord([60, 64, 67]).symbol, 'C');
  assert.equal(nameChord([64, 67, 72]).symbol, 'C/E');
  assert.equal(nameChord([55, 59, 62, 65]).symbol, 'G7');
  assert.equal(nameChord([59, 62, 65, 69]).symbol, 'Bm7b5');
  assert.deepEqual(closeVoicing('Cmaj7', { low: 48 }), [48, 52, 55, 59]);
  const v1 = voiceLead(null, 'C', { voices: 4 });
  const v2 = voiceLead(v1, 'F', { voices: 4 });
  const moved = v1.reduce((a, m, i) => a + Math.abs(m - v2[i]), 0);
  assert.ok(moved <= 6, `smooth C->F voice leading moved ${moved} semitones`);
});

test('keys: signatures, spelling, detection', () => {
  assert.deepEqual(signature('A major'), ['F#', 'C#', 'G#']);
  assert.deepEqual(signature('C minor'), ['Bb', 'Eb', 'Ab']);
  assert.deepEqual(signature('D dorian'), []);
  assert.equal(parseKey('Bbm').name, 'Bb minor');
  assert.equal(spellNameInKey(70, 'F major'), 'Bb4');
  assert.equal(spellNameInKey(68, 'A minor'), 'G#4');
  assert.equal(spellNameInKey(60, 'E major'), 'C4');
  assert.equal(spellNameInKey(66, 'C major'), 'F#4');
  assert.equal(spellNameInKey(63, 'C major'), 'Eb4');
  assert.equal(detectKey([60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 60])[0].key, 'C major');
  assert.equal(detectKey([57, 59, 60, 62, 64, 65, 68, 69, 64, 57, 69])[0].key, 'A minor');
  assert.equal(relativeKey('G major').name, 'E minor');
  assert.deepEqual(closelyRelated('C major'), ['D minor', 'E minor', 'F major', 'G major', 'A minor']);
});

test('roman numerals: parse and analyse', () => {
  const p = (r, k) => parseRoman(r, k).symbol;
  assert.equal(p('ii7', 'C'), 'Dm7');
  assert.equal(p('V7', 'A minor'), 'E7');
  assert.equal(p('vii°7', 'A minor'), 'G#dim7');
  assert.equal(p('VII', 'A minor'), 'G');
  assert.equal(p('bVII', 'C'), 'Bb');
  assert.equal(p('V7/V', 'C'), 'D7');
  assert.equal(p('V7/ii', 'C'), 'A7');
  assert.equal(p('I6', 'C'), 'C/E');
  assert.equal(p('V42', 'C'), 'G7/F');
  assert.equal(p('N6', 'C'), 'Db/F');
  assert.deepEqual(chordNames(parseRoman('Ger6', 'C').chord), ['Ab', 'C', 'Eb', 'F#']);
  assert.equal(analyzeRoman('D7', 'C'), 'V7/V');
  assert.equal(analyzeRoman('Bm7b5', 'C'), 'viiø7');
  assert.equal(analyzeRoman('Bb', 'C'), 'bVII');
  assert.equal(analyzeRoman('G#dim7', 'A minor'), 'vii°7');
  assert.equal(analyzeRoman('E7', 'A minor'), 'V7');
});
