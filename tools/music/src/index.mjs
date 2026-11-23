// TARBUILDER music toolkit: one import for everything.
//   import * as tb from '../tools/music/src/index.mjs'
export * from './rng.mjs';
export * from './ir.mjs';

export * as pitch from './theory/pitch.mjs';
export * as scales from './theory/scale.mjs';
export * as chords from './theory/chord.mjs';
export * as keys from './theory/key.mjs';
export * as roman from './theory/roman.mjs';

export * as progressions from './gen/progressions.mjs';
export * as voicing from './gen/voicing.mjs';
export * as drums from './gen/drums.mjs';
export * as form from './gen/form.mjs';
export * as lyrics from './gen/lyrics.mjs';
export * as melody from './gen/melody.mjs';
export * as motif from './gen/motif.mjs';
export * as harmonize from './gen/harmonize.mjs';
export * as accompany from './gen/accompany.mjs';
export * as riffs from './gen/riffs.mjs';
export * as arranger from './gen/arranger.mjs';
export * as reharm from './gen/reharm.mjs';
export * as jazz from './gen/jazz.mjs';

export * as voiceleading from './analysis/voiceleading.mjs';
export * as counterpoint from './analysis/counterpoint.mjs';
export * as orchestration from './analysis/orchestration.mjs';
export * as style from './analysis/style.mjs';

export * as rhythm from './lab/rhythm.mjs';
export * as tuplets from './tuplets.mjs';
export * as branching from './lab/branching.mjs';
export * as neoriemannian from './lab/neoriemannian.mjs';
export * as pcset from './lab/pcset.mjs';
export * as tuning from './lab/tuning.mjs';
export * as algorithmic from './lab/algorithmic.mjs';
export * as madeup from './lab/madeup.mjs';

export * as alphatex from './io/alphatex.mjs';
export * as midiio from './io/midi.mjs';
export * as musicxml from './io/musicxml.mjs';
export * as lilypond from './io/lilypond.mjs';
export * as gp from './io/gp.mjs';
export { render, ALL_FORMATS } from './io/render.mjs';
export { arrange } from './gen/arranger.mjs';
