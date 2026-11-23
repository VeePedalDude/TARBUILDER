// Song IR -> MusicXML 4.0 (partwise). Opens in Guitar Pro 7, MuseScore, Sibelius, Finale, Dorico.
import { trackLayout } from './notation.mjs';
import { assignFrets } from './fret.mjs';
import { parseKey, spellInKey } from '../theory/key.mjs';
import { parseChord } from '../theory/chord.mjs';
import { LETTERS, parseNote } from '../theory/pitch.mjs';
import { barStart, assertValid, cloneSong, beatTicks, GM_DRUMS } from '../ir.mjs';
import { channelFor } from './midi.mjs';
import { INSTRUMENTS } from '../analysis/orchestration.mjs';
import { transpose as transposeNote, parseInterval } from '../theory/pitch.mjs';
import { makeKey } from '../theory/key.mjs';

// written = sounding + t semitones. Map the simple part of t to a diatonic step count.
const DIATONIC_STEPS = { 0: 0, 2: 1, 5: 3, 7: 4, 9: 5 };
const UP_INTERVAL = { 0: 'P1', 2: 'M2', 5: 'P4', 7: 'P5', 9: 'M6' };

/** transposition info for a track with track.instrument (e.g. 'trumpet'), or null for concert pitch */
function transposition(track, key, concert) {
  if (concert || !track.instrument) return null;
  const ins = INSTRUMENTS[String(track.instrument).toLowerCase()];
  if (!ins || !ins.transpose) return null;
  const t = ins.transpose;
  const simple = ((t % 12) + 12) % 12;
  const oct = Math.floor(t / 12);
  if (!(simple in DIATONIC_STEPS)) return null;
  const tonic = transposeNote({ ...parseNoteSafe(key.tonic), oct: 4 }, parseInterval(UP_INTERVAL[simple]));
  const writtenKey = makeKey({ ...tonic, oct: null }, key.mode);
  return {
    semis: t,
    key: writtenKey,
    xml: `<transpose><diatonic>${-DIATONIC_STEPS[simple]}</diatonic><chromatic>${-simple}</chromatic>${oct ? `<octave-change>${-oct}</octave-change>` : ''}</transpose>`,
  };
}

function parseNoteSafe(n) {
  return parseNote(n);
}

const TYPE = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: '16th', 32: '32nd', 64: '64th', 128: '128th' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// GM drum -> [display-step, display-octave, notehead]
const DRUM_DISPLAY = {
  35: ['F', 4, null], 36: ['F', 4, null], 37: ['C', 5, 'x'], 38: ['C', 5, null], 39: ['C', 5, 'x'], 40: ['C', 5, null],
  41: ['G', 4, null], 42: ['G', 5, 'x'], 43: ['A', 4, null], 44: ['D', 4, 'x'], 45: ['B', 4, null], 46: ['G', 5, 'circle-x'],
  47: ['D', 5, null], 48: ['D', 5, null], 49: ['A', 5, 'x'], 50: ['E', 5, null], 51: ['F', 5, 'x'], 52: ['B', 5, 'x'],
  53: ['F', 5, 'diamond'], 54: ['E', 5, 'x'], 55: ['A', 5, 'x'], 56: ['E', 5, 'triangle'], 57: ['A', 5, 'x'], 59: ['F', 5, 'x'],
};

const KIND = [
  [['M3', 'P5'], 'major'], [['m3', 'P5'], 'minor'], [['m3', 'd5'], 'diminished'], [['M3', 'A5'], 'augmented'],
  [['M3', 'P5', 'm7'], 'dominant'], [['M3', 'P5', 'M7'], 'major-seventh'], [['m3', 'P5', 'm7'], 'minor-seventh'],
  [['m3', 'd5', 'm7'], 'half-diminished'], [['m3', 'd5', 'd7'], 'diminished-seventh'], [['m3', 'P5', 'M7'], 'major-minor'],
  [['M3', 'A5', 'm7'], 'augmented-seventh'], [['M3', 'P5', 'M6'], 'major-sixth'], [['m3', 'P5', 'M6'], 'minor-sixth'],
  [['M3', 'P5', 'm7', 'M9'], 'dominant-ninth'], [['M3', 'P5', 'M7', 'M9'], 'major-ninth'], [['m3', 'P5', 'm7', 'M9'], 'minor-ninth'],
  [['M3', 'P5', 'm7', 'M9', 'P11'], 'dominant-11th'], [['m3', 'P5', 'm7', 'M9', 'P11'], 'minor-11th'],
  [['M3', 'P5', 'm7', 'M9', 'M13'], 'dominant-13th'], [['M3', 'P5', 'M7', 'M9', 'M13'], 'major-13th'],
  [['P4', 'P5'], 'suspended-fourth'], [['M2', 'P5'], 'suspended-second'], [['P5'], 'power'],
];

