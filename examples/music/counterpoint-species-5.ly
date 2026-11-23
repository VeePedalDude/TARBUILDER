\version "2.24.0"
\header {
  title = "Fux species 5"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = { \clef "treble" \key d \dorian \time 4/4 \tempo 4 = 80 { d''2. e''4 |
    d''2. c''4~ |
    c''2 b'2 |
    a'2. b'4 |
    b''2 a''4 b''4 |
    a''2. b''4 |
    c'''2 b''4 a''4 |
    g''2. b''4~ |
    b''2 a''2 |
    g''4 f''4 des''2 |
    d''1 | } }

trackB = { \clef "treble" \key d \dorian \time 4/4 { d'1 |
    f'1 |
    e'1 |
    d'1 |
    g'1 |
    f'1 |
    a'1 |
    g'1 |
    f'1 |
    e'1 |
    d'1 | } }

\score {
  <<
    \new Staff \with { instrumentName = "Counterpoint" } \trackA
    \new Staff \with { instrumentName = "Cantus firmus" } \trackB
  >>
  \layout { }
  \midi { }
}