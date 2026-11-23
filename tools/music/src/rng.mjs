// Seeded random numbers. Every generator takes an rng so output is reproducible:
// same seed + same options = same music.

export function makeRng(seed = 1) {
  let s = hashSeed(seed) >>> 0;
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    seed,
    next,
    /** integer in [lo, hi] inclusive */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => {
      if (!arr.length) throw new Error('rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)];
    },
    /** pick from [[item, weight], ...] or (items, weights) */
    weighted: (items, weights) => {
      let pairs = weights ? items.map((it, i) => [it, weights[i]]) : items;
      pairs = pairs.filter(([, w]) => w > 0);
      if (!pairs.length) throw new Error('rng.weighted: no positive weights');
      const total = pairs.reduce((a, [, w]) => a + w, 0);
      let r = next() * total;
      for (const [it, w] of pairs) {
        r -= w;
        if (r < 0) return it;
      }
      return pairs[pairs.length - 1][0];
    },
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    gauss: (mean = 0, sd = 1) => {
      const u = Math.max(next(), 1e-12);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    /** independent child stream, so adding a generator doesn't change the others' output */
    fork: (label) => makeRng(`${seed}/${label}`),
  };
  return rng;
}

function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.floor(seed) ^ 0x9e3779b9;
  const str = String(seed);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h;
}

export function asRng(r) {
  if (r && typeof r.next === 'function') return r;
  return makeRng(r ?? 1);
}
