\version "2.24.0"
\header {
  title = "Golden Steps"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = { \clef "treble" \key c \major \time 4/4 \tempo 4 = 96 { c'16 d'16 c'16 e'16 f'4~ f'16 e'16 d'8 c'8 b16 a16~ |
    a4 g16 a16 g8 b8 c'16 e'16 f'8 g'16 a'16~ |
    a'16 b'16~ b'8 a'16 g'16~ g'16 f'16~ f'16 c'16~ c'16 r16 r4 | } }

\score {
  <<
    \new Staff \with { instrumentName = "Golden Steps" } \trackA
  >>
  \layout { }
  \midi { }
}