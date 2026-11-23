// Bridge to tools/alphatab (alphaTab 1.9): build .gp from the song IR, and import GP/alphaTex files
// back into the IR (for analysis, style training, or editing). Needs `npm install` in tools/alphatab.
import { createSong } from '../ir.mjs';
import { fromMidi, noteName } from '../theory/pitch.mjs';

const TAB_LIB = new URL('../../../alphatab/lib/tab.mjs', import.meta.url);

let tabLib = null;
export async function alphatab() {
  if (!tabLib) {
    try {
      tabLib = await import(TAB_LIB.href);
    } catch (e) {
      throw new Error(`Couldn't load tools/alphatab (run "npm install" in tools/alphatab): ${e.message}`);
    }
  }
  return tabLib;
}

/** alphaTex string -> { gp: Uint8Array, issues: [...] } using tarb's checker. Refuses on errors unless force. */
export async function texToGp(tex, { force = false, target = 'gp7' } = {}) {
  const t = await alphatab();
  const { score, settings, diagnostics } = t.parseTex(tex);
  const issues = diagnostics.filter((d) => d.level !== 'hint');
  if (score) issues.push(...t.check(score));
  const errors = issues.filter((d) => d.level === 'error');
  if (!score || (errors.length && !force)) {
    const e = new Error('alphaTex has errors:\n' + errors.map((d) => `  ${d.line ? `line ${d.line}: ` : d.where ? d.where + ': ' : ''}${d.message}`).join('\n'));
    e.issues = issues;
    throw e;
  }
  const gp = t.toGp7(score, settings, { target });
  const problems = t.roundTrip(score, gp);
  if (problems.length) issues.push({ level: 'warning', where: 'round-trip', message: problems.join('; ') });
  return { gp, issues };
}

/** Load .gp/.gpx/.gp5/.gp4/.gp3/.atex into the song IR. Ties are merged into single notes. */
export async function importScore(file) {
  const t = await alphatab();
  const { score } = t.loadFile(file);
  return scoreToSong(score);
}

export function scoreToSong(score) {
  const mb = score.masterBars;
  const first = mb[0];
  const song = createSong({
    title: score.title || 'Imported',
    artist: score.artist || '',
    tempo: score.tempo,
    meter: [first.timeSignatureNumerator, first.timeSignatureDenominator],
    bars: mb.length,
  });
  // alphaTab KeySignature enum value = number of sharps (+) / flats (-)
  const fifths = first.keySignature;
  const minor = first.keySignatureType === 1;
  const majorNames = { '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' };
  const minorNames = { '-7': 'Ab', '-6': 'Eb', '-5': 'Bb', '-4': 'F', '-3': 'C', '-2': 'G', '-1': 'D', 0: 'A', 1: 'E', 2: 'B', 3: 'F#', 4: 'C#', 5: 'G#', 6: 'D#', 7: 'A#' };
  song.key = minor ? `${minorNames[fifths] ?? 'A'} minor` : `${majorNames[fifths] ?? 'C'} major`;
  mb.forEach((m, i) => {
    if (i > 0 && (m.timeSignatureNumerator !== mb[i - 1].timeSignatureNumerator || m.timeSignatureDenominator !== mb[i - 1].timeSignatureDenominator)) {
      song.meterChanges.push({ bar: i, num: m.timeSignatureNumerator, den: m.timeSignatureDenominator });
    }
    if (m.section?.text) song.sections.push({ bar: i, name: m.section.text });
    for (const a of m.tempoAutomations ?? []) if (i > 0 || a.ratioPosition > 0) song.tempoChanges.push({ bar: i, bpm: a.value });
  });
  const seenChord = new Set();
  for (const track of score.tracks) {
    const staff = track.staves[0];
    const isDrums = staff.isPercussion;
    const fretted = !isDrums && staff.showTablature && staff.tuning.length > 0;
    const t = {
      name: (track.name || 'Track').replace(/\u00a0/g, ' '), // alphaTab's MusicXML reader turns spaces into NBSP
      kind: isDrums ? 'drums' : fretted ? 'fretted' : 'pitched',
      program: isDrums ? 0 : track.playbackInfo.program,
      tuning: fretted ? staff.tuning.map((v) => noteName(fromMidi(v))) : null,
      maxFret: 24,
      notes: [],
    };
    const art = track.percussionArticulations ?? [];
    const seen = new Set(); // extra staves (e.g. MusicXML notation + TAB) repeat the same notes
    for (const st of track.staves) {
      for (const bar of st.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            if (beat.isRest || beat.graceType) continue;
            const start = beat.absolutePlaybackStart;
            if (beat.chord?.name && !seenChord.has(start)) {
              seenChord.add(start);
              song.chords.push({ start, dur: 0, symbol: beat.chord.name });
            }
            for (const n of beat.notes) {
              if (n.isTieDestination) continue;
              let dur = beat.playbackDuration;
              for (let d = n.tieDestination; d; d = d.tieDestination) dur += d.beat.playbackDuration;
              let pitch;
              if (isDrums) pitch = art[n.percussionArticulation]?.outputMidiNumber ?? n.percussionArticulation;
              else pitch = n.realValueWithoutHarmonic ?? n.realValue;
              const fx = {};
              if (n.isPalmMute) fx.pm = true;
              if (n.isHammerPullOrigin) fx.h = true;
              if (n.vibrato) fx.v = true;
              if (n.isLetRing) fx.lr = true;
              if (n.isDead) fx.x = true;
              if (n.isGhost) fx.g = true;
              if (n.isStaccato) fx.st = true;
              const k = `${start}:${pitch}`;
              if (seen.has(k)) continue;
              seen.add(k);
              const note = { start, dur, pitch, vel: 96 };
              if (Object.keys(fx).length) note.fx = fx;
              if (fretted) {
                note.string = n.string > 0 ? staff.tuning.length - n.string + 1 : undefined;
                note.fret = n.fret;
              }
              if (beat.lyrics?.[0]) note.lyric = beat.lyrics[0];
              t.notes.push(note);
            }
          }
        }
      }
    }
    song.tracks.push(t);
  }
  // chord durations: until the next chord
  song.chords.sort((a, b) => a.start - b.start);
  const end = mb.length ? mb[mb.length - 1].start + mb[mb.length - 1].calculateDuration() : 0;
  song.chords.forEach((c, i) => (c.dur = (song.chords[i + 1]?.start ?? end) - c.start));
  return song;
}
