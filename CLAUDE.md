# TARBUILDER: rules for Claude

- This repo is a toolbox of music-generation skills. Skills: `.claude/skills/`. Code: `tools/`.
- Start with `.claude/skills/music-core/SKILL.md` for anything musical; then the skill for the task
  (songwriting, classical-writing, jazz-harmony, style-models, rhythm-lab, post-tonal, tuning-lab,
  algorithmic-composition, made-up-theory). Hand-written tabs: `alphatab-gp7`.
- Build and test, don't just write. Music goes through the song IR, `validateSong`, and `render()`;
  a `.gp` is delivered only after the tarb checks pass with zero errors. Report any warnings that remain and why.
- After changing `tools/music`, run `npm test` there; after changing `tools/alphatab`, run `npm test` there.
  Keep every test passing. New behaviour gets a new test.
- Generators take a `seed`/`rng`; keep them deterministic (no `Math.random`). Use `rng.fork(label)` for sub-parts.
- Pin dependency versions exactly. alphaTex syntax changes between alphaTab releases. `tools/music` has no dependencies.
- Keep tweakable values (rule weights, limits, ranges, header values) as named constants at the top of files.
- Report what was verified (validated, tarb-checked, round-tripped, rule-checked) separately from what wasn't
  (opening in GP7, how it sounds, LilyPond compiling).
- `node_modules/` is never committed. Built examples (`examples/**`) are committed so they can be opened directly.
