---
name: algorithmic-composition
description: Process-based composition - L-systems with turtle melodies, elementary cellular automata, logistic-map chaos, random walks and 1/f noise, 1D Gray-Scott reaction-diffusion, Fibonacci words, Xenakis sieves, and text/number mappings (gematria, digit roots) turned into notes and rhythms. Use for generative, rule-driven or concept-driven pieces (pedal ideas like the Dragon Curve delay or Turing EQ).
---

# algorithmic-composition

Builds on `music-core`. Every process returns numbers or 0/1 patterns; map them with `toNotes` / `patternToNotes`
or `tb.rhythm.writePattern`.

```js
const A = tb.algorithmic;
const s = A.lsystem('F', { F: 'F+F--F+F' }, 3);              // stochastic: { F: [[2, 'F+F'], [1, 'F-F']] }
const mel = A.turtleMelody(s);                                 // F/G play+step, +/- direction, [ ] branch, > < duration
A.elementaryCA(30, { width: 16, generations: 8 })              // rows of 0/1
A.logistic(32, { r: 3.9 }); A.randomWalk(32, { seed }); A.pinkNoise(32, { seed })
A.threshold(A.grayScott1D({ cells: 32, steps: 1500, seed }))   // reaction-diffusion -> rhythm
A.fibonacciWord(16); A.fibonacci(10)
A.sieve('(3@0 | 4@1) & !2@0', 0, 24)                           // Xenakis sieve: | & ! ( )
A.letterValues('amen'); A.wordNumbers('our father who art in heaven'); A.digitRoot(1987)
A.toNotes(values, { key: 'D minor', unit: 480, durs: [1, 1, 2], normalize: false, range: [55, 79] })
A.patternToNotes(pattern, { unit: 240, pitch: 60 })
```

```bash
node tools/music/bin/tb.mjs sieve "(3@0 | 4@1) & !2@0" --hi 36
```

Tested: L-system rewriting (Fibonacci word), turtle note counts, rule-90 CA, bounded walks, sieve algebra,
gematria, Gray-Scott stays finite, mapped notes validate.

Example: `examples/music/lsystem-ca.*` (L-system melody, rule-30 rim clicks, Fibonacci-word kick).
