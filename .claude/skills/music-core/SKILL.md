---
name: music-core
description: Base layer for every TARBUILDER music skill - the shared song format (IR), music theory (notes, intervals, scales, chords, keys, roman numerals) and rendering to Guitar Pro 7, MIDI, MusicXML and LilyPond. Use for any music generation, theory question that needs exact spelling, or file conversion.
---

# music-core

Code: `tools/music` (plain Node, no dependencies; GP export uses `tools/alphatab`).

```bash
cd tools/alphatab && npm install        # once, for .gp export/import
cd tools/music && npm test              # 48 tests, all must pass
node tools/music/bin/tb.mjs help        # CLI
```

In scripts: `import * as tb from './tools/music/src/index.mjs'` (adjust the relative path).

## The song format (IR)

Every generator writes it, every exporter reads it. Times are ticks, 960 per quarter, from bar 1.

```js
const song = tb.createSong({ title, tempo: 120, meter: [4, 4], key: 'E minor', bars: 8 });
const g = tb.addTrack(song, { name: 'Guitar', kind: 'fretted', program: 'Distortion Guitar', tuning: 'drop d' });
const v = tb.addTrack(song, { name: 'Lead', kind: 'pitched', program: 'Flute' });
const d = tb.addTrack(song, { name: 'Drums', kind: 'drums' });
tb.addNote(v, 0, 960, 'E4', { lyric: 'hel-' });          // start, dur, pitch (name or midi)
tb.addNote(g, 0, 1920, 40, { fx: { pm: true } });         // fx: pm h sl b:[0,4] v lr x nh g ac st
tb.addNote(d, 0, 480, 'kick');                            // drum names: kick snare hh hhopen ride crash tom1..
song.chords.push({ start: 0, dur: 3840, symbol: 'Em' });  // shown as chord names in GP/MusicXML/LilyPond
song.sections.push({ bar: 0, name: 'Verse' });
song.meterChanges.push({ bar: 4, num: 7, den: 8 });       // optional
```

- `kind: 'fretted'` gets fingered automatically (string/fret, playable 5-fret span) unless notes set `string`/`fret`.
  String 1 = highest string, like Guitar Pro.
- Grid: starts and durations must be multiples of 120 ticks (1/32). `tb.quantize(song, 240)` snaps imported material.
- `tb.validateSong(song)` lists errors (off-grid, past the end, out of tuning range, same pitch overlapping itself)
  and warnings. Exporters refuse invalid songs.

## Rendering

```js
const { files, issues } = await tb.render(song, 'songs/my-song');   // .json .atex .gp .mid .musicxml .ly
await tb.render(song, 'songs/x', { formats: ['gp', 'mid'], swing: 0.5 });
```

`.gp` goes through `tarb` (bar lengths, fingering, round-trip). Default header is the GP7 restamp. `issues` holds
any warnings; deliver only when there are no errors. Import: `await tb.gp.importScore('file.gp')` (also .gpx/.gp5/.musicxml/.atex).

## Theory API (spelled, not just pitch classes)

| Need | Call |
|---|---|
| note math | `tb.pitch.midi('Bb3')`, `noteName`, `transpose('B3','M3')` -> D#4, `interval(a,b)`, `intervalName` |
| scales | `tb.scales.scaleNames('F#','harmonic minor')`, `makeScale(tonic, name, oct)` with `.midi(deg)`, `.snap(m)`, `scalesContaining(pcs)` |
| chords | `tb.chords.parseChord('F#m7b5/C')`, `chordNames`, `nameChord([midi...])`, `closeVoicing`, `voiceLead(prev, sym)` |
| keys | `tb.keys.parseKey('Bbm')`, `signature`, `spellInKey(midi, key)`, `detectKey(notes)`, `closelyRelated` |
| roman | `tb.roman.parseRoman('V7/ii','C')` -> A7, `analyzeRoman('D7','C')` -> V7/V; N6, It6, Fr6, Ger6 supported |

Chord symbols cover triads, sus, 6/69, 7/maj7/m7/mMaj7/m7b5/dim7/aug7, 9/11/13, add9, alterations (b5 #5 b9 #9 #11 b13),
alt, no3/no5, slash bass. Unreadable symbols throw with the exact position.

## Rules

- Always validate (`validateSong`) and render through `render()`; never hand-write `.gp`.
- Keep generators seeded (`seed` / `rng`); same seed = same output. Use `rng.fork(label)` for sub-parts.
- Spell from the key (`spellInKey`) when writing note names; never `fromMidi` for notation.
- Report what was checked (validation, tarb, round-trip) separately from what wasn't (opening in GP7, sound).

## Known limits

- No tuplets in the IR exporters (binary grid only; compound meters like 6/8 and 12/8 are fine).
- LilyPond output is not compiled in the test suite (no LilyPond here); MusicXML and GP are round-tripped through alphaTab.
- Transposing parts: MusicXML writes written pitch + `<transpose>` for tracks with `instrument` (see classical-writing);
  chord names on a transposing part stay in concert pitch.
