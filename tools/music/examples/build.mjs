// Rebuild every showcase in /examples/music. Run: node examples/build.mjs (from tools/music)
// Each example is a small, readable recipe; copy one to start your own.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tb from '../src/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../../examples/music');
fs.mkdirSync(OUT, { recursive: true });
const Q = 960;
const report = [];

async function save(name, song, formats) {
  const { files, issues } = await tb.render(song, path.join(OUT, name), { formats });
  const errs = issues.filter((i) => i.level === 'error');
  if (errs.length) throw new Error(`${name}: ${errs.map((e) => e.message).join('; ')}`);
  report.push(`${name}: ${song.tracks.length} tracks, ${song.bars} bars, ${issues.length} warnings -> ${files.map((f) => path.basename(f)).join(', ')}`);
}

// 1. Full songs from one line of spec
await save('rock-song', tb.arrange({ genre: 'rock', seed: 7, title: 'Rock Sketch' }));
await save('blues-shuffle', tb.arrange({ genre: 'blues', seed: 3, title: 'Shuffle in E', key: 'E major' }));
await save('metal-drop-d', tb.arrange({ genre: 'metal', seed: 5, title: 'Drop D Gallop' }));
await save('metalcore-drop-c', tb.arrange({ genre: 'metalcore', seed: 4, title: 'Drop C Metalcore' }));
await save('deathcore-drop-a', tb.arrange({ genre: 'deathcore', seed: 4, title: 'Drop A Deathcore' }));
await save('tech-death-b', tb.arrange({ genre: 'tech-death', seed: 4, title: 'B Standard Tech-Death' }));
await save('folk-ballad-68', tb.arrange({ genre: 'ballad', seed: 2, title: '6/8 Ballad' }));

// 2. Jazz: ii-V-I changes, Coltrane reharm, guide tones and a bebop line
{
  const song = tb.createSong({ title: 'Giant Steps-ish', key: 'C major', tempo: 168, bars: 8 });
  const base = [['Dm7', 1], ['G7', 1], ['Cmaj7', 2], ['Am7', 1], ['D7', 1], ['Dm7', 1], ['G7', 1]];
  let t = 0;
  const chords = base.map(([symbol, bars]) => {
    const c = { start: t, dur: bars * 4 * Q, symbol };
    t += c.dur;
    return c;
  });
  song.chords = tb.reharm.coltrane(chords);
  const sax = tb.addTrack(song, { name: 'Tenor Sax', kind: 'pitched', program: 'Tenor Sax' });
  sax.notes.push(...tb.jazz.bebopLine(song, song.chords, { seed: 4, range: [55, 79] }));
  const keys = tb.addTrack(song, { name: 'Guide tones', kind: 'pitched', program: 'Electric Piano 1' });
  keys.notes.push(...tb.jazz.guideToneLine(song.chords, { range: [52, 70] }));
  const bass = tb.addTrack(song, { name: 'Bass', kind: 'fretted', program: 'Acoustic Bass', tuning: 'bass' });
  tb.accompany.bassLine(song, bass, { style: 'walking', seed: 2 });
  const d = tb.addTrack(song, { name: 'Drums', kind: 'drums' });
  for (let b = 0; b < song.bars; b++) for (let k = 0; k < 4; k++) {
    d.notes.push({ start: b * 4 * Q + k * Q, dur: Q / 2, pitch: 51, vel: k % 2 ? 100 : 80 });
    if (k % 2) d.notes.push({ start: b * 4 * Q + k * Q, dur: Q / 2, pitch: 44, vel: 70 });
  }
  await save('jazz-coltrane-bebop', song);
}

// 3. Chorale: roman numerals -> four parts with voice-leading rules
{
  const romans = ['I', 'V6', 'vi', 'iii', 'IV', 'I6', 'ii65', 'V7', 'I'];
  const { chords, issues } = tb.voiceleading.harmonizeSATB(romans, { key: 'G major' });
  if (issues.some((i) => i.level === 'error')) throw new Error('chorale has voice-leading errors');
  const song = tb.createSong({ title: 'Chorale in G', key: 'G major', tempo: 66, bars: romans.length });
  tb.voiceleading.satbToTracks(song, chords, { dur: 4 * Q });
  await save('chorale-satb', song);
}

// 4. Species counterpoint on Fux's cantus firmus
for (const species of [2, 4, 5]) {
  const cf = [62, 65, 64, 62, 67, 65, 69, 67, 65, 64, 62];
  const cp = tb.counterpoint.writeCounterpoint(cf, { species, key: 'D dorian', seed: 3 });
  const song = tb.createSong({ title: `Fux species ${species}`, key: 'D dorian', tempo: 80, bars: cf.length });
  song.tracks.push({ name: 'Counterpoint', kind: 'pitched', program: 52, tuning: null, notes: tb.counterpoint.counterpointToNotes(cp) });
  song.tracks.push({ name: 'Cantus firmus', kind: 'pitched', program: 52, tuning: null, notes: tb.counterpoint.cantusToNotes(cf) });
  await save(`counterpoint-species-${species}`, song);
}

// 5. String quartet: melody + progression orchestrated
{
  const song = tb.createSong({ title: 'Quartet sketch', key: 'D major', tempo: 88, bars: 8 });
  tb.progressions.placeChords(song, tb.progressions.realize(['I', 'vi', 'IV', 'V', 'I', 'ii', 'V7', 'I'], 'D major'));
  const mel = tb.melody.generateMelody(song, { seed: 9, range: [69, 86], form: 'period' });
  tb.orchestration.orchestrate(song, mel, { ensemble: 'string quartet', rhythm: 'pulse' });
  await save('string-quartet', song);
}

