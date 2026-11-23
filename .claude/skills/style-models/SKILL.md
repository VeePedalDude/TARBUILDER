---
name: style-models
description: Learn a style from example music (your own GP files, MusicXML or generated songs) with variable-order Markov models for melodies, chord progressions (as roman numerals) and drum patterns, then generate new material in that style. Use when asked to write "like" a set of songs or to continue/vary existing material.
---

# style-models

Builds on `music-core`. Models are plain JSON (save them next to the corpus).

```js
// corpus: import your files (quantize human/tuplet timing first)
const songs = [];
for (const f of files) songs.push(tb.quantize(await tb.gp.importScore(f), 240));

const mm = tb.style.trainMelodyModel(songs, { order: 2, track: 'Lead' });   // or a track index / all pitched tracks
const cm = tb.style.trainChordModel(songs, { order: 2 });                   // chords analysed as roman numerals
const dm = tb.style.trainDrumModel(songs, { order: 4, steps: 16 });
fs.writeFileSync('models/melody.json', JSON.stringify(mm));

const prog = tb.style.generateFromChordModel(cm, { key: 'E major', length: 8, seed, temperature: 1 });
const notes = tb.style.generateFromMelodyModel(mm, song, { start: 0, bars: 4, range: [60, 79], seed });
tb.style.generateFromDrumModel(dm, song, drumTrack, { from: 0, bars: 4, seed });
```

- Melody tokens are scale-degree steps + duration in 16ths, so a model trained in one key works in any key.
- Higher `order` copies the corpus more closely; lower is more random. `temperature` < 1 = safer, > 1 = wilder.
- The sampler backs off to shorter contexts when it hits an unseen context; output never leaves `range`.
- `tb import song.gp -o song.json --quantize 240` turns a GP file into IR JSON from the command line.

Tested: models train on a 4-song corpus, generate valid in-range material, and survive a JSON round trip.

## Known limits

- Monophonic melody model (highest note per onset). Chord models need `song.chords` (GP chord names or a
  harmonisation via `tb.harmonize.harmonizeMelody`).
- Small corpora overfit at order >= 3: use 1-2 for a handful of songs.
