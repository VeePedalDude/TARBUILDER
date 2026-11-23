# TARBUILDER

Music-generation skills and tools for Claude (and humans), from basic theory to made-up theory.
Skills live in `.claude/skills/<name>/` so Claude Code loads them when this repo is open; code lives in `tools/`.
Everything is seeded (same seed = same music), validated, and tested.

## Skills

| Skill | What it does |
|---|---|
| [`music-core`](.claude/skills/music-core/SKILL.md) | Song format, spelled theory (notes, scales, chords, keys, roman numerals), render to GP7 / MIDI / MusicXML / LilyPond |
| [`alphatab-gp7`](.claude/skills/alphatab-gp7/SKILL.md) | Hand-written alphaTex tabs -> Guitar Pro 7 with bar-length and playability checks; dump GP files back to text |
| [`songwriting`](.claude/skills/songwriting/SKILL.md) | Whole songs from a genre spec; progressions, melodies + critic, harmonisation, bass, comping with real guitar shapes, drums, riffs, form, lyrics |
| [`classical-writing`](.claude/skills/classical-writing/SKILL.md) | SATB chorales with a voice-leading checker, species counterpoint 1-5, orchestration with ranges and transpositions |
| [`jazz-harmony`](.claude/skills/jazz-harmony/SKILL.md) | Reharmonisation (tritone, ii-V, modal interchange, Coltrane...), chord scales, guide tones, bebop lines |
| [`style-models`](.claude/skills/style-models/SKILL.md) | Learn melodies / chords / drums from your own files and generate in that style |
| [`rhythm-lab`](.claude/skills/rhythm-lab/SKILL.md) | Euclidean rhythms, polymeter, polyrhythm, rhythm trees, phasing, metric modulation |
| [`post-tonal`](.claude/skills/post-tonal/SKILL.md) | Neo-Riemannian P/L/R and Tonnetz, pitch-class sets, twelve-tone rows |
| [`tuning-lab`](.claude/skills/tuning-lab/SKILL.md) | EDOs, just intonation, historical temperaments, Scala files, microtonal pitch-bend MIDI |
| [`algorithmic-composition`](.claude/skills/algorithmic-composition/SKILL.md) | L-systems, cellular automata, chaos, reaction-diffusion, sieves, numerology mappings |
| [`made-up-theory`](.claude/skills/made-up-theory/SKILL.md) | Invent a rule system in JSON, generate lines that obey it, check lines against it |

## Quick start

```bash
cd tools/alphatab && npm install && npm test      # GP7 builder (19 checks)
cd ../music && npm test                            # theory + generators + exporters (48 tests)
node bin/tb.mjs song --genre rock --seed 7 -o ../../songs/first-song
node bin/tb.mjs help
```

`songs/first-song.gp` opens in Guitar Pro 7; `.mid`, `.musicxml` and `.ly` go to a DAW, MuseScore/Sibelius, or LilyPond.

## Examples

`examples/` has hand-written alphaTex tabs. `examples/music/` has one of everything (rock, blues, metal and 6/8 songs,
a Coltrane-changes bebop line, an SATB chorale, species 2/4/5 counterpoint, a string quartet, Euclidean polymeter,
a Tonnetz walk, a twelve-tone row, made-up theories incl. 7-limit just intonation, and an L-system piece). Rebuild with
`node tools/music/examples/build.mjs`.

## Guitar Pro 7 compatibility

alphaTab 1.9 stamps `.gp` files as GP 8.1.3; `tarb` restamps them with GP7-era header values by default.
**Not yet confirmed in GP7.** Compare `examples/drop-d-riff.gp` (GP7 header) with `examples/drop-d-riff.gp8-header.gp`
and report which opens. If only the GP8 one works, flip the default in `tools/alphatab/lib/tab.mjs` (`GP7_HEADER` / `toGp7`).

## Layout

```
.claude/skills/<skill>/SKILL.md   instructions Claude follows
tools/alphatab/                   alphaTab 1.9 bridge: tarb CLI (build / check / dump / info)
tools/music/src/theory            pitch, scale, chord, key, roman
tools/music/src/gen               progressions, melody, motif, harmonize, accompany, drums, riffs, form, lyrics, arranger, reharm, jazz
tools/music/src/analysis          voiceleading, counterpoint, orchestration, style
tools/music/src/lab               rhythm, neoriemannian, pcset, tuning, algorithmic, madeup
tools/music/src/io                alphatex, midi, musicxml, lilypond, gp (import/export), render, notation, fret
tools/music/bin/tb.mjs            CLI
examples/                         source and built output
songs/                            your work (create as needed)
```

## Adding a skill

1. `.claude/skills/<name>/SKILL.md` with `name` + `description` frontmatter (the description decides when it's used).
2. Code in `tools/music/src/...` (or its own `tools/<name>/`) with tests in `test/`.
3. Add it to `src/index.mjs`, the CLI if useful, and the table above.

Maker credit: VeePedalDude (veepedaldude@gmail.com)
