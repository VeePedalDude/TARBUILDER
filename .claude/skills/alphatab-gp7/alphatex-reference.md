# alphaTex quick reference (alphaTab 1.9.0)

Everything here was built through `tarb` and round-tripped through a .gp export.
Full upstream docs: https://alphatab.net/docs/alphatex/introduction

## File skeleton

```
\title ("Song")
\artist ("VeePedalDude")
\tempo (120)

\track ("Guitar" "Gtr") { instrument distortionguitar }
\staff {tabs score}            // tabs, score, or both
\tuning (E4 B3 G3 D3 A2 E2)    // string 1 (highest) first
\ts (4 4)
:8 0.6 3.6 5.6 0.6 :4 3.6 5.6 |
:1 r

\track ("Bass") { instrument electricbassfinger }
\staff {tabs}
\tuning (G2 D2 A1 E1)
\clef (F4)
:1 0.4 | :1 r
```

`//` starts a comment.

## Score / bar metadata

| Write | Meaning |
|---|---|
| `\title ("X")` `\artist ("X")` `\album ("X")` | song info |
| `\tempo (132)` | BPM (also mid-song, before a bar) |
| `\ts (6 8)` | time signature, before the bar it applies to |
| `\section ("Chorus")` | section marker |
| `\ro` … `\rc (2)` | repeat open / close, play N times |
| `\chord ("E" 0 0 1 2 2 0)` | chord diagram, strings high → low, `x` muted |
| `\clef (F4)` | bass clef; `\clef (neutral)` for drums |

## Notes and beats

| Write | Meaning |
|---|---|
| `5.3` | fret 5, string 3 |
| `:8` | following beats are eighths (1 2 4 8 16 32 64) |
| `5.3.8` | this beat only, eighth |
| `(0.6 2.5 2.4)` | chord |
| `r` | rest |
| `x.6` | dead (muted) note on string 6 |
| `-.3` | tie from previous note on string 3 |

## Note effects (after a note: `5.3{h}`; on each note in a chord)

| Write | Meaning |
|---|---|
| `h` | hammer-on **or** pull-off to the next note |
| `sl` | legato slide to next note |
| `sib` / `sou` | slide in from below / slide out downward |
| `b (0 4)` | bend, quarter-tones: 4 = full, 2 = half; `b (4 0)` pre-bend release |
| `v` | vibrato |
| `pm` | palm mute |
| `lr` | let ring |
| `nh` | natural harmonic; `ah` artificial |
| `g` | ghost note |
| `ac` | accent |
| `st` | staccato |

## Beat effects (after a single note or after a chord's `)`)

| Write | Meaning |
|---|---|
| `tu 3` | triplet (each of the 3 beats) |
| `d` | dotted |
| `gr` | grace note (takes no bar time) |
| `tp 8` / `tp 16` / `tp 32` | tremolo picking |
| `dy ff` | dynamic (ppp … fff) |
| `ch "E"` | show chord name/diagram (define with `\chord` first) |

Traps: `{p}` = pick stroke (not pull-off). `{bu}` / `{bd}` = brush up/down (not bend).

## Drums

```
\track ("Drums") { instrument percussion }
\staff {score}
\clef (neutral)
\articulation defaults
:8 (KickHit HiHatClosed) HiHatClosed (SnareHit HiHatClosed) HiHatClosed |
```

Common ids: `KickHit` `SnareHit` `SnareRimshot` `SnareSideStick` `HiHatClosed` `HiHatHalf` `HiHatOpen`
`PedalHiHatHit` `HighTomHit` `MidTomHit` `LowTomHit` `HighFloorTomHit` `LowFloorTomHit` `RideMiddle`
`RideBell` `RideEdge` `CrashMediumHit` `CrashHighHit` `SplashHit` `ChinaHit` `CowbellMediumHit`
`TambourineHit` `HandClapHit`. (Case-insensitive; run `tarb` with a bad id to see errors.)

## Instruments (track `{ instrument … }`)

`acousticguitarsteel` `acousticguitarnylon` `electricguitarclean` `electricguitarjazz`
`electricguitarmuted` `overdrivenguitar` `distortionguitar` `guitarharmonics`
`electricbassfinger` `electricbasspick` `fretlessbass` `acousticbass` `synthbass1` `percussion`
(General MIDI names without spaces.)

## Tunings (high → low)

| Name | Guitar | Bass |
|---|---|---|
| Standard | `E4 B3 G3 D3 A2 E2` | `G2 D2 A1 E1` |
| Drop D | `E4 B3 G3 D3 A2 D2` | `G2 D2 A1 D1` |
| Eb standard | `Eb4 Bb3 Gb3 Db3 Ab2 Eb2` | `Gb2 Db2 Ab1 Eb1` |
| D standard | `D4 A3 F3 C3 G2 D2` | `F2 C2 G1 D1` |
| Drop C | `D4 A3 F3 C3 G2 C2` | `F2 C2 G1 C1` |
| Open G | `D4 B3 G3 D3 G2 D2` | |
| DADGAD | `D4 A3 G3 D3 A2 D2` | |
| 7-string | `E4 B3 G3 D3 A2 E2 B1` | 5-string `G2 D2 A1 E1 B0` |
