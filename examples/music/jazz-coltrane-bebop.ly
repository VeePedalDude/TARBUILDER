\version "2.24.0"
\header {
  title = "Giant Steps-ish"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = { \clef "treble" \key c \major \time 4/4 \tempo 4 = 168 { f'8^"Dm7" e'8 d'8 c'8 a8 b8 f'8 d'8 |
    ees'8^"Eb7" des'8 bes8 aes8 c'8^"Abmaj7" des'8 ees'8 f'8 |
    fis'8^"B7" aes'8 fis'8 ees'8 e'8^"Emaj7" fis'8 aes'8 a'8 |
    b'8^"G7" c''8 d''8 e''8 g''8^"Cmaj7" fis''8 d''8 b'8 |
    c''8^"Am7" b'8 a'8 g'8 e'8 d'8 c'8 b8 |
    a8^"D7" g8 a8 bes8 c'8 d'8 fis'8 g'8 |
    a'8^"Dm7" b'8 c''8 d''8 f''8 g''8 f''8 g''8 |
    f''8^"G7" e''8 d''8 c''8 b'8 a'8 r4 | } }

trackB = { \clef "treble" \key c \major \time 4/4 { f'1 |
    g'2 g'2 |
    a'2 aes'2 |
    f'2 e'2 |
    g'1 |
    fis'1 |
    f'1 |
    f'1 | } }

trackC = { \clef "bass_8" \key c \major \time 4/4 { d,4\2 c,4\4 d,4\2 c,4\4 |
    ees,4\3 a,,4\3 aes,,4\4 a,,4\3 |
    b,,4\3 f,,4\4 e,,4\4 f,,4\4 |
    g,,4\4 a,,4\3 c,4\3 b,,4\3 |
    a,,4\3 e,4\2 a,,4\3 des,4\3 |
    d,4\2 c,4\3 fis,,4\4 ees,4\2 |
    d,4\2 c,4\3 f,4\2 a,,4\3 |
    g,,4\4 a,,4\3 d,4\2 fis,,4\4 | } }

trackD = \drummode { \time 4/4 { cymr4 <cymr hhp>4 cymr4 <cymr hhp>4 |
    cymr4 <cymr hhp>4 cymr4 <cymr hhp>4 |
    cymr4 <cymr hhp>4 cymr4 <cymr hhp>4 |
    cymr4 <cymr hhp>4 cymr4 <cymr hhp>4 |
    cymr4 <cymr hhp>4 cymr4 <cymr hhp>4 |
    cymr4 <cymr hhp>4 cymr4 <cymr hhp>4 |
    cymr4 <cymr hhp>4 cymr4 <cymr hhp>4 |
    cymr4 <cymr hhp>4 cymr4 <cymr hhp>4 | } }

\score {
  <<
    \new Staff \with { instrumentName = "Tenor Sax" } \trackA
    \new Staff \with { instrumentName = "Guide tones" } \trackB
    \new StaffGroup \with { instrumentName = "Bass" } << \new Staff { \trackC } \new TabStaff \with { stringTunings = \stringTuning <e,, a,, d, g,> } { \trackC } >>
    \new DrumStaff \with { instrumentName = "Drums" } \trackD
  >>
  \layout { }
  \midi { }
}