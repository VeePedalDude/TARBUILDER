// Lyrics helpers: syllable counting/splitting (English, rule-based), stress guesses,
// and fitting syllables to melody notes.
//
// Rule-based syllabification is approximate (~90% on common words). Override any word with
// EXCEPTIONS below or by writing hyphens yourself: "beau-ti-ful".

export const EXCEPTIONS = {
  the: ['the'], every: ['ev', 'ery'], everything: ['ev', 'ery', 'thing'], fire: ['fire'], hour: ['hour'], our: ['our'],
  heaven: ['heav', 'en'], people: ['peo', 'ple'], being: ['be', 'ing'], idea: ['i', 'de', 'a'], area: ['ar', 'e', 'a'],
  quiet: ['qui', 'et'], poem: ['po', 'em'], lion: ['li', 'on'], science: ['sci', 'ence'], beautiful: ['beau', 'ti', 'ful'],
  maybe: ['may', 'be'], something: ['some', 'thing'], someone: ['some', 'one'], somewhere: ['some', 'where'], into: ['in', 'to'],
  only: ['on', 'ly'], over: ['o', 'ver'], even: ['e', 'ven'], ever: ['ev', 'er'], forever: ['for', 'ev', 'er'],
  remember: ['re', 'mem', 'ber'], tonight: ['to', 'night'], alone: ['a', 'lone'], away: ['a', 'way'], again: ['a', 'gain'],
  baby: ['ba', 'by'], lady: ['la', 'dy'], crying: ['cry', 'ing'], dying: ['dy', 'ing'], flying: ['fly', 'ing'], trying: ['try', 'ing'],
  world: ['world'], girl: ['girl'], whole: ['whole'], smile: ['smile'], while: ['while'], time: ['time'], love: ['love'], gone: ['gone'],
  done: ['done'], come: ['come'], some: ['some'], one: ['one'], live: ['live'], give: ['give'], have: ['have'], are: ['are'], were: ['were'],
  there: ['there'], where: ['where'], here: ['here'], more: ['more'], sure: ['sure'], whose: ['whose'], those: ['those'],
  apply: ['ap', 'ply'], supply: ['sup', 'ply'], reply: ['re', 'ply'], butterfly: ['but', 'ter', 'fly'], holy: ['ho', 'ly'],
  machine: ['ma', 'chine'], business: ['bus', 'i', 'ness'], different: ['dif', 'fer', 'ent'], family: ['fam', 'i', 'ly'], chocolate: ['choc', 'late'],
};

const COMPOUND_STARTS = ['some', 'every', 'any', 'heart', 'fire', 'home', 'life', 'moon', 'sun', 'night', 'day', 'rain', 'snow', 'under', 'over', 'out', 'with', 'down', 'up'];
const SUFFIXES = ['ness', 'less', 'ment', 'ful', 'ly'];
const VOWELS = 'aeiouy';
const isV = (c) => VOWELS.includes(c);

