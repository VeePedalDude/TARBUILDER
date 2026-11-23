// Song IR -> LilyPond (.ly) for engraved scores. Fretted tracks get a staff + TabStaff pair.
import { trackLayout } from './notation.mjs';
import { assignFrets } from './fret.mjs';
import { parseKey, spellInKey } from '../theory/key.mjs';
import { LETTERS, parseNote, midi } from '../theory/pitch.mjs';
import { assertValid, cloneSong, barStart } from '../ir.mjs';

const LY_DRUMS = {
  35: 'bda', 36: 'bd', 37: 'ss', 38: 'sn', 39: 'hc', 40: 'sne', 41: 'tomfl', 42: 'hh', 43: 'tomfh', 44: 'hhp', 45: 'toml',
  46: 'hho', 47: 'tomml', 48: 'tommh', 49: 'cymc', 50: 'tomh', 51: 'cymr', 52: 'cymch', 53: 'rb', 54: 'tamb', 55: 'cyms',
  56: 'cb', 57: 'cymc', 59: 'cymr', 60: 'boh', 61: 'bol', 63: 'cgho', 64: 'cgl', 70: 'mar', 75: 'cl', 76: 'wbh', 77: 'wbl',
};

const MODES = { major: '\\major', minor: '\\minor', dorian: '\\dorian', phrygian: '\\phrygian', lydian: '\\lydian', mixolydian: '\\mixolydian', locrian: '\\locrian', ionian: '\\ionian', aeolian: '\\aeolian' };

export function lyPitch(n) {
  const name = LETTERS[n.letter].toLowerCase() + (n.acc > 0 ? 'is'.repeat(n.acc) : 'es'.repeat(-n.acc));
  const marks = n.oct - 3;
  return name + (marks > 0 ? "'".repeat(marks) : ','.repeat(-marks));
}

const lyStr = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export function toLilyPond(songIn, options = {}) {
  const song = cloneSong(songIn);
  assertValid(song);
  const key = parseKey(song.key ?? 'C major');
  const chordTrack = options.chordTrack ?? song.tracks.findIndex((t) => t.kind !== 'drums');
  const chordStarts = new Map((song.chords ?? []).map((c) => [c.start, c.symbol]));
  const sections = new Map((song.sections ?? []).map((s) => [s.bar, s.name]));
  const tempos = new Map((song.tempoChanges ?? []).map((t) => [t.bar, t.bpm]));
  const meters = new Map((song.meterChanges ?? []).map((m) => [m.bar, m]));
  const keyTonic = parseNote(key.tonic);

  const out = ['\\version "2.24.0"', '\\header {', `  title = ${lyStr(song.title ?? 'Untitled')}`];
  if (song.artist) out.push(`  composer = ${lyStr(song.artist)}`);
  out.push('  tagline = "TARBUILDER"', '}', '');

  const staves = [];
  song.tracks.forEach((track, ti) => {
    if (track.kind === 'fretted') assignFrets(track, options.fret);
    const layout = trackLayout(song, track, ti === chordTrack ? [...chordStarts.keys()] : []);
    const voiceMusic = layout.map((bars, vi) =>
      bars
        .map((items, b) => {
          const head = [];
          if (b > 0 && meters.has(b)) head.push(`\\time ${meters.get(b).num}/${meters.get(b).den}`);
          if (vi === 0 && ti === 0 && sections.has(b)) head.push(`\\mark ${lyStr(sections.get(b))}`);
          if (vi === 0 && ti === 0 && b > 0 && tempos.has(b)) head.push(`\\tempo 4 = ${Math.round(tempos.get(b))}`);
          let pos = barStart(song, b);
          const notes = items.map((it) => {
            const start = pos;
            pos += it.ticks;
            const chord = ti === chordTrack && vi === 0 ? chordStarts.get(start) : null;
            const ly = itemLy(it, track, key, chord);
            return (it._tuStart ? `\\tuplet ${it.tu.n}/${it.tu.m} { ` : '') + ly + (it._tuStop ? ' }' : '');
          });
          return (head.length ? head.join(' ') + ' ' : '') + notes.join(' ') + ' |';
        })
        .join('\n    '),
    );
    const global = `\\key ${lyPitch({ ...keyTonic, oct: 3 })} ${MODES[key.mode] ?? '\\major'} \\time ${song.meter.num}/${song.meter.den}` + (ti === 0 ? ` \\tempo 4 = ${Math.round(song.tempo)}` : '');
    const body = voiceMusic.length === 1 ? `{ ${voiceMusic[0]} }` : `<< ${voiceMusic.map((v) => `{ ${v} }`).join(' \\\\ ')} >>`;
    const id = `track${String.fromCharCode(65 + (ti % 26))}${ti >= 26 ? ti : ''}`;
    if (track.kind === 'drums') {
      out.push(`${id} = \\drummode { \\time ${song.meter.num}/${song.meter.den} ${body} }`);
      staves.push(`\\new DrumStaff \\with { instrumentName = ${lyStr(track.name)} } \\${id}`);
    } else {
      const clef = track.kind === 'fretted' ? (track.tuning.length <= 5 && Math.min(...track.tuning.map((t) => midi(t))) < 40 ? 'bass_8' : 'treble_8') : avg(track) < 55 ? 'bass' : 'treble';
      out.push(`${id} = { \\clef "${clef}" ${global} ${body} }`);
      if (track.kind === 'fretted') {
        const tun = track.tuning.slice().reverse().map((t) => lyPitch(parseNote(t))).join(' ');
        staves.push(`\\new StaffGroup \\with { instrumentName = ${lyStr(track.name)} } << \\new Staff { \\${id} } \\new TabStaff \\with { stringTunings = \\stringTuning <${tun}> } { \\${id} } >>`);
      } else {
        staves.push(`\\new Staff \\with { instrumentName = ${lyStr(track.name)} } \\${id}`);
      }
    }
    out.push('');
  });
  out.push('\\score {', '  <<', ...staves.map((s) => '    ' + s), '  >>', '  \\layout { }', '  \\midi { }', '}');
  return out.join('\n');
}

function avg(track) {
  return track.notes.length ? track.notes.reduce((a, n) => a + n.pitch, 0) / track.notes.length : 60;
}

function itemLy(it, track, key, chord) {
  const dur = `${it.den}${it.dots ? '.' : ''}`;
  const mark = chord ? `^${lyStr(chord)}` : '';
  if (it.kind === 'rest' || (track.kind === 'drums' && it.tieIn)) return `r${dur}${mark}`;
  const tie = it._tieOut && track.kind !== 'drums' ? '~' : '';
  const lyric = it.first ? it.notes.find((n) => n.lyric)?.lyric : null;
  const lyr = lyric ? `_${lyStr(lyric)}` : '';
  const pitchOf = (n) => (track.kind === 'drums' ? LY_DRUMS[n.pitch] ?? 'sn' : lyPitch(spellInKey(n.pitch, key)));
  const str = (n) => (track.kind === 'fretted' && n.string ? `\\${n.string}` : '');
  // string numbers: inside <> for chords, after the duration for single notes
  if (it.notes.length === 1) return `${pitchOf(it.notes[0])}${dur}${str(it.notes[0])}${tie}${mark}${lyr}`;
  return `<${it.notes.map((n) => pitchOf(n) + str(n)).join(' ')}>${dur}${tie}${mark}${lyr}`;
}
