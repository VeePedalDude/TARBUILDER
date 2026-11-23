// Song forms: section plans with bar counts and energy, plus genre defaults.

// energy 0..1 drives arrangement density (drums, comping, register).
export const FORMS = {
  'verse-chorus': [['Intro', 4, 0.4], ['Verse', 8, 0.5], ['Chorus', 8, 0.85], ['Verse', 8, 0.55], ['Chorus', 8, 0.9], ['Bridge', 8, 0.65], ['Chorus', 8, 1], ['Outro', 4, 0.4]],
  pop: [['Intro', 4, 0.4], ['Verse', 8, 0.5], ['Pre-Chorus', 4, 0.7], ['Chorus', 8, 0.9], ['Verse', 8, 0.55], ['Pre-Chorus', 4, 0.75], ['Chorus', 8, 0.95], ['Bridge', 8, 0.6], ['Chorus', 8, 1], ['Outro', 4, 0.4]],
  aaba: [['A', 8, 0.6], ['A', 8, 0.65], ['B', 8, 0.75], ['A', 8, 0.7]],
  blues: [['Intro', 4, 0.5], ['Head', 12, 0.7], ['Solo', 12, 0.85], ['Head', 12, 0.75], ['Ending', 2, 0.5]],
  punk: [['Intro', 4, 0.8], ['Verse', 8, 0.85], ['Chorus', 8, 1], ['Verse', 8, 0.85], ['Chorus', 8, 1], ['Outro', 4, 0.9]],
  metal: [['Intro', 4, 0.7], ['Riff', 8, 0.9], ['Verse', 8, 0.85], ['Chorus', 8, 1], ['Breakdown', 8, 0.95], ['Chorus', 8, 1], ['Outro', 4, 0.7]],
  // metalcore: verse-chorus with a breakdown slot before the last chorus (see the metal research doc)
  metalcore: [['Intro', 4, 0.8], ['Verse', 8, 0.8], ['Pre-Chorus', 4, 0.85], ['Chorus', 8, 0.9], ['Verse', 8, 0.8], ['Pre-Chorus', 4, 0.85], ['Chorus', 8, 0.95], ['Bridge', 8, 0.7], ['Breakdown', 8, 0.95], ['Chorus', 8, 1], ['Outro', 4, 0.6]],
  // deathcore: riff/blast sections cut into escalating breakdowns, the heaviest last
  deathcore: [['Intro', 4, 0.8], ['Riff', 8, 0.9], ['Verse', 8, 0.9], ['Breakdown', 8, 0.95], ['Riff', 8, 0.9], ['Verse', 8, 0.9], ['Bridge', 8, 0.7], ['Breakdown', 8, 1]],
  // death metal: compound AABA (Hudson 2021) with a buildup intro; riffs repeat in 2s and 4s
  'death metal': [['Intro', 4, 0.6], ['Verse', 8, 0.9], ['Chorus', 8, 0.95], ['Verse', 8, 0.9], ['Chorus', 8, 0.95], ['Bridge', 8, 0.8], ['Verse', 8, 0.9], ['Chorus', 8, 1], ['Outro', 4, 0.7]],
  edm: [['Intro', 8, 0.3], ['Build', 8, 0.6], ['Drop', 16, 1], ['Break', 8, 0.35], ['Build', 8, 0.65], ['Drop', 16, 1], ['Outro', 8, 0.3]],
  ballad: [['Intro', 4, 0.25], ['Verse', 8, 0.35], ['Chorus', 8, 0.6], ['Verse', 8, 0.4], ['Chorus', 8, 0.7], ['Bridge', 8, 0.55], ['Chorus', 8, 0.8], ['Outro', 4, 0.25]],
  short: [['A', 4, 0.6], ['B', 4, 0.8], ['A', 4, 0.7]],
  loop: [['Loop', 8, 0.7]],
};

