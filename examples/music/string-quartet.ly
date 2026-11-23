\version "2.24.0"
\header {
  title = "Quartet sketch"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = { \clef "treble" \key d \major \time 4/4 \tempo 4 = 88 { a''16^"D" g''16 fis''16 g''16 fis''8 e''8 d''2 |
    b'16^"Bm" d''16 e''8 fis''8 e''8 d''8 b'8 d''16 cis''16 d''16 e''16 |
    g''16^"G" d''16 e''16 fis''16 g''8 b''8 g''2 |
    a''4^"A" e''4~ e''2 |
    fis''8^"D" e''16 fis''16 fis''8 a''8 fis''8. g''16 fis''16 g''16 fis''8 |
    e''8^"Em" d''16 g''16 fis''4 e''4 b'16 cis''16 d''16 e''16 |
    g''8^"A7" a''16 b''16 a''8 g''8 e''8. d''16 cis''16 d''16 g''8 |
    fis''4^"D" d''4~ d''2 | } }

trackB = { \clef "treble" \key d \major \time 4/4 { fis'4 fis'4 fis'4 fis'4 |
    b4 b'4 b'4 b'4 |
    b'4 b'4 b'4 b'4 |
    cis''4 cis''4 cis''4 cis''4 |
    d''4 d''4 d''4 d''4 |
    e'4 e''4 e'4 e'4 |
    cis''4 cis''4 cis''4 cis'4 |
    d''4 d'4 d'4 d'4 | } }

trackC = { \clef "treble" \key d \major \time 4/4 { d'4 d'4 d'4 d'4 |
    d'4 d'4 d'4 d'4 |
    g'4 g'4 g'4 g'4 |
    a'4 a'4 a'4 a'4 |
    fis'4 fis'4 fis'4 fis'4 |
    g'4 g'4 g'4 g'4 |
    a'4 a'4 a'4 a'4 |
    fis'4 fis'4 fis'4 fis'4 | } }

trackD = { \clef "bass" \key d \major \time 4/4 { d,4 d,4 d,4 d,4 |
    b,4 b,4 b,4 b,4 |
    g,4 g,4 g,4 g,4 |
    a,4 a,4 a,4 a,4 |
    d,4 d,4 d,4 d,4 |
    e,4 e,4 e,4 e,4 |
    a,4 a,4 a,4 a,4 |
    d,4 d,4 d,4 d,4 | } }

\score {
  <<
    \new Staff \with { instrumentName = "Violin 1" } \trackA
    \new Staff \with { instrumentName = "Violin 2" } \trackB
    \new Staff \with { instrumentName = "Viola" } \trackC
    \new Staff \with { instrumentName = "Cello" } \trackD
  >>
  \layout { }
  \midi { }
}