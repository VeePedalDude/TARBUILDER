// Arranger: a short spec in, a complete multi-track song out (form, chords, melody, bass,
// comping, drums), ready for render() -> .gp / .mid / .musicxml / .ly.
import { createSong, addTrack, barStart, barLength, totalTicks } from '../ir.mjs';
import { parseKey } from '../theory/key.mjs';
import { asRng } from '../rng.mjs';
import { planForm, GENRES, FORMS } from './form.mjs';
import { PROGRESSIONS, realize, generateProgression } from './progressions.mjs';
import { writeGroove, GROOVES, ADDITIVE, additiveGroove } from './drums.mjs';
import { phraseRhythm } from '../lab/branching.mjs';
import { euclid } from '../lab/rhythm.mjs';
import { bassLine, comp } from './accompany.mjs';
import { generateMelody } from './melody.mjs';
import { breakdownRiff } from './riffs.mjs';
import { midi, mod } from '../theory/pitch.mjs';

// genres whose bass and rhythm parts are palm-muted
const PALM_MUTED = /metal|core|death|punk/;

/** per-section override: first key that the section name starts with (case-insensitive) */
const bySection = (map, name) => (map ? Object.entries(map).find(([k]) => name.toLowerCase().startsWith(k))?.[1] : undefined);

/**
 * spec: {
 *   title, genre ('rock'|'pop'|'punk'|'metal'|'blues'|'jazz'|'funk'|'folk'|'lofi'|'reggae'|'ballad'),
 *   key, tempo, meter: [n, d], form (name or [[name, bars, energy], ...]), seed,
 *   progressions: { Verse: 'axis' | ['i','VI','III','VII'] , ... },
 *   parts: { drums: true, bass: true, guitar: true, lead: true, keys: false },
 *   lead: { instrument, range: [lo, hi], density }, guitar: { style, tuning, instrument }, bass: { style },
 *   complexity: 0..3 (harmony colour for generated progressions)
 * }
 */
