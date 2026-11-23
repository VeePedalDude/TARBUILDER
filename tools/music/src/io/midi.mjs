// Standard MIDI File (format 1) writer. One MIDI track per song track plus a tempo/meter track.
import { barStart, assertValid, meterAt } from '../ir.mjs';
import { parseKey } from '../theory/key.mjs';

function vlq(n) {
  if (n < 0) throw new Error(`MIDI delta < 0: ${n}`);
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    bytes.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes;
}

function u32(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function textBytes(str) {
  return [...Buffer.from(String(str), 'utf8')];
}

/**
 * events: [{ tick, bytes: [...] , order }] -> MTrk chunk bytes. Lower `order` first at equal ticks
 * (note-offs before note-ons so repeated notes retrigger).
 */
export function trackChunk(events) {
  const sorted = events.slice().sort((a, b) => a.tick - b.tick || (a.order ?? 5) - (b.order ?? 5));
  const data = [];
  let last = 0;
  for (const e of sorted) {
    data.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  data.push(0, 0xff, 0x2f, 0);
  return [0x4d, 0x54, 0x72, 0x6b, ...u32(data.length), ...data];
}

export function header(ntracks, ppq) {
  return [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 1, (ntracks >> 8) & 255, ntracks & 255, (ppq >> 8) & 255, ppq & 255];
}

export function meta(tick, type, payload, order = 0) {
  return { tick, order, bytes: [0xff, type, ...vlq(payload.length), ...payload] };
}

export function tempoEvent(tick, bpm) {
  const us = Math.round(60000000 / bpm);
  return meta(tick, 0x51, [(us >> 16) & 255, (us >> 8) & 255, us & 255]);
}

export function timeSigEvent(tick, num, den) {
  return meta(tick, 0x58, [num, Math.round(Math.log2(den)), 24, 8]);
}

/** channel for track index: 0..15 skipping 9 (drums use 9) */
export function channelFor(trackIndex, kind) {
  if (kind === 'drums') return 9;
  const c = trackIndex % 15;
  return c >= 9 ? c + 1 : c;
}

/** Song IR -> Uint8Array .mid. options.swing (0..1) delays off-beat 8ths for playback feel. */
export function toMidi(song, options = {}) {
  assertValid(song);
  const ppq = song.ppq;
  const chunks = [];
  const conductor = [meta(0, 0x03, textBytes(song.title ?? 'Untitled'))];
  conductor.push(tempoEvent(0, song.tempo));
  conductor.push(timeSigEvent(0, song.meter.num, song.meter.den));
  try {
    const k = parseKey(song.key ?? 'C major');
    const sf = Math.max(-7, Math.min(7, k.fifths));
    conductor.push(meta(0, 0x59, [sf & 255, k.mode === 'minor' ? 1 : 0]));
  } catch {
    /* modal keys etc: skip key signature */
  }
  for (const t of song.tempoChanges ?? []) conductor.push(tempoEvent(barStart(song, t.bar), t.bpm));
  for (const m of song.meterChanges ?? []) conductor.push(timeSigEvent(barStart(song, m.bar), m.num, m.den));
  for (const s of song.sections ?? []) conductor.push(meta(barStart(song, s.bar), 0x06, textBytes(s.name)));
  chunks.push(trackChunk(conductor));

  const swing = options.swing ?? 0;
  const swingTick = (t) => {
    if (!swing) return t;
    const eighth = ppq / 2;
    const inBeat = t % ppq;
    if (inBeat === eighth) return t + Math.round((swing * ppq) / 6);
    return t;
  };

  song.tracks.forEach((track, i) => {
    const ch = channelFor(i, track.kind);
    const ev = [meta(0, 0x03, textBytes(track.name))];
    if (track.kind !== 'drums') ev.push({ tick: 0, order: 1, bytes: [0xc0 | ch, track.program & 127] });
    for (const n of track.notes) {
      const on = swingTick(n.start);
      let off = swingTick(n.start + n.dur);
      if (track.kind === 'drums') off = on + Math.min(n.dur, ppq / 4);
      if (off <= on) off = on + 1;
      ev.push({ tick: on, order: 3, bytes: [0x90 | ch, n.pitch & 127, Math.max(1, Math.min(127, n.vel ?? 96))] });
      ev.push({ tick: off, order: 2, bytes: [0x80 | ch, n.pitch & 127, 0] });
    }
    chunks.push(trackChunk(ev));
  });
  void meterAt;
  return Uint8Array.from([...header(chunks.length, ppq), ...chunks.flat()]);
}

/** Minimal SMF reader (for tests and importing): returns { ppq, tracks: [{ name, notes:[{tick,dur,pitch,vel,ch}] , events }] } */
export function parseMidi(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  let p = 0;
  const str = (n) => String.fromCharCode(...b.slice(p, p + n));
  const rd32 = () => (b[p++] << 24) | (b[p++] << 16) | (b[p++] << 8) | b[p++];
  const rd16 = () => (b[p++] << 8) | b[p++];
  const rdv = () => {
    let v = 0;
    let c;
    do {
      c = b[p++];
      v = (v << 7) | (c & 0x7f);
    } while (c & 0x80);
    return v;
  };
  if (str(4) !== 'MThd') throw new Error('Not a MIDI file');
  p += 4;
  const len = rd32();
  const format = rd16();
  const ntr = rd16();
  const ppq = rd16();
  p = 8 + len;
  const tracks = [];
  for (let t = 0; t < ntr; t++) {
    if (str(4) !== 'MTrk') throw new Error(`Bad track chunk ${t}`);
    p += 4;
    const tl = rd32();
    const end = p + tl;
    let tick = 0;
    let status = 0;
    const open = new Map();
    const notes = [];
    const events = [];
    let name = '';
    while (p < end) {
      tick += rdv();
      let s = b[p];
      if (s & 0x80) p++;
      else s = status;
      if (s === 0xff) {
        const type = b[p++];
        const l = rdv();
        const data = b.slice(p, p + l);
        p += l;
        if (type === 0x03) name = String.fromCharCode(...data);
        events.push({ tick, type: 'meta', meta: type, data: [...data] });
        continue;
      }
      if (s === 0xf0 || s === 0xf7) {
        const l = rdv();
        p += l;
        continue;
      }
      status = s;
      const hi = s & 0xf0;
      const ch = s & 0x0f;
      const d1 = b[p++];
      const d2 = hi === 0xc0 || hi === 0xd0 ? 0 : b[p++];
      events.push({ tick, type: hi, ch, d1, d2 });
      if (hi === 0x90 && d2 > 0) open.set(`${ch}:${d1}`, { tick, vel: d2 });
      else if (hi === 0x80 || (hi === 0x90 && d2 === 0)) {
        const k = `${ch}:${d1}`;
        const o = open.get(k);
        if (o) {
          notes.push({ tick: o.tick, dur: tick - o.tick, pitch: d1, vel: o.vel, ch });
          open.delete(k);
        }
      }
    }
    p = end;
    tracks.push({ name, notes, events });
  }
  return { format, ppq, tracks };
}
