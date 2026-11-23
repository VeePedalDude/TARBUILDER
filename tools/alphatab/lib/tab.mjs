// TARBUILDER alphaTab core: parse alphaTex, check a score, export GP7 / MIDI / alphaTex.
// Pinned to @coderline/alphatab 1.9.0 (see package.json).
import * as at from '@coderline/alphatab';
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

// ---- tweakable limits used by check() --------------------------------------
export const LIMITS = {
  maxFret: 24,          // warn above this fret
  maxChordSpan: 4,      // warn when a chord's fretted notes are more than this many frets apart (5-fret stretch)
  maxTempo: 400,        // warn above this BPM
  minTempo: 20,         // warn below this BPM
};

const SEVERITY = ['hint', 'warning', 'error'];

function newSettings() {
  return new at.Settings();
}

// Parse an alphaTex string. Returns { score, diagnostics[] }.
// Throws only if alphaTab itself throws (fatal syntax).
export function parseTex(tex) {
  const settings = newSettings();
  const imp = new at.importer.AlphaTexImporter();
  imp.logErrors = false;
  imp.initFromString(tex, settings);
  let score = null;
  let fatal = null;
  try {
    score = imp.readScore();
  } catch (e) {
    fatal = e;
  }
  const diagnostics = [];
  for (const bag of [imp.lexerDiagnostics, imp.parserDiagnostics, imp.semanticDiagnostics]) {
    for (const d of bag.items ?? bag) {
      diagnostics.push({
        level: SEVERITY[d.severity] ?? String(d.severity),
        message: d.message,
        line: d.start?.line,
        col: d.start?.col,
        source: 'alphatex',
      });
    }
  }
  if (fatal) {
    diagnostics.push({ level: 'error', message: `alphaTab failed to read the score: ${fatal.message}`, source: 'alphatex' });
  }
  return { score, settings, diagnostics };
}

// Load any file alphaTab can read (.atex/.tex text, or .gp/.gpx/.gp5/.gp4/.gp3 binary).
export function loadFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.atex' || ext === '.tex' || ext === '.alphatex') {
    return parseTex(fs.readFileSync(file, 'utf8'));
  }
  const settings = newSettings();
  const score = at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)), settings);
  return { score, settings, diagnostics: [] };
}

// Structural checks alphaTab does not enforce but Guitar Pro will show as wrong.
export function check(score) {
  const out = [];
  const add = (level, where, message) => out.push({ level, where, message, source: 'check' });

  if (!score.tracks.length) add('error', 'score', 'No tracks.');
  if (score.tempo < LIMITS.minTempo || score.tempo > LIMITS.maxTempo) {
    add('warning', 'score', `Tempo ${score.tempo} BPM is outside ${LIMITS.minTempo}-${LIMITS.maxTempo}.`);
  }

  const masterBars = score.masterBars;
  for (const track of score.tracks) {
    track.staves.forEach((staff, si) => {
      const strings = staff.tuning.length;
      // Fret/string checks only make sense for fretted parts. Piano/vocal staves have no tuning in
      // alphaTex, but alphaTab's GP export gives them a dummy guitar tuning, so also require a
      // tab staff or a guitar/bass GM program (24-39).
      const program = track.playbackInfo.program;
      const stringed = !staff.isPercussion && strings > 0 && (staff.showTablature || (program >= 24 && program <= 39));
      const label = (bi) => `track "${track.name}"${track.staves.length > 1 ? ` staff ${si + 1}` : ''} bar ${bi + 1}`;

      if (staff.bars.length !== masterBars.length) {
        add('error', `track "${track.name}"`, `Has ${staff.bars.length} bars but the score has ${masterBars.length}. Every track needs the same bar count (pad with rests).`);
      }

      // alphaTab silently pads short tracks with empty bars; flag them so it's a choice, not an accident.
      let trailing = 0;
      for (let i = staff.bars.length - 1; i >= 0 && staff.bars[i].voices.every((v) => v.isEmpty); i--) trailing++;
      if (trailing && trailing < staff.bars.length) {
        const from = staff.bars.length - trailing + 1;
        add('warning', `track "${track.name}"`, `Bars ${from}-${staff.bars.length} are empty (track is shorter than the score). Add rests if that's intended.`);
      }

      staff.bars.forEach((bar, bi) => {
        const mb = masterBars[bi];
        if (!mb) return;
        const expected = mb.calculateDuration();
        bar.voices.forEach((voice, vi) => {
          if (voice.isEmpty) return;
          const actual = voice.beats.reduce((sum, b) => sum + (b.graceType ? 0 : b.displayDuration), 0);
          if (actual === 0) return;
          if (actual !== expected) {
            const isPickup = bi === 0 && actual < expected;
            const isLast = bi === staff.bars.length - 1 && actual < expected;
            const ts = `${mb.timeSignatureNumerator}/${mb.timeSignatureDenominator}`;
            const beats = (t) => +(t / 960).toFixed(3);
            const msg = `Voice ${vi + 1} holds ${beats(actual)} quarter-notes but ${ts} needs ${beats(expected)} (${actual > expected ? 'overfull - missing a "|"?' : 'short'}).`;
            add(isPickup || isLast ? 'warning' : 'error', label(bi), msg + (isPickup ? ' If this is a pickup bar, mark it with \\anacrusis.' : ''));
          }
          for (const beat of voice.beats) {
            if (stringed && beat.notes.length > 1) {
              const fretted = beat.notes.filter((n) => n.fret > 0 && !n.isDead).map((n) => n.fret);
              const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
              if (span > LIMITS.maxChordSpan) add('warning', label(bi), `Chord spans ${span + 1} frets (${fretted.join(',')}) - likely unplayable.`);
              const strs = beat.notes.map((n) => n.string);
              if (new Set(strs).size !== strs.length) add('error', label(bi), 'Two notes on the same string in one chord.');
            }
            for (const note of beat.notes) {
              if (stringed && (note.string < 1 || note.string > strings)) {
                add('error', label(bi), `Note on string ${note.string} but the tuning has ${strings} strings.`);
              }
              if (stringed && note.fret > LIMITS.maxFret) {
                add('warning', label(bi), `Fret ${note.fret} is above ${LIMITS.maxFret}.`);
              }
            }
          }
        });
      });
    });
  }
  return out;
}

