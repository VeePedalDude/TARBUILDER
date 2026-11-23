// Bridge to tools/alphatab (alphaTab 1.9): build .gp from the song IR, and import GP/alphaTex files
// back into the IR (for analysis, style training, or editing). Needs `npm install` in tools/alphatab.
import { createSong } from '../ir.mjs';
import { makeRegion, addRegion, frac, fmul, fadd } from '../tuplets.mjs';
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
    importTuplets(song, t, track.staves[0]);
    song.tracks.push(t);
  }
  // chord durations: until the next chord
  song.chords.sort((a, b) => a.start - b.start);
  const end = mb.length ? mb[mb.length - 1].start + mb[mb.length - 1].calculateDuration() : 0;
  song.chords.forEach((c, i) => (c.dur = (song.chords[i + 1]?.start ?? end) - c.start));
  return song;
}

// Tuplet beats -> tuplet regions, so imported triplets/quintuplets/septuplets keep exact timing.
// A run of consecutive tuplet beats becomes one region when it starts and ends on the grid;
// notes inside snap to the region's leaves.
const DRIFT = 3; // ticks of rounding drift tolerated on import

function importTuplets(song, t, staff) {
  const grid = song.grid ?? 120;
  // notes outside tuplets: undo rounding drift left by earlier tuplets in the bar
  const snapDrift = (x) => (Math.abs(Math.round(x / grid) * grid - x) <= DRIFT ? Math.round(x / grid) * grid : x);
  const fixDrift = () => {
    for (const n of t.notes) {
      if ((t.tuplets ?? []).some((r) => n.start >= r.start - DRIFT && n.start < r.start + r.dur - DRIFT)) continue;
      const e = snapDrift(n.start + n.dur);
      n.start = snapDrift(n.start);
      n.dur = Math.max(grid, e - n.start);
    }
  };
  for (const bar of staff.bars) {
    for (const voice of bar.voices) {
      const beats = voice.beats.filter((b) => !b.graceType);
      const qOf = (b) => {
        let q = b.duration < 0 ? frac(4 * -b.duration, 1) : frac(4, b.duration);
        if (b.dots === 1) q = fmul(q, [3, 2]);
        if (b.dots === 2) q = fmul(q, [7, 4]);
        return b.tupletNumerator > 0 ? fmul(q, frac(b.tupletDenominator, b.tupletNumerator)) : q;
      };
      // beats the grid can't hold: tuplets, and plain values shorter than the grid (64ths, 128ths)
      const fine = (b) => b.tupletNumerator > 0 || fmul(qOf(b), [song.ppq, grid])[1] !== 1;
      for (let i = 0; i < beats.length; i++) {
        if (!fine(beats[i])) continue;
        let j = i;
        while (j + 1 < beats.length && fine(beats[j + 1])) j++;
        const run = beats.slice(i, j + 1);
        i = j;
        // alphaTab's integer ticks drift by a tick or two after 7- or 11-tuplets: snap back to the grid
        const raw = run[0].absolutePlaybackStart;
        const start = Math.round(raw / grid) * grid;
        if (Math.abs(start - raw) > DRIFT) continue;
        // a run of short plain notes may end off the grid: pull in following beats until it lands
        const leaves = run.map((b) => ({ dur: qOf(b) }));
        let total = leaves.reduce((a, l) => fadd(a, l.dur), [0, 1]);
        while (fmul(total, [song.ppq, grid])[1] !== 1 && i + 1 < beats.length) {
          i++;
          leaves.push({ dur: qOf(beats[i]) });
          total = fadd(total, qOf(beats[i]));
        }
        let region;
        try {
          region = makeRegion(start, leaves, song.ppq);
          if (region.dur % grid) continue;
          addRegion(song, t, region);
        } catch {
          continue; // crosses a barline or overlaps another voice's region: leave it to quantize()
        }
        const bounds = [...region.leaves.map((lf) => lf.start), region.start + region.dur];
        const snap = (x) => bounds.reduce((best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best), bounds[0]);
        const end = region.start + region.dur;
        for (const n of t.notes) {
          if (n.start < region.start - DRIFT || n.start >= end - DRIFT) continue;
          const s0 = snap(n.start);
          const e0 = n.start + n.dur <= end + 2 ? snap(n.start + n.dur) : Math.round((n.start + n.dur) / grid) * grid;
          n.start = s0;
          n.dur = Math.max(e0 - s0, region.leaves.find((lf) => lf.start === s0)?.ticks ?? grid);
        }
      }
    }
  }
  fixDrift();
}
