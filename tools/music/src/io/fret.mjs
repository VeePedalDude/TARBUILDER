// Guitar/bass fingering: give every note a string and fret that a human can play.
// Beam search over onsets so chords stay within a hand span, the hand doesn't jump around,
// sustained notes keep their strings, and legato (h / sl) stays on one string.
import { midi } from '../theory/pitch.mjs';

// Tweak these to change fingering style.
export const FRET_COSTS = {
  maxSpan: 4,        // max distance between lowest and highest fretted note in a chord (4 = 5-fret stretch)
  spanWeight: 1.2,   // cost per fret of chord stretch
  moveWeight: 0.6,   // cost per fret the hand moves between onsets
  highFretFrom: 12,  // frets above this cost extra
  highFretWeight: 0.25,
  openBonus: 0.4,    // small preference for open strings
  legatoPenalty: 25, // hammer-on/slide not on the same string as the previous note
  beam: 40,          // search width
};

/** all ways to put the pitches of one chord on distinct free strings */
function candidates(pitches, openMidi, maxFret, fixed, occupied) {
  const n = openMidi.length;
  const out = [];
  const rec = (i, used, acc) => {
    if (i === pitches.length) {
      out.push(acc.slice());
      return;
    }
    const p = pitches[i];
    for (let s = 0; s < n; s++) {
      if (used & (1 << s) || occupied.has(s)) continue;
      if (fixed[i] && fixed[i].string !== undefined && fixed[i].string - 1 !== s) continue;
      const f = p - openMidi[s];
      if (f < 0 || f > maxFret) continue;
      if (fixed[i] && fixed[i].fret !== undefined && fixed[i].fret !== f) continue;
      acc.push({ s, f });
      rec(i + 1, used | (1 << s), acc);
      acc.pop();
    }
  };
  rec(0, 0, []);
  return out;
}

function shapeCost(shape, C) {
  const fretted = shape.filter((x) => x.f > 0).map((x) => x.f);
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  if (span > C.maxSpan) return Infinity;
  let cost = span * C.spanWeight;
  for (const x of shape) {
    if (x.f > C.highFretFrom) cost += (x.f - C.highFretFrom) * C.highFretWeight;
    if (x.f === 0) cost -= C.openBonus;
  }
  return cost;
}

function handPos(shape, prev) {
  const fretted = shape.filter((x) => x.f > 0).map((x) => x.f);
  return fretted.length ? Math.min(...fretted) : prev;
}

/**
 * Assign string/fret to every note of a fretted track (mutates notes: sets n.string, n.fret;
 * string 1 = highest string, like alphaTex/Guitar Pro).
 * Throws with the bar/tick if some onset can't be played.
 */
export function assignFrets(track, opts = {}) {
  const C = { ...FRET_COSTS, ...opts };
  const openMidi = track.tuning.map((t) => midi(t)); // index 0 = string 1 (highest)
  const maxFret = track.maxFret ?? 22;
  const groups = new Map();
  for (const n of track.notes) {
    if (!groups.has(n.start)) groups.set(n.start, []);
    groups.get(n.start).push(n);
  }
  const onsets = [...groups.keys()].sort((a, b) => a - b);
  // beam entries: { cost, pos, assign: Map(note -> {s,f}), active: [{end, s}] , last: Map(pitch->s) }
  // assignments are kept as a linked list (node.prev) so long songs stay fast
  let beam = [{ cost: 0, pos: null, node: null, active: [] }];
  for (const t of onsets) {
    const notes = groups.get(t).slice().sort((a, b) => b.pitch - a.pitch);
    const pitches = notes.map((n) => n.pitch);
    const fixed = notes.map((n) => (n.string !== undefined || n.fret !== undefined ? { string: n.string, fret: n.fret } : null));
    const next = [];
    for (const st of beam) {
      const stillOn = st.active.filter((a) => a.end > t);
      const occupied = new Set(stillOn.map((a) => a.s));
      const shapes = candidates(pitches, openMidi, maxFret, fixed, occupied);
      for (const shape of shapes) {
        let c = shapeCost(shape, C);
        if (c === Infinity) continue;
        const pos = handPos(shape, st.pos);
        if (st.pos !== null && pos !== null) c += Math.abs(pos - st.pos) * C.moveWeight;
        // legato: note with h/sl into this onset should share a string with the previous onset's note
        const prevAssign = st.node;
        notes.forEach((n, i) => {
          if (prevAssign && prevAssign.legatoFrom) {
            const want = prevAssign.legatoFrom;
            if (want.size && !want.has(shape[i].s) && notes.length === 1) c += C.legatoPenalty;
          }
        });
        const legatoFrom = new Set(notes.map((n, i) => ((n.fx?.h || n.fx?.sl) ? shape[i].s : -1)).filter((s) => s >= 0));
        next.push({
          cost: st.cost + c,
          pos,
          node: { prev: st.node, t, notes, shape, legatoFrom },
          active: [...stillOn, ...shape.map((x, i) => ({ end: t + notes[i].dur, s: x.s }))],
        });
      }
    }
    if (!next.length) {
      const names = pitches.join(',');
      throw new Error(`Track "${track.name}": can't finger pitches [${names}] at tick ${t} within a ${C.maxSpan + 1}-fret span on this tuning (maxFret ${maxFret}).`);
    }
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, C.beam);
  }
  for (let node = beam[0].node; node; node = node.prev) {
    node.notes.forEach((n, i) => {
      n.string = node.shape[i].s + 1;
      n.fret = node.shape[i].f;
    });
  }
  return track;
}

/** where a pitch can be played: [{ string, fret }] */
export function positions(pitch, tuningNotes, maxFret = 22) {
  const m = typeof pitch === 'number' ? pitch : midi(pitch);
  return tuningNotes
    .map((t, i) => ({ string: i + 1, fret: m - midi(t) }))
    .filter((p) => p.fret >= 0 && p.fret <= maxFret);
}
