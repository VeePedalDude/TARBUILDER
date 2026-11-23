---
name: made-up-theory
description: Invent a music theory as JSON rules (pitch universe incl. EDO/just ratios, allowed steps, forbidden moves, rhythm alphabet, constraints like palindromes, cadences, climax, net motion per bar), then generate lines that obey it and check any line against it. Use when asked to make up, design or explore a new music system.
---

# made-up-theory

Builds on `music-core`; microtonal theories render through `tuning-lab`.

```bash
node tools/music/bin/tb.mjs list theories
node tools/music/bin/tb.mjs theory "golden steps" --length 16 --seed 2 -o songs/golden
node tools/music/bin/tb.mjs theory my-theory.json --length 13 -o songs/mine
```

```js
const th = {
  name: 'Whole-tone climber', description: '...',
  pitch: { scale: 'whole tone' },              // or { edo: 19 } or { steps: [cents...], period: 1200 }
  tonic: 60, range: [0, 12],                   // degree range
  intervals: { allowed: [-1, 1, 2], weights: { 1: 3 } },
  forbid: [[5, 0]],                            // forbidden consecutive degrees (mod scale size)
  rhythm: { durations: [2, 4], weights: [2, 1], unit: 240, barUnits: 16, barEnds: 'exact' },
  rules: [{ type: 'start', degrees: [0] }, { type: 'cadence', pattern: [1, 0] }, { type: 'avoid', degrees: [3] }],
};
const line = tb.madeup.generateFromTheory(th, { length: 12, seed });   // [{ degree, dur }]
tb.madeup.checkTheory(th, line);                                       // [] when it obeys every rule
const notes = tb.madeup.theoryToNotes(th, line);                       // pitch (+ cents for microtonal)
```

Rule types (`tb.madeup.RULE_TYPES`): start, end, maxSameDirection, leapRecovery, noRepeat, palindrome,
sumPerBar, climax, avoid, cadence, durationSequence. Unknown types throw.
Starter theories: golden steps (Fibonacci steps and durations), mirror law (palindromes, dorian), ratio engine
(7-limit just intonation), prime pulse (19-EDO, prime durations, 17-unit bars).

## Workflow

1. Write the theory JSON (start from a starter in `THEORIES`).
2. Generate a few seeds; read `checkTheory` output (must be empty).
3. 12-TET theories render with `tb.render`; microtonal ones write pitch-bend MIDI + .scl (the CLI does this).
4. Save good theories as files in `theories/` so they can be reused and versioned.

## Known limits

- Generation is randomized backtracking: very tight rule sets can fail with a clear error; loosen a rule or change
  the length. Even-length palindromes need step 0 allowed (the middle note repeats).
