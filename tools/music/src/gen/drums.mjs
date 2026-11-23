// Drum grooves and fills. Patterns are step strings, one character per step:
//   x = hit, X = accent, g = ghost (quiet), o = open hi-hat (on the hat lane), . = rest
// Steps per bar are set per groove (16 for 4/4 sixteenths, 12 for 12/8, etc.).
import { DRUM, barStart, barLength, addTrack } from '../ir.mjs';
import { asRng } from '../rng.mjs';

export const GROOVES = {
  rock: { meter: [4, 4], steps: 16, lanes: { hh: 'x.x.x.x.x.x.x.x.', kick: 'x.......x.x.....', snare: '....x.......x...' } },
  'rock 2': { meter: [4, 4], steps: 16, lanes: { hh: 'x.x.x.x.x.x.x.x.', kick: 'x.....x.x.......', snare: '....x.......x...' } },
  halftime: { meter: [4, 4], steps: 16, lanes: { hh: 'x.x.x.x.x.x.x.x.', kick: 'x.........x.....', snare: '........x.......' } },
  punk: { meter: [4, 4], steps: 16, lanes: { hh: 'x.x.x.x.x.x.x.x.', kick: 'x...x...x...x...', snare: '..x...x...x...x.' } },
  'd-beat': { meter: [4, 4], steps: 16, lanes: { crash: 'x...x...x...x...', kick: 'x..xx.....xx....', snare: '....x.......x...' } },
  metal: { meter: [4, 4], steps: 16, lanes: { ride: 'x.x.x.x.x.x.x.x.', kick: 'xxxxxxxxxxxxxxxx', snare: '....x.......x...' } },
  blast: { meter: [4, 4], steps: 16, lanes: { crash: 'x.x.x.x.x.x.x.x.', kick: 'x.x.x.x.x.x.x.x.', snare: '.x.x.x.x.x.x.x.x' } },
  funk: { meter: [4, 4], steps: 16, lanes: { hh: 'xxxxxxxxxxxxxxxx', kick: 'x..x..x...x..x..', snare: '....X..g.g..X..g' } },
  disco: { meter: [4, 4], steps: 16, lanes: { hh: '..o...o...o...o.', kick: 'x...x...x...x...', snare: '....x.......x...' } },
  house: { meter: [4, 4], steps: 16, lanes: { hh: '..x...x...x...x.', kick: 'x...x...x...x...', clap: '....x.......x...' } },
  'boom bap': { meter: [4, 4], steps: 16, lanes: { hh: 'x.x.x.x.x.x.x.x.', kick: 'x.......x.x.....', snare: '....x.......x...' } },
  trap: { meter: [4, 4], steps: 16, lanes: { hh: 'xxxxxxxxxxxxxxxx', kick: 'x......x..x.....', snare: '........x.......' } },
  dnb: { meter: [4, 4], steps: 16, lanes: { hh: 'x.x.x.x.x.x.x.x.', kick: 'x.........x.....', snare: '....x.......x...' } },
  reggae: { meter: [4, 4], steps: 16, lanes: { hh: 'x.x.x.x.x.x.x.x.', kick: '........x.......', rim: '........x.......' } },
  bossa: { meter: [4, 4], steps: 16, lanes: { hh: 'x.x.x.x.x.x.x.x.', kick: 'x..xx..xx..xx..x', rim: 'x..x..x...x..x..' } },
  shuffle: { meter: [12, 8], steps: 12, lanes: { hh: 'x.xx.xx.xx.x', kick: 'x.....x.....', snare: '...x.....x..' } },
  'jazz swing': { meter: [12, 8], steps: 12, lanes: { ride: 'x..x.xx..x.x', hhpedal: '...x.....x..', kick: 'g..g..g..g..' } },
  '6/8 ballad': { meter: [6, 8], steps: 6, lanes: { hh: 'xxxxxx', kick: 'x.....', snare: '...x..' } },
  waltz: { meter: [3, 4], steps: 6, lanes: { hh: 'x.x.x.', kick: 'x.....', snare: '..x.x.' } },
  '7/8': { meter: [7, 8], steps: 7, lanes: { hh: 'xxxxxxx', kick: 'x..x...', snare: '..x..x.' } },
  '5/4': { meter: [5, 4], steps: 10, lanes: { hh: 'x.x.x.x.x.', kick: 'x.....x...', snare: '....x...x.' } },
  'motorik': { meter: [4, 4], steps: 8, lanes: { hh: 'xxxxxxxx', kick: 'x.x.x.x.', snare: '..x...x.' } },
};

export function listGrooves(meter) {
  return Object.entries(GROOVES).filter(([, g]) => !meter || (g.meter[0] === meter[0] && g.meter[1] === meter[1])).map(([n]) => n);
}

const VEL = { X: 118, x: 96, o: 96, g: 45 };

