---
name: songwriting
description: Write songs - full arrangements from a genre spec, chord progressions with cadences, rule-based melodies with a critic, harmonising a melody, bass lines, guitar comping with real chord shapes, drum grooves and fills, guitar riffs, song forms and lyric fitting. Use when asked to compose, generate or arrange a song, riff, progression, melody, bass line or beat.
---

# songwriting

Builds on `music-core` (read it for the song format and rendering).

## Fastest path: a whole song

```bash
node tools/music/bin/tb.mjs song --genre metal --seed 3 -o songs/metal-1
node tools/music/bin/tb.mjs song --genre pop --key "D major" --tempo 104 --form pop --keys -o songs/pop-1
node tools/music/bin/tb.mjs spec my-spec.json -o songs/x
```

```js
const song = tb.arrange({
  genre: 'rock', key: 'E minor', tempo: 128, seed: 4, title: 'Name',
  form: [['Intro', 4, 0.4], ['Verse', 8, 0.6], ['Chorus', 8, 0.9]],   // or a form name
  progressions: { Verse: 'aeolian vamp', Chorus: ['i', 'VI', 'III', 'VII'] },
  parts: { drums: true, bass: true, guitar: true, lead: true, keys: false },
  guitar: { style: 'gallop', tuning: 'drop d' }, bass: { style: 'eighths' }, lead: { range: [60, 77], density: 0.5 },
});
```

Genres: rock pop punk metal metalcore deathcore tech-death blues jazz funk folk lofi reggae ballad (`tb list genres`). Each sets tempo range, keys,
meter, groove, form, progressions, comp and bass styles, plus optional per-section grooves/comps (`sectionGrooves`, `sectionComps`). Energy per section (0-1) thins or fills drums, comping and melody.
Repeated sections reuse the same melody. In metal/metalcore/deathcore a `Breakdown` section is written by `breakdownRiff`
(tonic chord, kick locked to the chugs, bass doubling, the last breakdown in deathcore drops to quarter time); deathcore and
tech-death have no clean lead. Songs end on the tonic when the last section is an Outro/Ending.

## Parts, one at a time

| Part | Call | Options |
|---|---|---|
| progression (library) | `tb.progressions.realize('royal road', 'D major')` | `tb list progressions` (31) |
| progression (generated) | `generateProgression({ key, length, complexity: 0-3, cadence, seed })` | cadences: authentic half plagal deceptive none |
| place chords | `placeChords(song, prog, { bar, perBar, repeat })` | |
| melody | `tb.melody.generateMelody(song, { from, to, range, density, phrase, form: 'sentence'|'period', seed, candidates })` | `MELODY_RULES` weights |
| melody critic | `melodyReport(song, notes)` | chord tones on beats, stepwise %, leaps, recovery, ends on tonic, score |
| harmonise a melody | `tb.harmonize.harmonizeMelody(song, notes, { perBar, sevenths, secondaries, borrowed })` | Viterbi over functional harmony |
| harmony line | `harmonyLine(song, notes, { mode: 'thirds'|'sixths'|'counter' })` | |
| bass | `tb.accompany.bassLine(song, track, { style })` | root eighths root-fifth octaves walking syncopated arpeggio |
| comping | `comp(song, track, { style, pattern })` | strum power gallop arpeggio skank pad block jazz shuffle funk; strum patterns in `STRUMS` |
| guitar shapes | `tb.voicing.chordShapes('F#m7', { tuning })` -> diagrams like `x32010` | `powerChord(midi)` |
| drums | `tb.drums.writeGroove(song, track, fromBar, toBar, { groove, energy, fillEvery, seed })` | 26 grooves incl. 12/8, 6/8, 7/8, 5/4; metal feels `halftime`, `quarter time` (2-bar), `skank`, `blast`, `gravity blast`, `double kick` |
| riffs | `tb.riffs.pedalRiff`, `powerRiff`, `legatoRun`, `pentatonicLick` | pre-fingered |
| breakdown | `tb.riffs.breakdownRiff(song, gtr, { from, to, drums, feel: 'half'|'quarter', escalate, seed })` | uneven 2-5 sixteenth groups, rests kept, kick = guitar onsets; tune `BREAKDOWN` |
| form | `tb.form.planForm('pop')` | `FORMS`, `GENRES` |
| motif | `tb.motif.invert / retrograde / augment / sequence / transposeDiatonic / ornament` | |
| lyrics | `tb.lyrics.syllables('beautiful')`, `scan(text)` (stress), `fitLyrics(track, text)`, `rhythmForLine(text)`, `rhymes(a,b)` | |

## Workflow

1. Plan form + key + tempo (or let `arrange` pick from the genre).
2. Chords first (`song.chords`): everything else follows them.
3. Melody: generate, then read `melodyReport`. Targets that the tests enforce: chord tones on beats >= 0.8,
   stepwise >= 0.4, no leaps over an octave, ends on the tonic.
4. Bass, comping, drums from the chords. Fills at section ends, crash at section starts.
5. `validateSong`, then `render`. Fix every error; explain any warning you keep.

## Known limits

- Lyrics syllabification is rule-based English (~90%); hyphenate a word yourself ("beau-ti-ful") to override.
- Melodies use binary rhythms (no triplets) except in compound meters, which divide in three.
- Comp styles voice-lead on keys; on guitar they use the best-ranked shape per chord (not voice-led between shapes).
