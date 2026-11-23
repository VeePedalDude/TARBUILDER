\version "2.24.0"
\header {
  title = "All-interval row"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = { \clef "treble" \key c \major \time 4/4 \tempo 4 = 90 { c''8 d''8 b'4 ees''16 e''16 bes'8 f'4 |
    aes'8 des''8 a'8 g'8~ g'8 fis'8~ fis'4~ |
    fis'4. f'8 ees'8 fis'8~ fis'8 d'16 des'16 |
    g8 c'8~ c'8 a8 e'8 aes'8 bes'4 |
    b'2. fis'8 g'8 |
    a'4 des''16 aes'16 f'8 bes'4 e'8 ees'8 |
    b8 d'8~ d'8 c'8~ c'2~ |
    c'8 r8 r4 r2 | } }

\score {
  <<
    \new Staff \with { instrumentName = "Piano" } \trackA
  >>
  \layout { }
  \midi { }
}