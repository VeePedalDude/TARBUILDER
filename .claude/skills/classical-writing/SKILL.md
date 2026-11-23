---
name: classical-writing
description: Rule-checked classical writing - four-part SATB chorales from roman numerals with a voice-leading checker, Fux species counterpoint (cantus firmus generator, species 1-5 checker and writer, above or below), and orchestration (instrument ranges, transpositions, ensembles). Use for chorales, part-writing homework checks, counterpoint, or writing for real instruments.
---

# classical-writing

Builds on `music-core`.

## SATB chorales

```bash
node tools/music/bin/tb.mjs satb "I vi ii6 V7 I" --key G -o songs/chorale
```

```js
const { chords, issues } = tb.voiceleading.harmonizeSATB(['I', 'IV', 'V', 'I'], { key: 'C major' });
tb.voiceleading.satbToTracks(song, chords, { dur: 3840 });
tb.voiceleading.checkVoiceLeading(myChords, { key: 'C major', romans });   // check your own [[S,A,T,B], ...]
```

Checker rules: ranges (`SATB_RANGES`), crossing, spacing (S-A, A-T octave; T-B twelfth), parallel 5ths/8ves (error),
contrary 5ths/8ves and direct perfects in the outer voices (warning), overlap, leaps, tritone leaps, chord tones,
missing third, bass matches the inversion, doubled leading tone, leading tone resolves up (error in soprano),
chordal sevenths resolve down. The harmoniser uses the checker as its cost; tests require zero errors on seven
progressions including inversions, secondary dominants and minor keys.

## Species counterpoint

```bash
node tools/music/bin/tb.mjs cantus --key "D dorian" --seed 2
node tools/music/bin/tb.mjs counterpoint --species 4 --key "D dorian" --cantus "62 65 64 62 67 65 69 67 65 64 62" -o songs/s4
```

```js
const cf = tb.counterpoint.generateCantus({ key: 'C major', length: 10, seed });
const cp = tb.counterpoint.writeCounterpoint(cf, { species: 1-5, above: true, key, seed });
tb.counterpoint.checkCounterpoint(cf, cp, { species, above, key });   // [{ level, rule, at, message }]
```

Time unit: 1 bar = 4 (half = 2, quarter = 1). Species 4 notes carry `tie: true` on the downbeat.
Rules: consonance tables (P4 dissonant), perfect starts, unison/octave ending by contrary step, parallels between
downbeats (and across the barline in species 2/3), direct perfects in species 1, passing/neighbour/cambiata dissonance,
suspensions prepared and resolved down by step (9-8 allowed, 2-1 not), unisons only at the ends, melodic rules
(no 7ths, tritones, descending minor 6ths, leap recovery, compound leaps, oscillation, unique climax).
Some cantus + species + direction combinations have no solution (e.g. species 4 below over F-D-C endings);
the writer then throws: try another cantus or `above: true`.

## Orchestration

```js
tb.orchestration.orchestrate(song, melodyNotes, { ensemble: 'string quartet', rhythm: 'sustain'|'pulse' });
tb.orchestration.checkRanges(song);             // tracks with `instrument: 'violin'` etc.
tb.orchestration.writtenPitch('alto sax', 60);   // 69
```

`tb list instruments` / `tb list ensembles`. Ranges are typical professional sounding ranges with a comfortable
sub-range (warning outside it). MusicXML writes transposing instruments at written pitch with `<transpose>`
(tested: Bb trumpet, and the importer gets concert pitch back).

## Known limits

- Two-voice counterpoint only; no three-voice species yet.
- SATB harmoniser takes the progression as given (it doesn't choose chords); use `harmonizeMelody` first if needed.