/** split a word into syllables */
export function syllables(word) {
  const raw = String(word);
  if (raw.includes('-')) return raw.split('-').filter(Boolean);
  const w = raw.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return [];
  if (EXCEPTIONS[w]) return restoreCase(raw, EXCEPTIONS[w]);
  if (w.length <= 3) return [raw.replace(/[^A-Za-z']/g, '')];
  // compounds and suffixes: some+times, heart+break, lone+ly, dark+ness
  for (const pre of COMPOUND_STARTS) {
    const rest = w.slice(pre.length);
    if (w.startsWith(pre) && rest.length >= 4 && !isV(rest[0]) && /[aeiouy]/.test(rest)) return restoreCase(raw, [...syllables(pre), ...syllables(rest)]);
  }
  for (const suf of SUFFIXES) {
    const stem = w.slice(0, -suf.length);
    if (w.endsWith(suf) && stem.length >= 3 && /[aeiouy]/.test(stem)) return restoreCase(raw, [...syllables(stem), suf]);
  }
  // vowel groups, treating final silent e and -es/-ed endings
  const groups = [];
  let i = 0;
  while (i < w.length) {
    if (isV(w[i]) && !(w[i] === 'y' && i === 0)) {
      let j = i;
      while (j < w.length && isV(w[j])) j++;
      groups.push([i, j]);
      i = j;
    } else i++;
  }
  // silent final e (but not "-le" after consonant: ta-ble)
  if (groups.length > 1) {
    const last = groups[groups.length - 1];
    const endE = w.endsWith('e') && last[0] === w.length - 1;
    const le = /[^aeiouy]le$/.test(w);
    const esEd = /[^aeiouy](es|ed)$/.test(w) && !/(ted|ded|ses|zes|ces|ges|shes|ches|xes)$/.test(w);
    if ((endE && !le) || esEd) groups.pop();
  }
  if (groups.length <= 1) return [raw.replace(/[^A-Za-z']/g, '')];
  // split between groups: VCV -> V-CV, VCCV -> VC-CV (keep common digraphs together)
  const DIGRAPHS = ['ch', 'sh', 'th', 'ph', 'wh', 'ck', 'ng', 'qu', 'gh'];
  const cuts = [];
  for (let k = 0; k < groups.length - 1; k++) {
    const a = groups[k][1];
    const b = groups[k + 1][0];
    const cons = w.slice(a, b);
    let cut;
    if (cons.length === 0) cut = a; // hiatus: vowel-vowel across groups is rare here
    else if (cons.length === 1) cut = a;
    else if (cons.length === 2) cut = DIGRAPHS.includes(cons) ? a : a + 1;
    else cut = DIGRAPHS.includes(cons.slice(-2)) ? b - 2 : b - 1;
    if (cons === 'ck') cut = b;
    // "-le" ending keeps its consonant: ta-ble
    if (k === groups.length - 2 && /[^aeiouy]le$/.test(w) && b === w.length - 1) cut = b - 2;
    cuts.push(cut);
  }
  const out = [];
  let prev = 0;
  for (const c of cuts) {
    if (c > prev) out.push(w.slice(prev, c));
    prev = c;
  }
  out.push(w.slice(prev));
  return restoreCase(raw, out.filter(Boolean));
}

function restoreCase(raw, parts) {
  if (raw[0] && raw[0] === raw[0].toUpperCase() && /[A-Za-z]/.test(raw[0])) parts = [parts[0][0].toUpperCase() + parts[0].slice(1), ...parts.slice(1)];
  return parts;
}

export function countSyllables(text) {
  return String(text).split(/\s+/).filter(Boolean).reduce((a, w) => a + syllables(w).length, 0);
}

const UNSTRESSED = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as', 'is', 'am', 'are', 'was', 'were', 'be', 'it', 'its', 'my', 'your', 'his', 'her', 'their', 'our', 'i', 'you', 'we', 'they', 'he', 'she', 'me', 'him', 'them', 'us', 'that', 'than', 'then', 'so', 'if', 'do', 'does', 'can', 'will', 'just', 'like']);
const UNSTRESSED_PREFIX = ['a', 'be', 'de', 're', 'to', 'un', 'for', 'per', 'pre', 'pro', 'con', 'com', 'ex', 'in', 'dis'];

/**
 * Text -> [{ text, word, stress: 0|1, last: bool (last syllable of its word) }]
 * Stress guess: function words unstressed; 2-syllable words stressed on the first syllable
 * unless they start with a weak prefix (a-way, be-low, re-turn); longer words: first syllable,
 * or second after a weak prefix.
 */
export function scan(text) {
  const out = [];
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const sy = syllables(word);
    const lw = word.toLowerCase().replace(/[^a-z']/g, '');
    let stressIdx;
    if (sy.length === 1) stressIdx = UNSTRESSED.has(lw) ? -1 : 0;
    else stressIdx = UNSTRESSED_PREFIX.includes(sy[0].toLowerCase()) ? 1 : 0;
    sy.forEach((s, i) => out.push({ text: s, word, stress: i === stressIdx ? 1 : 0, last: i === sy.length - 1 }));
  }
  return out;
}

/**
 * Attach lyrics to a melody track's notes (in time order). One syllable per note; extra notes
 * become melisma (no new syllable). Syllables mid-word get a trailing "-".
 * Returns { assigned, leftoverSyllables, warnings[] } and sets note.lyric.
 */
export function fitLyrics(track, text, { song, strongBeat } = {}) {
  const syl = scan(text);
  const notes = track.notes.slice().sort((a, b) => a.start - b.start);
  const warnings = [];
  let k = 0;
  for (const n of notes) {
    if (k >= syl.length) break;
    const s = syl[k];
    n.lyric = s.text + (s.last ? '' : '-');
    if (song && strongBeat) {
      const strong = strongBeat(n.start);
      if (s.stress && !strong) warnings.push(`"${s.text}" (stressed) lands on a weak beat at tick ${n.start}`);
      if (!s.stress && strong && s.word.length > 3) warnings.push(`"${s.text}" (unstressed) lands on a strong beat at tick ${n.start}`);
    }
    k++;
  }
  if (k < syl.length) warnings.push(`${syl.length - k} syllables left over (need more notes)`);
  return { assigned: k, leftoverSyllables: syl.slice(k).map((s) => s.text), warnings };
}

/**
 * Make a rhythm for a lyric line: stressed syllables on strong beats.
 * Returns [{ start (ticks from line start), dur, syllable }]. beat = ticks per beat.
 */
export function rhythmForLine(text, { beat = 960, beatsPerBar = 4, bars = 1 } = {}) {
  const syl = scan(text);
  const half = beat / 2;
  const total = beat * beatsPerBar * bars;
  // candidate slots on 8ths; strong = on the beat
  const slots = [];
  for (let t = 0; t < total; t += half) slots.push({ t, strong: t % beat === 0, downbeat: t % (beat * beatsPerBar) === 0 });
  const out = [];
  let si = 0;
  for (const s of syl) {
    while (si < slots.length && s.stress && !slots[si].strong) si++;
    if (si >= slots.length) break;
    out.push({ start: slots[si].t, syllable: s.text + (s.last ? '' : '-'), stress: s.stress });
    si++;
  }
  if (out.length < syl.length) throw new Error(`"${text}": ${syl.length} syllables don't fit in ${bars} bar(s) of 8ths`);
  out.forEach((o, k) => (o.dur = (out[k + 1]?.start ?? Math.min(total, o.start + beat * 2)) - o.start));
  return out;
}

/** rhyme check by matching the last stressed vowel onward (rough, spelling-based) */
export function rhymes(a, b) {
  const tail = (w) => {
    const s = w.toLowerCase().replace(/[^a-z]/g, '').replace(/e$/, '');
    const m = /[aeiouy]+[^aeiouy]*$/.exec(s);
    return m ? m[0] : s;
  };
  return tail(a) === tail(b) && a.toLowerCase() !== b.toLowerCase();
}