// alphaTab 1.9 stamps its .gp output as GP 8.1.3 (revision required=12024).
// Guitar Pro refuses files from newer versions, so by default we restamp the
// header with GP7-era values. UNVERIFIED against a real GP7 install - see README.
export const GP7_HEADER = {
  version: '7.6.0',
  required: '12021',
  recommended: '12023',
  revision: '12025',
  encoding: 'GP7',
};

export function toGp7(score, settings = newSettings(), { target = 'gp7' } = {}) {
  const bytes = new at.exporter.Gp7Exporter().export(score, settings);
  return target === 'gp7' ? restampGp7(bytes) : bytes;
}

export function restampGp7(bytes) {
  const files = unzipSync(bytes);
  const name = 'Content/score.gpif';
  let xml = strFromU8(files[name]);
  const h = GP7_HEADER;
  xml = xml
    .replace(/<GPVersion>[^<]*<\/GPVersion>/, `<GPVersion>${h.version}</GPVersion>`)
    .replace(/<GPRevision[^>]*>[^<]*<\/GPRevision>/, `<GPRevision required="${h.required}" recommended="${h.recommended}">${h.revision}</GPRevision>`)
    .replace(/<EncodingDescription>[^<]*<\/EncodingDescription>/, `<EncodingDescription>${h.encoding}</EncodingDescription>`);
  files[name] = strToU8(xml);
  return zipSync(files, { level: 6, mtime: new Date('2000-01-01') });
}

export function gpHeader(bytes) {
  const xml = strFromU8(unzipSync(bytes)['Content/score.gpif']).slice(0, 400);
  const v = xml.match(/<GPVersion>([^<]*)/)?.[1];
  const r = xml.match(/<GPRevision([^>]*)>([^<]*)/);
  return `GPVersion ${v}, revision ${r?.[2]}${r?.[1] ?? ''}`;
}

export function toAlphaTex(score) {
  return new at.exporter.AlphaTexExporter().exportToString(score);
}

export function toMidi(score, settings = newSettings()) {
  const midi = new at.midi.MidiFile();
  const handler = new at.midi.AlphaSynthMidiFileHandler(midi, true);
  new at.midi.MidiFileGenerator(score, settings, handler).generate();
  return midi.toBinary();
}

// One-line-per-track summary, using alphaTex string numbering (1 = highest string).
export function summarize(score) {
  const lines = [];
  lines.push(`"${score.title || '(untitled)'}"${score.artist ? ` - ${score.artist}` : ''} | ${score.tempo} BPM | ${score.masterBars.length} bars`);
  for (const t of score.tracks) {
    const st = t.staves[0];
    const tuning = st.isPercussion ? 'percussion' : st.tuning.map((v) => midiName(v)).join(' ');
    let notes = 0;
    for (const s of t.staves) for (const b of s.bars) for (const v of b.voices) for (const be of v.beats) notes += be.notes.length;
    lines.push(`  track "${t.name}" | program ${t.playbackInfo.program} | ${tuning} | ${notes} notes`);
  }
  return lines.join('\n');
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function midiName(v) {
  return NAMES[v % 12] + (Math.floor(v / 12) - 1);
}

// Re-read exported GP bytes and confirm the structure survived.
export function roundTrip(score, gpBytes) {
  const back = at.importer.ScoreLoader.loadScoreFromBytes(gpBytes, newSettings());
  const problems = [];
  if (back.tracks.length !== score.tracks.length) problems.push(`track count ${score.tracks.length} -> ${back.tracks.length}`);
  if (back.masterBars.length !== score.masterBars.length) problems.push(`bar count ${score.masterBars.length} -> ${back.masterBars.length}`);
  const count = (s) => {
    let n = 0;
    for (const t of s.tracks) for (const st of t.staves) for (const b of st.bars) for (const v of b.voices) for (const be of v.beats) n += be.notes.length;
    return n;
  };
  if (count(back) !== count(score)) problems.push(`note count ${count(score)} -> ${count(back)}`);
  if (back.tempo !== score.tempo) problems.push(`tempo ${score.tempo} -> ${back.tempo}`);
  return problems;
}
