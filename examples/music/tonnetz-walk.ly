\version "2.24.0"
\header {
  title = "Tonnetz walk"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = { \clef "treble" \key c \major \time 4/4 \tempo 4 = 76 { <c'' g' e' c'>1^"C" |
    <c'' g' ees' c'>1^"Cm" |
    <bes' g' ees'>1^"Eb" |
    <g' d' bes g>1^"Gm" |
    <bes' d' bes f>1^"Bb" |
    <bes' des' bes f>1^"Bbm" |
    <aes' f' des'>1^"Db" |
    <f' c' aes f>1^"Fm" | } }

trackB = { \clef "treble" \key c \major \time 4/4 { g'2 e''2 |
    ees''2 g''2 |
    g''2 bes''2 |
    bes''2 d''2 |
    d''2 f''2 |
    f''2 des''2 |
    f''2 aes''2 |
    aes''2 c'''2 | } }

\score {
  <<
    \new Staff \with { instrumentName = "Strings" } \trackA
    \new Staff \with { instrumentName = "Lead" } \trackB
  >>
  \layout { }
  \midi { }
}