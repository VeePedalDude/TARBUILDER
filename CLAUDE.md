# TARBUILDER: rules for Claude

- This repo is a toolbox of music-generation skills. Skills: `.claude/skills/`. Code: `tools/`.
- For any Guitar Pro / tab work, follow `.claude/skills/alphatab-gp7/SKILL.md`.
- Build and test, don't just write. A `.gp` is delivered only after `tarb build` succeeds with zero
  errors; report any warnings that remain and why.
- After changing anything in `tools/alphatab/`, run `npm test` there and keep every test passing.
  New behavior gets a new test.
- Pin dependency versions exactly. alphaTex syntax changes between alphaTab releases.
- Keep tweakable values (limits, header values) as named constants at the top of files.
- Report what was verified (built, checked, round-tripped) separately from what wasn't (opening in GP7, how it sounds).
- `node_modules/` is never committed. Built examples (`examples/*.gp`, `*.mid`) are committed so they can be opened in GP7 directly.
