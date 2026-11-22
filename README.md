# TARBUILDER

A collection of music-generation skills and tools for Claude (and humans).
Each skill lives in `.claude/skills/<name>/` so Claude Code loads it automatically when this repo is open.
The code it drives lives in `tools/<name>/`.

## Skills

| Skill | What it does | Tool |
|---|---|---|
| [`alphatab-gp7`](.claude/skills/alphatab-gp7/SKILL.md) | Write tabs as alphaTex → build Guitar Pro 7 `.gp` + MIDI, with bar-length and playability checks; dump existing `.gp/.gpx/.gp5` back to text | `tools/alphatab` ([alphaTab](https://github.com/CoderLine/alphaTab) 1.9.0) |

## Quick start

```bash
cd tools/alphatab
npm install
npm test                                              # 17 checks
node bin/tarb.mjs build ../../examples/drop-d-riff.atex --midi
```

Open `examples/drop-d-riff.gp` in Guitar Pro 7.

## tarb commands

```
tarb build <in.atex...> [-o out.gp] [--midi] [--gp8] [--force]
tarb check <file...>          lint .atex or any GP file
tarb dump  <file.gp> [-o x.atex]   GP file -> editable alphaTex
tarb info  <file...>          summary per track
```

`build` won't write a file that has errors: overfull/short bars, notes on a string the tuning doesn't have,
two notes on one string, alphaTex syntax errors. It warns on frets above 24, chord stretches wider
than 5 frets, and tracks shorter than the score. Limits are at the top of `tools/alphatab/lib/tab.mjs`.

## Guitar Pro 7 compatibility

alphaTab 1.9 stamps its output as GP 8.1.3. `tarb` restamps the header with GP7-era values by default.
**This still needs a check in GP7:**

- `examples/drop-d-riff.gp`: GP7 header (default)
- `examples/drop-d-riff.gp8-header.gp`: alphaTab's original GP8 header (`--gp8`)

Open both in GP7 and note which ones load. If only the GP8 one works, flip the default in `GP7_HEADER` / `toGp7()`.

## Layout

```
.claude/skills/<skill>/SKILL.md     instructions Claude follows
.claude/skills/<skill>/*.md         reference sheets
tools/<skill>/                      code + tests
examples/                           source (.atex) + built output (.gp, .mid)
songs/                              your own work (create as needed)
```

## Adding a skill

1. `.claude/skills/<name>/SKILL.md` with `name` + `description` frontmatter (the description decides when Claude uses it).
2. Code in `tools/<name>/` with its own tests.
3. Add a row to the table above.

Maker credit: VeePedalDude (veepedaldude@gmail.com)