/**
 * Write a groove into a drum track for bars [from, to).
 * opts: { groove, humanize (0..1 velocity jitter), rng|seed, energy (0..1: 0 drops hats/ghosts),
 *         crashOnFirst (true), fillEvery (bars, 0 = none), fill (style) }
 */
export function writeGroove(song, track, from, to, opts = {}) {
  const g = typeof opts.groove === 'object' ? opts.groove : GROOVES[opts.groove ?? 'rock'];
  if (!g) throw new Error(`Unknown groove "${opts.groove}". Known: ${Object.keys(GROOVES).join(', ')}`);
  const rng = asRng(opts.rng ?? opts.seed);
  const humanize = opts.humanize ?? 0.15;
  const energy = opts.energy ?? 0.7;
  for (let b = from; b < to; b++) {
    const bs = barStart(song, b);
    const bl = barLength(song, b);
    const step = bl / g.steps;
    if (!Number.isInteger(step) || step % (song.grid ?? 120)) throw new Error(`Groove steps (${g.steps}) don't divide bar ${b + 1} (${bl} ticks)`);
    const isFillBar = opts.fillEvery && (b - from + 1) % opts.fillEvery === 0 && b < to - 0;
    const fillFrom = isFillBar ? Math.floor(g.steps / 2) : g.steps;
    for (const [lane, pat] of Object.entries(g.lanes)) {
      if (pat.length !== g.steps) throw new Error(`Groove lane "${lane}" has ${pat.length} steps, expected ${g.steps}`);
      for (let i = 0; i < Math.min(g.steps, fillFrom); i++) {
        const ch = pat[i];
        if (ch === '.') continue;
        if (ch === 'g' && energy < 0.4) continue;
        if ((lane === 'hh' || lane === 'ride') && energy < 0.2 && i % 2) continue;
        let pitch = DRUM[lane] ?? DRUM.snare;
        if (ch === 'o' && (lane === 'hh' || lane === 'hat')) pitch = DRUM.hhopen;
        const base = VEL[ch] ?? 96;
        const vel = clampVel(base * (0.75 + 0.5 * energy) + rng.gauss(0, 12 * humanize));
        track.notes.push({ start: bs + i * step, dur: step, pitch, vel });
      }
    }
    if (isFillBar) writeFill(song, track, bs + fillFrom * step, bs + bl, { rng, style: opts.fill, step });
    if (b === from && opts.crashOnFirst !== false) {
      removeAt(track, bs, [DRUM.hh, DRUM.hhopen, DRUM.ride]);
      track.notes.push({ start: bs, dur: step, pitch: DRUM.crash, vel: 115 });
      if (!track.notes.some((n) => n.start === bs && n.pitch === DRUM.kick)) track.notes.push({ start: bs, dur: step, pitch: DRUM.kick, vel: 110 });
    }
  }
  dedupe(track);
  return track;
}

/** fill from tick `from` to `to`: 'toms' (descending), 'snare' (roll), 'build' (16ths crescendo) */
export function writeFill(song, track, from, to, { rng: r, seed, style, step = 240 } = {}) {
  const rng = asRng(r ?? seed);
  const st = style ?? rng.pick(['toms', 'snare', 'mixed']);
  const toms = [DRUM.tom1, DRUM.tom2, DRUM.tom3, DRUM.floortom];
  const n = Math.floor((to - from) / step);
  for (let i = 0; i < n; i++) {
    const t = from + i * step;
    let pitch;
    if (st === 'snare' || st === 'build') pitch = DRUM.snare;
    else if (st === 'toms') pitch = toms[Math.min(toms.length - 1, Math.floor((i / n) * toms.length))];
    else pitch = i % 2 ? toms[Math.floor((i / n) * toms.length)] : DRUM.snare;
    const vel = st === 'build' ? clampVel(50 + (70 * i) / Math.max(1, n - 1)) : clampVel(95 + rng.gauss(0, 8));
    track.notes.push({ start: t, dur: step, pitch, vel });
    if (i % 2 === 0) track.notes.push({ start: t, dur: step, pitch: DRUM.kick, vel: 90 });
  }
  dedupe(track);
}

function removeAt(track, tick, pitches) {
  track.notes = track.notes.filter((n) => !(n.start === tick && pitches.includes(n.pitch)));
}

function dedupe(track) {
  const seen = new Map();
  for (const n of track.notes) {
    const k = `${n.start}:${n.pitch}`;
    if (!seen.has(k) || seen.get(k).vel < n.vel) seen.set(k, n);
  }
  track.notes = [...seen.values()].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

function clampVel(v) {
  return Math.max(1, Math.min(127, Math.round(v)));
}

/** convenience: a drum track with one groove over the whole song */
export function drumTrack(song, groove = 'rock', opts = {}) {
  const t = addTrack(song, { name: opts.name ?? 'Drums', kind: 'drums' });
  writeGroove(song, t, 0, song.bars, { groove, ...opts });
  return t;
}
