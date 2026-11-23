---
name: alphatab-gp7
description: Write guitar/bass/drum tabs as alphaTex and build them into Guitar Pro 7 (.gp) files plus MIDI, with bar-length and playability checks. Use when asked to make, generate, transcribe, edit or inspect a Guitar Pro / .gp / .gpx / .gp5 file or a tab.
---

# alphaTab → Guitar Pro 7

Tabs are written as **alphaTex** text (`.atex`), then built with the repo's `tarb` CLI
(alphaTab 1.9.0, pinned). Output is a `.gp` file restamped for Guitar Pro 7, and optionally a `.mid`.

## Setup (once per clone)

```bash
cd tools/alphatab && npm install
```

## Workflow

1. Write the song as `songs/<name>.atex` (start from `examples/drop-d-riff.atex`).
   Syntax: `alphatex-reference.md` in this folder. Only use effects listed there. They are tested.
2. Build:
   ```bash
   node tools/alphatab/bin/tarb.mjs build songs/<name>.atex --midi
   ```
   `build` refuses to write if there are errors. Fix every ERROR; read every WARNING and either fix it
   or say why it's intended.
3. Deliver the `.gp` (and `.mid` if useful). Say which checks passed and that GP7 opening is
   confirmed only by the user.

Other commands:
- `tarb check <file>`: lint `.atex` or any GP file without writing
- `tarb dump <file.gp|.gpx|.gp5> [-o out.atex]`: turn an existing GP file into editable alphaTex
- `tarb info <file>`: one-line-per-track summary
- `--gp8`: keep alphaTab's original GP8 header instead of the GP7 restamp

To edit a user's existing GP file: `dump` it to `.atex`, edit the text, `build` it back.

## Rules that catch most mistakes

- **String 1 is the highest-pitched string.** `\tuning` lists strings high → low:
  guitar standard `(E4 B3 G3 D3 A2 E2)`, drop D `(E4 B3 G3 D3 A2 D2)`, bass `(G2 D2 A1 E1)`.
- **Notes are `fret.string`**. Durations are a `:N` prefix that sticks until changed (`:4`, `:8`, `:16`),
  or a per-beat suffix `5.3.8`.
- **Every bar must exactly fill the time signature**, and end with `|`. `check` reports bar sums in quarter-notes.
- **Tuplets** are a beat effect: `{tu 3}` or any ratio `{tu (7 4)}` (7 in the time of 4). `check` sums bars with
  exact fractions, so a bar of septuplets is full even though alphaTab's own ticks round to 959.
  GP holds one tuplet per beat: write nested tuplets as one combined ratio, e.g. five 32nds `{tu (15 8)}`
  inside a triplet eighth. Change meter with `\ts (7 8)` at the start of a bar.
- **Every track needs the same number of bars.** Pad with rests (`:1 r`). alphaTab silently pads short
  tracks with empty bars; `check` warns.
- **Note effects vs beat effects:** in a chord, put note effects on each note:
  `(5.6{lr} 5.5{lr})`, not `(5.6 5.5){lr}` (error). Beat effects like `{ch "E"}`, `{tu 3}`, `{d}`, `{dy ff}`
  go after the closing `)`.
- **Hammer-ons and pull-offs are both `{h}`**, placed on the note *before* the legato move.
  `{p}` is a pick stroke, not a pull-off.
- **Bends are in quarter-tones**: `{b (0 4)}` = full bend, `{b (0 2)}` = half, `{b (4 0)}` = pre-bend release.
  `{bu}` is a *brush up*, not a bend.
- **Drums** need `\articulation defaults` after `\staff`, then use ids like `KickHit`, `SnareHit`,
  `HiHatClosed`, `CrashMediumHit` (full list in the reference).
- Define chord diagrams with `\chord ("E" 0 0 1 2 2 0)` (high → low, `x` = muted) before `{ch "E"}`.
- Use the parenthesised metadata form `\title ("X")`, `\tempo (120)`. The old bare form only warns, but don't use it.
- Keep it playable: chord shapes within a 5-fret stretch, no two notes on one string, frets ≤ 24.
  `check` enforces these (limits are in `LIMITS` at the top of `tools/alphatab/lib/tab.mjs`).

## Known limits

- The GP7 header restamp (`GP7_HEADER` in `lib/tab.mjs`) is not yet confirmed against a real GP7
  install. If GP7 rejects a file, try the `--gp8` build and report which one opened.
- An upstream alphaTab issue reports drum tracks exported by alphaTab being silent under RSE in GP8.
  Use the MIDI sound in GP if drums are silent.
- Odd tuplet ratios like 15:8 or 21:16 are valid in the GP file and survive the round trip, but whether
  GP7 draws them cleanly hasn't been checked.
- `tarb` checks structure and playability, not musical taste. Listen to the `.mid` or open in GP.

## Tests

`cd tools/alphatab && npm test`. Run after changing `lib/` or adding an example. Every `.atex` in
`examples/` must build with zero errors and zero warnings.
