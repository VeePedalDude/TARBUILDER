#!/usr/bin/env node
// tb - TARBUILDER music toolkit CLI. Run `tb help` for commands.
import fs from 'node:fs';
import path from 'node:path';
import * as tb from '../src/index.mjs';

const HELP = `tb - TARBUILDER music toolkit

SONGS
  tb song [--genre rock] [--key "E minor"] [--tempo 120] [--form pop] [--seed 1] [--title T] -o out/name
          [--formats gp,mid,musicxml,ly,atex,json] [--no-lead] [--no-guitar] [--keys] [--complexity 0-3]
  tb spec spec.json -o out/name          arrange from a JSON spec (see SKILL docs)
  tb render song.json -o out/name        render a song-IR JSON to every format
  tb check song.json                     validate a song-IR JSON
  tb import file.gp|.gpx|.gp5|.musicxml [-o song.json] [--quantize 240]

THEORY
  tb chord Cmaj7 [--tuning "drop d"]     notes, intervals, guitar shapes
  tb scale D dorian                      spelled scale
  tb roman "ii7 V7 Imaj7" --key Bb       roman numerals -> chords
  tb analyze "Dm7 G7 Cmaj7" --key C      chords -> roman numerals
  tb key 60 62 64 65 67                  detect key from midi notes
  tb prog --key "A minor" [--length 8] [--complexity 0-3] [--cadence authentic|half|plagal|deceptive] [--seed 1]
  tb prog --name axis --key G
  tb reharm "Dm7 G7 Cmaj7 Cmaj7" --tool tritoneSub|secondaryDominants|insertTwoFive|modalInterchange|
            chromaticMediant|backdoor|passingDiminished|coltrane [--key C]
  tb scales-for 0 2 4 7 9                which scales contain these pitch classes

CLASSICAL
  tb satb "I IV ii6 V7 I" --key C [-o out/name]
  tb cantus [--key C] [--length 10] [--seed 1]
  tb counterpoint --species 1-5 [--key "D dorian"] [--cantus "62 65 64 62 ..."] [--below] [--seed 1] [-o out/name]

LAB
  tb euclid 5 8 [--rotate 1]             Euclidean rhythm
  tb polymeter "x.." "x..." "x...."      layers realign after the LCM
  tb nr C PLR | tb nr C Ebm              neo-Riemannian ops / shortest path
  tb pcset 0 4 7 | tb pcset C E G        normal form, prime form, interval vector
  tb row 0 11 7 8 3 1 2 10 6 5 4 9       twelve-tone matrix
  tb tuning 31-EDO [--scl out.scl]       steps in cents, EDO errors
  tb sieve "(3@0 | 4@1) & !2@0" [--hi 24]
  tb theory "golden steps" [--length 16] [--seed 1] [-o out/name]   made-up theory -> notes

LISTS
  tb list genres|forms|progressions|grooves|scales|tunings|theories|instruments|ensembles
`;

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o') flags.o = argv[++i];
    else if (a.startsWith('--no-')) flags[a.slice(5)] = false;
    else if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) flags[k] = true;
      else {
        flags[k] = v;
        i++;
      }
    } else pos.push(a);
  }
  return { pos, flags };
}

const num = (x, d) => (x === undefined || x === true ? d : Number(x));
const print = (x) => console.log(typeof x === 'string' ? x : JSON.stringify(x, null, 1));

