---
name: jazz-harmony
description: Jazz and reharmonisation - tritone subs, secondary dominants, ii-V insertion, modal interchange, chromatic mediants, backdoor dominants, passing diminished chords, Coltrane changes, chord-scale choices with avoid notes, guide-tone lines and bebop eighth-note lines over changes. Use when reharmonising, comping or soloing over changes.
---

# jazz-harmony

Builds on `music-core`. Chord lists are `[{ start, dur, symbol }]` (ticks); every tool returns a new list with the
same total length and adds `why` (and often `was`) to changed chords.

```bash
node tools/music/bin/tb.mjs reharm "Dm7 G7 Cmaj7 Cmaj7" --tool coltrane
node tools/music/bin/tb.mjs analyze "Dm7 G7 Cmaj7 A7" --key C
```

| Tool | Effect |
|---|---|
| `tritoneSub(chords, { prob })` | G7 -> Db7 |
| `secondaryDominants(chords, { key })` | second half of each chord becomes V7 of the next |
| `insertTwoFive(chords)` | ii-V (or iiø-V7b9 for minor targets) into each chord; long chords keep their first half |
| `modalInterchange(chords, { key, prob })` | IV->iv, vi->bVI, iii->bIII, ii->iiø7, V->v (major keys) |
| `chromaticMediant(chords, { prob })` | same quality a 3rd/6th away |
| `backdoor(chords, { key })` | V7 -> bVII7 before the tonic |
| `passingDiminished(chords)` | C -> C#dim7 -> Dm |
| `coltrane(chords)` | G7 Cmaj7 -> Eb7 Abmaj7 B7 Emaj7 G7 Cmaj7 |

All in `tb.reharm.REHARM`. Lines over changes:

```js
tb.jazz.chordScale('G7alt')            // { scale: 'altered', pcs, avoid }
tb.jazz.guideToneLine(chords, { range: [55, 76], perChord: 1|2 })
tb.jazz.bebopLine(song, chords, { seed, range: [58, 82], restProb })
tb.accompany.bassLine(song, bassTrack, { style: 'walking' })
tb.accompany.comp(song, keysTrack, { style: 'jazz' })     // shells, Charleston rhythm
await tb.render(song, 'songs/x', { swing: 0.5 })          // MIDI swing; notation stays straight
```

Tested: totals preserved and every output symbol parses; guide tones are 3rds/7ths (3rd/5th on triads) moving by
<= 3 semitones; bebop lines land chord tones on >= 85% of beats.

## Known limits

- Swing is applied to MIDI playback only (`swing` 0..1); GP/MusicXML show straight eighths.
- Chord-scale choice is the textbook default; context beyond the next chord isn't considered.