function harmonyXml(symbol) {
  let c;
  try {
    c = parseChord(symbol);
  } catch {
    return '';
  }
  const names = c.names.filter((n) => n !== 'P1');
  const hit = KIND.find(([set]) => set.length === names.length && set.every((x) => names.includes(x)));
  const kind = hit ? hit[1] : 'other';
  const text = symbol.replace(/^[A-G](#|b)?/, '').replace(/\/.*$/, '');
  const root = c.root;
  let x = `<harmony><root><root-step>${LETTERS[root.letter]}</root-step>${root.acc ? `<root-alter>${root.acc}</root-alter>` : ''}</root>`;
  x += `<kind text="${esc(text)}">${kind}</kind>`;
  if (c.bass) x += `<bass><bass-step>${LETTERS[c.bass.letter]}</bass-step>${c.bass.acc ? `<bass-alter>${c.bass.acc}</bass-alter>` : ''}</bass>`;
  return x + '</harmony>';
}

const CLEFS = {
  G: '<clef><sign>G</sign><line>2</line></clef>',
  F: '<clef><sign>F</sign><line>4</line></clef>',
  C3: '<clef><sign>C</sign><line>3</line></clef>',
  G8: '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>',
  F8: '<clef><sign>F</sign><line>4</line><clef-octave-change>-1</clef-octave-change></clef>',
};

function clefXml(track) {
  if (track.kind === 'drums') return '<clef><sign>percussion</sign></clef>';
  const ins = track.instrument && INSTRUMENTS[String(track.instrument).toLowerCase()];
  if (ins && track.kind === 'pitched' && CLEFS[ins.clef]) return CLEFS[ins.clef];
  if (track.kind === 'fretted') {
    const lowest = Math.min(...track.notes.map((n) => n.pitch), 60);
    const isBass = track.tuning.length <= 5 && lowest < 40;
    return isBass
      ? '<clef><sign>F</sign><line>4</line><clef-octave-change>-1</clef-octave-change></clef>'
      : '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>';
  }
  const avg = track.notes.length ? track.notes.reduce((a, n) => a + n.pitch, 0) / track.notes.length : 60;
  return avg < 55 || track.clef === 'F4' ? '<clef><sign>F</sign><line>4</line></clef>' : '<clef><sign>G</sign><line>2</line></clef>';
}

export function toMusicXml(songIn, options = {}) {
  const song = cloneSong(songIn);
  assertValid(song);
  const key = parseKey(song.key ?? 'C major');
  const ppq = song.ppq;
  const chordTrack = options.chordTrack ?? song.tracks.findIndex((t) => t.kind !== 'drums');
  const chordStarts = new Map((song.chords ?? []).map((c) => [c.start, c.symbol]));
  const sections = new Map((song.sections ?? []).map((s) => [s.bar, s.name]));
  const tempos = new Map((song.tempoChanges ?? []).map((t) => [t.bar, t.bpm]));
  const meters = new Map((song.meterChanges ?? []).map((m) => [m.bar, m]));

  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  out.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
  out.push('<score-partwise version="4.0">');
  out.push(`<work><work-title>${esc(song.title ?? 'Untitled')}</work-title></work>`);
  out.push(`<identification>${song.artist ? `<creator type="composer">${esc(song.artist)}</creator>` : ''}<encoding><software>TARBUILDER tools/music</software></encoding></identification>`);
  out.push('<part-list>');
  song.tracks.forEach((t, i) => {
    const ch = channelFor(i, t.kind) + 1;
    if (t.kind === 'drums') {
      // one score-instrument per drum sound, so importers map unpitched notes back to GM sounds
      const used = [...new Set(t.notes.map((n) => n.pitch))].sort((a, b) => a - b);
      out.push(`<score-part id="P${i + 1}"><part-name>${esc(t.name)}</part-name>`);
      for (const d of used) out.push(`<score-instrument id="P${i + 1}-X${d}"><instrument-name>${esc(GM_DRUMS[d] ?? 'Drum ' + d)}</instrument-name></score-instrument>`);
      for (const d of used) out.push(`<midi-instrument id="P${i + 1}-X${d}"><midi-channel>10</midi-channel><midi-unpitched>${d + 1}</midi-unpitched></midi-instrument>`);
      out.push('</score-part>');
      return;
    }
    out.push(`<score-part id="P${i + 1}"><part-name>${esc(t.name)}</part-name><score-instrument id="P${i + 1}-I1"><instrument-name>${esc(t.name)}</instrument-name></score-instrument>`);
    out.push(`<midi-instrument id="P${i + 1}-I1"><midi-channel>${ch}</midi-channel><midi-program>${t.program + 1}</midi-program></midi-instrument></score-part>`);
  });
  out.push('</part-list>');

  song.tracks.forEach((track, ti) => {
    if (track.kind === 'fretted') assignFrets(track, options.fret);
    const tr = track.kind === 'pitched' ? transposition(track, key, options.concert) : null;
    const partKey = tr ? tr.key : key;
    if (tr) track.notes = track.notes.map((n) => ({ ...n, pitch: n.pitch + tr.semis }));
    const layout = trackLayout(song, track, ti === chordTrack ? [...chordStarts.keys()] : []);
    out.push(`<part id="P${ti + 1}">`);
    for (let b = 0; b < song.bars; b++) {
      out.push(`<measure number="${b + 1}">`);
      if (b === 0 || meters.has(b)) {
        const m = b === 0 ? song.meter : meters.get(b);
        out.push('<attributes>');
        if (b === 0) out.push(`<divisions>${ppq}</divisions><key><fifths>${Math.max(-7, Math.min(7, partKey.fifths))}</fifths>${partKey.mode === 'minor' ? '<mode>minor</mode>' : partKey.mode === 'major' ? '<mode>major</mode>' : ''}</key>`);
        out.push(`<time><beats>${m.num}</beats><beat-type>${m.den}</beat-type></time>`);
        if (b === 0) {
          if (tr) out.push(clefXml(track) + tr.xml);
          else if (track.kind === 'fretted') {
            // two staves: notation (1) + TAB (2) with the tuning, like Guitar Pro / MuseScore export
            out.push('<staves>2</staves>');
            out.push(clefXml(track).replace('<clef>', '<clef number="1">'));
            out.push('<clef number="2"><sign>TAB</sign><line>5</line></clef>');
            const lines = track.tuning.slice().reverse().map((t, i) => {
              const n = parseNote(t);
              return `<staff-tuning line="${i + 1}"><tuning-step>${LETTERS[n.letter]}</tuning-step>${n.acc ? `<tuning-alter>${n.acc}</tuning-alter>` : ''}<tuning-octave>${n.oct}</tuning-octave></staff-tuning>`;
            });
            out.push(`<staff-details number="2"><staff-lines>${track.tuning.length}</staff-lines>${lines.join('')}</staff-details>`);
          } else {
            out.push(clefXml(track));
          }
        }
        out.push('</attributes>');
      }
      if (ti === 0 && sections.has(b)) out.push(`<direction placement="above"><direction-type><rehearsal>${esc(sections.get(b))}</rehearsal></direction-type></direction>`);
      if (ti === 0 && (b === 0 || tempos.has(b))) {
        const bpm = b === 0 ? song.tempo : tempos.get(b);
        const beatUnit = beatTicks(song, b) === ppq * 1.5 ? '<beat-unit>quarter</beat-unit><beat-unit-dot/>' : '<beat-unit>quarter</beat-unit>';
        const shown = beatTicks(song, b) === ppq * 1.5 ? Math.round(bpm / 1.5) : Math.round(bpm);
        out.push(`<direction placement="above"><direction-type><metronome>${beatUnit}<per-minute>${shown}</per-minute></metronome></direction-type><sound tempo="${Math.round(bpm)}"/></direction>`);
      }
      const bs = barStart(song, b);
      const staves = track.kind === 'fretted' ? [1, 2] : [null];
      let firstPass = true;
      for (const staffNo of staves) {
        layout.forEach((bars, vi) => {
          if (!firstPass) {
            const len = bars[b].reduce((a, it) => a + it.ticks, 0);
            out.push(`<backup><duration>${len}</duration></backup>`);
          }
          firstPass = false;
          let pos = bs;
          for (const it of bars[b]) {
            const start = pos;
            pos += it.ticks;
            if (ti === chordTrack && vi === 0 && staffNo !== 2 && chordStarts.has(start)) out.push(harmonyXml(chordStarts.get(start)));
            const voice = staffNo === 2 ? vi + 5 : vi + 1;
            out.push(...noteXml(it, track, partKey, voice, staffNo, ti + 1));
          }
        });
      }
      out.push('</measure>');
    }
    out.push('</part>');
  });
  out.push('</score-partwise>');
  return out.join('\n');
}

function noteXml(it, track, key, voice, staffNo = null, partNo = 1) {
  const staffTag = staffNo ? `<staff>${staffNo}</staff>` : '';
  const type = TYPE[it.den];
  const dots = (it.dots ? '<dot/>' : '') + (it.tu ? `<time-modification><actual-notes>${it.tu.n}</actual-notes><normal-notes>${it.tu.m}</normal-notes></time-modification>` : '');
  const tuplet = [it._tuStart ? '<tuplet type="start" bracket="yes"/>' : '', it._tuStop ? '<tuplet type="stop"/>' : ''].join('');
  if (it.kind === 'rest' || (track.kind === 'drums' && it.tieIn)) {
    return [`<note><rest/><duration>${it.ticks}</duration><voice>${voice}</voice><type>${type}</type>${dots}${staffTag}${tuplet ? `<notations>${tuplet}</notations>` : ''}</note>`];
  }
  const tieOut = it._tieOut;
  return it.notes.map((n, i) => {
    let x = '<note>';
    if (i > 0) x += '<chord/>';
    let head = '';
    if (track.kind === 'drums') {
      const [step, oct, nh] = DRUM_DISPLAY[n.pitch] ?? ['C', 5, null];
      x += `<unpitched><display-step>${step}</display-step><display-octave>${oct}</display-octave></unpitched>`;
      if (nh) head = `<notehead>${nh}</notehead>`;
    } else {
      const sp = spellInKey(n.pitch, key);
      x += `<pitch><step>${LETTERS[sp.letter]}</step>${sp.acc ? `<alter>${sp.acc}</alter>` : ''}<octave>${sp.oct}</octave></pitch>`;
    }
    x += `<duration>${it.ticks}</duration>`;
    if (it.tieIn) x += '<tie type="stop"/>';
    if (tieOut) x += '<tie type="start"/>';
    if (track.kind === 'drums') x += `<instrument id="P${partNo}-X${n.pitch}"/>`;
    x += `<voice>${voice}</voice><type>${type}</type>${dots}`;
    if (track.kind === 'drums' && n.pitch !== 36 && n.pitch !== 35) x += '<stem>up</stem>';
    x += head + staffTag;
    const notations = [];
    if (i === 0 && tuplet) notations.push(tuplet);
    if (it.tieIn) notations.push('<tied type="stop"/>');
    if (tieOut) notations.push('<tied type="start"/>');
    if (track.kind === 'fretted' && n.string && staffNo === 2) notations.push(`<technical><string>${n.string}</string><fret>${n.fret}</fret></technical>`);
    if (it.first && n.fx?.ac) notations.push('<articulations><accent/></articulations>');
    if (it.first && n.fx?.st) notations.push('<articulations><staccato/></articulations>');
    if (notations.length) x += `<notations>${notations.join('')}</notations>`;
    if (i === 0 && it.first && n.lyric && staffNo !== 2) x += `<lyric number="1"><syllabic>single</syllabic><text>${esc(n.lyric)}</text></lyric>`;
    return x + '</note>';
  });
}
