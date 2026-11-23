// Run: npm test   (from tools/alphatab)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTex, loadFile, check, toGp7, toMidi, toAlphaTex, roundTrip, gpHeader } from '../lib/tab.mjs';
import * as at from '@coderline/alphatab';
const loadFileFromBytes = (bytes) => at.importer.ScoreLoader.loadScoreFromBytes(bytes, new at.Settings());

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.join(here, '../../../examples');
let pass = 0, fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };
const errs = (items) => items.filter((d) => d.level === 'error');

// 1. Every example builds clean, round-trips, and gets a GP7 header.
for (const f of fs.readdirSync(examples).filter((f) => f.endsWith('.atex'))) {
  const { score, diagnostics } = loadFile(path.join(examples, f));
  const issues = [...diagnostics.filter((d) => d.level !== 'hint'), ...(score ? check(score) : [])];
  t(`${f}: no errors or warnings`, score && issues.length === 0, issues.map((i) => i.message).join(' | '));
  if (!score) continue;
  const gp = toGp7(score);
  t(`${f}: round-trip`, roundTrip(score, gp).length === 0, roundTrip(score, gp).join('; '));
  t(`${f}: GP7 header`, gpHeader(gp).startsWith('GPVersion 7.'), gpHeader(gp));
  const mid = toMidi(score);
  t(`${f}: MIDI`, String.fromCharCode(...mid.slice(0, 4)) === 'MThd' && mid.length > 100, `${mid.length} bytes`);
  const again = parseTex(toAlphaTex(score));
  t(`${f}: alphaTex re-export parses`, again.score && errs(again.diagnostics).length === 0);
}

// 2. The broken fixture is caught for each planted problem.
{
  const { score } = loadFile(path.join(here, 'fixtures/bad.atex'));
  const msgs = check(score).map((d) => `${d.level}|${d.where}|${d.message}`);
  const has = (re) => msgs.some((m) => re.test(m));
  t('bad: overfull bar 1 is an error', has(/^error\|.*bar 1\|.*overfull/));
  t('bad: short bar 2 is an error', has(/^error\|.*bar 2\|.*short/));
  t('bad: fret 30 warned', has(/^warning\|.*Fret 30/));
  t('bad: short bass track warned', has(/^warning\|track "Bass"\|Bars 2-3 are empty/));
}

// 3. Out-of-range string is rejected by the parser.
{
  const { diagnostics } = parseTex('\\track ("G")\n\\staff {tabs}\n\\tuning (E4 B3 G3 D3 A2 E2)\n:1 3.7');
  t('string 7 on 6-string is an error', errs(diagnostics).some((d) => /string is out of range/i.test(d.message)));
}

// 4. Playability checks.
{
  const { score } = parseTex('\\track ("G")\n\\staff {tabs}\n\\tuning (E4 B3 G3 D3 A2 E2)\n:2 (1.6 8.5) (3.6 5.6)');
  const items = check(score);
  t('8-fret chord stretch warned', items.some((d) => d.level === 'warning' && /spans 8 frets/.test(d.message)));
  t('two notes on one string is an error', items.some((d) => d.level === 'error' && /same string/.test(d.message)));
}

// 5. Piano/vocal staves (no tuning) aren't checked as fretted, before or after a GP round trip.
{
  const { score } = parseTex('\\track ("Piano") { instrument 0 }\n\\staff {score}\n\\tuning (piano)\n:4 C2 (C4 E4 G4) A7 r');
  t('piano staff: no fret/string checks', check(score).length === 0, check(score).map((d) => d.message).join(' | '));
  const back = loadFileFromBytes(toGp7(score));
  t('piano staff after GP export: still clean', check(back).length === 0, check(back).map((d) => d.message).join(' | '));
}

// 5. Tuplets are measured exactly: a bar of septuplets is full, not 3.999 beats; nested (15:8) too.
{
  const tex = '\\track ("G" "G") { instrument 30 }\n\\staff {tabs score}\n\\tuning (E4 B3 G3 D3 A2 E2)\n\\ts (4 4)\n' +
    ':16 ' + Array(28).fill('0.6{tu (7 4)}').join(' ') + ' |\n' +
    ':8 0.6{tu (3 2)} :32 ' + Array(5).fill('0.6{tu (15 8)}').join(' ') + ' :8 0.6{tu (3 2)} :4 0.6 0.6 0.6 |\n' +
    ':16 ' + Array(6).fill('0.6{tu (7 4)}').join(' ') + ' :4 0.6 0.6 0.6';
  const { score, diagnostics } = parseTex(tex);
  const issues = [...errs(diagnostics), ...check(score)];
  const bad = issues.filter((d) => d.level !== 'hint');
  t('tuplets: full septuplet and nested 15:8 bars are clean', bad.filter((d) => !/bar 3/.test(d.where)).length === 0, bad.map((d) => d.where + ' ' + d.message).join(' | '));
  t('tuplets: a bar one septuplet short is still caught', bad.some((d) => /bar 3/.test(d.where) && /short/.test(d.message)));
  const back = loadFileFromBytes(toGp7(score));
  t('tuplets: survive GP7 export', check(back).filter((d) => d.level === 'error').length === 0 && back.tracks[0].staves[0].bars[0].voices[0].beats[0].tupletNumerator === 7);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
