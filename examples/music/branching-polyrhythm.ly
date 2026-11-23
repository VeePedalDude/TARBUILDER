\version "2.24.0"
\header {
  title = "Branching polyrhythm"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = { \clef "treble_8" \key e \minor \time 7/8 \tempo 4 = 132 { \tuplet 9/8 { d,32\6 d,32\6 dis,32\6 } \tuplet 15/8 { d,16\6 gis,16\6 r16 d,16\6 d,16\6 d,32\6 d,32\6 dis,32\6 d,32\6 gis,32\6 r32 } \tuplet 5/4 { d,16\6 } \tuplet 15/8 { d,16\6 dis,32\6 } \tuplet 5/4 { d,16\6 d,16.\6 d,32\6 dis,32\6 d,32\6 gis,16.\6 d,16.\6 d,16\6 dis,32\6 } |
    \tuplet 15/8 { d,16\6 d,16\6 r16 dis,16\6 d,16\6 } \tuplet 9/8 { gis,32\6 d,32\6 d,32\6 } \tuplet 15/8 { d,32\6 d,32\6 r32 } \tuplet 5/4 { dis,16\6 } \tuplet 15/8 { d,16\6 gis,32\6 } \tuplet 5/4 { d,16\6 } \tuplet 15/8 { d,32\6 dis,32\6 d,32\6 } \tuplet 5/4 { d,16.\6 d,32.\6 dis,64\6 d,64\6 gis,64\6 d,16.\6 d,16.\6 dis,16\6 d,32\6 } |
    \time 13/16 \tuplet 3/2 { d,4\6 } \tuplet 15/8 { d,16\6 dis,16\6 d,32\6 } \tuplet 5/4 { d,32.\6 d,32.\6 r16 dis,32\6 d,32.\6 } \tuplet 3/2 { d,32\6 d,16\6 } dis,16\6 d,16\6 \tuplet 5/4 { d,32.\6 r16 d,32\6 dis,32.\6 d,32.\6 } |
    \time 7/8 \tuplet 9/8 { d,32\6 d,32\6 dis,32\6 } \tuplet 15/8 { d,16\6 gis,16\6 r16 d,16\6 d,16\6 d,32\6 d,32\6 dis,32\6 d,32\6 gis,32\6 r32 } \tuplet 5/4 { d,16\6 } \tuplet 15/8 { d,16\6 dis,32\6 } \tuplet 5/4 { d,16\6 d,16.\6 d,32\6 dis,32\6 d,32\6 gis,16.\6 d,16.\6 d,16\6 dis,32\6 } | } }

trackB = { \clef "bass_8" \key e \minor \time 7/8 { \tuplet 10/7 { d,,4\4 a,,4\3 d,,4\4 d,,4\4 } \tuplet 15/14 { a,,16\3 d,,16\4 d,,16\4 } |
    \tuplet 10/7 { d,,4\4 a,,4\3 d,,4\4 } \tuplet 15/14 { d,,16\4 a,,16\3 d,,16\4 } \tuplet 10/7 { d,,4\4 } |
    \time 13/16 \tuplet 15/13 { d,,16.\4 a,,16.\3 d,,16\4 d,,16\4 a,,16\3 d,,8.\4 d,,4.\4 } |
    \time 7/8 \tuplet 10/7 { d,,4\4 a,,4\3 d,,4\4 d,,4\4 } \tuplet 15/14 { a,,16\3 d,,16\4 d,,16\4 } | } }

trackC = \drummode { \time 7/8 { bd8 sn8 bd8 sn8 bd8. sn16. bd16. |
    bd8 sn16 bd64 bd64 r64 bd64 bd16 sn32 bd32 bd8 bd16. sn32. bd64. bd64. bd16. sn16. |
    \time 13/16 bd8 sn8 bd32. r32. sn64. bd64. bd32. bd32. sn32. bd16. bd16. r32. sn32. |
    \time 7/8 bd8 sn8 bd8 sn8 bd8. sn16. bd16. | } }

\score {
  <<
    \new StaffGroup \with { instrumentName = "Guitar" } << \new Staff { \trackA } \new TabStaff \with { stringTunings = \stringTuning <d, a, d g b e'> } { \trackA } >>
    \new StaffGroup \with { instrumentName = "Bass" } << \new Staff { \trackB } \new TabStaff \with { stringTunings = \stringTuning <d,, a,, d, g,> } { \trackB } >>
    \new DrumStaff \with { instrumentName = "Drums" } \trackC
  >>
  \layout { }
  \midi { }
}