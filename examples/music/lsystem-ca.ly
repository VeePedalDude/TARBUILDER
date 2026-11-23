\version "2.24.0"
\header {
  title = "L-system"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = { \clef "treble" \key a \minor \time 4/4 \tempo 4 = 104 { a'8 b'8 c''8 b'8 c''8 d''8 e''8 d''8 |
    e''8 d''8 e''8 d''8 e''8 f''8 g''8 f''8 |
    g''8 a''8 b'8 a''8 b'8 c''8 d''8 c''8 |
    d''8 c''8 d''8 c''8 d''8 e''8 f''8 e''8 |
    f''8 e''8 f''8 e''8 f''8 g''8 a''8 g''8 |
    a''8 g''8 a''8 g''8 a''8 b'8 c''8 b'8 |
    c''8 d''8 e''8 d''8 e''8 f''8 g''8 f''8 |
    g''8 f''8 g''8 f''8 g''8 a''8 b'8 a''8 | } }

trackB = \drummode { \time 4/4 { bd8 bd16 bd16 r16 bd16 r16 bd16 <ss bd>8 bd16 bd16 r16 bd16 r16 bd16 |
    bd8 bd16 bd16 r16 bd16 r16 <ss bd>16 <ss bd>16 ss16 bd16 bd16 r16 bd16 r16 bd16 |
    bd8 bd16 bd16 r16 bd16 ss16 <ss bd>16 bd8 <ss bd>16 bd16 r16 bd16 r16 bd16 |
    bd8 bd16 bd16 r16 <ss bd>16 ss16 bd16 <ss bd>16 ss16 <ss bd>16 <ss bd>16 r16 bd16 r16 bd16 |
    bd8 bd16 bd16 ss16 <ss bd>16 r16 bd16 <ss bd>8 bd16 bd16 ss16 bd16 r16 bd16 |
    bd8 bd16 <ss bd>16 ss16 bd16 ss16 <ss bd>16 <ss bd>16 ss16 bd16 <ss bd>16 ss16 <ss bd>16 r16 bd16 |
    bd8 <ss bd>16 <ss bd>16 r16 bd16 ss16 bd16 bd8 bd16 <ss bd>16 r16 bd16 ss16 bd16 |
    bd16 ss16 <ss bd>16 bd16 ss16 <ss bd>16 ss16 <ss bd>16 bd8 <ss bd>16 <ss bd>16 ss16 <ss bd>16 ss16 <ss bd>16 | } }

\score {
  <<
    \new Staff \with { instrumentName = "Marimba" } \trackA
    \new DrumStaff \with { instrumentName = "Drums" } \trackB
  >>
  \layout { }
  \midi { }
}