export const GENRES = {
  rock: { tempo: [100, 140], keys: ['E minor', 'A minor', 'G major', 'D major', 'E major'], groove: 'rock', form: 'verse-chorus', progression: ['axis', 'mixolydian rock', 'aeolian vamp', 'grunge'], guitar: 'Distortion Guitar', comp: 'power', bass: 'eighths' },
  pop: { tempo: [90, 124], keys: ['C major', 'G major', 'D major', 'A major', 'F major'], groove: 'rock 2', form: 'pop', progression: ['axis', 'sensitive female', 'doo-wop', 'royal road'], guitar: 'Electric Guitar (clean)', comp: 'strum', bass: 'root-fifth' },
  punk: { tempo: [160, 200], keys: ['E major', 'A major', 'D major', 'G major'], groove: 'punk', form: 'punk', progression: ['three chord', 'punk'], guitar: 'Overdriven Guitar', comp: 'power', bass: 'eighths' },
  metal: { tempo: [110, 170], keys: ['E minor', 'D minor', 'C# minor', 'B minor'], groove: 'metal', form: 'metal', progression: ['andalusian', 'metal gallop', 'phrygian', 'aeolian vamp'], guitar: 'Distortion Guitar', comp: 'gallop', bass: 'eighths', tuning: 'drop d', breakdown: { feels: ['half'] } },
  // sectionGrooves / sectionComps: per-section overrides, matched by section name (case-insensitive prefix)
  metalcore: { tempo: [140, 180], keys: ['C minor'], groove: 'd-beat', sectionGrooves: { 'pre-chorus': 'double kick', chorus: 'rock 2', bridge: 'halftime', intro: 'double kick' }, form: 'metalcore', progression: ['aeolian vamp', 'andalusian'], guitar: 'Distortion Guitar', comp: 'power', sectionComps: { chorus: 'strum' }, bass: 'eighths', tuning: 'drop c', bassTuning: 'bass drop c', breakdown: { feels: ['half'] } },
  deathcore: { tempo: [140, 190], keys: ['A minor'], groove: 'blast', sectionGrooves: { riff: 'double kick', bridge: 'gravity blast', intro: 'double kick' }, form: 'deathcore', progression: ['phrygian', 'aeolian vamp'], guitar: 'Distortion Guitar', comp: 'power', bass: 'eighths', tuning: 'drop a', bassTuning: 'bass 5 drop a', lead: false, breakdown: { feels: ['half', 'quarter'] } },
  'tech-death': { tempo: [180, 230], keys: ['B minor'], groove: 'blast', sectionGrooves: { chorus: 'double kick', intro: 'double kick', bridge: 'skank' }, form: 'death metal', progression: ['phrygian', 'andalusian'], guitar: 'Distortion Guitar', comp: 'power', bass: 'eighths', tuning: 'b standard', bassTuning: 'bass 5', lead: false },
  blues: { tempo: [70, 120], keys: ['E major', 'A major', 'G major', 'C major'], groove: 'shuffle', meter: [12, 8], form: 'blues', progression: ['12-bar blues', 'quick-change blues'], guitar: 'Electric Guitar (clean)', comp: 'shuffle', bass: 'walking' },
  jazz: { tempo: [110, 180], keys: ['F major', 'Bb major', 'Eb major', 'C major'], groove: 'jazz swing', meter: [12, 8], form: 'aaba', progression: ['ii-V-I', 'turnaround', 'rhythm changes A'], guitar: 'Electric Guitar (jazz)', comp: 'jazz', bass: 'walking' },
  funk: { tempo: [95, 115], keys: ['E minor', 'A minor', 'D dorian'], groove: 'funk', form: 'loop', progression: ['dorian vamp'], guitar: 'Electric Guitar (clean)', comp: 'funk', bass: 'syncopated' },
  folk: { tempo: [80, 110], keys: ['G major', 'D major', 'C major', 'A major'], groove: 'rock 2', form: 'verse-chorus', progression: ['three chord', 'canon', 'doo-wop'], guitar: 'Acoustic Guitar (steel)', comp: 'arpeggio', bass: 'root' },
  lofi: { tempo: [70, 90], keys: ['F major', 'C major', 'Eb major'], groove: 'boom bap', form: 'loop', progression: ['lofi', 'neo soul'], guitar: 'Electric Guitar (jazz)', comp: 'arpeggio', bass: 'root' },
  reggae: { tempo: [70, 90], keys: ['A minor', 'G major', 'C major'], groove: 'reggae', form: 'verse-chorus', progression: ['axis', 'aeolian vamp'], guitar: 'Electric Guitar (clean)', comp: 'skank', bass: 'syncopated' },
  ballad: { tempo: [60, 80], keys: ['C major', 'G major', 'D major', 'Eb major'], groove: '6/8 ballad', meter: [6, 8], form: 'ballad', progression: ['canon', 'sensitive female', 'gospel'], guitar: 'Acoustic Guitar (nylon)', comp: 'arpeggio', bass: 'root' },
};

/** form name or custom list -> [{ name, bars, energy, bar (start) }] */
export function planForm(form = 'verse-chorus', { scale = 1 } = {}) {
  const list = Array.isArray(form) ? form : FORMS[form];
  if (!list) throw new Error(`Unknown form "${form}". Known: ${Object.keys(FORMS).join(', ')}`);
  let bar = 0;
  return list.map((s) => {
    const [name, bars, energy] = Array.isArray(s) ? s : [s.name, s.bars, s.energy ?? 0.7];
    const b = Math.max(1, Math.round(bars * scale));
    const out = { name, bars: b, energy, bar };
    bar += b;
    return out;
  });
}

export function formBars(plan) {
  return plan.reduce((a, s) => a + s.bars, 0);
}
