---
name: rhythm-lab
description: Rhythm theory and generators - Euclidean rhythms, necklaces and evenness, additive meters, polymeter (layers that realign at the LCM), polyrhythm, OpenMusic-style rhythm trees, Reich phasing, metric modulation, and writing patterns into drum or pitched tracks. Use for polymetric sequencers, odd meters, or rhythm experiments.
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
rounding (e.g. a 3:2 tree inside 100 ticks).
