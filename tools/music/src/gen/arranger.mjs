// Arranger: a short spec in, a complete multi-track song out (form, chords, melody, bass,
// comping, drums), ready for render() -> .gp / .mid / .musicxml / .ly.
import { createSong, addTrack, barStart, barLength, totalTicks } from '../ir.mjs';
import { parseKey } from '../theory/key.mjs';
import { asRng } from '../rng.mjs';
import { planForm, GENRES, FORMS } from './form.mjs';
import { PROGRESSIONS, realize, generateProgression } from './progressions.mjs';
import { writeGroove, GROOVES } from './drums.mjs';
import { bassLine, comp } from './accompany.mjs';
import { generateMelody } from './melody.mjs';

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
  const song = createSong({ title: spec.title ?? `${spec.genre ?? 'rock'} sketch`, artist: spec.artist ?? 'VeePedalDude', tempo, meter, key: k.name, bars });
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

  const parts = { drums: true, bass: true, guitar: true, lead: true, keys: false, ...spec.parts };

  // ---- drums ----
  if (parts.drums) {
    const d = addTrack(song, { name: 'Drums', kind: 'drums' });
    let groove = spec.groove ?? genre.groove;
    const g = GROOVES[groove];
    if (!g || g.meter[0] !== meter[0] || g.meter[1] !== meter[1]) {
      groove = Object.keys(GROOVES).find((n) => GROOVES[n].meter[0] === meter[0] && GROOVES[n].meter[1] === meter[1]) ?? null;
    }
    if (groove) {
      plan.forEach((s, i) => {
        const half = /verse|intro|outro|break/i.test(s.name) && s.energy < 0.6 && spec.genre !== 'punk';
        writeGroove(song, d, s.bar, s.bar + s.bars, {
          groove: half && GROOVES.halftime.meter.join() === meter.join() && s.energy < 0.45 ? 'halftime' : groove,
          energy: s.energy, rng: rng.fork('drums' + i), fillEvery: s.bars >= 4 ? s.bars : 0, crashOnFirst: i > 0 || s.energy > 0.6,
        });
      });
    }
  }

  // ---- bass ----
  if (parts.bass) {
    const tuning = spec.bass?.tuning ?? (genre.tuning === 'drop d' ? 'bass drop d' : 'bass');
    const b = addTrack(song, { name: 'Bass', kind: 'fretted', program: spec.bass?.instrument ?? 'Electric Bass (finger)', tuning });
    plan.forEach((s, i) => {
      let style = spec.bass?.style ?? genre.bass;
      if (s.energy < 0.45 && style !== 'walking') style = 'root';
      bassLine(song, b, { from: s.bar, to: s.bar + s.bars, style, rng: rng.fork('bass' + i), palmMute: spec.genre === 'metal' || spec.genre === 'punk' });
    });
  }

  // ---- rhythm guitar ----
  if (parts.guitar) {
    const tuning = spec.guitar?.tuning ?? genre.tuning ?? 'standard';
    const g = addTrack(song, { name: 'Rhythm Guitar', kind: 'fretted', program: spec.guitar?.instrument ?? genre.guitar, tuning });
    plan.forEach((s, i) => {
      let style = spec.guitar?.style ?? genre.comp;
      if (s.energy < 0.45 && ['power', 'gallop', 'strum'].includes(style)) style = style === 'strum' ? 'arpeggio' : 'power';
      comp(song, g, { from: s.bar, to: s.bar + s.bars, style, energy: s.energy, rng: rng.fork('gtr' + i), pattern: spec.guitar?.pattern });
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
