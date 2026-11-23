---
name: post-tonal
description: Post-tonal and transformational theory - neo-Riemannian P/L/R/N/S/H operations, Tonnetz walks and shortest paths, hexatonic/octatonic cycles; pitch-class sets (normal form, prime form, interval vectors, Tn/TnI relations, Z-relations, all set classes); twelve-tone rows (matrix, P/I/R/RI forms, all-interval rows, hexachordal combinatoriality). Use for film-style chromatic chord motion, set analysis or serial writing.
---

# post-tonal

Builds on `music-core`.

```bash
node tools/music/bin/tb.mjs nr C PLR          # C -> Cm -> Ab -> Fm
node tools/music/bin/tb.mjs nr C F#           # shortest path
node tools/music/bin/tb.mjs pcset C E G Bb    # prime [0258], vector <012111>
node tools/music/bin/tb.mjs row 0 11 7 8 3 1 2 10 6 5 4 9
```

## Neo-Riemannian

```js
tb.neoriemannian.apply('C', 'PLR')            // { result, path }
tb.neoriemannian.shortestPath('C', 'Ebm')     // BFS over P L R (pass { ops: 'PLRNSH' } for more)
tb.neoriemannian.hexatonicCycle('C')          // C Cm Ab G#m E Em
tb.neoriemannian.octatonicCycle('C'); lrChain('C')   // 8 and 24 triads
tb.neoriemannian.tonnetzWalk('C', 16, rng)    // each step one voice moves <= 2 semitones
tb.neoriemannian.voiceLeadingDistance('C', 'Am')
```
P = parallel, L = leading-tone exchange, R = relative; N = RLP (C->Fm), S = LPR (C->C#m), H = LPL (C->G#m).

## Sets

`tb.pcset.normalForm`, `primeForm` (Rahn), `intervalVector`, `relations(a, b)` (T/TnI), `zRelated`, `setClasses(n)`,
`complementSet`, `describeSet`. Tested: set-class counts per cardinality are 1 1 6 12 29 38 50 38 29 12 6 1 1 and
every hexachord shares its interval vector with its complement.

Prime forms follow Rahn's algorithm; Forte's book differs for 5-20, 6-Z29, 6-31, 7-20, 8-26 (and complements).
Forte numbers (e.g. "4-Z15") aren't computed: quote prime forms instead.

## Twelve-tone

`rowMatrix(row)`, `rowForms(row)` (P0..P11, I, R, RI), `isAllInterval`, `combinatoriality`, `randomRow({ allInterval })`,
`rowToNotes(form, { durs, range })` (octave chosen nearest the previous note).