async function out(song, flags) {
  if (!flags.o) throw new Error('Use -o out/name to choose where files go');
  const formats = flags.formats ? String(flags.formats).split(',') : tb.ALL_FORMATS;
  const { files, issues } = await tb.render(song, flags.o, { formats, gpTarget: flags.gp8 ? 'gp8' : 'gp7', swing: num(flags.swing, 0) });
  for (const i of issues) console.log(`  ${i.level.toUpperCase()} ${i.where ?? ''} ${i.message}`);
  for (const f of files) console.log(`wrote ${f}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const { pos, flags } = parseArgs(rest);

const commands = {
  help: () => print(HELP),

  async song() {
    const spec = {
      genre: flags.genre ?? 'rock', key: flags.key, tempo: flags.tempo ? Number(flags.tempo) : undefined, form: flags.form,
      seed: flags.seed ?? 1, title: flags.title, complexity: flags.complexity ? Number(flags.complexity) : undefined,
      parts: { lead: flags.lead !== false, guitar: flags.guitar !== false, bass: flags.bass !== false, drums: flags.drums !== false, keys: !!flags.keys },
    };
    const song = tb.arrange(spec);
    console.log(`${song.title}: ${song.key}, ${song.tempo} BPM, ${song.meter.num}/${song.meter.den}, ${song.bars} bars, sections ${song.sections.map((s) => s.name).join(' ')}`);
    await out(song, flags);
  },

  async spec() {
    const spec = JSON.parse(fs.readFileSync(pos[0], 'utf8'));
    await out(tb.arrange(spec), flags);
  },

  async render() {
    await out(JSON.parse(fs.readFileSync(pos[0], 'utf8')), flags);
  },

  check() {
    const issues = tb.validateSong(JSON.parse(fs.readFileSync(pos[0], 'utf8')));
    for (const i of issues) console.log(`${i.level.toUpperCase()} ${i.where}: ${i.message}`);
    console.log(issues.some((i) => i.level === 'error') ? 'FAIL' : 'OK');
    if (issues.some((i) => i.level === 'error')) process.exitCode = 1;
  },

  async import() {
    const song = await tb.gp.importScore(pos[0]);
    if (flags.quantize) tb.quantize(song, Number(flags.quantize));
    const json = JSON.stringify(song, null, 1);
    if (flags.o) {
      fs.writeFileSync(flags.o, json);
      console.log(`wrote ${flags.o} (${song.tracks.length} tracks, ${song.bars} bars)`);
    } else print(json);
  },

  chord() {
    const sym = pos.join('');
    const c = tb.chords.parseChord(sym);
    print(`${sym}: ${tb.chords.chordNames(c).join(' ')}  (${c.names.join(' ')})${c.bass ? '  bass ' + tb.pitch.noteName(c.bass) : ''}`);
    const shapes = tb.voicing.chordShapes(sym, { tuning: flags.tuning ?? 'standard', limit: 5 });
    print(`guitar (${flags.tuning ?? 'standard'}): ${shapes.map((s) => s.diagram).join('  ') || 'no shape found'}`);
  },

  scale() {
    const [tonic, ...name] = pos;
    print(tb.scales.scaleNames(tonic, name.join(' ') || 'major').join(' '));
  },

  roman() {
    const key = flags.key ?? 'C major';
    print(pos.join(' ').split(/\s+/).map((r) => `${r}=${tb.roman.parseRoman(r, key).symbol}`).join('  '));
  },

  analyze() {
    const key = flags.key ?? 'C major';
    print(pos.join(' ').split(/\s+/).map((s) => `${s}=${tb.roman.analyzeRoman(s, key)}`).join('  '));
  },

  key() {
    print(tb.keys.detectKey(pos.map(Number)).slice(0, 3).map((k) => `${k.key} (${k.score.toFixed(3)})`).join('  '));
  },

  prog() {
    const key = flags.key ?? 'C major';
    const list = flags.name
      ? tb.progressions.realize(flags.name, key)
      : tb.progressions.generateProgression({ key, length: num(flags.length, 4), complexity: num(flags.complexity, 0), cadence: flags.cadence ?? 'authentic', seed: flags.seed ?? 1 });
    print(list.map((c) => `${c.roman}=${c.symbol}`).join('  '));
  },

  reharm() {
    const tool = tb.reharm.REHARM[flags.tool ?? 'tritoneSub'];
    if (!tool) throw new Error(`Unknown tool. Known: ${Object.keys(tb.reharm.REHARM).join(', ')}`);
    const syms = pos.join(' ').split(/\s+/);
    const chords = syms.map((symbol, i) => ({ start: i * 3840, dur: 3840, symbol }));
    print(tool(chords, { key: flags.key ?? 'C major', seed: flags.seed ?? 1, prob: 1 }).map((c) => `${c.symbol}${c.dur !== 3840 ? '(' + c.dur / 960 + ')' : ''}`).join('  '));
  },

  'scales-for'() {
    print(tb.scales.scalesContaining(pos.map((x) => (/^\d+$/.test(x) ? Number(x) : x))).slice(0, 20).map((s) => `${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][s.tonicPc]} ${s.name}`).join('\n'));
  },

  async satb() {
    const romans = pos.join(' ').split(/\s+/);
    const key = flags.key ?? 'C major';
    const { chords, issues } = tb.voiceleading.harmonizeSATB(romans, { key });
    chords.forEach((c, i) => print(`${romans[i].padEnd(6)} S ${tb.pitch.midiToName(c[0])} A ${tb.pitch.midiToName(c[1])} T ${tb.pitch.midiToName(c[2])} B ${tb.pitch.midiToName(c[3])}`));
    for (const x of issues) print(`  ${x.level} ${x.rule} at chord ${x.at + 1}: ${x.message}`);
    if (flags.o) {
      const song = tb.createSong({ title: 'Chorale', key, bars: romans.length, tempo: 72 });
      tb.voiceleading.satbToTracks(song, chords, { dur: 3840 });
      await out(song, flags);
    }
  },

  cantus() {
    const cf = tb.counterpoint.generateCantus({ key: flags.key ?? 'C major', length: num(flags.length, 10), seed: flags.seed ?? 1 });
    print(cf.map((m) => tb.pitch.midiToName(m)).join(' ') + '   (' + cf.join(' ') + ')');
  },

  async counterpoint() {
    const key = flags.key ?? 'C major';
    const cf = flags.cantus ? String(flags.cantus).split(/[\s,]+/).map((x) => (/^\d+$/.test(x) ? Number(x) : tb.pitch.midi(x))) : tb.counterpoint.generateCantus({ key, seed: flags.seed ?? 1 });
    const species = num(flags.species, 1);
    const above = !flags.below;
    const cp = tb.counterpoint.writeCounterpoint(cf, { species, above, key, seed: flags.seed ?? 1 });
    print(`cantus: ${cf.map((m) => tb.pitch.midiToName(m)).join(' ')}`);
    print(`species ${species} ${above ? 'above' : 'below'}: ${cp.map((n) => (n.pitch === null ? 'r' : tb.pitch.midiToName(n.pitch) + (n.tie ? '~' : ''))).join(' ')}`);
    for (const w of tb.counterpoint.checkCounterpoint(cf, cp, { species, above, key })) print(`  ${w.level} ${w.rule}: ${w.message}`);
    if (flags.o) {
      const song = tb.createSong({ title: `Species ${species}`, key, bars: cf.length, tempo: 80 });
      const a = { name: 'Counterpoint', kind: 'pitched', program: 52, tuning: null, notes: tb.counterpoint.counterpointToNotes(cp) };
      const b = { name: 'Cantus', kind: 'pitched', program: 52, tuning: null, notes: tb.counterpoint.cantusToNotes(cf) };
      song.tracks.push(...(above ? [a, b] : [b, a]));
      await out(song, flags);
    }
  },

  euclid() {
    const p = tb.rhythm.euclid(Number(pos[0]), Number(pos[1]), num(flags.rotate, 0));
    print(`${tb.rhythm.toString(p)}   intervals ${tb.rhythm.intervals(p).join('-')}`);
  },

  polymeter() {
    const layers = pos.map((p, i) => ({ pattern: p, pitch: i }));
    const { events, steps } = tb.rhythm.polymeter(layers);
    const grid = pos.map((_, li) => Array.from({ length: steps }, (_, s) => (events.some((e) => e.step === s && e.layer === li) ? 'x' : '.')).join(''));
    print(`realigns after ${steps} steps\n` + grid.join('\n'));
  },

  nr() {
    const [from, arg] = pos;
    if (/^[PLRNSH]+$/.test(arg)) print(tb.neoriemannian.apply(from, arg).path.join(' -> '));
    else {
      const r = tb.neoriemannian.shortestPath(from, arg);
      print(r.path.join(' -> '));
    }
  },

  pcset() {
    const set = pos.map((x) => (/^\d+$/.test(x) ? Number(x) : x));
    const d = tb.pcset.describeSet(set);
    print(`pcs ${d.pcs.join(',')}  normal ${d.normal.join(',')}  prime ${d.primeString}  vector <${d.vector.join('')}>  complement [${d.complementPrime.join(',')}]`);
  },

  row() {
    const r = pos.map((x) => (/^\d+$/.test(x) ? Number(x) : x === 'T' ? 10 : x === 'E' ? 11 : x));
    const m = tb.pcset.rowMatrix(r);
    print(m.map((row) => row.map((x) => String(x).padStart(2)).join(' ')).join('\n'));
    print(`all-interval: ${tb.pcset.isAllInterval(r)}   combinatorial: ${tb.pcset.combinatoriality(r).all.join(' ') || 'none'}`);
  },

  tuning() {
    const sc = tb.tuning.getScale(pos.join(' '));
    print(`${sc.name}: ${sc.steps.map((c) => c.toFixed(2)).join(' ')}`);
    const edoM = /^(\d+)-?edo$/i.exec(pos.join(''));
    if (edoM) for (const e of tb.tuning.edoErrors(Number(edoM[1]))) print(`  ${e.interval.padEnd(5)} ${String(e.cents).padEnd(9)} -> ${e.steps} steps = ${e.edoCents} (${e.error > 0 ? '+' : ''}${e.error})`);
    if (flags.scl) {
      fs.writeFileSync(flags.scl, tb.tuning.toScala(sc));
      print(`wrote ${flags.scl}`);
    }
  },

  sieve() {
    print(tb.algorithmic.sieve(pos.join(' '), num(flags.lo, 0), num(flags.hi, 24)).join(' '));
  },

  async theory() {
    const name = pos.join(' ');
    const th = tb.madeup.THEORIES[name] ?? (fs.existsSync(name) ? JSON.parse(fs.readFileSync(name, 'utf8')) : null);
    if (!th) throw new Error(`Unknown theory "${name}". Known: ${Object.keys(tb.madeup.THEORIES).join(', ')} (or a .json file)`);
    const line = tb.madeup.generateFromTheory(th, { length: num(flags.length, 16), seed: flags.seed ?? 1 });
    const notes = tb.madeup.theoryToNotes(th, line);
    print(`${th.name}: ${line.map((x) => `${x.degree}:${x.dur}`).join(' ')}`);
    if (flags.o) {
      const end = notes[notes.length - 1].start + notes[notes.length - 1].dur;
      const bars = Math.ceil(end / 3840);
      const microtonal = notes.some((n) => n.cents);
      if (microtonal) {
        fs.mkdirSync(path.dirname(path.resolve(flags.o)), { recursive: true });
        const sc = th.pitch.edo ? `${th.pitch.edo}-EDO` : { name: th.name, steps: th.pitch.steps, period: th.pitch.period ?? 1200 };
        fs.writeFileSync(`${flags.o}.mid`, tb.tuning.microtonalMidi(line.map((x, i) => ({ start: notes[i].start, dur: notes[i].dur, degree: x.degree })), { scale: sc, tonicMidi: th.tonic ?? 60 }));
        fs.writeFileSync(`${flags.o}.scl`, tb.tuning.toScala(sc));
        print(`wrote ${flags.o}.mid (pitch-bend microtonal) and ${flags.o}.scl; GP/MusicXML would round to 12-TET so they are skipped`);
      } else {
        const song = tb.createSong({ title: th.name, bars, tempo: 90 });
        song.tracks.push({ name: th.name, kind: 'pitched', program: 0, tuning: null, notes: notes.map(({ start, dur, pitch, vel }) => ({ start, dur, pitch, vel })) });
        await out(song, flags);
      }
    }
  },

  list() {
    const what = pos[0];
    const lists = {
      genres: () => Object.keys(tb.form.GENRES),
      forms: () => Object.entries(tb.form.FORMS).map(([n, f]) => `${n}: ${f.map((s) => `${s[0]}(${s[1]})`).join(' ')}`),
      progressions: () => Object.entries(tb.progressions.PROGRESSIONS).map(([n, p]) => `${n.padEnd(20)} ${p.mode.padEnd(7)} ${p.romans.join(' ')}`),
      grooves: () => Object.entries(tb.drums.GROOVES).map(([n, g]) => `${n.padEnd(12)} ${g.meter.join('/')}`),
      scales: () => Object.keys(tb.scales.SCALES),
      tunings: () => [...Object.keys(tb.TUNINGS), '', ...Object.keys(tb.tuning.SCALES), '<n>-EDO'],
      theories: () => Object.entries(tb.madeup.THEORIES).map(([n, t]) => `${n}: ${t.description}`),
      instruments: () => Object.entries(tb.orchestration.INSTRUMENTS).map(([n, i]) => `${n.padEnd(14)} ${i.range.map((m) => tb.pitch.midiToName(m)).join('-')}${i.transpose ? `  (written ${i.transpose > 0 ? '+' : ''}${i.transpose})` : ''}`),
      ensembles: () => Object.entries(tb.orchestration.ENSEMBLES).map(([n, l]) => `${n}: ${l.join(', ')}`),
    };
    if (!lists[what]) throw new Error(`tb list ${Object.keys(lists).join('|')}`);
    print(lists[what]().join('\n'));
  },
};

if (!cmd || !commands[cmd]) {
  print(HELP);
  process.exit(cmd ? 2 : 0);
}
try {
  await commands[cmd]();
} catch (e) {
  console.error(`tb ${cmd}: ${e.message}`);
  process.exit(1);
}
