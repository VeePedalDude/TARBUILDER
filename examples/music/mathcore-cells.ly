\version "2.24.0"
\header {
  title = "Mathcore Cells"
  composer = "VeePedalDude"
  tagline = "TARBUILDER"
}

trackA = \drummode { \time 7/8 { \mark "Intro" <bd cymc>16 sn16 <bd cymc>16 sn16 <bd cymc>16 sn16 <bd cymc>16 sn16 <bd cymc>16 sn16 <bd cymc>16 sn16 <bd cymc>16 sn16 |
    <bd cymc>16 sn16 <bd cymc>16 sn16 <bd cymc>16 sn16 <bd cymc>16 <bd tomh>16 tomh16 <bd tommh>16 tommh16 <bd tomml>16 tomml16 <bd tomfh>16 |
    \mark "Cell A" <bd cymc>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 |
    <bd cymr>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 |
    \time 5/8 <bd cymr>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 |
    \time 13/16 <bd cymr>16 cymr16 <sn cymr>16 cymr16 <bd cymr>16 cymr16 <bd tomh>16 tomh16 <bd tommh>16 tommh16 <bd tomml>16 tomml16 <bd tomfh>16 |
    \time 4/4 \mark "Cell B" <cymc bd>8 <hh bd>8 <hh bd>8 <hh bd>16 bd16 <sn hh>16 bd16 hh16 bd16 hh16 bd16 <hh bd>8 |
    <hh bd>8 <hh bd>8 <hh bd>16 bd16 hh16 bd16 <sn hh>16 bd16 hh16 bd16 <hh bd>8 <hh bd>8 |
    <hh bd>8 <hh bd>16 bd16 hh16 bd16 hh16 bd16 <sn hh>16 bd16 <hh bd>8 <hh bd>8 <hh bd>8 |
    <hh bd>16 bd16 hh16 bd16 hh16 bd16 hh16 bd16 <sn bd>16 tomh16 <sn bd>16 tommh16 <sn bd>16 tomml16 <sn bd>16 <tomfh bd>16 |
    \time 7/8 \mark "Cell A" <bd cymc>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 |
    <bd cymr>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 |
    \time 5/8 <bd cymr>8 <sn cymr>8 <bd cymr>8 <sn cymr>8 <bd cymr>8 |
    \time 13/16 <bd cymr>16 cymr16 <sn cymr>16 cymr16 <bd cymr>16 cymr16 <bd sn>16 tomh16 <bd sn>16 tommh16 <bd sn>16 tomml16 <bd sn>16 |
    \time 4/4 \mark "Spiral" <bd cymc>8 sn8 \tuplet 3/2 { bd8 } \tuplet 9/8 { sn16 bd8 } bd8 sn16 bd16 \tuplet 3/2 { bd8 sn16 bd32 bd32 sn8 } |
    <bd cymc>8 sn32 bd32 bd32 sn32 \tuplet 3/2 { bd8 sn4 } bd16 \tuplet 3/2 { sn32 r32 bd32 } bd16 sn16 \tuplet 3/2 { bd16 sn32 bd32 bd8 sn8 } |
    \time 3/4 \tuplet 3/2 { <bd cymc>8 sn8 } \tuplet 9/8 { bd32 bd16 } \tuplet 3/2 { bd32 sn32 bd32 bd32 sn4 } bd8 sn8 |
    \time 5/4 <bd cymc>8 sn8 \tuplet 3/2 { bd8 } \tuplet 9/8 { sn16 bd8 } bd8 sn16 bd16 \tuplet 3/2 { bd8 sn16 bd32 bd32 sn8 } bd16 sn16 bd32 bd32 sn16 |
    \time 4/4 \mark "Breakdown" <bd cymch cymc>8. bd16 cymch16 bd16 r8 <bd sn cymch>8. bd16 cymch4 |
    <bd cymch>8. bd16 cymch16 bd16 r8 <bd sn cymch>8. bd16 cymch4 |
    <bd cymch>8. bd16 cymch16 bd16 r8 <bd sn cymch>8. bd16 cymch4 |
    <bd cymch>8. bd16 cymch16 bd16 r8 <bd sn cymch>8. bd16 cymch4 |
    <bd cymch>8. bd16 cymch16 bd16 r8 <bd sn cymch>8. bd16 cymch8 bd16 bd16 |
    <bd cymch>8. bd16 cymch16 bd16 r8 <bd sn cymch>8. bd16 cymch8 bd16 bd16 |
    <bd cymch>8. bd16 cymch16 bd16 r8 <bd sn cymch>8. bd16 cymch8 bd16 bd16 |
    <bd cymch>8. bd16 cymch16 bd16 r8 <bd sn cymch>8. bd16 cymch8 bd16 bd16 | } }