// 6. Polymeter: Euclidean layers that realign after 8 bars
{
  const song = tb.createSong({ title: 'Euclidean polymeter', tempo: 112, bars: 8 });
  const d = tb.addTrack(song, { name: 'Drums', kind: 'drums' });
  tb.rhythm.writePolymeter(song, d, [
    { pattern: tb.rhythm.euclid(3, 8), pitch: 'kick' },
    { pattern: tb.rhythm.euclid(5, 12), pitch: 'snare', vel: 90 },
    { pattern: tb.rhythm.euclid(7, 16), pitch: 'hh', vel: 70 },
    { pattern: tb.rhythm.euclid(2, 5), pitch: 'cowbell', vel: 80 },
  ]);
  await save('euclidean-polymeter', song);
}

// 7. Neo-Riemannian Tonnetz walk with a melody on top
{
  const song = tb.createSong({ title: 'Tonnetz walk', key: 'C major', tempo: 76, bars: 8 });
  const walk = tb.neoriemannian.tonnetzWalk('C', 7, tb.makeRng(5));
  tb.progressions.placeChords(song, walk.map((symbol) => ({ symbol })));
  const pad = tb.addTrack(song, { name: 'Strings', kind: 'pitched', program: 'String Ensemble 1' });
  tb.accompany.comp(song, pad, { style: 'pad', voices: 4, range: [52, 72] });
  const lead = tb.addTrack(song, { name: 'Lead', kind: 'pitched', program: 'Flute' });
  lead.notes.push(...tb.jazz.guideToneLine(song.chords, { range: [67, 84], perChord: 2 }));
  await save('tonnetz-walk', song);
}

// 8. Twelve-tone: an all-interval row stated in P0, I5, R0
{
  const row = tb.pcset.randomRow({ seed: 11, allInterval: true });
  const f = tb.pcset.rowForms(row);
  const song = tb.createSong({ title: 'All-interval row', tempo: 90, bars: 9 });
  const t = tb.addTrack(song, { name: 'Piano', kind: 'pitched', program: 0 });
  let start = 0;
  for (const form of [f.P0, f.I5, f.R0]) {
    const notes = tb.pcset.rowToNotes(form, { start, durs: [480, 480, 960, 240, 240, 480, 960, 480, 480, 480, 960, 2880] });
    t.notes.push(...notes);
    start = notes[notes.length - 1].start + notes[notes.length - 1].dur;
  }
  song.bars = Math.ceil(start / (4 * Q));
  await save('twelve-tone-row', song);
}

// 9. Made-up theory -> notes; microtonal theory -> pitch-bend MIDI + Scala file
{
  const th = tb.madeup.THEORIES['golden steps'];
  const line = tb.madeup.generateFromTheory(th, { length: 24, seed: 8 });
  const notes = tb.madeup.theoryToNotes(th, line);
  const end = notes[notes.length - 1].start + notes[notes.length - 1].dur;
  const song = tb.createSong({ title: 'Golden Steps', tempo: 96, bars: Math.ceil(end / (4 * Q)) });
  song.tracks.push({ name: 'Golden Steps', kind: 'pitched', program: 11, tuning: null, notes: notes.map(({ start, dur, pitch, vel }) => ({ start, dur, pitch, vel })) });
  await save('madeup-golden-steps', song);

  const pp = tb.madeup.THEORIES['ratio engine'];
  const pl = tb.madeup.generateFromTheory(pp, { length: 16, seed: 2 });
  const pn = tb.madeup.theoryToNotes(pp, pl);
  const sc = { name: pp.name, steps: pp.pitch.steps, period: 1200 };
  fs.writeFileSync(path.join(OUT, 'madeup-ratio-engine.mid'), tb.tuning.microtonalMidi(pl.map((x, i) => ({ start: pn[i].start, dur: pn[i].dur, degree: x.degree })), { scale: sc, tonicMidi: pp.tonic, program: 88 }));
  fs.writeFileSync(path.join(OUT, 'madeup-ratio-engine.scl'), tb.tuning.toScala(sc));
  report.push('madeup-ratio-engine: 7-limit just intonation -> pitch-bend MIDI + .scl');
}

// 10. Algorithmic: L-system melody over a Fibonacci-word rhythm + CA drums
{
  const song = tb.createSong({ title: 'L-system', key: 'A minor', tempo: 104, bars: 8 });
  const lsys = tb.algorithmic.lsystem('F', { F: 'F+F--F+F' }, 3);
  const mel = tb.algorithmic.turtleMelody(lsys, { step: 1 }).slice(0, 64);
  const lead = tb.addTrack(song, { name: 'Marimba', kind: 'pitched', program: 'Marimba' });
  lead.notes.push(...tb.algorithmic.toNotes(mel.map((m) => m.degree), { key: 'A minor', unit: 480, range: [57, 81] }));
  const d = tb.addTrack(song, { name: 'Drums', kind: 'drums' });
  const ca = tb.algorithmic.elementaryCA(30, { width: 16, generations: 8 });
  ca.forEach((row, b) => tb.rhythm.writePattern(song, d, row, { bar: b, bars: 1, pitch: 'rim' }));
  tb.rhythm.writePattern(song, d, tb.algorithmic.fibonacciWord(16), { bar: 0, bars: 8, pitch: 'kick' });
  await save('lsystem-ca', song);
}

fs.writeFileSync(path.join(OUT, 'README.md'), `# Music examples\n\nBuilt by \`node tools/music/examples/build.mjs\`. Every .gp passed \`tarb\` checks; every song passed IR validation.\n\n${report.map((r) => `- ${r}`).join('\n')}\n`);
console.log(report.join('\n'));
