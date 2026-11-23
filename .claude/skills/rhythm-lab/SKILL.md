---
name: rhythm-lab
description: Rhythm theory and generators - Euclidean rhythms, necklaces and evenness, additive meters, changing time signatures, polymeter (layers that realign at the LCM), polyrhythm, branching nested tuplets (rhythm trees written exactly, phrased a a' b a, several layers splitting differently), Reich phasing, metric modulation, and writing patterns into drum or pitched tracks. Use for polymetric sequencers, odd or changing meters, nested polyrhythms, or rhythm experiments.
---

# rhythm-lab

Builds on `music-core`. Patterns are `[1,0,0,1,...]` or strings `'x..x..x.'` (x/X/1 = hit).

```bash
node tools/music/bin/tb.mjs euclid 5 8            # x.xx.xx.  intervals 2-1-2-1-2
node tools/music/bin/tb.mjs polymeter "x.." "x..." "x...."
```

```js
tb.rhythm.euclid(3, 8)                    // tresillo; rotate with the 3rd arg
tb.rhythm.intervals('x..x..x.')           // [3,3,2]; fromIntervals([3,3,2])
tb.rhythm.necklace(p); evenness(p); complement(p); additive('2+2+3')
tb.rhythm.polymeter([{ pattern: 'x..', pitch: 'kick' }, { pattern: euclid(5, 7), pitch: 'hh' }])   // { events, steps }
tb.rhythm.writePolymeter(song, drumTrack, layers, { stepTicks: 240 })
tb.rhythm.writePattern(song, track, pattern, { bar, bars, pitch: 'rim' })
tb.rhythm.polyrhythm(3, 2, 1920)          // onset ticks of each stream
tb.rhythm.rhythmTree([1, [1, [1, [1, 1]], 2]], 3840)   // proportional subdivision, -n = rest
tb.rhythm.phase('x.xx.x', { repeats: 4 }) // Reich: second voice shifts a step every 4 cycles
tb.rhythm.metricModulation(120, 3, 2)     // 80: three old beats = two new beats
```

Tested: Euclidean output matches Toussaint's published patterns up to rotation and gaps differ by at most one
for every k <= n <= 24; polymeter LCM; tree arithmetic; written patterns validate.

Polymeter steps that don't land on the 1/32 grid, or tree splits that don't divide evenly, throw instead of
rounding (e.g. a 3:2 tree inside 100 ticks). For tuplets use the branching tools below, which write them exactly.

## Changing time signatures

```js
song.meterChanges.push({ bar: 2, num: 13, den: 16 }, { bar: 3, num: 7, den: 8 });   // keep sorted by bar
tb.drums.meterGrouping(7, 8)               // [2, 2, 3]   (13/16 -> [4,3,3,3], 6/8 -> [3,3])
tb.drums.additiveGroove(7, 8, { style })   // a groove for any meter: rock, skank, blast, 'double kick', halftime
tb.arrange({ genre: 'rock', form: [['Verse', 4, 0.7, { meters: [[7, 8]] }], ['Chorus', 4, 0.9, { meters: [[4, 4], [3, 4]] }]] })
```

In `tb.arrange`, a form entry's 4th item `{ meters }` cycles per bar. Drums use the section's groove if it fits the
bar's meter, otherwise the same style rebuilt on that meter's beat groups. Comp, bass and melody follow the bar lengths.
Section options `poly: 7` (a 7-sixteenth riff cycling against the bar, kick and bass locked to it) and
`branching: true` (nested tuplets via phraseRhythm) work in any genre. `genre: 'mathcore'` uses all of it.

## Branching nested polyrhythms (exact tuplets)

Tree grammar: leaf = weight (negative = rest); node = `[weight, [children]]` (always a number then an array);
`[[1, [1,1,1,1,1]], 1, 1]` = thirds of a beat, the first third in five (a quintuplet inside a triplet).

```bash
node tools/music/bin/tb.mjs tree "[[1,[1,1,1,1,1]],1,1]"          # exact leaves + how each is written
node tools/music/bin/tb.mjs tree --random --splits 3,5 --depth 2 --beats 2 --seed 4
```

```js
tb.branching.nestedRhythm(tree, [2, 1])          // exact leaves over 2 quarters: [{ dur: [1, 15], rest, depth, path }]
tb.branching.branchingTree({ splits: [3, 5], depth: 2, span: [1, 1], seed })   // grow one (tune BRANCH)
tb.branching.mutateTree(tree, { op: 'rebranch' | 'rest' | 'merge' | 'rotate', seed })
tb.branching.writeTree(song, track, { start, span, tree, pitches: ['E2', 'F2'] })   // one tuplet region
tb.branching.phraseRhythm(song, { from, bars, form: "a a' b a", seed, layers: [
  { track: gtr, pitches: ['D2', 'D#2'], splits: [3, 5], depth: 1, fx: { pm: true } },   // splits each beat group
  { track: drums, pitches: ['kick', 'snare'], splits: [2, 4] },
  { track: bass, pitches: ['D1'], across: 5 },                                         // 5 across the whole bar first
] })
tb.tuplets.notate([1, 15])                        // { den: 32, dots: 0, n: 15, m: 8 }
```

How it's stored: `track.tuplets = [{ start, dur, leaves: [{ start, ticks, den, dots, n, m }] }]`, one bar at most
per region and one region per beat group. Notes inside a region sit on leaf boundaries instead of the 1/32 grid.
Exports: alphaTex/GP7 `{tu (n m)}`, MusicXML `<time-modification>` with brackets, LilyPond `\tuplet n/m { }`,
and MIDI at the rounded ticks. GP import rebuilds the regions.

Limits:
- Guitar Pro holds one tuplet per beat, so nesting is flattened to one ratio per note. Five inside a triplet eighth
  becomes 15:8 thirty-seconds: the durations are exact but there is no nested bracket. MusicXML and LilyPond are
  flattened the same way.
- 7- and 11-tuplets can't be whole ticks at 960 PPQ. Leaves are rounded so they always add up, MIDI may be 1 tick
  off, and tarb checks bar lengths with exact fractions.
- One tuplet layer per track. To split kick and snare differently, give them separate drum tracks.
- 64ths and 128ths are allowed inside regions (`BRANCH.minLeaf` = 1/16 quarter).
