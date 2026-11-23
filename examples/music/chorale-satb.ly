\version "2.24.0"
\header {
  title = "Chorale in G"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = { \clef "treble" \key g \major \time 4/4 \tempo 4 = 66 { b'1 |
    a'1 |
    g'1 |
    fis'1 |
    e'1 |
    g'1~ |
    g'1 |
    fis'1 |
    g'1 | } }

trackB = { \clef "treble" \key g \major \time 4/4 { d'1~ |
    d'1 |
    e'1 |
    d'1 |
    c'1 |
    d'1 |
    c'1~ |
    c'1 |
    b1 | } }

trackC = { \clef "treble" \key g \major \time 4/4 { g1 |
    a1 |
    b1~ |
    b1 |
    g1~ |
    g1 |
    a1~ |
    a1 |
    g1 | } }

trackD = { \clef "bass" \key g \major \time 4/4 { g1 |
    fis1 |
    e1 |
    b,1 |
    c1 |
    b,1 |
    c1 |
    d1 |
    g1 | } }

\score {
  <<
    \new Staff \with { instrumentName = "Soprano" } \trackA
    \new Staff \with { instrumentName = "Alto" } \trackB
    \new Staff \with { instrumentName = "Tenor" } \trackC
    \new Staff \with { instrumentName = "Bass" } \trackD
  >>
  \layout { }
  \midi { }
}