trackB = { \clef "bass_8" \key c \minor \time 7/8 { c,,16\4^"Cm" c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 des,,16\4^"Db" des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 |
    c,,16\4^"Cm" c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 des,,16\4^"Db" des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 |
    c,,16\4^"Cm" c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 |
    des,,16\4^"Db" des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 |
    \time 5/8 c,,16\4^"Cm" c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 |
    \time 13/16 des,,16\4^"Db" des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 |
    \time 4/4 c,,16\4^"Cm" r16 c,,16\4 r16 c,,16\4 r16 c,,16\4 c,,16\4 r16 c,,16\4 r16 c,,16\4 r16 c,,16\4 c,,16\4 r16 |
    c,,16\4^"Bb" r16 c,,16\4 r16 c,,16\4 c,,16\4 r16 c,,16\4 r16 c,,16\4 r16 c,,16\4 c,,16\4 r16 c,,16\4 r16 |
    c,,16\4^"Ab" r16 c,,16\4 c,,16\4 r16 c,,16\4 r16 c,,16\4 r16 c,,16\4 c,,16\4 r16 c,,16\4 r16 c,,16\4 r16 |
    c,,16\4^"Bb" c,,16\4 r16 c,,16\4 r16 c,,16\4 r16 c,,16\4 c,,16\4 r16 c,,16\4 r16 c,,16\4 r16 c,,16\4 c,,16\4 |
    \time 7/8 c,,16\4^"Cm" c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 |
    des,,16\4^"Db" des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 |
    \time 5/8 c,,16\4^"Cm" c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 c,,16\4 |
    \time 13/16 des,,16\4^"Db" des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 des,,16\4 |
    \time 4/4 \tuplet 9/8 { c,,16\4^"Cm" c,,32\4 } \tuplet 15/8 { r32 des,,16\4 c,,32\4 ges,,32\4 } \tuplet 3/2 { c,,8\4 } \tuplet 25/16 { c,,16\4 c,,16\4 des,,32\4 } \tuplet 5/4 { c,,8\4 ges,,16\4 } \tuplet 15/8 { c,,32\4 c,,32\4 des,,32\4 } \tuplet 5/4 { c,,8\4 ges,,16\4 c,,16\4 c,,16\4 } \tuplet 15/8 { c,,16\4 des,,32\4 } \tuplet 5/4 { c,,16\4 } \tuplet 15/8 { ges,,32\4 c,,16\4 } \tuplet 5/4 { c,,16\4 } |
    \tuplet 3/2 { c,,16\4^"Db" } \tuplet 9/8 { c,,64\4 des,,64\4 c,,64\4 } \tuplet 15/8 { r32 ges,,16\4 c,,32\4 c,,32\4 } \tuplet 3/2 { des,,8\4 } \tuplet 5/4 { c,,16\4 } \tuplet 25/16 { c,,64\4 des,,32\4 c,,32\4 } \tuplet 5/4 { ges,,8\4 c,,16\4 } \tuplet 15/8 { c,,32\4 c,,32\4 des,,32\4 } \tuplet 5/4 { r8 c,,16\4 ges,,16\4 c,,16\4 } \tuplet 15/8 { c,,16\4 des,,32\4 } \tuplet 5/4 { r16 } \tuplet 15/8 { c,,32\4 ges,,16\4 } \tuplet 5/4 { c,,16\4 } |
    \time 3/4 \tuplet 3/2 { c,,8\4^"Cm" } \tuplet 9/8 { c,,32\4 des,,32\4 c,,32\4 } \tuplet 15/8 { ges,,16\4 c,,32\4 c,,32\4 des,,32\4 } \tuplet 3/2 { c,,8\4 } \tuplet 9/8 { c,,32\4 des,,32\4 r32 } \tuplet 3/2 { c,,8\4 } \tuplet 15/8 { c,,32\4 c,,32\4 des,,32\4 c,,16\4 } \tuplet 3/2 { ges,,8\4 c,,8\4 } |
    \time 5/4 \tuplet 9/8 { c,,16\4^"Db" c,,32\4 } \tuplet 15/8 { r32 des,,16\4 c,,32\4 ges,,32\4 } \tuplet 3/2 { c,,8\4 } \tuplet 25/16 { c,,16\4 c,,16\4 des,,32\4 } \tuplet 5/4 { c,,8\4 ges,,16\4 } \tuplet 15/8 { c,,32\4 c,,32\4 des,,32\4 } \tuplet 5/4 { c,,8\4 ges,,16\4 c,,16\4 c,,16\4 } \tuplet 15/8 { c,,16\4 des,,32\4 } \tuplet 5/4 { c,,16\4 } \tuplet 15/8 { ges,,32\4 c,,16\4 } \tuplet 5/4 { c,,16\4 } \tuplet 9/8 { c,,32\4 c,,32\4 des,,32\4 } \tuplet 15/8 { c,,16\4 ges,,16\4 c,,16\4 c,,8\4 } |
    \time 4/4 c,,16\4^"Cm" r16 r16 c,,16\4~ c,,16\4 c,,16\4 r8 c,,8\4 r16 c,,16\4~ c,,16\4 r16 r8 |
    c,,16\4^"Cm" r16 r16 c,,16\4~ c,,16\4 c,,16\4 r8 c,,8\4 r16 c,,16\4~ c,,16\4 r16 r8 |
    c,,16\4^"Cm" r16 r16 c,,16\4~ c,,16\4 c,,16\4 r8 c,,8\4 r16 c,,16\4~ c,,16\4 r16 r8 |
    c,,16\4^"Cm" r16 r16 c,,16\4~ c,,16\4 c,,16\4 r8 c,,8\4 r16 c,,16\4~ c,,16\4 r16 r8 |
    c,,16\4^"Cm" r16 r16 c,,16\4~ c,,16\4 c,,16\4 r8 c,,8\4 r16 c,,16\4~ c,,16\4 r16 c,,16\4 c,,16\4 |
    c,,16\4^"Cm" r16 r16 c,,16\4~ c,,16\4 c,,16\4 r8 c,,8\4 r16 c,,16\4~ c,,16\4 r16 c,,16\4 c,,16\4 |
    c,,16\4^"Cm" r16 r16 c,,16\4~ c,,16\4 c,,16\4 r8 c,,8\4 r16 c,,16\4~ c,,16\4 r16 c,,16\4 c,,16\4 |
    c,,16\4^"Cm" r16 r16 c,,16\4~ c,,16\4 c,,16\4 r8 c,,8\4 r16 c,,16\4~ c,,16\4 r16 c,,16\4 c,,16\4 | } }