export function arrange(spec = {}) {
  const rng = asRng(spec.seed ?? 1);
  const genre = GENRES[spec.genre ?? 'rock'];
  if (!genre) throw new Error(`Unknown genre "${spec.genre}". Known: ${Object.keys(GENRES).join(', ')}`);
  const key = spec.key ?? rng.pick(genre.keys);
  const k = parseKey(key);
  const tempo = spec.tempo ?? rng.int(genre.tempo[0], genre.tempo[1]);
  const meter = spec.meter ?? genre.meter ?? [4, 4];
  const plan = planForm(spec.form ?? genre.form);
  const bars = plan.reduce((a, s) => a + s.bars, 0);
  // per-bar meters: a section may carry { meters: [[7, 8], [5, 8]] } (cycled) or { meter: [7, 8] }
  const barMeters = [];
  for (const s of plan) {
    const list = s.meters ?? (s.meter ? [s.meter] : [meter]);
    for (let i = 0; i < s.bars; i++) barMeters.push(list[i % list.length]);
  }
  const song = createSong({ title: spec.title ?? `${spec.genre ?? 'rock'} sketch`, artist: spec.artist ?? 'VeePedalDude', tempo, meter: barMeters[0], key: k.name, bars });
  barMeters.forEach((m, b) => {
    if (b > 0 && (m[0] !== barMeters[b - 1][0] || m[1] !== barMeters[b - 1][1])) song.meterChanges.push({ bar: b, num: m[0], den: m[1] });
  });
  const meterOf = (b) => barMeters[b];
  for (const s of plan) song.sections.push({ bar: s.bar, name: s.name });

  // ---- harmony per section name ----
  const progFor = new Map();
  const libFits = (name) => {
    const p = PROGRESSIONS[name];
    if (!p) return false;
    const want = k.mode === 'minor' ? 'minor' : k.mode === 'major' ? 'major' : k.mode;
    return p.mode === want;
  };
  const pool = (genre.progression ?? []).filter(libFits);
  const complexity = spec.complexity ?? (spec.genre === 'jazz' ? 2 : 0);
  const sectionProg = (name, barsN) => {
    if (spec.progressions?.[name]) return realize(spec.progressions[name], k);
    const lower = name.toLowerCase();
    // breakdowns sit on the tonic: the open low string
    if (/breakdown/.test(lower)) return realize([k.mode === 'minor' ? 'i' : 'I'], k);
    if (/verse|riff|head|a$|loop|solo|drop/.test(lower) && pool.length) return realize(pool[0], k);
    if (/chorus|b$|drop/.test(lower) && pool.length > 1) return realize(pool[1], k);
    if (/pre/.test(lower)) return generateProgression({ key: k, length: 4, complexity, cadence: 'half', rng: rng.fork(name) });
    if (/bridge|break/.test(lower)) return generateProgression({ key: k, length: 4, complexity: Math.max(1, complexity), cadence: 'half', startTonic: false, rng: rng.fork(name) });
    if (/intro|build/.test(lower)) return progFor.get('Chorus') ?? progFor.get('Verse') ?? (pool.length ? realize(pool[0], k) : generateProgression({ key: k, length: 4, complexity, rng: rng.fork(name) }));
    if (/outro|ending/.test(lower)) return null; // filled below
    if (pool.length) return realize(rng.pick(pool), k);
    return generateProgression({ key: k, length: Math.min(8, barsN), complexity, rng: rng.fork(name) });
  };

  for (const s of plan) {
    if (!progFor.has(s.name)) progFor.set(s.name, sectionProg(s.name, s.bars));
    let prog = progFor.get(s.name);
    if (!prog) {
      // outro: last progression ends on the tonic
      const ref = progFor.get('Chorus') ?? progFor.get('Verse') ?? [...progFor.values()].find(Boolean) ?? generateProgression({ key: k, length: 4, rng: rng.fork('outro') });
      prog = ref.slice(0, Math.max(1, s.bars - 1));
      prog = [...prog, { roman: k.mode === 'minor' ? 'i' : 'I', symbol: realize([k.mode === 'minor' ? 'i' : 'I'], k)[0].symbol }];
    }
    const libPerBar = Object.values(PROGRESSIONS).find((p) => p.romans.join() === prog.map((c) => c.roman).join())?.perBar;
    let perBar = libPerBar ?? (prog.length > s.bars && prog.length <= 2 * s.bars ? 2 : 1);
    // a progression longer than the section (12-bar blues in a 4-bar intro): use its last bars (the turnaround)
    if (prog.length > s.bars * perBar) prog = prog.slice(prog.length - s.bars * perBar);
    const slots = s.bars * perBar;
    for (let i = 0; i < slots; i++) {
      const b = s.bar + Math.floor(i / perBar);
      const bl = barLength(song, b);
      const c = prog[i % prog.length];
      song.chords.push({ start: barStart(song, b) + (i % perBar) * (bl / perBar), dur: bl / perBar, symbol: c.symbol, roman: c.roman });
    }
  }
  // the song ends on the tonic
  const tonicSym = realize([k.mode === 'minor' ? 'i' : 'I'], k)[0].symbol;
  const lastChord = song.chords[song.chords.length - 1];
  if (lastChord && lastChord.symbol !== tonicSym && /outro|ending/i.test(plan[plan.length - 1].name)) {
    lastChord.symbol = tonicSym;
    lastChord.roman = k.mode === 'minor' ? 'i' : 'I';
  }

  const parts = { drums: true, bass: true, guitar: true, lead: genre.lead !== false, keys: false, ...spec.parts };
  const isBreakdown = (s) => Boolean(genre.breakdown) && /breakdown/i.test(s.name);
  let drumTrack = null;

  // ---- drums ----
  if (parts.drums) {
    const d = addTrack(song, { name: 'Drums', kind: 'drums' });
    drumTrack = d;
    const fitsM = (n, m) => GROOVES[n] && GROOVES[n].meter[0] === m[0] && GROOVES[n].meter[1] === m[1];
    // a named groove if it fits the bar's meter; else the same style built on the meter's beat groups;
    // else any library groove in that meter; else an additive rock beat
    const grooveFor = (want, m) => {
      if (fitsM(want, m)) return want;
      if (ADDITIVE[want] && want !== 'rock') return additiveGroove(m[0], m[1], { style: want });
      const lib = Object.keys(GROOVES).find((n) => fitsM(n, m));
      if (lib) return lib;
      return additiveGroove(m[0], m[1], { style: 'rock' });
    };
    const groove = spec.groove ?? genre.groove;
    plan.forEach((s, i) => {
      const own = spec.groove ? undefined : bySection(genre.sectionGrooves, s.name);
      const half = /verse|intro|outro|break/i.test(s.name) && s.energy < 0.6 && spec.genre !== 'punk';
      const want = half && s.energy < 0.45 ? 'halftime' : own ?? groove;
      // runs of bars in one meter
      let r0 = s.bar;
      for (let b = s.bar + 1; b <= s.bar + s.bars; b++) {
        if (b < s.bar + s.bars && meterOf(b).join() === meterOf(r0).join()) continue;
        const last = b === s.bar + s.bars;
        writeGroove(song, d, r0, b, {
          groove: grooveFor(want, meterOf(r0)), energy: s.energy, rng: rng.fork(`drums${i}:${r0}`),
          fillEvery: last && s.bars >= 2 ? b - r0 : 0, crashOnFirst: r0 === s.bar && (i > 0 || s.energy > 0.6),
        });
        r0 = b;
      }
    });
  }

  // ---- bass ----
  if (parts.bass) {
    const tuning = spec.bass?.tuning ?? genre.bassTuning ?? (genre.tuning === 'drop d' ? 'bass drop d' : 'bass');
    const b = addTrack(song, { name: 'Bass', kind: 'fretted', program: spec.bass?.instrument ?? 'Electric Bass (finger)', tuning });
    plan.forEach((s, i) => {
      let style = spec.bass?.style ?? genre.bass;
      if (s.energy < 0.45 && style !== 'walking') style = 'root';
      bassLine(song, b, { from: s.bar, to: s.bar + s.bars, style, rng: rng.fork('bass' + i), palmMute: PALM_MUTED.test(spec.genre ?? '') });
    });
  }

  // ---- rhythm guitar ----
  if (parts.guitar) {
    const tuning = spec.guitar?.tuning ?? genre.tuning ?? 'standard';
    const g = addTrack(song, { name: 'Rhythm Guitar', kind: 'fretted', program: spec.guitar?.instrument ?? genre.guitar, tuning });
    const breakdowns = plan.filter(isBreakdown);
    plan.forEach((s, i) => {
      if (s.poly || s.branching) return; // written below, once bass and drums exist
      if (isBreakdown(s) && meterOf(s.bar).join() === '4,4') {
        // escalate: the last breakdown takes the heaviest feel
        const feels = genre.breakdown.feels ?? ['half'];
        const idx = breakdowns.indexOf(s);
        const feel = idx === breakdowns.length - 1 ? feels[feels.length - 1] : feels[0];
        const r = breakdownRiff(song, g, { from: s.bar, to: s.bar + s.bars, drums: drumTrack, feel, rng: rng.fork('bd' + i) });
        if (drumTrack) drumTrack.notes.push({ start: barStart(song, s.bar), dur: song.ppq / 4, pitch: 49, vel: 115 });
        // the bass doubles the chug rhythm on the root
        const bassT = song.tracks.find((t) => t.name === 'Bass');
        if (bassT) {
          const lo = Math.min(...bassT.tuning.map((t) => midi(t)));
          const ds = barStart(song, s.bar);
          const de = barStart(song, s.bar + s.bars - 1) + barLength(song, s.bar + s.bars - 1);
          bassT.notes = bassT.notes.filter((n) => n.start < ds || n.start >= de);
          let root = lo;
          while (mod(root, 12) !== k.tonicPc) root++;
          const seen = new Set();
          for (const n of r.notes) {
            if (seen.has(n.start)) continue;
            seen.add(n.start);
            bassT.notes.push({ start: n.start, dur: n.dur, pitch: root, vel: n.vel, fx: { pm: true } });
          }
          bassT.notes.sort((a, b) => a.start - b.start);
        }
        return;
      }
      let style = spec.guitar?.style ?? bySection(genre.sectionComps, s.name) ?? genre.comp;
      if (s.energy < 0.45 && ['power', 'gallop', 'strum'].includes(style)) style = style === 'strum' ? 'arpeggio' : 'power';
      comp(song, g, { from: s.bar, to: s.bar + s.bars, style, energy: s.energy, rng: rng.fork('gtr' + i), pattern: spec.guitar?.pattern });
    });
  }

  // ---- polymeter and branching-tuplet cells (guitar leads, kick and bass lock to it) ----
  const gtr = song.tracks.find((t) => t.name === 'Rhythm Guitar');
  if (gtr) {
    const bassT = song.tracks.find((t) => t.name === 'Bass');
    const low = Math.min(...gtr.tuning.map((t) => midi(t)));
    let root = low;
    while (mod(root, 12) !== k.tonicPc) root++;
    const span = (s) => [barStart(song, s.bar), barStart(song, s.bar + s.bars - 1) + barLength(song, s.bar + s.bars - 1)];
    const clear = (t, [a, z], keep = () => false) => { if (t) t.notes = t.notes.filter((n) => n.start < a || n.start >= z || keep(n)); };
    const lockBass = (notes, [a, z]) => {
      if (!bassT) return;
      clear(bassT, [a, z]);
      const lo = Math.min(...bassT.tuning.map((t) => midi(t)));
      let br = lo;
      while (mod(br, 12) !== k.tonicPc) br++;
      const seen = new Set();
      for (const n of notes) {
        if (seen.has(n.start)) continue;
        seen.add(n.start);
        bassT.notes.push({ start: n.start, dur: n.dur, pitch: br + (n.pitch - root >= 0 && n.pitch - root < 12 ? n.pitch - root : 0), vel: n.vel, fx: { pm: true } });
      }
      bassT.notes.sort((x, y) => x.start - y.start);
    };
    plan.forEach((s, i) => {
      const sp = span(s);
      if (s.poly) {
        // an n-sixteenth riff cycling against the bar: Euclidean chugs, a stab on each cycle start
        const n = s.poly;
        const pat = euclid(Math.max(2, Math.round(n * 0.6)), n);
        const notes = [];
        let step = 0;
        for (let t = sp[0]; t < sp[1]; t += song.ppq / 4, step++) {
          const j = step % n;
          if (!pat[j]) continue;
          if (j === 0) notes.push({ start: t, dur: song.ppq / 4, pitch: root, vel: 118 }, { start: t, dur: song.ppq / 4, pitch: root + 7, vel: 118 });
          else notes.push({ start: t, dur: song.ppq / 4, pitch: root, vel: 98, fx: { pm: true } });
        }
        clear(gtr, sp);
        gtr.notes.push(...notes);
        if (drumTrack) {
          clear(drumTrack, sp, (x) => x.pitch !== 36);
          const seen = new Set();
          for (const x of notes) if (!seen.has(x.start)) { seen.add(x.start); drumTrack.notes.push({ start: x.start, dur: song.ppq / 4, pitch: 36, vel: x.vel }); }
        }
        lockBass(notes.filter((x) => x.pitch === root), sp);
      } else if (s.branching) {
        // nested tuplets phrased a a' b a: guitar splits beat groups in 3s and 5s, drums in 2s, 3s and 4s
        clear(gtr, sp);
        clear(drumTrack, sp);
        const layers = [{ track: gtr, pitches: [root, root, root + 1, root, root + 6], splits: [3, 5], depth: 1, restChance: 0.12, fx: { pm: true } }];
        if (drumTrack) layers.push({ track: drumTrack, pitches: ['kick', 'snare', 'kick', 'kick', 'snare'], splits: [2, 3, 4], depth: 1, restChance: 0.05 });
        phraseRhythm(song, { from: s.bar, bars: s.bars, form: s.form ?? "a a' b a", layers, rng: rng.fork('branch' + i) });
        if (drumTrack) {
          for (let b = s.bar; b < s.bar + s.bars; b++) {
            const t0 = barStart(song, b);
            const leaf = drumTrack.tuplets?.find((r) => r.start === t0)?.leaves[0];
            drumTrack.notes.push({ start: t0, dur: leaf?.ticks ?? 120, pitch: 49, vel: 112 }); // crash on every bar of the cell
          }
        }
        if (bassT) {
          for (const r of (gtr.tuplets ?? []).filter((x) => x.start >= sp[0] && x.start < sp[1])) {
            bassT.tuplets = bassT.tuplets ?? [];
            bassT.tuplets.push(JSON.parse(JSON.stringify(r)));
          }
          bassT.tuplets?.sort((x, y) => x.start - y.start);
          lockBass(gtr.notes.filter((x) => x.start >= sp[0] && x.start < sp[1]), sp);
        }
      }
    });
  }

  // ---- keys pad ----
  if (parts.keys) {
    const kt = addTrack(song, { name: 'Keys', kind: 'pitched', program: spec.keys?.instrument ?? 'Pad 2 (warm)' });
    plan.forEach((s) => comp(song, kt, { from: s.bar, to: s.bar + s.bars, style: s.energy > 0.7 ? 'block' : 'pad', range: [53, 77] }));
  }

  // ---- lead melody (same melody for every repeat of a section) ----
  if (parts.lead) {
    const lt = addTrack(song, { name: 'Lead', kind: 'pitched', program: spec.lead?.instrument ?? (spec.genre === 'jazz' ? 'Tenor Sax' : 'Lead 6 (voice)') });
    const memo = new Map();
    plan.forEach((s) => {
      if (/intro|outro|ending|build|break|breakdown/i.test(s.name)) return;
      const baseRange = spec.lead?.range ?? [60, 77];
      const lift = /chorus|drop/i.test(s.name) ? 3 : 0;
      const range = [baseRange[0] + lift, baseRange[1] + lift];
      const keyName = `${s.name}:${s.bars}`;
      if (!memo.has(keyName)) {
        const notes = generateMelody(song, {
          from: s.bar, to: s.bar + s.bars, range, density: spec.lead?.density ?? (/solo/i.test(s.name) ? 0.85 : 0.35 + 0.3 * s.energy),
          phrase: Math.min(4, s.bars), form: /chorus/i.test(s.name) ? 'sentence' : 'period', rng: rng.fork('mel' + s.name),
        });
        memo.set(keyName, { notes, bar: s.bar });
        lt.notes.push(...notes);
      } else {
        const m = memo.get(keyName);
        const shift = barStart(song, s.bar) - barStart(song, m.bar);
        lt.notes.push(...m.notes.map((n) => ({ ...n, start: n.start + shift })));
      }
    });
  }

  // nothing may run past the end
  const end = totalTicks(song);
  for (const t of song.tracks) t.notes = t.notes.filter((n) => n.start < end).map((n) => ({ ...n, dur: Math.min(n.dur, end - n.start) }));
  return song;
}

export { FORMS, GENRES };
