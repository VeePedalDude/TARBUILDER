#!/usr/bin/env node
// tarb - TARBUILDER alphaTab CLI
//   tarb build <in.atex...> [-o out.gp] [--midi] [--gp8] [--force]   alphaTex -> Guitar Pro 7 .gp (+ .mid)
//   tarb check <file...>                                    lint alphaTex or any GP file
//   tarb dump  <file.gp|.gpx|.gp5> [-o out.atex]            any GP file -> alphaTex text
//   tarb info  <file...>                                    short summary
import fs from 'node:fs';
import path from 'node:path';
import { loadFile, check, toGp7, toMidi, toAlphaTex, summarize, roundTrip, gpHeader } from '../lib/tab.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const oIdx = rest.indexOf('-o');
const outArg = oIdx >= 0 ? rest[oIdx + 1] : null;
const files = rest.filter((a, i) => !a.startsWith('--') && a !== '-o' && !(oIdx >= 0 && i === oIdx + 1));

function usage() {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 6).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(2);
}

function report(file, items) {
  for (const d of items) {
    const where = d.line ? `${file}:${d.line}:${d.col}` : `${file} ${d.where ?? ''}`;
    console.log(`  ${d.level.toUpperCase().padEnd(7)} ${where.trim()}  ${d.message}`);
  }
}

function lint(file) {
  const { score, settings, diagnostics } = loadFile(file);
  const items = diagnostics.filter((d) => d.level !== 'hint');
  if (score) items.push(...check(score));
  const errors = items.filter((d) => d.level === 'error').length;
  return { score, settings, items, errors };
}

if (!cmd || !files.length) usage();
let failed = 0;

for (const file of files) {
  if (cmd === 'build') {
    const { score, settings, items, errors } = lint(file);
    report(file, items);
    if (!score || (errors && !flags.has('--force'))) {
      console.log(`FAIL  ${file}: ${errors} error(s), nothing written (use --force to write anyway)`);
      failed++;
      continue;
    }
    const out = outArg && files.length === 1 ? outArg : file.replace(/\.(atex|tex|alphatex)$/i, '') + '.gp';
    const gp = toGp7(score, settings, { target: flags.has('--gp8') ? 'gp8' : 'gp7' });
    const problems = roundTrip(score, gp);
    fs.writeFileSync(out, gp);
    let msg = `OK    ${out} (${gp.length} bytes, ${gpHeader(gp)})`;
    if (flags.has('--midi')) {
      const mid = out.replace(/\.gp$/, '') + '.mid';
      fs.writeFileSync(mid, toMidi(score, settings));
      msg += ` + ${path.basename(mid)}`;
    }
    console.log(msg);
    if (problems.length) {
      console.log(`WARN  round-trip mismatch: ${problems.join('; ')}`);
      failed++;
    }
  } else if (cmd === 'check') {
    const { items, errors } = lint(file);
    report(file, items);
    console.log(`${errors ? 'FAIL' : 'OK  '}  ${file}: ${errors} error(s), ${items.length - errors} warning(s)`);
    if (errors) failed++;
  } else if (cmd === 'dump') {
    const { score } = loadFile(file);
    const tex = toAlphaTex(score);
    if (outArg) fs.writeFileSync(outArg, tex);
    else process.stdout.write(tex + '\n');
  } else if (cmd === 'info') {
    const { score } = loadFile(file);
    console.log(summarize(score));
  } else {
    usage();
  }
}
process.exit(failed ? 1 : 0);
