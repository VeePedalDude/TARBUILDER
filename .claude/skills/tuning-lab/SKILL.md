---
name: tuning-lab
description: Microtonal and alternative tunings - cents/ratios, EDOs with error tables, just intonation, Pythagorean, quarter-comma meantone, Werckmeister III, Bohlen-Pierce, harmonic series, Scala .scl read/write, JI lattice (monzos) and Tenney height, and microtonal MIDI using per-note pitch bend. Use for xenharmonic writing, tuning tables for synths/pedals, or comparing temperaments.
---

# tuning-lab

Builds on `music-core`.

```bash
node tools/music/bin/tb.mjs tuning 31-EDO --scl out/31edo.scl
node tools/music/bin/tb.mjs tuning "meantone 1/4"
node tools/music/bin/tb.mjs list tunings
```

```js
tb.tuning.cents(3 / 2)                       // 701.955
tb.tuning.approximateRatio(Math.pow(2, 7 / 12))   // { num: 3, den: 2, error }
tb.tuning.getScale('19-EDO' | 'just major' | 'pythagorean' | 'meantone 1/4' | 'werckmeister iii' | 'bohlen-pierce' | 'harmonic 8-16')
tb.tuning.edoErrors(31)                       // how well 31-EDO approximates 3/2 5/4 6/5 7/4 11/8 13/8
tb.tuning.toScala(scale); parseScala(text)    // Scala files round-trip
tb.tuning.monzo('81/80')                      // [-4, 4, -1, 0, 0, 0]
tb.tuning.degreeFreq(scale, degree, tonicHz)
const mid = tb.tuning.microtonalMidi([{ start, dur, degree }], { scale, tonicMidi: 60, bendRange: 2 });
```

Microtonal MIDI puts each sounding note on its own channel (skipping 10) and sets pitch-bend range with RPN 0,
so chords bend independently. Tested: a just major third comes out within 0.2 cents.

## Known limits

- Guitar Pro, MusicXML and LilyPond exports are 12-TET: use the pitch-bend MIDI plus the .scl for microtonal material.
- More than 15 overlapping notes reuse channels (bends then collide).
- Slendro is idealised as 5-EDO; real gamelan tunings vary by set.