trackC = { \clef "treble_8" \key c \minor \time 7/8 { <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 |
    <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 |
    <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 |
    <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 |
    \time 5/8 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 |
    \time 13/16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 |
    \time 4/4 <g,\5 c,\6>16 r16 c,16\6 r16 c,16\6 r16 c,16\6 <g,\5 c,\6>16 r16 c,16\6 r16 c,16\6 r16 c,16\6 <g,\5 c,\6>16 r16 |
    c,16\6 r16 c,16\6 r16 c,16\6 <g,\5 c,\6>16 r16 c,16\6 r16 c,16\6 r16 c,16\6 <g,\5 c,\6>16 r16 c,16\6 r16 |
    c,16\6 r16 c,16\6 <g,\5 c,\6>16 r16 c,16\6 r16 c,16\6 r16 c,16\6 <g,\5 c,\6>16 r16 c,16\6 r16 c,16\6 r16 |
    c,16\6 <g,\5 c,\6>16 r16 c,16\6 r16 c,16\6 r16 c,16\6 <g,\5 c,\6>16 r16 c,16\6 r16 c,16\6 r16 c,16\6 <g,\5 c,\6>16 |
    \time 7/8 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 |
    <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 |
    \time 5/8 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 <c\4 g,\5 c,\6>16 |
    \time 13/16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 <des\4 aes,\5 des,\6>16 |
    \time 4/4 \tuplet 9/8 { c,16\6 c,32\6 } \tuplet 15/8 { r32 des,16\6 c,32\6 ges,32\6 } \tuplet 3/2 { c,8\6 } \tuplet 25/16 { c,16\6 c,16\6 des,32\6 } \tuplet 5/4 { c,8\6 ges,16\6 } \tuplet 15/8 { c,32\6 c,32\6 des,32\6 } \tuplet 5/4 { c,8\6 ges,16\6 c,16\6 c,16\6 } \tuplet 15/8 { c,16\6 des,32\6 } \tuplet 5/4 { c,16\6 } \tuplet 15/8 { ges,32\6 c,16\6 } \tuplet 5/4 { c,16\6 } |
    \tuplet 3/2 { c,16\6 } \tuplet 9/8 { c,64\6 des,64\6 c,64\6 } \tuplet 15/8 { r32 ges,16\6 c,32\6 c,32\6 } \tuplet 3/2 { des,8\6 } \tuplet 5/4 { c,16\6 } \tuplet 25/16 { c,64\6 des,32\6 c,32\6 } \tuplet 5/4 { ges,8\6 c,16\6 } \tuplet 15/8 { c,32\6 c,32\6 des,32\6 } \tuplet 5/4 { r8 c,16\6 ges,16\6 c,16\6 } \tuplet 15/8 { c,16\6 des,32\6 } \tuplet 5/4 { r16 } \tuplet 15/8 { c,32\6 ges,16\6 } \tuplet 5/4 { c,16\6 } |
    \time 3/4 \tuplet 3/2 { c,8\6 } \tuplet 9/8 { c,32\6 des,32\6 c,32\6 } \tuplet 15/8 { ges,16\6 c,32\6 c,32\6 des,32\6 } \tuplet 3/2 { c,8\6 } \tuplet 9/8 { c,32\6 des,32\6 r32 } \tuplet 3/2 { c,8\6 } \tuplet 15/8 { c,32\6 c,32\6 des,32\6 c,16\6 } \tuplet 3/2 { ges,8\6 c,8\6 } |
    \time 5/4 \tuplet 9/8 { c,16\6 c,32\6 } \tuplet 15/8 { r32 des,16\6 c,32\6 ges,32\6 } \tuplet 3/2 { c,8\6 } \tuplet 25/16 { c,16\6 c,16\6 des,32\6 } \tuplet 5/4 { c,8\6 ges,16\6 } \tuplet 15/8 { c,32\6 c,32\6 des,32\6 } \tuplet 5/4 { c,8\6 ges,16\6 c,16\6 c,16\6 } \tuplet 15/8 { c,16\6 des,32\6 } \tuplet 5/4 { c,16\6 } \tuplet 15/8 { ges,32\6 c,16\6 } \tuplet 5/4 { c,16\6 } \tuplet 9/8 { c,32\6 c,32\6 des,32\6 } \tuplet 15/8 { c,16\6 ges,16\6 c,16\6 c,8\6 } |
    \time 4/4 <g,\5 c,\6>16 r16 r16 c,16\6~ c,16\6 c,16\6 r8 c,8\6 r16 c,16\6~ c,16\6 r16 r8 |
    <g,\5 c,\6>16 r16 r16 c,16\6~ c,16\6 c,16\6 r8 c,8\6 r16 <g,\5 c,\6>16~ <g,\5 c,\6>16 r16 r8 |
    <g,\5 c,\6>16 r16 r16 c,16\6~ c,16\6 c,16\6 r8 c,8\6 r16 <g,\5 c,\6>16~ <g,\5 c,\6>16 r16 r8 |
    <g,\5 c,\6>16 r16 r16 c,16\6~ c,16\6 c,16\6 r8 c,8\6 r16 <g,\5 c,\6>16~ <g,\5 c,\6>16 r16 r8 |
    <g,\5 c,\6>16 r16 r16 c,16\6~ c,16\6 c,16\6 r8 c,8\6 r16 <g,\5 c,\6>16~ <g,\5 c,\6>16 r16 c,16\6 c,16\6 |
    <g,\5 c,\6>16 r16 r16 c,16\6~ c,16\6 c,16\6 r8 c,8\6 r16 c,16\6~ c,16\6 r16 c,16\6 c,16\6 |
    <g,\5 c,\6>16 r16 r16 c,16\6~ c,16\6 c,16\6 r8 c,8\6 r16 <c\4 c,\6>16~ <c\4 c,\6>16 r16 c,16\6 c,16\6 |
    <g,\5 c,\6>16 r16 r16 c,16\6~ c,16\6 c,16\6 r8 c,8\6 r16 <c\4 c,\6>16~ <c\4 c,\6>16 r16 c,16\6 c,16\6 | } }

\score {
  <<
    \new DrumStaff \with { instrumentName = "Drums" } \trackA
    \new StaffGroup \with { instrumentName = "Bass" } << \new Staff { \trackB } \new TabStaff \with { stringTunings = \stringTuning <c,, g,, c, f,> } { \trackB } >>
    \new StaffGroup \with { instrumentName = "Rhythm Guitar" } << \new Staff { \trackC } \new TabStaff \with { stringTunings = \stringTuning <c, g, c f a d'> } { \trackC } >>
  >>
  \layout { }
  \midi { }
}