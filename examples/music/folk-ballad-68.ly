\version "2.24.0"
\header {
  title = "6/8 Ballad"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = \drummode { \time 6/8 { \mark "Intro" <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <bd sn>16 sn16 <bd sn>16 sn16 <bd sn>16 sn16 |
    \mark "Verse" <bd cymc>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <bd sn>16 sn16 <bd sn>16 sn16 <bd sn>16 sn16 |
    \mark "Chorus" <bd cymc>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <bd sn>8 tommh8 <bd sn>8 |
    \mark "Verse" <bd cymc>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <bd tomh>16 tomh16 <bd tommh>16 tomml16 <bd tomml>16 tomfh16 |
    \mark "Chorus" <bd cymc>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <bd sn>8 sn8 <bd sn>8 |
    \mark "Bridge" <bd cymc>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <bd sn>8 sn8 <bd sn>8 |
    \mark "Chorus" <bd cymc>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <sn hh>8 hh8 hh8 |
    <bd hh>8 hh8 hh8 <bd sn>8 tommh8 <bd sn>8 |
    \mark "Outro" <bd cymc>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <sn cymr>8 r8 r8 |
    <bd cymr>4 r8 <bd sn>16 sn16 <bd sn>16 sn16 <bd sn>16 sn16 | } }

trackB = { \clef "bass_8" \key d \major \time 6/8 { d,4.\2^"D" a,,8\3~^"A" a,,4\3 |
    b,,4.\3^"Bm" fis,,8\4~^"F#m" fis,,4\4 |
    g,,4.\4^"G" d,8\2~^"D" d,4\2 |
    g,,4.\4^"G" a,,8\3~^"A" a,,4\3 |
    d,2.\2^"D" |
    a,,2.\3^"A" |
    b,,2.\3^"Bm" |
    fis,,2.\4^"F#m" |
    g,,2.\4^"G" |
    d,2.\2^"D" |
    g,,2.\4^"G" |
    a,,2.\3^"A" |
    b,,2.\3^"Bm" |
    g,,2.\4^"G" |
    d,2.\2^"D" |
    a,,2.\3^"A" |
    b,,2.\3^"Bm" |
    g,,2.\4^"G" |
    d,2.\2^"D" |
    a,,2.\3^"A" |
    d,2.\2^"D" |
    a,,2.\3^"A" |
    b,,2.\3^"Bm" |
    fis,,2.\4^"F#m" |
    g,,2.\4^"G" |
    d,2.\2^"D" |
    g,,2.\4^"G" |
    a,,2.\3^"A" |
    b,,2.\3^"Bm" |
    g,,2.\4^"G" |
    d,2.\2^"D" |
    a,,2.\3^"A" |
    b,,2.\3^"Bm" |
    g,,2.\4^"G" |
    d,2.\2^"D" |
    a,,2.\3^"A" |
    g,,2.\4^"G" |
    cis,2.\3^"C#m7b5" |
    g,,2.\4^"G" |
    a,,2.\3^"A" |
    g,,2.\4^"G" |
    cis,2.\3^"C#m7b5" |
    g,,2.\4^"G" |
    a,,2.\3^"A" |
    b,,2.\3^"Bm" |
    g,,2.\4^"G" |
    d,2.\2^"D" |
    a,,2.\3^"A" |
    b,,2.\3^"Bm" |
    g,,2.\4^"G" |
    d,2.\2^"D" |
    a,,2.\3^"A" |
    b,,2.\3^"Bm" |
    g,,2.\4^"G" |
    d,2.\2^"D" |
    d,2.\2^"D" | } }

trackC = { \clef "treble_8" \key d \major \time 6/8 << { d4\4 a8\3 a,8\5~ a,8\5 e8\4 |
    b,4\5 d8\4 fis,8\6~ fis,8\6 a,8\5 |
    g,4\6 b,8\5 d8\4~ d8\4 a8\3 |
    g,4\6 b,8\5 a,8\5~ a,8\5 e8\4 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    b,4\5 d8\4~ d8\4 fis'4\1 |
    fis,4\6 a,8\5~ a,8\5 fis'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    b,4\5 d8\4~ d8\4 fis'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    b,4\5 d8\4~ d8\4 fis'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    b,4\5 d8\4~ d8\4 fis'4\1 |
    fis,4\6 a,8\5~ a,8\5 fis'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    b,4\5 d8\4~ d8\4 fis'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    b,4\5 d8\4~ d8\4 fis'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    cis4\5 e8\4~ e8\4 e'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    cis4\5 e8\4~ e8\4 e'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    b,4\5 d8\4~ d8\4 fis'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    b,4\5 d8\4~ d8\4 fis'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    a,4\5 e8\4~ e8\4 e'4\1 |
    b,4\5 d8\4~ d8\4 fis'4\1 |
    g,4\6 b,8\5~ b,8\5 g'4\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 |
    d4\4 a8\3~ a8\3 fis'8\1 fis'8\1 | } \\ { r8 d'8\2~ d'8\2 r8 a4\3 |
    r8 b8\2~ b8\2 r8 fis4\4 |
    r8 d8\4~ d8\4 r8 d'4\2 |
    r8 d8\4~ d8\4 r8 a4\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 b8\2~ b8\2 b8\3~ b8\3 b8\3 |
    r8 fis8\4~ fis8\4 a8\3~ a8\3 a8\3 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 b8\2~ b8\2 b8\3~ b8\3 b8\3 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 b8\2~ b8\2 b8\3~ b8\3 b8\3 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 b8\2~ b8\2 b8\3~ b8\3 b8\3 |
    r8 fis8\4~ fis8\4 a8\3~ a8\3 a8\3 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 b8\2~ b8\2 b8\3~ b8\3 b8\3 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 b8\2~ b8\2 b8\3~ b8\3 b8\3 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 g8\3~ g8\3 b8\2~ b8\2 b8\2 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 g8\3~ g8\3 b8\2~ b8\2 b8\2 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 b8\2~ b8\2 b8\3~ b8\3 b8\3 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 b8\2~ b8\2 b8\3~ b8\3 b8\3 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 a8\3~ a8\3 cis'8\2~ cis'8\2 cis'8\2 |
    r8 b8\2~ b8\2 b8\3~ b8\3 b8\3 |
    r8 d8\4~ d8\4 g8\3~ g8\3 g8\3 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 |
    r8 d'8\2~ d'8\2 fis'8\1 r4 | } >> }

trackD = { \clef "treble" \key d \major \time 6/8 { r2. |
    r2. |
    r2. |
    r2. |
    d'4 cis'8 r8 d'4 |
    e'4. cis'8 d'8 e'8 |
    d'4 cis'8 r8 d'4 |
    fis'4. a'8~ a'4 |
    b'2. |
    a'2. |
    b'2. |
    a'4. d''8~ d''4 |
    d''4 e''8 d''8~ d''8 fis''8 |
    d''4 e''8 d''8~ d''8 e''8 |
    fis''8 e''8 d''8 d''8 cis''8 d''8 |
    e''4. d''8~ d''4 |
    b'2. |
    g'2. |
    a'4 cis''8 d''8 e''8 d''8 |
    e''4. d''8~ d''4 |
    d'4 cis'8 r8 d'4 |
    e'4. cis'8 d'8 e'8 |
    d'4 cis'8 r8 d'4 |
    fis'4. a'8~ a'4 |
    b'2. |
    a'2. |
    b'2. |
    a'4. d''8~ d''4 |
    d''4 e''8 d''8~ d''8 fis''8 |
    d''4 e''8 d''8~ d''8 e''8 |
    fis''8 e''8 d''8 d''8 cis''8 d''8 |
    e''4. d''8~ d''4 |
    b'2. |
    g'2. |
    a'4 cis''8 d''8 e''8 d''8 |
    e''4. d''8~ d''4 |
    g'4 fis'8 g'8 fis'8 a'8 |
    g'8 b'8 a'8 g'8 fis'4 |
    g'4 fis'8 g'8 fis'8 g'8 |
    a'4. a'8~ a'4 |
    g'8 a'8 b'8 g'8 a'4 |
    b'4. cis''8~ cis''8 d''8 |
    b'8 cis''8 d''8 b'8 cis''4 |
    a'4. d''8~ d''4 |
    d''4 e''8 d''8~ d''8 fis''8 |
    d''4 e''8 d''8~ d''8 e''8 |
    fis''8 e''8 d''8 d''8 cis''8 d''8 |
    e''4. d''8~ d''4 |
    b'2. |
    g'2. |
    a'4 cis''8 d''8 e''8 d''8 |
    e''4. d''8~ d''4 |
    r2. |
    r2. |
    r2. |
    r2. | } }

\score {
  <<
    \new DrumStaff \with { instrumentName = "Drums" } \trackA
    \new StaffGroup \with { instrumentName = "Bass" } << \new Staff { \trackB } \new TabStaff \with { stringTunings = \stringTuning <e,, a,, d, g,> } { \trackB } >>
    \new StaffGroup \with { instrumentName = "Rhythm Guitar" } << \new Staff { \trackC } \new TabStaff \with { stringTunings = \stringTuning <e, a, d g b e'> } { \trackC } >>
    \new Staff \with { instrumentName = "Lead" } \trackD
  >>
  \layout { }
  \midi { }
}