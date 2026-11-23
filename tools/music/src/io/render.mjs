// Write a song to every format at once: .json (IR), .atex, .gp (via tarb checks), .mid, .musicxml, .ly
import fs from 'node:fs';
import path from 'node:path';
import { toAlphaTex } from './alphatex.mjs';
import { toMidi } from './midi.mjs';
import { toMusicXml } from './musicxml.mjs';
import { toLilyPond } from './lilypond.mjs';
import { texToGp } from './gp.mjs';
import { validateSong } from '../ir.mjs';

export const ALL_FORMATS = ['json', 'atex', 'gp', 'mid', 'musicxml', 'ly'];

/**
 * render(song, 'out/my-song', { formats }) -> { files: [...], issues: [...] }
 * Throws if the song is invalid or the GP checker finds errors (nothing half-written for .gp).
 */
export async function render(song, base, { formats = ALL_FORMATS, gpTarget = 'gp7', force = false, swing = 0 } = {}) {
  const issues = validateSong(song);
  const errors = issues.filter((d) => d.level === 'error');
  if (errors.length && !force) {
    throw new Error('Song is invalid:\n' + errors.map((e) => `  ${e.where}: ${e.message}`).join('\n'));
  }
  fs.mkdirSync(path.dirname(path.resolve(base)), { recursive: true });
  const files = [];
  const write = (ext, data) => {
    const f = `${base}.${ext}`;
    fs.writeFileSync(f, data);
    files.push(f);
  };
  if (formats.includes('json')) write('json', JSON.stringify(song, null, 1));
  let tex = null;
  if (formats.includes('atex') || formats.includes('gp')) tex = toAlphaTex(song);
  if (formats.includes('atex')) write('atex', tex);
  if (formats.includes('gp')) {
    const { gp, issues: gi } = await texToGp(tex, { force, target: gpTarget });
    issues.push(...gi.map((d) => ({ ...d, where: `gp ${d.where ?? (d.line ? 'line ' + d.line : '')}`.trim() })));
    write('gp', gp);
  }
  if (formats.includes('mid')) write('mid', toMidi(song, { swing }));
  if (formats.includes('musicxml')) write('musicxml', toMusicXml(song));
  if (formats.includes('ly')) write('ly', toLilyPond(song));
  return { files, issues };
}
